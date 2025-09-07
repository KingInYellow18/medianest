# MediaNest Troubleshooting Guide

**Version:** 4.0 - Comprehensive Problem Resolution  
**Last Updated:** September 7, 2025  
**Scope:** Common Issues, Diagnostics, and Solutions

## Table of Contents

1. [Quick Diagnostics](#quick-diagnostics)
2. [Installation Issues](#installation-issues)
3. [Authentication Problems](#authentication-problems)
4. [Database Issues](#database-issues)
5. [External Service Problems](#external-service-problems)
6. [Performance Issues](#performance-issues)
7. [Frontend Problems](#frontend-problems)
8. [Deployment Issues](#deployment-issues)
9. [Error Code Reference](#error-code-reference)
10. [Log Analysis](#log-analysis)

## Quick Diagnostics

### System Health Check

#### Quick Status Commands

```bash
# Check all services status
curl http://localhost:4000/api/v1/health

# Check specific service components
curl http://localhost:4000/api/v1/health/database
curl http://localhost:4000/api/v1/health/redis
curl http://localhost:4000/api/v1/health/external

# Check frontend accessibility
curl http://localhost:3000

# Check process status
ps aux | grep -E "(node|npm|next)"
```

#### Service Verification Checklist

```bash
# 1. Check ports are listening
netstat -tlnp | grep -E "(3000|4000|5432|6379)"

# 2. Check environment variables
env | grep -E "(DATABASE_URL|REDIS_URL|JWT_SECRET)"

# 3. Check log files for errors
tail -f backend/logs/app.log
tail -f frontend/.next/build.log

# 4. Check disk space
df -h

# 5. Check memory usage
free -m
```

### Common Quick Fixes

#### Service Restart Commands

```bash
# Restart backend service
npm run restart:backend

# Restart frontend service
npm run restart:frontend

# Restart all services (Docker)
docker-compose restart

# Clear cache and restart
npm run clean && npm run dev
```

## Installation Issues

### Node.js and npm Issues

#### Problem: Node Version Mismatch

```bash
# Symptoms
Error: Node.js version 14.x is not supported
npm ERR! engine Unsupported engine

# Solution
# Install Node.js 18+
nvm install 18
nvm use 18
node --version  # Should show 18.x.x
```

#### Problem: npm Install Failures

```bash
# Symptoms
npm ERR! code EACCES
npm ERR! peer dep missing

# Solutions
# Clear npm cache
npm cache clean --force

# Delete node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Fix permissions (Linux/Mac)
sudo chown -R $(whoami) ~/.npm
```

### Database Setup Issues

#### Problem: PostgreSQL Connection Failed

```bash
# Symptoms
Error: connect ECONNREFUSED 127.0.0.1:5432
Database connection failed

# Diagnostics
# Check if PostgreSQL is running
sudo systemctl status postgresql
# or on Mac
brew services list | grep postgresql

# Check connection
psql -h localhost -U postgres -c "SELECT 1;"

# Solutions
# Start PostgreSQL
sudo systemctl start postgresql
# or on Mac
brew services start postgresql

# Check DATABASE_URL format
echo $DATABASE_URL
# Should be: postgresql://user:password@host:port/database
```

#### Problem: Prisma Migration Issues

```bash
# Symptoms
Migration failed: column does not exist
Schema drift detected

# Solutions
# Reset database (development only)
npx prisma migrate reset

# Generate Prisma client
npx prisma generate

# Deploy pending migrations
npx prisma migrate deploy

# Check migration status
npx prisma migrate status
```

### Redis Connection Issues

#### Problem: Redis Not Available

```bash
# Symptoms
Error: connect ECONNREFUSED 127.0.0.1:6379
Session store unavailable

# Diagnostics
# Test Redis connection
redis-cli ping  # Should return PONG

# Check Redis status
sudo systemctl status redis
# or
brew services list | grep redis

# Solutions
# Start Redis
sudo systemctl start redis
# or on Mac
brew services start redis

# Check Redis configuration
redis-cli config get "*"
```

## Authentication Problems

### Login Issues

#### Problem: Cannot Login with Valid Credentials

```bash
# Symptoms
401 Unauthorized
Invalid credentials error
Login form returns to login page

# Diagnostics
# Check JWT secret is set
echo $JWT_SECRET | wc -c  # Should be >= 32 characters

# Check database for user
npx prisma studio
# Look in User table for account

# Check authentication logs
grep -i "authentication" backend/logs/app.log

# Solutions
# Verify password hash
# Reset user password via database
# Check JWT_SECRET environment variable
# Verify session storage (Redis)
```

#### Problem: Session Expires Immediately

```bash
# Symptoms
User logged out after page refresh
Session timeout errors
Repeated login prompts

# Diagnostics
# Check JWT expiration settings
echo $JWT_ACCESS_EXPIRES_IN
echo $JWT_REFRESH_EXPIRES_IN

# Check session configuration
grep -i "session" backend/logs/app.log

# Solutions
# Increase JWT expiration time
JWT_ACCESS_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=7d

# Check cookie settings
# Verify HTTPS in production
# Check SameSite cookie settings
```

### Permission Issues

#### Problem: Authorization Denied

```bash
# Symptoms
403 Forbidden
Access denied errors
Missing permissions

# Diagnostics
# Check user role in database
SELECT id, email, role FROM users WHERE email = 'user@example.com';

# Check token claims
# Decode JWT token at jwt.io

# Solutions
# Update user role
UPDATE users SET role = 'admin' WHERE email = 'admin@example.com';

# Verify role-based middleware
# Check route protection configuration
```

## Database Issues

### Connection Problems

#### Problem: Too Many Connections

```bash
# Symptoms
Error: remaining connection slots are reserved
Connection pool exhausted

# Diagnostics
# Check active connections
SELECT count(*) FROM pg_stat_activity;

# Check pool configuration
echo $DB_POOL_MAX

# Solutions
# Increase connection pool size
DB_POOL_MAX=20

# Check for connection leaks
# Review database query patterns
# Implement connection cleanup
```

#### Problem: Slow Queries

```bash
# Symptoms
Database timeout errors
Slow API response times
High CPU usage

# Diagnostics
# Check slow query log
SELECT query, mean_time, calls
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;

# Check missing indexes
EXPLAIN ANALYZE SELECT * FROM table WHERE condition;

# Solutions
# Add appropriate indexes
CREATE INDEX CONCURRENTLY idx_table_column ON table(column);

# Optimize queries
# Use LIMIT and pagination
# Avoid SELECT *
```

### Data Issues

#### Problem: Migration Failures

```bash
# Symptoms
Migration version mismatch
Schema drift detected
Foreign key constraint errors

# Diagnostics
# Check migration status
npx prisma migrate status

# Check schema differences
npx prisma db pull
git diff prisma/schema.prisma

# Solutions
# Reset database (development)
npx prisma migrate reset

# Resolve schema conflicts
npx prisma db push --force-reset

# Apply pending migrations
npx prisma migrate deploy
```

## External Service Problems

### Plex Integration Issues

#### Problem: Plex Server Not Accessible

```bash
# Symptoms
Plex connection timeout
Media not loading
Empty media libraries

# Diagnostics
# Test Plex server directly
curl -I http://plex-server:32400/web/index.html

# Check Plex token validity
curl "http://plex-server:32400/identity?X-Plex-Token=YOUR_TOKEN"

# Check network connectivity
ping plex-server
telnet plex-server 32400

# Solutions
# Verify PLEX_SERVER_URL
# Check firewall settings
# Validate Plex authentication token
# Ensure Plex remote access is enabled
```

#### Problem: Plex Authentication Failed

```bash
# Symptoms
401 Unauthorized from Plex
Invalid Plex token
Authentication errors in logs

# Diagnostics
# Validate token format
echo $PLEX_TOKEN | wc -c  # Should be 20 characters

# Test token validity
curl "https://plex.tv/users/account.json?X-Plex-Token=$PLEX_TOKEN"

# Solutions
# Generate new Plex token
# Visit: https://support.plex.tv/articles/204059436-finding-an-authentication-token-x-plex-token/
# Update environment variable
# Restart application
```

### YouTube API Issues

#### Problem: YouTube Quota Exceeded

```bash
# Symptoms
403 Quota exceeded
YouTube search not working
API limit errors

# Diagnostics
# Check quota usage in Google Cloud Console
# Review API call patterns
grep -i "youtube" backend/logs/app.log

# Solutions
# Implement request caching
# Reduce API call frequency
# Request quota increase
# Use pagination effectively
```

#### Problem: Invalid YouTube API Key

```bash
# Symptoms
400 Bad Request
API key not valid
Authentication errors

# Diagnostics
# Verify API key format
echo $YOUTUBE_API_KEY | wc -c  # Should be 39 characters

# Test API key
curl "https://www.googleapis.com/youtube/v3/search?part=snippet&q=test&key=$YOUTUBE_API_KEY"

# Solutions
# Generate new API key in Google Cloud Console
# Enable YouTube Data API v3
# Update environment variable
# Check API key restrictions
```

## Performance Issues

### Slow Response Times

#### Problem: High API Response Times

```bash
# Symptoms
API calls taking > 2 seconds
Timeout errors
Poor user experience

# Diagnostics
# Check response time metrics
curl -w "@curl-format.txt" -o /dev/null -s http://localhost:4000/api/v1/dashboard

# Monitor resource usage
top -p $(pgrep node)
iostat 1 5

# Check database performance
SELECT query, mean_time FROM pg_stat_statements ORDER BY mean_time DESC;

# Solutions
# Implement response caching
# Optimize database queries
# Add appropriate indexes
# Reduce payload size
# Enable compression
```

#### Problem: High Memory Usage

```bash
# Symptoms
Process killed by OOM
Memory usage keeps growing
Slow garbage collection

# Diagnostics
# Monitor memory usage
ps aux | grep node
node --inspect index.js  # Use Chrome DevTools

# Check for memory leaks
# Profile heap usage
# Monitor garbage collection

# Solutions
# Increase Node.js heap size
NODE_OPTIONS="--max-old-space-size=2048"

# Fix memory leaks
# Implement proper cleanup
# Use memory profiling tools
# Optimize data structures
```

### Database Performance

#### Problem: Connection Pool Exhausted

```bash
# Symptoms
Connection timeout errors
"No available connections"
Database queries hanging

# Diagnostics
# Check active connections
SELECT count(*) FROM pg_stat_activity WHERE state = 'active';

# Check pool settings
echo $DB_POOL_MAX

# Solutions
# Increase pool size
DB_POOL_MAX=20

# Implement connection cleanup
# Use connection timeouts
# Review query patterns
```

## Frontend Problems

### Build Issues

#### Problem: Next.js Build Failures

```bash
# Symptoms
Build process fails
Module not found errors
Type errors during build

# Diagnostics
# Check Node.js version
node --version  # Should be 18+

# Check package.json dependencies
npm list --depth=0

# Clear Next.js cache
rm -rf .next

# Solutions
# Update dependencies
npm update

# Clear all caches
rm -rf .next node_modules package-lock.json
npm install

# Fix TypeScript errors
npx tsc --noEmit
```

#### Problem: Runtime JavaScript Errors

```bash
# Symptoms
White screen of death
Console errors
Components not rendering

# Diagnostics
# Check browser console
# Enable React strict mode
# Use React DevTools

# Check network tab for failed requests
# Review error boundaries

# Solutions
# Add error boundaries
# Fix hydration mismatches
# Verify API endpoints
# Check environment variables
```

### CSS and Styling Issues

#### Problem: Tailwind CSS Not Working

```bash
# Symptoms
Styles not applied
Classes not recognized
Build output missing CSS

# Diagnostics
# Check tailwind.config.js
# Verify content paths
# Check PostCSS configuration

# Solutions
# Rebuild CSS
npm run build:css

# Update Tailwind configuration
# Verify purge/content settings
# Check import order
```

## Deployment Issues

### Docker Problems

#### Problem: Container Build Failures

```bash
# Symptoms
Docker build fails
Image cannot be created
Dockerfile errors

# Diagnostics
# Check Docker version
docker --version

# Build with verbose output
docker build --no-cache -t medianest .

# Check Dockerfile syntax
docker run --rm -i hadolint/hadolint < Dockerfile

# Solutions
# Fix Dockerfile syntax
# Update base image
# Check file permissions
# Verify build context
```

#### Problem: Container Runtime Issues

```bash
# Symptoms
Container exits immediately
Service unavailable
Port binding errors

# Diagnostics
# Check container logs
docker logs medianest-backend

# Check port bindings
docker ps
netstat -tlnp | grep 4000

# Check container health
docker exec -it medianest-backend sh

# Solutions
# Fix environment variables
# Check port conflicts
# Update health check
# Verify file permissions
```

### Production Deployment

#### Problem: SSL/HTTPS Issues

```bash
# Symptoms
SSL certificate errors
Mixed content warnings
Insecure connection

# Diagnostics
# Check certificate validity
openssl x509 -in cert.pem -text -noout

# Test SSL configuration
curl -I https://yourdomain.com

# Solutions
# Renew SSL certificate
# Update nginx configuration
# Fix certificate chain
# Enable HTTPS redirects
```

## Error Code Reference

### HTTP Error Codes

#### 4xx Client Errors

```yaml
400 Bad Request:
  - Invalid JSON payload
  - Missing required fields
  - Validation errors

401 Unauthorized:
  - Missing authentication token
  - Invalid JWT token
  - Expired session

403 Forbidden:
  - Insufficient permissions
  - Access denied
  - Rate limit exceeded

404 Not Found:
  - Endpoint not found
  - Resource not found
  - User not found

409 Conflict:
  - Duplicate entry
  - Resource conflict
  - Version mismatch

429 Too Many Requests:
  - Rate limit exceeded
  - API quota exceeded
  - Too many login attempts
```

#### 5xx Server Errors

```yaml
500 Internal Server Error:
  - Unhandled exception
  - Database error
  - External service error

502 Bad Gateway:
  - Upstream server error
  - Proxy configuration error
  - Service unavailable

503 Service Unavailable:
  - Database connection failed
  - External service down
  - Maintenance mode

504 Gateway Timeout:
  - Request timeout
  - Database timeout
  - External API timeout
```

### Application Error Codes

#### Custom Error Codes

```yaml
AUTH_001: Invalid credentials
AUTH_002: Account locked
AUTH_003: Password expired
AUTH_004: Token expired

DB_001: Connection failed
DB_002: Query timeout
DB_003: Constraint violation
DB_004: Migration failed

API_001: Rate limit exceeded
API_002: Invalid request format
API_003: External service error
API_004: Data validation failed
```

## Log Analysis

### Log Location Guide

#### Backend Logs

```bash
# Application logs
tail -f backend/logs/app.log
tail -f backend/logs/error.log

# PM2 logs (production)
pm2 logs medianest

# Docker logs
docker logs medianest-backend
```

#### System Logs

```bash
# Nginx logs
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log

# PostgreSQL logs
tail -f /var/log/postgresql/postgresql-14-main.log

# Redis logs
tail -f /var/log/redis/redis-server.log
```

### Log Analysis Commands

#### Common Log Patterns

```bash
# Find authentication errors
grep -i "authentication" logs/app.log | tail -20

# Find database errors
grep -i "database\|prisma" logs/app.log | tail -20

# Find API errors
grep -E "40[0-9]|50[0-9]" logs/app.log | tail -20

# Find slow queries
grep -i "slow query" logs/app.log

# Find memory issues
grep -i "memory\|heap" logs/app.log

# Get error summary
grep -i "error" logs/app.log | cut -d' ' -f4- | sort | uniq -c | sort -nr
```

### Log Analysis Tools

#### Structured Log Analysis

```bash
# Using jq for JSON logs
cat logs/app.log | jq 'select(.level == "error")'

# Filter by timestamp
cat logs/app.log | jq 'select(.timestamp > "2025-09-07T10:00:00")'

# Group by error type
cat logs/app.log | jq -r '.message' | sort | uniq -c | sort -nr
```

---

**Emergency Contact:** For critical issues affecting production, escalate immediately to the system administrator with relevant log excerpts and error codes.

**Note:** This troubleshooting guide covers the most common MediaNest issues. For complex problems not covered here, enable debug logging and gather comprehensive system information before seeking support.
