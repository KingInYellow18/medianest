import { http, HttpResponse } from 'msw';

export const handlers = [
  // Plex authentication endpoints
  http.post('/api/auth/plex/pin', () => {
    return HttpResponse.json({
      pin: '1234',
      sessionId: 'test-session-id',
      authUrl:
        'https://plex.tv/auth#!?clientID=test-client&context[device][product]=MediaNest&context[device][version]=1.0.0&context[device][platform]=Web&context[device][platformVersion]=1.0.0&context[device][device]=Web&context[device][deviceName]=MediaNest&context[device][model]=Web&context[device][screenResolution]=1920x1080&code=1234',
    });
  }),

  http.get('/api/auth/plex/pin', ({ request }) => {
    const url = new URL(request.url);
    const sessionId = url.searchParams.get('sessionId');

    if (sessionId === 'test-session-id-authorized') {
      return HttpResponse.json({
        authorized: true,
        authToken: 'test-plex-token',
      });
    }

    return HttpResponse.json({
      authorized: false,
    });
  }),

  http.post('/api/auth/plex/callback', () => {
    return HttpResponse.json({
      success: true,
      user: {
        id: 'test-user-id',
        email: 'test@example.com',
        username: 'testuser',
        role: 'user',
      },
    });
  }),

  // NextAuth endpoints
  http.get('/api/auth/session', () => {
    return HttpResponse.json({
      user: {
        id: 'test-user-id',
        email: 'test@example.com',
        name: 'Test User',
        role: 'user',
      },
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });
  }),

  http.post('/api/auth/signin/admin-bootstrap', ({ request }) => {
    return HttpResponse.json({
      url: '/auth/change-password?requiresPasswordChange=true',
    });
  }),

  // Change password endpoint
  http.post('/api/auth/change-password', () => {
    return HttpResponse.json({
      success: true,
      message: 'Password changed successfully',
    });
  }),

  // Health check endpoint
  http.get('/api/health', () => {
    return HttpResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
    });
  }),

  // Mock external Plex API
  http.get('https://plex.tv/api/v2/user', () => {
    return HttpResponse.json({
      id: 123456,
      uuid: 'test-uuid',
      username: 'testuser',
      title: 'Test User',
      email: 'test@example.com',
    });
  }),

  // Media search API - PROVEN PATTERN for useMediaSearch
  http.get('/api/media/search', ({ request }) => {
    const url = new URL(request.url);
    const query = url.searchParams.get('query') || '';

    // Return proper data structure to prevent "Query data cannot be undefined" error
    return HttpResponse.json({
      results: query
        ? [
            {
              id: 1,
              tmdbId: 27205,
              title: query === 'Inception' ? 'Inception' : 'Test Movie',
              mediaType: 'movie',
              overview: 'A thief who steals corporate secrets...',
              voteAverage: 8.3,
              availability: { status: 'available' },
            },
          ]
        : [],
      totalResults: query ? 1 : 0,
      page: 1,
      totalPages: query ? 1 : 0,
    });
  }),

  // Service status APIs - PROVEN PATTERN for useServiceStatus
  http.get('/api/services/status', () => {
    return HttpResponse.json([
      {
        id: 'plex',
        name: 'Plex',
        displayName: 'Plex Updated',
        status: 'up',
        responseTime: 120,
        lastCheckAt: new Date().toISOString(),
        uptime: {
          '24h': 99.8,
          '7d': 99.5,
          '30d': 99.2,
        },
      },
    ]);
  }),

  http.get('/dashboard/status', () => {
    return HttpResponse.json({
      data: {
        services: [
          {
            id: 'plex',
            name: 'Plex',
            displayName: 'Plex Updated',
            status: 'up',
            responseTime: 120,
            lastCheckAt: new Date().toISOString(),
            uptimePercentage: 99.8,
            uptime: {
              '24h': 99.8,
              '7d': 99.5,
              '30d': 99.2,
            },
          },
        ],
      },
    });
  }),

  // Media request API - PROVEN PATTERN for useMediaRequest
  http.post('/api/media/requests', async ({ request }) => {
    try {
      const body = (await request.json()) as any;

      return HttpResponse.json({
        id: '123',
        tmdbId: body.tmdbId || 550,
        mediaType: body.mediaType || 'movie',
        title: 'Fight Club',
        status: 'pending',
        requestedAt: new Date().toISOString(),
        seasons: body.seasons
          ? body.seasons.map((s: number) => ({
              seasonNumber: s,
              status: 'pending',
            }))
          : undefined,
      });
    } catch (error) {
      return new HttpResponse(JSON.stringify({ error: 'Failed to submit request' }), {
        status: 500,
      });
    }
  }),

  // Enhanced Plex callback with proper error handling
  http.post('/api/auth/plex/callback', async ({ request }) => {
    try {
      const body = (await request.json()) as any;

      if (!body.authToken) {
        return new HttpResponse(JSON.stringify({ error: 'Auth token is required' }), {
          status: 401,
        });
      }

      if (body.authToken === 'invalid-token') {
        return new HttpResponse(JSON.stringify({ error: 'Invalid auth token' }), { status: 401 });
      }

      if (body.authToken === 'db-error-token') {
        return new HttpResponse(JSON.stringify({ error: 'Database error' }), { status: 500 });
      }

      if (body.authToken === 'rate-limit-token') {
        return new HttpResponse(JSON.stringify({ error: 'Rate limit exceeded' }), { status: 429 });
      }

      // Simulate successful user creation/retrieval
      const isExistingUser = body.authToken === 'existing-token';
      const isNoEmailUser = body.authToken === 'no-email-token';

      return HttpResponse.json({
        user: {
          id: isExistingUser ? 'existing-user-id' : 'new-user-id',
          username: 'testuser',
          email: isNoEmailUser ? 'testuser@plex.local' : 'test@example.com',
          plexId: isExistingUser ? 'existing-user-id' : 123456,
        },
      });
    } catch (error) {
      return new HttpResponse(JSON.stringify({ error: 'Malformed request body' }), { status: 400 });
    }
  }),

  // Default fallback - suppress warnings for handled cases
  http.get('*', ({ request }) => {
    const url = request.url;
    // Don't warn for localhost URLs that are expected to be unhandled
    if (!url.includes('localhost:3000')) {
      console.warn(`Unhandled GET request: ${url}`);
    }
    return new HttpResponse(null, { status: 404 });
  }),

  http.post('*', ({ request }) => {
    const url = request.url;
    // Don't warn for localhost URLs that are expected to be unhandled
    if (!url.includes('localhost:3000')) {
      console.warn(`Unhandled POST request: ${url}`);
    }
    return new HttpResponse(null, { status: 404 });
  }),
];
