"""The hand-rolled tool-calling loop.

    append the user message
    → send the whole conversation + tool declarations + system instruction to Gemini
    → if a function_call comes back: run the Python function, append the model's turn
      plus a function_response, and go again
    → stop at plain text, persist, return

No framework does any of this. That is the point of the project, not an implementation
detail — see CLAUDE.md before reaching for LangGraph as a "simplification".

Things in here that are less arbitrary than they look:

**History is rebuilt from the database every turn, not cached.** `messages` is the single
source of truth, so a second worker process picking up the same session behaves
identically, and a conversation survives a redeploy. Rows are replayed in `seq` order —
never `created_at`, because one pass through this loop writes several rows inside one
transaction and Postgres `now()` is transaction-start time, so they share a timestamp to
the microsecond.

**`function_response` parts are sent with `role="user"`.** Counter-intuitive, since a tool
result isn't something the user said, but it's what the Gemini API expects: contents
alternate user/model, and a tool result is an input to the model's next turn.

**The iteration cap counts model calls, not tool calls.** Five `generate()` calls, then the
loop gives up with prose rather than spinning — a model that keeps re-calling the same tool
is a prompt bug, and it must not become an unbounded bill.

Deliberately *not* handled here: retries, backoff, and rate limiting. A transport error
from Gemini propagates. That is Phase 5's error-handling work, and a silent retry now would
hide exactly the flakiness worth measuring first.
"""

from __future__ import annotations

import uuid
from typing import Any

from google.genai import types
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.agent import tools
from app.agent.client import SupportsGenerate, get_gemini_client
from app.agent.prompts import FALLBACK_REPLY, SYSTEM_PROMPT
from app.models.conversation import Conversation
from app.models.message import Message, MessageRole

# Five model calls per user turn. PROJECT_OVERVIEW §5 suggests ~5; the real constraint is
# that this number bounds the cost of one misbehaving conversation.
MAX_TOOL_ITERATIONS = 5


def get_or_create_conversation(db: Session, session_id: str) -> Conversation:
    """Look a conversation up by its client-generated session id, creating it if new.

    `session_id` is UNIQUE, which is what stops a race from forking one browser session
    into two conversations and answering with half the history.
    """
    session_id = session_id.strip()
    if not session_id:
        raise ValueError("session_id must not be empty")

    conversation = db.execute(
        select(Conversation).where(Conversation.session_id == session_id)
    ).scalar_one_or_none()
    if conversation is None:
        conversation = Conversation(session_id=session_id)
        db.add(conversation)
        db.flush()
    return conversation


def _next_seq(db: Session, conversation_id: uuid.UUID) -> int:
    """One past the highest `seq` in this conversation; 0 for a fresh one."""
    highest = db.execute(
        select(func.max(Message.seq)).where(Message.conversation_id == conversation_id)
    ).scalar()
    return 0 if highest is None else highest + 1


def _replay(messages: list[Message]) -> list[types.Content]:
    """Turn persisted rows back into `Content` parts.

    `content` text alone cannot reconstruct a tool exchange — the call's arguments and the
    tool's return value are structured — which is why `messages.tool_payload` exists.
    """
    contents: list[types.Content] = []
    for message in messages:
        payload = message.tool_payload or {}

        if call := payload.get("function_call"):
            contents.append(
                types.Content(
                    role="model",
                    parts=[
                        types.Part.from_function_call(
                            name=call["name"], args=call.get("args") or {}
                        )
                    ],
                )
            )
        elif response := payload.get("function_response"):
            contents.append(
                types.Content(
                    role="user",  # see module docstring
                    parts=[
                        types.Part.from_function_response(
                            name=response["name"], response=response.get("response") or {}
                        )
                    ],
                )
            )
        elif message.content:
            role = "user" if message.role is MessageRole.USER else "model"
            contents.append(
                types.Content(role=role, parts=[types.Part.from_text(text=message.content)])
            )
    return contents


def _parts_of(response: types.GenerateContentResponse) -> list[types.Part]:
    """Every part of the first candidate, or nothing.

    Read off `candidates` rather than the `.text` / `.function_calls` conveniences: those
    warn when a response mixes text with function calls, which is a shape this loop treats
    as normal rather than exceptional.
    """
    if not response.candidates:
        return []
    content = response.candidates[0].content
    if content is None or not content.parts:
        return []
    return list(content.parts)


def run_turn(
    db: Session,
    session_id: str,
    user_message: str,
    client: SupportsGenerate | None = None,
) -> str:
    """Run one user turn to completion and return Amaya's reply.

    Persists the user message, every tool exchange, and the final assistant message, then
    commits. `client` is injectable so the suite can drive the whole loop from a scripted
    fake — nothing here is reached by patching.
    """
    text = user_message.strip()
    if not text:
        # Rejected before a model call is spent. Phase 3 will also validate at the schema
        # layer; this guards the function against its other callers.
        raise ValueError("user_message must not be empty")

    gemini = client if client is not None else get_gemini_client()
    conversation = get_or_create_conversation(db, session_id)
    seq = _next_seq(db, conversation.id)

    def record(
        role: MessageRole, content: str = "", payload: dict[str, Any] | None = None
    ) -> None:
        nonlocal seq
        db.add(
            Message(
                conversation_id=conversation.id,
                role=role,
                content=content,
                tool_payload=payload,
                seq=seq,
            )
        )
        seq += 1
        db.flush()

    record(MessageRole.USER, content=text)

    history = list(
        db.execute(
            select(Message)
            .where(Message.conversation_id == conversation.id)
            .order_by(Message.seq)
        ).scalars()
    )
    contents = _replay(history)
    context = tools.ToolContext(db=db, conversation_id=conversation.id)

    def finish(reply: str) -> str:
        record(MessageRole.ASSISTANT, content=reply)
        db.commit()
        return reply

    for _ in range(MAX_TOOL_ITERATIONS):
        response = gemini.generate(
            contents=contents,
            tools=tools.TOOL_DECLARATIONS,
            system_instruction=SYSTEM_PROMPT,
        )
        parts = _parts_of(response)
        calls = [part.function_call for part in parts if part.function_call]

        if not calls:
            # Plain text — the loop's exit. An empty or candidate-less response falls back
            # rather than returning "" to the user.
            reply = "".join(part.text for part in parts if part.text).strip()
            return finish(reply or FALLBACK_REPLY)

        # The model's own turn goes back verbatim, so its function_call parts are echoed
        # exactly as sent. A response carrying prose *and* a call keeps both.
        contents.append(types.Content(role="model", parts=parts))
        for part in parts:
            if part.function_call:
                record(
                    MessageRole.ASSISTANT,
                    payload={
                        "function_call": {
                            "name": part.function_call.name,
                            "args": dict(part.function_call.args or {}),
                        }
                    },
                )
            elif part.text:
                record(MessageRole.ASSISTANT, content=part.text)

        response_parts: list[types.Part] = []
        for call in calls:
            name = call.name or ""
            args = dict(call.args or {})
            result = tools.execute_tool(name, args, context)
            record(
                MessageRole.TOOL,
                payload={"function_response": {"name": name, "response": result}},
            )
            response_parts.append(
                types.Part.from_function_response(name=name, response=result)
            )
        contents.append(types.Content(role="user", parts=response_parts))

    # Cap reached with the model still calling tools. Answer in prose rather than looping.
    return finish(FALLBACK_REPLY)
