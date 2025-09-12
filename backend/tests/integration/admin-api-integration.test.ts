/**
 * ADMIN API INTEGRATION TESTS
 *
 * Comprehensive integration tests for admin endpoints
 * Covers user management, role-based access control, system statistics
 */

import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { describe, test, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';

import { createServer } from '../../src/server';
import { AuthTestHelper } from '../helpers/auth-test-helper';
import { DatabaseTestHelper } from '../helpers/database-test-helper';

const prisma = new PrismaClient();
let app: any;
let server: any;
let dbHelper: DatabaseTestHelper;
let authHelper: AuthTestHelper;

describe('Admin API Integration Tests', () => {
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
  });

  describe('Authorization Middleware', () => {
    test('should require authentication for all admin routes', async () => {
      const adminEndpoints = [
        '/api/v1/admin/users',
        '/api/v1/admin/services',
        '/api/v1/admin/requests',
        '/api/v1/admin/stats',
      ];

      for (const endpoint of adminEndpoints) {
        await request(app).get(endpoint).expect(401);
      }
    });

    test('should require admin role for all admin routes', async () => {
      const { accessToken } = await authHelper.createUserWithTokens('user@test.com', 'USER');

      const adminEndpoints = [
        '/api/v1/admin/users',
        '/api/v1/admin/services',
        '/api/v1/admin/requests',
        '/api/v1/admin/stats',
      ];

      for (const endpoint of adminEndpoints) {
        const response = await request(app)
          .get(endpoint)
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(403);

        expect(response.body.error).toContain('Insufficient permissions');
      }
    });

    test('should allow access with admin role', async () => {
      const { accessToken } = await authHelper.createUserWithTokens('admin@test.com', 'ADMIN');

      await request(app)
        .get('/api/v1/admin/users')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
    });
  });

  describe('GET /api/v1/admin/users', () => {
    test('should get users list with pagination', async () => {
      const { accessToken } = await authHelper.createUserWithTokens('admin@test.com', 'ADMIN');

      // Create test users
      await Promise.all(
        Array(15)
          .fill(null)
          .map((_, index) => authHelper.createTestUser(`user${index}@test.com`, 'USER')),
      );

      const response = await request(app)
        .get('/api/v1/admin/users')
        .query({ page: 1, limit: 10 })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('users');
      expect(response.body.data).toHaveProperty('pagination');
      expect(Array.isArray(response.body.data.users)).toBe(true);
      expect(response.body.data.users.length).toBeLessThanOrEqual(10);
      expect(response.body.data.pagination).toHaveProperty('currentPage', 1);
      expect(response.body.data.pagination).toHaveProperty('totalPages');
      expect(response.body.data.pagination).toHaveProperty('totalItems');

      // Verify user data structure
      const user = response.body.data.users[0];
      expect(user).toHaveProperty('id');
      expect(user).toHaveProperty('email');
      expect(user).toHaveProperty('role');
      expect(user).toHaveProperty('status');
      expect(user).toHaveProperty('createdAt');
      expect(user).not.toHaveProperty('passwordHash'); // Sensitive data excluded
    });

    test('should filter users by role', async () => {
      const { accessToken } = await authHelper.createUserWithTokens('admin@test.com', 'ADMIN');

      await Promise.all([
        authHelper.createTestUser('user1@test.com', 'USER'),
        authHelper.createTestUser('user2@test.com', 'USER'),
        authHelper.createTestUser('admin2@test.com', 'ADMIN'),
      ]);

      const response = await request(app)
        .get('/api/v1/admin/users')
        .query({ role: 'ADMIN' })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.data.users.every((user: any) => user.role === 'ADMIN')).toBe(true);
    });

    test('should filter users by status', async () => {
      const { accessToken } = await authHelper.createUserWithTokens('admin@test.com', 'ADMIN');

      const user = await authHelper.createTestUser('user@test.com', 'USER');
      await prisma.user.update({
        where: { id: user.id },
        data: { status: 'SUSPENDED' },
      });

      const response = await request(app)
        .get('/api/v1/admin/users')
        .query({ status: 'SUSPENDED' })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.data.users).toHaveLength(1);
      expect(response.body.data.users[0].status).toBe('SUSPENDED');
    });

    test('should search users by email', async () => {
      const { accessToken } = await authHelper.createUserWithTokens('admin@test.com', 'ADMIN');

      await authHelper.createTestUser('john.doe@test.com', 'USER');
      await authHelper.createTestUser('jane.smith@test.com', 'USER');

      const response = await request(app)
        .get('/api/v1/admin/users')
        .query({ search: 'john' })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.data.users).toHaveLength(1);
      expect(response.body.data.users[0].email).toContain('john');
    });

    test('should sort users by different fields', async () => {
      const { accessToken } = await authHelper.createUserWithTokens('admin@test.com', 'ADMIN');

      const now = new Date();
      await prisma.user.createMany({
        data: [
          {
            email: 'a@test.com',
            plexId: 'plex-a',
            plexUsername: 'usera',
            role: 'USER',
            createdAt: new Date(now.getTime() - 86400000), // 1 day ago
          },
          {
            email: 'z@test.com',
            plexId: 'plex-z',
            plexUsername: 'userz',
            role: 'USER',
            createdAt: now,
          },
        ],
      });

      // Sort by email ascending
      const emailAscResponse = await request(app)
        .get('/api/v1/admin/users')
        .query({ sortBy: 'email', sortOrder: 'asc' })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const emails = emailAscResponse.body.data.users.map((u: any) => u.email);
      expect(emails).toEqual([...emails].sort());

      // Sort by createdAt descending
      const dateDescResponse = await request(app)
        .get('/api/v1/admin/users')
        .query({ sortBy: 'createdAt', sortOrder: 'desc' })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const dates = dateDescResponse.body.data.users.map((u: any) => new Date(u.createdAt));
      expect(dates[0].getTime()).toBeGreaterThanOrEqual(dates[1]?.getTime() || 0);
    });

    test('should validate query parameters', async () => {
      const { accessToken } = await authHelper.createUserWithTokens('admin@test.com', 'ADMIN');

      // Invalid page
      await request(app)
        .get('/api/v1/admin/users')
        .query({ page: 'invalid' })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);

      // Invalid limit
      await request(app)
        .get('/api/v1/admin/users')
        .query({ limit: 101 }) // Exceeds max limit
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);

      // Invalid role
      await request(app)
        .get('/api/v1/admin/users')
        .query({ role: 'INVALID_ROLE' })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);
    });
  });

  describe('PATCH /api/v1/admin/users/:userId/role', () => {
    test('should update user role successfully', async () => {
      const { accessToken } = await authHelper.createUserWithTokens('admin@test.com', 'ADMIN');
      const targetUser = await authHelper.createTestUser('user@test.com', 'USER');

      const response = await request(app)
        .patch(`/api/v1/admin/users/${targetUser.id}/role`)
        .send({ role: 'ADMIN' })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.role).toBe('ADMIN');

      // Verify in database
      const updatedUser = await prisma.user.findUnique({
        where: { id: targetUser.id },
      });
      expect(updatedUser?.role).toBe('ADMIN');
    });

    test('should validate role parameter', async () => {
      const { accessToken } = await authHelper.createUserWithTokens('admin@test.com', 'ADMIN');
      const targetUser = await authHelper.createTestUser('user@test.com', 'USER');

      await request(app)
        .patch(`/api/v1/admin/users/${targetUser.id}/role`)
        .send({ role: 'INVALID_ROLE' })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);
    });

    test('should prevent self-demotion', async () => {
      const { user, accessToken } = await authHelper.createUserWithTokens(
        'admin@test.com',
        'ADMIN',
      );

      const response = await request(app)
        .patch(`/api/v1/admin/users/${user.id}/role`)
        .send({ role: 'USER' })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);

      expect(response.body.error).toContain('cannot change your own role');
    });

    test('should handle non-existent user', async () => {
      const { accessToken } = await authHelper.createUserWithTokens('admin@test.com', 'ADMIN');

      await request(app)
        .patch('/api/v1/admin/users/non-existent-id/role')
        .send({ role: 'ADMIN' })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });

    test('should log role changes for audit trail', async () => {
      const { accessToken } = await authHelper.createUserWithTokens('admin@test.com', 'ADMIN');
      const targetUser = await authHelper.createTestUser('user@test.com', 'USER');

      await request(app)
        .patch(`/api/v1/admin/users/${targetUser.id}/role`)
        .send({ role: 'ADMIN' })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // Verify audit log entry was created
      const auditLog = await prisma.auditLog.findFirst({
        where: {
          action: 'USER_ROLE_UPDATED',
          targetUserId: targetUser.id,
        },
      });

      expect(auditLog).toBeDefined();
      expect(auditLog?.metadata).toHaveProperty('previousRole', 'USER');
      expect(auditLog?.metadata).toHaveProperty('newRole', 'ADMIN');
    });
  });

  describe('DELETE /api/v1/admin/users/:userId', () => {
    test('should delete user successfully', async () => {
      const { accessToken } = await authHelper.createUserWithTokens('admin@test.com', 'ADMIN');
      const targetUser = await authHelper.createTestUser('user@test.com', 'USER');

      const response = await request(app)
        .delete(`/api/v1/admin/users/${targetUser.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('deleted successfully');

      // Verify user is deleted
      const deletedUser = await prisma.user.findUnique({
        where: { id: targetUser.id },
      });
      expect(deletedUser).toBeNull();
    });

    test('should prevent self-deletion', async () => {
      const { user, accessToken } = await authHelper.createUserWithTokens(
        'admin@test.com',
        'ADMIN',
      );

      const response = await request(app)
        .delete(`/api/v1/admin/users/${user.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);

      expect(response.body.error).toContain('cannot delete yourself');
    });

    test('should handle deletion with cascade constraints', async () => {
      const { accessToken } = await authHelper.createUserWithTokens('admin@test.com', 'ADMIN');
      const targetUser = await authHelper.createTestUser('user@test.com', 'USER');

      // Create related data
      await prisma.mediaRequest.create({
        data: {
          title: 'Test Movie',
          year: 2020,
          type: 'movie',
          tmdbId: 1001,
          userId: targetUser.id,
        },
      });

      const response = await request(app)
        .delete(`/api/v1/admin/users/${targetUser.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // Verify related data is also deleted
      const mediaRequests = await prisma.mediaRequest.findMany({
        where: { userId: targetUser.id },
      });
      expect(mediaRequests).toHaveLength(0);
    });

    test('should handle non-existent user', async () => {
      const { accessToken } = await authHelper.createUserWithTokens('admin@test.com', 'ADMIN');

      await request(app)
        .delete('/api/v1/admin/users/non-existent-id')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });
  });

  describe('GET /api/v1/admin/services', () => {
    test('should get services status', async () => {
      const { accessToken } = await authHelper.createUserWithTokens('admin@test.com', 'ADMIN');

      const response = await request(app)
        .get('/api/v1/admin/services')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('services');
      expect(Array.isArray(response.body.data.services)).toBe(true);

      // Verify service structure
      const service = response.body.data.services[0];
      expect(service).toHaveProperty('name');
      expect(service).toHaveProperty('status');
      expect(service).toHaveProperty('responseTime');
      expect(service).toHaveProperty('lastCheck');
      expect(['online', 'offline', 'degraded']).toContain(service.status);
    });

    test('should include service health metrics', async () => {
      const { accessToken } = await authHelper.createUserWithTokens('admin@test.com', 'ADMIN');

      const response = await request(app)
        .get('/api/v1/admin/services')
        .query({ includeMetrics: true })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const service = response.body.data.services.find((s: any) => s.name === 'Database');
      expect(service).toHaveProperty('metrics');
      expect(service.metrics).toHaveProperty('uptime');
      expect(service.metrics).toHaveProperty('errorRate');
    });

    test('should handle service check failures gracefully', async () => {
      const { accessToken } = await authHelper.createUserWithTokens('admin@test.com', 'ADMIN');

      // Mock service check failure
      vi.doMock('../../src/services/health.service', () => ({
        healthService: {
          checkServices: vi.fn().mockRejectedValue(new Error('Health check failed')),
        },
      }));

      const response = await request(app)
        .get('/api/v1/admin/services')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(503);

      expect(response.body.error).toContain('service unavailable');
    });
  });

  describe('GET /api/v1/admin/requests', () => {
    test('should get all media requests with admin view', async () => {
      const { accessToken } = await authHelper.createUserWithTokens('admin@test.com', 'ADMIN');
      const user1 = await authHelper.createTestUser('user1@test.com', 'USER');
      const user2 = await authHelper.createTestUser('user2@test.com', 'USER');

      // Create test requests
      await prisma.mediaRequest.createMany({
        data: [
          {
            title: 'User 1 Movie',
            year: 2020,
            type: 'movie',
            tmdbId: 1001,
            userId: user1.id,
            status: 'pending',
          },
          {
            title: 'User 2 Movie',
            year: 2020,
            type: 'movie',
            tmdbId: 1002,
            userId: user2.id,
            status: 'approved',
          },
        ],
      });

      const response = await request(app)
        .get('/api/v1/admin/requests')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.requests).toHaveLength(2);

      // Verify admin can see all requests with user info
      const request1 = response.body.data.requests.find((r: any) => r.title === 'User 1 Movie');
      expect(request1).toHaveProperty('user');
      expect(request1.user).toHaveProperty('email', 'user1@test.com');
    });

    test('should filter requests by status for admin', async () => {
      const { accessToken } = await authHelper.createUserWithTokens('admin@test.com', 'ADMIN');
      const user = await authHelper.createTestUser('user@test.com', 'USER');

      await prisma.mediaRequest.createMany({
        data: [
          {
            title: 'Pending Movie',
            year: 2020,
            type: 'movie',
            tmdbId: 1001,
            userId: user.id,
            status: 'pending',
          },
          {
            title: 'Approved Movie',
            year: 2020,
            type: 'movie',
            tmdbId: 1002,
            userId: user.id,
            status: 'approved',
          },
        ],
      });

      const response = await request(app)
        .get('/api/v1/admin/requests')
        .query({ status: 'pending' })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.data.requests).toHaveLength(1);
      expect(response.body.data.requests[0].status).toBe('pending');
    });

    test('should include request statistics', async () => {
      const { accessToken } = await authHelper.createUserWithTokens('admin@test.com', 'ADMIN');

      const response = await request(app)
        .get('/api/v1/admin/requests')
        .query({ includeStats: true })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.data).toHaveProperty('statistics');
      expect(response.body.data.statistics).toHaveProperty('totalRequests');
      expect(response.body.data.statistics).toHaveProperty('pendingRequests');
      expect(response.body.data.statistics).toHaveProperty('approvedRequests');
      expect(response.body.data.statistics).toHaveProperty('rejectedRequests');
    });
  });

  describe('GET /api/v1/admin/stats', () => {
    test('should get comprehensive system statistics', async () => {
      const { accessToken } = await authHelper.createUserWithTokens('admin@test.com', 'ADMIN');

      // Create test data
      await authHelper.createTestUser('user1@test.com', 'USER');
      await authHelper.createTestUser('user2@test.com', 'USER');
      const user = await authHelper.createTestUser('user3@test.com', 'USER');

      await prisma.mediaRequest.createMany({
        data: [
          {
            title: 'Movie 1',
            year: 2020,
            type: 'movie',
            tmdbId: 1001,
            userId: user.id,
            status: 'pending',
          },
          {
            title: 'Movie 2',
            year: 2020,
            type: 'movie',
            tmdbId: 1002,
            userId: user.id,
            status: 'approved',
          },
        ],
      });

      const response = await request(app)
        .get('/api/v1/admin/stats')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('users');
      expect(response.body.data).toHaveProperty('requests');
      expect(response.body.data).toHaveProperty('system');

      // User statistics
      expect(response.body.data.users).toHaveProperty('total');
      expect(response.body.data.users).toHaveProperty('active');
      expect(response.body.data.users).toHaveProperty('admins');
      expect(response.body.data.users).toHaveProperty('newThisWeek');

      // Request statistics
      expect(response.body.data.requests).toHaveProperty('total');
      expect(response.body.data.requests).toHaveProperty('pending');
      expect(response.body.data.requests).toHaveProperty('approved');
      expect(response.body.data.requests).toHaveProperty('rejected');

      // System statistics
      expect(response.body.data.system).toHaveProperty('uptime');
      expect(response.body.data.system).toHaveProperty('memoryUsage');
      expect(response.body.data.system).toHaveProperty('diskSpace');
    });

    test('should get time-ranged statistics', async () => {
      const { accessToken } = await authHelper.createUserWithTokens('admin@test.com', 'ADMIN');

      const response = await request(app)
        .get('/api/v1/admin/stats')
        .query({ timeRange: '7d' })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.data).toHaveProperty('timeRange', '7d');
      expect(response.body.data).toHaveProperty('chartData');
      expect(Array.isArray(response.body.data.chartData.userRegistrations)).toBe(true);
      expect(Array.isArray(response.body.data.chartData.requestsOverTime)).toBe(true);
    });

    test('should handle statistics calculation errors', async () => {
      const { accessToken } = await authHelper.createUserWithTokens('admin@test.com', 'ADMIN');

      // Mock database error
      vi.doMock('@prisma/client', () => ({
        PrismaClient: vi.fn().mockImplementation(() => ({
          user: {
            count: vi.fn().mockRejectedValue(new Error('Database error')),
          },
        })),
      }));

      const response = await request(app)
        .get('/api/v1/admin/stats')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(500);

      expect(response.body.error).toContain('statistics unavailable');
    });
  });

  describe('Admin Security Tests', () => {
    test('should prevent privilege escalation attacks', async () => {
      const { user, accessToken } = await authHelper.createUserWithTokens('user@test.com', 'USER');

      // Attempt to modify request headers to bypass authorization
      await request(app)
        .get('/api/v1/admin/users')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('X-User-Role', 'ADMIN') // Attempt header injection
        .expect(403);
    });

    test('should log all admin actions for audit', async () => {
      const { accessToken } = await authHelper.createUserWithTokens('admin@test.com', 'ADMIN');
      const targetUser = await authHelper.createTestUser('user@test.com', 'USER');

      // Perform admin action
      await request(app)
        .patch(`/api/v1/admin/users/${targetUser.id}/role`)
        .send({ role: 'ADMIN' })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // Verify audit log
      const auditLog = await prisma.auditLog.findFirst({
        where: { action: 'USER_ROLE_UPDATED' },
        orderBy: { createdAt: 'desc' },
      });

      expect(auditLog).toBeDefined();
      expect(auditLog?.adminId).toBeDefined();
      expect(auditLog?.targetUserId).toBe(targetUser.id);
    });

    test('should rate limit admin endpoints', async () => {
      const { accessToken } = await authHelper.createUserWithTokens('admin@test.com', 'ADMIN');

      // Make rapid requests to admin endpoint
      const requests = Array(20)
        .fill(null)
        .map(() =>
          request(app).get('/api/v1/admin/users').set('Authorization', `Bearer ${accessToken}`),
        );

      const responses = await Promise.all(
        requests.map((req) => req.then((res) => res.status).catch(() => 429)),
      );

      const rateLimitedCount = responses.filter((status) => status === 429).length;
      expect(rateLimitedCount).toBeGreaterThan(0);
    });

    test('should sanitize sensitive data in responses', async () => {
      const { accessToken } = await authHelper.createUserWithTokens('admin@test.com', 'ADMIN');

      const response = await request(app)
        .get('/api/v1/admin/users')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // Verify sensitive fields are excluded
      const user = response.body.data.users[0];
      expect(user).not.toHaveProperty('passwordHash');
      expect(user).not.toHaveProperty('plexToken');
      expect(user).not.toHaveProperty('refreshToken');
    });
  });

  describe('Database Transaction and Concurrency Tests', () => {
    test('should handle concurrent role updates safely', async () => {
      const { accessToken } = await authHelper.createUserWithTokens('admin@test.com', 'ADMIN');
      const targetUser = await authHelper.createTestUser('user@test.com', 'USER');

      // Create concurrent role update requests
      const roleUpdateRequests = [
        request(app)
          .patch(`/api/v1/admin/users/${targetUser.id}/role`)
          .send({ role: 'ADMIN' })
          .set('Authorization', `Bearer ${accessToken}`),
        request(app)
          .patch(`/api/v1/admin/users/${targetUser.id}/role`)
          .send({ role: 'USER' })
          .set('Authorization', `Bearer ${accessToken}`),
      ];

      const responses = await Promise.allSettled(roleUpdateRequests);

      // One should succeed, one should fail due to race condition handling
      const successful = responses.filter(
        (result): result is PromiseFulfilledResult<any> =>
          result.status === 'fulfilled' && result.value.status === 200,
      );

      expect(successful.length).toBeGreaterThanOrEqual(1);

      // Final state should be consistent
      const finalUser = await prisma.user.findUnique({
        where: { id: targetUser.id },
      });
      expect(['USER', 'ADMIN']).toContain(finalUser?.role);
    });

    test('should maintain referential integrity during user deletion', async () => {
      const { accessToken } = await authHelper.createUserWithTokens('admin@test.com', 'ADMIN');
      const targetUser = await authHelper.createTestUser('user@test.com', 'USER');

      // Create related data
      const mediaRequest = await prisma.mediaRequest.create({
        data: {
          title: 'Test Movie',
          year: 2020,
          type: 'movie',
          tmdbId: 1001,
          userId: targetUser.id,
        },
      });

      // Delete user should handle related data properly
      await request(app)
        .delete(`/api/v1/admin/users/${targetUser.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // Verify referential integrity
      const orphanedRequest = await prisma.mediaRequest.findUnique({
        where: { id: mediaRequest.id },
      });
      expect(orphanedRequest).toBeNull();
    });
  });
});
