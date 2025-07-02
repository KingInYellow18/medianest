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
  - Queue: Bull for background job processing
  - Container: Docker with Docker Compose
  - Proxy: Nginx for SSL termination

## Development Commands

Once the project is initialized, use these commands:
```bash
# Frontend development
cd frontend && npm run dev    # Start Next.js dev server (port 3000)
cd frontend && npm run build  # Build production frontend
cd frontend && npm test       # Run frontend tests
cd frontend && npm run lint   # Lint frontend code

# Backend development  
cd backend && npm run dev     # Start Express dev server (port 4000)
cd backend && npm run build   # Build backend
cd backend && npm test        # Run backend tests
cd backend && npm run lint    # Lint backend code

# Full stack
docker-compose up            # Run entire stack in containers
docker-compose down          # Stop all containers
```

## Code Architecture

### Frontend Structure (Next.js)
```
frontend/
├── app/                    # Next.js 14 app directory
│   ├── (auth)/            # Auth-protected routes
│   ├── api/               # API route handlers
│   └── layout.tsx         # Root layout with providers
├── components/
│   ├── dashboard/         # Dashboard components
│   ├── media/             # Media browsing components
│   └── shared/            # Reusable UI components
├── lib/
│   ├── api/               # API client functions
│   ├── hooks/             # Custom React hooks
│   └── utils/             # Helper functions
└── services/              # External service integrations
```

### Backend Structure (Express)
```
backend/
├── src/
│   ├── controllers/       # Request handlers
│   ├── services/          # Business logic
│   ├── integrations/      # External API clients
│   │   ├── plex/         # Plex API integration
│   │   ├── overseerr/    # Overseerr API integration
│   │   └── uptime-kuma/  # Uptime Kuma integration
│   ├── jobs/              # Background job processors
│   ├── middleware/        # Express middleware
│   └── models/            # Database models
└── config/                # Configuration files
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
- Bull job queue data
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

## Testing Strategy

### IMPORTANT: All tests MUST follow the principles outlined in test_architecture.md

- Unit tests for business logic (70% of tests)
- Integration tests for API endpoints (25% of tests)
- E2E tests for critical user flows (5% of tests)
- Mock external services in tests
- Minimum 80% code coverage target (95% for critical paths)

### Test Implementation Requirements
When creating tests, ALWAYS follow these principles from test_architecture.md:

1. **Test Structure**: Use AAA pattern (Arrange, Act, Assert)
2. **Naming**: Follow conventions - unit: `*.test.ts`, integration: `*.integration.test.ts`, E2E: `*.spec.ts`
3. **Isolation**: Each test must run independently with no shared state
4. **Mocking**: Use dependency injection and mock external services
5. **Performance**: Unit tests must complete in <30 seconds total
6. **Security**: Include authentication/authorization tests for all protected endpoints
7. **Error Cases**: Test both success and failure scenarios
8. **Database Testing**: Use Testcontainers for PostgreSQL/Redis
9. **WebSocket Testing**: Test real-time features with Socket.io client
10. **External APIs**: Mock Plex, Overseerr, and Uptime Kuma responses

### Test Quality Standards
- No flaky tests (failure rate must be <2%)
- Use custom matchers for API responses and JWT validation
- Include performance assertions where relevant
- Document complex test scenarios
- Group related tests logically
- Clean up all test data after execution

# important-instruction-reminders
Do what has been asked; nothing more, nothing less.
NEVER create files unless they're absolutely necessary for achieving your goal.
ALWAYS prefer editing an existing file to creating a new one.
NEVER proactively create documentation files (*.md) or README files. Only create documentation files if explicitly requested by the User.