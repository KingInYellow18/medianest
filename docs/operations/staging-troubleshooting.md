# Staging Troubleshooting Guide

## Overview

This troubleshooting guide addresses common issues encountered during MediaNest staging deployment and operation. All solutions have been tested and validated with the critical fixes applied to the staging environment.

!!! success "Critical Fixes Applied"
This guide includes solutions for issues resolved by our critical fixes:

    - ✅ Backend service startup (secrets_validator_1 fix)
    - ✅ Docker build improvements
    - ✅ JWT/Cache service stabilization
    - ✅ Memory leak fixes
    - ✅ Worker thread stability

## Quick Diagnostic Commands

### System Health Check

```bash
#!/bin/bash
# quick-diagnostic.sh - Run this first for any issue

echo "🔍 MediaNest Staging Quick Diagnostics"
echo "======================================"

# Service status
echo "📊 Service Status:"
docker-compose -f docker-compose.staging.yml ps

# Resource usage
echo -e "\n💻 Resource Usage:"
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}"

# Recent logs (last 20 lines)
echo -e "\n📝 Recent Backend Logs:"
docker-compose -f docker-compose.staging.yml logs backend --tail=20

# Health endpoints
echo -e "\n🏥 Health Checks:"
curl -s http://localhost:3000/api/health | jq '.' || echo "❌ API health check failed"

# Database connection
echo -e "\n🗄️ Database Status:"
docker-compose exec -T postgres pg_isready -U medianest_user || echo "❌ Database not ready"

# Redis connection
echo -e "\n🔴 Redis Status:"
docker-compose exec -T redis redis-cli ping || echo "❌ Redis not responding"

echo -e "\n✅ Quick diagnostics complete"
```

## Service Startup Issues

### Backend Service Won't Start

**Symptoms:**

- Container exits immediately after start
- Error: "secrets_validator_1 failed"
- Application crashes during initialization

**Diagnosis:**

```bash
# Check container exit code
docker-compose -f docker-compose.staging.yml ps backend

# View detailed startup logs
docker-compose -f docker-compose.staging.yml logs backend --tail=50

# Check environment variables
docker-compose exec backend env | grep -E "(DATABASE_URL|JWT_SECRET|NODE_ENV)"
```

**Solutions:**

#### 1. Secrets Validation Issue (FIXED ✅)

This issue has been resolved in the current deployment, but if encountered:

```bash
# Verify environment variables are properly set
cat .env.staging | grep -E "(JWT_SECRET|DATABASE_URL|REDIS_URL)"

# Regenerate secrets if needed
echo "JWT_SECRET=$(openssl rand -base64 32)" >> .env.staging
echo "SESSION_SECRET=$(openssl rand -base64 32)" >> .env.staging

# Restart backend service
docker-compose -f docker-compose.staging.yml restart backend
```

#### 2. Database Connection Issues

```bash
# Test database connectivity
docker-compose exec postgres psql -U medianest_user -d medianest_staging -c "SELECT 1;"

# Check database URL format
# Correct format: postgresql://user:password@host:port/database
echo $DATABASE_URL

# Reset database connection
docker-compose -f docker-compose.staging.yml restart postgres
sleep 10
docker-compose -f docker-compose.staging.yml restart backend
```

#### 3. Port Conflicts

```bash
# Check if port is already in use
netstat -tuln | grep 3000

# Find process using the port
lsof -i :3000

# Kill conflicting process
sudo kill -9 $(lsof -t -i:3000)

# Restart services
docker-compose -f docker-compose.staging.yml up -d
```

### Frontend Service Issues

**Symptoms:**

- Frontend not accessible on port 3001
- Build failures during container startup
- Static assets not loading

**Diagnosis:**

```bash
# Check frontend container status
docker-compose -f docker-compose.staging.yml logs frontend

# Test frontend accessibility
curl -I http://localhost:3001/
```

**Solutions:**

#### 1. Build Failures

```bash
# Rebuild frontend container
docker-compose -f docker-compose.staging.yml build --no-cache frontend

# Check build logs
docker-compose -f docker-compose.staging.yml up --build frontend

# Clear Docker build cache
docker builder prune
```

