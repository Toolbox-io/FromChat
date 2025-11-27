#!/bin/bash
# Don't use set -e here - we want to continue if Homebrew installation fails

# Install docker-pussh plugin for Docker CLI
# This script installs the unregistry docker-pussh plugin

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "📦 Installing docker-pussh plugin..."

# Check if Docker is installed
if ! command -v docker > /dev/null 2>&1; then
    echo "⚠️  Docker is not installed. Skipping docker-pussh installation."
    exit 0
fi

# Create docker plugins directory if it doesn't exist
PLUGIN_DIR="$HOME/.docker/cli-plugins"
mkdir -p "$PLUGIN_DIR"

# Check if already installed
if [ -f "$PLUGIN_DIR/docker-pussh" ] && docker pussh --help > /dev/null 2>&1; then
    echo "  ✓ docker-pussh is already installed"
    docker pussh --version 2>/dev/null || true
    exit 0
fi

# Try installing via Homebrew first
if command -v brew > /dev/null 2>&1; then
    echo "  Attempting installation via Homebrew..."
    if brew install psviderski/tap/docker-pussh 2>/dev/null; then
        # Create symlink to use as Docker CLI plugin
        BREW_PREFIX=$(brew --prefix 2>/dev/null || echo "/opt/homebrew")
        if [ -f "$BREW_PREFIX/bin/docker-pussh" ]; then
            mkdir -p "$PLUGIN_DIR"
            ln -sf "$BREW_PREFIX/bin/docker-pussh" "$PLUGIN_DIR/docker-pussh" 2>/dev/null || true
            
            # Verify installation
            if docker pussh --help > /dev/null 2>&1; then
                echo "  ✓ docker-pussh installed successfully via Homebrew"
                docker pussh --version 2>/dev/null || true
                exit 0
            fi
        fi
    fi
    echo "  ⚠️  Homebrew installation failed or incomplete, trying direct download..."
fi

# Fallback: Download and install docker-pussh directly (using latest from main branch)
echo "  Downloading docker-pussh from unregistry..."
if curl -sSL https://raw.githubusercontent.com/psviderski/unregistry/main/docker-pussh \
    -o "$PLUGIN_DIR/docker-pussh" 2>/dev/null; then
    chmod +x "$PLUGIN_DIR/docker-pussh"
    
    # Verify installation
    if docker pussh --help > /dev/null 2>&1; then
        echo "  ✓ docker-pussh installed successfully"
        docker pussh --version 2>/dev/null || true
    else
        echo "  ⚠️  Installation completed but plugin verification failed"
        echo "     You may need to restart your terminal or Docker Desktop"
    fi
else
    echo "  ⚠️  Failed to download docker-pussh"
    echo "     You can install it manually:"
    echo ""
    echo "     Via Homebrew:"
    echo "     brew install psviderski/tap/docker-pussh"
    echo "     mkdir -p ~/.docker/cli-plugins"
    echo "     ln -sf \$(brew --prefix)/bin/docker-pussh ~/.docker/cli-plugins/docker-pussh"
    echo ""
    echo "     Or via direct download:"
    echo "     mkdir -p ~/.docker/cli-plugins"
    echo "     curl -sSL https://raw.githubusercontent.com/psviderski/unregistry/main/docker-pussh \\"
    echo "       -o ~/.docker/cli-plugins/docker-pussh"
    echo "     chmod +x ~/.docker/cli-plugins/docker-pussh"
    exit 0
fi

