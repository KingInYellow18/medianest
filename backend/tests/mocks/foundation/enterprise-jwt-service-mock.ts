/**
 * ENTERPRISE JWT SERVICE MOCK - Phase G Critical Repair
 *
 * Fixes JWT authentication system breakdown by providing comprehensive
 * mocking infrastructure with proper Vitest patterns and export structure.
 *
 * CRITICAL FIXES:
 * - Adds missing generateRefreshToken and shouldRotateToken exports
 * - Proper vi.mock factory functions for class instantiation
 * - Complete method coverage for JwtService interface
 * - Enterprise-grade mock coordination with Phase G registry
 */

import { vi } from 'vitest';

export interface JwtPayload {
  userId: string;
  email: string;
  role: string;
  plexId?: string;
  sessionId?: string;
  deviceId?: string;
  ipAddress?: string;
  userAgent?: string;
  tokenVersion?: number;
  iat?: number;
  exp?: number;
  jti?: string;
}

/**
 * Enterprise JWT Service Mock Implementation
 * Matches the exact interface of backend/src/services/jwt.service.ts
 */
export const createEnterpriseJwtServiceMock = () => {
  const mock = {
    generateAccessToken: vi.fn().mockImplementation((payload: JwtPayload) => {
      if (!payload.userId || !payload.email || !payload.role) {
        throw new Error('JWT payload must include userId, email, and role');
      }
      return `enterprise-access-token-${payload.userId}-${Date.now()}`;
    }),

    generateRememberToken: vi.fn().mockImplementation((payload: JwtPayload) => {
      if (!payload.userId || !payload.email || !payload.role) {
        throw new Error('JWT payload must include userId, email, and role');
      }
      return `enterprise-remember-token-${payload.userId}-${Date.now()}`;
    }),

    verifyToken: vi.fn().mockImplementation((token: string): JwtPayload => {
      if (!token) {
        throw new Error('Token is required');
      }

      if (token.includes('invalid')) {
        throw new Error('Invalid token');
      }

      if (token.includes('expired')) {
        const error = new Error('jwt expired');
        (error as any).name = 'TokenExpiredError';
        throw error;
      }

      // Extract user information from token
      const userIdMatch = token.match(/(?:access|remember|refresh)-token-([^-]+)-/);
      const userId = userIdMatch ? userIdMatch[1] : 'enterprise-user-id';

      return {
        userId,
        email: `${userId}@enterprise.medianest.com`,
        role: 'user',
        plexId: `enterprise-plex-${userId}`,
        sessionId: `enterprise-session-${userId}`,
        deviceId: `enterprise-device-${userId}`,
        ipAddress: '10.0.0.1',
        userAgent: 'EnterpriseAgent/1.0',
        tokenVersion: 1,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 86400, // 24 hours
        jti: `enterprise-jti-${userId}-${Date.now()}`,
      };
    }),

    decodeToken: vi.fn().mockImplementation((token: string): JwtPayload | null => {
      try {
        if (!token) return null;

        const userIdMatch = token.match(/(?:access|remember|refresh)-token-([^-]+)-/);
        const userId = userIdMatch ? userIdMatch[1] : 'enterprise-user-id';

        return {
          userId,
          email: `${userId}@enterprise.medianest.com`,
          role: 'user',
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 86400,
        };
      } catch {
        return null;
      }
    }),

    refreshToken: vi.fn().mockImplementation((oldToken: string) => {
      const decoded = mock.decodeToken(oldToken);
      if (!decoded || !decoded.userId) {
        throw new Error('Invalid token for refresh');
      }
      return mock.generateAccessToken(decoded);
    }),

    isTokenExpired: vi.fn().mockImplementation((token: string): boolean => {
      if (!token || token.includes('expired')) return true;
      return false;
    }),

    getTokenExpirationTime: vi.fn().mockImplementation((token: string): number | null => {
      if (!token) return null;
      if (token.includes('no-exp')) return null;
      return Math.floor(Date.now() / 1000) + 86400; // 24 hours from now
    }),

    // CRITICAL MISSING METHODS - Emergency Export Repair
    generateRefreshToken: vi
      .fn()
      .mockImplementation((payload?: { userId: string; sessionId?: string }) => {
        if (!payload?.userId) {
          throw new Error('userId is required for refresh token generation');
        }
        return `enterprise-refresh-token-${payload.userId}-${Date.now()}`;
      }),

    shouldRotateToken: vi.fn().mockImplementation((token: string): boolean => {
      if (!token) return true;
      if (token.includes('old') || token.includes('expired')) return true;

      // Mock token rotation logic - rotate if token is "old"
      const decoded = mock.decodeToken(token);
      if (!decoded || !decoded.iat || !decoded.exp) return true;

      const now = Math.floor(Date.now() / 1000);
      const tokenAge = now - decoded.iat;
      const tokenLifetime = decoded.exp - decoded.iat;

      // Rotate if more than 75% through lifetime
      return tokenAge > tokenLifetime * 0.75;
    }),
  };

  // Add reset functionality
  (mock as any).reset = vi.fn().mockImplementation(() => {
    Object.values(mock).forEach((fn) => {
      if (typeof fn === 'function' && fn.mockReset) {
        fn.mockReset();
      }
    });
  });

  return mock;
};

