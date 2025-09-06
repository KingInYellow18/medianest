// EXTREME ISOLATION TEST - Minimal auth endpoint test with nuclear mocking

// Set environment FIRST
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-32-chars-long-minimum';
process.env.PLEX_CLIENT_IDENTIFIER = 'test-client';
process.env.PLEX_CLIENT_SECRET = 'test-secret';
process.env.DATABASE_URL = 'file:./test.db';
process.env.REDIS_URL = 'redis://mock:6379/0';

import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';

// NUCLEAR MOCKING - Mock EVERYTHING that could touch Redis
vi.mock('ioredis', () => ({
  default: vi.fn(() => ({
    ping: vi.fn().mockResolvedValue('PONG'),
    on: vi.fn(),
    quit: vi.fn().mockResolvedValue('OK'),
  })),
}));

// Mock ALL possible Redis imports
vi.mock('@/config/redis', () => ({
  initializeRedis: vi.fn().mockResolvedValue({}),
  getRedis: vi.fn().mockReturnValue({
    ping: vi.fn().mockResolvedValue('PONG'),
  }),
  redisClient: { ping: vi.fn() },
}));

// Mock ALL services that could import Redis
vi.mock('@/services/integration.service', () => ({
  IntegrationService: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('@/services/youtube.service', () => ({
  YouTubeService: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('@/config/queues', () => ({
  initializeQueues: vi.fn(),
}));

// Mock external APIs
vi.mock('axios', () => ({
  default: {
    post: vi.fn().mockResolvedValue({
      data: '<id>test-pin</id><code>ABCD</code>',
    }),
    isAxiosError: vi.fn().mockReturnValue(false),
    create: vi.fn(() => ({
      post: vi.fn().mockResolvedValue({ data: {} }),
      interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
    })),
  },
}));

// Mock CSRF completely
vi.mock('@/middleware/csrf', () => ({
  generateCSRFToken: (req: any, res: any, next: any) => next(),
  validateCSRFToken: (req: any, res: any, next: any) => next(),
  refreshCSRFToken: (req: any, res: any, next: any) => next(),
  optionalAuth: () => (req: any, res: any, next: any) => next(),
  csrfController: {
    getToken: (req: any, res: any) => res.json({ success: true }),
    refreshToken: (req: any, res: any) => res.json({ success: true }),
  },
}));

// NOW import the app
import { app } from '@/app';

describe('Auth Endpoints - Simple Test', () => {
  it('should return 404 for non-existent route', async () => {
    const response = await request(app).get('/api/v1/non-existent').expect(404);

    expect(response.body.error).toBe('Not Found');
  });

  it('should generate Plex PIN successfully', async () => {
    const response = await request(app)
      .post('/api/v1/auth/plex/pin')
      .send({ clientName: 'Test' })
      .expect(200);

    expect(response.body.success).toBe(true);
  });
});
