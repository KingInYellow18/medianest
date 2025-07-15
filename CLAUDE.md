# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MediaNest is a unified web portal for managing a Plex media server and related services. It consolidates multiple tools (Overseerr, Uptime Kuma, YouTube downloaders, etc.) into a single authenticated interface for friends and family who access the Plex server.

## Key Architecture Decisions

- **Monolithic Architecture**: Single deployable unit for 10-20 concurrent users
- **Technology Stack**:
  - Frontend: Next.js 14.x with React, Tailwind CSS
  - Backend: Express API with Node.js 20.x LTS
  - Database: PostgreSQL 15.x (primary) + Redis 7.x (cache/queue)
  - Authentication: NextAuth.js with Plex OAuth
  - Real-time: Socket.io for WebSocket connections
  - Queue: BullMQ for background job processing
  - Container: Docker with Docker Compose
  - Proxy: Nginx for SSL termination

## Development Commands

```bash
# Workspace-level commands (from root)
npm run dev              # Start both frontend and backend concurrently
npm run build            # Build all workspaces
npm run build:shared     # Build shared package only
npm test                 # Run all tests across workspaces
npm run test:watch       # Run tests in watch mode
npm run test:coverage    # Generate coverage report
npm run lint             # Lint all workspaces
npm run type-check       # TypeScript validation across workspaces
npm run generate-secrets # Generate secure keys for NextAuth and encryption
npm run clean            # Clean build artifacts and dependencies

# Database commands (from root)
npm run db:generate      # Generate Prisma client
npm run db:migrate       # Run database migrations
npm run db:studio        # Open Prisma Studio GUI

# Docker commands (from root) - Using Docker Compose V2
npm run docker:build     # Build Docker images (docker compose build)
npm run docker:up        # Start all services (docker compose up -d)
npm run docker:down      # Stop all containers (docker compose down)
npm run docker:logs      # View container logs (docker compose logs -f)

# Frontend development
cd frontend && npm run dev           # Start Next.js dev server (port 3000)
cd frontend && npm run build         # Build production frontend
cd frontend && npm run lint          # Lint frontend code
cd frontend && npm run type-check    # TypeScript validation
cd frontend && npm test              # Run frontend tests
cd frontend && npm run test:ui       # Open Vitest UI

# Backend development
cd backend && npm run dev            # Start Express dev server (port 4000)
cd backend && npm run build          # Build backend
cd backend && npm test               # Run tests with Vitest
cd backend && npm run test:ui        # Open Vitest UI for debugging
cd backend && npm run test:watch     # Run tests in watch mode
cd backend && npm run test:coverage  # Generate test coverage report
cd backend && npm run lint           # Lint backend code
cd backend && npm run type-check     # TypeScript validation
cd backend && ./run-tests.sh         # Run tests with automated DB setup

# Development environments (Docker Compose V2)
docker compose -f docker-compose.dev.yml up    # Local development with hot reload
docker compose -f docker-compose.test.yml up   # Test environment setup
```

## Code Architecture

### Monorepo Structure

```
medianest/
├── frontend/              # Next.js 14 application
├── backend/               # Express.js API server
├── shared/                # Shared types and utilities
├── scripts/               # Development and setup scripts
├── infrastructure/        # Docker and deployment configs
└── docs/                  # Comprehensive documentation
```

### Frontend Structure (Next.js)

```
frontend/
├── src/
│   ├── app/               # Next.js 14 app directory
│   │   ├── (auth)/        # Auth-protected routes
│   │   ├── api/           # API route handlers
│   │   └── layout.tsx     # Root layout with providers
│   ├── components/
│   │   ├── dashboard/     # Dashboard components
│   │   ├── media/         # Media browsing components
│   │   └── shared/        # Reusable UI components
│   ├── lib/
│   │   ├── api/           # API client functions
│   │   ├── hooks/         # Custom React hooks
│   │   └── utils/         # Helper functions
│   └── services/          # External service integrations
└── public/                # Static assets
```

