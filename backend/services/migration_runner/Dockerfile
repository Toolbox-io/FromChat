# Migration Runner Dockerfile
FROM backend/base:latest

# Copy migration files
COPY backend/alembic /app/backend/alembic/
COPY backend/migration.py /app/backend/migration.py

# Copy migration runner
COPY backend/services/migration_runner/main.py /app/backend/services/migration_runner/main.py

# Set service name for entrypoint
ENV SERVICE_NAME=migration_runner

# Override entrypoint to run migrations
ENTRYPOINT ["python", "-m", "backend.services.migration_runner.main"]
