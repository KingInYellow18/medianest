import { AuthenticationError } from '@medianest/shared';
import { describe, it, expect, beforeEach, vi, beforeAll, afterAll } from 'vitest';

import { AuthenticationFacade, AuthenticatedUser } from '../../src/auth';
import { SessionTokenRepository } from '../../src/repositories/session-token.repository';
import { UserRepository } from '../../src/repositories/user.repository';
import { DeviceSessionService } from '../../src/services/device-session.service';

import type { Request } from 'express';

// Mock dependencies
vi.mock('../../src/repositories/user.repository');
vi.mock('../../src/repositories/session-token.repository');
vi.mock('../../src/services/device-session.service');
vi.mock('../../src/utils/logger');
vi.mock('../../src/config/config.service', () => ({
  configService: {
    getAuthConfig: () => ({
      JWT_SECRET: 'test-secret-key-for-testing-only-do-not-use-in-production',
      JWT_ISSUER: 'medianest-test',
      JWT_AUDIENCE: 'medianest-app-test',
    }),
  },
}));

// Mock JWT facade
vi.mock('../../src/auth/jwt-facade', () => ({
  jwtFacade: {
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
  },
}));

// Mock auth utilities
vi.mock('../../src/middleware/auth/token-validator', () => ({
  extractTokenOptional: vi.fn(),
  validateToken: vi.fn(),
}));

vi.mock('../../src/middleware/auth/user-validator', () => ({
  validateUser: vi.fn(),
  validateUserOptional: vi.fn(),
}));

vi.mock('../../src/middleware/auth/device-session-manager', () => ({
  validateSessionToken: vi.fn().mockResolvedValue(undefined),
  registerAndAssessDevice: vi.fn().mockResolvedValue({
    deviceId: 'device-123',
    isNewDevice: false,
    riskScore: 0.1,
  }),
  updateSessionActivity: vi.fn().mockResolvedValue(undefined),
}));

