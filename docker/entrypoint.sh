#!/bin/bash
# Entrypoint script for FromChat microservices

# Run the service module
exec python -m backend.services.${SERVICE_NAME}.main
