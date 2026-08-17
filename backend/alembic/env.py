"""Alembic environment.

The connection string comes from app.config, not alembic.ini — one source of truth,
and no ConfigParser `%`-escaping surprises with the Neon password.
"""

from logging.config import fileConfig

from alembic import context
from sqlalchemy import CheckConstraint, create_engine, pool

import app.models  # noqa: F401  — registers every model on Base.metadata
from app.config import get_settings
from app.db.base import Base

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def _type_bound_check_names() -> frozenset[str]:
    """Names of every CHECK constraint the models create as a side effect of an Enum.

    Collected from the models rather than matched by pattern, so adding an enum column
    extends this automatically.
    """
    return frozenset(
        constraint.name
        for table in target_metadata.tables.values()
        for constraint in table.constraints
        if isinstance(constraint, CheckConstraint)
        and getattr(constraint, "_type_bound", False)
        and constraint.name is not None
    )


_TYPE_BOUND_CHECKS = _type_bound_check_names()


def _include_object(object_, name, type_, reflected, compare_to) -> bool:
    """Hide the enums' CHECK constraints from autogenerate.

    Alembic 1.19 reflects CHECK constraints from the database, but the ones that
    `Enum(native_enum=False, create_constraint=True)` attaches are marked `_type_bound` and
    are excluded from the *model* side of the comparison. The database therefore looks like
    it holds a constraint the models don't, and autogenerate emits a `drop_constraint` for
    it — silently destructive, because dropping the CHECK is exactly what would let an
    invalid enum value into the column.

    Reproduced on the first autogenerate after the properties migration: it wanted to drop
    `ck_properties_property_type` and `ck_properties_property_status`. Filtering by name is
    what works — for a *removed* constraint the object handed in is the reflected one, which
    carries no `_type_bound` flag to test.

    These constraints are still created and dropped with their tables; they live in the
    `CREATE TABLE`, not in a separate `op.create_check_constraint`.
    """
    if type_ == "check_constraint" and name in _TYPE_BOUND_CHECKS:
        return False
    return True


def _url() -> str:
    return get_settings().migration_sqlalchemy_url


def run_migrations_offline() -> None:
    context.configure(
        url=_url(),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
        include_object=_include_object,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = create_engine(_url(), poolclass=pool.NullPool)
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
            include_object=_include_object,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
