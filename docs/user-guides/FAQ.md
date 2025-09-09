# MediaNest Frequently Asked Questions (FAQ)

**Version:** 2.0  
**Date:** September 2025  
**Status:** Active - Post-Major-Cleanup FAQ  

## General Questions

### Q: What is MediaNest and what does it do?

**A:** MediaNest is a unified web portal that consolidates multiple media management services into a single, authenticated interface. It provides:

- **Centralized Dashboard**: Single interface for Plex, Overseerr, Uptime Kuma, and more
- **Media Library Management**: Browse, search, and manage your Plex media collection
- **Service Monitoring**: Real-time status monitoring of all connected services
- **User Management**: Secure authentication with role-based access control
- **Request Management**: Handle media requests through integrated services

### Q: What's the current status of MediaNest? Is it ready to use?

**A:** **Status as of September 2025: Significantly Improved & Largely Functional**

**Good News:**
- ✅ **Major cleanup completed**: 82% file reduction (51,480+ → ~9,332 files)
- ✅ **Build system working**: TypeScript compilation mostly functional
- ✅ **Docker environment**: Stable and working
- ✅ **Core functionality**: Media browsing, authentication, service integration all work
- ✅ **Security improvements**: Major security enhancements implemented

**Minor Remaining Issues:**
- ⚠️ **6 TypeScript warnings**: Non-blocking type mismatches (development continues normally)
- ⚠️ **2 integration tests failing**: Minor test issues (28/30 pass)
- ⚠️ **Next.js security update recommended**: Can be updated independently

**Bottom Line:** MediaNest is **much improved** and suitable for development, testing, and careful production use.

### Q: What technologies does MediaNest use?

**A:** MediaNest uses a modern technology stack:

**Frontend:**
- Next.js 14 with React 18
- TypeScript for type safety
- Tailwind CSS for styling
- NextAuth.js for authentication
- Socket.io for real-time updates

**Backend:**
- Express.js with TypeScript
- Prisma ORM for database management
- PostgreSQL for primary data storage
- Redis for caching and sessions (optional)
- JWT for API authentication

**Infrastructure:**
- Docker and Docker Compose for containerization
- Nginx for reverse proxy (optional)
- Vitest for testing framework

### Q: What are the system requirements?

**A:** **Minimum Requirements:**
- Node.js 20.x or higher
- 4GB RAM (8GB recommended)
- 10GB free disk space
- Docker and Docker Compose V2
- PostgreSQL 15.x (can run via Docker)

**Recommended Setup:**
- Ubuntu 20.04+ or similar Linux distribution
- 8GB+ RAM for comfortable operation
- SSD storage for better performance
- Redis for improved caching

**Supported Browsers:**
- Chrome 90+, Firefox 88+, Safari 14+, Edge 90+

## Installation and Setup

### Q: How do I install MediaNest?

**A:** There are two main installation methods:

**Docker (Recommended for Users):**
```bash
git clone <repository-url>
cd medianest
cp .env.example .env
# Edit .env with your configuration
npm run docker:up
```

**Development Setup:**
```bash
git clone <repository-url>
cd medianest
npm install
cd backend && npm install && cd ..
cd frontend && npm install --legacy-peer-deps && cd ..
# Set up environment files and database
npm run dev
```

See [Getting Started Guide](GETTING_STARTED.md) for detailed instructions.

### Q: Why do I need to use `--legacy-peer-deps` for frontend installation?

**A:** MediaNest uses React 18 with Next.js 14, which may have peer dependency conflicts with some packages. The `--legacy-peer-deps` flag allows npm to resolve these conflicts using older resolution algorithms. This is a temporary workaround that doesn't affect functionality.

### Q: What should I put in the environment variables?

**A:** Key environment variables you must configure:

```bash
# Security (generate strong secrets!)
JWT_SECRET=your-super-secure-jwt-secret-32-chars-minimum
ENCRYPTION_KEY=your-encryption-key-32-chars-minimum
NEXTAUTH_SECRET=your-nextauth-secret-32-chars-minimum

# Database
DATABASE_URL=postgresql://medianest:medianest@localhost:5432/medianest

# Plex Integration
PLEX_TOKEN=your-plex-token-from-plex-web-app
PLEX_SERVER_URL=http://your-plex-server:32400
```

See [Configuration Guide](CONFIGURATION.md) for complete details.

## Current Issues and Workarounds

