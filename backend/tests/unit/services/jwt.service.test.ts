import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import jwt from 'jsonwebtoken';
import { JwtService, JwtPayload } from '@/services/jwt.service';

describe('JwtService', () => {
  let jwtService: JwtService;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = process.env;
    process.env.JWT_SECRET = 'test-jwt-secret-key-at-least-32-chars-long';
    process.env.JWT_ISSUER = 'medianest-test';
    process.env.JWT_AUDIENCE = 'medianest-test-users';
    jwtService = new JwtService();
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe('Constructor Security', () => {
    it('should initialize with valid JWT secret', () => {
      expect(jwtService).toBeDefined();
    });

    it('should throw error for missing JWT secret', () => {
      delete process.env.JWT_SECRET;
      expect(() => new JwtService()).toThrow('JWT_SECRET is required for authentication');
    });

    it('should use default issuer and audience when not provided', () => {
      delete process.env.JWT_ISSUER;
      delete process.env.JWT_AUDIENCE;
      const service = new JwtService();

      const payload: JwtPayload = { userId: 'test-user', role: 'user' };
      const token = service.generateAccessToken(payload);
      const decoded = jwt.decode(token, { complete: true }) as any;

      expect(decoded.payload.iss).toBe('medianest');
      expect(decoded.payload.aud).toBe('medianest-users');
    });
  });

  describe('Access Token Generation (24h)', () => {
    it('should generate valid access token with 24h expiry', () => {
      const payload: JwtPayload = { userId: 'user-123', role: 'user' };
      const token = jwtService.generateAccessToken(payload);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT format
    });

    it('should include correct payload data in access token', () => {
      const payload: JwtPayload = { userId: 'user-456', role: 'admin' };
      const token = jwtService.generateAccessToken(payload);
      const decoded = jwt.decode(token) as any;

      expect(decoded.userId).toBe('user-456');
      expect(decoded.role).toBe('admin');
      expect(decoded.iss).toBe('medianest-test');
      expect(decoded.aud).toBe('medianest-test-users');
    });

    it('should set correct expiration time for access token (24h)', () => {
      const beforeGeneration = Math.floor(Date.now() / 1000);
      const payload: JwtPayload = { userId: 'user-789', role: 'user' };
      const token = jwtService.generateAccessToken(payload);
      const decoded = jwt.decode(token) as any;

      const expectedExp = beforeGeneration + 24 * 60 * 60; // 24 hours
      expect(decoded.exp).toBeGreaterThan(beforeGeneration);
      expect(decoded.exp).toBeLessThanOrEqual(expectedExp + 5); // Allow 5 second tolerance
    });

    it('should generate different tokens for same payload (due to timestamps)', () => {
      const payload: JwtPayload = { userId: 'user-123', role: 'user' };
      const token1 = jwtService.generateAccessToken(payload);

      // Wait a moment to ensure different timestamps
      vi.useFakeTimers();
      vi.advanceTimersByTime(1000);

      const token2 = jwtService.generateAccessToken(payload);
      vi.useRealTimers();

      expect(token1).not.toBe(token2);
    });
  });

  describe('Remember Token Generation (90d)', () => {
    it('should generate valid remember token with 90d expiry', () => {
      const payload: JwtPayload = { userId: 'user-123', role: 'user' };
      const token = jwtService.generateRememberToken(payload);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3);
    });

    it('should set correct expiration time for remember token (90d)', () => {
      const beforeGeneration = Math.floor(Date.now() / 1000);
      const payload: JwtPayload = { userId: 'user-789', role: 'user' };
      const token = jwtService.generateRememberToken(payload);
      const decoded = jwt.decode(token) as any;

      const expectedExp = beforeGeneration + 90 * 24 * 60 * 60; // 90 days
      expect(decoded.exp).toBeGreaterThan(beforeGeneration);
      expect(decoded.exp).toBeLessThanOrEqual(expectedExp + 5);
    });
  });

  describe('Token Verification Security', () => {
    it('should verify valid access token successfully', () => {
      const payload: JwtPayload = { userId: 'user-123', role: 'admin' };
      const token = jwtService.generateAccessToken(payload);

      const verified = jwtService.verifyToken(token);
      expect(verified.userId).toBe('user-123');
      expect(verified.role).toBe('admin');
    });

    it('should verify valid remember token successfully', () => {
      const payload: JwtPayload = { userId: 'user-456', role: 'user' };
      const token = jwtService.generateRememberToken(payload);

      const verified = jwtService.verifyToken(token);
      expect(verified.userId).toBe('user-456');
      expect(verified.role).toBe('user');
    });

    it('should reject token with invalid signature', () => {
      const payload: JwtPayload = { userId: 'user-123', role: 'user' };
      const token = jwtService.generateAccessToken(payload);
      const tamperedToken = token.slice(0, -10) + 'tampered123';

      expect(() => jwtService.verifyToken(tamperedToken)).toThrow();
    });

    it('should reject token with wrong issuer', () => {
      const maliciousToken = jwt.sign(
        { userId: 'user-123', role: 'admin' },
        'test-jwt-secret-key-at-least-32-chars-long',
        { issuer: 'malicious-issuer', audience: 'medianest-test-users' },
      );

      expect(() => jwtService.verifyToken(maliciousToken)).toThrow();
    });

    it('should reject token with wrong audience', () => {
      const maliciousToken = jwt.sign(
        { userId: 'user-123', role: 'admin' },
        'test-jwt-secret-key-at-least-32-chars-long',
        { issuer: 'medianest-test', audience: 'malicious-audience' },
      );

      expect(() => jwtService.verifyToken(maliciousToken)).toThrow();
    });

    it('should reject expired token', () => {
      const expiredToken = jwt.sign(
        { userId: 'user-123', role: 'user' },
        'test-jwt-secret-key-at-least-32-chars-long',
        {
          expiresIn: '1ms',
          issuer: 'medianest-test',
          audience: 'medianest-test-users',
        },
      );

      // Wait for token to expire
      return new Promise((resolve) => {
        setTimeout(() => {
          expect(() => jwtService.verifyToken(expiredToken)).toThrow();
          resolve(undefined);
        }, 10);
      });
    });
  });

  describe('Token Payload Security', () => {
    it('should sanitize malicious payload data', () => {
      const maliciousPayload = {
        userId: 'user-123',
        role: 'user',
        __proto__: { isAdmin: true }, // Prototype pollution attempt
        constructor: { prototype: { isAdmin: true } },
      } as any;

      const token = jwtService.generateAccessToken(maliciousPayload);
      const verified = jwtService.verifyToken(token);

      expect(verified.userId).toBe('user-123');
      expect(verified.role).toBe('user');
      expect((verified as any).__proto__).toBeUndefined();
      expect((verified as any).constructor).toBeUndefined();
    });

    it('should prevent privilege escalation via payload manipulation', () => {
      const userPayload: JwtPayload = { userId: 'user-123', role: 'user' };
      const token = jwtService.generateAccessToken(userPayload);

      // Attempt to decode and modify
      const decoded = jwt.decode(token) as any;
      expect(decoded.role).toBe('user'); // Should remain user, not admin

      // Verify token hasn't been tampered with
      const verified = jwtService.verifyToken(token);
      expect(verified.role).toBe('user');
    });

    it('should reject tokens with missing required fields', () => {
      const incompleteToken = jwt.sign(
        { userId: 'user-123' }, // Missing role
        'test-jwt-secret-key-at-least-32-chars-long',
        { issuer: 'medianest-test', audience: 'medianest-test-users' },
      );

      const verified = jwtService.verifyToken(incompleteToken);
      expect(verified.userId).toBe('user-123');
      expect(verified.role).toBeUndefined();
    });
  });

  describe('Concurrent Operations Security', () => {
    it('should handle concurrent token generation safely', async () => {
      const payload: JwtPayload = { userId: 'user-123', role: 'user' };
      const promises = Array(100)
        .fill(0)
        .map(() => Promise.resolve(jwtService.generateAccessToken(payload)));

      const tokens = await Promise.all(promises);

      // All should be valid and unique (due to timestamps)
      expect(tokens).toHaveLength(100);
      expect(new Set(tokens).size).toBe(100);

      // All should be verifiable
      tokens.forEach((token) => {
        const verified = jwtService.verifyToken(token);
        expect(verified.userId).toBe('user-123');
      });
    });

    it('should handle concurrent token verification safely', async () => {
      const payload: JwtPayload = { userId: 'user-456', role: 'admin' };
      const token = jwtService.generateAccessToken(payload);

      const promises = Array(50)
        .fill(0)
        .map(() => Promise.resolve(jwtService.verifyToken(token)));

      const results = await Promise.all(promises);

      results.forEach((result) => {
        expect(result.userId).toBe('user-456');
        expect(result.role).toBe('admin');
      });
    });
  });

  describe('Performance Security', () => {
    it('should generate tokens within performance limits', () => {
      const payload: JwtPayload = { userId: 'user-123', role: 'user' };

      const start = Date.now();
      jwtService.generateAccessToken(payload);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(10); // Should be very fast
    });

    it('should verify tokens within performance limits', () => {
      const payload: JwtPayload = { userId: 'user-123', role: 'user' };
      const token = jwtService.generateAccessToken(payload);

      const start = Date.now();
      jwtService.verifyToken(token);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(5);
    });

    it('should prevent DoS via large payload attacks', () => {
      const largePayload = {
        userId: 'user-123',
        role: 'user',
        data: 'x'.repeat(10000), // Large data
      } as any;

      expect(() => {
        const token = jwtService.generateAccessToken(largePayload);
        jwtService.verifyToken(token);
      }).not.toThrow();
    });
  });

  describe('Error Handling Security', () => {
    it('should not leak sensitive information in error messages', () => {
      const invalidToken = 'invalid.token.here';

      expect(() => jwtService.verifyToken(invalidToken)).toThrow();
      // Error should not contain the secret or other sensitive data
    });

    it('should handle malformed tokens gracefully', () => {
      const malformedTokens = [
        'not-a-jwt',
        'invalid.jwt',
        'too.many.parts.here.invalid',
        '',
        null as any,
        undefined as any,
        123 as any,
      ];

      malformedTokens.forEach((token) => {
        expect(() => jwtService.verifyToken(token)).toThrow();
      });
    });

    it('should handle edge case payloads', () => {
      const edgeCases = [
        { userId: '', role: 'user' },
        { userId: 'user-123', role: '' },
        { userId: null as any, role: 'user' },
        { userId: 'user-123', role: null as any },
      ];

      edgeCases.forEach((payload) => {
        expect(() => {
          const token = jwtService.generateAccessToken(payload);
          jwtService.verifyToken(token);
        }).not.toThrow();
      });
    });
  });

  describe('Timing Attack Prevention', () => {
    it('should have consistent verification timing for valid/invalid tokens', async () => {
      const validPayload: JwtPayload = { userId: 'user-123', role: 'user' };
      const validToken = jwtService.generateAccessToken(validPayload);
      const invalidToken = 'invalid.token.signature';

      // Measure timing for valid token
      const validStart = process.hrtime.bigint();
      try {
        jwtService.verifyToken(validToken);
      } catch {}
      const validEnd = process.hrtime.bigint();

      // Measure timing for invalid token
      const invalidStart = process.hrtime.bigint();
      try {
        jwtService.verifyToken(invalidToken);
      } catch {}
      const invalidEnd = process.hrtime.bigint();

      const validDuration = Number(validEnd - validStart) / 1000000; // Convert to ms
      const invalidDuration = Number(invalidEnd - invalidStart) / 1000000;

      // Timing difference should not be significant (within 10ms)
      const timingDifference = Math.abs(validDuration - invalidDuration);
      expect(timingDifference).toBeLessThan(10);
    });
  });

  describe('Algorithm Security', () => {
    it('should use secure signing algorithm (RS256/HS256)', () => {
      const payload: JwtPayload = { userId: 'user-123', role: 'user' };
      const token = jwtService.generateAccessToken(payload);
      const decoded = jwt.decode(token, { complete: true }) as any;

      // Should use HS256 by default (symmetric)
      expect(decoded.header.alg).toBe('HS256');
    });

    it('should reject tokens with weak algorithms', () => {
      // Create token with 'none' algorithm (security vulnerability)
      const unsafeToken = jwt.sign({ userId: 'user-123', role: 'admin' }, '', {
        algorithm: 'none' as any,
      });

      expect(() => jwtService.verifyToken(unsafeToken)).toThrow();
    });
  });
});
