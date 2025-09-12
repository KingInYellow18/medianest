import { describe, it, expect, beforeEach, vi } from 'vitest';
import jwt from 'jsonwebtoken';
import { JwtService, JwtPayload } from '../../../src/services/jwt.service';
import { config } from '../../../src/config';

// Mock dependencies
vi.mock('../../../src/config', () => ({
  config: {
    JWT_SECRET: 'test-jwt-secret-key-32-bytes-long-for-testing',
    JWT_ISSUER: 'medianest-test',
    JWT_AUDIENCE: 'medianest-test-users',
  },
}));

vi.mock('jsonwebtoken', () => {
  class TokenExpiredError extends Error {
    name = 'TokenExpiredError';
    expiredAt: Date;
    constructor(message: string, expiredAt: Date) {
      super(message);
      this.expiredAt = expiredAt;
    }
  }

  class JsonWebTokenError extends Error {
    name = 'JsonWebTokenError';
    constructor(message: string) {
      super(message);
    }
  }

  return {
    default: {
      sign: vi.fn(),
      verify: vi.fn(),
      decode: vi.fn(),
      TokenExpiredError,
      JsonWebTokenError,
    },
    sign: vi.fn(),
    verify: vi.fn(),
    decode: vi.fn(),
    TokenExpiredError,
    JsonWebTokenError,
  };
});

