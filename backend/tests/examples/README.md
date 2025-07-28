# Test Examples

This directory contains example test files demonstrating best practices for different types of tests in the MediaNest project.

## Test Types

1. **unit-test.example.ts** - Unit testing a service with mocked dependencies
2. **integration-test.example.ts** - Integration testing with real database
3. **api-test.example.ts** - API endpoint testing with supertest
4. **websocket-test.example.ts** - WebSocket event testing
5. **external-service-test.example.ts** - Testing external API integrations with MSW

## Key Patterns

### Mocking

- Use Vitest's `vi.mock()` for module mocking
- Use MSW for HTTP request mocking
- Create test factories for consistent test data

### Async Testing

- Always use `async/await` for async operations
- Use `waitFor` for timing-dependent assertions
- Set appropriate timeouts for slow operations

### Database Testing

- Use transactions for test isolation
- Clean up data in `afterEach` hooks
- Use the test database on port 5433

### Error Testing

- Test both success and failure paths
- Verify error messages are user-friendly
- Ensure proper error status codes

## Running Examples

These are example files for reference only. To see real tests in action:

```bash
# Run backend tests
cd backend && npm test

# Run specific test pattern
npm test -- auth

# Run with coverage
npm run test:coverage
```
