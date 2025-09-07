/**
 * Middleware Mock Implementation - Phase 2 Mock Fixes
 * Fixes issues with authentication middleware and token validation mocking
 */

import { vi } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { AuthenticatedUser } from '../../../src/middleware/auth/user-validator';
import { createMockAuthenticatedUser } from './auth-facade-mocks';
import { createMockJWTPayload } from './jwt-mocks';

// Mock token validation context
export const createMockTokenValidationContext = (overrides?: any) => ({
  ipAddress: '127.0.0.1',
  userAgent: 'Test-Agent/1.0',
  ...overrides,
});

// Mock token validation result
export const createMockTokenValidationResult = (overrides?: any) => ({
  token: 'mock-validated-token-' + Date.now().toString(16),
  payload: createMockJWTPayload(),
  metadata: {
    tokenId: 'mock-token-id-' + Date.now().toString(16),
    issuedAt: new Date(Date.now() - 5 * 60 * 1000),
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
  },
  ...overrides,
});

// Mock token validator utilities
export const createMockTokenValidator = () => ({
  extractToken: vi.fn().mockImplementation((req: Request) => {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    if (req.cookies?.['auth-token']) {
      return req.cookies['auth-token'];
    }

    if (req.cookies?.['token']) {
      return req.cookies['token'];
    }

    const error = new Error('Authentication required');
    error.name = 'AuthenticationError';
    throw error;
  }),

  extractTokenOptional: vi.fn().mockImplementation((req: Request) => {
    try {
      return createMockTokenValidator().extractToken(req);
    } catch {
      return null;
    }
  }),

  validateToken: vi.fn().mockImplementation((req: Request, context: any) => {
    const token = createMockTokenValidator().extractToken(req);

    if (token.includes('invalid') || token.includes('expired') || token.includes('blacklisted')) {
      const errorType = token.includes('expired')
        ? 'TokenExpiredError'
        : token.includes('blacklisted')
        ? 'TokenBlacklistedError'
        : 'InvalidTokenError';
      const error = new Error(`Token validation failed: ${errorType}`);
      error.name = 'AuthenticationError';
      throw error;
    }

    return createMockTokenValidationResult({
      token,
      payload: createMockJWTPayload({
        ipAddress: context?.ipAddress,
        userAgent: context?.userAgent,
      }),
    });
  }),

  validateTokenBlacklist: vi
    .fn()
    .mockImplementation((token: string, metadata: any, context: any) => {
      if (token.includes('blacklisted') || metadata?.tokenId?.includes('blacklisted')) {
        const error = new Error('Token has been revoked');
        error.name = 'AuthenticationError';
        throw error;
      }
    }),
});

// Mock user validator utilities
export const createMockUserValidator = () => ({
  validateUser: vi
    .fn()
    .mockImplementation(async (userId: string, userRepository: any, context: any) => {
      if (userId.includes('not-found') || userId.includes('inactive')) {
        const error = new Error('User not found or inactive');
        error.name = 'AuthenticationError';
        throw error;
      }

      const isAdmin = userId.includes('admin');
      return createMockAuthenticatedUser({
        id: userId,
        role: isAdmin ? 'admin' : 'user',
      });
    }),

  validateUserOptional: vi.fn().mockImplementation(async (userId: string, userRepository: any) => {
    try {
      return await createMockUserValidator().validateUser(userId, userRepository, {});
    } catch {
      return null;
    }
  }),
});

// Mock device session manager utilities
export const createMockDeviceSessionManager = () => ({
  validateSessionToken: vi
    .fn()
    .mockImplementation(
      async (token: string, metadata: any, sessionTokenRepository: any, context: any) => {
        if (token.includes('invalid-session') || metadata?.sessionId?.includes('invalid')) {
          const error = new Error('Invalid session token');
          error.name = 'AuthenticationError';
          throw error;
        }

        return {
          sessionId: metadata?.sessionId || 'mock-session-' + Date.now().toString(16),
          valid: true,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        };
      }
    ),

  registerAndAssessDevice: vi
    .fn()
    .mockImplementation(async (userId: string, req: Request, deviceSessionService: any) => {
      return {
        deviceId: 'mock-device-' + Date.now().toString(16).slice(-8),
        isNewDevice: false,
        riskScore: 0.1,
        riskLevel: 'LOW',
        requiresVerification: false,
        registeredAt: new Date(),
      };
    }),

  updateSessionActivity: vi
    .fn()
    .mockImplementation(async (sessionId: string, context: any, deviceSessionService: any) => {
      return {
        sessionId,
        lastActivity: new Date(),
        activityCount: 1,
        context,
      };
    }),
});

