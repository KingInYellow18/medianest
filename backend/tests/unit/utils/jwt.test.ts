import { describe, it, expect, vi } from 'vitest';
import { generateToken, verifyToken } from '@/utils/jwt';
import jwt from 'jsonwebtoken';

// Set up test environment variables
const TEST_JWT_SECRET = 'test-jwt-secret-for-testing-only';
process.env.JWT_SECRET = TEST_JWT_SECRET;
process.env.JWT_ISSUER = 'medianest';
process.env.JWT_AUDIENCE = 'medianest-users';

// Mock jsonwebtoken module properly - use real implementation
vi.mock('jsonwebtoken', async (importOriginal) => {
  const actual = await importOriginal<typeof import('jsonwebtoken')>();
  return {
    default: actual.default,
    ...actual,
  };
});

describe('JWT Utilities', () => {
  describe('generateToken', () => {
    it('should generate a valid JWT token', () => {
      const payload = { userId: 'user123', role: 'user' };
      const token = generateToken(payload, false);

      expect(token).toBeTruthy();
      expect(typeof token).toBe('string');

      // Verify the token structure
      const parts = token.split('.');
      expect(parts).toHaveLength(3);
    });

    it('should generate a remember me token with 30 day expiry', () => {
      const payload = { userId: 'user123', email: 'user@example.com', role: 'user' };
      const token = generateToken(payload, true);

      const decoded = jwt.verify(token, TEST_JWT_SECRET) as any;
      const expiryTime = decoded.exp - decoded.iat;

      // 30 days in seconds
      expect(expiryTime).toBe(30 * 24 * 60 * 60);
    });

    it('should generate a regular token with 15 minute expiry', () => {
      const payload = { userId: 'user123', email: 'user@example.com', role: 'user' };
      const token = generateToken(payload, false);

      const decoded = jwt.verify(token, TEST_JWT_SECRET) as any;
      const expiryTime = decoded.exp - decoded.iat;

      // 15 minutes in seconds (default expiry from jwt.ts)
      expect(expiryTime).toBe(15 * 60);
    });

    it('should include custom options in token', () => {
      const payload = { userId: 'user123', email: 'user@example.com', role: 'user' };
      const options = { issuer: 'medianest-test' };
      const token = generateToken(payload, false, options);

      const decoded = jwt.verify(token, TEST_JWT_SECRET) as any;
      expect(decoded.iss).toBe('medianest-test');
    });
  });

  describe('verifyToken', () => {
    it('should verify a valid token', () => {
      const payload = { userId: 'user123', email: 'user@example.com', role: 'user' };
      const token = generateToken(payload, false);

      const decoded = verifyToken(token);
      expect(decoded.userId).toBe('user123');
      expect(decoded.email).toBe('user@example.com');
      expect(decoded.role).toBe('user');
    });

    it('should throw error for expired token', () => {
      const expiredToken = jwt.sign({ userId: 'user123', role: 'user' }, TEST_JWT_SECRET, {
        expiresIn: '-1h',
      });

      expect(() => verifyToken(expiredToken)).toThrow();
    });

    it('should throw error for invalid token', () => {
      const invalidToken = 'invalid.jwt.token';
      expect(() => verifyToken(invalidToken)).toThrow();
    });

    it('should throw error for tampered token', () => {
      const token = generateToken(
        { userId: 'user123', email: 'user@example.com', role: 'user' },
        false,
      );
      const tamperedToken = token.slice(0, -1) + 'x';

      expect(() => verifyToken(tamperedToken)).toThrow();
    });

    it('should throw error for token with wrong secret', () => {
      const wrongSecretToken = jwt.sign({ userId: 'user123', role: 'user' }, 'wrong-secret', {
        expiresIn: '1h',
      });

      expect(() => verifyToken(wrongSecretToken)).toThrow();
    });
  });

  describe('Token Security', () => {
    it('should include all payload fields in token', () => {
      const payload = {
        userId: 'user123',
        email: 'user@example.com',
        role: 'user',
        plexId: 'plex-123',
      };

      const token = generateToken(payload, false);
      const decoded = jwt.decode(token) as any;

      // All fields from the payload should be included
      expect(decoded.userId).toBe('user123');
      expect(decoded.email).toBe('user@example.com');
      expect(decoded.role).toBe('user');
      expect(decoded.plexId).toBe('plex-123');

      // JWT standard claims should also be present
      expect(decoded.iss).toBe('medianest');
      expect(decoded.aud).toBe('medianest-users');
    });
  });
});
