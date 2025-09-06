import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app';
import { mockPrismaClient, mockRedisClient, createTestUser, createTestJWT } from '../setup';

// Mock dependencies
vi.mock('../../config/database', () => ({
  prisma: mockPrismaClient,
}));

vi.mock('../../config/redis', () => ({
  redis: mockRedisClient,
}));

describe('Authentication Flow Integration Tests', () => {
  let app: any;

  beforeEach(() => {
    app = createApp();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/auth/login', () => {
    it('should complete successful login flow', async () => {
      const testUser = createTestUser({
        email: 'test@example.com',
        password: '$2b$10$hashedPassword',
      });

      const loginData = {
        email: 'test@example.com',
        password: 'password123',
      };

      // Mock database calls
      mockPrismaClient.user.findUnique.mockResolvedValueOnce(testUser);
      mockPrismaClient.user.update.mockResolvedValueOnce({
        ...testUser,
        lastLoginAt: new Date(),
      });

      // Mock bcrypt
      const bcrypt = await import('bcrypt');
      vi.mocked(bcrypt.compare).mockResolvedValueOnce(true);

      // Mock JWT
      const jwt = await import('jsonwebtoken');
      vi.mocked(jwt.sign).mockReturnValueOnce('generated-jwt-token');

      // Mock Redis for session storage
      mockRedisClient.setex.mockResolvedValueOnce('OK');

      const response = await request(app).post('/api/auth/login').send(loginData).expect(200);

      expect(response.body).toMatchObject({
        success: true,
        user: {
          id: testUser.id,
          email: testUser.email,
          username: testUser.username,
        },
        token: 'generated-jwt-token',
      });

      // Verify database calls
      expect(mockPrismaClient.user.findUnique).toHaveBeenCalledWith({
        where: { email: loginData.email },
      });

      expect(mockPrismaClient.user.update).toHaveBeenCalledWith({
        where: { id: testUser.id },
        data: { lastLoginAt: expect.any(Date) },
      });

      // Verify session storage
      expect(mockRedisClient.setex).toHaveBeenCalledWith(
        expect.stringContaining('session:'),
        3600,
        expect.any(String),
      );
    });

    it('should handle invalid credentials', async () => {
      const loginData = {
        email: 'nonexistent@example.com',
        password: 'wrongpassword',
      };

      mockPrismaClient.user.findUnique.mockResolvedValueOnce(null);

      const response = await request(app).post('/api/auth/login').send(loginData).expect(401);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining('Invalid credentials'),
      });
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com' }) // missing password
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining('required'),
      });
    });

    it('should rate limit login attempts', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'wrongpassword',
      };

      mockPrismaClient.user.findUnique.mockResolvedValue(null);

      // Simulate multiple failed attempts
      for (let i = 0; i < 6; i++) {
        await request(app).post('/api/auth/login').send(loginData);
      }

      const response = await request(app).post('/api/auth/login').send(loginData).expect(429);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining('Too many attempts'),
      });
    });
  });

  describe('POST /api/auth/register', () => {
    it('should complete successful registration flow', async () => {
      const registrationData = {
        username: 'newuser',
        email: 'new@example.com',
        password: 'password123',
      };

      const createdUser = createTestUser({
        username: registrationData.username,
        email: registrationData.email,
      });

      // Mock database calls
      mockPrismaClient.user.findUnique.mockResolvedValueOnce(null); // Email doesn't exist
      mockPrismaClient.user.create.mockResolvedValueOnce(createdUser);

      // Mock bcrypt
      const bcrypt = await import('bcrypt');
      vi.mocked(bcrypt.hash).mockResolvedValueOnce('hashed-password');

      const response = await request(app)
        .post('/api/auth/register')
        .send(registrationData)
        .expect(201);

      expect(response.body).toMatchObject({
        success: true,
        user: {
          id: createdUser.id,
          email: createdUser.email,
          username: createdUser.username,
        },
      });

      // Verify database calls
      expect(mockPrismaClient.user.findUnique).toHaveBeenCalledWith({
        where: { email: registrationData.email },
      });

      expect(mockPrismaClient.user.create).toHaveBeenCalledWith({
        data: {
          username: registrationData.username,
          email: registrationData.email,
          password: 'hashed-password',
          role: 'user',
          status: 'active',
        },
      });
    });

    it('should prevent duplicate email registration', async () => {
      const registrationData = {
        username: 'newuser',
        email: 'existing@example.com',
        password: 'password123',
      };

      const existingUser = createTestUser({ email: registrationData.email });
      mockPrismaClient.user.findUnique.mockResolvedValueOnce(existingUser);

      const response = await request(app)
        .post('/api/auth/register')
        .send(registrationData)
        .expect(409);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining('already exists'),
      });
    });

    it('should validate email format', async () => {
      const invalidRegistrationData = {
        username: 'newuser',
        email: 'invalid-email',
        password: 'password123',
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(invalidRegistrationData)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining('Invalid email'),
      });
    });

    it('should enforce password requirements', async () => {
      const weakPasswordData = {
        username: 'newuser',
        email: 'new@example.com',
        password: '123', // too weak
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(weakPasswordData)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining('Password must be'),
      });
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should logout successfully with valid token', async () => {
      const token = createTestJWT();
      const testUser = createTestUser();

      mockRedisClient.del.mockResolvedValueOnce(1);
      mockPrismaClient.user.findUnique.mockResolvedValueOnce(testUser);

      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: expect.stringContaining('Logged out'),
      });

      // Verify session deletion
      expect(mockRedisClient.del).toHaveBeenCalledWith(expect.stringContaining('session:'));
    });

    it('should handle missing token', async () => {
      const response = await request(app).post('/api/auth/logout').expect(401);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining('token required'),
      });
    });

    it('should handle invalid token', async () => {
      const jwt = await import('jsonwebtoken');
      vi.mocked(jwt.verify).mockImplementationOnce(() => {
        throw new Error('Invalid token');
      });

      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining('Invalid token'),
      });
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return current user info with valid token', async () => {
      const token = createTestJWT();
      const testUser = createTestUser();

      mockPrismaClient.user.findUnique.mockResolvedValueOnce(testUser);
      mockRedisClient.get.mockResolvedValueOnce(JSON.stringify({ userId: testUser.id }));

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        user: {
          id: testUser.id,
          email: testUser.email,
          username: testUser.username,
          role: testUser.role,
        },
      });
    });

    it('should handle expired sessions', async () => {
      const token = createTestJWT();

      mockRedisClient.get.mockResolvedValueOnce(null); // No session found

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining('Session expired'),
      });
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('should refresh token successfully', async () => {
      const oldToken = createTestJWT();
      const testUser = createTestUser();

      mockPrismaClient.user.findUnique.mockResolvedValueOnce(testUser);
      mockRedisClient.get.mockResolvedValueOnce(JSON.stringify({ userId: testUser.id }));
      mockRedisClient.setex.mockResolvedValueOnce('OK');
      mockRedisClient.del.mockResolvedValueOnce(1);

      const jwt = await import('jsonwebtoken');
      vi.mocked(jwt.sign).mockReturnValueOnce('new-jwt-token');

      const response = await request(app)
        .post('/api/auth/refresh')
        .set('Authorization', `Bearer ${oldToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        token: 'new-jwt-token',
        user: {
          id: testUser.id,
        },
      });

      // Verify old session deleted and new session created
      expect(mockRedisClient.del).toHaveBeenCalled();
      expect(mockRedisClient.setex).toHaveBeenCalledWith(
        expect.stringContaining('session:'),
        3600,
        expect.any(String),
      );
    });

    it('should handle refresh with deleted user', async () => {
      const token = createTestJWT();

      mockRedisClient.get.mockResolvedValueOnce(JSON.stringify({ userId: 'deleted-user' }));
      mockPrismaClient.user.findUnique.mockResolvedValueOnce(null);

      const response = await request(app)
        .post('/api/auth/refresh')
        .set('Authorization', `Bearer ${token}`)
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining('User not found'),
      });
    });
  });

  describe('Authentication middleware integration', () => {
    it('should protect authenticated routes', async () => {
      const response = await request(app).get('/api/media/requests').expect(401);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining('token required'),
      });
    });

    it('should allow access with valid token', async () => {
      const token = createTestJWT();
      const testUser = createTestUser();

      mockPrismaClient.user.findUnique.mockResolvedValueOnce(testUser);
      mockRedisClient.get.mockResolvedValueOnce(JSON.stringify({ userId: testUser.id }));
      mockPrismaClient.mediaRequest.findMany.mockResolvedValueOnce([]);

      const response = await request(app)
        .get('/api/media/requests')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: [],
      });
    });

    it('should handle token in cookies', async () => {
      const token = createTestJWT();
      const testUser = createTestUser();

      mockPrismaClient.user.findUnique.mockResolvedValueOnce(testUser);
      mockRedisClient.get.mockResolvedValueOnce(JSON.stringify({ userId: testUser.id }));
      mockPrismaClient.mediaRequest.findMany.mockResolvedValueOnce([]);

      const response = await request(app)
        .get('/api/media/requests')
        .set('Cookie', `authToken=${token}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
      });
    });

    it('should enforce role-based access control', async () => {
      const token = createTestJWT({ role: 'user' });
      const testUser = createTestUser({ role: 'user' });

      mockPrismaClient.user.findUnique.mockResolvedValueOnce(testUser);
      mockRedisClient.get.mockResolvedValueOnce(JSON.stringify({ userId: testUser.id }));

      const response = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining('Insufficient permissions'),
      });
    });
  });

  describe('Session management', () => {
    it('should handle concurrent sessions for same user', async () => {
      const testUser = createTestUser();
      const token1 = createTestJWT({ sessionId: 'session-1' });
      const token2 = createTestJWT({ sessionId: 'session-2' });

      mockPrismaClient.user.findUnique.mockResolvedValue(testUser);
      mockRedisClient.get
        .mockResolvedValueOnce(JSON.stringify({ userId: testUser.id, sessionId: 'session-1' }))
        .mockResolvedValueOnce(JSON.stringify({ userId: testUser.id, sessionId: 'session-2' }));
      mockPrismaClient.mediaRequest.findMany.mockResolvedValue([]);

      // Both sessions should work
      const response1 = await request(app)
        .get('/api/media/requests')
        .set('Authorization', `Bearer ${token1}`)
        .expect(200);

      const response2 = await request(app)
        .get('/api/media/requests')
        .set('Authorization', `Bearer ${token2}`)
        .expect(200);

      expect(response1.body.success).toBe(true);
      expect(response2.body.success).toBe(true);
    });

    it('should cleanup expired sessions', async () => {
      const expiredToken = createTestJWT({ exp: Math.floor(Date.now() / 1000) - 3600 });

      const jwt = await import('jsonwebtoken');
      vi.mocked(jwt.verify).mockImplementationOnce(() => {
        const error = new Error('Token expired');
        (error as any).name = 'TokenExpiredError';
        throw error;
      });

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining('Token expired'),
      });
    });
  });
});
