import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { app } from '@/app';
import { server } from '../mocks/server';
import { http, HttpResponse } from 'msw';
import { createClient } from 'redis';

const prisma = new PrismaClient();
const redis = createClient({ url: process.env.REDIS_URL });

describe('API Endpoints: Services (/api/v1/services)', () => {
  let authToken: string;
  let adminToken: string;

  beforeAll(async () => {
    await redis.connect();

    // Clean test database
    await prisma.serviceStatus.deleteMany();
    await prisma.serviceConfiguration.deleteMany();
    await prisma.user.deleteMany();

    // Clear Redis
    await redis.flushDb();

    // Create test users
    const user = await prisma.user.create({
      data: {
        plexId: 'services-test-user',
        username: 'servicesuser',
        email: 'services@example.com',
        role: 'user',
        status: 'active',
      },
    });
    authToken = global.createTestJWT({ userId: user.id, role: user.role });

    const admin = await prisma.user.create({
      data: {
        plexId: 'services-admin-user',
        username: 'servicesadmin',
        email: 'servicesadmin@example.com',
        role: 'admin',
        status: 'active',
      },
    });
    adminToken = global.createTestJWT({ userId: admin.id, role: admin.role });

    // Configure services
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
          config: {
            monitors: {
              '1': { name: 'Plex Server', type: 'status' },
              '2': { name: 'Overseerr', type: 'status' },
              '3': { name: 'Router', type: 'ping' },
            },
          },
        },
      ],
    });
  });

  afterAll(async () => {
    await redis.disconnect();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    server.resetHandlers();
    await redis.flushDb();
  });

  describe('GET /api/v1/services/status', () => {
    it('should return status for all enabled services', async () => {
      const response = await request(app)
        .get('/api/v1/services/status')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        services: expect.arrayContaining([
          expect.objectContaining({
            service: 'plex',
            status: expect.stringMatching(/online|offline|degraded/),
            lastChecked: expect.any(String),
            responseTime: expect.any(Number),
          }),
          expect.objectContaining({
            service: 'overseerr',
            status: expect.stringMatching(/online|offline|degraded/),
            lastChecked: expect.any(String),
          }),
          expect.objectContaining({
            service: 'uptime_kuma',
            status: expect.stringMatching(/online|offline|degraded/),
            monitors: expect.any(Array),
          }),
        ]),
      });

      // Should cache results
      const cachedPlex = await redis.get('service_status:plex');
      expect(cachedPlex).toBeTruthy();
    });

    it('should use cached data on subsequent requests', async () => {
      // First request - populates cache
      await request(app)
        .get('/api/v1/services/status')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Mock services to fail
      server.use(http.all(/.*/, () => HttpResponse.error()));

      // Second request should still work from cache
      const response = await request(app)
        .get('/api/v1/services/status')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.services).toHaveLength(3);
      expect(response.headers['x-cache']).toBe('hit');
    });

    it('should handle individual service failures', async () => {
      server.use(http.get(/plex/, () => HttpResponse.error()));

      const response = await request(app)
        .get('/api/v1/services/status')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const services = response.body.services;
      const plexService = services.find((s: any) => s.service === 'plex');
      const overseerrService = services.find((s: any) => s.service === 'overseerr');

      expect(plexService.status).toBe('offline');
      expect(overseerrService.status).toBe('online');
    });

    it('should require authentication', async () => {
      await request(app).get('/api/v1/services/status').expect(401);
    });

    it('should include refresh parameter support', async () => {
      // Populate cache
      await request(app)
        .get('/api/v1/services/status')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Force refresh
      const response = await request(app)
        .get('/api/v1/services/status')
        .query({ refresh: true })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.headers['x-cache']).toBe('miss');
    });
  });

  describe('GET /api/v1/services/status/:service', () => {
    it('should return detailed status for specific service', async () => {
      const response = await request(app)
        .get('/api/v1/services/status/plex')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        service: 'plex',
        status: expect.stringMatching(/online|offline|degraded/),
        lastChecked: expect.any(String),
        details: expect.objectContaining({
          version: expect.any(String),
          serverName: expect.any(String),
        }),
      });
    });

    it('should return 404 for unknown service', async () => {
      await request(app)
        .get('/api/v1/services/status/unknown')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should return 404 for disabled service', async () => {
      // Disable service
      await prisma.serviceConfiguration.update({
        where: { service: 'overseerr' },
        data: { enabled: false },
      });

      await request(app)
        .get('/api/v1/services/status/overseerr')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      // Re-enable
      await prisma.serviceConfiguration.update({
        where: { service: 'overseerr' },
        data: { enabled: true },
      });
    });

    it('should return special format for uptime_kuma', async () => {
      const response = await request(app)
        .get('/api/v1/services/status/uptime_kuma')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        service: 'uptime_kuma',
        monitors: expect.arrayContaining([
          expect.objectContaining({
            id: expect.any(String),
            name: expect.any(String),
            status: expect.stringMatching(/up|down|unknown/),
            uptime: expect.any(Number),
          }),
        ]),
      });
    });
  });

  describe('GET /api/v1/services/metrics', () => {
    beforeEach(async () => {
      // Create historical status data
      const now = new Date();
      const statusData = [];

      for (let i = 0; i < 24; i++) {
        statusData.push({
          service: 'plex',
          status: i % 12 === 0 ? 'offline' : 'online',
          responseTime: 100 + Math.random() * 50,
          checkedAt: new Date(now.getTime() - i * 60 * 60 * 1000),
          details: {},
        });
      }

      await prisma.serviceStatus.createMany({ data: statusData });
    });

    it('should return aggregated metrics for service', async () => {
      const response = await request(app)
        .get('/api/v1/services/metrics')
        .query({ service: 'plex', period: '24h' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        service: 'plex',
        period: '24h',
        uptime: expect.any(Number),
        avgResponseTime: expect.any(Number),
        totalChecks: expect.any(Number),
        incidents: expect.any(Number),
        timeline: expect.any(Array),
      });

      expect(response.body.uptime).toBeGreaterThan(80);
      expect(response.body.uptime).toBeLessThan(100);
      expect(response.body.incidents).toBeGreaterThanOrEqual(2);
    });

    it('should support different time periods', async () => {
      const periods = ['1h', '6h', '24h', '7d', '30d'];

      for (const period of periods) {
        const response = await request(app)
          .get('/api/v1/services/metrics')
          .query({ service: 'plex', period })
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.period).toBe(period);
      }
    });

    it('should validate parameters', async () => {
      // Missing service
      await request(app)
        .get('/api/v1/services/metrics')
        .query({ period: '24h' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      // Invalid period
      await request(app)
        .get('/api/v1/services/metrics')
        .query({ service: 'plex', period: 'invalid' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });
  });

  describe('GET /api/v1/services/health', () => {
    it('should return overall system health', async () => {
      const response = await request(app)
        .get('/api/v1/services/health')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        status: expect.stringMatching(/healthy|degraded|unhealthy/),
        services: {
          total: expect.any(Number),
          online: expect.any(Number),
          offline: expect.any(Number),
          degraded: expect.any(Number),
        },
        database: expect.stringMatching(/connected|disconnected/),
        redis: expect.stringMatching(/connected|disconnected/),
        uptime: expect.any(Number),
        timestamp: expect.any(String),
      });
    });

    it('should be accessible without authentication for monitoring', async () => {
      const response = await request(app).get('/api/v1/services/health').expect(200);

      expect(response.body.status).toBeDefined();
    });

    it('should indicate degraded status when services are down', async () => {
      // Mock all services as offline
      server.use(http.all(/.*/, () => HttpResponse.error()));

      const response = await request(app).get('/api/v1/services/health').expect(200);

      expect(response.body.status).toBe('degraded');
      expect(response.body.services.offline).toBeGreaterThan(0);
    });
  });

  describe('POST /api/v1/services/:service/configure', () => {
    it('should allow admin to configure service', async () => {
      const response = await request(app)
        .post('/api/v1/services/plex/configure')
        .send({
          url: 'http://new-plex.local:32400',
          apiKey: 'new-plex-token',
        })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        message: expect.stringContaining('configured'),
        service: 'plex',
        testResult: expect.objectContaining({
          success: expect.any(Boolean),
        }),
      });

      // Verify configuration was updated
      const config = await prisma.serviceConfiguration.findUnique({
        where: { service: 'plex' },
      });
      expect(config?.url).toBe('http://new-plex.local:32400');
    });

    it('should test connection before saving', async () => {
      server.use(http.get(/new-invalid/, () => HttpResponse.error()));

      const response = await request(app)
        .post('/api/v1/services/plex/configure')
        .send({
          url: 'http://new-invalid.local',
          apiKey: 'invalid-token',
        })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);

      expect(response.body.error).toContain('Connection test failed');
    });

    it('should require admin role', async () => {
      await request(app)
        .post('/api/v1/services/plex/configure')
        .send({
          url: 'http://test.local',
          apiKey: 'test',
        })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);
    });

    it('should encrypt sensitive data', async () => {
      await request(app)
        .post('/api/v1/services/overseerr/configure')
        .send({
          url: 'http://overseerr.local',
          apiKey: 'super-secret-key',
        })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Check database - API key should be encrypted
      const config = await prisma.serviceConfiguration.findUnique({
        where: { service: 'overseerr' },
      });

      expect(config?.apiKey).toBeTruthy();
      expect(config?.apiKey).not.toBe('super-secret-key');
      expect(config?.apiKey).toContain(':'); // Encrypted format
    });
  });

  describe('WebSocket Events', () => {
    it('should emit status updates via WebSocket', async () => {
      // This would typically test WebSocket emission
      // For unit tests, we verify the endpoint triggers events

      const response = await request(app)
        .get('/api/v1/services/status')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // In real implementation, would verify socket.emit was called
      expect(response.headers['x-websocket-event']).toBe('service:status');
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits on status checks', async () => {
      // Make many rapid requests
      const requests = Array(50)
        .fill(null)
        .map(() =>
          request(app)
            .get('/api/v1/services/status')
            .query({ refresh: true })
            .set('Authorization', `Bearer ${authToken}`),
        );

      const responses = await Promise.all(requests);
      const rateLimited = responses.filter((r) => r.status === 429);

      expect(rateLimited.length).toBeGreaterThan(0);
    });
  });
});
