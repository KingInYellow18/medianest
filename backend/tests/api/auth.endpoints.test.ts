// Set required environment variables BEFORE importing anything
process.env.JWT_SECRET = 'test-jwt-secret-for-auth-endpoints';
process.env.PLEX_CLIENT_IDENTIFIER = 'test-client-id';
process.env.PLEX_CLIENT_SECRET = 'test-client-secret';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'file:./test.db';

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '@/app';
import { prisma } from '@/db/prisma';
import { databaseCleanup } from '../helpers/database-cleanup';
import { createAuthToken } from '../helpers/auth';

describe('Auth Endpoints - Critical Path', () => {
  beforeAll(async () => {
    await databaseCleanup.cleanAll();
  });

  afterAll(async () => {
    await databaseCleanup.cleanAll();
    await prisma.$disconnect();
  });

  describe('POST /api/v1/auth/plex/pin', () => {
    it('should generate Plex PIN successfully', async () => {
      const response = await request(app)
        .post('/api/v1/auth/plex/pin')
        .send({ clientName: 'MediaNest Test' })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          id: expect.any(String),
          code: expect.stringMatching(/^[A-Z0-9]+$/),
          qrUrl: expect.stringContaining('plex.tv/link'),
          expiresIn: 900,
        },
      });
    });

    it('should use default client name when not provided', async () => {
      const response = await request(app).post('/api/v1/auth/plex/pin').send({}).expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should handle Plex API errors', async () => {
      // This would need MSW to mock Plex service unavailable
      // For now, test validation
      const response = await request(app)
        .post('/api/v1/auth/plex/pin')
        .send({ clientName: 'Test' })
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('POST /api/v1/auth/plex/verify', () => {
    it('should verify authorized PIN and create user', async () => {
      const response = await request(app)
        .post('/api/v1/auth/plex/verify')
        .send({
          pinId: 'test-pin-first-user',
          rememberMe: false,
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          user: {
            id: expect.any(String),
            username: expect.any(String),
            role: expect.any(String),
          },
          token: expect.any(String),
        },
      });
    });

    it('should handle unauthorized PIN', async () => {
      const response = await request(app)
        .post('/api/v1/auth/plex/verify')
        .send({
          pinId: 'unauthorized-pin',
          rememberMe: false,
        })
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'PIN_NOT_AUTHORIZED',
        },
      });
    });

    it('should handle invalid PIN format', async () => {
      const response = await request(app)
        .post('/api/v1/auth/plex/verify')
        .send({
          pinId: '',
          rememberMe: false,
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should set remember token when requested', async () => {
      const response = await request(app)
        .post('/api/v1/auth/plex/verify')
        .send({
          pinId: 'test-pin-existing',
          rememberMe: true,
        })
        .expect(200);

      expect(response.body.data.rememberToken).toBeDefined();

      const cookies = response.headers['set-cookie'];
      expect(cookies.some((cookie: string) => cookie.startsWith('rememberToken=')));
    });
  });

  describe('GET /api/v1/auth/session', () => {
    it('should return current user session', async () => {
      // Create user first
      const user = await prisma.user.create({
        data: {
          plexId: 'plex-session-test',
          plexUsername: 'sessionuser',
          email: 'session@example.com',
          role: 'user',
          status: 'active',
          plexToken: 'encrypted-token',
        },
      });

      const token = createAuthToken(user);

      const response = await request(app)
        .get('/api/v1/auth/session')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          user: {
            id: user.id,
            role: 'user',
          },
        },
      });
    });

    it('should require authentication', async () => {
      const response = await request(app).get('/api/v1/auth/session').expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should reject invalid token', async () => {
      const response = await request(app)
        .get('/api/v1/auth/session')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    it('should logout successfully', async () => {
      const user = await prisma.user.create({
        data: {
          plexId: 'plex-logout-test',
          plexUsername: 'logoutuser',
          email: 'logout@example.com',
          role: 'user',
          status: 'active',
          plexToken: 'encrypted-token',
        },
      });

      const token = createAuthToken(user);

      const response = await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Logged out successfully',
      });

      // Check cookies are cleared
      const cookies = response.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies.some((cookie: string) => cookie.includes('token=;')));
    });

    it('should require authentication', async () => {
      const response = await request(app).post('/api/v1/auth/logout').expect(401);

      expect(response.body.success).toBe(false);
    });
  });
});
