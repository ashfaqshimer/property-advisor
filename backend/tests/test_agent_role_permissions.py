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


def test_agent_can_manage_broker_contacts_but_not_owner_contacts(
    agent_client: TestClient, authenticated_client: TestClient, db_session: Session
) -> None:
    # 1. Agent CANNOT create owner contact
    create_owner_res = agent_client.post(
        "/admin/property-contacts",
        json={
            "contact_type": "owner",
            "full_name": "Direct Property Owner",
            "phones": [{"phone": "0771234567", "is_whatsapp": True}],
        },
    )
    assert create_owner_res.status_code == 403

    # Admin CAN create owner contact
    admin_create_owner = authenticated_client.post(
        "/admin/property-contacts",
        json={
            "contact_type": "owner",
            "full_name": "Direct Property Owner",
            "phones": [{"phone": "0771234567", "is_whatsapp": True}],
        },
    )
    assert admin_create_owner.status_code == 201
    owner_contact_id = admin_create_owner.json()["id"]

    # Agent CANNOT view owner contact directly
    agent_get_owner = agent_client.get(f"/admin/property-contacts/{owner_contact_id}")
    assert agent_get_owner.status_code == 403

    # Agent CANNOT edit owner contact
    agent_edit_owner = agent_client.patch(
        f"/admin/property-contacts/{owner_contact_id}",
        json={"notes": "Trying to edit owner"},
    )
    assert agent_edit_owner.status_code == 403

    # 2. Agent CAN create broker contact
    create_broker_res = agent_client.post(
        "/admin/property-contacts",
        json={
            "contact_type": "broker",
            "full_name": "Co-Broke Partner",
            "company_name": "Prime Realty",
            "phones": [{"phone": "0779876543", "is_whatsapp": False}],
        },
    )
    assert create_broker_res.status_code == 201
    broker_contact_id = create_broker_res.json()["id"]

    # Agent CAN read broker contact
    agent_get_broker = agent_client.get(f"/admin/property-contacts/{broker_contact_id}")
    assert agent_get_broker.status_code == 200
    assert agent_get_broker.json()["full_name"] == "Co-Broke Partner"

    # Agent CAN edit broker contact
    agent_edit_broker = agent_client.patch(
        f"/admin/property-contacts/{broker_contact_id}",
        json={"notes": "Updated notes on partner"},
    )
    assert agent_edit_broker.status_code == 200

    # Agent cannot turn broker contact into owner contact
    agent_change_to_owner = agent_client.patch(
        f"/admin/property-contacts/{broker_contact_id}",
        json={"contact_type": "owner"},
    )
    assert agent_change_to_owner.status_code == 403

    # 3. Contacts list: agent sees broker, but NOT owner
    contacts_list = agent_client.get("/admin/property-contacts")
    assert contacts_list.status_code == 200
    contact_ids = [c["id"] for c in contacts_list.json()]
    assert broker_contact_id in contact_ids
    assert owner_contact_id not in contact_ids


def test_agent_can_view_all_properties_with_owner_details_redacted(
    agent_client: TestClient, authenticated_client: TestClient, db_session: Session
) -> None:
    # Create an owner contact and a broker contact
    owner = PropertyContact(
        id=uuid.uuid4(),
        contact_type="owner",
        full_name="Secret Landlord",
    )
    broker = PropertyContact(
        id=uuid.uuid4(),
        contact_type="broker",
        full_name="Public Broker",
    )
    # Property 1 with owner
    prop_owner = Property(
        id=uuid.uuid4(),
        title="Owner House in Colombo 7",
        description="Luxury villa",
        price=150000000.0,
        location="Colombo 07",
        property_type=PropertyType.HOUSE,
        listing_type=ListingType.SALE,
        status=PropertyStatus.AVAILABLE,
        property_contact=owner,
    )
    # Property 2 with broker
    prop_broker = Property(
        id=uuid.uuid4(),
        title="Broker Condo in Colombo 3",
        description="Sea view apartment",
        price=85000000.0,
        location="Colombo 03",
        property_type=PropertyType.APARTMENT,
        listing_type=ListingType.SALE,
        status=PropertyStatus.AVAILABLE,
        property_contact=broker,
    )
    db_session.add_all([owner, broker, prop_owner, prop_broker])
    db_session.commit()

    # Admin sees both properties with their contacts
    admin_res = authenticated_client.get("/admin/properties")
    assert admin_res.status_code == 200
    admin_props = {p["id"]: p for p in admin_res.json()}
    assert admin_props[str(prop_owner.id)]["property_contact"]["full_name"] == "Secret Landlord"
    assert admin_props[str(prop_broker.id)]["property_contact"]["full_name"] == "Public Broker"

    # Agent sees ALL properties in the DB
    agent_res = agent_client.get("/admin/properties")
    assert agent_res.status_code == 200
    agent_props = {p["id"]: p for p in agent_res.json()}
    assert str(prop_owner.id) in agent_props
    assert str(prop_broker.id) in agent_props

    # BUT owner details are redacted for the agent
    owner_prop_for_agent = agent_props[str(prop_owner.id)]
    assert owner_prop_for_agent["property_contact"] is None
    assert owner_prop_for_agent["property_contact_id"] is None

    # Broker details remain visible to the agent
    broker_prop_for_agent = agent_props[str(prop_broker.id)]
    assert broker_prop_for_agent["property_contact"]["full_name"] == "Public Broker"
    assert broker_prop_for_agent["property_contact_id"] == str(broker.id)

    # Single property endpoint: GET /admin/properties/{id}
    single_owner = agent_client.get(f"/admin/properties/{prop_owner.id}")
    assert single_owner.status_code == 200
    assert single_owner.json()["property_contact"] is None
    assert single_owner.json()["property_contact_id"] is None

    single_broker = agent_client.get(f"/admin/properties/{prop_broker.id}")
    assert single_broker.status_code == 200
    assert single_broker.json()["property_contact"]["full_name"] == "Public Broker"

    # Agent cannot assign owner contact to property
    agent_assign_owner = agent_client.patch(
        f"/admin/properties/{prop_broker.id}",
        json={"property_contact_id": str(owner.id)},
    )
    assert agent_assign_owner.status_code == 403

    # Agent updating owner property doesn't wipe owner contact in DB
    agent_edit_prop = agent_client.patch(
        f"/admin/properties/{prop_owner.id}",
        json={"description": "Updated by agent without touching owner"},
    )
    assert agent_edit_prop.status_code == 200
    assert agent_edit_prop.json()["description"] == "Updated by agent without touching owner"
    assert agent_edit_prop.json()["property_contact"] is None  # still redacted for agent

    # Verify DB still has owner attached
    db_session.refresh(prop_owner)
    assert prop_owner.property_contact_id == owner.id


def test_agent_can_update_profile_settings(agent_client: TestClient) -> None:
    res = agent_client.patch("/auth/me", json={"name": "Agent Renamed"})
    assert res.status_code == 200
    assert res.json()["name"] == "Agent Renamed"
