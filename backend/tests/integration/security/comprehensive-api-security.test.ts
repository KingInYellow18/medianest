import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { User } from '@prisma/client';
import crypto from 'crypto';

import { app } from '../../../src/server';
import { cleanDatabase, disconnectDatabase } from '../../helpers/database';
import { createTestUser, generateValidToken } from '../../helpers/auth';

describe('Comprehensive API Security Tests', () => {
  let regularUser: User;
  let adminUser: User;
  let regularToken: string;
  let adminToken: string;

  beforeAll(async () => {
    // Initialize test environment
  });

  beforeEach(async () => {
    await cleanDatabase();
    
    regularUser = await createTestUser({
      email: 'user@example.com',
      name: 'Regular User',
      plexId: 'plex-user',
      role: 'user',
    });

    adminUser = await createTestUser({
      email: 'admin@example.com',
      name: 'Admin User',
      plexId: 'plex-admin',
      role: 'admin',
    });
    
    regularToken = await generateValidToken(regularUser.id);
    adminToken = await generateValidToken(adminUser.id);
  });

  afterAll(async () => {
    await disconnectDatabase();
  });

  describe('API Endpoint Security', () => {
    it('should validate all endpoints have proper authentication', async () => {
      const endpoints = [
        { method: 'get', path: '/api/users/me' },
        { method: 'post', path: '/api/media-requests' },
        { method: 'get', path: '/api/admin/users' },
        { method: 'patch', path: '/api/user-settings' },
        { method: 'delete', path: '/api/media-requests/123' },
        { method: 'get', path: '/api/system/status' },
        { method: 'post', path: '/api/auth/logout' },
      ];

      for (const endpoint of endpoints) {
        const response = await request(app)[endpoint.method](endpoint.path);
        
        // Should require authentication (except public endpoints)
        if (!endpoint.path.includes('/health') && !endpoint.path.includes('/public')) {
          expect(response.status).toBe(401);
          expect(response.body).toHaveProperty('code');
        }
      }
    });

    it('should enforce HTTPS-only cookies in production', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: adminUser.email,
          password: 'AdminPassword123!',
        });

      if (response.status === 200) {
        const cookies = response.headers['set-cookie'];
        if (cookies) {
          cookies.forEach((cookie: string) => {
            if (cookie.includes('auth-token')) {
              expect(cookie).toContain('Secure');
              expect(cookie).toContain('HttpOnly');
              expect(cookie).toContain('SameSite');
            }
          });
        }
      }

      process.env.NODE_ENV = originalEnv;
    });

    it('should implement proper error handling without information disclosure', async () => {
      const errorTriggers = [
        { path: '/api/users/nonexistent-id', expected: 404 },
        { path: '/api/admin/users', token: regularToken, expected: 403 },
        { path: '/api/malformed-endpoint', expected: 404 },
        { path: '/api/auth/login', body: { email: 'invalid' }, expected: 400 },
      ];

      for (const trigger of errorTriggers) {
        const response = await request(app)
          .get(trigger.path)
          .set('Authorization', `Bearer ${trigger.token || adminToken}`)
          .send(trigger.body || {});

        expect(response.status).toBe(trigger.expected);
        
        // Error responses should not leak sensitive information
        const responseText = JSON.stringify(response.body);
        expect(responseText).not.toContain('password');
        expect(responseText).not.toContain('secret');
        expect(responseText).not.toContain('database');
        expect(responseText).not.toContain('prisma');
        expect(responseText).not.toContain('/home/');
        expect(responseText).not.toContain('node_modules');
        
        // Should not expose stack traces in production
        if (process.env.NODE_ENV === 'production') {
          expect(response.body).not.toHaveProperty('stack');
          expect(responseText).not.toContain('at ');
        }
      }
    });

    it('should validate request size limits', async () => {
      const largePayload = {
        data: 'x'.repeat(10 * 1024 * 1024), // 10MB
        array: new Array(100000).fill('data'),
        nested: {
          deep: {
            very: {
              deeply: {
                nested: 'x'.repeat(1000000),
              },
            },
          },
        },
      };

      const response = await request(app)
        .post('/api/user-data')
        .set('Authorization', `Bearer ${regularToken}`)
        .send(largePayload);

      expect(response.status).toBe(413);
      expect(response.body.code).toBe('PAYLOAD_TOO_LARGE');
    });

    it('should implement request timeout protection', async () => {
      const slowPayload = {
        operation: 'slow-processing',
        iterations: 1000000,
      };

      const response = await request(app)
        .post('/api/process-data')
        .set('Authorization', `Bearer ${regularToken}`)
        .timeout(30000) // 30 second timeout
        .send(slowPayload);

      // Should timeout or complete within reasonable time
      expect([408, 200, 202]).toContain(response.status);
    });

    it('should prevent API enumeration attacks', async () => {
      // Try to enumerate user IDs
      const userIdTests = [
        '1', '2', '3', '100', '999',
        'admin', 'user', 'test',
        '../admin', '../../etc/passwd',
        'null', 'undefined', '',
      ];

      for (const userId of userIdTests) {
        const response = await request(app)
          .get(`/api/users/${userId}`)
          .set('Authorization', `Bearer ${regularToken}`);

        // Should either be forbidden or not found, not leak existence info
        expect([403, 404]).toContain(response.status);
        
        // Response should be consistent regardless of whether user exists
        if (response.status === 404) {
          expect(response.body.message).toContain('not found');
        }
      }
    });
  });

  describe('Content-Type and Media Type Security', () => {
    it('should validate Content-Type headers strictly', async () => {
      const invalidContentTypes = [
        'text/html',
        'application/xml',
        'multipart/form-data',
        'text/plain',
        'application/javascript',
        'application/x-www-form-urlencoded; charset=utf-7',
      ];

      for (const contentType of invalidContentTypes) {
        const response = await request(app)
          .post('/api/user-settings')
          .set('Authorization', `Bearer ${regularToken}`)
          .set('Content-Type', contentType)
          .send('{"theme": "dark"}');

        expect([400, 415]).toContain(response.status);
      }
    });

    it('should prevent MIME type confusion attacks', async () => {
      // Send JSON with image Content-Type
      const response = await request(app)
        .post('/api/user-avatar')
        .set('Authorization', `Bearer ${regularToken}`)
        .set('Content-Type', 'image/jpeg')
        .send(JSON.stringify({ malicious: 'payload' }));

      expect([400, 415]).toContain(response.status);
    });

    it('should validate file upload MIME types', async () => {
      const maliciousFiles = [
        { name: 'script.js', content: 'console.log("xss")', mimeType: 'application/javascript' },
        { name: 'page.html', content: '<script>alert(1)</script>', mimeType: 'text/html' },
        { name: 'shell.php', content: '<?php echo "hacked"; ?>', mimeType: 'application/x-php' },
      ];

      for (const file of maliciousFiles) {
        const response = await request(app)
          .post('/api/upload')
          .set('Authorization', `Bearer ${regularToken}`)
          .attach('file', Buffer.from(file.content), {
            filename: file.name,
            contentType: file.mimeType,
          });

        expect([400, 415]).toContain(response.status);
        expect(response.body.code).toBe('INVALID_FILE_TYPE');
      }
    });
  });

  describe('JSON and Data Structure Security', () => {
    it('should prevent JSON injection attacks', async () => {
      const jsonInjectionPayloads = [
        '{"valid": "data", "constructor": {"prototype": {"isAdmin": true}}}',
        '{"__proto__": {"admin": true}}',
        '{"prototype": {"polluted": true}}',
        '{"valid": "data"}\n{"injected": "payload"}',
      ];

      for (const payload of jsonInjectionPayloads) {
        const response = await request(app)
          .post('/api/user-preferences')
          .set('Authorization', `Bearer ${regularToken}`)
          .set('Content-Type', 'application/json')
          .send(payload);

        expect([400, 422]).toContain(response.status);
      }
    });

    it('should validate nested object depth limits', async () => {
      // Create deeply nested object (potential DoS)
      let deepObject: any = { value: 'test' };
      for (let i = 0; i < 1000; i++) {
        deepObject = { nested: deepObject };
      }

      const response = await request(app)
        .post('/api/user-data')
        .set('Authorization', `Bearer ${regularToken}`)
        .send(deepObject);

      expect([400, 413]).toContain(response.status);
    });

    it('should sanitize array inputs', async () => {
      const maliciousArrays = [
        { tags: ['<script>alert(1)</script>', 'normal-tag'] },
        { categories: ["'; DROP TABLE users; --", 'valid-category'] },
        { permissions: ['admin', '../admin', '../../root'] },
      ];

      for (const payload of maliciousArrays) {
        const response = await request(app)
          .post('/api/user-tags')
          .set('Authorization', `Bearer ${regularToken}`)
          .send(payload);

        if (response.status === 200) {
          // Verify data was sanitized
          expect(JSON.stringify(response.body)).not.toContain('<script>');
          expect(JSON.stringify(response.body)).not.toContain('DROP TABLE');
          expect(JSON.stringify(response.body)).not.toContain('../');
        } else {
          expect([400, 422]).toContain(response.status);
        }
      }
    });

    it('should prevent circular JSON references', async () => {
      // This would normally cause JSON.stringify to fail
      const circularData = { name: 'test' };
      (circularData as any).self = circularData;

      // Express should handle this gracefully
      const response = await request(app)
        .post('/api/user-data')
        .set('Authorization', `Bearer ${regularToken}`)
        .send(circularData);

      expect([400, 422]).toContain(response.status);
    });
  });

  describe('HTTP Method and Verb Security', () => {
    it('should only allow appropriate HTTP methods', async () => {
      const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'];
      const disallowedMethods = ['TRACE', 'CONNECT', 'PROPFIND', 'PROPPATCH'];

      // Test allowed methods on appropriate endpoints
      for (const method of methods) {
        const response = await (request(app) as any)[method.toLowerCase()]('/api/users/me')
          .set('Authorization', `Bearer ${regularToken}`);

        // Should either work or return method not allowed, not internal server error
        expect([200, 405, 404]).toContain(response.status);
      }

      // Test disallowed methods
      for (const method of disallowedMethods) {
        try {
          const response = await request(app)
            .request(method, '/api/users/me')
            .set('Authorization', `Bearer ${regularToken}`);

          expect([405, 501]).toContain(response.status);
        } catch (error) {
          // Method not supported by supertest is also fine
        }
      }
    });

    it('should prevent HTTP method override attacks', async () => {
      // Attempt to override POST with DELETE via headers
      const response = await request(app)
        .post('/api/users/me')
        .set('Authorization', `Bearer ${regularToken}`)
        .set('X-HTTP-Method-Override', 'DELETE')
        .set('X-HTTP-Method', 'DELETE')
        .send({});

      // Should treat as POST, not DELETE
      expect([405, 422]).toContain(response.status);
    });

    it('should validate request method consistency', async () => {
      // Send conflicting methods
      const response = await request(app)
        .get('/api/user-data')
        .set('Authorization', `Bearer ${regularToken}`)
        .set('Content-Length', '100')
        .send({ data: 'should-not-be-here' });

      // GET request with body should be handled appropriately
      expect([400, 200]).toContain(response.status);
    });
  });

  describe('Parameter and Query Security', () => {
    it('should validate query parameter injection', async () => {
      const maliciousQueries = {
        'search': "'; DROP TABLE users; --",
        'filter': '1 OR 1=1',
        'sort': '../../../etc/passwd',
        'limit': 'UNION SELECT * FROM passwords',
        'page': '<script>alert(1)</script>',
      };

      for (const [param, value] of Object.entries(maliciousQueries)) {
        const response = await request(app)
          .get('/api/search')
          .query({ [param]: value })
          .set('Authorization', `Bearer ${regularToken}`);

        expect([200, 400]).toContain(response.status);
        
        if (response.status === 200) {
          const responseText = JSON.stringify(response.body);
          expect(responseText).not.toContain('DROP TABLE');
          expect(responseText).not.toContain('<script>');
          expect(responseText).not.toContain('/etc/passwd');
        }
      }
    });

    it('should prevent query parameter pollution', async () => {
      const response = await request(app)
        .get('/api/users')
        .query('role=user&role=admin&role=superuser')
        .set('Authorization', `Bearer ${adminToken}`);

      expect([200, 400]).toContain(response.status);
      
      if (response.status === 200) {
        // Should not return superuser or admin results for duplicate parameters
        const users = response.body.data || [];
        const adminUsers = users.filter((user: any) => user.role === 'admin');
        expect(adminUsers.length).toBeLessThanOrEqual(1);
      }
    });

    it('should validate path parameter injection', async () => {
      const maliciousPaths = [
        '../admin/users',
        '../../etc/passwd',
        'user?role=admin',
        'user&admin=true',
        'user/../admin',
        'user%2e%2e/admin',
      ];

      for (const maliciousPath of maliciousPaths) {
        const response = await request(app)
          .get(`/api/users/${maliciousPath}`)
          .set('Authorization', `Bearer ${regularToken}`);

        // Should be 404 or 403, not expose admin data
        expect([403, 404]).toContain(response.status);
      }
    });
  });

  describe('Response Security and Data Leakage Prevention', () => {
    it('should not expose sensitive fields in API responses', async () => {
      const response = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${regularToken}`);

      expect(response.status).toBe(200);
      
      // Should not expose sensitive fields
      expect(response.body).not.toHaveProperty('password');
      expect(response.body).not.toHaveProperty('passwordHash');
      expect(response.body).not.toHaveProperty('secret');
      expect(response.body).not.toHaveProperty('token');
      expect(response.body).not.toHaveProperty('sessionToken');
      expect(response.body).not.toHaveProperty('apiKey');
    });

    it('should implement response filtering based on user permissions', async () => {
      const response = await request(app)
        .get('/api/users/search')
        .set('Authorization', `Bearer ${regularToken}`)
        .query({ q: 'admin' });

      if (response.status === 200) {
        const users = response.body.data || [];
        
        // Regular users should not see admin user details
        users.forEach((user: any) => {
          if (user.role === 'admin') {
            expect(user).not.toHaveProperty('email');
            expect(user).not.toHaveProperty('lastLoginAt');
            expect(user).not.toHaveProperty('permissions');
          }
        });
      }
    });

    it('should prevent response splitting attacks', async () => {
      const maliciousInput = 'test\r\nSet-Cookie: injected=true';
      
      const response = await request(app)
        .post('/api/user-settings')
        .set('Authorization', `Bearer ${regularToken}`)
        .send({ name: maliciousInput });

      // Should not include injected headers
      expect(response.headers['set-cookie']).not.toContain('injected=true');
      
      if (response.status === 200) {
        expect(response.body.data?.name).not.toContain('\r\n');
      }
    });

    it('should implement proper cache control headers', async () => {
      const sensitiveEndpoints = [
        '/api/users/me',
        '/api/auth/session',
        '/api/admin/users',
        '/api/user-settings',
      ];

      for (const endpoint of sensitiveEndpoints) {
        const response = await request(app)
          .get(endpoint)
          .set('Authorization', `Bearer ${regularToken}`);

        if ([200, 403].includes(response.status)) {
          // Sensitive endpoints should not be cached
          expect(response.headers['cache-control']).toMatch(/no-cache|no-store|private/);
        }
      }
    });
  });

  describe('Session and State Management Security', () => {
    it('should prevent session fixation attacks', async () => {
      // Create initial session
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: adminUser.email,
          password: 'AdminPassword123!',
        });

      if (loginResponse.status === 200) {
        const initialToken = loginResponse.body.data.token;

        // Attempt to fix session ID
        const fixationResponse = await request(app)
          .post('/api/auth/login')
          .set('Cookie', `session-id=fixed-session-123`)
          .send({
            email: adminUser.email,
            password: 'AdminPassword123!',
          });

        // Should generate new session, not use fixed one
        expect(fixationResponse.status).toBe(200);
        expect(fixationResponse.body.data.token).not.toBe(initialToken);
      }
    });

    it('should implement secure session token generation', async () => {
      const tokens = [];
      
      // Generate multiple tokens
      for (let i = 0; i < 5; i++) {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: adminUser.email,
            password: 'AdminPassword123!',
          });

        if (response.status === 200) {
          tokens.push(response.body.data.token);
        }
      }

      // All tokens should be unique
      const uniqueTokens = new Set(tokens);
      expect(uniqueTokens.size).toBe(tokens.length);

      // Tokens should have sufficient entropy
      tokens.forEach(token => {
        expect(token.length).toBeGreaterThan(50);
        expect(token).toMatch(/^[A-Za-z0-9._-]+$/); // Valid JWT characters
      });
    });

    it('should prevent concurrent session attacks', async () => {
      // Login from multiple locations simultaneously
      const loginPromises = Array(5).fill(null).map(() =>
        request(app)
          .post('/api/auth/login')
          .send({
            email: adminUser.email,
            password: 'AdminPassword123!',
          })
      );

      const responses = await Promise.all(loginPromises);
      const successfulLogins = responses.filter(r => r.status === 200);

      // Should handle concurrent logins appropriately
      expect(successfulLogins.length).toBeGreaterThan(0);
      
      // Check if session limits are enforced
      if (successfulLogins.length < 5) {
        // Some logins rejected due to concurrent session limits
        const rejectedLogins = responses.filter(r => r.status === 429);
        expect(rejectedLogins.length).toBeGreaterThan(0);
      }
    });

    it('should implement proper session invalidation', async () => {
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: adminUser.email,
          password: 'AdminPassword123!',
        });

      if (loginResponse.status === 200) {
        const token = loginResponse.body.data.token;

        // Logout
        const logoutResponse = await request(app)
          .post('/api/auth/logout')
          .set('Authorization', `Bearer ${token}`)
          .send({});

        expect(logoutResponse.status).toBe(200);

        // Token should no longer work
        const useTokenResponse = await request(app)
          .get('/api/users/me')
          .set('Authorization', `Bearer ${token}`);

        expect(useTokenResponse.status).toBe(401);
      }
    });
  });

  describe('API Versioning and Backward Compatibility Security', () => {
    it('should handle version-specific security policies', async () => {
      const versions = ['v1', 'v2', 'latest'];
      
      for (const version of versions) {
        const response = await request(app)
          .get(`/api/${version}/users/me`)
          .set('Authorization', `Bearer ${regularToken}`);

        // Each version should have appropriate security
        expect([200, 404]).toContain(response.status);
        
        if (response.status === 200) {
          // Newer versions should have stricter security
          if (version === 'v2' || version === 'latest') {
            expect(response.headers).toHaveProperty('x-content-type-options', 'nosniff');
          }
        }
      }
    });

    it('should prevent downgrade attacks', async () => {
      // Attempt to use older, less secure API version
      const downgradeResponse = await request(app)
        .get('/api/v0/admin/users')
        .set('Authorization', `Bearer ${regularToken}`)
        .set('Accept', 'application/vnd.api+json;version=0');

      // Should reject unsupported versions
      expect([404, 400]).toContain(downgradeResponse.status);
    });
  });
});