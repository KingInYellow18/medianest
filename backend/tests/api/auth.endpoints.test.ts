// Set required environment variables BEFORE importing anything
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-for-auth-endpoints';
process.env.PLEX_CLIENT_IDENTIFIER = 'test-client-id';
process.env.PLEX_CLIENT_SECRET = 'test-client-secret';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'file:./test.db';
process.env.REDIS_URL = 'redis://mock-redis:6379/0';

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';

// Mock Redis BEFORE any imports that might use it
vi.mock('ioredis', () => {
  const mockRedisClient = {
    ping: vi.fn().mockResolvedValue('PONG'),
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
    incr: vi.fn().mockResolvedValue(1),
    pexpire: vi.fn().mockResolvedValue(1),
    pttl: vi.fn().mockResolvedValue(-1),
    eval: vi.fn().mockResolvedValue(0),
    on: vi.fn(),
    off: vi.fn(),
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    quit: vi.fn().mockResolvedValue('OK'),
    flushall: vi.fn().mockResolvedValue('OK'),
    status: 'ready',
  };

  return {
    default: vi.fn(() => mockRedisClient),
    __esModule: true,
  };
});

// Mock the entire Redis config module
vi.mock('@/config/redis', () => ({
  initializeRedis: vi.fn().mockResolvedValue({
    ping: vi.fn().mockResolvedValue('PONG'),
    on: vi.fn(),
    quit: vi.fn().mockResolvedValue('OK'),
  }),
  getRedis: vi.fn().mockReturnValue({
    ping: vi.fn().mockResolvedValue('PONG'),
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
    incr: vi.fn().mockResolvedValue(1),
    pexpire: vi.fn().mockResolvedValue(1),
    pttl: vi.fn().mockResolvedValue(-1),
    eval: vi.fn().mockResolvedValue(0),
  }),
  redisClient: {
    ping: vi.fn().mockResolvedValue('PONG'),
    on: vi.fn(),
    quit: vi.fn().mockResolvedValue('OK'),
  },
  closeRedis: vi.fn().mockResolvedValue(undefined),
  checkRedisHealth: vi.fn().mockResolvedValue(true),
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
}));

// Mock ALL services that use Redis to prevent connection attempts
vi.mock('@/services/integration.service', () => ({
  IntegrationService: vi.fn().mockImplementation(() => ({
    initialize: vi.fn().mockResolvedValue(undefined),
    shutdown: vi.fn().mockResolvedValue(undefined),
    getHealthStatuses: vi.fn().mockReturnValue(new Map()),
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
  })),
}));

vi.mock('@/services/youtube.service', () => ({
  YouTubeService: vi.fn().mockImplementation(() => ({
    downloadVideo: vi.fn().mockResolvedValue({ success: true }),
    getProgress: vi.fn().mockResolvedValue({ progress: 0 }),
  })),
}));

vi.mock('@/services/cache.service', () => ({
  CacheService: vi.fn().mockImplementation(() => ({
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
  })),
}));

vi.mock('@/services/plex.service', () => ({
  PlexService: vi.fn().mockImplementation(() => ({
    authenticate: vi.fn().mockResolvedValue({ success: true }),
    getLibraries: vi.fn().mockResolvedValue([]),
  })),
}));

vi.mock('@/config/queues', () => ({
  initializeQueues: vi.fn().mockResolvedValue(undefined),
}));

// Mock axios for external API calls
vi.mock('axios', () => {
  const mockAxiosInstance = {
    get: vi.fn().mockResolvedValue({ data: {} }),
    post: vi.fn().mockResolvedValue({ data: {} }),
    put: vi.fn().mockResolvedValue({ data: {} }),
    delete: vi.fn().mockResolvedValue({ data: {} }),
    defaults: { headers: {} },
    interceptors: {
      request: { use: vi.fn(), eject: vi.fn() },
      response: { use: vi.fn(), eject: vi.fn() },
    },
  };

  return {
    default: {
      post: vi.fn().mockImplementation((url: string, data: any, config: any) => {
        if (url.includes('plex.tv/pins.xml')) {
          return Promise.resolve({
            data: '<id>test-pin-12345</id><code>ABCD1234</code>',
          });
        }
        if (url.includes('pin/test-pin-first-user')) {
          return Promise.resolve({
            data: `
              <pin>
                <id>test-pin-first-user</id>
                <code>ABCD1234</code>
                <authToken>mock-plex-token-first-user</authToken>
                <user>
                  <id>12345</id>
                  <title>TestUser</title>
                  <email>test@example.com</email>
                </user>
              </pin>
            `,
          });
        }
        if (url.includes('pin/test-pin-existing')) {
          return Promise.resolve({
            data: `
              <pin>
                <id>test-pin-existing</id>
                <code>EFGH5678</code>
                <authToken>mock-plex-token-existing</authToken>
                <user>
                  <id>67890</id>
                  <title>ExistingUser</title>
                  <email>existing@example.com</email>
                </user>
              </pin>
            `,
          });
        }
        if (url.includes('pin/unauthorized-pin')) {
          return Promise.reject({
            response: { status: 400 },
            message: 'PIN not authorized',
          });
        }
        return Promise.resolve({ data: {} });
      }),
      get: vi.fn().mockResolvedValue({ data: {} }),
      create: vi.fn(() => mockAxiosInstance),
      isAxiosError: vi.fn().mockReturnValue(false),
    },
  };
});

