#!/bin/bash

# 🚀 MediaNest Pre-Deployment Validation Script
# Prevents staging blockers by validating all critical components

set -e

echo "🛡️  MediaNest Pre-Deployment Validation"
echo "========================================"
echo ""

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Track validation results
VALIDATION_PASSED=true

print_status() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✅ $2: PASS${NC}"
    else
        echo -e "${RED}❌ $2: FAIL${NC}"
        VALIDATION_PASSED=false
    fi
}

print_info() {
    echo -e "${BLUE}🔍 $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# Step 1: TypeScript Compilation Check
print_info "Step 1: TypeScript Compilation Validation"
npx tsc --noEmit > /dev/null 2>&1
print_status $? "TypeScript Compilation"

# Check for circular dependencies
print_info "Checking for circular dependencies..."
if command -v madge &> /dev/null; then
    CIRCULAR_DEPS=$(npx madge --circular --extensions ts,tsx . 2>/dev/null || echo "")
    if [ -z "$CIRCULAR_DEPS" ]; then
        print_status 0 "Circular Dependencies Check"
    else
        print_status 1 "Circular Dependencies Check"
        echo -e "${RED}   Found circular dependencies:${NC}"
        echo "$CIRCULAR_DEPS"
    fi
else
    print_warning "madge not installed, skipping circular dependency check"
fi

echo ""

# Step 2: Build Process Validation
print_info "Step 2: Build Process Validation"
npm run build > build-validation.log 2>&1
BUILD_RESULT=$?
print_status $BUILD_RESULT "Build Process"

if [ $BUILD_RESULT -ne 0 ]; then
    echo -e "${RED}   Build errors:${NC}"
    tail -20 build-validation.log | grep -E "(error|Error|ERROR)" || echo "   Check build-validation.log for details"
fi

echo ""

# Step 3: Critical Test Validation
print_info "Step 3: Critical Test Validation"
print_warning "Running critical tests (this may take a few minutes)..."

# Run tests with timeout and summary
timeout 600 npm test -- --run --reporter=basic > test-validation.log 2>&1
TEST_RESULT=$?

if [ $TEST_RESULT -eq 0 ]; then
    print_status 0 "Critical Tests"
else
    print_status 1 "Critical Tests"
    echo -e "${RED}   Test failures detected. Recent failures:${NC}"
    grep -A 3 -B 1 "×.*failed" test-validation.log | tail -20 || echo "   Check test-validation.log for details"
fi

echo ""

# Step 4: Docker Build Validation
print_info "Step 4: Docker Build Validation"

# Check if Docker is available
if command -v docker &> /dev/null; then
    # Check if images exist
    if docker images | grep -q medianest; then
        print_status 0 "Docker Images Available"
        
        # Optionally test build (commented out to save time)
        # print_info "Testing Docker build process..."
        # docker-compose build --quiet > docker-validation.log 2>&1
        # print_status $? "Docker Build Process"
    else
        print_status 1 "Docker Images Available"
        echo -e "${RED}   No MediaNest Docker images found${NC}"
    fi
else
    print_warning "Docker not available, skipping Docker validation"
fi

echo ""

# Step 5: Configuration Validation
print_info "Step 5: Configuration Validation"

# Check package.json scripts
REQUIRED_SCRIPTS=("build" "test" "typecheck")
MISSING_SCRIPTS=""

for script in "${REQUIRED_SCRIPTS[@]}"; do
    if ! grep -q "\"$script\":" package.json; then
        MISSING_SCRIPTS="$MISSING_SCRIPTS $script"
    fi
done

if [ -z "$MISSING_SCRIPTS" ]; then
    print_status 0 "Required Scripts"
else
    print_status 1 "Required Scripts"
    echo -e "${RED}   Missing scripts:$MISSING_SCRIPTS${NC}"
fi

# Check for common configuration files
CONFIG_FILES=("tsconfig.json" "vitest.config.ts" "docker-compose.yml")
for file in "${CONFIG_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${GREEN}   ✓ $file exists${NC}"
    else
        echo -e "${RED}   ✗ $file missing${NC}"
        VALIDATION_PASSED=false
    fi
done

echo ""

# Step 6: Security and Quality Checks
print_info "Step 6: Security and Quality Validation"

# Check for common security issues
if [ -f "package-lock.json" ]; then
    print_status 0 "Package Lock File"
else
    print_status 1 "Package Lock File"
    print_warning "Missing package-lock.json - security vulnerability"
fi

# Check for environment template
if [ -f ".env.example" ] || [ -f ".env.template" ]; then
    print_status 0 "Environment Template"
else
    print_status 1 "Environment Template"
    print_warning "Missing .env.example or .env.template"
fi

echo ""

# Final Results
echo "=========================================="
if [ "$VALIDATION_PASSED" = true ]; then
    echo -e "${GREEN}🎉 ALL VALIDATIONS PASSED!${NC}"
    echo -e "${GREEN}✅ System is ready for staging deployment${NC}"
    exit 0
else
    echo -e "${RED}❌ VALIDATION FAILURES DETECTED${NC}"
    echo -e "${RED}🚨 System is NOT ready for deployment${NC}"
    echo ""
    echo -e "${YELLOW}📋 Next steps:${NC}"
    echo "1. Review the failed validations above"
    echo "2. Fix the identified issues"
    echo "3. Re-run this validation script"
    echo "4. Only deploy when all validations pass"
    echo ""
    echo -e "${BLUE}📄 Log files created:${NC}"
    [ -f build-validation.log ] && echo "   - build-validation.log"
    [ -f test-validation.log ] && echo "   - test-validation.log" 
    [ -f docker-validation.log ] && echo "   - docker-validation.log"
    exit 1
fi