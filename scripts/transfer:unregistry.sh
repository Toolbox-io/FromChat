#!/bin/bash
# Transfer unregistry image from local machine to server
# Usage: ./scripts/transfer:unregistry.sh [server_user@server_host]

set -e

SERVER="${1:-${DEPLOY_SERVER:-}}"

if [ -z "$SERVER" ]; then
    echo "❌ Server not specified. Usage: $0 [user@host]"
    echo "   Or set DEPLOY_SERVER environment variable"
    exit 1
fi

echo "📦 Transferring unregistry image to $SERVER..."

# Pull the image locally if not already present
if ! docker images ghcr.io/psviderski/unregistry:0.3.1 --format "{{.Repository}}:{{.Tag}}" | grep -q "unregistry:0.3.1"; then
    echo "  Pulling unregistry:0.3.1 locally..."
    docker pull ghcr.io/psviderski/unregistry:0.3.1
fi

# Save and transfer the image
echo "  Saving and transferring image to server..."
docker save ghcr.io/psviderski/unregistry:0.3.1 | ssh "$SERVER" "docker load"

echo "  ✓ Unregistry image transferred successfully"
echo ""
echo "  Now you can run on the server:"
echo "  docker run -d \\"
echo "    --name unregistry \\"
echo "    -p 5000:5000 \\"
echo "    -v /run/containerd/containerd.sock:/run/containerd/containerd.sock \\"
echo "    --restart unless-stopped \\"
echo "    ghcr.io/psviderski/unregistry:0.3.1"


