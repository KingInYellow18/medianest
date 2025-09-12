/**
 * COMPREHENSIVE AUTHENTICATION MOCKING INFRASTRUCTURE
 *
 * Provides high-level authentication mocks for middleware, facades, and services.
 * Addresses authentication test failures and provides consistent auth behavior.
 */

import { vi } from 'vitest';

import { jwtTestHelpers, createDefaultPayload } from './jwt-mock';
import { TEST_CONFIG } from '../test-infrastructure-config';

/**
 * Mock authenticated user
 */
export const createMockUser = (overrides = {}) => ({
  id: 'test-user-id',
  email: 'test@medianest.com',
  name: 'Test User',
  role: 'USER',
  plexId: 'test-plex-id',
  plexUsername: 'testuser',
  status: 'active',
  createdAt: new Date('2024-01-01T00:00:00Z'),
  updatedAt: new Date('2024-01-01T00:00:00Z'),
  lastLoginAt: new Date('2024-01-01T00:00:00Z'),
  ...overrides,
});

/**
 * Mock Express request with authentication
 */
export const createMockAuthenticatedRequest = (overrides = {}) => {
  const user = createMockUser(overrides.user);
  const token = jwtTestHelpers.createValidToken({ userId: user.id });

  return {
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      'user-agent': 'test-agent',
      ...(overrides as any)?.headers,
    },
    body: {},
    query: {},
    params: {},
    ip: '127.0.0.1',
    method: 'GET',
    path: '/api/test',
    get: vi.fn().mockReturnValue('test-user-agent'),
    user,
    token,
    sessionId: 'test-session-id',
    deviceId: 'test-device-id',
    ...overrides,
  };
};

/**
 * Mock Express response
 */
export const createMockResponse = () => ({
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
  send: vi.fn().mockReturnThis(),
  cookie: vi.fn().mockReturnThis(),
  clearCookie: vi.fn().mockReturnThis(),
  redirect: vi.fn().mockReturnThis(),
  setHeader: vi.fn().mockReturnThis(),
  getHeader: vi.fn(),
  locals: {},
  statusCode: 200,
});

/**
 * Mock Next function
 */
export const createMockNext = () => vi.fn();

/**
 * Authentication service mocks
 */
export function setupAuthServiceMocks() {
  // Mock JWT utilities
  const mockJWTUtils = {
    generateToken: vi.fn().mockImplementation((payload, rememberMe = false) => {
      return jwtTestHelpers.createValidToken(payload);
    }),

    verifyToken: vi.fn().mockImplementation((token) => {
      return createDefaultPayload();
    }),

    generateRefreshToken: vi.fn().mockImplementation((payload = {}) => {
      return jwtTestHelpers.createRefreshToken(payload);
    }),

    verifyRefreshToken: vi.fn().mockImplementation((token) => {
      return {
        userId: 'test-user-id',
        sessionId: 'test-session-id',
      };
    }),

    getTokenMetadata: vi.fn().mockImplementation((token) => {
      return {
        userId: 'test-user-id',
        sessionId: 'test-session-id',
        tokenId: 'test-token-id',
        issuedAt: new Date(),
        expiresAt: new Date(Date.now() + 900000), // 15 minutes
      };
    }),

    isTokenBlacklisted: vi.fn().mockReturnValue(false),
    blacklistToken: vi.fn(),
    shouldRotateToken: vi.fn().mockReturnValue(false),
    rotateTokenIfNeeded: vi.fn().mockReturnValue(null),
  };

  // Mock token validator
  const mockTokenValidator = {
    extractToken: vi.fn().mockImplementation((req) => {
      const auth = req.headers?.authorization;
      if (auth && auth.startsWith('Bearer ')) {
        return auth.substring(7);
      }
      throw new Error('Authorization header missing');
    }),

    extractTokenOptional: vi.fn().mockImplementation((req) => {
      const auth = req.headers?.authorization;
      if (auth && auth.startsWith('Bearer ')) {
        return auth.substring(7);
      }
      return null;
    }),

    validateToken: vi.fn().mockImplementation((req, context) => {
      const authHeader = req.headers?.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new Error('Authentication required');
      }

      const token = authHeader.substring(7);
      if (token === 'invalid-token') {
        throw new Error('Invalid token');
      }

      return {
        token,
        payload: createDefaultPayload(),
        metadata: {
          tokenId: 'test-token-id',
          userId: 'user-123',
          sessionId: 'test-session-id',
          issuedAt: new Date(),
          expiresAt: new Date(Date.now() + 900000),
        },
      };
    }),
  };

  // Mock user validator
  const mockUserValidator = {
    validateUser: vi.fn().mockImplementation((userId, userRepository, context) => {
      const user = createMockUser({ id: userId });
      if (user.status !== 'active') {
        const error = new Error('User account is not active');
        error.name = 'AuthenticationError';
        throw error;
      }
      return Promise.resolve(user);
    }),
    validateUserOptional: vi.fn().mockImplementation((userId, userRepository) => {
      return Promise.resolve(createMockUser({ id: userId }));
    }),
  };

  // Mock device session manager
  const mockDeviceSessionManager = {
    validateSessionToken: vi.fn().mockResolvedValue(undefined),
    registerAndAssessDevice: vi.fn().mockResolvedValue({
      deviceId: 'test-device-id',
      isNewDevice: false,
      riskScore: 0.1,
    }),
    updateSessionActivity: vi.fn().mockResolvedValue(undefined),
  };

  // Setup mocks
  vi.mock('../../src/utils/jwt', () => mockJWTUtils);
  vi.mock('../../src/middleware/auth/token-validator', () => mockTokenValidator);
  vi.mock('../../src/middleware/auth/user-validator', () => mockUserValidator);
  vi.mock('../../src/middleware/auth/device-session-manager', () => mockDeviceSessionManager);

  return {
    mockJWTUtils,
    mockTokenValidator,
    mockUserValidator,
    mockDeviceSessionManager,
    resetMocks: () => {
      vi.clearAllMocks();

      // Reset to default behavior
      mockJWTUtils.verifyToken.mockImplementation(() => createDefaultPayload());
      mockJWTUtils.isTokenBlacklisted.mockReturnValue(false);
      mockJWTUtils.shouldRotateToken.mockReturnValue(false);

      mockTokenValidator.validateToken.mockImplementation((req, context) => {
        const authHeader = req.headers?.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          throw new Error('Authentication required');
        }

        const token = authHeader.substring(7);
        if (token === 'invalid-token') {
          throw new Error('Invalid token');
        }

        return {
          token,
          payload: createDefaultPayload(),
          metadata: {
            tokenId: 'test-token-id',
            userId: 'user-123',
            sessionId: 'test-session-id',
            issuedAt: new Date(),
            expiresAt: new Date(Date.now() + 900000),
          },
        };
      });

      mockUserValidator.validateUser.mockResolvedValue(createMockUser());
      mockDeviceSessionManager.registerAndAssessDevice.mockResolvedValue({
        deviceId: 'test-device-id',
        isNewDevice: false,
        riskScore: 0.1,
      });
    },
  };
}

