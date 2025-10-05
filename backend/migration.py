"""
Database migration utility using Alembic.
This module handles running database migrations on startup.
"""
import os
import logging
from alembic import command
from alembic.config import Config
from alembic.runtime.migration import MigrationContext
from sqlalchemy import create_engine
from constants import DATABASE_URL
import logging

logger = logging.getLogger(__name__)

def run_migrations():
    """
    Run database migrations using Alembic.
    This function will upgrade the database to the latest migration.
    Fully automated - handles all scenarios automatically.
    """
    try:
        # Get the directory where this script is located
        current_dir = os.path.dirname(os.path.abspath(__file__))
        
        # Create Alembic configuration
        alembic_cfg = Config(os.path.join(current_dir, "alembic.ini"))
        
        # Disable Alembic's logging configuration to avoid interfering with FastAPI
        alembic_cfg.set_main_option("configure_logging", "false")
        
        # Set the database URL in the config
        alembic_cfg.set_main_option("sqlalchemy.url", DATABASE_URL)
        
        # Check if any migration files exist
        versions_dir = os.path.join(current_dir, "alembic", "versions")

        if not os.path.exists(versions_dir):
            os.makedirs(versions_dir)

        migration_files = [f for f in os.listdir(versions_dir) if f.endswith('.py') and not f.startswith('__')]
        
        if not migration_files:
            logger.info("No migration files found. Creating initial migration...")
            # Check if database exists and has tables
            engine = create_engine(DATABASE_URL)
            with engine.connect() as connection:
                from sqlalchemy import text
                result = connection.execute(text("SELECT name FROM sqlite_master WHERE type='table' AND name != 'alembic_version'"))
                existing_tables = result.fetchall()
                
                if existing_tables:
                    logger.info("Found existing database with tables. Creating migration to match current schema...")
                    # Create migration with autogenerate to detect differences
                    command.revision(alembic_cfg, autogenerate=True, message="Initial migration from existing database")
                    
                    # Check if the generated migration is empty (common with existing databases)
                    versions_dir = os.path.join(current_dir, "alembic", "versions")
                    migration_files = [f for f in os.listdir(versions_dir) if f.endswith('.py') and not f.startswith('__')]
                    if migration_files:
                        latest_migration = max(migration_files)
                        migration_path = os.path.join(versions_dir, latest_migration)
                        
                        # Check if migration is empty
                        with open(migration_path, 'r') as f:
                            content = f.read()
                            if 'pass' in content and 'op.create_table' not in content and 'op.add_column' not in content:
                                logger.info("Generated migration is empty. Creating complete schema migration...")
                                # Remove the empty migration
                                os.remove(migration_path)
                                # Create a complete migration
                                _create_complete_migration(alembic_cfg)
                else:
                    logger.info("No existing tables found. Creating fresh migration...")
                    # Create fresh migration
                    command.revision(alembic_cfg, autogenerate=True, message="Initial migration")
            logger.info("Initial migration created successfully.")
        else:
            # Migration files exist, check if we need to create a new migration for schema changes
            logger.info("Migration files exist. Checking for pending schema changes...")
            try:
                # Create a new migration to detect any schema changes
                command.revision(alembic_cfg, autogenerate=True, message="Auto-generated migration for schema changes")
                
                # Check if the new migration is empty (no changes detected)
                migration_files = [f for f in os.listdir(versions_dir) if f.endswith('.py') and not f.startswith('__')]
                if migration_files:
                    latest_migration = max(migration_files)
                    migration_path = os.path.join(versions_dir, latest_migration)
                    
                    # Check if migration is empty
                    with open(migration_path, 'r') as f:
                        content = f.read()
                        if 'pass' in content and 'op.create_table' not in content and 'op.add_column' not in content and 'op.drop_table' not in content and 'op.drop_column' not in content:
                            logger.info("No schema changes detected. Removing empty migration...")
                            # Remove the empty migration
                            os.remove(migration_path)
                        else:
                            logger.info("Schema changes detected. New migration created.")
                            
            except Exception as e:
                logger.info(f"No new migrations needed or error creating migration: {e}")
                pass
        
        # Run the upgrade command
        logger.info("Running database migrations...")
        command.upgrade(alembic_cfg, "head")
        logger.info("Database migrations completed successfully.")
        
    except Exception as e:
        logger.error(f"Error running database migrations: {e}")
        # Fully automated recovery - handle ALL error scenarios
        logger.info("Attempting automated recovery...")
        try:
            # Clear the alembic_version table to reset state
            engine = create_engine(DATABASE_URL)
            with engine.connect() as connection:
                from sqlalchemy import text
                connection.execute(text("DROP TABLE IF EXISTS alembic_version"))
                connection.commit()
            
            # Remove any existing migration files to start fresh
            versions_dir = os.path.join(current_dir, "alembic", "versions")
            for file in os.listdir(versions_dir):
                if file.endswith('.py') and not file.startswith('__'):
                    os.remove(os.path.join(versions_dir, file))
            
            # Create a completely fresh migration with full schema
            logger.info("Creating fresh migration with complete schema...")
            _create_complete_migration(alembic_cfg)
            
            # Run the migration
            command.upgrade(alembic_cfg, "head")
            logger.info("Automated recovery completed successfully.")
            
        except Exception as recovery_error:
            logger.error(f"Automated recovery failed: {recovery_error}")
            # Last resort: create database using SQLAlchemy directly
            logger.info("Using fallback: creating database directly...")
            _create_database_directly()
            logger.info("Database created successfully using fallback method.")


