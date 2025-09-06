import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';
import { AuthController } from '../../controllers/auth.controller';
import {
  mockPrismaClient,
  mockRedisClient,
  createTestUser,
  createTestRequest,
  createTestResponse,
  createTestJWT,
} from '../setup';

// Import the actual controller - we'll need to mock its dependencies
vi.mock('../../config/database', () => ({
  prisma: mockPrismaClient,
}));

vi.mock('../../config/redis', () => ({
  redis: mockRedisClient,
}));

describe('AuthController', () => {
  let authController: AuthController;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    authController = new AuthController();
    mockRequest = createTestRequest();
    mockResponse = createTestResponse();
  });

  describe('login', () => {
    it('should login successfully with valid credentials', async () => {
      const testUser = createTestUser({
        email: 'test@example.com',
        password: 'hashed-password',
      });

      mockRequest.body = {
        email: 'test@example.com',
        password: 'password123',
      };

      mockPrismaClient.user.findUnique.mockResolvedValueOnce(testUser);

      // Mock bcrypt compare
      const bcrypt = await import('bcrypt');
      vi.mocked(bcrypt.compare).mockResolvedValueOnce(true);

      await authController.login(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          user: expect.objectContaining({
            id: testUser.id,
            email: testUser.email,
          }),
          token: expect.any(String),
        }),
      );
    });

    it('should return 401 for invalid credentials', async () => {
      mockRequest.body = {
        email: 'test@example.com',
        password: 'wrongpassword',
      };

      mockPrismaClient.user.findUnique.mockResolvedValueOnce(null);

      await authController.login(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining('Invalid'),
        }),
      );
    });

    it('should return 401 for wrong password', async () => {
      const testUser = createTestUser({
        email: 'test@example.com',
        password: 'hashed-password',
      });

      mockRequest.body = {
        email: 'test@example.com',
        password: 'wrongpassword',
      };

      mockPrismaClient.user.findUnique.mockResolvedValueOnce(testUser);

      // Mock bcrypt compare to return false
      const bcrypt = await import('bcrypt');
      vi.mocked(bcrypt.compare).mockResolvedValueOnce(false);

      await authController.login(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining('Invalid'),
        }),
      );
    });

    it('should handle database errors gracefully', async () => {
      mockRequest.body = {
        email: 'test@example.com',
        password: 'password123',
      };

      mockPrismaClient.user.findUnique.mockRejectedValueOnce(new Error('Database error'));

      await authController.login(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining('Internal server error'),
        }),
      );
    });

    it('should validate required fields', async () => {
      mockRequest.body = {
        email: 'test@example.com',
        // missing password
      };

      await authController.login(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining('required'),
        }),
      );
    });
  });

  describe('register', () => {
    it('should register a new user successfully', async () => {
      const userData = {
        username: 'newuser',
        email: 'new@example.com',
        password: 'password123',
      };

      mockRequest.body = userData;
      mockPrismaClient.user.findUnique.mockResolvedValueOnce(null); // Email not exists
      mockPrismaClient.user.create.mockResolvedValueOnce(
        createTestUser({
          username: userData.username,
          email: userData.email,
        }),
      );

      await authController.register(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          user: expect.objectContaining({
            username: userData.username,
            email: userData.email,
          }),
        }),
      );
    });

    it('should return 409 for existing email', async () => {
      const userData = {
        username: 'newuser',
        email: 'existing@example.com',
        password: 'password123',
      };

      mockRequest.body = userData;
      mockPrismaClient.user.findUnique.mockResolvedValueOnce(
        createTestUser({
          email: userData.email,
        }),
      );

      await authController.register(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(409);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining('already exists'),
        }),
      );
    });

    it('should validate email format', async () => {
      mockRequest.body = {
        username: 'newuser',
        email: 'invalid-email',
        password: 'password123',
      };

      await authController.register(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining('email'),
        }),
      );
    });

    it('should validate password strength', async () => {
      mockRequest.body = {
        username: 'newuser',
        email: 'new@example.com',
        password: '123', // too weak
      };

      await authController.register(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining('password'),
        }),
      );
    });
  });

  describe('logout', () => {
    it('should logout successfully', async () => {
      const token = createTestJWT();
      mockRequest.headers = { authorization: `Bearer ${token}` };
      mockRedisClient.del.mockResolvedValueOnce(1);

      await authController.logout(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: expect.stringContaining('Logged out'),
        }),
      );
      expect(mockRedisClient.del).toHaveBeenCalledWith(expect.stringContaining(token));
    });

    it('should handle missing token', async () => {
      mockRequest.headers = {};

      await authController.logout(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining('token'),
        }),
      );
    });
  });

  describe('refresh', () => {
    it('should refresh token successfully', async () => {
      const token = createTestJWT();
      const testUser = createTestUser();

      mockRequest.headers = { authorization: `Bearer ${token}` };
      mockRequest.user = testUser;
      mockPrismaClient.user.findUnique.mockResolvedValueOnce(testUser);

      await authController.refresh(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          token: expect.any(String),
          user: expect.objectContaining({
            id: testUser.id,
          }),
        }),
      );
    });

    it('should return 401 for invalid user', async () => {
      const token = createTestJWT();

      mockRequest.headers = { authorization: `Bearer ${token}` };
      mockRequest.user = { id: 'invalid-user-id' };
      mockPrismaClient.user.findUnique.mockResolvedValueOnce(null);

      await authController.refresh(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining('Invalid'),
        }),
      );
    });
  });

  describe('me', () => {
    it('should return current user info', async () => {
      const testUser = createTestUser();
      mockRequest.user = testUser;
      mockPrismaClient.user.findUnique.mockResolvedValueOnce(testUser);

      await authController.me(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          user: expect.objectContaining({
            id: testUser.id,
            email: testUser.email,
          }),
        }),
      );
    });

    it('should handle missing user', async () => {
      mockRequest.user = undefined;

      await authController.me(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining('authenticated'),
        }),
      );
    });
  });
});
