# Fix: Complete MSW v2 Migration for All Handler Files

## Test Failure Summary

- **Test File**: All files in backend/tests/msw/handlers/
- **Test Suite**: All backend integration and API tests
- **Test Case**: N/A - Module loading failure
- **Failure Type**: Import Error - MSW v1 to v2 Breaking Changes
- **Priority**: Critical

## Error Details

```
TypeError: Cannot read properties of undefined (reading 'post')
 ❯ tests/msw/handlers/plex.handlers.ts:7:8
```

## Root Cause Analysis

All MSW handler files are using MSW v1 syntax, but the project has MSW v2 (^2.10.4) installed. This affects:

- plex.handlers.ts
- overseerr.handlers.ts
- uptime-kuma.handlers.ts
- youtube.handlers.ts
- index.ts (exports all handlers)

## Affected Code

All handler files need migration from:

- `import { rest } from 'msw'` → `import { http, HttpResponse } from 'msw'`
- `rest.get/post` → `http.get/post`
- `(req, res, ctx) => res(ctx.json())` → `() => HttpResponse.json()`
- `req.params` → `({ params })`
- `req.headers.get()` → `({ request }) => request.headers.get()`

## Suggested Fix

Complete migration of all MSW handlers to v2 syntax.

### Code Changes Required:

1. Update `backend/tests/msw/handlers/index.ts`:

```typescript
import { plexHandlers } from './plex.handlers';
import { overseerrHandlers } from './overseerr.handlers';
import { uptimeKumaHandlers } from './uptime-kuma.handlers';
import { youtubeHandlers } from './youtube.handlers';

export const handlers = [
  ...plexHandlers,
  ...overseerrHandlers,
  ...uptimeKumaHandlers,
  ...youtubeHandlers,
];
```

2. Update `backend/tests/msw/handlers/overseerr.handlers.ts`:

```typescript
import { http, HttpResponse } from 'msw';

const OVERSEERR_API_BASE = 'http://localhost:5055/api/v1';

export const overseerrHandlers = [
  // Get server status
  http.get(`${OVERSEERR_API_BASE}/status`, () => {
    return HttpResponse.json({
      version: '1.33.2',
      commitTag: 'test-commit',
      updateAvailable: false,
      commitsBehind: 0,
    });
  }),

  // Get settings
  http.get(`${OVERSEERR_API_BASE}/settings/public`, () => {
    return HttpResponse.json({
      initialized: true,
      applicationTitle: 'Overseerr Test',
      applicationUrl: 'http://localhost:5055',
      hideAvailable: false,
      movie4kEnabled: false,
      series4kEnabled: false,
      region: 'US',
      originalLanguage: 'en',
    });
  }),

  // Search multi
  http.get(`${OVERSEERR_API_BASE}/search`, ({ request }) => {
    const url = new URL(request.url);
    const query = url.searchParams.get('query');

    if (!query) {
      return HttpResponse.json({ error: 'Query required' }, { status: 400 });
    }

    return HttpResponse.json({
      page: 1,
      totalPages: 1,
      totalResults: 2,
      results: [
        {
          id: 1,
          mediaType: 'movie',
          title: 'Test Movie',
          overview: 'A test movie',
          releaseDate: '2023-01-01',
          mediaInfo: {
            status: 'available',
            requests: [],
          },
        },
        {
          id: 2,
          mediaType: 'tv',
          name: 'Test Show',
          overview: 'A test show',
          firstAirDate: '2023-01-01',
          mediaInfo: {
            status: 'partially_available',
            requests: [],
          },
        },
      ],
    });
  }),

  // Create request
  http.post(`${OVERSEERR_API_BASE}/request`, async ({ request }) => {
    const body = await request.json();

    return HttpResponse.json(
      {
        id: 123,
        type: body.mediaType,
        mediaId: body.mediaId,
        status: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        requestedBy: {
          id: 1,
          displayName: 'Test User',
          email: 'test@example.com',
        },
      },
      { status: 201 },
    );
  }),

  // Get request by ID
  http.get(`${OVERSEERR_API_BASE}/request/:id`, ({ params }) => {
    const { id } = params;

    return HttpResponse.json({
      id: Number(id),
      type: 'movie',
      mediaId: 456,
      status: 'approved',
      createdAt: '2023-01-01T00:00:00Z',
      updatedAt: '2023-01-01T00:00:00Z',
      requestedBy: {
        id: 1,
        displayName: 'Test User',
        email: 'test@example.com',
      },
      media: {
        id: 456,
        tmdbId: 456,
        tvdbId: null,
        imdbId: 'tt1234567',
        status: 'available',
        mediaType: 'movie',
      },
    });
  }),
];
```

