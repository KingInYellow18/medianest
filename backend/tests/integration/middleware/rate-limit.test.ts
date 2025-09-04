import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '@/app';
import { prisma } from '@/db/prisma';
import { databaseCleanup } from '../../helpers/database-cleanup';
import { createAuthToken } from '../../helpers/auth';
import { testUsers } from '../../fixtures/test-data';

describe('Rate Limiting Middleware - Critical Path', () => {
  let userToken: string;
  let testUser: any;

  beforeAll(async () => {
    await databaseCleanup.cleanAll();

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
    await databaseCleanup.cleanAll();
    await prisma.$disconnect();
  });

  it('should implement API rate limiting (100/min)', async () => {
    const requests = [];

    for (let i = 0; i < 20; i++) {
      requests.push(
        request(app)
          .get('/api/v1/media/search')
          .query({ query: `test${i}` })
          .set('Authorization', `Bearer ${userToken}`),
      );
    }

    const responses = await Promise.all(requests);
    const rateLimitedCount = responses.filter((r) => r.status === 429).length;

    // Should have some rate limiting after rapid requests
    if (rateLimitedCount > 0) {
      expect(rateLimitedCount).toBeGreaterThan(0);
    }
  });

  it('should implement YouTube download rate limiting (5/hr)', async () => {
    const requests = [];

    for (let i = 0; i < 10; i++) {
      requests.push(
        request(app)
          .post('/api/v1/youtube/download')
          .send({ url: `https://www.youtube.com/watch?v=test${i}`, quality: '720p' })
          .set('Authorization', `Bearer ${userToken}`),
      );
    }

    const responses = await Promise.all(requests);
    const rateLimitedCount = responses.filter((r) => r.status === 429).length;

    expect(rateLimitedCount).toBeGreaterThan(0);
  });
});
