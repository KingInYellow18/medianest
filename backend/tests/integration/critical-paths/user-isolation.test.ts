import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '@/app';
import { prisma } from '@/db/prisma';
import { databaseCleanup } from '../../helpers/database-cleanup';
import { createAuthToken } from '../../helpers/auth';

describe('User Isolation - Critical Path', () => {
  let user1Token: string;
  let user2Token: string;
  let testUser1: any;
  let testUser2: any;

  beforeAll(async () => {
    await databaseCleanup.cleanAll();

    testUser1 = await prisma.user.create({
      data: {
        plexId: 'isolation-user-1',
        plexUsername: 'isolationuser1',
        email: 'isolation1@example.com',
        role: 'user',
        status: 'active',
        plexToken: 'encrypted-token-1',
      },
    });

    testUser2 = await prisma.user.create({
      data: {
        plexId: 'isolation-user-2',
        plexUsername: 'isolationuser2',
        email: 'isolation2@example.com',
        role: 'user',
        status: 'active',
        plexToken: 'encrypted-token-2',
      },
    });

    user1Token = createAuthToken(testUser1);
    user2Token = createAuthToken(testUser2);
  });

  afterAll(async () => {
    await databaseCleanup.cleanAll();
    await prisma.$disconnect();
  });

  it("should ensure users cannot see each other's data", async () => {
    // Create requests for each user
    await prisma.mediaRequest.createMany({
      data: [
        {
          userId: testUser1.id,
          title: 'User 1 Movie',
          mediaType: 'movie',
          tmdbId: '111111',
          status: 'pending',
          requestedAt: new Date(),
        },
        {
          userId: testUser2.id,
          title: 'User 2 Movie',
          mediaType: 'movie',
          tmdbId: '222222',
          status: 'pending',
          requestedAt: new Date(),
        },
      ],
    });

    // User 1 should only see their own requests
    const user1Response = await request(app)
      .get('/api/v1/media/requests')
      .set('Authorization', `Bearer ${user1Token}`)
      .expect(200);

    const user1Requests = user1Response.body.data.requests;
    expect(user1Requests.every((req: any) => req.userId === testUser1.id)).toBe(true);

    // User 2 should only see their own requests
    const user2Response = await request(app)
      .get('/api/v1/media/requests')
      .set('Authorization', `Bearer ${user2Token}`)
      .expect(200);

    const user2Requests = user2Response.body.data.requests;
    expect(user2Requests.every((req: any) => req.userId === testUser2.id)).toBe(true);
  });

  it('should implement proper data access controls', async () => {
    // Create request for user 1
    const user1Request = await prisma.mediaRequest.create({
      data: {
        userId: testUser1.id,
        title: 'Private Movie',
        mediaType: 'movie',
        tmdbId: '333333',
        status: 'pending',
        requestedAt: new Date(),
      },
    });

    // User 2 should not be able to access user 1's request
    const response = await request(app)
      .get(`/api/v1/media/requests/${user1Request.id}`)
      .set('Authorization', `Bearer ${user2Token}`)
      .expect(403);

    expect(response.body).toMatchObject({
      success: false,
      error: {
        message: 'Access denied',
      },
    });
  });
});
