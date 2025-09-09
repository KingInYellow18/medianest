#!/bin/bash

# 🚀 Build Stabilization Script for MediaNest
# Comprehensive build process with error handling and optimization

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Build configuration
BUILD_START_TIME=$(date +%s)
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUILD_LOG="$PROJECT_ROOT/build.log"
MAX_BUILD_TIME=300  # 5 minutes
TARGET_BUNDLE_SIZE=500  # KB

echo -e "${BLUE}🚀 MediaNest Build Stabilization Pipeline${NC}"
echo -e "${BLUE}===========================================${NC}"
echo "📁 Project Root: $PROJECT_ROOT"
echo "📝 Build Log: $BUILD_LOG"
echo "⏱️  Max Build Time: ${MAX_BUILD_TIME}s"
echo "🎯 Target Bundle Size: ${TARGET_BUNDLE_SIZE}KB"
echo ""

# Initialize build log
echo "[$(date)] Build stabilization started" > "$BUILD_LOG"

# Function to log with timestamp
log() {
    echo "[$(date)] $1" | tee -a "$BUILD_LOG"
}

# Function to check build time
check_build_time() {
    local current_time=$(date +%s)
    local elapsed=$((current_time - BUILD_START_TIME))
    
    if [ $elapsed -gt $MAX_BUILD_TIME ]; then
        echo -e "${RED}❌ Build timeout exceeded (${elapsed}s > ${MAX_BUILD_TIME}s)${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}⏱️  Build time: ${elapsed}s${NC}"
}

# Function to cleanup on exit
cleanup() {
    local exit_code=$?
    local end_time=$(date +%s)
    local total_time=$((end_time - BUILD_START_TIME))
    
    if [ $exit_code -eq 0 ]; then
        echo -e "${GREEN}✅ Build completed successfully in ${total_time}s${NC}"
        log "Build completed successfully in ${total_time}s"
    else
        echo -e "${RED}❌ Build failed after ${total_time}s (exit code: $exit_code)${NC}"
        log "Build failed after ${total_time}s (exit code: $exit_code)"
    fi
}

trap cleanup EXIT

# Change to project directory
cd "$PROJECT_ROOT"

# Step 1: Environment Setup and Validation
echo -e "${BLUE}🔍 Step 1: Environment Setup and Validation${NC}"
log "Step 1: Environment setup started"

# Check Node.js version
NODE_VERSION=$(node --version)
echo "📦 Node.js version: $NODE_VERSION"

if ! node --version | grep -q "v20\|v22"; then
    echo -e "${YELLOW}⚠️  Warning: Node.js 20+ recommended, found $NODE_VERSION${NC}"
fi

# Check npm version
NPM_VERSION=$(npm --version)
echo "📦 npm version: $NPM_VERSION"

# Verify project structure
required_dirs=("backend" "frontend" "shared")
for dir in "${required_dirs[@]}"; do
    if [ ! -d "$dir" ]; then
        echo -e "${RED}❌ Missing required directory: $dir${NC}"
        exit 1
    fi
done
echo -e "${GREEN}✅ Project structure validated${NC}"

check_build_time

# Step 2: Dependency Management
echo -e "\n${BLUE}📦 Step 2: Dependency Management${NC}"
log "Step 2: Dependency management started"

# Clean npm cache
echo "🧹 Cleaning npm cache..."
npm cache clean --force >> "$BUILD_LOG" 2>&1

# Install dependencies with optimization
echo "📥 Installing dependencies..."
if ! npm ci --prefer-offline --no-audit --no-fund >> "$BUILD_LOG" 2>&1; then
    echo -e "${YELLOW}⚠️  npm ci failed, trying npm install...${NC}"
    if ! npm install --prefer-offline --no-audit --no-fund >> "$BUILD_LOG" 2>&1; then
        echo -e "${RED}❌ Failed to install dependencies${NC}"
        log "Failed to install dependencies"
        exit 1
    fi
fi

echo -e "${GREEN}✅ Dependencies installed successfully${NC}"
check_build_time

# Step 3: Workspace Dependency Synchronization
echo -e "\n${BLUE}🔧 Step 3: Workspace Dependency Synchronization${NC}"
log "Step 3: Workspace synchronization started"

# Synchronize backend dependencies
echo "🔧 Synchronizing backend dependencies..."
if cd backend; then
    if ! npm ci --prefer-offline --no-audit --no-fund >> "$BUILD_LOG" 2>&1; then
        echo -e "${YELLOW}⚠️  Backend npm ci failed, trying npm install...${NC}"
        npm install --prefer-offline --no-audit --no-fund >> "$BUILD_LOG" 2>&1
    fi
    cd ..
    echo -e "${GREEN}✅ Backend dependencies synchronized${NC}"
fi

# Synchronize frontend dependencies
echo "🎨 Synchronizing frontend dependencies..."
if cd frontend; then
    if ! npm ci --prefer-offline --no-audit --no-fund >> "$BUILD_LOG" 2>&1; then
        echo -e "${YELLOW}⚠️  Frontend npm ci failed, trying npm install...${NC}"
        npm install --prefer-offline --no-audit --no-fund >> "$BUILD_LOG" 2>&1
    fi
    cd ..
    echo -e "${GREEN}✅ Frontend dependencies synchronized${NC}"
fi

