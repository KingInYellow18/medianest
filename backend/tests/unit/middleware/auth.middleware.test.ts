import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { authenticate, requireRole, requireAdmin, requireUser, optionalAuth } from '../../../dist/middleware/auth';
import { createMockRequest, createMockResponse, createMockNext } from '../../setup';

// Mock dependencies
const mockJWTService = {
  verifyToken: vi.fn(),
  extractTokenFromHeader: vi.fn()
};

const mockUserRepository = {
  findById: vi.fn()
};

vi.mock('@/services/jwt.service', () => ({
  jwtService: mockJWTService
}));

vi.mock('@/repositories/instances', () => ({
  userRepository: mockUserRepository
}));

vi.mock('@/middleware/error', () => ({
  AppError: class AppError extends Error {
    constructor(message: string, statusCode: number, code?: string) {
      super(message);
      this.name = 'AppError';
      (this as any).statusCode = statusCode;
      (this as any).code = code;
    }
  }
}));

describe('Auth Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = createMockRequest();
    mockRes = createMockResponse();
    mockNext = createMockNext();
    
    vi.clearAllMocks();
  });

  describe('authenticate', () => {
    it('should authenticate valid token successfully', async () => {
      // Arrange
      const mockUser = {
        id: 'test-user-id',
        email: 'test@example.com',
        role: 'user',
        status: 'active',
        plexId: 'test-plex-id'
      };

      mockReq.headers = {
        authorization: 'Bearer valid-jwt-token'
      };

      mockJWTService.verifyToken.mockResolvedValue({ userId: 'test-user-id' });
      mockUserRepository.findById.mockResolvedValue(mockUser);

      // Act
      await authenticate(mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect(mockJWTService.verifyToken).toHaveBeenCalledWith('valid-jwt-token');
      expect(mockUserRepository.findById).toHaveBeenCalledWith('test-user-id');
      expect(mockReq.user).toEqual({
        id: 'test-user-id',
        email: 'test@example.com',
        role: 'user',
        plexId: 'test-plex-id'
      });
      expect(mockReq.token).toBe('valid-jwt-token');
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should reject request without authorization header', async () => {
      // Arrange
      mockReq.headers = {};

      // Act
      await authenticate(mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'No token provided',
          statusCode: 401,
          code: 'NO_TOKEN'
        })
      );
    });

    it('should reject request with malformed authorization header', async () => {
      // Arrange
      mockReq.headers = {
        authorization: 'InvalidFormat token'
      };

      // Act
      await authenticate(mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'No token provided',
          statusCode: 401
        })
      );
    });

    it('should reject invalid JWT token', async () => {
      // Arrange
      mockReq.headers = {
        authorization: 'Bearer invalid-token'
      };

      mockJWTService.verifyToken.mockRejectedValue(new Error('Invalid token'));

      // Act
      await authenticate(mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Invalid token')
        })
      );
    });

    it('should reject when user not found', async () => {
      // Arrange
      mockReq.headers = {
        authorization: 'Bearer valid-token'
      };

      mockJWTService.verifyToken.mockResolvedValue({ userId: 'nonexistent-user' });
      mockUserRepository.findById.mockResolvedValue(null);

      // Act
      await authenticate(mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'User not found or inactive',
          statusCode: 401,
          code: 'USER_NOT_FOUND'
        })
      );
    });

    it('should reject inactive user', async () => {
      // Arrange
      const inactiveUser = {
        id: 'test-user-id',
        email: 'test@example.com',
        role: 'user',
        status: 'inactive',
        plexId: 'test-plex-id'
      };

      mockReq.headers = {
        authorization: 'Bearer valid-token'
      };

      mockJWTService.verifyToken.mockResolvedValue({ userId: 'test-user-id' });
      mockUserRepository.findById.mockResolvedValue(inactiveUser);

      // Act
      await authenticate(mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'User not found or inactive',
          statusCode: 401
        })
      );
    });

    it('should handle user with empty email gracefully', async () => {
      // Arrange
      const userWithoutEmail = {
        id: 'test-user-id',
        email: null,
        role: 'user',
        status: 'active',
        plexId: 'test-plex-id'
      };

      mockReq.headers = {
        authorization: 'Bearer valid-token'
      };

      mockJWTService.verifyToken.mockResolvedValue({ userId: 'test-user-id' });
      mockUserRepository.findById.mockResolvedValue(userWithoutEmail);

      // Act
      await authenticate(mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect(mockReq.user?.email).toBe('');
      expect(mockNext).toHaveBeenCalledWith();
    });
  });

  describe('requireRole', () => {
    beforeEach(() => {
      mockReq.user = {
        id: 'test-user-id',
        email: 'test@example.com',
        role: 'user',
        plexId: 'test-plex-id'
      };
    });

    it('should allow access for user with correct role', () => {
      // Arrange
      const middleware = requireRole('user', 'admin');

      // Act
      middleware(mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should deny access for user with incorrect role', () => {
      // Arrange
      const middleware = requireRole('admin');

      // Act
      middleware(mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Required role: admin',
          statusCode: 403,
          code: 'FORBIDDEN'
        })
      );
    });

    it('should deny access when user is not authenticated', () => {
      // Arrange
      mockReq.user = undefined;
      const middleware = requireRole('user');

      // Act
      middleware(mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Authentication required',
          statusCode: 401,
          code: 'AUTH_REQUIRED'
        })
      );
    });

    it('should allow access for multiple valid roles', () => {
      // Arrange
      mockReq.user!.role = 'admin';
      const middleware = requireRole('user', 'admin', 'moderator');

      // Act
      middleware(mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith();
    });
  });

  describe('requireAdmin', () => {
    it('should allow access for admin user', () => {
      // Arrange
      mockReq.user = {
        id: 'admin-user-id',
        email: 'admin@example.com',
        role: 'admin',
        plexId: 'admin-plex-id'
      };

      const middleware = requireAdmin();

      // Act
      middleware(mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should deny access for non-admin user', () => {
      // Arrange
      mockReq.user = {
        id: 'user-id',
        email: 'user@example.com',
        role: 'user',
        plexId: 'user-plex-id'
      };

      const middleware = requireAdmin();

      // Act
      middleware(mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Required role: admin',
          statusCode: 403
        })
      );
    });
  });

  describe('requireUser', () => {
    it('should allow access for regular user', () => {
      // Arrange
      mockReq.user = {
        id: 'user-id',
        email: 'user@example.com',
        role: 'user',
        plexId: 'user-plex-id'
      };

      const middleware = requireUser();

      // Act
      middleware(mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should allow access for admin user (admin has user privileges)', () => {
      // Arrange
      mockReq.user = {
        id: 'admin-user-id',
        email: 'admin@example.com',
        role: 'admin',
        plexId: 'admin-plex-id'
      };

      const middleware = requireUser();

      // Act
      middleware(mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should deny access for guest user', () => {
      // Arrange
      mockReq.user = {
        id: 'guest-id',
        email: 'guest@example.com',
        role: 'guest',
        plexId: 'guest-plex-id'
      };

      const middleware = requireUser();

      // Act
      middleware(mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Required role: user or admin',
          statusCode: 403
        })
      );
    });
  });

  describe('optionalAuth', () => {
    it('should proceed without error when valid token is provided', async () => {
      // Arrange
      const mockUser = {
        id: 'test-user-id',
        email: 'test@example.com',
        role: 'user',
        status: 'active'
      };

      mockReq.headers = {
        authorization: 'Bearer valid-token'
      };

      mockJWTService.verifyToken.mockResolvedValue({ userId: 'test-user-id' });
      mockUserRepository.findById.mockResolvedValue(mockUser);

      // Act
      await optionalAuth(mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect(mockReq.user).toBeDefined();
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should proceed without error when no token is provided', async () => {
      // Arrange
      mockReq.headers = {};

      // Act
      await optionalAuth(mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect(mockReq.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should proceed without error when invalid token is provided', async () => {
      // Arrange
      mockReq.headers = {
        authorization: 'Bearer invalid-token'
      };

      mockJWTService.verifyToken.mockRejectedValue(new Error('Invalid token'));

      // Act
      await optionalAuth(mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect(mockReq.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should proceed without error when user is not found', async () => {
      // Arrange
      mockReq.headers = {
        authorization: 'Bearer valid-token'
      };

      mockJWTService.verifyToken.mockResolvedValue({ userId: 'nonexistent-user' });
      mockUserRepository.findById.mockResolvedValue(null);

      // Act
      await optionalAuth(mockReq as Request, mockRes as Response, mockNext);

      // Assert
      expect(mockReq.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalledWith();
    });
  });
});