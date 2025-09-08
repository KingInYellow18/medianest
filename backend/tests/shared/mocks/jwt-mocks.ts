/**
 * JWT Mock Implementation - Phase 2 Mock Fixes
 * Fixes issues with JWT utilities returning void instead of proper objects
 */

import { vi } from 'vitest';
import { JWTPayload, JWTOptions, TokenRotationInfo } from '../../../src/utils/jwt';

// Mock JWT payload generator
export const createMockJWTPayload = (overrides?: Partial<JWTPayload>): JWTPayload => ({
  userId: 'mock-user-123',
  email: 'test@example.com',
  role: 'user',
  plexId: 'mock-plex-456',
  sessionId: 'mock-session-789',
  deviceId: 'mock-device-abc',
  ipAddress: '127.0.0.1',
  userAgent: 'mock-user-agent',
  tokenVersion: 1,
  iat: Math.floor(Date.now() / 1000),
  jti: 'mock-jwt-id-' + Date.now().toString(16),
  ...overrides,
});

// Mock token rotation info generator
export const createMockTokenRotationInfo = (
  overrides?: Partial<TokenRotationInfo>
): TokenRotationInfo => ({
  newToken: 'mock-new-token-' + Date.now().toString(16),
  refreshToken: 'mock-refresh-token-' + Date.now().toString(16),
  expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes from now
  ...overrides,
});

// Mock token metadata
export const createMockTokenMetadata = (overrides?: any) => ({
  userId: 'mock-user-123',
  sessionId: 'mock-session-789',
  deviceId: 'mock-device-abc',
  issuedAt: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago
  expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes from now
  tokenId: 'mock-token-id-' + Date.now().toString(16),
  ...overrides,
});

// Comprehensive JWT utility mocks
export const createJWTMocks = () => {
  const generateTokenMock = vi
    .fn()
    .mockImplementation((payload: JWTPayload, rememberMe = false, options?: JWTOptions) => {
      const tokenPrefix = rememberMe ? 'remember-token' : 'access-token';
      const sessionId = options?.sessionId || payload.sessionId || 'default-session';
      return `${tokenPrefix}-${payload.userId}-${sessionId}-${Date.now().toString(16)}`;
    });

  const verifyTokenMock = vi.fn().mockImplementation((token: string, options?: any): JWTPayload => {
    if (token.includes('invalid') || token.includes('expired')) {
      const error = new Error(token.includes('expired') ? 'Token expired' : 'Invalid token');
      error.name = token.includes('expired') ? 'TokenExpiredError' : 'JsonWebTokenError';
      throw error;
    }

    const basePayload = createMockJWTPayload();

    // Extract userId from token pattern if available
    const userIdMatch = token.match(/token-([^-]+)/);
    if (userIdMatch) {
      basePayload.userId = userIdMatch[1];
    }

    // Merge with any provided context
    if (options?.ipAddress) {
      basePayload.ipAddress = options.ipAddress;
    }
    if (options?.userAgent) {
      basePayload.userAgent = options.userAgent;
    }

    return basePayload;
  });

  const generateRefreshTokenMock = vi
    .fn()
    .mockImplementation((payload?: { userId: string; sessionId: string }): string => {
      if (payload) {
        return `refresh-token-${payload.userId}-${payload.sessionId}-${Date.now().toString(16)}`;
      }
      return `random-refresh-token-${Date.now().toString(16)}`;
    });

  const verifyRefreshTokenMock = vi
    .fn()
    .mockImplementation((refreshToken: string): { userId: string; sessionId: string } => {
      if (refreshToken.includes('invalid') || refreshToken.includes('expired')) {
        const error = new Error(
          refreshToken.includes('expired') ? 'Refresh token expired' : 'Invalid refresh token'
        );
        error.name = refreshToken.includes('expired') ? 'TokenExpiredError' : 'JsonWebTokenError';
        throw error;
      }

      // Extract userId and sessionId from token pattern
      const match = refreshToken.match(/refresh-token-([^-]+)-([^-]+)/);
      if (match) {
        return {
          userId: match[1],
          sessionId: match[2],
        };
      }

      return {
        userId: 'mock-user-123',
        sessionId: 'mock-session-789',
      };
    });

  const getTokenMetadataMock = vi.fn().mockImplementation((token: string) => {
    const metadata = createMockTokenMetadata();

    // Extract userId from token pattern if available
    const userIdMatch = token.match(/token-([^-]+)/);
    if (userIdMatch) {
      metadata.userId = userIdMatch[1];
    }

    return metadata;
  });

  const shouldRotateTokenMock = vi.fn().mockImplementation((token: string): boolean => {
    // Return true for tokens that contain 'rotate' or are near expiry
    return token.includes('rotate') || token.includes('near-expiry');
  });

  const rotateTokenIfNeededMock = vi
    .fn()
    .mockImplementation(
      (token: string, payload: JWTPayload, options?: JWTOptions): TokenRotationInfo | null => {
        if (!shouldRotateTokenMock(token)) {
          return null;
        }

        return createMockTokenRotationInfo({
          newToken: generateTokenMock(payload, false, options),
          refreshToken: generateRefreshTokenMock({
            userId: payload.userId,
            sessionId: payload.sessionId || 'rotated-session',
          }),
        });
      }
    );

  const isTokenBlacklistedMock = vi.fn().mockImplementation((tokenId: string): boolean => {
    return tokenId.includes('blacklisted');
  });

  const blacklistTokenMock = vi.fn().mockImplementation((tokenId: string): void => {
    // Mock implementation - in real code this would add to blacklist
    console.log(`[MOCK] Token ${tokenId} blacklisted`);
  });

  const decodeTokenMock = vi.fn().mockImplementation((token: string): JWTPayload | null => {
    if (token.includes('invalid-format')) {
      return null;
    }

    return createMockJWTPayload();
  });

  const getTokenExpiryMock = vi.fn().mockImplementation((token: string): Date | null => {
    if (token.includes('no-expiry')) {
      return null;
    }

    return new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now
  });

  const getTokenIssuedAtMock = vi.fn().mockImplementation((token: string): Date | null => {
    if (token.includes('no-issued-at')) {
      return null;
    }

    return new Date(Date.now() - 5 * 60 * 1000); // 5 minutes ago
  });

  const isTokenExpiredMock = vi.fn().mockImplementation((token: string): boolean => {
    return token.includes('expired');
  });

  return {
    generateToken: generateTokenMock,
    verifyToken: verifyTokenMock,
    generateRefreshToken: generateRefreshTokenMock,
    verifyRefreshToken: verifyRefreshTokenMock,
    getTokenMetadata: getTokenMetadataMock,
    shouldRotateToken: shouldRotateTokenMock,
    rotateTokenIfNeeded: rotateTokenIfNeededMock,
    isTokenBlacklisted: isTokenBlacklistedMock,
    blacklistToken: blacklistTokenMock,
    decodeToken: decodeTokenMock,
    getTokenExpiry: getTokenExpiryMock,
    getTokenIssuedAt: getTokenIssuedAtMock,
    isTokenExpired: isTokenExpiredMock,
  };
};

