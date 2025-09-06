import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { setupSecurityMocks, resetSecurityMocks } from './security-mocks';

// Setup mocks before importing
setupSecurityMocks();

// Import after mocking
const { app } = await import('../../../src/server');

describe('Comprehensive Security Test Suite', () => {
  beforeAll(async () => {
    // Security mocks are setup
  });

  afterAll(async () => {
    resetSecurityMocks();
  });

  describe('Security Headers Validation', () => {
    it('should set comprehensive security headers', async () => {
      const response = await request(app).get('/health').expect(200);

      // Core security headers
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-xss-protection']).toBe('1; mode=block');
      expect(response.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');

      // CSP should be present and restrictive
      const csp = response.headers['content-security-policy'];
      expect(csp).toBeDefined();
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("frame-ancestors 'none'");
    });

    it('should not expose sensitive server information', async () => {
      const response = await request(app).get('/health');

      expect(response.headers['x-powered-by']).toBeUndefined();
      expect(response.headers['server']).toBeUndefined();
    });
  });

  describe('Input Validation Security', () => {
    it('should handle malicious input gracefully', async () => {
      const maliciousInputs = [
        '<script>alert("xss")</script>',
        '"; DROP TABLE users; --',
        '../../../etc/passwd',
        'javascript:alert("xss")',
      ];

      for (const input of maliciousInputs) {
        const response = await request(app).get('/health').query({ test: input });

        // Should not reflect the malicious input
        expect(response.text).not.toContain('<script>');
        expect(response.text).not.toContain('DROP TABLE');
        expect(response.text).not.toContain('javascript:');
      }
    });
  });

  describe('HTTP Method Security', () => {
    it('should only allow appropriate HTTP methods', async () => {
      const response = await request(app).trace('/health');

      // TRACE method should be disabled
      expect(response.status).toBe(405);
    });

    it('should handle OPTIONS requests securely', async () => {
      const response = await request(app).options('/health');

      // Should not leak sensitive information in OPTIONS
      expect([200, 204, 405]).toContain(response.status);
    });
  });

  describe('Error Handling Security', () => {
    it('should not expose stack traces in error responses', async () => {
      const response = await request(app).get('/nonexistent-endpoint');

      expect(response.status).toBe(404);
      expect(response.text).not.toContain('at ');
      expect(response.text).not.toContain('node_modules');
      expect(response.text).not.toContain(__dirname);
    });

    it('should handle invalid JSON gracefully', async () => {
      const response = await request(app)
        .post('/api/test-endpoint')
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}');

      expect(response.status).toBe(400);
      expect(response.body).not.toHaveProperty('stack');
    });
  });

  describe('Content-Type Security', () => {
    it('should enforce proper content-type validation', async () => {
      const response = await request(app)
        .post('/health')
        .set('Content-Type', 'text/html')
        .send('<html><body>test</body></html>');

      // Should reject non-JSON content types for API endpoints
      expect([400, 405, 415]).toContain(response.status);
    });

    it('should prevent MIME type confusion', async () => {
      const response = await request(app)
        .post('/health')
        .set('Content-Type', 'image/jpeg')
        .send('{"data": "test"}');

      expect([400, 415]).toContain(response.status);
    });
  });

  describe('Request Size Limits', () => {
    it('should enforce request size limits', async () => {
      const largePayload = 'x'.repeat(15 * 1024 * 1024); // 15MB

      const response = await request(app)
        .post('/health')
        .set('Content-Type', 'application/json')
        .send(largePayload);

      expect(response.status).toBe(413);
    });
  });

  describe('Security Header Consistency', () => {
    it('should maintain security headers across different response types', async () => {
      const endpoints = ['/health', '/nonexistent'];

      for (const endpoint of endpoints) {
        const response = await request(app).get(endpoint);

        // Security headers should be present regardless of response status
        expect(response.headers['x-content-type-options']).toBe('nosniff');
        expect(response.headers['x-frame-options']).toBe('DENY');
      }
    });
  });
});
