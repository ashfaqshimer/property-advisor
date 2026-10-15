"""Tests for Langfuse tracing helpers in app.agent.tracing."""

from unittest.mock import MagicMock, patch
from google.genai import types

from app.agent.tracing import (
    _NoOpObservation,
    flush_traces,
    format_contents_for_trace,
    get_langfuse,
    trace_generation,
    trace_tool,
    trace_turn,
)
from app.config import Settings


def test_format_contents_for_trace():
    contents = [
        types.Content(role="user", parts=[types.Part.from_text(text="Hi")]),
        types.Content(
            role="model",
            parts=[
                types.Part.from_function_call(
                    name="search_properties",
                    args={"location": "Colombo 5"},
                )
            ],
        ),
        types.Content(
            role="user",
            parts=[
                types.Part.from_function_response(
                    name="search_properties",
                    response={"count": 1},
                )
            ],
        ),
    ]

    formatted = format_contents_for_trace(contents)
    assert len(formatted) == 3
    assert formatted[0]["role"] == "user"
    assert formatted[0]["content"] == "Hi"

    assert formatted[1]["role"] == "assistant"
    assert formatted[1]["tool_calls"][0]["function"]["name"] == "search_properties"
    assert "Colombo 5" in formatted[1]["tool_calls"][0]["function"]["arguments"]

    assert formatted[2]["role"] == "tool"
    assert formatted[2]["name"] == "search_properties"
    assert formatted[2]["tool_call_id"] == "call_search_properties"


def test_unconfigured_tracing_is_noop(monkeypatch):
    get_langfuse.cache_clear()
    settings = Settings(
        database_url="sqlite://",
        gemini_model="fake",
        langfuse_public_key="",
        langfuse_secret_key="",
        langfuse_enabled=True,
    )
    monkeypatch.setattr("app.agent.tracing.get_settings", lambda: settings)

    assert get_langfuse() is None

    with trace_turn("sess_123", "Hello") as turn:
        assert isinstance(turn, _NoOpObservation)
        turn.update(output="Done")

    with trace_generation("llm", "gemini", []) as gen:
        assert isinstance(gen, _NoOpObservation)
        gen.update(output="Result")

    with trace_tool("search_properties", {}) as tool:
        assert isinstance(tool, _NoOpObservation)
        tool.update(output={"status": "ok"})

    flush_traces()


def test_configured_tracing_invokes_client(monkeypatch):
    get_langfuse.cache_clear()
    settings = Settings(
        database_url="sqlite://",
        gemini_model="fake",
        langfuse_public_key="pk-lf-test",
        langfuse_secret_key="sk-lf-test",
        langfuse_enabled=True,
    )
    monkeypatch.setattr("app.agent.tracing.get_settings", lambda: settings)

    mock_client = MagicMock()
    monkeypatch.setattr("app.agent.tracing.Langfuse", lambda **kw: mock_client)

    client = get_langfuse()
    assert client is mock_client

    with trace_turn("sess_123", "Hello") as turn:
        turn.update(output="Amaya reply")

    assert mock_client.start_as_current_observation.called
    get_langfuse.cache_clear()