# Synchronize shared dependencies
echo "📦 Synchronizing shared dependencies..."
if cd shared; then
    if ! npm ci --prefer-offline --no-audit --no-fund >> "$BUILD_LOG" 2>&1; then
        echo -e "${YELLOW}⚠️  Shared npm ci failed, trying npm install...${NC}"
        npm install --prefer-offline --no-audit --no-fund >> "$BUILD_LOG" 2>&1
    fi
    cd ..
    echo -e "${GREEN}✅ Shared dependencies synchronized${NC}"
fi

check_build_time

# Step 4: Clean Build Process
echo -e "\n${BLUE}🏗️  Step 4: Clean Build Process${NC}"
log "Step 4: Build process started"

# Clean previous builds
echo "🧹 Cleaning previous build artifacts..."
rm -rf backend/dist frontend/.next shared/dist
log "Cleaned previous build artifacts"

# Build shared dependencies first
echo "🔧 Building shared dependencies..."
if cd shared && npm run build >> "$BUILD_LOG" 2>&1; then
    echo -e "${GREEN}✅ Shared dependencies built successfully${NC}"
    cd ..
    log "Shared dependencies built successfully"
else
    echo -e "${RED}❌ Failed to build shared dependencies${NC}"
    cd ..
    log "Failed to build shared dependencies"
    exit 1
fi

check_build_time

# Build backend
echo "🔧 Building backend..."
BACKEND_START_TIME=$(date +%s)
if cd backend && npm run build >> "$BUILD_LOG" 2>&1; then
    BACKEND_END_TIME=$(date +%s)
    BACKEND_BUILD_TIME=$((BACKEND_END_TIME - BACKEND_START_TIME))
    echo -e "${GREEN}✅ Backend built successfully in ${BACKEND_BUILD_TIME}s${NC}"
    cd ..
    log "Backend built successfully in ${BACKEND_BUILD_TIME}s"
else
    echo -e "${RED}❌ Failed to build backend${NC}"
    cd ..
    log "Failed to build backend"
    exit 1
fi

check_build_time

# Build frontend
echo "🎨 Building frontend..."
FRONTEND_START_TIME=$(date +%s)
if cd frontend && npm run build >> "$BUILD_LOG" 2>&1; then
    FRONTEND_END_TIME=$(date +%s)
    FRONTEND_BUILD_TIME=$((FRONTEND_END_TIME - FRONTEND_START_TIME))
    echo -e "${GREEN}✅ Frontend built successfully in ${FRONTEND_BUILD_TIME}s${NC}"
    cd ..
    log "Frontend built successfully in ${FRONTEND_BUILD_TIME}s"
else
    echo -e "${RED}❌ Failed to build frontend${NC}"
    cd ..
    log "Failed to build frontend"
    exit 1
fi

check_build_time

# Step 5: Build Verification
echo -e "\n${BLUE}📊 Step 5: Build Verification${NC}"
log "Step 5: Build verification started"

# Verify build artifacts
echo "🔍 Verifying build artifacts..."
if [ -d "backend/dist" ]; then
    backend_files=$(find backend/dist -name "*.js" | wc -l)
    echo "  🔧 Backend: $backend_files JS files generated"
    log "Backend build verification: $backend_files JS files"
else
    echo -e "${RED}❌ Backend build artifacts missing${NC}"
    exit 1
fi

if [ -d "frontend/.next" ]; then
    echo "  🎨 Frontend: Build artifacts present"
    log "Frontend build verification: artifacts present"
else
    echo -e "${RED}❌ Frontend build artifacts missing${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Build verification completed${NC}"

# Step 6: Performance Summary
echo -e "\n${BLUE}🎯 Step 6: Performance Summary${NC}"
log "Step 6: Performance summary"

BUILD_END_TIME=$(date +%s)
TOTAL_BUILD_TIME=$((BUILD_END_TIME - BUILD_START_TIME))

echo -e "${GREEN}📊 BUILD PERFORMANCE SUMMARY${NC}"
echo -e "${GREEN}=============================${NC}"
echo "⏱️  Total Build Time: ${TOTAL_BUILD_TIME}s"
echo "🔧 Backend Build Time: ${BACKEND_BUILD_TIME:-N/A}s"
echo "🎨 Frontend Build Time: ${FRONTEND_BUILD_TIME:-N/A}s"

# Performance targets check
echo -e "\n🎯 OPTIMIZATION TARGETS:"
if [ "$TOTAL_BUILD_TIME" -le "$MAX_BUILD_TIME" ]; then
    echo -e "  Build Time: ${GREEN}✅ Achieved${NC} (${TOTAL_BUILD_TIME}s < ${MAX_BUILD_TIME}s)"
else
    echo -e "  Build Time: ${RED}❌ Exceeded${NC} (${TOTAL_BUILD_TIME}s > ${MAX_BUILD_TIME}s)"
fi

# Save performance metrics
cat > build-metrics.json << EOF
{
  "timestamp": "$(date -Iseconds)",
  "buildTime": $TOTAL_BUILD_TIME,
  "backendBuildTime": ${BACKEND_BUILD_TIME:-0},
  "frontendBuildTime": ${FRONTEND_BUILD_TIME:-0},
  "targets": {
    "buildTime": $MAX_BUILD_TIME,
    "bundleSize": $TARGET_BUNDLE_SIZE
  },
  "success": true
}
EOF

log "Performance metrics saved to build-metrics.json"
log "Build stabilization completed successfully"
echo -e "\n${GREEN}🎉 Build stabilization completed successfully!${NC}"
echo -e "${GREEN}📋 Check build.log for detailed information${NC}"
echo -e "${GREEN}📊 Performance metrics saved to build-metrics.json${NC}"