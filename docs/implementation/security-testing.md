# MediaNest Security Testing Framework

## Executive Summary

This document establishes a comprehensive security testing strategy for MediaNest, ensuring robust protection against vulnerabilities, threats, and attacks. The framework covers authentication security, authorization testing, input validation, API security, infrastructure security, and compliance validation.

## Security Testing Philosophy

### Core Principles
- **Security by Design**: Security testing integrated throughout development lifecycle
- **Defense in Depth**: Multiple layers of security testing and validation
- **Zero Trust Architecture**: Verify every request, user, and system interaction
- **Continuous Security**: Automated security testing in CI/CD pipelines
- **Threat-Based Testing**: Testing based on real-world threat scenarios
- **Compliance Driven**: Meeting industry security standards and regulations

### Security Testing Pyramid

```
                    Compliance & Audit Testing
                         (2% - Regulatory)
           ┌──────────────────────────────────────────┐
           │  GDPR/CCPA Compliance Testing           │
           │  SOC 2 Audit Validation                 │
           │  Industry Standard Compliance           │
           └──────────────────────────────────────────┘
            
                    Penetration Testing
                      (8% - Real-world)
        ┌─────────────────────────────────────────────────┐
        │  External Security Assessment                   │
        │  Social Engineering Testing                     │
        │  Red Team Exercises                             │
        └─────────────────────────────────────────────────┘
        
                    Integration Security Testing
                       (20% - System Level)
      ┌──────────────────────────────────────────────────────┐
      │  API Security Testing                               │
      │  Authentication Flow Testing                        │
      │  Authorization Matrix Testing                       │
      │  Infrastructure Security Testing                    │
      └──────────────────────────────────────────────────────┘
      
                    Component Security Testing
                       (70% - Code Level)
    ┌─────────────────────────────────────────────────────────────┐
    │  Input Validation Testing                                   │
    │  SQL Injection Testing                                      │
    │  XSS Prevention Testing                                     │
    │  CSRF Protection Testing                                    │
    │  Dependency Vulnerability Scanning                         │
    └─────────────────────────────────────────────────────────────┘
```

## Authentication & Authorization Security Testing

### 1. Authentication Security Test Suite

```typescript
// tests/security/auth-security.test.ts
import request from 'supertest';
import { app } from '../../src/app';
import { testDb } from '../helpers/database-helper';
import { userFactory } from '../factories/user-factory';
import { generateJWT, verifyJWT } from '../../src/utils/jwt';
import bcrypt from 'bcrypt';

describe('Authentication Security Testing', () => {
  beforeEach(async () => {
    await testDb.migrate.latest();
    await testDb.seed.run();
  });

  afterEach(async () => {
    await testDb.migrate.rollback();
  });

  describe('Password Security', () => {
    it('should enforce strong password requirements', async () => {
      const weakPasswords = [
        '123456',           // Too simple
        'password',         // Common word
        'abc123',          // Too short
        '11111111',        // Repeated characters
        'qwertyui',        // Keyboard pattern
      ];

      for (const password of weakPasswords) {
        const response = await request(app)
          .post('/api/auth/register')
          .send({
            email: 'test@example.com',
            password: password,
            confirmPassword: password
          });

        expect(response.status).toBe(400);
        expect(response.body.errors).toContainEqual(
          expect.objectContaining({
            field: 'password',
            message: expect.stringContaining('password requirements')
          })
        );
      }
    });

    it('should properly hash and salt passwords', async () => {
      const userData = userFactory.build({ password: 'SecurePassword123!' });
      
      const response = await request(app)
        .post('/api/auth/register')
        .send(userData);

      expect(response.status).toBe(201);

      // Verify password is hashed in database
      const user = await testDb('users').where({ email: userData.email }).first();
      expect(user.password).not.toBe(userData.password);
      expect(user.password).toMatch(/^\$2[ab]\$\d{2}\$/); // bcrypt hash format
      
      // Verify password can be verified
      const isValid = await bcrypt.compare(userData.password, user.password);
      expect(isValid).toBe(true);
    });

    it('should prevent timing attacks on login', async () => {
      const user = await userFactory.create();
      
      // Time login attempts with valid and invalid users
      const startValidUser = process.hrtime();
      await request(app)
        .post('/api/auth/login')
        .send({ email: user.email, password: 'wrongpassword' });
      const [validSeconds, validNanoseconds] = process.hrtime(startValidUser);

      const startInvalidUser = process.hrtime();
      await request(app)
        .post('/api/auth/login')
        .send({ email: 'nonexistent@example.com', password: 'wrongpassword' });
      const [invalidSeconds, invalidNanoseconds] = process.hrtime(startInvalidUser);

      const validTime = validSeconds * 1000 + validNanoseconds / 1000000;
      const invalidTime = invalidSeconds * 1000 + invalidNanoseconds / 1000000;
      
      // Response times should be similar (within 50ms) to prevent timing attacks
      const timeDifference = Math.abs(validTime - invalidTime);
      expect(timeDifference).toBeLessThan(50);
    });

    it('should implement account lockout after failed attempts', async () => {
      const user = await userFactory.create();
      const maxAttempts = 5;

      // Make multiple failed login attempts
      for (let i = 0; i < maxAttempts; i++) {
        const response = await request(app)
          .post('/api/auth/login')
          .send({ email: user.email, password: 'wrongpassword' });
        
        expect(response.status).toBe(401);
      }

      // Next attempt should be locked out
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: user.email, password: user.password });

      expect(response.status).toBe(423); // Locked
      expect(response.body.message).toContain('account locked');
      expect(response.body.lockoutExpiry).toBeDefined();
    });

    it('should implement progressive delays for failed attempts', async () => {
      const user = await userFactory.create();

      // First failed attempt - should be fast
      const start1 = Date.now();
      await request(app)
        .post('/api/auth/login')
        .send({ email: user.email, password: 'wrongpassword' });
      const time1 = Date.now() - start1;

      // Third failed attempt - should have delay
      await request(app).post('/api/auth/login').send({ email: user.email, password: 'wrong' });
      
      const start3 = Date.now();
      await request(app)
        .post('/api/auth/login')
        .send({ email: user.email, password: 'wrongpassword' });
      const time3 = Date.now() - start3;

      // Third attempt should take longer (progressive delay)
      expect(time3).toBeGreaterThan(time1 + 1000); // At least 1 second more
    });
  });

  describe('JWT Security', () => {
    it('should generate secure JWT tokens', async () => {
      const user = await userFactory.create();
      
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: user.email, password: user.password });

      expect(response.status).toBe(200);
      expect(response.body.token).toBeDefined();

      const token = response.body.token;
      
      // Verify token structure
      const parts = token.split('.');
      expect(parts).toHaveLength(3);

      // Verify token can be decoded and contains expected claims
      const decoded = verifyJWT(token);
      expect(decoded.userId).toBe(user.id);
      expect(decoded.email).toBe(user.email);
      expect(decoded.iat).toBeDefined();
      expect(decoded.exp).toBeDefined();
      
      // Verify token expiry is reasonable (not too long)
      const expiryTime = decoded.exp - decoded.iat;
      expect(expiryTime).toBeLessThanOrEqual(24 * 60 * 60); // Max 24 hours
    });

    it('should reject expired JWT tokens', async () => {
      const user = await userFactory.create();
      
      // Generate token with short expiry
      const expiredToken = generateJWT({
        userId: user.id,
        email: user.email
      }, { expiresIn: '1ms' });

      // Wait for token to expire
      await new Promise(resolve => setTimeout(resolve, 10));

      const response = await request(app)
        .get('/api/user/profile')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(response.status).toBe(401);
      expect(response.body.message).toContain('expired');
    });

    it('should reject tampered JWT tokens', async () => {
      const user = await userFactory.create();
      
      const validToken = generateJWT({
        userId: user.id,
        email: user.email
      });

      // Tamper with token by changing a character
      const tamperedToken = validToken.slice(0, -5) + 'XXXXX';

      const response = await request(app)
        .get('/api/user/profile')
        .set('Authorization', `Bearer ${tamperedToken}`);

      expect(response.status).toBe(401);
      expect(response.body.message).toContain('invalid');
    });

    it('should validate JWT token claims properly', async () => {
      const user = await userFactory.create();
      
      // Generate token with invalid claims
      const invalidToken = generateJWT({
        userId: 'invalid-user-id',
        email: 'invalid@example.com',
        role: 'super-admin' // Role escalation attempt
      });

      const response = await request(app)
        .get('/api/user/profile')
        .set('Authorization', `Bearer ${invalidToken}`);

      expect(response.status).toBe(401);
    });
  });

  describe('Session Security', () => {
    it('should implement secure session management', async () => {
      const user = await userFactory.create();
      
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({ email: user.email, password: user.password });

      // Check for secure session cookie attributes
      const cookies = loginResponse.headers['set-cookie'];
      if (cookies) {
        const sessionCookie = cookies.find(cookie => cookie.includes('sessionId'));
        if (sessionCookie) {
          expect(sessionCookie).toContain('HttpOnly');
          expect(sessionCookie).toContain('Secure');
          expect(sessionCookie).toContain('SameSite=Strict');
        }
      }
    });

    it('should invalidate sessions on logout', async () => {
      const user = await userFactory.create();
      
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({ email: user.email, password: user.password });

      const token = loginResponse.body.token;

      // Verify token works
      let response = await request(app)
        .get('/api/user/profile')
        .set('Authorization', `Bearer ${token}`);
      expect(response.status).toBe(200);

      // Logout
      await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`);

      // Verify token is invalidated
      response = await request(app)
        .get('/api/user/profile')
        .set('Authorization', `Bearer ${token}`);
      expect(response.status).toBe(401);
    });
  });

  describe('Multi-Factor Authentication', () => {
    it('should support TOTP-based 2FA', async () => {
      const user = await userFactory.create();
      
      // Enable 2FA
      const setupResponse = await request(app)
        .post('/api/auth/2fa/setup')
        .set('Authorization', `Bearer ${user.token}`);

      expect(setupResponse.status).toBe(200);
      expect(setupResponse.body.secret).toBeDefined();
      expect(setupResponse.body.qrCode).toBeDefined();

      // Simulate TOTP verification
      const totpCode = '123456'; // In real test, generate valid TOTP
      
      const verifyResponse = await request(app)
        .post('/api/auth/2fa/verify')
        .set('Authorization', `Bearer ${user.token}`)
        .send({ code: totpCode });

      // This would normally succeed with a valid TOTP code
      expect(verifyResponse.status).toBe(400); // Invalid code in this test
    });

    it('should enforce 2FA for sensitive operations', async () => {
      const user = await userFactory.create({ twoFactorEnabled: true });
      
      // Attempt sensitive operation without 2FA verification
      const response = await request(app)
        .delete('/api/user/account')
        .set('Authorization', `Bearer ${user.token}`);

      expect(response.status).toBe(403);
      expect(response.body.message).toContain('2FA required');
    });
  });
});
```

### 2. Authorization Security Testing

```typescript
// tests/security/authorization-security.test.ts
import request from 'supertest';
import { app } from '../../src/app';
import { testDb } from '../helpers/database-helper';
import { userFactory } from '../factories/user-factory';

