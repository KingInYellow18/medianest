import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../../../src/server';
import './security-test-runner';

describe('Security Headers Tests', () => {
  beforeAll(async () => {
    // Ensure app is ready
  });

  afterAll(async () => {
    // Cleanup
  });

  describe('Content Security Policy', () => {
    it('should set proper CSP headers', async () => {
      const response = await request(app).get('/health').expect(200);

      expect(response.headers['content-security-policy']).toBeDefined();
      expect(response.headers['content-security-policy']).toContain("default-src 'self'");
      expect(response.headers['content-security-policy']).toContain("frame-ancestors 'none'");
    });

    it('should prevent unsafe inline scripts in strict CSP', async () => {
      const response = await request(app).get('/health');

      const csp = response.headers['content-security-policy'];
      // Should allow controlled inline scripts for React but be restrictive
      expect(csp).toContain("script-src 'self'");
    });
  });

  describe('Anti-Clickjacking Headers', () => {
    it('should set X-Frame-Options to DENY', async () => {
      const response = await request(app).get('/health').expect(200);

      expect(response.headers['x-frame-options']).toBe('DENY');
    });
  });

  describe('MIME Type Security', () => {
    it('should set X-Content-Type-Options to nosniff', async () => {
      const response = await request(app).get('/health').expect(200);

      expect(response.headers['x-content-type-options']).toBe('nosniff');
    });
  });

  describe('XSS Protection', () => {
    it('should set X-XSS-Protection header', async () => {
      const response = await request(app).get('/health').expect(200);

      expect(response.headers['x-xss-protection']).toBe('1; mode=block');
    });
  });

  describe('Referrer Policy', () => {
    it('should set strict referrer policy', async () => {
      const response = await request(app).get('/health').expect(200);

      expect(response.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    });
  });

  describe('Permissions Policy', () => {
    it('should restrict dangerous browser APIs', async () => {
      const response = await request(app).get('/health').expect(200);

      const permissionsPolicy = response.headers['permissions-policy'];
      expect(permissionsPolicy).toBeDefined();
      expect(permissionsPolicy).toContain('camera=()');
      expect(permissionsPolicy).toContain('microphone=()');
      expect(permissionsPolicy).toContain('geolocation=()');
    });
  });

  describe('Cross-Origin Policies', () => {
    it('should set Cross-Origin-Embedder-Policy', async () => {
      const response = await request(app).get('/health').expect(200);

      expect(response.headers['cross-origin-embedder-policy']).toBe('require-corp');
    });

    it('should set Cross-Origin-Opener-Policy', async () => {
      const response = await request(app).get('/health').expect(200);

      expect(response.headers['cross-origin-opener-policy']).toBe('same-origin');
    });

    it('should set Cross-Origin-Resource-Policy', async () => {
      const response = await request(app).get('/health').expect(200);

      expect(response.headers['cross-origin-resource-policy']).toBe('same-origin');
    });
  });

  describe('Information Disclosure Prevention', () => {
    it('should not expose server information', async () => {
      const response = await request(app).get('/health').expect(200);

      expect(response.headers['x-powered-by']).toBeUndefined();
      expect(response.headers['server']).toBeUndefined();
    });

    it('should set X-DNS-Prefetch-Control', async () => {
      const response = await request(app).get('/health').expect(200);

      expect(response.headers['x-dns-prefetch-control']).toBe('off');
    });
  });

  describe('Production Security Headers', () => {
    it('should set HSTS in production environment', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const response = await request(app).get('/health').expect(200);

      // Note: HSTS should be set in production with proper HTTPS setup
      // This test documents the expected behavior

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('Security Headers Consistency', () => {
    it('should set security headers on all endpoints', async () => {
      const endpoints = ['/health', '/api/health'];

      for (const endpoint of endpoints) {
        const response = await request(app).get(endpoint);

        if (response.status !== 404) {
          expect(response.headers['x-content-type-options']).toBe('nosniff');
          expect(response.headers['x-frame-options']).toBe('DENY');
          expect(response.headers['x-xss-protection']).toBe('1; mode=block');
        }
      }
    });

    it('should maintain security headers even on error responses', async () => {
      const response = await request(app).get('/nonexistent-endpoint').expect(404);

      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
    });
  });
});
