# MediaNest Testing Progress Guide

**Created:** January 15, 2025  
**Purpose:** Phased approach to achieve passing test criteria  
**Total Tests:** 48 test files (28 backend, 17 frontend, 3 e2e)

## Overview

This guide provides a logical, phased approach to running and troubleshooting tests in the MediaNest project. Tests are grouped by dependencies and criticality to help achieve a stable testing baseline.

## Pre-Test Setup Requirements

### 1. Environment Setup

```bash
# Install all dependencies
npm install

# Generate Prisma client
npm run db:generate

# Ensure test databases are ready
docker-compose -f docker-compose.test.yml up -d

# Wait for services to be ready (5-10 seconds)
sleep 10

# Run database migrations on test DB
cd backend
DATABASE_URL="postgresql://test:test@localhost:5433/medianest_test" npx prisma migrate deploy
cd ..
```

### 2. Environment Variables

Create `.env.test` files in both frontend and backend:

**backend/.env.test:**

```env
NODE_ENV=test
DATABASE_URL=postgresql://test:test@localhost:5433/medianest_test
REDIS_URL=redis://localhost:6380
JWT_SECRET=test-jwt-secret
ENCRYPTION_KEY=test-encryption-key-32-characters!!
PLEX_CLIENT_ID=test-client-id
PLEX_CLIENT_SECRET=test-client-secret
```

**frontend/.env.test:**

```env
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=test-nextauth-secret
```

## Testing Phases

### Phase 1: Core Infrastructure & Utilities (Foundation)

**Goal:** Ensure basic utilities and shared code work correctly

#### Shared Package Tests (5 tests)

```bash
# Run shared package tests first
cd shared && npm test
```

Expected tests:

- `src/errors/__tests__/index.test.ts` - Custom error classes
- `src/constants/__tests__/index.test.ts` - Shared constants
- `src/utils/__tests__/validation.test.ts` - Validation utilities
- `src/utils/__tests__/format.test.ts` - Formatting utilities
- `src/utils/__tests__/crypto.test.ts` - Encryption utilities

**Common Issues:**

- Missing dependencies → Run `npm install` in shared directory
- TypeScript errors → Run `npm run build` in shared first

#### Backend Utilities (3 tests)

```bash
# Run backend utility tests
cd backend && npm test tests/unit/utils/
```

Expected tests:

- `tests/unit/utils/jwt.test.ts` - JWT token handling
- `tests/unit/utils/retry.test.ts` - Retry logic
- `tests/unit/middleware/correlation-id.test.ts` - Request tracking

### Phase 2: Database & Repository Layer

**Goal:** Ensure database connections and basic CRUD operations work

#### Prerequisites

```bash
# Verify test database is running
docker ps | grep postgres-test

# Test connection
PGPASSWORD=test psql -h localhost -p 5433 -U test -d medianest_test -c "SELECT 1;"
```

#### Repository Tests (1 test)

```bash
cd backend && npm test tests/integration/repositories/
```

Expected test:

- `tests/integration/repositories/user.repository.test.ts`

**Common Issues:**

- Connection refused → Check Docker containers are running
- Migration errors → Re-run migrations with test DATABASE_URL
- Permission errors → Ensure test user has correct privileges

### Phase 3: Authentication & Security

**Goal:** Verify authentication flows and security middleware

#### Authentication Tests (3 tests)

```bash
cd backend && npm test tests/integration/auth/ tests/integration/middleware/auth.test.ts
```

Expected tests:

- `tests/integration/auth/plex-oauth.test.ts` - Plex OAuth flow
- `tests/integration/middleware/auth.test.ts` - JWT middleware
- `tests/unit/services/plex.service.test.ts` - Plex service logic

**Common Issues:**

- MSW not intercepting → Check setup.ts is properly configured
- Token validation fails → Verify JWT_SECRET is set
- Plex API mocks failing → Check MSW handlers are registered

### Phase 4: External Service Integration

**Goal:** Test all external service clients with mocked responses

#### Service Client Tests (4 tests)

```bash
cd backend && npm test tests/integration/plex/ tests/integration/overseerr/ tests/integration/uptime-kuma/
```

Expected tests:

- `tests/integration/plex/plex.client.test.ts`
- `tests/integration/overseerr/overseerr.client.test.ts`
- `tests/integration/uptime-kuma/uptime-kuma.client.test.ts`
- `tests/integration/services/external-services.integration.test.ts`

**Setup MSW handlers properly:**

```typescript
// Ensure tests/setup.ts includes:
beforeAll(() => {
  server.listen({ onUnhandledRequest: 'bypass' }); // Critical for local API calls
});
```

### Phase 5: API & Middleware Layer

**Goal:** Test API endpoints and middleware functions

#### API & Middleware Tests (4 tests)

```bash
cd backend && npm test tests/integration/api/ tests/integration/middleware/
```

Expected tests:

- `tests/integration/api/health.test.ts` - Health check endpoint
- `tests/integration/middleware/error.test.ts` - Error handling
- `tests/integration/middleware/rate-limit.test.ts` - Rate limiting
- `tests/integration/websocket/socket.test.ts` - WebSocket connections

**Common Issues:**

- Rate limit tests fail → Ensure Redis test instance is running
- WebSocket timeouts → Increase test timeout in config

