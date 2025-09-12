# MediaNest Deployment Validation Guide

**Use this checklist to validate your MediaNest deployment is working correctly.**

## 🚀 Quick Validation Commands

### Automated Validation

```bash
# Run the automated deployment script validation
./scripts/deployment-automation.sh health

# Or use the comprehensive validation
./scripts/deployment-automation.sh validate
```

### Manual Validation Steps

## 1. 🐳 Container Status Check

```bash
# Check all containers are running
docker compose -f config/docker/docker-compose.prod.yml ps

# Expected output - all services should show "Up" or "Up (healthy)":
# medianest-nginx        Up       0.0.0.0:80->80/tcp, 0.0.0.0:443->443/tcp
# medianest-frontend     Up       3000/tcp
# medianest-backend      Up       4000/tcp
# medianest-postgres     Up (healthy)   5432/tcp
# medianest-redis        Up (healthy)   6379/tcp
```

**✅ PASS:** All containers show "Up" status  
**❌ FAIL:** Any container shows "Exit", "Restarting", or missing

## 2. 🔍 Health Endpoint Checks

```bash
# Test backend health endpoint
curl -f http://localhost/api/health
# Expected: {"status":"ok","timestamp":"2025-09-09T...","uptime":...}

# Test frontend access (HTTP should redirect to HTTPS)
curl -I http://localhost
# Expected: HTTP/1.1 301 Moved Permanently

# Test HTTPS access (if SSL configured)
curl -f https://your-domain.com/api/health
# Expected: {"status":"ok",...} with HTTPS connection
```

**✅ PASS:** All endpoints return successful responses  
**❌ FAIL:** Any endpoint returns errors or timeouts

## 3. 🗄️ Database Connectivity

```bash
# Test PostgreSQL connection
docker compose -f config/docker/docker-compose.prod.yml exec postgres psql -U medianest -d medianest -c "SELECT version();"
# Expected: PostgreSQL version information

# Test database from backend
docker compose -f config/docker/docker-compose.prod.yml exec backend node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.\$connect()
  .then(() => { console.log('✅ Database connected successfully'); process.exit(0); })
  .catch(err => { console.error('❌ Database error:', err.message); process.exit(1); });
"
# Expected: "✅ Database connected successfully"
```

**✅ PASS:** Database connections work from both direct and application access  
**❌ FAIL:** Connection errors or timeouts

## 4. 📊 Redis Cache Check

```bash
# Test Redis connection
docker compose -f config/docker/docker-compose.prod.yml exec redis redis-cli -a "$(cat secrets/redis_password)" ping
# Expected: PONG

# Test Redis from application
docker compose -f config/docker/docker-compose.prod.yml exec backend node -e "
const Redis = require('ioredis');
const redis = new Redis(process.env.REDIS_URL);
redis.ping()
  .then(() => { console.log('✅ Redis connected successfully'); process.exit(0); })
  .catch(err => { console.error('❌ Redis error:', err.message); process.exit(1); });
"
# Expected: "✅ Redis connected successfully"
```

**✅ PASS:** Redis responds to ping and application can connect  
**❌ FAIL:** Redis connection errors

## 5. 🔐 Security Validation

```bash
# Check SSL certificate (if configured)
echo | openssl s_client -servername your-domain.com -connect your-domain.com:443 2>/dev/null | openssl x509 -noout -dates
# Expected: Valid date range showing certificate is not expired

# Test security headers
curl -I https://your-domain.com | grep -E "(Strict-Transport|X-Frame-Options|X-Content-Type|Content-Security-Policy)"
# Expected: Security headers present

# Check secrets file permissions
ls -la secrets/
# Expected: All files should have permissions 600 (-rw-------)
```

**✅ PASS:** SSL works, security headers present, secrets properly secured  
**❌ FAIL:** SSL errors, missing security headers, or incorrect permissions

## 6. 🌐 Network Connectivity

