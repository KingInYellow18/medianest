import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import { app } from '@/app';
import { prisma } from '@/db/prisma';
import { databaseCleanup } from '../../helpers/database-cleanup';
import { testUsers } from '../../fixtures/test-data';

describe('Plex OAuth Integration - Critical Path', () => {
  beforeAll(async () => {
    await databaseCleanup.cleanAll();
  });

  afterAll(async () => {
    await databaseCleanup.cleanAll();
    await prisma.$disconnect();
  });

  describe('PIN Generation Flow', () => {
    it('should generate a Plex PIN successfully', async () => {
      const response = await request(app)
        .post('/api/v1/auth/plex/pin')
        .send({ clientName: 'MediaNest Test' })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          id: expect.any(String),
          code: expect.stringMatching(/^[A-Z0-9]{4}$/),
          qrUrl: expect.stringContaining('plex.tv/link'),
          expiresIn: 900,
        },
      });

      expect(response.body.data.code).toHaveLength(4);
    });

    it('should handle Plex API errors gracefully', async () => {
      // Mock Plex API to return error
      vi.mocked(global.fetch).mockRejectedValueOnce(new Error('ECONNREFUSED'));

      const response = await request(app)
        .post('/api/v1/auth/plex/pin')
        .send({ clientName: 'MediaNest Test' })
        .expect(503);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          message: expect.stringContaining('Cannot connect to Plex server'),
          code: 'PLEX_UNREACHABLE',
        },
      });
    });

    it('should use default client name when none provided', async () => {
      const response = await request(app).post('/api/v1/auth/plex/pin').send({}).expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('code');
    });
  });

  describe('PIN Verification Flow', () => {
    it('should verify PIN and create new user', async () => {
      const response = await request(app)
        .post('/api/v1/auth/plex/verify')
        .send({
          pinId: 'test-pin-123',
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

      // Check cookies are set
      expect(response.headers['set-cookie']).toBeDefined();
      const cookies = response.headers['set-cookie'];
      expect(cookies.some((cookie: string) => cookie.startsWith('token=')));
    });

    it('should verify PIN and update existing user', async () => {
      // Create existing user first
      await prisma.user.create({
        data: {
          plexId: 'plex-test-123',
          plexUsername: 'existinguser',
          email: 'existing@example.com',
          role: 'user',
          status: 'active',
          plexToken: 'encrypted-token',
        },
      });

      const response = await request(app)
        .post('/api/v1/auth/plex/verify')
        .send({
          pinId: 'test-pin-existing',
          rememberMe: true,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.username).toBe('testuser');
      expect(response.body.data.rememberToken).toBeDefined();

      // Check remember cookie is set
      const cookies = response.headers['set-cookie'];
      expect(cookies.some((cookie: string) => cookie.startsWith('rememberToken=')));
    });

    it('should make first user admin', async () => {
      await databaseCleanup.cleanAll();

      const response = await request(app)
        .post('/api/v1/auth/plex/verify')
        .send({
          pinId: 'test-pin-first-user',
          rememberMe: false,
        })
        .expect(200);

      expect(response.body.data.user.role).toBe('admin');
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
          message: expect.stringContaining('PIN has not been authorized'),
          code: 'PIN_NOT_AUTHORIZED',
        },
      });
    });

    it('should handle invalid PIN', async () => {
      const response = await request(app)
        .post('/api/v1/auth/plex/verify')
        .send({
          pinId: 'invalid-pin',
          rememberMe: false,
        })
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'INVALID_PIN',
        },
      });
    });
  });

  describe('Session Management', () => {
    it('should get current session for authenticated user', async () => {
      // Create user and get token first
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

      const loginResponse = await request(app).post('/api/v1/auth/plex/verify').send({
        pinId: 'session-test-pin',
        rememberMe: false,
      });

      const token = loginResponse.body.data.token;

      const sessionResponse = await request(app)
        .get('/api/v1/auth/session')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(sessionResponse.body).toMatchObject({
        success: true,
        data: {
          user: {
            id: expect.any(String),
            username: expect.any(String),
            role: 'user',
          },
        },
      });
    });

    it('should logout and clear cookies', async () => {
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

      const loginResponse = await request(app).post('/api/v1/auth/plex/verify').send({
        pinId: 'logout-test-pin',
        rememberMe: true,
      });

      const token = loginResponse.body.data.token;

      const logoutResponse = await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(logoutResponse.body).toMatchObject({
        success: true,
        message: 'Logged out successfully',
      });

      // Check cookies are cleared
      const cookies = logoutResponse.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies.some((cookie: string) => cookie.includes('token=;')));
      expect(cookies.some((cookie: string) => cookie.includes('rememberToken=;')));
    });
  });
});
