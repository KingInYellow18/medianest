/**
 * COMPREHENSIVE JWT MOCKING INFRASTRUCTURE
 * 
 * Fixes JWT authentication test failures by providing robust JWT mocking.
 * Addresses token verification, signing, and error handling.
 */

import { vi } from 'vitest';
import { TEST_CONFIG } from '../test-infrastructure-config';

/**
 * JWT Error Classes for consistent error mocking
 */
export class TokenExpiredError extends Error {
  name = 'TokenExpiredError';
  expiredAt: Date;
  
  constructor(message: string, expiredAt: Date) {
    super(message);
    this.expiredAt = expiredAt;
  }
}

export class JsonWebTokenError extends Error {
  name = 'JsonWebTokenError';
  
  constructor(message: string) {
    super(message);
  }
}

export class NotBeforeError extends Error {
  name = 'NotBeforeError';
  date: Date;
  
  constructor(message: string, date: Date) {
    super(message);
    this.date = date;
  }
}

/**
 * JWT Mock Configuration
 */
export interface JWTMockConfig {
  secret?: string;
  issuer?: string;
  audience?: string;
  defaultExpiry?: number;
}

/**
 * JWT Mock State for controlling mock behavior
 */
class JWTMockState {
  private blacklistedTokens = new Set<string>();
  private mockPayloads = new Map<string, any>();
  private shouldFailVerification = false;
  private shouldExpire = false;
  
  blacklistToken(tokenId: string): void {
    this.blacklistedTokens.add(tokenId);
  }
  
  isBlacklisted(tokenId: string): boolean {
    return this.blacklistedTokens.has(tokenId);
  }
  
  setMockPayload(token: string, payload: any): void {
    this.mockPayloads.set(token, payload);
  }
  
  getMockPayload(token: string): any {
    return this.mockPayloads.get(token);
  }
  
  setShouldFailVerification(fail: boolean): void {
    this.shouldFailVerification = fail;
  }
  
  getShouldFailVerification(): boolean {
    return this.shouldFailVerification;
  }
  
  setShouldExpire(expire: boolean): void {
    this.shouldExpire = expire;
  }
  
  getShouldExpire(): boolean {
    return this.shouldExpire;
  }
  
  reset(): void {
    this.blacklistedTokens.clear();
    this.mockPayloads.clear();
    this.shouldFailVerification = false;
    this.shouldExpire = false;
  }
}

/**
 * Global JWT mock state
 */
export const jwtMockState = new JWTMockState();

/**
 * Create default test payload
 */
export const createDefaultPayload = (overrides = {}) => ({
  userId: 'test-user-id',
  email: 'test@medianest.com',
  role: 'USER',
  plexId: 'test-plex-id',
  plexUsername: 'testuser',
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 900, // 15 minutes
  iss: TEST_CONFIG.JWT.ISSUER,
  aud: TEST_CONFIG.JWT.AUDIENCE,
  jti: 'test-jwt-id',
  sessionId: 'test-session-id',
  ...overrides,
});

/**
 * Create refresh token payload
 */
export const createRefreshPayload = (overrides = {}) => ({
  userId: 'test-user-id',
  sessionId: 'test-session-id',
  type: 'refresh',
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 604800, // 7 days
  iss: TEST_CONFIG.JWT.ISSUER,
  aud: TEST_CONFIG.JWT.AUDIENCE,
  jti: 'test-refresh-jwt-id',
  ...overrides,
});

/**
 * Setup JWT mocks - call this in test setup files
 */
