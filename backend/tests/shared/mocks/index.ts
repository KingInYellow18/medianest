/**
 * Comprehensive Mock Index - Phase 2 Mock Fixes
 * Central export point for all mock implementations
 */

// JWT Mock exports
export {
  createMockJWTPayload,
  createMockTokenRotationInfo,
  createMockTokenMetadata,
  createJWTMocks,
  setupJWTMocks,
  resetJWTMocks,
  createJWTTestScenarios,
  createMockConfigService as createMockConfigServiceFromJWT,
} from './jwt-mocks';

// Authentication Facade Mock exports
export {
  createMockAuthenticatedUser,
  createMockAuthResult,
  createMockUserRepository,
  createMockSessionTokenRepository,
  createMockDeviceSessionService,
  createMockAuthenticationFacade,
  createMockAuthenticationFacadeFactory,
  setupAuthFacadeMocks,
  createAuthTestScenarios,
  resetAuthFacadeMocks,
} from './auth-facade-mocks';

// Configuration Service Mock exports
export {
  createMockConfigs,
  createMockConfigService,
  setupConfigServiceMocks,
  createTestEnvironmentConfig,
  createConfigTestScenarios,
  resetConfigServiceMocks,
  createConfigValidationMocks,
} from './config-service-mocks';

// Middleware Mock exports
export {
  createMockTokenValidationContext,
  createMockTokenValidationResult,
  createMockTokenValidator,
  createMockUserValidator,
  createMockDeviceSessionManager,
  createMockTokenRotator,
  createMockAuthMiddleware,
  createMockCSRFMiddleware,
  setupMiddlewareMocks,
  createMockRequest,
  createMockResponse,
  createMockNext,
  createMiddlewareTestScenarios,
  resetMiddlewareMocks,
} from './middleware-mocks';

// Combined setup functions for comprehensive mocking
export const setupAllAuthMocks = () => {
  const jwtMocks = setupJWTMocks();
  const configMocks = setupConfigServiceMocks();
  const authFacadeMocks = setupAuthFacadeMocks();
  const middlewareMocks = setupMiddlewareMocks();

  return {
    jwt: jwtMocks,
    config: configMocks,
    authFacade: authFacadeMocks,
    middleware: middlewareMocks,
  };
};

// Reset all authentication-related mocks
export const resetAllAuthMocks = (mocks: ReturnType<typeof setupAllAuthMocks>) => {
  resetJWTMocks(mocks.jwt);
  resetConfigServiceMocks(mocks.config);
  resetAuthFacadeMocks(mocks.authFacade);
  resetMiddlewareMocks(mocks.middleware);
};

// Test scenario combinations
export const createComprehensiveTestScenarios = () => {
  const jwtScenarios = createJWTTestScenarios();
  const authScenarios = createAuthTestScenarios();
  const middlewareScenarios = createMiddlewareTestScenarios();
  const configScenarios = createConfigTestScenarios();

  return {
    // Authentication flow scenarios
    successfulLogin: {
      config: configScenarios.validConfig,
      jwt: jwtScenarios.validToken,
      auth: authScenarios.validAuth,
      middleware: middlewareScenarios.validAuth,
    },

    adminLogin: {
      config: configScenarios.validConfig,
      jwt: jwtScenarios.validToken,
      auth: authScenarios.adminAuth,
      middleware: middlewareScenarios.adminAuth,
    },

    expiredToken: {
      config: configScenarios.validConfig,
      jwt: jwtScenarios.expiredToken,
      auth: authScenarios.expiredAuth,
      middleware: middlewareScenarios.expiredToken,
    },

    invalidToken: {
      config: configScenarios.validConfig,
      jwt: jwtScenarios.invalidToken,
      auth: authScenarios.invalidAuth,
      middleware: middlewareScenarios.invalidToken,
    },

    missingConfiguration: {
      config: configScenarios.missingJWTSecret,
      expectedError: 'JWT_SECRET is required',
    },

    tokenRotation: {
      config: configScenarios.validConfig,
      jwt: jwtScenarios.rotationNeededToken,
      expectedAction: 'token_rotation',
    },

    unauthorizedAccess: {
      config: configScenarios.validConfig,
      auth: authScenarios.unauthorizedAction,
      expectedStatus: 403,
    },
  };
};

