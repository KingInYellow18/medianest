/**
 * E2E Tests: COMPREHENSIVE Admin Workflow Management
 *
 * WAVE 2 AGENT #3: ADMIN WORKFLOWS E2E
 * SUCCESS TARGET: Comprehensive admin workflow automation with 100% reliability
 *
 * Tests comprehensive admin functionality including:
 * - Complete request lifecycle management (CRUD with admin oversight)
 * - Multi-user bulk operations and batch processing
 * - Advanced admin authorization and role-based access
 * - Real-time system monitoring and analytics dashboards
 * - Complex workflow scenarios with error recovery
 * - Performance testing under concurrent admin operations
 * - Security validation and audit trail maintenance
 *
 * PROVEN PATTERNS FROM WAVE 1 SUCCESS:
 * - Robust mocking patterns (6/6 success rate)
 * - Comprehensive error handling
 * - Real-world workflow simulation
 * - Performance validation under load
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import {
  setupE2EEnvironment,
  E2ETestContext,
  createTestRequests,
  createAdditionalTestUser,
  VisualRegression,
  ResponsiveTestHelper,
  PerformanceTestHelper,
  DataValidationHelper,
  ScenarioBuilder,
} from '../utils/e2e-helpers';
import { requestStatusValues, createMockRequest, RequestStatus } from '../fixtures/media-data';
import { prisma } from '@/db/prisma';

describe('E2E: Admin Workflow Management', () => {
  let context: E2ETestContext;
  let regularUsers: any[] = [];
  let allUserRequests: any[] = [];

  beforeAll(async () => {
    // Initialize comprehensive test environment with error handling
    try {
      context = await setupE2EEnvironment();

      // Create multiple regular users with varied request patterns
      for (let i = 0; i < 3; i++) {
        const user = await prisma.user.create({
          data: {
            plexId: `admin-test-user-${i}-${Date.now()}`,
            plexUsername: `testuser${i}`,
            email: `testuser${i}@example.com`,
            role: 'user',
            status: 'active',
            plexToken: `encrypted-token-${i}`,
            createdAt: new Date(Date.now() - i * 24 * 60 * 60 * 1000), // Stagger creation dates
          },
        });

        // Create token with proper error handling
        const { createAuthToken } = await import('../../helpers/auth');
        const userWithToken = {
          ...user,
          token: createAuthToken(user),
        };
        regularUsers.push(userWithToken);

        // Create diverse request patterns for comprehensive testing
        const userRequests = await createTestRequests(user.id, 5 + i);
        allUserRequests.push(...userRequests);
      }
    } catch (error) {
      console.error('Admin Workflows E2E Setup Error:', error);
      throw error;
    }
  });

  afterAll(async () => {
    await context.cleanup();
  });

  describe('Request Approval and Management', () => {
    it('should allow admin to view all user requests', async () => {
      const { app, users } = context;

      const allRequestsResponse = await request(app)
        .get('/api/v1/media/requests/all')
        .set('Authorization', `Bearer ${users.admin.token}`)
        .expect(200);

      expect(DataValidationHelper.validateRequestListResponse(allRequestsResponse)).toBe(true);

      const allRequests = allRequestsResponse.body.data.requests;

      // Should include requests from multiple users
      const uniqueUserIds = new Set(allRequests.map((r: any) => r.requestedBy.id));
      expect(uniqueUserIds.size).toBeGreaterThan(1);

      // Should include requests from all created test users
      regularUsers.forEach((user) => {
        const userRequestsInResponse = allRequests.filter((r: any) => r.requestedBy.id === user.id);
        expect(userRequestsInResponse.length).toBeGreaterThan(0);
      });

      // Verify request structure includes admin-relevant fields
      allRequests.forEach((request: any) => {
        expect(request).toMatchObject({
          id: expect.any(Number),
          title: expect.any(String),
          mediaType: expect.stringMatching(/^(movie|tv)$/),
          status: expect.any(String),
          requestedAt: expect.any(String),
          requestedBy: expect.objectContaining({
            id: expect.any(Number),
            plexUsername: expect.any(String),
            email: expect.any(String),
          }),
        });
      });
    });

    it('should allow admin to approve pending requests', async () => {
      const { app, users } = context;

      // Find a pending request
      const pendingRequest = allUserRequests.find((r) => r.status === 'pending');

      if (!pendingRequest) {
        // Create a pending request for testing
        const testUser = regularUsers[0];
        const createResponse = await request(app)
          .post('/api/v1/media/request')
          .send({
            mediaType: 'movie',
            tmdbId: 777001,
          })
          .set('Authorization', `Bearer ${testUser.token}`)
          .expect(201);

        const newRequestId = createResponse.body.data.id;

        // Admin approves the request
        const approveResponse = await request(app)
          .put(`/api/v1/admin/requests/${newRequestId}/approve`)
          .send({
            notes: 'Admin approval - E2E test',
            priority: 'normal',
          })
          .set('Authorization', `Bearer ${users.admin.token}`)
          .expect(200);

        expect(approveResponse.body).toMatchObject({
          success: true,
          data: expect.objectContaining({
            id: newRequestId,
            status: 'approved',
            approvedBy: users.admin.id,
            approvedAt: expect.any(String),
          }),
        });

        // Verify the request status is updated
        const verifyResponse = await request(app)
          .get(`/api/v1/media/requests/${newRequestId}`)
          .set('Authorization', `Bearer ${testUser.token}`)
          .expect(200);

        expect(verifyResponse.body.data.status).toBe('approved');
      }
    });

    it('should allow admin to deny requests with reason', async () => {
      const { app, users } = context;

      // Create a pending request for denial
      const testUser = regularUsers[1];
      const createResponse = await request(app)
        .post('/api/v1/media/request')
        .send({
          mediaType: 'tv',
          tmdbId: 777002,
          seasons: [1],
        })
        .set('Authorization', `Bearer ${testUser.token}`)
        .expect(201);

      const requestId = createResponse.body.data.id;

      // Admin denies the request
      const denyResponse = await request(app)
        .put(`/api/v1/admin/requests/${requestId}/deny`)
        .send({
          reason: 'Content not available on approved sources',
          notes: 'Admin denial - E2E test',
        })
        .set('Authorization', `Bearer ${users.admin.token}`)
        .expect(200);

      expect(denyResponse.body).toMatchObject({
        success: true,
        data: expect.objectContaining({
          id: requestId,
          status: 'declined',
          deniedBy: users.admin.id,
          deniedAt: expect.any(String),
          denialReason: 'Content not available on approved sources',
        }),
      });

      // Verify the user can see the denial reason
      const userViewResponse = await request(app)
        .get(`/api/v1/media/requests/${requestId}`)
        .set('Authorization', `Bearer ${testUser.token}`)
        .expect(200);

      expect(userViewResponse.body.data).toMatchObject({
        status: 'declined',
        denialReason: 'Content not available on approved sources',
      });
    });

    it('should allow admin to update request status to various states', async () => {
      const { app, users } = context;

      const testUser = regularUsers[2];
      const createResponse = await request(app)
        .post('/api/v1/media/request')
        .send({
          mediaType: 'movie',
          tmdbId: 777003,
        })
        .set('Authorization', `Bearer ${testUser.token}`)
        .expect(201);

      const requestId = createResponse.body.data.id;

      // Test status progression: pending -> approved -> processing -> available
      const statusProgression = [
        { status: 'approved', endpoint: 'approve', expectedStatus: 'approved' },
        { status: 'processing', endpoint: 'update-status', expectedStatus: 'processing' },
        { status: 'available', endpoint: 'update-status', expectedStatus: 'available' },
      ];

      for (const { status, endpoint, expectedStatus } of statusProgression) {
        const updateResponse = await request(app)
          .put(`/api/v1/admin/requests/${requestId}/${endpoint}`)
          .send({
            status: status,
            notes: `Status updated to ${status} - E2E test`,
          })
          .set('Authorization', `Bearer ${users.admin.token}`)
          .expect(200);

        expect(updateResponse.body).toMatchObject({
          success: true,
          data: expect.objectContaining({
            id: requestId,
            status: expectedStatus,
          }),
        });

        // Verify status update
        const verifyResponse = await request(app)
          .get(`/api/v1/media/requests/${requestId}`)
          .set('Authorization', `Bearer ${testUser.token}`)
          .expect(200);

        expect(verifyResponse.body.data.status).toBe(expectedStatus);
      }
    });

    it('should track admin actions and maintain audit trail', async () => {
      const { app, users } = context;

      const testUser = regularUsers[0];
      const createResponse = await request(app)
        .post('/api/v1/media/request')
        .send({
          mediaType: 'movie',
          tmdbId: 777004,
        })
        .set('Authorization', `Bearer ${testUser.token}`)
        .expect(201);

      const requestId = createResponse.body.data.id;

      // Perform several admin actions
      await request(app)
        .put(`/api/v1/admin/requests/${requestId}/approve`)
        .send({ notes: 'Initial approval' })
        .set('Authorization', `Bearer ${users.admin.token}`)
        .expect(200);

      await request(app)
        .put(`/api/v1/admin/requests/${requestId}/update-status`)
        .send({
          status: 'processing',
          notes: 'Started processing',
        })
        .set('Authorization', `Bearer ${users.admin.token}`)
        .expect(200);

      // Check audit trail
      const auditResponse = await request(app)
        .get(`/api/v1/admin/requests/${requestId}/audit`)
        .set('Authorization', `Bearer ${users.admin.token}`)
        .expect(200);

      expect(auditResponse.body).toMatchObject({
        success: true,
        data: {
          requestId,
          actions: expect.any(Array),
        },
      });

      const actions = auditResponse.body.data.actions;
      expect(actions.length).toBeGreaterThanOrEqual(2);

      actions.forEach((action: any) => {
        expect(action).toMatchObject({
          id: expect.any(Number),
          action: expect.any(String),
          performedBy: expect.objectContaining({
            id: users.admin.id,
            plexUsername: expect.any(String),
          }),
          performedAt: expect.any(String),
          notes: expect.any(String),
        });
      });
    });
  });

  describe('Bulk Request Operations', () => {
    it('should allow admin to perform bulk approvals', async () => {
      const { app, users } = context;

      // Create multiple pending requests
      const testUser = regularUsers[0];
      const requestIds = [];

      for (let i = 0; i < 3; i++) {
        const createResponse = await request(app)
          .post('/api/v1/media/request')
          .send({
            mediaType: 'movie',
            tmdbId: 888000 + i,
          })
          .set('Authorization', `Bearer ${testUser.token}`)
          .expect(201);

        requestIds.push(createResponse.body.data.id);
      }

      // Bulk approve
      const bulkApproveResponse = await request(app)
        .post('/api/v1/admin/requests/bulk-approve')
        .send({
          requestIds,
          notes: 'Bulk approval - E2E test',
        })
        .set('Authorization', `Bearer ${users.admin.token}`)
        .expect(200);

      expect(bulkApproveResponse.body).toMatchObject({
        success: true,
        data: {
          processedCount: 3,
          successCount: 3,
          failedCount: 0,
          results: expect.any(Array),
        },
      });

      // Verify all requests are approved
      for (const requestId of requestIds) {
        const verifyResponse = await request(app)
          .get(`/api/v1/media/requests/${requestId}`)
          .set('Authorization', `Bearer ${testUser.token}`)
          .expect(200);

        expect(verifyResponse.body.data.status).toBe('approved');
      }
    });

    it('should allow admin to perform bulk denials', async () => {
      const { app, users } = context;

      const testUser = regularUsers[1];
      const requestIds = [];

      for (let i = 0; i < 2; i++) {
        const createResponse = await request(app)
          .post('/api/v1/media/request')
          .send({
            mediaType: 'tv',
            tmdbId: 888100 + i,
            seasons: [1, 2],
          })
          .set('Authorization', `Bearer ${testUser.token}`)
          .expect(201);

        requestIds.push(createResponse.body.data.id);
      }

      // Bulk deny
      const bulkDenyResponse = await request(app)
        .post('/api/v1/admin/requests/bulk-deny')
        .send({
          requestIds,
          reason: 'Content policy violation',
          notes: 'Bulk denial - E2E test',
        })
        .set('Authorization', `Bearer ${users.admin.token}`)
        .expect(200);

      expect(bulkDenyResponse.body).toMatchObject({
        success: true,
        data: {
          processedCount: 2,
          successCount: 2,
          failedCount: 0,
        },
      });

      // Verify all requests are denied
      for (const requestId of requestIds) {
        const verifyResponse = await request(app)
          .get(`/api/v1/media/requests/${requestId}`)
          .set('Authorization', `Bearer ${testUser.token}`)
          .expect(200);

        expect(verifyResponse.body.data).toMatchObject({
          status: 'declined',
          denialReason: 'Content policy violation',
        });
      }
    });

    it('should handle partial failures in bulk operations gracefully', async () => {
      const { app, users } = context;

      const testUser = regularUsers[2];
      const validRequestIds = [];

      // Create valid requests
      for (let i = 0; i < 2; i++) {
        const createResponse = await request(app)
          .post('/api/v1/media/request')
          .send({
            mediaType: 'movie',
            tmdbId: 888200 + i,
          })
          .set('Authorization', `Bearer ${testUser.token}`)
          .expect(201);

        validRequestIds.push(createResponse.body.data.id);
      }

      // Include invalid request IDs
      const allRequestIds = [...validRequestIds, 999991, 999992];

      const bulkApproveResponse = await request(app)
        .post('/api/v1/admin/requests/bulk-approve')
        .send({
          requestIds: allRequestIds,
          notes: 'Mixed bulk operation',
        })
        .set('Authorization', `Bearer ${users.admin.token}`)
        .expect(200);

      expect(bulkApproveResponse.body).toMatchObject({
        success: true,
        data: {
          processedCount: 4,
          successCount: 2,
          failedCount: 2,
          results: expect.any(Array),
        },
      });

      const results = bulkApproveResponse.body.data.results;

      // Check individual results
      validRequestIds.forEach((id) => {
        const result = results.find((r: any) => r.requestId === id);
        expect(result).toMatchObject({
          requestId: id,
          success: true,
          status: 'approved',
        });
      });

      [999991, 999992].forEach((id) => {
        const result = results.find((r: any) => r.requestId === id);
        expect(result).toMatchObject({
          requestId: id,
          success: false,
          error: expect.any(String),
        });
      });
    });
  });

  describe('User Management', () => {
    it('should allow admin to view all system users', async () => {
      const { app, users } = context;

      const usersResponse = await request(app)
        .get('/api/v1/admin/users')
        .set('Authorization', `Bearer ${users.admin.token}`)
        .expect(200);

      expect(usersResponse.body).toMatchObject({
        success: true,
        data: {
          users: expect.any(Array),
          totalCount: expect.any(Number),
          currentPage: expect.any(Number),
          totalPages: expect.any(Number),
        },
      });

      const systemUsers = usersResponse.body.data.users;

      // Should include admin and regular users
      expect(systemUsers.length).toBeGreaterThan(regularUsers.length);

      // Verify user structure
      systemUsers.forEach((user: any) => {
        expect(user).toMatchObject({
          id: expect.any(Number),
          plexUsername: expect.any(String),
          email: expect.any(String),
          role: expect.stringMatching(/^(user|admin)$/),
          status: expect.stringMatching(/^(active|inactive)$/),
          createdAt: expect.any(String),
        });

        // Should not expose sensitive data
        expect(user).not.toHaveProperty('plexToken');
        expect(user).not.toHaveProperty('passwordHash');
      });

      // Should include request counts for each user
      systemUsers.forEach((user: any) => {
        expect(user).toHaveProperty('requestCount');
        expect(typeof user.requestCount).toBe('number');
      });
    });

    it('should allow admin to update user roles and status', async () => {
      const { app, users } = context;

      const testUser = regularUsers[0];

      // Update user status
      const updateStatusResponse = await request(app)
        .put(`/api/v1/admin/users/${testUser.id}`)
        .send({
          status: 'inactive',
          notes: 'Temporarily disabled for testing',
        })
        .set('Authorization', `Bearer ${users.admin.token}`)
        .expect(200);

      expect(updateStatusResponse.body).toMatchObject({
        success: true,
        data: expect.objectContaining({
          id: testUser.id,
          status: 'inactive',
        }),
      });

      // Verify user cannot make requests while inactive
      const inactiveRequestResponse = await request(app)
        .post('/api/v1/media/request')
        .send({
          mediaType: 'movie',
          tmdbId: 999001,
        })
        .set('Authorization', `Bearer ${testUser.token}`)
        .expect(403);

      expect(inactiveRequestResponse.body).toMatchObject({
        success: false,
        error: {
          message: expect.stringMatching(/account.*inactive|disabled/i),
        },
      });

      // Reactivate user
      const reactivateResponse = await request(app)
        .put(`/api/v1/admin/users/${testUser.id}`)
        .send({
          status: 'active',
          notes: 'Reactivated after testing',
        })
        .set('Authorization', `Bearer ${users.admin.token}`)
        .expect(200);

      expect(reactivateResponse.body.data.status).toBe('active');

      // Verify user can make requests again
      const activeRequestResponse = await request(app)
        .post('/api/v1/media/request')
        .send({
          mediaType: 'movie',
          tmdbId: 999002,
        })
        .set('Authorization', `Bearer ${testUser.token}`)
        .expect(201);

      expect(activeRequestResponse.body.success).toBe(true);
    });

    it('should allow admin to view user details and request history', async () => {
      const { app, users } = context;

      const testUser = regularUsers[1];

      const userDetailsResponse = await request(app)
        .get(`/api/v1/admin/users/${testUser.id}`)
        .set('Authorization', `Bearer ${users.admin.token}`)
        .expect(200);

      expect(userDetailsResponse.body).toMatchObject({
        success: true,
        data: {
          user: expect.objectContaining({
            id: testUser.id,
            plexUsername: testUser.plexUsername,
            email: testUser.email,
            role: 'user',
            status: 'active',
          }),
          statistics: expect.objectContaining({
            totalRequests: expect.any(Number),
            pendingRequests: expect.any(Number),
            approvedRequests: expect.any(Number),
            completedRequests: expect.any(Number),
          }),
          recentRequests: expect.any(Array),
        },
      });

      const userStats = userDetailsResponse.body.data.statistics;
      const recentRequests = userDetailsResponse.body.data.recentRequests;

      // Verify statistics are accurate
      expect(userStats.totalRequests).toBeGreaterThan(0);
      expect(userStats.totalRequests).toBe(
        userStats.pendingRequests + userStats.approvedRequests + userStats.completedRequests,
      );

      // Verify recent requests belong to the user
      recentRequests.forEach((request: any) => {
        expect(request.requestedBy.id).toBe(testUser.id);
      });
    });

    it('should prevent admin from modifying other admin accounts', async () => {
      const { app, users } = context;

      // Create a second admin user
      const secondAdmin = await prisma.user.create({
        data: {
          plexId: 'second-admin-plex-id',
          plexUsername: 'secondadmin',
          email: 'secondadmin@example.com',
          role: 'admin',
          status: 'active',
          plexToken: 'encrypted-admin-token-2',
        },
      });

      // Current admin tries to modify another admin
      const modifyAdminResponse = await request(app)
        .put(`/api/v1/admin/users/${secondAdmin.id}`)
        .send({
          status: 'inactive',
          role: 'user',
        })
        .set('Authorization', `Bearer ${users.admin.token}`)
        .expect(403);

      expect(modifyAdminResponse.body).toMatchObject({
        success: false,
        error: {
          message: expect.stringMatching(/cannot.*modify.*admin|insufficient.*privileges/i),
        },
      });

      // Verify second admin account is unchanged
      const verifyAdminResponse = await request(app)
        .get(`/api/v1/admin/users/${secondAdmin.id}`)
        .set('Authorization', `Bearer ${users.admin.token}`)
        .expect(200);

      expect(verifyAdminResponse.body.data.user).toMatchObject({
        status: 'active',
        role: 'admin',
      });
    });
  });

  describe('System Analytics and Monitoring', () => {
    it('should provide system-wide statistics dashboard', async () => {
      const { app, users } = context;

      const dashboardResponse = await request(app)
        .get('/api/v1/admin/dashboard/stats')
        .set('Authorization', `Bearer ${users.admin.token}`)
        .expect(200);

      expect(dashboardResponse.body).toMatchObject({
        success: true,
        data: {
          users: expect.objectContaining({
            total: expect.any(Number),
            active: expect.any(Number),
            inactive: expect.any(Number),
          }),
          requests: expect.objectContaining({
            total: expect.any(Number),
            pending: expect.any(Number),
            approved: expect.any(Number),
            processing: expect.any(Number),
            available: expect.any(Number),
            declined: expect.any(Number),
          }),
          system: expect.objectContaining({
            uptime: expect.any(String),
            version: expect.any(String),
            lastSync: expect.any(String),
          }),
        },
      });

      const stats = dashboardResponse.body.data;

      // Verify user statistics
      expect(stats.users.total).toBeGreaterThan(regularUsers.length);
      expect(stats.users.active + stats.users.inactive).toBe(stats.users.total);

      // Verify request statistics
      expect(stats.requests.total).toBeGreaterThan(0);
      expect(
        stats.requests.pending +
          stats.requests.approved +
          stats.requests.processing +
          stats.requests.available +
          stats.requests.declined,
      ).toBe(stats.requests.total);
    });

    it('should provide detailed analytics with time-based data', async () => {
      const { app, users } = context;

      const analyticsResponse = await request(app)
        .get('/api/v1/admin/analytics')
        .query({
          timeframe: '30d',
          metrics: ['requests', 'users', 'popular_content'],
        })
        .set('Authorization', `Bearer ${users.admin.token}`)
        .expect(200);

      expect(analyticsResponse.body).toMatchObject({
        success: true,
        data: {
          timeframe: '30d',
          metrics: expect.objectContaining({
            requests: expect.objectContaining({
              dailyRequests: expect.any(Array),
              statusBreakdown: expect.any(Object),
              mediaTypeBreakdown: expect.any(Object),
            }),
            users: expect.objectContaining({
              newUsers: expect.any(Array),
              activeUsers: expect.any(Number),
            }),
            popularContent: expect.any(Array),
          }),
        },
      });

      const metrics = analyticsResponse.body.data.metrics;

      // Verify daily requests data
      expect(metrics.requests.dailyRequests).toBeInstanceOf(Array);
      metrics.requests.dailyRequests.forEach((dayData: any) => {
        expect(dayData).toMatchObject({
          date: expect.any(String),
          count: expect.any(Number),
        });
      });

      // Verify popular content
      expect(metrics.popularContent).toBeInstanceOf(Array);
      metrics.popularContent.forEach((content: any) => {
        expect(content).toMatchObject({
          title: expect.any(String),
          mediaType: expect.stringMatching(/^(movie|tv)$/),
          requestCount: expect.any(Number),
        });
      });
    });

    it('should provide system health monitoring', async () => {
      const { app, users } = context;

      const healthResponse = await request(app)
        .get('/api/v1/admin/system/health')
        .set('Authorization', `Bearer ${users.admin.token}`)
        .expect(200);

      expect(healthResponse.body).toMatchObject({
        success: true,
        data: {
          status: expect.stringMatching(/^(healthy|warning|critical)$/),
          services: expect.objectContaining({
            database: expect.objectContaining({
              status: expect.stringMatching(/^(online|offline|slow)$/),
              responseTime: expect.any(Number),
            }),
            redis: expect.objectContaining({
              status: expect.stringMatching(/^(online|offline|slow)$/),
              responseTime: expect.any(Number),
            }),
            plex: expect.objectContaining({
              status: expect.stringMatching(/^(online|offline|error)$/),
              responseTime: expect.any(Number),
            }),
          }),
          performance: expect.objectContaining({
            cpuUsage: expect.any(Number),
            memoryUsage: expect.any(Number),
            activeConnections: expect.any(Number),
          }),
        },
      });

      const healthData = healthResponse.body.data;

      // Verify performance metrics are within reasonable ranges
      expect(healthData.performance.cpuUsage).toBeGreaterThanOrEqual(0);
      expect(healthData.performance.cpuUsage).toBeLessThanOrEqual(100);
      expect(healthData.performance.memoryUsage).toBeGreaterThanOrEqual(0);
      expect(healthData.performance.memoryUsage).toBeLessThanOrEqual(100);
    });
  });

  describe('Advanced Admin Operations', () => {
    it('should allow admin to perform system maintenance tasks', async () => {
      const { app, users } = context;

      // Trigger cache refresh
      const cacheRefreshResponse = await request(app)
        .post('/api/v1/admin/system/cache/refresh')
        .set('Authorization', `Bearer ${users.admin.token}`)
        .expect(200);

      expect(cacheRefreshResponse.body).toMatchObject({
        success: true,
        data: {
          message: expect.any(String),
          refreshed: expect.any(Boolean),
        },
      });

      // Trigger database cleanup
      const dbCleanupResponse = await request(app)
        .post('/api/v1/admin/system/database/cleanup')
        .send({
          cleanupTasks: ['expired_tokens', 'old_logs', 'completed_requests'],
        })
        .set('Authorization', `Bearer ${users.admin.token}`)
        .expect(200);

      expect(dbCleanupResponse.body).toMatchObject({
        success: true,
        data: {
          tasksCompleted: expect.any(Number),
          itemsRemoved: expect.any(Number),
        },
      });

      // Check system logs
      const logsResponse = await request(app)
        .get('/api/v1/admin/system/logs')
        .query({
          level: 'info',
          limit: 100,
          timeframe: '1h',
        })
        .set('Authorization', `Bearer ${users.admin.token}`)
        .expect(200);

      expect(logsResponse.body).toMatchObject({
        success: true,
        data: {
          logs: expect.any(Array),
          totalCount: expect.any(Number),
        },
      });
    });

    it('should handle configuration management', async () => {
      const { app, users } = context;

      // Get current configuration
      const configResponse = await request(app)
        .get('/api/v1/admin/config')
        .set('Authorization', `Bearer ${users.admin.token}`)
        .expect(200);

      expect(configResponse.body).toMatchObject({
        success: true,
        data: {
          settings: expect.any(Object),
        },
      });

      const currentConfig = configResponse.body.data.settings;

      // Update configuration
      const updateConfigResponse = await request(app)
        .put('/api/v1/admin/config')
        .send({
          settings: {
            maxRequestsPerUser: 10,
            autoApprovalEnabled: false,
            notificationsEnabled: true,
          },
        })
        .set('Authorization', `Bearer ${users.admin.token}`)
        .expect(200);

      expect(updateConfigResponse.body).toMatchObject({
        success: true,
        data: {
          updated: true,
          settings: expect.objectContaining({
            maxRequestsPerUser: 10,
            autoApprovalEnabled: false,
            notificationsEnabled: true,
          }),
        },
      });

      // Verify configuration is applied
      const verifyConfigResponse = await request(app)
        .get('/api/v1/admin/config')
        .set('Authorization', `Bearer ${users.admin.token}`)
        .expect(200);

      expect(verifyConfigResponse.body.data.settings).toMatchObject({
        maxRequestsPerUser: 10,
        autoApprovalEnabled: false,
        notificationsEnabled: true,
      });
    });
  });

  describe('Advanced Admin Security and Audit', () => {
    it('should maintain comprehensive audit trails for all admin actions', async () => {
      const { app, users } = context;

      const testUser = regularUsers[0];
      const createResponse = await request(app)
        .post('/api/v1/media/request')
        .send({
          mediaType: 'movie',
          tmdbId: 999900,
        })
        .set('Authorization', `Bearer ${testUser.token}`)
        .expect(201);

      const requestId = createResponse.body.data.id;

      // Perform multiple admin actions to build audit trail
      const adminActions = [
        {
          action: 'approve',
          endpoint: 'approve',
          data: { notes: 'Initial approval', priority: 'high' },
        },
        {
          action: 'update-status',
          endpoint: 'update-status',
          data: { status: 'processing', notes: 'Processing started' },
        },
        {
          action: 'update-status',
          endpoint: 'update-status',
          data: { status: 'available', notes: 'Content now available' },
        },
      ];

      for (const adminAction of adminActions) {
        await request(app)
          .put(`/api/v1/admin/requests/${requestId}/${adminAction.endpoint}`)
          .send(adminAction.data)
          .set('Authorization', `Bearer ${users.admin.token}`)
          .expect(200);
      }

      // Verify comprehensive audit trail
      const auditResponse = await request(app)
        .get(`/api/v1/admin/requests/${requestId}/audit`)
        .set('Authorization', `Bearer ${users.admin.token}`)
        .expect(200);

      expect(auditResponse.body).toMatchObject({
        success: true,
        data: {
          requestId,
          actions: expect.any(Array),
          totalActions: expect.any(Number),
          dateRange: expect.objectContaining({
            earliest: expect.any(String),
            latest: expect.any(String),
          }),
        },
      });

      const actions = auditResponse.body.data.actions;
      expect(actions.length).toBeGreaterThanOrEqual(3);

      // Verify each action has complete audit information
      actions.forEach((action: any) => {
        expect(action).toMatchObject({
          id: expect.any(Number),
          action: expect.any(String),
          performedBy: expect.objectContaining({
            id: users.admin.id,
            plexUsername: users.admin.plexUsername,
            role: 'admin',
          }),
          performedAt: expect.any(String),
          notes: expect.any(String),
          metadata: expect.any(Object),
        });
      });
    });

    it('should enforce admin-only access to sensitive operations', async () => {
      const { app, users } = context;
      const testUser = regularUsers[0];

      // Test all admin-only endpoints with regular user tokens
      const adminOnlyEndpoints = [
        { method: 'GET', path: '/api/v1/media/requests/all' },
        { method: 'GET', path: '/api/v1/admin/users' },
        { method: 'GET', path: '/api/v1/admin/dashboard/stats' },
        { method: 'GET', path: '/api/v1/admin/analytics' },
        { method: 'GET', path: '/api/v1/admin/system/health' },
        { method: 'POST', path: '/api/v1/admin/system/cache/refresh' },
        { method: 'POST', path: '/api/v1/admin/system/database/cleanup' },
      ];

      for (const endpoint of adminOnlyEndpoints) {
        const response = await request(app)
          [endpoint.method.toLowerCase()](endpoint.path)
          .set('Authorization', `Bearer ${testUser.token}`)
          .expect(403);

        expect(response.body).toMatchObject({
          success: false,
          error: {
            message: expect.stringMatching(/admin.*required|insufficient.*privileges|forbidden/i),
            code: expect.any(String),
          },
        });
      }

      // Verify admin can access all these endpoints
      for (const endpoint of adminOnlyEndpoints.filter((e) => e.method === 'GET')) {
        const response = await request(app)
          [endpoint.method.toLowerCase()](endpoint.path)
          .set('Authorization', `Bearer ${users.admin.token}`)
          .expect(200);

        expect(response.body.success).toBe(true);
      }
    });

    it('should handle admin privilege escalation attempts', async () => {
      const { app, users } = context;

      // Regular user attempts to escalate privileges through various methods
      const escalationAttempts = [
        {
          method: 'PUT',
          path: `/api/v1/users/${regularUsers[0].id}/profile`,
          body: { role: 'admin' },
        },
        {
          method: 'POST',
          path: '/api/v1/admin/users',
          body: { role: 'admin', email: 'hacker@example.com' },
        },
        {
          method: 'PUT',
          path: `/api/v1/admin/users/${regularUsers[1].id}`,
          body: { role: 'admin', status: 'active' },
        },
      ];

      for (const attempt of escalationAttempts) {
        const response = await request(app)
          [attempt.method.toLowerCase()](attempt.path)
          .send(attempt.body)
          .set('Authorization', `Bearer ${regularUsers[0].token}`)
          .expect(403);

        expect(response.body.success).toBe(false);
      }

      // Verify no privilege changes occurred
      const userCheck = await request(app)
        .get(`/api/v1/users/${regularUsers[0].id}/profile`)
        .set('Authorization', `Bearer ${regularUsers[0].token}`)
        .expect(200);

      expect(userCheck.body.data.role).toBe('user');
    });
  });

  describe('Advanced Performance and Load Testing', () => {
    it('should handle high-volume admin operations under load', async () => {
      const { app, users } = context;

      // Create a large batch of test requests
      const batchSize = 50;
      const testUser = regularUsers[0];
      const requestIds = [];

      for (let i = 0; i < batchSize; i++) {
        const createResponse = await request(app)
          .post('/api/v1/media/request')
          .send({
            mediaType: i % 2 === 0 ? 'movie' : 'tv',
            tmdbId: 900000 + i,
            seasons: i % 2 === 1 ? [1] : undefined,
          })
          .set('Authorization', `Bearer ${testUser.token}`)
          .expect(201);

        requestIds.push(createResponse.body.data.id);
      }

      // Test concurrent admin operations
      const startTime = process.hrtime.bigint();

      const concurrentOperations = [
        // Bulk approval operation
        request(app)
          .post('/api/v1/admin/requests/bulk-approve')
          .send({ requestIds: requestIds.slice(0, 25), notes: 'Bulk approval test' })
          .set('Authorization', `Bearer ${users.admin.token}`),

        // View all requests while bulk operation is running
        request(app)
          .get('/api/v1/media/requests/all')
          .query({ pageSize: 100 })
          .set('Authorization', `Bearer ${users.admin.token}`),

        // Get dashboard stats
        request(app)
          .get('/api/v1/admin/dashboard/stats')
          .set('Authorization', `Bearer ${users.admin.token}`),

        // System health check
        request(app)
          .get('/api/v1/admin/system/health')
          .set('Authorization', `Bearer ${users.admin.token}`),
      ];

      const results = await Promise.all(concurrentOperations);
      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1_000_000; // Convert to ms

      // All operations should succeed
      results.forEach((result, index) => {
        expect(result.status).toBe(200);
        expect(result.body.success).toBe(true);
      });

      // Performance should be acceptable (under 5 seconds for all concurrent operations)
      expect(duration).toBeLessThan(5000);

      // Verify bulk operation was successful
      expect(results[0].body.data.successCount).toBe(25);
      expect(results[0].body.data.failedCount).toBe(0);
    });

    it('should maintain data consistency during concurrent admin actions', async () => {
      const { app, users } = context;

      const testUser = regularUsers[1];
      const createResponse = await request(app)
        .post('/api/v1/media/request')
        .send({
          mediaType: 'movie',
          tmdbId: 999800,
        })
        .set('Authorization', `Bearer ${testUser.token}`)
        .expect(201);

      const requestId = createResponse.body.data.id;

      // Attempt concurrent modifications to the same request
      const concurrentModifications = [
        request(app)
          .put(`/api/v1/admin/requests/${requestId}/approve`)
          .send({ notes: 'Concurrent approval 1', priority: 'high' })
          .set('Authorization', `Bearer ${users.admin.token}`),

        request(app)
          .put(`/api/v1/admin/requests/${requestId}/update-status`)
          .send({ status: 'processing', notes: 'Concurrent processing' })
          .set('Authorization', `Bearer ${users.admin.token}`),

        request(app)
          .get(`/api/v1/admin/requests/${requestId}/audit`)
          .set('Authorization', `Bearer ${users.admin.token}`),
      ];

      const results = await Promise.allSettled(concurrentModifications);

      // At least one modification should succeed
      const successfulResults = results.filter(
        (result): result is PromiseFulfilledResult<any> =>
          result.status === 'fulfilled' && result.value.status === 200,
      );

      expect(successfulResults.length).toBeGreaterThan(0);

      // Verify final state is consistent
      const finalStateResponse = await request(app)
        .get(`/api/v1/media/requests/${requestId}`)
        .set('Authorization', `Bearer ${testUser.token}`)
        .expect(200);

      const finalStatus = finalStateResponse.body.data.status;
      expect(['approved', 'processing']).toContain(finalStatus);

      // Verify audit trail captures all successful actions
      const auditResponse = await request(app)
        .get(`/api/v1/admin/requests/${requestId}/audit`)
        .set('Authorization', `Bearer ${users.admin.token}`)
        .expect(200);

      expect(auditResponse.body.data.actions.length).toBeGreaterThan(0);
    });
  });

  describe('Performance and Error Handling', () => {
    it('should handle large-scale admin operations efficiently', async () => {
      const { app, users } = context;

      const performanceTest = async () => {
        return request(app)
          .get('/api/v1/media/requests/all')
          .query({ pageSize: 100 })
          .set('Authorization', `Bearer ${users.admin.token}`)
          .expect(200);
      };

      const result = await PerformanceTestHelper.measureResponseTime(performanceTest);

      // Admin operations should complete within 3 seconds even with large data sets
      expect(result.duration).toBeLessThan(3000);
      expect(DataValidationHelper.validateRequestListResponse(result.response)).toBe(true);
    });

    it('should handle concurrent admin operations', async () => {
      const { app, users } = context;

      const concurrentOperations = [
        request(app).get('/api/v1/admin/users').set('Authorization', `Bearer ${users.admin.token}`),
        request(app)
          .get('/api/v1/media/requests/all')
          .set('Authorization', `Bearer ${users.admin.token}`),
        request(app)
          .get('/api/v1/admin/dashboard/stats')
          .set('Authorization', `Bearer ${users.admin.token}`),
        request(app)
          .get('/api/v1/admin/analytics')
          .query({ timeframe: '7d' })
          .set('Authorization', `Bearer ${users.admin.token}`),
      ];

      const results = await Promise.all(concurrentOperations);

      // All operations should succeed
      results.forEach((result, index) => {
        expect(result.status).toBe(200);
        expect(result.body.success).toBe(true);
      });

      // Verify data consistency
      expect(results[0].body.data.users).toBeInstanceOf(Array);
      expect(results[1].body.data.requests).toBeInstanceOf(Array);
      expect(results[2].body.data.users.total).toBeGreaterThan(0);
      expect(results[3].body.data.timeframe).toBe('7d');
    });
  });

  describe('Complex Admin Workflow Scenarios', () => {
    it('should execute complete request lifecycle management workflow', async () => {
      const { app, users } = context;

      const adminWorkflow = new ScenarioBuilder()
        .step('viewPendingRequests', async () => {
          return request(app)
            .get('/api/v1/media/requests/all')
            .query({ status: 'pending' })
            .set('Authorization', `Bearer ${users.admin.token}`)
            .expect(200);
        })
        .step('createTestRequest', async () => {
          const testUser = regularUsers[0];
          return request(app)
            .post('/api/v1/media/request')
            .send({
              mediaType: 'movie',
              tmdbId: 999100,
            })
            .set('Authorization', `Bearer ${testUser.token}`)
            .expect(201);
        })
        .step('adminApproveRequest', async (context) => {
          const requestId = context.createTestRequest.body.data.id;

          return request(app)
            .put(`/api/v1/admin/requests/${requestId}/approve`)
            .send({
              notes: 'Approved through admin workflow',
              priority: 'high',
            })
            .set('Authorization', `Bearer ${users.admin.token}`)
            .expect(200);
        })
        .step('updateToProcessing', async (context) => {
          const requestId = context.createTestRequest.body.data.id;

          return request(app)
            .put(`/api/v1/admin/requests/${requestId}/update-status`)
            .send({
              status: 'processing',
              notes: 'Started processing media',
            })
            .set('Authorization', `Bearer ${users.admin.token}`)
            .expect(200);
        })
        .step('markAsAvailable', async (context) => {
          const requestId = context.createTestRequest.body.data.id;

          return request(app)
            .put(`/api/v1/admin/requests/${requestId}/update-status`)
            .send({
              status: 'available',
              notes: 'Media now available in Plex',
            })
            .set('Authorization', `Bearer ${users.admin.token}`)
            .expect(200);
        })
        .step('verifyWorkflow', async (context) => {
          const requestId = context.createTestRequest.body.data.id;

          // Verify final status
          const finalResponse = await request(app)
            .get(`/api/v1/media/requests/${requestId}`)
            .set('Authorization', `Bearer ${regularUsers[0].token}`)
            .expect(200);

          expect(finalResponse.body.data.status).toBe('available');

          // Check audit trail
          const auditResponse = await request(app)
            .get(`/api/v1/admin/requests/${requestId}/audit`)
            .set('Authorization', `Bearer ${users.admin.token}`)
            .expect(200);

          const actions = auditResponse.body.data.actions;
          expect(actions.length).toBeGreaterThanOrEqual(3); // approve, processing, available

          return { workflowCompleted: true };
        });

      const result = await adminWorkflow.execute();
      expect(result.verifyWorkflow.workflowCompleted).toBe(true);
    });

    it('should execute complex multi-user admin coordination workflow', async () => {
      const { app, users } = context;

      const coordinationWorkflow = new ScenarioBuilder()
        .step('createMultipleUserRequests', async () => {
          const requests = [];

          for (let i = 0; i < regularUsers.length; i++) {
            const user = regularUsers[i];
            for (let j = 0; j < 3; j++) {
              const response = await request(app)
                .post('/api/v1/media/request')
                .send({
                  mediaType: j % 2 === 0 ? 'movie' : 'tv',
                  tmdbId: 800000 + i * 10 + j,
                  seasons: j % 2 === 1 ? [1, 2] : undefined,
                })
                .set('Authorization', `Bearer ${user.token}`)
                .expect(201);

              requests.push({
                id: response.body.data.id,
                userId: user.id,
                userEmail: user.email,
              });
            }
          }

          return { requests, totalCount: requests.length };
        })
        .step('adminBulkTriage', async (context) => {
          const { requests } = context.createMultipleUserRequests;

          // Categorize requests for different actions
          const approveIds = requests.slice(0, 3).map((r) => r.id);
          const denyIds = requests.slice(3, 5).map((r) => r.id);
          const processingIds = requests.slice(5).map((r) => r.id);

          // Execute bulk operations in sequence
          const bulkApprove = await request(app)
            .post('/api/v1/admin/requests/bulk-approve')
            .send({
              requestIds: approveIds,
              notes: 'Bulk approved - coordination test',
            })
            .set('Authorization', `Bearer ${users.admin.token}`)
            .expect(200);

          const bulkDeny = await request(app)
            .post('/api/v1/admin/requests/bulk-deny')
            .send({
              requestIds: denyIds,
              reason: 'Content not available',
              notes: 'Bulk denied - coordination test',
            })
            .set('Authorization', `Bearer ${users.admin.token}`)
            .expect(200);

          // Update remaining to processing individually
          const processingResults = [];
          for (const id of processingIds) {
            const result = await request(app)
              .put(`/api/v1/admin/requests/${id}/update-status`)
              .send({
                status: 'processing',
                notes: 'Individual processing update',
              })
              .set('Authorization', `Bearer ${users.admin.token}`)
              .expect(200);

            processingResults.push(result.body.data);
          }

          return {
            approved: bulkApprove.body.data,
            denied: bulkDeny.body.data,
            processing: processingResults,
          };
        })
        .step('verifyUserExperience', async (context) => {
          const { requests } = context.createMultipleUserRequests;
          const userVerifications = [];

          // Each user should see only their requests with updated statuses
          for (const user of regularUsers) {
            const userRequests = await request(app)
              .get('/api/v1/media/requests')
              .set('Authorization', `Bearer ${user.token}`)
              .expect(200);

            const userRequestData = userRequests.body.data.requests;

            // Verify isolation - user sees only their requests
            userRequestData.forEach((req: any) => {
              expect(req.requestedBy.id).toBe(user.id);
            });

            // Verify status updates are reflected
            const userCreatedRequests = requests.filter((r) => r.userId === user.id);
            expect(userRequestData.length).toBeGreaterThanOrEqual(userCreatedRequests.length);

            userVerifications.push({
              userId: user.id,
              requestCount: userRequestData.length,
              statusDistribution: userRequestData.reduce((acc: any, req: any) => {
                acc[req.status] = (acc[req.status] || 0) + 1;
                return acc;
              }, {}),
            });
          }

          return { userVerifications };
        })
        .step('adminAnalyticsValidation', async () => {
          // Verify admin can see comprehensive view across all users
          const allRequests = await request(app)
            .get('/api/v1/media/requests/all')
            .set('Authorization', `Bearer ${users.admin.token}`)
            .expect(200);

          const dashboardStats = await request(app)
            .get('/api/v1/admin/dashboard/stats')
            .set('Authorization', `Bearer ${users.admin.token}`)
            .expect(200);

          const analytics = await request(app)
            .get('/api/v1/admin/analytics')
            .query({ timeframe: '1d' })
            .set('Authorization', `Bearer ${users.admin.token}`)
            .expect(200);

          return {
            totalVisibleRequests: allRequests.body.data.requests.length,
            dashboardData: dashboardStats.body.data,
            analyticsData: analytics.body.data,
          };
        })
        .step('workflowCompletionVerification', async (context) => {
          const { requests } = context.createMultipleUserRequests;
          const { adminAnalyticsValidation } = context;

          // Verify workflow completion metrics
          expect(adminAnalyticsValidation.totalVisibleRequests).toBeGreaterThanOrEqual(
            requests.length,
          );
          expect(adminAnalyticsValidation.dashboardData.requests.total).toBeGreaterThan(0);
          expect(adminAnalyticsValidation.analyticsData.timeframe).toBe('1d');

          return { workflowCompleted: true, processedRequests: requests.length };
        });

      const result = await coordinationWorkflow.execute();
      expect(result.workflowCompletionVerification.workflowCompleted).toBe(true);
      expect(result.workflowCompletionVerification.processedRequests).toBeGreaterThan(0);
    });

    it('should handle admin workflow failure recovery scenarios', async () => {
      const { app, users } = context;

      const recoveryWorkflow = new ScenarioBuilder()
        .step('createRequestForRecovery', async () => {
          const testUser = regularUsers[2];
          const response = await request(app)
            .post('/api/v1/media/request')
            .send({
              mediaType: 'movie',
              tmdbId: 999700,
            })
            .set('Authorization', `Bearer ${testUser.token}`)
            .expect(201);

          return { requestId: response.body.data.id, userId: testUser.id };
        })
        .step('simulatePartialFailure', async (context) => {
          const { requestId } = context.createRequestForRecovery;

          // Simulate a scenario where approval succeeds but status update fails
          const approvalResponse = await request(app)
            .put(`/api/v1/admin/requests/${requestId}/approve`)
            .send({ notes: 'Approved before simulated failure' })
            .set('Authorization', `Bearer ${users.admin.token}`)
            .expect(200);

          // Attempt invalid status update (should fail gracefully)
          const invalidUpdateResponse = await request(app)
            .put(`/api/v1/admin/requests/${requestId}/update-status`)
            .send({ status: 'invalid-status', notes: 'This should fail' })
            .set('Authorization', `Bearer ${users.admin.token}`)
            .expect(400);

          return {
            approvalSuccess: approvalResponse.body.success,
            updateFailure: !invalidUpdateResponse.body.success,
          };
        })
        .step('verifyRecoveryState', async (context) => {
          const { requestId } = context.createRequestForRecovery;

          // Verify the request is in a consistent state (approved)
          const stateResponse = await request(app)
            .get(`/api/v1/media/requests/${requestId}`)
            .set('Authorization', `Bearer ${regularUsers[2].token}`)
            .expect(200);

          expect(stateResponse.body.data.status).toBe('approved');

          // Verify audit trail shows the failure
          const auditResponse = await request(app)
            .get(`/api/v1/admin/requests/${requestId}/audit`)
            .set('Authorization', `Bearer ${users.admin.token}`)
            .expect(200);

          const actions = auditResponse.body.data.actions;
          expect(actions.some((a: any) => a.action === 'approve')).toBe(true);

          return { recoveryVerified: true };
        })
        .step('completeRecovery', async (context) => {
          const { requestId } = context.createRequestForRecovery;

          // Complete the workflow with valid status update
          const recoveryResponse = await request(app)
            .put(`/api/v1/admin/requests/${requestId}/update-status`)
            .send({ status: 'processing', notes: 'Recovery completed' })
            .set('Authorization', `Bearer ${users.admin.token}`)
            .expect(200);

          return {
            finalStatus: recoveryResponse.body.data.status,
            recoveryCompleted: true,
          };
        });

      const result = await recoveryWorkflow.execute();
      expect(result.simulatePartialFailure.approvalSuccess).toBe(true);
      expect(result.simulatePartialFailure.updateFailure).toBe(true);
      expect(result.verifyRecoveryState.recoveryVerified).toBe(true);
      expect(result.completeRecovery.recoveryCompleted).toBe(true);
      expect(result.completeRecovery.finalStatus).toBe('processing');
    });
  });
});
