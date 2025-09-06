import request from 'supertest';
import { app } from '../../src/app';
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';

// Mock external dependencies before importing app
vi.mock('@/config/redis', () => ({
  redisClient: {
    ping: vi.fn().mockResolvedValue('PONG'),
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    quit: vi.fn(),
  },
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $on: vi.fn(),
    $queryRaw: vi.fn().mockResolvedValue([{ '1': 1 }]),
    user: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    $disconnect: vi.fn(),
  },
}));

vi.mock('@/db/prisma', () => ({
  getPrismaClient: vi.fn(() => ({
    $on: vi.fn(),
    $queryRaw: vi.fn().mockResolvedValue([{ '1': 1 }]),
    user: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    $disconnect: vi.fn(),
  })),
}));

// Mock axios to prevent real network calls
vi.mock('axios', () => ({
  default: {
    post: vi.fn().mockRejectedValue(new Error('Network error - mocked')),
    get: vi.fn().mockRejectedValue(new Error('Network error - mocked')),
    isAxiosError: vi.fn().mockReturnValue(true),
  },
}));

describe('Core API Endpoints - Container Deployment Verification', () => {
  beforeAll(async () => {
    vi.mock('@/services/cache.service', () => ({
      cacheService: {
        getInfo: vi.fn().mockResolvedValue({
          keyCount: 10,
          memoryUsage: '5.2MB',
        }),
        getOrSet: vi.fn().mockImplementation((key, fn, ttl) => fn()),
      },
    }));

    vi.mock('@/services/status.service', () => ({
      statusService: {
        getAllStatuses: vi.fn().mockResolvedValue([
          {
            service: 'database',
            status: 'healthy',
            responseTime: 15,
            lastCheckAt: new Date(),
          },
        ]),
        getServiceStatus: vi.fn().mockResolvedValue({
          service: 'test',
          status: 'healthy',
          responseTime: 10,
          lastCheckAt: new Date(),
        }),
      },
    }));
  });

  afterAll(async () => {
    vi.clearAllMocks();
  });

  describe('Health Check Endpoint', () => {
    it('should return 200 OK with correct health status', async () => {
      const response = await request(app)
        .get('/api/v1/health')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toEqual({
        status: 'ok',
        timestamp: expect.any(String),
        version: expect.any(String),
        uptime: expect.any(Number),
        environment: expect.any(String),
      });

      // Verify timestamp is valid ISO string
      expect(new Date(response.body.timestamp).toISOString()).toBe(response.body.timestamp);
    });

    it('should return valid JSON structure without authentication', async () => {
      const response = await request(app).get('/api/v1/health');

      expect(response.status).toBe(200);
      expect(response.type).toBe('application/json');
      expect(response.body.status).toBe('ok');
    });
  });

  describe('Authentication Endpoints', () => {
    it('should handle POST /auth/plex/pin without crashing', async () => {
      // Mock axios for Plex API call
      vi.doMock('axios', () => ({
        default: {
          post: vi.fn().mockRejectedValue(new Error('Network error')),
          isAxiosError: vi.fn().mockReturnValue(true),
        },
      }));

      const response = await request(app)
        .post('/api/v1/auth/plex/pin')
        .send({ clientName: 'Test Client' });

      // Should not return 500, even on network errors
      expect([400, 401, 403, 503]).toContain(response.status);
      expect(response.body).toHaveProperty('error');
    });

    it('should handle POST /auth/plex/verify without crashing', async () => {
      const response = await request(app)
        .post('/api/v1/auth/plex/verify')
        .send({ pinId: 'test-pin', rememberMe: false });

      // Should not return 500, should handle validation or auth errors gracefully
      expect([400, 401, 403, 422]).toContain(response.status);
      expect(response.body).toHaveProperty('error');
    });

    it('should handle GET /auth/session without authentication', async () => {
      const response = await request(app).get('/api/v1/auth/session');

      // Should return 401 unauthorized, not 500
      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });

    it('should handle POST /auth/logout endpoint', async () => {
      const response = await request(app).post('/api/v1/auth/logout');

      // Should handle missing auth gracefully
      expect([400, 401, 403]).toContain(response.status);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Dashboard Endpoints (Business Logic)', () => {
    it('should return 401 for dashboard stats without auth', async () => {
      const response = await request(app).get('/api/v1/dashboard/stats');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });

    it('should handle service statuses endpoint', async () => {
      const response = await request(app).get('/api/v1/dashboard/status');

      // This endpoint may be public or require auth
      expect([200, 401]).toContain(response.status);

      if (response.status === 200) {
        expect(response.body).toHaveProperty('success');
        expect(response.body).toHaveProperty('data');
      } else {
        expect(response.body).toHaveProperty('error');
      }
    });

    it('should handle specific service status endpoint', async () => {
      const response = await request(app).get('/api/v1/dashboard/status/database');

      expect([200, 401, 404]).toContain(response.status);
      expect(response.type).toBe('application/json');
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for non-existent routes', async () => {
      const response = await request(app).get('/api/v1/non-existent-route');

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        error: 'Not Found',
        message: 'Cannot GET /api/v1/non-existent-route',
        path: '/api/v1/non-existent-route',
        timestamp: expect.any(String),
      });
    });

    it('should handle invalid JSON payloads', async () => {
      const response = await request(app)
        .post('/api/v1/auth/plex/pin')
        .send('invalid-json')
        .set('Content-Type', 'application/json');

      // Should handle malformed JSON gracefully
      expect([400, 422]).toContain(response.status);
    });

    it('should handle oversized payloads', async () => {
      const largePayload = 'a'.repeat(11 * 1024 * 1024); // 11MB (over limit)

      const response = await request(app)
        .post('/api/v1/auth/plex/pin')
        .send({ data: largePayload });

      expect(response.status).toBe(413); // Payload too large
    });
  });

  describe('CORS and Security Headers', () => {
    it('should include security headers', async () => {
      const response = await request(app).get('/api/v1/health');

      expect(response.headers).toHaveProperty('x-content-type-options');
      expect(response.headers).toHaveProperty('x-frame-options');
      expect(response.headers).toHaveProperty('x-xss-protection');
    });

    it('should handle CORS preflight requests', async () => {
      const response = await request(app)
        .options('/api/v1/health')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'GET');

      expect([200, 204]).toContain(response.status);
    });
  });

  describe('Rate Limiting', () => {
    it('should apply rate limiting headers', async () => {
      const response = await request(app).get('/api/v1/health');

      // Rate limiting headers should be present
      expect(response.headers['x-ratelimit-limit']).toBeDefined();
      expect(response.headers['x-ratelimit-remaining']).toBeDefined();
    });
  });
});
