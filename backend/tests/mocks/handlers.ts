import { http, HttpResponse, delay } from 'msw';

// Test state for controlling mock responses
export const mockState = {
  plexDown: false,
  plexSlowResponse: false,
  overseerrDown: false,
  overseerrSlowResponse: false,
  failureCount: 0,
  resetFailures: () => {
    mockState.failureCount = 0;
  },
};

export const handlers = [
  // =========================
  // PLEX API ENDPOINTS
  // =========================

  // Plex OAuth PIN endpoints
  http.post('https://plex.tv/pins.xml', async () => {
    if (mockState.plexSlowResponse) {
      await delay(6000); // Timeout simulation
    }
    if (mockState.plexDown) {
      return HttpResponse.text('Service Unavailable', { status: 503 });
    }
    return HttpResponse.text(
      `
      <pin>
        <id>12345</id>
        <code>ABCD</code>
      </pin>
    `,
      {
        headers: { 'Content-Type': 'application/xml' },
      },
    );
  }),

  http.get('https://plex.tv/pins/:id.xml', async ({ params }) => {
    if (mockState.plexSlowResponse) {
      await delay(6000);
    }
    if (mockState.plexDown) {
      return HttpResponse.text('Service Unavailable', { status: 503 });
    }

    const { id } = params;
    if (id === '12345') {
      return HttpResponse.text(
        `
        <pin>
          <id>12345</id>
          <code>ABCD</code>
          <authToken>plex-auth-token-123</authToken>
        </pin>
      `,
        {
          headers: { 'Content-Type': 'application/xml' },
        },
      );
    }
    return HttpResponse.text('Pin not found', { status: 404 });
  }),

  // Plex user endpoints
  http.get('https://plex.tv/api/v2/user', async ({ request }) => {
    if (mockState.plexSlowResponse) {
      await delay(6000);
    }
    if (mockState.plexDown) {
      return HttpResponse.json({ error: 'Service unavailable' }, { status: 503 });
    }

    const token = request.headers.get('X-Plex-Token');

    if (token === 'invalid-token') {
      return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (token === 'expired-token') {
      return HttpResponse.json({ error: 'Token expired' }, { status: 401 });
    }

    if (token === 'plex-auth-token-123' || token === 'test-plex-token') {
      return HttpResponse.json({
        user: {
          id: 'plex-user-456',
          uuid: 'user-uuid-123',
          username: 'testplexuser',
          title: 'Test Plex User',
          email: 'plex@example.com',
          thumb: 'https://plex.tv/users/avatar/test.jpg',
          hasPassword: true,
          authToken: token,
          subscription: {
            active: true,
            status: 'active',
            plan: 'plex_pass',
          },
        },
      });
    }

    return HttpResponse.json({ error: 'Invalid token' }, { status: 401 });
  }),

  // Plex servers endpoint
  http.get('https://plex.tv/api/v2/resources', async ({ request }) => {
    if (mockState.plexSlowResponse) {
      await delay(6000);
    }
    if (mockState.plexDown) {
      return HttpResponse.json({ error: 'Service unavailable' }, { status: 503 });
    }

    const token = request.headers.get('X-Plex-Token');
    if (!token || token === 'invalid-token') {
      return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return HttpResponse.json({
      MediaContainer: {
        Server: [
          {
            name: 'Test Plex Server',
            host: '192.168.1.100',
            port: 32400,
            machineIdentifier: 'server-123',
            version: '1.32.0.6918',
            scheme: 'http',
            address: '192.168.1.100',
            owned: true,
          },
        ],
      },
    });
  }),

  // Plex server libraries endpoint
  http.get('http://192.168.1.100:32400/library/sections', async ({ request }) => {
    if (mockState.plexSlowResponse) {
      await delay(6000);
    }
    if (mockState.plexDown) {
      return HttpResponse.json({ error: 'Server unavailable' }, { status: 503 });
    }

    const token = request.headers.get('X-Plex-Token');
    if (!token) {
      return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return HttpResponse.json({
      MediaContainer: {
        Directory: [
          {
            key: '1',
            title: 'Movies',
            type: 'movie',
            agent: 'com.plexapp.agents.imdb',
            scanner: 'Plex Movie Scanner',
            language: 'en',
            uuid: 'library-uuid-1',
            updatedAt: 1640995200,
            createdAt: 1640995200,
            scannedAt: 1640995200,
            refreshing: false,
          },
          {
            key: '2',
            title: 'TV Shows',
            type: 'show',
            agent: 'com.plexapp.agents.thetvdb',
            scanner: 'Plex Series Scanner',
            language: 'en',
            uuid: 'library-uuid-2',
            updatedAt: 1640995200,
            createdAt: 1640995200,
            scannedAt: 1640995200,
            refreshing: false,
          },
        ],
      },
    });
  }),

  // Plex library content endpoint
  http.get(
    'http://192.168.1.100:32400/library/sections/:sectionKey/all',
    async ({ params, request }) => {
      if (mockState.plexSlowResponse) {
        await delay(6000);
      }
      if (mockState.plexDown) {
        return HttpResponse.json({ error: 'Server unavailable' }, { status: 503 });
      }

      const token = request.headers.get('X-Plex-Token');
      if (!token) {
        return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      const { sectionKey } = params;

      if (sectionKey === '1') {
        // Movies
        return HttpResponse.json({
          MediaContainer: {
            Metadata: [
              {
                ratingKey: '101',
                key: '/library/metadata/101',
                guid: 'plex://movie/5d7768d59ab54200216b3d44',
                title: 'Test Movie',
                type: 'movie',
                summary: 'A test movie for integration testing',
                year: 2023,
                thumb: '/library/metadata/101/thumb/1640995200',
                art: '/library/metadata/101/art/1640995200',
                duration: 7200000,
                addedAt: 1640995200,
                updatedAt: 1640995200,
                Media: [
                  {
                    id: '201',
                    duration: 7200000,
                    bitrate: 8000,
                    width: 1920,
                    height: 1080,
                    aspectRatio: 1.78,
                    audioChannels: 6,
                    audioCodec: 'ac3',
                    videoCodec: 'h264',
                    videoResolution: '1080',
                    container: 'mkv',
                    videoFrameRate: '24p',
                    Part: [
                      {
                        id: '301',
                        key: '/library/parts/301/1640995200/file.mkv',
                        duration: 7200000,
                        file: '/movies/Test Movie (2023)/Test Movie.mkv',
                        size: 7200000000,
                        container: 'mkv',
                        has64bitOffsets: false,
                        optimizedForStreaming: true,
                      },
                    ],
                  },
                ],
              },
            ],
          },
        });
      }

      return HttpResponse.json({
        MediaContainer: { Metadata: [] },
      });
    },
  ),

  // Plex search endpoint
  http.get('http://192.168.1.100:32400/search', async ({ request }) => {
    if (mockState.plexSlowResponse) {
      await delay(6000);
    }
    if (mockState.plexDown) {
      return HttpResponse.json({ error: 'Server unavailable' }, { status: 503 });
    }

    const url = new URL(request.url);
    const query = url.searchParams.get('query');
    const token = request.headers.get('X-Plex-Token');

    if (!token) {
      return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (query === 'test') {
      return HttpResponse.json({
        MediaContainer: {
          Metadata: [
            {
              ratingKey: '102',
              key: '/library/metadata/102',
              title: 'Test Search Result',
              type: 'movie',
              year: 2023,
              addedAt: 1640995200,
              updatedAt: 1640995200,
            },
          ],
        },
      });
    }

    return HttpResponse.json({
      MediaContainer: { Metadata: [] },
    });
  }),

  // =========================
  // OVERSEERR API ENDPOINTS
  // =========================

  // Overseerr status endpoint
  http.get('**/api/v1/status', async ({ request }) => {
    if (mockState.overseerrSlowResponse) {
      await delay(6000);
    }
    if (mockState.overseerrDown) {
      mockState.failureCount++;
      return HttpResponse.json({ error: 'Service unavailable' }, { status: 503 });
    }

    return HttpResponse.json({
      version: '1.32.0',
      commitTag: 'v1.32.0',
      updateAvailable: false,
      commitsBehind: 0,
    });
  }),

  // Overseerr settings endpoint
  http.get('**/api/v1/settings/main', async ({ request }) => {
    if (mockState.overseerrSlowResponse) {
      await delay(6000);
    }
    if (mockState.overseerrDown) {
      return HttpResponse.json({ error: 'Service unavailable' }, { status: 503 });
    }

    const apiKey = request.headers.get('X-API-Key');
    if (!apiKey || apiKey === 'invalid-key') {
      return HttpResponse.json({ error: 'Invalid API key' }, { status: 401 });
    }

    return HttpResponse.json({
      id: 1,
      hostname: 'overseerr.local',
      port: 5055,
      ssl: false,
      urlBase: '',
      csrfProtection: false,
      cacheImages: true,
      enablePushRegistration: true,
      locale: 'en',
      region: 'US',
      originalLanguage: 'en',
      toDisplayLanguage: 'en',
      hideAvailable: false,
      localLogin: true,
      newPlexLogin: true,
      defaultPermissions: 2,
    });
  }),

  // Overseerr requests endpoint
  http.get('**/api/v1/request', async ({ request }) => {
    if (mockState.overseerrSlowResponse) {
      await delay(6000);
    }
    if (mockState.overseerrDown) {
      return HttpResponse.json({ error: 'Service unavailable' }, { status: 503 });
    }

    const apiKey = request.headers.get('X-API-Key');
    if (!apiKey || apiKey === 'invalid-key') {
      return HttpResponse.json({ error: 'Invalid API key' }, { status: 401 });
    }

    const url = new URL(request.url);
    const take = url.searchParams.get('take') || '20';
    const skip = url.searchParams.get('skip') || '0';
    const filter = url.searchParams.get('filter');

    return HttpResponse.json({
      results: [
        {
          id: 1,
          status: 1, // pending
          createdAt: '2023-12-01T10:00:00.000Z',
          updatedAt: '2023-12-01T10:00:00.000Z',
          type: 'movie',
          requestedBy: {
            id: 1,
            email: 'user@example.com',
            displayName: 'Test User',
            avatar: '/avatar.jpg',
            permissions: 2,
          },
          media: {
            id: 1,
            mediaType: 'movie',
            tmdbId: 550,
            status: 1,
            status4k: 1,
            createdAt: '2023-12-01T10:00:00.000Z',
            updatedAt: '2023-12-01T10:00:00.000Z',
          },
        },
      ],
      pageInfo: {
        pages: 1,
        pageSize: parseInt(take),
        total: 1,
        page: Math.floor(parseInt(skip) / parseInt(take)) + 1,
      },
    });
  }),

  // Create request endpoint
  http.post('**/api/v1/request', async ({ request }) => {
    if (mockState.overseerrSlowResponse) {
      await delay(6000);
    }
    if (mockState.overseerrDown) {
      return HttpResponse.json({ error: 'Service unavailable' }, { status: 503 });
    }

    const apiKey = request.headers.get('X-API-Key');
    if (!apiKey || apiKey === 'invalid-key') {
      return HttpResponse.json({ error: 'Invalid API key' }, { status: 401 });
    }

    const body = (await request.json()) as any;

    if (body.mediaId === 999) {
      return HttpResponse.json({ error: 'Media not found' }, { status: 404 });
    }

    return HttpResponse.json(
      {
        id: 123,
        status: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        type: body.mediaType,
        requestedBy: {
          id: 1,
          email: 'user@example.com',
          displayName: 'Test User',
          avatar: '/avatar.jpg',
          permissions: 2,
        },
        media: {
          id: 123,
          mediaType: body.mediaType,
          tmdbId: body.mediaId,
          status: 1,
          status4k: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      },
      { status: 201 },
    );
  }),

  // Get specific request
  http.get('**/api/v1/request/:id', async ({ params, request }) => {
    if (mockState.overseerrSlowResponse) {
      await delay(6000);
    }
    if (mockState.overseerrDown) {
      return HttpResponse.json({ error: 'Service unavailable' }, { status: 503 });
    }

    const apiKey = request.headers.get('X-API-Key');
    if (!apiKey || apiKey === 'invalid-key') {
      return HttpResponse.json({ error: 'Invalid API key' }, { status: 401 });
    }

    const { id } = params;

    if (id === '999') {
      return HttpResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    return HttpResponse.json({
      id: parseInt(id as string),
      status: 1,
      createdAt: '2023-12-01T10:00:00.000Z',
      updatedAt: '2023-12-01T10:00:00.000Z',
      type: 'movie',
      requestedBy: {
        id: 1,
        email: 'user@example.com',
        displayName: 'Test User',
        avatar: '/avatar.jpg',
        permissions: 2,
      },
      media: {
        id: parseInt(id as string),
        mediaType: 'movie',
        tmdbId: 550,
        status: 1,
        status4k: 1,
        createdAt: '2023-12-01T10:00:00.000Z',
        updatedAt: '2023-12-01T10:00:00.000Z',
      },
    });
  }),

  // Approve request
  http.post('**/api/v1/request/:id/approve', async ({ params, request }) => {
    if (mockState.overseerrSlowResponse) {
      await delay(6000);
    }
    if (mockState.overseerrDown) {
      return HttpResponse.json({ error: 'Service unavailable' }, { status: 503 });
    }

    const apiKey = request.headers.get('X-API-Key');
    if (!apiKey || apiKey === 'invalid-key') {
      return HttpResponse.json({ error: 'Invalid API key' }, { status: 401 });
    }

    const { id } = params;

    if (id === '999') {
      return HttpResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    return HttpResponse.json({
      id: parseInt(id as string),
      status: 2, // approved
      createdAt: '2023-12-01T10:00:00.000Z',
      updatedAt: new Date().toISOString(),
      type: 'movie',
      requestedBy: {
        id: 1,
        email: 'user@example.com',
        displayName: 'Test User',
        avatar: '/avatar.jpg',
        permissions: 2,
      },
      media: {
        id: parseInt(id as string),
        mediaType: 'movie',
        tmdbId: 550,
        status: 2,
        status4k: 1,
        createdAt: '2023-12-01T10:00:00.000Z',
        updatedAt: new Date().toISOString(),
      },
    });
  }),

  // Search media
  http.get('**/api/v1/search', async ({ request }) => {
    if (mockState.overseerrSlowResponse) {
      await delay(6000);
    }
    if (mockState.overseerrDown) {
      return HttpResponse.json({ error: 'Service unavailable' }, { status: 503 });
    }

    const url = new URL(request.url);
    const query = url.searchParams.get('query');
    const type = url.searchParams.get('type');
    const page = url.searchParams.get('page') || '1';

    if (query === 'test movie') {
      return HttpResponse.json({
        page: parseInt(page),
        totalPages: 1,
        totalResults: 1,
        results: [
          {
            id: 550,
            title: 'Test Movie',
            overview: 'A test movie for integration testing',
            poster_path: '/test-poster.jpg',
            backdrop_path: '/test-backdrop.jpg',
            release_date: '2023-01-01',
            vote_average: 8.5,
            vote_count: 1000,
            popularity: 500,
            genre_ids: [28, 35],
            adult: false,
            original_language: 'en',
            original_title: 'Test Movie',
            video: false,
            mediaType: 'movie',
          },
        ],
      });
    }

    return HttpResponse.json({
      page: parseInt(page),
      totalPages: 0,
      totalResults: 0,
      results: [],
    });
  }),

  // =========================
  // UPTIME KUMA ENDPOINTS
  // =========================

  // Status page heartbeat (for HTTP monitoring checks)
  http.get('**/api/status-page/heartbeat', async () => {
    return HttpResponse.json({
      heartbeatList: {
        '1': [{ status: 1, time: Date.now(), msg: 'Up', ping: 50 }],
        '2': [{ status: 0, time: Date.now(), msg: 'Down', ping: null }],
        '3': [{ status: 1, time: Date.now(), msg: 'Up', ping: 120 }],
      },
    });
  }),

  // =========================
  // ERROR SIMULATION ENDPOINTS
  // =========================

  // Network error simulation
  http.get('http://unreachable.test', () => {
    return HttpResponse.error();
  }),

  // Timeout simulation
  http.get('http://timeout.test', async () => {
    await delay(30000); // 30 second delay to trigger timeout
    return HttpResponse.json({ message: 'This should timeout' });
  }),

  // Rate limit simulation
  http.get('http://ratelimited.test', () => {
    return HttpResponse.json(
      { error: 'Rate limit exceeded' },
      { status: 429, headers: { 'Retry-After': '60' } },
    );
  }),

  // Internal server error
  http.get('http://servererror.test', () => {
    return HttpResponse.json({ error: 'Internal server error' }, { status: 500 });
  }),
];
