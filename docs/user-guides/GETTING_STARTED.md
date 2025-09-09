# MediaNest Getting Started Guide

**Version:** 2.0  
**Date:** September 2025  
**Status:** Active - Post-Cleanup Version  
**Build Status:** ⚠️ Mostly Working (Minor TypeScript Issues Remain)

## What is MediaNest?

MediaNest is a unified web portal for managing Plex media servers and related services. It provides:

- **Centralized Dashboard**: Single interface for all your media services
- **Plex Integration**: Browse and manage your Plex media library
- **Service Monitoring**: Track status of external services (Overseerr, Uptime Kuma)
- **User Management**: Secure authentication and user isolation
- **Real-time Updates**: Live status updates via WebSocket connections

## Current Status (Honest Assessment)

**Good News**: The project has undergone massive cleanup and technical debt elimination:
- ✅ **82% file reduction** completed (from 51,480+ to ~9,332 files)
- ✅ **Major security improvements** implemented
- ✅ **TypeScript compilation** mostly fixed (was 122+ errors, now ~6 minor issues)
- ✅ **Test suite** operational (most tests passing)
- ✅ **Docker builds** working correctly

**Current Issues**: 
- ⚠️ **6 minor TypeScript errors** remaining (non-blocking, mostly type mismatches)
- ⚠️ **Next.js security update needed** (can be updated separately)
- ⚠️ **Some integration tests failing** (28/30 pass)

**Bottom Line**: MediaNest is **significantly improved** and **largely functional** for development and testing.

## Prerequisites

### System Requirements
- **Node.js**: 20.x or higher (currently tested with v22.17.0)
- **npm**: 8.0+ (currently tested with v11.5.2)
- **Docker**: Latest stable version with Docker Compose V2
- **PostgreSQL**: 15.x (for local development or via Docker)
- **Redis**: 7.x (for caching, optional but recommended)

### Hardware Requirements
- **RAM**: Minimum 4GB, Recommended 8GB
- **Storage**: 10GB free space (after cleanup, much less storage needed)
- **CPU**: 2+ cores recommended

### External Services (Optional)
- **Plex Media Server**: For media management functionality
- **Overseerr**: For media request management
- **Uptime Kuma**: For service monitoring

## Quick Start Installation

### Option 1: Docker (Recommended for Users)

**Best for**: Quick setup, production-like environment

```bash
# 1. Clone the repository
git clone <your-repository-url>
cd medianest

# 2. Copy and configure environment
cp .env.example .env
# Edit .env with your settings (see Configuration Guide)

# 3. Start all services
npm run docker:up

# 4. Check status
npm run docker:logs

# 5. Access MediaNest
# Open http://localhost:3000 in your browser
```

**Expected Results**:
- ✅ Services should start successfully
- ✅ Frontend accessible at http://localhost:3000
- ✅ Backend API at http://localhost:4000
- ⚠️ Some TypeScript warnings in logs (non-blocking)

### Option 2: Development Setup

**Best for**: Contributing to the project, customization

```bash
# 1. Clone the repository
git clone <your-repository-url>
cd medianest

# 2. Install dependencies (root level)
npm install

# 3. Install workspace dependencies
cd backend && npm install && cd ..
cd frontend && npm install --legacy-peer-deps && cd ..
cd shared && npm install && cd ..

# 4. Set up environment files
cp .env.example .env
cp frontend/.env.example frontend/.env.local

# 5. Configure your environment variables
# Edit both .env files with your settings

# 6. Set up database (if running locally)
npm run db:migrate

# 7. Start development servers
npm run dev
```

**Expected Results**:
- ✅ Backend should start on port 4000
- ✅ Frontend should start on port 3000  
- ⚠️ ~6 TypeScript warnings (development continues to work)
- ✅ Hot reloading functional

## Configuration

### Required Environment Variables

Edit your `.env` file with these required settings:

```bash
# Security (Generate strong secrets!)
JWT_SECRET=your-super-secure-jwt-secret-here
ENCRYPTION_KEY=your-encryption-key-here

# Database
DATABASE_URL=postgresql://medianest:medianest@localhost:5432/medianest

# Basic Settings
NODE_ENV=development
PORT=3000
FRONTEND_URL=http://localhost:3000
```