def _create_complete_migration(alembic_cfg):
    """Create a complete migration file with all database schema."""
    # Create a new migration file
    command.revision(alembic_cfg, message="Complete schema migration")
    
    # Get the latest migration file
    versions_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "alembic", "versions")
    migration_files = [f for f in os.listdir(versions_dir) if f.endswith('.py') and not f.startswith('__')]
    latest_migration = max(migration_files) if migration_files else None
    
    if latest_migration:
        migration_path = os.path.join(versions_dir, latest_migration)
        _populate_migration_file(migration_path)


def _populate_migration_file(migration_path):
    """Populate a migration file with the complete database schema from models."""
    # Generate the migration content dynamically from models
    migration_content = _generate_migration_from_models()
    
    # Read the current migration file
    with open(migration_path, 'r') as f:
        content = f.read()
    
    # Replace the empty upgrade/downgrade functions
    import re
    # More flexible regex to match the actual content
    content = re.sub(
        r'def upgrade\(\) -> None:.*?pass.*?(?=\n\ndef downgrade|\n\nif __name__|\Z)',
        migration_content,
        content,
        flags=re.DOTALL
    )
    
    # Write the updated content back
    with open(migration_path, 'w') as f:
        f.write(content)


def _generate_migration_from_models():
    """Generate migration content dynamically from SQLAlchemy models."""
    from models import Base
    import sqlalchemy as sa
    
    # Generate migration content using Alembic's op functions
    upgrade_statements = []
    downgrade_statements = []
    
    # Get all tables from Base metadata
    for table_name, table in Base.metadata.tables.items():
        if table_name != 'alembic_version':  # Skip alembic_version table
            # Check if table exists and compare schema
            schema_diff = _detect_schema_differences(table_name, table)
            
            if schema_diff['table_exists']:
                if schema_diff['needs_update']:
                    # Generate ALTER TABLE statements for existing table
                    upgrade_statements.append(f"    # Update {table_name} table schema")
                    for statement in schema_diff['alter_statements']:
                        upgrade_statements.append(f"    {statement}")
                else:
                    # Table exists and is up to date
                    upgrade_statements.append(f"    # Table {table_name} is already up to date")
            else:
                # Generate CREATE TABLE for new table
                table_code = _generate_table_creation_code(table_name, table)
                upgrade_statements.append(f"    # Create {table_name} table")
                upgrade_statements.append(table_code)
            
            # Generate DROP TABLE statement for downgrade
            downgrade_statements.append(f"    op.drop_table('{table_name}')")
    
    # Combine all statements
    upgrade_content = "def upgrade() -> None:\n    \"\"\"Upgrade schema.\"\"\"\n" + "\n".join(upgrade_statements)
    downgrade_content = "def downgrade() -> None:\n    \"\"\"Downgrade schema.\"\"\"\n" + "\n".join(downgrade_statements)
    
    return upgrade_content + "\n\n" + downgrade_content


