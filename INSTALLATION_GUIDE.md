# MediaNest Installation Guide

**� CURRENT STATUS: Under Development - Installation Not Yet Functional**

## Prerequisites

Before attempting installation, please note:

- **Build Status**: L **FAILING** - 80+ TypeScript compilation errors
- **Installation Ready**: L **NO** - Core dependencies have unresolved issues
- **Production Ready**: L **NO** - Not suitable for production use

## System Requirements

### Hardware Requirements

- **RAM**: Minimum 4GB, Recommended 8GB
- **Storage**: Minimum 10GB free space
- **CPU**: 2+ cores recommended

### Software Dependencies

- **Node.js**: 20.x LTS (required)
- **Docker**: Latest stable version
- **Docker Compose**: v2.0+
- **Git**: For repository cloning

## Quick Start (Currently Non-Functional)

**� WARNING**: These steps will fail due to unresolved TypeScript errors.

### 1. Clone Repository

```bash
git clone <repository-url>
cd medianest
```

### 2. Environment Configuration

```bash
# Copy example environment file
cp .env.example .env

# Edit configuration (required before proceeding)
nano .env
```

### 3. Install Dependencies

```bash
# Root dependencies
npm install

# Backend dependencies
cd backend && npm install && cd ..

# Frontend dependencies
cd frontend && npm install --legacy-peer-deps && cd ..
```

**Expected Result**: L Installation will succeed but compilation will fail

### 4. Database Setup

```bash
# Generate Prisma client
npm run db:generate

# Run migrations
npm run db:migrate
```

**Expected Result**: L May fail due to TypeScript compilation errors

### 5. Development Startup

```bash
# Start all services
npm run dev
```

**Expected Result**: L **WILL FAIL** - TypeScript compilation errors prevent startup

## Docker Installation (Recommended)

### Prerequisites Check

```bash
# Verify Docker installation
docker --version
docker-compose --version
```

### Build and Start Services

```bash
# Build images
docker-compose build

# Start services in background
docker-compose up -d

# Check service status
docker-compose ps
```

**Expected Result**: L **BUILD WILL FAIL** - TypeScript errors prevent Docker image creation

## Environment Configuration

### Required Environment Variables

```bash
# Database Configuration
DATABASE_URL=postgresql://user:password@localhost:5432/medianest

# Redis Configuration
REDIS_URL=redis://localhost:6379

# Authentication
JWT_SECRET=your-secure-jwt-secret-minimum-64-characters
NEXTAUTH_SECRET=your-nextauth-secret-minimum-32-characters
NEXTAUTH_URL=http://localhost:3000

# Plex Integration (obtain from Plex)
PLEX_CLIENT_ID=your-plex-client-identifier
PLEX_CLIENT_SECRET=your-plex-client-secret

# External Services (configure after basic setup)
OVERSEERR_URL=http://localhost:5055
OVERSEERR_API_KEY=your-overseerr-api-key

UPTIME_KUMA_URL=http://localhost:3001
UPTIME_KUMA_TOKEN=your-uptime-kuma-token
```

## Troubleshooting Common Issues

### TypeScript Compilation Errors

**Issue**: 80+ TypeScript errors prevent successful build

**Current Status**: Known issue - requires development team attention

**Workaround**: None available - compilation must be fixed before installation

### Dependency Resolution Errors

**Issue**: React 19 with Next.js 15 peer dependency conflicts

**Solution**:

```bash
npm install --legacy-peer-deps
```

### Database Connection Issues

**Issue**: PostgreSQL connection failures

**Check**:

1. PostgreSQL service is running
2. Database credentials are correct
3. Database exists and is accessible
4. Network connectivity to database host

### Port Conflicts

**Default Ports Used**:

- Frontend: 3000
- Backend: 3001
- PostgreSQL: 5432
- Redis: 6379

**Solution**: Modify ports in docker-compose.yml if conflicts occur

## Service Verification

Once services start (if TypeScript issues are resolved):

### Health Checks

```bash
# Backend API health
curl http://localhost:3001/api/health

# Frontend accessibility
curl http://localhost:3000

# Database connectivity
docker-compose exec postgres psql -U medianest -d medianest -c "SELECT 1;"
```

### Service Status

```bash
# Check all containers
docker-compose ps

# View logs
docker-compose logs -f

# View specific service logs
docker-compose logs backend
docker-compose logs frontend
```

## Development vs Production

### Development Setup

- Uses nodemon for hot reload
- Source maps enabled
- Debugging ports exposed
- Verbose logging enabled

### Production Setup

**Status**: L **NOT AVAILABLE** - Cannot build production images due to compilation errors

## Next Steps

### For Users

1. **Wait for fixes**: Monitor repository for TypeScript error resolution
2. **Check releases**: Watch for stable release announcements
3. **Report issues**: Submit detailed bug reports if encountering new problems

### For Developers

1. **Fix TypeScript errors**: Address 80+ compilation issues
2. **Test installation**: Verify complete installation process
3. **Update documentation**: Reflect actual working installation steps

## Support

### Getting Help

- **GitHub Issues**: Report installation problems
- **Documentation**: Check docs/ folder for detailed guides
- **Logs**: Always include error logs when reporting issues

### Known Limitations

- Installation currently non-functional due to build errors
- Production deployment not possible
- Some integrations require manual configuration
- Performance not optimized for production workloads

---

**Last Updated**: January 2025  
**Document Status**: Reflects current non-functional state  
**Next Review**: After TypeScript compilation issues resolved
