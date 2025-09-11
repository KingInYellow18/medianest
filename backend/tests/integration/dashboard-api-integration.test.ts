/**
 * DASHBOARD API INTEGRATION TESTS
 *
 * Comprehensive integration tests for dashboard endpoints
 * Covers statistics, service statuses, notifications, and performance optimization
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

describe('Dashboard API Integration Tests', () => {
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

  describe('Authentication Requirements', () => {
    test('should require authentication for all dashboard routes', async () => {
      const dashboardEndpoints = [
        '/api/v1/dashboard/stats',
        '/api/v1/dashboard/status',
        '/api/v1/dashboard/status/database',
        '/api/v1/dashboard/notifications',
      ];

      for (const endpoint of dashboardEndpoints) {
        await request(app).get(endpoint).expect(401);
      }
    });

    test('should allow access with valid authentication', async () => {
      const { accessToken } = await authHelper.createUserWithTokens();

      vi.doMock('../../src/controllers/dashboard.controller', () => ({
        dashboardController: {
          getDashboardStats: vi.fn().mockImplementation((req, res) => {
            res.status(200).json({
              success: true,
              data: { stats: {} },
            });
          }),
        },
      }));

      await request(app)
        .get('/api/v1/dashboard/stats')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
    });
  });

  describe('GET /api/v1/dashboard/stats', () => {
    test('should return comprehensive dashboard statistics', async () => {
      const { user, accessToken } = await authHelper.createUserWithTokens();

      // Create test data for statistics
      await Promise.all([
        // Media requests
        prisma.mediaRequest.create({
          data: {
            title: 'Test Movie 1',
            year: 2020,
            type: 'movie',
            tmdbId: 1001,
            userId: user.id,
            status: 'pending',
          },
        }),
        prisma.mediaRequest.create({
          data: {
            title: 'Test Movie 2',
            year: 2021,
            type: 'movie',
            tmdbId: 1002,
            userId: user.id,
            status: 'approved',
          },
        }),
        // Additional users for stats
        authHelper.createTestUser('user2@test.com', 'USER'),
        authHelper.createTestUser('user3@test.com', 'USER'),
      ]);

      const response = await request(app)
        .get('/api/v1/dashboard/stats')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('stats');

      const stats = response.body.data.stats;

      // User statistics
      expect(stats).toHaveProperty('users');
      expect(stats.users).toHaveProperty('total');
      expect(stats.users).toHaveProperty('active');
      expect(stats.users).toHaveProperty('newThisWeek');
      expect(stats.users.total).toBeGreaterThanOrEqual(3);

      // Media request statistics
      expect(stats).toHaveProperty('requests');
      expect(stats.requests).toHaveProperty('total');
      expect(stats.requests).toHaveProperty('pending');
      expect(stats.requests).toHaveProperty('approved');
      expect(stats.requests).toHaveProperty('rejected');
      expect(stats.requests.total).toBe(2);
      expect(stats.requests.pending).toBe(1);
      expect(stats.requests.approved).toBe(1);

      // System statistics
      expect(stats).toHaveProperty('system');
      expect(stats.system).toHaveProperty('uptime');
      expect(stats.system).toHaveProperty('version');
      expect(stats.system).toHaveProperty('environment');
      expect(stats.system.uptime).toBeGreaterThan(0);
    });

    test('should include user-specific statistics', async () => {
      const { user, accessToken } = await authHelper.createUserWithTokens();

      // Create user-specific data
      await prisma.mediaRequest.createMany({
        data: [
          {
            title: 'User Movie 1',
            year: 2020,
            type: 'movie',
            tmdbId: 2001,
            userId: user.id,
            status: 'pending',
          },
          {
            title: 'User Movie 2',
            year: 2021,
            type: 'movie',
            tmdbId: 2002,
            userId: user.id,
            status: 'approved',
          },
        ],
      });

      const response = await request(app)
        .get('/api/v1/dashboard/stats')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const stats = response.body.data.stats;

      expect(stats).toHaveProperty('userStats');
      expect(stats.userStats).toHaveProperty('totalRequests', 2);
      expect(stats.userStats).toHaveProperty('pendingRequests', 1);
      expect(stats.userStats).toHaveProperty('approvedRequests', 1);
      expect(stats.userStats).toHaveProperty('memberSince');
    });

    test('should include recent activity', async () => {
      const { user, accessToken } = await authHelper.createUserWithTokens();

      // Create recent activity
      const recentRequest = await prisma.mediaRequest.create({
        data: {
          title: 'Recent Movie',
          year: 2023,
          type: 'movie',
          tmdbId: 3001,
          userId: user.id,
          status: 'pending',
          requestedAt: new Date(),
        },
      });

      const response = await request(app)
        .get('/api/v1/dashboard/stats')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const stats = response.body.data.stats;

      expect(stats).toHaveProperty('recentActivity');
      expect(Array.isArray(stats.recentActivity)).toBe(true);
      expect(stats.recentActivity.length).toBeGreaterThan(0);

      const activity = stats.recentActivity[0];
      expect(activity).toHaveProperty('type');
      expect(activity).toHaveProperty('title');
      expect(activity).toHaveProperty('timestamp');
      expect(activity).toHaveProperty('status');
    });

    test('should have proper cache headers for performance', async () => {
      const { accessToken } = await authHelper.createUserWithTokens();

      const response = await request(app)
        .get('/api/v1/dashboard/stats')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // Verify cache headers (5-minute cache as per route config)
      expect(response.headers['cache-control']).toContain('max-age=300');
      expect(response.headers['cache-control']).toContain('private');
    });

    test('should handle database errors gracefully', async () => {
      const { accessToken } = await authHelper.createUserWithTokens();

      // Mock database error
      vi.doMock('@prisma/client', () => ({
        PrismaClient: vi.fn().mockImplementation(() => ({
          user: {
            count: vi.fn().mockRejectedValue(new Error('Database error')),
          },
        })),
      }));

      const response = await request(app)
        .get('/api/v1/dashboard/stats')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(500);

      expect(response.body.error).toContain('statistics unavailable');
    });
  });

  describe('GET /api/v1/dashboard/status', () => {
    test('should return service statuses', async () => {
      const { accessToken } = await authHelper.createUserWithTokens();

      const response = await request(app)
        .get('/api/v1/dashboard/status')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('services');
      expect(response.body.data).toHaveProperty('overall');
      expect(response.body.data).toHaveProperty('lastUpdated');

      expect(Array.isArray(response.body.data.services)).toBe(true);
      expect(response.body.data.services.length).toBeGreaterThan(0);

      // Verify service structure
      const service = response.body.data.services[0];
      expect(service).toHaveProperty('name');
      expect(service).toHaveProperty('status');
      expect(service).toHaveProperty('responseTime');
      expect(service).toHaveProperty('lastCheck');
      expect(['online', 'offline', 'degraded']).toContain(service.status);

      // Verify overall status
      expect(['healthy', 'degraded', 'unhealthy']).toContain(response.body.data.overall.status);
      expect(response.body.data.overall).toHaveProperty('uptime');
    });

    test('should include expected services in status check', async () => {
      const { accessToken } = await authHelper.createUserWithTokens();

      const response = await request(app)
        .get('/api/v1/dashboard/status')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const serviceNames = response.body.data.services.map((s: any) => s.name);

      expect(serviceNames).toContain('Database');
      expect(serviceNames).toContain('Redis Cache');
      expect(serviceNames).toContain('Plex API');
      expect(serviceNames).toContain('YouTube API');
    });

    test('should handle partial service failures', async () => {
      const { accessToken } = await authHelper.createUserWithTokens();

      // Mock one service failure
      vi.doMock('../../src/services/plex.service', () => ({
        plexService: {
          checkHealth: vi.fn().mockRejectedValue(new Error('Plex unreachable')),
        },
      }));

      const response = await request(app)
        .get('/api/v1/dashboard/status')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const plexService = response.body.data.services.find((s: any) => s.name === 'Plex API');
      expect(plexService).toBeDefined();
      expect(plexService.status).toBe('offline');

      // Overall status should still be returned
      expect(response.body.data.overall.status).toMatch(/degraded|unhealthy/);
    });

    test('should have appropriate cache headers', async () => {
      const { accessToken } = await authHelper.createUserWithTokens();

      const response = await request(app)
        .get('/api/v1/dashboard/status')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // 1-minute cache as per route config
      expect(response.headers['cache-control']).toContain('max-age=60');
      expect(response.headers['cache-control']).toContain('private');
    });
  });

  describe('GET /api/v1/dashboard/status/:service', () => {
    test('should return specific service status', async () => {
      const { accessToken } = await authHelper.createUserWithTokens();

      const response = await request(app)
        .get('/api/v1/dashboard/status/database')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('service');
      expect(response.body.data.service).toHaveProperty('name', 'database');
      expect(response.body.data.service).toHaveProperty('status');
      expect(response.body.data.service).toHaveProperty('responseTime');
      expect(response.body.data.service).toHaveProperty('details');
      expect(['online', 'offline', 'degraded']).toContain(response.body.data.service.status);
    });

    test('should include detailed metrics for specific services', async () => {
      const { accessToken } = await authHelper.createUserWithTokens();

      const response = await request(app)
        .get('/api/v1/dashboard/status/database')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const service = response.body.data.service;
      expect(service.details).toHaveProperty('connectionCount');
      expect(service.details).toHaveProperty('queryStats');
      expect(service.details.queryStats).toHaveProperty('averageResponseTime');
      expect(service.details.queryStats).toHaveProperty('slowQueries');
    });

    test('should handle invalid service names', async () => {
      const { accessToken } = await authHelper.createUserWithTokens();

      const response = await request(app)
        .get('/api/v1/dashboard/status/nonexistent_service')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);

      expect(response.body.error).toContain('Service not found');
    });

    test('should handle service check timeouts', async () => {
      const { accessToken } = await authHelper.createUserWithTokens();

      // Mock service timeout
      vi.doMock('../../src/services/health.service', () => ({
        healthService: {
          checkServiceHealth: vi
            .fn()
            .mockImplementation(
              () =>
                new Promise((_, reject) => setTimeout(() => reject(new Error('ETIMEDOUT')), 100))
            ),
        },
      }));

      const response = await request(app)
        .get('/api/v1/dashboard/status/plex')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.data.service.status).toBe('offline');
      expect(response.body.data.service.details.error).toContain('timeout');
    });
  });

  describe('GET /api/v1/dashboard/notifications', () => {
    test('should return user notifications', async () => {
      const { user, accessToken } = await authHelper.createUserWithTokens();

      // Create test notifications
      await prisma.notification.createMany({
        data: [
          {
            title: 'Request Approved',
            message: 'Your request for Inception has been approved',
            type: 'info',
            userId: user.id,
            read: false,
          },
          {
            title: 'System Update',
            message: 'MediaNest has been updated to version 1.2.0',
            type: 'success',
            userId: user.id,
            read: true,
          },
          {
            title: 'Warning',
            message: 'Plex server is experiencing issues',
            type: 'warning',
            userId: user.id,
            read: false,
          },
        ],
      });

      const response = await request(app)
        .get('/api/v1/dashboard/notifications')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('notifications');
      expect(response.body.data).toHaveProperty('unreadCount');

      expect(Array.isArray(response.body.data.notifications)).toBe(true);
      expect(response.body.data.notifications.length).toBe(3);
      expect(response.body.data.unreadCount).toBe(2);

      // Verify notification structure
      const notification = response.body.data.notifications[0];
      expect(notification).toHaveProperty('id');
      expect(notification).toHaveProperty('title');
      expect(notification).toHaveProperty('message');
      expect(notification).toHaveProperty('type');
      expect(notification).toHaveProperty('read');
      expect(notification).toHaveProperty('createdAt');
      expect(['info', 'success', 'warning', 'error']).toContain(notification.type);
    });

    test('should filter notifications by read status', async () => {
      const { user, accessToken } = await authHelper.createUserWithTokens();

      await prisma.notification.createMany({
        data: [
          {
            title: 'Read Notification',
            message: 'This has been read',
            type: 'info',
            userId: user.id,
            read: true,
          },
          {
            title: 'Unread Notification',
            message: 'This is unread',
            type: 'info',
            userId: user.id,
            read: false,
          },
        ],
      });

      // Test unread notifications
      const unreadResponse = await request(app)
        .get('/api/v1/dashboard/notifications')
        .query({ unreadOnly: true })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(unreadResponse.body.data.notifications).toHaveLength(1);
      expect(unreadResponse.body.data.notifications[0].read).toBe(false);

      // Test read notifications
      const readResponse = await request(app)
        .get('/api/v1/dashboard/notifications')
        .query({ readOnly: true })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(readResponse.body.data.notifications).toHaveLength(1);
      expect(readResponse.body.data.notifications[0].read).toBe(true);
    });

    test('should support pagination for notifications', async () => {
      const { user, accessToken } = await authHelper.createUserWithTokens();

      // Create many notifications
      const notifications = Array(25)
        .fill(null)
        .map((_, index) => ({
          title: `Notification ${index + 1}`,
          message: `Message ${index + 1}`,
          type: 'info',
          userId: user.id,
          read: index % 2 === 0,
        }));

      await prisma.notification.createMany({ data: notifications });

      const response = await request(app)
        .get('/api/v1/dashboard/notifications')
        .query({ page: 1, limit: 10 })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.data.notifications.length).toBeLessThanOrEqual(10);
      expect(response.body.data).toHaveProperty('pagination');
      expect(response.body.data.pagination).toHaveProperty('currentPage', 1);
      expect(response.body.data.pagination).toHaveProperty('totalPages');
      expect(response.body.data.pagination).toHaveProperty('totalItems', 25);
    });

    test('should order notifications by date descending', async () => {
      const { user, accessToken } = await authHelper.createUserWithTokens();

      const now = new Date();
      await prisma.notification.createMany({
        data: [
          {
            title: 'Old Notification',
            message: 'Old message',
            type: 'info',
            userId: user.id,
            createdAt: new Date(now.getTime() - 86400000), // 1 day ago
          },
          {
            title: 'New Notification',
            message: 'New message',
            type: 'info',
            userId: user.id,
            createdAt: now,
          },
        ],
      });

      const response = await request(app)
        .get('/api/v1/dashboard/notifications')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.data.notifications[0].title).toBe('New Notification');
      expect(response.body.data.notifications[1].title).toBe('Old Notification');
    });

    test('should only show user own notifications', async () => {
      const { user: user1, accessToken: token1 } = await authHelper.createUserWithTokens();
      const { user: user2 } = await authHelper.createUserWithTokens();

      await Promise.all([
        prisma.notification.create({
          data: {
            title: 'User 1 Notification',
            message: 'For user 1',
            type: 'info',
            userId: user1.id,
          },
        }),
        prisma.notification.create({
          data: {
            title: 'User 2 Notification',
            message: 'For user 2',
            type: 'info',
            userId: user2.id,
          },
        }),
      ]);

      const response = await request(app)
        .get('/api/v1/dashboard/notifications')
        .set('Authorization', `Bearer ${token1}`)
        .expect(200);

      expect(response.body.data.notifications).toHaveLength(1);
      expect(response.body.data.notifications[0].title).toBe('User 1 Notification');
    });

    test('should have no cache for real-time notifications', async () => {
      const { accessToken } = await authHelper.createUserWithTokens();

      const response = await request(app)
        .get('/api/v1/dashboard/notifications')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // No cache for notifications as per route config
      expect(response.headers['cache-control']).toContain('max-age=0');
    });
  });

  describe('Performance and Optimization Tests', () => {
    test('should handle concurrent dashboard requests efficiently', async () => {
      const { accessToken } = await authHelper.createUserWithTokens();

      const startTime = Date.now();

      // 15 concurrent dashboard stats requests
      const requests = Array(15)
        .fill(null)
        .map(() =>
          request(app).get('/api/v1/dashboard/stats').set('Authorization', `Bearer ${accessToken}`)
        );

      const responses = await Promise.all(requests);
      const duration = Date.now() - startTime;

      // All should succeed
      responses.forEach((response) => {
        expect(response.status).toBe(200);
        expect(response.body.data.stats).toBeDefined();
      });

      // Should complete efficiently due to caching
      expect(duration).toBeLessThan(3000); // 3 seconds max
    });

    test('should leverage caching for repeated requests', async () => {
      const { accessToken } = await authHelper.createUserWithTokens();

      // First request
      const startTime1 = Date.now();
      await request(app)
        .get('/api/v1/dashboard/stats')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      const duration1 = Date.now() - startTime1;

      // Second request (should be cached)
      const startTime2 = Date.now();
      const response2 = await request(app)
        .get('/api/v1/dashboard/stats')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      const duration2 = Date.now() - startTime2;

      // Second request should be faster (cached)
      expect(duration2).toBeLessThan(duration1);
      expect(response2.headers['x-cache']).toBe('HIT'); // If cache hit header is implemented
    });

    test('should maintain performance with large datasets', async () => {
      const { user, accessToken } = await authHelper.createUserWithTokens();

      // Create large dataset
      const mediaRequests = Array(1000)
        .fill(null)
        .map((_, index) => ({
          title: `Movie ${index}`,
          year: 2000 + (index % 23),
          type: 'movie',
          tmdbId: 10000 + index,
          userId: user.id,
          status: index % 3 === 0 ? 'approved' : 'pending',
        }));

      await prisma.mediaRequest.createMany({ data: mediaRequests });

      const startTime = Date.now();

      const response = await request(app)
        .get('/api/v1/dashboard/stats')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const duration = Date.now() - startTime;

      expect(response.body.data.stats).toBeDefined();
      expect(duration).toBeLessThan(2000); // 2 seconds max with optimized queries
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle empty dataset gracefully', async () => {
      const { accessToken } = await authHelper.createUserWithTokens();

      const response = await request(app)
        .get('/api/v1/dashboard/stats')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const stats = response.body.data.stats;
      expect(stats.requests.total).toBe(0);
      expect(stats.requests.pending).toBe(0);
      expect(stats.requests.approved).toBe(0);
      expect(stats.recentActivity).toEqual([]);
    });

    test('should handle service timeouts gracefully', async () => {
      const { accessToken } = await authHelper.createUserWithTokens();

      // Mock service timeout
      vi.doMock('../../src/services/dashboard.service', () => ({
        dashboardService: {
          getServiceStatuses: vi
            .fn()
            .mockImplementation(
              () =>
                new Promise((_, reject) => setTimeout(() => reject(new Error('ETIMEDOUT')), 100))
            ),
        },
      }));

      const response = await request(app)
        .get('/api/v1/dashboard/status')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // Should return degraded status when some services timeout
      expect(['degraded', 'unhealthy']).toContain(response.body.data.overall.status);
    });

    test('should handle invalid query parameters', async () => {
      const { accessToken } = await authHelper.createUserWithTokens();

      const invalidParams = [
        { page: 'invalid' },
        { limit: 'not_a_number' },
        { limit: -1 },
        { page: 0 },
      ];

      for (const params of invalidParams) {
        const response = await request(app)
          .get('/api/v1/dashboard/notifications')
          .query(params)
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(400);

        expect(response.body.error).toContain('Invalid');
      }
    });

    test('should provide consistent response format during errors', async () => {
      const { accessToken } = await authHelper.createUserWithTokens();

      // Mock complete failure
      vi.doMock('../../src/controllers/dashboard.controller', () => ({
        dashboardController: {
          getDashboardStats: vi.fn().mockImplementation(() => {
            throw new Error('Service failure');
          }),
        },
      }));

      const response = await request(app)
        .get('/api/v1/dashboard/stats')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(500);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  describe('Security and Data Privacy', () => {
    test('should not expose sensitive system information', async () => {
      const { accessToken } = await authHelper.createUserWithTokens();

      const response = await request(app)
        .get('/api/v1/dashboard/stats')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const stats = response.body.data.stats;

      // Should not expose sensitive system details
      expect(stats.system).not.toHaveProperty('databaseUrl');
      expect(stats.system).not.toHaveProperty('secretKeys');
      expect(stats.system).not.toHaveProperty('passwords');
    });

    test('should sanitize notification content', async () => {
      const { user, accessToken } = await authHelper.createUserWithTokens();

      // Create notification with potentially malicious content
      await prisma.notification.create({
        data: {
          title: '<script>alert("xss")</script>Notification',
          message: 'Message with <img src=x onerror=alert("xss")> content',
          type: 'info',
          userId: user.id,
        },
      });

      const response = await request(app)
        .get('/api/v1/dashboard/notifications')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const notification = response.body.data.notifications[0];

      // Should sanitize malicious content
      expect(notification.title).not.toContain('<script>');
      expect(notification.message).not.toContain('<img');
    });

    test('should include appropriate security headers', async () => {
      const { accessToken } = await authHelper.createUserWithTokens();

      const response = await request(app)
        .get('/api/v1/dashboard/stats')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-xss-protection']).toBe('1; mode=block');
    });
  });
});
