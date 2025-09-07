# Troubleshooting Guide

Comprehensive troubleshooting guide for MediaNest deployment issues, common problems, and their solutions.

## Table of Contents

- [General Troubleshooting](#general-troubleshooting)
- [Container Issues](#container-issues)
- [Database Problems](#database-problems)
- [Network Issues](#network-issues)
- [Performance Problems](#performance-problems)
- [SSL/TLS Issues](#ssltls-issues)
- [Authentication Problems](#authentication-problems)
- [File System Issues](#file-system-issues)
- [Monitoring and Logging](#monitoring-and-logging)
- [Common Error Messages](#common-error-messages)
- [Emergency Procedures](#emergency-procedures)

## General Troubleshooting

### Initial Diagnostic Steps

#### 1. Check System Status

```bash
# Check all container status
docker-compose ps

# Check system resources
df -h
free -h
docker system df

# Check Docker daemon
docker info
systemctl status docker
```

#### 2. Review Logs

```bash
# Check all service logs
docker-compose logs

# Check specific service logs
docker-compose logs backend
docker-compose logs postgres
docker-compose logs nginx

# Follow logs in real-time
docker-compose logs -f --tail=100

# Check system logs
journalctl -u docker.service
tail -f /var/log/syslog
```

#### 3. Health Checks

```bash
# Test health endpoints
curl -f http://localhost:4000/api/health
curl -f http://localhost:3000/api/health

# Check database connectivity
docker-compose exec postgres pg_isready -U medianest

# Check Redis connectivity
docker-compose exec redis redis-cli ping
```

### General Debugging Commands

```bash
# Enter container for debugging
docker-compose exec backend bash
docker-compose exec postgres psql -U medianest

# Check container resource usage
docker stats

# Inspect container configuration
docker inspect medianest-backend

# Check network connectivity
docker-compose exec backend ping postgres
docker-compose exec backend nslookup postgres
```

## Container Issues

### Container Won't Start

#### Problem: Container exits immediately

```bash
# Check exit code and reason
docker-compose ps
docker-compose logs <service-name>

# Check container configuration
docker-compose config
```

**Common Causes & Solutions:**

1. **Missing Environment Variables**

   ```bash
   # Check environment file
   cat .env

   # Verify required variables are set
   docker-compose exec backend printenv | grep -E "(DATABASE_URL|JWT_SECRET)"
   ```

2. **Port Conflicts**

   ```bash
   # Check port usage
   netstat -tulpn | grep <port>
   lsof -i :<port>

   # Solution: Change ports in docker-compose.yml
   ports:
     - "3001:3000"  # Use different host port
   ```

3. **Volume Mount Issues**

   ```bash
   # Check volume permissions
   ls -la ./data/

   # Fix permissions
   sudo chown -R 1001:1001 data/
   chmod -R 755 data/
   ```

### Container Memory Issues

#### Problem: Container killed by OOM

```bash
# Check memory usage
docker stats --no-stream

# Check Docker logs for OOM
dmesg | grep -i "killed process"
journalctl -u docker.service | grep -i oom
```

**Solutions:**

1. **Increase Memory Limits**

   ```yaml
   # In docker-compose.yml
   services:
     backend:
       deploy:
         resources:
           limits:
             memory: 2G
           reservations:
             memory: 1G
   ```

2. **Optimize Application Memory**
   ```bash
   # Set Node.js memory limit
   NODE_OPTIONS="--max-old-space-size=1024"
   ```

### Container Networking Issues

#### Problem: Services can't communicate

```bash
# Check network configuration
docker network ls
docker network inspect medianest_default

# Test connectivity between containers
docker-compose exec backend ping postgres
docker-compose exec backend telnet postgres 5432
```

**Solutions:**

1. **Verify Network Configuration**

   ```yaml
   # Ensure services are on same network
   networks:
     - default
   ```

2. **Use Service Names for Internal Communication**
   ```javascript
   // Use service name, not localhost
   const DATABASE_URL = 'postgresql://user:pass@postgres:5432/db';
   ```

## Database Problems

### PostgreSQL Connection Issues

#### Problem: "Connection refused" or "Connection timeout"

```bash
# Check PostgreSQL status
docker-compose exec postgres pg_isready -U medianest

# Check PostgreSQL logs
docker-compose logs postgres

# Test connection manually
docker-compose exec postgres psql -U medianest -d medianest
```

**Common Solutions:**

1. **Database Not Ready**

   ```bash
   # Wait for database to initialize
   docker-compose logs postgres | grep "ready to accept connections"

   # Use healthcheck in docker-compose.yml
   healthcheck:
     test: ["CMD-SHELL", "pg_isready -U medianest"]
     interval: 30s
     timeout: 10s
     retries: 5
   ```

2. **Wrong Connection Parameters**

   ```bash
   # Verify connection string
   echo $DATABASE_URL

   # Check environment variables
   docker-compose exec backend printenv | grep DB_
   ```

3. **Permissions Issues**

   ```bash
   # Check PostgreSQL permissions
   docker-compose exec postgres psql -U medianest -c "\\du"

   # Grant necessary permissions
   docker-compose exec postgres psql -U medianest -c "GRANT ALL PRIVILEGES ON DATABASE medianest TO medianest;"
   ```

### Database Migration Issues

#### Problem: Migrations fail or are stuck

```bash
# Check migration status
docker-compose exec backend npm run db:migrate:status

# View migration logs
docker-compose logs backend | grep -i migration
```

**Solutions:**

1. **Reset Migrations** (Development only)

   ```bash
   # Drop and recreate database
   docker-compose exec postgres dropdb -U medianest medianest --if-exists
   docker-compose exec postgres createdb -U medianest medianest

   # Run migrations
   docker-compose exec backend npm run db:migrate
   ```

2. **Fix Stuck Migration**

   ```bash
   # Check migration lock
   docker-compose exec postgres psql -U medianest -d medianest -c "SELECT * FROM knex_migrations_lock;"

   # Release lock if stuck
   docker-compose exec postgres psql -U medianest -d medianest -c "DELETE FROM knex_migrations_lock WHERE is_locked = 1;"
   ```

### Database Performance Issues

#### Problem: Slow queries or high CPU usage

```bash
# Check PostgreSQL activity
docker-compose exec postgres psql -U medianest -d medianest -c "SELECT * FROM pg_stat_activity;"

# Check slow queries (if pg_stat_statements is enabled)
docker-compose exec postgres psql -U medianest -d medianest -c "SELECT query, mean_time, calls FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10;"
```

**Solutions:**

1. **Analyze Query Performance**

   ```sql
   -- Enable query logging temporarily
   ALTER SYSTEM SET log_statement = 'all';
   SELECT pg_reload_conf();

   -- View query plans
   EXPLAIN ANALYZE SELECT * FROM expensive_query;
   ```

2. **Optimize Database Configuration**

   ```bash
   # Increase shared buffers
   docker-compose exec postgres psql -U medianest -c "ALTER SYSTEM SET shared_buffers = '256MB';"

   # Restart PostgreSQL
   docker-compose restart postgres
   ```

## Network Issues

### External Access Problems

#### Problem: Can't access application from outside

```bash
# Check port binding
docker-compose ps
netstat -tulpn | grep :80
netstat -tulpn | grep :443

# Check firewall rules
ufw status
iptables -L
```

**Solutions:**

1. **Verify Port Configuration**

   ```yaml
   # In docker-compose.yml
   services:
     nginx:
       ports:
         - '80:80'
         - '443:443'
   ```

2. **Check Firewall Rules**

   ```bash
   # Allow HTTP/HTTPS traffic
   ufw allow 80/tcp
   ufw allow 443/tcp
   ufw reload
   ```

3. **DNS Resolution Issues**

   ```bash
   # Test DNS resolution
   nslookup yourdomain.com
   dig yourdomain.com

   # Check /etc/hosts for local testing
   echo "127.0.0.1 medianest.local" >> /etc/hosts
   ```

### Reverse Proxy Issues

#### Problem: Nginx returning 502 Bad Gateway

```bash
# Check Nginx configuration
docker-compose exec nginx nginx -t

# Check upstream health
docker-compose exec nginx curl -f http://backend:4000/api/health
docker-compose exec nginx curl -f http://frontend:3000/api/health

# Check Nginx logs
docker-compose logs nginx
```

**Solutions:**

1. **Fix Nginx Configuration**

   ```nginx
   # Verify upstream configuration
   upstream backend {
       server backend:4000 max_fails=3 fail_timeout=30s;
   }

   # Test backend connectivity
   location /api/ {
       proxy_pass http://backend;
       # Add debugging headers
       proxy_set_header Host $host;
       proxy_set_header X-Real-IP $remote_addr;
   }
   ```

2. **Check Service Dependencies**
   ```yaml
   # Ensure proper startup order
   nginx:
     depends_on:
       backend:
         condition: service_healthy
       frontend:
         condition: service_healthy
   ```

## Performance Problems

### High CPU Usage

#### Problem: Containers consuming too much CPU

```bash
# Monitor CPU usage
docker stats --no-stream
top -p $(docker inspect --format '{{.State.Pid}}' medianest-backend)

# Check application logs for errors
docker-compose logs backend | grep -i error
```

**Solutions:**

1. **Optimize Application Code**

   ```javascript
   // Enable Node.js profiling
   node --prof app.js

   // Use performance monitoring
   const perfHooks = require('perf_hooks');
   ```

2. **Scale Services**

   ```bash
   # Scale backend service
   docker-compose up -d --scale backend=3
   ```

3. **Resource Limits**
   ```yaml
   # Set CPU limits
   services:
     backend:
       deploy:
         resources:
           limits:
             cpus: '1.0'
   ```

### Memory Leaks

#### Problem: Memory usage continuously increasing

```bash
# Monitor memory over time
while true; do
    docker stats --no-stream --format "table {{.Container}}\t{{.MemUsage}}\t{{.MemPerc}}"
    sleep 60
done

# Generate Node.js heap dump
docker-compose exec backend kill -USR2 $(pidof node)
```

**Solutions:**

1. **Analyze Memory Usage**

   ```javascript
   // Monitor memory in application
   setInterval(() => {
     const used = process.memoryUsage();
     console.log('Memory usage:', JSON.stringify(used));
   }, 30000);
   ```

2. **Optimize Caching**
   ```javascript
   // Clear cache periodically
   const cache = new Map();
   setInterval(() => {
     if (cache.size > 10000) {
       cache.clear();
     }
   }, 300000);
   ```

### Database Connection Pool Issues

#### Problem: "Too many connections" or connection timeout

```bash
# Check connection count
docker-compose exec postgres psql -U medianest -d medianest -c "SELECT count(*) FROM pg_stat_activity;"

# Check connection pool configuration
docker-compose exec backend node -e "console.log(require('./config/database.js').pool)"
```

**Solutions:**

1. **Optimize Connection Pool**

   ```javascript
   // Reduce pool size
   const pool = {
     min: 2,
     max: 10,
     acquireTimeoutMillis: 60000,
     idleTimeoutMillis: 30000,
   };
   ```

2. **Close Connections Properly**
   ```javascript
   // Always close connections
   try {
     const result = await query('SELECT * FROM users');
     return result;
   } finally {
     client.release();
   }
   ```

## SSL/TLS Issues

### Certificate Problems

#### Problem: SSL certificate errors or warnings

```bash
# Check certificate status
openssl x509 -in /path/to/cert.pem -text -noout

# Test SSL connection
openssl s_client -connect yourdomain.com:443 -servername yourdomain.com

# Check certificate expiry
echo | openssl s_client -servername yourdomain.com -connect yourdomain.com:443 2>/dev/null | openssl x509 -noout -dates
```

**Solutions:**

1. **Renew Let's Encrypt Certificate**

   ```bash
   # Manual renewal
   docker-compose run --rm certbot renew

   # Check renewal logs
   docker-compose logs certbot
   ```

2. **Fix Certificate Permissions**

   ```bash
   # Check certificate file permissions
   ls -la infrastructure/nginx/ssl/

   # Fix permissions
   chmod 600 infrastructure/nginx/ssl/privkey.pem
   chmod 644 infrastructure/nginx/ssl/fullchain.pem
   ```

3. **Verify Nginx SSL Configuration**

   ```nginx
   # Check SSL configuration
   ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
   ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

   # Test configuration
   docker-compose exec nginx nginx -t
   ```

### Mixed Content Issues

#### Problem: HTTP content on HTTPS site

```bash
# Check browser console for mixed content warnings
# Look for "Mixed Content" errors

# Check application URLs in code
grep -r "http://" frontend/src/
```

**Solutions:**

1. **Use Relative URLs**

   ```javascript
   // Instead of absolute URLs
   const API_URL = '/api/v1';

   // Or use environment variables
   const API_URL = process.env.NEXT_PUBLIC_API_URL;
   ```

2. **Content Security Policy**
   ```nginx
   add_header Content-Security-Policy "upgrade-insecure-requests;";
   ```

## Authentication Problems

### JWT Token Issues

#### Problem: "Invalid token" or authentication failures

```bash
# Check JWT configuration
docker-compose exec backend node -e "console.log(process.env.JWT_SECRET ? 'JWT_SECRET is set' : 'JWT_SECRET is missing')"

# Test token generation
docker-compose exec backend node -e "
const jwt = require('jsonwebtoken');
const token = jwt.sign({test: true}, process.env.JWT_SECRET);
console.log('Token:', token);
console.log('Verified:', jwt.verify(token, process.env.JWT_SECRET));
"
```

**Solutions:**

1. **Check JWT Secret Configuration**

   ```bash
   # Verify JWT secret is consistent
   docker-compose exec backend printenv | grep JWT
   docker-compose exec frontend printenv | grep JWT
   ```

2. **Fix Token Expiration**

   ```javascript
   // Check token expiration
   const jwt = require('jsonwebtoken');
   const decoded = jwt.decode(token);
   console.log('Token expires:', new Date(decoded.exp * 1000));
   ```

3. **Debug Token Validation**

   ```javascript
   // Add logging to auth middleware
   const authMiddleware = (req, res, next) => {
     const token = req.header('Authorization')?.replace('Bearer ', '');
     console.log('Received token:', token);

     try {
       const decoded = jwt.verify(token, process.env.JWT_SECRET);
       console.log('Decoded token:', decoded);
       req.user = decoded;
       next();
     } catch (error) {
       console.log('Token verification failed:', error.message);
       res.status(401).json({ error: 'Invalid token' });
     }
   };
   ```

### Session Management Issues

#### Problem: Users getting logged out frequently

```bash
# Check Redis session storage
docker-compose exec redis redis-cli keys "sess:*"
docker-compose exec redis redis-cli get "sess:XXXXX"

# Check session configuration
docker-compose logs backend | grep -i session
```

**Solutions:**

1. **Increase Session Timeout**

   ```javascript
   // Increase session max age
   session({
     maxAge: 24 * 60 * 60 * 1000, // 24 hours
     rolling: true, // Reset expiry on activity
   });
   ```

2. **Fix Redis Connection**

   ```javascript
   // Check Redis connectivity
   const redis = require('redis');
   const client = redis.createClient({
     host: process.env.REDIS_HOST,
     port: process.env.REDIS_PORT,
   });

   client.on('error', (err) => {
     console.error('Redis error:', err);
   });
   ```

## File System Issues

### Permission Errors

#### Problem: "Permission denied" errors

```bash
# Check file permissions
ls -la data/
ls -la uploads/
ls -la logs/

# Check container user
docker-compose exec backend id
docker-compose exec backend whoami
```

**Solutions:**

1. **Fix Directory Permissions**

   ```bash
   # Create directories with correct permissions
   mkdir -p data/{postgres,redis,uploads,downloads,logs}
   sudo chown -R 1001:1001 data/
   chmod -R 755 data/
   ```

2. **Use Proper User in Container**
   ```yaml
   # In docker-compose.yml
   services:
     backend:
       user: '1001:1001'
   ```

### Disk Space Issues

#### Problem: "No space left on device"

```bash
# Check disk usage
df -h
du -sh /*

# Check Docker space usage
docker system df
docker volume ls
```

**Solutions:**

1. **Clean Docker Resources**

   ```bash
   # Remove unused containers, networks, images
   docker system prune -a

   # Remove unused volumes (be careful!)
   docker volume prune

   # Clean up logs
   find /var/lib/docker/containers/ -name "*.log" -exec truncate -s 0 {} \;
   ```

2. **Configure Log Rotation**
   ```yaml
   # In docker-compose.yml
   services:
     backend:
       logging:
         driver: json-file
         options:
           max-size: '10m'
           max-file: '3'
   ```

## Monitoring and Logging

### Log Analysis Issues

#### Problem: Logs not appearing or incomplete

```bash
# Check log driver configuration
docker inspect medianest-backend | grep -i logging

# Check log files directly
find /var/lib/docker/containers/ -name "*-json.log" -exec tail -f {} \;

# Check custom log locations
ls -la logs/
tail -f logs/backend/combined.log
```

**Solutions:**

1. **Fix Log Driver Configuration**

   ```yaml
   # Ensure consistent logging configuration
   services:
     backend:
       logging:
         driver: 'json-file'
         options:
           max-size: '10m'
           max-file: '3'
   ```

2. **Debug Application Logging**

   ```javascript
   // Verify logging configuration
   const logger = require('./utils/logger');
   logger.info('Application started');
   logger.error('Test error message');

   // Check log levels
   console.log('Current log level:', process.env.LOG_LEVEL);
   ```

### Metrics Collection Issues

#### Problem: Prometheus not collecting metrics

```bash
# Check Prometheus targets
curl http://localhost:9090/api/v1/targets

# Test metrics endpoint
curl http://localhost:4000/metrics

# Check Prometheus configuration
docker-compose exec prometheus cat /etc/prometheus/prometheus.yml
```

**Solutions:**

1. **Fix Metrics Endpoint**

   ```javascript
   // Ensure metrics endpoint is available
   const promClient = require('prom-client');

   app.get('/metrics', async (req, res) => {
     res.set('Content-Type', promClient.register.contentType);
     res.end(await promClient.register.metrics());
   });
   ```

2. **Check Network Connectivity**
   ```bash
   # Test connectivity from Prometheus to application
   docker-compose exec prometheus wget -qO- http://backend:4000/metrics
   ```

## Common Error Messages

### "ECONNREFUSED"

**Meaning**: Connection refused - target service is not running or not accessible

**Common Causes**:

- Service not started
- Wrong host/port configuration
- Network connectivity issues

**Solutions**:

```bash
# Check service status
docker-compose ps

# Test connectivity
docker-compose exec backend telnet postgres 5432

# Check environment variables
docker-compose exec backend printenv | grep HOST
```

### "ENOTFOUND" / "getaddrinfo ENOTFOUND"

**Meaning**: DNS resolution failed - hostname cannot be resolved

**Common Causes**:

- Using localhost instead of service name
- Typo in service name
- Services not on same network

**Solutions**:

```bash
# Use service names for internal communication
DATABASE_URL=postgresql://user:pass@postgres:5432/db

# Check network configuration
docker network ls
docker network inspect medianest_default
```

### "Port already in use" / "EADDRINUSE"

**Meaning**: Attempting to bind to a port that's already in use

**Solutions**:

```bash
# Find what's using the port
lsof -i :3000
netstat -tulpn | grep :3000

# Kill the process or use different port
kill -9 PID
# Or change port in docker-compose.yml
ports:
  - "3001:3000"
```

### "No such file or directory" / "ENOENT"

**Meaning**: File or directory doesn't exist

**Common Causes**:

- Missing environment file
- Volume mount path doesn't exist
- Missing configuration files

**Solutions**:

```bash
# Check file exists
ls -la .env
ls -la secrets/

# Create missing directories
mkdir -p data/postgres data/redis

# Check volume mounts
docker-compose config | grep volumes -A 5
```

## Emergency Procedures

### Complete System Recovery

#### When everything is broken:

1. **Stop All Services**

   ```bash
   docker-compose down
   ```

2. **Check System Resources**

   ```bash
   df -h
   free -h
   docker system df
   ```

3. **Clean Docker Environment**

   ```bash
   docker system prune -a
   docker volume prune  # Be careful with this!
   ```

4. **Restore from Backup**

   ```bash
   ./scripts/complete-restore.sh /path/to/latest/backup
   ```

5. **Start Services Gradually**

   ```bash
   # Start database services first
   docker-compose up -d postgres redis

   # Wait and check health
   sleep 30
   docker-compose exec postgres pg_isready

   # Start application services
   docker-compose up -d backend frontend

   # Finally start reverse proxy
   docker-compose up -d nginx
   ```

### Quick Health Check Script

```bash
#!/bin/bash
# scripts/quick-health-check.sh

echo "=== MediaNest Quick Health Check ==="

# Check containers
echo "Checking container status..."
if docker-compose ps | grep -q "Up"; then
    echo "✓ Containers are running"
else
    echo "✗ Some containers are not running"
    docker-compose ps
fi

# Check database
echo "Checking database..."
if docker-compose exec postgres pg_isready -U medianest &>/dev/null; then
    echo "✓ Database is healthy"
else
    echo "✗ Database is not responding"
fi

# Check Redis
echo "Checking Redis..."
if docker-compose exec redis redis-cli ping &>/dev/null; then
    echo "✓ Redis is healthy"
else
    echo "✗ Redis is not responding"
fi

# Check application health
echo "Checking application health..."
if curl -f http://localhost:4000/api/health &>/dev/null; then
    echo "✓ Backend is healthy"
else
    echo "✗ Backend health check failed"
fi

if curl -f http://localhost:3000 &>/dev/null; then
    echo "✓ Frontend is accessible"
else
    echo "✗ Frontend is not accessible"
fi

# Check disk space
echo "Checking disk space..."
DISK_USAGE=$(df / | awk 'NR==2 {print $5}' | sed 's/%//')
if [ $DISK_USAGE -lt 90 ]; then
    echo "✓ Disk space is adequate ($DISK_USAGE% used)"
else
    echo "✗ Disk space is running low ($DISK_USAGE% used)"
fi

# Check memory
echo "Checking memory..."
MEM_USAGE=$(free | awk 'NR==2{printf "%.0f", $3*100/$2}')
if [ $MEM_USAGE -lt 90 ]; then
    echo "✓ Memory usage is normal ($MEM_USAGE% used)"
else
    echo "✗ Memory usage is high ($MEM_USAGE% used)"
fi

echo "=== Health check completed ==="
```

### Emergency Contacts and Escalation

When you need help:

1. **Check Documentation First**
   - This troubleshooting guide
   - Application logs
   - Docker Compose logs

2. **Gather Information**
   - Error messages
   - Log files
   - System status
   - Recent changes

3. **Create Support Request**
   - Include all relevant information
   - Steps to reproduce
   - Expected vs actual behavior

4. **Temporary Workarounds**
   - Restart affected services
   - Scale down to essential services only
   - Redirect traffic to maintenance page

Remember: Most issues can be resolved by checking logs, verifying configuration, and ensuring all services are healthy. When in doubt, start with the basics: container status, resource availability, and network connectivity.
