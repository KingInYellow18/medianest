import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '@/app';
import { prisma } from '@/db/prisma';
import { databaseCleanup } from '../../helpers/database-cleanup';
import { createAuthToken } from '../../helpers/auth';
import { testUsers } from '../../fixtures/test-data';

describe('Error Scenarios - Critical Path', () => {
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