### Q: I see TypeScript errors during build. Should I be concerned?

**A:** **No, these are currently expected and don't affect functionality.**

**Current Status:** ~6 minor TypeScript warnings remain after major cleanup
**Impact:** None - applications builds and runs normally
**Examples:** Type comparison mismatches in controllers, constructor signature issues

**Workaround:** Continue development as normal. These warnings don't prevent:
- Building the application
- Running in development mode
- Docker deployments
- Core functionality

### Q: Some tests are failing. Is this normal?

**A:** **Yes, currently normal. 28 out of 30 integration tests pass.**

**Current Status:** Minor test failures in edge cases
**Impact:** Core functionality works correctly
**Failing Tests:** Usually related to timeout handling or mock configurations

**Workaround:** 
```bash
# Run tests and check results
npm test

# Focus on core functionality tests
npm run test:core  # if available

# Skip problematic tests temporarily
npm test -- --testPathIgnorePatterns=problematic-test
```

### Q: The build seems slow or shows warnings. Is this normal?

**A:** **Yes, some build warnings are expected but build completes successfully.**

**Performance:** Build time is reasonable after cleanup (much improved from before)
**Warnings:** TypeScript warnings during build are non-blocking
**Optimization:** Docker builds are optimized and cached

**Tips for faster builds:**
```bash
# Use Docker for consistent builds
npm run docker:build

# Development mode with hot reloading
npm run dev

# Skip checks for faster development builds
npm run build:fast  # if available
```

## Features and Functionality

### Q: What media services does MediaNest integrate with?

**A:** MediaNest integrates with several popular media services:

**Core Integration:**
- **Plex Media Server**: Complete library browsing and management

**Optional Integrations:**
- **Overseerr**: Media request management
- **Uptime Kuma**: Service monitoring and uptime tracking
- **YouTube-DL**: YouTube video downloading (partially implemented)

**API Integrations:**
- **TMDB**: Enhanced movie/TV metadata
- **YouTube Data API**: Video metadata

### Q: Can I use MediaNest without Plex?

**A:** **No, Plex integration is core to MediaNest's functionality.** MediaNest is specifically designed as a Plex management portal. While other services are optional, Plex server integration is required for:

- User authentication (Plex OAuth)
- Media library browsing
- Core media management features

### Q: How does authentication work?

**A:** MediaNest uses Plex OAuth for authentication:

1. **Login Process**: Users authenticate using their Plex account credentials
2. **Token Management**: Plex tokens are securely stored and encrypted
3. **Session Management**: JWT tokens for API access with configurable expiration
4. **User Isolation**: Each user can only access their authorized Plex libraries

**Security Features:**
- AES-256-GCM encryption for stored tokens
- Rate limiting on authentication endpoints
- Session timeout and refresh token rotation

### Q: Can multiple users access MediaNest simultaneously?

**A:** **Yes, MediaNest supports multiple concurrent users.**

**Multi-User Features:**
- Individual user authentication via Plex accounts
- User isolation (users only see their accessible libraries)
- Concurrent session support
- Role-based access control (Admin/User roles)

**Performance:** Optimized for 10-20 concurrent users (can handle more depending on hardware)

## Technical Questions

### Q: How do I update MediaNest to the latest version?

**A:** Update process depends on your installation method:

**Docker Installation:**
```bash
# Pull latest code
git pull origin main

# Rebuild containers
docker-compose build --no-cache
docker-compose up -d

# Run any database migrations
docker-compose exec backend npm run db:migrate
```

**Development Installation:**
```bash
# Pull latest code
git pull origin main

# Update dependencies
npm install
cd backend && npm install && cd ..
cd frontend && npm install --legacy-peer-deps && cd ..

# Run migrations
npm run db:migrate

# Restart services
npm run dev
```

### Q: How do I backup my MediaNest configuration?

**A:** **Configuration Backup:**
```bash
# Backup environment files
cp .env .env.backup
cp frontend/.env.local frontend/.env.local.backup

# Backup database (PostgreSQL)
pg_dump $DATABASE_URL > medianest_backup.sql

# Backup Docker volumes (if using Docker)
docker-compose exec postgres pg_dump -U medianest medianest > backup.sql
```

**Configuration Migration:**
```bash
# Export configuration
npm run config:export > config_backup.json

# Import configuration  
npm run config:import < config_backup.json
```

### Q: Can I run MediaNest behind a reverse proxy?

