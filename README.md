# MediaNest

**⚠️ PROJECT STATUS: Development/Repair Phase - NOT Production Ready**

A unified web portal for managing Plex media server and related services.

## 🚨 Current Project State

**Build Status:** ❌ **FAILING** - 80+ TypeScript compilation errors  
**Test Status:** ❌ **FAILING** - 28/30 integration tests failing  
**Production Ready:** ❌ **NO** - Major issues need resolution

This project is currently in active repair phase. Previous documentation contained inflated claims about production readiness. See [docs/CHANGELOG.md](docs/CHANGELOG.md) for honest project status.

## Known Issues (Must Fix Before Use)

### Critical Build Blockers

- **TypeScript Errors**: 80+ compilation errors preventing successful builds
- **Database Schema Issues**: ID type mismatches (string vs number) throughout codebase
- **Missing Configuration**: Plex integration config referenced but not implemented
- **Type Definition Conflicts**: Frontend/backend type inconsistencies

### Test Failures

- **Error Handling Middleware**: 28 out of 30 integration tests failing
- **Circuit Breaker**: Timeout issues in concurrency tests
- **Authentication Flow**: Type mismatches in auth controller

## Quick Start (Currently Not Working)

### Prerequisites

- Node.js 20.x or higher
- Docker and Docker Compose
- PostgreSQL 15.x (for local development)
- Redis 7.x (for local development)

### Development Setup (⚠️ Currently Broken)

**Note**: These steps will fail due to TypeScript compilation errors. Project needs repair first.

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd medianest
   ```

2. **Install dependencies**

   ```bash
   npm install
   # Note: npm run install:all script may not exist
   ```

3. **Set up environment variables**

   ```bash
   cp .env.example .env
   npm run generate-secrets  # May fail - script needs verification
   ```

4. **Attempt database setup** (Will likely fail)

   ```bash
   npm run db:generate  # May fail due to TypeScript errors
   npm run db:migrate   # May fail if generate fails
   ```

5. **Try to start development servers** (Will fail)
   ```bash
   npm run dev  # WILL FAIL - TypeScript compilation errors
   ```

**Expected Results:**

- ❌ Build will fail with 80+ TypeScript errors
- ❌ Tests will fail (28/30 integration tests failing)
- ❌ Services will not start properly

**To actually develop:** Fix TypeScript errors first (see Known Issues above)

### Docker Development

To run the entire stack with Docker:

```bash
# Build and start all services
npm run docker:up

# View logs
npm run docker:logs

