"""Importing this package registers every model on `Base.metadata`.

Alembic's env.py imports it for exactly that reason — one import, all tables.
"""

from app.models.conversation import Conversation
from app.models.auth import StaffSession, StaffUser
from app.models.lead import Lead, LeadIntent, LeadInterest, LeadSource
from app.models.message import Message, MessageRole
from app.models.property import (
    FurnishingStatus,
    ListingType,
    Property,
    PropertyStatus,
    PropertyType,
)
from app.models.property_contact import (
    PropertyContact,
    PropertyContactPhone,
    PropertyContactType,
)
from app.models.site_configuration import SiteConfiguration

__all__ = [
    "StaffSession",
    "StaffUser",
    "Conversation",
    "Lead",
    "LeadIntent",
    "LeadInterest",
    "LeadSource",
    "Message",
    "MessageRole",
    "Property",
    "PropertyStatus",
    "PropertyType",
    "PropertyContact",
    "PropertyContactPhone",
    "PropertyContactType",
    "SiteConfiguration",
]