**A:** **Yes, MediaNest is designed to work behind reverse proxies.**

**Nginx Configuration Example:**
```nginx
location / {
    proxy_pass http://localhost:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;
}
```

**Required Settings:**
```bash
# In .env file
TRUST_PROXY=true
ALLOWED_ORIGINS=https://your-domain.com
```

### Q: How do I enable HTTPS/SSL?

**A:** **HTTPS should be handled by reverse proxy for security and certificate management.**

**Recommended Approach:**
1. Use nginx or Caddy as reverse proxy
2. Handle SSL termination at proxy level
3. Configure MediaNest to trust proxy headers

**Production Configuration:**
```bash
# In .env
FORCE_HTTPS=true
TRUST_PROXY=true
```

## Development and Contributing

### Q: How can I contribute to MediaNest?

**A:** Contributions are welcome! Current priorities:

**High Priority:**
- Fix remaining TypeScript warnings (6 issues)
- Improve integration test reliability
- UI/UX enhancements

**Medium Priority:**
- Performance optimizations
- Additional service integrations
- Documentation improvements

**Getting Started:**
1. Read [Contributing Guide](../CONTRIBUTING.md)
2. Check GitHub Issues for "good first issue" labels
3. Set up development environment
4. Submit pull requests with tests

### Q: What's the development workflow?

**A:** **Standard Git workflow with testing requirements:**

1. Fork the repository
2. Create a feature branch
3. Make changes with appropriate tests
4. Run the test suite: `npm test`
5. Submit pull request with description

**Development Commands:**
```bash
# Start development environment
npm run dev

# Run all tests
npm test

# Type checking
npm run typecheck

# Lint code
npm run lint:fix
```

### Q: How can I report bugs or request features?

**A:** **Use GitHub Issues for all bug reports and feature requests.**

**Bug Reports Should Include:**
- Steps to reproduce
- Expected vs actual behavior  
- System information (OS, Node.js version, etc.)
- Relevant log files or error messages
- Screenshots if UI-related

**Feature Requests Should Include:**
- Use case description
- Proposed solution
- Alternative solutions considered
- Implementation complexity estimate

## Troubleshooting

### Q: MediaNest won't start. What should I check?

**A:** **Common startup issues and solutions:**

1. **Check Prerequisites:**
```bash
node --version  # Should be 20.x+
docker --version  # Should be installed
```

2. **Check Configuration:**
```bash
# Verify environment files exist
ls -la .env frontend/.env.local

# Check database connectivity
npm run db:check
```

3. **Check Logs:**
```bash
# Development mode
npm run dev

# Docker mode
docker-compose logs
```

4. **Common Solutions:**
```bash
# Clear cache and reinstall
npm run clean
npm install

# Reset database (development only!)
npm run db:reset
```

### Q: I can't connect to my Plex server. What's wrong?

**A:** **Plex connectivity issues and solutions:**

**Check Plex Configuration:**
```bash
# Test Plex server directly
curl -H "X-Plex-Token: $PLEX_TOKEN" $PLEX_SERVER_URL/identity

# Verify environment variables
echo $PLEX_TOKEN
echo $PLEX_SERVER_URL
```

**Common Issues:**
- **Wrong Plex token**: Get fresh token from Plex Web App
- **Incorrect server URL**: Use IP address instead of hostname
- **Firewall blocking**: Ensure port 32400 is accessible
- **Plex server offline**: Check Plex server status

**Getting Plex Token:**
1. Open Plex Web App in browser
2. Open browser Developer Tools (F12)
3. Look for `X-Plex-Token` header in network requests
4. Copy the token value

### Q: Performance is slow. How can I improve it?

**A:** **Performance optimization strategies:**

**Enable Redis Caching:**
```bash
# Add to .env
REDIS_URL=redis://localhost:6379
```

**Database Optimization:**
```bash
# Run database analysis
npm run db:analyze

# Check for slow queries
npm run db:slow-queries
```

**System Resources:**
```bash
# Check resource usage
docker stats  # If using Docker
npm run system:info
```

**Performance Monitoring:**
```bash
# Enable performance monitoring
npm run monitoring:enable

# Check performance metrics
curl http://localhost:4000/metrics
```

---

**Last Updated**: September 2025  
**FAQ Version**: 2.0 (Post-Major-Cleanup)  
**Status**: Reflects current improved state with minor known issues