#!/bin/bash

# MediaNest Manual Testing Helper Script
# This script automates some manual testing setup and verification tasks

set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m'

# Test results file
TEST_RESULTS="manual-test-results-$(date +%Y%m%d-%H%M%S).md"

echo -e "${PURPLE}🧪 MediaNest Manual Testing Helper${NC}"
echo "===================================="
echo ""

# Function to check service
check_service() {
    local service_name=$1
    local url=$2
    
    echo -n "Checking $service_name... "
    if curl -s -f -o /dev/null "$url" 2>/dev/null; then
        echo -e "${GREEN}✓ Online${NC}"
        return 0
    else
        echo -e "${RED}✗ Offline${NC}"
        return 1
    fi
}

# Function to prompt for test result
test_step() {
    local test_name=$1
    local test_description=$2
    
    echo ""
    echo -e "${YELLOW}TEST: $test_name${NC}"
    echo "$test_description"
    echo -n "Result (p)ass/(f)ail/(s)kip/(n)otes: "
    
    read -r result
    
    case $result in
        p|P)
            echo "- [x] $test_name" >> "$TEST_RESULTS"
            echo -e "${GREEN}✓ Passed${NC}"
            ;;
        f|F)
            echo "- [ ] $test_name ❌" >> "$TEST_RESULTS"
            echo -e "${RED}✗ Failed${NC}"
            echo -n "Enter failure reason: "
            read -r reason
            echo "  - Failure: $reason" >> "$TEST_RESULTS"
            ;;
        s|S)
            echo "- [ ] $test_name ⏭️ (Skipped)" >> "$TEST_RESULTS"
            echo -e "${YELLOW}⏭️  Skipped${NC}"
            ;;
        n|N)
            echo "- [x] $test_name" >> "$TEST_RESULTS"
            echo -n "Enter notes: "
            read -r notes
            echo "  - Note: $notes" >> "$TEST_RESULTS"
            echo -e "${BLUE}📝 Noted${NC}"
            ;;
        *)
            echo "- [ ] $test_name ❓" >> "$TEST_RESULTS"
            echo -e "${YELLOW}? Unknown${NC}"
            ;;
    esac
}

# Initialize test results file
cat > "$TEST_RESULTS" << EOF
# MediaNest Manual Test Results
Date: $(date)
Tester: ${USER}

## Environment Information
EOF

# 1. Environment Check
echo -e "${BLUE}=== Environment Check ===${NC}"
echo ""

echo "## Environment Check" >> "$TEST_RESULTS"
echo "" >> "$TEST_RESULTS"

# Check Docker
echo -n "Docker: "
if command -v docker &> /dev/null; then
    DOCKER_VERSION=$(docker --version)
    echo -e "${GREEN}✓${NC} $DOCKER_VERSION"
    echo "- Docker: $DOCKER_VERSION" >> "$TEST_RESULTS"
else
    echo -e "${RED}✗ Not installed${NC}"
    echo "- Docker: Not installed ❌" >> "$TEST_RESULTS"
fi

# Check Docker Compose
echo -n "Docker Compose: "
if command -v docker &> /dev/null && docker compose version &> /dev/null; then
    COMPOSE_VERSION=$(docker compose version)
    echo -e "${GREEN}✓${NC} $COMPOSE_VERSION"
    echo "- Docker Compose: $COMPOSE_VERSION" >> "$TEST_RESULTS"
else
    echo -e "${RED}✗ Not installed${NC}"
    echo "- Docker Compose: Not installed ❌" >> "$TEST_RESULTS"
fi

# Check running containers
echo ""
echo "Running Containers:"
docker compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"

echo "" >> "$TEST_RESULTS"
echo "## Service Status" >> "$TEST_RESULTS"
echo "" >> "$TEST_RESULTS"

# 2. Service Availability
echo ""
echo -e "${BLUE}=== Service Availability ===${NC}"
echo ""

check_service "Frontend" "http://localhost:3000"
check_service "Backend API" "http://localhost:4000/api/health"
check_service "PostgreSQL" "localhost:5432" || true
check_service "Redis" "localhost:6379" || true

# Get service URLs from user
echo ""
echo -e "${YELLOW}Enter your service URLs for testing:${NC}"
echo -n "Plex URL (e.g., http://192.168.1.100:32400): "
read -r PLEX_URL
echo -n "Overseerr URL (e.g., http://192.168.1.100:5055): "
read -r OVERSEERR_URL
echo -n "Uptime Kuma URL (e.g., http://192.168.1.100:3001): "
read -r UPTIME_URL

