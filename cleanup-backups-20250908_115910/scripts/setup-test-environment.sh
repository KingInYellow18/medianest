#!/bin/bash

# MediaNest Test Environment Setup Script
# Quickly sets up a test environment for manual testing

set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m'

echo -e "${PURPLE}🚀 MediaNest Test Environment Setup${NC}"
echo "===================================="
echo ""

# Function to check prerequisites
check_prerequisite() {
    local cmd=$1
    local name=$2
    
    echo -n "Checking $name... "
    if command -v "$cmd" &> /dev/null; then
        echo -e "${GREEN}✓${NC}"
        return 0
    else
        echo -e "${RED}✗${NC}"
        echo "Please install $name before continuing."
        return 1
    fi
}

# Function to wait for service
wait_for_service() {
    local service=$1
    local url=$2
    local max_attempts=30
    local attempt=1
    
    echo -n "Waiting for $service to be ready..."
    
    while [ $attempt -le $max_attempts ]; do
        if curl -s -f -o /dev/null "$url" 2>/dev/null; then
            echo -e " ${GREEN}✓${NC}"
            return 0
        fi
        echo -n "."
        sleep 2
        ((attempt++))
    done
    
    echo -e " ${RED}✗${NC}"
    echo "Service $service failed to start after $max_attempts attempts"
    return 1
}

# 1. Check prerequisites
echo -e "${BLUE}Checking prerequisites...${NC}"
echo ""

all_good=true
check_prerequisite "docker" "Docker" || all_good=false
check_prerequisite "git" "Git" || all_good=false
check_prerequisite "curl" "curl" || all_good=false

if [ "$all_good" = false ]; then
    echo ""
    echo -e "${RED}Missing prerequisites. Please install them and try again.${NC}"
    exit 1
fi

# Check Docker Compose
echo -n "Checking Docker Compose... "
if docker compose version &> /dev/null; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${RED}✗${NC}"
    echo "Docker Compose v2 is required. Please update Docker."
    exit 1
fi

echo ""

# 2. Setup options
echo -e "${BLUE}Setup Options${NC}"
echo "1. Full clean setup (reset everything)"
echo "2. Quick restart (keep data)"
echo "3. Update and restart"
echo "4. Just start services"
echo ""
echo -n "Choose option (1-4): "
read -r setup_option

echo ""

# 3. Execute based on option
case $setup_option in
    1)
        echo -e "${YELLOW}Performing full clean setup...${NC}"
        echo ""
        
        # Stop and remove everything
        echo "Stopping existing containers..."
        docker compose down -v || true
        
        # Clean up data
        echo "Cleaning up old data..."
        rm -rf ./data/postgres ./data/redis ./data/uploads || true
        
        # Build fresh
        echo "Building fresh containers..."
        docker compose build --no-cache
        
        # Generate secrets
        echo "Generating secrets..."
        npm run generate-secrets || true
        
        # Start services
        echo "Starting services..."
        docker compose up -d
        
        # Run migrations
        echo "Waiting for database..."
        sleep 10
        echo "Running migrations..."
        docker compose exec backend npx prisma migrate deploy
        ;;
        
    2)
        echo -e "${YELLOW}Quick restart (keeping data)...${NC}"
        echo ""
        
        docker compose down
        docker compose up -d
        ;;
        
    3)
        echo -e "${YELLOW}Updating and restarting...${NC}"
        echo ""
        
        # Pull latest
        git pull origin main || echo "Could not pull latest changes"
        
        # Rebuild
        docker compose build
        
        # Restart
        docker compose down
        docker compose up -d
        
        # Run new migrations
        sleep 10
        docker compose exec backend npx prisma migrate deploy || true
        ;;
        
    4)
        echo -e "${YELLOW}Starting services...${NC}"
        echo ""
        
        docker compose up -d
        ;;
        
    *)
        echo -e "${RED}Invalid option${NC}"
        exit 1
        ;;
esac

echo ""

# 4. Wait for services to be ready
echo -e "${BLUE}Waiting for services to start...${NC}"
echo ""

wait_for_service "PostgreSQL" "http://localhost:5432" || true
wait_for_service "Redis" "http://localhost:6379" || true
wait_for_service "Backend API" "http://localhost:4000/api/health"
wait_for_service "Frontend" "http://localhost:3000"

echo ""

# 5. Display service status
echo -e "${BLUE}Service Status:${NC}"
echo ""
docker compose ps

echo ""

# 6. Create test data (optional)
echo -n "Create test data? (y/n): "
read -r create_test_data

if [[ $create_test_data =~ ^[Yy]$ ]]; then
    echo ""
    echo -e "${YELLOW}Creating test data...${NC}"
    
    # Create test users via SQL
    docker compose exec -T postgres psql -U medianest -d medianest << EOF
-- Create test users (passwords will be set via UI)
INSERT INTO users (id, plex_id, username, email, role, status, created_at, last_login_at)
VALUES 
  (gen_random_uuid(), 'test-user-1', 'testuser1', 'test1@example.com', 'user', 'active', NOW(), NOW()),
  (gen_random_uuid(), 'test-user-2', 'testuser2', 'test2@example.com', 'user', 'active', NOW(), NOW()),
  (gen_random_uuid(), 'test-admin', 'testadmin', 'admin@example.com', 'admin', 'active', NOW(), NOW())
