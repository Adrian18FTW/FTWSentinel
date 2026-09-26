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

echo "🧹 Clearing any cached WASM files..."
# Remove any cached WASM to ensure fresh files are used
rm -rf .next/cache/lib/obfuscator-wasm 2>/dev/null || true
rm -rf .next/server/lib/obfuscator-wasm 2>/dev/null || true

echo "📋 Pre-build: Verify WASM files exist and copy..."
# Verify WASM files exist
if [ ! -f "lib/wasm/obfuscator_lib_bg.wasm" ]; then
  echo "❌ ERROR: WASM file not found at lib/wasm/obfuscator_lib_bg.wasm"
  exit 1
fi

# Show WASM file timestamp to verify it's the latest
echo "📅 WASM file timestamp:"
ls -lh lib/wasm/obfuscator_lib_bg.wasm

# Ensure WASM files are in multiple locations for different build phases
mkdir -p public/wasm
cp -v lib/wasm/*.wasm public/wasm/ 2>/dev/null || echo "WASM copy to public skipped"
cp -v lib/wasm/*.js public/wasm/ 2>/dev/null || true

echo "🔨 Building Next.js application..."
npm run build

echo "📋 Post-build: Ensure WASM in server output..."
# Copy WASM files into the Next.js server output where they can be accessed
if [ -d ".next/server" ]; then
  echo "Copying WASM to Next.js server output..."
  
  # Create directories
  mkdir -p .next/server/lib/wasm
  mkdir -p .next/server/lib/obfuscator-wasm
  
  # Copy all WASM files to both locations
  cp -v lib/wasm/*.wasm .next/server/lib/wasm/ 2>/dev/null || echo "WASM copy to .next/server/lib/wasm failed"
  cp -v lib/wasm/*.js .next/server/lib/wasm/ 2>/dev/null || true
  cp -v lib/wasm/*.d.ts .next/server/lib/wasm/ 2>/dev/null || true
  
  cp -v lib/wasm/*.wasm .next/server/lib/obfuscator-wasm/ 2>/dev/null || true
  cp -v lib/wasm/*.js .next/server/lib/obfuscator-wasm/ 2>/dev/null || true
  cp -v lib/wasm/*.d.ts .next/server/lib/obfuscator-wasm/ 2>/dev/null || true
  
  # Also copy to root of .next/server
  cp -v lib/wasm/*.wasm .next/server/ 2>/dev/null || echo "WASM copy to .next/server root skipped"
  
  echo "✓ WASM files deployed to server output"
fi

echo "🔍 Verifying WASM deployment..."
if [ -f ".next/server/lib/wasm/obfuscator_lib_bg.wasm" ]; then
  echo "✓ WASM found in .next/server/lib/wasm/"
  ls -lh .next/server/lib/wasm/obfuscator_lib_bg.wasm
else
  echo "⚠ Warning: WASM not found in expected location"
fi

echo "✅ Build complete!"
