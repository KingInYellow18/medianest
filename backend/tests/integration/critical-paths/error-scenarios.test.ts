import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import { databaseCleanup } from '../../helpers/database-cleanup';
import { createAuthToken } from '../../helpers/auth';
import { testUsers } from '../../fixtures/test-data';

// Mock external dependencies before importing app
vi.mock('@/config/redis', () => ({
  redisClient: {
    ping: vi.fn().mockResolvedValue('PONG'),
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    quit: vi.fn(),
  },
  getRedis: vi.fn().mockReturnValue({
    ping: vi.fn().mockResolvedValue('PONG'),
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    quit: vi.fn(),
  }),
  initializeRedis: vi.fn().mockResolvedValue(true),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $on: vi.fn(),
    $queryRaw: vi.fn().mockResolvedValue([{ '1': 1 }]),
    user: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn().mockResolvedValue({
        id: 'test-user-id',
        plexId: 'test-plex-id',
        plexUsername: 'testuser',
        email: 'test@example.com',
        role: 'user',
        status: 'active',
        plexToken: 'encrypted-token',
        createdAt: new Date(),
      }),
    },
    $disconnect: vi.fn(),
  },
}));

vi.mock('@/db/prisma', () => ({
  prisma: {
    $on: vi.fn(),
    $queryRaw: vi.fn().mockResolvedValue([{ '1': 1 }]),
    user: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn().mockResolvedValue({
        id: 'test-user-id',
        plexId: 'test-plex-id',
        plexUsername: 'testuser',
        email: 'test@example.com',
        role: 'user',
        status: 'active',
        plexToken: 'encrypted-token',
        createdAt: new Date(),
      }),
    },
    $disconnect: vi.fn(),
  },
}));

// Mock axios to prevent real network calls
vi.mock('axios', () => {
  const mockAxios = {
    post: vi.fn().mockRejectedValue(new Error('Network error - mocked')),
    get: vi.fn().mockRejectedValue(new Error('Network error - mocked')),
    isAxiosError: vi.fn().mockReturnValue(true),
  };

  return {
    default: {
      ...mockAxios,
      create: vi.fn().mockReturnValue(mockAxios),
    },
  };
});

import { app } from '@/app';

describe('Error Scenarios - Critical Path', () => {
  let userToken: string;
  let testUser: any;

  beforeAll(async () => {
    await databaseCleanup.cleanAll();

    testUser = {
      id: 'test-user-id',
      plexId: testUsers[0].plexId,
      plexUsername: testUsers[0].username,
      email: testUsers[0].email,
      role: testUsers[0].role,
      status: testUsers[0].status,
      plexToken: 'encrypted-token',
      createdAt: new Date(),
    };

    userToken = createAuthToken(testUser);
  });

  afterAll(async () => {
    await databaseCleanup.cleanAll();
  });

  it('should implement graceful degradation when services unavailable', async () => {
    const response = await request(app)
      .get('/api/v1/services/status')
      .set('Authorization', `Bearer ${userToken}`);

    // Should return service status even if some services are down
    expect(response.status).toBeLessThan(500);
    expect(response.body).toHaveProperty('success');
  });

  it('should implement proper error handling with user-friendly messages', async () => {
    const response = await request(app)
      .post('/api/v1/media/request')
      .send({})
      .set('Authorization', `Bearer ${userToken}`)
      .expect(400);

    expect(response.body).toMatchObject({
      success: false,
      error: {
        message: expect.any(String),
      },
    });
  });
});
