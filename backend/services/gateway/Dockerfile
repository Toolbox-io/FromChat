# Gateway Service Dockerfile
FROM backend/base:latest

# Copy service-specific files
COPY backend/app.py /app/backend/app.py
COPY backend/main.py /app/backend/main.py
COPY backend/dependencies.py /app/backend/dependencies.py
COPY backend/security /app/backend/security/
COPY backend/services/gateway/main.py /app/backend/services/gateway/main.py

# Set service name for entrypoint
ENV SERVICE_NAME=gateway

EXPOSE 8301
