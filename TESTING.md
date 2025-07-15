# MediaNest Testing Guide

## Overview

This guide outlines the comprehensive testing strategy for MediaNest, focusing on practical testing for a 10-20 user application. Our approach emphasizes testing critical paths, maintaining fast feedback loops, and ensuring reliability without over-engineering.

## Testing Philosophy

1. **Test what can break** - Focus on critical user paths and integrations
2. **Keep it simple** - Use modern tools without complex frameworks
3. **Fast feedback** - Full test suite runs in under 5 minutes
4. **Fix or delete** - No flaky tests allowed

## Test Structure

```
medianest/
├── run-all-tests.sh           # Main test orchestrator
├── vitest.workspace.ts        # Workspace test configuration
├── frontend/
│   ├── src/
│   │   ├── components/__tests__/
│   │   ├── hooks/__tests__/
│   │   └── lib/__tests__/
│   └── vitest.config.mts
├── backend/
│   ├── tests/
│   │   ├── unit/              # Business logic tests
│   │   ├── integration/       # API & service tests
│   │   ├── api/               # API endpoint tests
│   │   ├── fixtures/          # Test data
│   │   ├── mocks/             # MSW handlers
│   │   ├── helpers/           # Test utilities
│   │   ├── run-api-tests.sh   # API test runner
│   │   └── run-critical-paths.sh
│   └── vitest.config.ts
└── shared/
    └── src/
        └── __tests__/
```

## Quick Start

### Running All Tests

```bash
# Run all tests across workspaces
./run-all-tests.sh

# Run with coverage
./run-all-tests.sh --coverage

# Run in watch mode
./run-all-tests.sh --watch

# Run with UI
./run-all-tests.sh --ui
```

### Running Specific Test Suites

```bash
# Backend only
./run-all-tests.sh --workspace backend

# Critical paths only
./run-all-tests.sh --critical

# API tests only
./run-all-tests.sh --api

# Unit tests only
./run-all-tests.sh --unit

# Quick smoke tests
./run-all-tests.sh --quick
```

### Running Individual Tests

```bash
# Backend tests
cd backend
npm test                              # All backend tests
npm test auth.controller              # Tests matching pattern
npm test tests/unit/services          # Specific directory
./run-critical-paths.sh               # Critical path tests
./run-api-tests.sh                    # API endpoint tests

# Frontend tests
cd frontend
npm test                              # All frontend tests
npm test useWebSocket                 # Tests matching pattern
npm test:ui                           # Open Vitest UI

# Shared tests
cd shared
npm test                              # All shared tests
```

## Test Categories

### 1. Critical Path Tests (Priority 1)

Located in `backend/tests/integration/critical-paths/`

- **Auth Flow**: Complete Plex OAuth PIN authentication
- **Media Requests**: End-to-end media request workflow
- **Service Monitoring**: Uptime Kuma integration and status updates
- **YouTube Downloads**: Download queue and processing
- **User Isolation**: Ensure data privacy between users
- **Error Scenarios**: Graceful error handling

Run with: `./run-all-tests.sh --critical`

### 2. API Endpoint Tests (Priority 2)

Located in `backend/tests/api/`

- **Auth Endpoints**: Login, logout, session management
- **Media Endpoints**: Browse, search, request media
- **Service Endpoints**: Configuration, status checks
- **YouTube Endpoints**: Download management

Run with: `./run-all-tests.sh --api`

### 3. Unit Tests (Priority 3)

Distributed across workspaces in `__tests__` directories

- **Services**: Business logic validation
- **Repositories**: Data access patterns
- **Utils**: Helper functions and utilities
- **React Hooks**: Custom hook behavior
- **Components**: Critical UI component logic

Run with: `./run-all-tests.sh --unit`

## Writing Tests

### Backend Test Example

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { UserService } from '@/services/user.service';
import { createMockRepository } from '../helpers/mocks';

describe('UserService', () => {
  let userService: UserService;
  let mockUserRepo: ReturnType<typeof createMockRepository>;

  beforeEach(() => {
    mockUserRepo = createMockRepository();
    userService = new UserService(mockUserRepo);
  });

  it('should create user with encrypted token', async () => {
    const userData = {
      plexId: 'plex-123',
      username: 'testuser',
      email: 'test@example.com',
      plexToken: 'secret-token',
    };

    mockUserRepo.create.mockResolvedValue({
      id: 'user-123',
      ...userData,
      plexToken: 'encrypted-token',
    });

    const user = await userService.createUser(userData);

    expect(user.plexToken).not.toBe('secret-token');
    expect(mockUserRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        plexToken: expect.stringContaining('encrypted:'),
      }),
    );
  });
});
```

### Frontend Test Example

```typescript
import { renderHook, waitFor } from '@testing-library/react';
import { useServiceStatus } from '@/hooks/useServiceStatus';
import { mockWebSocket } from '../helpers/mockWebSocket';

