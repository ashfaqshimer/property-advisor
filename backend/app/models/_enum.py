"""Shared column helper for the string enums the models use.

Lives here rather than in one model module because more than one table needs it —
`properties` for its type/status columns, `messages` for its role.
"""

import enum

from sqlalchemy import Enum as SAEnum


def enum_column(python_enum: type[enum.Enum], name: str) -> SAEnum:
    """VARCHAR + a named CHECK constraint, rather than a native Postgres ENUM.

    Adding a member to a native ENUM is an `ALTER TYPE` that can't run in the same
    transaction as its own usage; a CHECK is an ordinary drop-and-add in a normal
    migration. It also lets the Phase 2 `search_properties` tool compare against a
    raw string from the model without a cast.

    `values_callable` is load-bearing: SQLAlchemy persists the enum *member name* by
    default, so without it the column would hold "HOUSE" and every query filtering
    on "house" would silently match nothing.
    """
    return SAEnum(
        python_enum,
        name=name,
        native_enum=False,
        length=16,
        create_constraint=True,
        validate_strings=True,
        values_callable=lambda e: [member.value for member in e],
    )
