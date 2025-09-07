import { describe, it, expect, beforeEach, beforeAll, afterAll } from '@jest/globals';
import { JWTFacade, JWTPayload } from '../../src/auth/jwt-facade';
import { AppError } from '../../src/utils/errors';

describe('JWTFacade', () => {
  let jwtFacade: JWTFacade;

  const mockPayload: JWTPayload = {
    userId: 'user-123',
    email: 'test@example.com',
    role: 'user',
    plexId: 'plex-123',
  };

  beforeAll(() => {
    // Set required environment variables
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
    jwtFacade = new JWTFacade();
  });

  describe('constructor', () => {
    it('should throw error for missing JWT_SECRET', () => {
      const originalSecret = process.env.JWT_SECRET;
      delete process.env.JWT_SECRET;

      expect(() => new JWTFacade()).toThrow('JWT_SECRET is required');

      process.env.JWT_SECRET = originalSecret;
    });

    it('should throw error for default dev JWT_SECRET', () => {
      const originalSecret = process.env.JWT_SECRET;
      process.env.JWT_SECRET = 'dev-secret';

      expect(() => new JWTFacade()).toThrow('JWT_SECRET is required');

      process.env.JWT_SECRET = originalSecret;
    });
  });

  describe('generateToken', () => {
    it('should generate a valid JWT token', () => {
      const token = jwtFacade.generateToken(mockPayload);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.').length).toBe(3); // JWT has 3 parts
    });

    it('should generate different tokens for same payload', () => {
      const token1 = jwtFacade.generateToken(mockPayload);
      const token2 = jwtFacade.generateToken(mockPayload);

      expect(token1).not.toBe(token2);
    });

    it('should generate longer-lived tokens for remember me', () => {
      const regularToken = jwtFacade.generateToken(mockPayload, false);
      const rememberToken = jwtFacade.generateToken(mockPayload, true);

      const regularMetadata = jwtFacade.getTokenMetadata(regularToken);
      const rememberMetadata = jwtFacade.getTokenMetadata(rememberToken);

      expect(rememberMetadata.expiresAt!.getTime()).toBeGreaterThan(
        regularMetadata.expiresAt!.getTime()
      );
    });

    it('should include custom options in token', () => {
      const token = jwtFacade.generateToken(mockPayload, false, {
        sessionId: 'custom-session-id',
        deviceId: 'device-123',
        ipAddress: '192.168.1.1',
      });

      const decoded = jwtFacade.decodeToken(token);

      expect(decoded).toMatchObject({
        sessionId: 'custom-session-id',
        deviceId: 'device-123',
        ipAddress: '192.168.1.1',
      });
    });
  });

  describe('verifyToken', () => {
    it('should verify a valid token', () => {
      const token = jwtFacade.generateToken(mockPayload);
      const decoded = jwtFacade.verifyToken(token);

      expect(decoded).toMatchObject({
        userId: 'user-123',
        email: 'test@example.com',
        role: 'user',
        plexId: 'plex-123',
      });
    });

    it('should throw AppError for invalid token', () => {
      expect(() => jwtFacade.verifyToken('invalid.token.here')).toThrow(AppError);
    });

    it('should throw AppError for expired token', () => {
      // Generate token with very short expiry
      const token = jwtFacade.generateToken(mockPayload, false, { expiresIn: '1ms' });

      // Wait a bit for token to expire
      return new Promise((resolve) => {
        setTimeout(() => {
          expect(() => jwtFacade.verifyToken(token)).toThrow('Token has expired');
          resolve(undefined);
        }, 10);
      });
    });

    it('should validate IP address when provided', () => {
      const token = jwtFacade.generateToken(mockPayload, false, {
        ipAddress: '192.168.1.1',
      });

      // Should succeed with matching IP
      expect(() => jwtFacade.verifyToken(token, { ipAddress: '192.168.1.1' })).not.toThrow();

      // Should fail with different IP
      expect(() => jwtFacade.verifyToken(token, { ipAddress: '192.168.1.2' })).toThrow(
        'Token IP mismatch'
      );
    });
  });

  describe('generateRefreshToken', () => {
    it('should generate structured refresh token with payload', () => {
      const refreshToken = jwtFacade.generateRefreshToken({
        userId: 'user-123',
        sessionId: 'session-123',
      });

      expect(refreshToken).toBeDefined();
      expect(typeof refreshToken).toBe('string');
    });

    it('should generate random refresh token without payload', () => {
      const refreshToken = jwtFacade.generateRefreshToken();

      expect(refreshToken).toBeDefined();
      expect(typeof refreshToken).toBe('string');
      expect(refreshToken.length).toBe(64); // 32 bytes * 2 (hex)
    });
  });

  describe('verifyRefreshToken', () => {
    it('should verify structured refresh token', () => {
      const refreshToken = jwtFacade.generateRefreshToken({
        userId: 'user-123',
        sessionId: 'session-123',
      });

      const result = jwtFacade.verifyRefreshToken(refreshToken);

      expect(result).toEqual({
        userId: 'user-123',
        sessionId: 'session-123',
      });
    });

    it('should throw error for invalid refresh token', () => {
      expect(() => jwtFacade.verifyRefreshToken('invalid-token')).toThrow(AppError);
    });

    it('should throw error for non-refresh token type', () => {
      const accessToken = jwtFacade.generateToken(mockPayload);

      expect(() => jwtFacade.verifyRefreshToken(accessToken)).toThrow('Invalid refresh token type');
    });
  });

  describe('getTokenMetadata', () => {
    it('should extract token metadata', () => {
      const token = jwtFacade.generateToken(mockPayload, false, {
        sessionId: 'session-123',
        deviceId: 'device-123',
      });

      const metadata = jwtFacade.getTokenMetadata(token);

      expect(metadata).toMatchObject({
        userId: 'user-123',
        sessionId: 'session-123',
        deviceId: 'device-123',
        issuedAt: expect.any(Date),
        expiresAt: expect.any(Date),
        tokenId: expect.any(String),
      });
    });

    it('should return empty object for invalid token', () => {
      const metadata = jwtFacade.getTokenMetadata('invalid.token');

      expect(metadata).toEqual({});
    });
  });

  describe('token lifecycle', () => {
    it('should correctly identify expired tokens', () => {
      // Generate token with very short expiry
      const token = jwtFacade.generateToken(mockPayload, false, { expiresIn: '1ms' });

      return new Promise((resolve) => {
        setTimeout(() => {
          expect(jwtFacade.isTokenExpired(token)).toBe(true);
          resolve(undefined);
        }, 10);
      });
    });

    it('should correctly identify non-expired tokens', () => {
      const token = jwtFacade.generateToken(mockPayload);

      expect(jwtFacade.isTokenExpired(token)).toBe(false);
    });

    it('should identify tokens that need rotation', () => {
      // Generate token with short expiry (less than rotation threshold)
      const token = jwtFacade.generateToken(mockPayload, false, { expiresIn: '1s' });

      expect(jwtFacade.shouldRotateToken(token)).toBe(true);
    });

    it('should not rotate fresh tokens', () => {
      const token = jwtFacade.generateToken(mockPayload);

      expect(jwtFacade.shouldRotateToken(token)).toBe(false);
    });
  });

  describe('rotateTokenIfNeeded', () => {
    it('should rotate token when needed', () => {
      // Generate token with short expiry
      const token = jwtFacade.generateToken(mockPayload, false, { expiresIn: '1s' });

      const rotationResult = jwtFacade.rotateTokenIfNeeded(token, mockPayload);

      expect(rotationResult).toMatchObject({
        newToken: expect.any(String),
        refreshToken: expect.any(String),
        expiresAt: expect.any(Date),
      });
    });

    it('should not rotate fresh token', () => {
      const token = jwtFacade.generateToken(mockPayload);

      const rotationResult = jwtFacade.rotateTokenIfNeeded(token, mockPayload);

      expect(rotationResult).toBeNull();
    });
  });

  describe('token blacklist', () => {
    it('should blacklist and check tokens', () => {
      const tokenId = 'test-token-id';

      expect(jwtFacade.isTokenBlacklisted(tokenId)).toBe(false);

      jwtFacade.blacklistToken(tokenId);

      expect(jwtFacade.isTokenBlacklisted(tokenId)).toBe(true);
    });
  });

  describe('decodeToken', () => {
    it('should decode token without verification', () => {
      const token = jwtFacade.generateToken(mockPayload);
      const decoded = jwtFacade.decodeToken(token);

      expect(decoded).toMatchObject({
        userId: 'user-123',
        email: 'test@example.com',
        role: 'user',
      });
    });

    it('should return null for invalid token', () => {
      const decoded = jwtFacade.decodeToken('invalid.token');

      expect(decoded).toBeNull();
    });
  });
});
