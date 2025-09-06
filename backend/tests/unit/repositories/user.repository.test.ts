import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UserRepository } from '../../../src/repositories/user.repository';
import { mockPrismaClient } from '../../../src/__tests__/setup';
import { createTestUser } from '../../../src/config/test-database';

// Mock encryption service
vi.mock('../../../src/services/encryption.service', () => ({
  encryptionService: {
    encryptForStorage: vi.fn((data) => `encrypted_${data}`),
    decryptFromStorage: vi.fn((data) => data.replace('encrypted_', '')),
  },
}));

// Mock bcrypt
vi.mock('bcrypt', () => ({
  default: {
    hash: vi.fn().mockResolvedValue('hashed_password'),
    compare: vi.fn().mockResolvedValue(true),
  },
}));

describe('UserRepository', () => {
  let userRepository: UserRepository;

  beforeEach(() => {
    userRepository = new UserRepository(mockPrismaClient);
    vi.clearAllMocks();
  });

  describe('findById', () => {
    it('should find user by id successfully', async () => {
      // Arrange
      const testUser = createTestUser();
      mockPrismaClient.user.findUnique.mockResolvedValue(testUser);

      // Act
      const result = await userRepository.findById(testUser.id);

      // Assert
      expect(result).toEqual(testUser);
      expect(mockPrismaClient.user.findUnique).toHaveBeenCalledWith({
        where: { id: testUser.id },
      });
    });

    it('should return null when user not found', async () => {
      // Arrange
      mockPrismaClient.user.findUnique.mockResolvedValue(null);

      // Act
      const result = await userRepository.findById('non-existent-id');

      // Assert
      expect(result).toBeNull();
      expect(mockPrismaClient.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'non-existent-id' },
      });
    });
  });

  describe('findByEmail', () => {
    it('should find user by email successfully', async () => {
      // Arrange
      const testUser = createTestUser();
      mockPrismaClient.user.findUnique.mockResolvedValue(testUser);

      // Act
      const result = await userRepository.findByEmail(testUser.email);

      // Assert
      expect(result).toEqual(testUser);
      expect(mockPrismaClient.user.findUnique).toHaveBeenCalledWith({
        where: { email: testUser.email },
      });
    });

    it('should return null when user with email not found', async () => {
      // Arrange
      mockPrismaClient.user.findUnique.mockResolvedValue(null);

      // Act
      const result = await userRepository.findByEmail('nonexistent@example.com');

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('findByPlexId', () => {
    it('should find user by plexId successfully', async () => {
      // Arrange
      const testUser = createTestUser();
      mockPrismaClient.user.findUnique.mockResolvedValue(testUser);

      // Act
      const result = await userRepository.findByPlexId(testUser.plexId);

      // Assert
      expect(result).toEqual(testUser);
      expect(mockPrismaClient.user.findUnique).toHaveBeenCalledWith({
        where: { plexId: testUser.plexId },
      });
    });

    it('should handle null plexId gracefully', async () => {
      // Arrange
      mockPrismaClient.user.findUnique.mockResolvedValue(null);

      // Act
      const result = await userRepository.findByPlexId(null);

      // Assert
      expect(result).toBeNull();
      expect(mockPrismaClient.user.findUnique).toHaveBeenCalledWith({
        where: { plexId: null },
      });
    });
  });

  describe('create', () => {
    it('should create user successfully', async () => {
      // Arrange
      const userData = {
        email: 'test@example.com',
        name: 'Test User',
        plexId: 'test-plex-id',
        plexUsername: 'testuser',
        role: 'USER',
      };

      const expectedUser = createTestUser(userData);
      mockPrismaClient.user.create.mockResolvedValue(expectedUser);

      // Act
      const result = await userRepository.create(userData);

      // Assert
      expect(result).toEqual(expectedUser);
      expect(mockPrismaClient.user.create).toHaveBeenCalledWith({
        data: userData,
      });
    });

    it('should handle creation errors', async () => {
      // Arrange
      const userData = {
        email: 'test@example.com',
        name: 'Test User',
      };

      const error = new Error('Email already exists');
      mockPrismaClient.user.create.mockRejectedValue(error);

      // Act & Assert
      await expect(userRepository.create(userData)).rejects.toThrow();
    });
  });

  describe('update', () => {
    it('should update user successfully', async () => {
      // Arrange
      const userId = 'test-user-id';
      const updateData = {
        name: 'Updated Name',
        lastLoginAt: new Date(),
      };

      const updatedUser = createTestUser({ ...updateData, id: userId });
      
      // Mock the findUnique call for existence check
      mockPrismaClient.user.findUnique.mockResolvedValue({ id: userId });
      mockPrismaClient.user.update.mockResolvedValue(updatedUser);

      // Act
      const result = await userRepository.update(userId, updateData);

      // Assert
      expect(result).toEqual(updatedUser);
      expect(mockPrismaClient.user.findUnique).toHaveBeenCalledWith({
        where: { id: userId },
        select: { id: true },
      });
      expect(mockPrismaClient.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: updateData,
      });
    });

    it('should handle update errors', async () => {
      // Arrange
      const userId = 'non-existent-id';
      const updateData = { name: 'Updated Name' };

      const error = new Error('User not found');
      mockPrismaClient.user.update.mockRejectedValue(error);

      // Act & Assert
      await expect(userRepository.update(userId, updateData)).rejects.toThrow('User not found');
    });
  });

  describe('delete', () => {
    it('should delete user successfully', async () => {
      // Arrange
      const userId = 'test-user-id';
      const deletedUser = createTestUser({ id: userId });
      mockPrismaClient.user.delete.mockResolvedValue(deletedUser);

      // Act
      const result = await userRepository.delete(userId);

      // Assert
      expect(result).toEqual(deletedUser);
      expect(mockPrismaClient.user.delete).toHaveBeenCalledWith({
        where: { id: userId },
      });
    });

    it('should handle deletion of non-existent user', async () => {
      // Arrange
      const userId = 'non-existent-id';
      const error = new Error('User not found');
      mockPrismaClient.user.delete.mockRejectedValue(error);

      // Act & Assert
      await expect(userRepository.delete(userId)).rejects.toThrow('User not found');
    });
  });

  describe('findAll', () => {
    it('should find all users with default pagination', async () => {
      // Arrange
      const users = [
        createTestUser({ id: 'user-1', email: 'user1@example.com' }),
        createTestUser({ id: 'user-2', email: 'user2@example.com' }),
      ];
      
      // Mock the paginate method calls
      mockPrismaClient.user.findMany.mockResolvedValue(users);
      mockPrismaClient.user.count.mockResolvedValue(2);

      // Mock the paginate method to return expected structure
      const paginatedResult = {
        items: users,
        total: 2,
        page: 1,
        limit: 50,
        totalPages: 1,
      };

      // Create a spy for the paginate method
      const paginateSpy = vi.spyOn(userRepository, 'paginate').mockResolvedValue(paginatedResult);

      // Act
      const result = await userRepository.findAll();

      // Assert
      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(paginateSpy).toHaveBeenCalled();
    });

    it('should find users with custom pagination options', async () => {
      // Arrange
      const users = [createTestUser()];
      const paginatedResult = {
        items: users,
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      };

      // Create a spy for the paginate method
      const paginateSpy = vi.spyOn(userRepository, 'paginate').mockResolvedValue(paginatedResult);

      // Act
      const result = await userRepository.findAll({
        page: 1,
        limit: 10,
      });

      // Assert
      expect(result.items).toEqual(users);
      expect(result.total).toBe(1);
      expect(paginateSpy).toHaveBeenCalled();
    });

    it('should handle empty results', async () => {
      // Arrange
      const paginatedResult = {
        items: [],
        total: 0,
        page: 1,
        limit: 50,
        totalPages: 0,
      };

      // Create a spy for the paginate method
      const paginateSpy = vi.spyOn(userRepository, 'paginate').mockResolvedValue(paginatedResult);

      // Act
      const result = await userRepository.findAll();

      // Assert
      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
      expect(paginateSpy).toHaveBeenCalled();
    });
  });

  describe('count', () => {
    it('should count users successfully', async () => {
      // Arrange
      mockPrismaClient.user.count.mockResolvedValue(5);

      // Act
      const result = await userRepository.count();

      // Assert
      expect(result).toBe(5);
      expect(mockPrismaClient.user.count).toHaveBeenCalled();
    });
  });

  describe('countByRole', () => {
    it('should count users by role', async () => {
      // Arrange
      mockPrismaClient.user.count.mockResolvedValue(2);

      // Act
      const result = await userRepository.countByRole('ADMIN');

      // Assert
      expect(result).toBe(2);
      expect(mockPrismaClient.user.count).toHaveBeenCalledWith({
        where: { role: 'ADMIN' },
      });
    });
  });

  describe('updateLastLogin', () => {
    it('should update last login time', async () => {
      // Arrange
      const userId = 'test-user-id';
      const updatedUser = createTestUser({ id: userId });
      
      // Mock the findUnique call for existence check and update
      mockPrismaClient.user.findUnique.mockResolvedValue({ id: userId });
      mockPrismaClient.user.update.mockResolvedValue(updatedUser);

      // Act
      const result = await userRepository.updateLastLogin(userId);

      // Assert
      expect(result).toEqual(updatedUser);
      expect(mockPrismaClient.user.findUnique).toHaveBeenCalledWith({
        where: { id: userId },
        select: { id: true },
      });
    });
  });

  describe('updatePlexToken', () => {
    it('should update plex token for user', async () => {
      // Arrange
      const userId = 'test-user-id';
      const plexToken = 'new-plex-token';
      const updatedUser = createTestUser({ id: userId, plexToken });
      
      // Mock the findUnique call for existence check and update
      mockPrismaClient.user.findUnique.mockResolvedValue({ id: userId });
      mockPrismaClient.user.update.mockResolvedValue(updatedUser);

      // Act
      const result = await userRepository.updatePlexToken(userId, plexToken);

      // Assert
      expect(result).toEqual(updatedUser);
      expect(mockPrismaClient.user.findUnique).toHaveBeenCalledWith({
        where: { id: userId },
        select: { id: true },
      });
    });

    it('should clear plex token when null provided', async () => {
      // Arrange
      const userId = 'test-user-id';
      const updatedUser = createTestUser({ id: userId, plexToken: null });
      
      // Mock the findUnique call for existence check and update
      mockPrismaClient.user.findUnique.mockResolvedValue({ id: userId });
      mockPrismaClient.user.update.mockResolvedValue(updatedUser);

      // Act
      const result = await userRepository.updatePlexToken(userId, null);

      // Assert
      expect(result).toEqual(updatedUser);
    });
  });
});