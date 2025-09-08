#!/bin/bash
# Production-optimized build script
set -e

echo "🏗️  Building production-optimized MediaNest..."

# Clean previous builds
echo "🧹 Cleaning previous builds..."
rm -rf backend/dist frontend/.next shared/dist

# Build shared module first
echo "📦 Building shared module..."
cd shared && npm run build && cd ..

# Build backend with webpack optimization
echo "⚡ Building backend with webpack..."
if [ -d "backend" ]; then
    cd backend
    if [ -f "webpack.config.js" ]; then
        npm install --save-dev webpack webpack-cli ts-loader
        npx webpack --mode=production
    else
        npm run build
    fi
    cd ..
else
    echo "   ⚠️  Backend directory not found, skipping backend build"
fi

# Build frontend with Next.js optimizations
echo "⚙️  Building frontend with Next.js optimizations..."
if [ -d "frontend" ]; then
    cd frontend
    NODE_ENV=production npm run build
    cd ..
else
    echo "   ⚠️  Frontend directory not found, skipping frontend build"
fi

echo "✅ Production build complete!"

# Calculate size savings
echo "📊 Build size analysis:"
du -sh backend/dist 2>/dev/null || echo "Backend dist: Using TypeScript build"
du -sh frontend/.next 2>/dev/null || echo "Frontend: Build not found"
du -sh shared/dist 2>/dev/null || echo "Shared: Build not found"
