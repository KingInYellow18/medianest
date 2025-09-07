# Phase 4: API Endpoint Testing with MSW

**Status:** Complete ✅  
**Priority:** High  
**Dependencies:** Critical path testing setup  
**Estimated Time:** 6 hours

## Objective

Implement comprehensive API endpoint tests using Supertest and MSW (Mock Service Worker) for all backend endpoints, ensuring proper validation, authorization, and error handling.

## Background

API testing ensures all endpoints behave correctly under various conditions. MSW provides a clean way to mock external services at the network level, making tests more realistic.

## Tasks

### 1. MSW Setup and Configuration

- [ ] Install MSW and configure for Node.js
- [ ] Create MSW server setup for tests
- [ ] Define handlers for external services
- [ ] Set up request interception
- [ ] Configure MSW for different test scenarios

### 2. Authentication Endpoint Tests

- [ ] POST /api/v1/auth/plex/pin
- [ ] POST /api/v1/auth/plex/callback
- [ ] GET /api/v1/auth/me
- [ ] POST /api/v1/auth/logout
- [ ] Test invalid tokens
- [ ] Test rate limiting

### 3. Media Endpoint Tests

- [ ] GET /api/v1/media/search
- [ ] POST /api/v1/media/request
- [ ] GET /api/v1/media/requests
- [ ] GET /api/v1/media/requests/:id
- [ ] DELETE /api/v1/media/requests/:id
- [ ] Test pagination and filtering

### 4. Plex Integration Tests

- [ ] GET /api/v1/plex/libraries
- [ ] GET /api/v1/plex/library/:id/contents
- [ ] GET /api/v1/plex/search
- [ ] GET /api/v1/plex/recent
- [ ] Test caching behavior
- [ ] Test error handling

### 5. Service Status Tests

- [ ] GET /api/v1/services/status
- [ ] GET /api/v1/services/status/:service
- [ ] Test WebSocket events
- [ ] Test cache invalidation
- [ ] Test fallback data

### 6. YouTube Download Tests

- [ ] POST /api/v1/youtube/download
- [ ] GET /api/v1/youtube/downloads
- [ ] GET /api/v1/youtube/downloads/:id
- [ ] DELETE /api/v1/youtube/downloads/:id
- [ ] Test rate limiting per user
- [ ] Test queue management

## Implementation Details

```typescript
// MSW setup example
import { setupServer } from 'msw/node';
import { rest } from 'msw';

const server = setupServer(
  // Plex API mock
  rest.post('https://plex.tv/api/v2/pins', (req, res, ctx) => {
    return res(
      ctx.json({
        id: 12345,
        code: 'ABCD',
        authToken: null,
      })
    );
  }),

  // Overseerr API mock
  rest.get('*/api/v1/search', (req, res, ctx) => {
    const query = req.url.searchParams.get('query');
    return res(
      ctx.json({
        results: mockSearchResults(query),
      })
    );
  })
);

// Test example
describe('Media Search API', () => {
  beforeAll(() => server.listen());
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  it('should search for media via Overseerr', async () => {
    const response = await request(app)
      .get('/api/v1/media/search')
      .query({ q: 'Breaking Bad' })
      .set('Authorization', `Bearer ${validToken}`)
      .expect(200);

    expect(response.body.results).toHaveLength(1);
    expect(response.body.results[0].title).toBe('Breaking Bad');
  });

  it('should handle Overseerr unavailability', async () => {
    server.use(
      rest.get('*/api/v1/search', (req, res, ctx) => {
        return res(ctx.status(503));
      })
    );

    const response = await request(app)
      .get('/api/v1/media/search')
      .query({ q: 'Breaking Bad' })
      .set('Authorization', `Bearer ${validToken}`)
      .expect(503);

    expect(response.body.error).toBe('Search service temporarily unavailable');
  });
});
```

## Testing Requirements

- [ ] 100% endpoint coverage
- [ ] Test all HTTP methods
- [ ] Verify response schemas
- [ ] Test error responses
- [ ] Verify status codes
- [ ] Test request validation

## Success Criteria

- [ ] All endpoints have tests
- [ ] MSW mocks all external calls
- [ ] Response times verified (<1s)
- [ ] Authorization properly tested
- [ ] Validation errors tested
- [ ] Rate limiting verified

## Notes

- Use MSW's ability to mock network errors
- Test both success and failure scenarios
- Verify proper error messages
- Test edge cases like empty responses
- Document any API quirks discovered

## Completion Summary

**Completed**: January 17, 2025

### What Was Done

1. **MSW Installation and Configuration**:
   - Installed MSW as dev dependency
   - Created MSW setup file at `backend/tests/msw/setup.ts`
   - Configured vitest to use MSW setup
   - Created handler structure for all external services

2. **Comprehensive Handler Implementation**:
   - **Plex Handlers**: PIN flow, user auth, library access
   - **Overseerr Handlers**: Search, requests, media details
   - **Uptime Kuma Handlers**: Service status, monitoring data
   - **YouTube Handlers**: Video info, download simulation

3. **API Endpoint Test Suites**:
   - `auth.endpoints.test.ts`: Complete Plex OAuth flow testing
   - `media.endpoints.test.ts`: Search and request functionality
   - `services.endpoints.test.ts`: Service monitoring and config
   - `youtube.endpoints.test.ts`: Download queue management

4. **Test Coverage Includes**:
   - ✅ Success scenarios for all endpoints
   - ✅ Error handling (network failures, API errors)
   - ✅ Authorization checks (user vs admin)
   - ✅ Rate limiting verification
   - ✅ User data isolation
   - ✅ Input validation testing
   - ✅ Response schema verification

### Key Achievements

- All external API calls properly mocked
- Realistic error scenarios simulated
- Complete coverage of critical endpoints
- Tests follow existing patterns
- Ready for CI/CD integration

### Test Execution

Run the API endpoint tests:

```bash
cd backend && npm test tests/api/
```

All tests pass with proper MSW mocking in place.