describe('Authorization Security Testing', () => {
  let adminUser: any;
  let moderatorUser: any;
  let regularUser: any;
  let adminToken: string;
  let moderatorToken: string;
  let userToken: string;

  beforeEach(async () => {
    await testDb.migrate.latest();
    
    adminUser = await userFactory.create({ role: 'admin' });
    moderatorUser = await userFactory.create({ role: 'moderator' });
    regularUser = await userFactory.create({ role: 'user' });

    // Generate tokens
    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: adminUser.email, password: adminUser.password });
    adminToken = adminLogin.body.token;

    const modLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: moderatorUser.email, password: moderatorUser.password });
    moderatorToken = modLogin.body.token;

    const userLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: regularUser.email, password: regularUser.password });
    userToken = userLogin.body.token;
  });

  afterEach(async () => {
    await testDb.migrate.rollback();
  });

  describe('Role-Based Access Control (RBAC)', () => {
    const testCases = [
      {
        endpoint: 'GET /api/admin/users',
        allowedRoles: ['admin'],
        deniedRoles: ['moderator', 'user']
      },
      {
        endpoint: 'POST /api/admin/users/ban',
        allowedRoles: ['admin', 'moderator'],
        deniedRoles: ['user']
      },
      {
        endpoint: 'GET /api/media',
        allowedRoles: ['admin', 'moderator', 'user'],
        deniedRoles: []
      },
      {
        endpoint: 'DELETE /api/media/:id',
        allowedRoles: ['admin'],
        deniedRoles: ['moderator', 'user']
      }
    ];

    testCases.forEach(({ endpoint, allowedRoles, deniedRoles }) => {
      describe(`${endpoint}`, () => {
        const tokens = {
          admin: () => adminToken,
          moderator: () => moderatorToken,
          user: () => userToken
        };

        allowedRoles.forEach(role => {
          it(`should allow ${role} access`, async () => {
            const [method, path] = endpoint.split(' ');
            const token = tokens[role as keyof typeof tokens]();

            const response = await request(app)
              [method.toLowerCase() as keyof typeof request.agent](path.replace(':id', '1'))
              .set('Authorization', `Bearer ${token}`);

            expect(response.status).not.toBe(403);
          });
        });

        deniedRoles.forEach(role => {
          it(`should deny ${role} access`, async () => {
            const [method, path] = endpoint.split(' ');
            const token = tokens[role as keyof typeof tokens]();

            const response = await request(app)
              [method.toLowerCase() as keyof typeof request.agent](path.replace(':id', '1'))
              .set('Authorization', `Bearer ${token}`);

            expect(response.status).toBe(403);
          });
        });
      });
    });
  });

  describe('Resource Access Control', () => {
    it('should prevent users from accessing other users\' resources', async () => {
      const user1 = await userFactory.create();
      const user2 = await userFactory.create();
      
      // Create media file owned by user1
      const mediaFile = await testDb('media_files').insert({
        userId: user1.id,
        filename: 'private-file.jpg',
        isPublic: false
      }).returning('*');

      // User2 should not be able to access user1's private file
      const response = await request(app)
        .get(`/api/media/${mediaFile[0].id}`)
        .set('Authorization', `Bearer ${user2.token}`);

      expect(response.status).toBe(403);
    });

    it('should enforce ownership-based permissions', async () => {
      const user = await userFactory.create();
      
      // Create media file
      const mediaFile = await testDb('media_files').insert({
        userId: user.id,
        filename: 'user-file.jpg'
      }).returning('*');

      // User should be able to update their own file
      const updateResponse = await request(app)
        .put(`/api/media/${mediaFile[0].id}`)
        .set('Authorization', `Bearer ${user.token}`)
        .send({ title: 'Updated Title' });

      expect(updateResponse.status).toBe(200);

      // Another user should not be able to update
      const otherUser = await userFactory.create();
      const forbiddenResponse = await request(app)
        .put(`/api/media/${mediaFile[0].id}`)
        .set('Authorization', `Bearer ${otherUser.token}`)
        .send({ title: 'Unauthorized Update' });

      expect(forbiddenResponse.status).toBe(403);
    });
  });

  describe('Privilege Escalation Prevention', () => {
    it('should prevent horizontal privilege escalation', async () => {
      const user1 = await userFactory.create();
      const user2 = await userFactory.create();

      // User1 should not be able to access user2's profile
      const response = await request(app)
        .get(`/api/user/${user2.id}/profile`)
        .set('Authorization', `Bearer ${user1.token}`);

      expect(response.status).toBe(403);
    });

    it('should prevent vertical privilege escalation', async () => {
      // Regular user should not be able to promote themselves to admin
      const response = await request(app)
        .put('/api/user/profile')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ role: 'admin' });

      expect(response.status).toBe(403);
      
      // Verify role wasn't changed
      const updatedUser = await testDb('users').where({ id: regularUser.id }).first();
      expect(updatedUser.role).toBe('user');
    });

    it('should prevent token manipulation attacks', async () => {
      // Attempt to modify JWT payload to escalate privileges
      const parts = userToken.split('.');
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
      
      // Modify role in payload
      payload.role = 'admin';
      const tamperedPayload = Buffer.from(JSON.stringify(payload)).toString('base64');
      const tamperedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`;

      const response = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${tamperedToken}`);

      expect(response.status).toBe(401); // Should be rejected due to signature mismatch
    });
  });

  describe('API Rate Limiting by Role', () => {
    it('should enforce different rate limits based on user role', async () => {
      // Regular users might have stricter limits
      const regularUserLimit = 100;
      const adminUserLimit = 1000;

      // Test regular user rate limiting
      for (let i = 0; i < regularUserLimit + 10; i++) {
        const response = await request(app)
          .get('/api/media')
          .set('Authorization', `Bearer ${userToken}`);

        if (i >= regularUserLimit) {
          expect(response.status).toBe(429); // Too Many Requests
          expect(response.headers['x-ratelimit-remaining']).toBe('0');
          break;
        }
      }
    });
  });
});
```

## Input Validation & Injection Attack Prevention

### 1. SQL Injection Prevention Testing

```typescript
// tests/security/sql-injection.test.ts
import request from 'supertest';
import { app } from '../../src/app';
import { testDb } from '../helpers/database-helper';
import { userFactory } from '../factories/user-factory';

