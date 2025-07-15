import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { app } from '@/app';
import { server } from '../mocks/server';
import { http, HttpResponse } from 'msw';

const prisma = new PrismaClient();

describe('API Endpoints: Users (/api/v1/users)', () => {
  let authToken: string;
  let userId: string;
  let adminToken: string;
  let adminId: string;
  let otherUserToken: string;
  let otherUserId: string;

  beforeAll(async () => {
    // Clean test database
    await prisma.user.deleteMany();

    // Create test users
    const user = await prisma.user.create({
      data: {
        plexId: 'users-test-user',
        username: 'testuser',
        email: 'user@example.com',
        role: 'user',
        status: 'active',
        preferences: {
          theme: 'dark',
          notifications: {
            email: true,
            push: false,
          },
        },
      },
    });
    userId = user.id;
    authToken = global.createTestJWT({ userId: user.id, role: user.role });

    const admin = await prisma.user.create({
      data: {
        plexId: 'users-admin-user',
        username: 'adminuser',
        email: 'admin@example.com',
        role: 'admin',
        status: 'active',
        preferences: {
          theme: 'light',
          notifications: {
            email: true,
            push: true,
          },
        },
      },
    });
    adminId = admin.id;
    adminToken = global.createTestJWT({ userId: admin.id, role: admin.role });

    const otherUser = await prisma.user.create({
      data: {
        plexId: 'other-test-user',
        username: 'otheruser',
        email: 'other@example.com',
        role: 'user',
        status: 'active',
      },
    });
    otherUserId = otherUser.id;
    otherUserToken = global.createTestJWT({ userId: otherUser.id, role: otherUser.role });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(() => {
    server.resetHandlers();
  });

  describe('GET /api/v1/users/profile', () => {
    it('should return current user profile', async () => {
      const response = await request(app)
        .get('/api/v1/users/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        id: userId,
        plexId: 'users-test-user',
        username: 'testuser',
        email: 'user@example.com',
        role: 'user',
        status: 'active',
        preferences: {
          theme: 'dark',
          notifications: {
            email: true,
            push: false,
          },
        },
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });

      // Should not include sensitive data
      expect(response.body).not.toHaveProperty('plexToken');
      expect(response.body).not.toHaveProperty('password');
    });

    it('should require authentication', async () => {
      await request(app).get('/api/v1/users/profile').expect(401);
    });

    it('should include user statistics', async () => {
      // Create some user data
      await prisma.mediaRequest.create({
        data: {
          userId,
          mediaType: 'movie',
          mediaId: 'tt1234567',
          title: 'Test Movie',
          status: 'approved',
          overseerrId: 123,
        },
      });

      await prisma.youTubeDownload.create({
        data: {
          userId,
          videoId: 'test123',
          url: 'https://youtube.com/watch?v=test123',
          title: 'Test Video',
          channel: 'Test Channel',
          duration: 300,
          status: 'completed',
          progress: 100,
          quality: 'best',
          format: 'mp4',
        },
      });

      const response = await request(app)
        .get('/api/v1/users/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.statistics).toMatchObject({
        totalRequests: 1,
        approvedRequests: 1,
        totalDownloads: 1,
        completedDownloads: 1,
      });
    });
  });

  describe('PATCH /api/v1/users/profile', () => {
    it('should update user preferences', async () => {
      const response = await request(app)
        .patch('/api/v1/users/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          preferences: {
            theme: 'light',
            notifications: {
              email: false,
              push: true,
            },
            language: 'es',
          },
        })
        .expect(200);

      expect(response.body.preferences).toMatchObject({
        theme: 'light',
        notifications: {
          email: false,
          push: true,
        },
        language: 'es',
      });

      // Verify in database
      const updatedUser = await prisma.user.findUnique({
        where: { id: userId },
      });
      expect(updatedUser?.preferences).toMatchObject({
        theme: 'light',
        notifications: {
          email: false,
          push: true,
        },
        language: 'es',
      });
    });

    it('should update display name', async () => {
      const response = await request(app)
        .patch('/api/v1/users/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          displayName: 'Test User Display',
        })
        .expect(200);

      expect(response.body.displayName).toBe('Test User Display');
    });

    it('should validate input', async () => {
      const invalidRequests = [
        {
          body: { email: 'newemail@test.com' },
          expectedError: 'Cannot update email',
        },
        {
          body: { role: 'admin' },
          expectedError: 'Cannot update role',
        },
        {
          body: { status: 'suspended' },
          expectedError: 'Cannot update status',
        },
        {
          body: { plexId: 'new-plex-id' },
          expectedError: 'Cannot update Plex ID',
        },
        {
          body: { displayName: 'x'.repeat(51) },
          expectedError: 'too long',
        },
      ];

      for (const { body, expectedError } of invalidRequests) {
        const response = await request(app)
          .patch('/api/v1/users/profile')
          .set('Authorization', `Bearer ${authToken}`)
          .send(body)
          .expect(400);

        expect(response.body.error).toContain(expectedError);
      }
    });

    it('should require authentication', async () => {
      await request(app)
        .patch('/api/v1/users/profile')
        .send({ displayName: 'New Name' })
        .expect(401);
    });

    it('should handle partial updates', async () => {
      // Update only theme
      const response = await request(app)
        .patch('/api/v1/users/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          preferences: {
            theme: 'auto',
          },
        })
        .expect(200);

      // Other preferences should remain unchanged
      expect(response.body.preferences).toMatchObject({
        theme: 'auto',
        notifications: expect.any(Object),
      });
    });
  });

  describe('GET /api/v1/users (Admin)', () => {
    it('should list all users for admin', async () => {
      const response = await request(app)
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        users: expect.arrayContaining([
          expect.objectContaining({
            username: 'testuser',
            role: 'user',
          }),
          expect.objectContaining({
            username: 'adminuser',
            role: 'admin',
          }),
          expect.objectContaining({
            username: 'otheruser',
            role: 'user',
          }),
        ]),
        total: 3,
        page: 1,
        limit: 20,
      });

      // Should not include sensitive data
      response.body.users.forEach((user: any) => {
        expect(user).not.toHaveProperty('plexToken');
        expect(user).not.toHaveProperty('password');
      });
    });

    it('should reject non-admin users', async () => {
      const response = await request(app)
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);

      expect(response.body.error).toContain('Admin access required');
    });

    it('should support filtering by status', async () => {
      // Create suspended user
      await prisma.user.create({
        data: {
          plexId: 'suspended-user',
          username: 'suspendeduser',
          email: 'suspended@example.com',
          role: 'user',
          status: 'suspended',
        },
      });

      const response = await request(app)
        .get('/api/v1/users?status=suspended')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.users).toHaveLength(1);
      expect(response.body.users[0]).toMatchObject({
        username: 'suspendeduser',
        status: 'suspended',
      });
    });

    it('should support filtering by role', async () => {
      const response = await request(app)
        .get('/api/v1/users?role=admin')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.users).toHaveLength(1);
      expect(response.body.users[0]).toMatchObject({
        username: 'adminuser',
        role: 'admin',
      });
    });

    it('should support search by username/email', async () => {
      const response = await request(app)
        .get('/api/v1/users?search=other')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.users).toHaveLength(1);
      expect(response.body.users[0]).toMatchObject({
        username: 'otheruser',
      });
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get('/api/v1/users?page=1&limit=2')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        users: expect.any(Array),
        total: expect.any(Number),
        page: 1,
        limit: 2,
      });
      expect(response.body.users.length).toBeLessThanOrEqual(2);
    });

    it('should include user statistics', async () => {
      const response = await request(app)
        .get('/api/v1/users?includeStats=true')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      response.body.users.forEach((user: any) => {
        expect(user.statistics).toMatchObject({
          totalRequests: expect.any(Number),
          totalDownloads: expect.any(Number),
          lastActive: expect.any(String),
        });
      });
    });
  });

  describe('GET /api/v1/users/:userId (Admin)', () => {
    it('should return specific user details', async () => {
      const response = await request(app)
        .get(`/api/v1/users/${userId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        id: userId,
        username: 'testuser',
        email: 'user@example.com',
        role: 'user',
        status: 'active',
      });
    });

    it('should reject non-admin users', async () => {
      await request(app)
        .get(`/api/v1/users/${otherUserId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);
    });

    it('should handle non-existent users', async () => {
      const response = await request(app)
        .get('/api/v1/users/non-existent-id')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);

      expect(response.body.error).toContain('User not found');
    });

    it('should include detailed statistics', async () => {
      const response = await request(app)
        .get(`/api/v1/users/${userId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.statistics).toBeDefined();
      expect(response.body.recentActivity).toBeDefined();
    });
  });

  describe('PATCH /api/v1/users/:userId (Admin)', () => {
    let targetUserId: string;

    beforeEach(async () => {
      // Create a user to modify
      const targetUser = await prisma.user.create({
        data: {
          plexId: `target-user-${Date.now()}`,
          username: 'targetuser',
          email: 'target@example.com',
          role: 'user',
          status: 'active',
        },
      });
      targetUserId = targetUser.id;
    });

    it('should update user status', async () => {
      const response = await request(app)
        .patch(`/api/v1/users/${targetUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: 'suspended',
          reason: 'Terms of service violation',
        })
        .expect(200);

      expect(response.body).toMatchObject({
        status: 'suspended',
      });

      // Verify audit log created
      const logs = await prisma.auditLog.findMany({
        where: {
          targetUserId,
          action: 'user.status.update',
        },
      });
      expect(logs).toHaveLength(1);
      expect(logs[0]).toMatchObject({
        performedById: adminId,
        metadata: expect.objectContaining({
          reason: 'Terms of service violation',
          oldStatus: 'active',
          newStatus: 'suspended',
        }),
      });
    });

    it('should update user role', async () => {
      const response = await request(app)
        .patch(`/api/v1/users/${targetUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          role: 'admin',
          reason: 'Promoted to admin',
        })
        .expect(200);

      expect(response.body.role).toBe('admin');
    });

    it('should prevent self-demotion', async () => {
      const response = await request(app)
        .patch(`/api/v1/users/${adminId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          role: 'user',
        })
        .expect(400);

      expect(response.body.error).toContain('Cannot demote yourself');
    });

    it('should prevent removing last admin', async () => {
      // This would need to check if it's the last admin
      // Implementation depends on business rules
    });

    it('should validate input', async () => {
      const invalidRequests = [
        {
          body: { status: 'invalid-status' },
          expectedError: 'Invalid status',
        },
        {
          body: { role: 'superadmin' },
          expectedError: 'Invalid role',
        },
        {
          body: { email: 'new@email.com' },
          expectedError: 'Cannot update email',
        },
      ];

      for (const { body, expectedError } of invalidRequests) {
        const response = await request(app)
          .patch(`/api/v1/users/${targetUserId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send(body)
          .expect(400);

        expect(response.body.error).toContain(expectedError);
      }
    });

    it('should require admin authentication', async () => {
      await request(app)
        .patch(`/api/v1/users/${targetUserId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'suspended' })
        .expect(403);
    });

    it('should require a reason for status changes', async () => {
      const response = await request(app)
        .patch(`/api/v1/users/${targetUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: 'suspended',
        })
        .expect(400);

      expect(response.body.error).toContain('Reason required');
    });
  });

  describe('DELETE /api/v1/users/:userId (Admin)', () => {
    let deleteUserId: string;

    beforeEach(async () => {
      // Create a user to delete
      const deleteUser = await prisma.user.create({
        data: {
          plexId: `delete-user-${Date.now()}`,
          username: 'deleteuser',
          email: 'delete@example.com',
          role: 'user',
          status: 'active',
        },
      });
      deleteUserId = deleteUser.id;
    });

    it('should soft delete user', async () => {
      const response = await request(app)
        .delete(`/api/v1/users/${deleteUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          reason: 'User requested account deletion',
        })
        .expect(200);

      expect(response.body).toMatchObject({
        message: 'User deleted successfully',
      });

      // User should be soft deleted (status = deleted)
      const deletedUser = await prisma.user.findUnique({
        where: { id: deleteUserId },
      });
      expect(deletedUser?.status).toBe('deleted');
      expect(deletedUser?.deletedAt).toBeTruthy();
    });

    it('should anonymize user data', async () => {
      // Create some user data
      await prisma.mediaRequest.create({
        data: {
          userId: deleteUserId,
          mediaType: 'movie',
          mediaId: 'tt999999',
          title: 'User Movie',
          status: 'pending',
          overseerrId: 999,
        },
      });

      await request(app)
        .delete(`/api/v1/users/${deleteUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          reason: 'GDPR request',
        })
        .expect(200);

      const deletedUser = await prisma.user.findUnique({
        where: { id: deleteUserId },
      });

      // Personal data should be anonymized
      expect(deletedUser?.email).toMatch(/^deleted-.*@deleted.local$/);
      expect(deletedUser?.username).toMatch(/^deleted-user-/);
      expect(deletedUser?.plexId).toMatch(/^deleted-/);
    });

    it('should prevent self-deletion', async () => {
      const response = await request(app)
        .delete(`/api/v1/users/${adminId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          reason: 'Testing self deletion',
        })
        .expect(400);

      expect(response.body.error).toContain('Cannot delete yourself');
    });

    it('should require admin authentication', async () => {
      await request(app)
        .delete(`/api/v1/users/${deleteUserId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ reason: 'Test' })
        .expect(403);
    });

    it('should require a reason', async () => {
      const response = await request(app)
        .delete(`/api/v1/users/${deleteUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);

      expect(response.body.error).toContain('Reason required');
    });

    it('should handle non-existent users', async () => {
      const response = await request(app)
        .delete('/api/v1/users/non-existent-id')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'Test' })
        .expect(404);

      expect(response.body.error).toContain('User not found');
    });
  });

  describe('GET /api/v1/users/export (Admin)', () => {
    it('should export user data as CSV', async () => {
      const response = await request(app)
        .get('/api/v1/users/export?format=csv')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.headers['content-type']).toContain('text/csv');
      expect(response.headers['content-disposition']).toContain('attachment');
      expect(response.headers['content-disposition']).toContain('users-export');

      // Check CSV content
      const lines = response.text.split('\n');
      expect(lines[0]).toContain('Username,Email,Role,Status'); // Header
      expect(lines.length).toBeGreaterThan(1); // Has data
    });

    it('should export user data as JSON', async () => {
      const response = await request(app)
        .get('/api/v1/users/export?format=json')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.headers['content-type']).toContain('application/json');
      expect(response.body).toMatchObject({
        exportDate: expect.any(String),
        totalUsers: expect.any(Number),
        users: expect.any(Array),
      });
    });

    it('should require admin authentication', async () => {
      await request(app)
        .get('/api/v1/users/export')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);
    });

    it('should respect filters', async () => {
      const response = await request(app)
        .get('/api/v1/users/export?format=json&role=admin')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      response.body.users.forEach((user: any) => {
        expect(user.role).toBe('admin');
      });
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits on profile updates', async () => {
      // Make multiple rapid updates
      const requests = [];
      for (let i = 0; i < 11; i++) {
        requests.push(
          request(app)
            .patch('/api/v1/users/profile')
            .set('Authorization', `Bearer ${authToken}`)
            .send({ displayName: `Name ${i}` }),
        );
      }

      const responses = await Promise.all(requests);
      const rateLimited = responses.filter((r) => r.status === 429);

      expect(rateLimited.length).toBeGreaterThan(0);
      expect(rateLimited[0].body).toMatchObject({
        error: expect.stringContaining('rate limit'),
        retryAfter: expect.any(Number),
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      // Mock database error
      const originalFindUnique = prisma.user.findUnique;
      prisma.user.findUnique = vi.fn().mockRejectedValue(new Error('Database connection lost'));

      const response = await request(app)
        .get('/api/v1/users/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(503);

      expect(response.body).toMatchObject({
        error: 'Service temporarily unavailable',
        retryAfter: expect.any(Number),
      });

      // Restore original method
      prisma.user.findUnique = originalFindUnique;
    });
  });
});
