from decimal import Decimal

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Conversation, Lead, LeadIntent, LeadInterest, LeadSource


def test_admin_leads_requires_authentication(client: TestClient) -> None:
    assert client.get("/admin/leads").status_code == 401


def _add_lead(db: Session, *, name: str, intent: LeadIntent) -> Lead:
    conversation = Conversation(session_id=f"session-{name.lower()}")
    lead = Lead(
        name=name,
        phone="0712345678",
        budget_min=Decimal("10000000"),
        budget_max=Decimal("50000000"),
        intent=intent,
        requirements="Colombo apartment",
        interest=LeadInterest.APARTMENT_SALE,
        conversation=conversation,
    )
    db.add(lead)
    db.commit()
    db.refresh(lead)
    return lead


def test_admin_leads_returns_serialized_leads(authenticated_client: TestClient, seeded: Session) -> None:
    lead = _add_lead(seeded, name="Maya", intent=LeadIntent.BUY)

    response = authenticated_client.get("/admin/leads")

    assert response.status_code == 200
    assert response.json() == [
        {
            "id": str(lead.id),
            "name": "Maya",
            "phone": "0712345678",
            "budget_min": 10000000.0,
            "budget_max": 50000000.0,
            "intent": "buy",
            "source": None,
            "requirements": "Colombo apartment",
            "interest": "apartment_sale",
            "remarks": None,
            "conversation_id": str(lead.conversation_id),
            "created_at": lead.created_at.isoformat().replace("+00:00", "Z"),
            "updated_at": lead.updated_at.isoformat().replace("+00:00", "Z"),
        }
    ]


def test_admin_leads_filters_by_search_and_intent(
    authenticated_client: TestClient, seeded: Session
) -> None:
    _add_lead(seeded, name="Maya", intent=LeadIntent.BUY)
    _add_lead(seeded, name="Ravi", intent=LeadIntent.SELL)

    response = authenticated_client.get("/admin/leads", params={"search": "Maya", "intent": "buy"})

    assert response.status_code == 200
    assert [item["name"] for item in response.json()] == ["Maya"]


def test_admin_leads_limit_is_validated(authenticated_client: TestClient) -> None:
    assert authenticated_client.get("/admin/leads", params={"limit": 0}).status_code == 422
    assert authenticated_client.get("/admin/leads", params={"limit": 101}).status_code == 422


def test_fallback_lead_capture_is_public_and_idempotent(
    client: TestClient, seeded: Session
) -> None:
    payload = {"session_id": "failed-chat", "name": "Nimali", "phone": "0712345678"}

    first = client.post("/leads/fallback", json=payload)
    second = client.post("/leads/fallback", json={**payload, "name": "Nimali Perera"})

    assert first.status_code == 200
    assert first.json() == {"captured": True}
    assert second.status_code == 200
    leads = seeded.execute(select(Lead)).scalars().all()
    assert len(leads) == 1
    assert leads[0].name == "Nimali Perera"
    assert leads[0].phone == "0712345678"
    assert leads[0].requirements == "Requested a call because chat was unavailable."
    assert leads[0].source is LeadSource.FALLBACK
    assert leads[0].remarks == "Chat was unavailable when this callback request was submitted."


def test_fallback_lead_capture_requires_a_phone(client: TestClient) -> None:
    response = client.post(
        "/leads/fallback", json={"session_id": "failed-chat", "name": "Nimali"}
    )

    assert response.status_code == 422


def test_manual_lead_creation_is_staff_only(client: TestClient) -> None:
    response = client.post(
        "/admin/leads", json={"phone": "0712345678", "name": "Maya"}
    )

    assert response.status_code == 401


def test_manual_lead_creation_allows_no_conversation(
    authenticated_client: TestClient, seeded: Session
) -> None:
    response = authenticated_client.post(
        "/admin/leads",
        json={
            "phone": "0712345678",
            "name": "Maya",
            "intent": "buy",
            "budget_max": "50000000",
            "requirements": "Colombo apartment",
            "interest": "apartment_sale",
            "remarks": "Call after 6pm",
        },
    )

    assert response.status_code == 201
    body = response.json()
    assert body["source"] == "manual"
    assert body["conversation_id"] is None
    assert body["remarks"] == "Call after 6pm"
    lead = seeded.scalar(select(Lead))
    assert lead is not None
    assert lead.source is LeadSource.MANUAL


def test_admin_leads_can_filter_by_source(
    authenticated_client: TestClient, seeded: Session
) -> None:
    _add_lead(seeded, name="Maya", intent=LeadIntent.BUY)
    seeded.add(Lead(name="Ravi", phone="0712345678", source=LeadSource.MANUAL))
    seeded.commit()

    response = authenticated_client.get("/admin/leads", params={"source": "manual"})

    assert response.status_code == 200
    assert [item["name"] for item in response.json()] == ["Ravi"]
