/**
 * CRITICAL JWT FACADE MOCK IMPLEMENTATION
 *
 * Complete mock implementation matching jwt-facade.ts interface
 * Fixes authentication system test failures by providing all required exports
 *
 * Based on DeviceSessionService template success pattern (100% compatibility)
 */

import { vi } from 'vitest';

// =============================================================================
// JWT FACADE COMPLETE MOCK WITH ALL EXPORTS
// =============================================================================

export const createJWTFacadeMock = () => {
  const mockJWTFacade = {
    // Core token operations
    generateToken: vi.fn().mockReturnValue('mock-jwt-token'),
    verifyToken: vi.fn().mockReturnValue({
      userId: 'mock-user-id',
      email: 'mock@example.com',
      role: 'user',
      sessionId: 'mock-session-id',
      deviceId: 'mock-device-id',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
      jti: 'mock-token-id',
    }),
    decodeToken: vi.fn().mockReturnValue({
      userId: 'mock-user-id',
      email: 'mock@example.com',
      role: 'user',
      sessionId: 'mock-session-id',
      deviceId: 'mock-device-id',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
      jti: 'mock-token-id',
    }),

    // CRITICAL MISSING EXPORTS - Authentication facade requirements
    generateRefreshToken: vi.fn().mockReturnValue('mock-refresh-token'),
    verifyRefreshToken: vi.fn().mockReturnValue({
      userId: 'mock-user-id',
      sessionId: 'mock-session-id',
    }),

    // Token metadata and lifecycle
    getTokenMetadata: vi.fn().mockReturnValue({
      userId: 'mock-user-id',
      sessionId: 'mock-session-id',
      deviceId: 'mock-device-id',
      issuedAt: new Date(Date.now() - 60000), // 1 minute ago
      expiresAt: new Date(Date.now() + 3600000), // 1 hour from now
      tokenId: 'mock-token-id',
    }),
    isTokenExpired: vi.fn().mockReturnValue(false),
    shouldRotateToken: vi.fn().mockReturnValue(false),
    rotateTokenIfNeeded: vi.fn().mockReturnValue(null),

    // Token blacklist operations
    blacklistToken: vi.fn().mockImplementation(() => undefined),
    isTokenBlacklisted: vi.fn().mockReturnValue(false),

    // Legacy compatibility exports
    getTokenExpiry: vi.fn().mockReturnValue(new Date(Date.now() + 3600000)),
    getTokenIssuedAt: vi.fn().mockReturnValue(new Date(Date.now() - 60000)),

    // Additional compatibility methods
    refreshToken: vi.fn().mockReturnValue('mock-refreshed-token'),
    validateTokenStructure: vi.fn().mockReturnValue(true),
    getTokenPayload: vi.fn().mockReturnValue({
      userId: 'mock-user-id',
      email: 'mock@example.com',
      role: 'user',
      sessionId: 'mock-session-id',
    }),
    revokeToken: vi.fn().mockResolvedValue(true),
    validateRefreshToken: vi.fn().mockReturnValue(true),
  };

  return mockJWTFacade;
};

// =============================================================================
// JWT FACADE SINGLETON MOCK INSTANCE
// =============================================================================

export const mockJWTFacadeInstance = createJWTFacadeMock();

// =============================================================================
// JWT FACADE CLASS MOCK
// =============================================================================

export const JWTFacadeMock = vi.fn().mockImplementation(() => mockJWTFacadeInstance);

// =============================================================================
// DIRECT FUNCTION EXPORTS (Legacy Compatibility)
// =============================================================================

export const generateToken = vi.fn().mockReturnValue('mock-jwt-token');
export const verifyToken = vi.fn().mockReturnValue({
  userId: 'mock-user-id',
  email: 'mock@example.com',
  role: 'user',
  sessionId: 'mock-session-id',
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 3600,
});

