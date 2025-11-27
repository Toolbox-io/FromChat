#!/bin/bash
set -e

# Complete deployment script: build and push to server
# Usage: ./scripts/deploy.sh [server_user@server_host] [deployment_path] [platform]
# Example: ./scripts/deploy.sh user@example.com /home/user/fromchat linux/arm64

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# Helper functions
info() { echo -e "${BLUE}ℹ${NC} $1"; }
success() { echo -e "${GREEN}✓${NC} $1"; }
warning() { echo -e "${YELLOW}⚠${NC} $1"; }
error() { echo -e "${RED}✗${NC} $1"; exit 1; }
step() { echo -e "${CYAN}${BOLD}→${NC} ${BOLD}$1${NC}"; }
substep() { 
    if [ "$2" = "-n" ]; then
        echo -n -e "  ${GREEN}•${NC} $1"
    else
        echo -e "  ${GREEN}•${NC} $1"
    fi
}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
DEPLOYMENT_DIR="$PROJECT_ROOT/deployment"
ENV_FILE="$DEPLOYMENT_DIR/.env"

# Load .env file if it exists
if [ -f "$ENV_FILE" ]; then
    # Export variables from .env file (ignore comments and empty lines)
    set -a
    while IFS= read -r line || [ -n "$line" ]; do
        # Skip comments and empty lines
        case "$line" in
            \#*|'') continue ;;
            *)
                # Export the variable
                export "$line" 2>/dev/null || true
                ;;
        esac
    done < "$ENV_FILE"
    set +a
fi

# Read server from environment variable (from .env), command line argument, or fallback
SERVER="${1:-${DEPLOYMENT_SERVER:-}}"
DEPLOY_PATH="${2:-${DEPLOY_PATH:-/home/denis0001-dev/actions-runner/_work/FromChat/FromChat}}"
PLATFORM="${3:-linux/arm64}"

# Check if server is provided
if [ -z "$SERVER" ]; then
    error "Server not specified. Usage: $0 [user@host] [deployment_path] [platform]"
    echo "   Or set DEPLOYMENT_SERVER in $ENV_FILE or as an environment variable"
    echo ""
    echo "Example:"
    echo "  $0 user@example.com /home/user/fromchat linux/arm64"
    echo "  Or add to $ENV_FILE: DEPLOYMENT_SERVER=user@example.com"
    echo "  Or: DEPLOYMENT_SERVER=user@example.com $0"
    exit 1
fi

echo -e "${MAGENTA}${BOLD}🚀 Deployment${NC}\n"

# ============================================================================
# BUILD PHASE
# ============================================================================

echo -e "${MAGENTA}${BOLD}🔨 Building Docker images${NC}"

# Determine project name
if [ -n "$SERVER" ]; then
    COMPOSE_DIR=$(ssh "$SERVER" "dirname $DEPLOY_PATH/deployment/docker-compose.yml" 2>/dev/null || echo "$DEPLOY_PATH/deployment")
    PROJECT_NAME=$(ssh "$SERVER" "basename $COMPOSE_DIR" 2>/dev/null || echo "deployment")
else
    PROJECT_NAME=$(basename "$DEPLOYMENT_DIR")
fi

# Check buildx
if ! docker buildx version > /dev/null 2>&1; then
    error "Docker buildx not available. Install Docker Desktop."
fi

# Setup buildx builder
step "Setting up buildx builder"
BUILDER_NAME="fromchat-builder"
BUILDER_EXISTS=false

if docker buildx inspect "$BUILDER_NAME" > /dev/null 2>&1; then
    BUILDER_EXISTS=true
    if ! docker buildx use "$BUILDER_NAME" > /dev/null 2>&1; then
        substep "Recreating builder..."
        docker buildx rm "$BUILDER_NAME" > /dev/null 2>&1 || true
        BUILDER_EXISTS=false
    elif ! docker buildx inspect "$BUILDER_NAME" > /dev/null 2>&1; then
        substep "Recreating builder (inspection failed)..."
        docker buildx rm "$BUILDER_NAME" > /dev/null 2>&1 || true
        BUILDER_EXISTS=false
    fi
