# MediaNest Testing Suite Overview

## Phase 4 Testing Implementation

This document provides an overview of the comprehensive testing suite implemented for MediaNest, focusing on critical path testing and API endpoint validation.

## Test Architecture

```
backend/tests/
├── integration/
│   ├── critical-paths/      # End-to-end user workflows
│   ├── middleware/          # Auth, rate limiting, error handling
│   ├── services/            # External service integration
│   └── websocket/           # Real-time functionality
├── api/                     # REST API endpoint tests
├── unit/                    # Business logic tests
├── fixtures/                # Shared test data
├── helpers/                 # Test utilities
└── mocks/                   # MSW server setup
```

## Testing Philosophy

### 1. User-Centric Testing

- Focus on real user journeys, not implementation details
- Test what users actually do, not how the system does it
- Ensure graceful error handling for better UX

### 2. Pragmatic Coverage

- Target 60-70% overall coverage
- 80-90% for security-critical paths (auth, user isolation)
- Skip testing third-party libraries and simple getters/setters

### 3. Fast Feedback

- Total test suite runs in <5 minutes
- Critical paths tested on every commit
- Parallel test execution where possible

## Test Types

### Critical Path Tests

**Purpose**: Validate complete user workflows function correctly

**Coverage**:

- Authentication flow (PIN → JWT → Session)
- Media request lifecycle
- Service health monitoring
- YouTube download process
- User data isolation
- Error recovery scenarios

**Execution**: `./run-critical-paths.sh`

### API Endpoint Tests

**Purpose**: Ensure REST API contract compliance

**Coverage**:

- Request validation (Zod schemas)
- Response format consistency
- Authentication/authorization
- Rate limiting enforcement
- Error response standards
- CORS and security headers

**Execution**: `npm test tests/api/`

### Integration Tests

**Purpose**: Verify component interactions

**Coverage**:

- Database operations (Prisma)
- Cache operations (Redis)
- Queue processing (BullMQ)
- External APIs (Plex, Overseerr)
- WebSocket connections

**Execution**: `npm test tests/integration/`

### Unit Tests

**Purpose**: Test isolated business logic

**Coverage**:

- Utility functions
- Service methods
- Data transformations
- Validation logic
- Error handling

**Execution**: `npm test tests/unit/`

## Test Environment

### Infrastructure

- **Test Database**: PostgreSQL on port 5433
- **Test Redis**: Redis on port 6380
- **Containers**: Managed via docker-compose.test.yml
- **Mocking**: MSW for HTTP, vi.mock for modules

### Configuration

```bash
# Environment variables for tests
NODE_ENV=test
DATABASE_URL=postgresql://test:test@localhost:5433/medianest_test
REDIS_URL=redis://localhost:6380
LOG_LEVEL=error  # Reduce noise during tests
```

## Key Testing Patterns

### 1. Authentication Testing

```typescript
// Generate test JWT
const token = global.createTestJWT({
  userId: user.id,
  role: 'admin',
});

// Test protected endpoints
await request(app).get('/api/v1/protected').set('Authorization', `Bearer ${token}`).expect(200);
```

### 2. External Service Mocking

```typescript
// Mock Plex API with MSW
server.use(
  http.get('https://plex.tv/*', () => {
    return HttpResponse.json(mockPlexResponse);
  }),
);
```

### 3. Database Cleanup

```typescript
beforeEach(async () => {
  await prisma.user.deleteMany();
  await redis.flushDb();
});
```

### 4. Error Scenario Testing

```typescript
it('should handle service unavailability', async () => {
  server.use(
    http.get('*', () => {
      return HttpResponse.json({ error: 'Service Unavailable' }, { status: 503 });
    }),
  );
  // Test graceful degradation
});
```

## Running Tests

### Development Workflow

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Watch mode for TDD
npm run test:watch

# Run specific test file
npx vitest run tests/api/auth.endpoints.test.ts

# Debug with UI
npm run test:ui
```

### CI/CD Pipeline

```bash
# Critical paths only (fast feedback)
./run-critical-paths.sh

# Full test suite
npm test

# Generate coverage report
npm run test:coverage -- --reporter=lcov
```

## Test Data Management

### Fixtures

- Located in `tests/fixtures/test-data.ts`
- Consistent test users, media items, configurations
- Realistic data that matches production patterns

### Test User Accounts

```typescript
export const testUsers = {
  regular: {
    plexId: 'test-user-123',
    username: 'testuser',
    email: 'test@example.com',
    role: 'user',
  },
  admin: {
    plexId: 'test-admin-456',
    username: 'testadmin',
    email: 'admin@example.com',
    role: 'admin',
  },
};
```

## Coverage Goals

### By Component

- **Authentication**: 90% (security critical)
- **API Endpoints**: 85% (contract critical)
- **User Isolation**: 90% (privacy critical)
- **External Services**: 80% (integration critical)
- **Error Handling**: 85% (UX critical)
- **Background Jobs**: 70% (async processing)

### Overall Target

- **Line Coverage**: 70%
- **Branch Coverage**: 65%
- **Function Coverage**: 75%

## Best Practices

### DO

- ✅ Test user-visible behavior
- ✅ Use descriptive test names
- ✅ Keep tests focused and fast
- ✅ Mock external dependencies
- ✅ Test error paths thoroughly
- ✅ Use fixtures for consistency

### DON'T

- ❌ Test implementation details
- ❌ Rely on test execution order
- ❌ Use production services
- ❌ Skip error scenarios
- ❌ Leave console.logs in tests
- ❌ Use arbitrary delays/sleeps

## Debugging Failed Tests

### 1. Run Single Test

```bash
npx vitest run tests/api/auth.endpoints.test.ts -t "should generate PIN"
```

### 2. Enable Debug Logging

```bash
LOG_LEVEL=debug npm test
```

### 3. Keep Test Database Running

```bash
KEEP_TEST_DB=true ./run-critical-paths.sh
# Inspect database with: npm run db:studio
```

### 4. Use Vitest UI

```bash
npm run test:ui
# Opens browser with interactive test runner
```

## Maintenance Schedule

### Daily

- Monitor CI test results
- Fix any flaky tests immediately

### Weekly

- Review test execution times
- Update fixtures if needed

### Monthly

- Audit test coverage metrics
- Remove obsolete tests
- Add tests for new features

### Quarterly

- Full test suite performance review
- Update MSW handlers for API changes
- Refactor common test patterns

## Next Steps

1. **Implement YouTube Backend Tests**

   - Complete `youtube.endpoints.test.ts`
   - Add YouTube worker process tests
   - Test download file management

2. **Add Performance Tests**

   - Response time benchmarks
   - Concurrent user simulations
   - Database query optimization

3. **Enhance Error Testing**

   - More edge case scenarios
   - Network failure simulations
   - Recovery mechanism validation

4. **Improve Test Reporting**
   - Better coverage visualization
   - Test execution trends
   - Failure pattern analysis