echo "" >> "$TEST_RESULTS"
echo "### External Services" >> "$TEST_RESULTS"
echo "- Plex: $PLEX_URL" >> "$TEST_RESULTS"
echo "- Overseerr: $OVERSEERR_URL" >> "$TEST_RESULTS"
echo "- Uptime Kuma: $UPTIME_URL" >> "$TEST_RESULTS"

# 3. Begin Manual Tests
echo ""
echo -e "${BLUE}=== Beginning Manual Test Checklist ===${NC}"
echo ""
echo "For each test, perform the action and report the result."
echo ""

echo "" >> "$TEST_RESULTS"
echo "## Test Results" >> "$TEST_RESULTS"
echo "" >> "$TEST_RESULTS"

# Phase 1: Initial Setup
echo "" >> "$TEST_RESULTS"
echo "### Phase 1: Initial Setup" >> "$TEST_RESULTS"
echo "" >> "$TEST_RESULTS"

test_step "Admin Bootstrap" "Navigate to http://localhost:3000 and complete admin setup with admin/admin"
test_step "Password Change" "Change the default admin password successfully"
test_step "Service Configuration" "Configure all three services (Plex, Overseerr, Uptime Kuma) in Settings"

# Phase 2: Authentication
echo "" >> "$TEST_RESULTS"
echo "### Phase 2: Authentication" >> "$TEST_RESULTS"
echo "" >> "$TEST_RESULTS"

test_step "Plex OAuth PIN" "Click 'Login with Plex' and receive a PIN code"
test_step "PIN Authorization" "Authorize the PIN at plex.tv/link"
test_step "Auto Login" "Return to app and verify automatic login"
test_step "Session Persistence" "Close and reopen browser, verify still logged in"
test_step "Logout" "Successfully logout from the application"

# Phase 3: Dashboard
echo "" >> "$TEST_RESULTS"
echo "### Phase 3: Service Dashboard" >> "$TEST_RESULTS"
echo "" >> "$TEST_RESULTS"

test_step "Service Cards" "All three service status cards display correctly"
test_step "Real-time Updates" "Service status updates within 30 seconds of change"
test_step "Service Degradation" "Stop one service and verify graceful handling"

# Phase 4: Media Features
echo "" >> "$TEST_RESULTS"
echo "### Phase 4: Media Management" >> "$TEST_RESULTS"
echo "" >> "$TEST_RESULTS"

test_step "Library Browse" "Browse Plex libraries successfully"
test_step "Media Search" "Search for new content via Overseerr"
test_step "Request Submission" "Submit a media request successfully"
test_step "Request History" "View your request history"

# Phase 5: YouTube
echo "" >> "$TEST_RESULTS"
echo "### Phase 5: YouTube Downloads" >> "$TEST_RESULTS"
echo "" >> "$TEST_RESULTS"

test_step "URL Validation" "Validate a YouTube URL successfully"
test_step "Download Queue" "Submit a download and see it in queue"
test_step "Progress Tracking" "Monitor download progress"
test_step "Rate Limiting" "Verify 5/hour rate limit works"

# Phase 6: Multi-User
echo "" >> "$TEST_RESULTS"
echo "### Phase 6: Multi-User Testing" >> "$TEST_RESULTS"
echo "" >> "$TEST_RESULTS"

test_step "Multiple Sessions" "Login with 2+ users simultaneously"
test_step "Data Isolation" "Verify users can't see each other's data"
test_step "Admin Access" "Verify admin can see all user data"

# Phase 7: Mobile
echo "" >> "$TEST_RESULTS"
echo "### Phase 7: Mobile Testing" >> "$TEST_RESULTS"
echo "" >> "$TEST_RESULTS"

test_step "Responsive Design" "Test on mobile device or browser"
test_step "Touch Navigation" "Verify touch interactions work"
test_step "Mobile Features" "Core features work on mobile"

# 4. Performance Checks
echo ""
echo -e "${BLUE}=== Performance Checks ===${NC}"
echo ""

echo "" >> "$TEST_RESULTS"
echo "## Performance Metrics" >> "$TEST_RESULTS"
echo "" >> "$TEST_RESULTS"

