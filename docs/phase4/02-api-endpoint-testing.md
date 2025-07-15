# API Endpoint Testing Suite

## Overview

The API endpoint testing suite ensures all REST API endpoints follow specifications, handle edge cases properly, and maintain backward compatibility. These tests focus on HTTP request/response contracts, validation, and error handling.

## Test Coverage by Module

### 1. Authentication Endpoints (`auth.endpoints.test.ts`)

#### POST /api/v1/auth/plex/pin

- ✅ Generates valid 4-character PIN
- ✅ Returns PIN ID and expiration
- ✅ Includes QR code URL
- ✅ Handles Plex API errors (503)
- ✅ Includes rate limit headers
- ✅ CORS headers for frontend

#### POST /api/v1/auth/plex/verify

- ✅ Validates PIN ID format
- ✅ Exchanges authorized PIN for JWT
- ✅ Creates user session
- ✅ Sets secure HTTP-only cookie
- ✅ Handles unauthorized PINs (401)
- ✅ Validates request body with Zod
- ✅ Supports remember me option

#### GET /api/v1/auth/session

- ✅ Returns current user session
- ✅ Requires valid JWT token
- ✅ Excludes sensitive data (plexToken)
- ✅ Handles expired tokens (401)
- ✅ Validates session in database

#### POST /api/v1/auth/logout

- ✅ Invalidates current session
- ✅ Clears auth cookie
- ✅ Removes session from database
- ✅ Requires authentication
- ✅ Handles multiple logout attempts

### 2. Media Endpoints (`media.endpoints.test.ts`)

#### GET /api/v1/media/library

- ✅ Lists user's Plex libraries
- ✅ Requires authentication
- ✅ Filters by media type (movie/show/music)
- ✅ Includes library metadata
- ✅ Handles Plex unavailability
- ✅ Caches library data (5 min)

#### GET /api/v1/media/library/:libraryId/items

- ✅ Lists items in specific library
- ✅ Supports pagination (offset/limit)
- ✅ Includes sorting options
- ✅ Returns item metadata
- ✅ Handles invalid library IDs
- ✅ Respects user permissions

#### GET /api/v1/media/search

- ✅ Searches across libraries
- ✅ Requires query parameter
- ✅ Supports type filtering
- ✅ Returns relevance-sorted results
- ✅ Handles special characters
- ✅ Implements result limits

#### POST /api/v1/media/requests

- ✅ Creates Overseerr request
- ✅ Validates media type and ID
- ✅ Checks existing requests
- ✅ Returns request status
- ✅ Sends confirmation email
- ✅ Broadcasts WebSocket update

#### GET /api/v1/media/requests

- ✅ Lists user's requests
- ✅ Supports status filtering
- ✅ Includes request metadata
- ✅ Paginates results
- ✅ Sorts by date
- ✅ Admin sees all requests

### 3. Services Endpoints (`services.endpoints.test.ts`)

#### GET /api/v1/services/status

- ✅ Returns all service statuses
- ✅ Uses cached data when fresh
- ✅ Triggers health checks if stale
- ✅ Includes service metadata
- ✅ Handles partial failures
- ✅ No auth required (public)

#### GET /api/v1/services/:serviceId/status

- ✅ Returns specific service status
- ✅ Validates service ID
- ✅ Includes detailed health info
- ✅ Shows last check timestamp
- ✅ Returns 404 for unknown services

#### POST /api/v1/services/:serviceId/configure

- ✅ Admin-only endpoint
- ✅ Validates configuration schema
- ✅ Encrypts sensitive data
- ✅ Tests connection before saving
- ✅ Returns sanitized config
- ✅ Triggers status refresh

#### DELETE /api/v1/services/:serviceId/configure

- ✅ Admin-only endpoint
- ✅ Removes service configuration
- ✅ Clears related cache
- ✅ Returns 404 if not configured
- ✅ Handles service dependencies

### 4. YouTube Endpoints (`youtube.endpoints.test.ts`)

#### POST /api/v1/youtube/downloads

- ✅ Validates YouTube URL format
- ✅ Fetches video metadata
- ✅ Enforces rate limit (5/hour)
- ✅ Queues download job
- ✅ Returns job ID and status
- ✅ Prevents duplicate downloads

#### GET /api/v1/youtube/downloads

- ✅ Lists user's downloads
- ✅ Shows download progress
- ✅ Filters by status
- ✅ Includes video metadata
- ✅ Sorts by date
- ✅ Paginates results

#### GET /api/v1/youtube/downloads/:downloadId

- ✅ Returns specific download
- ✅ Validates ownership
- ✅ Shows detailed progress
- ✅ Includes error details
- ✅ Returns 404 if not found

#### DELETE /api/v1/youtube/downloads/:downloadId

- ✅ Cancels pending download
- ✅ Validates ownership
- ✅ Removes from queue
- ✅ Cleans up partial files
- ✅ Returns 400 if completed

### 5. User Endpoints (`users.endpoints.test.ts`)

