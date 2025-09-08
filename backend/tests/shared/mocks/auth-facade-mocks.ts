/**
 * Authentication Facade Mock Implementation - Phase 2 Mock Fixes
 * Fixes issues with AuthenticationFacade mocking and dependency injection
 */

import { vi } from 'vitest';
import { Request, Response } from 'express';
import { AuthenticatedUser } from '../../../src/middleware/auth/user-validator';
import { JWTPayload, JWTOptions, TokenRotationInfo } from '../../../src/utils/jwt';
import { createMockJWTPayload, createMockTokenRotationInfo } from './jwt-mocks';

// Mock authenticated user factory
export const createMockAuthenticatedUser = (
  overrides?: Partial<AuthenticatedUser>
): AuthenticatedUser => ({
  id: 'mock-user-123',
  plexId: 'mock-plex-456',
  email: 'test@example.com',
  username: 'testuser',
  name: 'Test User',
  role: 'user',
  status: 'active',
  plexToken: 'encrypted-mock-plex-token',
  image: null,
  requiresPasswordChange: false,
  createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
  lastLoginAt: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
  ...overrides,
});

// Mock authentication result factory
export const createMockAuthResult = (
  userOverrides?: Partial<AuthenticatedUser>,
  resultOverrides?: any
) => ({
  user: createMockAuthenticatedUser(userOverrides),
  token: 'mock-access-token-' + Date.now().toString(16),
  deviceId: 'mock-device-' + Date.now().toString(16).slice(-8),
  sessionId: 'mock-session-' + Date.now().toString(16).slice(-8),
  ...resultOverrides,
});

// Mock repository interfaces
export const createMockUserRepository = () => ({
  findById: vi.fn().mockImplementation(async (id: string) => {
    if (id.includes('not-found')) {
      return null;
    }
    return createMockAuthenticatedUser({ id });
  }),
  findByPlexId: vi.fn().mockImplementation(async (plexId: string) => {
    if (plexId.includes('not-found')) {
      return null;
    }
    return createMockAuthenticatedUser({ plexId });
  }),
  findByEmail: vi.fn().mockImplementation(async (email: string) => {
    if (email.includes('not-found')) {
      return null;
    }
    return createMockAuthenticatedUser({ email });
  }),
  create: vi.fn().mockImplementation(async (userData: any) => {
    return createMockAuthenticatedUser({
      id: 'created-user-' + Date.now(),
      ...userData,
    });
  }),
  update: vi.fn().mockImplementation(async (id: string, updateData: any) => {
    return createMockAuthenticatedUser({ id, ...updateData });
  }),
  delete: vi.fn().mockResolvedValue(true),
  findAll: vi.fn().mockResolvedValue([]),
  count: vi.fn().mockResolvedValue(0),
});

export const createMockSessionTokenRepository = () => ({
  create: vi.fn().mockImplementation(async (tokenData: any) => ({
    id: 'mock-session-token-' + Date.now(),
    userId: tokenData.userId,
    tokenHash: 'mock-hash-' + Date.now().toString(16),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    createdAt: new Date(),
    lastUsedAt: new Date(),
    ...tokenData,
  })),
  findByToken: vi.fn().mockImplementation(async (tokenHash: string) => {
    if (tokenHash.includes('not-found')) {
      return null;
    }
    return {
      id: 'mock-session-token-123',
      userId: 'mock-user-123',
      tokenHash,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      createdAt: new Date(Date.now() - 60 * 60 * 1000),
      lastUsedAt: new Date(),
    };
  }),
  update: vi.fn().mockImplementation(async (id: string, updateData: any) => ({
    id,
    ...updateData,
    updatedAt: new Date(),
  })),
  delete: vi.fn().mockResolvedValue(true),
  deleteExpired: vi.fn().mockResolvedValue({ count: 0 }),
  findExpired: vi.fn().mockResolvedValue([]),
});

