/**
 * Media Request Test Factory - Mock and test data generation
 */

export class MediaTestFactory {
  static createMovieRequestData(overrides: Partial<any> = {}) {
    return {
      mediaType: 'movie',
      tmdbId: 123456,
      quality: 'HD',
      notes: 'Test request',
      ...overrides,
    };
  }

  static createTVShowRequestData(overrides: Partial<any> = {}) {
    return {
      mediaType: 'tv',
      tmdbId: 789012,
      seasons: [1, 2],
      quality: 'HD',
      notes: 'Test TV show request',
      ...overrides,
    };
  }

  static createSearchResultData(count: number = 5) {
    return Array.from({ length: count }, (_, i) => ({
      id: 100000 + i,
      title: `Test Movie ${i + 1}`,
      overview: `Description for test movie ${i + 1}`,
      mediaType: 'movie',
      releaseDate: '2024-01-01',
      posterPath: `/test-poster-${i + 1}.jpg`,
      backdropPath: `/test-backdrop-${i + 1}.jpg`,
      voteAverage: 7.5 + i * 0.1,
      voteCount: 1000 + i * 100,
      popularity: 50.0 + i * 5,
      genres: [
        { id: 28, name: 'Action' },
        { id: 12, name: 'Adventure' },
      ],
      adult: false,
      originalLanguage: 'en',
      originalTitle: `Original Test Movie ${i + 1}`,
    }));
  }

  static createRequestListResponse(requests: any[] = [], meta: any = {}) {
    return {
      success: true,
      data: {
        requests,
        pagination: {
          page: 1,
          pageSize: 20,
          total: requests.length,
          totalPages: Math.ceil(requests.length / 20),
          ...meta,
        },
      },
    };
  }

  static createRequestResponse(status: string = 'pending', overrides: any = {}) {
    return {
      success: true,
      data: {
        id: Math.floor(Math.random() * 100000),
        status,
        media: {
          title: 'Test Movie',
          tmdbId: 123456,
          mediaType: 'movie',
          year: 2024,
          posterPath: '/test-poster.jpg',
        },
        requestedBy: 'test-user-id',
        requestedAt: new Date().toISOString(),
        ...overrides,
      },
    };
  }

  static createPerformanceTestData() {
    return {
      concurrentSearches: 10,
      largePageSize: 100,
      timeout: {
        search: 2000,
        creation: 2000,
        pagination: 3000,
        adminOperations: 4000,
      },
    };
  }

  static createErrorScenarios() {
    return {
      invalidToken: {
        status: 401,
        body: {
          success: false,
          error: { message: 'Invalid or expired token', code: 'UNAUTHORIZED' },
        },
      },
      malformedRequest: {
        status: 400,
        body: {
          success: false,
          error: { message: 'Invalid request data', code: 'BAD_REQUEST' },
        },
      },
      notFound: {
        status: 404,
        body: {
          success: false,
          error: { message: 'Resource not found', code: 'NOT_FOUND' },
        },
      },
      forbidden: {
        status: 403,
        body: {
          success: false,
          error: { message: 'Insufficient permissions', code: 'FORBIDDEN' },
        },
      },
      rateLimited: {
        status: 429,
        body: {
          success: false,
          error: {
            message: 'Too many requests',
            code: 'RATE_LIMITED',
            retryAfter: 60,
          },
        },
      },
    };
  }

  static createAdminApprovalData(requestId: string | number) {
    return {
      notes: 'Approved via test workflow',
      priority: 'normal' as const,
      requestId,
    };
  }

  static createStatusUpdateData(status: string = 'approved') {
    return {
      status,
      updatedBy: 'admin-user-id',
      updatedAt: new Date().toISOString(),
      notes: `Status updated to ${status} via test`,
    };
  }

  static createValidationScenarios() {
    return [
      {
        name: 'Missing mediaType',
        data: { tmdbId: 123456 },
        expectedError: 'mediaType is required',
      },
      {
        name: 'Invalid mediaType',
        data: { mediaType: 'invalid', tmdbId: 123456 },
        expectedError: 'mediaType must be movie or tv',
      },
      {
        name: 'Missing tmdbId',
        data: { mediaType: 'movie' },
        expectedError: 'tmdbId is required',
      },
      {
        name: 'Invalid tmdbId type',
        data: { mediaType: 'movie', tmdbId: 'not-a-number' },
        expectedError: 'tmdbId must be a number',
      },
      {
        name: 'TV show without seasons',
        data: { mediaType: 'tv', tmdbId: 123456 },
        expectedError: 'seasons is required for TV shows',
      },
      {
        name: 'Invalid seasons format',
        data: { mediaType: 'tv', tmdbId: 123456, seasons: 'not-array' },
        expectedError: 'seasons must be an array of numbers',
      },
    ];
  }

  static createIsolationTestData() {
    return {
      user1Requests: [
        { mediaType: 'movie', tmdbId: 100001, notes: 'User 1 movie request' },
        { mediaType: 'tv', tmdbId: 100002, seasons: [1], notes: 'User 1 TV request' },
      ],
      user2Requests: [
        { mediaType: 'movie', tmdbId: 200001, notes: 'User 2 movie request' },
        { mediaType: 'tv', tmdbId: 200002, seasons: [1, 2], notes: 'User 2 TV request' },
      ],
    };
  }

  static createResponsiveTestData() {
    return {
      viewports: [
        { name: 'mobile', pageSize: 5, userAgent: 'Mobile Safari' },
        { name: 'tablet', pageSize: 10, userAgent: 'Tablet' },
        { name: 'desktop', pageSize: 20, userAgent: 'Desktop Chrome' },
      ],
    };
  }

  static createHealthCheckEndpoints() {
    return [
      {
        name: 'Database connectivity',
        endpoint: '/api/v1/health',
        expectedStatus: 200,
        expectedResponse: { status: 'healthy' },
      },
      {
        name: 'Authentication system',
        endpoint: '/api/v1/auth/me',
        requiresAuth: true,
        expectedStatus: 200,
        expectedResponse: { success: true },
      },
      {
        name: 'Admin functionality',
        endpoint: '/api/v1/admin/dashboard/stats',
        requiresAuth: true,
        requiresAdmin: true,
        expectedStatus: 200,
        expectedResponse: { success: true },
      },
      {
        name: 'Media search integration',
        endpoint: '/api/v1/media/search',
        requiresAuth: true,
        query: { query: 'test' },
        expectedStatus: 200,
        expectedResponse: { success: true },
      },
    ];
  }
}
