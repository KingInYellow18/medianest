# MediaNest Deployment Troubleshooting Guide

**Comprehensive solutions for common deployment issues with step-by-step diagnostics and fixes.**

## 🔍 Diagnostic Quick Reference

### First Steps for Any Issue

```bash
# Always start with these commands to gather information:
docker compose -f config/docker/docker-compose.prod.yml ps
docker compose -f config/docker/docker-compose.prod.yml logs --tail=50
docker system df
free -h
df -h
```

### Log Locations

```bash
# Application logs
tail -f logs/backend/application.log
tail -f logs/frontend/next.log
tail -f logs/nginx/access.log
tail -f logs/nginx/error.log

# Container logs
docker compose -f config/docker/docker-compose.prod.yml logs -f backend frontend postgres redis nginx
```

---

## 🐳 Docker & Container Issues

### Issue: Containers Won't Start

**Symptoms:**

- Containers exit immediately with non-zero code
- `docker compose ps` shows services as "Exit 1" or "Exit 125"
- Services stuck in "Restarting" state

**Immediate Diagnosis:**

```bash
# Check container status and exit codes
docker compose -f config/docker/docker-compose.prod.yml ps

# Check logs for specific service (replace 'backend' with problematic service)
docker compose -f config/docker/docker-compose.prod.yml logs backend

# Check system resources
df -h  # Disk space
free -h  # Memory
docker system df  # Docker space usage
```

**Common Root Causes & Solutions:**

#### A. Insufficient Disk Space

```bash
# Check available space
df -h

# Clean up Docker resources
docker system prune -f
docker volume prune -f
docker image prune -a -f

# Clean up logs if needed
sudo find /var/log -type f -name "*.log" -mtime +7 -delete
```

#### B. Memory Issues

