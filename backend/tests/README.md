# Backend Test Suite

This directory contains the test suite for the MediaNest backend, following the simplified testing approach outlined in the project's test architecture.

## Test Structure

```
tests/
├── unit/              # Business logic and utility tests
├── integration/       # API endpoints and service integration tests
├── helpers/           # Test utilities and setup helpers
├── fixtures/          # Test data and constants
└── mocks/            # MSW handlers for external services
```

## Running Tests

### Prerequisites

1. Start the test database and Redis:

```bash
cd /home/kinginyellow/projects/medianest
docker-compose -f docker-compose.test.yml up -d
```

2. Install dependencies:

```bash
cd backend
npm install
```

### Run Tests

```bash
# Run all tests
npm test

# Run tests in watch mode (development)
npm run test:watch

# Run tests with UI (debugging)
npm run test:ui

# Run tests with coverage
npm run test:coverage
```

## Test Coverage Goals

- **Overall**: 60-70% coverage
- **Auth/Security**: 80% coverage
- **Test execution**: Under 5 minutes

## Critical Path Tests

The following areas have the highest priority for testing:

1. **Plex OAuth PIN Flow** - The primary authentication method
2. **JWT Token Management** - Session and remember me functionality
3. **Rate Limiting** - Protects against abuse
4. **Repository Pattern** - Data access layer
5. **Error Handling** - User-friendly error messages

## Writing Tests

### Test Principles

1. **Test what can break** - Focus on critical paths and integrations
2. **Keep it simple** - Use built-in tools, avoid complex frameworks
3. **Fast feedback** - Tests should run quickly
4. **Fix or delete** - No flaky tests allowed

### Example Test Structure

```typescript
import { describe, it, expect, beforeEach } from 'vitest';

describe('Feature Name', () => {
  beforeEach(() => {
    // Setup
  });

  it('should do something specific', async () => {
    // Arrange
    const input = {
      /* test data */
    };

    // Act
    const result = await functionUnderTest(input);

    // Assert
    expect(result).toMatchObject({
      /* expected */
    });
  });
});
```

## Mocking External Services

We use MSW (Mock Service Worker) for mocking external APIs:

```typescript
// In tests/mocks/handlers.ts
export const handlers = [
  http.post('https://plex.tv/pins.xml', () => {
    return HttpResponse.text(`<pin>...</pin>`);
  }),
];
```

## Test Database

The test suite uses a separate PostgreSQL instance running on port 5433 and Redis on port 6380. These are automatically cleaned between test runs.

## Debugging Tests

1. Use the Vitest UI: `npm run test:ui`
2. Add `console.log` statements
3. Use VS Code's debugger with the Vitest extension
4. Check test output for detailed error messages

## Common Issues

1. **Database connection errors**: Ensure docker-compose.test.yml is running
2. **Port conflicts**: Check ports 5433 and 6380 are available
3. **Module resolution**: Check tsconfig paths are configured correctly
