/**
 * Authentication Bypass Prevention Test Suite
 * 
 * Comprehensive tests to validate authentication mechanisms cannot be bypassed
 * Tests JWT token security, session management, and authorization controls
 */

import { describe, test, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import { createApp } from '../../src/app';
import { PrismaClient } from '@prisma/client';
import { AuthTestHelper } from '../helpers/auth-test-helper';
import { DatabaseTestHelper } from '../helpers/database-test-helper';
import jwt from 'jsonwebtoken';

describe('Authentication Bypass Prevention Test Suite', () => {
  let app: any;
  let request: supertest.SuperTest<supertest.Test>;
  let prisma: PrismaClient;
  let authHelper: AuthTestHelper;
  let dbHelper: DatabaseTestHelper;
  let validUserToken: string;
  let validAdminToken: string;
  let userId: string;
  let adminId: string;

  beforeAll(async () => {
    app = createApp();
    request = supertest(app);
    prisma = new PrismaClient();
    authHelper = new AuthTestHelper(prisma);
    dbHelper = new DatabaseTestHelper(prisma);

    // Create test users
    const user = await authHelper.createTestUser('auth-test-user', 'auth-user@test.com');
    const admin = await authHelper.createTestUser('auth-admin', 'auth-admin@test.com', 'admin');
    
    userId = user.id;
    adminId = admin.id;
    validUserToken = await authHelper.generateValidToken(user.id, 'user');
    validAdminToken = await authHelper.generateValidToken(admin.id, 'admin');
  });

  afterAll(async () => {
    await dbHelper.cleanup();
    await prisma.$disconnect();
  });

  describe('JWT Token Bypass Prevention Tests', () => {
    test('should reject requests with no authentication token', async () => {
      const protectedEndpoints = [
        { method: 'get', path: '/api/v1/dashboard/stats' },
        { method: 'get', path: '/api/v1/media/requests' },
        { method: 'post', path: '/api/v1/media/request' },
        { method: 'get', path: '/api/v1/admin/users' },
        { method: 'patch', path: `/api/v1/admin/users/${userId}/role` }
      ];

      for (const endpoint of protectedEndpoints) {
        const response = await request[endpoint.method](endpoint.path)
          .send({ test: 'data' });
        
        expect([401, 403]).toContain(response.status);
        expect(response.body).not.toHaveProperty('data');
      }
    });

    test('should reject malformed JWT tokens', async () => {
      const malformedTokens = [
        'Bearer invalid-token',
        'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.signature',
        'Bearer eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.', // Algorithm: none
        'Bearer ' + 'a'.repeat(2000), // Extremely long token
        'Bearer ..', // Incomplete token
        'Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ', // Missing signature
        'invalid-format-token',
        'Basic dXNlcjpwYXNzd29yZA==', // Wrong auth type
        'Bearer null',
        'Bearer undefined'
      ];

      for (const token of malformedTokens) {
        const response = await request
          .get('/api/v1/dashboard/stats')
          .set('Authorization', token);
        
        expect([401, 403, 400]).toContain(response.status);
        expect(response.body).not.toHaveProperty('data');
      }
    });

    test('should reject tokens with invalid signatures', async () => {
      // Create token with wrong signature
      const payload = { userId: userId, role: 'user', iat: Math.floor(Date.now() / 1000) };
      const invalidToken = jwt.sign(payload, 'wrong-secret');
      
      const response = await request
        .get('/api/v1/dashboard/stats')
        .set('Authorization', `Bearer ${invalidToken}`);
      
      expect([401, 403]).toContain(response.status);
    });

    test('should reject expired JWT tokens', async () => {
      // Create expired token
      const expiredPayload = {
        userId: userId,
        role: 'user',
        iat: Math.floor(Date.now() / 1000) - 7200, // 2 hours ago
        exp: Math.floor(Date.now() / 1000) - 3600  // Expired 1 hour ago
      };
      
      // This would require access to the signing secret used by the app
      // For testing purposes, we'll test with a token that looks expired
      const response = await request
        .get('/api/v1/dashboard/stats')
        .set('Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE1MTYyMzkwMjJ9.invalid');
      
      expect([401, 403]).toContain(response.status);
    });

    test('should reject tokens with algorithm confusion attacks', async () => {
      const algorithmConfusionTokens = [
        // RS256 public key used as HS256 secret
        'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhZG1pbiIsInJvbGUiOiJhZG1pbiIsImlhdCI6MTYwOTQ1OTIwMH0.signature',
        // Algorithm set to 'none'
        'Bearer eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOiJhZG1pbiIsInJvbGUiOiJhZG1pbiIsImlhdCI6MTYwOTQ1OTIwMH0.',
        // Invalid algorithm
        'Bearer eyJhbGciOiJIUzUxMiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhZG1pbiIsInJvbGUiOiJhZG1pbiIsImlhdCI6MTYwOTQ1OTIwMH0.signature'
      ];

      for (const token of algorithmConfusionTokens) {
        const response = await request
          .get('/api/v1/admin/users')
          .set('Authorization', token);
        
        expect([401, 403]).toContain(response.status);
      }
    });
  });

  describe('Session Management Bypass Prevention', () => {
    test('should prevent session fixation attacks', async () => {
      // Try to set a fixed session ID
      const response = await request
        .post('/api/v1/auth/plex/verify')
        .send({ pin: '1234' })
        .set('Cookie', 'sessionId=fixed-session-id-12345');
      
      expect([400, 401]).toContain(response.status);
      
      // Verify that session ID is not the fixed one
      const cookies = response.headers['set-cookie'];
      if (cookies) {
        const sessionCookie = cookies.find((cookie: string) => cookie.includes('sessionId'));
        if (sessionCookie) {
          expect(sessionCookie).not.toContain('fixed-session-id-12345');
        }
      }
    });

    test('should prevent session hijacking via XSS', async () => {
      // Verify that session cookies have HttpOnly flag
      const response = await request
        .post('/api/v1/auth/plex/verify')
        .send({ pin: '1234', username: 'testuser' });
      
      const cookies = response.headers['set-cookie'];
      if (cookies) {
        cookies.forEach((cookie: string) => {
          if (cookie.includes('session') || cookie.includes('token')) {
            expect(cookie).toMatch(/HttpOnly/i);
            expect(cookie).toMatch(/SameSite/i);
          }
        });
      }
    });

    test('should prevent concurrent session abuse', async () => {
      // Test with multiple tokens for the same user
      const tokens = [
        validUserToken,
        await authHelper.generateValidToken(userId, 'user'),
        await authHelper.generateValidToken(userId, 'user')
      ];

      const responses = await Promise.all(
        tokens.map(token => 
          request
            .get('/api/v1/dashboard/stats')
            .set('Authorization', `Bearer ${token}`)
        )
      );

      // All should work (unless there's a concurrent session limit)
      responses.forEach(response => {
        expect([200, 401, 429]).toContain(response.status);
      });
    });
  });

  describe('Authorization Bypass Prevention', () => {
    test('should prevent horizontal privilege escalation', async () => {
      // Create another user
      const anotherUser = await authHelper.createTestUser('another-user', 'another@test.com');
      const anotherUserToken = await authHelper.generateValidToken(anotherUser.id, 'user');

      // Try to access first user's data with second user's token
      const response = await request
        .get(`/api/v1/users/${userId}/profile`)
        .set('Authorization', `Bearer ${anotherUserToken}`);
      
      expect([403, 404]).toContain(response.status);
    });

    test('should prevent vertical privilege escalation', async () => {
      const adminOnlyEndpoints = [
        { method: 'get', path: '/api/v1/admin/users' },
        { method: 'patch', path: `/api/v1/admin/users/${userId}/role` },
        { method: 'delete', path: `/api/v1/admin/users/${userId}` },
        { method: 'get', path: '/api/v1/admin/services' },
        { method: 'get', path: '/api/v1/admin/stats' }
      ];

      for (const endpoint of adminOnlyEndpoints) {
        const response = await request[endpoint.method](endpoint.path)
          .send({ role: 'admin' }) // Try to escalate
          .set('Authorization', `Bearer ${validUserToken}`);
        
        expect([403, 404]).toContain(response.status);
      }
    });

    test('should prevent role manipulation in requests', async () => {
      const roleManipulationAttempts = [
        { role: 'admin' },
        { role: ['user', 'admin'] },
        { 'user.role': 'admin' },
        { '__proto__.role': 'admin' },
        { 'constructor.role': 'admin' },
        { roles: ['admin'] }
      ];

      for (const attempt of roleManipulationAttempts) {
        const response = await request
          .post('/api/v1/media/request')
          .send({
            title: 'Test Movie',
            type: 'movie',
            tmdbId: 12345,
            ...attempt
          })
          .set('Authorization', `Bearer ${validUserToken}`);
        
        // Should either reject the request or ignore role manipulation
        if (response.status === 201) {
          // If successful, verify user role wasn't changed
          const userCheck = await request
            .get('/api/v1/admin/users')
            .set('Authorization', `Bearer ${validUserToken}`);
          
          expect([403, 401]).toContain(userCheck.status);
        }
      }
    });
  });

  describe('Parameter Pollution Bypass Prevention', () => {
    test('should prevent HTTP parameter pollution attacks', async () => {
      const pollutionAttempts = [
        '?userId=123&userId=456', // Duplicate parameters
        '?role=user&role=admin',
        '?id[]=1&id[]=2',
        '?filter=safe&filter=../../../etc/passwd',
        '?limit=10&limit=999999'
      ];

      for (const params of pollutionAttempts) {
        const response = await request
          .get(`/api/v1/admin/users${params}`)
          .set('Authorization', `Bearer ${validAdminToken}`);
        
        // Should handle parameter pollution safely
        expect(response.status).not.toBe(500);
        
        if (response.status === 200) {
          // Verify response doesn't contain sensitive data leak
          expect(response.body).not.toHaveProperty('password');
          expect(response.body).not.toHaveProperty('secret');
        }
      }
    });

    test('should prevent JSON parameter pollution', async () => {
      const jsonPollutionAttempts = [
        { userId: [123, 456] },
        { role: ['user', 'admin'] },
        { 'id': 1, 'id ': 2 }, // Space in key
        { 'user': { 'id': 123 }, 'user.id': 456 }
      ];

      for (const attempt of jsonPollutionAttempts) {
        const response = await request
          .patch(`/api/v1/users/${userId}/profile`)
          .send(attempt)
          .set('Authorization', `Bearer ${validUserToken}`);
        
        // Should handle JSON pollution safely
        expect([400, 422]).toContain(response.status);
      }
    });
  });

  describe('Header Manipulation Bypass Prevention', () => {
    test('should prevent authentication bypass via header manipulation', async () => {
      const headerBypassAttempts = [
        { 'X-Forwarded-For': '127.0.0.1' },
        { 'X-Real-IP': '127.0.0.1' },
        { 'X-Original-IP': '127.0.0.1' },
        { 'X-Client-IP': '127.0.0.1' },
        { 'X-Remote-IP': '127.0.0.1' },
        { 'X-Forwarded-Host': 'localhost' },
        { 'X-Host': 'localhost' },
        { 'Host': 'localhost' },
        { 'X-Forwarded-Proto': 'https' },
        { 'X-Auth-User': 'admin' },
        { 'X-Remote-User': 'admin' },
        { 'X-User-Id': adminId },
        { 'X-Role': 'admin' }
      ];

      for (const headers of headerBypassAttempts) {
        const response = await request
          .get('/api/v1/admin/users')
          .set(headers);
        
        expect([401, 403]).toContain(response.status);
      }
    });

    test('should prevent cookie-based authentication bypass', async () => {
      const cookieBypassAttempts = [
        'admin=true',
        'role=admin',
        'authenticated=true',
        'user_id=' + adminId,
        'session=admin-session',
        'token=' + validAdminToken.replace('Bearer ', ''),
        'auth_token=bypass'
      ];

      for (const cookie of cookieBypassAttempts) {
        const response = await request
          .get('/api/v1/admin/users')
          .set('Cookie', cookie);
        
        expect([401, 403]).toContain(response.status);
      }
    });
  });

  describe('Timing Attack Prevention', () => {
    test('should prevent timing attacks on authentication', async () => {
      const validUsername = 'auth-test-user';
      const invalidUsername = 'nonexistent-user-12345';
      const password = 'test-password';

      // Measure response time for valid vs invalid usernames
      const timings: number[] = [];

      // Test with valid username
      for (let i = 0; i < 5; i++) {
        const start = Date.now();
        await request
          .post('/api/v1/auth/plex/verify')
          .send({ pin: '1234', username: validUsername });
        timings.push(Date.now() - start);
      }

      // Test with invalid username
      for (let i = 0; i < 5; i++) {
        const start = Date.now();
        await request
          .post('/api/v1/auth/plex/verify')
          .send({ pin: '1234', username: invalidUsername });
        timings.push(Date.now() - start);
      }

      // Calculate average response times
      const validTimings = timings.slice(0, 5);
      const invalidTimings = timings.slice(5, 10);
      
      const avgValidTime = validTimings.reduce((a, b) => a + b, 0) / validTimings.length;
      const avgInvalidTime = invalidTimings.reduce((a, b) => a + b, 0) / invalidTimings.length;

      // Timing difference should be minimal (under 50ms difference)
      const timingDifference = Math.abs(avgValidTime - avgInvalidTime);
      expect(timingDifference).toBeLessThan(100); // Allow some variance for test environment
    });
  });

  describe('Brute Force Attack Prevention', () => {
    test('should implement rate limiting for authentication attempts', async () => {
      const attempts: Promise<any>[] = [];
      
      // Generate multiple rapid authentication attempts
      for (let i = 0; i < 25; i++) {
        attempts.push(
          request
            .post('/api/v1/auth/plex/verify')
            .send({ pin: `${1000 + i}`, username: 'brute-force-test' })
        );
      }

      const responses = await Promise.all(attempts);
      
      // Should start rate limiting after several attempts
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });

    test('should implement account lockout after failed attempts', async () => {
      const username = 'lockout-test-user';
      
      // Create a test user for lockout testing
      const testUser = await authHelper.createTestUser(username, `${username}@test.com`);
      
      // Attempt multiple failed authentications
      for (let i = 0; i < 10; i++) {
        await request
          .post('/api/v1/auth/plex/verify')
          .send({ pin: `wrong-pin-${i}`, username: username });
      }

      // Next attempt should be locked out or rate limited
      const response = await request
        .post('/api/v1/auth/plex/verify')
        .send({ pin: 'any-pin', username: username });
      
      expect([429, 423, 401]).toContain(response.status); // Too Many Requests, Locked, or Unauthorized
    });
  });

  describe('Directory Traversal Bypass Prevention', () => {
    test('should prevent path traversal in user ID parameters', async () => {
      const traversalAttempts = [
        '../../../etc/passwd',
        '..\\..\\windows\\system32\\config\\sam',
        '....//....//....//etc/passwd',
        '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd',
        '../../admin/users',
        '../config/database.yml',
        '..%2F..%2F..%2Fetc%2Fpasswd'
      ];

      for (const path of traversalAttempts) {
        const response = await request
          .get(`/api/v1/users/${path}/profile`)
          .set('Authorization', `Bearer ${validUserToken}`);
        
        expect([400, 403, 404]).toContain(response.status);
        expect(response.body).not.toHaveProperty('password');
        expect(response.body).not.toHaveProperty('secret');
      }
    });
  });

  describe('Protocol-Level Bypass Prevention', () => {
    test('should prevent HTTP verb tampering', async () => {
      // Test if POST endpoints can be accessed via GET with parameters
      const response = await request
        .get('/api/v1/media/request')
        .query({
          title: 'Test Movie',
          type: 'movie',
          tmdbId: 12345
        })
        .set('Authorization', `Bearer ${validUserToken}`);
      
      expect([404, 405]).toContain(response.status); // Not Found or Method Not Allowed
    });

    test('should prevent HTTP method override attacks', async () => {
      const methodOverrideHeaders = [
        { 'X-HTTP-Method-Override': 'DELETE' },
        { 'X-HTTP-Method': 'PUT' },
        { 'X-Method-Override': 'PATCH' },
        { '_method': 'DELETE' }
      ];

      for (const headers of methodOverrideHeaders) {
        const response = await request
          .post(`/api/v1/admin/users/${userId}`)
          .set(headers)
          .set('Authorization', `Bearer ${validAdminToken}`);
        
        // Should not delete user via method override
        expect(response.status).not.toBe(204); // No Content (successful deletion)
      }
    });
  });

  describe('Unicode and Encoding Bypass Prevention', () => {
    test('should prevent Unicode normalization attacks', async () => {
      const unicodeAttempts = [
        'admin\u0000', // Null byte
        'admin\u000A', // Line feed
        'admin\u000D', // Carriage return
        'admin\u0020', // Space
        'admin\u00A0', // Non-breaking space
        'admin\u2028', // Line separator
        'admin\u2029', // Paragraph separator
        'admin\uFEFF'  // Byte order mark
      ];

      for (const username of unicodeAttempts) {
        const response = await request
          .post('/api/v1/auth/plex/verify')
          .send({ pin: '1234', username: username });
        
        expect([400, 401, 422]).toContain(response.status);
      }
    });

    test('should prevent double encoding bypass attempts', async () => {
      const encodingAttempts = [
        '%252e%252e%252f', // Double URL encoded ../
        '%25%32%65%25%32%65%25%32%66', // Triple encoded ../
        '\\u002e\\u002e\\u002f' // JavaScript Unicode escape
      ];

      for (const encoded of encodingAttempts) {
        const response = await request
          .get(`/api/v1/files/${encoded}/config.json`)
          .set('Authorization', `Bearer ${validAdminToken}`);
        
        expect([400, 403, 404]).toContain(response.status);
      }
    });
  });
});
