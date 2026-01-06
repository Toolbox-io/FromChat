# Account Service Dockerfile
FROM backend/base:latest

# Copy service-specific files
COPY backend/routes/account.py /app/backend/routes/account.py
COPY backend/services/account/main.py /app/backend/services/account/main.py

# Set service name for entrypoint
ENV SERVICE_NAME=account

EXPOSE 8301
