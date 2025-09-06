import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import { app } from '@/app';
import { prisma } from '@/db/prisma';
import { databaseCleanup } from '../../helpers/database-cleanup';
import { createAuthToken } from '../../helpers/auth';
import { testUsers } from '../../fixtures/test-data';

// Mock ioredis to prevent actual Redis connections
vi.mock('ioredis', () => {
  const mockRedis = {
    ping: vi.fn().mockResolvedValue('PONG'),
    disconnect: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(),
    info: vi.fn().mockResolvedValue(''),
    flushdb: vi.fn().mockResolvedValue(0),
  };

  return {
    default: vi.fn().mockImplementation(() => mockRedis),
    Redis: vi.fn().mockImplementation(() => mockRedis),
  };
});

// Mock Redis config to return mock client
vi.mock('@/config/redis', () => ({
  initializeRedis: vi.fn().mockResolvedValue({
    ping: vi.fn().mockResolvedValue('PONG'),
    disconnect: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(),
  }),
  getRedis: vi.fn().mockReturnValue({
    ping: vi.fn().mockResolvedValue('PONG'),
    disconnect: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(),
  }),
  redisClient: {
    ping: vi.fn().mockResolvedValue('PONG'),
    disconnect: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(),
  },
}));

describe('Service Monitoring - Critical Path', () => {
  let userToken: string;
  let testUser: any;

  beforeAll(async () => {
    await databaseCleanup.cleanAll(prisma);

    testUser = await prisma.user.create({
      data: {
        plexId: testUsers[0].plexId,
        plexUsername: testUsers[0].username,
        email: testUsers[0].email,
        role: testUsers[0].role,
        status: testUsers[0].status,
        plexToken: 'encrypted-token',
      },
    });

    userToken = createAuthToken(testUser);
  });

  afterAll(async () => {
    await databaseCleanup.cleanAll(prisma);
    await prisma.$disconnect();
  });

  it('should implement service health checks via Uptime Kuma', async () => {
    const response = await request(app)
      .get('/api/v1/services/status')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);

    expect(response.body).toMatchObject({
      success: true,
      data: {
        services: expect.arrayContaining([
          expect.objectContaining({
            name: expect.any(String),
            status: expect.stringMatching(/^(online|offline|degraded)$/),
            responseTime: expect.any(Number),
          }),
        ]),
      },
    });
  });

  it('should implement service status caching', async () => {
    // Make multiple rapid requests to test caching
    const responses = await Promise.all([
      request(app).get('/api/v1/services/status').set('Authorization', `Bearer ${userToken}`),
      request(app).get('/api/v1/services/status').set('Authorization', `Bearer ${userToken}`),
      request(app).get('/api/v1/services/status').set('Authorization', `Bearer ${userToken}`),
    ]);

    responses.forEach((response) => {
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    // Cached responses should be consistent and fast
    expect(responses[0].body).toMatchObject(responses[1].body);
  });
});
