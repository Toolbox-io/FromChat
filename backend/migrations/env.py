from __future__ import annotations
from sqlalchemy import engine_from_config, pool
from alembic import context
from models import Base

config = context.config
target_metadata = Base.metadata


def _skip_empty_autogenerate(ctx, rev, directives):
    # Avoid creating empty migrations when there are no schema changes
    if getattr(config, "cmd_opts", None) and getattr(config.cmd_opts, "autogenerate", False):
        if directives:
            script = directives[0]
            if hasattr(script, "upgrade_ops") and script.upgrade_ops.is_empty():
                directives[:] = []

def run_migrations_offline():
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url, target_metadata=target_metadata, literal_binds=True, dialect_opts={"paramstyle": "named"},
        render_as_batch=True,
        process_revision_directives=_skip_empty_autogenerate
    )
    with context.begin_transaction():
        context.run_migrations()

def run_migrations_online():
    connectable = engine_from_config(config.get_section(config.config_ini_section) or {}, prefix="sqlalchemy.", poolclass=pool.NullPool)
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            render_as_batch=True,
            process_revision_directives=_skip_empty_autogenerate
        )
        with context.begin_transaction():
            context.run_migrations()

if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
