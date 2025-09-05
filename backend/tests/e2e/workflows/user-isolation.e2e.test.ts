/**
 * E2E Tests: User Isolation and Data Security
 * 
 * Tests comprehensive user isolation functionality including:
 * - Users see only their own requests and data
 * - Cannot access other users' private information
 * - Proper data filtering and access controls
 * - Role-based access restrictions
 * - Session isolation and token validation
 * - Data leakage prevention
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import {
  setupE2EEnvironment,
  E2ETestContext,
  createAdditionalTestUser,
  createTestRequests,
  VisualRegression,
  ResponsiveTestHelper,
  PerformanceTestHelper,
  DataValidationHelper,
  ScenarioBuilder
} from '../utils/e2e-helpers';
import { 
  createMockRequest,
  RequestStatus
} from '../fixtures/media-data';
import { prisma } from '@/db/prisma';

describe('E2E: User Isolation and Data Security', () => {
  let context: E2ETestContext;
  let secondUser: any;
  let thirdUser: any;
  let user1Requests: any[];
  let user2Requests: any[];

  beforeAll(async () => {
    context = await setupE2EEnvironment();
    
    // Create additional test users
    secondUser = await createAdditionalTestUser(context);
    
    thirdUser = await prisma.user.create({
      data: {
        plexId: 'third-user-plex-id',
        plexUsername: 'thirduser',
        email: 'third@example.com',
        role: 'user',
        status: 'active',
        plexToken: 'encrypted-third-token',
      },
    });
    
    // Create token for third user
    const { createAuthToken } = await import('../../helpers/auth');
    thirdUser.token = createAuthToken(thirdUser);

    // Create test requests for each user
    user1Requests = await createTestRequests(context.users.user.id, 8);
    user2Requests = await createTestRequests(secondUser.id, 6);
  });

  afterAll(async () => {
    await context.cleanup();
  });

  describe('Request Data Isolation', () => {
    it('should only show users their own requests', async () => {
      const { app } = context;

      // User 1 gets their requests
      const user1Response = await request(app)
        .get('/api/v1/media/requests')
        .set('Authorization', `Bearer ${context.users.user.token}`)
        .expect(200);

      expect(DataValidationHelper.validateRequestListResponse(user1Response)).toBe(true);

      const user1RequestsData = user1Response.body.data.requests;
      
      // Verify all requests belong to user 1
      user1RequestsData.forEach((request: any) => {
        expect(request.requestedBy.id).toBe(context.users.user.id);
      });

      // User 2 gets their requests
      const user2Response = await request(app)
        .get('/api/v1/media/requests')
        .set('Authorization', `Bearer ${secondUser.token}`)
        .expect(200);

      expect(DataValidationHelper.validateRequestListResponse(user2Response)).toBe(true);

      const user2RequestsData = user2Response.body.data.requests;
      
      // Verify all requests belong to user 2
      user2RequestsData.forEach((request: any) => {
        expect(request.requestedBy.id).toBe(secondUser.id);
      });

      // Verify no cross-contamination
      const user1RequestIds = user1RequestsData.map((r: any) => r.id);
      const user2RequestIds = user2RequestsData.map((r: any) => r.id);
      
      const commonRequestIds = user1RequestIds.filter((id: number) => 
        user2RequestIds.includes(id)
      );
      
      expect(commonRequestIds).toHaveLength(0);
    });

    it('should prevent access to other users specific requests', async () => {
      const { app } = context;

      if (user1Requests.length > 0 && user2Requests.length > 0) {
        const user1RequestId = user1Requests[0].id;
        const user2RequestId = user2Requests[0].id;

        // User 1 tries to access User 2's request
        const unauthorizedResponse = await request(app)
          .get(`/api/v1/media/requests/${user2RequestId}`)
          .set('Authorization', `Bearer ${context.users.user.token}`)
          .expect(403);

        expect(unauthorizedResponse.body).toMatchObject({
          success: false,
          error: {
            message: expect.stringMatching(/access denied|forbidden|not authorized/i)
          }
        });

        // User 2 tries to access User 1's request
        const unauthorizedResponse2 = await request(app)
          .get(`/api/v1/media/requests/${user1RequestId}`)
          .set('Authorization', `Bearer ${secondUser.token}`)
          .expect(403);

        expect(unauthorizedResponse2.body.success).toBe(false);

        // Users can access their own requests
        const authorizedResponse1 = await request(app)
          .get(`/api/v1/media/requests/${user1RequestId}`)
          .set('Authorization', `Bearer ${context.users.user.token}`)
          .expect(200);

        expect(authorizedResponse1.body.success).toBe(true);
        expect(authorizedResponse1.body.data.id).toBe(user1RequestId);

        const authorizedResponse2 = await request(app)
          .get(`/api/v1/media/requests/${user2RequestId}`)
          .set('Authorization', `Bearer ${secondUser.token}`)
          .expect(200);

        expect(authorizedResponse2.body.success).toBe(true);
        expect(authorizedResponse2.body.data.id).toBe(user2RequestId);
      }
    });

    it('should prevent modification of other users requests', async () => {
      const { app } = context;

      if (user2Requests.length > 0) {
        const user2PendingRequest = user2Requests.find(r => r.status === 'pending');
        
        if (user2PendingRequest) {
          // User 1 tries to delete User 2's request
          const deleteResponse = await request(app)
            .delete(`/api/v1/media/requests/${user2PendingRequest.id}`)
            .set('Authorization', `Bearer ${context.users.user.token}`)
            .expect(403);

          expect(deleteResponse.body).toMatchObject({
            success: false,
            error: {
              message: expect.stringMatching(/access denied|forbidden/i)
            }
          });

          // Verify request still exists for the owner
          const verifyResponse = await request(app)
            .get(`/api/v1/media/requests/${user2PendingRequest.id}`)
            .set('Authorization', `Bearer ${secondUser.token}`)
            .expect(200);

          expect(verifyResponse.body.success).toBe(true);
        }
      }
    });

    it('should filter search results based on user ownership', async () => {
      const { app } = context;

      // User 1 searches their requests
      const user1SearchResponse = await request(app)
        .get('/api/v1/media/requests')
        .query({ search: 'Test' })
        .set('Authorization', `Bearer ${context.users.user.token}`)
        .expect(200);

      const user1Results = user1SearchResponse.body.data.requests;
      
      // All results should belong to user 1
      user1Results.forEach((request: any) => {
        expect(request.requestedBy.id).toBe(context.users.user.id);
      });

      // User 2 searches their requests
      const user2SearchResponse = await request(app)
        .get('/api/v1/media/requests')
        .query({ search: 'Test' })
        .set('Authorization', `Bearer ${secondUser.token}`)
        .expect(200);

      const user2Results = user2SearchResponse.body.data.requests;
      
      // All results should belong to user 2
      user2Results.forEach((request: any) => {
        expect(request.requestedBy.id).toBe(secondUser.id);
      });

      // No overlap in results
      const user1Ids = user1Results.map((r: any) => r.id);
      const user2Ids = user2Results.map((r: any) => r.id);
      const overlap = user1Ids.filter(id => user2Ids.includes(id));
      
      expect(overlap).toHaveLength(0);
    });
  });

  describe('User Profile and Personal Data Isolation', () => {
    it('should prevent access to other users profile information', async () => {
      const { app } = context;

      // User 1 tries to access User 2's profile
      const unauthorizedProfileResponse = await request(app)
        .get(`/api/v1/users/${secondUser.id}/profile`)
        .set('Authorization', `Bearer ${context.users.user.token}`)
        .expect(403);

      expect(unauthorizedProfileResponse.body).toMatchObject({
        success: false,
        error: {
          message: expect.stringMatching(/access denied|forbidden/i)
        }
      });

      // User can access their own profile
      const authorizedProfileResponse = await request(app)
        .get(`/api/v1/users/${context.users.user.id}/profile`)
        .set('Authorization', `Bearer ${context.users.user.token}`)
        .expect(200);

      expect(authorizedProfileResponse.body).toMatchObject({
        success: true,
        data: expect.objectContaining({
          id: context.users.user.id,
          plexUsername: context.users.user.plexUsername,
          email: context.users.user.email
        })
      });

      // Sensitive data should not be exposed
      expect(authorizedProfileResponse.body.data).not.toHaveProperty('plexToken');
      expect(authorizedProfileResponse.body.data).not.toHaveProperty('password');
    });

    it('should prevent users from modifying other users profiles', async () => {
      const { app } = context;

      // User 1 tries to update User 2's profile
      const unauthorizedUpdateResponse = await request(app)
        .put(`/api/v1/users/${secondUser.id}/profile`)
        .send({
          plexUsername: 'hacked-username',
          email: 'hacked@example.com'
        })
        .set('Authorization', `Bearer ${context.users.user.token}`)
        .expect(403);

      expect(unauthorizedUpdateResponse.body.success).toBe(false);

      // Verify User 2's profile wasn't changed
      const verifyProfileResponse = await request(app)
        .get(`/api/v1/users/${secondUser.id}/profile`)
        .set('Authorization', `Bearer ${secondUser.token}`)
        .expect(200);

      expect(verifyProfileResponse.body.data.plexUsername).toBe(secondUser.plexUsername);
      expect(verifyProfileResponse.body.data.email).toBe(secondUser.email);
    });

    it('should isolate user settings and preferences', async () => {
      const { app } = context;

      // User 1 sets their preferences
      const user1SettingsResponse = await request(app)
        .put('/api/v1/users/settings')
        .send({
          notifications: {
            email: true,
            push: false
          },
          preferences: {
            defaultQuality: 'HD',
            autoApprove: false
          }
        })
        .set('Authorization', `Bearer ${context.users.user.token}`)
        .expect(200);

      expect(user1SettingsResponse.body.success).toBe(true);

      // User 2 sets different preferences
      const user2SettingsResponse = await request(app)
        .put('/api/v1/users/settings')
        .send({
          notifications: {
            email: false,
            push: true
          },
          preferences: {
            defaultQuality: '4K',
            autoApprove: true
          }
        })
        .set('Authorization', `Bearer ${secondUser.token}`)
        .expect(200);

      expect(user2SettingsResponse.body.success).toBe(true);

      // Verify settings are isolated
      const user1GetSettingsResponse = await request(app)
        .get('/api/v1/users/settings')
        .set('Authorization', `Bearer ${context.users.user.token}`)
        .expect(200);

      const user2GetSettingsResponse = await request(app)
        .get('/api/v1/users/settings')
        .set('Authorization', `Bearer ${secondUser.token}`)
        .expect(200);

      expect(user1GetSettingsResponse.body.data.preferences.defaultQuality).toBe('HD');
      expect(user2GetSettingsResponse.body.data.preferences.defaultQuality).toBe('4K');
      
      expect(user1GetSettingsResponse.body.data.notifications.email).toBe(true);
      expect(user2GetSettingsResponse.body.data.notifications.email).toBe(false);
    });
  });

  describe('Session and Token Isolation', () => {
    it('should prevent token reuse across different users', async () => {
      const { app } = context;

      // Create a request using User 1's token but claiming to be User 2
      const maliciousResponse = await request(app)
        .post('/api/v1/media/request')
        .send({
          mediaType: 'movie',
          tmdbId: 999001,
          userId: secondUser.id // Trying to impersonate
        })
        .set('Authorization', `Bearer ${context.users.user.token}`)
        .expect(201); // Should succeed but create request for the token owner

      expect(maliciousResponse.body.success).toBe(true);
      
      // Request should be created for the token owner (User 1), not the claimed user
      expect(maliciousResponse.body.data.requestedBy.id).toBe(context.users.user.id);
      expect(maliciousResponse.body.data.requestedBy.id).not.toBe(secondUser.id);
    });

    it('should invalidate sessions properly on logout', async () => {
      const { app } = context;

      // Create a temporary token for testing
      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: context.users.user.email,
          password: 'test-password' // This would need to match the user's actual password
        });

      // Skip if login endpoint doesn't exist or requires different auth
      if (loginResponse.status === 200 && loginResponse.body.data?.token) {
        const tempToken = loginResponse.body.data.token;

        // Use the token successfully
        const authorizedResponse = await request(app)
          .get('/api/v1/media/requests')
          .set('Authorization', `Bearer ${tempToken}`)
          .expect(200);

        expect(authorizedResponse.body.success).toBe(true);

        // Logout
        const logoutResponse = await request(app)
          .post('/api/v1/auth/logout')
          .set('Authorization', `Bearer ${tempToken}`)
          .expect(200);

        expect(logoutResponse.body.success).toBe(true);

        // Try to use the token after logout
        const unauthorizedResponse = await request(app)
          .get('/api/v1/media/requests')
          .set('Authorization', `Bearer ${tempToken}`)
          .expect(401);

        expect(unauthorizedResponse.body.success).toBe(false);
      }
    });

    it('should prevent session hijacking attempts', async () => {
      const { app } = context;

      // Try to use malformed tokens
      const malformedTokenResponse = await request(app)
        .get('/api/v1/media/requests')
        .set('Authorization', 'Bearer malformed.token.here')
        .expect(401);

      expect(malformedTokenResponse.body.success).toBe(false);

      // Try to use expired token (simulate by manipulating JWT if possible)
      const expiredTokenResponse = await request(app)
        .get('/api/v1/media/requests')
        .set('Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE1MTYyMzkwMjJ9.invalid')
        .expect(401);

      expect(expiredTokenResponse.body.success).toBe(false);

      // Try to use token with tampered payload
      const tamperedTokenResponse = await request(app)
        .get('/api/v1/media/requests')
        .set('Authorization', 'Bearer ' + context.users.user.token.slice(0, -10) + 'tampered123')
        .expect(401);

      expect(tamperedTokenResponse.body.success).toBe(false);
    });
  });

  describe('Role-Based Access Control', () => {
    it('should restrict regular users from admin-only endpoints', async () => {
      const { app } = context;

      // Regular user tries to access all user requests (admin only)
      const adminOnlyResponse = await request(app)
        .get('/api/v1/media/requests/all')
        .set('Authorization', `Bearer ${context.users.user.token}`)
        .expect(403);

      expect(adminOnlyResponse.body).toMatchObject({
        success: false,
        error: {
          message: expect.stringMatching(/admin.*required|insufficient.*privileges/i)
        }
      });

      // Regular user tries to approve requests (admin only)
      if (user1Requests.length > 0) {
        const approveResponse = await request(app)
          .put(`/api/v1/media/requests/${user1Requests[0].id}/approve`)
          .set('Authorization', `Bearer ${context.users.user.token}`)
          .expect(403);

        expect(approveResponse.body.success).toBe(false);
      }

      // Regular user tries to access user management (admin only)
      const userManagementResponse = await request(app)
        .get('/api/v1/admin/users')
        .set('Authorization', `Bearer ${context.users.user.token}`)
        .expect(403);

      expect(userManagementResponse.body.success).toBe(false);
    });

    it('should allow admin users to access admin endpoints', async () => {
      const { app } = context;

      // Admin can access all user requests
      const allRequestsResponse = await request(app)
        .get('/api/v1/media/requests/all')
        .set('Authorization', `Bearer ${context.users.admin.token}`)
        .expect(200);

      expect(allRequestsResponse.body.success).toBe(true);
      expect(DataValidationHelper.validateRequestListResponse(allRequestsResponse)).toBe(true);

      const allRequests = allRequestsResponse.body.data.requests;
      
      // Should include requests from multiple users
      const userIds = [...new Set(allRequests.map((r: any) => r.requestedBy.id))];
      expect(userIds.length).toBeGreaterThan(1); // Multiple users represented

      // Admin can access user management
      const usersResponse = await request(app)
        .get('/api/v1/admin/users')
        .set('Authorization', `Bearer ${context.users.admin.token}`)
        .expect(200);

      expect(usersResponse.body.success).toBe(true);
      expect(usersResponse.body.data).toBeInstanceOf(Array);
    });

    it('should prevent privilege escalation attempts', async () => {
      const { app } = context;

      // Regular user tries to modify their own role
      const escalationResponse = await request(app)
        .put(`/api/v1/users/${context.users.user.id}/profile`)
        .send({
          role: 'admin' // Trying to escalate privileges
        })
        .set('Authorization', `Bearer ${context.users.user.token}`)
        .expect(403);

      expect(escalationResponse.body.success).toBe(false);

      // Verify role wasn't changed
      const profileResponse = await request(app)
        .get(`/api/v1/users/${context.users.user.id}/profile`)
        .set('Authorization', `Bearer ${context.users.user.token}`)
        .expect(200);

      expect(profileResponse.body.data.role).toBe('user');
    });
  });

  describe('Data Leakage Prevention', () => {
    it('should not expose sensitive data in API responses', async () => {
      const { app } = context;

      // Check user request response doesn't leak sensitive data
      const requestResponse = await request(app)
        .get('/api/v1/media/requests')
        .set('Authorization', `Bearer ${context.users.user.token}`)
        .expect(200);

      const requests = requestResponse.body.data.requests;
      
      requests.forEach((request: any) => {
        // Should not expose other users' email addresses
        if (request.requestedBy.id !== context.users.user.id) {
          expect(request.requestedBy).not.toHaveProperty('email');
        }
        
        // Should not expose internal system data
        expect(request).not.toHaveProperty('internalNotes');
        expect(request).not.toHaveProperty('systemData');
        expect(request.requestedBy).not.toHaveProperty('plexToken');
      });

      // Check profile response doesn't leak tokens
      const profileResponse = await request(app)
        .get(`/api/v1/users/${context.users.user.id}/profile`)
        .set('Authorization', `Bearer ${context.users.user.token}`)
        .expect(200);

      expect(profileResponse.body.data).not.toHaveProperty('plexToken');
      expect(profileResponse.body.data).not.toHaveProperty('passwordHash');
      expect(profileResponse.body.data).not.toHaveProperty('refreshToken');
    });

    it('should prevent information disclosure through error messages', async () => {
      const { app } = context;

      // Try to access non-existent user's request
      const nonExistentResponse = await request(app)
        .get('/api/v1/media/requests/999999')
        .set('Authorization', `Bearer ${context.users.user.token}`)
        .expect(404);

      // Error message should not reveal whether the request exists for another user
      expect(nonExistentResponse.body.error.message).not.toMatch(/belongs to another user/i);
      expect(nonExistentResponse.body.error.message).not.toMatch(/user.*not authorized/i);
      expect(nonExistentResponse.body.error.message).toMatch(/not found/i);

      // Try to access actual other user's request
      if (user2Requests.length > 0) {
        const otherUserResponse = await request(app)
          .get(`/api/v1/media/requests/${user2Requests[0].id}`)
          .set('Authorization', `Bearer ${context.users.user.token}`)
          .expect(403);

        // Should give generic access denied message
        expect(otherUserResponse.body.error.message).toMatch(/access denied|forbidden/i);
        expect(otherUserResponse.body.error.message).not.toContain(secondUser.email);
        expect(otherUserResponse.body.error.message).not.toContain(secondUser.plexUsername);
      }
    });

    it('should sanitize search and filter inputs to prevent injection', async () => {
      const { app } = context;

      // Test SQL injection attempts in search
      const sqlInjectionResponse = await request(app)
        .get('/api/v1/media/requests')
        .query({ search: "'; DROP TABLE users; --" })
        .set('Authorization', `Bearer ${context.users.user.token}`)
        .expect(200);

      expect(sqlInjectionResponse.body.success).toBe(true);
      // Should return empty results or handle gracefully without breaking

      // Test script injection in search
      const scriptInjectionResponse = await request(app)
        .get('/api/v1/media/requests')
        .query({ search: '<script>alert("xss")</script>' })
        .set('Authorization', `Bearer ${context.users.user.token}`)
        .expect(200);

      expect(scriptInjectionResponse.body.success).toBe(true);

      // Test NoSQL injection attempts
      const noSqlInjectionResponse = await request(app)
        .get('/api/v1/media/requests')
        .query({ search: '{"$ne": null}' })
        .set('Authorization', `Bearer ${context.users.user.token}`)
        .expect(200);

      expect(noSqlInjectionResponse.body.success).toBe(true);
    });
  });

  describe('Performance and Stress Testing for Isolation', () => {
    it('should maintain isolation under concurrent access', async () => {
      const { app } = context;

      // Create concurrent requests from different users
      const concurrentRequests = [
        // User 1 requests
        ...Array.from({ length: 10 }, () =>
          request(app)
            .get('/api/v1/media/requests')
            .set('Authorization', `Bearer ${context.users.user.token}`)
        ),
        // User 2 requests
        ...Array.from({ length: 10 }, () =>
          request(app)
            .get('/api/v1/media/requests')
            .set('Authorization', `Bearer ${secondUser.token}`)
        ),
        // User 3 requests
        ...Array.from({ length: 5 }, () =>
          request(app)
            .get('/api/v1/media/requests')
            .set('Authorization', `Bearer ${thirdUser.token}`)
        )
      ];

      const results = await Promise.all(concurrentRequests);

      // All requests should succeed
      results.forEach((result, index) => {
        expect(result.status).toBe(200);
        expect(result.body.success).toBe(true);
      });

      // Verify isolation is maintained
      const user1Results = results.slice(0, 10);
      const user2Results = results.slice(10, 20);
      const user3Results = results.slice(20, 25);

      // Check that each user only gets their own data
      user1Results.forEach((result) => {
        result.body.data.requests.forEach((request: any) => {
          expect(request.requestedBy.id).toBe(context.users.user.id);
        });
      });

      user2Results.forEach((result) => {
        result.body.data.requests.forEach((request: any) => {
          expect(request.requestedBy.id).toBe(secondUser.id);
        });
      });

      user3Results.forEach((result) => {
        result.body.data.requests.forEach((request: any) => {
          expect(request.requestedBy.id).toBe(thirdUser.id);
        });
      });
    });

    it('should measure isolation overhead', async () => {
      const { app } = context;

      const performanceTest = async () => {
        return request(app)
          .get('/api/v1/media/requests')
          .query({ pageSize: 50 })
          .set('Authorization', `Bearer ${context.users.user.token}`)
          .expect(200);
      };

      const result = await PerformanceTestHelper.measureResponseTime(performanceTest);
      
      // Isolation should not significantly impact performance (under 2 seconds)
      expect(result.duration).toBeLessThan(2000);
      expect(DataValidationHelper.validateRequestListResponse(result.response)).toBe(true);

      // Verify response contains only user's data
      result.response.body.data.requests.forEach((request: any) => {
        expect(request.requestedBy.id).toBe(context.users.user.id);
      });
    });
  });

  describe('Complex User Isolation Scenarios', () => {
    it('should execute complete multi-user workflow with isolation', async () => {
      const { app } = context;

      const isolationWorkflow = new ScenarioBuilder()
        .step('user1CreateRequest', async () => {
          return request(app)
            .post('/api/v1/media/request')
            .send({
              mediaType: 'movie',
              tmdbId: 888001
            })
            .set('Authorization', `Bearer ${context.users.user.token}`)
            .expect(201);
        })
        .step('user2CreateRequest', async () => {
          return request(app)
            .post('/api/v1/media/request')
            .send({
              mediaType: 'tv',
              tmdbId: 888002,
              seasons: [1, 2]
            })
            .set('Authorization', `Bearer ${secondUser.token}`)
            .expect(201);
        })
        .step('verifyIsolation', async (context) => {
          const user1RequestId = context.user1CreateRequest.body.data.id;
          const user2RequestId = context.user2CreateRequest.body.data.id;

          // User 1 should see their request
          const user1ViewResponse = await request(app)
            .get(`/api/v1/media/requests/${user1RequestId}`)
            .set('Authorization', `Bearer ${context.users.user.token}`)
            .expect(200);

          expect(user1ViewResponse.body.data.requestedBy.id).toBe(context.users.user.id);

          // User 1 should NOT see User 2's request
          const user1UnauthorizedResponse = await request(app)
            .get(`/api/v1/media/requests/${user2RequestId}`)
            .set('Authorization', `Bearer ${context.users.user.token}`)
            .expect(403);

          expect(user1UnauthorizedResponse.body.success).toBe(false);

          // User 2 should see their request
          const user2ViewResponse = await request(app)
            .get(`/api/v1/media/requests/${user2RequestId}`)
            .set('Authorization', `Bearer ${secondUser.token}`)
            .expect(200);

          expect(user2ViewResponse.body.data.requestedBy.id).toBe(secondUser.id);

          return { isolationVerified: true };
        });

      const result = await isolationWorkflow.execute();
      expect(result.verifyIsolation.isolationVerified).toBe(true);
    });

    it('should handle edge cases in user isolation', async () => {
      const { app } = context;

      // Test with URL manipulation attempts
      const urlManipulationResponse = await request(app)
        .get('/api/v1/media/requests')
        .query({ userId: secondUser.id }) // Trying to see another user's requests
        .set('Authorization', `Bearer ${context.users.user.token}`)
        .expect(200);

      // Should ignore the userId parameter and return only the token owner's requests
      urlManipulationResponse.body.data.requests.forEach((request: any) => {
        expect(request.requestedBy.id).toBe(context.users.user.id);
        expect(request.requestedBy.id).not.toBe(secondUser.id);
      });

      // Test with header manipulation
      const headerManipulationResponse = await request(app)
        .get('/api/v1/media/requests')
        .set('Authorization', `Bearer ${context.users.user.token}`)
        .set('X-User-ID', secondUser.id.toString()) // Custom header attempt
        .expect(200);

      // Should still return only the token owner's requests
      headerManipulationResponse.body.data.requests.forEach((request: any) => {
        expect(request.requestedBy.id).toBe(context.users.user.id);
      });
    });
  });
});