"""Importing this package registers every model on `Base.metadata`.

Alembic's env.py imports it for exactly that reason — one import, all tables.
"""

from app.models.property import Property, PropertyStatus, PropertyType

__all__ = ["Property", "PropertyStatus", "PropertyType"]