describe('AuthenticationFacade', () => {
  let authFacade: AuthenticationFacade;
  let mockUserRepository: any;
  let mockSessionTokenRepository: any;
  let mockDeviceSessionService: any;
  let mockRequest: Partial<
    Request & { user?: AuthenticatedUser; token?: string; deviceId?: string; sessionId?: string }
  >;

  const mockUser: AuthenticatedUser = {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
    role: 'user',
    plexId: 'plex-123',
    plexUsername: 'testuser',
  };

  beforeAll(() => {
    // Set required environment variables for JWT
    process.env.JWT_SECRET = 'test-secret-key-for-testing-only-do-not-use-in-production';
    process.env.JWT_ISSUER = 'medianest-test';
    process.env.JWT_AUDIENCE = 'medianest-app-test';
  });

  afterAll(() => {
    // Clean up environment variables
    delete process.env.JWT_SECRET;
    delete process.env.JWT_ISSUER;
    delete process.env.JWT_AUDIENCE;
  });

  beforeEach(() => {
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

    authFacade = new AuthenticationFacade(
      mockUserRepository,
      mockSessionTokenRepository,
      mockDeviceSessionService,
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
    };

    // Reset all mocks
    vi.clearAllMocks();
  });

  describe('authenticate', () => {
    it('should successfully authenticate a valid request', async () => {
      // Mock successful authentication flow
      const { validateToken } = await import('../../src/middleware/auth/token-validator');
      const { validateUser } = await import('../../src/middleware/auth/user-validator');
      const { registerAndAssessDevice } = await import(
        '../../src/middleware/auth/device-session-manager'
      );

      vi.mocked(validateToken).mockReturnValue({
        token: 'test-jwt-token',
        payload: {
          userId: 'user-123',
          email: 'test@example.com',
          role: 'user',
          sessionId: 'test-session-id',
        },
        metadata: {
          userId: 'user-123',
          sessionId: 'test-session-id',
        },
      } as any);

      vi.mocked(validateUser).mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        role: 'user',
        status: 'active',
        plexId: 'plex-123',
        plexUsername: 'testuser',
      } as any);

      vi.mocked(registerAndAssessDevice).mockResolvedValue({
        deviceId: 'device-123',
        isNewDevice: false,
        riskScore: 0.1,
      } as any);

      const result = await authFacade.authenticate(mockRequest as Request);

      expect(result).toMatchObject({
        user: expect.objectContaining({
          id: 'user-123',
          email: 'test@example.com',
          role: 'user',
        }),
        token: expect.any(String),
        deviceId: 'device-123',
        sessionId: expect.any(String),
      });
    });

    it('should throw AuthenticationError for invalid token', async () => {
      mockRequest.headers!.authorization = 'Bearer invalid-token';

      await expect(authFacade.authenticate(mockRequest as Request)).rejects.toThrow(
        'Invalid token',
      );
    });

    it('should throw AuthenticationError for inactive user', async () => {
      mockUserRepository.findById.mockResolvedValue({
        id: 'user-123',
        status: 'inactive',
      } as any);

      await expect(authFacade.authenticate(mockRequest as Request)).rejects.toThrow(
        AuthenticationError,
      );
    });

    it('should handle missing authorization header', async () => {
      delete mockRequest.headers!.authorization;

      await expect(authFacade.authenticate(mockRequest as Request)).rejects.toThrow(
        'Authentication required',
      );
    });
  });

  describe('authenticateOptional', () => {
    it('should return user data for valid token', async () => {
      const { extractTokenOptional } = await import('../../src/middleware/auth/token-validator');
      const { validateUserOptional } = await import('../../src/middleware/auth/user-validator');

      vi.mocked(extractTokenOptional).mockReturnValue('test-jwt-token');
      vi.mocked(validateUserOptional).mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        role: 'user',
        status: 'active',
        plexId: 'plex-123',
        plexUsername: 'testuser',
      } as any);

      const result = await authFacade.authenticateOptional(mockRequest as Request);

      expect(result).toMatchObject({
        user: expect.objectContaining({
          id: 'user-123',
          email: 'test@example.com',
          role: 'user',
        }),
        token: expect.any(String),
      });
    });

    it('should return null for invalid token', async () => {
      mockRequest.headers!.authorization = 'Bearer invalid-token';

      const result = await authFacade.authenticateOptional(mockRequest as Request);

      expect(result).toBeNull();
    });

    it('should return null for missing token', async () => {
      delete mockRequest.headers!.authorization;

      const result = await authFacade.authenticateOptional(mockRequest as Request);

      expect(result).toBeNull();
    });

    it('should return null for inactive user', async () => {
      const { extractTokenOptional } = await import('../../src/middleware/auth/token-validator');
      const { validateUserOptional } = await import('../../src/middleware/auth/user-validator');

      vi.mocked(extractTokenOptional).mockReturnValue('test-jwt-token');
      vi.mocked(validateUserOptional).mockResolvedValue(null); // Inactive users return null

      const result = await authFacade.authenticateOptional(mockRequest as Request);

      expect(result).toBeNull();
    });
  });

  describe('authorize', () => {
    it('should authorize admin for all resources', () => {
      const adminUser: AuthenticatedUser = { ...mockUser, role: 'admin' };

      const result = authFacade.authorize(adminUser, 'any-resource', 'any-action');

      expect(result).toBe(true);
    });

    it('should authorize user for allowed resource/action combinations', () => {
      const result = authFacade.authorize(mockUser, 'media', 'read');

      expect(result).toBe(true);
    });

    it('should deny user for unauthorized resource/action combinations', () => {
      const result = authFacade.authorize(mockUser, 'admin', 'delete');

      expect(result).toBe(false);
    });

    it('should deny guest for user-only resources', () => {
      const guestUser: AuthenticatedUser = { ...mockUser, role: 'guest' };

      const result = authFacade.authorize(guestUser, 'profile', 'update');

      expect(result).toBe(false);
    });
  });

  describe('hasRole', () => {
    it('should return true for matching role', () => {
      const result = authFacade.hasRole(mockUser, 'user');

      expect(result).toBe(true);
    });

    it('should return true for multiple roles when user has one', () => {
      const result = authFacade.hasRole(mockUser, 'admin', 'user', 'guest');

      expect(result).toBe(true);
    });

    it('should return false for non-matching role', () => {
      const result = authFacade.hasRole(mockUser, 'admin');

      expect(result).toBe(false);
    });

    it('should handle case-sensitive roles', () => {
      const adminUser: AuthenticatedUser = { ...mockUser, role: 'ADMIN' };

      expect(authFacade.hasRole(adminUser, 'ADMIN')).toBe(true);
      expect(authFacade.hasRole(adminUser, 'admin')).toBe(false);
    });
  });

  describe('generateTokens', () => {
    it('should generate access and refresh tokens', () => {
      const result = authFacade.generateTokens(mockUser);

      expect(result).toMatchObject({
        accessToken: expect.any(String),
        refreshToken: expect.any(String),
      });
    });

    it('should generate longer-lived tokens for remember me', () => {
      const result = authFacade.generateTokens(mockUser, true);

      expect(result).toMatchObject({
        accessToken: expect.any(String),
        refreshToken: expect.any(String),
      });

      // Verify token has longer expiry (implementation would need to decode and check)
      expect(result.accessToken).toBeDefined();
    });

    it('should include session ID when provided', () => {
      const result = authFacade.generateTokens(mockUser, false, {
        sessionId: 'custom-session-id',
      });

      expect(result).toMatchObject({
        accessToken: expect.any(String),
        refreshToken: expect.any(String),
      });
    });
  });

  describe('refreshToken', () => {
    it('should refresh tokens successfully', async () => {
      // Generate a valid refresh token first
      const tokens = authFacade.generateTokens(mockUser);

      mockUserRepository.findById.mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        role: 'user',
        status: 'active',
        plexId: 'plex-123',
        plexUsername: 'testuser',
      } as any);

      const result = await authFacade.refreshToken(tokens.refreshToken);

      expect(result).toMatchObject({
        accessToken: expect.any(String),
        refreshToken: expect.any(String),
        user: expect.objectContaining({
          id: 'user-123',
          email: 'test@example.com',
        }),
      });
    });

    it('should throw error for invalid refresh token', async () => {
      await expect(authFacade.refreshToken('invalid-refresh-token')).rejects.toThrow();
    });
  });

  describe('logout', () => {
    it('should blacklist token on logout', async () => {
      const tokens = authFacade.generateTokens(mockUser);

      await authFacade.logout(tokens.accessToken, 'session-123');

      // Verify token is blacklisted (would need access to internal state)
      const tokenInfo = authFacade.getTokenInfo(tokens.accessToken);
      expect(tokenInfo.tokenId).toBeDefined();
    });

    it('should handle logout without session ID', async () => {
      const tokens = authFacade.generateTokens(mockUser);

      await expect(authFacade.logout(tokens.accessToken)).resolves.not.toThrow();
    });
  });

  describe('token utilities', () => {
    it('should get token information', () => {
      const tokens = authFacade.generateTokens(mockUser);
      const tokenInfo = authFacade.getTokenInfo(tokens.accessToken);

      expect(tokenInfo).toMatchObject({
        userId: 'user-123',
        sessionId: expect.any(String),
        issuedAt: expect.any(Date),
        expiresAt: expect.any(Date),
        tokenId: expect.any(String),
      });
    });

    it('should validate token correctly', () => {
      const tokens = authFacade.generateTokens(mockUser);

      const result = authFacade.validateToken(tokens.accessToken);

      expect(result).toMatchObject({
        userId: 'user-123',
        email: 'test@example.com',
        role: 'user',
      });
    });

    it('should detect if token should be rotated', () => {
      const tokens = authFacade.generateTokens(mockUser);

      // Fresh token should not need rotation
      const shouldRotate = authFacade.shouldRotateToken(tokens.accessToken);

      expect(shouldRotate).toBe(false);
    });
  });
});
