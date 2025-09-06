import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';
import { AdminController } from '../../controllers/admin.controller';
import {
  mockPrismaClient,
  mockRedisClient,
  createTestUser,
  createTestRequest,
  createTestResponse,
  createTestMediaRequest,
} from '../setup';

vi.mock('../../config/database', () => ({
  prisma: mockPrismaClient,
}));

vi.mock('../../config/redis', () => ({
  redis: mockRedisClient,
}));

describe('AdminController', () => {
  let adminController: AdminController;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let adminUser: any;

  beforeEach(() => {
    adminController = new AdminController();
    adminUser = createTestUser({ role: 'admin' });
    mockRequest = createTestRequest({ user: adminUser });
    mockResponse = createTestResponse();
  });

  describe('getUsers', () => {
    it('should return paginated list of users for admin', async () => {
      const testUsers = [
        createTestUser({ id: '1', email: 'user1@example.com' }),
        createTestUser({ id: '2', email: 'user2@example.com' }),
      ];

      mockRequest.query = { page: '1', limit: '10' };
      mockPrismaClient.user.findMany.mockResolvedValueOnce(testUsers);
      mockPrismaClient.user.count.mockResolvedValueOnce(25);

      await adminController.getUsers(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: testUsers,
          pagination: expect.objectContaining({
            page: 1,
            limit: 10,
            total: 25,
            pages: 3,
          }),
        }),
      );

      expect(mockPrismaClient.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
          take: 10,
          select: expect.objectContaining({
            id: true,
            username: true,
            email: true,
            role: true,
            status: true,
            createdAt: true,
            lastLoginAt: true,
            password: false, // Should exclude password
          }),
        }),
      );
    });

    it('should filter users by role', async () => {
      const adminUsers = [createTestUser({ role: 'admin' })];

      mockRequest.query = { role: 'admin' };
      mockPrismaClient.user.findMany.mockResolvedValueOnce(adminUsers);
      mockPrismaClient.user.count.mockResolvedValueOnce(1);

      await adminController.getUsers(mockRequest as Request, mockResponse as Response);

      expect(mockPrismaClient.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            role: 'admin',
          }),
        }),
      );
    });

    it('should filter users by status', async () => {
      const activeUsers = [createTestUser({ status: 'active' })];

      mockRequest.query = { status: 'active' };
      mockPrismaClient.user.findMany.mockResolvedValueOnce(activeUsers);
      mockPrismaClient.user.count.mockResolvedValueOnce(1);

      await adminController.getUsers(mockRequest as Request, mockResponse as Response);

      expect(mockPrismaClient.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'active',
          }),
        }),
      );
    });

    it('should search users by email or username', async () => {
      const searchResults = [createTestUser({ email: 'search@example.com' })];

      mockRequest.query = { search: 'search' };
      mockPrismaClient.user.findMany.mockResolvedValueOnce(searchResults);
      mockPrismaClient.user.count.mockResolvedValueOnce(1);

      await adminController.getUsers(mockRequest as Request, mockResponse as Response);

      expect(mockPrismaClient.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [
              { email: { contains: 'search', mode: 'insensitive' } },
              { username: { contains: 'search', mode: 'insensitive' } },
            ],
          },
        }),
      );
    });

    it('should handle database errors', async () => {
      mockPrismaClient.user.findMany.mockRejectedValueOnce(new Error('Database error'));

      await adminController.getUsers(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining('Failed to fetch users'),
        }),
      );
    });
  });

  describe('updateUser', () => {
    it('should update user status as admin', async () => {
      const userId = 'user-to-update';
      const updateData = { status: 'suspended' };

      mockRequest.params = { id: userId };
      mockRequest.body = updateData;

      const existingUser = createTestUser({ id: userId });
      const updatedUser = { ...existingUser, ...updateData };

      mockPrismaClient.user.findUnique.mockResolvedValueOnce(existingUser);
      mockPrismaClient.user.update.mockResolvedValueOnce(updatedUser);

      await adminController.updateUser(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: updatedUser,
        }),
      );

      expect(mockPrismaClient.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: updateData,
        select: expect.objectContaining({
          password: false, // Should exclude password from response
        }),
      });
    });

    it('should update user role as admin', async () => {
      const userId = 'user-to-promote';
      const updateData = { role: 'moderator' };

      mockRequest.params = { id: userId };
      mockRequest.body = updateData;

      const existingUser = createTestUser({ id: userId, role: 'user' });
      const updatedUser = { ...existingUser, ...updateData };

      mockPrismaClient.user.findUnique.mockResolvedValueOnce(existingUser);
      mockPrismaClient.user.update.mockResolvedValueOnce(updatedUser);

      await adminController.updateUser(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockPrismaClient.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: updateData,
        select: expect.anything(),
      });
    });

    it('should return 404 for non-existent user', async () => {
      mockRequest.params = { id: 'non-existent-user' };
      mockRequest.body = { status: 'suspended' };

      mockPrismaClient.user.findUnique.mockResolvedValueOnce(null);

      await adminController.updateUser(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining('User not found'),
        }),
      );
    });

    it('should prevent admin from demoting themselves', async () => {
      const updateData = { role: 'user' };

      mockRequest.params = { id: adminUser.id }; // Same as authenticated user
      mockRequest.body = updateData;

      const existingUser = createTestUser({ id: adminUser.id, role: 'admin' });
      mockPrismaClient.user.findUnique.mockResolvedValueOnce(existingUser);

      await adminController.updateUser(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining('Cannot modify own role'),
        }),
      );
    });

    it('should validate role values', async () => {
      const userId = 'user-to-update';
      const invalidUpdateData = { role: 'invalid-role' };

      mockRequest.params = { id: userId };
      mockRequest.body = invalidUpdateData;

      await adminController.updateUser(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining('Invalid role'),
        }),
      );
    });

    it('should validate status values', async () => {
      const userId = 'user-to-update';
      const invalidUpdateData = { status: 'invalid-status' };

      mockRequest.params = { id: userId };
      mockRequest.body = invalidUpdateData;

      await adminController.updateUser(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining('Invalid status'),
        }),
      );
    });
  });

  describe('deleteUser', () => {
    it('should delete user as admin', async () => {
      const userId = 'user-to-delete';

      mockRequest.params = { id: userId };

      const existingUser = createTestUser({ id: userId });
      mockPrismaClient.user.findUnique.mockResolvedValueOnce(existingUser);
      mockPrismaClient.$transaction.mockImplementation(async (fn) => {
        return fn(mockPrismaClient);
      });

      mockPrismaClient.mediaRequest.deleteMany.mockResolvedValueOnce({ count: 5 });
      mockPrismaClient.user.delete.mockResolvedValueOnce(existingUser);

      await adminController.deleteUser(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: expect.stringContaining('deleted successfully'),
        }),
      );

      // Verify cascade deletion
      expect(mockPrismaClient.mediaRequest.deleteMany).toHaveBeenCalledWith({
        where: { userId: userId },
      });
      expect(mockPrismaClient.user.delete).toHaveBeenCalledWith({
        where: { id: userId },
      });
    });

    it('should prevent admin from deleting themselves', async () => {
      mockRequest.params = { id: adminUser.id };

      const existingUser = createTestUser({ id: adminUser.id, role: 'admin' });
      mockPrismaClient.user.findUnique.mockResolvedValueOnce(existingUser);

      await adminController.deleteUser(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining('Cannot delete own account'),
        }),
      );
    });

    it('should return 404 for non-existent user', async () => {
      mockRequest.params = { id: 'non-existent-user' };

      mockPrismaClient.user.findUnique.mockResolvedValueOnce(null);

      await adminController.deleteUser(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining('User not found'),
        }),
      );
    });
  });

  describe('getSystemStats', () => {
    it('should return comprehensive system statistics', async () => {
      const mockStats = {
        users: { total: 100, active: 85, suspended: 15 },
        requests: { total: 250, pending: 45, approved: 180, rejected: 25 },
        storage: { used: 1024 * 1024 * 1024, available: 5 * 1024 * 1024 * 1024 },
      };

      // Mock database queries for stats
      mockPrismaClient.user.count
        .mockResolvedValueOnce(100) // total users
        .mockResolvedValueOnce(85) // active users
        .mockResolvedValueOnce(15); // suspended users

      mockPrismaClient.mediaRequest.count
        .mockResolvedValueOnce(250) // total requests
        .mockResolvedValueOnce(45) // pending requests
        .mockResolvedValueOnce(180) // approved requests
        .mockResolvedValueOnce(25); // rejected requests

      await adminController.getSystemStats(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            users: expect.objectContaining({
              total: 100,
              active: 85,
              suspended: 15,
            }),
            requests: expect.objectContaining({
              total: 250,
              pending: 45,
              approved: 180,
              rejected: 25,
            }),
          }),
        }),
      );
    });

    it('should handle database errors in stats collection', async () => {
      mockPrismaClient.user.count.mockRejectedValueOnce(new Error('Database error'));

      await adminController.getSystemStats(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining('Failed to fetch statistics'),
        }),
      );
    });
  });

  describe('getRecentActivity', () => {
    it('should return recent system activity', async () => {
      const recentUsers = [
        createTestUser({
          id: '1',
          createdAt: new Date('2024-01-01T10:00:00Z'),
          lastLoginAt: new Date('2024-01-01T11:00:00Z'),
        }),
      ];

      const recentRequests = [
        createTestMediaRequest({
          id: '1',
          createdAt: new Date('2024-01-01T09:30:00Z'),
          status: 'pending',
        }),
      ];

      mockPrismaClient.user.findMany.mockResolvedValueOnce(recentUsers);
      mockPrismaClient.mediaRequest.findMany.mockResolvedValueOnce(recentRequests);

      await adminController.getRecentActivity(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            recentUsers: recentUsers,
            recentRequests: recentRequests,
          }),
        }),
      );

      // Verify queries for recent activity
      expect(mockPrismaClient.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
          orderBy: { createdAt: 'desc' },
        }),
      );

      expect(mockPrismaClient.mediaRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
          orderBy: { createdAt: 'desc' },
        }),
      );
    });
  });

  describe('bulkUpdateUsers', () => {
    it('should update multiple users in bulk', async () => {
      const userIds = ['user1', 'user2', 'user3'];
      const updateData = { status: 'suspended' };

      mockRequest.body = {
        userIds: userIds,
        updates: updateData,
      };

      mockPrismaClient.user.updateMany.mockResolvedValueOnce({ count: 3 });

      await adminController.bulkUpdateUsers(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: expect.stringContaining('3 users updated'),
        }),
      );

      expect(mockPrismaClient.user.updateMany).toHaveBeenCalledWith({
        where: { id: { in: userIds } },
        data: updateData,
      });
    });

    it('should validate bulk update data', async () => {
      mockRequest.body = {
        userIds: [], // empty array
        updates: { status: 'suspended' },
      };

      await adminController.bulkUpdateUsers(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining('No users specified'),
        }),
      );
    });

    it('should prevent bulk update on admin account', async () => {
      const userIds = [adminUser.id, 'user2'];
      const updateData = { role: 'user' };

      mockRequest.body = {
        userIds: userIds,
        updates: updateData,
      };

      await adminController.bulkUpdateUsers(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining('Cannot modify own account'),
        }),
      );
    });
  });
});