// Setup JWT mocks for testing
export const setupJWTMocks = () => {
  const mocks = createJWTMocks();

  vi.mock('../../../src/utils/jwt', () => ({
    generateToken: mocks.generateToken,
    verifyToken: mocks.verifyToken,
    generateRefreshToken: mocks.generateRefreshToken,
    verifyRefreshToken: mocks.verifyRefreshToken,
    getTokenMetadata: mocks.getTokenMetadata,
    shouldRotateToken: mocks.shouldRotateToken,
    rotateTokenIfNeeded: mocks.rotateTokenIfNeeded,
    isTokenBlacklisted: mocks.isTokenBlacklisted,
    blacklistToken: mocks.blacklistToken,
    decodeToken: mocks.decodeToken,
    getTokenExpiry: mocks.getTokenExpiry,
    getTokenIssuedAt: mocks.getTokenIssuedAt,
    isTokenExpired: mocks.isTokenExpired,
    // Export types and interfaces for proper typing
    JWTPayload: {} as any,
    JWTOptions: {} as any,
    TokenRotationInfo: {} as any,
  }));

  return mocks;
};

// Reset all JWT mocks
export const resetJWTMocks = (mocks: ReturnType<typeof createJWTMocks>) => {
  Object.values(mocks).forEach((mock) => {
    if (mock && typeof mock.mockReset === 'function') {
      mock.mockReset();
    }
  });
};

// Helper for creating specific JWT test scenarios
export const createJWTTestScenarios = () => ({
  validToken: 'valid-access-token-user123-session456',
  expiredToken: 'expired-access-token-user123-session456',
  invalidToken: 'invalid-malformed-token',
  rotationNeededToken: 'rotate-access-token-user123-session456',
  blacklistedToken: 'access-token-blacklisted-user123',
  validRefreshToken: 'refresh-token-user123-session456',
  expiredRefreshToken: 'expired-refresh-token-user123-session456',
  invalidRefreshToken: 'invalid-refresh-token',
});

// Mock configuration service for JWT tests
export const createMockConfigService = () => ({
  getAuthConfig: vi.fn().mockReturnValue({
    JWT_SECRET: 'test-jwt-secret-for-mocking',
    JWT_SECRET_ROTATION: 'test-jwt-rotation-secret',
    JWT_ISSUER: 'medianest-test',
    JWT_AUDIENCE: 'medianest-app-test',
  }),
  getDatabaseConfig: vi.fn(),
  getRedisConfig: vi.fn(),
  getPlexConfig: vi.fn(),
  getYouTubeConfig: vi.fn(),
  getOverseerrConfig: vi.fn(),
  getWebhookConfig: vi.fn(),
  getServerConfig: vi.fn(),
});