// Mock token rotation utilities
export const createMockTokenRotator = () => ({
  handleTokenRotation: vi
    .fn()
    .mockImplementation(
      async (
        token: string,
        payload: any,
        userId: string,
        context: any,
        sessionTokenRepository: any,
        res: Response
      ) => {
        if (token.includes('no-rotation')) {
          return; // No rotation needed
        }

        const newToken = 'rotated-token-' + Date.now().toString(16);
        const refreshToken = 'rotated-refresh-' + Date.now().toString(16);

        // Set new tokens in response
        res.setHeader('X-New-Access-Token', newToken);
        res.setHeader('X-New-Refresh-Token', refreshToken);
        res.setHeader('X-Token-Rotated', 'true');

        // Set cookies
        res.cookie('token', newToken, {
          httpOnly: true,
          secure: false, // For testing
          maxAge: 15 * 60 * 1000, // 15 minutes
        });
      }
    ),
});

// Mock authentication middleware
export const createMockAuthMiddleware = () => {
  const mockAuthFacade = {
    authenticate: vi.fn(),
    authenticateOptional: vi.fn(),
  };

  return {
    // Required authentication middleware
    authenticate: vi.fn().mockImplementation((req: Request, res: Response, next: NextFunction) => {
      try {
        const authHeader = req.headers.authorization;
        const token = authHeader?.replace('Bearer ', '') || req.cookies?.token;

        if (!token || token.includes('invalid') || token.includes('expired')) {
          return res.status(401).json({
            success: false,
            error: {
              message: 'Authentication required',
              code: 'UNAUTHORIZED',
            },
          });
        }

        // Mock successful authentication
        const isAdmin = token.includes('admin');
        req.user = createMockAuthenticatedUser({
          role: isAdmin ? 'admin' : 'user',
        });
        req.token = token;

        next();
      } catch (error) {
        return res.status(401).json({
          success: false,
          error: {
            message: 'Authentication failed',
            code: 'AUTHENTICATION_FAILED',
          },
        });
      }
    }),

    // Optional authentication middleware
    authenticateOptional: vi
      .fn()
      .mockImplementation((req: Request, res: Response, next: NextFunction) => {
        try {
          const authHeader = req.headers.authorization;
          const token = authHeader?.replace('Bearer ', '') || req.cookies?.token;

          if (token && !token.includes('invalid') && !token.includes('expired')) {
            const isAdmin = token.includes('admin');
            req.user = createMockAuthenticatedUser({
              role: isAdmin ? 'admin' : 'user',
            });
            req.token = token;
          }

          next();
        } catch {
          // Continue without authentication for optional middleware
          next();
        }
      }),

    // Role-based authorization middleware
    authorize: vi.fn().mockImplementation((...roles: string[]) => {
      return (req: Request, res: Response, next: NextFunction) => {
        if (!req.user) {
          return res.status(401).json({
            success: false,
            error: {
              message: 'Authentication required',
              code: 'UNAUTHORIZED',
            },
          });
        }

        if (!roles.includes(req.user.role) && !roles.includes('*')) {
          return res.status(403).json({
            success: false,
            error: {
              message: 'Insufficient permissions',
              code: 'FORBIDDEN',
            },
          });
        }

        next();
      };
    }),

    // Admin-only middleware
    requireAdmin: vi.fn().mockImplementation((req: Request, res: Response, next: NextFunction) => {
      if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: {
            message: 'Admin access required',
            code: 'FORBIDDEN',
          },
        });
      }
      next();
    }),

    // User authentication status checker
    checkAuthStatus: vi
      .fn()
      .mockImplementation((req: Request, res: Response, next: NextFunction) => {
        const authHeader = req.headers.authorization;
        const token = authHeader?.replace('Bearer ', '') || req.cookies?.token;

        if (token && !token.includes('invalid') && !token.includes('expired')) {
          req.isAuthenticated = true;
          const isAdmin = token.includes('admin');
          req.user = createMockAuthenticatedUser({
            role: isAdmin ? 'admin' : 'user',
          });
        } else {
          req.isAuthenticated = false;
        }

        next();
      }),

    // Mock facade reference
    authFacade: mockAuthFacade,
  };
};

// Mock CSRF middleware
export const createMockCSRFMiddleware = () => ({
  csrfProtection: vi.fn().mockImplementation((req: Request, res: Response, next: NextFunction) => {
    // Mock CSRF token validation
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'OPTIONS') {
      const csrfToken = req.headers['x-csrf-token'] || req.body._csrf;

      if (!csrfToken || csrfToken.includes('invalid')) {
        return res.status(403).json({
          success: false,
          error: {
            message: 'Invalid CSRF token',
            code: 'CSRF_TOKEN_INVALID',
          },
        });
      }
    }

    // Add CSRF token to response
    res.locals.csrfToken = 'mock-csrf-token-' + Date.now().toString(16);
    next();
  }),

  generateToken: vi.fn().mockReturnValue('mock-csrf-token-' + Date.now().toString(16)),
});

