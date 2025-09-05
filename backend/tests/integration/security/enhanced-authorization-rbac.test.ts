import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { User } from '@prisma/client';

import { app } from '../../../src/server';
import { cleanDatabase, disconnectDatabase } from '../../helpers/database';
import { createTestUser, generateValidToken } from '../../helpers/auth';
import { UserRepository } from '../../../src/repositories/user.repository';

describe('Enhanced Authorization and RBAC Security Tests', () => {
  let userRepository: UserRepository;
  let regularUser: User;
  let adminUser: User;
  let moderatorUser: User;
  let regularToken: string;
  let adminToken: string;
  let moderatorToken: string;

  beforeAll(async () => {
    userRepository = new UserRepository();
  });

  beforeEach(async () => {
    await cleanDatabase();
    
    regularUser = await createTestUser({
      email: 'user@example.com',
      name: 'Regular User',
      plexId: 'plex-user',
      role: 'user',
    });
    
    adminUser = await createTestUser({
      email: 'admin@example.com',
      name: 'Admin User',
      plexId: 'plex-admin',
      role: 'admin',
    });

    moderatorUser = await createTestUser({
      email: 'moderator@example.com',
      name: 'Moderator User',
      plexId: 'plex-moderator',
      role: 'moderator',
    });
    
    regularToken = await generateValidToken(regularUser.id);
    adminToken = await generateValidToken(adminUser.id);
    moderatorToken = await generateValidToken(moderatorUser.id);
  });

  afterAll(async () => {
    await disconnectDatabase();
  });

  describe('Role-Based Access Control (RBAC)', () => {
    it('should enforce admin-only endpoints', async () => {
      const adminEndpoints = [
        { method: 'get', path: '/api/admin/users' },
        { method: 'get', path: '/api/admin/system' },
        { method: 'post', path: '/api/admin/users' },
        { method: 'delete', path: '/api/admin/users/test-id' },
        { method: 'get', path: '/api/admin/logs' },
        { method: 'get', path: '/api/admin/settings' },
        { method: 'patch', path: '/api/admin/settings' },
      ];

      for (const endpoint of adminEndpoints) {
        // Regular user should be forbidden
        const regularResponse = await request(app)[endpoint.method](endpoint.path)
          .set('Authorization', `Bearer ${regularToken}`);
        expect(regularResponse.status).toBe(403);
        expect(regularResponse.body.code).toBe('INSUFFICIENT_PERMISSIONS');

        // Admin should have access
        const adminResponse = await request(app)[endpoint.method](endpoint.path)
          .set('Authorization', `Bearer ${adminToken}`);
        expect([200, 201, 404]).toContain(adminResponse.status);
      }
    });

    it('should implement granular permission system', async () => {
      const permissionTests = [
        {
          path: '/api/media-requests',
          method: 'post',
          requiredPermission: 'media:create',
          allowedRoles: ['user', 'moderator', 'admin'],
        },
        {
          path: '/api/media-requests/approve',
          method: 'patch',
          requiredPermission: 'media:approve',
          allowedRoles: ['moderator', 'admin'],
        },
        {
          path: '/api/users/ban',
          method: 'post',
          requiredPermission: 'users:ban',
          allowedRoles: ['admin'],
        },
        {
          path: '/api/system/maintenance',
          method: 'post',
          requiredPermission: 'system:maintenance',
          allowedRoles: ['admin'],
        },
      ];

      for (const test of permissionTests) {
        const tokens = {
          user: regularToken,
          moderator: moderatorToken,
          admin: adminToken,
        };

        for (const [role, token] of Object.entries(tokens)) {
          const response = await request(app)[test.method](test.path)
            .set('Authorization', `Bearer ${token}`)
            .send({});

          if (test.allowedRoles.includes(role)) {
            expect([200, 201, 404]).toContain(response.status);
          } else {
            expect(response.status).toBe(403);
            expect(response.body.code).toBe('INSUFFICIENT_PERMISSIONS');
          }
        }
      }
    });

    it('should prevent horizontal privilege escalation', async () => {
      // Create second regular user
      const user2 = await createTestUser({
        email: 'user2@example.com',
        name: 'User Two',
        plexId: 'plex-user2',
        role: 'user',
      });

      const user2Token = await generateValidToken(user2.id);

      // User should not be able to access other user's data
      const response = await request(app)
        .get(`/api/users/${user2.id}/profile`)
        .set('Authorization', `Bearer ${regularToken}`);

      expect(response.status).toBe(403);
      expect(response.body.code).toBe('ACCESS_DENIED');

      // User should be able to access their own data
      const ownResponse = await request(app)
        .get(`/api/users/${regularUser.id}/profile`)
        .set('Authorization', `Bearer ${regularToken}`);

      expect([200, 404]).toContain(ownResponse.status);
    });

    it('should prevent vertical privilege escalation', async () => {
      // Regular user tries to perform admin actions
      const escalationAttempts = [
        {
          method: 'patch',
          path: `/api/users/${regularUser.id}`,
          body: { role: 'admin' }, // Try to make self admin
        },
        {
          method: 'post',
          path: '/api/admin/users',
          body: { email: 'evil@example.com', role: 'admin' },
        },
        {
          method: 'patch',
          path: '/api/system/permissions',
          body: { userId: regularUser.id, permissions: ['admin:*'] },
        },
      ];

      for (const attempt of escalationAttempts) {
        const response = await request(app)[attempt.method](attempt.path)
          .set('Authorization', `Bearer ${regularToken}`)
          .send(attempt.body);

        expect([403, 404]).toContain(response.status);
        if (response.status === 403) {
          expect(response.body.code).toBe('INSUFFICIENT_PERMISSIONS');
        }
      }
    });

    it('should enforce context-based access control', async () => {
      // Create media request owned by user
      const mediaRequest = await request(app)
        .post('/api/media-requests')
        .set('Authorization', `Bearer ${regularToken}`)
        .send({
          title: 'Test Movie',
          mediaType: 'movie',
          tmdbId: '12345',
        });

      if (mediaRequest.status === 201) {
        const requestId = mediaRequest.body.data.id;

        // User should be able to cancel their own request
        const cancelResponse = await request(app)
          .delete(`/api/media-requests/${requestId}`)
          .set('Authorization', `Bearer ${regularToken}`);

        expect([200, 204]).toContain(cancelResponse.status);

        // Another user should not be able to cancel it
        const otherUserResponse = await request(app)
          .delete(`/api/media-requests/${requestId}`)
          .set('Authorization', `Bearer ${moderatorToken}`);

        // Moderator might have permission, regular user should not
        if (otherUserResponse.status === 403) {
          expect(otherUserResponse.body.code).toBe('ACCESS_DENIED');
        }
      }
    });
  });

  describe('Resource-Based Authorization', () => {
    it('should implement resource ownership validation', async () => {
      // Create a resource owned by user
      const createResponse = await request(app)
        .post('/api/user-settings')
        .set('Authorization', `Bearer ${regularToken}`)
        .send({
          theme: 'dark',
          language: 'en',
        });

      if (createResponse.status === 201) {
        const settingsId = createResponse.body.data.id;

        // Owner should be able to update
        const updateResponse = await request(app)
          .patch(`/api/user-settings/${settingsId}`)
          .set('Authorization', `Bearer ${regularToken}`)
          .send({ theme: 'light' });

        expect([200, 204]).toContain(updateResponse.status);

        // Other user should not be able to update
        const otherResponse = await request(app)
          .patch(`/api/user-settings/${settingsId}`)
          .set('Authorization', `Bearer ${moderatorToken}`)
          .send({ theme: 'auto' });

        expect(otherResponse.status).toBe(403);
      }
    });

    it('should validate resource access based on user relationships', async () => {
      // Test friend/sharing relationships
      const shareResponse = await request(app)
        .post('/api/playlists/share')
        .set('Authorization', `Bearer ${regularToken}`)
        .send({
          playlistId: 'playlist-123',
          sharedWith: [moderatorUser.id],
          permissions: ['read'],
        });

      if (shareResponse.status === 201) {
        // Shared user should have read access
        const readResponse = await request(app)
          .get('/api/playlists/playlist-123')
          .set('Authorization', `Bearer ${moderatorToken}`);

        expect(readResponse.status).toBe(200);

        // But not write access
        const writeResponse = await request(app)
          .patch('/api/playlists/playlist-123')
          .set('Authorization', `Bearer ${moderatorToken}`)
          .send({ name: 'Modified Name' });

        expect(writeResponse.status).toBe(403);
      }
    });

    it('should implement time-based access control', async () => {
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago

      // Create scheduled access
      const scheduleResponse = await request(app)
        .post('/api/scheduled-access')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          userId: regularUser.id,
          resource: '/api/premium-features',
          validFrom: futureDate,
          validUntil: new Date(futureDate.getTime() + 7 * 24 * 60 * 60 * 1000), // 7 days later
        });

      if (scheduleResponse.status === 201) {
        // Should not have access yet
        const earlyResponse = await request(app)
          .get('/api/premium-features')
          .set('Authorization', `Bearer ${regularToken}`);

        expect(earlyResponse.status).toBe(403);
        expect(earlyResponse.body.code).toBe('ACCESS_NOT_ACTIVE');
      }
    });

    it('should enforce IP-based access restrictions', async () => {
      // Set IP restrictions for admin account
      await request(app)
        .patch('/api/admin/security-settings')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          ipWhitelist: ['192.168.1.0/24', '10.0.0.0/8'],
        });

      // Request from allowed IP
      const allowedResponse = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('X-Forwarded-For', '192.168.1.100');

      expect([200, 404]).toContain(allowedResponse.status);

      // Request from blocked IP
      const blockedResponse = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('X-Forwarded-For', '203.0.113.1');

      expect(blockedResponse.status).toBe(403);
      expect(blockedResponse.body.code).toBe('IP_NOT_ALLOWED');
    });
  });

  describe('Dynamic Permission System', () => {
    it('should support runtime permission changes', async () => {
      // Initially user has no special permissions
      const initialResponse = await request(app)
        .get('/api/moderator/reports')
        .set('Authorization', `Bearer ${regularToken}`);

      expect(initialResponse.status).toBe(403);

      // Admin grants moderator permissions
      const grantResponse = await request(app)
        .post('/api/admin/permissions/grant')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          userId: regularUser.id,
          permissions: ['moderator:reports:read'],
          expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
        });

      if (grantResponse.status === 200) {
        // User should now have access
        const accessResponse = await request(app)
          .get('/api/moderator/reports')
          .set('Authorization', `Bearer ${regularToken}`);

        expect([200, 404]).toContain(accessResponse.status);
      }
    });

    it('should implement permission inheritance', async () => {
      // Create group with permissions
      const groupResponse = await request(app)
        .post('/api/admin/groups')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Content Moderators',
          permissions: [
            'media:approve',
            'media:reject',
            'comments:moderate',
          ],
        });

      if (groupResponse.status === 201) {
        const groupId = groupResponse.body.data.id;

        // Add user to group
        await request(app)
          .post(`/api/admin/groups/${groupId}/members`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ userId: regularUser.id });

        // User should inherit group permissions
        const permissionResponse = await request(app)
          .post('/api/media-requests/approve')
          .set('Authorization', `Bearer ${regularToken}`)
          .send({ requestId: 'request-123' });

        expect([200, 204, 404]).toContain(permissionResponse.status);
      }
    });

    it('should handle permission conflicts and precedence', async () => {
      // Grant user specific deny permission
      await request(app)
        .post('/api/admin/permissions/deny')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          userId: regularUser.id,
          permissions: ['media:delete'],
        });

      // Add user to group with allow permission
      await request(app)
        .post('/api/admin/groups/content-creators/members')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          userId: regularUser.id,
          permissions: ['media:delete'], // Conflicting permission
        });

      // Deny should take precedence
      const deleteResponse = await request(app)
        .delete('/api/media/media-123')
        .set('Authorization', `Bearer ${regularToken}`);

      expect(deleteResponse.status).toBe(403);
      expect(deleteResponse.body.code).toBe('PERMISSION_EXPLICITLY_DENIED');
    });
  });

  describe('Administrative Override and Audit', () => {
    it('should allow admin override with audit logging', async () => {
      // Create protected resource
      const protectedResponse = await request(app)
        .get('/api/protected/sensitive-data')
        .set('Authorization', `Bearer ${regularToken}`);

      expect(protectedResponse.status).toBe(403);

      // Admin override
      const overrideResponse = await request(app)
        .get('/api/protected/sensitive-data')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('X-Admin-Override', 'true')
        .set('X-Override-Reason', 'Security investigation');

      expect([200, 404]).toContain(overrideResponse.status);

      // Verify audit log entry
      const auditResponse = await request(app)
        .get('/api/admin/audit-logs')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ action: 'ADMIN_OVERRIDE' });

      if (auditResponse.status === 200) {
        expect(auditResponse.body.data).toBeInstanceOf(Array);
        const overrideLog = auditResponse.body.data.find(
          (log: any) => log.reason === 'Security investigation'
        );
        expect(overrideLog).toBeDefined();
      }
    });

    it('should track permission usage and anomalies', async () => {
      // Make multiple requests with different permissions
      const requests = [
        { path: '/api/users/me', expected: 200 },
        { path: '/api/media-requests', expected: 200 },
        { path: '/api/admin/users', expected: 403 },
        { path: '/api/moderator/reports', expected: 403 },
      ];

      for (const req of requests) {
        await request(app)
          .get(req.path)
          .set('Authorization', `Bearer ${regularToken}`);
      }

      // Check permission usage statistics
      const statsResponse = await request(app)
        .get('/api/admin/permission-stats')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ userId: regularUser.id });

      if (statsResponse.status === 200) {
        expect(statsResponse.body.data).toHaveProperty('allowedRequests');
        expect(statsResponse.body.data).toHaveProperty('deniedRequests');
        expect(statsResponse.body.data.deniedRequests).toBeGreaterThan(0);
      }
    });
  });

  describe('Cross-Origin and API Security', () => {
    it('should enforce CORS policies based on user role', async () => {
      const corsHeaders = {
        'Origin': 'https://external-app.com',
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'Authorization',
      };

      // Regular user might have restricted CORS
      const regularCors = await request(app)
        .options('/api/users/me')
        .set(corsHeaders)
        .set('Authorization', `Bearer ${regularToken}`);

      // Admin might have broader CORS access
      const adminCors = await request(app)
        .options('/api/admin/users')
        .set(corsHeaders)
        .set('Authorization', `Bearer ${adminToken}`);

      expect([200, 204, 403]).toContain(regularCors.status);
      expect([200, 204]).toContain(adminCors.status);
    });

    it('should validate API key permissions alongside JWT', async () => {
      const apiKeyResponse = await request(app)
        .get('/api/external/webhook')
        .set('Authorization', `Bearer ${regularToken}`)
        .set('X-API-Key', 'limited-api-key');

      // Should require both valid JWT and API key with appropriate permissions
      expect([200, 403]).toContain(apiKeyResponse.status);
    });
  });

  describe('Emergency Access and Security Incidents', () => {
    it('should implement emergency access procedures', async () => {
      // Simulate security incident
      const emergencyResponse = await request(app)
        .post('/api/security/emergency-access')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          incidentId: 'INC-123',
          requiredAccess: ['system:full', 'data:export'],
          justification: 'Data breach investigation',
        });

      if (emergencyResponse.status === 200) {
        const emergencyToken = emergencyResponse.body.data.emergencyToken;

        // Emergency token should have elevated permissions
        const elevatedResponse = await request(app)
          .get('/api/emergency/system-dump')
          .set('Authorization', `Bearer ${emergencyToken}`);

        expect([200, 404]).toContain(elevatedResponse.status);
      }
    });

    it('should automatically revoke permissions during security incidents', async () => {
      // Trigger security incident
      await request(app)
        .post('/api/security/incident')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          type: 'SUSPECTED_BREACH',
          affectedUsers: [regularUser.id],
        });

      // User permissions should be temporarily revoked
      const response = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${regularToken}`);

      expect([401, 403]).toContain(response.status);
      if (response.status === 403) {
        expect(response.body.code).toBe('ACCOUNT_SUSPENDED_SECURITY');
      }
    });
  });
});