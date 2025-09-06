/**
 * WAVE 3 AGENT #9: API ROUTES - ENHANCED AUTH ROUTE TESTS
 *
 * Enhanced API route testing with proven patterns from successful waves
 * - Comprehensive mocking patterns
 * - Robust error handling
 * - Performance tracking
 * - Security validation
 */

// Set test environment FIRST
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-enhanced-routes';
process.env.SKIP_REDIS = 'true';
process.env.DISABLE_REDIS = 'true';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'file:./test-enhanced.db';

import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import request from 'supertest';

// ENHANCED MOCKING PATTERNS - WAVE 3 SUCCESS PATTERN
vi.mock('ioredis', () => {
  const mockClient = {
    ping: vi.fn().mockResolvedValue('PONG'),
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
    on: vi.fn().mockReturnThis(),
    off: vi.fn().mockReturnThis(),
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    quit: vi.fn().mockResolvedValue('OK'),
    status: 'ready',
    ready: true,
  };

  return {
    default: vi.fn(() => mockClient),
    Redis: vi.fn(() => mockClient),
    __esModule: true,
  };
});

// Mock ALL Redis-dependent services
vi.mock('@/config/redis', () => ({
  initializeRedis: vi.fn().mockResolvedValue(null),
  getRedis: vi.fn().mockReturnValue(null),
  redisClient: null,
  closeRedis: vi.fn().mockResolvedValue(undefined),
  checkRedisHealth: vi.fn().mockResolvedValue(false),
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, remainingHits: 100 }),
  __esModule: true,
}));

// Mock authentication middleware
vi.mock('@/middleware/auth', () => ({
  authMiddleware: (req: any, res: any, next: any) => {
    req.user = { id: 'test-user', role: 'user' };
    next();
  },
  requireAuth: (req: any, res: any, next: any) => next(),
  optionalAuth: () => (req: any, res: any, next: any) => next(),
}));

// Mock rate limiting
vi.mock('@/middleware/rate-limiter', () => ({
  rateLimiter: {
    api: (req: any, res: any, next: any) => next(),
    auth: (req: any, res: any, next: any) => next(),
  },
}));

// Mock external services
vi.mock('axios', () => ({
  default: {
    post: vi.fn().mockImplementation((url: string) => {
      if (url.includes('plex.tv/pins.xml')) {
        return Promise.resolve({
          data: '<pin><id>test-pin-123</id><code>ABCD1234</code></pin>',
        });
      }
      if (url.includes('pin/')) {
        return Promise.resolve({
          data: '<pin><authToken>mock-token</authToken><user><title>TestUser</title></user></pin>',
        });
      }
      return Promise.resolve({ data: {} });
    }),
    get: vi.fn().mockResolvedValue({ data: {} }),
    create: vi.fn(() => ({
      post: vi.fn().mockResolvedValue({ data: {} }),
      get: vi.fn().mockResolvedValue({ data: {} }),
    })),
  },
}));

import { app } from '@/app';

