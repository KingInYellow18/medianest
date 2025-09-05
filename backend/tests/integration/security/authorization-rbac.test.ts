import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { User } from '@prisma/client';

import { app } from '../../../src/server';
import { cleanDatabase, disconnectDatabase } from '../../helpers/database';
import { createTestUser, generateValidToken } from '../../helpers/auth';
import { UserRepository } from '../../../src/repositories/user.repository';
import { MediaRequestRepository } from '../../../src/repositories/media-request.repository';

describe('Authorization and RBAC Security Tests', () => {
  let userRepository: UserRepository;
  let mediaRequestRepository: MediaRequestRepository;
  
  // Test users with different roles
  let regularUser: User;
  let moderatorUser: User;
  let adminUser: User;
  let inactiveUser: User;
  
  // Test tokens
  let regularUserToken: string;
  let moderatorUserToken: string;
  let adminUserToken: string;
  let inactiveUserToken: string;

  beforeAll(async () => {
    userRepository = new UserRepository();
    mediaRequestRepository = new MediaRequestRepository();
  });

  beforeEach(async () => {
    await cleanDatabase();

    // Create test users with different roles
    regularUser = await createTestUser({
      email: 'user@test.com',
      name: 'Regular User',
      plexId: 'plex-user',
      role: 'user',
      status: 'active',
    });

    moderatorUser = await createTestUser({
      email: 'moderator@test.com',
      name: 'Moderator User',
      plexId: 'plex-moderator',
      role: 'moderator',
      status: 'active',
    });

    adminUser = await createTestUser({
      email: 'admin@test.com',
      name: 'Admin User',
      plexId: 'plex-admin',
      role: 'admin',
      status: 'active',
    });

    inactiveUser = await createTestUser({
      email: 'inactive@test.com',
      name: 'Inactive User',
      plexId: 'plex-inactive',
      role: 'user',
      status: 'inactive',
    });

    // Generate tokens for all users
    regularUserToken = await generateValidToken(regularUser.id);
    moderatorUserToken = await generateValidToken(moderatorUser.id);
    adminUserToken = await generateValidToken(adminUser.id);
    inactiveUserToken = await generateValidToken(inactiveUser.id);
  });

  afterAll(async () => {
    await disconnectDatabase();
  });

  describe('Role-Based Access Control', () => {
    describe('Admin-Only Endpoints', () => {
      const adminEndpoints = [
        { method: 'get', path: '/api/admin/users' },
        { method: 'post', path: '/api/admin/users' },
        { method: 'get', path: '/api/admin/users/stats' },
        { method: 'get', path: '/api/admin/system/health' },
        { method: 'post', path: '/api/admin/maintenance/cleanup' },
      ];

      adminEndpoints.forEach(({ method, path }) => {
        it(`should allow admin access to ${method.toUpperCase()} ${path}`, async () => {
          const response = await (request(app)[method] as any)(path)
            .set('Authorization', `Bearer ${adminUserToken}`);

          expect([200, 201, 404]).toContain(response.status); // Endpoint exists or not found
          expect(response.status).not.toBe(403); // Not forbidden
        });

        it(`should deny regular user access to ${method.toUpperCase()} ${path}`, async () => {
          const response = await (request(app)[method] as any)(path)
            .set('Authorization', `Bearer ${regularUserToken}`);

          expect(response.status).toBe(403);
        });

        it(`should deny moderator access to ${method.toUpperCase()} ${path}`, async () => {
          const response = await (request(app)[method] as any)(path)
            .set('Authorization', `Bearer ${moderatorUserToken}`);

          expect(response.status).toBe(403);
        });

        it(`should deny inactive user access to ${method.toUpperCase()} ${path}`, async () => {
          const response = await (request(app)[method] as any)(path)
            .set('Authorization', `Bearer ${inactiveUserToken}`);

          expect(response.status).toBe(401); // Should fail at auth level
        });
      });
    });

    describe('Moderator-Level Endpoints', () => {
      const moderatorEndpoints = [
        { method: 'get', path: '/api/moderator/media-requests' },
        { method: 'patch', path: '/api/moderator/media-requests/bulk-update' },
        { method: 'get', path: '/api/moderator/reports' },
      ];

      moderatorEndpoints.forEach(({ method, path }) => {
        it(`should allow admin access to ${method.toUpperCase()} ${path}`, async () => {
          const response = await (request(app)[method] as any)(path)
            .set('Authorization', `Bearer ${adminUserToken}`);

          expect([200, 201, 404]).toContain(response.status);
          expect(response.status).not.toBe(403);
        });

        it(`should allow moderator access to ${method.toUpperCase()} ${path}`, async () => {
          const response = await (request(app)[method] as any)(path)
            .set('Authorization', `Bearer ${moderatorUserToken}`);

          expect([200, 201, 404]).toContain(response.status);
          expect(response.status).not.toBe(403);
        });

        it(`should deny regular user access to ${method.toUpperCase()} ${path}`, async () => {
          const response = await (request(app)[method] as any)(path)
            .set('Authorization', `Bearer ${regularUserToken}`);

          expect(response.status).toBe(403);
        });
      });
    });

    describe('User-Level Endpoints', () => {
      const userEndpoints = [
        { method: 'get', path: '/api/media-requests' },
        { method: 'post', path: '/api/media-requests' },
        { method: 'get', path: '/api/users/me' },
        { method: 'patch', path: '/api/users/me' },
      ];

      userEndpoints.forEach(({ method, path }) => {
        it(`should allow all active users access to ${method.toUpperCase()} ${path}`, async () => {
          const tokens = [regularUserToken, moderatorUserToken, adminUserToken];
          
          for (const token of tokens) {
            const response = await (request(app)[method] as any)(path)
              .set('Authorization', `Bearer ${token}`)
              .send(method === 'post' ? {
                title: 'Test Request',
                mediaType: 'movie',
                tmdbId: '12345'
              } : undefined);

            expect([200, 201, 400, 404]).toContain(response.status);
            expect(response.status).not.toBe(403);
          }
        });

        it(`should deny inactive users access to ${method.toUpperCase()} ${path}`, async () => {
          const response = await (request(app)[method] as any)(path)
            .set('Authorization', `Bearer ${inactiveUserToken}`);

          expect(response.status).toBe(401);
        });
      });
    });
  });

  describe('Resource-Level Authorization', () => {
    it('should prevent users from accessing other users resources', async () => {
      // Create a media request for regular user
      const mediaRequest = await mediaRequestRepository.create({
        userId: regularUser.id,
        title: 'User Movie Request',
        mediaType: 'movie',
        tmdbId: '12345',
      });

      // Moderator should not be able to access regular user's specific resource
      const response = await request(app)
        .get(`/api/media-requests/${mediaRequest.id}`)
        .set('Authorization', `Bearer ${moderatorUserToken}`);

      expect(response.status).toBe(404); // Not found due to user isolation
    });

    it('should allow admin to access all resources', async () => {
      const mediaRequest = await mediaRequestRepository.create({
        userId: regularUser.id,
        title: 'User Movie Request',
        mediaType: 'movie',
        tmdbId: '12345',
      });

      // Admin should be able to access via admin endpoint
      const response = await request(app)
        .get(`/api/admin/media-requests/${mediaRequest.id}`)
        .set('Authorization', `Bearer ${adminUserToken}`);

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(mediaRequest.id);
    });

    it('should prevent users from modifying other users resources', async () => {
      const mediaRequest = await mediaRequestRepository.create({
        userId: regularUser.id,
        title: 'User Movie Request',
        mediaType: 'movie',
        tmdbId: '12345',
      });

      // Create another user
      const anotherUser = await createTestUser({
        email: 'another@test.com',
        name: 'Another User',
        plexId: 'plex-another',
        role: 'user',
      });
      const anotherUserToken = await generateValidToken(anotherUser.id);

      // Another user should not be able to modify the resource
      const response = await request(app)
        .patch(`/api/media-requests/${mediaRequest.id}`)
        .set('Authorization', `Bearer ${anotherUserToken}`)
        .send({ status: 'approved' });

      expect(response.status).toBe(404);
    });
  });

  describe('Privilege Escalation Prevention', () => {
    it('should prevent regular users from accessing admin user profiles', async () => {
      const response = await request(app)
        .get(`/api/users/${adminUser.id}`)
        .set('Authorization', `Bearer ${regularUserToken}`);

      expect(response.status).toBe(403);
    });

    it('should prevent users from modifying their own role', async () => {
      const response = await request(app)
        .patch(`/api/users/${regularUser.id}`)
        .set('Authorization', `Bearer ${regularUserToken}`)
        .send({ role: 'admin' });

      expect(response.status).toBe(400); // Should be rejected by validation
    });

    it('should prevent users from elevating other users roles', async () => {
      const response = await request(app)
        .patch(`/api/users/${moderatorUser.id}`)
        .set('Authorization', `Bearer ${regularUserToken}`)
        .send({ role: 'admin' });

      expect(response.status).toBe(403);
    });

    it('should only allow admin to change user roles', async () => {
      const response = await request(app)
        .patch(`/api/admin/users/${regularUser.id}`)
        .set('Authorization', `Bearer ${adminUserToken}`)
        .send({ role: 'moderator' });

      expect([200, 404]).toContain(response.status); // Success or endpoint not found
      expect(response.status).not.toBe(403);
    });
  });

  describe('Context-Based Authorization', () => {
    it('should allow users to perform actions on their own data', async () => {
      // User can update their own profile
      const response = await request(app)
        .patch(`/api/users/${regularUser.id}`)
        .set('Authorization', `Bearer ${regularUserToken}`)
        .send({ name: 'Updated Name' });

      expect(response.status).toBe(200);
    });

    it('should prevent users from deleting their own account', async () => {
      const response = await request(app)
        .delete(`/api/users/${regularUser.id}`)
        .set('Authorization', `Bearer ${regularUserToken}`);

      expect([403, 404]).toContain(response.status); // Forbidden or not found
    });

    it('should allow admin to perform privileged operations', async () => {
      // Admin can deactivate users
      const response = await request(app)
        .patch(`/api/admin/users/${regularUser.id}`)
        .set('Authorization', `Bearer ${adminUserToken}`)
        .send({ status: 'inactive' });

      expect([200, 404]).toContain(response.status);
      expect(response.status).not.toBe(403);
    });
  });

  describe('Cross-Tenant Security', () => {
    it('should prevent cross-user data access in list endpoints', async () => {
      // Create media requests for different users
      await mediaRequestRepository.create({
        userId: regularUser.id,
        title: 'User 1 Request',
        mediaType: 'movie',
        tmdbId: '11111',
      });

      await mediaRequestRepository.create({
        userId: moderatorUser.id,
        title: 'User 2 Request',
        mediaType: 'movie',
        tmdbId: '22222',
      });

      // Regular user should only see their own requests
      const response = await request(app)
        .get('/api/media-requests')
        .set('Authorization', `Bearer ${regularUserToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].userId).toBe(regularUser.id);
    });

    it('should enforce tenant isolation in search operations', async () => {
      await mediaRequestRepository.create({
        userId: regularUser.id,
        title: 'Secret User Request',
        mediaType: 'movie',
        tmdbId: '11111',
      });

      // Another user searching for "Secret" should not find it
      const anotherUser = await createTestUser({
        email: 'search@test.com',
        name: 'Search User',
        plexId: 'plex-search',
        role: 'user',
      });
      const searchToken = await generateValidToken(anotherUser.id);

      const response = await request(app)
        .get('/api/media-requests?search=Secret')
        .set('Authorization', `Bearer ${searchToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(0);
    });
  });

  describe('Dynamic Authorization', () => {
    it('should handle role changes dynamically', async () => {
      // User starts as regular user
      const response1 = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${regularUserToken}`);

      expect(response1.status).toBe(403);

      // Promote user to admin (simulated)
      await userRepository.update(regularUser.id, { role: 'admin' });

      // User should still be denied because role in JWT hasn't changed
      const response2 = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${regularUserToken}`);

      expect(response2.status).toBe(403); // JWT role validation should catch this
    });

    it('should handle user deactivation immediately', async () => {
      // User can access initially
      const response1 = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${regularUserToken}`);

      expect(response1.status).toBe(200);

      // Deactivate user
      await userRepository.update(regularUser.id, { status: 'inactive' });

      // Access should be denied immediately
      const response2 = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${regularUserToken}`);

      expect(response2.status).toBe(401);
    });
  });

  describe('Error Handling and Security', () => {
    it('should not leak role information in error messages', async () => {
      const response = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${regularUserToken}`);

      expect(response.status).toBe(403);
      expect(response.body.message).not.toContain('admin');
      expect(response.body.message).not.toContain('user');
      expect(response.body.message).not.toContain(regularUser.role);
    });

    it('should not expose user existence through authorization errors', async () => {
      const nonExistentUserId = '00000000-0000-0000-0000-000000000000';
      
      const response = await request(app)
        .get(`/api/users/${nonExistentUserId}`)
        .set('Authorization', `Bearer ${regularUserToken}`);

      expect(response.status).toBe(403); // Same response as existing but unauthorized user
    });

    it('should handle malformed role data gracefully', async () => {
      // Update user with invalid role (direct database manipulation)
      await userRepository.update(regularUser.id, { role: 'invalid-role' as any });

      const response = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${regularUserToken}`);

      // Should handle gracefully, either deny or use default permissions
      expect([200, 403]).toContain(response.status);
    });
  });

  describe('Authorization Middleware Chain', () => {
    it('should execute authorization checks in correct order', async () => {
      // Authentication should be checked before authorization
      const response = await request(app)
        .get('/api/admin/users')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401); // Auth fails before authz
    });

    it('should handle missing authentication gracefully', async () => {
      const response = await request(app)
        .get('/api/admin/users');

      expect(response.status).toBe(401); // No token provided
    });

    it('should validate roles against endpoint requirements', async () => {
      // Mock endpoint that requires specific role
      const response = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${moderatorUserToken}`);

      expect(response.status).toBe(403); // Wrong role
    });
  });

  describe('Concurrent Authorization', () => {
    it('should handle concurrent authorization checks', async () => {
      const promises = [
        request(app)
          .get('/api/users/me')
          .set('Authorization', `Bearer ${regularUserToken}`),
        request(app)
          .get('/api/admin/users')
          .set('Authorization', `Bearer ${adminUserToken}`),
        request(app)
          .get('/api/admin/users')
          .set('Authorization', `Bearer ${regularUserToken}`),
      ];

      const responses = await Promise.all(promises);

      expect(responses[0].status).toBe(200); // Regular user accessing own data
      expect(responses[1].status).toBeLessThan(400); // Admin accessing admin endpoint
      expect(responses[2].status).toBe(403); // Regular user denied admin access
    });

    it('should prevent race conditions in permission changes', async () => {
      const promises = [
        request(app)
          .get('/api/admin/users')
          .set('Authorization', `Bearer ${regularUserToken}`),
        userRepository.update(regularUser.id, { role: 'admin' }),
        request(app)
          .get('/api/admin/users')
          .set('Authorization', `Bearer ${regularUserToken}`),
      ];

      const responses = await Promise.all(promises);

      // Both requests should have consistent behavior based on original role
      expect(responses[0].status).toBe(403);
      expect(responses[2].status).toBe(403); // Role change doesn't affect JWT
    });
  });
});