describe('JwtService', () => {
  let jwtService: JwtService;
  let mockPayload: JwtPayload;

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset the config to test values before creating service
    vi.mocked(config).JWT_SECRET = 'test-secret';
    vi.mocked(config).JWT_ISSUER = 'medianest';
    vi.mocked(config).JWT_AUDIENCE = 'medianest-users';

    jwtService = new JwtService();

    mockPayload = {
      userId: 'user-123',
      email: 'test@example.com',
      role: 'user',
      plexId: 'plex-123',
      sessionId: 'session-123',
      deviceId: 'device-123',
      ipAddress: '127.0.0.1',
      userAgent: 'Mozilla/5.0',
      tokenVersion: 1,
    };
  });

  describe('constructor', () => {
    it('should initialize with config values', () => {
      expect(() => new JwtService()).not.toThrow();
    });

    it('should throw error if JWT_SECRET is missing', () => {
      // Mock config without JWT secret
      vi.mocked(config).JWT_SECRET = undefined as any;

      expect(() => new JwtService()).toThrow('JWT_SECRET is required for authentication');
    });

    it('should use default values for optional config', () => {
      vi.mocked(config).JWT_SECRET = 'test-secret';
      vi.mocked(config).JWT_ISSUER = undefined as any;
      vi.mocked(config).JWT_AUDIENCE = undefined as any;

      expect(() => new JwtService()).not.toThrow();
    });
  });

  describe('generateAccessToken', () => {
    it('should generate access token successfully', () => {
      const mockToken = 'generated-access-token';
      vi.mocked(jwt.sign).mockReturnValue(mockToken as any);

      const token = jwtService.generateAccessToken(mockPayload);

      expect(jwt.sign).toHaveBeenCalledWith(
        mockPayload,
        'test-secret', // Updated to match mock config
        {
          expiresIn: '24h',
          issuer: 'medianest', // Updated to match mock config
          audience: 'medianest-users', // Updated to match mock config
        },
      );
      expect(token).toBe(mockToken);
    });

    it('should throw error for missing userId', () => {
      const invalidPayload = { ...mockPayload, userId: undefined as any };

      expect(() => jwtService.generateAccessToken(invalidPayload)).toThrow(
        'JWT payload must include userId, email, and role',
      );
    });

    it('should throw error for missing email', () => {
      const invalidPayload = { ...mockPayload, email: undefined as any };

      expect(() => jwtService.generateAccessToken(invalidPayload)).toThrow(
        'JWT payload must include userId, email, and role',
      );
    });

    it('should throw error for missing role', () => {
      const invalidPayload = { ...mockPayload, role: undefined as any };

      expect(() => jwtService.generateAccessToken(invalidPayload)).toThrow(
        'JWT payload must include userId, email, and role',
      );
    });

    it('should handle jwt.sign errors', () => {
      vi.mocked(jwt.sign).mockImplementation(() => {
        throw new Error('JWT signing failed');
      });

      expect(() => jwtService.generateAccessToken(mockPayload)).toThrow('JWT signing failed');
    });

    it('should accept minimal payload', () => {
      const minimalPayload: JwtPayload = {
        userId: 'user-123',
        email: 'test@example.com',
        role: 'user',
      };

      const mockToken = 'minimal-token';
      vi.mocked(jwt.sign).mockReturnValue(mockToken as any);

      const token = jwtService.generateAccessToken(minimalPayload);

      expect(jwt.sign).toHaveBeenCalledWith(
        minimalPayload,
        'test-secret', // Updated to match mock config
        {
          expiresIn: '24h',
          issuer: 'medianest', // Updated to match mock config
          audience: 'medianest-users', // Updated to match mock config
        },
      );
      expect(token).toBe(mockToken);
    });
  });

  describe('generateRememberToken', () => {
    it('should generate remember token successfully', () => {
      const mockToken = 'generated-remember-token';
      vi.mocked(jwt.sign).mockReturnValue(mockToken as any);

      const token = jwtService.generateRememberToken(mockPayload);

      expect(jwt.sign).toHaveBeenCalledWith(
        mockPayload,
        'test-secret', // Updated to match mock config
        {
          expiresIn: '90d',
          issuer: 'medianest', // Updated to match mock config
          audience: 'medianest-users', // Updated to match mock config
        },
      );
      expect(token).toBe(mockToken);
    });

    it('should throw error for missing required fields', () => {
      const invalidPayload = { ...mockPayload, userId: undefined as any };

      expect(() => jwtService.generateRememberToken(invalidPayload)).toThrow(
        'JWT payload must include userId, email, and role',
      );
    });

    it('should handle jwt.sign errors', () => {
      vi.mocked(jwt.sign).mockImplementation(() => {
        throw new Error('JWT signing failed');
      });

      expect(() => jwtService.generateRememberToken(mockPayload)).toThrow('JWT signing failed');
    });
  });

  describe('verifyToken', () => {
    it('should verify token successfully', () => {
      const mockToken = 'valid-token';
      const mockDecodedPayload = { ...mockPayload, iat: 1234567890, exp: 1234571490 };
      vi.mocked(jwt.verify).mockReturnValue(mockDecodedPayload as any);

      const result = jwtService.verifyToken(mockToken);

      expect(jwt.verify).toHaveBeenCalledWith(
        mockToken,
        'test-secret', // Updated to match mock config
        {
          issuer: 'medianest', // Updated to match mock config
          audience: 'medianest-users', // Updated to match mock config
        },
      );
      expect(result).toEqual(mockDecodedPayload);
    });

    it('should handle TokenExpiredError', () => {
      const mockToken = 'expired-token';
      const expiredError = new jwt.TokenExpiredError('Token expired', new Date());
      vi.mocked(jwt.verify).mockImplementation(() => {
        throw expiredError;
      });

      expect(() => jwtService.verifyToken(mockToken)).toThrow(expiredError);
    });

    it('should handle JsonWebTokenError', () => {
      const mockToken = 'invalid-token';
      const jwtError = new jwt.JsonWebTokenError('Invalid token');
      vi.mocked(jwt.verify).mockImplementation(() => {
        throw jwtError;
      });

      expect(() => jwtService.verifyToken(mockToken)).toThrow(jwtError);
    });

    it('should handle generic errors', () => {
      const mockToken = 'malformed-token';
      const genericError = new Error('Unexpected error');
      vi.mocked(jwt.verify).mockImplementation(() => {
        throw genericError;
      });

      expect(() => jwtService.verifyToken(mockToken)).toThrow(genericError);
    });

    it('should handle null/undefined tokens', () => {
      expect(() => jwtService.verifyToken(null as any)).toThrow();
      expect(() => jwtService.verifyToken(undefined as any)).toThrow();
      expect(() => jwtService.verifyToken('')).toThrow();
    });
  });

  describe('decodeToken', () => {
    it('should decode token without verification', () => {
      const mockToken = 'token-to-decode';
      const mockDecodedPayload = { ...mockPayload, iat: 1234567890, exp: 1234571490 };
      vi.mocked(jwt.decode).mockReturnValue(mockDecodedPayload as any);

      const result = jwtService.decodeToken(mockToken);

      expect(jwt.decode).toHaveBeenCalledWith(mockToken);
      expect(result).toEqual(mockDecodedPayload);
    });

    it('should return null for invalid tokens', () => {
      const mockToken = 'invalid-token';
      vi.mocked(jwt.decode).mockReturnValue(null);

      const result = jwtService.decodeToken(mockToken);

      expect(result).toBeNull();
    });

    it('should handle decode errors', () => {
      const mockToken = 'malformed-token';
      vi.mocked(jwt.decode).mockImplementation(() => {
        throw new Error('Decode failed');
      });

      expect(() => jwtService.decodeToken(mockToken)).toThrow('Decode failed');
    });

    it('should handle empty tokens', () => {
      vi.mocked(jwt.decode).mockReturnValue(null);

      expect(jwtService.decodeToken('')).toBeNull();
      expect(jwtService.decodeToken(null as any)).toBeNull();
      expect(jwtService.decodeToken(undefined as any)).toBeNull();
    });
  });

  describe('refreshToken', () => {
    it('should refresh token successfully', () => {
      const oldToken = 'old-token';
      const newToken = 'new-token';
      const mockDecodedPayload = { ...mockPayload, iat: 1234567890, exp: 1234571490 };

      // Mock decode to return valid payload
      vi.mocked(jwt.decode).mockReturnValue(mockDecodedPayload as any);
      // Mock sign to return new token
      vi.mocked(jwt.sign).mockReturnValue(newToken as any);

      const result = jwtService.refreshToken(oldToken);

      expect(jwt.decode).toHaveBeenCalledWith(oldToken);
      expect(jwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockPayload.userId,
          email: mockPayload.email,
          role: mockPayload.role,
        }),
        'test-secret', // Updated to match mock config
        {
          expiresIn: '24h',
          issuer: 'medianest', // Updated to match mock config
          audience: 'medianest-users', // Updated to match mock config
        },
      );
      expect(result).toBe(newToken);
    });

    it('should throw error for invalid token during refresh', () => {
      const invalidToken = 'invalid-token';
      vi.mocked(jwt.decode).mockReturnValue(null);

      expect(() => jwtService.refreshToken(invalidToken)).toThrow('Invalid token for refresh');
    });

    it('should throw error for token missing required fields', () => {
      const invalidToken = 'token-missing-fields';
      const incompletePayload = { userId: 'user-123' }; // Missing email and role
      vi.mocked(jwt.decode).mockReturnValue(incompletePayload as any);

      expect(() => jwtService.refreshToken(invalidToken)).toThrow(
        'JWT payload must include userId, email, and role',
      );
    });

    it('should exclude timing-sensitive fields from refreshed token', () => {
      const oldToken = 'old-token';
      const newToken = 'new-token';
      const mockDecodedPayload = {
        ...mockPayload,
        iat: 1234567890,
        exp: 1234571490,
        jti: 'old-jti',
      };

      vi.mocked(jwt.decode).mockReturnValue(mockDecodedPayload as any);
      vi.mocked(jwt.sign).mockReturnValue(newToken as any);

      jwtService.refreshToken(oldToken);

      // Verify that iat, exp, and jti are not included in the new payload
      expect(jwt.sign).toHaveBeenCalledWith(
        expect.not.objectContaining({
          iat: expect.anything(),
          exp: expect.anything(),
          jti: expect.anything(),
        }),
        expect.any(String),
        expect.any(Object),
      );
    });
  });

  describe('isTokenExpired', () => {
    it('should return false for valid token', () => {
      const validPayload = {
        ...mockPayload,
        exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
      };
      vi.mocked(jwt.decode).mockReturnValue(validPayload as any);

      const result = jwtService.isTokenExpired('valid-token');

      expect(result).toBe(false);
    });

    it('should return true for expired token', () => {
      const expiredPayload = {
        ...mockPayload,
        exp: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
      };
      vi.mocked(jwt.decode).mockReturnValue(expiredPayload as any);

      const result = jwtService.isTokenExpired('expired-token');

      expect(result).toBe(true);
    });

    it('should return true for token without exp claim', () => {
      const payloadWithoutExp = { ...mockPayload };
      delete (payloadWithoutExp as any).exp;
      vi.mocked(jwt.decode).mockReturnValue(payloadWithoutExp as any);

      const result = jwtService.isTokenExpired('token-without-exp');

      expect(result).toBe(true);
    });

    it('should return true for invalid token', () => {
      vi.mocked(jwt.decode).mockReturnValue(null);

      const result = jwtService.isTokenExpired('invalid-token');

      expect(result).toBe(true);
    });

    it('should handle decode errors', () => {
      vi.mocked(jwt.decode).mockImplementation(() => {
        throw new Error('Decode failed');
      });

      const result = jwtService.isTokenExpired('malformed-token');

      expect(result).toBe(true);
    });
  });

  describe('getTokenExpirationTime', () => {
    it('should return expiration time for valid token', () => {
      const expTime = Math.floor(Date.now() / 1000) + 3600;
      const validPayload = { ...mockPayload, exp: expTime };
      vi.mocked(jwt.decode).mockReturnValue(validPayload as any);

      const result = jwtService.getTokenExpirationTime('valid-token');

      expect(result).toBe(expTime);
    });

    it('should return null for token without exp claim', () => {
      const payloadWithoutExp = { ...mockPayload };
      vi.mocked(jwt.decode).mockReturnValue(payloadWithoutExp as any);

      const result = jwtService.getTokenExpirationTime('token-without-exp');

      expect(result).toBeNull();
    });

    it('should return null for invalid token', () => {
      vi.mocked(jwt.decode).mockReturnValue(null);

      const result = jwtService.getTokenExpirationTime('invalid-token');

      expect(result).toBeNull();
    });
  });
});