# Stop all services
npm run docker:down
```

## Project Structure

```
medianest/
├── frontend/          # Next.js 14 frontend application
│   ├── src/
│   │   ├── app/      # App router pages and layouts
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── lib/
│   │   └── services/
│   └── server.js     # Custom server for Socket.io support
├── backend/          # Express.js backend API
│   ├── src/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── integrations/
│   │   ├── jobs/
│   │   ├── middleware/
│   │   ├── repositories/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── types/
│   │   └── utils/
│   └── prisma/       # Database schema and migrations
├── infrastructure/   # Infrastructure configuration
│   └── database/     # Database initialization scripts
├── docs/            # Documentation
└── scripts/         # Utility scripts
```

## Available Scripts

### Root Commands

- `npm run dev` - Start both frontend and backend in development mode
- `npm run build` - Build both frontend and backend for production
- `npm run lint` - Run linting for both frontend and backend
- `npm run type-check` - Run TypeScript type checking

### Database Commands

- `npm run db:generate` - Generate Prisma client
- `npm run db:migrate` - Run database migrations
- `npm run db:studio` - Open Prisma Studio

### Docker Commands

- `npm run docker:build` - Build Docker images
- `npm run docker:up` - Start all services with Docker Compose
- `npm run docker:down` - Stop all services
- `npm run docker:logs` - View container logs

## Configuration

### Environment Variables

See `.env.example` for all available configuration options. Key variables:

- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string
- `NEXTAUTH_SECRET` - Secret for NextAuth.js
- `PLEX_CLIENT_ID/SECRET` - Plex OAuth credentials
- `ENCRYPTION_KEY` - Key for encrypting sensitive data

### External Services

External service configurations (Plex, Overseerr, Uptime Kuma) are managed through the admin UI after deployment.

## Reverse Proxy Configuration

MediaNest is designed to work behind a reverse proxy. The application:

- Trusts proxy headers (`X-Forwarded-*`)
- Handles WebSocket upgrades for Socket.io
- Supports path-based routing

Example nginx configuration:

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

## Frequently Asked Questions (FAQ)

### General Questions

**Q: What is MediaNest?**
A: MediaNest is a unified web portal for managing Plex media server and related services. It provides a centralized dashboard for media management, user authentication, and system monitoring.

**Q: What technologies does MediaNest use?**
A: MediaNest is **intended** to be built with:

- **Frontend**: Next.js 14 with React 19, TypeScript, Tailwind CSS (⚠️ has build issues)
- **Backend**: Express.js with TypeScript, Prisma ORM (⚠️ 80+ TypeScript errors)
- **Database**: PostgreSQL with Redis for caching (⚠️ schema type mismatches)
- **Authentication**: JWT-based with device tracking (⚠️ type errors in auth controller)
- **Testing**: Vitest for unit and integration testing (⚠️ 28/30 tests failing)
- **Deployment**: Docker containers (⚠️ cannot build due to TypeScript errors)

### Installation & Setup

**Q: What are the system requirements?**
A: You need Node.js 20.x+, Docker, PostgreSQL 15.x, and Redis 7.x. See the Prerequisites section above for details.

**Q: How do I set up the development environment?**
A: ⚠️ **Currently broken** - Development setup will fail. The documented steps (`npm run install:all`, generate secrets, run dev servers) will encounter TypeScript compilation errors. See "Known Issues" section for what needs to be fixed first.

**Q: Why am I getting dependency resolution errors?**
A: This project uses React 19 with Next.js 15, which may require `--legacy-peer-deps` for npm install. The project is configured to handle this automatically.

### Security & Authentication

**Q: How does authentication work?**
A: MediaNest uses JWT-based authentication with:

- Device fingerprinting and risk assessment
- Session token validation and rotation
- Blacklist checking for revoked tokens
- Optional authentication for public endpoints

**Q: Is MediaNest secure?**
A: Yes, MediaNest implements multiple security layers:

- Helmet.js for HTTP security headers
- Rate limiting to prevent abuse
- CORS configuration for cross-origin requests
- Comprehensive security auditing and logging
- Regular security updates (see CHANGELOG.md)

**Q: How are passwords handled?**
A: Passwords are hashed using bcrypt with salt rounds. The system also supports 2FA via TOTP (Time-based One-Time Passwords).

### Development & Deployment

**Q: How do I run tests?**
A: ⚠️ **Tests are currently failing**. Commands exist but will show failures:

- `npm test` - Run all tests (⚠️ 28/30 integration tests failing)
- `npm run test:watch` - Run tests in watch mode (will show ongoing failures)
- `npm run test:coverage` - Run tests with coverage report (limited due to failures)
- `npm run test:e2e` - Run end-to-end tests with Playwright (status unknown)

**Q: How do I deploy MediaNest?**
A: ⚠️ **Cannot deploy** - Project has build-blocking issues:

- **Docker**: Cannot build Docker images due to TypeScript errors
- **Manual**: `npm run build` will fail with 80+ TypeScript compilation errors
- **Cloud**: Cannot deploy non-building applications to any platform
  **Required**: Fix TypeScript errors before any deployment is possible

**Q: Can I customize MediaNest?**
A: Yes! MediaNest is designed to be extensible:

- Add custom middleware in the backend
- Create new React components in the frontend
- Extend the database schema with Prisma migrations
- Add new API endpoints following the existing patterns

### Troubleshooting

**Q: The build is failing with TypeScript errors. What should I do?**
A: Common solutions:

1. Run `npm install` to ensure all dependencies are up to date
2. Check that your Node.js version is 20.x or higher
3. Clear the TypeScript cache: `npx tsc --build --clean`
4. Restart your development server

**Q: I'm getting CORS errors. How do I fix this?**
A: Check your environment variables:

- Ensure `FRONTEND_URL` is set correctly in your backend `.env`
- Verify the CORS configuration in `backend/src/app.ts`
- For development, make sure both frontend (3000) and backend (3001) are running

**Q: Database connection is failing. What should I check?**
A: Verify these settings:

- PostgreSQL is running and accessible
- `DATABASE_URL` in your `.env` file is correct
- Database user has proper permissions
- Run `npm run db:migrate` to apply database migrations

**Q: How do I update MediaNest to the latest version?**
A: Follow these steps:

1. Backup your database and configuration files
2. Pull the latest changes: `git pull origin main`
3. Update dependencies: `npm install`
4. Run database migrations: `npm run db:migrate`
5. Rebuild the application: `npm run build`
6. Restart your services

### Performance & Monitoring

**Q: How can I monitor MediaNest performance?**
A: MediaNest includes built-in monitoring:

- Performance metrics tracking in the backend
- Request logging with Winston
- Health check endpoints for monitoring systems
- Error tracking and security event logging

**Q: How do I optimize performance?**
A: Several optimization strategies are available:

- Enable Redis caching for database queries
- Use the built-in performance monitoring tools
- Implement proper database indexing
- Consider using a CDN for static assets
- Monitor and analyze the performance reports

### Contributing & Community

**Q: How can I contribute to MediaNest?**
A: We welcome contributions! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes with tests
4. Follow the existing code style
5. Submit a pull request with a clear description

**Q: Where can I report bugs or request features?**
A: Please use the GitHub Issues page to report bugs or request features. Provide as much detail as possible, including:

- Steps to reproduce the issue
- Expected vs actual behavior
- Your environment details (OS, Node.js version, etc.)
- Screenshots or logs if applicable

**Q: Is there a roadmap for future features?**
A: Check the GitHub repository for our roadmap and upcoming features. We regularly update our plans based on community feedback and needs.

## Contributing

1. Create a feature branch
2. Make your changes
3. Run tests and linting
4. Submit a pull request

## License

MIT