3. Update `backend/tests/msw/handlers/uptime-kuma.handlers.ts`:

```typescript
import { http, HttpResponse } from 'msw';

const UPTIME_KUMA_API_BASE = 'http://localhost:3001/api';

export const uptimeKumaHandlers = [
  // Get all monitors
  http.get(`${UPTIME_KUMA_API_BASE}/monitors`, () => {
    return HttpResponse.json([
      {
        id: 1,
        name: 'Plex Server',
        type: 'http',
        url: 'http://plex.local:32400',
        interval: 60,
        retryInterval: 60,
        maxretries: 3,
        active: true,
        status: 'up',
        lastCheck: new Date().toISOString(),
        uptime: 99.95,
        avgPing: 25,
      },
      {
        id: 2,
        name: 'Overseerr',
        type: 'http',
        url: 'http://localhost:5055',
        interval: 60,
        retryInterval: 60,
        maxretries: 3,
        active: true,
        status: 'up',
        lastCheck: new Date().toISOString(),
        uptime: 100,
        avgPing: 15,
      },
    ]);
  }),

  // Get monitor by ID
  http.get(`${UPTIME_KUMA_API_BASE}/monitors/:id`, ({ params }) => {
    const { id } = params;

    return HttpResponse.json({
      id: Number(id),
      name: 'Test Monitor',
      type: 'http',
      url: 'http://test.local',
      interval: 60,
      retryInterval: 60,
      maxretries: 3,
      active: true,
      status: 'up',
      lastCheck: new Date().toISOString(),
      uptime: 99.99,
      avgPing: 20,
      heartbeats: [
        {
          time: new Date().toISOString(),
          status: 1,
          msg: 'OK',
          ping: 20,
        },
      ],
    });
  }),

  // Get status page
  http.get(`${UPTIME_KUMA_API_BASE}/status-page`, () => {
    return HttpResponse.json({
      incident: null,
      publicGroupList: [
        {
          id: 1,
          name: 'Media Services',
          monitorList: [
            { id: 1, name: 'Plex Server', status: 'up' },
            { id: 2, name: 'Overseerr', status: 'up' },
          ],
        },
      ],
    });
  }),
];
```

4. Update `backend/tests/msw/handlers/youtube.handlers.ts`:

```typescript
import { http, HttpResponse } from 'msw';

export const youtubeHandlers = [
  // YouTube info extraction
  http.post('/api/v1/youtube/extract-info', async ({ request }) => {
    const body = await request.json();
    const { url } = body;

    if (!url || !url.includes('youtube.com')) {
      return HttpResponse.json({ error: 'Invalid YouTube URL' }, { status: 400 });
    }

    return HttpResponse.json({
      id: 'dQw4w9WgXcQ',
      title: 'Test Video',
      duration: 212,
      uploader: 'Test Channel',
      thumbnail: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg',
      description: 'Test video description',
      upload_date: '20230101',
      view_count: 1000000,
      like_count: 50000,
      formats: [
        {
          format_id: '22',
          ext: 'mp4',
          quality: 720,
          filesize: 50000000,
        },
        {
          format_id: '18',
          ext: 'mp4',
          quality: 360,
          filesize: 20000000,
        },
      ],
    });
  }),

  // Get download queue
  http.get('/api/v1/youtube/downloads', ({ request }) => {
    const authHeader = request.headers.get('Authorization');

    if (!authHeader) {
      return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return HttpResponse.json({
      downloads: [
        {
          id: '123',
          url: 'https://youtube.com/watch?v=dQw4w9WgXcQ',
          status: 'downloading',
          progress: 45,
          metadata: {
            title: 'Test Video',
            duration: 212,
            uploader: 'Test Channel',
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      total: 1,
    });
  }),

  // Start download
  http.post('/api/v1/youtube/download', async ({ request }) => {
    const authHeader = request.headers.get('Authorization');

    if (!authHeader) {
      return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    return HttpResponse.json(
      {
        id: '456',
        url: body.url,
        status: 'queued',
        progress: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      { status: 201 },
    );
  }),

  // Cancel download
  http.delete('/api/v1/youtube/downloads/:id', ({ params }) => {
    const { id } = params;

    return HttpResponse.json({
      message: `Download ${id} cancelled successfully`,
    });
  }),
];
```

## Testing Verification

- [ ] Run the specific test: `cd backend && npm test tests/msw`
- [ ] Verify no regression: `cd backend && npm test`
- [ ] Check test coverage remains above threshold
- [ ] Ensure fix follows project patterns

## Additional Context

- Related files: All test files that import these handlers
- Dependencies: MSW v2.10.4 is already installed
- Previous similar issues: This completes the MSW v1 to v2 migration for all handler files
