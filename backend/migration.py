from __future__ import annotations

import os
from pathlib import Path
from typing import Optional
from traceback import format_exc
import hashlib

from sqlalchemy.engine import Engine

from alembic import command
from alembic.config import Config

from models import Base
from constants import DATABASE_URL


MIGRATIONS_DIR = Path(__file__).resolve().parent / "migrations"
LOCK_FILE = MIGRATIONS_DIR / ".autogen.lock"
SCHEMA_HASH_FILE = MIGRATIONS_DIR / ".schema.hash"


def _ensure_alembic_layout() -> None:
    """Create a minimal Alembic environment if missing."""
    versions = MIGRATIONS_DIR / "versions"
    versions.mkdir(parents=True, exist_ok=True)


def _alembic_config() -> Config:
    cfg = Config()
    cfg.set_main_option("script_location", str(MIGRATIONS_DIR))
    cfg.set_main_option("sqlalchemy.url", DATABASE_URL)
    # Provide a minimal ini section so env.py can read config_ini_section
    cfg.config_file_name = "alembic.ini"
    cfg.set_section_option("alembic", "sqlalchemy.url", DATABASE_URL)
    return cfg


def _model_schema_fingerprint() -> str:
    """Compute a deterministic fingerprint of the current SQLAlchemy model schema."""
    parts: list[str] = []
    md = Base.metadata
    for table in sorted(md.tables.values(), key=lambda t: t.name):
        parts.append(f"T:{table.name}")
        for col in sorted(table.columns, key=lambda c: c.name):
            col_type = str(col.type)
            parts.append(f"C:{col.name}:{col_type}:N{int(bool(col.nullable))}")
    digest = hashlib.sha256("|".join(parts).encode("utf-8")).hexdigest()
    return digest


def run_auto_migration(engine: Engine) -> None:
    """Use Alembic to autogenerate and apply migrations automatically on startup."""
    # Ensure env present
    _ensure_alembic_layout()
    cfg = _alembic_config()

    try:
        # Upgrade existing migrations (if any) first
        command.upgrade(cfg, "head")
    except Exception:
        print("[alembic] upgrade to head failed:\n" + format_exc())

    # Always attempt autogenerate only when model schema fingerprint changed
    try:
        # Avoid concurrent autogenerate on dev server reloads
        try:
            LOCK_FILE.parent.mkdir(parents=True, exist_ok=True)
            fd = os.open(str(LOCK_FILE), os.O_CREAT | os.O_EXCL | os.O_RDWR)
            os.close(fd)
            have_lock = True
        except FileExistsError:
            have_lock = False

        if have_lock:
            try:
                new_hash = _model_schema_fingerprint()
                old_hash = SCHEMA_HASH_FILE.read_text(encoding="utf-8").strip() if SCHEMA_HASH_FILE.exists() else ""
                if new_hash != old_hash:
                    command.revision(cfg, message="auto", autogenerate=True)
                    command.upgrade(cfg, "head")
                    # Update stored fingerprint
                    SCHEMA_HASH_FILE.write_text(new_hash, encoding="utf-8")
            finally:
                try:
                    LOCK_FILE.unlink(missing_ok=True)
                except Exception:
                    pass
    except Exception:
        print("[alembic] autogenerate failed:\n" + format_exc())


