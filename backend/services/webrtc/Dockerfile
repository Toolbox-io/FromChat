# WebRTC Service Dockerfile
FROM backend/base:latest

# Copy service-specific files
COPY backend/routes/webrtc.py /app/backend/routes/webrtc.py
COPY backend/services/webrtc/main.py /app/backend/services/webrtc/main.py

# Set service name for entrypoint
ENV SERVICE_NAME=webrtc

EXPOSE 8301
