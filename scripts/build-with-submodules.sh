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

echo "📋 Pre-build: Copy WASM to ensure it's accessible..."
# Ensure WASM files are in multiple locations for different build phases
mkdir -p public/wasm
cp lib/obfuscator-wasm/*.wasm public/wasm/ 2>/dev/null || echo "WASM copy to public skipped"

# Also copy to root lib location that Next.js will look for during build
mkdir -p lib/obfuscator-wasm
cp -f lib/obfuscator-wasm/*.wasm lib/obfuscator-wasm/ 2>/dev/null || true
cp -f lib/obfuscator-wasm/*.js lib/obfuscator-wasm/ 2>/dev/null || true

echo "🔨 Building Next.js application..."
npm run build

echo "📋 Post-build: Ensure WASM in server output..."
# Copy WASM files into the Next.js server output where they can be accessed
if [ -d ".next/server" ]; then
  mkdir -p .next/server/lib/obfuscator-wasm
  cp lib/obfuscator-wasm/*.wasm .next/server/lib/obfuscator-wasm/ 2>/dev/null || echo "WASM already in .next/server"
  cp lib/obfuscator-wasm/*.js .next/server/lib/obfuscator-wasm/ 2>/dev/null || true
  cp lib/obfuscator-wasm/*.d.ts .next/server/lib/obfuscator-wasm/ 2>/dev/null || true
fi

echo "✅ Build complete!"
