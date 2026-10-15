"""The Gemini wrapper — the only module that constructs a `genai.Client`.

Two design points worth keeping:

**The client is built lazily.** `app.db.session` can build its engine at import time
because `create_engine()` never connects, but a missing API key is a different problem:
it has to fail, and failing at import would make `import app.agent` impossible in a test
suite that has no key. So construction happens on first `generate()`, and
`GeminiNotConfigured` says which variable is missing rather than surfacing whatever the
SDK raises three frames down.

**The loop depends on the `SupportsGenerate` protocol, not on this class.** That is what
lets the tests drive the whole loop from a scripted fake with no network and no key —
see `tests/agent_fakes.py`. Nothing here is mocked by patching.

Automatic function calling is switched *off* explicitly. The SDK will execute Python
callables itself if you hand it any, which would silently replace the hand-rolled loop
this project exists to demonstrate. We pass `FunctionDeclaration`s rather than callables,
so it wouldn't trigger today — the flag is there so it can't start.
"""

from __future__ import annotations

from functools import lru_cache
import random
import time
from typing import Any, Callable, Protocol, TypeVar

from google import genai
from google.genai import errors as genai_errors
from google.genai import types
import httpx
import structlog

from app.config import get_settings

logger = structlog.get_logger()

TRANSIENT_STATUS_CODES = {429, 500, 502, 503, 504}
T = TypeVar("T")


def is_transient_error(exc: Exception) -> bool:
    """True if `exc` is a temporary network or upstream server/rate error worth retrying."""
    if isinstance(exc, genai_errors.APIError):
        code = getattr(exc, "code", None)
        return code in TRANSIENT_STATUS_CODES
    if isinstance(exc, (httpx.TimeoutException, httpx.NetworkError, httpx.ConnectError)):
        return True
    return False


def retry_with_backoff(
    fn: Callable[[], T],
    max_attempts: int = 3,
    base_delay: float = 0.5,
    description: str = "gemini_call",
) -> T:
    """Execute `fn` with exponential backoff on transient upstream errors."""
    for attempt in range(max_attempts):
        try:
            return fn()
        except Exception as exc:
            if not is_transient_error(exc) or attempt == max_attempts - 1:
                raise
            delay = base_delay * (2 ** attempt) + random.uniform(0.05, 0.2)
            logger.warning(
                "gemini_transient_error_retry",
                operation=description,
                attempt=attempt + 1,
                delay_seconds=round(delay, 2),
                error=str(exc),
            )
            time.sleep(delay)
    raise RuntimeError("unreachable")


class GeminiNotConfigured(RuntimeError):
    """Raised on first use when `GEMINI_API_KEY` is missing or blank."""


class SupportsGenerate(Protocol):
    """What `loop.run_turn` actually needs. Implemented by `GeminiClient` and by fakes."""

    def generate(
        self,
        contents: list[types.Content],
        tools: list[types.Tool],
        system_instruction: str,
    ) -> types.GenerateContentResponse: ...

    def generate_stream(
        self,
        contents: list[types.Content],
        tools: list[types.Tool],
        system_instruction: str,
    ) -> Any: ...

    def count_tokens(
        self,
        contents: list[types.Content] | str,
    ) -> int: ...


class GeminiClient:
    """Thin pass-through to `client.models.generate_content`.

    Deliberately holds no conversation state: history is rebuilt from the `messages`
    table on every turn, so a second process serving the same session behaves identically.
    """

    def __init__(self, api_key: str, model: str) -> None:
        if not api_key.strip():
            raise GeminiNotConfigured(
                "GEMINI_API_KEY is not set. Add it to backend/.env "
                "(AI Studio → Get API key) before running the agent."
            )
        self._model = model
        self._client = genai.Client(api_key=api_key)

    @property
    def model(self) -> str:
        return self._model

    def generate(
        self,
        contents: list[types.Content],
        tools: list[types.Tool],
        system_instruction: str,
    ) -> types.GenerateContentResponse:
        return retry_with_backoff(
            lambda: self._client.models.generate_content(
                model=self._model,
                contents=contents,
                config=types.GenerateContentConfig(
                    system_instruction=system_instruction,
                    tools=tools,
                    automatic_function_calling=types.AutomaticFunctionCallingConfig(
                        disable=True
                    ),
                ),
            ),
            description="generate_content",
        )

    def generate_stream(
        self,
        contents: list[types.Content],
        tools: list[types.Tool],
        system_instruction: str,
    ) -> Any:
        def start_stream():
            return self._client.models.generate_content_stream(
                model=self._model,
                contents=contents,
                config=types.GenerateContentConfig(
                    system_instruction=system_instruction,
                    tools=tools,
                    automatic_function_calling=types.AutomaticFunctionCallingConfig(
                        disable=True
                    ),
                ),
            )

        max_attempts = 3
        base_delay = 0.5
        for attempt in range(max_attempts):
            try:
                stream = start_stream()
                it = iter(stream)
                try:
                    first_chunk = next(it)
                except StopIteration:
                    return iter([])

                def stream_wrapper():
                    yield first_chunk
                    yield from it

                return stream_wrapper()
            except Exception as exc:
                if not is_transient_error(exc) or attempt == max_attempts - 1:
                    raise
                delay = base_delay * (2 ** attempt) + random.uniform(0.05, 0.2)
                logger.warning(
                    "gemini_stream_retry",
                    attempt=attempt + 1,
                    delay_seconds=round(delay, 2),
                    error=str(exc),
                )
                time.sleep(delay)

    def generate_structured(
        self,
        prompt: str,
        schema: Any,
    ) -> Any:
        response = retry_with_backoff(
            lambda: self._client.models.generate_content(
                model=self._model,
                contents=[prompt],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=schema,
                ),
            ),
            description="generate_structured",
        )
        return response.parsed

    def count_tokens(
        self,
        contents: list[types.Content] | str,
    ) -> int:
        """Count the number of tokens in a prompt without generating a response."""
        response = self._client.models.count_tokens(
            model=self._model,
            contents=contents,
        )
        return response.total_tokens


@lru_cache
def get_gemini_client() -> GeminiClient:
    """Process-wide client. Cached because `genai.Client` holds a connection pool.

    The model string comes from settings and is never inlined at a call site — swapping
    `flash-lite` for the non-lite Flash is then a one-line config change, per CLAUDE.md.
    """
    settings = get_settings()
    return GeminiClient(api_key=settings.gemini_api_key, model=settings.gemini_model)


@lru_cache
def get_gemini_extractor_client() -> GeminiClient:
    """Separate client specifically for data extraction if a different key is configured."""
    settings = get_settings()
    # Fallback to the main key if extractor key is not set
    key = settings.gemini_extractor_api_key or settings.gemini_api_key
    return GeminiClient(api_key=key, model=settings.gemini_model)
