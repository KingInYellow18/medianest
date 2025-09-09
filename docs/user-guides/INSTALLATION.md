# MediaNest Installation Guide

**Version:** 4.0 - Optimized Installation  
**Last Updated:** September 7, 2025  
**Target:** Development and Production Setup

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Development Setup](#development-setup)
3. [Production Installation](#production-installation)
4. [Environment Configuration](#environment-configuration)
5. [Database Setup](#database-setup)
6. [External Service Configuration](#external-service-configuration)
7. [Verification](#verification)
8. [Troubleshooting](#troubleshooting)

## Prerequisites

### System Requirements

- **Node.js:** 18.0.0 or higher
- **PostgreSQL:** 14.0 or higher
- **Redis:** 6.2 or higher
- **Docker:** 24.0 or higher (optional but recommended)
- **Git:** Latest version

### Hardware Requirements

- **RAM:** Minimum 4GB, Recommended 8GB
- **Storage:** Minimum 10GB free space
- **CPU:** Modern multi-core processor
- **Network:** Internet connection for external API access

### External Services

- **Plex Media Server:** Access to a running Plex server
- **YouTube API:** Google Cloud account with YouTube Data API v3 enabled

## Development Setup

### 1. Clone Repository

```bash
git clone https://github.com/yourusername/medianest.git
cd medianest
```

### 2. Install Dependencies

```bash
# Root dependencies
npm install

# Backend dependencies
cd backend
npm install

# Frontend dependencies
cd ../frontend
npm install
```

### 3. Environment Setup

```bash
# Copy environment templates
cp .env.development.example .env.development
cp backend/.env.example backend/.env
cp frontend/.env.local.example frontend/.env.local
```

### 4. Configure Environment Variables

Edit the `.env` files with your configuration:

**Backend (.env):**

```env
# Database
DATABASE_URL="postgresql://user:pass@localhost:5432/medianest_dev"
REDIS_URL="redis://localhost:6379"

# JWT Configuration
JWT_SECRET="your-secure-jwt-secret-256-bit-minimum"
JWT_REFRESH_SECRET="your-secure-refresh-secret-256-bit-minimum"

# External APIs
PLEX_SERVER_URL="http://your-plex-server:32400"
YOUTUBE_API_KEY="your-youtube-api-key"

# Application
NODE_ENV="development"
PORT=4000
FRONTEND_URL="http://localhost:3000"
```

**Frontend (.env.local):**

```env
NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1
NEXT_PUBLIC_PLEX_SERVER_URL=http://your-plex-server:32400
```

### 5. Database Setup

```bash
cd backend

# Run database migrations
npx prisma migrate dev

# Seed database with initial data (optional)
npx prisma db seed
```

### 6. Start Development Servers

```bash
# Terminal 1: Start backend
cd backend
npm run dev

# Terminal 2: Start frontend
cd frontend
npm run dev

# Terminal 3: Start Redis (if not using Docker)
redis-server
```

### 7. Verify Installation

- Backend API: http://localhost:4000/api/v1/health
- Frontend: http://localhost:3000
- Login with default admin credentials (if seeded)

## Production Installation

### Option 1: Docker Compose (Recommended)

```bash
# Production environment setup
cp .env.production.example .env.production

# Configure production environment variables
nano .env.production

# Start services
docker-compose -f docker-compose.prod.yml up -d

# Run database migrations
docker-compose exec backend npx prisma migrate deploy
```

### Option 2: Manual Installation

```bash
# Install PM2 for process management
npm install -g pm2

# Build applications
npm run build:backend
npm run build:frontend

# Start services with PM2
pm2 start ecosystem.config.js

# Setup nginx (see DEPLOYMENT.md for configuration)
sudo nginx -t && sudo systemctl reload nginx
```

## Environment Configuration

### Required Environment Variables

#### Backend Configuration

```env
# Core Settings
NODE_ENV=production
PORT=4000
FRONTEND_URL=https://yourdomain.com

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/medianest_prod
REDIS_URL=redis://localhost:6379

# Security
JWT_SECRET=your-production-jwt-secret-256-bit-minimum
JWT_REFRESH_SECRET=your-production-refresh-secret-256-bit-minimum
CSRF_SECRET=your-csrf-secret-32-characters-minimum

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# External Services
PLEX_SERVER_URL=http://your-plex-server:32400
YOUTUBE_API_KEY=your-youtube-api-key

# Monitoring
PROMETHEUS_PORT=9090
```

#### Frontend Configuration

```env
NEXT_PUBLIC_API_URL=https://yourdomain.com/api/v1
NEXT_PUBLIC_PLEX_SERVER_URL=http://your-plex-server:32400
NEXT_PUBLIC_ENV=production
```

### Security Configuration

#### Generate Secure Secrets

```bash
# Generate JWT secrets (use different values)
openssl rand -hex 32
openssl rand -hex 32

# Generate CSRF secret
openssl rand -hex 16
```

#### SSL/TLS Setup

- Obtain SSL certificates (Let's Encrypt recommended)
- Configure nginx with SSL (see DEPLOYMENT.md)
- Enable HTTPS redirects

## Database Setup

### PostgreSQL Installation

#### Ubuntu/Debian

```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

#### macOS (Homebrew)

```bash
brew install postgresql
brew services start postgresql
```

### Database Configuration

```bash
# Connect to PostgreSQL
sudo -u postgres psql

# Create database and user
CREATE DATABASE medianest_prod;
CREATE USER medianest_user WITH PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE medianest_prod TO medianest_user;
\q
```

### Run Migrations

```bash
cd backend
npx prisma migrate deploy
npx prisma generate
```

## External Service Configuration

### Plex Media Server Setup

1. **Enable Remote Access** in Plex settings
2. **Create Plex Token:**

   - Log into Plex Web App
   - Navigate to Settings → Account
   - Generate authentication token
   - Add to environment variables

3. **Configure Network Access:**
   - Ensure MediaNest can reach Plex server
   - Configure firewall rules if necessary

### YouTube API Setup

1. **Create Google Cloud Project:**

   - Visit Google Cloud Console
   - Create new project or select existing
   - Enable YouTube Data API v3

2. **Generate API Key:**

   - Navigate to Credentials
   - Create API Key
   - Restrict key to YouTube Data API v3
   - Add to environment variables

3. **Configure Quotas:**
   - Monitor API usage in Google Cloud Console
   - Set up billing alerts if necessary

### Redis Configuration

#### Installation

```bash
# Ubuntu/Debian
sudo apt install redis-server

# macOS
brew install redis

# Docker
docker run -d --name redis -p 6379:6379 redis:alpine
```

#### Configuration

```bash
# Edit Redis configuration
sudo nano /etc/redis/redis.conf

# Key settings:
maxmemory 256mb
maxmemory-policy allkeys-lru
```

## Verification

### Health Checks

```bash
# Backend health check
curl http://localhost:4000/api/v1/health

# Database connectivity
curl http://localhost:4000/api/v1/health/database

# External services
curl http://localhost:4000/api/v1/health/services
```

### Functional Testing

1. **Authentication:** Try logging in with admin credentials
2. **Plex Integration:** Verify Plex server connection
3. **YouTube Integration:** Test YouTube search functionality
4. **Dashboard:** Check media statistics display

## Troubleshooting

### Common Issues

#### Database Connection Errors

```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Test connection
psql -h localhost -U medianest_user -d medianest_prod

# Check environment variables
echo $DATABASE_URL
```

#### Redis Connection Issues

```bash
# Check Redis status
redis-cli ping

# Check Redis configuration
redis-cli config get "*"
```

#### Build Failures

```bash
# Clear npm cache
npm cache clean --force

# Remove node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Check Node.js version
node --version
```

#### Port Conflicts

```bash
# Check port usage
lsof -i :4000
lsof -i :3000

# Kill processes if necessary
kill -9 <PID>
```

### Log Analysis

```bash
# Backend logs
tail -f backend/logs/app.log

# PM2 logs (production)
pm2 logs

# Docker logs
docker-compose logs -f
```

### Getting Help

1. Check the [Troubleshooting Guide](TROUBLESHOOTING.md)
2. Review application logs for error messages
3. Verify all environment variables are set correctly
4. Ensure all external services are accessible

## Next Steps

After successful installation:

1. Review [Configuration Guide](CONFIGURATION.md) for advanced settings
2. Set up monitoring using [Monitoring Guide](MONITORING.md)
3. Review [Security Guide](SECURITY.md) for hardening recommendations
4. Configure backups and disaster recovery procedures

---

**Note:** This installation guide assumes a standard setup. Adjust configurations based on your specific infrastructure and requirements.