/**
 * Global enterprise JWT service mock instance
 */
export const enterpriseJwtServiceMock = createEnterpriseJwtServiceMock();

/**
 * Enterprise JWT Service Mock Setup with Proper Vitest Patterns
 */
export function setupEnterpriseJwtServiceMocks() {
  // Use proper vi.mock with factory function for class mocking
  vi.mock('@/services/jwt.service', () => ({
    JwtService: vi.fn().mockImplementation(() => enterpriseJwtServiceMock),
    jwtService: enterpriseJwtServiceMock,
    default: enterpriseJwtServiceMock,
    // Export payload interface for type checking
    JwtPayload: {} as JwtPayload,
  }));

  return {
    enterpriseJwtServiceMock,
    resetMocks: () => {
      (enterpriseJwtServiceMock as any).reset();
      vi.clearAllMocks();
    },
    // Helper for creating test payloads
    createTestPayload: (overrides: Partial<JwtPayload> = {}): JwtPayload => ({
      userId: 'enterprise-test-user',
      email: 'test@enterprise.medianest.com',
      role: 'user',
      plexId: 'enterprise-plex-test',
      sessionId: 'enterprise-session-test',
      deviceId: 'enterprise-device-test',
      ipAddress: '10.0.0.1',
      userAgent: 'EnterpriseTestAgent/1.0',
      tokenVersion: 1,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 86400,
      jti: `enterprise-test-jti-${Date.now()}`,
      ...overrides,
    }),
  };
}

/**
 * Enterprise JWT Test Helpers
 */
export const enterpriseJwtHelpers = {
  mockSuccessfulTokenGeneration: (userId: string = 'enterprise-user') => {
    enterpriseJwtServiceMock.generateAccessToken.mockReturnValue(`enterprise-access-${userId}`);
    enterpriseJwtServiceMock.generateRememberToken.mockReturnValue(`enterprise-remember-${userId}`);
    enterpriseJwtServiceMock.generateRefreshToken.mockReturnValue(`enterprise-refresh-${userId}`);
  },

  mockTokenVerificationSuccess: (payload: JwtPayload) => {
    enterpriseJwtServiceMock.verifyToken.mockReturnValue(payload);
  },

  mockTokenVerificationFailure: (
    error: Error = new Error('Enterprise token verification failed'),
  ) => {
    enterpriseJwtServiceMock.verifyToken.mockImplementation(() => {
      throw error;
    });
  },

  mockTokenRotation: (shouldRotate: boolean = false) => {
    enterpriseJwtServiceMock.shouldRotateToken.mockReturnValue(shouldRotate);
  },

  mockExpiredToken: () => {
    const error = new Error('jwt expired');
    (error as any).name = 'TokenExpiredError';
    enterpriseJwtServiceMock.verifyToken.mockImplementation(() => {
      throw error;
    });
    enterpriseJwtServiceMock.isTokenExpired.mockReturnValue(true);
  },

  createAdminPayload: (overrides: Partial<JwtPayload> = {}): JwtPayload => ({
    userId: 'enterprise-admin-user',
    email: 'admin@enterprise.medianest.com',
    role: 'admin',
    plexId: 'enterprise-admin-plex',
    sessionId: 'enterprise-admin-session',
    deviceId: 'enterprise-admin-device',
    ipAddress: '10.0.0.1',
    userAgent: 'EnterpriseAdminAgent/1.0',
    tokenVersion: 1,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 86400,
    jti: `enterprise-admin-jti-${Date.now()}`,
    ...overrides,
  }),

  reset: () => {
    (enterpriseJwtServiceMock as any).reset();
  },
};

// Type exports for enhanced TypeScript support
export type { JwtPayload };