# Check container stats
echo "Container Resource Usage:"
docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}"

# Database connections
echo ""
echo "Database Connections:"
docker compose exec -T postgres psql -U medianest -d medianest -c "SELECT count(*) as connections FROM pg_stat_activity;" 2>/dev/null || echo "Could not check"

# Redis info
echo ""
echo "Redis Memory Usage:"
docker compose exec -T redis redis-cli INFO memory | grep "used_memory_human" || echo "Could not check"

# 5. Log Analysis
echo ""
echo -e "${BLUE}=== Recent Errors/Warnings ===${NC}"
echo ""

echo "" >> "$TEST_RESULTS"
echo "## Log Analysis" >> "$TEST_RESULTS"
echo "" >> "$TEST_RESULTS"

# Check for recent errors
echo "Recent Backend Errors:"
docker compose logs backend --tail 1000 2>/dev/null | grep -i "error" | tail -5 || echo "No recent errors"

echo "" >> "$TEST_RESULTS"
echo "### Recent Errors" >> "$TEST_RESULTS"
echo '```' >> "$TEST_RESULTS"
docker compose logs backend --tail 1000 2>/dev/null | grep -i "error" | tail -5 >> "$TEST_RESULTS" || echo "No recent errors" >> "$TEST_RESULTS"
echo '```' >> "$TEST_RESULTS"

# 6. Test Summary
echo ""
echo -e "${BLUE}=== Test Summary ===${NC}"
echo ""

echo "" >> "$TEST_RESULTS"
echo "## Summary" >> "$TEST_RESULTS"
echo "" >> "$TEST_RESULTS"

# Count results
TOTAL_TESTS=$(grep -c "^- \[" "$TEST_RESULTS" || true)
PASSED_TESTS=$(grep -c "^- \[x\]" "$TEST_RESULTS" || true)
FAILED_TESTS=$(grep -c "❌" "$TEST_RESULTS" || true)
SKIPPED_TESTS=$(grep -c "⏭️" "$TEST_RESULTS" || true)

echo "Total Tests: $TOTAL_TESTS"
echo "Passed: $PASSED_TESTS"
echo "Failed: $FAILED_TESTS"
echo "Skipped: $SKIPPED_TESTS"

echo "- Total Tests: $TOTAL_TESTS" >> "$TEST_RESULTS"
echo "- Passed: $PASSED_TESTS" >> "$TEST_RESULTS"
echo "- Failed: $FAILED_TESTS" >> "$TEST_RESULTS"
echo "- Skipped: $SKIPPED_TESTS" >> "$TEST_RESULTS"

# Calculate pass rate
if [ $TOTAL_TESTS -gt 0 ]; then
    PASS_RATE=$((PASSED_TESTS * 100 / TOTAL_TESTS))
    echo "Pass Rate: $PASS_RATE%"
    echo "- Pass Rate: $PASS_RATE%" >> "$TEST_RESULTS"
fi

# 7. Recommendations
echo "" >> "$TEST_RESULTS"
echo "## Recommendations" >> "$TEST_RESULTS"
echo "" >> "$TEST_RESULTS"

if [ $FAILED_TESTS -gt 0 ]; then
    echo "- ⚠️ Address failed tests before deployment" >> "$TEST_RESULTS"
fi

if [ $PASS_RATE -lt 90 ]; then
    echo "- ⚠️ Pass rate below 90%, additional testing recommended" >> "$TEST_RESULTS"
else
    echo "- ✅ Pass rate acceptable for homelab deployment" >> "$TEST_RESULTS"
fi

# Final message
echo ""
echo -e "${GREEN}Testing complete!${NC}"
echo "Results saved to: $TEST_RESULTS"
echo ""
echo "Next steps:"
echo "1. Review the test results file"
echo "2. Address any failed tests"
echo "3. Share results with beta testers"
echo "4. Run automated test suites"
echo ""

# Open results file (optional)
if command -v code &> /dev/null; then
    echo -n "Open results in VS Code? (y/n): "
    read -r open_vscode
    if [[ $open_vscode =~ ^[Yy]$ ]]; then
        code "$TEST_RESULTS"
    fi
elif command -v open &> /dev/null; then
    echo -n "Open results file? (y/n): "
    read -r open_file
    if [[ $open_file =~ ^[Yy]$ ]]; then
        open "$TEST_RESULTS"
    fi
fi