// Helper to create mock Express app with all mocks
export const createMockExpressApp = () => {
  const mockApp = {
    use: vi.fn(),
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    patch: vi.fn(),
    listen: vi.fn(),
    set: vi.fn(),
    enable: vi.fn(),
    disable: vi.fn(),
  };

  return mockApp;
};

// Mock database transaction helper
export const createMockTransaction = () => {
  const mockTx = {
    user: createMockUserRepository(),
    sessionToken: createMockSessionTokenRepository(),
    commit: vi.fn().mockResolvedValue(undefined),
    rollback: vi.fn().mockResolvedValue(undefined),
  };

  return mockTx;
};

// Performance monitoring mocks
export const createMockPerformanceMetrics = () => ({
  startTimer: vi.fn().mockReturnValue({
    stop: vi.fn().mockReturnValue(123.45),
  }),
  recordHistogram: vi.fn(),
  incrementCounter: vi.fn(),
  setGauge: vi.fn(),
  recordDuration: vi.fn(),
});

// Security event logging mocks
export const createMockSecurityLogger = () => ({
  logSecurityEvent: vi.fn(),
  logAuthAttempt: vi.fn(),
  logTokenRotation: vi.fn(),
  logSuspiciousActivity: vi.fn(),
  logDataAccess: vi.fn(),
});

// Error handling mocks
export const createMockErrorHandlers = () => ({
  handleAuthError: vi.fn().mockImplementation((error: Error, req: any, res: any, next: any) => {
    res.status(401).json({
      success: false,
      error: {
        message: error.message,
        code: 'AUTHENTICATION_ERROR',
      },
    });
  }),

  handleValidationError: vi
    .fn()
    .mockImplementation((error: Error, req: any, res: any, next: any) => {
      res.status(400).json({
        success: false,
        error: {
          message: error.message,
          code: 'VALIDATION_ERROR',
        },
      });
    }),

  handleServerError: vi.fn().mockImplementation((error: Error, req: any, res: any, next: any) => {
    res.status(500).json({
      success: false,
      error: {
        message: 'Internal server error',
        code: 'INTERNAL_ERROR',
      },
    });
  }),
});

// Re-export vitest utilities for convenience
export { vi } from 'vitest';

// Type exports for better TypeScript support
export type { JWTPayload, JWTOptions, TokenRotationInfo } from '../../../src/utils/jwt';

export type { AuthenticatedUser } from '../../../src/middleware/auth/user-validator';

export type {
  TokenValidationContext,
  TokenValidationResult,
} from '../../../src/middleware/auth/token-validator';

// Test utilities
export const testUtils = {
  // Wait for async operations in tests
  waitFor: (condition: () => boolean | Promise<boolean>, timeout = 5000) => {
    return new Promise<void>((resolve, reject) => {
      const startTime = Date.now();

      const check = async () => {
        try {
          const result = await condition();
          if (result) {
            resolve();
          } else if (Date.now() - startTime > timeout) {
            reject(new Error('Condition not met within timeout'));
          } else {
            setTimeout(check, 100);
          }
        } catch (error) {
          if (Date.now() - startTime > timeout) {
            reject(error);
          } else {
            setTimeout(check, 100);
          }
        }
      };

      check();
    });
  },

  // Mock timer utilities
  mockTimers: {
    useFakeTimers: () => vi.useFakeTimers(),
    useRealTimers: () => vi.useRealTimers(),
    advanceTimersByTime: (ms: number) => vi.advanceTimersByTime(ms),
    runAllTimers: () => vi.runAllTimers(),
  },

  // Random data generators
  generators: {
    uuid: () =>
      'mock-uuid-' + Date.now().toString(16) + '-' + Math.random().toString(16).slice(2, 8),
    email: () => `test-${Date.now()}-${Math.random().toString(16).slice(2, 6)}@example.com`,
    token: () =>
      'mock-token-' + Date.now().toString(16) + '-' + Math.random().toString(16).slice(2, 10),
    timestamp: () => new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000),
  },
};
