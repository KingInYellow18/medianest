/**
 * USER SERVICE UNIT TESTS
 * 
 * Comprehensive tests for UserService covering:
 * - User CRUD operations
 * - Authentication workflows
 * - Error handling
 * - Business logic validation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UserService } from '../../../backend/src/services/user.service';
import { UserRepository } from '../../../backend/src/repositories/user.repository';
import { AuthenticationError, ValidationError } from '../../../backend/src/utils/errors';
import { userMockHelpers } from '../../mocks/prisma-mock';
import { createMockUser } from '../../mocks/auth-mock';

// Mock dependencies
vi.mock('../../../backend/src/repositories/user.repository');
vi.mock('../../../backend/src/utils/logger');

describe('UserService', () => {
  let userService: UserService;
  let mockUserRepository: any;

  beforeEach(() => {
    mockUserRepository = {
      findById: vi.fn(),
      findByEmail: vi.fn(),
      findByPlexId: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    };

    userService = new UserService(mockUserRepository);
  });

  describe('findById', () => {
    it('should return user when found', async () => {
      const userId = 'test-user-id';
      const mockUser = createMockUser({ id: userId });
      
      mockUserRepository.findById.mockResolvedValue(mockUser);

      const result = await userService.findById(userId);

      expect(result).toEqual(mockUser);
      expect(mockUserRepository.findById).toHaveBeenCalledWith(userId);
    });

    it('should return null when user not found', async () => {
      mockUserRepository.findById.mockResolvedValue(null);

      const result = await userService.findById('non-existent-id');

      expect(result).toBeNull();
    });

    it('should throw error for invalid user ID format', async () => {
      await expect(userService.findById('')).rejects.toThrow(ValidationError);
    });
  });

  describe('findByEmail', () => {
    it('should return user when found by email', async () => {
      const email = 'test@medianest.com';
      const mockUser = createMockUser({ email });
      
      mockUserRepository.findByEmail.mockResolvedValue(mockUser);

      const result = await userService.findByEmail(email);

      expect(result).toEqual(mockUser);
      expect(mockUserRepository.findByEmail).toHaveBeenCalledWith(email);
    });

    it('should return null when user not found by email', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(null);

      const result = await userService.findByEmail('non-existent@medianest.com');

      expect(result).toBeNull();
    });

    it('should throw error for invalid email format', async () => {
      await expect(userService.findByEmail('invalid-email')).rejects.toThrow(ValidationError);
    });
  });

  describe('create', () => {
    it('should create user successfully', async () => {
      const userData = {
        email: 'new-user@medianest.com',
        name: 'New User',
        plexId: 'new-plex-id',
        plexUsername: 'newuser',
      };
      
      const createdUser = createMockUser({
        id: 'new-user-id',
        ...userData,
      });
      
      mockUserRepository.findByEmail.mockResolvedValue(null);
      mockUserRepository.findByPlexId.mockResolvedValue(null);
      mockUserRepository.create.mockResolvedValue(createdUser);

      const result = await userService.create(userData);

      expect(result).toEqual(createdUser);
      expect(mockUserRepository.create).toHaveBeenCalledWith(userData);
    });

    it('should throw error when email already exists', async () => {
      const userData = {
        email: 'existing@medianest.com',
        name: 'New User',
        plexId: 'new-plex-id',
        plexUsername: 'newuser',
      };
      
      mockUserRepository.findByEmail.mockResolvedValue(createMockUser());

      await expect(userService.create(userData)).rejects.toThrow(ValidationError);
    });

    it('should throw error when plex ID already exists', async () => {
      const userData = {
        email: 'new-user@medianest.com',
        name: 'New User',
        plexId: 'existing-plex-id',
        plexUsername: 'newuser',
      };
      
      mockUserRepository.findByEmail.mockResolvedValue(null);
      mockUserRepository.findByPlexId.mockResolvedValue(createMockUser());

      await expect(userService.create(userData)).rejects.toThrow(ValidationError);
    });

    it('should validate required fields', async () => {
      const invalidUserData = {
        name: 'New User',
        // Missing required fields
      };

      await expect(userService.create(invalidUserData as any)).rejects.toThrow(ValidationError);
    });
  });

  describe('update', () => {
    it('should update user successfully', async () => {
      const userId = 'test-user-id';
      const updates = {
        name: 'Updated Name',
        email: 'updated@medianest.com',
      };
      
      const existingUser = createMockUser({ id: userId });
      const updatedUser = createMockUser({ id: userId, ...updates });
      
      mockUserRepository.findById.mockResolvedValue(existingUser);
      mockUserRepository.findByEmail.mockResolvedValue(null);
      mockUserRepository.update.mockResolvedValue(updatedUser);

      const result = await userService.update(userId, updates);

      expect(result).toEqual(updatedUser);
      expect(mockUserRepository.update).toHaveBeenCalledWith(userId, updates);
    });

    it('should throw error when user not found', async () => {
      mockUserRepository.findById.mockResolvedValue(null);

      await expect(userService.update('non-existent-id', {})).rejects.toThrow(ValidationError);
    });

    it('should throw error when updating to existing email', async () => {
      const userId = 'test-user-id';
      const updates = { email: 'existing@medianest.com' };
      
      mockUserRepository.findById.mockResolvedValue(createMockUser({ id: userId }));
      mockUserRepository.findByEmail.mockResolvedValue(createMockUser({ id: 'different-id' }));

      await expect(userService.update(userId, updates)).rejects.toThrow(ValidationError);
    });

    it('should allow updating to same email', async () => {
      const userId = 'test-user-id';
      const currentEmail = 'current@medianest.com';
      const updates = { email: currentEmail };
      
      const existingUser = createMockUser({ id: userId, email: currentEmail });
      
      mockUserRepository.findById.mockResolvedValue(existingUser);
      mockUserRepository.findByEmail.mockResolvedValue(existingUser);
      mockUserRepository.update.mockResolvedValue(existingUser);

      const result = await userService.update(userId, updates);

      expect(result).toEqual(existingUser);
    });
  });

  describe('delete', () => {
    it('should delete user successfully', async () => {
      const userId = 'test-user-id';
      const existingUser = createMockUser({ id: userId });
      
      mockUserRepository.findById.mockResolvedValue(existingUser);
      mockUserRepository.delete.mockResolvedValue(existingUser);

      const result = await userService.delete(userId);

      expect(result).toEqual(existingUser);
      expect(mockUserRepository.delete).toHaveBeenCalledWith(userId);
    });

    it('should throw error when user not found', async () => {
      mockUserRepository.findById.mockResolvedValue(null);

      await expect(userService.delete('non-existent-id')).rejects.toThrow(ValidationError);
    });
  });

  describe('list', () => {
    it('should return paginated list of users', async () => {
      const users = [
        createMockUser({ id: 'user-1' }),
        createMockUser({ id: 'user-2' }),
      ];
      
      mockUserRepository.findMany.mockResolvedValue(users);
      mockUserRepository.count.mockResolvedValue(2);

      const result = await userService.list({ page: 1, limit: 10 });

      expect(result).toEqual({
        users,
        total: 2,
        page: 1,
        limit: 10,
        totalPages: 1,
      });
    });

    it('should apply filters when provided', async () => {
      const filters = { role: 'USER', status: 'active' };
      const users = [createMockUser()];
      
      mockUserRepository.findMany.mockResolvedValue(users);
      mockUserRepository.count.mockResolvedValue(1);

      await userService.list({ page: 1, limit: 10, filters });

      expect(mockUserRepository.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: filters,
        })
      );
    });

    it('should handle search query', async () => {
      const searchQuery = 'john';
      const users = [createMockUser({ name: 'John Doe' })];
      
      mockUserRepository.findMany.mockResolvedValue(users);
      mockUserRepository.count.mockResolvedValue(1);

      await userService.list({ page: 1, limit: 10, search: searchQuery });

      expect(mockUserRepository.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [
              { name: { contains: searchQuery, mode: 'insensitive' } },
              { email: { contains: searchQuery, mode: 'insensitive' } },
              { plexUsername: { contains: searchQuery, mode: 'insensitive' } },
            ],
          },
        })
      );
    });
  });

  describe('updateLastLogin', () => {
    it('should update user last login timestamp', async () => {
      const userId = 'test-user-id';
      const existingUser = createMockUser({ id: userId });
      const updatedUser = createMockUser({ 
        id: userId, 
        lastLoginAt: new Date(),
      });
      
      mockUserRepository.findById.mockResolvedValue(existingUser);
      mockUserRepository.update.mockResolvedValue(updatedUser);

      const result = await userService.updateLastLogin(userId);

      expect(result).toEqual(updatedUser);
      expect(mockUserRepository.update).toHaveBeenCalledWith(
        userId,
        expect.objectContaining({
          lastLoginAt: expect.any(Date),
        })
      );
    });

    it('should throw error when user not found', async () => {
      mockUserRepository.findById.mockResolvedValue(null);

      await expect(userService.updateLastLogin('non-existent-id')).rejects.toThrow(ValidationError);
    });
  });

  describe('validateUser', () => {
    it('should return true for active user', async () => {
      const userId = 'test-user-id';
      const activeUser = createMockUser({ id: userId, status: 'active' });
      
      mockUserRepository.findById.mockResolvedValue(activeUser);

      const result = await userService.validateUser(userId);

      expect(result).toBe(true);
    });

    it('should return false for inactive user', async () => {
      const userId = 'test-user-id';
      const inactiveUser = createMockUser({ id: userId, status: 'inactive' });
      
      mockUserRepository.findById.mockResolvedValue(inactiveUser);

      const result = await userService.validateUser(userId);

      expect(result).toBe(false);
    });

    it('should return false for non-existent user', async () => {
      mockUserRepository.findById.mockResolvedValue(null);

      const result = await userService.validateUser('non-existent-id');

      expect(result).toBe(false);
    });
  });

  describe('getUserStats', () => {
    it('should return user statistics', async () => {
      const userId = 'test-user-id';
      const stats = {
        mediaRequests: 15,
        pendingRequests: 5,
        approvedRequests: 10,
        joinedDate: new Date('2024-01-01'),
        lastActive: new Date(),
      };

      // Mock the stats query (this would be a custom repository method)
      mockUserRepository.getStats = vi.fn().mockResolvedValue(stats);
      userService = new UserService(mockUserRepository);

      const result = await userService.getUserStats(userId);

      expect(result).toEqual(stats);
      expect(mockUserRepository.getStats).toHaveBeenCalledWith(userId);
    });
  });
});