// CRITICAL EXPORTS - Fix authentication cascade failures
export const generateRefreshToken = vi.fn().mockReturnValue('mock-refresh-token');
export const verifyRefreshToken = vi.fn().mockReturnValue({
  userId: 'mock-user-id',
  sessionId: 'mock-session-id',
});

export const getTokenMetadata = vi.fn().mockReturnValue({
  userId: 'mock-user-id',
  sessionId: 'mock-session-id',
  deviceId: 'mock-device-id',
  issuedAt: new Date(Date.now() - 60000),
  expiresAt: new Date(Date.now() + 3600000),
  tokenId: 'mock-token-id',
});

export const isTokenExpired = vi.fn().mockReturnValue(false);
export const shouldRotateToken = vi.fn().mockReturnValue(false);
export const rotateTokenIfNeeded = vi.fn().mockReturnValue(null);
export const blacklistToken = vi.fn().mockImplementation(() => undefined);
export const isTokenBlacklisted = vi.fn().mockReturnValue(false);
export const decodeToken = vi.fn().mockReturnValue({
  userId: 'mock-user-id',
  email: 'mock@example.com',
  role: 'user',
  sessionId: 'mock-session-id',
});

// Legacy exports
export const getTokenExpiry = vi.fn().mockReturnValue(new Date(Date.now() + 3600000));
export const getTokenIssuedAt = vi.fn().mockReturnValue(new Date(Date.now() - 60000));

// =============================================================================
// RESET AND CLEANUP UTILITIES
// =============================================================================

export const resetJWTFacadeMock = () => {
  Object.values(mockJWTFacadeInstance).forEach((mockFn: any) => {
    if (typeof mockFn?.mockReset === 'function') {
      mockFn.mockReset();
    }
  });

  // Restore default implementations
  mockJWTFacadeInstance.generateToken.mockReturnValue('mock-jwt-token');
  mockJWTFacadeInstance.generateRefreshToken.mockReturnValue('mock-refresh-token');
  mockJWTFacadeInstance.verifyToken.mockReturnValue({
    userId: 'mock-user-id',
    email: 'mock@example.com',
    role: 'user',
    sessionId: 'mock-session-id',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
  });
  mockJWTFacadeInstance.shouldRotateToken.mockReturnValue(false);
  mockJWTFacadeInstance.isTokenExpired.mockReturnValue(false);
  mockJWTFacadeInstance.isTokenBlacklisted.mockReturnValue(false);
};

// =============================================================================
// ENHANCED MOCK PATTERNS FOR ENTERPRISE COMPATIBILITY
// =============================================================================

/**
 * USAGE PATTERNS FOR FIXING JWT FACADE IMPORT FAILURES:
 *
 * 1. COMPLETE JWT FACADE MOCK:
 * ```typescript
 * import { mockJWTFacadeInstance } from '@/tests/mocks/services/jwt-facade-mock';
 *
 * vi.mock('@/auth/jwt-facade', () => ({
 *   jwtFacade: mockJWTFacadeInstance,
 *   JWTFacade: JWTFacadeMock,
 *   generateRefreshToken: vi.fn().mockReturnValue('mock-refresh-token'),
 *   shouldRotateToken: vi.fn().mockReturnValue(false),
 * }));
 * ```
 *
 * 2. DIRECT FUNCTION IMPORTS:
 * ```typescript
 * vi.mock('@/auth/jwt-facade', () => ({
 *   generateRefreshToken: vi.fn().mockReturnValue('mock-refresh-token'),
 *   shouldRotateToken: vi.fn().mockReturnValue(false),
 *   verifyRefreshToken: vi.fn().mockReturnValue({
 *     userId: 'mock-user-id',
 *     sessionId: 'mock-session-id',
 *   }),
 * }));
 * ```
 *
 * 3. SINGLETON INSTANCE MOCK:
 * ```typescript
 * vi.mock('@/auth/jwt-facade', () => ({
 *   jwtFacade: mockJWTFacadeInstance
 * }));
 * ```
 */
