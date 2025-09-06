import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import {
  authMiddleware,
  requireRole,
  requireAdmin,
  optionalAuth,
} from '../../../src/middleware/auth';
import { validateOrigin, csrfProtection } from '../../../src/middleware/security';
import { rateLimiter } from '../../../src/middleware/rate-limit';

// Mock JWT utilities
vi.mock('../../../src/utils/jwt', () => ({
  verifyToken: vi.fn(),
  getTokenMetadata: vi.fn(() => ({ expired: true })),
  decodeToken: vi.fn(),
}));

// Mock config
vi.mock('@/config', () => ({
  getRateLimitConfig: vi.fn(() => ({
    api: {
      window: 60000,
      requests: 100,
    },
    auth: {
      window: 900000,
      requests: 10,
    },
    youtube: {
      window: 60000,
      requests: 50,
    },
    media: {
      window: 60000,
      requests: 200,
    },
    standardHeaders: true,
    legacyHeaders: false,
  })),
}));

describe('Security Middleware Unit Tests', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let nextFunction: NextFunction;

  beforeEach(() => {
    mockRequest = {
      headers: {},
      cookies: {},
      ip: '127.0.0.1',
      method: 'GET',
      path: '/api/test',
      get: vi.fn((name: string) => {
        const headers = (mockRequest.headers as Record<string, string>) || {};
        return headers[name.toLowerCase()] || headers[name];
      }),
    };

    mockResponse = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      cookie: vi.fn().mockReturnThis(),
      clearCookie: vi.fn().mockReturnThis(),
      setHeader: vi.fn().mockReturnThis(),
    };

    nextFunction = vi.fn();
  });

  describe('Authentication Middleware', () => {
    it('should reject requests without token', async () => {
      const middleware = authMiddleware();

      await middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 401,
          message: 'Authentication required',
        }),
      );
    });

    it('should reject requests with invalid token format', async () => {
      mockRequest.headers!.authorization = 'Invalid token format';

      const middleware = authMiddleware();
      await middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 401,
        }),
      );
    });

    it('should reject requests with malformed JWT', async () => {
      mockRequest.headers!.authorization = 'Bearer invalid.jwt.token';

      const middleware = authMiddleware();
      await middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 401,
        }),
      );
    });

    it('should handle expired tokens correctly', async () => {
      // Mock expired JWT
      const expiredToken =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ0ZXN0IiwiZXhwIjoxfQ.invalid';
      mockRequest.headers!.authorization = `Bearer ${expiredToken}`;

      const middleware = authMiddleware();
      await middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 401,
        }),
      );
    });

    it('should validate token against session store', async () => {
      const validToken = 'valid.jwt.token';
      mockRequest.headers!.authorization = `Bearer ${validToken}`;

      // Mock session validation failure
      vi.mock('../../../src/repositories/session-token.repository', () => ({
        SessionTokenRepository: vi.fn().mockImplementation(() => ({
          validate: vi.fn().mockResolvedValue(null),
        })),
      }));

      const middleware = authMiddleware();
      await middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 401,
          message: expect.stringContaining('session'),
        }),
      );
    });

    it('should prevent timing attacks on token validation', async () => {
      const tokens = [
        'Bearer valid.jwt.token',
        'Bearer invalid.jwt.token',
        'Bearer short.token',
        'Bearer very.long.token.that.exceeds.normal.length',
        'Bearer',
        '',
      ];

      const timings: number[] = [];

      for (const token of tokens) {
        mockRequest.headers!.authorization = token;

        const start = process.hrtime.bigint();
        const middleware = authMiddleware();
        await middleware(mockRequest as Request, mockResponse as Response, nextFunction);
        const end = process.hrtime.bigint();

        timings.push(Number(end - start) / 1000000); // Convert to milliseconds
      }

      // Check that timing variance is minimal
      const maxTime = Math.max(...timings);
      const minTime = Math.min(...timings);
      const variance = maxTime - minTime;

      expect(variance).toBeLessThan(100); // Less than 100ms variance
    });
  });

  describe('Role-Based Authorization Middleware', () => {
    beforeEach(() => {
      mockRequest.user = {
        id: 'test-user',
        email: 'test@example.com',
        name: 'Test User',
        role: 'user',
      };
    });

    it('should allow users with required role', () => {
      const middleware = requireRole('user');
      middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalledWith();
    });

    it('should reject users without required role', () => {
      const middleware = requireRole('admin');
      middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 403,
          message: expect.stringContaining('admin'),
        }),
      );
    });

    it('should handle multiple allowed roles', () => {
      const middleware = requireRole('user', 'moderator');
      middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalledWith();
    });

    it('should reject unauthenticated requests', () => {
      delete mockRequest.user;

      const middleware = requireRole('user');
      middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 401,
          message: 'Authentication required',
        }),
      );
    });

    it('should validate admin role specifically', () => {
      mockRequest.user!.role = 'admin';

      const middleware = requireAdmin();
      middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalledWith();
    });

    it('should prevent role manipulation attempts', () => {
      // Attempt to manipulate role in request
      mockRequest.user!.role = 'admin';
      mockRequest.body = { role: 'admin' };
      mockRequest.headers!['x-role-override'] = 'admin';

      const originalRole = 'user';
      mockRequest.user!.role = originalRole;

      const middleware = requireRole('admin');
      middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 403,
        }),
      );
    });
  });

  describe('Optional Authentication Middleware', () => {
    it('should continue without authentication when no token provided', async () => {
      const middleware = optionalAuth();
      await middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalledWith();
      expect(mockRequest.user).toBeUndefined();
    });

    it('should authenticate when valid token provided', async () => {
      mockRequest.headers!.authorization = 'Bearer valid.token';

      // Mock successful authentication
      vi.mock('../../../src/utils/jwt', () => ({
        verifyToken: vi.fn().mockReturnValue({
          userId: 'test-user',
          email: 'test@example.com',
          role: 'user',
        }),
      }));

      const middleware = optionalAuth();
      await middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalledWith();
      // User should be attached if valid token
    });

    it('should continue gracefully with invalid token', async () => {
      mockRequest.headers!.authorization = 'Bearer invalid.token';

      const middleware = optionalAuth();
      await middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalledWith();
      expect(mockRequest.user).toBeUndefined();
    });
  });

  describe('CSRF Protection Middleware', () => {
    it('should require CSRF token for POST requests', () => {
      mockRequest.method = 'POST';
      mockRequest.headers!['x-csrf-token'] = undefined;

      const middleware = csrfProtection();
      middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 403,
          code: 'CSRF_TOKEN_MISSING',
        }),
      );
    });

    it('should validate CSRF token format', () => {
      mockRequest.method = 'POST';
      mockRequest.headers!['x-csrf-token'] = 'invalid-format';

      const middleware = csrfProtection();
      middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 403,
          code: 'INVALID_CSRF_TOKEN',
        }),
      );
    });

    it('should implement double-submit cookie pattern', () => {
      mockRequest.method = 'POST';
      mockRequest.headers!['x-csrf-token'] = 'token123';
      mockRequest.cookies!['csrf-token'] = 'different-token';

      const middleware = csrfProtection();
      middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 403,
          code: 'CSRF_TOKEN_MISMATCH',
        }),
      );
    });

    it('should allow safe methods without CSRF token', () => {
      const safeMethods = ['GET', 'HEAD', 'OPTIONS'];

      safeMethods.forEach((method) => {
        mockRequest.method = method;

        const middleware = csrfProtection();
        middleware(mockRequest as Request, mockResponse as Response, nextFunction);

        expect(nextFunction).toHaveBeenCalledWith();
      });
    });

    it('should validate CSRF token origin', () => {
      mockRequest.method = 'POST';
      mockRequest.headers!['x-csrf-token'] = 'valid-token';
      mockRequest.headers!.origin = 'https://evil.com';
      mockRequest.headers!.referer = 'https://evil.com/malicious';

      const middleware = csrfProtection();
      middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 403,
          code: 'INVALID_ORIGIN',
        }),
      );
    });
  });

  describe('Origin Validation Middleware', () => {
    it('should validate allowed origins', () => {
      mockRequest.headers!.origin = 'https://trusted-app.com';

      const middleware = validateOrigin(['https://trusted-app.com']);
      middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalledWith();
    });

    it('should reject disallowed origins', () => {
      mockRequest.headers!.origin = 'https://evil.com';

      const middleware = validateOrigin(['https://trusted-app.com']);
      middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 403,
          code: 'INVALID_ORIGIN',
        }),
      );
    });

    it('should handle origin header spoofing attempts', () => {
      const spoofingAttempts = [
        'https://trusted-app.com.evil.com',
        'https://evil.com/trusted-app.com',
        'https://trusted-app.com@evil.com',
        'https://trusted-app.com:8080.evil.com',
      ];

      spoofingAttempts.forEach((origin) => {
        mockRequest.headers!.origin = origin;

        const middleware = validateOrigin(['https://trusted-app.com']);
        middleware(mockRequest as Request, mockResponse as Response, nextFunction);

        expect(nextFunction).toHaveBeenCalledWith(
          expect.objectContaining({
            statusCode: 403,
          }),
        );
      });
    });

    it('should validate subdomain policies', () => {
      mockRequest.headers!.origin = 'https://api.trusted-app.com';

      const middleware = validateOrigin(['https://*.trusted-app.com']);
      middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalledWith();
    });

    it('should handle missing origin header appropriately', () => {
      delete mockRequest.headers!.origin;

      const middleware = validateOrigin(['https://trusted-app.com'], { requireOrigin: true });
      middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 400,
          code: 'ORIGIN_REQUIRED',
        }),
      );
    });
  });

  describe('Rate Limiting Middleware', () => {
    it('should allow requests under rate limit', async () => {
      mockRequest.ip = '192.168.1.1';
      mockRequest.user = { id: 'user-123', role: 'user' };

      const middleware = rateLimiter({ windowMs: 60000, max: 100 });
      await middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalledWith();
    });

    it('should rate limit excessive requests', async () => {
      mockRequest.ip = '192.168.1.1';
      mockRequest.user = { id: 'user-123', role: 'user' };

      const middleware = rateLimiter({ windowMs: 60000, max: 1 });

      // First request should pass
      await middleware(mockRequest as Request, mockResponse as Response, nextFunction);
      expect(nextFunction).toHaveBeenCalledWith();

      // Second request should be rate limited
      nextFunction.mockClear();
      await middleware(mockRequest as Request, mockResponse as Response, nextFunction);
      expect(mockResponse.status).toHaveBeenCalledWith(429);
    });

    it('should set rate limit headers', async () => {
      mockRequest.ip = '192.168.1.1';

      const middleware = rateLimiter({ windowMs: 60000, max: 100 });
      await middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockResponse.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', 100);
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'X-RateLimit-Remaining',
        expect.any(Number),
      );
      expect(mockResponse.setHeader).toHaveBeenCalledWith('X-RateLimit-Reset', expect.any(Number));
    });

    it('should handle different rate limits for different roles', async () => {
      const adminRequest = {
        ...mockRequest,
        user: { id: 'admin-123', role: 'admin' },
      };

      const userRequest = {
        ...mockRequest,
        user: { id: 'user-123', role: 'user' },
      };

      const middleware = rateLimiter({
        windowMs: 60000,
        max: (req) => (req.user?.role === 'admin' ? 1000 : 100),
      });

      await middleware(adminRequest as Request, mockResponse as Response, nextFunction);
      expect(mockResponse.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', 1000);

      await middleware(userRequest as Request, mockResponse as Response, nextFunction);
      expect(mockResponse.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', 100);
    });

    it('should prevent rate limit bypass attempts', async () => {
      const bypassAttempts = [
        { headers: { 'x-forwarded-for': '192.168.1.1, 203.0.113.1' } },
        { headers: { 'x-real-ip': '203.0.113.1' } },
        { headers: { 'x-client-ip': '203.0.113.1' } },
        { headers: { 'user-agent': 'different-agent' } },
      ];

      const middleware = rateLimiter({ windowMs: 60000, max: 1 });

      for (const attempt of bypassAttempts) {
        const req = { ...mockRequest, ...attempt, user: { id: 'user-123' } };

        // Should still be rate limited by user ID
        await middleware(req as Request, mockResponse as Response, nextFunction);

        if (mockResponse.status) {
          expect(mockResponse.status).toHaveBeenCalledWith(429);
        }
      }
    });
  });

  describe('Security Headers Middleware', () => {
    it('should set comprehensive security headers', () => {
      const securityHeaders = require('../../../src/middleware/security-headers');
      const middleware = securityHeaders();

      middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockResponse.setHeader).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
      expect(mockResponse.setHeader).toHaveBeenCalledWith('X-Frame-Options', 'DENY');
      expect(mockResponse.setHeader).toHaveBeenCalledWith('X-XSS-Protection', '1; mode=block');
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'Strict-Transport-Security',
        expect.stringContaining('max-age'),
      );
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'Content-Security-Policy',
        expect.stringContaining("default-src 'self'"),
      );
    });

    it('should set appropriate CSP for different endpoints', () => {
      const paths = [
        { path: '/api/upload', expectedCSP: expect.stringContaining('form-action') },
        { path: '/api/websocket', expectedCSP: expect.stringContaining('connect-src') },
        { path: '/api/external', expectedCSP: expect.stringContaining('default-src') },
      ];

      paths.forEach(({ path, expectedCSP }) => {
        mockRequest.path = path;

        const middleware = require('../../../src/middleware/security-headers')();
        middleware(mockRequest as Request, mockResponse as Response, nextFunction);

        expect(mockResponse.setHeader).toHaveBeenCalledWith('Content-Security-Policy', expectedCSP);
      });
    });

    it('should prevent header injection', () => {
      mockRequest.headers!['x-malicious'] = 'value\r\nX-Injected: header';

      const middleware = require('../../../src/middleware/security-headers')();
      middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      // Should sanitize or reject malicious headers
      expect(mockResponse.setHeader).not.toHaveBeenCalledWith(
        expect.stringContaining('X-Injected'),
        expect.anything(),
      );
    });
  });

  describe('Input Validation and Sanitization', () => {
    it('should sanitize XSS attempts in request body', () => {
      mockRequest.body = {
        name: '<script>alert("xss")</script>',
        description: '<img src=x onerror=alert("xss")>',
        html: '&lt;script&gt;safe&lt;/script&gt;',
      };

      const sanitizeMiddleware = require('../../../src/middleware/sanitization');
      const middleware = sanitizeMiddleware();

      middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockRequest.body.name).not.toContain('<script>');
      expect(mockRequest.body.description).not.toContain('onerror=');
      expect(nextFunction).toHaveBeenCalledWith();
    });

    it('should validate and sanitize SQL injection attempts', () => {
      mockRequest.query = {
        search: "'; DROP TABLE users; --",
        filter: "1' OR '1'='1",
        id: '1 UNION SELECT password FROM users',
      };

      const sanitizeMiddleware = require('../../../src/middleware/sanitization');
      const middleware = sanitizeMiddleware();

      middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockRequest.query.search).not.toContain('DROP TABLE');
      expect(mockRequest.query.filter).not.toContain("'1'='1");
      expect(mockRequest.query.id).not.toContain('UNION SELECT');
    });

    it('should prevent NoSQL injection in JSON payloads', () => {
      mockRequest.body = {
        filter: { $ne: null },
        query: { $regex: '.*' },
        conditions: { $where: 'return true' },
      };

      const sanitizeMiddleware = require('../../../src/middleware/sanitization');
      const middleware = sanitizeMiddleware();

      middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockRequest.body.filter).not.toHaveProperty('$ne');
      expect(mockRequest.body.query).not.toHaveProperty('$regex');
      expect(mockRequest.body.conditions).not.toHaveProperty('$where');
    });
  });
});
