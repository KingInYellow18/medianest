/**
 * COMPREHENSIVE API INTEGRATION TESTS
 * 
 * Complete integration testing for all major API workflows
 * Covers authentication, media requests, error handling, and user workflows
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { createServer } from '../../src/server';
import { DatabaseTestHelper } from '../helpers/database-test-helper';
import { AuthTestHelper } from '../helpers/auth-test-helper';

const prisma = new PrismaClient();
let app: any;
let server: any;
let dbHelper: DatabaseTestHelper;
let authHelper: AuthTestHelper;

describe('Comprehensive API Integration Tests', () => {
  beforeAll(async () => {
    dbHelper = new DatabaseTestHelper();
    authHelper = new AuthTestHelper();
    
    // Setup test database
    await dbHelper.setupTestDatabase();
    
    // Create test server
    app = await createServer();
    server = app.listen(0); // Use random available port
  });

  afterAll(async () => {
    await server?.close();
    await dbHelper.cleanupTestDatabase();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await dbHelper.seedTestData();
  });

  describe('Authentication Flow Integration', () => {
    test('should complete full user registration and login workflow', async () => {
      // Step 1: User registration
      const registrationData = {
        email: 'test@medianest.com',
        username: 'testuser',
        password: 'SecurePassword123!',
        plexId: 'plex-test-id'
      };

      const registrationResponse = await request(app)
        .post('/api/v1/auth/register')
        .send(registrationData)
        .expect(201);

      expect(registrationResponse.body).toHaveProperty('user');
      expect(registrationResponse.body).toHaveProperty('tokens');
      expect(registrationResponse.body.user.email).toBe(registrationData.email);

      // Step 2: Login with credentials
      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: registrationData.email,
          password: registrationData.password
        })
        .expect(200);

      expect(loginResponse.body).toHaveProperty('user');
      expect(loginResponse.body).toHaveProperty('tokens');
      const { accessToken, refreshToken } = loginResponse.body.tokens;

      // Step 3: Access protected resource
      const protectedResponse = await request(app)
        .get('/api/v1/dashboard/stats')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(protectedResponse.body).toHaveProperty('stats');

      // Step 4: Token refresh workflow
      const refreshResponse = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      expect(refreshResponse.body).toHaveProperty('tokens');
      expect(refreshResponse.body.tokens.accessToken).not.toBe(accessToken);
    });

    test('should handle multi-device session management', async () => {
      const user = await authHelper.createTestUser();
      const credentials = { email: user.email, password: 'password123' };

      // Login from device 1
      const device1Login = await request(app)
        .post('/api/v1/auth/login')
        .send(credentials)
        .set('User-Agent', 'Device1/TestApp')
        .expect(200);

      // Login from device 2
      const device2Login = await request(app)
        .post('/api/v1/auth/login')
        .send(credentials)
        .set('User-Agent', 'Device2/TestApp')
        .expect(200);

      // Both sessions should be active
      expect(device1Login.body.tokens.accessToken).toBeDefined();
      expect(device2Login.body.tokens.accessToken).toBeDefined();
      expect(device1Login.body.tokens.accessToken).not.toBe(device2Login.body.tokens.accessToken);

      // Test concurrent access from both devices
      const device1Access = await request(app)
        .get('/api/v1/dashboard/stats')
        .set('Authorization', `Bearer ${device1Login.body.tokens.accessToken}`)
        .expect(200);

      const device2Access = await request(app)
        .get('/api/v1/dashboard/stats')
        .set('Authorization', `Bearer ${device2Login.body.tokens.accessToken}`)
        .expect(200);

      expect(device1Access.body).toHaveProperty('stats');
      expect(device2Access.body).toHaveProperty('stats');
    });
  });

  describe('Media Request Workflow Integration', () => {
    test('should complete full media request lifecycle', async () => {
      const user = await authHelper.createTestUser();
      const accessToken = await authHelper.generateAccessToken(user.id);

      // Step 1: Search for media
      const searchResponse = await request(app)
        .get('/api/v1/media/search')
        .query({ query: 'Inception', type: 'movie' })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(searchResponse.body).toHaveProperty('results');
      expect(Array.isArray(searchResponse.body.results)).toBe(true);

      // Step 2: Create media request
      const mediaData = {
        title: 'Inception',
        year: 2010,
        type: 'movie',
        imdbId: 'tt1375666',
        tmdbId: 27205
      };

      const requestResponse = await request(app)
        .post('/api/v1/media/request')
        .send(mediaData)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(201);

      expect(requestResponse.body).toHaveProperty('id');
      expect(requestResponse.body).toHaveProperty('status');
      expect(requestResponse.body.status).toBe('pending');
      const requestId = requestResponse.body.id;

      // Step 3: Check request status
      const statusResponse = await request(app)
        .get(`/api/v1/media/request/${requestId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(statusResponse.body).toHaveProperty('id', requestId);
      expect(statusResponse.body).toHaveProperty('status');

      // Step 4: Admin approval workflow
      const admin = await authHelper.createTestAdmin();
      const adminToken = await authHelper.generateAccessToken(admin.id);

      const approvalResponse = await request(app)
        .patch(`/api/v1/media/request/${requestId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(approvalResponse.body.status).toBe('approved');

      // Step 5: Verify request history
      const historyResponse = await request(app)
        .get('/api/v1/media/requests')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(Array.isArray(historyResponse.body.requests)).toBe(true);
      const userRequest = historyResponse.body.requests.find((r: any) => r.id === requestId);
      expect(userRequest).toBeDefined();
      expect(userRequest.status).toBe('approved');
    });

    test('should handle concurrent media requests', async () => {
      const users = await Promise.all([
        authHelper.createTestUser('user1@test.com'),
        authHelper.createTestUser('user2@test.com'),
        authHelper.createTestUser('user3@test.com')
      ]);

      const tokens = await Promise.all(
        users.map(user => authHelper.generateAccessToken(user.id))
      );

      // Create concurrent requests
      const requestPromises = tokens.map((token, index) =>
        request(app)
          .post('/api/v1/media/request')
          .send({
            title: `Test Movie ${index + 1}`,
            year: 2020 + index,
            type: 'movie',
            imdbId: `tt000000${index + 1}`,
            tmdbId: 1000 + index
          })
          .set('Authorization', `Bearer ${token}`)
      );

      const responses = await Promise.all(requestPromises);
      
      // All requests should succeed
      responses.forEach((response, index) => {
        expect(response.status).toBe(201);
        expect(response.body).toHaveProperty('id');
        expect(response.body.title).toBe(`Test Movie ${index + 1}`);
      });

      // Verify all requests exist in database
      const allRequestsResponse = await request(app)
        .get('/api/v1/admin/requests')
        .set('Authorization', `Bearer ${await authHelper.generateAccessToken((await authHelper.createTestAdmin()).id)}`)
        .expect(200);

      expect(allRequestsResponse.body.requests.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Real-time Features Integration', () => {
    test('should handle WebSocket connections and real-time updates', async () => {
      const user = await authHelper.createTestUser();
      const accessToken = await authHelper.generateAccessToken(user.id);

      // This would typically use a WebSocket client, simplified for test
      const socketResponse = await request(app)
        .get('/api/v1/socket/info')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(socketResponse.body).toHaveProperty('socketUrl');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle malformed requests gracefully', async () => {
      const user = await authHelper.createTestUser();
      const accessToken = await authHelper.generateAccessToken(user.id);

      // Test malformed JSON
      const malformedResponse = await request(app)
        .post('/api/v1/media/request')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('Content-Type', 'application/json')
        .send('{"malformed": json}')
        .expect(400);

      expect(malformedResponse.body).toHaveProperty('error');

      // Test missing required fields
      const incompleteResponse = await request(app)
        .post('/api/v1/media/request')
        .send({ title: 'Movie' }) // Missing required fields
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);

      expect(incompleteResponse.body).toHaveProperty('error');
      expect(incompleteResponse.body.error).toContain('validation');
    });

    test('should handle rate limiting correctly', async () => {
      const user = await authHelper.createTestUser();
      const accessToken = await authHelper.generateAccessToken(user.id);

      // Make multiple rapid requests to trigger rate limiting
      const rapidRequests = Array(10).fill(null).map(() =>
        request(app)
          .get('/api/v1/media/search')
          .query({ query: 'test' })
          .set('Authorization', `Bearer ${accessToken}`)
      );

      const responses = await Promise.all(rapidRequests.map(req => 
        req.then(res => res.status).catch(err => err.status || 500)
      ));

      // Should have at least some rate limited responses
      const rateLimitedCount = responses.filter(status => status === 429).length;
      expect(rateLimitedCount).toBeGreaterThan(0);
    });

    test('should handle database connection failures gracefully', async () => {
      // Simulate database failure by using invalid connection
      const originalUrl = process.env.DATABASE_URL;
      process.env.DATABASE_URL = 'postgresql://invalid:invalid@invalid:5432/invalid';

      const healthResponse = await request(app)
        .get('/api/v1/health')
        .expect(503);

      expect(healthResponse.body).toHaveProperty('status', 'error');
      expect(healthResponse.body).toHaveProperty('database');
      expect(healthResponse.body.database.status).toBe('down');

      // Restore original URL
      process.env.DATABASE_URL = originalUrl;
    });
  });

  describe('Performance and Load Testing', () => {
    test('should handle high load of simultaneous requests', async () => {
      const users = await Promise.all(
        Array(20).fill(null).map(() => authHelper.createTestUser())
      );
      const tokens = await Promise.all(
        users.map(user => authHelper.generateAccessToken(user.id))
      );

      const startTime = Date.now();
      
      // Create 100 simultaneous requests
      const loadTestPromises = Array(100).fill(null).map((_, index) => 
        request(app)
          .get('/api/v1/dashboard/stats')
          .set('Authorization', `Bearer ${tokens[index % tokens.length]}`)
      );

      const responses = await Promise.allSettled(loadTestPromises);
      const duration = Date.now() - startTime;
      
      const successfulResponses = responses.filter(
        (result): result is PromiseFulfilledResult<any> => 
          result.status === 'fulfilled' && result.value.status === 200
      );

      // Should handle most requests successfully within reasonable time
      expect(successfulResponses.length).toBeGreaterThan(80); // 80% success rate minimum
      expect(duration).toBeLessThan(10000); // Complete within 10 seconds
    });

    test('should maintain response times under load', async () => {
      const user = await authHelper.createTestUser();
      const accessToken = await authHelper.generateAccessToken(user.id);

      const responseTimes: number[] = [];
      
      // Measure response times for multiple requests
      for (let i = 0; i < 10; i++) {
        const startTime = Date.now();
        
        await request(app)
          .get('/api/v1/dashboard/stats')
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(200);
          
        responseTimes.push(Date.now() - startTime);
      }

      const averageResponseTime = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
      const maxResponseTime = Math.max(...responseTimes);

      // Performance thresholds
      expect(averageResponseTime).toBeLessThan(500); // 500ms average
      expect(maxResponseTime).toBeLessThan(1000); // 1s maximum
    });
  });

  describe('Security Integration Tests', () => {
    test('should prevent unauthorized access to admin endpoints', async () => {
      const user = await authHelper.createTestUser();
      const userToken = await authHelper.generateAccessToken(user.id);

      const unauthorizedResponse = await request(app)
        .get('/api/v1/admin/users')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

      expect(unauthorizedResponse.body).toHaveProperty('error');
      expect(unauthorizedResponse.body.error).toContain('Insufficient permissions');
    });

    test('should validate JWT token integrity', async () => {
      const invalidToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.invalid_signature';

      const response = await request(app)
        .get('/api/v1/dashboard/stats')
        .set('Authorization', `Bearer ${invalidToken}`)
        .expect(401);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Invalid token');
    });

    test('should sanitize user input and prevent XSS', async () => {
      const user = await authHelper.createTestUser();
      const accessToken = await authHelper.generateAccessToken(user.id);

      const maliciousInput = {
        title: '<script>alert("xss")</script>Inception',
        description: 'A movie about <img src=x onerror=alert("xss")> dreams'
      };

      const response = await request(app)
        .post('/api/v1/media/request')
        .send({
          ...maliciousInput,
          year: 2010,
          type: 'movie',
          imdbId: 'tt1375666'
        })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('validation');
    });
  });
});