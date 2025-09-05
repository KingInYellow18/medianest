# Docker Security Configuration Notice

## 🚨 CRITICAL: Required Environment Variables

Before deploying to production, you MUST set these environment variables:

```bash
# Generate these securely:
export POSTGRES_PASSWORD=$(openssl rand -base64 32)
export NEXTAUTH_SECRET=$(openssl rand -hex 32)
export JWT_SECRET=$(openssl rand -hex 32)
export ENCRYPTION_KEY=$(openssl rand -hex 32)

# Set your Plex OAuth credentials
export PLEX_CLIENT_ID="your-plex-client-id"
export PLEX_CLIENT_SECRET="your-plex-client-secret"
```

## Security Features Implemented

### ✅ Resolved Critical Issues
1. **Removed legacy architecture files**: Deleted Python/Flask and React Dockerfiles that didn't match Node.js/Express/Next.js architecture
2. **Docker Compose v2 compatibility**: Removed deprecated `version: '3.8'` declarations
3. **Secured database access**: Removed public port exposure for PostgreSQL (5432) and Redis (6379) in production
4. **Environment variable security**: All sensitive credentials now use environment variables instead of hardcoded values
5. **Added .dockerignore files**: Prevents secrets and development files from leaking into Docker images

### ✅ Security Configurations
- **Non-root user**: All containers run as user `nodejs` (UID 1000)
- **Internal networking**: Database services only accessible within Docker network
- **Health checks**: Comprehensive health monitoring for all services
- **Minimal attack surface**: Alpine Linux base images with only required packages

### ✅ Development vs Production
- **Development**: Database ports exposed for debugging (`docker-compose.dev.yml`)
- **Production**: Database ports internal only (`docker-compose.yml`)

## Deployment Commands

### Production Deployment
```bash
# Create .env file from template
cp .env.example .env
# Edit .env with your actual values
nano .env

# Deploy with Docker Compose v2
docker compose up -d
```

### Development Environment
```bash
# Start only database services for local development
docker compose -f docker-compose.dev.yml up -d

# Or run full stack with exposed database ports
POSTGRES_PASSWORD=dev_password docker compose -f docker-compose.dev.yml up -d
```

## Validation Checklist

- [ ] All environment variables set in `.env` file
- [ ] No hardcoded credentials in compose files
- [ ] Database ports not exposed in production
- [ ] Health checks responding correctly
- [ ] Non-root user configured
- [ ] .dockerignore preventing secrets leakage

## Emergency Security Updates

If you suspect a security breach:

1. **Rotate all secrets immediately**:
   ```bash
   # Generate new secrets
   export POSTGRES_PASSWORD=$(openssl rand -base64 32)
   export NEXTAUTH_SECRET=$(openssl rand -hex 32)
   export JWT_SECRET=$(openssl rand -hex 32)
   export ENCRYPTION_KEY=$(openssl rand -hex 32)
   ```

2. **Restart all services**:
   ```bash
   docker compose down
   docker compose up -d
   ```

3. **Check for unauthorized access**:
   ```bash
   docker compose logs app
   docker compose logs postgres
   ```

## Monitoring

Monitor these endpoints for health:
- Application: `http://localhost:4000/api/health`
- Container health: `docker compose ps`
- Logs: `docker compose logs -f`