```bash
# Test external domain access (replace with your domain)
curl -I https://your-domain.com
# Expected: HTTP/2 200 OK

# Test DNS resolution
dig your-domain.com
# Expected: A record pointing to your server IP

# Test from external network (use online tool or different network)
# Visit: https://your-domain.com
# Expected: MediaNest login page loads without errors
```

**✅ PASS:** Domain resolves correctly and is accessible externally  
**❌ FAIL:** DNS issues or external access blocked

## 7. 📝 Application Functionality

```bash
# Test API status endpoint
curl -s https://your-domain.com/api/status | jq '.'
# Expected: JSON response with service status information

# Test authentication endpoint
curl -X POST https://your-domain.com/api/auth/csrf -c cookies.txt
# Expected: Sets CSRF token cookie

# Check logs for errors
docker compose -f config/docker/docker-compose.prod.yml logs --tail=50 backend frontend | grep -i error
# Expected: No critical errors (some warnings may be normal)
```

**✅ PASS:** API endpoints work, authentication system functional  
**❌ FAIL:** API errors or authentication failures

## 8. 📊 Performance Check

```bash
# Test response time
time curl -s https://your-domain.com > /dev/null
# Expected: Total time under 3 seconds

# Check resource usage
docker stats --no-stream
# Expected: Memory usage under 80%, CPU usage reasonable

# Check disk space
df -h
# Expected: Sufficient free space (>2GB recommended)
```

**✅ PASS:** Good response times and resource usage within limits  
**❌ FAIL:** Slow responses or high resource usage

## 9. 🔄 Service Restart Test

```bash
# Test graceful restart
docker compose -f config/docker/docker-compose.prod.yml restart backend

# Wait for service to come back up
sleep 30

# Test that services are still working after restart
curl -f https://your-domain.com/api/health
# Expected: Service responds normally after restart
```

**✅ PASS:** Services restart gracefully and continue working  
**❌ FAIL:** Services don't restart properly or lose functionality

## 10. 💾 Backup Validation

```bash
# Test backup creation
./scripts/deployment-automation.sh backup

# Check backup files exist
ls -la backups/
# Expected: Recent backup files with current timestamps

# Verify backup contents (without extracting)
tar -tzf backups/medianest-backup-*.tar.gz | head -10
# Expected: Expected files and directories listed
```

**✅ PASS:** Backups create successfully and contain expected content  
**❌ FAIL:** Backup creation fails or backups are empty

---

## 🎯 Comprehensive Validation Script

Save this as `validate-deployment.sh`:

```bash
#!/bin/bash
# MediaNest Deployment Validation Script
# Automatically validates all critical deployment aspects

set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

COMPOSE_FILE="config/docker/docker-compose.prod.yml"
DOMAIN="${DOMAIN_NAME:-localhost}"
PASSED=0
FAILED=0

check_test() {
    local test_name="$1"
    local command="$2"

    echo -n "🔍 Testing: $test_name... "

    if eval "$command" &>/dev/null; then
        echo -e "${GREEN}PASS${NC}"
        ((PASSED++))
        return 0
    else
        echo -e "${RED}FAIL${NC}"
        ((FAILED++))
        return 1
    fi
}

echo "🚀 MediaNest Deployment Validation"
echo "=================================="
echo "Domain: $DOMAIN"
echo "Compose file: $COMPOSE_FILE"
echo ""

# Container status checks
check_test "Container Status" "docker compose -f $COMPOSE_FILE ps | grep -q 'Up'"

# Health endpoint checks
check_test "Backend Health" "curl -f -s http://localhost/api/health"
check_test "HTTP Redirect" "curl -s -I http://localhost | grep -q '301\|302'"

# Database connectivity
check_test "PostgreSQL Connection" "docker compose -f $COMPOSE_FILE exec -T postgres psql -U medianest -d medianest -c 'SELECT 1;'"

# Redis connectivity
check_test "Redis Connection" "docker compose -f $COMPOSE_FILE exec -T redis redis-cli -a \"\$(cat secrets/redis_password)\" ping | grep -q PONG"

# File permissions
check_test "Secrets Permissions" "find secrets -type f ! -perm 600 | wc -l | grep -q '^0$'"

# Application functionality
check_test "API Status Endpoint" "curl -f -s https://$DOMAIN/api/status"

# Resource usage
check_test "Memory Usage" "free | awk 'NR==2{if (\$3/\$2 < 0.9) print \"OK\"}' | grep -q OK"
check_test "Disk Space" "df -h | awk '\$5 < \"90%\"' | grep -q /"

echo ""
echo "=================================="
echo -e "✅ Tests Passed: ${GREEN}$PASSED${NC}"
echo -e "❌ Tests Failed: ${RED}$FAILED${NC}"
echo ""

if [[ $FAILED -eq 0 ]]; then
    echo -e "${GREEN}🎉 All validation tests passed!${NC}"
    echo -e "${GREEN}Your MediaNest deployment is healthy and ready for use.${NC}"
    exit 0
else
    echo -e "${RED}💥 Some validation tests failed.${NC}"
    echo -e "${YELLOW}Please review the failed tests and check the troubleshooting guide.${NC}"
    exit 1
fi
```

