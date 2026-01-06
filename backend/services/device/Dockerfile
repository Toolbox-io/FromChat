# Device Service Dockerfile
FROM backend/base:latest

# Copy service-specific files
COPY backend/routes/devices.py /app/backend/routes/devices.py
COPY backend/services/device/main.py /app/backend/services/device/main.py

# Set service name for entrypoint
ENV SERVICE_NAME=device

EXPOSE 8301
