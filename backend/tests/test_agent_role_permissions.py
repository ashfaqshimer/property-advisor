import uuid
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.field_assignment import FieldAssignment
from app.models.prospect import Prospect
from app.models.property import Property, PropertyStatus, PropertyType, ListingType
from app.models.property_contact import PropertyContact


def test_agent_sees_only_assigned_prospects(
    agent_client: TestClient, authenticated_client: TestClient, db_session: Session
) -> None:
    # Prospect 1: Unassigned
    p1 = Prospect(
        id=uuid.uuid4(),
        ikman_ad_id="ad-unassigned-1",
        ikman_url="https://ikman.lk/ad-1",
        ikman_slug="ad-1",
        title="Unassigned House",
        price="Rs 25,000,000",
        location="Colombo 05",
        property_type="house",
        listing_type="for_sale",
        classification="owner",
        confidence=90,
        classification_reasons=["owner_keyword"],
        classification_method="heuristic",
        status="new",
    )
    # Prospect 2: Assigned
    p2 = Prospect(
        id=uuid.uuid4(),
        ikman_ad_id="ad-assigned-2",
        ikman_url="https://ikman.lk/ad-2",
        ikman_slug="ad-2",
        title="Assigned Apartment",
        price="Rs 35,000,000",
        location="Colombo 03",
        property_type="apartment",
        listing_type="for_sale",
        classification="owner",
        confidence=95,
        classification_reasons=["owner_keyword"],
        classification_method="heuristic",
        status="new",
    )
    db_session.add_all([p1, p2])
    db_session.commit()

    # Assign p2
    assignment = FieldAssignment(
        id=uuid.uuid4(),
        prospect_id=p2.id,
        status="pending",
    )
    db_session.add(assignment)
    db_session.commit()

    # Admin sees both
    admin_res = authenticated_client.get("/admin/prospects")
    assert admin_res.status_code == 200
    admin_items = admin_res.json()["items"]
    admin_ids = [item["id"] for item in admin_items]
    assert str(p1.id) in admin_ids
    assert str(p2.id) in admin_ids

    # Agent sees only assigned prospect (p2)
    agent_res = agent_client.get("/admin/prospects")
    assert agent_res.status_code == 200
    agent_items = agent_res.json()["items"]
    agent_ids = [item["id"] for item in agent_items]
    assert str(p1.id) not in agent_ids
    assert str(p2.id) in agent_ids


def test_agent_scanner_features_forbidden(agent_client: TestClient) -> None:
    # Cannot launch scans
    res = agent_client.post("/admin/prospects/scan", json={"keyword": "colombo"})
    assert res.status_code == 403

    # Cannot launch bulk phone fetch
    res = agent_client.post("/admin/prospects/scan/phones")
    assert res.status_code == 403

    # Cannot access scan list
    res = agent_client.get("/admin/prospects/scans")
    assert res.status_code == 403

    # Cannot save scan presets
    res = agent_client.post("/admin/prospects/presets", json={"id": "test", "name": "Test"})
    assert res.status_code == 403

    # Cannot delete scan presets
    res = agent_client.delete("/admin/prospects/presets/test")
    assert res.status_code == 403

    # Cannot purge prospects
    res = agent_client.delete("/admin/prospects/purge")
    assert res.status_code == 403

    # Cannot access field assignments management
    res = agent_client.get("/admin/field-assignments")
    assert res.status_code == 403


def test_agent_cannot_delete_anything(agent_client: TestClient, db_session: Session) -> None:
    # 1. Properties
    prop = Property(
        id=uuid.uuid4(),
        title="Test Property",
        description="A great place",
        price=50000000.0,
        location="Colombo 07",
        property_type=PropertyType.HOUSE,
        listing_type=ListingType.SALE,
        status=PropertyStatus.AVAILABLE,
    )
    # 2. Contacts
    contact = PropertyContact(
        id=uuid.uuid4(),
        contact_type="owner",
        full_name="Perera Property Owner",
    )
    db_session.add_all([prop, contact])
    db_session.commit()

    # Agent cannot delete property
    prop_del = agent_client.delete(f"/admin/properties/{prop.id}")
    assert prop_del.status_code == 403

    # Agent cannot delete contact
    contact_del = agent_client.delete(f"/admin/property-contacts/{contact.id}")
    assert contact_del.status_code == 403


def test_agent_can_manage_contacts_add_and_edit(agent_client: TestClient, db_session: Session) -> None:
    # Can create contact
    create_res = agent_client.post(
        "/admin/property-contacts",
        json={
            "contact_type": "owner",
            "full_name": "Nimal Silva",
            "company_name": "Silva Holdings",
            "email": "nimal@example.com",
            "notes": "Met at property site",
            "phones": [{"phone": "0771234567", "is_whatsapp": True, "label": "Mobile"}],
        },
    )
    assert create_res.status_code == 201
    contact_id = create_res.json()["id"]

    # Can edit contact
    update_res = agent_client.patch(
        f"/admin/property-contacts/{contact_id}",
        json={"notes": "Updated notes after second call"},
    )
    assert update_res.status_code == 200
    assert update_res.json()["notes"] == "Updated notes after second call"

    # Can read contact
    get_res = agent_client.get(f"/admin/property-contacts/{contact_id}")
    assert get_res.status_code == 200
    assert get_res.json()["full_name"] == "Nimal Silva"


def test_agent_can_update_profile_settings(agent_client: TestClient) -> None:
    res = agent_client.patch("/auth/me", json={"name": "Agent Renamed"})
    assert res.status_code == 200
    assert res.json()["name"] == "Agent Renamed"
