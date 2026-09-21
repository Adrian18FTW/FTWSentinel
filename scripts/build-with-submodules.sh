#!/bin/bash
set -e

echo "🔧 Configuring git credentials for private submodules..."

# Configure git to use credentials from environment variable if available
if [ -n "$GIT_CREDENTIALS" ]; then
  echo "✓ GIT_CREDENTIALS found, configuring git..."
  git config --global credential.helper store
  echo "$GIT_CREDENTIALS" > ~/.git-credentials
  chmod 600 ~/.git-credentials
fi

echo "📦 Cloning submodules..."
git submodule update --init --recursive

echo "🔨 Building Next.js application..."
npm run build

echo "✅ Build complete!"