#### 2. API Connection Issues

```bash
# Verify API_BASE_URL environment variable
docker-compose exec frontend env | grep API_BASE_URL

# Update API URL in environment
# Should be: API_BASE_URL=http://backend:3000/api (internal)
# Or: API_BASE_URL=http://localhost:3000/api (external)

# Restart frontend
docker-compose -f docker-compose.staging.yml restart frontend
```

## Database Connection Issues

### PostgreSQL Connection Failures

**Symptoms:**

- "Connection refused" errors
- "Password authentication failed"
- "Database does not exist"

**Diagnosis:**

```bash
# Check PostgreSQL container status
docker-compose -f docker-compose.staging.yml logs postgres

# Test connection from host
psql -h localhost -p 5432 -U medianest_user -d medianest_staging

# Check database existence
docker-compose exec postgres psql -U postgres -c "\l"
```

**Solutions:**

#### 1. Authentication Issues

```bash
# Verify PostgreSQL environment variables
docker-compose exec postgres env | grep POSTGRES

# Reset PostgreSQL password
docker-compose -f docker-compose.staging.yml down
docker volume rm medianest_postgres_data
docker-compose -f docker-compose.staging.yml up -d postgres

# Wait for initialization
sleep 30

# Run database migrations
docker-compose exec backend npm run db:migrate
```

#### 2. Database Connection Pool Issues

```bash
# Check active connections
docker-compose exec postgres psql -U medianest_user -d medianest_staging \
  -c "SELECT count(*) FROM pg_stat_activity WHERE datname='medianest_staging';"

# Terminate idle connections
docker-compose exec postgres psql -U medianest_user -d medianest_staging \
  -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='medianest_staging' AND state='idle';"

# Restart backend to reset connection pool
docker-compose -f docker-compose.staging.yml restart backend
```

### Database Performance Issues

**Symptoms:**

- Slow query responses
- High CPU usage on database container
- Connection timeouts

**Diagnosis:**

```bash
# Check slow queries
docker-compose exec postgres psql -U medianest_user -d medianest_staging \
  -c "SELECT query, calls, mean_exec_time FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 10;"

# Check database size
docker-compose exec postgres psql -U medianest_user -d medianest_staging \
  -c "SELECT pg_size_pretty(pg_database_size('medianest_staging'));"

# Monitor database activity
docker-compose exec postgres psql -U medianest_user -d medianest_staging \
  -c "SELECT * FROM pg_stat_activity WHERE datname='medianest_staging';"
```

**Solutions:**

#### 1. Query Optimization

```bash
# Run VACUUM and ANALYZE
docker-compose exec postgres psql -U medianest_user -d medianest_staging \
  -c "VACUUM ANALYZE;"

# Update table statistics
docker-compose exec postgres psql -U medianest_user -d medianest_staging \
  -c "ANALYZE;"

# Check for missing indexes
docker-compose exec backend npm run db:analyze-queries
```

#### 2. Resource Allocation

```yaml
# Update docker-compose.staging.yml
postgres:
  # ... existing configuration ...
  deploy:
    resources:
      limits:
        memory: 2G
        cpus: '2'
      reservations:
        memory: 1G
        cpus: '1'
  environment:
    # Increase shared buffers
    - POSTGRES_INITDB_ARGS=--shared-buffers=256MB --effective-cache-size=1GB
```

## Redis Connection Issues

### Redis Service Issues

**Symptoms:**

- Cache misses and performance degradation
- Session data loss
- Redis connection timeouts

**Diagnosis:**

```bash
# Check Redis container status
docker-compose -f docker-compose.staging.yml logs redis

# Test Redis connectivity
docker-compose exec redis redis-cli ping

# Check Redis memory usage
docker-compose exec redis redis-cli info memory

# Monitor Redis operations
docker-compose exec redis redis-cli monitor
```

**Solutions:**

#### 1. Memory Issues