describe('useServiceStatus', () => {
  it('should update status on WebSocket event', async () => {
    const { socket, emit } = mockWebSocket();

    const { result } = renderHook(() => useServiceStatus());

    expect(result.current.services).toEqual({});

    emit('service:status', {
      serviceId: 'plex',
      status: 'online',
      responseTime: 45,
    });

    await waitFor(() => {
      expect(result.current.services.plex).toEqual({
        status: 'online',
        responseTime: 45,
      });
    });
  });
});
```

## Test Environment

### Test Databases

The test suite uses isolated databases:

- PostgreSQL on port 5433 (test DB)
- Redis on port 6380 (test cache)

These are automatically managed by `docker-compose.test.yml`

### Environment Variables

Test environment is configured in `backend/tests/setup.ts`:

- `NODE_ENV=test`
- `DATABASE_URL` points to test database
- `REDIS_URL` points to test Redis
- Mock JWT secrets and encryption keys

### External Service Mocking

We use MSW (Mock Service Worker) for mocking external APIs:

```typescript
// backend/tests/mocks/handlers/plex.ts
import { http, HttpResponse } from 'msw';

export const plexHandlers = [
  http.post('https://plex.tv/pins.xml', () => {
    return HttpResponse.xml(`
      <pin>
        <id>12345</id>
        <code>ABCD</code>
      </pin>
    `);
  }),

  http.get('https://plex.tv/api/v2/user', () => {
    return HttpResponse.json({
      id: 'plex-user-123',
      username: 'testuser',
      email: 'test@example.com',
    });
  }),
];
```

## Coverage Goals

Target coverage by area:

| Area          | Target     | Priority |
| ------------- | ---------- | -------- |
| Auth/Security | 80%        | Critical |
| API Endpoints | 70%        | High     |
| Services      | 70%        | High     |
| Repositories  | 60%        | Medium   |
| Utilities     | 60%        | Medium   |
| UI Components | 50%        | Low      |
| **Overall**   | **60-70%** | -        |

View coverage reports:

```bash
# Generate coverage
./run-all-tests.sh --coverage

# View reports
open frontend/coverage/index.html
open backend/coverage/index.html
open shared/coverage/index.html
```

## CI/CD Integration

For GitHub Actions or other CI systems:

```yaml
# .github/workflows/test.yml
name: Test Suite

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: test
          POSTGRES_DB: medianest_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
        ports:
          - 5433:5432

      redis:
        image: redis:7
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
        ports:
          - 6380:6379

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run tests with coverage
        run: ./run-all-tests.sh --coverage

      - name: Upload coverage
        uses: codecov/codecov-action@v3
```

## Debugging Tests

### Using Vitest UI

```bash
# Backend
cd backend && npm run test:ui

# Frontend
cd frontend && npm run test:ui

# All workspaces
./run-all-tests.sh --ui
```

### VSCode Debugging

1. Install the Vitest extension
2. Use the test explorer panel
3. Set breakpoints in test files
4. Click "Debug Test" icon

### Keeping Test DB Running

```bash
# Keep containers running after tests
KEEP_TEST_DB=true ./run-all-tests.sh

# Connect to test DB
psql postgresql://test:test@localhost:5433/medianest_test

# Connect to test Redis
redis-cli -p 6380
```

## Common Issues

### Port Conflicts

If tests fail with connection errors:

```bash
# Check if ports are in use
lsof -i :5433  # Test PostgreSQL
lsof -i :6380  # Test Redis

# Stop conflicting services
docker compose -f docker-compose.test.yml down
```

### Flaky Tests

If a test fails intermittently:

1. Add proper waitFor assertions
2. Increase timeout for slow operations
3. Mock time-dependent operations
4. If still flaky, delete it

### Module Resolution

If imports fail in tests:

```bash
# Ensure TypeScript paths are built
cd backend && npm run prisma:generate
cd ../shared && npm run build
```

## Best Practices

1. **Test Naming**: Use descriptive names that explain the scenario

   ```typescript
   ✓ it('should reject expired JWT tokens')
   ✗ it('test auth')
   ```

2. **Test Data**: Use factories for consistent test data

   ```typescript
   const user = createTestUser({ role: 'admin' });
   ```

3. **Async Testing**: Always await async operations

   ```typescript
   await waitFor(() => {
     expect(result.current.isLoading).toBe(false);
   });
   ```

4. **Cleanup**: Tests should not depend on order

   ```typescript
   beforeEach(async () => {
     await prisma.user.deleteMany();
   });
   ```

5. **Mocking**: Mock at the network level when possible (MSW)
   ```typescript
   server.use(
     http.get('/api/services', () => {
       return HttpResponse.json({ services: [] });
     }),
   );
   ```

## Performance

The test suite is optimized for speed:

- Vitest runs tests in parallel
- Shared test database setup
- Minimal test data
- No heavy fixtures
- Smart test selection

Target execution times:

- Unit tests: < 30 seconds
- Integration tests: < 2 minutes
- Full suite: < 5 minutes

## Maintenance

### Adding New Tests

1. Identify the test category (unit/integration/critical)
2. Create test file in appropriate directory
3. Follow existing patterns
4. Run locally before committing
5. Update this guide if adding new patterns

### Removing Tests

If a test becomes obsolete:

1. Check if functionality still exists
2. Remove test file
3. Update any documentation
4. Verify coverage still meets targets

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [MSW Documentation](https://mswjs.io/)
- [Testing Library](https://testing-library.com/)
- [Supertest](https://github.com/visionmedia/supertest)

---

Remember: The goal is confidence in deployments, not 100% coverage. Focus on testing what matters for our users.
