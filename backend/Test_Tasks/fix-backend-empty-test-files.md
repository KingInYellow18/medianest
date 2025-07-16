# Fix: Backend Empty Test Files

## Test Failure Summary

- **Test Files**: Multiple backend test files with 0 tests
- **Test Suite**: Backend API and Integration tests
- **Test Cases**: No test cases implemented
- **Failure Type**: Empty test files causing test runner warnings
- **Priority**: MEDIUM

## Error Details

```
Empty test files detected:
- tests/api/youtube.endpoints.test.ts (0 test)
- tests/api/users.endpoints.test.ts (0 test)
- tests/api/media.endpoints.test.ts (0 test)
- tests/api/services.endpoints.test.ts (0 test)
- tests/api/auth.endpoints.test.ts (0 test)
- tests/integration/critical-paths/user-isolation.test.ts (0 test)
- tests/integration/critical-paths/youtube-download-flow.test.ts (0 test)
- tests/integration/critical-paths/error-scenarios.test.ts (0 test)
- tests/integration/critical-paths/media-request-flow.test.ts (0 test)
- tests/integration/critical-paths/service-monitoring.test.ts (0 test)
- tests/integration/auth/plex-oauth.test.ts (0 test)
- tests/integration/middleware/error.test.ts (0 test)
- tests/integration/middleware/rate-limit.test.ts (0 test)
- tests/integration/middleware/auth.test.ts (0 test)
- And many more...
```

## Root Cause Analysis

The backend has many test files created as placeholders but no actual test implementations. This indicates that while the test structure was planned, the actual test cases were never written. According to the project philosophy, we should focus on critical paths and avoid over-testing.

## Affected Code

All empty test files in the backend directory that don't contain actual test implementations.

## Suggested Fix

Based on the project's testing philosophy (60-70% coverage, focus on critical paths), we should:

1. **Delete unnecessary test files** that test simple CRUD or edge cases
2. **Keep and implement only critical path tests**:
   - Plex OAuth flow
   - Media request integration with Overseerr
   - Service monitoring with Uptime Kuma
   - Rate limiting validation
   - User data isolation

### Code Changes Required:

#### Option 1: Remove Empty Test Files (Recommended)

```bash
# Remove empty test files that aren't critical
rm backend/tests/api/users.endpoints.test.ts
rm backend/tests/unit/services/plex.service.test.ts
rm backend/tests/unit/utils/jwt.test.ts
rm backend/tests/unit/utils/retry.test.ts
rm backend/tests/unit/middleware/correlation-id.test.ts
rm backend/tests/integration/repositories/user.repository.test.ts
rm backend/tests/integration/plex/plex.client.test.ts
rm backend/src/controllers/__tests__/plex.collections.test.ts
# Keep only critical path tests
```

#### Option 2: Add Placeholder Tests to Prevent Warnings

```typescript
// For files we want to keep but implement later
import { describe, it, expect } from 'vitest';

describe.skip('Auth Endpoints', () => {
  it('should be implemented', () => {
    expect(true).toBe(true);
  });
});
```

#### Option 3: Implement Critical Path Tests (for auth.endpoints.test.ts)

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app';
import { prisma } from '../../src/lib/prisma';

describe('Auth Endpoints - Critical Paths', () => {
  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('POST /api/v1/auth/plex/pin', () => {
    it('should generate a valid Plex PIN', async () => {
      const response = await request(app).post('/api/v1/auth/plex/pin').expect(200);

      expect(response.body).toHaveProperty('pin');
      expect(response.body).toHaveProperty('authUrl');
      expect(response.body.authUrl).toContain('plex.tv/link');
    });
  });

  describe('GET /api/v1/auth/plex/check/:pinId', () => {
    it('should return pending status for unclaimed PIN', async () => {
      // This would need a mock PIN ID
      const mockPinId = 'test-pin-id';

      const response = await request(app).get(`/api/v1/auth/plex/check/${mockPinId}`).expect(200);

      expect(response.body).toHaveProperty('status', 'pending');
    });
  });
});
```

## Testing Verification

- [ ] Remove unnecessary test files
- [ ] Run tests to ensure no errors: `cd backend && npm test`
- [ ] Verify remaining tests are for critical paths only
- [ ] Ensure test execution time stays under 5 minutes

## Additional Context

- Related files: vitest.config.ts, test setup files
- Dependencies: Testing infrastructure is already set up
- Previous similar issues: Over-testing in previous projects led to maintenance burden