### Generate Secure Secrets

```bash
# Generate JWT secret (32+ characters)
openssl rand -base64 32

# Generate encryption key (32+ characters)  
openssl rand -base64 32
```

### Frontend Configuration

Edit `frontend/.env.local`:

```bash
# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-nextauth-secret-here

# Plex OAuth (get from Plex)
AUTH_PLEX_CLIENT_ID=MediaNest
PLEX_CLIENT_IDENTIFIER=your-unique-uuid-here

# API Connection
NEXT_PUBLIC_API_URL=http://localhost:4000
```

## First Run Verification

### Health Checks

Once services are running, verify everything works:

```bash
# Check backend health
curl http://localhost:4000/api/health
# Expected: {"status":"ok","timestamp":"...","version":"2.0.0"}

# Check frontend (open in browser)
# http://localhost:3000
# Expected: MediaNest login screen

# Check database connection (if running locally)
npm run db:check
# Expected: Connection successful
```

### Initial Setup

1. **Access MediaNest**: Open http://localhost:3000
2. **First Login**: Use admin credentials if configured, or set up Plex OAuth
3. **Configuration**: Navigate to Settings to configure integrations
4. **Test Integration**: Try browsing your Plex library (if configured)

## Common First-Run Issues

### TypeScript Warnings
**Issue**: You see TypeScript compilation warnings during startup
**Status**: ⚠️ Expected - 6 minor issues remain
**Impact**: None - application functions normally
**Solution**: Can be ignored for now, fixes planned

### Dependency Resolution
**Issue**: npm install fails with peer dependency warnings
**Solution**: Use `npm install --legacy-peer-deps` for frontend

### Port Conflicts
**Issue**: Port 3000 or 4000 already in use
**Solution**: 
- Check what's using the ports: `lsof -i :3000`
- Change ports in .env file if needed
- Stop conflicting services

### Database Connection
**Issue**: Cannot connect to PostgreSQL
**Check**:
1. PostgreSQL is running
2. Database exists: `createdb medianest`
3. User has permissions
4. Connection string is correct

### Docker Issues
**Issue**: Docker services fail to start
**Solutions**:
```bash
# Check Docker status
docker --version
docker-compose --version

# View detailed logs
docker-compose logs backend
docker-compose logs frontend

# Rebuild if needed
docker-compose build --no-cache
```

## Next Steps

### For Users
1. **Complete Setup**: Configure your Plex server and other integrations
2. **Explore Features**: Browse the dashboard and try media browsing
3. **Read User Guide**: See `/docs/user-guides/USER_INTERFACE.md`
4. **Report Issues**: Use GitHub Issues for any problems

### For Developers
1. **Read Development Guide**: See `/docs/user-guides/DEVELOPMENT.md`
2. **Review Architecture**: See `/docs/ARCHITECTURE.md`
3. **Run Tests**: See `/docs/user-guides/TESTING.md`
4. **Contributing**: See `/docs/CONTRIBUTING.md`

## Support

### Getting Help
- **Documentation**: Check `/docs` folder for detailed guides
- **GitHub Issues**: Report bugs and request features
- **Logs**: Always check logs for troubleshooting

### Project Status
- **Current Version**: 2.0.0
- **Build Status**: Mostly stable (minor TypeScript issues)
- **Production Ready**: ⚠️ Not recommended yet (security updates pending)
- **Development Ready**: ✅ Yes, suitable for development and testing

## What's Next?

The MediaNest project is in **active development** with recent major improvements:

### Recent Achievements
- Massive codebase cleanup (82% file reduction)
- Major security improvements
- TypeScript compilation mostly fixed
- Docker infrastructure stabilized

### Planned Improvements
- Final TypeScript error resolution
- Next.js security updates
- Architectural refactoring
- Enhanced integration testing

The project is **significantly better** than it was and suitable for development work, with production readiness coming soon.

---

**Last Updated**: September 2025  
**Next Review**: After remaining TypeScript fixes  
**Status**: Post-cleanup version with major improvements