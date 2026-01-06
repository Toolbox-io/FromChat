# Moderation Service Dockerfile
FROM backend/base:latest

# Copy service-specific files
COPY backend/routes/moderation.py /app/backend/routes/moderation.py
COPY backend/security/profanity.py /app/backend/security/profanity.py
COPY backend/similarity.py /app/backend/similarity.py
COPY backend/services/moderation/main.py /app/backend/services/moderation/main.py

# Set service name for entrypoint
ENV SERVICE_NAME=moderation

EXPOSE 8301
