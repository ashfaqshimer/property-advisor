"""A scripted stand-in for Gemini.

`loop.run_turn` takes a client implementing `client.SupportsGenerate`, so the whole loop —
tool dispatch, persistence, sequencing, the iteration cap — runs offline against real
`google.genai.types` objects. Nothing is patched and no key is needed.

**What this cannot prove.** The fake supplies the reply text, so every assertion about
what Amaya *says* is an assertion about this file, not about the model. Prompt adherence —
not inventing listings, not denying coverage, admitting she's an AI — is only observable
against the live model, and is recorded as manual verification in
context/features/agent-core/spec.md. A green suite here means the plumbing is right.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from google.genai import types


def text_response(text: str) -> types.GenerateContentResponse:
    """A plain prose turn — the loop's exit condition."""
    return _response([types.Part.from_text(text=text)])


def call_response(
    name: str, args: dict[str, Any] | None = None, text: str | None = None
) -> types.GenerateContentResponse:
    """A function_call turn, optionally carrying prose alongside it.

    Gemini does return both at once, and the loop has to execute the call rather than
    stopping at the text — hence `text` being available here.
    """
    parts: list[types.Part] = []
    if text is not None:
        parts.append(types.Part.from_text(text=text))
    parts.append(types.Part.from_function_call(name=name, args=args or {}))
    return _response(parts)


def empty_response() -> types.GenerateContentResponse:
    """No candidates at all — a safety block or a bad day upstream."""
    return types.GenerateContentResponse(candidates=[])


def contentless_response() -> types.GenerateContentResponse:
    """A candidate with no content — the other shape a blocked response arrives in."""
    return types.GenerateContentResponse(candidates=[types.Candidate(content=None)])


def _response(parts: list[types.Part]) -> types.GenerateContentResponse:
    return types.GenerateContentResponse(
        candidates=[
            types.Candidate(content=types.Content(role="model", parts=parts))
        ]
    )


@dataclass
class Turn:
    """One recorded call into the fake, so tests can assert on what the loop sent."""

    contents: list[types.Content]
    tools: list[types.Tool]
    system_instruction: str


@dataclass
class ScriptedGemini:
    """Returns queued responses in order.

    Set `repeat_last=True` to keep returning the final response forever — that's how the
    iteration-cap test builds a model that never stops calling tools.
    """

    responses: list[types.GenerateContentResponse]
    repeat_last: bool = False
    turns: list[Turn] = field(default_factory=list)

    @property
    def call_count(self) -> int:
        return len(self.turns)

    def generate(
        self,
        contents: list[types.Content],
        tools: list[types.Tool],
        system_instruction: str,
    ) -> types.GenerateContentResponse:
        # Copied, not referenced: the loop appends to its own `contents` list as it goes,
        # so holding the live object would make every recorded turn look identical.
        self.turns.append(
            Turn(
                contents=list(contents),
                tools=tools,
                system_instruction=system_instruction,
            )
        )
        index = len(self.turns) - 1
        if index < len(self.responses):
            return self.responses[index]
        if self.repeat_last and self.responses:
            return self.responses[-1]
        raise AssertionError(
            f"ScriptedGemini ran out of responses on call {index + 1}; "
            f"only {len(self.responses)} were queued."
        )


def always_calls(name: str, args: dict[str, Any] | None = None) -> ScriptedGemini:
    """A model that will not stop calling a tool. Used to prove the cap holds."""
    return ScriptedGemini(responses=[call_response(name, args)], repeat_last=True)