export function setupJWTMocks(config: JWTMockConfig = {}) {
  // Mock config service first
  vi.mock('../../../backend/src/config/config.service', () => ({
    configService: {
      getAuthConfig: () => ({
        JWT_SECRET: TEST_CONFIG.JWT.SECRET,
        JWT_ISSUER: TEST_CONFIG.JWT.ISSUER,
        JWT_AUDIENCE: TEST_CONFIG.JWT.AUDIENCE,
        JWT_SECRET_ROTATION: undefined,
      }),
    },
  }));
  // Mock the sign function
  const mockSign = vi.fn().mockImplementation((payload, secret, options = {}) => {
    const mockPayload = {
      ...createDefaultPayload(),
      ...payload,
    };
    
    // Generate a deterministic token ID for testing
    const tokenId = `test-jwt-token-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    jwtMockState.setMockPayload(tokenId, mockPayload);
    
    return tokenId;
  });

  // Mock the verify function
  const mockVerify = vi.fn().mockImplementation((token, secret, options = {}) => {
    if (jwtMockState.getShouldFailVerification()) {
      throw new JsonWebTokenError('Invalid token signature');
    }
    
    if (jwtMockState.getShouldExpire()) {
      throw new TokenExpiredError('jwt expired', new Date());
    }
    
    // Check if token is blacklisted
    if (jwtMockState.isBlacklisted(token)) {
      throw new JsonWebTokenError('Token has been revoked');
    }
    
    // Return mock payload or default
    const mockPayload = jwtMockState.getMockPayload(token);
    if (mockPayload) {
      return mockPayload;
    }
    
    // Return default payload
    return createDefaultPayload();
  });

  // Mock the decode function (no verification)
  const mockDecode = vi.fn().mockImplementation((token, options = {}) => {
    try {
      // Return mock payload or default
      const mockPayload = jwtMockState.getMockPayload(token);
      if (mockPayload) {
        return mockPayload;
      }
      
      return createDefaultPayload();
    } catch (error) {
      return null;
    }
  });

  // Setup the jsonwebtoken mock
  vi.mock('jsonwebtoken', async () => {
    const actual = await vi.importActual('jsonwebtoken');
    return {
      ...actual,
      default: {
        sign: mockSign,
        verify: mockVerify,
        decode: mockDecode,
        TokenExpiredError,
        JsonWebTokenError,
        NotBeforeError,
      },
      sign: mockSign,
      verify: mockVerify,
      decode: mockDecode,
      TokenExpiredError,
      JsonWebTokenError,
      NotBeforeError,
    };
  });

  return {
    mockSign,
    mockVerify,
    mockDecode,
    jwtMockState,
    resetMocks: () => {
      vi.clearAllMocks();
      jwtMockState.reset();
      
      // Reset to default behavior
      mockSign.mockImplementation((payload, secret, options = {}) => {
        const mockPayload = {
          ...createDefaultPayload(),
          ...payload,
        };
        const tokenId = `test-jwt-token-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        jwtMockState.setMockPayload(tokenId, mockPayload);
        return tokenId;
      });
      
      mockVerify.mockImplementation((token) => {
        const mockPayload = jwtMockState.getMockPayload(token) || createDefaultPayload();
        return mockPayload;
      });
      
      mockDecode.mockImplementation((token) => {
        const mockPayload = jwtMockState.getMockPayload(token) || createDefaultPayload();
        return mockPayload;
      });
    },
  };
}

/**
 * JWT Test Helpers
 */
export const jwtTestHelpers = {
  // Create a valid test token
  createValidToken: (payload = {}) => {
    const token = `test-valid-token-${Date.now()}`;
    jwtMockState.setMockPayload(token, createDefaultPayload(payload));
    return token;
  },

  // Create an expired token
  createExpiredToken: () => {
    const token = `test-expired-token-${Date.now()}`;
    jwtMockState.setMockPayload(token, createDefaultPayload({
      exp: Math.floor(Date.now() / 1000) - 3600, // Expired 1 hour ago
    }));
    return token;
  },

  // Create a refresh token
  createRefreshToken: (payload = {}) => {
    const token = `test-refresh-token-${Date.now()}`;
    jwtMockState.setMockPayload(token, createRefreshPayload(payload));
    return token;
  },

  // Mock token verification failure
  mockVerificationFailure: () => {
    jwtMockState.setShouldFailVerification(true);
  },

  // Mock token expiration
  mockTokenExpired: () => {
    jwtMockState.setShouldExpire(true);
  },

  // Blacklist a token
  blacklistToken: (token: string) => {
    jwtMockState.blacklistToken(token);
  },

  // Check if token is blacklisted
  isTokenBlacklisted: (token: string) => {
    return jwtMockState.isBlacklisted(token);
  },

  // Create admin token
  createAdminToken: () => {
    const token = `test-admin-token-${Date.now()}`;
    jwtMockState.setMockPayload(token, createDefaultPayload({
      role: 'ADMIN',
      email: 'admin@medianest.com',
      userId: 'admin-user-id',
    }));
    return token;
  },

  // Create guest token
  createGuestToken: () => {
    const token = `test-guest-token-${Date.now()}`;
    jwtMockState.setMockPayload(token, createDefaultPayload({
      role: 'GUEST',
      email: 'guest@medianest.com',
      userId: 'guest-user-id',
    }));
    return token;
  },

  // Reset all mock state
  reset: () => {
    jwtMockState.reset();
  },
};

/**
 * Assertion helpers for JWT tests
 */
export const jwtAssertionHelpers = {
  expectValidJWT: (token: string) => {
    expect(token).toBeDefined();
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(0);
  },

  expectJWTPayload: (payload: any, expectedFields: string[]) => {
    expect(payload).toBeDefined();
    expect(typeof payload).toBe('object');
    
    expectedFields.forEach(field => {
      expect(payload).toHaveProperty(field);
    });
  },

  expectJWTError: (error: any, errorType: string) => {
    expect(error).toBeDefined();
    expect(error.name).toBe(errorType);
  },
};