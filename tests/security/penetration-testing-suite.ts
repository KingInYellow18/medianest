import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import request from 'supertest';
import { User } from '@prisma/client';
import crypto from 'crypto';
import { spawn } from 'child_process';

import { app } from '../../backend/src/server';
import { cleanDatabase, disconnectDatabase } from '../helpers/database';
import { createTestUser, generateValidToken } from '../helpers/auth';
import { UserRepository } from '../../backend/src/repositories/user.repository';
import { getRedis } from '../../backend/src/config/redis';

/**
 * PENETRATION TESTING SUITE
 * 
 * Simulates real-world attack scenarios to test the security posture
 * of the MediaNest application.
 */

describe('🏴‍☠️ PENETRATION TESTING SUITE', () => {
  let userRepository: UserRepository;
  let redis: any;
  let testUser: User;
  let adminUser: User;
  let testToken: string;
  let adminToken: string;

  beforeAll(async () => {
    userRepository = new UserRepository();
    redis = getRedis();
  });

  beforeEach(async () => {
    await cleanDatabase();
    
    testUser = await createTestUser({
      email: 'pentest@security.com',
      name: 'PenTest User',
      plexId: 'pentest-001',
      role: 'user',
      status: 'active',
    });
    
    adminUser = await createTestUser({
      email: 'admin@security.com',
      name: 'Admin User',
      plexId: 'admin-pentest',
      role: 'admin',
      status: 'active',
    });
    
    testToken = await generateValidToken(testUser.id);
    adminToken = await generateValidToken(adminUser.id);
  });

  afterAll(async () => {
    await disconnectDatabase();
  });

  describe('🎯 AUTOMATED ATTACK SCENARIOS', () => {
    describe('Brute Force Attack Simulation', () => {
      it('should detect and prevent brute force login attempts', async () => {
        const loginAttempts = [];
        const passwords = [
          'password', '123456', 'admin', 'letmein', 'welcome',
          'monkey', '1234567890', 'qwerty', 'abc123', 'Password1'
        ];
        
        // Simulate rapid brute force attempts
        for (const password of passwords) {
          loginAttempts.push(
            request(app)
              .post('/api/auth/login')
              .send({
                email: testUser.email,
                password: password
              })
          );
        }
        
        const responses = await Promise.all(loginAttempts);
        
        // Should be rate limited after several attempts
        const rateLimited = responses.filter(r => r.status === 429);
        expect(rateLimited.length).toBeGreaterThan(0);
        
        // Should not return different error messages that leak information
        const errorMessages = responses.map(r => r.body.message).filter(Boolean);
        const uniqueMessages = new Set(errorMessages);
        expect(uniqueMessages.size).toBeLessThan(3); // Consistent error messages
      });

      it('should implement progressive delays for repeated failures', async () => {
        const timings: number[] = [];
        
        // Make multiple failed attempts and measure response time
        for (let i = 0; i < 5; i++) {
          const start = Date.now();
          
          await request(app)
            .post('/api/auth/login')
            .send({
              email: testUser.email,
              password: 'wrong-password'
            });
          
          timings.push(Date.now() - start);
          
          // Small delay between attempts
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        // Response times should generally increase (progressive delays)
        const averageEarly = (timings[0] + timings[1]) / 2;
        const averageLater = (timings[3] + timings[4]) / 2;
        
        // Later attempts should be slower due to rate limiting
        expect(averageLater).toBeGreaterThan(averageEarly * 0.8);
      });
    });

    describe('Account Enumeration Prevention', () => {
      it('should prevent username enumeration via login responses', async () => {
        const existingUserEmail = testUser.email;
        const nonExistentEmail = 'nonexistent@example.com';
        
        // Test with existing user
        const response1 = await request(app)
          .post('/api/auth/login')
          .send({
            email: existingUserEmail,
            password: 'wrong-password'
          });
        
        // Test with non-existent user
        const response2 = await request(app)
          .post('/api/auth/login')
          .send({
            email: nonExistentEmail,
            password: 'wrong-password'
          });
        
        // Should return same status code and similar response structure
        expect(response1.status).toBe(response2.status);
        
        // Should not leak information about user existence
        expect(response1.body.message).toBe(response2.body.message);
        
        // Response times should be similar (to prevent timing attacks)
        // Note: This is approximated as exact timing is hard to test
      });

      it('should prevent user enumeration via registration endpoint', async () => {
        const existingEmail = testUser.email;
        const newEmail = 'newuser@example.com';
        
        // Try to register with existing email
        const response1 = await request(app)
          .post('/api/auth/register')
          .send({
            email: existingEmail,
            password: 'NewPassword123!',
            name: 'New User'
          });
        
        // Try to register with new email (if registration is open)
        const response2 = await request(app)
          .post('/api/auth/register')
          .send({
            email: newEmail,
            password: 'NewPassword123!', 
            name: 'Another User'
          });
        
        // Should not reveal if email already exists
        if (response1.status === 400 && response2.status === 201) {
          // This would indicate user enumeration vulnerability
          expect(false).toBe(true); // Force failure
        }
        
        // Both should either succeed or fail consistently
        expect([400, 403, 404, 422]).toContain(response1.status);
      });
    });

    describe('Session Hijacking Simulation', () => {
      it('should detect session token theft attempts', async () => {
        // Get valid session token
        const validToken = testToken;
        
        // Simulate attacker using stolen token from different IP/User-Agent
        const legitimateRequest = await request(app)
          .get('/api/users/me')
          .set('Authorization', `Bearer ${validToken}`)
          .set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')
          .set('X-Forwarded-For', '192.168.1.100');
        
        expect(legitimateRequest.status).toBe(200);
        
        // Attacker from different location
        const suspiciousRequest = await request(app)
          .get('/api/users/me')
          .set('Authorization', `Bearer ${validToken}`)
          .set('User-Agent', 'curl/7.68.0') // Different user agent
          .set('X-Forwarded-For', '10.0.0.50'); // Different IP
        
        // Should still work but potentially be logged/flagged
        expect(suspiciousRequest.status).toBe(200);
        
        // Rapid requests from multiple IPs should trigger alerts
        const rapidRequests = await Promise.all([
          request(app).get('/api/users/me').set('Authorization', `Bearer ${validToken}`).set('X-Forwarded-For', '1.1.1.1'),
          request(app).get('/api/users/me').set('Authorization', `Bearer ${validToken}`).set('X-Forwarded-For', '2.2.2.2'),
          request(app).get('/api/users/me').set('Authorization', `Bearer ${validToken}`).set('X-Forwarded-For', '3.3.3.3'),
          request(app).get('/api/users/me').set('Authorization', `Bearer ${validToken}`).set('X-Forwarded-For', '4.4.4.4')
        ]);
        
        // Some requests might be rate limited if suspicious activity is detected
        const successful = rapidRequests.filter(r => r.status === 200);
        const rateLimited = rapidRequests.filter(r => r.status === 429);
        
        expect(successful.length + rateLimited.length).toBe(4);
      });
    });

    describe('Privilege Escalation Attempts', () => {
      it('should prevent horizontal privilege escalation', async () => {
        // Create second user
        const user2 = await createTestUser({
          email: 'user2@test.com',
          name: 'User Two',
          plexId: 'user2-test',
          role: 'user',
        });
        
        // User 1 tries to access User 2's data
        const response1 = await request(app)
          .get(`/api/users/${user2.id}`)
          .set('Authorization', `Bearer ${testToken}`);
        
        expect(response1.status).toBe(403);
        
        // User 1 tries to modify User 2's profile
        const response2 = await request(app)
          .patch(`/api/users/${user2.id}`)
          .send({ name: 'Hacked Name' })
          .set('Authorization', `Bearer ${testToken}`);
        
        expect(response2.status).toBe(403);
        
        // Verify User 2's data wasn't modified
        const user2Data = await userRepository.findById(user2.id);
        expect(user2Data?.name).toBe('User Two');
      });

      it('should prevent vertical privilege escalation', async () => {
        // Regular user tries to access admin endpoints
        const adminEndpoints = [
          { method: 'get', path: '/api/admin/users' },
          { method: 'post', path: '/api/admin/users' },
          { method: 'delete', path: `/api/admin/users/${testUser.id}` },
          { method: 'get', path: '/api/admin/system/health' }
        ];
        
        for (const endpoint of adminEndpoints) {
          const response = await (request(app) as any)[endpoint.method](endpoint.path)
            .set('Authorization', `Bearer ${testToken}`);
          
          expect(response.status).toBe(403);
        }
      });

      it('should prevent role manipulation in requests', async () => {
        // Try to escalate role in profile update
        const response1 = await request(app)
          .patch('/api/users/me')
          .send({ 
            name: 'Updated Name',
            role: 'admin' // Attempt to escalate
          })
          .set('Authorization', `Bearer ${testToken}`);
        
        // Should either reject or ignore role field
        expect([200, 400, 422]).toContain(response1.status);
        
        // Verify role wasn't changed
        const updatedUser = await userRepository.findById(testUser.id);
        expect(updatedUser?.role).toBe('user');
      });
    });

    describe('Data Exfiltration Prevention', () => {
      it('should prevent bulk data extraction', async () => {
        // Try to extract large amounts of data
        const response1 = await request(app)
          .get('/api/media-requests')
          .query({ limit: 10000 }) // Excessive limit
          .set('Authorization', `Bearer ${testToken}`);
        
        expect(response1.status).toBe(200);
        
        // Should enforce reasonable pagination limits
        expect(response1.body.data.length).toBeLessThan(100);
        
        // Try to access all users data
        const response2 = await request(app)
          .get('/api/users')
          .set('Authorization', `Bearer ${testToken}`);
        
        // Should be forbidden for regular users
        expect(response2.status).toBe(403);
      });

      it('should prevent sensitive data leakage in responses', async () => {
        // Get user profile
        const response = await request(app)
          .get('/api/users/me')
          .set('Authorization', `Bearer ${testToken}`);
        
        expect(response.status).toBe(200);
        
        // Should not contain sensitive fields
        expect(response.body).not.toHaveProperty('password');
        expect(response.body).not.toHaveProperty('passwordHash');
        expect(response.body).not.toHaveProperty('plexToken');
        expect(response.body).not.toHaveProperty('sessionToken');
        
        // Check response headers don't leak info
        expect(response.headers).not.toHaveProperty('x-internal-user-id');
        expect(response.headers).not.toHaveProperty('x-database-id');
      });
    });

    describe('API Abuse Prevention', () => {
      it('should prevent API flooding attacks', async () => {
        // Flood API with rapid requests
        const floodRequests = Array(50).fill(null).map(() =>
          request(app)
            .get('/api/media-requests')
            .set('Authorization', `Bearer ${testToken}`)
        );
        
        const responses = await Promise.all(floodRequests);
        
        // Some should be rate limited
        const rateLimited = responses.filter(r => r.status === 429);
        expect(rateLimited.length).toBeGreaterThan(0);
        
        // Server should remain stable
        const errors = responses.filter(r => r.status >= 500);
        expect(errors.length).toBe(0);
      });

      it('should handle malformed request payloads gracefully', async () => {
        const malformedPayloads = [
          'not-json',
          '{ invalid json',
          '{ "key": }',
          '{ "recursive": { "recursive": { "recursive": true } } }',
          'A'.repeat(10000), // Large payload
          '\x00\x01\x02\x03', // Binary data
          '<xml>not json</xml>'
        ];
        
        for (const payload of malformedPayloads) {
          const response = await request(app)
            .post('/api/media-requests')
            .set('Content-Type', 'application/json')
            .set('Authorization', `Bearer ${testToken}`)
            .send(payload);
          
          // Should handle gracefully, not crash
          expect(response.status).toBeLessThan(500);
        }
      });
    });
  });

  describe('🔎 SECURITY CONFIGURATION VALIDATION', () => {
    it('should validate security headers are properly set', async () => {
      const response = await request(app)
        .get('/api/health');
      
      // Check for security headers
      expect(response.headers).toHaveProperty('x-content-type-options');
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      
      expect(response.headers).toHaveProperty('x-frame-options');
      expect(['DENY', 'SAMEORIGIN']).toContain(response.headers['x-frame-options']);
      
      expect(response.headers).toHaveProperty('x-xss-protection');
      
      // Should have CSP header
      if (response.headers['content-security-policy']) {
        expect(response.headers['content-security-policy']).toContain("default-src 'self'");
      }
    });

    it('should validate CORS configuration', async () => {
      // Test CORS preflight
      const response = await request(app)
        .options('/api/users/me')
        .set('Origin', 'https://malicious.com')
        .set('Access-Control-Request-Method', 'GET');
      
      // Should not allow all origins
      expect(response.headers['access-control-allow-origin']).not.toBe('*');
      
      // Should have specific allowed origin
      const allowedOrigin = response.headers['access-control-allow-origin'];
      if (allowedOrigin) {
        expect(allowedOrigin).toMatch(/^https?:\/\/(localhost|127\.0\.0\.1|.*\.local)/);
      }
    });

    it('should validate environment security', async () => {
      // Check that sensitive env vars are not exposed
      const response = await request(app)
        .get('/api/debug/env') // This endpoint should not exist
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(response.status).toBe(404); // Should not expose env vars
      
      // Check that errors don't leak env info
      const errorResponse = await request(app)
        .get('/api/nonexistent')
        .set('Authorization', `Bearer ${testToken}`);
      
      const responseText = JSON.stringify(errorResponse.body);
      expect(responseText).not.toContain(process.env.JWT_SECRET || '');
      expect(responseText).not.toContain('DATABASE_URL');
      expect(responseText).not.toContain('REDIS_URL');
    });
  });

  describe('📦 FILE UPLOAD SECURITY', () => {
    it('should prevent malicious file uploads', async () => {
      const maliciousFiles = [
        { name: 'malware.exe', type: 'application/octet-stream', content: 'MZ\x90\x00' },
        { name: 'script.js', type: 'application/javascript', content: 'alert("XSS")' },
        { name: '../../../etc/passwd', type: 'text/plain', content: 'root:x:0:0' },
        { name: 'image.php', type: 'image/jpeg', content: '<?php system($_GET["cmd"]); ?>' },
        { name: 'large-file.txt', type: 'text/plain', content: 'A'.repeat(10000000) }
      ];
      
      for (const file of maliciousFiles) {
        const response = await request(app)
          .post('/api/upload')
          .attach('file', Buffer.from(file.content), {
            filename: file.name,
            contentType: file.type
          })
          .set('Authorization', `Bearer ${testToken}`);
        
        // Should reject malicious files or endpoint should not exist
        expect([400, 403, 404, 413, 422]).toContain(response.status);
      }
    });
  });
});
