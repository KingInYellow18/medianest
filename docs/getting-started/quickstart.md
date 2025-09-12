# Quick Start Guide

Get MediaNest running locally in 5 minutes! This guide will help you set up a basic development environment quickly.

## Prerequisites Check

Before starting, verify you have:

```bash
# Check Node.js version (must be 20.x)
node --version  # Should show v20.x.x

# Check Docker installation
docker --version && docker compose version

# Check Git installation
git --version
```

If any are missing:

- **Node.js 20.x**: Download from [nodejs.org](https://nodejs.org/)
- **Docker**: Download from [docker.com](https://www.docker.com/get-started)
- **Git**: Download from [git-scm.com](https://git-scm.com/)

## 5-Minute Setup

### Step 1: Clone and Install (2 minutes)

```bash
# Clone the repository
git clone https://github.com/your-username/medianest.git
cd medianest

# Install all dependencies (this may take 1-2 minutes)
npm install

# This automatically:
# - Installs frontend dependencies
# - Installs backend dependencies
# - Sets up Git hooks
# - Installs shared package dependencies
```

### Step 2: Environment Setup (1 minute)

```bash
# Copy environment template
cp .env.example .env

# Generate secure secrets automatically
npm run generate-secrets

# The generate-secrets script creates:
# - NEXTAUTH_SECRET: For session encryption
# - ENCRYPTION_KEY: For sensitive data encryption
# - JWT_SECRET: For token signing
```

### Step 3: Database Setup (1 minute)

```bash
# Start PostgreSQL and Redis with Docker
docker compose -f docker-compose.dev.yml up -d

# Wait for services to be ready (about 30 seconds)
sleep 30

# Run database migrations
npm run db:migrate

# This creates all necessary tables and indexes
```

### Step 4: Start Development Servers (1 minute)

```bash
# Start both frontend and backend concurrently
npm run dev

# This starts:
# - Frontend: http://localhost:3000 (Next.js)
# - Backend: http://localhost:4000 (Express API)
# - WebSocket: Integrated with both servers
```

## Verify Setup

### 1. Check Services

Open these URLs in your browser:

- **Frontend**: http://localhost:3000
- **Backend Health**: http://localhost:4000/api/health
- **API Status**: http://localhost:4000/api/dashboard/status

### 2. Test Basic Functionality

1. **Homepage**: Visit http://localhost:3000
   - Should show the MediaNest landing page
   - "Login with Plex" button should be visible

2. **API Health**: Visit http://localhost:4000/api/health
   - Should return: `{"status": "healthy", "timestamp": "..."}`

3. **Database Connection**: Check logs for:
   ```
   ✓ Database connected successfully
   ✓ Redis connected successfully
   ```

### 3. Admin Bootstrap (Optional)

For testing admin features:

```bash
# Access admin bootstrap at:
http://localhost:3000/auth/signin

# Default credentials (change immediately):
Username: admin
Password: admin

# This creates the first admin user
```

## What's Running?

After successful setup:

```bash
# Check running containers
docker compose -f docker-compose.dev.yml ps

# Should show:
# - postgres (port 5432)
# - redis (port 6379)

# Check running Node processes
ps aux | grep node

# Should show:
# - Next.js frontend (port 3000)
# - Express backend (port 4000)
```

## Common Quick Fixes

### Port Already in Use

```bash
# Kill processes using ports
sudo lsof -ti:3000 | xargs kill -9
sudo lsof -ti:4000 | xargs kill -9

# Restart services
npm run dev
```

### Database Connection Issues

```bash
# Restart Docker services
docker compose -f docker-compose.dev.yml down
docker compose -f docker-compose.dev.yml up -d

# Wait and retry migration
sleep 30
npm run db:migrate
```

### Permission Issues (Linux/macOS)

```bash
# Fix file permissions
sudo chown -R $USER:$USER .
chmod +x scripts/*.sh
```

### Windows WSL2 Issues

```bash
# Update .env to use WSL2 network
echo "DATABASE_URL=postgresql://postgres:password@localhost:5432/medianest" >> .env
echo "REDIS_URL=redis://localhost:6379" >> .env
```

## Next Steps

### 1. Test External Integrations

Configure external services through the admin panel:

1. **Plex Server Setup**:
   - Go to Admin → Service Configuration
   - Add your Plex server URL
   - Test connection

2. **Overseerr Setup** (Optional):
   - Add Overseerr URL and API key
   - Test media search functionality

3. **Uptime Kuma Setup** (Optional):
   - Add monitoring URL and token
   - View service status updates

### 2. Development Workflow

Now you're ready for development:

```bash
# Run tests
npm test

# Check code quality
npm run lint
npm run type-check

# Make changes and see hot reload
# - Frontend changes: Instant reload
# - Backend changes: Automatic restart with nodemon
```

### 3. Learn the Codebase

Recommended learning path:

1. **Explore the structure**:
   - `frontend/src/app/` - Next.js App Router pages
   - `backend/src/` - Express API and services
   - `docs/` - Comprehensive documentation

2. **Key files to understand**:
   - `backend/src/app.ts` - Express server setup
   - `frontend/src/app/layout.tsx` - Root layout and providers
   - `backend/src/config/database.ts` - Database configuration

3. **Read the documentation**:
   - [Development Setup](./development-setup.md) - Detailed development guide
   - [Architecture](../ARCHITECTURE.md) - System design overview
   - [Contributing](../developers/contributing.md) - How to contribute

## Troubleshooting Quick Reference

| Issue                     | Quick Fix                                                |
| ------------------------- | -------------------------------------------------------- |
| "Port 3000 in use"        | `sudo lsof -ti:3000 \| xargs kill -9`                    |
| "Database not found"      | `npm run db:migrate`                                     |
| "Redis connection failed" | `docker compose -f docker-compose.dev.yml restart redis` |
| "Permission denied"       | `sudo chown -R $USER:$USER .`                            |
| "TypeScript errors"       | `npm run type-check`                                     |
| "Tests failing"           | `npm install && npm test`                                |

## Development Tools

### Recommended VS Code Extensions

```json
{
  "recommendations": [
    "bradlc.vscode-tailwindcss",
    "esbenp.prettier-vscode",
    "ms-vscode.vscode-typescript-next",
    "prisma.prisma",
    "ms-vscode.vscode-json"
  ]
}
```

### Useful Development Commands

```bash
# Database management
npm run db:studio          # Open Prisma Studio
npm run db:reset           # Reset database (dev only)
npm run db:backup          # Create database backup

# Testing
npm run test:watch         # Run tests in watch mode
npm run test:coverage      # Generate coverage report
npm run test:e2e           # Run end-to-end tests

# Code quality
npm run lint:fix           # Auto-fix linting issues
npm run format             # Format all code with Prettier

# Docker management
docker compose -f docker-compose.dev.yml logs -f  # Follow logs
docker compose -f docker-compose.dev.yml down -v  # Clean shutdown
```

## Ready for More?

🎉 **Congratulations!** You now have MediaNest running locally.

### Next recommended reading:

- [Development Setup Guide](./development-setup.md) - Detailed development environment
- [Development Workflow](../developers/workflow.md) - How to contribute effectively
- [API Documentation](../api/) - Understanding the API structure
- [Troubleshooting Guide](../troubleshooting/common-issues.md) - When things go wrong

### Start contributing:

1. Pick a [good first issue](https://github.com/your-repo/medianest/labels/good%20first%20issue)
2. Read the [Contributing Guidelines](../developers/contributing.md)
3. Make your first pull request!

**Need help?** Check the [Troubleshooting Guide](../troubleshooting/common-issues.md) or open an issue on GitHub.