ON CONFLICT (plex_id) DO NOTHING;

-- Create some media requests
INSERT INTO media_requests (id, user_id, external_id, media_type, media_id, title, status, requested_at)
SELECT 
  gen_random_uuid(),
  u.id,
  floor(random() * 1000)::int,
  CASE WHEN random() > 0.5 THEN 'movie' ELSE 'tv' END,
  floor(random() * 1000)::int,
  'Test Media ' || floor(random() * 100)::text,
  CASE 
    WHEN random() < 0.3 THEN 'pending'
    WHEN random() < 0.6 THEN 'approved'
    WHEN random() < 0.8 THEN 'available'
    ELSE 'failed'
  END,
  NOW() - (random() * interval '30 days')
FROM users u
CROSS JOIN generate_series(1, 5)
WHERE u.role = 'user'
LIMIT 10;

-- Create service configurations (without sensitive data)
INSERT INTO service_configurations (service, url, enabled, is_configured, created_at)
VALUES 
  ('plex', 'http://plex.local:32400', true, false, NOW()),
  ('overseerr', 'http://overseerr.local:5055', true, false, NOW()),
  ('uptime_kuma', 'http://uptime-kuma.local:3001', true, false, NOW())
ON CONFLICT (service) DO NOTHING;

-- Show created data
SELECT 'Test users created:' as info;
SELECT username, email, role FROM users ORDER BY created_at DESC LIMIT 5;

SELECT 'Test requests created:' as info;
SELECT title, media_type, status FROM media_requests ORDER BY requested_at DESC LIMIT 5;
EOF

    echo ""
    echo -e "${GREEN}Test data created!${NC}"
fi

echo ""

# 7. Display access information
echo -e "${BLUE}=== Access Information ===${NC}"
echo ""
echo "🌐 Frontend:        http://localhost:3000"
echo "🔧 Backend API:     http://localhost:4000/api/v1"
echo "📚 API Docs:        http://localhost:4000/api-docs"
echo "🗄️  Prisma Studio:   http://localhost:5555"
echo "🔴 Redis Commander: http://localhost:8081"
echo ""
echo "Default admin credentials: admin / admin"
echo "(You'll be prompted to change on first login)"
echo ""

# 8. Show helpful commands
echo -e "${BLUE}=== Helpful Commands ===${NC}"
echo ""
echo "View logs:           docker compose logs -f [service]"
echo "Enter container:     docker compose exec [service] bash"
echo "Run tests:           cd backend && npm test"
echo "Manual test helper:  ./scripts/manual-test-helper.sh"
echo "Stop everything:     docker compose down"
echo ""

# 9. Quick health check
echo -e "${BLUE}=== Quick Health Check ===${NC}"
echo ""

# Check API health
echo -n "API Health: "
API_HEALTH=$(curl -s http://localhost:4000/api/health | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
if [ "$API_HEALTH" = "ok" ]; then
    echo -e "${GREEN}✓ Healthy${NC}"
else
    echo -e "${RED}✗ Unhealthy${NC}"
fi

# Check database
echo -n "Database: "
if docker compose exec -T postgres pg_isready -U medianest &> /dev/null; then
    echo -e "${GREEN}✓ Ready${NC}"
else
    echo -e "${RED}✗ Not ready${NC}"
fi

# Check Redis
echo -n "Redis: "
if docker compose exec -T redis redis-cli ping &> /dev/null; then
    echo -e "${GREEN}✓ Ready${NC}"
else
    echo -e "${RED}✗ Not ready${NC}"
fi

echo ""

# 10. Open browser
echo -n "Open MediaNest in browser? (y/n): "
read -r open_browser

if [[ $open_browser =~ ^[Yy]$ ]]; then
    if command -v xdg-open &> /dev/null; then
        xdg-open "http://localhost:3000"
    elif command -v open &> /dev/null; then
        open "http://localhost:3000"
    elif command -v start &> /dev/null; then
        start "http://localhost:3000"
    else
        echo "Please open http://localhost:3000 in your browser"
    fi
fi

echo ""
echo -e "${GREEN}✅ Test environment is ready!${NC}"
echo ""
echo "Next steps:"
echo "1. Complete admin setup at http://localhost:3000"
echo "2. Configure your services (Plex, Overseerr, Uptime Kuma)"
echo "3. Run manual tests with: ./scripts/manual-test-helper.sh"
echo "4. Check automated tests with: cd backend && ./tests/run-critical-paths.sh"
echo ""

# Save environment info
cat > test-environment-info.txt << EOF
MediaNest Test Environment
Created: $(date)

Services:
- Frontend: http://localhost:3000
- Backend: http://localhost:4000
- Database: PostgreSQL on port 5432
- Cache: Redis on port 6379

Docker Containers:
$(docker compose ps --format "table {{.Name}}\t{{.Status}}")

Test Accounts:
- Admin: admin/admin (change on first login)
- Test users created in database (use Plex OAuth to activate)

Commands:
- Logs: docker compose logs -f
- Stop: docker compose down
- Clean: docker compose down -v
EOF

echo "Environment info saved to: test-environment-info.txt"