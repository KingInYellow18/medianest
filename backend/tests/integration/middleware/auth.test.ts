import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '@/app';
import { prisma } from '@/db/prisma';
import { databaseCleanup } from '../../helpers/database-cleanup';
import {
  createAuthToken,
  createAdminToken,
  createExpiredToken,
  createInvalidToken,
} from '../../helpers/auth';
import { testUsers } from '../../fixtures/test-data';

describe('Auth Middleware - Critical Path', () => {
  let userToken: string;
  let adminToken: string;
  let testUser: any;
  let adminUser: any;

  beforeAll(async () => {
    await databaseCleanup.cleanAll();

    // Create test users
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

    adminUser = await prisma.user.create({
      data: {
        plexId: testUsers[1].plexId,
        plexUsername: testUsers[1].username,
        email: testUsers[1].email,
        role: testUsers[1].role,
        status: testUsers[1].status,
        plexToken: 'encrypted-admin-token',
      },
    });

    userToken = createAuthToken(testUser);
    adminToken = createAuthToken(adminUser);
  });

  afterAll(async () => {
    await databaseCleanup.cleanAll();
    await prisma.$disconnect();
  });

  describe('JWT Validation', () => {
    it('should accept valid JWT tokens', async () => {
      const response = await request(app)
        .get('/api/v1/auth/session')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          user: {
            id: testUser.id,
            role: 'user',
          },
        },
      });
    });

    it('should reject expired tokens', async () => {
      const expiredToken = createExpiredToken();

      const response = await request(app)
        .get('/api/v1/auth/session')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should reject malformed tokens', async () => {
      const invalidToken = createInvalidToken();

      const response = await request(app)
        .get('/api/v1/auth/session')
        .set('Authorization', `Bearer ${invalidToken}`)
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should require Authorization header', async () => {
      const response = await request(app).get('/api/v1/auth/session').expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Role-based Access Control', () => {
    it('should allow user access to user endpoints', async () => {
      const response = await request(app)
        .get('/api/v1/media/search')
        .query({ query: 'test' })
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should allow admin access to admin endpoints', async () => {
      const response = await request(app)
        .get('/api/v1/media/requests/all')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should deny user access to admin endpoints', async () => {
      const response = await request(app)
        .get('/api/v1/media/requests/all')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          message: 'Access denied',
        },
      });
    });

    it('should enforce user isolation', async () => {
      // Create another user
      const otherUser = await prisma.user.create({
        data: {
          plexId: 'isolation-test-user',
          plexUsername: 'isolationuser',
          email: 'isolation@example.com',
          role: 'user',
          status: 'active',
          plexToken: 'encrypted-isolation-token',
        },
      });

      // Create a request for the other user
      const otherRequest = await prisma.mediaRequest.create({
        data: {
          userId: otherUser.id,
          title: 'Isolation Test Movie',
          mediaType: 'movie',
          tmdbId: '777777',
          status: 'pending',
          requestedAt: new Date(),
        },
      });

      // Test user should not access other user's request
      const response = await request(app)
        .get(`/api/v1/media/requests/${otherRequest.id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          message: 'Access denied',
        },
      });
    });
  });
});