Make it executable:

```bash
chmod +x validate-deployment.sh
```

---

## 🚨 Common Validation Failures

### Container Not Starting

**Symptoms:** `docker compose ps` shows "Exit" status  
**Quick Fix:**

```bash
docker compose -f config/docker/docker-compose.prod.yml logs backend
# Review logs and fix configuration issues
docker compose -f config/docker/docker-compose.prod.yml up -d --force-recreate
```

### Health Endpoints Failing

**Symptoms:** `curl` commands return connection errors  
**Quick Fix:**

```bash
# Check if services are listening on correct ports
docker compose -f config/docker/docker-compose.prod.yml exec backend netstat -tlnp
# Wait longer for services to start
sleep 60 && curl -f http://localhost/api/health
```

### Database Connection Issues

**Symptoms:** Database connection commands fail  
**Quick Fix:**

```bash
# Check PostgreSQL logs
docker compose -f config/docker/docker-compose.prod.yml logs postgres
# Verify credentials
cat secrets/database_url
# Restart database
docker compose -f config/docker/docker-compose.prod.yml restart postgres
```

### SSL Certificate Issues

**Symptoms:** HTTPS endpoints fail or certificate warnings  
**Quick Fix:**

```bash
# Check certificate files
ls -la data/certbot/ssl/
# Regenerate if needed
sudo certbot certonly --standalone -d your-domain.com
# Copy certificates
sudo cp /etc/letsencrypt/live/your-domain.com/*.pem data/certbot/ssl/
```

---

## ✅ Successful Validation Checklist

Mark each item as complete:

- [ ] All containers show "Up" or "Up (healthy)" status
- [ ] Backend health endpoint responds with JSON
- [ ] HTTP properly redirects to HTTPS
- [ ] HTTPS endpoint accessible (if SSL configured)
- [ ] PostgreSQL connection works from container and application
- [ ] Redis connection works and responds to PING
- [ ] Security headers present in HTTP responses
- [ ] Secrets files have correct 600 permissions
- [ ] API status endpoint returns service information
- [ ] Authentication endpoints functional
- [ ] Memory usage under 80%
- [ ] Disk space sufficient (>2GB free)
- [ ] Services restart gracefully
- [ ] Backups create successfully
- [ ] External domain access works (if applicable)

**🎉 If all items are checked, your MediaNest deployment is successfully validated!**

For any failing validation checks, refer to the [Troubleshooting Guide](TROUBLESHOOTING_GUIDE.md) for detailed solutions.

---

_This validation guide ensures your MediaNest deployment meets all operational requirements and is ready for production use._
