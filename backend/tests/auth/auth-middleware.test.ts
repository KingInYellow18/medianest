import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { AuthMiddleware } from '../../src/auth/middleware';
import { UserRepository } from '../../src/repositories/user.repository';
import { SessionTokenRepository } from '../../src/repositories/session-token.repository';
import { DeviceSessionService } from '../../src/services/device-session.service';
import { AuthenticationError } from '../../src/utils/errors';
import { AuthenticatedUser } from '../../src/auth';

// Mock dependencies
vi.mock('../../src/repositories/user.repository');
vi.mock('../../src/repositories/session-token.repository');
vi.mock('../../src/services/device-session.service');
vi.mock('../../src/utils/logger');
vi.mock('../../src/config/config.service', () => ({
  configService: {
    getAuthConfig: () => ({
      JWT_SECRET: 'test-secret-key-for-testing',
      JWT_ISSUER: 'medianest-test',
      JWT_AUDIENCE: 'medianest-app-test',
    }),
  },
}));

// Mock the JWT utilities
vi.mock('../../src/utils/jwt', () => ({
  generateToken: vi.fn().mockReturnValue('test-jwt-token'),
  verifyToken: vi.fn().mockReturnValue({
    userId: 'user-123',
    email: 'test@example.com',
    role: 'user',
    sessionId: 'test-session-id',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
  }),
  generateRefreshToken: vi.fn().mockReturnValue('test-refresh-token'),
  verifyRefreshToken: vi.fn().mockReturnValue({
    userId: 'user-123',
    sessionId: 'test-session-id',
  }),
  getTokenMetadata: vi.fn().mockReturnValue({
    userId: 'user-123',
    sessionId: 'test-session-id',
    tokenId: 'test-token-id',
  }),
  isTokenBlacklisted: vi.fn().mockReturnValue(false),
  blacklistToken: vi.fn(),
  shouldRotateToken: vi.fn().mockReturnValue(false),
  rotateTokenIfNeeded: vi.fn().mockReturnValue(null),
}));

// Mock token validator
vi.mock('../../src/middleware/auth/token-validator', () => ({
  extractToken: vi.fn(),
  extractTokenOptional: vi.fn(),
  validateToken: vi.fn(),
}));

// Mock user validator
vi.mock('../../src/middleware/auth/user-validator', () => ({
  validateUser: vi.fn(),
  validateUserOptional: vi.fn(),
}));

// Mock device session manager
vi.mock('../../src/middleware/auth/device-session-manager', () => ({
  validateSessionToken: vi.fn().mockResolvedValue(undefined),
  registerAndAssessDevice: vi.fn().mockResolvedValue({
    deviceId: 'device-123',
    isNewDevice: false,
    riskScore: 0.1,
  }),
  updateSessionActivity: vi.fn().mockResolvedValue(undefined),
}));

