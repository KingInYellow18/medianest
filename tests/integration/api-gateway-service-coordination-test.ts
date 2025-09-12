import { EventEmitter } from 'events';
import { Server } from 'http';

import request from 'supertest';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WebSocket } from 'ws';

import { createAuthToken } from '../helpers/auth';
import { databaseCleanup } from '../helpers/database-cleanup';

import { app } from '@/app';
import { initializeRedis, getRedis } from '@/config/redis';
import { prisma } from '@/db/prisma';
import { IntegrationService } from '@/services/integration.service';





/**
 * HIVE-MIND API INTEGRATION COORDINATOR
 * Comprehensive API Gateway and Service Integration Testing
 *
 * Tests the complete integration matrix:
 * 1. Authentication Flow Integration
 * 2. Service-to-Service Communication
 * 3. External API Integration
 * 4. Real-time Features
 * 5. Error Handling Coordination
 */

describe('API Gateway and Service Integration Coordination', () => {
  let server: Server;
  let redis: ReturnType<typeof getRedis>;
  let integrationService: IntegrationService;
  let testUser: any;
  let adminToken: string;
  let userToken: string;

  beforeEach(async () => {
    // Initialize all services
    await initializeRedis();
    redis = getRedis();
    await redis.flushdb();
    await databaseCleanup.cleanAll();

    // Create test users
    const adminUser = await prisma.user.create({
      data: {
        plexId: 'admin-test-id',
        plexUsername: 'admin',
        email: 'admin@test.com',
        role: 'admin',
        status: 'active',
        plexToken: 'encrypted-admin-token',
      },
    });

    testUser = await prisma.user.create({
      data: {
        plexId: 'user-test-id',
        plexUsername: 'testuser',
        email: 'user@test.com',
        role: 'user',
        status: 'active',
        plexToken: 'encrypted-user-token',
      },
    });

    adminToken = createAuthToken(adminUser);
    userToken = createAuthToken(testUser);

    // Initialize integration service
    integrationService = new IntegrationService({
      plex: {
        enabled: true,
        defaultToken: 'test-token',
        serverUrl: 'http://plex.local:32400',
      },
      overseerr: {
        enabled: true,
        url: 'http://overseerr.local:5055',
        apiKey: 'test-overseerr-key',
      },
      uptimeKuma: {
        enabled: true,
        url: 'ws://uptime.local:3001',
        username: 'admin',
        password: 'password',
      },
    });
    await integrationService.initialize();
  });

  afterEach(async () => {
    if (integrationService) {
      await integrationService.shutdown();
    }
    if (server) {
      server.close();
    }
    await redis.flushdb();
    await databaseCleanup.cleanAll();
    await prisma.$disconnect();
  });

  describe('1. Authentication Flow Integration', () => {
    it('should coordinate Plex OAuth → JWT token generation → API access', async () => {
      // Step 1: Generate PIN (API Gateway → Plex API)
      const pinResponse = await request(app)
        .post('/api/v1/auth/plex/pin')
        .send({ clientName: 'Integration Test' })
        .expect(200);

      expect(pinResponse.body.success).toBe(true);
      expect(pinResponse.body.data).toHaveProperty('id');

      // Step 2: Verify PIN and get JWT (Plex API → Backend → Database)
      const verifyResponse = await request(app)
        .post('/api/v1/auth/plex/verify')
        .send({
          pinId: 'test-pin-first-user',
          rememberMe: true,
        })
        .expect(200);

      const { token } = verifyResponse.body.data;

      // Step 3: NextAuth.js session management
      const sessionResponse = await request(app)
        .get('/api/v1/auth/session')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(sessionResponse.body.data.user).toBeDefined();

      // Step 4: Protected route validation
      const protectedResponse = await request(app)
        .get('/api/v1/services/status')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(protectedResponse.body.success).toBe(true);

      // Step 5: Cross-service authentication validation
      const mediaResponse = await request(app)
        .get('/api/v1/media/search')
        .query({ query: 'test' })
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(mediaResponse.body.success).toBe(true);
    });

    it('should handle authentication failures across service boundaries', async () => {
      // Test invalid token across multiple services
      const invalidToken = 'invalid.jwt.token';

      const services = [
        '/api/v1/auth/session',
        '/api/v1/services/status',
        '/api/v1/media/search?query=test',
        '/api/v1/media/requests',
      ];

      for (const service of services) {
        const response = await request(app)
          .get(service)
          .set('Authorization', `Bearer ${invalidToken}`)
          .expect(401);

        expect(response.body.success).toBe(false);
      }
    });

    it('should coordinate role-based access control across services', async () => {
      // Admin endpoints - should succeed with admin token
      const adminEndpoints = [
        { method: 'get', path: '/api/v1/services/status' },
        { method: 'get', path: '/api/v1/admin/users' },
        {
          method: 'post',
          path: '/api/v1/admin/users/role',
          body: { userId: testUser.id, role: 'user' },
        },
      ];

      for (const endpoint of adminEndpoints) {
        const response = await request(app)
          [endpoint.method as 'get' | 'post'](endpoint.path)
          .set('Authorization', `Bearer ${adminToken}`)
          .send(endpoint.body || {});

        expect([200, 201, 204]).toContain(response.status);
      }

      // Admin endpoints - should fail with user token
      for (const endpoint of adminEndpoints) {
        if (endpoint.path.includes('/admin/')) {
          const response = await request(app)
            [endpoint.method as 'get' | 'post'](endpoint.path)
            .set('Authorization', `Bearer ${userToken}`)
            .send(endpoint.body || {});

          expect([403, 401]).toContain(response.status);
        }
      }
    });
  });

  describe('2. Service-to-Service Communication', () => {
    it('should coordinate Backend API ↔ Frontend Next.js app', async () => {
      // Test API endpoints that frontend consumes
      const frontendEndpoints = [
        { path: '/api/v1/services/status', expectData: 'services' },
        { path: '/api/v1/media/requests', expectData: 'requests' },
        { path: '/api/v1/auth/session', expectData: 'user' },
      ];

      for (const endpoint of frontendEndpoints) {
        const response = await request(app)
          .get(endpoint.path)
          .set('Authorization', `Bearer ${userToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty(endpoint.expectData);
      }
    });

    it('should validate shared library integration across services', async () => {
      // Test shared validation schemas
      const invalidRequest = await request(app)
        .post('/api/v1/media/requests')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          // Invalid request missing required fields
          type: 'invalid',
        })
        .expect(400);

      expect(invalidRequest.body.success).toBe(false);
      expect(invalidRequest.body.error).toHaveProperty('validation');

      // Test shared utility functions via API responses
      const validRequest = await request(app)
        .post('/api/v1/media/requests')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          type: 'movie',
          title: 'Test Movie',
          tmdbId: 12345,
          overview: 'Test overview',
        })
        .expect(201);

      expect(validRequest.body.success).toBe(true);
      expect(validRequest.body.data).toHaveProperty('id');
    });

    it('should coordinate database transaction management', async () => {
      // Test transactional operations across services
      const mediaRequestResponse = await request(app)
        .post('/api/v1/media/requests')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          type: 'movie',
          title: 'Transaction Test',
          tmdbId: 54321,
          overview: 'Testing transactions',
        })
        .expect(201);

      const requestId = mediaRequestResponse.body.data.id;

      // Verify request was created with proper relationships
      const getRequestResponse = await request(app)
        .get(`/api/v1/media/requests/${requestId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(getRequestResponse.body.data).toMatchObject({
        id: requestId,
        userId: testUser.id,
        status: 'pending',
        title: 'Transaction Test',
      });

      // Test transaction rollback on admin action
      await request(app)
        .post(`/api/v1/media/requests/${requestId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Verify status change
      const updatedResponse = await request(app)
        .get(`/api/v1/media/requests/${requestId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(updatedResponse.body.data.status).toBe('approved');
    });
  });

  describe('3. External API Integration', () => {
    it('should coordinate Plex Server API integration', async () => {
      // Test Plex library access
      const libraryResponse = await request(app)
        .get('/api/v1/plex/libraries')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(libraryResponse.body.success).toBe(true);
      expect(libraryResponse.body.data).toHaveProperty('libraries');

      // Test Plex search functionality
      const searchResponse = await request(app)
        .get('/api/v1/plex/search')
        .query({ query: 'test movie' })
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(searchResponse.body.success).toBe(true);
      expect(searchResponse.body.data).toHaveProperty('results');

      // Test Plex collection management
      const collectionsResponse = await request(app)
        .get('/api/v1/plex/collections')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(collectionsResponse.body.success).toBe(true);
    });

    it('should coordinate Overseerr integration', async () => {
      // Test Overseerr media requests
      const overseerrResponse = await request(app)
        .get('/api/v1/overseerr/requests')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(overseerrResponse.body.success).toBe(true);

      // Test request approval workflow
      const approvalResponse = await request(app)
        .post('/api/v1/overseerr/requests/approve')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ requestId: 'test-request-id' })
        .expect(200);

      expect(approvalResponse.body.success).toBe(true);
    });

    it('should coordinate YouTube yt-dlp service integration', async () => {
      // Test YouTube download initiation
      const downloadResponse = await request(app)
        .post('/api/v1/youtube/download')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          url: 'https://www.youtube.com/watch?v=test',
          quality: '720p',
          format: 'mp4',
        })
        .expect(202);

      expect(downloadResponse.body.success).toBe(true);
      expect(downloadResponse.body.data).toHaveProperty('jobId');

      // Test download status checking
      const jobId = downloadResponse.body.data.jobId;
      const statusResponse = await request(app)
        .get(`/api/v1/youtube/download/${jobId}/status`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(statusResponse.body.success).toBe(true);
      expect(statusResponse.body.data).toHaveProperty('status');
    });

    it('should coordinate Uptime Kuma monitoring endpoints', async () => {
      // Test monitoring status
      const monitoringResponse = await request(app)
        .get('/api/v1/monitoring/status')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(monitoringResponse.body.success).toBe(true);
      expect(monitoringResponse.body.data).toHaveProperty('monitors');

      // Test alert configuration
      const alertResponse = await request(app)
        .post('/api/v1/monitoring/alerts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          monitorId: 1,
          threshold: 95,
          alertType: 'email',
        })
        .expect(201);

      expect(alertResponse.body.success).toBe(true);
    });
  });

  describe('4. Real-time Features', () => {
    it('should coordinate WebSocket connections for live updates', (done) => {
      const wsUrl = 'ws://localhost:3000/ws';
      const ws = new WebSocket(wsUrl, {
        headers: { Authorization: `Bearer ${userToken}` },
      });

      const events: any[] = [];

      ws.on('open', () => {
        ws.send(JSON.stringify({ type: 'subscribe', channel: 'media-requests' }));
      });

      ws.on('message', (data) => {
        const event = JSON.parse(data.toString());
        events.push(event);

        if (event.type === 'subscription-confirmed') {
          // Trigger an event that should cause a WebSocket notification
          request(app)
            .post('/api/v1/media/requests')
            .set('Authorization', `Bearer ${userToken}`)
            .send({
              type: 'movie',
              title: 'WebSocket Test',
              tmdbId: 99999,
            })
            .end();
        }

        if (event.type === 'media-request-created') {
          expect(event.data.title).toBe('WebSocket Test');
          ws.close();
          done();
        }
      });

      ws.on('error', done);
    });

    it('should coordinate Server-Sent Events for download progress', (done) => {
      // Start a download
      request(app)
        .post('/api/v1/youtube/download')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          url: 'https://www.youtube.com/watch?v=test-sse',
          quality: '720p',
        })
        .end((err, res) => {
          if (err) return done(err);

          const jobId = res.body.data.jobId;

          // Connect to SSE endpoint
          const sseResponse = request(app)
            .get(`/api/v1/youtube/download/${jobId}/progress`)
            .set('Authorization', `Bearer ${userToken}`)
            .set('Accept', 'text/event-stream');

          let progressEvents = 0;

          sseResponse.on('data', (chunk) => {
            const data = chunk.toString();
            if (data.includes('data: ')) {
              progressEvents++;
              if (progressEvents >= 2) {
                sseResponse.abort();
                done();
              }
            }
          });

          sseResponse.on('error', done);
        });
    });

    it('should coordinate cache invalidation across services', async () => {
      // Populate cache by fetching data
      const initialResponse = await request(app)
        .get('/api/v1/media/requests')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      // Create new request (should invalidate cache)
      await request(app)
        .post('/api/v1/media/requests')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          type: 'movie',
          title: 'Cache Test',
          tmdbId: 88888,
        })
        .expect(201);

      // Fetch again (should return updated data)
      const updatedResponse = await request(app)
        .get('/api/v1/media/requests')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(updatedResponse.body.data.requests.length).toBeGreaterThan(
        initialResponse.body.data.requests.length,
      );
    });
  });

  describe('5. Error Handling Coordination', () => {
    it('should coordinate cross-service error propagation', async () => {
      // Simulate Plex service being down
      vi.spyOn(integrationService, 'getPlexClient').mockResolvedValue(null);

      const plexResponse = await request(app)
        .get('/api/v1/plex/libraries')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(503);

      expect(plexResponse.body.success).toBe(false);
      expect(plexResponse.body.error.code).toBe('SERVICE_UNAVAILABLE');
      expect(plexResponse.body.error.service).toBe('plex');
    });

    it('should coordinate circuit breaker patterns', async () => {
      // Test circuit breaker status
      const circuitBreakerResponse = await request(app)
        .get('/api/v1/services/circuit-breaker/status')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(circuitBreakerResponse.body.success).toBe(true);
      expect(circuitBreakerResponse.body.data).toHaveProperty('services');

      // Test circuit breaker reset
      const resetResponse = await request(app)
        .post('/api/v1/services/circuit-breaker/reset')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ service: 'plex' })
        .expect(200);

      expect(resetResponse.body.success).toBe(true);
    });

    it('should coordinate graceful degradation testing', async () => {
      // Test service with partial functionality when dependencies are down
      vi.spyOn(integrationService, 'getOverseerrClient').mockReturnValue(null);

      // Media requests should still work even if Overseerr is down
      const mediaResponse = await request(app)
        .post('/api/v1/media/requests')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          type: 'movie',
          title: 'Degraded Mode Test',
          tmdbId: 77777,
        })
        .expect(201);

      expect(mediaResponse.body.success).toBe(true);
      expect(mediaResponse.body.data.externalStatus).toBe('pending'); // Graceful degradation
    });

    it('should coordinate rate limiting across service boundaries', async () => {
      // Test rate limiting on multiple endpoints
      const requests = [];

      for (let i = 0; i < 20; i++) {
        requests.push(
          request(app)
            .get('/api/v1/media/search')
            .query({ query: `test-${i}` })
            .set('Authorization', `Bearer ${userToken}`),
        );
      }

      const responses = await Promise.all(
        requests.map((req) => req.then((res) => res.status).catch(() => 429)),
      );

      // Should have rate limited some requests
      expect(responses.filter((status) => status === 429).length).toBeGreaterThan(0);
      expect(responses.filter((status) => status === 200).length).toBeGreaterThan(0);
    });

    it('should coordinate distributed timeout handling', async () => {
      // Test timeout propagation across services
      vi.spyOn(integrationService, 'getPlexClient').mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10000)); // Long timeout
        return null;
      });

      const timeoutResponse = await request(app)
        .get('/api/v1/plex/libraries')
        .set('Authorization', `Bearer ${userToken}`)
        .timeout(5000);

      expect([408, 503]).toContain(timeoutResponse.status);
      expect(timeoutResponse.body.success).toBe(false);
    });
  });

  describe('6. Performance and Reliability Integration', () => {
    it('should validate end-to-end performance metrics', async () => {
      const startTime = Date.now();

      // Execute a complex workflow that touches multiple services
      const workflowSteps = [
        // 1. Authenticate
        request(app).get('/api/v1/auth/session').set('Authorization', `Bearer ${userToken}`),
        // 2. Check service status
        request(app).get('/api/v1/services/status').set('Authorization', `Bearer ${userToken}`),
        // 3. Search media
        request(app)
          .get('/api/v1/media/search')
          .query({ query: 'performance' })
          .set('Authorization', `Bearer ${userToken}`),
        // 4. Create request
        request(app)
          .post('/api/v1/media/requests')
          .set('Authorization', `Bearer ${userToken}`)
          .send({ type: 'movie', title: 'Performance Test', tmdbId: 66666 }),
        // 5. Get requests
        request(app).get('/api/v1/media/requests').set('Authorization', `Bearer ${userToken}`),
      ];

      const responses = await Promise.all(workflowSteps);
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // Verify all steps succeeded
      responses.forEach((response) => {
        expect([200, 201]).toContain(response.status);
      });

      // Performance assertion - complete workflow should be fast
      expect(totalTime).toBeLessThan(5000); // 5 seconds max
    });

    it('should coordinate load balancing across service instances', async () => {
      // Simulate multiple concurrent requests
      const concurrentRequests = Array(10)
        .fill(null)
        .map(() =>
          request(app).get('/api/v1/services/status').set('Authorization', `Bearer ${userToken}`),
        );

      const startTime = Date.now();
      const responses = await Promise.all(concurrentRequests);
      const endTime = Date.now();

      // All requests should succeed
      responses.forEach((response) => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      // Should handle concurrent load efficiently
      expect(endTime - startTime).toBeLessThan(2000);
    });

    it('should validate integration health checks', async () => {
      // Comprehensive health check endpoint
      const healthResponse = await request(app)
        .get('/api/v1/health/comprehensive')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(healthResponse.body.success).toBe(true);
      expect(healthResponse.body.data).toHaveProperty('services');
      expect(healthResponse.body.data).toHaveProperty('database');
      expect(healthResponse.body.data).toHaveProperty('redis');
      expect(healthResponse.body.data).toHaveProperty('integrations');

      // Verify individual service health
      const services = healthResponse.body.data.services;
      expect(services).toHaveProperty('plex');
      expect(services).toHaveProperty('overseerr');
      expect(services).toHaveProperty('uptimeKuma');
    });
  });
});