#### GET /api/v1/users/profile

- ✅ Returns current user profile
- ✅ Excludes sensitive data
- ✅ Includes preferences
- ✅ Shows account status
- ✅ Requires authentication

#### PATCH /api/v1/users/profile

- ✅ Updates user preferences
- ✅ Validates input fields
- ✅ Prevents role changes
- ✅ Returns updated profile
- ✅ Logs profile changes

#### GET /api/v1/users (Admin)

- ✅ Lists all users
- ✅ Admin-only access
- ✅ Supports filtering
- ✅ Includes user stats
- ✅ Paginates results

#### PATCH /api/v1/users/:userId (Admin)

- ✅ Updates user status/role
- ✅ Admin-only access
- ✅ Validates changes
- ✅ Logs admin actions
- ✅ Handles self-modification

## Common Test Patterns

### Request Validation

```typescript
it('should validate request body', async () => {
  const invalidRequests = [
    { body: {}, expectedError: 'field is required' },
    { body: { field: '' }, expectedError: 'too short' },
    { body: { field: 'x'.repeat(101) }, expectedError: 'too long' },
    { body: { extra: 'field' }, expectedError: 'Unknown field' },
  ];

  for (const { body, expectedError } of invalidRequests) {
    const response = await request(app).post('/api/v1/endpoint').send(body).expect(400);

    expect(response.body.error).toContain(expectedError);
  }
});
```

### Authentication Testing

```typescript
it('should require authentication', async () => {
  await request(app).get('/api/v1/protected').expect(401);
});

it('should accept valid token', async () => {
  await request(app)
    .get('/api/v1/protected')
    .set('Authorization', `Bearer ${validToken}`)
    .expect(200);
});
```

### Error Response Testing

```typescript
it('should return user-friendly error', async () => {
  // Mock service failure
  server.use(
    http.get('*', () => {
      return HttpResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }),
  );

  const response = await request(app).get('/api/v1/endpoint').expect(503);

  expect(response.body).toMatchObject({
    error: 'Service temporarily unavailable',
    service: expect.any(String),
    retryAfter: expect.any(Number),
  });
});
```

### Rate Limit Testing

```typescript
it('should enforce rate limits', async () => {
  const requests = Array(11)
    .fill(null)
    .map(() => request(app).post('/api/v1/limited'));

  const responses = await Promise.all(requests);
  const rateLimited = responses.filter((r) => r.status === 429);

  expect(rateLimited).toHaveLength(1);
  expect(rateLimited[0].headers['retry-after']).toBeDefined();
});
```

## Running API Tests

### Full Suite

```bash
cd backend
npm test tests/api/
```

### Specific Endpoint Group

```bash
cd backend
npx vitest run tests/api/auth.endpoints.test.ts
```

### Watch Mode for Development

```bash
cd backend
npx vitest tests/api/ --watch
```

### With Coverage Report

```bash
cd backend
npx vitest run tests/api/ --coverage
```

## Test Utilities

### Helper Functions (`tests/helpers/`)

- `createTestJWT()`: Generate valid test tokens
- `createTestUser()`: Create test users with defaults
- `mockExternalService()`: Configure MSW handlers
- `expectErrorResponse()`: Validate error format

### Fixtures (`tests/fixtures/`)

- Sample media items
- Mock service configurations
- Test user data
- YouTube video metadata

## Best Practices

1. **Test Contract, Not Implementation**

   - Focus on request/response format
   - Verify HTTP status codes
   - Check response headers
   - Validate response body structure

2. **Cover Edge Cases**

   - Empty/null values
   - Maximum length inputs
   - Special characters
   - Concurrent requests
   - Rate limit boundaries

3. **Maintain Test Independence**

   - Each test should be self-contained
   - Clean up test data after each test
   - Don't rely on test execution order
   - Use unique identifiers for test data

4. **Mock External Dependencies**

   - Use MSW for HTTP mocking
   - Mock Redis/BullMQ appropriately
   - Simulate various failure scenarios
   - Test timeout handling

5. **Verify Security**
   - Authentication requirements
   - Authorization boundaries
   - Input sanitization
   - Sensitive data exclusion
   - CORS headers

## API Documentation Sync

Tests serve as living documentation:

- Response examples from tests
- Error scenarios documented
- Rate limits verified
- Required headers specified
- Query parameters validated

## Performance Considerations

- Keep individual tests under 100ms
- Use parallel test execution
- Minimize database operations
- Cache test user tokens
- Reuse MSW server instance

## Maintenance Checklist

### When Adding New Endpoints

1. Create test file in `tests/api/`
2. Test all HTTP methods
3. Validate request body/params
4. Check authentication/authorization
5. Test error scenarios
6. Verify rate limiting
7. Document response format
8. Add to CI test suite

### When Modifying Endpoints

1. Update existing tests first
2. Add tests for new behavior
3. Ensure backward compatibility
4. Update API documentation
5. Run full test suite
6. Check coverage metrics