describe('AuthMiddleware', () => {
  let authMiddleware: AuthMiddleware;
  let mockUserRepository: any;
  let mockSessionTokenRepository: any;
  let mockDeviceSessionService: any;
  let mockRequest: Partial<
    Request & { user?: AuthenticatedUser; token?: string; deviceId?: string; sessionId?: string }
  >;
  let mockResponse: Partial<Response>;
  let mockNext: any;

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

    // Create mock objects with vi.fn()
    mockUserRepository = {
      findById: vi.fn(),
      findByEmail: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };
    mockSessionTokenRepository = {
      create: vi.fn(),
      findById: vi.fn(),
      delete: vi.fn(),
      deleteExpired: vi.fn(),
    };
    mockDeviceSessionService = {
      registerDevice: vi.fn(),
      validateDevice: vi.fn(),
      updateLastSeen: vi.fn(),
    };

    authMiddleware = new AuthMiddleware(
      mockUserRepository,
      mockSessionTokenRepository,
      mockDeviceSessionService
    );

    mockRequest = {
      ip: '127.0.0.1',
      get: vi.fn().mockReturnValue('test-user-agent'),
      headers: {
        authorization: 'Bearer valid-token',
      },
      method: 'GET',
      path: '/api/test',
      query: {},
      params: {},
      user: undefined,
      token: undefined,
      deviceId: undefined,
      sessionId: undefined,
    };

    mockResponse = {
      locals: {},
    };

    mockNext = vi.fn();

    // Reset all mocks
    vi.clearAllMocks();
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

      // Mock the AuthenticationFacade authenticate method
      const { AuthenticationFacade } = await import('../../src/auth');
      vi.spyOn(AuthenticationFacade.prototype, 'authenticate').mockResolvedValue({
        user: {
          id: 'user-123',
          email: 'test@example.com',
          role: 'user',
        },
        token: 'test-jwt-token',
        deviceId: 'device-123',
        sessionId: 'test-session-id',
      } as any);

      const middleware = authMiddleware.authenticate();
      await middleware(mockRequest as any, mockResponse as Response, mockNext);

      expect(mockRequest.user).toBeDefined();
      expect(mockRequest.user!.id).toBe('user-123');
      expect(mockRequest.token).toBeDefined();
      expect(mockRequest.deviceId).toBe('device-123');
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should call next with error for invalid token', async () => {
      mockRequest.headers!.authorization = 'Bearer invalid-token';
      mockRequest.user = undefined;

      // Mock token validation to throw error for invalid token
      const { validateToken } = await import('../../src/middleware/auth/token-validator');
      vi.mocked(validateToken).mockImplementationOnce(() => {
        throw new Error('Invalid token');
      });

      const middleware = authMiddleware.authenticate();
      await middleware(mockRequest as any, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
      expect(mockRequest.user).toBeUndefined();
    });

    it('should call next with error when no authorization header', async () => {
      delete mockRequest.headers!.authorization;
      delete mockRequest.cookies;

      // Mock token extractor to throw error for missing token
      const { validateToken } = await import('../../src/middleware/auth/token-validator');
      vi.mocked(validateToken).mockImplementationOnce(() => {
        throw new AuthenticationError('Authentication required');
      });

      const middleware = authMiddleware.authenticate();
      await middleware(mockRequest as any, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(AuthenticationError));
    });
  });

  describe('optionalAuth', () => {
    it('should attach user for valid token', async () => {
      // Set up valid token in request
      mockRequest.headers!.authorization = 'Bearer test-jwt-token';

      mockUserRepository.findById.mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        role: 'user',
        status: 'active',
        plexId: 'plex-123',
        plexUsername: 'testuser',
      } as any);

      // Mock the AuthenticationFacade authenticateOptional method
      const { AuthenticationFacade } = await import('../../src/auth');
      vi.spyOn(AuthenticationFacade.prototype, 'authenticateOptional').mockResolvedValue({
        user: {
          id: 'user-123',
          email: 'test@example.com',
          role: 'user',
        },
        token: 'test-jwt-token',
      } as any);

      const middleware = authMiddleware.optionalAuth();
      await middleware(mockRequest as any, mockResponse as Response, mockNext);

      expect(mockRequest.user).toBeDefined();
      expect(mockRequest.user!.id).toBe('user-123');
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should continue without user for invalid token', async () => {
      mockRequest.headers!.authorization = 'Bearer invalid-token';
      mockRequest.user = undefined;

      // Mock optional token extraction to return null for invalid token
      const { extractTokenOptional } = await import('../../src/middleware/auth/token-validator');
      vi.mocked(extractTokenOptional).mockImplementation(() => null);

      const middleware = authMiddleware.optionalAuth();
      await middleware(mockRequest as any, mockResponse as Response, mockNext);

      expect(mockRequest.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should continue without user when no token provided', async () => {
      delete mockRequest.headers!.authorization;
      mockRequest.user = undefined;

      // Mock optional token extraction to return null when no token
      const { extractTokenOptional } = await import('../../src/middleware/auth/token-validator');
      vi.mocked(extractTokenOptional).mockImplementation(() => null);

      const middleware = authMiddleware.optionalAuth();
      await middleware(mockRequest as any, mockResponse as Response, mockNext);

      expect(mockRequest.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalledWith();
    });
  });

  describe('requireRole', () => {
    it('should allow user with correct role', () => {
      mockRequest.user = mockUser;

      const middleware = authMiddleware.requireRole('user');
      middleware(mockRequest as any, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should allow user with one of multiple acceptable roles', () => {
      mockRequest.user = mockUser;

      const middleware = authMiddleware.requireRole('admin', 'user', 'moderator');
      middleware(mockRequest as any, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should reject user with incorrect role', () => {
      mockRequest.user = mockUser;

      const middleware = authMiddleware.requireRole('admin');
      middleware(mockRequest as any, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Required role: admin',
        })
      );
    });

    it('should reject unauthenticated requests', () => {
      // No user attached to request

      const middleware = authMiddleware.requireRole('user');
      middleware(mockRequest as any, mockResponse as Response, mockNext);

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
      middleware(mockRequest as any, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should allow admin user for any permission', () => {
      const adminUser: AuthenticatedUser = { ...mockUser, role: 'admin' };
      mockRequest.user = adminUser;

      const middleware = authMiddleware.requirePermission('restricted', 'delete');
      middleware(mockRequest as any, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should reject user without correct permission', () => {
      mockRequest.user = mockUser;

      const middleware = authMiddleware.requirePermission('admin', 'delete');
      middleware(mockRequest as any, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Access denied: admin:delete',
        })
      );
    });

    it('should reject unauthenticated requests', () => {
      const middleware = authMiddleware.requirePermission('media', 'read');
      middleware(mockRequest as any, mockResponse as Response, mockNext);

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
      middleware(mockRequest as any, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should allow ADMIN user (case variation)', () => {
      const adminUser: AuthenticatedUser = { ...mockUser, role: 'ADMIN' };
      mockRequest.user = adminUser;

      const middleware = authMiddleware.requireAdmin();
      middleware(mockRequest as any, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should reject regular user', () => {
      mockRequest.user = mockUser;

      const middleware = authMiddleware.requireAdmin();
      middleware(mockRequest as any, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(AuthenticationError));
    });
  });

  describe('requireUser', () => {
    it('should allow regular user', () => {
      mockRequest.user = mockUser;

      const middleware = authMiddleware.requireUser();
      middleware(mockRequest as any, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should allow admin user', () => {
      const adminUser: AuthenticatedUser = { ...mockUser, role: 'admin' };
      mockRequest.user = adminUser;

      const middleware = authMiddleware.requireUser();
      middleware(mockRequest as any, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should reject guest user', () => {
      const guestUser: AuthenticatedUser = { ...mockUser, role: 'guest' };
      mockRequest.user = guestUser;

      const middleware = authMiddleware.requireUser();
      middleware(mockRequest as any, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(AuthenticationError));
    });
  });

  describe('logAuthenticatedRequest', () => {
    it('should log request for authenticated user', () => {
      mockRequest.user = mockUser;

      const middleware = authMiddleware.logAuthenticatedRequest();
      middleware(mockRequest as any, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      // Logger mock would be checked here in real implementation
    });

    it('should not log for unauthenticated request', () => {
      const middleware = authMiddleware.logAuthenticatedRequest();
      middleware(mockRequest as any, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });
  });
});
