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
from typing import Protocol

from google import genai
from google.genai import types

from app.config import get_settings


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
        return self._client.models.generate_content(
            model=self._model,
            contents=contents,
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                tools=tools,
                # See the module docstring: the loop is ours, not the SDK's.
                automatic_function_calling=types.AutomaticFunctionCallingConfig(
                    disable=True
                ),
            ),
        )


@lru_cache
def get_gemini_client() -> GeminiClient:
    """Process-wide client. Cached because `genai.Client` holds a connection pool.

    The model string comes from settings and is never inlined at a call site — swapping
    `flash-lite` for the non-lite Flash is then a one-line config change, per CLAUDE.md.
    """
    settings = get_settings()
    return GeminiClient(api_key=settings.gemini_api_key, model=settings.gemini_model)