/**
 * Authentication middleware test helpers
 */
export const authMiddlewareHelpers = {
  // Mock successful authentication
  mockSuccessfulAuth: (user = createMockUser()) => {
    const { mockUserValidator, mockDeviceSessionManager } = setupAuthServiceMocks();

    mockUserValidator.validateUser.mockResolvedValue(user);
    mockDeviceSessionManager.registerAndAssessDevice.mockResolvedValue({
      deviceId: 'test-device-id',
      isNewDevice: false,
      riskScore: 0.1,
    });

    return { user, token: jwtTestHelpers.createValidToken({ userId: user.id }) };
  },

  // Mock authentication failure
  mockAuthFailure: (errorMessage = 'Invalid token') => {
    const { mockTokenValidator } = setupAuthServiceMocks();

    mockTokenValidator.validateToken.mockImplementation(() => {
      throw new Error(errorMessage);
    });
  },

  // Mock expired token
  mockExpiredToken: () => {
    const { mockJWTUtils } = setupAuthServiceMocks();

    mockJWTUtils.verifyToken.mockImplementation(() => {
      const error = new Error('jwt expired');
      error.name = 'TokenExpiredError';
      throw error;
    });
  },

  // Mock missing authorization header
  mockMissingAuth: () => {
    const { mockTokenValidator } = setupAuthServiceMocks();

    mockTokenValidator.extractToken.mockImplementation(() => {
      throw new Error('Authorization header missing');
    });
  },

  // Mock blacklisted token
  mockBlacklistedToken: () => {
    const { mockJWTUtils } = setupAuthServiceMocks();

    mockJWTUtils.isTokenBlacklisted.mockReturnValue(true);
  },
};

/**
 * Authorization test helpers
 */
export const authorizationHelpers = {
  // Create user with specific role
  createUserWithRole: (role: string, overrides = {}) => {
    return createMockUser({ role, ...overrides });
  },

  // Check role-based authorization
  mockRoleAuthorization: (allowedRoles: string[]) => {
    return (user: any) => allowedRoles.includes(user.role);
  },

  // Check permission-based authorization
  mockPermissionAuthorization: (requiredPermission: string) => {
    return (user: any) => {
      // Admin has all permissions
      if (user.role === 'ADMIN') return true;

      // Define role permissions
      const rolePermissions: Record<string, string[]> = {
        USER: ['media:read', 'media:create', 'profile:update'],
        MODERATOR: ['media:read', 'media:create', 'media:update', 'profile:update'],
        ADMIN: ['*'], // All permissions
        GUEST: ['media:read'],
      };

      const userPermissions = rolePermissions[user.role] || [];
      return userPermissions.includes('*') || userPermissions.includes(requiredPermission);
    };
  },
};

/**
 * Session management test helpers
 */
export const sessionHelpers = {
  // Mock active session
  mockActiveSession: (sessionData = {}) => {
    return {
      id: 'test-session-id',
      userId: 'test-user-id',
      deviceId: 'test-device-id',
      isActive: true,
      lastActivity: new Date(),
      expiresAt: new Date(Date.now() + 86400000), // 24 hours
      ...sessionData,
    };
  },

  // Mock expired session
  mockExpiredSession: () => {
    return {
      id: 'test-expired-session-id',
      userId: 'test-user-id',
      deviceId: 'test-device-id',
      isActive: false,
      lastActivity: new Date(Date.now() - 86400000), // 24 hours ago
      expiresAt: new Date(Date.now() - 3600000), // Expired 1 hour ago
    };
  },

  // Mock device information
  mockDeviceInfo: (overrides = {}) => {
    return {
      deviceId: 'test-device-id',
      userAgent: 'test-user-agent',
      ipAddress: '127.0.0.1',
      isNewDevice: false,
      riskScore: 0.1,
      lastSeen: new Date(),
      ...overrides,
    };
  },
};