export const createMockDeviceSessionService = () => ({
  registerDevice: vi.fn().mockImplementation(async (userId: string, deviceInfo: any) => ({
    deviceId: 'mock-device-' + Date.now().toString(16).slice(-8),
    userId,
    deviceName: deviceInfo.deviceName || 'Mock Device',
    userAgent: deviceInfo.userAgent || 'Mock User Agent',
    ipAddress: deviceInfo.ipAddress || '127.0.0.1',
    isVerified: true,
    riskScore: 0.1,
    lastSeen: new Date(),
    createdAt: new Date(),
  })),
  assessDeviceRisk: vi.fn().mockImplementation(async (deviceInfo: any) => ({
    riskScore: 0.1,
    riskLevel: 'LOW',
    factors: ['new_device'],
    requiresVerification: false,
  })),
  updateActivity: vi.fn().mockImplementation(async (deviceId: string, sessionInfo: any) => ({
    deviceId,
    lastActivity: new Date(),
    sessionCount: 1,
    ...sessionInfo,
  })),
  getDevice: vi.fn().mockImplementation(async (deviceId: string) => {
    if (deviceId.includes('not-found')) {
      return null;
    }
    return {
      id: deviceId,
      userId: 'mock-user-123',
      deviceName: 'Mock Device',
      isVerified: true,
      riskScore: 0.1,
      lastSeen: new Date(),
    };
  }),
  getUserDevices: vi.fn().mockResolvedValue([]),
  revokeDevice: vi.fn().mockResolvedValue(true),
});

// Mock AuthenticationFacade class
export const createMockAuthenticationFacade = () => {
  const facade = {
    authenticate: vi.fn().mockImplementation(async (req: Request) => {
      // Extract token from request for conditional responses
      const authHeader = req.headers.authorization;
      const token =
        authHeader?.replace('Bearer ', '') || req.cookies?.['auth-token'] || 'default-token';

      if (token.includes('invalid') || token.includes('expired')) {
        const error = new Error(token.includes('expired') ? 'Token expired' : 'Invalid token');
        error.name = 'AuthenticationError';
        throw error;
      }

      if (token.includes('user-not-found')) {
        const error = new Error('User not found');
        error.name = 'AuthenticationError';
        throw error;
      }

      // Extract user type from token for role-based responses
      const isAdmin = token.includes('admin');
      const userRole = isAdmin ? 'admin' : 'user';

      return createMockAuthResult({ role: userRole });
    }),

    authenticateOptional: vi.fn().mockImplementation(async (req: Request) => {
      try {
        const result = await facade.authenticate(req);
        return {
          user: result.user,
          token: result.token,
        };
      } catch {
        return null;
      }
    }),

    authorize: vi
      .fn()
      .mockImplementation((user: AuthenticatedUser, resource: string, action: string) => {
        // Simple authorization logic for testing
        if (user.role === 'admin') {
          return true; // Admin can do everything
        }

        // User permissions
        const userPermissions = [
          'media:read',
          'media:stream',
          'dashboard:read',
          'profile:read',
          'profile:update',
        ];

        const permissionKey = `${resource}:${action}`;
        return userPermissions.includes(permissionKey);
      }),

    validateToken: vi.fn().mockImplementation((token: string, options?: any) => {
      if (token.includes('invalid') || token.includes('expired')) {
        const error = new Error(token.includes('expired') ? 'Token expired' : 'Invalid token');
        error.name = token.includes('expired') ? 'TokenExpiredError' : 'JsonWebTokenError';
        throw error;
      }

      return createMockJWTPayload();
    }),

    refreshToken: vi.fn().mockImplementation(async (refreshToken: string) => {
      if (refreshToken.includes('invalid') || refreshToken.includes('expired')) {
        const error = new Error(
          refreshToken.includes('expired') ? 'Refresh token expired' : 'Invalid refresh token'
        );
        error.name = 'AuthenticationError';
        throw error;
      }

      const user = createMockAuthenticatedUser();
      return {
        accessToken: 'new-access-token-' + Date.now().toString(16),
        refreshToken: 'new-refresh-token-' + Date.now().toString(16),
        user,
      };
    }),

    handleTokenRotation: vi
      .fn()
      .mockImplementation(
        async (req: Request, res: Response, token: string, payload: JWTPayload, userId: string) => {
          // Mock token rotation handling
          const rotationInfo = createMockTokenRotationInfo();

          // Set new token in response headers (mock implementation)
          res.setHeader('X-New-Token', rotationInfo.newToken);
          res.setHeader('X-Token-Rotated', 'true');
        }
      ),

    logout: vi.fn().mockImplementation(async (token: string, sessionId?: string) => {
      // Mock logout implementation
      console.log(`[MOCK] User logged out - Token: ${token}, Session: ${sessionId}`);
    }),

    generateTokens: vi
      .fn()
      .mockImplementation((user: AuthenticatedUser, rememberMe = false, options?: JWTOptions) => ({
        accessToken: `${rememberMe ? 'remember' : 'access'}-token-${user.id}-${Date.now().toString(
          16
        )}`,
        refreshToken: `refresh-token-${user.id}-${Date.now().toString(16)}`,
      })),

    getTokenInfo: vi.fn().mockImplementation((token: string) => ({
      userId: 'mock-user-123',
      sessionId: 'mock-session-789',
      deviceId: 'mock-device-abc',
      issuedAt: new Date(Date.now() - 5 * 60 * 1000),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      tokenId: 'mock-token-id-' + Date.now().toString(16),
    })),

    shouldRotateToken: vi.fn().mockImplementation((token: string) => {
      return token.includes('rotate') || token.includes('near-expiry');
    }),

    rotateTokenIfNeeded: vi
      .fn()
      .mockImplementation((token: string, payload: JWTPayload, options?: JWTOptions) => {
        if (!facade.shouldRotateToken(token)) {
          return null;
        }
        return createMockTokenRotationInfo();
      }),

    hasRole: vi.fn().mockImplementation((user: AuthenticatedUser, ...roles: string[]) => {
      return roles.includes(user.role);
    }),
  };

  return facade;
};