### Backend Structure (Express)

```
backend/
├── src/
│   ├── controllers/       # Request handlers
│   ├── services/          # Business logic layer
│   ├── repositories/      # Database access layer
│   ├── integrations/      # External API clients
│   │   ├── plex/         # Plex API integration
│   │   ├── overseerr/    # Overseerr API integration
│   │   └── uptime-kuma/  # Uptime Kuma integration
│   ├── jobs/              # Background job processors
│   ├── middleware/        # Express middleware
│   ├── utils/             # Helper functions
│   └── types/             # TypeScript definitions
├── prisma/
│   ├── schema.prisma      # Database schema
│   └── migrations/        # Database migrations
└── tests/                 # Test suites
```

### Shared Package

```
shared/
├── src/
│   ├── types/             # Common TypeScript interfaces
│   ├── constants/         # Shared constants
│   └── utils/             # Shared utilities
└── package.json           # Shared dependencies
```

## Key Integration Points

### Plex Authentication Flow (PIN-based)

1. User clicks "Login with Plex"
2. Backend generates PIN via Plex API
3. User enters PIN at plex.tv/link
4. Frontend polls backend for authorization status
5. Backend exchanges PIN for Plex token
6. Fetch user details from Plex API
7. Create/update local user record with encrypted token
8. Issue JWT for session management

### Service Integration Pattern

```typescript
// All external services follow this pattern:
class ServiceClient {
  constructor(config) {
    this.baseURL = config.url;
    this.apiKey = config.apiKey;
    this.timeout = config.timeout || 5000;
  }

  async request(endpoint, options) {
    // Circuit breaker logic
    // Retry logic
    // Error mapping
  }
}
```

### WebSocket Events

- `service:status` - Service health updates
- `request:update` - Media request status changes
- `download:progress` - YouTube download progress
- `user:notification` - User-specific alerts

## Database Schema Highlights

### Core Tables

- `users` - Plex ID, email, role, preferences
- `media_requests` - Links to Overseerr requests
- `youtube_downloads` - Download queue and status
- `service_status` - Cached service health data
- `user_sessions` - Active JWT sessions

### Redis Usage

- Session storage with 24h TTL
- Service status cache (5min TTL)
- BullMQ job queue data
- Rate limiting counters

## Security Considerations

- All routes require authentication except `/api/health`
- Plex OAuth for primary authentication
- JWT tokens with secure httpOnly cookies
- Rate limiting: 100 req/min per user
- Input validation with Joi/Zod
- SQL injection prevention via Prisma ORM
- XSS protection via React's built-in escaping

## Error Handling

- User-facing errors return friendly messages
- Internal errors logged with full stack traces
- Circuit breakers for external services
- Graceful degradation when services unavailable
- Structured logging with correlation IDs

## Testing Strategy (Simplified for 10-20 Users)

### Focus on What Matters

- Test critical paths: Plex OAuth, media requests, service status
- Use modern tools: Vitest, Supertest, MSW for mocking
- Target 60-70% coverage overall (80% for auth/security)
- Total test suite runs in <5 minutes

### Priority Testing Areas

1. **Plex Authentication**: PIN flow, user creation, token validation
2. **Media Requests**: API endpoints, Overseerr integration
3. **Service Monitoring**: Uptime Kuma status, graceful degradation
4. **Rate Limiting**: Verify limits work (100/min API, 5/hr YouTube)
5. **User Isolation**: Ensure users can't see each other's data

### What NOT to Test

- UI component internals
- Simple CRUD operations
- Third-party library behavior
- Edge cases that won't happen with 20 users
- Performance under extreme load

### Test Structure

```
backend/tests/
├── unit/              # Business logic tests
├── integration/       # API endpoints + external services
├── fixtures/          # Test data and mocks
└── setup.ts           # Test configuration

frontend/__tests__/    # Frontend tests (when implemented)
└── components/        # Component tests
```

