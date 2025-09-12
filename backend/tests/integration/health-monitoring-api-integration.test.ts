/**
 * HEALTH AND MONITORING API INTEGRATION TESTS
 *
 * Comprehensive integration tests for health, monitoring, and service status endpoints
 * Covers health checks, metrics, CSRF, services status, and error handling
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
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

describe('Health and Monitoring API Integration Tests', () => {
  beforeAll(async () => {
    dbHelper = new DatabaseTestHelper();
    authHelper = new AuthTestHelper();

    await dbHelper.setupTestDatabase();
    app = await createServer();
    server = app.listen(0);
  });

  afterAll(async () => {
    await server?.close();
    await dbHelper.cleanupTestDatabase();
    await authHelper.disconnect();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await dbHelper.seedTestData();
    vi.clearAllMocks();
  });

  describe('GET /api/v1/health', () => {
    test('should return basic health status without authentication', async () => {
      const response = await request(app).get('/api/v1/health').expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('status', 'healthy');
      expect(response.body.data).toHaveProperty('timestamp');
      expect(response.body.data).toHaveProperty('uptime');
      expect(response.body.data).toHaveProperty('version');
      expect(response.body.data).toHaveProperty('environment');

      // Verify timestamp is recent
      const responseTime = new Date(response.body.data.timestamp);
      const now = new Date();
      const timeDiff = Math.abs(now.getTime() - responseTime.getTime());
      expect(timeDiff).toBeLessThan(5000); // Within 5 seconds
    });

    test('should include system information', async () => {
      const response = await request(app).get('/api/v1/health').expect(200);

      expect(response.body.data).toHaveProperty('system');
      expect(response.body.data.system).toHaveProperty('nodeVersion');
      expect(response.body.data.system).toHaveProperty('platform');
      expect(response.body.data.system).toHaveProperty('arch');
      expect(response.body.data.system).toHaveProperty('memory');
      expect(response.body.data.system.memory).toHaveProperty('used');
      expect(response.body.data.system.memory).toHaveProperty('total');
      expect(response.body.data.system.memory).toHaveProperty('free');
    });

    test('should check database connectivity', async () => {
      const response = await request(app).get('/api/v1/health').expect(200);

      expect(response.body.data).toHaveProperty('database');
      expect(response.body.data.database).toHaveProperty('status', 'connected');
      expect(response.body.data.database).toHaveProperty('responseTime');
      expect(response.body.data.database.responseTime).toBeGreaterThan(0);
    });

    test('should check Redis connectivity', async () => {
      const response = await request(app).get('/api/v1/health').expect(200);

      expect(response.body.data).toHaveProperty('cache');
      expect(response.body.data.cache).toHaveProperty('status');
      expect(['connected', 'disconnected']).toContain(response.body.data.cache.status);
      if (response.body.data.cache.status === 'connected') {
        expect(response.body.data.cache).toHaveProperty('responseTime');
      }
    });

    test('should handle database connection failure gracefully', async () => {
      // Mock database connection failure
      vi.doMock('@prisma/client', () => ({
        PrismaClient: vi.fn().mockImplementation(() => ({
          $queryRaw: vi.fn().mockRejectedValue(new Error('Connection refused')),
        })),
      }));

      const response = await request(app).get('/api/v1/health').expect(503);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.data.status).toBe('unhealthy');
      expect(response.body.data.database.status).toBe('disconnected');
      expect(response.body.data.database).toHaveProperty('error');
    });

    test('should include proper cache headers for health endpoint', async () => {
      const response = await request(app).get('/api/v1/health').expect(200);

      // Health endpoint should not be cached
      expect(response.headers['cache-control']).toContain('no-cache');
      expect(response.headers['pragma']).toBe('no-cache');
    });

    test('should handle high load gracefully', async () => {
      const startTime = Date.now();

      // Make 20 concurrent health check requests
      const requests = Array(20)
        .fill(null)
        .map(() => request(app).get('/api/v1/health'));

      const responses = await Promise.all(requests);
      const duration = Date.now() - startTime;

      // All requests should succeed
      responses.forEach((response) => {
        expect(response.status).toBe(200);
        expect(response.body.data.status).toBe('healthy');
      });

      // Should complete quickly
      expect(duration).toBeLessThan(2000); // 2 seconds
    });
  });

  describe('GET /api/v1/health/metrics', () => {
    test('should require admin authentication', async () => {
      // No authentication
      await request(app).get('/api/v1/health/metrics').expect(401);

      // User role (not admin)
      const { accessToken: userToken } = await authHelper.createUserWithTokens(
        'user@test.com',
        'USER',
      );
      await request(app)
        .get('/api/v1/health/metrics')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });

    test('should return detailed metrics for admin users', async () => {
      const { accessToken } = await authHelper.createUserWithTokens('admin@test.com', 'ADMIN');

      const response = await request(app)
        .get('/api/v1/health/metrics')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('metrics');

      // System metrics
      expect(response.body.data.metrics).toHaveProperty('system');
      expect(response.body.data.metrics.system).toHaveProperty('cpuUsage');
      expect(response.body.data.metrics.system).toHaveProperty('memoryUsage');
      expect(response.body.data.metrics.system).toHaveProperty('diskSpace');
      expect(response.body.data.metrics.system).toHaveProperty('loadAverage');

      // Application metrics
      expect(response.body.data.metrics).toHaveProperty('application');
      expect(response.body.data.metrics.application).toHaveProperty('requestCount');
      expect(response.body.data.metrics.application).toHaveProperty('responseTime');
      expect(response.body.data.metrics.application).toHaveProperty('errorRate');
      expect(response.body.data.metrics.application).toHaveProperty('activeConnections');

      // Database metrics
      expect(response.body.data.metrics).toHaveProperty('database');
      expect(response.body.data.metrics.database).toHaveProperty('connectionCount');
      expect(response.body.data.metrics.database).toHaveProperty('queryResponseTime');
      expect(response.body.data.metrics.database).toHaveProperty('slowQueries');
    });

    test('should include time-series data', async () => {
      const { accessToken } = await authHelper.createUserWithTokens('admin@test.com', 'ADMIN');

      const response = await request(app)
        .get('/api/v1/health/metrics')
        .query({ includeTimeSeries: true, timeRange: '1h' })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.data).toHaveProperty('timeSeries');
      expect(Array.isArray(response.body.data.timeSeries.cpuUsage)).toBe(true);
      expect(Array.isArray(response.body.data.timeSeries.memoryUsage)).toBe(true);
      expect(Array.isArray(response.body.data.timeSeries.requestRate)).toBe(true);
    });

    test('should handle metrics collection errors', async () => {
      const { accessToken } = await authHelper.createUserWithTokens('admin@test.com', 'ADMIN');

      // Mock metrics collection failure
      vi.doMock('../../src/services/metrics.service', () => ({
        metricsService: {
          collectMetrics: vi.fn().mockRejectedValue(new Error('Metrics collection failed')),
        },
      }));

      const response = await request(app)
        .get('/api/v1/health/metrics')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(500);

      expect(response.body.error).toContain('metrics unavailable');
    });
  });

  describe('GET /api/v1/simple-health', () => {
    test('should return minimal health status for Docker health checks', async () => {
      const response = await request(app).get('/api/v1/simple-health').expect(200);

      expect(response.text).toBe('OK');
      expect(response.headers['content-type']).toContain('text/plain');
    });

    test('should return 503 when unhealthy', async () => {
      // Mock unhealthy state
      vi.doMock('../../src/services/health.service', () => ({
        healthService: {
          isHealthy: vi.fn().mockReturnValue(false),
        },
      }));

      const response = await request(app).get('/api/v1/simple-health').expect(503);

      expect(response.text).toBe('UNHEALTHY');
    });

    test('should be extremely fast for container health checks', async () => {
      const startTime = Date.now();

      await request(app).get('/api/v1/simple-health').expect(200);

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(100); // Less than 100ms
    });
  });

  describe('GET /api/v1/services/status', () => {
    test('should return service status without authentication', async () => {
      const response = await request(app).get('/api/v1/services/status').expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('services');
      expect(response.body.data).toHaveProperty('timestamp');
      expect(response.body.data).toHaveProperty('summary');

      expect(Array.isArray(response.body.data.services)).toBe(true);
      expect(response.body.data.services.length).toBeGreaterThan(0);

      // Verify service structure
      const service = response.body.data.services[0];
      expect(service).toHaveProperty('name');
      expect(service).toHaveProperty('status');
      expect(service).toHaveProperty('responseTime');
      expect(service).toHaveProperty('lastCheck');
      expect(['online', 'offline', 'degraded']).toContain(service.status);

      // Verify summary
      expect(response.body.data.summary).toHaveProperty('total');
      expect(response.body.data.summary).toHaveProperty('online');
      expect(response.body.data.summary).toHaveProperty('offline');
      expect(response.body.data.summary).toHaveProperty('degraded');
    });

    test('should include expected services', async () => {
      const response = await request(app).get('/api/v1/services/status').expect(200);

      const serviceNames = response.body.data.services.map((s: any) => s.name);
      expect(serviceNames).toContain('Database');
      expect(serviceNames).toContain('Redis Cache');
      expect(serviceNames).toContain('Plex API');
      expect(serviceNames).toContain('YouTube API');
    });

    test('should handle service check failures gracefully', async () => {
      // Mock service failure
      vi.doMock('../../src/services/plex.service', () => ({
        plexService: {
          checkHealth: vi.fn().mockRejectedValue(new Error('Plex unreachable')),
        },
      }));

      const response = await request(app).get('/api/v1/services/status').expect(200);

      const plexService = response.body.data.services.find((s: any) => s.name === 'Plex API');
      expect(plexService.status).toBe('offline');
      expect(plexService).toHaveProperty('error');
    });

    test('should cache service status appropriately', async () => {
      const response = await request(app).get('/api/v1/services/status').expect(200);

      // Should have cache headers for reasonable caching
      expect(response.headers['cache-control']).toBeDefined();
      expect(response.headers['cache-control']).toContain('max-age');
    });
  });

  describe('CSRF Token Management', () => {
    test('GET /api/v1/csrf/token should generate CSRF token', async () => {
      const response = await request(app).get('/api/v1/csrf/token').expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('token');
      expect(response.body.data).toHaveProperty('expiresIn');
      expect(response.body.data.token).toMatch(/^[a-zA-Z0-9_-]{32,}$/);
      expect(response.body.data.expiresIn).toBe(3600); // 1 hour
    });

    test('GET /api/v1/csrf/token should work for authenticated users', async () => {
      const { accessToken } = await authHelper.createUserWithTokens();

      const response = await request(app)
        .get('/api/v1/csrf/token')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('token');
    });

    test('POST /api/v1/csrf/refresh should refresh CSRF token', async () => {
      // First get a token
      const tokenResponse = await request(app).get('/api/v1/csrf/token').expect(200);

      const originalToken = tokenResponse.body.data.token;

      // Refresh the token
      const refreshResponse = await request(app).post('/api/v1/csrf/refresh').expect(200);

      expect(refreshResponse.body.success).toBe(true);
      expect(refreshResponse.body.data).toHaveProperty('token');
      expect(refreshResponse.body.data.token).not.toBe(originalToken);
    });

    test('GET /api/v1/csrf/stats should require admin access', async () => {
      // No authentication
      await request(app).get('/api/v1/csrf/stats').expect(401);

      // User role
      const { accessToken: userToken } = await authHelper.createUserWithTokens(
        'user@test.com',
        'USER',
      );
      await request(app)
        .get('/api/v1/csrf/stats')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });

    test('GET /api/v1/csrf/stats should return statistics for admin', async () => {
      const { accessToken } = await authHelper.createUserWithTokens('admin@test.com', 'ADMIN');

      // Generate some tokens first
      await request(app).get('/api/v1/csrf/token');
      await request(app).get('/api/v1/csrf/token');

      const response = await request(app)
        .get('/api/v1/csrf/stats')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('totalTokens');
      expect(response.body.data).toHaveProperty('averageAgeSeconds');
      expect(response.body.data).toHaveProperty('protection');
      expect(response.body.data).toHaveProperty('tokenTtlSeconds');
      expect(response.body.data.tokenTtlSeconds).toBe(3600);
    });
  });

  describe('Error Handling and Resilience', () => {
    test('should handle multiple service failures gracefully', async () => {
      // Mock multiple service failures
      vi.doMock('../../src/services/plex.service', () => ({
        plexService: {
          checkHealth: vi.fn().mockRejectedValue(new Error('Plex down')),
        },
      }));

      vi.doMock('../../src/services/youtube.service', () => ({
        youtubeService: {
          checkHealth: vi.fn().mockRejectedValue(new Error('YouTube down')),
        },
      }));

      const response = await request(app).get('/api/v1/services/status').expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.summary.offline).toBeGreaterThanOrEqual(2);

      const offlineServices = response.body.data.services.filter(
        (s: any) => s.status === 'offline',
      );
      expect(offlineServices.length).toBeGreaterThanOrEqual(2);
    });

    test('should handle timeout scenarios', async () => {
      // Mock service timeout
      vi.doMock('../../src/services/health.service', () => ({
        healthService: {
          checkDatabaseHealth: vi
            .fn()
            .mockImplementation(
              () =>
                new Promise((_, reject) => setTimeout(() => reject(new Error('ETIMEDOUT')), 100)),
            ),
        },
      }));

      const response = await request(app).get('/api/v1/health').expect(503);

      expect(response.body.data.database.status).toBe('disconnected');
      expect(response.body.data.database.error).toContain('timeout');
    });

    test('should return consistent response format during errors', async () => {
      // Mock complete system failure
      vi.doMock('../../src/services/health.service', () => ({
        healthService: {
          getHealthStatus: vi.fn().mockRejectedValue(new Error('System failure')),
        },
      }));

      const response = await request(app).get('/api/v1/health').expect(500);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  describe('Performance and Load Tests', () => {
    test('should handle concurrent health checks efficiently', async () => {
      const startTime = Date.now();

      // 50 concurrent health check requests
      const requests = Array(50)
        .fill(null)
        .map(() => request(app).get('/api/v1/health'));

      const responses = await Promise.all(requests);
      const duration = Date.now() - startTime;

      // All should complete successfully
      responses.forEach((response) => {
        expect(response.status).toBe(200);
        expect(response.body.data.status).toBe('healthy');
      });

      // Should handle load efficiently
      expect(duration).toBeLessThan(3000); // 3 seconds max
    });

    test('should maintain performance under metrics collection load', async () => {
      const { accessToken } = await authHelper.createUserWithTokens('admin@test.com', 'ADMIN');

      const startTime = Date.now();

      // 10 concurrent metrics requests
      const requests = Array(10)
        .fill(null)
        .map(() =>
          request(app).get('/api/v1/health/metrics').set('Authorization', `Bearer ${accessToken}`),
        );

      const responses = await Promise.all(requests);
      const duration = Date.now() - startTime;

      // All should succeed
      responses.forEach((response) => {
        expect(response.status).toBe(200);
        expect(response.body.data.metrics).toBeDefined();
      });

      // Should complete within reasonable time
      expect(duration).toBeLessThan(5000); // 5 seconds max
    });
  });

  describe('Security and Headers', () => {
    test('should include security headers on health endpoints', async () => {
      const response = await request(app).get('/api/v1/health').expect(200);

      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-xss-protection']).toBe('1; mode=block');
    });

    test('should prevent information disclosure in error responses', async () => {
      // Mock internal server error
      vi.doMock('../../src/controllers/health.controller', () => ({
        healthController: {
          getHealth: vi.fn().mockImplementation(() => {
            throw new Error('Detailed internal error with sensitive info');
          }),
        },
      }));

      const response = await request(app).get('/api/v1/health').expect(500);

      // Should not expose internal error details
      expect(response.body.error).not.toContain('sensitive info');
      expect(response.body.error).not.toContain('Detailed internal error');
    });

    test('should validate query parameters properly', async () => {
      const { accessToken } = await authHelper.createUserWithTokens('admin@test.com', 'ADMIN');

      // Invalid time range
      await request(app)
        .get('/api/v1/health/metrics')
        .query({ timeRange: 'invalid_range' })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);

      // SQL injection attempt
      await request(app)
        .get('/api/v1/health/metrics')
        .query({ timeRange: "1h'; DROP TABLE users; --" })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);
    });
  });

  describe('Content Type and Response Format', () => {
    test('should return JSON with correct Content-Type', async () => {
      const response = await request(app).get('/api/v1/health').expect(200);

      expect(response.headers['content-type']).toContain('application/json');
      expect(response.body).toBeDefined();
      expect(typeof response.body).toBe('object');
    });

    test('should handle Accept header preferences', async () => {
      const response = await request(app)
        .get('/api/v1/health')
        .set('Accept', 'application/json')
        .expect(200);

      expect(response.headers['content-type']).toContain('application/json');
    });

    test('should handle unsupported Accept headers', async () => {
      const response = await request(app)
        .get('/api/v1/health')
        .set('Accept', 'application/xml')
        .expect(200); // Should still respond with JSON

      expect(response.headers['content-type']).toContain('application/json');
    });
  });
});
