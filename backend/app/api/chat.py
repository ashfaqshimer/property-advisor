"""The chat endpoint: one HTTP request, one full turn of the agent loop.

Thin by design. `loop.run_turn` already owns tool dispatch, persistence, history replay,
and the iteration cap; everything here is validation, dependency wiring, and giving upstream
failures an HTTP shape.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from google.genai import errors as genai_errors
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.agent.client import SupportsGenerate, get_gemini_client
from app.agent.loop import run_turn
from app.db.session import get_db
from app.schemas.chat import ChatRequest, ChatResponse

router = APIRouter(tags=["chat"])


def get_agent_client() -> SupportsGenerate:
    """The Gemini client, as a dependency so the suite can override it.

    `run_turn` takes `client` for exactly this reason — no test needs `patch()`, and no
    test touches the network. Resolved per request rather than at import, so a missing
    `GEMINI_API_KEY` is a 503 on the first call instead of a crash at boot.
    """
    return get_gemini_client()


DbSession = Annotated[Session, Depends(get_db)]
AgentClient = Annotated[SupportsGenerate, Depends(get_agent_client)]


# Deliberately `def`, not `async def`. `run_turn` blocks on Gemini and Postgres for the
# whole turn; under `async def` it would hold the event loop and serialise every concurrent
# user. As a plain `def`, FastAPI runs it in the threadpool.
@router.post("/chat", response_model=ChatResponse)
def post_chat(
    payload: ChatRequest, db: DbSession, client: AgentClient
) -> ChatResponse:
    """Send one user message, get Amaya's complete reply."""
    try:
        reply = _run_turn_handling_session_race(db, payload, client)
    except genai_errors.APIError as exc:
        # Transport, quota, and upstream 5xx. Retries and backoff stay out of scope on
        # purpose (see loop.py's docstring) — this only gives the failure a status code.
        # Note a *safety* block doesn't land here: it comes back as a candidate-less
        # response, which the loop turns into FALLBACK_REPLY and a 200.
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="The assistant is unavailable right now. Please try again.",
        ) from exc

    return ChatResponse(reply=reply, session_id=payload.session_id)


def _run_turn_handling_session_race(
    db: Session, payload: ChatRequest, client: SupportsGenerate
) -> str:
    """Run the turn, retrying once if a concurrent request created the conversation first.

    `conversations.session_id` is UNIQUE, so when two first requests for one session race,
    the loser's INSERT raises IntegrityError. A double-submitting client or a double-fired
    effect makes this reachable, and it must not be a 500.

    The retry is safe because the turn is atomic: nothing was committed, so the rollback
    discards the losing attempt's rows entirely and `get_or_create_conversation` finds the
    winner's row on the second pass. It costs one extra model call in a rare race, which is
    the cheaper side of the trade against answering with half a conversation.
    """
    try:
        return run_turn(db, payload.session_id, payload.message, client=client)
    except IntegrityError:
        db.rollback()
        return run_turn(db, payload.session_id, payload.message, client=client)
