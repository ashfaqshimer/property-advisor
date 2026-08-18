"""Importing this package registers every model on `Base.metadata`.

Alembic's env.py imports it for exactly that reason — one import, all tables.
"""

from app.models.conversation import Conversation
from app.models.lead import Lead, LeadIntent
from app.models.message import Message, MessageRole
from app.models.property import Property, PropertyStatus, PropertyType

__all__ = [
    "Conversation",
    "Lead",
    "LeadIntent",
    "Message",
    "MessageRole",
    "Property",
    "PropertyStatus",
    "PropertyType",
]
