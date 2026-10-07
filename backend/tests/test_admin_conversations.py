"""Tests for admin conversations endpoints."""

import uuid
from decimal import Decimal
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import Conversation, Lead, LeadIntent, LeadInterest, Message
from app.models.message import MessageRole


def test_conversations_requires_auth(client: TestClient) -> None:
    response = client.get("/admin/conversations")
    assert response.status_code == 401


def test_conversations_forbidden_for_agent(agent_client: TestClient) -> None:
    response = agent_client.get("/admin/conversations")
    assert response.status_code == 403


def _create_sample_conversation(
    db: Session,
    session_id: str,
    with_lead: bool = False,
    user_text: str = "Looking for a 2-bed apartment in Colombo 03",
    reply_text: str = "I found a few apartments in Colombo 03 for you.",
) -> Conversation:
    conv = Conversation(id=uuid.uuid4(), session_id=session_id)
    db.add(conv)
    db.commit()

    m1 = Message(
        id=uuid.uuid4(),
        conversation_id=conv.id,
        role=MessageRole.USER,
        content=user_text,
        seq=1,
    )
    m2 = Message(
        id=uuid.uuid4(),
        conversation_id=conv.id,
        role=MessageRole.TOOL,
        content="",
        tool_payload={"name": "search_properties", "args": {"location": "Colombo 03"}},
        seq=2,
    )
    m3 = Message(
        id=uuid.uuid4(),
        conversation_id=conv.id,
        role=MessageRole.ASSISTANT,
        content=reply_text,
        seq=3,
    )
    db.add_all([m1, m2, m3])

    if with_lead:
        lead = Lead(
            id=uuid.uuid4(),
            conversation_id=conv.id,
            name="Kasun Perera",
            phone="0771234567",
            intent=LeadIntent.BUY,
            interest=LeadInterest.APARTMENT_SALE,
            budget_min=Decimal("25000000"),
            budget_max=Decimal("40000000"),
            requirements="2-bed Colombo 03 apartment",
            remarks="Interested in sea view",
        )
        db.add(lead)

    db.commit()
    db.refresh(conv)
    return conv


def test_admin_can_list_conversations(
    authenticated_client: TestClient, seeded: Session
) -> None:
    conv1 = _create_sample_conversation(seeded, "session-test-1", with_lead=True)
    conv2 = _create_sample_conversation(
        seeded,
        "session-test-2",
        with_lead=False,
        user_text="Need a house in Rajagiriya",
    )

    response = authenticated_client.get("/admin/conversations")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] >= 2
    items = data["items"]

    session_ids = [c["session_id"] for c in items]
    assert "session-test-1" in session_ids
    assert "session-test-2" in session_ids

    c1_summary = next(c for c in items if c["session_id"] == "session-test-1")
    assert c1_summary["message_count"] == 3
    assert c1_summary["preview"] == "Looking for a 2-bed apartment in Colombo 03"
    assert c1_summary["lead"] is not None
    assert c1_summary["lead"]["name"] == "Kasun Perera"


def test_admin_conversations_filter_and_search(
    authenticated_client: TestClient, seeded: Session
) -> None:
    _create_sample_conversation(
        seeded,
        "search-sess-alpha",
        with_lead=True,
        user_text="Searching luxury penthouse",
    )
    _create_sample_conversation(
        seeded,
        "search-sess-beta",
        with_lead=False,
        user_text="Looking for land in Kandy",
    )

    # Search by message text
    res = authenticated_client.get("/admin/conversations?search=penthouse")
    assert res.status_code == 200
    data = res.json()
    assert data["total"] == 1
    assert data["items"][0]["session_id"] == "search-sess-alpha"

    # Search by lead name
    res = authenticated_client.get("/admin/conversations?search=Kasun")
    assert res.status_code == 200
    assert any(c["session_id"] == "search-sess-alpha" for c in res.json()["items"])

    # Filter has_lead=True
    res_lead = authenticated_client.get("/admin/conversations?has_lead=true")
    assert res_lead.status_code == 200
    for item in res_lead.json()["items"]:
        assert item["lead"] is not None

    # Filter has_lead=False
    res_no_lead = authenticated_client.get("/admin/conversations?has_lead=false")
    assert res_no_lead.status_code == 200
    for item in res_no_lead.json()["items"]:
        assert item["lead"] is None


def test_admin_get_conversation_detail(
    authenticated_client: TestClient, seeded: Session
) -> None:
    conv = _create_sample_conversation(seeded, "detail-session-123", with_lead=True)

    res = authenticated_client.get(f"/admin/conversations/{conv.id}")
    assert res.status_code == 200
    detail = res.json()

    assert detail["session_id"] == "detail-session-123"
    assert detail["message_count"] == 3
    assert len(detail["messages"]) == 3
    assert detail["messages"][0]["role"] == "user"
    assert detail["messages"][1]["role"] == "tool"
    assert detail["messages"][1]["tool_payload"] == {
        "name": "search_properties",
        "args": {"location": "Colombo 03"},
    }
    assert detail["messages"][2]["role"] == "assistant"
    assert detail["lead"]["phone"] == "0771234567"


def test_admin_delete_conversation(
    authenticated_client: TestClient, seeded: Session
) -> None:
    conv = _create_sample_conversation(seeded, "delete-session-999", with_lead=True)

    res = authenticated_client.delete(f"/admin/conversations/{conv.id}")
    assert res.status_code == 204

    # Verify 404
    res_after = authenticated_client.get(f"/admin/conversations/{conv.id}")
    assert res_after.status_code == 404
