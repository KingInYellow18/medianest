# Fix: MSW REST Import Migration

## Test Failure Summary

- **Test File**: backend/tests/msw/handlers/plex.handlers.ts
- **Test Suite**: All backend tests (22 test files)
- **Test Case**: N/A - Module loading failure
- **Failure Type**: Import Error
- **Priority**: Critical

## Error Details

```
TypeError: Cannot read properties of undefined (reading 'post')
 ❯ tests/msw/handlers/plex.handlers.ts:7:8
      5| export const plexHandlers = [
      6|   // PIN generation
      7|   rest.post(`${PLEX_API_BASE}/pins`, (req, res, ctx) => {
       |        ^
      8|     return res(
      9|       ctx.json({
```

## Root Cause Analysis

The code is using MSW v1 syntax but the project has MSW v2 installed (^2.10.4). MSW v2 introduced breaking changes in the API:

- The `rest` namespace was replaced with `http`
- Handler signatures changed significantly
- Response creation methods were updated

## Affected Code

```typescript
// File: backend/tests/msw/handlers/plex.handlers.ts
// Lines: 1-242
import { rest } from 'msw';  // OLD MSW v1 syntax

export const plexHandlers = [
  rest.post(`${PLEX_API_BASE}/pins`, (req, res, ctx) => {
    return res(
      ctx.json({...})
    );
  }),
  // ... more handlers using old syntax
];
```

## Suggested Fix

Migration to MSW v2 syntax is required. The handlers need to be updated to use the new API.

### Code Changes Required:

```typescript
// Update the import to use MSW v2
import { http, HttpResponse } from 'msw';

const PLEX_API_BASE = 'https://plex.tv/api/v2';

export const plexHandlers = [
  // PIN generation
  http.post(`${PLEX_API_BASE}/pins`, () => {
    return HttpResponse.json({
      id: 123456,
      code: 'TEST-CODE',
      product: 'MediaNest',
      trusted: false,
      qr: 'https://plex.tv/link/qr/TEST-CODE',
      clientIdentifier: 'test-client-id',
      location: {
        code: 'US',
        european_union_member: false,
        continent_code: 'NA',
        country: 'United States',
        city: 'New York',
        time_zone: 'America/New_York',
        postal_code: '10001',
        subdivisions: 'NY',
        coordinates: '40.7128,-74.0060',
      },
      expiresIn: 1800,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 1800000).toISOString(),
      authToken: null,
      newRegistration: false,
    });
  }),

  // PIN check handler
  http.get(`${PLEX_API_BASE}/pins/:pinId`, ({ params }) => {
    const { pinId } = params;

    if (pinId === '123456') {
      return HttpResponse.json({
        // ... pin data
      });
    }

    if (pinId === '999999') {
      return HttpResponse.json({
        // ... authorized pin data
      });
    }

    return HttpResponse.json({ error: 'PIN not found' }, { status: 404 });
  }),

  // User info handler
  http.get(`${PLEX_API_BASE}/user`, ({ request }) => {
    const authHeader = request.headers.get('X-Plex-Token');

    if (authHeader === 'test-auth-token-123') {
      return HttpResponse.json({
        // ... user data
      });
    }

    return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }),

  // Library sections - XML response
  http.get('*/library/sections', ({ request }) => {
    const authHeader = request.headers.get('X-Plex-Token');

    if (!authHeader) {
      return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return new HttpResponse(
      `<?xml version="1.0" encoding="UTF-8"?>
<MediaContainer size="3">
  <!-- XML content -->
</MediaContainer>`,
      {
        headers: {
          'Content-Type': 'application/xml',
        },
      },
    );
  }),

  // Search handler
  http.get('*/search', ({ request }) => {
    const url = new URL(request.url);
    const authHeader = request.headers.get('X-Plex-Token');
    const query = url.searchParams.get('query');

    if (!authHeader) {
      return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!query) {
      return HttpResponse.json({ error: 'Query parameter required' }, { status: 400 });
    }

    return new HttpResponse(
      `<?xml version="1.0" encoding="UTF-8"?>
<MediaContainer size="2">
  <!-- XML content -->
</MediaContainer>`,
      {
        headers: {
          'Content-Type': 'application/xml',
        },
      },
    );
  }),
];
```

## Testing Verification

- [ ] Run the specific test: `cd backend && npm test tests/msw/handlers/plex.handlers.ts`
- [ ] Verify no regression: `cd backend && npm test`
- [ ] Check test coverage remains above threshold
- [ ] Ensure fix follows project patterns

## Additional Context

- Related files: All handler files in `backend/tests/msw/handlers/` directory need similar updates
- Dependencies: MSW v2.10.4 is already installed
- Previous similar issues: This is a breaking change from MSW v1 to v2 migration
