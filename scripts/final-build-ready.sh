#!/bin/bash

# 🎯 Final Build Execution Script - MediaNest
# Ready to execute when all fixes are complete

set -e

echo "🎯 FINAL BUILD ATTEMPT - MediaNest Monorepo"
echo "============================================="

# Verify environment is ready
echo "🔍 Pre-flight checks..."

# Check that shared package builds
if [ ! -d "shared/dist" ]; then
    echo "📦 Building shared package first..."
    cd shared && npm run build && cd ..
fi

# Verify shared build artifacts
if [ -d "shared/dist" ]; then
    echo "✅ Shared package ready"
else
    echo "❌ Shared package build failed"
    exit 1
fi

# Final build command
echo "🚀 Executing final build..."
echo "📋 Build order: shared → backend → frontend"

# Use the optimized build stabilizer script
exec ./scripts/build-stabilizer.sh