### Test Environment

- Test database: PostgreSQL on port 5433
- Test Redis: Redis on port 6380
- Use `./run-tests.sh` in backend for automated test setup (uses Docker Compose V2)
- MSW for mocking external API calls
- Vitest UI available with `npm run test:ui`
- Test containers managed via `docker compose -f docker-compose.test.yml`

### Key Principles

- If a test is flaky, fix it immediately or delete it
- Mock external services with MSW for realistic request interception
- Use Vitest's built-in features for fast, modern testing
- Document only non-obvious test scenarios

## Important Development Notes

### MANDATORY: Use Context7 MCP Server Before Code Generation

**CRITICAL REQUIREMENT**: You MUST use the Context7 MCP server before writing any code that uses external libraries or frameworks. This is not optional.

1. **Before writing any code**, check for the latest documentation:

   - Use `mcp__context7__resolve-library-id` to find the correct library ID
   - Use `mcp__context7__get-library-docs` to retrieve up-to-date documentation
   - This ensures code uses the latest APIs and best practices

2. **Examples of when to use Context7**:

   - Before using Next.js features or hooks
   - Before implementing Prisma queries or schema changes
   - Before using Socket.io server/client APIs
   - Before implementing BullMQ job processing
   - Before using any React hooks or patterns
   - Before implementing authentication with NextAuth.js

3. **How to use**:
   ```
   First: mcp__context7__resolve-library-id with library name (e.g., "next.js", "prisma", "socket.io")
   Then: mcp__context7__get-library-docs with the resolved library ID
   ```

### Current Implementation Status

Phase 1 (Core Infrastructure) is COMPLETE ✅:

- ✅ Plex OAuth authentication with PIN flow
- ✅ Database schema with Prisma ORM
- ✅ Repository pattern with full CRUD operations
- ✅ JWT authentication and RBAC middleware
- ✅ Rate limiting with Redis Lua scripts
- ✅ Winston logging with correlation IDs
- ✅ Error handling with user-friendly messages
- ✅ Basic monitoring and metrics
- ✅ API versioning structure (/api/v1/)
- ✅ Socket.io server configuration with JWT auth
- ✅ AES-256-GCM encryption for sensitive data
- ✅ Zod input validation schemas for all endpoints

Phase 2 (External Service Integration) is COMPLETE ✅:

- ✅ Plex API integration with PIN-based OAuth flow
- ✅ Overseerr API integration for media requests
- ✅ Uptime Kuma integration for service monitoring
- ✅ Service configuration management with encryption
- ✅ Circuit breaker pattern for all external services
- ✅ Health check endpoints for all services

Phase 3 (Dashboard & Media UI) is COMPLETE ✅:

- ✅ Service status cards with real-time updates
- ✅ Media browsing with Plex library integration
- ✅ Media request UI with Overseerr integration
- ✅ YouTube downloader frontend interface
- ✅ WebSocket-powered status updates
- ✅ Mobile-responsive dashboard

Phase 4 (YouTube Integration) is IN PROGRESS 🚧:

- ✅ Frontend download interface complete
- ⏳ Backend YouTube downloader integration pending
- ⏳ BullMQ job processing for downloads
- ⏳ User isolation for download queues

Ready for Phase 4 completion: YouTube backend implementation with yt-dlp

### Development Setup

1. **Initial Setup**:

   ```bash
   npm install              # Install all dependencies (npm workspaces)
   npm run generate-secrets # Generate security keys
   cp .env.example .env     # Configure environment
   npm run db:generate      # Generate Prisma client
   npm run db:migrate       # Setup database
   ```