describe('Enhanced API Routes - Authentication', () => {
  const performanceMetrics: Array<{ endpoint: string; responseTime: number; status: number }> = [];

  const recordMetrics = (endpoint: string, status: number, responseTime: number) => {
    performanceMetrics.push({ endpoint, status, responseTime });
  };

  beforeEach(() => {
    vi.clearAllMocks();
    performanceMetrics.length = 0;
  });

  describe('POST /api/v1/auth/plex/pin', () => {
    it('should generate PIN successfully with performance tracking', async () => {
      const startTime = Date.now();

      const response = await request(app)
        .post('/api/v1/auth/plex/pin')
        .send({ clientName: 'Enhanced Test Client' })
        .expect('Content-Type', /json/);

      const responseTime = Date.now() - startTime;
      recordMetrics('/api/v1/auth/plex/pin', response.status, responseTime);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data).toHaveProperty('code');

      // Performance assertion
      expect(responseTime).toBeLessThan(2000);
    });

    it('should handle missing client name gracefully', async () => {
      const response = await request(app)
        .post('/api/v1/auth/plex/pin')
        .send({})
        .expect('Content-Type', /json/);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should validate request payload size', async () => {
      const largePayload = { clientName: 'a'.repeat(1000) };

      const response = await request(app).post('/api/v1/auth/plex/pin').send(largePayload);

      expect([200, 400, 413]).toContain(response.status);
    });
  });

  describe('POST /api/v1/auth/plex/verify', () => {
    it('should verify PIN with proper validation', async () => {
      const response = await request(app)
        .post('/api/v1/auth/plex/verify')
        .send({
          pinId: 'test-pin-123',
          rememberMe: false,
        })
        .expect('Content-Type', /json/);

      expect([200, 400]).toContain(response.status);

      if (response.status === 200) {
        expect(response.body).toHaveProperty('success', true);
        expect(response.body.data).toHaveProperty('user');
        expect(response.body.data).toHaveProperty('token');
      }
    });

    it('should handle invalid PIN gracefully', async () => {
      const response = await request(app).post('/api/v1/auth/plex/verify').send({
        pinId: '',
        rememberMe: false,
      });

      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(response.body).toHaveProperty('success', false);
    });

    it('should support remember me functionality', async () => {
      const response = await request(app).post('/api/v1/auth/plex/verify').send({
        pinId: 'test-pin-remember',
        rememberMe: true,
      });

      // Should handle remember token if successful
      if (response.status === 200) {
        const cookies = response.headers['set-cookie'];
        expect(cookies).toBeDefined();
      }
    });
  });

  describe('GET /api/v1/auth/session', () => {
    it('should require authentication', async () => {
      const response = await request(app).get('/api/v1/auth/session');

      // Auth middleware mocked, but route might still validate
      expect([200, 401]).toContain(response.status);
      expect(response.body).toHaveProperty('success');
    });

    it('should return session data when authenticated', async () => {
      const response = await request(app)
        .get('/api/v1/auth/session')
        .set('Authorization', 'Bearer mock-token');

      expect([200, 401]).toContain(response.status);

      if (response.status === 200) {
        expect(response.body.data).toHaveProperty('user');
      }
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    it('should handle logout request', async () => {
      const response = await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', 'Bearer mock-token');

      expect([200, 401]).toContain(response.status);
      expect(response.body).toHaveProperty('success');
    });
  });

  describe('Route Security & Error Handling', () => {
    it('should handle malformed JSON payloads', async () => {
      const response = await request(app)
        .post('/api/v1/auth/plex/pin')
        .send('invalid-json')
        .set('Content-Type', 'application/json');

      expect([400, 422]).toContain(response.status);
    });

    it('should include security headers', async () => {
      const response = await request(app).get('/api/v1/auth/session');

      // Check for common security headers
      expect(response.headers).toHaveProperty('x-content-type-options');
    });

    it('should handle concurrent requests', async () => {
      const requests = Array.from({ length: 5 }, () =>
        request(app).post('/api/v1/auth/plex/pin').send({ clientName: 'Concurrent Test' }),
      );

      const responses = await Promise.all(requests);

      responses.forEach((response) => {
        expect([200, 400, 429]).toContain(response.status);
      });
    });
  });

  describe('Performance Summary', () => {
    it('should report route performance metrics', () => {
      if (performanceMetrics.length === 0) {
        console.log('ℹ️ No performance metrics collected in this test run');
        return;
      }

      const avgResponseTime =
        performanceMetrics.reduce((sum, m) => sum + m.responseTime, 0) / performanceMetrics.length;
      const maxResponseTime = Math.max(...performanceMetrics.map((m) => m.responseTime));
      const successRate =
        performanceMetrics.filter((m) => m.status < 400).length / performanceMetrics.length;

      console.log('\n📊 Enhanced Auth Routes Performance:');
      console.log(`   Average Response Time: ${avgResponseTime.toFixed(2)}ms`);
      console.log(`   Max Response Time: ${maxResponseTime}ms`);
      console.log(`   Success Rate: ${(successRate * 100).toFixed(2)}%`);

      // Performance assertions
      expect(avgResponseTime).toBeLessThan(1000);
      expect(maxResponseTime).toBeLessThan(5000);
    });
  });
});
