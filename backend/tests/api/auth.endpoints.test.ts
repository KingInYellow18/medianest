import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { app } from '@/app';
import { server } from '../mocks/server';
import { http, HttpResponse } from 'msw';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

describe('API Endpoints: Authentication (/api/v1/auth)', () => {
  beforeAll(async () => {
    // Clean test database
    await prisma.session.deleteMany();
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(() => {
    server.resetHandlers();
  });

  describe('POST /api/v1/auth/plex/pin', () => {
    it('should generate a new Plex PIN', async () => {
      const response = await request(app).post('/api/v1/auth/plex/pin').expect(200);

      expect(response.body).toMatchObject({
        id: expect.any(Number),
        code: expect.stringMatching(/^[A-Z0-9]{4}$/),
        expiresIn: expect.any(Number),
        qrCodeUrl: expect.stringContaining('plex.tv'),
      });

      // Headers should include rate limit info
      expect(response.headers).toMatchObject({
        'x-ratelimit-limit': expect.any(String),
        'x-ratelimit-remaining': expect.any(String),
      });
    });

    it('should handle Plex API errors gracefully', async () => {
      server.use(
        http.post('https://plex.tv/api/v2/pins', () => {
          return HttpResponse.json({ error: 'Internal Server Error' }, { status: 500 });
        }),
      );

      const response = await request(app).post('/api/v1/auth/plex/pin').expect(503);

      expect(response.body).toMatchObject({
        error: expect.stringContaining('Plex authentication service'),
        service: 'plex',
        retryAfter: expect.any(Number),
      });
    });

    it('should include CORS headers for frontend access', async () => {
      const response = await request(app)
        .post('/api/v1/auth/plex/pin')
        .set('Origin', process.env.FRONTEND_URL)
        .expect(200);

      expect(response.headers['access-control-allow-origin']).toBe(process.env.FRONTEND_URL);
      expect(response.headers['access-control-allow-credentials']).toBe('true');
    });
  });

  describe('POST /api/v1/auth/plex/verify', () => {
    let pinId: string;

    beforeEach(async () => {
      // Generate a PIN first
      const pinResponse = await request(app).post('/api/v1/auth/plex/pin').expect(200);

      pinId = String(pinResponse.body.id);
    });

    it('should verify authorized PIN and create session', async () => {
      // Mock authorized PIN
      server.use(
        http.get(`https://plex.tv/api/v2/pins/${pinId}`, () => {
          return HttpResponse.json({
            id: parseInt(pinId),
            code: 'ABCD',
            authToken: 'plex-auth-token-123',
            clientIdentifier: process.env.PLEX_CLIENT_ID,
            expiresAt: new Date(Date.now() + 900000).toISOString(),
          });
        }),
      );

      const response = await request(app)
        .post('/api/v1/auth/plex/verify')
        .send({ pinId })
        .expect(200);

      expect(response.body).toMatchObject({
        user: {
          id: expect.any(String),
          plexId: expect.any(String),
          username: expect.any(String),
          email: expect.any(String),
          role: expect.stringMatching(/^(user|admin)$/),
          status: 'active',
        },
        token: expect.any(String),
        expiresIn: expect.any(Number),
      });

      // Should set secure cookie
      const cookies = response.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies[0]).toContain('auth-token');
      expect(cookies[0]).toContain('HttpOnly');
      expect(cookies[0]).toContain('SameSite=Strict');
    });

    it('should reject unauthorized PIN', async () => {
      // Mock unauthorized PIN (no authToken)
      server.use(
        http.get(`https://plex.tv/api/v2/pins/${pinId}`, () => {
          return HttpResponse.json({
            id: parseInt(pinId),
            code: 'ABCD',
            authToken: null,
            clientIdentifier: process.env.PLEX_CLIENT_ID,
            expiresAt: new Date(Date.now() + 900000).toISOString(),
          });
        }),
      );

      const response = await request(app)
        .post('/api/v1/auth/plex/verify')
        .send({ pinId })
        .expect(401);

      expect(response.body).toMatchObject({
        error: expect.stringContaining('not authorized'),
      });
    });

    it('should validate request body', async () => {
      const invalidRequests = [
        { body: {}, expectedError: 'pinId is required' },
        { body: { pinId: '' }, expectedError: 'Invalid PIN' },
        { body: { pinId: 'abc' }, expectedError: 'Invalid PIN' },
        { body: { pinId: '12345', extra: 'field' }, expectedError: 'Unknown field' },
      ];

      for (const { body, expectedError } of invalidRequests) {
        const response = await request(app).post('/api/v1/auth/plex/verify').send(body).expect(400);

        expect(response.body.error).toContain(expectedError);
      }
    });

    it('should handle remember me option', async () => {
      server.use(
        http.get(`https://plex.tv/api/v2/pins/${pinId}`, () => {
          return HttpResponse.json({
            id: parseInt(pinId),
            code: 'ABCD',
            authToken: 'plex-auth-token-remember',
            clientIdentifier: process.env.PLEX_CLIENT_ID,
            expiresAt: new Date(Date.now() + 900000).toISOString(),
          });
        }),
      );

      const response = await request(app)
        .post('/api/v1/auth/plex/verify')
        .send({ pinId, rememberMe: true })
        .expect(200);

      // Token should have 90-day expiration
      expect(response.body.expiresIn).toBe(90 * 24 * 60 * 60);

      // Cookie should have extended expiration
      const cookies = response.headers['set-cookie'];
      expect(cookies[0]).toContain('Max-Age=7776000'); // 90 days
    });
  });

  describe('GET /api/v1/auth/session', () => {
    let authToken: string;
    let userId: string;

    beforeAll(async () => {
      // Create test user and session
      const user = await prisma.user.create({
        data: {
          plexId: 'session-test-user',
          username: 'sessionuser',
          email: 'session@example.com',
          role: 'user',
          status: 'active',
        },
      });
      userId = user.id;

      const session = await prisma.session.create({
        data: {
          userId: user.id,
          expiresAt: new Date(Date.now() + 86400000), // 24 hours
        },
      });

      authToken = jwt.sign(
        { userId: user.id, role: user.role, sessionId: session.id },
        process.env.JWT_SECRET!,
        { expiresIn: '24h' },
      );
    });

    it('should return current session for authenticated user', async () => {
      const response = await request(app)
        .get('/api/v1/auth/session')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        user: {
          id: userId,
          username: 'sessionuser',
          email: 'session@example.com',
          role: 'user',
          status: 'active',
        },
        session: {
          expiresAt: expect.any(String),
          createdAt: expect.any(String),
        },
      });

      // Should not include sensitive data
      expect(response.body.user).not.toHaveProperty('plexToken');
      expect(response.body.user).not.toHaveProperty('password');
    });

    it('should reject requests without authentication', async () => {
      await request(app).get('/api/v1/auth/session').expect(401);
    });

    it('should reject invalid tokens', async () => {
      const invalidToken = jwt.sign({ userId: 'fake-id', role: 'user' }, 'wrong-secret');

      await request(app)
        .get('/api/v1/auth/session')
        .set('Authorization', `Bearer ${invalidToken}`)
        .expect(401);
    });

    it('should reject expired tokens', async () => {
      const expiredToken = jwt.sign(
        { userId, role: 'user' },
        process.env.JWT_SECRET!,
        { expiresIn: '-1h' }, // Already expired
      );

      await request(app)
        .get('/api/v1/auth/session')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    let authToken: string;
    let sessionId: string;

    beforeEach(async () => {
      // Create fresh user and session
      const user = await prisma.user.create({
        data: {
          plexId: `logout-test-${Date.now()}`,
          username: 'logoutuser',
          email: 'logout@example.com',
          role: 'user',
          status: 'active',
        },
      });

      const session = await prisma.session.create({
        data: {
          userId: user.id,
          expiresAt: new Date(Date.now() + 86400000),
        },
      });
      sessionId = session.id;

      authToken = jwt.sign(
        { userId: user.id, role: user.role, sessionId },
        process.env.JWT_SECRET!,
        { expiresIn: '24h' },
      );
    });

    it('should successfully logout and invalidate session', async () => {
      const response = await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        message: 'Logged out successfully',
      });

      // Should clear auth cookie
      const cookies = response.headers['set-cookie'];
      expect(cookies[0]).toContain('auth-token=;');
      expect(cookies[0]).toContain('Max-Age=0');

      // Session should be deleted from database
      const deletedSession = await prisma.session.findUnique({
        where: { id: sessionId },
      });
      expect(deletedSession).toBeNull();

      // Token should no longer work
      await request(app)
        .get('/api/v1/auth/session')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(401);
    });

    it('should require authentication', async () => {
      await request(app).post('/api/v1/auth/logout').expect(401);
    });

    it('should handle multiple logout attempts gracefully', async () => {
      // First logout
      await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Second logout with same token should fail auth
      await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(401);
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits on PIN generation', async () => {
      // Make requests up to rate limit
      const requests = [];
      for (let i = 0; i < 11; i++) {
        requests.push(request(app).post('/api/v1/auth/plex/pin'));
      }

      const responses = await Promise.all(requests);

      // First 10 should succeed
      const successCount = responses.filter((r) => r.status === 200).length;
      const rateLimitedCount = responses.filter((r) => r.status === 429).length;

      expect(successCount).toBe(10);
      expect(rateLimitedCount).toBe(1);

      // Rate limited response should include retry info
      const rateLimitedResponse = responses.find((r) => r.status === 429);
      expect(rateLimitedResponse?.body).toMatchObject({
        error: expect.stringContaining('rate limit'),
        retryAfter: expect.any(Number),
      });
      expect(rateLimitedResponse?.headers['retry-after']).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed JSON gracefully', async () => {
      const response = await request(app)
        .post('/api/v1/auth/plex/verify')
        .set('Content-Type', 'application/json')
        .send('{"invalid json}')
        .expect(400);

      expect(response.body).toMatchObject({
        error: expect.stringContaining('Invalid JSON'),
      });
    });

    it('should handle database errors gracefully', async () => {
      // Mock database error
      const originalCreate = prisma.user.create;
      prisma.user.create = vi.fn().mockRejectedValue(new Error('Database connection lost'));

      server.use(
        http.get(/plex.*pins/, () => {
          return HttpResponse.json({
            id: 99999,
            code: 'TEST',
            authToken: 'test-token',
            expiresAt: new Date(Date.now() + 900000).toISOString(),
          });
        }),
      );

      const response = await request(app)
        .post('/api/v1/auth/plex/verify')
        .send({ pinId: '99999' })
        .expect(503);

      expect(response.body).toMatchObject({
        error: 'Service temporarily unavailable',
        retryAfter: expect.any(Number),
      });

      // Restore original method
      prisma.user.create = originalCreate;
    });
  });
});
