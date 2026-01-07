#!/bin/bash

echo > deployment/.env

./.venv/bin/python3 backend/generate_vapid_keys.py >> deployment/.env

cat >> deployment/.env <<EOF
VAPID_SUBJECT=mailto:support@fromchat.ru
JWT_SECRET="$(openssl rand -base64 32)"
TURN_USERNAME=<set>
TURN_SECRET=<set>
DEPLOYMENT_SERVER=<set>
FIREBASE_CERT=<set>
DB_PASSWORD=development
EOF