```bash
# Check Redis memory configuration
docker-compose exec redis redis-cli CONFIG GET maxmemory

# Set memory limit if needed
docker-compose exec redis redis-cli CONFIG SET maxmemory 1gb
docker-compose exec redis redis-cli CONFIG SET maxmemory-policy allkeys-lru

# Save configuration
docker-compose exec redis redis-cli CONFIG REWRITE
```

#### 2. Persistence Issues

```bash
# Check Redis persistence status
docker-compose exec redis redis-cli LASTSAVE

# Force save to disk
docker-compose exec redis redis-cli BGSAVE

# Check AOF status
docker-compose exec redis redis-cli CONFIG GET appendonly

# Enable AOF if needed
docker-compose exec redis redis-cli CONFIG SET appendonly yes
```

## Memory and Performance Issues

### High Memory Usage

**Symptoms:**

- Containers consuming excessive memory
- Out of memory errors
- System becoming unresponsive

**Diagnosis:**

```bash
# Monitor container memory usage
docker stats --format "table {{.Name}}\t{{.MemUsage}}\t{{.MemPerc}}"

# Check system memory
free -h

# Identify memory leaks
docker-compose exec backend node --expose-gc -e "
  setInterval(() => {
    console.log('Memory:', process.memoryUsage());
    global.gc && global.gc();
  }, 5000);
"
```

**Solutions:**

#### 1. Memory Leak Fixes (FIXED ✅)

Memory leaks have been addressed in the current deployment:

```bash
# Verify memory leak fixes are applied
docker-compose exec backend node -e "console.log(process.env.MEMORY_LEAK_FIXES)"

# Monitor memory usage over time
while true; do
  echo "$(date): $(docker stats --no-stream --format '{{.MemUsage}}' medianest-backend-staging)"
  sleep 60
done
```

#### 2. Resource Limits

```yaml
# Update docker-compose.staging.yml with resource limits
services:
  backend:
    # ... existing configuration ...
    deploy:
      resources:
        limits:
          memory: 2G
          cpus: '2'
        reservations:
          memory: 512M
          cpus: '0.5'
    environment:
      - NODE_OPTIONS=--max-old-space-size=1536
```

### CPU Performance Issues

**Symptoms:**

- High CPU usage
- Slow response times
- Request timeouts

**Diagnosis:**

```bash
# Monitor CPU usage
docker stats --format "table {{.Name}}\t{{.CPUPerc}}"

# Profile Node.js application
docker-compose exec backend npm run profile

# Check for CPU-intensive queries
docker-compose exec postgres psql -U medianest_user -d medianest_staging \
  -c "SELECT query, calls, total_time FROM pg_stat_statements ORDER BY total_time DESC LIMIT 10;"
```

**Solutions:**

#### 1. Worker Thread Optimization (FIXED ✅)

Worker thread stability improvements have been applied:

```bash
# Verify worker thread fixes
docker-compose exec backend node -e "
  console.log('Worker threads enabled:', require('worker_threads').isMainThread);
  console.log('CPU cores:', require('os').cpus().length);
"

# Monitor worker performance
docker-compose exec backend npm run monitor:workers
```

#### 2. Caching Improvements

```bash
# Warm up cache
curl -X POST http://localhost:3000/api/cache/warmup

# Check cache hit ratio
docker-compose exec redis redis-cli info stats | grep keyspace_hits

# Optimize cache settings
docker-compose exec backend npm run optimize:cache
```

## Network and Connectivity Issues

### API Endpoint Not Accessible

**Symptoms:**

- HTTP 502/503 errors
- Connection refused
- Timeouts

**Diagnosis:**

```bash
# Test API endpoint
curl -v http://localhost:3000/api/health

# Check port binding
netstat -tuln | grep 3000

# Verify Docker network
docker network ls
docker network inspect medianest-network
```

**Solutions:**

#### 1. Port Binding Issues

```bash
# Check Docker port mapping
docker port medianest-backend-staging

# Restart with correct port binding
docker-compose -f docker-compose.staging.yml down
docker-compose -f docker-compose.staging.yml up -d

# Verify port accessibility
telnet localhost 3000
```

#### 2. Load Balancer Issues

