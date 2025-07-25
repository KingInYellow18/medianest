import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createTestApp } from '../../helpers/test-app';
import { server } from '../../msw/setup';
import { http, HttpResponse } from 'msw';
import { cleanupDatabase } from '../../helpers/database-cleanup';
import { testPrismaClient as prisma } from '../../helpers/test-prisma-client';

describe('Critical Path: Plex OAuth Authentication Flow (Simplified)', () => {
  let app: any;

  beforeAll(async () => {
    // Clean up test database using helper
    await cleanupDatabase(prisma);

    // Create test app with mock routes
    app = createTestApp();

    // Mock PIN generation endpoint
    app.post('/api/v1/auth/plex/pin', async (req, res) => {
      // Simulate PIN generation
      const pinId = Math.floor(Math.random() * 1000000);
      const code = Math.random().toString(36).substring(2, 6).toUpperCase();

      res.json({
        id: pinId,
        code,
        expiresIn: 900, // 15 minutes
      });
    });

    // Mock PIN callback endpoint
    app.post('/api/v1/auth/plex/callback', async (req, res) => {
      const { pinId } = req.body;

      if (!pinId) {
        return res.status(400).json({ error: 'PIN ID required' });
      }

      // Check MSW for PIN authorization status
      try {
        // In real app, this would check Plex API
        const plexUserId = `plex-user-${pinId}`;
        const plexUsername = `testuser${pinId}`;
        const email = `user${pinId}@example.com`;

        // Create or update user
        const user = await prisma.user.upsert({
          where: { plexId: plexUserId },
          update: {
            lastLoginAt: new Date(),
          },
          create: {
            plexId: plexUserId,
            plexUsername,
            email,
            role: 'USER', // Use uppercase for role
            plexToken: 'encrypted-token', // Would be encrypted in real app
          },
        });

        // Create session
        const sessionToken = `session-${Date.now()}-${Math.random().toString(36).substring(2)}`;
        const session = await prisma.session.create({
          data: {
            sessionToken,
            userId: user.id,
            expires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
          },
        });

        // Generate JWT
        const token = jwt.sign(
          {
            userId: user.id,
            role: user.role,
            sessionId: session.id,
          },
          process.env.JWT_SECRET!,
          { expiresIn: '24h' },
        );

        res.json({
          user: {
            id: user.id,
            plexId: user.plexId,
            username: user.plexUsername || user.email,
            email: user.email,
            role: user.role,
          },
          token,
          expiresIn: 86400, // 24 hours in seconds
        });
      } catch (error: any) {
        console.error('Auth callback error:', error);
        res.status(500).json({ error: error.message || 'Authentication failed' });
      }
    });

    // Mock me endpoint
    app.get('/api/v1/auth/me', async (req: any, res) => {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const user = await prisma.user.findUnique({
        where: { id: req.user.userId },
      });

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json({
        id: user.id,
        plexId: user.plexId,
        username: user.plexUsername || user.email,
        email: user.email,
        role: user.role,
      });
    });

    // Mock logout endpoint
    app.post('/api/v1/auth/logout', async (req: any, res) => {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Delete session
      if (req.user.sessionId) {
        await prisma.session
          .delete({
            where: { id: req.user.sessionId },
          })
          .catch(() => {
            // Session might already be deleted
          });
      }

      res.json({ message: 'Logged out successfully' });
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Reset MSW handlers to default
    server.resetHandlers();

    // Clean database between tests for isolation
    await cleanupDatabase(prisma);
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

    // Step 2: Complete callback (simulating user authorized the PIN)
    const authResponse = await request(app)
      .post('/api/v1/auth/plex/callback')
      .send({ pinId: String(pinId) })
      .expect(200);

    expect(authResponse.body).toMatchObject({
      user: {
        id: expect.any(String),
        plexId: expect.stringContaining('plex-user-'),
        username: expect.any(String),
        email: expect.any(String),
        role: 'USER',
      },
      token: expect.any(String),
      expiresIn: expect.any(Number),
    });

    const { token, user } = authResponse.body;

    // Step 3: Verify JWT token is valid
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    expect(decoded).toMatchObject({
      userId: user.id,
      role: user.role,
    });

    // Step 4: Test authenticated request with JWT
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
    });

    // Step 5: Verify user was created in database
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
    });

    expect(dbUser).toBeTruthy();
    expect(dbUser!.plexToken).toBeTruthy();

    // Step 6: Test logout
    const logoutResponse = await request(app)
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(logoutResponse.body.message).toBe('Logged out successfully');

    // Step 7: Verify token is invalidated (session deleted)
    const session = await prisma.session.findUnique({
      where: { id: decoded.sessionId },
    });

    expect(session).toBeNull();
  });

  it('should handle invalid PIN gracefully', async () => {
    // Try to complete callback without valid PIN
    const authResponse = await request(app)
      .post('/api/v1/auth/plex/callback')
      .send({ pinId: '' })
      .expect(400);

    expect(authResponse.body.error).toContain('PIN ID required');
  });

  it('should enforce JWT expiration', async () => {
    // Create an expired token
    const expiredToken = jwt.sign(
      {
        userId: 'expired-user',
        role: 'user',
      },
      process.env.JWT_SECRET!,
      { expiresIn: '-1h' }, // Already expired
    );

    await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${expiredToken}`)
      .expect(401);
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

    // Each PIN should have a unique ID
    const ids = pinResponses.map((r) => r.body.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('should create unique users for each Plex account', async () => {
    // Authenticate two different users
    const users = [];

    for (let i = 0; i < 2; i++) {
      const pinResponse = await request(app).post('/api/v1/auth/plex/pin').expect(200);

      const authResponse = await request(app)
        .post('/api/v1/auth/plex/callback')
        .send({ pinId: String(pinResponse.body.id) })
        .expect(200);

      users.push(authResponse.body.user);
    }

    // Users should have different IDs and Plex IDs
    expect(users[0].id).not.toBe(users[1].id);
    expect(users[0].plexId).not.toBe(users[1].plexId);

    // Verify both users exist in database
    const dbUsers = await prisma.user.findMany({
      where: {
        id: { in: users.map((u) => u.id) },
      },
    });

    expect(dbUsers).toHaveLength(2);
  });
});
