/**
 * USER REPOSITORY UNIT TESTS
 * 
 * Comprehensive tests for UserRepository covering:
 * - CRUD operations
 * - Database queries
 * - Transaction handling
 * - Error scenarios
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UserRepository } from '../../../backend/src/repositories/user.repository';
import { userMockHelpers, mockPrismaInstance } from '../../mocks/prisma-mock';
import { createMockUser } from '../../mocks/auth-mock';

describe('UserRepository', () => {
  let userRepository: UserRepository;

  beforeEach(() => {
    userRepository = new UserRepository(mockPrismaInstance);
  });

  describe('findById', () => {
    it('should find user by ID', async () => {
      const userId = 'test-user-id';
      const mockUser = createMockUser({ id: userId });
      
      userMockHelpers.mockFindUserById(userId, mockUser);

      const result = await userRepository.findById(userId);

      expect(result).toEqual(mockUser);
      expect(mockPrismaInstance.user.findUnique).toHaveBeenCalledWith({
        where: { id: userId },
      });
    });

    it('should return null for non-existent user', async () => {
      userMockHelpers.mockUserNotFound();

      const result = await userRepository.findById('non-existent-id');

      expect(result).toBeNull();
    });
  });

  describe('findByEmail', () => {
    it('should find user by email', async () => {
      const email = 'test@medianest.com';
      const mockUser = createMockUser({ email });
      
      userMockHelpers.mockFindUserByEmail(email, mockUser);

      const result = await userRepository.findByEmail(email);

      expect(result).toEqual(mockUser);
      expect(mockPrismaInstance.user.findFirst).toHaveBeenCalledWith({
        where: { email },
      });
    });

    it('should handle case-insensitive email search', async () => {
      const email = 'TEST@MEDIANEST.COM';
      const mockUser = createMockUser({ email: email.toLowerCase() });
      
      mockPrismaInstance.user.findFirst.mockResolvedValue(mockUser);

      const result = await userRepository.findByEmail(email);

      expect(mockPrismaInstance.user.findFirst).toHaveBeenCalledWith({
        where: { email: email.toLowerCase() },
      });
    });
  });

  describe('findByPlexId', () => {
    it('should find user by Plex ID', async () => {
      const plexId = 'test-plex-id';
      const mockUser = createMockUser({ plexId });
      
      mockPrismaInstance.user.findFirst.mockResolvedValue(mockUser);

      const result = await userRepository.findByPlexId(plexId);

      expect(result).toEqual(mockUser);
      expect(mockPrismaInstance.user.findFirst).toHaveBeenCalledWith({
        where: { plexId },
      });
    });
  });

  describe('create', () => {
    it('should create user successfully', async () => {
      const userData = {
        email: 'new-user@medianest.com',
        name: 'New User',
        plexId: 'new-plex-id',
        plexUsername: 'newuser',
        role: 'USER',
      };
      
      const createdUser = createMockUser({
        id: 'new-user-id',
        ...userData,
      });
      
      userMockHelpers.mockCreateUser(userData);

      const result = await userRepository.create(userData);

      expect(mockPrismaInstance.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          email: userData.email,
          name: userData.name,
          plexId: userData.plexId,
          plexUsername: userData.plexUsername,
          role: userData.role,
          status: 'active', // Default status
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        }),
      });
    });

    it('should set default values', async () => {
      const minimalUserData = {
        email: 'minimal@medianest.com',
        plexId: 'minimal-plex-id',
      };

      userMockHelpers.mockCreateUser(minimalUserData);

      await userRepository.create(minimalUserData);

      expect(mockPrismaInstance.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          role: 'USER',
          status: 'active',
          requiresPasswordChange: false,
        }),
      });
    });
  });

  describe('update', () => {
    it('should update user successfully', async () => {
      const userId = 'test-user-id';
      const updates = {
        name: 'Updated Name',
        email: 'updated@medianest.com',
      };
      
      const updatedUser = createMockUser({ id: userId, ...updates });
      
      userMockHelpers.mockUpdateUser(userId, updates);

      const result = await userRepository.update(userId, updates);

      expect(mockPrismaInstance.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: expect.objectContaining({
          ...updates,
          updatedAt: expect.any(Date),
        }),
      });
    });

    it('should handle partial updates', async () => {
      const userId = 'test-user-id';
      const updates = { lastLoginAt: new Date() };
      
      userMockHelpers.mockUpdateUser(userId, updates);

      await userRepository.update(userId, updates);

      expect(mockPrismaInstance.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: expect.objectContaining(updates),
      });
    });
  });

  describe('delete', () => {
    it('should delete user successfully', async () => {
      const userId = 'test-user-id';
      const deletedUser = createMockUser({ id: userId });
      
      mockPrismaInstance.user.delete.mockResolvedValue(deletedUser);

      const result = await userRepository.delete(userId);

      expect(result).toEqual(deletedUser);
      expect(mockPrismaInstance.user.delete).toHaveBeenCalledWith({
        where: { id: userId },
      });
    });

    it('should handle cascade delete of related records', async () => {
      const userId = 'test-user-id';
      
      // Mock transaction for cascade delete
      mockPrismaInstance.$transaction.mockImplementation(async (operations) => {
        if (typeof operations === 'function') {
          const tx = mockPrismaInstance;
          return await operations(tx);
        }
        return Promise.all(operations);
      });

      const deletedUser = createMockUser({ id: userId });
      mockPrismaInstance.user.delete.mockResolvedValue(deletedUser);

      await userRepository.delete(userId);

      expect(mockPrismaInstance.$transaction).toHaveBeenCalled();
    });
  });

  describe('findMany', () => {
    it('should return paginated users', async () => {
      const users = [
        createMockUser({ id: 'user-1' }),
        createMockUser({ id: 'user-2' }),
      ];
      
      mockPrismaInstance.user.findMany.mockResolvedValue(users);

      const result = await userRepository.findMany({
        skip: 0,
        take: 10,
      });

      expect(result).toEqual(users);
      expect(mockPrismaInstance.user.findMany).toHaveBeenCalledWith({
        skip: 0,
        take: 10,
      });
    });

    it('should apply filters', async () => {
      const filters = { role: 'USER', status: 'active' };
      const users = [createMockUser()];
      
      mockPrismaInstance.user.findMany.mockResolvedValue(users);

      await userRepository.findMany({
        where: filters,
        skip: 0,
        take: 10,
      });

      expect(mockPrismaInstance.user.findMany).toHaveBeenCalledWith({
        where: filters,
        skip: 0,
        take: 10,
      });
    });

    it('should apply sorting', async () => {
      const users = [createMockUser()];
      
      mockPrismaInstance.user.findMany.mockResolvedValue(users);

      await userRepository.findMany({
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 10,
      });

      expect(mockPrismaInstance.user.findMany).toHaveBeenCalledWith({
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 10,
      });
    });

    it('should include related data when requested', async () => {
      const users = [createMockUser()];
      
      mockPrismaInstance.user.findMany.mockResolvedValue(users);

      await userRepository.findMany({
        include: {
          mediaRequests: true,
          sessionTokens: true,
        },
        skip: 0,
        take: 10,
      });

      expect(mockPrismaInstance.user.findMany).toHaveBeenCalledWith({
        include: {
          mediaRequests: true,
          sessionTokens: true,
        },
        skip: 0,
        take: 10,
      });
    });
  });

  describe('count', () => {
    it('should count all users when no filters', async () => {
      mockPrismaInstance.user.count.mockResolvedValue(100);

      const result = await userRepository.count();

      expect(result).toBe(100);
      expect(mockPrismaInstance.user.count).toHaveBeenCalledWith({});
    });

    it('should count users with filters', async () => {
      const filters = { role: 'USER', status: 'active' };
      
      mockPrismaInstance.user.count.mockResolvedValue(85);

      const result = await userRepository.count({ where: filters });

      expect(result).toBe(85);
      expect(mockPrismaInstance.user.count).toHaveBeenCalledWith({
        where: filters,
      });
    });
  });

  describe('findByIds', () => {
    it('should find multiple users by IDs', async () => {
      const userIds = ['user-1', 'user-2', 'user-3'];
      const users = userIds.map(id => createMockUser({ id }));
      
      mockPrismaInstance.user.findMany.mockResolvedValue(users);

      const result = await userRepository.findByIds(userIds);

      expect(result).toEqual(users);
      expect(mockPrismaInstance.user.findMany).toHaveBeenCalledWith({
        where: {
          id: { in: userIds },
        },
      });
    });

    it('should return empty array for empty ID list', async () => {
      mockPrismaInstance.user.findMany.mockResolvedValue([]);

      const result = await userRepository.findByIds([]);

      expect(result).toEqual([]);
    });
  });

  describe('updateLastLogin', () => {
    it('should update last login timestamp', async () => {
      const userId = 'test-user-id';
      const updatedUser = createMockUser({ 
        id: userId, 
        lastLoginAt: new Date(),
      });
      
      mockPrismaInstance.user.update.mockResolvedValue(updatedUser);

      const result = await userRepository.updateLastLogin(userId);

      expect(result).toEqual(updatedUser);
      expect(mockPrismaInstance.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: {
          lastLoginAt: expect.any(Date),
          updatedAt: expect.any(Date),
        },
      });
    });
  });

  describe('searchUsers', () => {
    it('should search users by query string', async () => {
      const query = 'john';
      const users = [createMockUser({ name: 'John Doe' })];
      
      mockPrismaInstance.user.findMany.mockResolvedValue(users);

      const result = await userRepository.searchUsers(query, { skip: 0, take: 10 });

      expect(result).toEqual(users);
      expect(mockPrismaInstance.user.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { email: { contains: query, mode: 'insensitive' } },
            { plexUsername: { contains: query, mode: 'insensitive' } },
          ],
        },
        skip: 0,
        take: 10,
      });
    });

    it('should handle empty search query', async () => {
      const users = [createMockUser()];
      
      mockPrismaInstance.user.findMany.mockResolvedValue(users);

      const result = await userRepository.searchUsers('', { skip: 0, take: 10 });

      expect(mockPrismaInstance.user.findMany).toHaveBeenCalledWith({
        skip: 0,
        take: 10,
      });
    });
  });
});