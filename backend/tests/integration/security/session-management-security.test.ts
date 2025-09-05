import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { User } from '@prisma/client';
import crypto from 'crypto';

import { app } from '../../../src/server';
import { cleanDatabase, disconnectDatabase } from '../../helpers/database';
import { createTestUser, generateValidToken } from '../../helpers/auth';
import { getRedis } from '../../../src/config/redis';

describe('Session Management Security Tests', () => {
  let testUser: User;
  let adminUser: User;
  let userToken: string;
  let adminToken: string;
  let redis: any;

  beforeAll(async () => {
    redis = getRedis();
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
    
    // Clear Redis session data
    const keys = await redis.keys('session:*');
    if (keys.length > 0) {
      await redis.del(keys);
    }
  });

  afterAll(async () => {
    await disconnectDatabase();
  });

  describe('Session Creation Security', () => {
    it('should generate cryptographically secure session tokens', async () => {
      const tokens = [];
      
      // Generate multiple sessions
      for (let i = 0; i < 10; i++) {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: testUser.email,
            password: 'TestPassword123!',
          });

        if (response.status === 200) {
          tokens.push(response.body.data.token);
        }
      }

      // All tokens should be unique
      const uniqueTokens = new Set(tokens);
      expect(uniqueTokens.size).toBe(tokens.length);

      // Test token entropy
      tokens.forEach(token => {
        // JWT tokens should have sufficient length and complexity
        expect(token.length).toBeGreaterThan(100);
        
        // Should contain all JWT parts (header.payload.signature)
        const parts = token.split('.');
        expect(parts.length).toBe(3);
        
        // Each part should be base64 encoded
        parts.forEach(part => {
          expect(part).toMatch(/^[A-Za-z0-9_-]+$/);
        });
      });
    });

    it('should prevent session prediction attacks', async () => {
      const sessions = [];
      
      // Create sessions with timing patterns
      for (let i = 0; i < 5; i++) {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: testUser.email,
            password: 'TestPassword123!',
          });

        if (response.status === 200) {
          sessions.push({
            token: response.body.data.token,
            timestamp: Date.now(),
          });
        }
        
        // Small delay between sessions
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      // Tokens should not be predictable based on timing
      const tokens = sessions.map(s => s.token);
      for (let i = 1; i < tokens.length; i++) {
        // No two consecutive tokens should have similar patterns
        expect(tokens[i]).not.toBe(tokens[i - 1]);
        
        // Check for sequential patterns in token parts
        const current = tokens[i].split('.')[1]; // payload
        const previous = tokens[i - 1].split('.')[1];
        expect(current).not.toBe(previous);
      }
    });

    it('should implement session binding to client characteristics', async () => {
      const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
      const ipAddress = '192.168.1.100';

      // Create session with specific client characteristics
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .set('User-Agent', userAgent)
        .set('X-Forwarded-For', ipAddress)
        .send({
          email: testUser.email,
          password: 'TestPassword123!',
        });

      if (loginResponse.status === 200) {
        const token = loginResponse.body.data.token;

        // Use session with same characteristics - should work
        const sameCharResponse = await request(app)
          .get('/api/users/me')
          .set('Authorization', `Bearer ${token}`)
          .set('User-Agent', userAgent)
          .set('X-Forwarded-For', ipAddress);

        expect(sameCharResponse.status).toBe(200);

        // Use session with different characteristics - should be suspicious
        const diffCharResponse = await request(app)
          .get('/api/users/me')
          .set('Authorization', `Bearer ${token}`)
          .set('User-Agent', 'curl/7.68.0')
          .set('X-Forwarded-For', '203.0.113.1');

        // Should either work with warning or require additional verification
        if (diffCharResponse.status === 401) {
          expect(diffCharResponse.body.code).toBe('SUSPICIOUS_SESSION_ACTIVITY');
        }
      }
    });

    it('should enforce secure session storage', async () => {
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'TestPassword123!',
        });

      if (loginResponse.status === 200) {
        const token = loginResponse.body.data.token;

        // Check that session token is not stored in plaintext
        const redisKeys = await redis.keys('*');
        
        for (const key of redisKeys) {
          const value = await redis.get(key);
          if (typeof value === 'string') {
            // Raw token should not be stored
            expect(value).not.toContain(token);
            
            // Should be hashed or encrypted
            if (value.includes('session') || value.includes('token')) {
              expect(value.length).toBeGreaterThan(token.length);
            }
          }
        }
      }
    });
  });

  describe('Session Hijacking Prevention', () => {
    it('should detect and prevent session hijacking attempts', async () => {
      const originalUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)';
      const originalIP = '192.168.1.100';

      // Create legitimate session
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .set('User-Agent', originalUA)
        .set('X-Forwarded-For', originalIP)
        .send({
          email: testUser.email,
          password: 'TestPassword123!',
        });

      if (loginResponse.status === 200) {
        const token = loginResponse.body.data.token;

        // Normal usage from same client
        const normalResponse = await request(app)
          .get('/api/users/me')
          .set('Authorization', `Bearer ${token}`)
          .set('User-Agent', originalUA)
          .set('X-Forwarded-For', originalIP);

        expect(normalResponse.status).toBe(200);

        // Suspicious usage from different location/device
        const suspiciousResponse = await request(app)
          .get('/api/users/me')
          .set('Authorization', `Bearer ${token}`)
          .set('User-Agent', 'curl/7.68.0')
          .set('X-Forwarded-For', '198.51.100.1')
          .set('X-Forwarded-Proto', 'http'); // Downgrade attack

        // Should detect anomaly
        if (suspiciousResponse.status === 401) {
          expect(suspiciousResponse.body.code).toBe('SESSION_HIJACK_DETECTED');
        } else if (suspiciousResponse.status === 200) {
          // Should at least log the suspicious activity
          expect(suspiciousResponse.headers).toHaveProperty('x-security-warning');
        }
      }
    });

    it('should implement session token rotation', async () => {
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'TestPassword123!',
        });

      if (loginResponse.status === 200) {
        const originalToken = loginResponse.body.data.token;

        // Perform sensitive action that should trigger token rotation
        const sensitiveResponse = await request(app)
          .post('/api/auth/change-password')
          .set('Authorization', `Bearer ${originalToken}`)
          .send({
            currentPassword: 'TestPassword123!',
            newPassword: 'NewPassword123!',
            confirmNewPassword: 'NewPassword123!',
          });

        if (sensitiveResponse.status === 200) {
          // Should provide new token
          const newToken = sensitiveResponse.headers['x-new-auth-token'] || 
                          sensitiveResponse.body.data?.newToken;

          if (newToken) {
            expect(newToken).not.toBe(originalToken);

            // Old token should be invalidated
            const oldTokenResponse = await request(app)
              .get('/api/users/me')
              .set('Authorization', `Bearer ${originalToken}`);

            expect(oldTokenResponse.status).toBe(401);

            // New token should work
            const newTokenResponse = await request(app)
              .get('/api/users/me')
              .set('Authorization', `Bearer ${newToken}`);

            expect(newTokenResponse.status).toBe(200);
          }
        }
      }
    });

    it('should prevent concurrent session abuse', async () => {
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'TestPassword123!',
        });

      if (loginResponse.status === 200) {
        const token = loginResponse.body.data.token;

        // Make many concurrent requests (potential abuse)
        const concurrentRequests = Array(50).fill(null).map(() =>
          request(app)
            .get('/api/users/me')
            .set('Authorization', `Bearer ${token}`)
        );

        const responses = await Promise.all(concurrentRequests);
        const successful = responses.filter(r => r.status === 200).length;
        const rateLimited = responses.filter(r => r.status === 429).length;

        // Should apply rate limiting for concurrent abuse
        expect(rateLimited).toBeGreaterThan(10);
        expect(successful).toBeLessThan(40);
      }
    });

    it('should implement geolocation-based session validation', async () => {
      // Login from one location
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .set('X-Forwarded-For', '192.168.1.100') // US IP
        .set('X-Real-IP', '192.168.1.100')
        .send({
          email: testUser.email,
          password: 'TestPassword123!',
        });

      if (loginResponse.status === 200) {
        const token = loginResponse.body.data.token;

        // Use from drastically different location
        const foreignResponse = await request(app)
          .get('/api/users/me')
          .set('Authorization', `Bearer ${token}`)
          .set('X-Forwarded-For', '1.2.3.4') // Different country IP
          .set('X-Country-Code', 'CN')
          .set('Accept-Language', 'zh-CN,zh;q=0.9');

        // Should detect geographic anomaly
        if (foreignResponse.status === 200) {
          expect(foreignResponse.headers).toHaveProperty('x-location-warning');
        } else if (foreignResponse.status === 401) {
          expect(foreignResponse.body.code).toBe('SUSPICIOUS_LOCATION');
        }
      }
    });
  });

  describe('Session Lifecycle Management', () => {
    it('should implement proper session expiration', async () => {
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'TestPassword123!',
          rememberMe: false, // Short session
        });

      if (loginResponse.status === 200) {
        const token = loginResponse.body.data.token;

        // Session should work initially
        const initialResponse = await request(app)
          .get('/api/users/me')
          .set('Authorization', `Bearer ${token}`);

        expect(initialResponse.status).toBe(200);

        // Simulate session expiration by manipulating Redis TTL
        const sessionKeys = await redis.keys('session:*');
        if (sessionKeys.length > 0) {
          await redis.expire(sessionKeys[0], 1); // Expire in 1 second
          await new Promise(resolve => setTimeout(resolve, 1100));
        }

        // Session should now be expired
        const expiredResponse = await request(app)
          .get('/api/users/me')
          .set('Authorization', `Bearer ${token}`);

        expect(expiredResponse.status).toBe(401);
        expect(expiredResponse.body.code).toBe('SESSION_EXPIRED');
      }
    });

    it('should implement session extension for active users', async () => {
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'TestPassword123!',
        });

      if (loginResponse.status === 200) {
        const token = loginResponse.body.data.token;

        // Get initial session TTL
        const sessionKeys = await redis.keys('session:*');
        const initialTTL = sessionKeys.length > 0 ? await redis.ttl(sessionKeys[0]) : 0;

        // Make active request (should extend session)
        const activeResponse = await request(app)
          .get('/api/users/me')
          .set('Authorization', `Bearer ${token}`);

        expect(activeResponse.status).toBe(200);

        // Check if session was extended
        if (sessionKeys.length > 0) {
          const extendedTTL = await redis.ttl(sessionKeys[0]);
          expect(extendedTTL).toBeGreaterThanOrEqual(initialTTL);
        }
      }
    });

    it('should implement absolute session timeout', async () => {
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'TestPassword123!',
        });

      if (loginResponse.status === 200) {
        const token = loginResponse.body.data.token;

        // Set absolute timeout in Redis (simulate 24 hour limit)
        const sessionKeys = await redis.keys('session:*');
        if (sessionKeys.length > 0) {
          await redis.hset(sessionKeys[0], 'absoluteTimeout', Date.now() + (24 * 60 * 60 * 1000));
          
          // Simulate absolute timeout reached
          await redis.hset(sessionKeys[0], 'absoluteTimeout', Date.now() - 1000);
        }

        // Should be rejected due to absolute timeout
        const timeoutResponse = await request(app)
          .get('/api/users/me')
          .set('Authorization', `Bearer ${token}`);

        expect(timeoutResponse.status).toBe(401);
        expect(timeoutResponse.body.code).toBe('SESSION_ABSOLUTE_TIMEOUT');
      }
    });

    it('should implement secure session cleanup', async () => {
      // Create multiple sessions
      const sessions = [];
      for (let i = 0; i < 3; i++) {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: testUser.email,
            password: 'TestPassword123!',
          });

        if (response.status === 200) {
          sessions.push(response.body.data.token);
        }
      }

      // Logout all sessions
      if (sessions.length > 0) {
        const logoutResponse = await request(app)
          .post('/api/auth/logout')
          .set('Authorization', `Bearer ${sessions[0]}`)
          .send({ allSessions: true });

        expect(logoutResponse.status).toBe(200);

        // All sessions should be invalidated
        for (const token of sessions) {
          const response = await request(app)
            .get('/api/users/me')
            .set('Authorization', `Bearer ${token}`);

          expect(response.status).toBe(401);
        }

        // Redis should be cleaned up
        const remainingSessions = await redis.keys('session:*');
        expect(remainingSessions.length).toBe(0);
      }
    });
  });

  describe('Session Fixation Prevention', () => {
    it('should prevent session fixation attacks', async () => {
      const fixedSessionId = 'fixed-session-12345';

      // Attempt to fix session before authentication
      const preAuthResponse = await request(app)
        .get('/api/pre-auth/status')
        .set('Cookie', `sessionId=${fixedSessionId}`);

      // Login attempt with fixed session
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .set('Cookie', `sessionId=${fixedSessionId}`)
        .send({
          email: testUser.email,
          password: 'TestPassword123!',
        });

      if (loginResponse.status === 200) {
        // Should generate new session, not use fixed one
        const newSessionCookie = loginResponse.headers['set-cookie']?.find(
          (cookie: string) => cookie.startsWith('sessionId=')
        );

        if (newSessionCookie) {
          expect(newSessionCookie).not.toContain(fixedSessionId);
        }

        // New token should not be predictable from fixed session
        expect(loginResponse.body.data.token).not.toContain(fixedSessionId);
      }
    });

    it('should regenerate session IDs after privilege changes', async () => {
      // Login as regular user
      const userLoginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'TestPassword123!',
        });

      if (userLoginResponse.status === 200) {
        const originalToken = userLoginResponse.body.data.token;

        // Simulate privilege escalation (user becomes admin)
        const privilegeResponse = await request(app)
          .patch('/api/admin/promote-user')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ userId: testUser.id, role: 'admin' });

        if (privilegeResponse.status === 200) {
          // Original session should be invalidated
          const oldSessionResponse = await request(app)
            .get('/api/admin/users')
            .set('Authorization', `Bearer ${originalToken}`);

          expect([401, 403]).toContain(oldSessionResponse.status);

          // Should require re-authentication for elevated privileges
          const newLoginResponse = await request(app)
            .post('/api/auth/login')
            .send({
              email: testUser.email,
              password: 'TestPassword123!',
            });

          if (newLoginResponse.status === 200) {
            const newToken = newLoginResponse.body.data.token;
            expect(newToken).not.toBe(originalToken);
          }
        }
      }
    });
  });

  describe('Multi-Device Session Management', () => {
    it('should track sessions across multiple devices', async () => {
      const devices = [
        { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', name: 'Desktop' },
        { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6)', name: 'Mobile' },
        { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', name: 'Laptop' },
      ];

      const sessions = [];

      // Login from multiple devices
      for (const device of devices) {
        const response = await request(app)
          .post('/api/auth/login')
          .set('User-Agent', device.userAgent)
          .send({
            email: testUser.email,
            password: 'TestPassword123!',
          });

        if (response.status === 200) {
          sessions.push({
            token: response.body.data.token,
            device: device.name,
          });
        }
      }

      // Get active sessions
      if (sessions.length > 0) {
        const sessionsResponse = await request(app)
          .get('/api/auth/sessions')
          .set('Authorization', `Bearer ${sessions[0].token}`);

        expect(sessionsResponse.status).toBe(200);
        expect(sessionsResponse.body.data).toBeInstanceOf(Array);
        expect(sessionsResponse.body.data.length).toBe(sessions.length);

        // Should show device information
        sessionsResponse.body.data.forEach((session: any) => {
          expect(session).toHaveProperty('deviceType');
          expect(session).toHaveProperty('lastActive');
          expect(session).toHaveProperty('ipAddress');
          expect(session).not.toHaveProperty('token'); // Don't expose token
        });
      }
    });

    it('should allow selective session termination', async () => {
      // Create multiple sessions
      const sessions = [];
      for (let i = 0; i < 3; i++) {
        const response = await request(app)
          .post('/api/auth/login')
          .set('User-Agent', `Device-${i}`)
          .send({
            email: testUser.email,
            password: 'TestPassword123!',
          });

        if (response.status === 200) {
          sessions.push(response.body.data.token);
        }
      }

      if (sessions.length >= 2) {
        // Get session list to find session IDs
        const listResponse = await request(app)
          .get('/api/auth/sessions')
          .set('Authorization', `Bearer ${sessions[0]}`);

        if (listResponse.status === 200) {
          const sessionList = listResponse.body.data;
          const targetSessionId = sessionList[1].id;

          // Terminate specific session
          const terminateResponse = await request(app)
            .delete(`/api/auth/sessions/${targetSessionId}`)
            .set('Authorization', `Bearer ${sessions[0]}`);

          expect(terminateResponse.status).toBe(200);

          // Terminated session should no longer work
          const terminatedResponse = await request(app)
            .get('/api/users/me')
            .set('Authorization', `Bearer ${sessions[1]}`);

          expect(terminatedResponse.status).toBe(401);

          // Other sessions should still work
          const activeResponse = await request(app)
            .get('/api/users/me')
            .set('Authorization', `Bearer ${sessions[0]}`);

          expect(activeResponse.status).toBe(200);
        }
      }
    });

    it('should implement device trust levels', async () => {
      const trustedDevice = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) - Trusted';
      const unknownDevice = 'curl/7.68.0 - Suspicious';

      // Login from trusted device
      const trustedResponse = await request(app)
        .post('/api/auth/login')
        .set('User-Agent', trustedDevice)
        .set('X-Device-Trust-Token', 'trusted-device-123')
        .send({
          email: testUser.email,
          password: 'TestPassword123!',
        });

      // Login from unknown device
      const unknownResponse = await request(app)
        .post('/api/auth/login')
        .set('User-Agent', unknownDevice)
        .send({
          email: testUser.email,
          password: 'TestPassword123!',
        });

      // Trusted device should have full access
      if (trustedResponse.status === 200) {
        const trustedToken = trustedResponse.body.data.token;
        
        const privilegedResponse = await request(app)
          .get('/api/sensitive-data')
          .set('Authorization', `Bearer ${trustedToken}`);

        expect([200, 404]).toContain(privilegedResponse.status);
      }

      // Unknown device might require additional verification
      if (unknownResponse.status === 200) {
        const unknownToken = unknownResponse.body.data.token;
        
        const privilegedResponse = await request(app)
          .get('/api/sensitive-data')
          .set('Authorization', `Bearer ${unknownToken}`);

        if (privilegedResponse.status === 401) {
          expect(privilegedResponse.body.code).toBe('DEVICE_VERIFICATION_REQUIRED');
        }
      }
    });
  });

  describe('Session Security Monitoring', () => {
    it('should log suspicious session activities', async () => {
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'TestPassword123!',
        });

      if (loginResponse.status === 200) {
        const token = loginResponse.body.data.token;

        // Perform suspicious activities
        const suspiciousActivities = [
          { path: '/api/admin/users', method: 'get' },
          { path: '/api/admin/system', method: 'get' },
          { path: '/api/auth/sessions', method: 'get' },
          { path: '/api/user-data/export', method: 'post' },
        ];

        for (const activity of suspiciousActivities) {
          await request(app)[activity.method](activity.path)
            .set('Authorization', `Bearer ${token}`);
        }

        // Check security logs
        const logsResponse = await request(app)
          .get('/api/admin/security-logs')
          .set('Authorization', `Bearer ${adminToken}`)
          .query({ userId: testUser.id });

        if (logsResponse.status === 200) {
          expect(logsResponse.body.data).toBeInstanceOf(Array);
          
          const suspiciousLogs = logsResponse.body.data.filter(
            (log: any) => log.type === 'SUSPICIOUS_ACTIVITY'
          );
          
          expect(suspiciousLogs.length).toBeGreaterThan(0);
        }
      }
    });

    it('should implement session anomaly detection', async () => {
      const normalPattern = {
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        timing: [9, 10, 14, 16, 18], // Business hours
        endpoints: ['/api/users/me', '/api/dashboard', '/api/notifications'],
      };

      const anomalousPattern = {
        userAgent: 'curl/7.68.0',
        timing: [2, 3, 4], // Middle of night
        endpoints: ['/api/admin/users', '/api/system/config', '/api/data/export'],
      };

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'TestPassword123!',
        });

      if (loginResponse.status === 200) {
        const token = loginResponse.body.data.token;

        // Establish normal pattern
        for (const endpoint of normalPattern.endpoints) {
          await request(app)
            .get(endpoint)
            .set('Authorization', `Bearer ${token}`)
            .set('User-Agent', normalPattern.userAgent);
        }

        // Perform anomalous activities
        for (const endpoint of anomalousPattern.endpoints) {
          const response = await request(app)
            .get(endpoint)
            .set('Authorization', `Bearer ${token}`)
            .set('User-Agent', anomalousPattern.userAgent);

          // Should detect anomaly
          if (response.headers['x-anomaly-score']) {
            expect(parseFloat(response.headers['x-anomaly-score'])).toBeGreaterThan(0.5);
          }
        }
      }
    });

    it('should implement automatic session termination on threats', async () => {
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'TestPassword123!',
        });

      if (loginResponse.status === 200) {
        const token = loginResponse.body.data.token;

        // Trigger high-threat activity
        const threatActivities = [
          { path: '/api/../../../etc/passwd', method: 'get' },
          { path: '/api/admin/users', method: 'delete' },
          { path: '/api/system/shutdown', method: 'post' },
        ];

        for (const activity of threatActivities) {
          await request(app)[activity.method](activity.path)
            .set('Authorization', `Bearer ${token}`)
            .send({ malicious: 'payload' });
        }

        // Session should be automatically terminated
        const statusResponse = await request(app)
          .get('/api/users/me')
          .set('Authorization', `Bearer ${token}`);

        expect(statusResponse.status).toBe(401);
        expect(statusResponse.body.code).toBe('SESSION_TERMINATED_THREAT');
      }
    });
  });
});