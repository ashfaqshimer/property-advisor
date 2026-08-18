"""POST /chat — the HTTP surface over the agent loop.

Every test drives a scripted stand-in for Gemini through the `chat_client` fixture, so the
suite makes no network calls and patches nothing. What that means: assertions here are about
the *plumbing* — validation, status codes, persistence, history replay — never about what
Amaya says, which is the fake's text. Prompt adherence is verified against the live model
and recorded in the spec.
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from google.genai import errors as genai_errors

import app.api.chat as chat_module
from app.agent.client import GeminiNotConfigured
from app.agent.prompts import FALLBACK_REPLY
from app.api.chat import get_agent_client
from app.main import app as fastapi_app
from app.models import Conversation, Message, MessageRole
from app.schemas.chat import MAX_MESSAGE_LENGTH, MAX_SESSION_ID_LENGTH
from tests.agent_fakes import (
    ScriptedGemini,
    always_calls,
    call_response,
    text_response,
)


class FailingGemini:
    """Upstream is down. `ServerError` is a real `google.genai` error, not a stand-in."""

    def generate(self, contents, tools, system_instruction):
        raise genai_errors.ServerError(503, {"error": {"message": "overloaded"}})

SESSION = "session-abc"


def _post(client: TestClient, message: str, session_id: str = SESSION):
    return client.post("/chat", json={"session_id": session_id, "message": message})


def test_returns_the_reply_and_echoes_the_session(chat_client) -> None:
    client = chat_client(ScriptedGemini(responses=[text_response("Happy to help.")]))

    response = _post(client, "Hi")

    assert response.status_code == 200
    assert response.json() == {"reply": "Happy to help.", "session_id": SESSION}


def test_a_new_session_creates_one_conversation(chat_client, seeded: Session) -> None:
    client = chat_client(ScriptedGemini(responses=[text_response("Hello.")]))

    assert _post(client, "Hi").status_code == 200

    conversations = seeded.execute(select(Conversation)).scalars().all()
    assert len(conversations) == 1
    assert conversations[0].session_id == SESSION


def test_second_request_continues_the_same_conversation(
    chat_client, seeded: Session
) -> None:
    """The point of `session_id`: turn two must see turn one.

    Asserted through the fake's recorded contents rather than by calling `run_turn`
    directly, so this covers the endpoint replaying history over HTTP.
    """
    fake = ScriptedGemini(
        responses=[text_response("Noted."), text_response("Still with you.")]
    )
    client = chat_client(fake)

    _post(client, "I'm after a house in Galle")
    _post(client, "Any update?")

    assert len(seeded.execute(select(Conversation)).scalars().all()) == 1
    second_turn_texts = [
        part.text
        for content in fake.turns[1].contents
        for part in (content.parts or [])
        if part.text
    ]
    assert "I'm after a house in Galle" in second_turn_texts
    assert "Noted." in second_turn_texts


def test_tool_call_path_runs_end_to_end(chat_client, seeded: Session) -> None:
    """A function_call turn followed by prose: 200 with the prose, tool rows persisted."""
    fake = ScriptedGemini(
        responses=[
            call_response("search_properties", {"location": "Galle"}),
            text_response("I have a colonial retreat in Galle Fort."),
        ]
    )
    client = chat_client(fake)

    response = _post(client, "Anything in Galle?")

    assert response.status_code == 200
    assert response.json()["reply"] == "I have a colonial retreat in Galle Fort."
    assert fake.call_count == 2

    roles = _message_roles(seeded)
    assert MessageRole.TOOL in roles
    tool_row = next(
        row for row in _messages(seeded) if row.role is MessageRole.TOOL
    )
    payload = tool_row.tool_payload or {}
    assert payload["function_response"]["name"] == "search_properties"
    # Proves the tool hit the real seeded table through the endpoint's session, not a stub.
    matches = payload["function_response"]["response"]["matches"]
    assert matches and all("Galle" in match["location"] for match in matches)


def test_iteration_cap_returns_the_fallback_not_an_error(
    chat_client, seeded: Session
) -> None:
    """A model that never stops calling tools ends in prose with a 200, and persists."""
    client = chat_client(always_calls("search_properties", {"location": "Colombo"}))

    response = _post(client, "Show me everything")

    assert response.status_code == 200
    assert response.json()["reply"] == FALLBACK_REPLY
    assert _message_roles(seeded).count(MessageRole.ASSISTANT) >= 1


def test_non_latin_input_is_persisted_intact(chat_client, seeded: Session) -> None:
    """Sinhala input is accepted and stored unchanged; replies stay English by decision."""
    client = chat_client(ScriptedGemini(responses=[text_response("Of course.")]))
    sinhala = "මට ගාල්ලේ නිවසක් අවශ්‍යයි"

    assert _post(client, sinhala).status_code == 200

    user_rows = [row for row in _messages(seeded) if row.role is MessageRole.USER]
    assert [row.content for row in user_rows] == [sinhala]


# --- validation: every one of these must be a 422, never a 500 from the loop -------------


def test_blank_and_whitespace_messages_are_rejected(chat_client) -> None:
    client = chat_client(ScriptedGemini(responses=[]))

    assert _post(client, "").status_code == 422
    # `run_turn` would also reject this, but only after the request reached it — the
    # schema strips first so the loop's ValueError is unreachable over HTTP.
    assert _post(client, "   ").status_code == 422


def test_message_length_boundary(chat_client) -> None:
    client = chat_client(
        ScriptedGemini(responses=[text_response("Long one.")], repeat_last=True)
    )

    assert _post(client, "x" * MAX_MESSAGE_LENGTH).status_code == 200
    assert _post(client, "x" * (MAX_MESSAGE_LENGTH + 1)).status_code == 422
    # Padding is stripped before the cap is applied, so this is inside the limit.
    assert _post(client, f"  {'x' * MAX_MESSAGE_LENGTH}  ").status_code == 200


def test_session_id_is_validated(chat_client) -> None:
    client = chat_client(ScriptedGemini(responses=[]))

    assert _post(client, "Hi", session_id="").status_code == 422
    assert _post(client, "Hi", session_id="   ").status_code == 422
    # Longer than the String(128) column, which would be a DataError on insert.
    assert (
        _post(client, "Hi", session_id="s" * (MAX_SESSION_ID_LENGTH + 1)).status_code
        == 422
    )


def test_missing_fields_are_rejected(chat_client) -> None:
    client = chat_client(ScriptedGemini(responses=[]))

    assert client.post("/chat", json={"message": "Hi"}).status_code == 422
    assert client.post("/chat", json={"session_id": SESSION}).status_code == 422
    assert client.post("/chat", json={}).status_code == 422


def test_a_rejected_request_writes_nothing(chat_client, seeded: Session) -> None:
    """422s must not leave a conversation row behind for a message never processed."""
    client = chat_client(ScriptedGemini(responses=[]))

    _post(client, "   ")

    assert seeded.execute(select(Conversation)).scalars().all() == []


# --- upstream failures --------------------------------------------------------------------


def test_missing_api_key_is_503(chat_client) -> None:
    """The real dependency raises this when GEMINI_API_KEY is blank.

    Raised from a dependency, which resolves before the route function — hence the
    app-level handler in main.py rather than a try/except in the endpoint.
    """


    def unconfigured():
        raise GeminiNotConfigured("GEMINI_API_KEY is not set.")

    # Built first so `get_db` is wired, then the client override is replaced with one
    # that fails the way a blank key does.
    client = chat_client(ScriptedGemini(responses=[]))
    fastapi_app.dependency_overrides[get_agent_client] = unconfigured

    response = _post(client, "Hi")

    assert response.status_code == 503
    assert "GEMINI_API_KEY" in response.json()["detail"]


def test_the_real_dependency_raises_when_the_key_is_blank(monkeypatch) -> None:
    """Covers the dependency body itself, which every other test overrides away.

    Without this, the 503 above only proves the handler maps an exception the *fake*
    raised. This pins the other half: a blank `GEMINI_API_KEY` really does raise from
    `get_agent_client`, which is what reaches that handler in production.
    """
    from app.agent import client as client_module
    from app.config import Settings

    def blank_key_settings() -> Settings:
        return Settings(
            database_url="postgresql+psycopg://x:x@localhost/x", gemini_api_key=""
        )

    monkeypatch.setattr(client_module, "get_settings", blank_key_settings)
    client_module.get_gemini_client.cache_clear()
    try:
        with pytest.raises(GeminiNotConfigured):
            get_agent_client()
    finally:
        # Cached per process — a leaked fake would surface as an unrelated failure later.
        client_module.get_gemini_client.cache_clear()


def test_gemini_api_error_is_502(chat_client) -> None:
    client = chat_client(FailingGemini())

    response = _post(client, "Hi")

    assert response.status_code == 502
    # The upstream message is not forwarded — the client gets something it can show a user.
    assert "overloaded" not in response.json()["detail"]


def test_a_failed_turn_persists_nothing(chat_client, seeded: Session) -> None:
    """Turns are atomic: `run_turn` commits only at the end, so a mid-loop failure
    discards the user's message too. Deliberate — a half-written conversation would
    poison every later turn, since history is replayed from `messages`."""
    client = chat_client(FailingGemini())

    assert _post(client, "Hi").status_code == 502

    # Rolling back stands in for what production does at the end of the request: `get_db`
    # closes the session, and SQLAlchemy rolls back the open transaction. The suite's
    # override hands out one long-lived session instead, so without this the flushed —
    # but uncommitted — rows are still visible inside that transaction and the assertion
    # would pass for the wrong reason. What's being proved is that nothing was *committed*.
    seeded.rollback()

    assert seeded.execute(select(Conversation)).scalars().all() == []
    assert _messages(seeded) == []


def test_concurrent_first_requests_do_not_500(
    chat_client, seeded: Session, monkeypatch
) -> None:
    """Two first requests for one session race on the UNIQUE `session_id`; the loser's
    INSERT raises IntegrityError and the endpoint retries once.

    Patching `run_turn` rather than the Gemini client here: a genuine race needs two
    concurrent transactions, which the single in-memory SQLite session can't stage. The
    no-patch rule protects the *network* boundary, and that still holds — this fake never
    reaches Gemini either.
    """
    calls: list[str] = []
    real_run_turn = chat_module.run_turn

    def flaky(db, session_id, user_message, client=None):
        calls.append(session_id)
        if len(calls) == 1:
            raise IntegrityError("INSERT", {}, Exception("duplicate key"))
        return real_run_turn(db, session_id, user_message, client=client)

    monkeypatch.setattr("app.api.chat.run_turn", flaky)
    client = chat_client(ScriptedGemini(responses=[text_response("Second time lucky.")]))

    response = _post(client, "Hi")

    assert response.status_code == 200
    assert response.json()["reply"] == "Second time lucky."
    assert len(calls) == 2
    assert len(seeded.execute(select(Conversation)).scalars().all()) == 1


def test_cors_preflight_allows_posting_to_chat(chat_client) -> None:
    client = chat_client(ScriptedGemini(responses=[]))

    response = client.options(
        "/chat",
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "Content-Type",
        },
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:3000"


def _messages(db: Session) -> list[Message]:
    return list(db.execute(select(Message).order_by(Message.seq)).scalars())


def _message_roles(db: Session) -> list[MessageRole]:
    return [row.role for row in _messages(db)]
