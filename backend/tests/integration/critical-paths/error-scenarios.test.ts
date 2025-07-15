import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { app } from '@/app';
import { server } from '../../mocks/server';
import { http, HttpResponse } from 'msw';
import { createClient } from 'redis';

const prisma = new PrismaClient();
const redis = createClient({ url: process.env.REDIS_URL });

describe('Critical Path: Error Scenarios and Graceful Degradation', () => {
  let authToken: string;
  let userId: string;

  beforeAll(async () => {
    await redis.connect();

    // Clean up test database
    await prisma.serviceConfiguration.deleteMany();
    await prisma.user.deleteMany();

    // Create test user
    const user = await prisma.user.create({
      data: {
        plexId: 'test-plex-id',
        username: 'testuser',
        email: 'test@example.com',
        role: 'user',
        status: 'active',
      },
    });
    userId = user.id;
    authToken = global.createTestJWT({ userId: user.id, role: user.role });

    // Set up service configurations
    await prisma.serviceConfiguration.createMany({
      data: [
        {
          service: 'plex',
          url: 'http://plex.local:32400',
          apiKey: 'plex-token',
          enabled: true,
          isConfigured: true,
        },
        {
          service: 'overseerr',
          url: 'http://overseerr.local',
          apiKey: 'overseerr-api-key',
          enabled: true,
          isConfigured: true,
        },
        {
          service: 'uptime_kuma',
          url: 'http://uptime-kuma.local',
          enabled: true,
          isConfigured: true,
        },
      ],
    });
  });

  afterAll(async () => {
    await redis.disconnect();
    await prisma.$disconnect();
  });

  beforeEach(() => {
    server.resetHandlers();
  });

  describe('Plex Service Failures', () => {
    it('should handle Plex being completely down', async () => {
      // Override all Plex endpoints to fail
      server.use(
        http.all(/plex/, () => {
          return HttpResponse.error();
        }),
      );

      // Login should fail gracefully
      const pinResponse = await request(app).post('/api/v1/auth/plex/pin').expect(503);

      expect(pinResponse.body).toMatchObject({
        error: expect.stringContaining('temporarily unavailable'),
        service: 'plex',
      });

      // Service status should reflect Plex is down
      const statusResponse = await request(app)
        .get('/api/v1/services/status')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const plexStatus = statusResponse.body.services.find((s: any) => s.service === 'plex');
      expect(plexStatus).toMatchObject({
        status: 'offline',
        error: expect.any(String),
      });
    });

    it('should allow app to function when Plex is down for authenticated users', async () => {
      server.use(
        http.all(/plex/, () => {
          return HttpResponse.error();
        }),
      );

      // User can still access other features
      const servicesResponse = await request(app)
        .get('/api/v1/services/status')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(servicesResponse.body.services).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ service: 'overseerr' }),
          expect.objectContaining({ service: 'uptime_kuma' }),
        ]),
      );
    });

    it('should handle Plex timeout gracefully', async () => {
      // Simulate slow Plex response
      server.use(
        http.get(/plex/, async () => {
          await new Promise((resolve) => setTimeout(resolve, 6000)); // 6 second delay
          return HttpResponse.json({});
        }),
      );

      const startTime = Date.now();
      const response = await request(app)
        .get('/api/v1/plex/libraries')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(504);

      const duration = Date.now() - startTime;

      // Should timeout after ~5 seconds, not wait forever
      expect(duration).toBeLessThan(5500);
      expect(response.body.error).toContain('timeout');
    });
  });

  describe('Overseerr Service Failures', () => {
    it('should handle Overseerr being unavailable during search', async () => {
      server.use(
        http.get(/overseerr.*search/, () => {
          return HttpResponse.json({ error: 'Service Unavailable' }, { status: 503 });
        }),
      );

      const response = await request(app)
        .get('/api/v1/media/search')
        .query({ q: 'Test Movie' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(503);

      expect(response.body).toMatchObject({
        error: expect.stringContaining('Search service'),
        retryAfter: expect.any(Number),
      });
    });

    it('should queue requests when Overseerr is temporarily down', async () => {
      // First, Overseerr is down
      server.use(
        http.post(/overseerr.*request/, () => {
          return HttpResponse.json({ error: 'Service Unavailable' }, { status: 503 });
        }),
      );

      const requestResponse = await request(app)
        .post('/api/v1/media/request')
        .send({
          mediaType: 'movie',
          mediaId: 123,
          title: 'Test Movie',
        })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(202); // Accepted for queuing

      expect(requestResponse.body).toMatchObject({
        message: expect.stringContaining('queued'),
        requestId: expect.any(String),
        status: 'queued',
      });

      // Verify request was stored for retry
      const queuedRequest = await prisma.mediaRequest.findUnique({
        where: { id: requestResponse.body.requestId },
      });

      expect(queuedRequest).toMatchObject({
        status: 'queued',
        retryCount: 0,
      });
    });
  });

  describe('Uptime Kuma Service Failures', () => {
    it('should provide mock data when Uptime Kuma is down', async () => {
      server.use(
        http.all(/uptime-kuma/, () => {
          return HttpResponse.error();
        }),
      );

      const response = await request(app)
        .get('/api/v1/services/status')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const uptimeKumaStatus = response.body.services.find((s: any) => s.service === 'uptime_kuma');

      expect(uptimeKumaStatus).toMatchObject({
        status: 'degraded',
        monitors: expect.arrayContaining([
          expect.objectContaining({
            status: 'unknown',
            message: expect.stringContaining('Unable to fetch'),
          }),
        ]),
      });
    });

    it('should handle WebSocket disconnection gracefully', async () => {
      // This tests the WebSocket fallback mechanism
      const response = await request(app)
        .get('/api/v1/services/status/uptime_kuma')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        connectionType: expect.stringMatching(/polling|fallback/),
        message: expect.any(String),
      });
    });
  });

  describe('Database Connection Failures', () => {
    it('should handle database connection errors', async () => {
      // Mock Prisma to throw connection error
      const originalFindMany = prisma.user.findMany;
      prisma.user.findMany = vi.fn().mockRejectedValue(new Error('P2002: Connection refused'));

      const response = await request(app)
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(503);

      expect(response.body).toMatchObject({
        error: 'Database temporarily unavailable',
        retryAfter: expect.any(Number),
      });

      // Restore original method
      prisma.user.findMany = originalFindMany;
    });

    it('should use cached data when database is slow', async () => {
      // Pre-populate cache
      await redis.setex(
        'service_status:plex',
        300,
        JSON.stringify({
          status: 'online',
          lastChecked: new Date().toISOString(),
          details: { version: '1.32.8' },
        }),
      );

      // Mock slow database
      const originalFindMany = prisma.serviceStatus.findMany;
      prisma.serviceStatus.findMany = vi.fn().mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 3000));
        return [];
      });

      const startTime = Date.now();
      const response = await request(app)
        .get('/api/v1/services/status')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      const duration = Date.now() - startTime;

      // Should return quickly from cache
      expect(duration).toBeLessThan(500);
      expect(response.body.services).toContainEqual(
        expect.objectContaining({
          service: 'plex',
          status: 'online',
        }),
      );

      // Restore
      prisma.serviceStatus.findMany = originalFindMany;
    });
  });

  describe('Redis Connection Failures', () => {
    it('should function without Redis for critical operations', async () => {
      // Temporarily disconnect Redis
      await redis.disconnect();

      // Auth should still work (without rate limiting)
      const meResponse = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(meResponse.body.id).toBe(userId);

      // Reconnect for cleanup
      await redis.connect();
    });

    it('should warn about degraded rate limiting when Redis is down', async () => {
      // Mock Redis connection error
      const originalGet = redis.get;
      redis.get = vi.fn().mockRejectedValue(new Error('Connection refused'));

      const response = await request(app)
        .get('/api/v1/services/status')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Should include warning in response headers
      expect(response.headers['x-degraded-mode']).toBe('rate-limiting-disabled');

      // Restore
      redis.get = originalGet;
    });
  });

  describe('Cascading Failures', () => {
    it('should prevent cascading failures with circuit breakers', async () => {
      let plexCallCount = 0;

      // Plex fails intermittently
      server.use(
        http.get(/plex/, () => {
          plexCallCount++;
          if (plexCallCount < 5) {
            return HttpResponse.json({ error: 'Internal Server Error' }, { status: 500 });
          }
          return HttpResponse.json({ MediaContainer: {} });
        }),
      );

      // Make multiple requests
      const requests = Array(10)
        .fill(null)
        .map(() =>
          request(app).get('/api/v1/plex/libraries').set('Authorization', `Bearer ${authToken}`),
        );

      const responses = await Promise.all(requests);

      // Circuit breaker should open after failures
      const failureCount = responses.filter((r) => r.status === 503).length;
      const successCount = responses.filter((r) => r.status === 200).length;

      // Should have some failures but circuit breaker prevents all from failing
      expect(failureCount).toBeGreaterThan(0);
      expect(plexCallCount).toBeLessThan(10); // Circuit breaker prevented some calls
    });
  });

  describe('User-Friendly Error Messages', () => {
    it('should provide helpful error messages for common scenarios', async () => {
      const errorScenarios = [
        {
          endpoint: '/api/v1/auth/plex/pin',
          override: http.post(/plex.*pins/, () =>
            HttpResponse.json({ error: 'Unauthorized' }, { status: 401 }),
          ),
          expectedError: /Plex authentication service/i,
        },
        {
          endpoint: '/api/v1/media/search?q=test',
          override: http.get(/overseerr.*search/, () =>
            HttpResponse.json({ error: 'API key invalid' }, { status: 401 }),
          ),
          expectedError: /Search service configuration/i,
        },
        {
          endpoint: '/api/v1/youtube/download',
          body: { url: 'invalid-url' },
          expectedError: /valid YouTube URL/i,
        },
      ];

      for (const scenario of errorScenarios) {
        if (scenario.override) {
          server.use(scenario.override);
        }

        const req = request(app)[scenario.body ? 'post' : 'get'](scenario.endpoint);

        if (authToken && scenario.endpoint !== '/api/v1/auth/plex/pin') {
          req.set('Authorization', `Bearer ${authToken}`);
        }

        if (scenario.body) {
          req.send(scenario.body);
        }

        const response = await req;

        expect(response.body.error).toMatch(scenario.expectedError);
        expect(response.body).not.toContain('stack');
        expect(response.body).not.toContain('prisma');
        expect(response.body).not.toContain('sql');
      }
    });
  });

  describe('Recovery and Retry Mechanisms', () => {
    it('should automatically retry failed operations', async () => {
      let attemptCount = 0;

      // Fail first 2 attempts, succeed on 3rd
      server.use(
        http.get(/overseerr.*status/, () => {
          attemptCount++;
          if (attemptCount < 3) {
            return HttpResponse.json({ error: 'Temporary failure' }, { status: 503 });
          }
          return HttpResponse.json({ status: 'ok', version: '1.33.2' });
        }),
      );

      const response = await request(app)
        .get('/api/v1/services/status/overseerr')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.status).toBe('online');
      expect(attemptCount).toBe(3); // Retried twice
    });

    it('should process queued requests when services recover', async () => {
      // Create a queued request
      const queuedRequest = await prisma.mediaRequest.create({
        data: {
          userId,
          externalId: 0, // Not yet submitted to Overseerr
          mediaType: 'movie',
          mediaId: 999,
          title: 'Queued Movie',
          status: 'queued',
          requestedAt: new Date(),
          retryCount: 0,
        },
      });

      // Process retry queue (would normally be a background job)
      const retryResponse = await request(app)
        .post('/api/v1/admin/retry-queued-requests')
        .set('Authorization', `Bearer ${authToken}`) // Would need admin token in real app
        .expect(200);

      expect(retryResponse.body).toMatchObject({
        processed: expect.any(Number),
        succeeded: expect.any(Number),
        failed: expect.any(Number),
      });
    });
  });

  describe('Monitoring and Alerting', () => {
    it('should track error rates and patterns', async () => {
      // Generate some errors
      server.use(http.get(/plex/, () => HttpResponse.json({ error: 'Error' }, { status: 500 })));

      // Make failing requests
      for (let i = 0; i < 5; i++) {
        await request(app)
          .get('/api/v1/plex/libraries')
          .set('Authorization', `Bearer ${authToken}`);
      }

      // Check error metrics
      const metricsResponse = await request(app)
        .get('/api/v1/admin/metrics/errors')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(metricsResponse.body).toMatchObject({
        errorRate: expect.any(Number),
        recentErrors: expect.arrayContaining([
          expect.objectContaining({
            service: 'plex',
            count: expect.any(Number),
            lastOccurred: expect.any(String),
          }),
        ]),
      });
    });
  });
});