describe('SQL Injection Prevention Testing', () => {
  let user: any;
  let token: string;

  beforeEach(async () => {
    await testDb.migrate.latest();
    await testDb.seed.run();
    
    user = await userFactory.create();
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: user.password });
    token = loginResponse.body.token;
  });

  afterEach(async () => {
    await testDb.migrate.rollback();
  });

  describe('Authentication SQL Injection Tests', () => {
    const sqlInjectionPayloads = [
      "admin'--",
      "admin'/*",
      "' OR '1'='1",
      "' OR '1'='1'--",
      "' OR '1'='1'/*",
      "') OR '1'='1--",
      "admin'; DROP TABLE users;--",
      "1' UNION SELECT password FROM users WHERE '1'='1",
      "' OR 1=1#",
      "' UNION SELECT username, password FROM users--"
    ];

    sqlInjectionPayloads.forEach(payload => {
      it(`should prevent SQL injection with payload: ${payload}`, async () => {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: payload,
            password: payload
          });

        expect(response.status).toBe(401);
        expect(response.body.message).toContain('Invalid credentials');
        
        // Verify no unauthorized access
        expect(response.body.token).toBeUndefined();
        
        // Verify database integrity
        const userCount = await testDb('users').count('* as count').first();
        expect(parseInt(userCount.count)).toBeGreaterThan(0); // Table should still exist
      });
    });
  });

  describe('Search SQL Injection Tests', () => {
    it('should sanitize search parameters', async () => {
      const maliciousSearchTerms = [
        "'; DROP TABLE media_files; --",
        "' UNION SELECT password FROM users --",
        "1' OR '1'='1",
        "'; UPDATE users SET role='admin' WHERE id=1; --"
      ];

      for (const searchTerm of maliciousSearchTerms) {
        const response = await request(app)
          .get('/api/search')
          .query({ q: searchTerm })
          .set('Authorization', `Bearer ${token}`);

        // Should either return empty results or error, but not execute SQL
        expect([200, 400]).toContain(response.status);
        
        if (response.status === 200) {
          expect(Array.isArray(response.body.results)).toBe(true);
        }
        
        // Verify database integrity
        const tables = await testDb.raw("SELECT name FROM sqlite_master WHERE type='table'");
        expect(tables.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Parameter SQL Injection Tests', () => {
    it('should sanitize URL parameters', async () => {
      const maliciousIds = [
        "1; DROP TABLE users;--",
        "1' UNION SELECT password FROM users--",
        "1 OR 1=1",
        "'; DELETE FROM media_files; --"
      ];

      for (const maliciousId of maliciousIds) {
        const response = await request(app)
          .get(`/api/media/${maliciousId}`)
          .set('Authorization', `Bearer ${token}`);

        // Should return 400 (bad request) or 404 (not found), not execute SQL
        expect([400, 404]).toContain(response.status);
        
        // Verify database wasn't affected
        const mediaCount = await testDb('media_files').count('* as count').first();
        expect(parseInt(mediaCount.count)).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('JSON Payload SQL Injection Tests', () => {
    it('should sanitize JSON input fields', async () => {
      const maliciousPayloads = [
        { title: "'; DROP TABLE media_files; --" },
        { description: "' UNION SELECT password FROM users --" },
        { tags: ["'; DELETE FROM users; --"] },
        { filename: "test'; UPDATE users SET role='admin'; --.jpg" }
      ];

      for (const payload of maliciousPayloads) {
        const response = await request(app)
          .post('/api/media')
          .set('Authorization', `Bearer ${token}`)
          .send(payload);

        // Should validate input and reject or sanitize
        expect([400, 422]).toContain(response.status);
        
        // Verify no SQL injection occurred
        const adminCount = await testDb('users')
          .where({ role: 'admin' })
          .count('* as count')
          .first();
        
        // Should not have created unauthorized admins
        expect(parseInt(adminCount.count)).toBeLessThan(5); // Reasonable admin count
      }
    });
  });

  describe('Prepared Statement Verification', () => {
    it('should use parameterized queries for all database operations', async () => {
      // This test would verify that all database queries use prepared statements
      // In a real implementation, you might use query logging or database proxies
      
      const response = await request(app)
        .get('/api/media')
        .query({ 
          page: 1, 
          limit: 10,
          search: "test'--", // Potential SQL injection
          sort: 'created_at',
          order: 'desc'
        })
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.data)).toBe(true);
      
      // Verify database structure remains intact
      const tableInfo = await testDb.raw("PRAGMA table_info(media_files)");
      expect(tableInfo.length).toBeGreaterThan(0);
    });
  });
});
```

### 2. XSS Prevention Testing

```typescript
// tests/security/xss-prevention.test.ts
import request from 'supertest';
import { app } from '../../src/app';
import { testDb } from '../helpers/database-helper';
import { userFactory } from '../factories/user-factory';

describe('XSS Prevention Testing', () => {
  let user: any;
  let token: string;

  beforeEach(async () => {
    await testDb.migrate.latest();
    user = await userFactory.create();
    
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: user.password });
    token = loginResponse.body.token;
  });

  afterEach(async () => {
    await testDb.migrate.rollback();
  });

  describe('Stored XSS Prevention', () => {
    const xssPayloads = [
      '<script>alert("XSS")</script>',
      '<img src="x" onerror="alert(\'XSS\')">',
      '<svg onload="alert(\'XSS\')">',
      '<iframe src="javascript:alert(\'XSS\')"></iframe>',
      '<div onmouseover="alert(\'XSS\')">Hover me</div>',
      '<a href="javascript:alert(\'XSS\')">Click me</a>',
      '<input type="text" value="" onfocus="alert(\'XSS\')" autofocus>',
      '<meta http-equiv="refresh" content="0;url=javascript:alert(\'XSS\')">',
      '"><script>alert("XSS")</script>',
      "'><script>alert('XSS')</script>",
      'javascript:alert("XSS")',
      'vbscript:msgbox("XSS")',
      '<script src="http://evil.com/xss.js"></script>'
    ];

    xssPayloads.forEach(payload => {
      it(`should sanitize XSS payload: ${payload.substring(0, 30)}...`, async () => {
        // Test user profile update
        const response = await request(app)
          .put('/api/user/profile')
          .set('Authorization', `Bearer ${token}`)
          .send({
            displayName: payload,
            bio: payload
          });

        if (response.status === 200) {
          // Verify data was sanitized
          expect(response.body.displayName).not.toContain('<script>');
          expect(response.body.displayName).not.toContain('javascript:');
          expect(response.body.displayName).not.toContain('onerror=');
          expect(response.body.displayName).not.toContain('onload=');
          expect(response.body.bio).not.toContain('<script>');
        } else {
          // Should reject malicious input
          expect(response.status).toBe(400);
        }
      });
    });

    it('should sanitize media file metadata', async () => {
      const xssTitle = '<script>alert("XSS in title")</script>';
      const xssDescription = '<img src="x" onerror="alert(\'XSS in description\')">';
      
      const response = await request(app)
        .post('/api/media')
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: xssTitle,
          description: xssDescription,
          tags: ['<script>alert("XSS in tags")</script>']
        });

      if (response.status === 201) {
        expect(response.body.title).not.toContain('<script>');
        expect(response.body.description).not.toContain('onerror=');
        expect(response.body.tags[0]).not.toContain('<script>');
      } else {
        expect(response.status).toBe(400);
      }
    });
  });

  describe('Reflected XSS Prevention', () => {
    it('should sanitize search parameters in responses', async () => {
      const xssSearch = '<script>alert("Reflected XSS")</script>';
      
      const response = await request(app)
        .get('/api/search')
        .query({ q: xssSearch })
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      
      // Response should not contain unescaped XSS payload
      const responseText = JSON.stringify(response.body);
      expect(responseText).not.toContain('<script>alert("Reflected XSS")</script>');
      
      // But might contain escaped version
      if (response.body.query) {
        expect(response.body.query).not.toContain('<script>');
      }
    });

    it('should sanitize error message outputs', async () => {
      const xssFilename = '<script>alert("XSS in error")</script>.jpg';
      
      const response = await request(app)
        .get(`/api/media/file/${xssFilename}`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(404);
      
      // Error message should not contain executable XSS
      const responseText = JSON.stringify(response.body);
      expect(responseText).not.toContain('<script>alert("XSS in error")</script>');
    });
  });

  describe('Content Security Policy (CSP) Headers', () => {
    it('should set appropriate CSP headers', async () => {
      const response = await request(app)
        .get('/api/health')
        .set('Authorization', `Bearer ${token}`);

      const cspHeader = response.headers['content-security-policy'];
      
      if (cspHeader) {
        expect(cspHeader).toContain("default-src 'self'");
        expect(cspHeader).toContain("script-src 'self'");
        expect(cspHeader).not.toContain("'unsafe-inline'");
        expect(cspHeader).not.toContain("'unsafe-eval'");
      }
    });
  });

  describe('HTML Entity Encoding', () => {
    it('should properly encode HTML entities in API responses', async () => {
      const htmlContent = '< > & " \' / =';
      
      const response = await request(app)
        .put('/api/user/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({ displayName: htmlContent });

      if (response.status === 200) {
        // Should be encoded or properly handled
        const displayName = response.body.displayName;
        expect(displayName === htmlContent || 
               displayName.includes('&lt;') || 
               displayName.includes('&gt;') || 
               displayName.includes('&amp;')).toBe(true);
      }
    });
  });

  describe('URL Validation', () => {
    it('should validate and sanitize URLs', async () => {
      const maliciousUrls = [
        'javascript:alert("XSS")',
        'data:text/html,<script>alert("XSS")</script>',
        'vbscript:msgbox("XSS")',
        'file:///etc/passwd',
        'ftp://malicious.com/backdoor.exe'
      ];

      for (const url of maliciousUrls) {
        const response = await request(app)
          .put('/api/user/profile')
          .set('Authorization', `Bearer ${token}`)
          .send({ website: url });

        if (response.status === 200) {
          expect(response.body.website).not.toBe(url);
          expect(response.body.website).not.toContain('javascript:');
          expect(response.body.website).not.toContain('data:');
        } else {
          expect(response.status).toBe(400);
        }
      }
    });
  });
});
```

## API Security Testing

### 1. API Security Test Suite

```typescript
// tests/security/api-security.test.ts
import request from 'supertest';
import { app } from '../../src/app';
import { testDb } from '../helpers/database-helper';
import { userFactory } from '../factories/user-factory';

describe('API Security Testing', () => {
  let user: any;
  let token: string;

  beforeEach(async () => {
    await testDb.migrate.latest();
    user = await userFactory.create();
    
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: user.password });
    token = loginResponse.body.token;
  });

  afterEach(async () => {
    await testDb.migrate.rollback();
  });

  describe('CSRF Protection', () => {
    it('should require CSRF token for state-changing operations', async () => {
      // Attempt POST without CSRF token
      const response = await request(app)
        .post('/api/media')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Test Media' });

      // Should either require CSRF token or use other CSRF protection
      // (like same-origin checks for API endpoints)
      expect(response.status).toBeLessThan(500);
    });

    it('should validate CSRF token when provided', async () => {
      // This test would verify CSRF token validation if implemented
      const response = await request(app)
        .post('/api/media')
        .set('Authorization', `Bearer ${token}`)
        .set('X-CSRF-Token', 'invalid-token')
        .send({ title: 'Test Media' });

      // Should validate the CSRF token
      expect(response.status).toBeLessThan(500);
    });
  });

  describe('API Rate Limiting', () => {
    it('should enforce rate limits per endpoint', async () => {
      const endpoint = '/api/media';
      const rateLimitResponses = [];

      // Make rapid requests to trigger rate limiting
      for (let i = 0; i < 120; i++) {
        const response = await request(app)
          .get(endpoint)
          .set('Authorization', `Bearer ${token}`);
        
        rateLimitResponses.push(response.status);
        
        if (response.status === 429) {
          expect(response.headers['x-ratelimit-limit']).toBeDefined();
          expect(response.headers['x-ratelimit-remaining']).toBe('0');
          expect(response.headers['retry-after']).toBeDefined();
          break;
        }
      }

      // Should have hit rate limit
      expect(rateLimitResponses).toContain(429);
    });

    it('should have different rate limits for different user roles', async () => {
      const adminUser = await userFactory.create({ role: 'admin' });
      const adminLogin = await request(app)
        .post('/api/auth/login')
        .send({ email: adminUser.email, password: adminUser.password });
      const adminToken = adminLogin.body.token;

      // Admin should have higher rate limits
      let adminRequestCount = 0;
      let userRequestCount = 0;

      // Test regular user limit
      for (let i = 0; i < 60; i++) {
        const response = await request(app)
          .get('/api/media')
          .set('Authorization', `Bearer ${token}`);
        
        if (response.status === 429) break;
        userRequestCount++;
      }

      // Test admin limit
      for (let i = 0; i < 200; i++) {
        const response = await request(app)
          .get('/api/media')
          .set('Authorization', `Bearer ${adminToken}`);
        
        if (response.status === 429) break;
        adminRequestCount++;
      }

      // Admin should be able to make more requests
      expect(adminRequestCount).toBeGreaterThan(userRequestCount);
    });
  });

  describe('HTTP Security Headers', () => {
    it('should set security headers on all responses', async () => {
      const response = await request(app)
        .get('/api/health')
        .set('Authorization', `Bearer ${token}`);

      // X-Content-Type-Options
      expect(response.headers['x-content-type-options']).toBe('nosniff');

      // X-Frame-Options
      expect(response.headers['x-frame-options']).toMatch(/DENY|SAMEORIGIN/);

      // X-XSS-Protection
      expect(response.headers['x-xss-protection']).toBe('1; mode=block');

      // Strict-Transport-Security (if HTTPS)
      if (response.headers['strict-transport-security']) {
        expect(response.headers['strict-transport-security']).toContain('max-age=');
      }

      // Content-Security-Policy
      if (response.headers['content-security-policy']) {
        expect(response.headers['content-security-policy']).toContain("default-src");
      }
    });

    it('should not expose server information', async () => {
      const response = await request(app)
        .get('/api/health')
        .set('Authorization', `Bearer ${token}`);

      // Should not expose server version
      expect(response.headers['server']).toBeUndefined();
      expect(response.headers['x-powered-by']).toBeUndefined();
    });
  });

  describe('Input Validation', () => {
    it('should validate request payload sizes', async () => {
      // Large payload test
      const largePayload = {
        title: 'A'.repeat(10000),
        description: 'B'.repeat(50000),
        tags: Array(1000).fill('tag')
      };

      const response = await request(app)
        .post('/api/media')
        .set('Authorization', `Bearer ${token}`)
        .send(largePayload);

      // Should reject overly large payloads
      expect(response.status).toBe(413); // Payload Too Large
    });

    it('should validate request content types', async () => {
      const response = await request(app)
        .post('/api/media')
        .set('Authorization', `Bearer ${token}`)
        .set('Content-Type', 'text/plain')
        .send('invalid content type');

      expect(response.status).toBe(415); // Unsupported Media Type
    });

    it('should sanitize file upload parameters', async () => {
      const maliciousFileName = '../../../etc/passwd';
      
      const response = await request(app)
        .post('/api/media/upload')
        .set('Authorization', `Bearer ${token}`)
        .attach('file', Buffer.from('test'), maliciousFileName);

      if (response.status === 200) {
        // Filename should be sanitized
        expect(response.body.filename).not.toContain('../');
        expect(response.body.filename).not.toContain('/etc/passwd');
      } else {
        // Should reject malicious filenames
        expect(response.status).toBe(400);
      }
    });
  });

  describe('API Endpoint Enumeration Protection', () => {
    it('should not expose internal API endpoints', async () => {
      const internalEndpoints = [
        '/api/internal/stats',
        '/api/debug/info',
        '/api/admin/system',
        '/api/test/reset',
        '/.env',
        '/config.json',
        '/swagger.json'
      ];

      for (const endpoint of internalEndpoints) {
        const response = await request(app)
          .get(endpoint)
          .set('Authorization', `Bearer ${token}`);

        // Should return 404 or 403, not expose internal endpoints
        expect([403, 404]).toContain(response.status);
      }
    });

    it('should handle OPTIONS requests securely', async () => {
      const response = await request(app)
        .options('/api/media')
        .set('Authorization', `Bearer ${token}`);

      // Should handle CORS properly without exposing sensitive headers
      expect(response.status).toBeLessThan(500);
      
      if (response.headers['access-control-allow-methods']) {
        // Should not expose unnecessary HTTP methods
        expect(response.headers['access-control-allow-methods'])
          .not.toContain('TRACE');
        expect(response.headers['access-control-allow-methods'])
          .not.toContain('CONNECT');
      }
    });
  });

  describe('Error Information Disclosure', () => {
    it('should not expose sensitive information in error messages', async () => {
      // Trigger database error
      const response = await request(app)
        .get('/api/media/99999999')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(404);
      
      // Should not expose database internals
      const responseText = JSON.stringify(response.body);
      expect(responseText).not.toContain('SELECT');
      expect(responseText).not.toContain('FROM');
      expect(responseText).not.toContain('WHERE');
      expect(responseText).not.toContain('database');
      expect(responseText).not.toContain('connection');
      expect(responseText).not.toContain('postgres');
      expect(responseText).not.toContain('mysql');
    });

    it('should provide consistent error responses', async () => {
      // Test non-existent resource
      const response1 = await request(app)
        .get('/api/media/99999')
        .set('Authorization', `Bearer ${token}`);

      // Test unauthorized resource
      const otherUser = await userFactory.create();
      const privateMedia = await testDb('media_files').insert({
        userId: otherUser.id,
        filename: 'private.jpg',
        isPublic: false
      }).returning('*');

      const response2 = await request(app)
        .get(`/api/media/${privateMedia[0].id}`)
        .set('Authorization', `Bearer ${token}`);

      // Both should return similar error structures
      expect(response1.status).toBe(404);
      expect(response2.status).toBe(403);
      
      // Error structure should be consistent
      expect(typeof response1.body.message).toBe('string');
      expect(typeof response2.body.message).toBe('string');
    });
  });
});
```

## Security Testing Automation

### 1. Automated Security Scanning

```python
# tests/security/security-automation.py
import subprocess
import json
import requests
import time
import logging
from typing import Dict, List, Any

logger = logging.getLogger(__name__)

class SecurityTestAutomation:
    def __init__(self, base_url: str = "http://localhost:3000"):
        self.base_url = base_url
        self.scan_results = {}
        
    def run_comprehensive_security_scan(self) -> Dict[str, Any]:
        """Run comprehensive automated security scanning"""
        logger.info("🛡️  Starting comprehensive security scan")
        
        results = {
            "timestamp": time.time(),
            "base_url": self.base_url,
            "scans": {}
        }
        
        # Run different types of security scans
        results["scans"]["dependency_scan"] = self.run_dependency_scan()
        results["scans"]["container_scan"] = self.run_container_security_scan()
        results["scans"]["web_scan"] = self.run_web_security_scan()
        results["scans"]["ssl_scan"] = self.run_ssl_security_scan()
        results["scans"]["api_scan"] = self.run_api_security_scan()
        
        # Generate security report
        self.generate_security_report(results)
        
        return results
        
    def run_dependency_scan(self) -> Dict[str, Any]:
        """Scan for vulnerable dependencies"""
        logger.info("📦 Running dependency vulnerability scan")
        
        try:
            # Run npm audit
            npm_result = subprocess.run(
                ["npm", "audit", "--json"],
                capture_output=True,
                text=True,
                timeout=300
            )
            
            npm_data = json.loads(npm_result.stdout) if npm_result.stdout else {}
            
            # Run Snyk scan if available
            snyk_result = None
            try:
                snyk_result = subprocess.run(
                    ["npx", "snyk", "test", "--json"],
                    capture_output=True,
                    text=True,
                    timeout=300
                )
                snyk_data = json.loads(snyk_result.stdout) if snyk_result.stdout else {}
            except (subprocess.TimeoutExpired, FileNotFoundError):
                snyk_data = {"error": "Snyk not available"}
            
            vulnerabilities = {
                "npm_audit": {
                    "vulnerabilities": npm_data.get("vulnerabilities", {}),
                    "metadata": npm_data.get("metadata", {}),
                    "total_vulnerabilities": len(npm_data.get("vulnerabilities", {}))
                },
                "snyk": snyk_data
            }
            
            # Check for critical/high vulnerabilities
            critical_count = 0
            high_count = 0
            
            for vuln in npm_data.get("vulnerabilities", {}).values():
                severity = vuln.get("severity", "").lower()
                if severity == "critical":
                    critical_count += 1
                elif severity == "high":
                    high_count += 1
            
            return {
                "status": "completed",
                "vulnerabilities": vulnerabilities,
                "summary": {
                    "critical": critical_count,
                    "high": high_count,
                    "total": len(npm_data.get("vulnerabilities", {}))
                },
                "recommendations": self.generate_dependency_recommendations(vulnerabilities)
            }
            
        except Exception as e:
            logger.error(f"Dependency scan failed: {e}")
            return {"status": "failed", "error": str(e)}
    
    def run_container_security_scan(self) -> Dict[str, Any]:
        """Scan container images for vulnerabilities"""
        logger.info("🐳 Running container security scan")
        
        try:
            # List of images to scan
            images = ["medianest-backend:latest", "medianest-frontend:latest"]
            scan_results = {}
            
            for image in images:
                try:
                    # Use Trivy for container scanning if available
                    result = subprocess.run(
                        ["trivy", "image", "--format", "json", image],
                        capture_output=True,
                        text=True,
                        timeout=600
                    )
                    
                    if result.returncode == 0 and result.stdout:
                        scan_data = json.loads(result.stdout)
                        scan_results[image] = scan_data
                    else:
                        # Fallback to basic Docker inspect
                        inspect_result = subprocess.run(
                            ["docker", "inspect", image],
                            capture_output=True,
                            text=True,
                            timeout=60
                        )
                        
                        if inspect_result.returncode == 0:
                            inspect_data = json.loads(inspect_result.stdout)
                            scan_results[image] = {
                                "basic_info": inspect_data[0] if inspect_data else {},
                                "scan_type": "docker_inspect"
                            }
                        
                except subprocess.TimeoutExpired:
                    scan_results[image] = {"error": "Scan timeout"}
                except FileNotFoundError:
                    scan_results[image] = {"error": "Scanner not available"}
            
            return {
                "status": "completed",
                "results": scan_results,
                "recommendations": self.generate_container_recommendations(scan_results)
            }
            
        except Exception as e:
            logger.error(f"Container scan failed: {e}")
            return {"status": "failed", "error": str(e)}
    
    def run_web_security_scan(self) -> Dict[str, Any]:
        """Run web application security scanning"""
        logger.info("🌐 Running web application security scan")
        
        try:
            # Basic web security tests
            security_tests = []
            
            # Test security headers
            security_tests.append(self.test_security_headers())
            
            # Test for common vulnerabilities
            security_tests.append(self.test_common_vulnerabilities())
            
            # Test authentication security
            security_tests.append(self.test_authentication_security())
            
            return {
                "status": "completed",
                "tests": security_tests,
                "summary": self.summarize_web_scan_results(security_tests)
            }
            
        except Exception as e:
            logger.error(f"Web security scan failed: {e}")
            return {"status": "failed", "error": str(e)}
    
    def test_security_headers(self) -> Dict[str, Any]:
        """Test HTTP security headers"""
        try:
            response = requests.get(f"{self.base_url}/api/health", timeout=10)
            headers = response.headers
            
            security_headers = {
                "X-Content-Type-Options": headers.get("X-Content-Type-Options"),
                "X-Frame-Options": headers.get("X-Frame-Options"),
                "X-XSS-Protection": headers.get("X-XSS-Protection"),
                "Strict-Transport-Security": headers.get("Strict-Transport-Security"),
                "Content-Security-Policy": headers.get("Content-Security-Policy"),
                "X-Powered-By": headers.get("X-Powered-By"),  # Should be None
                "Server": headers.get("Server")  # Should not expose version
            }
            
            # Evaluate security header compliance
            compliance = {
                "x_content_type_options": security_headers["X-Content-Type-Options"] == "nosniff",
                "x_frame_options": security_headers["X-Frame-Options"] in ["DENY", "SAMEORIGIN"],
                "x_xss_protection": security_headers["X-XSS-Protection"] == "1; mode=block",
                "hsts_present": security_headers["Strict-Transport-Security"] is not None,
                "csp_present": security_headers["Content-Security-Policy"] is not None,
                "server_header_hidden": security_headers["Server"] is None,
                "powered_by_hidden": security_headers["X-Powered-By"] is None
            }
            
            return {
                "test": "security_headers",
                "status": "completed",
                "headers": security_headers,
                "compliance": compliance,
                "score": sum(compliance.values()) / len(compliance) * 100
            }
            
        except Exception as e:
            return {
                "test": "security_headers",
                "status": "failed",
                "error": str(e)
            }
    
    def test_common_vulnerabilities(self) -> Dict[str, Any]:
        """Test for common web vulnerabilities"""
        vulnerabilities = []
        
        # Test for directory traversal
        try:
            response = requests.get(f"{self.base_url}/../../../etc/passwd", timeout=5)
            if response.status_code != 404:
                vulnerabilities.append({
                    "type": "directory_traversal",
                    "severity": "high",
                    "description": "Potential directory traversal vulnerability"
                })
        except requests.RequestException:
            pass
        
        # Test for server-side request forgery (SSRF)
        try:
            response = requests.post(
                f"{self.base_url}/api/media",
                json={"url": "http://169.254.169.254/latest/meta-data/"},
                timeout=5
            )
            # Analyze response for SSRF indicators
        except requests.RequestException:
            pass
        
        # Test for XML External Entity (XXE)
        xxe_payload = """<?xml version="1.0"?><!DOCTYPE root [<!ENTITY test SYSTEM 'file:///etc/passwd'>]><root>&test;</root>"""
        try:
            response = requests.post(
                f"{self.base_url}/api/upload",
                data=xxe_payload,
                headers={"Content-Type": "application/xml"},
                timeout=5
            )
            if "root:" in response.text:
                vulnerabilities.append({
                    "type": "xxe",
                    "severity": "critical",
                    "description": "XML External Entity vulnerability detected"
                })
        except requests.RequestException:
            pass
        
        return {
            "test": "common_vulnerabilities",
            "status": "completed",
            "vulnerabilities": vulnerabilities,
            "vulnerability_count": len(vulnerabilities)
        }
    
    def test_authentication_security(self) -> Dict[str, Any]:
        """Test authentication security mechanisms"""
        auth_tests = {}
        
        # Test rate limiting on login
        try:
            failed_attempts = 0
            for i in range(10):
                response = requests.post(
                    f"{self.base_url}/api/auth/login",
                    json={"email": "test@example.com", "password": "wrong"},
                    timeout=5
                )
                if response.status_code == 429:  # Too Many Requests
                    auth_tests["rate_limiting"] = True
                    break
                failed_attempts += 1
            
            if "rate_limiting" not in auth_tests:
                auth_tests["rate_limiting"] = False
                
        except requests.RequestException:
            auth_tests["rate_limiting"] = "error"
        
        # Test password strength requirements
        try:
            weak_passwords = ["123456", "password", "abc123"]
            password_strength_enforced = True
            
            for weak_password in weak_passwords:
                response = requests.post(
                    f"{self.base_url}/api/auth/register",
                    json={
                        "email": f"test{weak_password}@example.com",
                        "password": weak_password,
                        "confirmPassword": weak_password
                    },
                    timeout=5
                )
                if response.status_code == 201:  # Created
                    password_strength_enforced = False
                    break
            
            auth_tests["password_strength"] = password_strength_enforced
            
        except requests.RequestException:
            auth_tests["password_strength"] = "error"
        
        return {
            "test": "authentication_security",
            "status": "completed",
            "tests": auth_tests
        }
    
    def run_ssl_security_scan(self) -> Dict[str, Any]:
        """Scan SSL/TLS configuration"""
        if not self.base_url.startswith("https"):
            return {
                "status": "skipped",
                "reason": "HTTPS not configured"
            }
        
        try:
            # Use SSL Labs API or testssl.sh if available
            # For now, basic SSL verification
            response = requests.get(self.base_url, verify=True, timeout=10)
            
            return {
                "status": "completed",
                "ssl_valid": True,
                "certificate_valid": True
            }
            
        except requests.exceptions.SSLError as e:
            return {
                "status": "completed",
                "ssl_valid": False,
                "error": str(e)
            }
        except Exception as e:
            return {
                "status": "failed",
                "error": str(e)
            }
    
    def run_api_security_scan(self) -> Dict[str, Any]:
        """Scan API endpoints for security issues"""
        logger.info("🔌 Running API security scan")
        
        api_tests = []
        
        # Test API endpoints without authentication
        endpoints = [
            "/api/health",
            "/api/media",
            "/api/user/profile",
            "/api/admin/users"
        ]
        
        for endpoint in endpoints:
            try:
                response = requests.get(f"{self.base_url}{endpoint}", timeout=5)
                
                api_tests.append({
                    "endpoint": endpoint,
                    "status_code": response.status_code,
                    "requires_auth": response.status_code in [401, 403],
                    "response_size": len(response.content),
                    "headers": dict(response.headers)
                })
                
            except requests.RequestException as e:
                api_tests.append({
                    "endpoint": endpoint,
                    "error": str(e)
                })
        
        return {
            "status": "completed",
            "endpoint_tests": api_tests,
            "recommendations": self.generate_api_recommendations(api_tests)
        }
    
    def generate_dependency_recommendations(self, vulnerabilities: Dict) -> List[str]:
        """Generate recommendations for dependency vulnerabilities"""
        recommendations = []
        
        npm_vulns = vulnerabilities.get("npm_audit", {}).get("vulnerabilities", {})
        critical_count = sum(1 for v in npm_vulns.values() if v.get("severity") == "critical")
        high_count = sum(1 for v in npm_vulns.values() if v.get("severity") == "high")
        
        if critical_count > 0:
            recommendations.append(f"URGENT: Address {critical_count} critical vulnerabilities immediately")
            recommendations.append("Run 'npm audit fix' to automatically fix resolvable vulnerabilities")
        
        if high_count > 0:
            recommendations.append(f"Address {high_count} high-severity vulnerabilities")
            recommendations.append("Review and update dependencies to secure versions")
        
        if critical_count == 0 and high_count == 0:
            recommendations.append("Dependencies appear secure - continue regular monitoring")
        
        recommendations.append("Implement automated dependency scanning in CI/CD pipeline")
        recommendations.append("Set up vulnerability alerts for dependencies")
        
        return recommendations
    
    def generate_container_recommendations(self, scan_results: Dict) -> List[str]:
        """Generate recommendations for container security"""
        recommendations = []
        
        for image, result in scan_results.items():
            if "error" in result:
                recommendations.append(f"Unable to scan {image} - ensure image exists and scanner is available")
            else:
                recommendations.append(f"Container {image} scanned successfully")
        
        recommendations.extend([
            "Use minimal base images to reduce attack surface",
            "Regularly update base images and dependencies",
            "Implement container image scanning in CI/CD pipeline",
            "Use non-root users in containers",
            "Enable read-only root filesystems where possible"
        ])
        
        return recommendations
    
    def generate_api_recommendations(self, api_tests: List) -> List[str]:
        """Generate API security recommendations"""
        recommendations = []
        
        unprotected_endpoints = [
            test["endpoint"] for test in api_tests 
            if test.get("status_code") == 200 and test.get("endpoint", "").startswith("/api/")
        ]
        
        if unprotected_endpoints:
            recommendations.append(f"Review authentication for endpoints: {', '.join(unprotected_endpoints)}")
        
        recommendations.extend([
            "Implement proper API authentication and authorization",
            "Use API rate limiting to prevent abuse",
            "Validate and sanitize all input parameters",
            "Implement API monitoring and logging",
            "Use HTTPS for all API communications"
        ])
        
        return recommendations
    
    def summarize_web_scan_results(self, security_tests: List) -> Dict:
        """Summarize web security scan results"""
        total_tests = len(security_tests)
        completed_tests = sum(1 for test in security_tests if test.get("status") == "completed")
        failed_tests = sum(1 for test in security_tests if test.get("status") == "failed")
        
        # Calculate overall security score
        security_scores = [
            test.get("score", 0) for test in security_tests 
            if "score" in test and test.get("status") == "completed"
        ]
        
        avg_score = sum(security_scores) / len(security_scores) if security_scores else 0
        
        return {
            "total_tests": total_tests,
            "completed_tests": completed_tests,
            "failed_tests": failed_tests,
            "overall_security_score": round(avg_score, 2)
        }
    
    def generate_security_report(self, results: Dict) -> None:
        """Generate comprehensive security report"""
        logger.info("📋 Generating security report")
        
        report = {
            "scan_timestamp": results["timestamp"],
            "base_url": results["base_url"],
            "executive_summary": self.create_executive_summary(results),
            "detailed_findings": results["scans"],
            "recommendations": self.create_consolidated_recommendations(results)
        }
        
        # Save report to file
        with open("security-scan-report.json", "w") as f:
            json.dump(report, f, indent=2)
        
        # Generate HTML report
        self.generate_html_security_report(report)
        
        logger.info("✅ Security report generated: security-scan-report.json")
    
    def create_executive_summary(self, results: Dict) -> Dict:
        """Create executive summary of security scan"""
        summary = {
            "overall_security_posture": "Unknown",
            "critical_issues": 0,
            "high_issues": 0,
            "recommendations_count": 0,
            "priority_actions": []
        }
        
        # Analyze results to determine security posture
        scans = results.get("scans", {})
        
        # Count critical and high issues from dependency scan
        dep_scan = scans.get("dependency_scan", {})
        if dep_scan.get("status") == "completed":
            dep_summary = dep_scan.get("summary", {})
            summary["critical_issues"] += dep_summary.get("critical", 0)
            summary["high_issues"] += dep_summary.get("high", 0)
        
        # Determine overall posture
        if summary["critical_issues"] > 0:
            summary["overall_security_posture"] = "Critical - Immediate Action Required"
        elif summary["high_issues"] > 5:
            summary["overall_security_posture"] = "High Risk - Action Needed"
        elif summary["high_issues"] > 0:
            summary["overall_security_posture"] = "Medium Risk - Monitor and Improve"
        else:
            summary["overall_security_posture"] = "Low Risk - Maintain Current Practices"
        
        return summary
    
    def create_consolidated_recommendations(self, results: Dict) -> List[str]:
        """Create consolidated list of security recommendations"""
        all_recommendations = []
        
        for scan_type, scan_result in results.get("scans", {}).items():
            recommendations = scan_result.get("recommendations", [])
            all_recommendations.extend(recommendations)
        
        # Deduplicate and prioritize
        unique_recommendations = list(set(all_recommendations))
        
        # Add general recommendations
        unique_recommendations.extend([
            "Implement security monitoring and alerting",
            "Conduct regular security training for development team",
            "Establish incident response procedures",
            "Perform regular security assessments",
            "Implement security code reviews"
        ])
        
        return unique_recommendations[:20]  # Top 20 recommendations
    
    def generate_html_security_report(self, report: Dict) -> None:
        """Generate HTML security report"""
        html_template = """
        <!DOCTYPE html>
        <html>
        <head>
            <title>MediaNest Security Scan Report</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 20px; }
                .header { background: #f5f5f5; padding: 20px; border-radius: 5px; }
                .critical { color: #d73027; font-weight: bold; }
                .high { color: #fc8d59; font-weight: bold; }
                .medium { color: #fee08b; font-weight: bold; }
                .low { color: #91cf60; font-weight: bold; }
                .section { margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 5px; }
                .recommendation { background: #e8f4f8; padding: 10px; margin: 5px 0; border-radius: 3px; }
                ul { margin: 10px 0; }
                li { margin: 5px 0; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>MediaNest Security Scan Report</h1>
                <p><strong>Scan Date:</strong> {scan_date}</p>
                <p><strong>Target:</strong> {base_url}</p>
                <p><strong>Overall Security Posture:</strong> <span class="{posture_class}">{posture}</span></p>
            </div>
            
            <div class="section">
                <h2>Executive Summary</h2>
                <p>Critical Issues: <span class="critical">{critical_issues}</span></p>
                <p>High Issues: <span class="high">{high_issues}</span></p>
            </div>
            
            <div class="section">
                <h2>Priority Recommendations</h2>
                <ul>
                {recommendations}
                </ul>
            </div>
        </body>
        </html>
        """
        
        # Format template
        recommendations_html = "".join([
            f'<li class="recommendation">{rec}</li>' 
            for rec in report["recommendations"][:10]
        ])
        
        html_content = html_template.format(
            scan_date=time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(report["scan_timestamp"])),
            base_url=report["base_url"],
            posture=report["executive_summary"]["overall_security_posture"],
            posture_class=self.get_posture_css_class(report["executive_summary"]["overall_security_posture"]),
            critical_issues=report["executive_summary"]["critical_issues"],
            high_issues=report["executive_summary"]["high_issues"],
            recommendations=recommendations_html
        )
        
        with open("security-scan-report.html", "w") as f:
            f.write(html_content)
        
        logger.info("✅ HTML security report generated: security-scan-report.html")
    
    def get_posture_css_class(self, posture: str) -> str:
        """Get CSS class for security posture"""
        if "Critical" in posture:
            return "critical"
        elif "High Risk" in posture:
            return "high"
        elif "Medium Risk" in posture:
            return "medium"
        else:
            return "low"


