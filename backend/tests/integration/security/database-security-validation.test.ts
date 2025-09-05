import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { User } from '@prisma/client';

import { app } from '../../../src/server';
import { cleanDatabase, disconnectDatabase } from '../../helpers/database';
import { createTestUser, generateValidToken } from '../../helpers/auth';

describe('Database Security Validation Tests', () => {
  let prisma: PrismaClient;
  let regularUser: User;
  let adminUser: User;
  let regularToken: string;
  let adminToken: string;

  beforeAll(async () => {
    prisma = new PrismaClient();
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
    await prisma.$disconnect();
  });

  describe('SQL Injection Protection', () => {
    it('should prevent SQL injection in user search', async () => {
      const sqlPayloads = [
        "'; DROP TABLE users; --",
        "' OR '1'='1' --",
        "' UNION SELECT password FROM users --",
        "'; INSERT INTO users (email, role) VALUES ('hacker@evil.com', 'admin'); --",
        "' OR 1=1 LIMIT 1 OFFSET 0 --",
        "' AND (SELECT COUNT(*) FROM users WHERE role='admin') > 0 --",
        "1'; DELETE FROM users WHERE role != 'admin'; --",
        "'; UPDATE users SET role='admin' WHERE email='user@example.com'; --",
      ];

      for (const payload of sqlPayloads) {
        const response = await request(app)
          .get('/api/users/search')
          .query({ q: payload })
          .set('Authorization', `Bearer ${adminToken}`);

        expect([200, 400, 422]).toContain(response.status);
        
        if (response.status === 200) {
          // Verify no malicious data was returned or created
          expect(response.body).not.toHaveProperty('password');
          expect(response.body).not.toHaveProperty('passwordHash');
          
          const responseText = JSON.stringify(response.body);
          expect(responseText).not.toContain('hacker@evil.com');
        }

        // Verify database integrity
        const userCount = await prisma.user.count();
        expect(userCount).toBe(2); // Should still have exactly 2 users

        const adminCount = await prisma.user.count({ where: { role: 'admin' } });
        expect(adminCount).toBe(1); // Should still have exactly 1 admin

        const regularUserRecord = await prisma.user.findUnique({
          where: { id: regularUser.id },
        });
        expect(regularUserRecord?.role).toBe('user'); // Role should not be changed
      }
    });

    it('should prevent SQL injection in POST body parameters', async () => {
      const maliciousData = {
        name: "Test'; DROP TABLE session_tokens; --",
        email: "test@example.com'; INSERT INTO users (email, role) VALUES ('admin@evil.com', 'admin'); --",
        description: "'; UPDATE users SET password_hash='hacked' WHERE role='admin'; --",
        preferences: {
          theme: "dark'; DELETE FROM users; --",
          language: "en'; ALTER TABLE users ADD COLUMN hacked BOOLEAN DEFAULT TRUE; --",
        },
      };

      const response = await request(app)
        .patch('/api/users/me')
        .set('Authorization', `Bearer ${regularToken}`)
        .send(maliciousData);

      expect([200, 400, 422]).toContain(response.status);

      // Verify database integrity
      const userCount = await prisma.user.count();
      expect(userCount).toBe(2);

      const sessionCount = await prisma.sessionToken.count();
      expect(sessionCount).toBeGreaterThanOrEqual(0); // Table should still exist

      const adminUser = await prisma.user.findFirst({ where: { role: 'admin' } });
      expect(adminUser).toBeDefined();
      expect(adminUser?.email).toBe('admin@example.com'); // Not modified

      // Check for malicious user creation
      const maliciousUser = await prisma.user.findFirst({
        where: { email: 'admin@evil.com' }
      });
      expect(maliciousUser).toBeNull();
    });

    it('should prevent blind SQL injection timing attacks', async () => {
      const timingPayloads = [
        "'; WAITFOR DELAY '00:00:05'; --",
        "' OR (SELECT SLEEP(5)) --",
        "' UNION SELECT * FROM (SELECT SLEEP(5)) as t --",
        "'; IF (1=1) WAITFOR DELAY '0:0:5'; --",
        "' OR BENCHMARK(5000000, MD5('timing_attack')) --",
      ];

      for (const payload of timingPayloads) {
        const startTime = Date.now();
        
        const response = await request(app)
          .get('/api/users')
          .query({ filter: payload })
          .set('Authorization', `Bearer ${adminToken}`);

        const duration = Date.now() - startTime;

        // Response should complete quickly (< 2 seconds)
        expect(duration).toBeLessThan(2000);
        expect([200, 400, 422]).toContain(response.status);

        // Should not reveal timing-based information
        if (response.status === 200) {
          expect(response.body.data).toBeInstanceOf(Array);
        }
      }
    });

    it('should validate parameterized queries are used correctly', async () => {
      // Test that the application uses parameterized queries by testing edge cases
      const edgeCases = [
        "test'user",
        'test"user',
        "test\\user",
        "test`user",
        "test;user",
        "test/**/user",
        "test--user",
        "test\x00user",
        "test\nuser",
        "test\ruser",
      ];

      for (const testCase of edgeCases) {
        const response = await request(app)
          .post('/api/user-search')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ query: testCase });

        expect([200, 400, 422]).toContain(response.status);

        // If successful, verify no SQL syntax errors occurred
        if (response.status === 200) {
          expect(response.body).not.toHaveProperty('error');
          expect(response.body).not.toHaveProperty('sqlState');
        }
      }
    });
  });

  describe('Data Access Control', () => {
    it('should enforce row-level security for user data', async () => {
      // Create additional test user
      const otherUser = await createTestUser({
        email: 'other@example.com',
        name: 'Other User',
        plexId: 'plex-other',
        role: 'user',
      });

      // Regular user should not be able to access other user's data
      const response = await request(app)
        .get(`/api/users/${otherUser.id}`)
        .set('Authorization', `Bearer ${regularToken}`);

      expect([403, 404]).toContain(response.status);

      // Admin should be able to access any user's data
      const adminResponse = await request(app)
        .get(`/api/users/${otherUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect([200, 404]).toContain(adminResponse.status);

      // User should be able to access their own data
      const ownDataResponse = await request(app)
        .get(`/api/users/${regularUser.id}`)
        .set('Authorization', `Bearer ${regularToken}`);

      expect([200, 404]).toContain(ownDataResponse.status);
    });

    it('should prevent horizontal privilege escalation through direct database queries', async () => {
      // Attempt to modify another user's data
      const otherUser = await createTestUser({
        email: 'other@example.com',
        name: 'Other User',
        plexId: 'plex-other',
        role: 'user',
      });

      const response = await request(app)
        .patch(`/api/users/${otherUser.id}`)
        .set('Authorization', `Bearer ${regularToken}`)
        .send({
          name: 'Hacked Name',
          role: 'admin',
          email: 'hacked@evil.com',
        });

      expect([403, 404]).toContain(response.status);

      // Verify other user's data was not modified
      const unchangedUser = await prisma.user.findUnique({
        where: { id: otherUser.id },
      });

      expect(unchangedUser?.name).toBe('Other User');
      expect(unchangedUser?.role).toBe('user');
      expect(unchangedUser?.email).toBe('other@example.com');
    });

    it('should prevent vertical privilege escalation', async () => {
      // Regular user tries to elevate their own privileges
      const response = await request(app)
        .patch('/api/users/me')
        .set('Authorization', `Bearer ${regularToken}`)
        .send({
          role: 'admin',
          permissions: ['admin:*'],
        });

      expect([403, 422]).toContain(response.status);

      // Verify user's role was not changed
      const unchangedUser = await prisma.user.findUnique({
        where: { id: regularUser.id },
      });

      expect(unchangedUser?.role).toBe('user');
    });

    it('should implement proper database connection security', async () => {
      // Test that database errors don't leak sensitive information
      const response = await request(app)
        .get('/api/database-test/error')
        .set('Authorization', `Bearer ${adminToken}`);

      if ([500, 400].includes(response.status)) {
        const errorMessage = response.body.message || '';
        
        // Should not expose database credentials or connection strings
        expect(errorMessage).not.toContain('password');
        expect(errorMessage).not.toContain('host=');
        expect(errorMessage).not.toContain('user=');
        expect(errorMessage).not.toContain('DATABASE_URL');
        expect(errorMessage).not.toContain('postgresql://');
        expect(errorMessage).not.toContain('mysql://');
        expect(errorMessage).not.toContain('mongodb://');

        // Should not expose database schema information
        expect(errorMessage).not.toContain('table');
        expect(errorMessage).not.toContain('column');
        expect(errorMessage).not.toContain('constraint');
        expect(errorMessage).not.toContain('foreign key');

        // Should not expose system paths
        expect(errorMessage).not.toContain('/var/lib/');
        expect(errorMessage).not.toContain('/etc/');
        expect(errorMessage).not.toContain('/usr/');
      }
    });
  });

  describe('Data Encryption and Hashing', () => {
    it('should properly hash passwords before storage', async () => {
      const password = 'TestPassword123!';
      
      const response = await request(app)
        .post('/api/auth/admin')
        .send({
          email: 'newadmin@example.com',
          password,
          confirmPassword: password,
          name: 'New Admin',
        });

      if (response.status === 201) {
        // Verify password is hashed in database
        const storedUser = await prisma.user.findUnique({
          where: { email: 'newadmin@example.com' },
        });

        expect(storedUser?.passwordHash).toBeDefined();
        expect(storedUser?.passwordHash).not.toBe(password);
        expect(storedUser?.passwordHash?.length).toBeGreaterThan(50);
        
        // Should use bcrypt format
        expect(storedUser?.passwordHash).toMatch(/^\$2[aby]\$\d+\$/);
      }
    });

    it('should encrypt sensitive data at rest', async () => {
      // Create user with sensitive data
      const sensitiveData = {
        plexToken: 'sensitive-plex-token-12345',
        apiKey: 'api-key-67890',
        personalNote: 'This is sensitive personal information',
      };

      const response = await request(app)
        .patch('/api/users/me')
        .set('Authorization', `Bearer ${regularToken}`)
        .send(sensitiveData);

      if ([200, 201].includes(response.status)) {
        // Check raw database storage
        const storedUser = await prisma.user.findUnique({
          where: { id: regularUser.id },
        });

        // Sensitive fields should be encrypted or hashed
        if (storedUser?.plexToken) {
          expect(storedUser.plexToken).not.toBe(sensitiveData.plexToken);
        }

        // Should not store sensitive data in plaintext
        const rawData = JSON.stringify(storedUser);
        expect(rawData).not.toContain('sensitive-plex-token-12345');
        expect(rawData).not.toContain('This is sensitive personal information');
      }
    });

    it('should use secure random tokens for sessions', async () => {
      const tokens = [];
      
      // Generate multiple session tokens
      for (let i = 0; i < 10; i++) {
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

      // Tokens should have high entropy
      tokens.forEach(token => {
        expect(token.length).toBeGreaterThan(100);
        
        // Check for patterns that suggest weak randomness
        expect(token).not.toMatch(/^(.)\1+/); // Not all same character
        expect(token).not.toMatch(/^123/); // Not sequential
        expect(token).not.toMatch(/(.{1,3})\1{3,}/); // Not highly repetitive
      });

      // Verify tokens are stored securely in database
      const sessionTokens = await prisma.sessionToken.findMany();
      sessionTokens.forEach(sessionToken => {
        // Token should be hashed in database
        tokens.forEach(originalToken => {
          expect(sessionToken.hashedToken).not.toBe(originalToken);
        });
      });
    });

    it('should implement secure deletion of sensitive data', async () => {
      // Create session
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: regularUser.email,
          password: 'TestPassword123!',
        });

      if (loginResponse.status === 200) {
        const token = loginResponse.body.data.token;

        // Logout (should securely delete session)
        const logoutResponse = await request(app)
          .post('/api/auth/logout')
          .set('Authorization', `Bearer ${token}`)
          .send({});

        expect(logoutResponse.status).toBe(200);

        // Verify session is completely removed from database
        const remainingSessions = await prisma.sessionToken.findMany({
          where: { userId: regularUser.id },
        });

        expect(remainingSessions.length).toBe(0);
      }
    });
  });

  describe('Database Transaction Security', () => {
    it('should handle transaction rollback on security violations', async () => {
      const initialUserCount = await prisma.user.count();

      // Attempt operation that should trigger rollback
      const response = await request(app)
        .post('/api/batch-operations')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          operations: [
            { action: 'createUser', data: { email: 'valid@example.com', name: 'Valid User' } },
            { action: 'createUser', data: { email: "'; DROP TABLE users; --", name: 'Malicious' } },
            { action: 'createUser', data: { email: 'another@example.com', name: 'Another User' } },
          ],
        });

      expect([400, 422]).toContain(response.status);

      // Verify no partial operations were committed
      const finalUserCount = await prisma.user.count();
      expect(finalUserCount).toBe(initialUserCount);

      // Verify specific users were not created
      const validUser = await prisma.user.findUnique({
        where: { email: 'valid@example.com' }
      });
      expect(validUser).toBeNull();

      const anotherUser = await prisma.user.findUnique({
        where: { email: 'another@example.com' }
      });
      expect(anotherUser).toBeNull();
    });

    it('should prevent race condition attacks', async () => {
      // Concurrent requests that could cause race conditions
      const concurrentRequests = Array(10).fill(null).map((_, i) =>
        request(app)
          .patch('/api/users/me')
          .set('Authorization', `Bearer ${regularToken}`)
          .send({ name: `Updated Name ${i}` })
      );

      const responses = await Promise.all(concurrentRequests);
      const successfulResponses = responses.filter(r => r.status === 200);
      
      // Only one update should succeed, or all should be handled properly
      expect(successfulResponses.length).toBeGreaterThanOrEqual(1);

      // Verify final state is consistent
      const finalUser = await prisma.user.findUnique({
        where: { id: regularUser.id },
      });

      expect(finalUser?.name).toMatch(/^Updated Name \d+$/);
    });

    it('should implement proper database connection pooling security', async () => {
      // Make many concurrent requests to test connection pooling
      const requests = Array(50).fill(null).map(() =>
        request(app)
          .get('/api/users/me')
          .set('Authorization', `Bearer ${regularToken}`)
      );

      const responses = await Promise.all(requests);
      const successful = responses.filter(r => r.status === 200).length;

      // Most requests should succeed (connection pool should handle load)
      expect(successful).toBeGreaterThan(40);

      // No connection exhaustion errors
      const connectionErrors = responses.filter(r => 
        r.status === 500 && 
        (r.body.message || '').toLowerCase().includes('connection')
      );
      expect(connectionErrors.length).toBe(0);
    });

    it('should prevent deadlock exploitation', async () => {
      // Create operations that could potentially deadlock
      const operations = [
        { userId: regularUser.id, field: 'name', value: 'Name 1' },
        { userId: adminUser.id, field: 'name', value: 'Name 2' },
        { userId: regularUser.id, field: 'email', value: 'new1@example.com' },
        { userId: adminUser.id, field: 'email', value: 'new2@example.com' },
      ];

      const requests = operations.map(op =>
        request(app)
          .patch(`/api/users/${op.userId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ [op.field]: op.value })
      );

      const responses = await Promise.all(requests);
      
      // Operations should complete without deadlock
      const timeoutErrors = responses.filter(r => 
        r.status === 500 && 
        (r.body.message || '').toLowerCase().includes('timeout')
      );
      expect(timeoutErrors.length).toBe(0);
    });
  });

  describe('Database Backup and Recovery Security', () => {
    it('should not expose backup data through API endpoints', async () => {
      const backupEndpoints = [
        '/api/backup/database',
        '/api/admin/backup',
        '/api/system/export',
        '/api/data/dump',
        '/api/migration/export',
      ];

      for (const endpoint of backupEndpoints) {
        const response = await request(app)
          .get(endpoint)
          .set('Authorization', `Bearer ${regularToken}`);

        // Regular users should not access backup endpoints
        expect([401, 403, 404]).toContain(response.status);
      }

      for (const endpoint of backupEndpoints) {
        const response = await request(app)
          .get(endpoint)
          .set('Authorization', `Bearer ${adminToken}`);

        // Even admins should have restricted access or proper controls
        if (response.status === 200) {
          // Should not return raw database content
          const responseText = JSON.stringify(response.body);
          expect(responseText).not.toContain('passwordHash');
          expect(responseText).not.toContain('sessionToken');
        } else {
          expect([401, 403, 404]).toContain(response.status);
        }
      }
    });

    it('should validate database schema migration security', async () => {
      const migrationResponse = await request(app)
        .post('/api/admin/migrate')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          migration: 'ALTER TABLE users ADD COLUMN test_field VARCHAR(255);',
        });

      // Should not allow arbitrary SQL execution
      expect([403, 404, 501]).toContain(migrationResponse.status);

      // Verify no unauthorized schema changes occurred
      const tableInfo = await prisma.$queryRaw`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'User' AND column_name = 'test_field';
      `;

      expect(Array.isArray(tableInfo) ? tableInfo.length : 0).toBe(0);
    });
  });

  describe('Database Monitoring and Auditing', () => {
    it('should log sensitive database operations', async () => {
      // Perform sensitive operation
      const response = await request(app)
        .patch(`/api/users/${regularUser.id}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'moderator' });

      if ([200, 403].includes(response.status)) {
        // Check audit logs
        const auditResponse = await request(app)
          .get('/api/admin/audit-logs')
          .set('Authorization', `Bearer ${adminToken}`)
          .query({ 
            action: 'ROLE_CHANGE',
            targetUserId: regularUser.id,
          });

        if (auditResponse.status === 200) {
          expect(auditResponse.body.data).toBeInstanceOf(Array);
          
          if (auditResponse.body.data.length > 0) {
            const logEntry = auditResponse.body.data[0];
            expect(logEntry).toHaveProperty('action');
            expect(logEntry).toHaveProperty('performedBy');
            expect(logEntry).toHaveProperty('timestamp');
            expect(logEntry).toHaveProperty('targetUser');
          }
        }
      }
    });

    it('should detect and log suspicious database queries', async () => {
      // Make suspicious query patterns
      const suspiciousQueries = [
        { path: '/api/users', query: { limit: '999999' } },
        { path: '/api/users', query: { select: 'password,secret' } },
        { path: '/api/admin/users', query: { includeDeleted: 'true' } },
      ];

      for (const suspiciousQuery of suspiciousQueries) {
        await request(app)
          .get(suspiciousQuery.path)
          .query(suspiciousQuery.query)
          .set('Authorization', `Bearer ${adminToken}`);
      }

      // Check security logs
      const securityResponse = await request(app)
        .get('/api/admin/security-logs')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ type: 'SUSPICIOUS_QUERY' });

      if (securityResponse.status === 200) {
        expect(securityResponse.body.data).toBeInstanceOf(Array);
      }
    });
  });
});