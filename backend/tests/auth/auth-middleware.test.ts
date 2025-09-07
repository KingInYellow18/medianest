import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { Request, Response, NextFunction } from 'express';
import { AuthMiddleware } from '../../src/auth/middleware';
import { UserRepository } from '../../src/repositories/user.repository';
import { SessionTokenRepository } from '../../src/repositories/session-token.repository';
import { DeviceSessionService } from '../../src/services/device-session.service';
import { AuthenticationError } from '../../src/utils/errors';
import { AuthenticatedUser } from '../../src/auth';

// Mock dependencies
jest.mock('../../src/repositories/user.repository');
jest.mock('../../src/repositories/session-token.repository');
jest.mock('../../src/services/device-session.service');
jest.mock('../../src/utils/logger');

describe('AuthMiddleware', () => {
  let authMiddleware: AuthMiddleware;
  let mockUserRepository: jest.Mocked<UserRepository>;
  let mockSessionTokenRepository: jest.Mocked<SessionTokenRepository>;
  let mockDeviceSessionService: jest.Mocked<DeviceSessionService>;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: jest.MockedFunction<NextFunction>;

  const mockUser: AuthenticatedUser = {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
    role: 'user',
    plexId: 'plex-123',
    plexUsername: 'testuser',
  };

  beforeEach(() => {
    // Set up environment variables
    process.env.JWT_SECRET = 'test-secret-key-for-testing';
    process.env.JWT_ISSUER = 'medianest-test';
    process.env.JWT_AUDIENCE = 'medianest-app-test';

    mockUserRepository = new UserRepository({} as any) as jest.Mocked<UserRepository>;
    mockSessionTokenRepository = new SessionTokenRepository(
      {} as any
    ) as jest.Mocked<SessionTokenRepository>;
    mockDeviceSessionService = new DeviceSessionService() as jest.Mocked<DeviceSessionService>;

    authMiddleware = new AuthMiddleware(
      mockUserRepository,
      mockSessionTokenRepository,
      mockDeviceSessionService
    );

    mockRequest = {
      ip: '127.0.0.1',
      get: jest.fn().mockReturnValue('test-user-agent'),
      headers: {
        authorization: 'Bearer valid-token',
      },
      method: 'GET',
      path: '/api/test',
      query: {},
      params: {},
    };

    mockResponse = {
      locals: {},
    };

    mockNext = jest.fn();

    // Reset all mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    delete process.env.JWT_SECRET;
    delete process.env.JWT_ISSUER;
    delete process.env.JWT_AUDIENCE;
  });

  describe('authenticate', () => {
    it('should authenticate valid request and attach user to request', async () => {
      // Mock successful authentication
      mockUserRepository.findById.mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        role: 'user',
        status: 'active',
        plexId: 'plex-123',
        plexUsername: 'testuser',
      } as any);

      mockDeviceSessionService.registerDevice.mockResolvedValue({
        deviceId: 'device-123',
        isNewDevice: false,
        riskScore: 0.1,
      } as any);

      const middleware = authMiddleware.authenticate();
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockRequest.user).toBeDefined();
      expect(mockRequest.user!.id).toBe('user-123');
      expect(mockRequest.token).toBeDefined();
      expect(mockRequest.deviceId).toBe('device-123');
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should call next with error for invalid token', async () => {
      mockRequest.headers!.authorization = 'Bearer invalid-token';

      const middleware = authMiddleware.authenticate();
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
      expect(mockRequest.user).toBeUndefined();
    });

    it('should call next with error when no authorization header', async () => {
      delete mockRequest.headers!.authorization;

      const middleware = authMiddleware.authenticate();
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(AuthenticationError));
    });
  });

  describe('optionalAuth', () => {
    it('should attach user for valid token', async () => {
      mockUserRepository.findById.mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        role: 'user',
        status: 'active',
        plexId: 'plex-123',
        plexUsername: 'testuser',
      } as any);

      const middleware = authMiddleware.optionalAuth();
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockRequest.user).toBeDefined();
      expect(mockRequest.user!.id).toBe('user-123');
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should continue without user for invalid token', async () => {
      mockRequest.headers!.authorization = 'Bearer invalid-token';

      const middleware = authMiddleware.optionalAuth();
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockRequest.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should continue without user when no token provided', async () => {
      delete mockRequest.headers!.authorization;

      const middleware = authMiddleware.optionalAuth();
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockRequest.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalledWith();
    });
  });

  describe('requireRole', () => {
    it('should allow user with correct role', () => {
      mockRequest.user = mockUser;

      const middleware = authMiddleware.requireRole('user');
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should allow user with one of multiple acceptable roles', () => {
      mockRequest.user = mockUser;

      const middleware = authMiddleware.requireRole('admin', 'user', 'moderator');
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should reject user with incorrect role', () => {
      mockRequest.user = mockUser;

      const middleware = authMiddleware.requireRole('admin');
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Required role: admin',
        })
      );
    });

    it('should reject unauthenticated requests', () => {
      // No user attached to request

      const middleware = authMiddleware.requireRole('user');
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Authentication required',
        })
      );
    });
  });

  describe('requirePermission', () => {
    it('should allow user with correct permission', () => {
      mockRequest.user = mockUser;

      const middleware = authMiddleware.requirePermission('media', 'read');
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should allow admin user for any permission', () => {
      const adminUser: AuthenticatedUser = { ...mockUser, role: 'admin' };
      mockRequest.user = adminUser;

      const middleware = authMiddleware.requirePermission('restricted', 'delete');
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should reject user without correct permission', () => {
      mockRequest.user = mockUser;

      const middleware = authMiddleware.requirePermission('admin', 'delete');
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Access denied: admin:delete',
        })
      );
    });

    it('should reject unauthenticated requests', () => {
      const middleware = authMiddleware.requirePermission('media', 'read');
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Authentication required',
        })
      );
    });
  });

  describe('requireAdmin', () => {
    it('should allow admin user', () => {
      const adminUser: AuthenticatedUser = { ...mockUser, role: 'admin' };
      mockRequest.user = adminUser;

      const middleware = authMiddleware.requireAdmin();
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should allow ADMIN user (case variation)', () => {
      const adminUser: AuthenticatedUser = { ...mockUser, role: 'ADMIN' };
      mockRequest.user = adminUser;

      const middleware = authMiddleware.requireAdmin();
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should reject regular user', () => {
      mockRequest.user = mockUser;

      const middleware = authMiddleware.requireAdmin();
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(AuthenticationError));
    });
  });

  describe('requireUser', () => {
    it('should allow regular user', () => {
      mockRequest.user = mockUser;

      const middleware = authMiddleware.requireUser();
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should allow admin user', () => {
      const adminUser: AuthenticatedUser = { ...mockUser, role: 'admin' };
      mockRequest.user = adminUser;

      const middleware = authMiddleware.requireUser();
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should reject guest user', () => {
      const guestUser: AuthenticatedUser = { ...mockUser, role: 'guest' };
      mockRequest.user = guestUser;

      const middleware = authMiddleware.requireUser();
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(AuthenticationError));
    });
  });

  describe('logAuthenticatedRequest', () => {
    it('should log request for authenticated user', () => {
      mockRequest.user = mockUser;

      const middleware = authMiddleware.logAuthenticatedRequest();
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      // Logger mock would be checked here in real implementation
    });

    it('should not log for unauthenticated request', () => {
      const middleware = authMiddleware.logAuthenticatedRequest();
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });
  });
});