fi

if [ "$BUILDER_EXISTS" = false ]; then
    substep "Creating builder with persistent cache..."
    docker buildx create \
        --name "$BUILDER_NAME" \
        --driver docker-container \
        --driver-opt image=moby/buildkit:latest \
        --use \
        --bootstrap > /dev/null 2>&1
fi

docker buildx use "$BUILDER_NAME" > /dev/null 2>&1

# Detect services
step "Detecting services"
cd "$DEPLOYMENT_DIR"
SERVICES=$(docker compose -f docker-compose.yml config --services 2>/dev/null)

if [ -z "$SERVICES" ]; then
    error "No services found in docker-compose.yml"
fi

BUILT_IMAGES=()

for SERVICE in $SERVICES; do
    HAS_BUILD=$(docker compose -f docker-compose.yml config 2>/dev/null | \
        grep -A 30 "^[[:space:]]*${SERVICE}:" | \
        grep -q "build:" && echo "yes" || echo "no")
    
    if [ "$HAS_BUILD" != "yes" ]; then
        continue
    fi
    
    IMAGE_TAG="${PROJECT_NAME}-${SERVICE}:latest"
    
    substep "Building ${CYAN}$SERVICE${NC} -> ${CYAN}$IMAGE_TAG${NC}..."
    
    BUILD_OUTPUT=$(docker compose -f docker-compose.yml config 2>/dev/null | \
        grep -A 15 "^[[:space:]]*${SERVICE}:" | \
        grep -A 10 "build:")
    
    DOCKERFILE_REL=$(echo "$BUILD_OUTPUT" | grep "dockerfile:" | \
        sed 's/.*dockerfile:[[:space:]]*\(.*\)/\1/' | \
        tr -d '"' | tr -d "'" | xargs)
    
    CONTEXT_REL=$(echo "$BUILD_OUTPUT" | grep "context:" | \
        sed 's/.*context:[[:space:]]*\(.*\)/\1/' | \
        tr -d '"' | tr -d "'" | xargs)
    
    if [ -z "$CONTEXT_REL" ]; then
        CONTEXT_REL=".."
    fi
    
    if [[ "$CONTEXT_REL" == ".." ]]; then
        BUILD_CONTEXT="$PROJECT_ROOT"
    elif [[ "$CONTEXT_REL" == /* ]]; then
        BUILD_CONTEXT="$CONTEXT_REL"
    else
        BUILD_CONTEXT="$DEPLOYMENT_DIR/$CONTEXT_REL"
    fi
    
    if [ -n "$DOCKERFILE_REL" ]; then
        if [[ "$DOCKERFILE_REL" == /* ]]; then
            DOCKERFILE="$DOCKERFILE_REL"
        else
            if [[ "$CONTEXT_REL" == ".." ]] || [[ "$BUILD_CONTEXT" == "$PROJECT_ROOT" ]]; then
                DOCKERFILE="$PROJECT_ROOT/$DOCKERFILE_REL"
            else
                DOCKERFILE="$BUILD_CONTEXT/$DOCKERFILE_REL"
            fi
        fi
    else
        if [ -f "$DEPLOYMENT_DIR/Dockerfile.$SERVICE" ]; then
            DOCKERFILE="$DEPLOYMENT_DIR/Dockerfile.$SERVICE"
        elif [ -f "$DEPLOYMENT_DIR/$SERVICE/Dockerfile" ]; then
            DOCKERFILE="$DEPLOYMENT_DIR/$SERVICE/Dockerfile"
        else
            error "Could not determine Dockerfile for $SERVICE"
        fi
    fi
    
    if docker buildx build \
        --platform "$PLATFORM" \
        --file "$DOCKERFILE" \
        --tag "$IMAGE_TAG" \
        --load \
        "$BUILD_CONTEXT"; then
        echo -e "  ${GREEN}✓${NC} Built ${CYAN}$SERVICE${NC}"
        BUILT_IMAGES+=("$IMAGE_TAG")
        echo ""
    else
        error "Build failed for $SERVICE"
    fi
done

success "Build complete! ${#BUILT_IMAGES[@]} image(s) ready"

# ============================================================================
# DEPLOY PHASE
# ============================================================================

echo -e "\n${MAGENTA}${BOLD}🚀 Deploying to ${SERVER}${NC}\n"

# Ask for sudo password at the beginning
step "Authentication"
SUDO_PASSWORD=""
while true; do
    substep "Sudo password: " -n
    read -sp "" SUDO_PASSWORD
    echo ""
    
    if [ -z "$SUDO_PASSWORD" ]; then
        warning "No password provided - assuming passwordless sudo"
        break
    fi
    
    if echo "$SUDO_PASSWORD" | ssh "$SERVER" "sudo -S -v" > /dev/null 2>&1; then
        export SUDO_PASSWORD
        break
    else
        error "Invalid password, please try again"
    fi
done

# Check SSH connection (silent)
if ! ssh -o BatchMode=yes -o ConnectTimeout=5 "$SERVER" "echo" > /dev/null 2>&1; then
    warning "SSH key auth not available, will prompt when needed"
fi

# Check docker pussh
if ! docker pussh --help > /dev/null 2>&1; then
    error "docker pussh plugin not installed"
    echo "   Install: npm run install:pussh"
fi

# Detect images
IMAGES=($(docker images --format "{{.Repository}}:{{.Tag}}" | grep "^${PROJECT_NAME}-" || true))

if [ ${#IMAGES[@]} -eq 0 ]; then
    error "No ${PROJECT_NAME} images found"
fi

# Pre-pull unregistry image if needed
UNREGISTRY_IMAGE="ghcr.io/psviderski/unregistry:0.3.1"
if ! ssh "$SERVER" "docker images --format '{{.Repository}}:{{.Tag}}' | grep -q '^${UNREGISTRY_IMAGE}$'" 2>/dev/null; then
    substep "Pulling unregistry image (one-time setup)..."
    ssh "$SERVER" "docker pull ${UNREGISTRY_IMAGE}" > /dev/null 2>&1 || true
fi

# Transfer images
step "Transferring images"
PUSH_FAILED=0
for IMAGE in "${IMAGES[@]}"; do
    substep "Pushing ${CYAN}$IMAGE${NC}..."
    if docker pussh "$IMAGE" "$SERVER"; then
        echo ""
    else
        echo -e "  ${RED}✗${NC} Failed to push ${CYAN}$IMAGE${NC}"
        PUSH_FAILED=1
        echo ""
    fi
done

if [ $PUSH_FAILED -eq 1 ]; then
    error "Image transfer failed"
fi

# Transfer files
step "Transferring deployment files"
TEMP_DIR="/tmp/fromchat-deploy-$$"
ssh "$SERVER" "mkdir -p $TEMP_DIR" > /dev/null 2>&1

# Copy docker-compose.yml
if scp "$DEPLOYMENT_DIR/docker-compose.yml" "$SERVER:$TEMP_DIR/docker-compose.yml" > /dev/null 2>&1; then
    if [ -n "$SUDO_PASSWORD" ]; then
        ssh "$SERVER" bash << REMOTE_SUDO_SCRIPT > /dev/null 2>&1
set -e
echo '$SUDO_PASSWORD' | sudo -S -p '' mkdir -p $DEPLOY_PATH/deployment 2>/dev/null || true
echo '$SUDO_PASSWORD' | sudo -S -p '' cp $TEMP_DIR/docker-compose.yml $DEPLOY_PATH/deployment/ 2>/dev/null || true
echo '$SUDO_PASSWORD' | sudo -S -p '' chown \$(whoami):\$(whoami) $DEPLOY_PATH/deployment/docker-compose.yml 2>/dev/null || true
REMOTE_SUDO_SCRIPT
    else
        ssh "$SERVER" "sudo mkdir -p $DEPLOY_PATH/deployment && sudo cp $TEMP_DIR/docker-compose.yml $DEPLOY_PATH/deployment/ && sudo chown \$(whoami):\$(whoami) $DEPLOY_PATH/deployment/docker-compose.yml" > /dev/null 2>&1 || true
    fi
fi

# Copy service file
scp "$DEPLOYMENT_DIR/fromchat.service" "$SERVER:$TEMP_DIR/fromchat.service" > /dev/null 2>&1 || {
    error "Failed to copy fromchat.service"
}

if [ -n "$SUDO_PASSWORD" ]; then
    ssh "$SERVER" bash << REMOTE_SUDO_SCRIPT > /dev/null 2>&1
set -e
echo '$SUDO_PASSWORD' | sudo -S -p '' mkdir -p $DEPLOY_PATH/deployment 2>/dev/null
echo '$SUDO_PASSWORD' | sudo -S -p '' cp $TEMP_DIR/fromchat.service $DEPLOY_PATH/deployment/ 2>/dev/null
echo '$SUDO_PASSWORD' | sudo -S -p '' chown \$(whoami):\$(whoami) $DEPLOY_PATH/deployment/fromchat.service 2>/dev/null
REMOTE_SUDO_SCRIPT
else
    ssh "$SERVER" "sudo mkdir -p $DEPLOY_PATH/deployment && sudo cp $TEMP_DIR/fromchat.service $DEPLOY_PATH/deployment/ && sudo chown \$(whoami):\$(whoami) $DEPLOY_PATH/deployment/fromchat.service" > /dev/null 2>&1 || {
        error "Failed to copy fromchat.service"
    }
fi

ssh "$SERVER" "rm -rf $TEMP_DIR" > /dev/null 2>&1 || true

# Deploy on server
step "Deploying on server"
ssh "$SERVER" SUDO_PASSWORD="$SUDO_PASSWORD" DEPLOY_PATH="$DEPLOY_PATH" bash << 'REMOTE_SCRIPT'
set -e

REMOTE_SUDO_PASS="${SUDO_PASSWORD:-}"
REMOTE_DEPLOY_PATH="${DEPLOY_PATH:-}"
export SUDO_PROMPT=""

sudo_cmd() {
    if [ -n "$REMOTE_SUDO_PASS" ]; then
        echo "$REMOTE_SUDO_PASS" | sudo -S -p '' "$@" 2>/dev/null
    else
        sudo "$@" 2>/dev/null
    fi
}

if [ -z "$REMOTE_DEPLOY_PATH" ]; then
    echo "❌ DEPLOY_PATH is not set"
    exit 1
fi

mkdir -p "$REMOTE_DEPLOY_PATH/deployment"
cd "$REMOTE_DEPLOY_PATH/deployment"

if [ ! -f "$REMOTE_DEPLOY_PATH/deployment/.env" ]; then
    echo "⚠️  Warning: .env file not found"
fi

if systemctl is-active --quiet fromchat; then
    sudo_cmd systemctl stop fromchat
fi

docker compose down > /dev/null 2>&1 || true

sudo_cmd cp -f "$REMOTE_DEPLOY_PATH/deployment/fromchat.service" /etc/systemd/system/fromchat.service
sudo_cmd systemctl daemon-reload
sudo_cmd systemctl restart fromchat

sleep 3
if systemctl is-active --quiet fromchat; then
    echo "✅ Service started"
else
    echo "❌ Service failed to start"
    sudo_cmd journalctl --no-pager -xeu fromchat -n 30
    exit 1
fi
REMOTE_SCRIPT

success "Deployment complete!"
