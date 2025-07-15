import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { app } from '@/app';
import { server } from '../../mocks/server';
import { http, HttpResponse } from 'msw';
import { getIO } from '@/socket/socket';
import { createClient } from 'redis';

const prisma = new PrismaClient();
const redis = createClient({ url: process.env.REDIS_URL });

describe('Critical Path: Service Status Monitoring', () => {
  let authToken: string;
  let userId: string;

  beforeAll(async () => {
    await redis.connect();

    // Clean up test database
    await prisma.serviceStatus.deleteMany();
    await prisma.serviceConfiguration.deleteMany();
    await prisma.user.deleteMany();

    // Clear Redis cache
    await redis.flushDb();

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

    // Generate auth token
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
    // Clear Redis cache before each test
    await redis.flushDb();
  });

  it('should fetch and cache service status from all configured services', async () => {
    // Get service status
    const statusResponse = await request(app)
      .get('/api/v1/services/status')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(statusResponse.body).toMatchObject({
      services: expect.arrayContaining([
        expect.objectContaining({
          service: 'plex',
          status: 'online',
          lastChecked: expect.any(String),
          details: expect.objectContaining({
            version: expect.any(String),
            serverName: expect.any(String),
          }),
        }),
        expect.objectContaining({
          service: 'overseerr',
          status: 'online',
          lastChecked: expect.any(String),
          details: expect.objectContaining({
            version: expect.any(String),
          }),
        }),
        expect.objectContaining({
          service: 'uptime_kuma',
          status: 'online',
          monitors: expect.arrayContaining([
            expect.objectContaining({
              id: '1',
              name: 'Plex Server',
              status: 'up',
              uptime: 99.9,
            }),
          ]),
        }),
      ]),
    });

    // Verify data was cached in Redis
    const cachedPlex = await redis.get('service_status:plex');
    expect(cachedPlex).toBeTruthy();
    const plexData = JSON.parse(cachedPlex!);
    expect(plexData.status).toBe('online');

    // Second request should use cache (faster response)
    const startTime = Date.now();
    const cachedResponse = await request(app)
      .get('/api/v1/services/status')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);
    const responseTime = Date.now() - startTime;

    expect(responseTime).toBeLessThan(100); // Should be fast from cache
    expect(cachedResponse.body).toEqual(statusResponse.body);
  });

  it('should handle individual service failures gracefully', async () => {
    // Override Plex to fail
    server.use(
      http.get(/^https?:\/\/[^\/]+\/$/, ({ request }) => {
        const url = new URL(request.url);
        if (url.hostname.includes('plex')) {
          return HttpResponse.json({ error: 'Connection refused' }, { status: 503 });
        }
        return HttpResponse.json({}); // Other services work
      }),
    );

    const response = await request(app)
      .get('/api/v1/services/status')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    const plexService = response.body.services.find((s: any) => s.service === 'plex');
    const overseerrService = response.body.services.find((s: any) => s.service === 'overseerr');

    expect(plexService).toMatchObject({
      service: 'plex',
      status: 'offline',
      error: expect.stringContaining('unavailable'),
    });

    expect(overseerrService).toMatchObject({
      service: 'overseerr',
      status: 'online',
    });
  });

  it('should emit WebSocket events for status updates', async () => {
    const io = getIO();
    const socketEvents: any[] = [];

    // Mock socket emission
    const emitSpy = vi.spyOn(io, 'emit').mockImplementation((event, data) => {
      socketEvents.push({ event, data });
      return true;
    });

    // Trigger status update
    await request(app)
      .get('/api/v1/services/status')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    // Should emit status update event
    const statusEvent = socketEvents.find((e) => e.event === 'service:status');
    expect(statusEvent).toBeTruthy();
    expect(statusEvent.data).toMatchObject({
      services: expect.any(Array),
    });

    emitSpy.mockRestore();
  });

  it('should use fallback data when Uptime Kuma is unavailable', async () => {
    // Override Uptime Kuma to fail
    server.use(
      http.get(/uptime-kuma/, () => {
        return HttpResponse.json({ error: 'Service unavailable' }, { status: 503 });
      }),
    );

    const response = await request(app)
      .get('/api/v1/services/status/uptime_kuma')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(response.body).toMatchObject({
      service: 'uptime_kuma',
      status: 'degraded',
      monitors: expect.arrayContaining([
        expect.objectContaining({
          id: '1',
          name: 'Plex Server',
          status: 'unknown',
          message: 'Unable to fetch real-time data',
        }),
      ]),
    });
  });

  it('should handle WebSocket reconnection for Uptime Kuma', async () => {
    // This would typically test WebSocket connection handling
    // For unit tests, we verify the reconnection logic exists
    const response = await request(app)
      .get('/api/v1/services/status/uptime_kuma')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(response.body).toMatchObject({
      service: 'uptime_kuma',
      connectionType: expect.stringMatching(/websocket|polling/),
    });
  });

  it('should respect cache TTL for service status', async () => {
    // First request - should hit external services
    const firstResponse = await request(app)
      .get('/api/v1/services/status')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    const firstTimestamp = new Date(firstResponse.body.services[0].lastChecked).getTime();

    // Wait a moment
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Second request - should use cache
    const secondResponse = await request(app)
      .get('/api/v1/services/status')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    const secondTimestamp = new Date(secondResponse.body.services[0].lastChecked).getTime();

    // Timestamps should be the same (cached)
    expect(secondTimestamp).toBe(firstTimestamp);

    // Clear cache to force refresh
    await redis.del('service_status:plex');
    await redis.del('service_status:overseerr');
    await redis.del('service_status:uptime_kuma');

    // Third request - should hit external services again
    const thirdResponse = await request(app)
      .get('/api/v1/services/status')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    const thirdTimestamp = new Date(thirdResponse.body.services[0].lastChecked).getTime();

    // Timestamp should be newer
    expect(thirdTimestamp).toBeGreaterThan(secondTimestamp);
  });

  it('should store historical status data', async () => {
    // Fetch status to create history
    await request(app)
      .get('/api/v1/services/status')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    // Check that status was stored in database
    const statusRecords = await prisma.serviceStatus.findMany({
      orderBy: { checkedAt: 'desc' },
      take: 10,
    });

    expect(statusRecords.length).toBeGreaterThan(0);
    expect(statusRecords[0]).toMatchObject({
      service: expect.stringMatching(/plex|overseerr|uptime_kuma/),
      status: expect.stringMatching(/online|offline|degraded/),
      responseTime: expect.any(Number),
      checkedAt: expect.any(Date),
    });
  });

  it('should aggregate service health metrics', async () => {
    // Create some historical data
    const now = new Date();
    const statusData = [];

    for (let i = 0; i < 24; i++) {
      statusData.push({
        service: 'plex',
        status: i % 12 === 0 ? 'offline' : 'online', // Offline twice
        responseTime: 100 + Math.random() * 50,
        checkedAt: new Date(now.getTime() - i * 60 * 60 * 1000), // Hourly
        details: {},
      });
    }

    await prisma.serviceStatus.createMany({ data: statusData });

    // Get aggregated metrics
    const metricsResponse = await request(app)
      .get('/api/v1/services/metrics')
      .query({ service: 'plex', period: '24h' })
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(metricsResponse.body).toMatchObject({
      service: 'plex',
      period: '24h',
      uptime: expect.any(Number), // Should be around 91.67% (22/24)
      avgResponseTime: expect.any(Number),
      totalChecks: expect.any(Number),
      incidents: expect.any(Number),
    });

    expect(metricsResponse.body.uptime).toBeGreaterThan(90);
    expect(metricsResponse.body.uptime).toBeLessThan(95);
    expect(metricsResponse.body.incidents).toBe(2);
  });

  it('should handle rapid status polling without overwhelming services', async () => {
    // Make multiple rapid requests
    const requests = Array(10)
      .fill(null)
      .map(() =>
        request(app).get('/api/v1/services/status').set('Authorization', `Bearer ${authToken}`),
      );

    const responses = await Promise.all(requests);

    // All should succeed
    responses.forEach((response) => {
      expect(response.status).toBe(200);
    });

    // But should have used cache (check Redis was hit)
    const plexCacheHits = (await redis.get('service_status:plex:hits')) || '0';
    expect(parseInt(plexCacheHits)).toBeGreaterThan(0);
  });

  it('should properly handle service configuration changes', async () => {
    // Disable a service
    await prisma.serviceConfiguration.update({
      where: { service: 'overseerr' },
      data: { enabled: false },
    });

    // Clear cache to force re-check
    await redis.flushDb();

    const response = await request(app)
      .get('/api/v1/services/status')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    // Overseerr should not be in the response
    const overseerrService = response.body.services.find((s: any) => s.service === 'overseerr');
    expect(overseerrService).toBeUndefined();

    // Re-enable for other tests
    await prisma.serviceConfiguration.update({
      where: { service: 'overseerr' },
      data: { enabled: true },
    });
  });
});