```bash
# Check memory usage
free -h
ps aux --sort=-%mem | head -10

# Add swap if needed
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

#### C. Permission Issues

```bash
# Fix data directory permissions
sudo chown -R $USER:$USER data logs backups secrets
chmod 755 data logs backups
chmod 700 secrets
chmod 600 secrets/*

# Fix Docker socket permissions
sudo chown root:docker /var/run/docker.sock
sudo chmod 660 /var/run/docker.sock
```

#### D. Port Conflicts

```bash
# Check what's using ports 80/443
sudo ss -tlnp | grep :80
sudo ss -tlnp | grep :443

# Stop conflicting services
sudo systemctl stop apache2 nginx
sudo systemctl disable apache2 nginx

# Or configure alternative ports in docker-compose.prod.yml
```

### Issue: Build Failures

**Symptoms:**

- `docker compose build` fails with compilation errors
- "No such file or directory" errors during build
- TypeScript compilation failures

**Diagnosis & Solutions:**

```bash
# Clean build with verbose output
docker compose -f config/docker/docker-compose.prod.yml build --no-cache --progress=plain backend

# Check if source files exist
ls -la backend/src
ls -la frontend/src
ls -la shared/src

# Verify package.json files
cat package.json
cat backend/package.json
cat frontend/package.json

# Fix missing dependencies
npm install
cd backend && npm install && cd ..
cd frontend && npm install && cd ..
cd shared && npm install && cd ..

# Rebuild with fresh containers
docker compose -f config/docker/docker-compose.prod.yml down
docker compose -f config/docker/docker-compose.prod.yml build --no-cache
docker compose -f config/docker/docker-compose.prod.yml up -d
```

### Issue: Services Failing Health Checks

**Symptoms:**

- Services show as "unhealthy" in `docker compose ps`
- Health check timeouts
- Services restart continuously

**Diagnosis:**

```bash
# Check health check status
docker compose -f config/docker/docker-compose.prod.yml ps

# Test health endpoints manually
curl -f http://localhost:4000/api/health  # Backend
curl -f http://localhost:3000/api/health  # Frontend

# Check if services are actually responding
docker compose -f config/docker/docker-compose.prod.yml exec backend curl -f http://localhost:4000/api/health
```

**Solutions:**

```bash
# Increase health check timeouts in docker-compose.prod.yml
healthcheck:
  test: ['CMD', 'curl', '-f', 'http://localhost:4000/api/health']
  interval: 60s      # Increased from 30s
  timeout: 30s       # Increased from 10s
  retries: 5         # Increased from 3
  start_period: 120s # Increased from 60s

# Restart services after configuration change
docker compose -f config/docker/docker-compose.prod.yml up -d
```

---

## 🗄️ Database Issues

### Issue: Database Connection Failures

**Symptoms:**

- "database connection failed" in backend logs
- "ECONNREFUSED" errors
- Prisma connection timeouts

**Immediate Diagnosis:**

```bash
# Check PostgreSQL container status
docker compose -f config/docker/docker-compose.prod.yml ps postgres

# Check PostgreSQL logs
docker compose -f config/docker/docker-compose.prod.yml logs postgres

# Test database connection manually
docker compose -f config/docker/docker-compose.prod.yml exec postgres psql -U medianest -d medianest -c "SELECT version();"
```

**Common Solutions:**

#### A. PostgreSQL Not Ready

```bash
# Wait for PostgreSQL to be fully ready (can take 30-60 seconds)
sleep 60

# Check if PostgreSQL is accepting connections
docker compose -f config/docker/docker-compose.prod.yml exec postgres pg_isready -U medianest -d medianest
```

#### B. Incorrect Database Credentials

```bash
# Verify secrets exist and are readable
ls -la secrets/
cat secrets/database_url
cat secrets/postgres_password

# Check if credentials match between secrets and environment
docker compose -f config/docker/docker-compose.prod.yml exec backend env | grep DATABASE_URL
```

#### C. Database URL Formatting Issues

```bash
# Correct format should be:
# postgresql://username:password@host:port/database?options

# Example valid DATABASE_URL:
echo "postgresql://medianest:$(cat secrets/postgres_password)@postgres:5432/medianest?sslmode=prefer&connection_limit=20&pool_timeout=30" > secrets/database_url
```

### Issue: Migration Failures

**Symptoms:**

- "Migration failed" errors
- Database schema inconsistencies
- Prisma migration errors

**Solutions:**

```bash
# Check current migration status
docker compose -f config/docker/docker-compose.prod.yml exec backend npx prisma migrate status

# Reset database and run migrations (⚠️ DATA LOSS)
docker compose -f config/docker/docker-compose.prod.yml exec backend npx prisma migrate reset --force

# Or apply pending migrations
docker compose -f config/docker/docker-compose.prod.yml exec backend npx prisma migrate deploy

# Generate Prisma client if needed
docker compose -f config/docker/docker-compose.prod.yml exec backend npx prisma generate
```

### Issue: Database Performance Problems

**Symptoms:**

- Slow query responses
- High CPU usage on PostgreSQL container
- Connection timeouts

**Diagnosis & Solutions:**

```bash
# Check PostgreSQL performance
docker compose -f config/docker/docker-compose.prod.yml exec postgres psql -U medianest -d medianest -c "SELECT * FROM pg_stat_activity;"

# Check slow queries
docker compose -f config/docker/docker-compose.prod.yml exec postgres psql -U medianest -d medianest -c "SELECT query, mean_exec_time, calls FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 10;"

# Optimize database
docker compose -f config/docker/docker-compose.prod.yml exec postgres psql -U medianest -d medianest -c "VACUUM ANALYZE;"

# Increase PostgreSQL resources in docker-compose.prod.yml
deploy:
  resources:
    limits:
      cpus: '2.0'     # Increased from 1.0
      memory: 2G      # Increased from 1G
    reservations:
      cpus: '0.5'
      memory: 512M
```

---

## 🔐 SSL & HTTPS Issues

### Issue: SSL Certificate Problems

**Symptoms:**

- Browser shows "Certificate error" or "Not secure"
- SSL handshake failures
- Certificate expired warnings

**Diagnosis:**

```bash
# Check certificate files
ls -la data/certbot/ssl/
openssl x509 -in data/certbot/ssl/fullchain.pem -text -noout -dates

# Test SSL connection
echo | openssl s_client -servername your-domain.com -connect your-domain.com:443

# Check nginx SSL configuration
docker compose -f config/docker/docker-compose.prod.yml exec nginx nginx -t
```

**Solutions:**

#### A. Regenerate Let's Encrypt Certificate

```bash
# Stop nginx temporarily
docker compose -f config/docker/docker-compose.prod.yml stop nginx

# Remove old certificate
sudo certbot delete --cert-name your-domain.com

# Generate new certificate
sudo certbot certonly \
    --standalone \
    --email your-email@domain.com \
    --agree-tos \
    --no-eff-email \
    --domains your-domain.com

# Copy to application directory
sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem data/certbot/ssl/
sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem data/certbot/ssl/
sudo chown $USER:$USER data/certbot/ssl/*

# Restart nginx
docker compose -f config/docker/docker-compose.prod.yml up -d nginx
```

#### B. Fix Certificate Permissions

```bash
chmod 644 data/certbot/ssl/fullchain.pem
chmod 600 data/certbot/ssl/privkey.pem
chown $USER:$USER data/certbot/ssl/*
```

#### C. Configure Self-Signed Certificate (for testing)

```bash
# Generate self-signed certificate
openssl req -x509 -newkey rsa:4096 \
    -keyout data/certbot/ssl/privkey.pem \
    -out data/certbot/ssl/fullchain.pem \
    -days 365 -nodes \
    -subj "/C=US/ST=State/L=City/O=Organization/CN=your-domain.com"

chmod 600 data/certbot/ssl/privkey.pem
chmod 644 data/certbot/ssl/fullchain.pem
```

### Issue: HTTPS Redirects Not Working

**Symptoms:**

- HTTP requests don't redirect to HTTPS
- Mixed content warnings
- Insecure connections allowed

**Solutions:**

```bash
# Check nginx configuration
docker compose -f config/docker/docker-compose.prod.yml exec nginx cat /etc/nginx/nginx.conf

# Ensure redirect is configured in nginx config:
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

# Restart nginx after configuration changes
docker compose -f config/docker/docker-compose.prod.yml restart nginx
```

---

## 🌐 Network & Connectivity Issues

### Issue: External Access Problems

**Symptoms:**

- Can't reach application from internet
- Timeouts when accessing domain
- DNS resolution failures

**Diagnosis:**

```bash
# Test DNS resolution
dig your-domain.com
nslookup your-domain.com

# Test connectivity from server
curl -I http://localhost
curl -I https://localhost -k

# Check firewall
sudo ufw status
sudo iptables -L

# Check if ports are listening
sudo ss -tlnp | grep :80
sudo ss -tlnp | grep :443
```

**Solutions:**

#### A. DNS Issues

```bash
# Verify DNS A record points to correct IP
dig your-domain.com +short

# Check from external DNS checker
# Use online tools like whatsmydns.net
```

#### B. Firewall Blocking Access

```bash
# Allow HTTP/HTTPS through firewall
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw reload

# Check if cloud provider firewall is also blocking
# Configure security groups in AWS/GCP/Azure console
```

#### C. Docker Network Issues

```bash
# Restart Docker daemon
sudo systemctl restart docker

# Recreate networks
docker compose -f config/docker/docker-compose.prod.yml down
docker network prune -f
docker compose -f config/docker/docker-compose.prod.yml up -d
```

### Issue: Inter-Service Communication Problems

**Symptoms:**

- Frontend can't reach backend
- Services can't connect to database/Redis
- "Connection refused" between containers

**Diagnosis & Solutions:**

```bash
# Test network connectivity between containers
docker compose -f config/docker/docker-compose.prod.yml exec frontend ping backend
docker compose -f config/docker/docker-compose.prod.yml exec backend ping postgres
docker compose -f config/docker/docker-compose.prod.yml exec backend ping redis

# Check Docker networks
docker network ls
docker network inspect medianest_backend-network
docker network inspect medianest_frontend-network

# Recreate networks if corrupted
docker compose -f config/docker/docker-compose.prod.yml down
docker network prune -f
docker compose -f config/docker/docker-compose.prod.yml up -d
```

---

## 🚀 Application-Specific Issues

### Issue: Frontend Loading Problems

**Symptoms:**

- White screen or blank page
- JavaScript errors in browser console
- Next.js build failures

**Diagnosis:**

```bash
# Check frontend logs
docker compose -f config/docker/docker-compose.prod.yml logs frontend

# Check browser console for JavaScript errors
# (Open browser developer tools)

# Test if backend API is accessible from frontend
docker compose -f config/docker/docker-compose.prod.yml exec frontend curl -f http://backend:4000/api/health
```

**Solutions:**

```bash
# Rebuild frontend with clean cache
docker compose -f config/docker/docker-compose.prod.yml stop frontend
docker compose -f config/docker/docker-compose.prod.yml build --no-cache frontend
docker compose -f config/docker/docker-compose.prod.yml up -d frontend

# Check environment variables are correct
docker compose -f config/docker/docker-compose.prod.yml exec frontend env | grep NEXT_PUBLIC

# Verify API URL configuration
echo "NEXT_PUBLIC_API_URL should be: https://your-domain.com/api"
```

### Issue: Authentication Not Working

**Symptoms:**

- Login failures
- JWT token errors
- Session management issues

**Diagnosis & Solutions:**

```bash
# Check authentication secrets
ls -la secrets/nextauth_secret secrets/jwt_secret

# Verify NextAuth configuration
docker compose -f config/docker/docker-compose.prod.yml exec frontend env | grep NEXTAUTH

# Check if sessions are being created
docker compose -f config/docker/docker-compose.prod.yml exec backend npx prisma studio
# Check User and Session tables

# Test JWT token generation
curl -X POST https://your-domain.com/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}'
```

### Issue: File Upload Problems

**Symptoms:**

- "File upload failed" errors
- Permission denied on uploads
- Disk space issues

**Solutions:**

```bash
# Check upload directory permissions
ls -la data/uploads
sudo chown -R 1001:1001 data/uploads
chmod 755 data/uploads

# Check disk space
df -h data/uploads

# Check upload limits in nginx
docker compose -f config/docker/docker-compose.prod.yml exec nginx grep -i "client_max_body_size" /etc/nginx/nginx.conf

# Test upload endpoint
curl -X POST -F "file=@testfile.txt" https://your-domain.com/api/upload
```

---

## 🔧 Performance Issues

### Issue: High Memory Usage

**Symptoms:**

- System running out of memory
- Containers being killed (OOMKilled)
- Slow response times

**Diagnosis:**

```bash
# Check system memory
free -h
cat /proc/meminfo

# Check container memory usage
docker stats --no-stream

# Check for memory leaks
docker compose -f config/docker/docker-compose.prod.yml exec backend node --expose-gc -e "
setInterval(() => {
  const usage = process.memoryUsage();
  console.log('Memory Usage:', {
    rss: Math.round(usage.rss / 1024 / 1024) + 'MB',
    heapTotal: Math.round(usage.heapTotal / 1024 / 1024) + 'MB',
    heapUsed: Math.round(usage.heapUsed / 1024 / 1024) + 'MB'
  });
}, 5000);
" &
```

**Solutions:**

```bash
# Add or increase swap space
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# Optimize container memory limits
# Edit docker-compose.prod.yml:
deploy:
  resources:
    limits:
      memory: 512M  # Reduce if needed
    reservations:
      memory: 256M

# Restart services with new limits
docker compose -f config/docker/docker-compose.prod.yml up -d

# Enable Node.js memory optimization
environment:
  - NODE_OPTIONS=--max-old-space-size=512 --optimize-for-size
```

### Issue: Slow Database Queries

**Symptoms:**

- API responses taking >2 seconds
- Database timeout errors
- High CPU usage on PostgreSQL

**Solutions:**

```bash
# Enable query logging in PostgreSQL
docker compose -f config/docker/docker-compose.prod.yml exec postgres psql -U medianest -d medianest -c "
ALTER SYSTEM SET log_statement = 'all';
ALTER SYSTEM SET log_duration = on;
SELECT pg_reload_conf();
"

# Analyze slow queries
docker compose -f config/docker/docker-compose.prod.yml exec postgres psql -U medianest -d medianest -c "
SELECT query, mean_exec_time, calls, total_exec_time
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
"

# Add database indexes (example)
docker compose -f config/docker/docker-compose.prod.yml exec backend npx prisma db execute --stdin <<< "
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_email ON users(email);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_session_user_id ON sessions(user_id);
"

# Optimize PostgreSQL configuration
docker compose -f config/docker/docker-compose.prod.yml exec postgres psql -U medianest -d medianest -c "
ALTER SYSTEM SET shared_buffers = '512MB';
ALTER SYSTEM SET effective_cache_size = '1GB';
ALTER SYSTEM SET maintenance_work_mem = '128MB';
SELECT pg_reload_conf();
"
```

---

## 🛠️ Emergency Recovery Procedures

### Complete System Recovery

**When everything is broken and you need to start fresh:**

```bash
# 1. Stop all services
docker compose -f config/docker/docker-compose.prod.yml down

# 2. Create emergency backup (if possible)
docker run --rm -v medianest_postgres_data:/data -v $(pwd)/emergency-backup:/backup alpine tar czf /backup/postgres-emergency.tar.gz -C /data .

# 3. Clean up Docker completely
docker system prune -a -f --volumes
docker network prune -f

# 4. Reset to clean state
git status
git reset --hard HEAD
git clean -fd

# 5. Regenerate all secrets
./generate-secrets.sh

# 6. Rebuild and restart
docker compose -f config/docker/docker-compose.prod.yml build --no-cache
docker compose -f config/docker/docker-compose.prod.yml up -d

# 7. Restore data if needed
# (Follow backup restoration procedures)
```

### Quick Health Recovery Script

Create this script for rapid diagnostics and fixes:

```bash
#!/bin/bash
# Save as: emergency-fix.sh
set -e

echo "🚨 MediaNest Emergency Recovery"
echo "==============================="

# Stop services
docker compose -f config/docker/docker-compose.prod.yml down

# Clean up resources
docker system prune -f
docker volume prune -f

# Fix permissions
sudo chown -R $USER:$USER data logs backups secrets
chmod 755 data logs backups
chmod 700 secrets
chmod 600 secrets/*

# Restart services
docker compose -f config/docker/docker-compose.prod.yml up -d

# Wait for services to start
echo "⏳ Waiting for services to start..."
sleep 60

# Check health
docker compose -f config/docker/docker-compose.prod.yml ps

# Test connectivity
curl -f https://your-domain.com/api/health && echo "✅ Application is healthy" || echo "❌ Application still has issues"

echo "🏥 Emergency recovery complete!"
```

---

## 📞 Getting Help

### Information to Gather Before Seeking Help

```bash
# System information
uname -a
lsb_release -a
docker --version
docker compose version

# Service status
docker compose -f config/docker/docker-compose.prod.yml ps
docker compose -f config/docker/docker-compose.prod.yml logs --tail=100

# Resource usage
free -h
df -h
docker system df

# Network configuration
ip addr show
sudo ufw status
```

### Log Collection Script

```bash
#!/bin/bash
# Save as: collect-logs.sh
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_DIR="debug-logs-$TIMESTAMP"

mkdir -p "$LOG_DIR"

# Collect system info
uname -a > "$LOG_DIR/system-info.txt"
docker --version >> "$LOG_DIR/system-info.txt"
free -h >> "$LOG_DIR/system-info.txt"
df -h >> "$LOG_DIR/system-info.txt"

# Collect container info
docker compose -f config/docker/docker-compose.prod.yml ps > "$LOG_DIR/container-status.txt"
docker compose -f config/docker/docker-compose.prod.yml logs --tail=200 > "$LOG_DIR/container-logs.txt"

# Collect configuration (without secrets)
cp .env.production "$LOG_DIR/env-config.txt"
sed -i 's/password=[^&]*/password=REDACTED/g' "$LOG_DIR/env-config.txt"

# Create archive
tar -czf "medianest-debug-$TIMESTAMP.tar.gz" "$LOG_DIR"
rm -rf "$LOG_DIR"

echo "📦 Debug information collected: medianest-debug-$TIMESTAMP.tar.gz"
echo "📧 Attach this file when reporting issues"
```

---

**This troubleshooting guide covers the most common deployment issues. For additional help, check the main [README_DEPLOYMENT.md](../README_DEPLOYMENT.md) or create an issue on the MediaNest GitHub repository.**
