# Common Issues and Troubleshooting

This guide covers the most common issues you might encounter while developing, deploying, or using MediaNest, along with step-by-step solutions.

## Table of Contents

- [Development Environment Issues](#development-environment-issues)
- [Database and Migration Issues](#database-and-migration-issues)
- [Authentication and Authorization Issues](#authentication-and-authorization-issues)
- [API and Network Issues](#api-and-network-issues)
- [Frontend and UI Issues](#frontend-and-ui-issues)
- [Docker and Container Issues](#docker-and-container-issues)
- [Performance Issues](#performance-issues)
- [External Service Integration Issues](#external-service-integration-issues)
- [Build and Deployment Issues](#build-and-deployment-issues)
- [Testing Issues](#testing-issues)

## Development Environment Issues

### Node.js Version Problems

**Problem**: TypeScript compilation errors, dependency installation failures
```
Error: The engine "node" is incompatible with this module
npm ERR! peer dep missing: typescript@>=4.5.0
```

**Solution**:
```bash
# Check Node.js version
node --version

# Should be v20.x.x or higher
# Install correct version using nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 20
nvm use 20
nvm alias default 20

# Clear npm cache and reinstall
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

### Port Already in Use

**Problem**: Cannot start development servers
```
Error: listen EADDRINUSE: address already in use :::3000
Error: listen EADDRINUSE: address already in use :::4000
```

**Solution**:
```bash
# Find and kill processes using ports
sudo lsof -ti:3000 | xargs kill -9
sudo lsof -ti:4000 | xargs kill -9

# Alternative: Use different ports
PORT=3001 npm run dev:frontend
BACKEND_PORT=4001 npm run dev:backend

# Or add to .env
echo "PORT=3001" >> .env
echo "BACKEND_PORT=4001" >> .env
```

### Hot Reload Not Working

**Problem**: Changes not reflected automatically, need manual refresh

**Solution**:
```bash
# For Next.js (frontend)
# 1. Clear .next directory
rm -rf frontend/.next

# 2. Check file watching limits (Linux)
echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf
sudo sysctl -p

# 3. Restart development server
npm run dev

# For backend (nodemon)
# Check nodemon configuration in package.json
# Ensure file patterns are correct:
{
  "nodemon": {
    "watch": ["src"],
    "ext": "ts,js,json",
    "ignore": ["src/**/*.test.ts"],
    "exec": "tsx src/server.ts"
  }
}
```

### Environment Variables Not Loading

**Problem**: Configuration not working, services failing to connect

**Solution**:
```bash
# 1. Verify .env file exists and has correct format
ls -la .env
cat .env

# 2. Check for extra spaces or quotes
# ✅ Correct format:
DATABASE_URL=postgresql://user:pass@localhost:5432/medianest
# ❌ Incorrect format:
DATABASE_URL = "postgresql://user:pass@localhost:5432/medianest"

# 3. Regenerate secrets if needed
npm run generate-secrets

# 4. Restart development servers
npm run dev
```

## Database and Migration Issues

### Database Connection Failures

**Problem**: Cannot connect to PostgreSQL database
```
Error: connect ECONNREFUSED 127.0.0.1:5432
PrismaClientInitializationError: Can't reach database server
```

**Solution**:
```bash
# 1. Check if PostgreSQL is running
docker compose -f docker-compose.dev.yml ps postgres

# 2. Start database if not running
docker compose -f docker-compose.dev.yml up -d postgres

# 3. Check database logs
docker compose -f docker-compose.dev.yml logs postgres

# 4. Verify connection string
echo $DATABASE_URL
# Should be: postgresql://postgres:password@localhost:5432/medianest

# 5. Test connection manually
psql postgresql://postgres:password@localhost:5432/medianest -c "SELECT 1"

# 6. Reset database if corrupted
docker compose -f docker-compose.dev.yml down -v
docker compose -f docker-compose.dev.yml up -d postgres
sleep 10
npm run db:migrate
```

### Migration Failures

**Problem**: Prisma migrations fail or get stuck
```
Error: P3018: A migration failed to apply. New migrations cannot be applied before the error is recovered from.
```

**Solution**:
```bash
# 1. Check migration status
cd backend
npx prisma migrate status

# 2. Reset development database (DEVELOPMENT ONLY)
npx prisma migrate reset
npx prisma generate

# 3. For production, rollback problematic migration
npx prisma migrate rollback

# 4. Fix migration file and reapply
npx prisma migrate dev --name fix_migration_issue

# 5. If migration table is corrupted (last resort)
# DANGER: Only for development
docker compose -f docker-compose.dev.yml down -v
docker compose -f docker-compose.dev.yml up -d postgres
npm run db:migrate
```

### Prisma Client Out of Sync

**Problem**: TypeScript errors about missing Prisma types
```
Type 'User' does not exist
Property 'findUnique' does not exist on type 'UserDelegate'
```

**Solution**:
```bash
# 1. Regenerate Prisma client
cd backend
npx prisma generate

# 2. Clear TypeScript cache
npx tsc --build --clean

# 3. Restart TypeScript service in VS Code
# Command Palette: "TypeScript: Restart TS Server"

# 4. If still failing, check schema.prisma for syntax errors
npx prisma validate

# 5. Restart development server
npm run dev
```

## Authentication and Authorization Issues

### Plex OAuth Login Fails

**Problem**: "Login with Plex" button doesn't work, PIN flow fails

**Solution**:
```bash
# 1. Verify Plex OAuth configuration
echo $PLEX_CLIENT_ID
echo $PLEX_CLIENT_SECRET

# 2. Check if redirect URI is correctly configured in Plex app settings
# Should be: http://localhost:3000/api/auth/callback/plex

# 3. Test Plex API connectivity
curl -X POST https://plex.tv/pins.xml \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "strong=true"

# 4. Check backend logs for OAuth errors
# Look for "plex oauth" in console output

# 5. Verify NextAuth configuration
# Check frontend/src/lib/auth/nextauth.config.ts
```

### Session Management Issues

**Problem**: Users getting logged out frequently, "Unauthorized" errors

**Solution**:
```bash
# 1. Check JWT secret configuration
echo $NEXTAUTH_SECRET
echo $JWT_SECRET

# 2. Verify session duration settings
# Check backend/src/config/auth.ts

# 3. Clear existing sessions
redis-cli flushdb

# 4. Check for clock skew between services
date

# 5. Monitor JWT token validation
DEBUG="nextauth:*" npm run dev
```

### Permission Denied Errors

**Problem**: Users cannot access resources they should have access to

**Solution**:
```bash
# 1. Check user roles in database
# Connect to database and verify user role:
psql $DATABASE_URL -c "SELECT id, plex_username, role FROM users;"

# 2. Verify middleware configuration
# Check backend/src/middleware/auth.ts

# 3. Test API endpoints manually
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     http://localhost:4000/api/admin/users

# 4. Check CORS configuration for frontend
# Verify CORS_ORIGIN in backend environment
```

## API and Network Issues

### CORS Errors

**Problem**: Frontend cannot connect to backend API
```
Access to fetch at 'http://localhost:4000/api/health' from origin 'http://localhost:3000' has been blocked by CORS policy
```

**Solution**:
```bash
# 1. Check CORS configuration in backend
# File: backend/src/app.ts
# Verify CORS origin includes frontend URL

# 2. Update environment variables
echo "FRONTEND_URL=http://localhost:3000" >> backend/.env

# 3. Restart backend server
cd backend && npm run dev

# 4. For production, ensure proper domain configuration
FRONTEND_URL=https://your-domain.com
CORS_ORIGIN=https://your-domain.com
```

### API Endpoints Not Found

**Problem**: 404 errors when calling API endpoints

**Solution**:
```bash
# 1. Verify API endpoint registration
# Check backend/src/routes/index.ts

# 2. Test backend directly
curl http://localhost:4000/api/health

# 3. Check route definitions
grep -r "router.get\|router.post" backend/src/routes/

# 4. Verify Express server configuration
# Check backend/src/server.ts for route mounting

# 5. Check for URL encoding issues
# Ensure special characters are properly encoded
```

### Slow API Response Times

**Problem**: API calls taking too long to respond

**Solution**:
```bash
# 1. Check database query performance
# Enable Prisma query logging
DEBUG="prisma:query" npm run dev

# 2. Monitor database connections
# Check for connection pool exhaustion
docker compose -f docker-compose.dev.yml logs postgres | grep "connection"

# 3. Check external service response times
# Monitor calls to Plex, Overseerr, etc.
curl -w "%{time_total}" -o /dev/null -s http://your-plex-server/

# 4. Review caching configuration
# Check Redis connectivity and cache hit rates
redis-cli info stats

# 5. Profile API endpoints
# Use built-in performance monitoring
npm run dev:profile
```

## Frontend and UI Issues

### Next.js Build Failures

**Problem**: Frontend fails to build or start
```
Error: Cannot find module 'next/dynamic'
TypeError: Cannot read property 'pathname' of undefined
```

**Solution**:
```bash
# 1. Clear Next.js cache
rm -rf frontend/.next
rm -rf frontend/node_modules/.cache

# 2. Reinstall dependencies
cd frontend
rm package-lock.json
npm install

# 3. Check Next.js configuration
# Verify frontend/next.config.js syntax

# 4. Update Next.js if needed
npm install next@latest

# 5. Check for TypeScript errors
npm run type-check
```

### WebSocket Connection Issues

**Problem**: Real-time updates not working, WebSocket connection fails

**Solution**:
```bash
# 1. Check WebSocket server configuration
# Verify backend/src/socket/index.ts

# 2. Test WebSocket connection manually
# In browser console:
const socket = io('http://localhost:4000');
socket.on('connect', () => console.log('Connected'));

# 3. Check firewall and proxy settings
# Ensure WebSocket traffic is allowed

# 4. Verify Socket.io client/server version compatibility
npm list socket.io socket.io-client

# 5. Check authentication for WebSocket
# Verify JWT token is passed correctly
```

### React Hydration Errors

**Problem**: Hydration mismatches between server and client
```
Warning: Text content did not match. Server: "..." Client: "..."
Error: Hydration failed because the initial UI does not match what was rendered on the server
```

**Solution**:
```bash
# 1. Check for dynamic content that differs between server/client
# Look for Date(), Math.random(), etc.

# 2. Use dynamic imports for client-only components
import dynamic from 'next/dynamic';
const ClientOnlyComponent = dynamic(() => import('./ClientOnlyComponent'), {
  ssr: false
});

# 3. Check for localStorage/sessionStorage usage
# Only access these in useEffect hooks

# 4. Verify environment variables
# Ensure same values on server and client

# 5. Clear browser cache and restart
rm -rf frontend/.next
npm run dev
```

## Docker and Container Issues

### Container Build Failures

**Problem**: Docker images fail to build
```
Error: failed to solve: process "/bin/sh -c npm install" did not complete successfully
```

**Solution**:
```bash
# 1. Check Dockerfile syntax
docker build -f Dockerfile --no-cache .

# 2. Verify base image is accessible
docker pull node:20-alpine

# 3. Check for networking issues during build
docker build --network=host .

# 4. Clear Docker cache
docker system prune -a

# 5. Check disk space
df -h

# 6. Use .dockerignore to reduce build context
echo "node_modules\n.git\n.next" >> .dockerignore
```

### Container Startup Issues

**Problem**: Containers exit immediately or fail health checks

**Solution**:
```bash
# 1. Check container logs
docker compose -f docker-compose.dev.yml logs postgres
docker compose -f docker-compose.dev.yml logs redis

# 2. Verify environment variables
docker compose -f docker-compose.dev.yml config

# 3. Check port conflicts
docker port medianest_postgres_1

# 4. Inspect container health
docker inspect medianest_postgres_1 | grep -A 10 "Health"

# 5. Debug container interactively
docker run -it postgres:15-alpine sh

# 6. Check resource limits
docker stats
```

### Volume Mount Issues

**Problem**: Data not persisting, file permission errors

**Solution**:
```bash
# 1. Check volume configuration
docker compose -f docker-compose.dev.yml config | grep -A 5 "volumes"

# 2. Fix file permissions
sudo chown -R $USER:$USER ./data
chmod -R 755 ./data

# 3. Use named volumes instead of bind mounts
# Update docker-compose.dev.yml:
volumes:
  postgres_data:
  redis_data:

# 4. Check volume disk usage
docker system df

# 5. Clean up unused volumes
docker volume prune
```

## Performance Issues

### High Memory Usage

**Problem**: Application consuming too much RAM

**Solution**:
```bash
# 1. Monitor memory usage
npm run dev:memory
top -p $(pgrep node)

# 2. Check for memory leaks
node --inspect --max-old-space-size=4096 backend/src/server.ts
# Open Chrome DevTools -> Memory tab

# 3. Optimize database connections
# Check connection pool settings in DATABASE_URL
DATABASE_URL="postgresql://user:pass@localhost:5432/db?connection_limit=5"

# 4. Review cache configuration
# Check Redis memory usage
redis-cli info memory

# 5. Analyze bundle size (frontend)
npm run analyze
```

### Slow Page Loads

**Problem**: Frontend pages loading slowly

**Solution**:
```bash
# 1. Analyze bundle size
cd frontend
npm run build
npm run analyze

# 2. Check for large dependencies
npx bundle-analyzer

# 3. Enable compression
# Verify gzip compression in nginx.conf

# 4. Optimize images
# Use next/image component
# Compress images before upload

# 5. Profile React rendering
# Use React DevTools Profiler
# Check for unnecessary re-renders
```

### Database Query Performance

**Problem**: Slow database queries, high CPU usage

**Solution**:
```bash
# 1. Enable query logging
DEBUG="prisma:query" npm run dev

# 2. Analyze slow queries
# Check PostgreSQL logs for slow queries
docker compose -f docker-compose.dev.yml logs postgres | grep "slow"

# 3. Add database indexes
# Update schema.prisma with appropriate indexes:
model User {
  @@index([plexId])
  @@index([role, status])
}

# 4. Optimize Prisma queries
# Use select and include carefully
const user = await prisma.user.findUnique({
  where: { id },
  select: { id: true, username: true, role: true }
});

# 5. Monitor connection pool
# Check for connection exhaustion
```

## External Service Integration Issues

### Plex Server Connection Problems

**Problem**: Cannot connect to Plex server, timeout errors

**Solution**:
```bash
# 1. Test direct connection to Plex
curl -I http://your-plex-server:32400/web

# 2. Check Plex token validity
curl "http://your-plex-server:32400/library/sections?X-Plex-Token=YOUR_TOKEN"

# 3. Verify network accessibility
ping your-plex-server
telnet your-plex-server 32400

# 4. Check Plex server settings
# Ensure "List of IP addresses and networks that are allowed without auth"
# includes your MediaNest server IP

# 5. Update Plex client configuration
# File: backend/src/integrations/plex/plex.client.ts
# Adjust timeout and retry settings
```

### Overseerr Integration Issues

**Problem**: Media search not working, request submission fails

**Solution**:
```bash
# 1. Test Overseerr API directly
curl -H "X-Api-Key: YOUR_API_KEY" \
     "http://your-overseerr:5055/api/v1/search?query=inception"

# 2. Check API key validity
# Login to Overseerr -> Settings -> General -> API Key

# 3. Verify service URL configuration
echo $OVERSEERR_URL
echo $OVERSEERR_API_KEY

# 4. Check Overseerr logs
docker logs overseerr

# 5. Test network connectivity
curl -I http://your-overseerr:5055
```

### Uptime Kuma Integration Issues

**Problem**: Service monitoring not working, WebSocket connection fails

**Solution**:
```bash
# 1. Test Uptime Kuma connectivity
curl http://your-uptime-kuma:3001

# 2. Check WebSocket connection
# Use browser dev tools to monitor WS connections

# 3. Verify authentication token
# Get token from Uptime Kuma settings

# 4. Check Uptime Kuma configuration
# Ensure API is enabled
# Verify token permissions

# 5. Test alternative monitoring method
# Fall back to HTTP polling if WebSocket fails
```

## Build and Deployment Issues

### Production Build Failures

**Problem**: Build process fails in production environment

**Solution**:
```bash
# 1. Check Node.js version in production
node --version
# Should match development version

# 2. Set correct environment
NODE_ENV=production npm run build

# 3. Check memory limits
node --max-old-space-size=4096 node_modules/.bin/next build

# 4. Verify all environment variables
printenv | grep -E "(DATABASE|REDIS|NEXTAUTH|PLEX)"

# 5. Check for missing dependencies
npm ci --only=production

# 6. Test build locally first
npm run build:prod
npm run start:prod
```

### Docker Production Issues

**Problem**: Production containers failing or behaving differently

**Solution**:
```bash
# 1. Compare development and production configurations
diff docker-compose.dev.yml docker-compose.yml

# 2. Check environment variable differences
docker compose config

# 3. Verify secrets management
docker secret ls
docker config ls

# 4. Test production build locally
docker compose build --no-cache
docker compose up -d

# 5. Check resource limits
docker stats
docker inspect container_name | grep -A 10 "Resources"
```

### SSL/TLS Certificate Issues

**Problem**: HTTPS not working, certificate errors

**Solution**:
```bash
# 1. Check certificate validity
openssl x509 -in /path/to/cert.pem -text -noout
curl -I https://your-domain.com

# 2. Verify nginx configuration
nginx -t
nginx -s reload

# 3. Check certificate renewal (Let's Encrypt)
certbot certificates
certbot renew --dry-run

# 4. Test SSL configuration
ssllabs.com/ssltest/analyze.html?d=your-domain.com

# 5. Check certificate chain
openssl s_client -connect your-domain.com:443 -showcerts
```

## Testing Issues

### Test Database Issues

**Problem**: Tests failing due to database state or connection issues

**Solution**:
```bash
# 1. Ensure test database is isolated
# Check DATABASE_URL in test environment
echo $DATABASE_URL_TEST

# 2. Reset test database
npm run test:setup
npm run test:teardown
npm run test:setup

# 3. Check for test data contamination
# Use transactions or database cleanup between tests
beforeEach(async () => {
  await testDb.cleanup();
});

# 4. Verify test database schema
cd backend
npx prisma migrate status --schema=prisma/schema.prisma

# 5. Check for async test issues
# Ensure all async operations are properly awaited
test('async operation', async () => {
  await expect(asyncFunction()).resolves.toBe(expected);
});
```

### Flaky Test Issues

**Problem**: Tests passing/failing inconsistently

**Solution**:
```bash
# 1. Identify timing issues
# Add proper waits in tests
await waitFor(() => expect(element).toBeInTheDocument());

# 2. Mock external dependencies
jest.mock('../services/external-api');

# 3. Use deterministic test data
// Instead of Math.random()
const testData = {
  id: 'test-user-1',
  name: 'Test User',
  createdAt: new Date('2024-01-01')
};

# 4. Increase test timeouts if needed
jest.setTimeout(10000);

# 5. Run tests multiple times to identify patterns
npm test -- --runInBand --repeat=10
```

### E2E Test Failures

**Problem**: Playwright tests failing or timing out

**Solution**:
```bash
# 1. Check browser installation
npx playwright install

# 2. Run with UI to debug
npm run test:e2e:ui

# 3. Increase timeouts for slow operations
test.setTimeout(60000);

# 4. Use proper selectors
// Instead of brittle text selectors
page.locator('[data-testid="login-button"]')

# 5. Wait for network completion
await page.waitForLoadState('networkidle');

# 6. Take screenshots for debugging
await page.screenshot({ path: 'debug.png', fullPage: true });
```

## Getting Additional Help

### Debug Information Collection

When reporting issues, collect this information:

```bash
# System information
echo "Node.js: $(node --version)"
echo "npm: $(npm --version)"
echo "Docker: $(docker --version)"
echo "OS: $(uname -a)"

# Application status
npm run health-check || echo "Health check failed"

# Service status
docker compose -f docker-compose.dev.yml ps

# Logs (last 50 lines)
docker compose -f docker-compose.dev.yml logs --tail=50
npm run dev 2>&1 | tail -50

# Environment variables (sanitized)
printenv | grep -E "(NODE_ENV|DATABASE_URL|REDIS_URL)" | sed 's/password:[^@]*@/password:***@/g'
```

### Log Locations

Important log files and commands:

```bash
# Application logs
tail -f backend/logs/app.log
tail -f backend/logs/error.log

# Docker logs
docker compose -f docker-compose.dev.yml logs -f postgres
docker compose -f docker-compose.dev.yml logs -f redis

# System logs (Linux)
sudo journalctl -u docker -f
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# Browser console (for frontend issues)
# F12 -> Console tab -> Look for errors
```

### Community Resources

- **GitHub Issues**: [Repository Issues](https://github.com/your-repo/medianest/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-repo/medianest/discussions)
- **Documentation**: [Full Documentation](../index.md)
- **Development Guide**: [Development Setup](../getting-started/development-setup.md)

When reporting issues:
1. Search existing issues first
2. Use appropriate issue templates
3. Include reproduction steps
4. Provide system information
5. Include relevant logs and error messages
6. Describe expected vs actual behavior

Remember: The development community is here to help! Don't hesitate to ask questions or report issues.