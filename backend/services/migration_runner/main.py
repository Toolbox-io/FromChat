#!/usr/bin/env python3
"""
Migration runner service - executes database migrations and exits.
This service runs Alembic migrations against PostgreSQL and terminates.
"""

import os
import sys
from pathlib import Path
from alembic import command
from alembic.config import Config

def run_migrations():
    """Run Alembic migrations."""
    print("Starting database migrations...")

    # Change to backend directory to run migrations
    backend_dir = Path(__file__).parent.parent.parent
    os.chdir(backend_dir)

    # Ensure shared models are imported for alembic
    import backend.shared.models

    # Set DATABASE_URL from environment if not set
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        print("ERROR: DATABASE_URL environment variable not set")
        sys.exit(1)

    # Export DATABASE_URL for alembic
    os.environ["DATABASE_URL"] = db_url

    try:
        # Use the robust migration system from migration.py
        # This handles all edge cases and recovery scenarios automatically
        print("Starting database migrations...")

        # Import and run the migration function
        from backend.migration import run_migrations
        run_migrations()

        print("Database migrations completed successfully!")

    except Exception as e:
        print(f"ERROR: Failed to run migrations: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    run_migrations()