2. **Running Tests**:

   ```bash
   # Run all tests
   npm test

   # Run backend tests with test database
   cd backend && ./run-tests.sh   # Uses docker compose for test DB

   # Run single test file
   cd backend && npm test src/controllers/__tests__/auth.controller.test.ts
   cd frontend && npm test src/components/__tests__/ServiceCard.test.tsx

   # Run tests matching pattern
   cd backend && npm test -- -t "should authenticate"
   ```

3. **Environment Variables**:

   - `NODE_ENV`: development | production | test
   - `DATABASE_URL`: PostgreSQL connection string
   - `REDIS_URL`: Redis connection string (or separate REDIS_HOST/PORT)
   - `NEXTAUTH_SECRET`: Generated by generate-secrets script
   - `PLEX_CLIENT_ID` & `PLEX_CLIENT_SECRET`: From Plex app settings
   - `ENCRYPTION_KEY`: For encrypting service credentials
   - See `.env.example` for complete list

4. **Pre-commit Hooks**:
   - Automatically runs ESLint and Prettier on staged files via `lint-staged`
   - Frontend files use Next.js ESLint integration
   - Backend/shared files use standard ESLint
   - Prisma schema files are auto-formatted
   - Ensures code quality before commits

### Git Workflow

- Use descriptive commit messages
- Group related changes into logical commits
- Run tests before committing: `npm test`
- Lint code before committing: `npm run lint`
- Follow conventional commits format when possible

## Common Development Tasks

### Adding a New API Endpoint

1. Create validation schema in `backend/src/validations/`
2. Add controller method in `backend/src/controllers/`
3. Add service logic in `backend/src/services/`
4. Add repository methods in `backend/src/repositories/`
5. Register route in `backend/src/routes/v1/`
6. Add tests for controller and service layers
7. Update frontend API client in `frontend/src/lib/api/`

### Working with External Services

1. Create integration client in `backend/src/integrations/{service}/`
2. Follow the ServiceClient pattern with circuit breaker and retry logic
3. Add service configuration to database schema if needed
4. Create service-specific endpoints in controllers
5. Add frontend service card in `frontend/src/components/dashboard/cards/`

### Database Changes

1. Modify schema in `backend/prisma/schema.prisma`
2. Run `npm run db:generate` to update Prisma client
3. Create migration: `cd backend && npx prisma migrate dev --name description`
4. Update repositories and types as needed
5. Run tests to ensure nothing breaks

### WebSocket Events

1. Define event types in `shared/src/types/`
2. Add server handler in `backend/src/socket/handlers/`
3. Emit events from relevant services
4. Add client listener in `frontend/src/hooks/useWebSocket.ts`
5. Update components to react to events

### Debugging Tips

- Frontend runs on port 3000, backend on port 4000
- Use `npm run db:studio` to inspect database
- Check Redis with `redis-cli` on port 6379 (or 6380 for tests)
- Socket.io admin UI available at `http://localhost:4000/admin` in development
- Use correlation IDs in logs to trace requests
- Enable debug logging with `LOG_LEVEL=debug`

### Key Configuration Files

- `.env.example` - Complete list of all environment variables
- `docker-compose.yml` - Production deployment configuration
- `docker-compose.dev.yml` - Development environment with hot reload
- `docker-compose.test.yml` - Test environment setup
- `vitest.workspace.ts` - Test configuration for all workspaces
- `ARCHITECTURE.md` - Detailed system design documentation

### Important Architecture Documents

- `docs/01-project-overview.md` - Project goals and scope
- `docs/02-architecture-decisions.md` - Key architectural choices
- `docs/04-security-design.md` - Security implementation details
- `docs/05-api-design.md` - API endpoint documentation
- `docs/08-deployment-plan.md` - Production deployment guide

# important-instruction-reminders

Do what has been asked; nothing more, nothing less.
NEVER create files unless they're absolutely necessary for achieving your goal.
ALWAYS prefer editing an existing file to creating a new one.
NEVER proactively create documentation files (\*.md) or README files. Only create documentation files if explicitly requested by the User.
