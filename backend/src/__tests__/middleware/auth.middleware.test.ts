import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { authMiddleware, requireRole } from '../../middleware/auth';
import {
  mockPrismaClient,
  mockRedisClient,
  createTestUser,
  createTestRequest,
  createTestResponse,
  createTestJWT,
} from '../setup';

vi.mock('../../config/database', () => ({
  prisma: mockPrismaClient,
}));

vi.mock('../../config/redis', () => ({
  redis: mockRedisClient,
}));

describe('Auth Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockRequest = createTestRequest();
    mockResponse = createTestResponse();
    mockNext = vi.fn();
  });

  describe('authMiddleware', () => {
    it('should authenticate valid JWT token from Authorization header', async () => {
      const testUser = createTestUser();
      const token = createTestJWT({ userId: testUser.id });

      mockRequest.headers = { authorization: `Bearer ${token}` };
      mockPrismaClient.user.findUnique.mockResolvedValueOnce(testUser);
      mockRedisClient.get.mockResolvedValueOnce(JSON.stringify({ userId: testUser.id }));

      const jwt = await import('jsonwebtoken');
      vi.mocked(jwt.verify).mockReturnValueOnce({ userId: testUser.id, role: 'user' });

      await authMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRequest.user).toEqual(testUser);
    });

    it('should authenticate valid JWT token from cookies', async () => {
      const testUser = createTestUser();
      const token = createTestJWT({ userId: testUser.id });

      mockRequest.cookies = { authToken: token };
      mockPrismaClient.user.findUnique.mockResolvedValueOnce(testUser);
      mockRedisClient.get.mockResolvedValueOnce(JSON.stringify({ userId: testUser.id }));

      const jwt = await import('jsonwebtoken');
      vi.mocked(jwt.verify).mockReturnValueOnce({ userId: testUser.id, role: 'user' });

      await authMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRequest.user).toEqual(testUser);
    });

    it('should reject request with no token', async () => {
      mockRequest.headers = {};
      mockRequest.cookies = {};

      await authMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining('token required'),
        }),
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject request with invalid token format', async () => {
      mockRequest.headers = { authorization: 'InvalidFormat' };

      await authMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining('Invalid token format'),
        }),
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject expired tokens', async () => {
      const expiredToken = 'expired-jwt-token';
      mockRequest.headers = { authorization: `Bearer ${expiredToken}` };

      const jwt = await import('jsonwebtoken');
      const expiredError = new Error('Token expired');
      (expiredError as any).name = 'TokenExpiredError';
      vi.mocked(jwt.verify).mockImplementationOnce(() => {
        throw expiredError;
      });

      await authMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining('Token expired'),
        }),
      );
    });

    it('should reject tokens with invalid signature', async () => {
      const invalidToken = 'invalid-jwt-token';
      mockRequest.headers = { authorization: `Bearer ${invalidToken}` };

      const jwt = await import('jsonwebtoken');
      const invalidError = new Error('Invalid signature');
      (invalidError as any).name = 'JsonWebTokenError';
      vi.mocked(jwt.verify).mockImplementationOnce(() => {
        throw invalidError;
      });

      await authMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining('Invalid token'),
        }),
      );
    });

    it('should reject tokens for non-existent users', async () => {
      const token = createTestJWT({ userId: 'non-existent-user' });
      mockRequest.headers = { authorization: `Bearer ${token}` };

      const jwt = await import('jsonwebtoken');
      vi.mocked(jwt.verify).mockReturnValueOnce({ userId: 'non-existent-user', role: 'user' });

      mockPrismaClient.user.findUnique.mockResolvedValueOnce(null);
      mockRedisClient.get.mockResolvedValueOnce(JSON.stringify({ userId: 'non-existent-user' }));

      await authMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining('User not found'),
        }),
      );
    });

    it('should reject tokens for suspended users', async () => {
      const suspendedUser = createTestUser({ status: 'suspended' });
      const token = createTestJWT({ userId: suspendedUser.id });

      mockRequest.headers = { authorization: `Bearer ${token}` };
      mockPrismaClient.user.findUnique.mockResolvedValueOnce(suspendedUser);
      mockRedisClient.get.mockResolvedValueOnce(JSON.stringify({ userId: suspendedUser.id }));

      const jwt = await import('jsonwebtoken');
      vi.mocked(jwt.verify).mockReturnValueOnce({ userId: suspendedUser.id, role: 'user' });

      await authMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining('Account suspended'),
        }),
      );
    });

    it('should reject tokens without valid session', async () => {
      const testUser = createTestUser();
      const token = createTestJWT({ userId: testUser.id });

      mockRequest.headers = { authorization: `Bearer ${token}` };
      mockRedisClient.get.mockResolvedValueOnce(null); // No session found

      const jwt = await import('jsonwebtoken');
      vi.mocked(jwt.verify).mockReturnValueOnce({ userId: testUser.id, role: 'user' });

      await authMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining('Session expired'),
        }),
      );
    });

    it('should handle database errors gracefully', async () => {
      const token = createTestJWT();
      mockRequest.headers = { authorization: `Bearer ${token}` };

      const jwt = await import('jsonwebtoken');
      vi.mocked(jwt.verify).mockReturnValueOnce({ userId: 'test-user', role: 'user' });

      mockRedisClient.get.mockResolvedValueOnce(JSON.stringify({ userId: 'test-user' }));
      mockPrismaClient.user.findUnique.mockRejectedValueOnce(new Error('Database error'));

      await authMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining('Authentication error'),
        }),
      );
    });
  });

  describe('requireRole middleware', () => {
    it('should allow access for users with required role', async () => {
      const adminUser = createTestUser({ role: 'admin' });
      mockRequest.user = adminUser;

      const adminMiddleware = requireRole('admin');
      await adminMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should allow access for users with higher role', async () => {
      const adminUser = createTestUser({ role: 'admin' });
      mockRequest.user = adminUser;

      const moderatorMiddleware = requireRole('moderator');
      await moderatorMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should deny access for users with insufficient role', async () => {
      const regularUser = createTestUser({ role: 'user' });
      mockRequest.user = regularUser;

      const adminMiddleware = requireRole('admin');
      await adminMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining('Insufficient permissions'),
        }),
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should deny access for unauthenticated requests', async () => {
      mockRequest.user = undefined;

      const adminMiddleware = requireRole('admin');
      await adminMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining('Authentication required'),
        }),
      );
    });

    it('should support multiple required roles', async () => {
      const moderatorUser = createTestUser({ role: 'moderator' });
      mockRequest.user = moderatorUser;

      const multiRoleMiddleware = requireRole(['admin', 'moderator']);
      await multiRoleMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should validate role hierarchy correctly', async () => {
      const roles = ['user', 'moderator', 'admin'];

      // Test each role against each requirement
      for (const userRole of roles) {
        for (const requiredRole of roles) {
          const testUser = createTestUser({ role: userRole });
          mockRequest.user = testUser;

          const roleMiddleware = requireRole(requiredRole);
          const shouldAllow = roles.indexOf(userRole) >= roles.indexOf(requiredRole);

          if (shouldAllow) {
            await roleMiddleware(mockRequest as Request, mockResponse as Response, mockNext);
            expect(mockNext).toHaveBeenCalled();
          } else {
            await roleMiddleware(mockRequest as Request, mockResponse as Response, mockNext);
            expect(mockResponse.status).toHaveBeenCalledWith(403);
          }

          // Reset mocks for next iteration
          vi.clearAllMocks();
          mockNext = vi.fn();
          mockResponse = createTestResponse();
        }
      }
    });
  });

  describe('optional auth middleware', () => {
    it('should attach user if token is provided and valid', async () => {
      const testUser = createTestUser();
      const token = createTestJWT({ userId: testUser.id });

      mockRequest.headers = { authorization: `Bearer ${token}` };
      mockPrismaClient.user.findUnique.mockResolvedValueOnce(testUser);
      mockRedisClient.get.mockResolvedValueOnce(JSON.stringify({ userId: testUser.id }));

      const jwt = await import('jsonwebtoken');
      vi.mocked(jwt.verify).mockReturnValueOnce({ userId: testUser.id, role: 'user' });

      // Simulate optional auth middleware
      const optionalAuthMiddleware = (req: Request, res: Response, next: NextFunction) => {
        // Try to authenticate but don't fail if no token
        if (!req.headers.authorization && !req.cookies?.authToken) {
          return next();
        }
        return authMiddleware(req, res, next);
      };

      await optionalAuthMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRequest.user).toEqual(testUser);
    });

    it('should continue without user if no token provided', async () => {
      mockRequest.headers = {};
      mockRequest.cookies = {};

      const optionalAuthMiddleware = (req: Request, res: Response, next: NextFunction) => {
        if (!req.headers.authorization && !req.cookies?.authToken) {
          return next();
        }
        return authMiddleware(req, res, next);
      };

      await optionalAuthMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRequest.user).toBeUndefined();
    });
  });

  describe('token blacklist integration', () => {
    it('should reject blacklisted tokens', async () => {
      const blacklistedToken = 'blacklisted-token';
      mockRequest.headers = { authorization: `Bearer ${blacklistedToken}` };

      // Mock token being in blacklist
      mockRedisClient.get
        .mockResolvedValueOnce('blacklisted') // Token in blacklist
        .mockResolvedValueOnce(null); // No session

      const jwt = await import('jsonwebtoken');
      vi.mocked(jwt.verify).mockReturnValueOnce({ userId: 'test-user', role: 'user' });

      await authMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining('Token revoked'),
        }),
      );
    });
  });
});
