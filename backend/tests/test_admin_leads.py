from decimal import Decimal

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import Conversation, Lead, LeadIntent


def _add_lead(db: Session, *, name: str, intent: LeadIntent) -> Lead:
    conversation = Conversation(session_id=f"session-{name.lower()}")
    lead = Lead(
        name=name,
        phone="0712345678",
        budget_min=Decimal("10000000"),
        budget_max=Decimal("50000000"),
        intent=intent,
        preferences="Colombo apartment",
        conversation=conversation,
    )
    db.add(lead)
    db.commit()
    db.refresh(lead)
    return lead


def test_admin_leads_returns_serialized_leads(empty_client: TestClient, db_session: Session) -> None:
    lead = _add_lead(db_session, name="Maya", intent=LeadIntent.BUY)

    response = empty_client.get("/admin/leads")

    assert response.status_code == 200
    assert response.json() == [
        {
            "id": str(lead.id),
            "name": "Maya",
            "phone": "0712345678",
            "budget_min": 10000000.0,
            "budget_max": 50000000.0,
            "intent": "buy",
            "preferences": "Colombo apartment",
            "conversation_id": str(lead.conversation_id),
            "created_at": lead.created_at.isoformat().replace("+00:00", "Z"),
            "updated_at": lead.updated_at.isoformat().replace("+00:00", "Z"),
        }
    ]


def test_admin_leads_filters_by_search_and_intent(
    empty_client: TestClient, db_session: Session
) -> None:
    _add_lead(db_session, name="Maya", intent=LeadIntent.BUY)
    _add_lead(db_session, name="Ravi", intent=LeadIntent.SELL)

    response = empty_client.get("/admin/leads", params={"search": "Maya", "intent": "buy"})

    assert response.status_code == 200
    assert [item["name"] for item in response.json()] == ["Maya"]


def test_admin_leads_limit_is_validated(empty_client: TestClient) -> None:
    assert empty_client.get("/admin/leads", params={"limit": 0}).status_code == 422
    assert empty_client.get("/admin/leads", params={"limit": 101}).status_code == 422