### Phase 6: Frontend Component Tests

**Goal:** Verify React components render and behave correctly

#### Component Tests (17 tests)

```bash
cd frontend && npm test
```

Test groups:

1. **Dashboard Components** (5 tests)
   - ServiceCard, StatusIndicator, QuickActions, etc.
2. **Media Components** (5 tests)
   - MediaGrid, SearchInput, RequestModal, etc.
3. **Plex Components** (2 tests)
   - PlexBrowser, PlexSearch
4. **YouTube Components** (3 tests)
   - URLSubmissionForm, DownloadQueue, CollectionProgress
5. **Request Components** (1 test)
   - RequestStatusBadge

**Common Issues:**

- Socket.io mocking → Check frontend/tests/setup.ts
- Fetch not defined → Ensure global.fetch is mocked
- React hooks errors → Wrap tests with proper providers

### Phase 7: Frontend Hooks & API Integration

**Goal:** Test custom hooks and API client code

#### Hook Tests (7 tests)

```bash
cd frontend && npm test src/hooks/ src/lib/
```

Expected tests:

- WebSocket hooks (useWebSocket, useRealtimeStatus)
- API hooks (useMediaSearch, useMediaRequest)
- Utility hooks (useRateLimit, useServiceStatus)
- Socket client library

### Phase 8: End-to-End Tests (Final Validation)

**Goal:** Validate complete user flows work correctly

#### E2E Tests (3 tests)

```bash
# Ensure both frontend and backend are running
npm run dev

# In another terminal
npm run test:e2e
```

Expected tests:

- `tests/e2e/auth/auth-flow.spec.ts` - Complete auth flow
- `tests/e2e/dashboard/service-status.spec.ts` - Real-time updates
- `tests/e2e/media/media-request-flow.spec.ts` - Media requests

**Common Issues:**

- Services not running → Start with `npm run dev`
- Browser not installed → Run `npx playwright install`
- Timeouts → Increase timeout in playwright.config.ts

## Troubleshooting Guide

### Common Test Failures

#### 1. Database Connection Issues

```bash
# Check if test DB is running
docker ps | grep postgres-test

# Restart test databases
docker-compose -f docker-compose.test.yml down
docker-compose -f docker-compose.test.yml up -d

# Re-run migrations
cd backend
DATABASE_URL="postgresql://test:test@localhost:5433/medianest_test" npx prisma migrate reset --force
```

#### 2. MSW Mock Issues

```typescript
// Add to failing test file
import { server } from '../mocks/server';

beforeEach(() => {
  console.log('Registered handlers:', server.listHandlers());
});
```

#### 3. Timeout Issues

```typescript
// Increase timeout for specific test
it('should handle long operations', async () => {
  // test code
}, 30000); // 30 second timeout
```

#### 4. Port Conflicts

```bash
# Check what's using ports
lsof -i :5433  # Test PostgreSQL
lsof -i :6380  # Test Redis
lsof -i :3000  # Frontend
lsof -i :4000  # Backend
```

## Test Execution Commands

### Run All Tests in Order

```bash
# Phase 1-7: Unit and Integration Tests
npm test

# Phase 8: E2E Tests (requires running app)
npm run test:e2e
```

### Run Specific Phase

```bash
# Backend specific phase
cd backend && npm test tests/integration/auth/

# Frontend specific phase
cd frontend && npm test src/components/dashboard/
```

### Generate Coverage Report

```bash
# Full coverage report
npm run test:coverage

# Open coverage UI
npm run test:coverage:ui
```

## Success Criteria

### Minimum Acceptable Test Coverage

- **Phase 1-3**: 100% pass rate (critical infrastructure)
- **Phase 4-5**: 90% pass rate (allow some external service flakiness)
- **Phase 6-7**: 80% pass rate (UI can be more brittle)
- **Phase 8**: 70% pass rate (E2E tests are naturally flaky)

### Overall Goals

- 60% code coverage across all packages
- All authentication tests passing
- All security middleware tests passing
- Core API endpoints tested and passing
- No test takes longer than 30 seconds

## Quick Fix Script

Create `scripts/fix-tests.sh`:

```bash
#!/bin/bash
echo "🔧 Fixing common test issues..."

# Reset test environment
docker-compose -f docker-compose.test.yml down
docker-compose -f docker-compose.test.yml up -d
sleep 10

# Rebuild shared package
cd shared && npm run build && cd ..

# Reset and migrate test database
cd backend
DATABASE_URL="postgresql://test:test@localhost:5433/medianest_test" npx prisma migrate reset --force
cd ..

# Clear all caches
rm -rf frontend/.next
rm -rf backend/dist
rm -rf shared/dist

# Reinstall dependencies
npm install

echo "✅ Test environment reset. Try running tests again!"
```

## Next Steps

1. Start with Phase 1 and work through each phase sequentially
2. Fix issues in earlier phases before moving to later ones
3. Document any new issues discovered in this file
4. Once all phases pass, set up CI/CD to run tests automatically

## Notes

- Tests use MSW v2 for mocking external services
- Database tests use real PostgreSQL and Redis instances
- Frontend tests use React Testing Library with Vitest
- E2E tests require the full application to be running