// Setup all middleware mocks
export const setupMiddlewareMocks = () => {
  const tokenValidator = createMockTokenValidator();
  const userValidator = createMockUserValidator();
  const deviceSessionManager = createMockDeviceSessionManager();
  const tokenRotator = createMockTokenRotator();
  const authMiddleware = createMockAuthMiddleware();
  const csrfMiddleware = createMockCSRFMiddleware();

  // Mock token validator module
  vi.mock('../../../src/middleware/auth/token-validator', () => ({
    extractToken: tokenValidator.extractToken,
    extractTokenOptional: tokenValidator.extractTokenOptional,
    validateToken: tokenValidator.validateToken,
    validateTokenBlacklist: tokenValidator.validateTokenBlacklist,
    TokenValidationContext: {} as any,
    TokenValidationResult: {} as any,
  }));

  // Mock user validator module
  vi.mock('../../../src/middleware/auth/user-validator', () => ({
    validateUser: userValidator.validateUser,
    validateUserOptional: userValidator.validateUserOptional,
    AuthenticatedUser: {} as any,
  }));

  // Mock device session manager module
  vi.mock('../../../src/middleware/auth/device-session-manager', () => ({
    validateSessionToken: deviceSessionManager.validateSessionToken,
    registerAndAssessDevice: deviceSessionManager.registerAndAssessDevice,
    updateSessionActivity: deviceSessionManager.updateSessionActivity,
    SessionUpdateContext: {} as any,
  }));

  // Mock token rotator module
  vi.mock('../../../src/middleware/auth/token-rotator', () => ({
    handleTokenRotation: tokenRotator.handleTokenRotation,
    TokenRotationContext: {} as any,
  }));

  // Mock auth middleware module
  vi.mock('../../../src/middleware/auth', () => ({
    authenticate: authMiddleware.authenticate,
    authenticateOptional: authMiddleware.authenticateOptional,
    authorize: authMiddleware.authorize,
    requireAdmin: authMiddleware.requireAdmin,
    checkAuthStatus: authMiddleware.checkAuthStatus,
  }));

  // Mock CSRF middleware
  vi.mock('../../../src/middleware/csrf', () => ({
    csrfProtection: csrfMiddleware.csrfProtection,
    generateToken: csrfMiddleware.generateToken,
  }));

  return {
    tokenValidator,
    userValidator,
    deviceSessionManager,
    tokenRotator,
    authMiddleware,
    csrfMiddleware,
  };
};

// Test request helpers
export const createMockRequest = (overrides?: Partial<Request>): Partial<Request> => ({
  headers: {
    authorization: 'Bearer valid-token-user123',
    'user-agent': 'Test-Agent/1.0',
    'x-forwarded-for': '127.0.0.1',
    ...overrides?.headers,
  },
  cookies: {
    token: 'valid-token-user123',
    ...overrides?.cookies,
  },
  ip: '127.0.0.1',
  method: 'GET',
  path: '/test',
  query: {},
  params: {},
  body: {},
  ...overrides,
});

export const createMockResponse = (): Partial<Response> => {
  const res: any = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
    cookie: vi.fn().mockReturnThis(),
    clearCookie: vi.fn().mockReturnThis(),
    setHeader: vi.fn().mockReturnThis(),
    getHeader: vi.fn(),
    locals: {},
  };
  return res;
};

export const createMockNext = (): NextFunction => {
  return vi.fn();
};

// Middleware test scenarios
export const createMiddlewareTestScenarios = () => ({
  validAuth: {
    request: createMockRequest({
      headers: { authorization: 'Bearer valid-token-user123' },
    }),
    expectedUser: createMockAuthenticatedUser(),
    shouldPass: true,
  },

  adminAuth: {
    request: createMockRequest({
      headers: { authorization: 'Bearer admin-token-admin456' },
    }),
    expectedUser: createMockAuthenticatedUser({ role: 'admin' }),
    shouldPass: true,
  },

  expiredToken: {
    request: createMockRequest({
      headers: { authorization: 'Bearer expired-token-user123' },
    }),
    expectedError: 'Authentication required',
    shouldPass: false,
  },

  invalidToken: {
    request: createMockRequest({
      headers: { authorization: 'Bearer invalid-malformed-token' },
    }),
    expectedError: 'Authentication required',
    shouldPass: false,
  },

  missingAuth: {
    request: createMockRequest({
      headers: {},
      cookies: {},
    }),
    expectedError: 'Authentication required',
    shouldPass: false,
  },

  cookieAuth: {
    request: createMockRequest({
      headers: {},
      cookies: { token: 'valid-token-user123' },
    }),
    expectedUser: createMockAuthenticatedUser(),
    shouldPass: true,
  },
});

// Reset all middleware mocks
export const resetMiddlewareMocks = (mocks: ReturnType<typeof setupMiddlewareMocks>) => {
  Object.values(mocks).forEach((mockGroup) => {
    if (mockGroup && typeof mockGroup === 'object') {
      Object.values(mockGroup).forEach((method) => {
        if (method && typeof method.mockReset === 'function') {
          method.mockReset();
        }
      });
    }
  });
};
