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
npm run dev:all          # Start both frontend and backend concurrently
npm run build            # Build all workspaces
npm run build:shared     # Build shared package only
npm test                 # Run all tests across workspaces
npm run test:watch       # Run tests in watch mode
npm run test:coverage    # Generate coverage report
npm run lint             # Lint all workspaces
npm run type-check       # TypeScript validation across workspaces
npm run generate-secrets # Generate secure keys for NextAuth and encryption

# Database commands (from root)
npm run db:generate      # Generate Prisma client
npm run db:migrate       # Run database migrations
npm run db:studio        # Open Prisma Studio GUI

# Docker commands (from root)
npm run docker:build     # Build Docker images
npm run docker:up        # Start all services with docker-compose
npm run docker:down      # Stop all containers
npm run docker:logs      # View container logs

# Frontend development
cd frontend && npm run dev    # Start Next.js dev server (port 3000)
cd frontend && npm run build  # Build production frontend
cd frontend && npm run lint   # Lint frontend code

# Backend development  
cd backend && npm run dev     # Start Express dev server (port 4000)
cd backend && npm run build   # Build backend
cd backend && npm test        # Run tests with Vitest
cd backend && npm run test:ui # Open Vitest UI for debugging
cd backend && npm run lint    # Lint backend code
cd backend && ./run-tests.sh  # Run tests with automated DB setup

# Development environments
docker-compose -f docker-compose.dev.yml up    # Local development with hot reload
docker-compose -f docker-compose.test.yml up   # Test environment setup
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

### Plex Authentication Flow
1. User clicks "Login with Plex"
2. Redirect to Plex OAuth with client ID
3. Plex redirects back with auth code
4. Exchange code for Plex token
5. Fetch user details from Plex API
6. Create/update local user record
7. Issue JWT for session management

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
- Use `./run-tests.sh` in backend for automated test setup
- MSW for mocking external API calls
- Vitest UI available with `npm run test:ui`

### Key Principles
- If a test is flaky, fix it immediately or delete it
- Mock external services with MSW for realistic request interception
- Use Vitest's built-in features for fast, modern testing
- Document only non-obvious test scenarios

## Important Development Notes

### ALWAYS Use Context7 MCP Server Before Code Generation
- **REQUIRED**: Before writing any code, use the Context7 MCP server to check for the latest documentation
- Use `mcp__context7__resolve-library-id` to find the correct library
- Use `mcp__context7__get-library-docs` to get up-to-date documentation
- This ensures code is using the latest APIs and best practices

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

Ready for Phase 2: External Service Integration (Plex, Overseerr, Uptime Kuma)

### Development Setup

1. **Initial Setup**:
   ```bash
   npm install              # Install all dependencies
   npm run generate-secrets # Generate security keys
   cp .env.example .env     # Configure environment
   npm run db:migrate       # Setup database
   ```

2. **Environment Variables**:
   - `NODE_ENV`: development | production | test
   - `DATABASE_URL`: PostgreSQL connection string
   - `REDIS_URL`: Redis connection string
   - `NEXTAUTH_SECRET`: Generated by generate-secrets script
   - `PLEX_CLIENT_ID` & `PLEX_CLIENT_SECRET`: From Plex app settings
   - See `.env.example` for complete list

3. **Pre-commit Hooks**:
   - Automatically runs ESLint on staged files via `lint-staged`
   - Ensures code quality before commits

### Git Workflow
- Use descriptive commit messages
- Group related changes into logical commits
- Run tests before committing: `npm test`
- Lint code before committing: `npm run lint`
- Follow conventional commits format when possible

# important-instruction-reminders
Do what has been asked; nothing more, nothing less.
NEVER create files unless they're absolutely necessary for achieving your goal.
ALWAYS prefer editing an existing file to creating a new one.
NEVER proactively create documentation files (*.md) or README files. Only create documentation files if explicitly requested by the User.