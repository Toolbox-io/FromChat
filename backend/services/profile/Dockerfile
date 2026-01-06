# Profile Service Dockerfile
FROM backend/base:latest

# Copy service-specific files
COPY backend/routes/profile.py /app/backend/routes/profile.py
COPY backend/services/profile/main.py /app/backend/services/profile/main.py

# Set service name for entrypoint
ENV SERVICE_NAME=profile

EXPOSE 8301
