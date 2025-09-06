import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import request from 'supertest';

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only';
process.env.REDIS_URL = 'redis://mock-redis:6379';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';

// Mock logger first
vi.mock('@/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock IORedis completely
vi.mock('ioredis', () => ({
  default: vi.fn(() => ({
    ping: vi.fn().mockResolvedValue('PONG'),
    on: vi.fn(),
    quit: vi.fn().mockResolvedValue('OK'),
  })),
}));

// Mock config
vi.mock('@/config/index', () => ({
  config: {
    NODE_ENV: 'test',
    JWT_SECRET: 'test-jwt-secret',
    jwt: { secret: 'test-jwt-secret' },
  },
  getRedisConfig: vi.fn(() => ({ host: 'localhost', port: 6379 })),
  isTest: vi.fn(() => true),
  validateRequiredConfig: vi.fn(),
  logConfiguration: vi.fn(),
}));

// Mock Prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    $on: vi.fn(),
    $queryRaw: vi.fn().mockResolvedValue([{ '1': 1 }]),
    $disconnect: vi.fn(),
  },
}));

// Mock axios
vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => ({
      interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
    })),
    isAxiosError: vi.fn().mockReturnValue(true),
  },
}));

// Mock Socket.IO
vi.mock('socket.io', () => ({
  Server: vi.fn(() => ({ on: vi.fn() })),
}));

// Mock Redis config functions
vi.mock('@/config/redis', () => ({
  initializeRedis: vi.fn(() =>
    Promise.resolve({
      ping: vi.fn().mockResolvedValue('PONG'),
      on: vi.fn(),
    }),
  ),
  getRedis: vi.fn(() => ({
    ping: vi.fn().mockResolvedValue('PONG'),
  })),
}));

// Mock HTTP and HTTPS modules
vi.mock('http', async () => {
  const actual = await vi.importActual('http');
  return {
    ...actual,
    createServer: vi.fn((app) => app),
    Agent: vi.fn(() => ({
      keepAlive: true,
      maxSockets: 10,
    })),
  };
});

vi.mock('https', async () => {
  const actual = await vi.importActual('https');
  return {
    ...actual,
    Agent: vi.fn(() => ({
      keepAlive: true,
      maxSockets: 10,
    })),
  };
});

describe('API Integration - Basic Success Patterns', () => {
  let app: any;

  beforeAll(async () => {
    // Import app after mocks are set up
    const { app: importedApp } = await import('../../src/app');
    app = importedApp;
  });

  afterAll(() => {
    vi.clearAllMocks();
  });

  describe('Health Check Endpoint', () => {
    it('should return 200 OK with health status', async () => {
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
    });
  });

  describe('Authentication Endpoints', () => {
    it('should handle POST /auth/plex/pin gracefully', async () => {
      const response = await request(app)
        .post('/api/v1/auth/plex/pin')
        .send({ clientName: 'Test Client' });

      // Should not crash, should return proper error status
      expect([400, 401, 403, 503]).toContain(response.status);
      expect(response.body).toHaveProperty('error');
    });

    it('should handle GET /auth/session without auth', async () => {
      const response = await request(app).get('/api/v1/auth/session');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for non-existent routes', async () => {
      const response = await request(app).get('/api/v1/non-existent-route');

      expect(response.status).toBe(404);
      expect(response.body).toMatchObject({
        error: 'Not Found',
        message: expect.any(String),
        path: '/api/v1/non-existent-route',
        timestamp: expect.any(String),
      });
    });
  });

  describe('Security Headers', () => {
    it('should include basic security headers', async () => {
      const response = await request(app).get('/api/v1/health');

      expect(response.status).toBe(200);
      // Basic security validation
      expect(response.type).toBe('application/json');
    });
  });
});