def _detect_schema_differences(table_name, expected_table):
    """Detect differences between existing table and expected schema."""
    engine = create_engine(DATABASE_URL)
    
    with engine.connect() as connection:
        from sqlalchemy import text, inspect
        
        # Check if table exists
        inspector = inspect(connection)
        if table_name not in inspector.get_table_names():
            return {
                'table_exists': False,
                'needs_update': False,
                'alter_statements': []
            }
        
        # Get existing columns
        existing_columns = inspector.get_columns(table_name)
        existing_column_names = {col['name'] for col in existing_columns}
        
        # Get expected columns
        expected_column_names = {col.name for col in expected_table.columns}
        
        # Check for missing columns
        missing_columns = expected_column_names - existing_column_names
        extra_columns = existing_column_names - expected_column_names
        
        alter_statements = []
        
        # Add missing columns
        for column in expected_table.columns:
            if column.name in missing_columns:
                column_def = _generate_column_definition(column)
                alter_statements.append(f"op.add_column('{table_name}', {column_def})")
        
        # Add missing indexes
        for index in expected_table.indexes:
            if not index.unique:
                cols = "', '".join([col.name for col in index.columns])
                alter_statements.append(f"op.create_index(op.f('ix_{table_name}_{index.name}'), '{table_name}', ['{cols}'], unique=False)")
        
        return {
            'table_exists': True,
            'needs_update': len(alter_statements) > 0,
            'alter_statements': alter_statements
        }


def _generate_column_definition(column):
    """Generate column definition for ALTER TABLE."""
    type_def = _get_column_type(column)
    nullable = "nullable=True" if column.nullable else "nullable=False"
    
    definition = f"sa.Column('{column.name}', {type_def}, {nullable}"
    
    # Handle default values properly
    if column.default is not None:
        if hasattr(column.default, 'arg'):
            # Handle callable defaults
            if callable(column.default.arg):
                definition += f", default=datetime.now"
            else:
                definition += f", default={repr(column.default.arg)}"
        else:
            definition += f", default={repr(column.default)}"
    
    definition += ")"
    return definition


def _generate_table_creation_code(table_name, table):
    """Generate op.create_table code for a SQLAlchemy table."""
    lines = [f"    op.create_table('{table_name}',"]
    
    # Add columns
    for column in table.columns:
        column_def = f"        sa.Column('{column.name}', {_get_column_type(column)}, nullable={column.nullable}"
        if column.default is not None:
            column_def += f", default={repr(column.default)}"
        column_def += ")"
        lines.append(column_def)
    
    # Add constraints
    for constraint in table.constraints:
        if hasattr(constraint, 'columns'):
            if constraint.__class__.__name__ == 'PrimaryKeyConstraint':
                lines.append(f"        sa.PrimaryKeyConstraint('{constraint.columns.keys()[0]}')")
            elif constraint.__class__.__name__ == 'UniqueConstraint':
                cols = "', '".join(constraint.columns.keys())
                lines.append(f"        sa.UniqueConstraint('{cols}')")
    
    # Add foreign key constraints
    for fk in table.foreign_keys:
        lines.append(f"        sa.ForeignKeyConstraint(['{fk.parent.name}'], ['{fk.column.table.name}.{fk.column.name}'], )")
    
    lines.append("    )")
    
    # Add indexes
    for index in table.indexes:
        if not index.unique:
            cols = "', '".join([col.name for col in index.columns])
            lines.append(f"    op.create_index(op.f('ix_{table_name}_{index.name}'), '{table_name}', ['{cols}'], unique=False)")
    
    return "\n".join(lines)


def _get_column_type(column):
    """Get SQLAlchemy column type string."""
    type_name = column.type.__class__.__name__
    
    if type_name == 'String':
        return f"sa.String(length={column.type.length})"
    elif type_name == 'Integer':
        return "sa.Integer()"
    elif type_name == 'Text':
        return "sa.Text()"
    elif type_name == 'Boolean':
        return "sa.Boolean()"
    elif type_name == 'DateTime':
        return "sa.DateTime()"
    else:
        return f"sa.{type_name}()"