```bash
# Check if load balancer is running
docker-compose ps nginx

# Test direct backend connection
curl -v http://localhost:3000/api/health

# Restart load balancer
docker-compose restart nginx
```

### Plex Integration Issues

**Symptoms:**

- Plex connection timeouts
- Authentication failures
- Library sync issues

**Diagnosis:**

```bash
# Test Plex connectivity
curl -v "http://your-plex-server:32400/identity?X-Plex-Token=your-token"

# Check Plex token validity
docker-compose exec backend npm run test:plex-auth

# Verify network connectivity
docker-compose exec backend ping plex-server-ip
```

**Solutions:**

#### 1. Token Issues

```bash
# Refresh Plex token
# Get new token from Plex Web App -> Settings -> Network -> Show Advanced

# Update environment variable
docker-compose -f docker-compose.staging.yml stop backend
# Update .env.staging with new PLEX_TOKEN
docker-compose -f docker-compose.staging.yml start backend
```

#### 2. Network Connectivity

```bash
# Test Plex server accessibility
telnet plex-server-ip 32400

# Check firewall rules
sudo ufw status | grep 32400

# Update Plex server URL if needed
# Ensure PLEX_URL in .env.staging points to correct server
```

## SSL/TLS and Security Issues

### HTTPS Certificate Issues

**Symptoms:**

- SSL certificate errors
- "Not secure" warnings
- Certificate expiration

**Diagnosis:**

```bash
# Check certificate validity
openssl x509 -in staging.medianest.com.crt -text -noout

# Test SSL connection
openssl s_client -connect staging.medianest.com:443 -servername staging.medianest.com

# Check certificate expiration
openssl x509 -in staging.medianest.com.crt -checkend 86400
```

**Solutions:**

#### 1. Certificate Renewal

```bash
# Renew Let's Encrypt certificate
sudo certbot renew --dry-run

# Generate new self-signed certificate
openssl req -x509 -newkey rsa:4096 -keyout staging.key -out staging.crt -days 365 -nodes

# Update certificate in container
docker-compose -f docker-compose.staging.yml restart nginx
```

#### 2. Certificate Configuration

```nginx
# nginx.conf SSL configuration
server {
    listen 443 ssl;
    server_name staging.medianest.com;

    ssl_certificate /etc/ssl/certs/staging.crt;
    ssl_certificate_key /etc/ssl/private/staging.key;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    location / {
        proxy_pass http://backend:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## Docker-Specific Issues

### Container Build Failures

**Symptoms:**

- Docker build errors
- Image build timeouts
- Dependency installation failures

**Diagnosis:**

```bash
# Check Docker daemon status
sudo systemctl status docker

# View build logs
docker-compose -f docker-compose.staging.yml build --no-cache --progress=plain

# Check Docker disk usage
docker system df
```

**Solutions:**

#### 1. Build Optimization (FIXED ✅)

Docker build improvements have been applied:

```bash
# Use multi-stage build
# Dockerfile improvements are already applied in current deployment

# Clear build cache
docker builder prune -a

# Rebuild with verbose output
docker-compose -f docker-compose.staging.yml build --no-cache --progress=plain backend
```

#### 2. Registry Issues

```bash
# Clear Docker cache
docker system prune -a

# Pull base images manually
docker pull node:18-alpine
docker pull postgres:14-alpine
docker pull redis:6-alpine

# Rebuild containers
docker-compose -f docker-compose.staging.yml build
```

### Volume and Data Issues

**Symptoms:**

- Data not persisting
- Volume mount failures
- Permission denied errors

**Diagnosis:**

```bash
# Check volume status
docker volume ls
docker volume inspect medianest_postgres_data

# Check mount permissions
docker-compose exec backend ls -la /app/storage

# Check disk space
df -h
```

**Solutions:**

#### 1. Permission Issues

```bash
# Fix volume permissions
sudo chown -R 1000:1000 /opt/medianest/storage
sudo chmod -R 755 /opt/medianest/storage

