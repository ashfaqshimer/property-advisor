"""Langfuse tracing integration for the agent loop and tools.

Tracing is entirely optional and fails silently:
- If `LANGFUSE_PUBLIC_KEY` or `LANGFUSE_SECRET_KEY` is missing or blank, all tracing
  calls resolve to no-ops with zero overhead.
- When enabled, each turn creates an observed trace tagged with the `session_id`,
  recording each model generation iteration (prompt, completion, tokens, latency)
  and nested tool execution observations following Langfuse best practices.
"""

from __future__ import annotations

import json
from contextlib import contextmanager
from functools import lru_cache
from typing import Any, Iterator

from google.genai import types
from langfuse import Langfuse, propagate_attributes
import structlog

from app.config import get_settings

logger = structlog.get_logger()


class _NoOpObservation:
    """Mock observation used when Langfuse is disabled or unconfigured."""

    def update(self, *args: Any, **kwargs: Any) -> None:
        pass

    def end(self, *args: Any, **kwargs: Any) -> None:
        pass


_NOOP = _NoOpObservation()


@lru_cache
def get_langfuse() -> Langfuse | None:
    """Process-wide Langfuse client instance.

    Returns None if Langfuse is not enabled or credentials are missing.
    """
    settings = get_settings()
    if not settings.langfuse_configured:
        return None

    try:
        return Langfuse(
            public_key=settings.langfuse_public_key.strip(),
            secret_key=settings.langfuse_secret_key.strip(),
            base_url=settings.langfuse_host.strip() or "https://cloud.langfuse.com",
            environment=settings.app_environment,
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("langfuse_initialization_failed", error=str(exc))
        return None


def format_contents_for_trace(contents: list[types.Content]) -> list[dict[str, Any]]:
    """Convert Gemini Content parts into OpenAI-style role-labeled message dicts.

    Langfuse natively renders OpenAI-style messages (role: user/assistant/tool)
    with conversation bubbles and tool cards in the trace tree and session views.
    """
    formatted: list[dict[str, Any]] = []
    for content in contents:
        role = "assistant" if content.role == "model" else content.role
        text_parts: list[str] = []
        tool_calls: list[dict[str, Any]] = []

        for part in content.parts or []:
            if part.text:
                text_parts.append(part.text)
            elif part.function_call:
                tool_calls.append(
                    {
                        "id": f"call_{part.function_call.name}",
                        "type": "function",
                        "function": {
                            "name": part.function_call.name,
                            "arguments": json.dumps(dict(part.function_call.args or {})),
                        },
                    }
                )
            elif part.function_response:
                formatted.append(
                    {
                        "role": "tool",
                        "name": part.function_response.name,
                        "tool_call_id": f"call_{part.function_response.name}",
                        "content": json.dumps(part.function_response.response),
                    }
                )

        if text_parts or tool_calls:
            msg: dict[str, Any] = {
                "role": role,
                "content": "".join(text_parts) if text_parts else None,
            }
            if tool_calls:
                msg["tool_calls"] = tool_calls
            formatted.append(msg)

    return formatted


@contextmanager
def trace_turn(session_id: str, user_message: str) -> Iterator[Any]:
    """Trace a full turn of Amaya's conversation loop.

    Creates an observation of type 'agent' tagged with the chat `session_id`,
    enabling Langfuse's Agent Graph and Sessions replay.
    """
    client = get_langfuse()
    if client is None:
        yield _NOOP
        return

    settings = get_settings()
    try:
        prop_ctx = propagate_attributes(
            session_id=session_id,
            tags=[settings.app_environment, "real-estate-chat"],
            metadata={"environment": settings.app_environment},
        )
        obs_ctx = client.start_as_current_observation(
            name="agent-turn",
            as_type="agent",
            input={"user_message": user_message},
            metadata={
                "session_id": session_id,
                "environment": settings.app_environment,
            },
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("langfuse_trace_turn_failed", error=str(exc))
        yield _NOOP
        return

    with prop_ctx:
        with obs_ctx as span:
            yield span


@contextmanager
def trace_generation(
    name: str,
    model: str,
    input_data: Any = None,
    metadata: dict[str, Any] | None = None,
) -> Iterator[Any]:
    """Trace a single Gemini model generation call within a turn."""
    client = get_langfuse()
    if client is None:
        yield _NOOP
        return

    try:
        obs_ctx = client.start_as_current_observation(
            name=name,
            as_type="generation",
            model=model,
            input=input_data,
            metadata=metadata,
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("langfuse_trace_generation_failed", error=str(exc))
        yield _NOOP
        return

    with obs_ctx as gen:
        yield gen


@contextmanager
def trace_tool(name: str, args: dict[str, Any]) -> Iterator[Any]:
    """Trace the execution of an agent tool call as a native 'tool' observation."""
    client = get_langfuse()
    if client is None:
        yield _NOOP
        return

    try:
        obs_ctx = client.start_as_current_observation(
            name=f"tool-{name}",
            as_type="tool",
            input=args,
            metadata={"tool_name": name},
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("langfuse_trace_tool_failed", error=str(exc))
        yield _NOOP
        return

    with obs_ctx as span:
        yield span


def flush_traces() -> None:
    """Flush pending traces to the Langfuse backend."""
    client = get_langfuse()
    if client is not None:
        try:
            client.flush()
        except Exception as exc:  # noqa: BLE001
            logger.warning("langfuse_flush_failed", error=str(exc))