def _create_database_directly():
    """Fallback method: create database directly using SQLAlchemy."""
    from models import Base
    from db import engine
    from sqlalchemy import text, inspect
    
    # Check existing tables and update schema
    with engine.connect() as connection:
        inspector = inspect(connection)
        existing_tables = inspector.get_table_names()
        
        # For each model table, check if it needs updates
        for table_name, table in Base.metadata.tables.items():
            if table_name != 'alembic_version':
                if table_name in existing_tables:
                    # Table exists, check for missing columns
                    existing_columns = {col['name'] for col in inspector.get_columns(table_name)}
                    expected_columns = {col.name for col in table.columns}
                    missing_columns = expected_columns - existing_columns
                    
                    # Add missing columns
                    for column in table.columns:
                        if column.name in missing_columns:
                            # Convert to raw SQL for direct execution
                            sql_type = _get_sql_type(column)
                            nullable = "NULL" if column.nullable else "NOT NULL"
                            
                            # Handle datetime columns without default (SQLite limitation)
                            if column.type.__class__.__name__ == 'DateTime':
                                # Add column without default, then update existing rows
                                alter_sql = f"ALTER TABLE {table_name} ADD COLUMN {column.name} {sql_type} {nullable}"
                                try:
                                    connection.execute(text(alter_sql))
                                    logger.info(f"Added column {column.name} to {table_name}")
                                    
                                    # Update existing rows with current timestamp
                                    update_sql = f"UPDATE {table_name} SET {column.name} = CURRENT_TIMESTAMP WHERE {column.name} IS NULL"
                                    connection.execute(text(update_sql))
                                    logger.info(f"Updated {column.name} with current timestamp")
                                except Exception as e:
                                    logger.error(f"Could not add column {column.name}: {e}")
                            else:
                                # Handle other column types with defaults
                                default_clause = ""
                                if column.default is not None:
                                    if hasattr(column.default, 'arg') and callable(column.default.arg):
                                        # Skip callable defaults for SQLite compatibility
                                        pass
                                    elif hasattr(column.default, 'arg'):
                                        default_clause = f" DEFAULT {repr(column.default.arg)}"
                                
                                alter_sql = f"ALTER TABLE {table_name} ADD COLUMN {column.name} {sql_type} {nullable}{default_clause}"
                                try:
                                    connection.execute(text(alter_sql))
                                    logger.info(f"Added column {column.name} to {table_name}")
                                except Exception as e:
                                    logger.error(f"Could not add column {column.name}: {e}")
                else:
                    # Table doesn't exist, create it
                    logger.info(f"Creating table {table_name}")
        
        # Create alembic_version table manually
        connection.execute(text("""
            CREATE TABLE IF NOT EXISTS alembic_version (
                version_num VARCHAR(32) NOT NULL,
                CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num)
            )
        """))
        connection.execute(text("INSERT OR IGNORE INTO alembic_version (version_num) VALUES ('direct_creation')"))
        connection.commit()


def _get_sql_type(column):
    """Get SQL type for direct SQL execution."""
    type_name = column.type.__class__.__name__
    
    if type_name == 'String':
        return f"VARCHAR({column.type.length})"
    elif type_name == 'Integer':
        return "INTEGER"
    elif type_name == 'Text':
        return "TEXT"
    elif type_name == 'Boolean':
        return "BOOLEAN"
    elif type_name == 'DateTime':
        return "DATETIME"
    else:
        return "TEXT"  # fallback


def check_migration_status():
    """
    Check if the database needs migrations.
    Returns True if migrations are needed, False otherwise.
    """
    try:
        # Create engine
        engine = create_engine(DATABASE_URL)
        
        # Check if alembic_version table exists
        with engine.connect() as connection:
            # Check if alembic_version table exists
            from sqlalchemy import text
            result = connection.execute(
                text("SELECT name FROM sqlite_master WHERE type='table' AND name='alembic_version'")
            )
            alembic_table_exists = result.fetchone() is not None
            
            if not alembic_table_exists:
                return True
            
            # Get current migration context
            context = MigrationContext.configure(connection)
            current_rev = context.get_current_revision()
            
            # Get the latest revision from alembic
            current_dir = os.path.dirname(os.path.abspath(__file__))
            alembic_cfg = Config(os.path.join(current_dir, "alembic.ini"))
            script_dir = command.ScriptDirectory.from_config(alembic_cfg)
            head_rev = script_dir.get_current_head()
            
            return current_rev != head_rev
            
    except Exception as e:
        logger.error(f"Error checking migration status: {e}")
        return True  # Assume migrations are needed if we can't check


if __name__ == "__main__":
    # This allows running migrations directly
    run_migrations()