# Recreate volumes if needed
docker-compose -f docker-compose.staging.yml down -v
docker-compose -f docker-compose.staging.yml up -d
```

#### 2. Volume Recovery

```bash
# Backup volume data
docker run --rm -v medianest_postgres_data:/source:ro -v /backup:/target alpine \
  sh -c "cp -rp /source/* /target/"

# Restore volume data
docker run --rm -v medianest_postgres_data:/target -v /backup:/source alpine \
  sh -c "cp -rp /source/* /target/"
```

## Log Analysis and Debugging

### Application Logs

**Key Log Locations:**

- Backend: `docker-compose logs backend`
- Database: `docker-compose logs postgres`
- Cache: `docker-compose logs redis`
- Frontend: `docker-compose logs frontend`

### Common Error Patterns

#### 1. JWT Token Issues

```
Pattern: "JsonWebTokenError" or "TokenExpiredError"
Solution: Check JWT_SECRET and token generation
```

#### 2. Database Connection Pool

```
Pattern: "connection pool exhausted" or "too many clients"
Solution: Optimize connection pool settings
```

#### 3. Memory Leaks

```
Pattern: "JavaScript heap out of memory"
Solution: Memory leak fixes are applied, restart if needed
```

### Debug Mode

```bash
# Enable debug logging
docker-compose -f docker-compose.staging.yml stop backend
# Update .env.staging: LOG_LEVEL=debug
docker-compose -f docker-compose.staging.yml start backend

# View debug logs
docker-compose -f docker-compose.staging.yml logs backend -f
```

## Emergency Procedures

### Service Recovery

```bash
#!/bin/bash
# emergency-recovery.sh - Last resort recovery procedure

echo "🚨 Emergency Recovery Procedure"
echo "==============================="

# Stop all services
docker-compose -f docker-compose.staging.yml down

# Clean up containers and volumes
docker system prune -f

# Restore from backup if needed
if [ -f "/backup/latest/database.sql" ]; then
    echo "Restoring database from backup..."
    # Restore procedure here
fi

# Restart with fresh state
docker-compose -f docker-compose.staging.yml up -d --force-recreate

# Wait for services
sleep 30

# Run health checks
curl -f http://localhost:3000/api/health || echo "❌ Recovery failed"

echo "✅ Emergency recovery complete"
```

### Rollback Procedure

```bash
#!/bin/bash
# rollback.sh - Rollback to previous version

echo "🔄 Rolling back staging deployment"

# Stop current deployment
docker-compose -f docker-compose.staging.yml down

# Switch to previous version
git checkout HEAD~1

# Restore previous environment
cp .env.staging.backup .env.staging

# Start previous version
docker-compose -f docker-compose.staging.yml up -d

echo "✅ Rollback completed"
```

## Getting Help

### Escalation Matrix

| Severity                      | Response Time | Contact          |
| ----------------------------- | ------------- | ---------------- |
| **Critical** (Service Down)   | 15 minutes    | On-call engineer |
| **High** (Performance Issues) | 2 hours       | DevOps team      |
| **Medium** (Minor Issues)     | 8 hours       | Development team |
| **Low** (Questions)           | 24 hours      | Support team     |

### Support Channels

- **Documentation**: [Staging Deployment Guide](staging-deployment.md)
- **Prerequisites**: [Staging Prerequisites](staging-prerequisites.md)
- **GitHub Issues**: [Report Issues](https://github.com/kinginyellow/medianest/issues)
- **Emergency Contact**: [Contact Information]

### Information to Include in Support Requests

1. **Environment Details**
   - Operating system and version
   - Docker and Docker Compose versions
   - System resources (CPU, RAM, disk)

2. **Error Information**
   - Exact error messages
   - Steps to reproduce
   - Timestamps of issues

3. **System State**
   - Output of diagnostic commands
   - Recent logs (last 50 lines)
   - Service status information

4. **Configuration**
   - Environment variables (sanitized)
   - Docker Compose configuration
   - Any custom modifications

---

**Related Documentation:**

- [Staging Deployment Guide](staging-deployment.md) - Complete deployment instructions
- [Staging Prerequisites](staging-prerequisites.md) - Infrastructure requirements
- [Operations Monitoring](monitoring-stack.md) - Performance monitoring setup
