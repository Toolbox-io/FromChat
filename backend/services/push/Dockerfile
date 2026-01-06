# Push Service Dockerfile
FROM backend/base:latest

# Copy service-specific files
COPY backend/routes/push.py /app/backend/routes/push.py
COPY backend/push_service.py /app/backend/push_service.py
COPY backend/services/push/main.py /app/backend/services/push/main.py

# Set service name for entrypoint
ENV SERVICE_NAME=push

EXPOSE 8301
