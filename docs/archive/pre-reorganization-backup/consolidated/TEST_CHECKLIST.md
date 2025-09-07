# MediaNest Test Checklist

Use this checklist when writing or reviewing tests to ensure consistency and quality.

## Before Writing Tests

- [ ] **Understand the requirement** - What user story or bug does this address?
- [ ] **Identify test type** - Unit, integration, or E2E?
- [ ] **Check existing tests** - Avoid duplication
- [ ] **Plan test cases** - Success path, error cases, edge cases

## Writing Tests

### General Requirements

- [ ] **Descriptive names** - Test names clearly explain what is being tested
- [ ] **Isolated tests** - Each test can run independently
- [ ] **No hardcoded values** - Use constants or test factories
- [ ] **Proper cleanup** - Reset state in `afterEach` hooks
- [ ] **No `.only()`** - All tests should run
- [ ] **No `console.log`** - Use proper assertions

### Unit Tests

- [ ] **Mock dependencies** - Test in isolation
- [ ] **Test public API** - Don't test implementation details
- [ ] **Cover edge cases** - Null, undefined, empty arrays
- [ ] **Test error paths** - What happens when things go wrong?
- [ ] **Fast execution** - Unit tests should be milliseconds

### Integration Tests

- [ ] **Use test database** - Port 5433, not production
- [ ] **Transaction rollback** - Or explicit cleanup
- [ ] **Mock external APIs** - Use MSW, not real services
- [ ] **Test full flow** - From request to response
- [ ] **Verify side effects** - Database changes, events emitted

### API Tests

- [ ] **Test all endpoints** - GET, POST, PUT, DELETE
- [ ] **Validate responses** - Status codes, headers, body
- [ ] **Test auth** - Both authenticated and unauthenticated
- [ ] **Input validation** - Invalid data returns 400
- [ ] **Error responses** - User-friendly error messages

## Code Quality

### Structure

- [ ] **AAA Pattern** - Arrange, Act, Assert
- [ ] **Single assertion focus** - One logical assertion per test
- [ ] **Helper functions** - Extract common setup
- [ ] **Test data factories** - Consistent test data creation

### Async Testing

- [ ] **Await async operations** - Don't forget await
- [ ] **Use waitFor** - For timing-dependent assertions
- [ ] **Set timeouts** - For slow operations
- [ ] **Handle promises** - Catch rejections properly

### Mocking

- [ ] **Mock at boundaries** - Network, database, file system
- [ ] **Verify mock calls** - Was it called with right args?
- [ ] **Reset mocks** - Between tests
- [ ] **Mock realistically** - Return realistic data

## Test Coverage

### What to Test

- [ ] **Happy path** - Normal successful flow
- [ ] **Error cases** - Invalid input, missing data
- [ ] **Edge cases** - Boundaries, limits
- [ ] **Security** - Auth, permissions, injection
- [ ] **Concurrency** - Race conditions (if applicable)

### What NOT to Test

- [ ] **Framework code** - Trust Next.js, Express work
- [ ] **Third-party libraries** - They have their own tests
- [ ] **Trivial code** - Simple getters/setters
- [ ] **UI styling** - CSS classes, colors
- [ ] **Implementation details** - Test behavior, not how

## Performance

- [ ] **Fast tests** - Under 100ms for unit tests
- [ ] **Minimal setup** - Reuse test data where possible
- [ ] **Parallel execution** - Tests don't interfere
- [ ] **Skip slow tests** - In watch mode if needed

## Documentation

- [ ] **Clear test names** - Self-documenting
- [ ] **Comments for complex** - Explain non-obvious setup
- [ ] **Update README** - If adding new test patterns
- [ ] **Example tests** - For new developers

## Before Committing

- [ ] **All tests pass** - Run full suite
- [ ] **No skipped tests** - Unless with good reason
- [ ] **Coverage maintained** - Don't reduce coverage
- [ ] **Lint passes** - Follow code style
- [ ] **No test pollution** - Tests clean up after themselves

## Review Checklist

When reviewing test PRs:

- [ ] **Tests actually test** - Not just running code
- [ ] **Meaningful assertions** - Not just "not null"
- [ ] **Error cases covered** - Both success and failure
- [ ] **Readable tests** - Can understand without deep dive
- [ ] **No flaky tests** - Consistent pass/fail

## Common Mistakes to Avoid

1. **Testing implementation instead of behavior**

   ```typescript
   // Bad
   expect(service._privateMethod()).toBe(true);

   // Good
   expect(service.isValid()).toBe(true);
   ```

2. **Not testing error cases**

   ```typescript
   // Don't just test success
   it('should handle network errors', async () => {
     mockApi.get.mockRejectedValue(new Error('Network error'));
     await expect(service.fetchData()).rejects.toThrow();
   });
   ```

3. **Overmocking**

   ```typescript
   // Bad - mocking too much
   vi.mock('entire-module');

   // Good - mock only external dependencies
   vi.mock('@/integrations/external-api');
   ```

4. **Ignoring async behavior**

   ```typescript
   // Bad
   it('updates state', () => {
     component.updateAsync();
     expect(component.state).toBe('updated'); // Might fail!
   });

   // Good
   it('updates state', async () => {
     await component.updateAsync();
     expect(component.state).toBe('updated');
   });
   ```

## Quick Commands

```bash
# Run tests for current changes
npm test -- --watch

# Run specific test file
npm test auth.test.ts

# Run with coverage
npm run test:coverage

# Debug a test
npm run test:ui

# Validate all tests
./scripts/validate-tests.sh
```

## Getting Help

- Check `backend/tests/examples/` for test examples
- Read the [Testing Guide](TESTING.md)
- Run `./scripts/test-dashboard.sh` for current status
- Ask in team chat for complex scenarios

Remember: Good tests give confidence to ship. Bad tests give false confidence. No tests give anxiety.
