# Messaging Service Dockerfile
FROM backend/base:latest

# Copy service-specific files
COPY backend/routes/messaging.py /app/backend/routes/messaging.py
COPY backend/websocket /app/backend/websocket/
COPY backend/services/messaging/main.py /app/backend/services/messaging/main.py

# Set service name for entrypoint
ENV SERVICE_NAME=messaging

EXPOSE 8301