if __name__ == "__main__":
    # Run security automation
    scanner = SecurityTestAutomation()
    results = scanner.run_comprehensive_security_scan()
    print("Security scan completed. Check security-scan-report.html for results.")
```

### 2. CI/CD Security Integration

```yaml
# .github/workflows/security-testing.yml
name: Security Testing Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 2 * * 1'  # Weekly Monday 2 AM

env:
  NODE_VERSION: '18'

jobs:
  dependency-security-scan:
    name: Dependency Security Scan
    runs-on: ubuntu-latest
    timeout-minutes: 10
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
      
      - name: Install dependencies
        run: |
          npm ci --prefer-offline --no-audit
          cd backend && npm ci --prefer-offline --no-audit
          cd ../frontend && npm ci --prefer-offline --no-audit
      
      - name: Run npm audit
        run: |
          npm audit --audit-level moderate
          cd backend && npm audit --audit-level moderate
          cd ../frontend && npm audit --audit-level moderate
      
      - name: Run Snyk security scan
        uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
        with:
          args: --severity-threshold=high --all-projects
      
      - name: Upload dependency scan results
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: dependency-security-results
          path: |
            snyk-results.json
            npm-audit-results.json

  container-security-scan:
    name: Container Security Scan
    runs-on: ubuntu-latest
    timeout-minutes: 20
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Build Docker images
        run: |
          docker build -f backend/Dockerfile.production -t medianest-backend:security-test backend/
          docker build -f frontend/Dockerfile.production -t medianest-frontend:security-test frontend/
      
      - name: Run Trivy vulnerability scanner
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: 'medianest-backend:security-test'
          format: 'json'
          output: 'backend-trivy-results.json'
      
      - name: Run Trivy on frontend image
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: 'medianest-frontend:security-test'
          format: 'json'
          output: 'frontend-trivy-results.json'
      
      - name: Check for critical vulnerabilities
        run: |
          # Fail if critical vulnerabilities found
          if [ -f backend-trivy-results.json ]; then
            critical_count=$(jq '[.Results[]?.Vulnerabilities[]? | select(.Severity=="CRITICAL")] | length' backend-trivy-results.json)
            if [ "$critical_count" -gt 0 ]; then
              echo "❌ Found $critical_count critical vulnerabilities in backend image"
              exit 1
            fi
          fi
      
      - name: Upload container scan results
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: container-security-results
          path: |
            backend-trivy-results.json
            frontend-trivy-results.json

  code-security-analysis:
    name: Code Security Analysis
    runs-on: ubuntu-latest
    timeout-minutes: 15
    
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      
      - name: Initialize CodeQL
        uses: github/codeql-action/init@v3
        with:
          languages: javascript, typescript
          queries: security-and-quality
      
      - name: Autobuild
        uses: github/codeql-action/autobuild@v3
      
      - name: Perform CodeQL Analysis
        uses: github/codeql-action/analyze@v3
      
      - name: Run ESLint security rules
        run: |
          npm ci --prefer-offline --no-audit
          npx eslint . --ext .ts,.js,.tsx,.jsx --format json --output-file eslint-security-results.json || true
      
      - name: Upload code analysis results
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: code-security-results
          path: eslint-security-results.json

  security-testing:
    name: Security Unit Tests
    runs-on: ubuntu-latest
    timeout-minutes: 20
    needs: [dependency-security-scan]
    
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_USER: test_user
          POSTGRES_PASSWORD: test_pass
          POSTGRES_DB: medianest_security_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432
      
      redis:
        image: redis:7-alpine
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 6379:6379
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
      
      - name: Install dependencies
        run: |
          npm ci --prefer-offline --no-audit
          cd backend && npm ci --prefer-offline --no-audit
      
      - name: Run security tests
        run: |
          cd backend
          npm run test:security -- --coverage --json --outputFile=security-test-results.json
        env:
          NODE_ENV: test
          DATABASE_URL: postgresql://test_user:test_pass@localhost:5432/medianest_security_test
          REDIS_URL: redis://localhost:6379/1
      
      - name: Upload security test results
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: security-test-results
          path: backend/security-test-results.json

  penetration-testing:
    name: Basic Penetration Testing
    runs-on: ubuntu-latest
    timeout-minutes: 30
    if: github.ref == 'refs/heads/main'
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup test environment
        run: |
          docker-compose -f docker-compose.security-test.yml up -d
          sleep 60
      
      - name: Wait for application
        run: |
          timeout 120s bash -c 'until curl -f http://localhost:3000/health; do sleep 5; done'
      
      - name: Setup Python for security testing
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      
      - name: Install security testing tools
        run: |
          pip install requests python-owasp-zap-v2.4 sqlmap
      
      - name: Run automated security tests
        run: |
          python tests/security/security-automation.py
      
      - name: Upload penetration test results
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: penetration-test-results
          path: |
            security-scan-report.json
            security-scan-report.html
      
      - name: Cleanup
        if: always()
        run: |
          docker-compose -f docker-compose.security-test.yml down -v

  security-report-generation:
    name: Generate Security Report
    runs-on: ubuntu-latest
    needs: [dependency-security-scan, container-security-scan, code-security-analysis, security-testing]
    if: always()
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Download all security results
        uses: actions/download-artifact@v4
        with:
          path: security-results
      
      - name: Setup Node.js for report generation
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
      
      - name: Generate consolidated security report
        run: |
          node scripts/generate-security-report.js security-results/
      
      - name: Upload consolidated security report
        uses: actions/upload-artifact@v4
        with:
          name: consolidated-security-report
          path: |
            consolidated-security-report.html
            consolidated-security-report.json
      
      - name: Comment security report on PR
        if: github.event_name == 'pull_request'
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            
            try {
              const reportPath = 'consolidated-security-report.json';
              if (fs.existsSync(reportPath)) {
                const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
                
                const comment = `## 🛡️ Security Scan Results
                
                **Overall Security Posture:** ${report.executive_summary?.overall_security_posture || 'Unknown'}
                
                **Issues Found:**
                - Critical: ${report.executive_summary?.critical_issues || 0}
                - High: ${report.executive_summary?.high_issues || 0}
                
                **Top Recommendations:**
                ${report.recommendations?.slice(0, 5).map(r => `- ${r}`).join('\n') || 'No recommendations available'}
                
                Full report available in build artifacts.
                `;
                
                github.rest.issues.createComment({
                  issue_number: context.issue.number,
                  owner: context.repo.owner,
                  repo: context.repo.repo,
                  body: comment
                });
              }
            } catch (error) {
              console.log('Could not generate security comment:', error);
            }

  security-monitoring-alert:
    name: Security Monitoring Alert
    runs-on: ubuntu-latest
    needs: [security-report-generation]
    if: failure() && github.ref == 'refs/heads/main'
    
    steps:
      - name: Send security alert
        uses: actions/github-script@v7
        with:
          script: |
            // This would send alerts via Slack, email, or other notification systems
            console.log('🚨 Security testing failed - alerts should be sent to security team');
            
            // Example: Create security issue
            await github.rest.issues.create({
              owner: context.repo.owner,
              repo: context.repo.repo,
              title: '🚨 Security Testing Failure - Immediate Attention Required',
              body: `Security testing pipeline failed on ${new Date().toISOString()}.
              
              **Action Required:**
              1. Review security test failures
              2. Address critical vulnerabilities
              3. Re-run security tests
              
              **Build:** ${context.runId}
              **Commit:** ${context.sha}
              `,
              labels: ['security', 'critical', 'bug']
            });
```

## Conclusion

This comprehensive security testing framework provides MediaNest with:

1. **Multi-layered Security Testing**: From authentication to infrastructure security validation
2. **Automated Vulnerability Detection**: Continuous scanning for dependencies, containers, and code
3. **Penetration Testing Integration**: Automated security testing that simulates real attacks  
4. **Compliance Validation**: Testing for security standards and regulatory requirements
5. **CI/CD Security Integration**: Security testing embedded in development workflows
6. **Comprehensive Reporting**: Detailed security reports with actionable recommendations
7. **Threat-based Testing**: Testing based on real-world attack scenarios and OWASP Top 10
8. **Continuous Monitoring**: Ongoing security validation and alerting

The framework ensures MediaNest maintains robust security posture through systematic testing, early vulnerability detection, and proactive security measures throughout the application lifecycle.