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
error() { echo -e "${RED}✗${NC} $1"; }
step() { echo -e "${CYAN}${BOLD}→${NC} ${BOLD}$1${NC}"; }
substep() { 
    if [ "$2" = "-n" ]; then
        echo -n -e "  ${GREEN}•${NC} $1"
    else
        echo -e "  ${GREEN}•${NC} $1"
    fi
}

echo -e "${MAGENTA}${BOLD}🚀 Deployment${NC}\n"

# Read password with asterisks
read_password() {
    local password=""
    local char
    local old_stty
    
    # Save current terminal settings
    old_stty=$(stty -g 2>/dev/null)
    
    # Disable echo
    stty -echo 2>/dev/null
    
    # Read characters one by one
    while IFS= read -rs -n 1 char; do
        # Check for Enter key (empty means Enter was pressed)
        if [ -z "$char" ]; then
            break
        fi
        # Check for backspace/delete (ASCII 127)
        if [ "$char" = $'\177' ] || [ "$char" = $'\b' ]; then
            if [ ${#password} -gt 0 ]; then
                password="${password%?}"
                printf "\b \b" >&2
            fi
        else
            password+="$char"
            printf "*" >&2
        fi
    done
    
    # Restore terminal settings
    stty "$old_stty" 2>/dev/null
    echo "" >&2
    echo "$password"
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
REPO_NAME="FromChat"
DEPLOY_PATH="~/actions-runner/_work/$REPO_NAME/$REPO_NAME"
PLATFORM="linux/arm64"

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

# ============================================================================
# SSH AUTHENTICATION
# ============================================================================

step "Authentication"
SSH_KEY_FILE="$HOME/.ssh/id_rsa"
SSH_KEY_PUB_FILE="$SSH_KEY_FILE.pub"

# Ensure ssh-agent is running
if [ -z "$SSH_AUTH_SOCK" ]; then
    eval "$(ssh-agent -s)" > /dev/null 2>&1
fi

# Check if SSH key exists
if [ ! -f "$SSH_KEY_FILE" ]; then
    error "SSH key not found at $SSH_KEY_FILE"
    echo "   Please generate an SSH key pair first:"
    echo "   ssh-keygen -t rsa -b 4096 -C 'your_email@example.com'"
    exit 1
fi

# Add SSH key to agent if not already loaded
KEY_LOADED=false
if ssh-add -l > /dev/null 2>&1; then
    # Check if this specific key is loaded by trying to match the public key
    KEY_FINGERPRINT=$(ssh-keygen -lf "$SSH_KEY_FILE" 2>/dev/null | awk '{print $2}')
    if [ -n "$KEY_FINGERPRINT" ] && ssh-add -l 2>/dev/null | grep -q "$KEY_FINGERPRINT"; then
        KEY_LOADED=true
    fi
fi

if [ "$KEY_LOADED" = false ]; then
    substep "Adding SSH key to agent..."
    if ! ssh-add "$SSH_KEY_FILE" 2>/dev/null; then
        error "Failed to add SSH key to agent. Check your key passphrase."
        exit 1
    fi
fi

# Check if SSH key authentication already works
if ssh -o BatchMode=yes -o ConnectTimeout=10 -o StrictHostKeyChecking=no "$SERVER" "echo 'SSH key works'" >/dev/null 2>&1; then
    # SSH key already works, no need to copy
    true
else
    # Check if our public key is already on the server
    KEY_CONTENT=$(cat "$SSH_KEY_PUB_FILE")
    if ssh -o BatchMode=no -o ConnectTimeout=10 -o StrictHostKeyChecking=no "$SERVER" "
        grep -q '$KEY_CONTENT' ~/.ssh/authorized_keys 2>/dev/null
    " >/dev/null 2>&1; then
        # Key exists but authentication failed - might be permissions issue
        error "SSH key found on server but authentication failed. Check server SSH configuration."
        exit 1
    else
        # Key not on server, need to copy it
        substep "SSH password: " -n
        SSH_PASSWORD=$(read_password)

        if [ -z "$SSH_PASSWORD" ]; then
            error "No SSH password provided"
            exit 1
        fi

        substep "Copying SSH key to server..."
        if command -v expect >/dev/null 2>&1; then
            expect << EOF >/dev/null 2>&1
spawn ssh-copy-id -o ConnectTimeout=10 -o StrictHostKeyChecking=no -i "$SSH_KEY_PUB_FILE" "$SERVER"
expect "password:"
send "$SSH_PASSWORD\r"
expect eof
EOF
            if [ $? -eq 0 ]; then
                true
            else
                error "Failed to copy SSH key to server"
                exit 1
            fi
        else
            error "expect not available - cannot copy SSH key"
            exit 1
        fi
    fi
fi

# ============================================================================
# SUDO AUTHENTICATION
# ============================================================================

SUDO_PASSWORD=""
# If SSH password was provided, try using it for sudo first
if [ -n "$SSH_PASSWORD" ]; then
    if echo "$SSH_PASSWORD" | ssh "$SERVER" "sudo -S -v" > /dev/null 2>&1; then
        SUDO_PASSWORD="$SSH_PASSWORD"
        export SUDO_PASSWORD
    fi
fi

# If we don't have a working sudo password yet, prompt for it
if [ -z "$SUDO_PASSWORD" ]; then
    while true; do
        substep "Sudo password: " -n
        SUDO_PASSWORD=$(read_password)

        if [ -z "$SUDO_PASSWORD" ]; then
            warning "No password provided - assuming passwordless sudo"
            break
        fi

        if echo "$SUDO_PASSWORD" | ssh "$SERVER" "sudo -S -v" > /dev/null 2>&1; then
            export SUDO_PASSWORD
            break
        else
            echo -n "  " && error "Invalid password, please try again"
        fi
    done
fi

# ============================================================================
# BUILD PHASE
# ============================================================================

echo -e "\n${MAGENTA}${BOLD}🔨 Building Docker images${NC}\n"

# Determine project name
if [ -n "$SERVER" ]; then
    COMPOSE_DIR=$(ssh "$SERVER" "dirname $DEPLOY_PATH/deployment/docker-compose.yml" 2>/dev/null || echo "$DEPLOY_PATH/deployment")
    PROJECT_NAME=$(ssh "$SERVER" "basename $COMPOSE_DIR" 2>/dev/null || echo "deployment")
else
    PROJECT_NAME=$(basename "$DEPLOYMENT_DIR")
fi

# Check if Docker daemon is running
check_docker_daemon() {
    docker info > /dev/null 2>&1
}

# Start Docker Desktop
start_docker_desktop() {
    substep "Starting Docker Desktop..."
    if ! docker desktop start > /dev/null 2>&1; then
        return 1
    fi
    
    # Wait for Docker to be ready (max 60 seconds)
    substep "Waiting for Docker to start..." -n
    local max_wait=60
    local waited=0
    while [ $waited -lt $max_wait ]; do
        if check_docker_daemon; then
            echo ""
            return 0
        fi
        sleep 2
        waited=$((waited + 2))
        echo -n "."
    done
    echo ""
    return 1
}

# Check buildx
if ! docker buildx version > /dev/null 2>&1; then
    error "Docker buildx not available. Install Docker Desktop."
fi

# Check Docker daemon
if ! check_docker_daemon; then
    warning "Docker daemon is not running"
    if ! start_docker_desktop; then
        error "Failed to start Docker Desktop. Please start it manually and try again."
    fi
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
        exit 1
    fi
done

success "Build complete! ${#BUILT_IMAGES[@]} image(s) ready"

# ============================================================================
# DEPLOY PHASE
# ============================================================================

echo -e "\n${MAGENTA}${BOLD}🚀 Deploying to ${SERVER}${NC}\n"


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

# Ensure destination directory exists with proper permissions
if [ -n "$SUDO_PASSWORD" ]; then
    ssh "$SERVER" bash << REMOTE_SUDO_SCRIPT > /dev/null 2>&1
set -e
echo '$SUDO_PASSWORD' | sudo -S -p '' mkdir -p $DEPLOY_PATH/deployment 2>/dev/null || true
echo '$SUDO_PASSWORD' | sudo -S -p '' chown -R \$(whoami):\$(whoami) $DEPLOY_PATH/deployment 2>/dev/null || true
REMOTE_SUDO_SCRIPT
else
    ssh "$SERVER" "sudo mkdir -p $DEPLOY_PATH/deployment && sudo chown -R \$(whoami):\$(whoami) $DEPLOY_PATH/deployment" > /dev/null 2>&1 || true
fi

# Copy deployment directory excluding gitignored files
cd "$PROJECT_ROOT"
substep "Copying deployment directory..."

# Generate exclude file for rsync using git ls-files to list ignored files
EXCLUDE_FILE="/tmp/fromchat-rsync-exclude-$$"
RSYNC_ERROR="/tmp/fromchat-rsync-error-$$"

# Get ignored files in deployment directory and convert to rsync exclude patterns
git ls-files --others --ignored --exclude-standard deployment/ 2>/dev/null | \
    sed 's|^deployment/||' > "$EXCLUDE_FILE" || true

# Use rsync with native --exclude-from option
if rsync -avz --delete --exclude-from="$EXCLUDE_FILE" \
    "$DEPLOYMENT_DIR/" \
    "$SERVER:$DEPLOY_PATH/deployment/" > "$RSYNC_ERROR" 2>&1; then
    rm -f "$EXCLUDE_FILE" "$RSYNC_ERROR"
else
    echo -e "  ${RED}✗${NC} Rsync failed. Error output:"
    cat "$RSYNC_ERROR" | sed 's/^/    /'
    rm -f "$EXCLUDE_FILE" "$RSYNC_ERROR"
    echo -n "  " && error "Failed to copy deployment directory"
fi

# Copy .env.prod to .env on server (bypassing gitignore)
if [ -f "$DEPLOYMENT_DIR/.env.prod" ]; then
    substep "Copying .env.prod to .env..."
    if ! scp "$DEPLOYMENT_DIR/.env.prod" "$SERVER:$DEPLOY_PATH/deployment/.env" > /dev/null 2>&1; then
        warning "Failed to copy .env.prod to .env"
    fi
else
    warning ".env.prod not found in deployment directory"
fi

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
if ! systemctl is-active --quiet fromchat; then
    echo "❌ Service failed to start"
    sudo_cmd journalctl --no-pager -xeu fromchat -n 30
    exit 1
fi
REMOTE_SCRIPT

echo
success "Deployment complete!"