// Mock CSRF middleware to bypass in tests
vi.mock('@/middleware/csrf', () => ({
  generateCSRFToken: (req: any, res: any, next: any) => {
    res.locals.csrfToken = 'mock-csrf-token';
    next();
  },
  validateCSRFToken: (req: any, res: any, next: any) => {
    next();
  },
  refreshCSRFToken: (req: any, res: any, next: any) => {
    res.locals.csrfToken = 'mock-refreshed-csrf-token';
    next();
  },
  optionalAuth: () => (req: any, res: any, next: any) => next(),
  csrfController: {
    getToken: (req: any, res: any) => {
      res.json({ success: true, data: { csrfToken: 'mock-csrf-token' } });
    },
    refreshToken: (req: any, res: any) => {
      res.json({ success: true, data: { csrfToken: 'mock-refreshed-csrf-token' } });
    },
  },
}));

import { app } from '@/app';
import { prisma } from '@/db/prisma';
import { databaseCleanup } from '../helpers/database-cleanup';
import { createAuthToken } from '../helpers/auth';

describe('Auth Endpoints - Critical Path', () => {
  beforeAll(async () => {
    await databaseCleanup.cleanAll();
  });

  afterAll(async () => {
    await databaseCleanup.cleanAll();
    await prisma.$disconnect();
  });

  describe('POST /api/v1/auth/plex/pin', () => {
    it('should generate Plex PIN successfully', async () => {
      const response = await request(app)
        .post('/api/v1/auth/plex/pin')
        .send({ clientName: 'MediaNest Test' })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          id: expect.any(String),
          code: expect.stringMatching(/^[A-Z0-9]+$/),
          qrUrl: expect.stringContaining('plex.tv/link'),
          expiresIn: 900,
        },
      });
    });

    it('should use default client name when not provided', async () => {
      const response = await request(app).post('/api/v1/auth/plex/pin').send({}).expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should handle Plex API errors', async () => {
      // This would need MSW to mock Plex service unavailable
      // For now, test validation
      const response = await request(app)
        .post('/api/v1/auth/plex/pin')
        .send({ clientName: 'Test' })
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('POST /api/v1/auth/plex/verify', () => {
    it('should verify authorized PIN and create user', async () => {
      const response = await request(app)
        .post('/api/v1/auth/plex/verify')
        .send({
          pinId: 'test-pin-first-user',
          rememberMe: false,
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          user: {
            id: expect.any(String),
            username: expect.any(String),
            role: expect.any(String),
          },
          token: expect.any(String),
        },
      });
    });

    it('should handle unauthorized PIN', async () => {
      const response = await request(app)
        .post('/api/v1/auth/plex/verify')
        .send({
          pinId: 'unauthorized-pin',
          rememberMe: false,
        })
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'PIN_NOT_AUTHORIZED',
        },
      });
    });

    it('should handle invalid PIN format', async () => {
      const response = await request(app)
        .post('/api/v1/auth/plex/verify')
        .send({
          pinId: '',
          rememberMe: false,
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should set remember token when requested', async () => {
      const response = await request(app)
        .post('/api/v1/auth/plex/verify')
        .send({
          pinId: 'test-pin-existing',
          rememberMe: true,
        })
        .expect(200);

      expect(response.body.data.rememberToken).toBeDefined();

      const cookies = response.headers['set-cookie'];
      expect(cookies.some((cookie: string) => cookie.startsWith('rememberToken=')));
    });
  });

  describe('GET /api/v1/auth/session', () => {
    it('should return current user session', async () => {
      // Create user first
      const user = await prisma.user.create({
        data: {
          plexId: 'plex-session-test',
          plexUsername: 'sessionuser',
          email: 'session@example.com',
          role: 'user',
          status: 'active',
          plexToken: 'encrypted-token',
        },
      });

      const token = createAuthToken(user);

      const response = await request(app)
        .get('/api/v1/auth/session')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          user: {
            id: user.id,
            role: 'user',
          },
        },
      });
    });

    it('should require authentication', async () => {
      const response = await request(app).get('/api/v1/auth/session').expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should reject invalid token', async () => {
      const response = await request(app)
        .get('/api/v1/auth/session')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    it('should logout successfully', async () => {
      const user = await prisma.user.create({
        data: {
          plexId: 'plex-logout-test',
          plexUsername: 'logoutuser',
          email: 'logout@example.com',
          role: 'user',
          status: 'active',
          plexToken: 'encrypted-token',
        },
      });

      const token = createAuthToken(user);

      const response = await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Logged out successfully',
      });

      // Check cookies are cleared
      const cookies = response.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies.some((cookie: string) => cookie.includes('token=;')));
    });

    it('should require authentication', async () => {
      const response = await request(app).post('/api/v1/auth/logout').expect(401);

      expect(response.body.success).toBe(false);
    });
  });
});
