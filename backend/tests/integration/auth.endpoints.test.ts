import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app';
import { server, rest } from '../msw/setup';
import { generateToken } from '@/utils/jwt.util';
import { redisClient } from '@/config/redis';
import prisma from '@/config/database';
import { encrypt } from '@/utils/encryption.util';

// Mock Redis and Prisma
vi.mock('@/config/redis', () => ({
  redisClient: {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    eval: vi.fn(),
  },
}));

vi.mock('@/config/database', () => ({
  default: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    userSession: {
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

describe('Authentication Endpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/v1/auth/plex/pin', () => {
    it('should successfully generate a Plex PIN', async () => {
      const response = await request(app).post('/api/v1/auth/plex/pin').expect(201);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          pinId: 123456,
          code: 'TEST-CODE',
          qrUrl: 'https://plex.tv/link/qr/TEST-CODE',
          expiresAt: expect.any(String),
        },
      });
    });

    it('should handle Plex API errors gracefully', async () => {
      // Override the handler to return an error
      server.use(
        rest.post('https://plex.tv/api/v2/pins', (req, res, ctx) => {
          return res(ctx.status(503), ctx.json({ error: 'Service unavailable' }));
        }),
      );

      const response = await request(app).post('/api/v1/auth/plex/pin').expect(503);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: 'Plex service is temporarily unavailable',
        },
      });
    });

    it('should handle network errors', async () => {
      // Override the handler to simulate network error
      server.use(
        rest.post('https://plex.tv/api/v2/pins', (req, res, ctx) => {
          return res.networkError('Failed to connect');
        }),
      );

      const response = await request(app).post('/api/v1/auth/plex/pin').expect(503);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: 'Plex service is temporarily unavailable',
        },
      });
    });
  });

  describe('GET /api/v1/auth/plex/pin/:pinId/check', () => {
    it('should return pending status for unauthorized PIN', async () => {
      const response = await request(app).get('/api/v1/auth/plex/pin/123456/check').expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          authorized: false,
          authToken: null,
        },
      });
    });

    it('should handle authorized PIN and create user session', async () => {
      // Mock database responses
      (prisma.user.findUnique as any).mockResolvedValue(null);
      (prisma.user.create as any).mockResolvedValue({
        id: 'user-1',
        plexId: '1234567',
        email: 'test@example.com',
        username: 'testuser',
        displayName: 'Test User',
        role: 'USER',
        isActive: true,
        lastLoginAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      (prisma.userSession.create as any).mockResolvedValue({
        id: 'session-1',
        userId: 'user-1',
        token: 'jwt-token',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        isActive: true,
        userAgent: 'test-agent',
        ipAddress: '::1',
        createdAt: new Date(),
      });

      const response = await request(app).get('/api/v1/auth/plex/pin/999999/check').expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          authorized: true,
          authToken: expect.any(String),
          user: {
            id: 'user-1',
            email: 'test@example.com',
            username: 'testuser',
            displayName: 'Test User',
            role: 'USER',
          },
        },
      });

      // Verify user creation was called with encrypted token
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          plexId: '1234567',
          email: 'test@example.com',
          username: 'testuser',
          plexToken: expect.stringContaining(':'), // Encrypted format
        }),
      });
    });

    it('should handle existing users', async () => {
      // Mock existing user
      (prisma.user.findUnique as any).mockResolvedValue({
        id: 'existing-user',
        plexId: '1234567',
        email: 'test@example.com',
        username: 'testuser',
        displayName: 'Test User',
        role: 'ADMIN',
        isActive: true,
        lastLoginAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      (prisma.user.update as any).mockResolvedValue({
        id: 'existing-user',
        plexId: '1234567',
        email: 'test@example.com',
        username: 'testuser',
        displayName: 'Test User',
        role: 'ADMIN',
        isActive: true,
        lastLoginAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      (prisma.userSession.create as any).mockResolvedValue({
        id: 'session-2',
        userId: 'existing-user',
        token: 'jwt-token',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        isActive: true,
        userAgent: 'test-agent',
        ipAddress: '::1',
        createdAt: new Date(),
      });

      const response = await request(app).get('/api/v1/auth/plex/pin/999999/check').expect(200);

      expect(response.body.data.user.role).toBe('ADMIN');
      expect(prisma.user.update).toHaveBeenCalled();
    });

    it('should handle invalid PIN ID', async () => {
      const response = await request(app).get('/api/v1/auth/plex/pin/invalid/check').expect(404);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'PIN not found or expired',
        },
      });
    });

    it('should handle Plex API errors', async () => {
      server.use(
        rest.get('https://plex.tv/api/v2/pins/:pinId', (req, res, ctx) => {
          return res(ctx.status(500), ctx.json({ error: 'Internal error' }));
        }),
      );

      const response = await request(app).get('/api/v1/auth/plex/pin/123456/check').expect(503);

      expect(response.body.error.code).toBe('SERVICE_UNAVAILABLE');
    });
  });

  describe('GET /api/v1/auth/me', () => {
    it('should return current user with valid token', async () => {
      const token = generateToken({ id: 'user-1', role: 'USER' });

      (prisma.userSession.findFirst as any).mockResolvedValue({
        id: 'session-1',
        userId: 'user-1',
        token,
        expiresAt: new Date(Date.now() + 3600000),
        isActive: true,
        user: {
          id: 'user-1',
          email: 'test@example.com',
          username: 'testuser',
          displayName: 'Test User',
          role: 'USER',
          isActive: true,
        },
      });

      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          id: 'user-1',
          email: 'test@example.com',
          username: 'testuser',
          displayName: 'Test User',
          role: 'USER',
        },
      });
    });

    it('should return 401 without token', async () => {
      const response = await request(app).get('/api/v1/auth/me').expect(401);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      });
    });

    it('should return 401 with invalid token', async () => {
      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should return 401 with expired session', async () => {
      const token = generateToken({ id: 'user-1', role: 'USER' });

      (prisma.userSession.findFirst as any).mockResolvedValue({
        id: 'session-1',
        userId: 'user-1',
        token,
        expiresAt: new Date(Date.now() - 3600000), // Expired
        isActive: true,
      });

      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(401);

      expect(response.body.error.message).toContain('expired');
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    it('should successfully logout user', async () => {
      const token = generateToken({ id: 'user-1', role: 'USER' });

      (prisma.userSession.findFirst as any).mockResolvedValue({
        id: 'session-1',
        userId: 'user-1',
        token,
        expiresAt: new Date(Date.now() + 3600000),
        isActive: true,
        user: {
          id: 'user-1',
          email: 'test@example.com',
          username: 'testuser',
          displayName: 'Test User',
          role: 'USER',
          isActive: true,
        },
      });
      (prisma.userSession.update as any).mockResolvedValue({});

      const response = await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          message: 'Logged out successfully',
        },
      });

      expect(prisma.userSession.update).toHaveBeenCalledWith({
        where: { id: 'session-1' },
        data: { isActive: false },
      });
    });

    it('should require authentication', async () => {
      const response = await request(app).post('/api/v1/auth/logout').expect(401);

      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('POST /api/v1/auth/logout-all', () => {
    it('should logout all user sessions', async () => {
      const token = generateToken({ id: 'user-1', role: 'USER' });

      (prisma.userSession.findFirst as any).mockResolvedValue({
        id: 'session-1',
        userId: 'user-1',
        token,
        expiresAt: new Date(Date.now() + 3600000),
        isActive: true,
        user: {
          id: 'user-1',
          email: 'test@example.com',
          username: 'testuser',
          displayName: 'Test User',
          role: 'USER',
          isActive: true,
        },
      });
      (prisma.userSession.deleteMany as any).mockResolvedValue({ count: 3 });

      const response = await request(app)
        .post('/api/v1/auth/logout-all')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          message: 'All sessions logged out successfully',
          sessionsRevoked: 3,
        },
      });

      expect(prisma.userSession.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
      });
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits on PIN generation', async () => {
      // Mock rate limiter to return limit exceeded
      (redisClient.eval as any).mockResolvedValue([0, 100, 100, 59]);

      const response = await request(app).post('/api/v1/auth/plex/pin').expect(429);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests',
        },
      });
      expect(response.headers['x-ratelimit-limit']).toBe('100');
      expect(response.headers['x-ratelimit-remaining']).toBe('0');
    });

    it('should allow requests within rate limit', async () => {
      // Mock rate limiter to allow request
      (redisClient.eval as any).mockResolvedValue([1, 100, 99, 60]);

      const response = await request(app).post('/api/v1/auth/plex/pin').expect(201);

      expect(response.headers['x-ratelimit-limit']).toBe('100');
      expect(response.headers['x-ratelimit-remaining']).toBe('99');
    });
  });
});
