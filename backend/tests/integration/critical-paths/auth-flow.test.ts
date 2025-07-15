import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { app } from '@/app';
import { server } from '../../mocks/server';
import { http, HttpResponse } from 'msw';

const prisma = new PrismaClient();

describe('Critical Path: Plex OAuth Authentication Flow', () => {
  beforeAll(async () => {
    // Clean up test database
    await prisma.session.deleteMany();
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(() => {
    // Reset MSW handlers to default
    server.resetHandlers();
  });

  it('should complete full authentication flow from PIN to JWT', async () => {
    // Step 1: Generate PIN
    const pinResponse = await request(app).post('/api/v1/auth/plex/pin').expect(200);

    expect(pinResponse.body).toMatchObject({
      id: expect.any(Number),
      code: expect.stringMatching(/^[A-Z0-9]{4}$/),
      expiresIn: expect.any(Number),
    });

    const { id: pinId, code: pinCode } = pinResponse.body;

    // Step 2: Simulate user authorization at plex.tv
    // Override the PIN check handler to return authorized status
    server.use(
      http.get(`https://plex.tv/api/v2/pins/${pinId}`, () => {
        return HttpResponse.json({
          id: pinId,
          code: pinCode,
          authToken: 'plex-auth-token-test-123',
          clientIdentifier: process.env.PLEX_CLIENT_ID,
          expiresAt: new Date(Date.now() + 900000).toISOString(),
        });
      }),
    );

    // Step 3: Poll for PIN authorization and complete callback
    const authResponse = await request(app)
      .post('/api/v1/auth/plex/callback')
      .send({ pinId: String(pinId) })
      .expect(200);

    expect(authResponse.body).toMatchObject({
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

    const { token, user } = authResponse.body;

    // Step 4: Verify JWT token is valid
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    expect(decoded).toMatchObject({
      userId: user.id,
      role: user.role,
      iss: process.env.JWT_ISSUER,
      aud: process.env.JWT_AUDIENCE,
    });

    // Step 5: Test authenticated request with JWT
    const meResponse = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(meResponse.body).toMatchObject({
      id: user.id,
      plexId: user.plexId,
      username: user.username,
      email: user.email,
      role: user.role,
      status: 'active',
    });

    // Step 6: Verify user was created in database
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
    });

    expect(dbUser).toBeTruthy();
    expect(dbUser!.plexToken).toBeTruthy(); // Should be encrypted
    expect(dbUser!.plexToken).not.toBe('plex-auth-token-test-123'); // Should not be plain text

    // Step 7: Test logout
    const logoutResponse = await request(app)
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(logoutResponse.body.message).toBe('Logged out successfully');

    // Step 8: Verify token is invalidated
    await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`).expect(401);
  });

  it('should handle PIN expiration gracefully', async () => {
    // Generate PIN
    const pinResponse = await request(app).post('/api/v1/auth/plex/pin').expect(200);

    const { id: pinId } = pinResponse.body;

    // Override handler to return expired PIN
    server.use(
      http.get(`https://plex.tv/api/v2/pins/${pinId}`, () => {
        return HttpResponse.json({ error: 'PIN expired' }, { status: 410 });
      }),
    );

    // Try to complete callback with expired PIN
    const authResponse = await request(app)
      .post('/api/v1/auth/plex/callback')
      .send({ pinId: String(pinId) })
      .expect(401);

    expect(authResponse.body.error).toContain('expired');
  });

  it('should handle Plex service unavailability', async () => {
    // Override handler to simulate Plex being down
    server.use(
      http.post('https://plex.tv/api/v2/pins', () => {
        return HttpResponse.json({ error: 'Service unavailable' }, { status: 503 });
      }),
    );

    const response = await request(app).post('/api/v1/auth/plex/pin').expect(503);

    expect(response.body.error).toContain('temporarily unavailable');
  });

  it('should enforce remember me token expiration', async () => {
    // Complete normal auth flow first
    const pinResponse = await request(app).post('/api/v1/auth/plex/pin').expect(200);

    const { id: pinId } = pinResponse.body;

    server.use(
      http.get(`https://plex.tv/api/v2/pins/${pinId}`, () => {
        return HttpResponse.json({
          id: pinId,
          code: 'ABCD',
          authToken: 'plex-auth-token-remember',
          clientIdentifier: process.env.PLEX_CLIENT_ID,
          expiresAt: new Date(Date.now() + 900000).toISOString(),
        });
      }),
    );

    // Request with remember me
    const authResponse = await request(app)
      .post('/api/v1/auth/plex/callback')
      .send({
        pinId: String(pinId),
        rememberMe: true,
      })
      .expect(200);

    const { token, expiresIn } = authResponse.body;

    // Remember me tokens should expire in 90 days
    expect(expiresIn).toBe(90 * 24 * 60 * 60); // 90 days in seconds

    // Verify token has correct expiration
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    const expirationDate = new Date(decoded.exp * 1000);
    const expectedExpiration = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

    // Allow 1 minute tolerance for test execution time
    expect(Math.abs(expirationDate.getTime() - expectedExpiration.getTime())).toBeLessThan(60000);
  });

  it('should prevent authentication without valid Plex account', async () => {
    // Generate PIN
    const pinResponse = await request(app).post('/api/v1/auth/plex/pin').expect(200);

    const { id: pinId } = pinResponse.body;

    // Override handlers to simulate authorized PIN but invalid account
    server.use(
      http.get(`https://plex.tv/api/v2/pins/${pinId}`, () => {
        return HttpResponse.json({
          id: pinId,
          code: 'ABCD',
          authToken: 'invalid-token',
          clientIdentifier: process.env.PLEX_CLIENT_ID,
          expiresAt: new Date(Date.now() + 900000).toISOString(),
        });
      }),
      http.get('https://plex.tv/users/account.json', () => {
        return HttpResponse.json({ error: 'Invalid authentication token' }, { status: 401 });
      }),
    );

    const authResponse = await request(app)
      .post('/api/v1/auth/plex/callback')
      .send({ pinId: String(pinId) })
      .expect(401);

    expect(authResponse.body.error).toContain('Failed to get Plex account');
  });

  it('should handle concurrent authentication attempts', async () => {
    // Generate multiple PINs
    const pinPromises = Array(5)
      .fill(null)
      .map(() => request(app).post('/api/v1/auth/plex/pin'));

    const pinResponses = await Promise.all(pinPromises);

    // All should succeed
    pinResponses.forEach((response) => {
      expect(response.status).toBe(200);
      expect(response.body.code).toMatch(/^[A-Z0-9]{4}$/);
    });

    // Each PIN should be unique
    const codes = pinResponses.map((r) => r.body.code);
    const uniqueCodes = new Set(codes);
    expect(uniqueCodes.size).toBe(codes.length);
  });

  it('should clean up expired sessions', async () => {
    // Create a user with an expired session
    const user = await prisma.user.create({
      data: {
        plexId: 'expired-user',
        username: 'expireduser',
        email: 'expired@example.com',
        role: 'user',
        status: 'active',
      },
    });

    // Create expired session
    await prisma.session.create({
      data: {
        id: 'expired-session',
        userId: user.id,
        expiresAt: new Date(Date.now() - 1000), // Already expired
      },
    });

    // Create valid session
    await prisma.session.create({
      data: {
        id: 'valid-session',
        userId: user.id,
        expiresAt: new Date(Date.now() + 86400000), // 24 hours from now
      },
    });

    // Attempt to use expired session token
    const expiredToken = jwt.sign(
      { userId: user.id, role: user.role, sessionId: 'expired-session' },
      process.env.JWT_SECRET!,
      { expiresIn: '1h' },
    );

    await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${expiredToken}`)
      .expect(401);

    // Valid session should still work
    const validToken = jwt.sign(
      { userId: user.id, role: user.role, sessionId: 'valid-session' },
      process.env.JWT_SECRET!,
      { expiresIn: '1h' },
    );

    const response = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${validToken}`)
      .expect(200);

    expect(response.body.id).toBe(user.id);
  });
});
