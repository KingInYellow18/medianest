import { http, HttpResponse } from 'msw';

// Mock handlers for external API calls during testing
export const handlers = [
  // Plex API mocks
  http.get('https://plex.tv/api/v2/user', ({ request }) => {
    const authHeader = request.headers.get('X-Plex-Token');

    if (!authHeader || authHeader === 'invalid-token') {
      return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return HttpResponse.json({
      id: 123456,
      uuid: 'test-uuid-123',
      username: 'testuser',
      title: 'Test User',
      email: 'test@example.com',
      thumb: 'https://example.com/thumb.jpg',
      authToken: authHeader,
    });
  }),

  http.post('https://plex.tv/api/v2/pins', () => {
    return HttpResponse.json({
      id: 'test-pin-id',
      code: 'TEST123',
      product: 'medianest',
      trusted: true,
      clientIdentifier: 'test-client-id',
      location: {
        code: 'TEST123',
      },
      expiresIn: 900,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 900000).toISOString(),
    });
  }),

  // YouTube API mocks
  http.get('https://www.googleapis.com/youtube/v3/videos', ({ request }) => {
    const url = new URL(request.url);
    const videoId = url.searchParams.get('id');

    if (!videoId || videoId === 'invalid-id') {
      return HttpResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    return HttpResponse.json({
      items: [
        {
          id: videoId,
          snippet: {
            title: 'Test Video Title',
            description: 'Test video description',
            channelTitle: 'Test Channel',
            publishedAt: '2024-01-01T00:00:00Z',
            thumbnails: {
              default: { url: 'https://example.com/thumb.jpg' },
            },
          },
          contentDetails: {
            duration: 'PT10M30S',
          },
        },
      ],
    });
  }),

  // TMDB API mocks
  http.get('https://api.themoviedb.org/3/movie/:id', ({ params }) => {
    const { id } = params;

    if (id === 'invalid-id') {
      return HttpResponse.json(
        { status_message: 'The resource you requested could not be found.' },
        { status: 404 },
      );
    }

    return HttpResponse.json({
      id: parseInt(id as string),
      title: 'Test Movie',
      overview: 'Test movie description',
      poster_path: '/test-poster.jpg',
      backdrop_path: '/test-backdrop.jpg',
      release_date: '2024-01-01',
      vote_average: 8.5,
      runtime: 120,
    });
  }),

  // Overseerr API mocks
  http.get('http://localhost:5055/api/v1/status', () => {
    return HttpResponse.json({
      version: '1.0.0',
      uptime: 12345,
      initialized: true,
    });
  }),

  http.post('http://localhost:5055/api/v1/request', ({ request }) => {
    return HttpResponse.json({
      id: 1,
      status: 'pending',
      createdAt: new Date().toISOString(),
      media: {
        id: 1,
        mediaType: 'movie',
        tmdbId: 12345,
        title: 'Test Movie',
      },
    });
  }),

  // Uptime Kuma API mocks
  http.get('http://localhost:3001/api/status-page/medianest', () => {
    return HttpResponse.json({
      config: {
        title: 'MediaNest Status',
        description: 'Service status dashboard',
      },
      incident: null,
      publicGroupList: [
        {
          name: 'Core Services',
          monitorList: [
            {
              id: 1,
              name: 'Database',
              type: 'postgres',
              url: 'postgresql://localhost:5432/medianest',
              status: 1,
            },
            {
              id: 2,
              name: 'Redis',
              type: 'redis',
              url: 'redis://localhost:6379',
              status: 1,
            },
          ],
        },
      ],
    });
  }),

  // Internal API mocks for integration tests
  http.get('/api/v1/media/requests', ({ request }) => {
    const authHeader = request.headers.get('authorization');

    if (!authHeader) {
      return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse token to get user context (mocked behavior)
    const token = authHeader.replace('Bearer ', '');
    let userId = 'isolation-user-1'; // Default

    // Simple token parsing for test
    if (token.includes('isolation-user-2')) {
      userId = 'isolation-user-2';
    }

    // Mock user isolation - only return requests for the authenticated user
    const mockRequests = [
      {
        id: 'req-1',
        userId: 'isolation-user-1',
        title: 'User 1 Movie',
        mediaType: 'movie',
        tmdbId: '111111',
        status: 'pending',
        requestedAt: new Date().toISOString(),
      },
      {
        id: 'req-2',
        userId: 'isolation-user-2',
        title: 'User 2 Movie',
        mediaType: 'movie',
        tmdbId: '222222',
        status: 'pending',
        requestedAt: new Date().toISOString(),
      },
    ];

    const userRequests = mockRequests.filter((req) => req.userId === userId);

    return HttpResponse.json({
      success: true,
      data: {
        requests: userRequests,
        total: userRequests.length,
      },
    });
  }),

  http.get('/api/v1/media/requests/:id', ({ params, request }) => {
    const { id } = params;
    const authHeader = request.headers.get('authorization');

    if (!authHeader) {
      return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse token to get user context (mocked behavior)
    const token = authHeader.replace('Bearer ', '');
    let userId = 'isolation-user-1'; // Default

    if (token.includes('isolation-user-2')) {
      userId = 'isolation-user-2';
    }

    // Mock request belonging to user 1
    const mockRequest = {
      id: 'test-request-id',
      userId: 'isolation-user-1',
      title: 'Private Movie',
      mediaType: 'movie',
      tmdbId: '333333',
      status: 'pending',
      requestedAt: new Date().toISOString(),
    };

    // Check access control - user 2 should not access user 1's request
    if (mockRequest.userId !== userId) {
      return HttpResponse.json(
        {
          success: false,
          error: {
            message: 'Access denied',
          },
        },
        { status: 403 },
      );
    }

    return HttpResponse.json({
      success: true,
      data: mockRequest,
    });
  }),

  // Default fallback for unhandled requests
  http.all('*', ({ request }) => {
    console.warn(`Unhandled ${request.method} request to ${request.url}`);
    return HttpResponse.json({ error: 'Not implemented in test mock' }, { status: 501 });
  }),
];
