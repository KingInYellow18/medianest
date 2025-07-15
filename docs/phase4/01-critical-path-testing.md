# Critical Path Testing Suite

## Overview

The critical path testing suite ensures that essential user workflows function correctly end-to-end. These tests simulate real user scenarios and verify that all components work together seamlessly.

## Test Coverage

### 1. Authentication Flow (`auth-flow.test.ts`)

**Priority: CRITICAL**

Tests the complete Plex OAuth authentication journey:

- PIN generation and display
- User authorization at plex.tv
- PIN verification and token exchange
- JWT session creation
- Token validation and refresh
- Logout and session cleanup
- Remember me functionality
- Concurrent authentication attempts
- Session expiration handling

**Key Scenarios:**

- ✅ Complete auth flow from PIN to JWT
- ✅ PIN expiration handling
- ✅ Plex service unavailability
- ✅ Invalid Plex accounts
- ✅ Session management and cleanup
- ✅ Rate limiting enforcement

### 2. Media Request Flow (`media-request-flow.test.ts`)

**Priority: HIGH**

Tests the complete media request process:

- Browsing Plex library
- Searching for media
- Creating Overseerr requests
- Request status tracking
- Notification delivery
- Request approval/denial (admin)
- Media availability updates

**Key Scenarios:**

- ✅ Browse library with proper authorization
- ✅ Search across movie/TV libraries
- ✅ Create and track requests
- ✅ Handle Overseerr unavailability
- ✅ Admin request management
- ✅ Real-time status updates via WebSocket

### 3. Service Monitoring (`service-monitoring.test.ts`)

**Priority: HIGH**

Tests service health monitoring and status reporting:

- Service configuration (admin)
- Health check execution
- Status caching and updates
- Graceful degradation
- Real-time status broadcasts
- Service recovery handling

**Key Scenarios:**

- ✅ Configure external services
- ✅ Monitor service health
- ✅ Cache status for performance
- ✅ Handle service failures gracefully
- ✅ Broadcast status updates
- ✅ Service recovery detection

### 4. YouTube Download Flow (`youtube-download-flow.test.ts`)

**Priority: MEDIUM**

Tests the YouTube download functionality:

- URL validation and metadata fetch
- Download queue management
- Progress tracking
- User download isolation
- Rate limiting (5/hour)
- Download completion/failure

**Key Scenarios:**

- ✅ Validate YouTube URLs
- ✅ Queue downloads with BullMQ
- ✅ Track download progress
- ✅ Enforce rate limits
- ✅ Isolate user downloads
- ✅ Handle download failures

### 5. User Isolation (`user-isolation.test.ts`)

**Priority: CRITICAL**

Tests data isolation between users:

- Media request visibility
- Download queue isolation
- Service configuration access
- User profile privacy
- Admin vs user permissions

**Key Scenarios:**

- ✅ Users can't see others' requests
- ✅ Download queues are isolated
- ✅ Service config requires admin
- ✅ Profile data is private
- ✅ Permission boundaries enforced

### 6. Error Scenarios (`error-scenarios.test.ts`)

**Priority: HIGH**

Tests error handling and recovery:

- Database connection failures
- Redis unavailability
- External service timeouts
- Invalid input handling
- Circuit breaker triggers
- Graceful error messages

**Key Scenarios:**

- ✅ Database failure handling
- ✅ Cache unavailability
- ✅ External API timeouts
- ✅ Input validation errors
- ✅ Circuit breaker activation
- ✅ User-friendly error messages

## Running Critical Path Tests

### Full Suite

```bash
cd backend
./run-critical-paths.sh
```

### Individual Test Files

```bash
cd backend
npx vitest run tests/integration/critical-paths/auth-flow.test.ts
```

### With Coverage

```bash
cd backend
./run-critical-paths.sh --coverage
```

### Debug Mode

```bash
cd backend
KEEP_TEST_DB=true ./run-critical-paths.sh
# Containers stay running for debugging
```

## Test Environment

- **Test Database**: PostgreSQL on port 5433
- **Test Redis**: Redis on port 6380
- **MSW**: Mock Service Worker for external APIs
- **Test Data**: Fixtures in `tests/fixtures/test-data.ts`

## Writing New Critical Path Tests

### Structure

```typescript
describe('Critical Path: [Feature Name]', () => {
  // Setup test users and data
  beforeAll(async () => {
    // Database cleanup
    // User creation
    // Service mocking
  });

  // Test the happy path first
  it('should complete [action] successfully', async () => {
    // Arrange: Set up preconditions
    // Act: Execute the workflow
    // Assert: Verify outcomes
  });

  // Test error scenarios
  it('should handle [error] gracefully', async () => {
    // Mock failure conditions
    // Verify error handling
    // Check user experience
  });

  // Test edge cases
  it('should handle [edge case]', async () => {
    // Test boundary conditions
    // Verify system stability
  });
});
```

### Best Practices

1. **Test Real Workflows**: Focus on actual user journeys, not implementation details
2. **Use Test Fixtures**: Leverage shared test data for consistency
3. **Mock External Services**: Use MSW for realistic API mocking
4. **Verify Side Effects**: Check database state, cache updates, WebSocket events
5. **Test Error Recovery**: Ensure graceful degradation and recovery
6. **Keep Tests Fast**: Use focused setups, avoid unnecessary waits

## Coverage Goals

- **Overall**: 80% coverage for critical paths
- **Authentication**: 90% (security critical)
- **Media Requests**: 85% (core feature)
- **Service Monitoring**: 80% (operational critical)
- **YouTube Downloads**: 70% (Phase 4 feature)
- **User Isolation**: 90% (privacy critical)
- **Error Handling**: 85% (UX critical)

## Continuous Integration

Critical path tests run on:

- Every pull request
- Pre-deployment validation
- Nightly regression runs
- Manual trigger for debugging

Tests must pass before:

- Merging to main branch
- Deploying to production
- Major version releases

## Maintenance

### Monthly Review

- Update test data for new features
- Remove obsolete test scenarios
- Optimize slow-running tests
- Update MSW handlers for API changes

### Quarterly Audit

- Review coverage metrics
- Identify missing scenarios
- Update error message assertions
- Refactor shared test utilities