// Factory for creating AuthenticationFacade instances
export const createMockAuthenticationFacadeFactory = () => {
  return vi
    .fn()
    .mockImplementation(
      (userRepository: any, sessionTokenRepository: any, deviceSessionService: any) =>
        createMockAuthenticationFacade()
    );
};

// Setup complete authentication facade mocks
export const setupAuthFacadeMocks = () => {
  const mockUserRepository = createMockUserRepository();
  const mockSessionTokenRepository = createMockSessionTokenRepository();
  const mockDeviceSessionService = createMockDeviceSessionService();
  const mockAuthFacade = createMockAuthenticationFacade();
  const mockFacadeFactory = createMockAuthenticationFacadeFactory();

  // Mock the main auth module
  vi.mock('../../../src/auth/index', () => ({
    AuthenticationFacade: vi.fn().mockImplementation(() => mockAuthFacade),
    createAuthenticationFacade: mockFacadeFactory,
  }));

  // Mock repositories
  vi.mock('../../../src/repositories/user.repository', () => ({
    UserRepository: vi.fn().mockImplementation(() => mockUserRepository),
  }));

  vi.mock('../../../src/repositories/session-token.repository', () => ({
    SessionTokenRepository: vi.fn().mockImplementation(() => mockSessionTokenRepository),
  }));

  // Mock device session service
  vi.mock('../../../src/services/device-session.service', () => ({
    DeviceSessionService: vi.fn().mockImplementation(() => mockDeviceSessionService),
  }));

  return {
    mockUserRepository,
    mockSessionTokenRepository,
    mockDeviceSessionService,
    mockAuthFacade,
    mockFacadeFactory,
  };
};

// Test scenario helpers
export const createAuthTestScenarios = () => ({
  validAuth: {
    token: 'Bearer valid-token-user123',
    user: createMockAuthenticatedUser(),
  },
  adminAuth: {
    token: 'Bearer admin-token-admin456',
    user: createMockAuthenticatedUser({ role: 'admin', id: 'admin456' }),
  },
  expiredAuth: {
    token: 'Bearer expired-token-user123',
    expectedError: 'Token expired',
  },
  invalidAuth: {
    token: 'Bearer invalid-malformed-token',
    expectedError: 'Invalid token',
  },
  userNotFound: {
    token: 'Bearer user-not-found-token',
    expectedError: 'User not found',
  },
  unauthorizedAction: {
    user: createMockAuthenticatedUser({ role: 'user' }),
    resource: 'admin',
    action: 'create',
    expected: false,
  },
  authorizedAction: {
    user: createMockAuthenticatedUser({ role: 'admin' }),
    resource: 'admin',
    action: 'create',
    expected: true,
  },
});

// Reset all authentication facade mocks
export const resetAuthFacadeMocks = (mocks: ReturnType<typeof setupAuthFacadeMocks>) => {
  Object.values(mocks).forEach((mock) => {
    if (mock && typeof mock === 'object') {
      Object.values(mock).forEach((method) => {
        if (method && typeof method.mockReset === 'function') {
          method.mockReset();
        }
      });
    }
  });
};
