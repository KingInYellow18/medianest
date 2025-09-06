import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app';
import { server, http, HttpResponse } from '../msw/setup';
import { generateToken } from '../../src/utils/jwt';
import { redisMock } from '../setup-redis-mock';

// Mock Redis completely to avoid connection issues
vi.mock('../../src/config/redis', () => ({
  redisClient: redisMock,
  getRedis: vi.fn(() => redisMock),
  initializeRedis: vi.fn().mockResolvedValue(true),
  closeRedis: vi.fn().mockResolvedValue(true),
  checkRedisHealth: vi.fn().mockResolvedValue(true),
  rateLimitScript: 'mocked-script',
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
}));

// Mock Prisma with optimized responses
vi.mock('../../src/config/database', () => ({
  default: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    userSession: {
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
    },
    mediaRequest: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
      delete: vi.fn(),
    },
    serviceConfig: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

// Mock encryption service
vi.mock('../../src/services/encryption.service', () => ({
  encryptionService: {
    decrypt: vi.fn().mockImplementation((data) => {
      if (data === 'encrypted:api:key') return 'test-api-key';
      return 'decrypted-data';
    }),
    encrypt: vi.fn().mockImplementation((data) => `encrypted:${data}`),
  },
}));

// Mock repositories
vi.mock('../../src/repositories', () => ({
  createRepositories: vi.fn(() => ({
    mediaRequestRepository: {
      create: vi.fn(),
      findByTmdbId: vi.fn(),
      findById: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
      findMany: vi.fn(),
    },
    serviceConfigRepository: {
      findByName: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  })),
}));

// Mock logger to prevent noise
vi.mock('../../src/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// Optimized MSW handlers
const optimizedHandlers = [
  http.get('*/api/v1/search', () => {
    return HttpResponse.json({
      page: 1,
      totalPages: 1,
      totalResults: 1,
      results: [
        {
          id: 123456,
          mediaType: 'movie',
          title: 'Test Movie',
          overview: 'Test overview',
          releaseDate: '2023-01-01',
          voteAverage: 8.5,
        },
      ],
    });
  }),

  http.get('*/api/v1/movie/:id', ({ params }) => {
    return HttpResponse.json({
      id: parseInt(params.id as string),
      title: 'Test Movie',
      overview: 'Test overview',
      releaseDate: '2023-01-01',
      voteAverage: 8.5,
      mediaInfo: { status: 1 },
    });
  }),

  http.get('*/api/v1/tv/:id', ({ params }) => {
    return HttpResponse.json({
      id: parseInt(params.id as string),
      name: 'Test Show',
      overview: 'Test overview',
      firstAirDate: '2023-01-01',
      voteAverage: 9.0,
      mediaInfo: { status: 2 },
    });
  }),

  http.post('*/api/v1/request', () => {
    return HttpResponse.json({
      id: 1,
      status: 1,
      createdAt: new Date().toISOString(),
    });
  }),
];

describe('Media Endpoints Integration (Optimized)', () => {
  let authToken: string;

  beforeEach(() => {
    vi.clearAllMocks();
    authToken = generateToken({ id: 'user-1', role: 'USER' });

    server.use(...optimizedHandlers);

    // Setup auth mock
    const prisma = require('../../src/config/database').default;
    prisma.userSession.findFirst.mockImplementation(({ where }) => {
      if (where.token === authToken) {
        return Promise.resolve({
          id: 'session-1',
          userId: 'user-1',
          token: authToken,
          expiresAt: new Date(Date.now() + 3600000),
          isActive: true,
          user: {
            id: 'user-1',
            email: 'test@example.com',
            role: 'USER',
            isActive: true,
          },
        });
      }
      return null;
    });

    // Setup service config mock
    prisma.serviceConfig.findUnique.mockResolvedValue({
      id: 'overseerr-config',
      service: 'OVERSEERR',
      serviceUrl: 'http://localhost:5055',
      apiKey: 'encrypted:api:key',
      enabled: true,
    });

    // Setup Redis mocks
    redisMock.eval.mockResolvedValue([1, 5, 4, 3600]);
    redisMock.get.mockResolvedValue(null);
    redisMock.setex.mockResolvedValue('OK');
  });

  afterEach(() => {
    server.resetHandlers();
  });

  describe('Basic Functionality', () => {
    it('should search for media successfully', async () => {
      const response = await request(app)
        .get('/api/v1/media/search')
        .query({ query: 'test' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: expect.objectContaining({
          results: expect.arrayContaining([
            expect.objectContaining({
              id: 123456,
              title: 'Test Movie',
            }),
          ]),
        }),
      });
    }, 5000);

    it('should get movie details successfully', async () => {
      const response = await request(app)
        .get('/api/v1/media/movie/123456')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          id: 123456,
          title: 'Test Movie',
        },
      });
    }, 5000);

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/v1/media/search')
        .query({ query: 'test' })
        .expect(401);

      expect(response.body.error.code).toBe('UNAUTHORIZED');
    }, 3000);

    it('should validate query parameter', async () => {
      const response = await request(app)
        .get('/api/v1/media/search')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    }, 3000);
  });

  describe('Error Handling', () => {
    it('should handle service unavailable', async () => {
      server.use(
        http.get('*/api/v1/search', () => {
          return HttpResponse.json({ error: 'Service unavailable' }, { status: 503 });
        }),
      );

      const response = await request(app)
        .get('/api/v1/media/search')
        .query({ query: 'test' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(500);

      expect(response.body.error.message).toContain('Search failed');
    }, 5000);

    it('should handle missing configuration', async () => {
      const prisma = require('../../src/config/database').default;
      prisma.serviceConfig.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/v1/media/search')
        .query({ query: 'test' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(500);

      expect(response.body.error.message).toContain('Search failed');
    }, 5000);
  });
});
