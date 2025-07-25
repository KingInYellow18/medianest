import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UserRepository } from '../../../dist/repositories/user.repository';
import { mockPrisma } from '../../setup';
import { createTestUser } from '../../setup';

// Mock encryption service
const mockEncryptionService = {
  encryptForStorage: vi.fn(),
  decryptFromStorage: vi.fn()
};

vi.mock('@/services/encryption.service', () => ({
  encryptionService: mockEncryptionService
}));

describe('UserRepository', () => {
  let userRepository: UserRepository;

  beforeEach(() => {
    userRepository = new UserRepository();
    vi.clearAllMocks();

    // Default encryption mocks
    mockEncryptionService.encryptForStorage.mockImplementation((data: string) => `encrypted:${data}`);
    mockEncryptionService.decryptFromStorage.mockImplementation((data: string) => 
      data.startsWith('encrypted:') ? data.slice(10) : data
    );
  });

  describe('findById', () => {
    it('should find user by ID and decrypt sensitive data', async () => {
      // Arrange
      const mockUser = createTestUser({
        plexToken: 'encrypted:test-plex-token'
      });
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      // Act
      const result = await userRepository.findById('test-user-id');

      // Assert
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'test-user-id' }
      });
      expect(result).toEqual(
        expect.objectContaining({
          id: 'test-user-id',
          plexToken: 'test-plex-token' // Should be decrypted
        })
      );
    });

    it('should return null when user is not found', async () => {
      // Arrange
      mockPrisma.user.findUnique.mockResolvedValue(null);

      // Act
      const result = await userRepository.findById('nonexistent-id');

      // Assert
      expect(result).toBeNull();
    });

    it('should handle decryption errors gracefully', async () => {
      // Arrange
      const mockUser = createTestUser({
        plexToken: 'corrupted-encrypted-data'
      });
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockEncryptionService.decryptFromStorage.mockImplementation(() => {
        throw new Error('Decryption failed');
      });

      // Act
      const result = await userRepository.findById('test-user-id');

      // Assert
      expect(result?.plexToken).toBeNull();
    });

    it('should handle database errors', async () => {
      // Arrange
      mockPrisma.user.findUnique.mockRejectedValue(new Error('Database connection failed'));

      // Act & Assert
      await expect(userRepository.findById('test-user-id')).rejects.toThrow('Database connection failed');
    });
  });

  describe('findByEmail', () => {
    it('should find user by email', async () => {
      // Arrange
      const mockUser = createTestUser();
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      // Act
      const result = await userRepository.findByEmail('test@example.com');

      // Assert
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' }
      });
      expect(result?.email).toBe('test@example.com');
    });

    it('should return null for non-existent email', async () => {
      // Arrange
      mockPrisma.user.findUnique.mockResolvedValue(null);

      // Act
      const result = await userRepository.findByEmail('nonexistent@example.com');

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('findByPlexId', () => {
    it('should find user by Plex ID', async () => {
      // Arrange
      const mockUser = createTestUser();
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      // Act
      const result = await userRepository.findByPlexId('test-plex-id');

      // Assert
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { plexId: 'test-plex-id' }
      });
      expect(result?.plexId).toBe('test-plex-id');
    });
  });

  describe('create', () => {
    it('should create new user with encrypted sensitive data', async () => {
      // Arrange
      const userData = {
        email: 'newuser@example.com',
        plexId: 'new-plex-id',
        plexToken: 'plain-plex-token',
        role: 'user'
      };

      const createdUser = createTestUser({
        ...userData,
        id: 'new-user-id',
        plexToken: 'encrypted:plain-plex-token'
      });

      mockPrisma.user.create.mockResolvedValue(createdUser);

      // Act
      const result = await userRepository.create(userData);

      // Assert
      expect(mockEncryptionService.encryptForStorage).toHaveBeenCalledWith('plain-plex-token');
      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          email: 'newuser@example.com',
          plexToken: 'encrypted:plain-plex-token'
        })
      });
      expect(result.plexToken).toBe('plain-plex-token'); // Should be decrypted in response
    });

    it('should create user without plex token', async () => {
      // Arrange
      const userData = {
        email: 'newuser@example.com',
        role: 'user'
      };

      const createdUser = createTestUser({
        ...userData,
        id: 'new-user-id',
        plexToken: null
      });

      mockPrisma.user.create.mockResolvedValue(createdUser);

      // Act
      const result = await userRepository.create(userData);

      // Assert
      expect(mockEncryptionService.encryptForStorage).not.toHaveBeenCalled();
      expect(result.plexToken).toBeNull();
    });

    it('should handle unique constraint violations', async () => {
      // Arrange
      const userData = {
        email: 'existing@example.com',
        plexId: 'existing-plex-id'
      };

      const dbError = new Error('Unique constraint failed');
      (dbError as any).code = 'P2002';
      mockPrisma.user.create.mockRejectedValue(dbError);

      // Act & Assert
      await expect(userRepository.create(userData)).rejects.toThrow('Unique constraint failed');
    });
  });

  describe('update', () => {
    it('should update user data and encrypt sensitive fields', async () => {
      // Arrange
      const updateData = {
        email: 'updated@example.com',
        plexToken: 'new-plex-token'
      };

      const updatedUser = createTestUser({
        ...updateData,
        plexToken: 'encrypted:new-plex-token'
      });

      mockPrisma.user.update.mockResolvedValue(updatedUser);

      // Act
      const result = await userRepository.update('test-user-id', updateData);

      // Assert
      expect(mockEncryptionService.encryptForStorage).toHaveBeenCalledWith('new-plex-token');
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'test-user-id' },
        data: expect.objectContaining({
          email: 'updated@example.com',
          plexToken: 'encrypted:new-plex-token'
        })
      });
      expect(result.plexToken).toBe('new-plex-token');
    });

    it('should handle partial updates', async () => {
      // Arrange
      const updateData = { email: 'newemail@example.com' };
      const updatedUser = createTestUser(updateData);
      mockPrisma.user.update.mockResolvedValue(updatedUser);

      // Act
      const result = await userRepository.update('test-user-id', updateData);

      // Assert
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'test-user-id' },
        data: { email: 'newemail@example.com' }
      });
      expect(result.email).toBe('newemail@example.com');
    });
  });

  describe('delete', () => {
    it('should delete user by ID', async () => {
      // Arrange
      const deletedUser = createTestUser();
      mockPrisma.user.delete.mockResolvedValue(deletedUser);

      // Act
      const result = await userRepository.delete('test-user-id');

      // Assert
      expect(mockPrisma.user.delete).toHaveBeenCalledWith({
        where: { id: 'test-user-id' }
      });
      expect(result).toBeTruthy();
    });

    it('should handle deletion of non-existent user', async () => {
      // Arrange
      const dbError = new Error('Record to delete does not exist');
      (dbError as any).code = 'P2025';
      mockPrisma.user.delete.mockRejectedValue(dbError);

      // Act & Assert
      await expect(userRepository.delete('nonexistent-id')).rejects.toThrow('Record to delete does not exist');
    });
  });

  describe('updateLastLogin', () => {
    it('should update user last login timestamp', async () => {
      // Arrange
      const now = new Date();
      const updatedUser = createTestUser({ lastLoginAt: now });
      mockPrisma.user.update.mockResolvedValue(updatedUser);

      // Act
      const result = await userRepository.updateLastLogin('test-user-id');

      // Assert
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'test-user-id' },
        data: {
          lastLoginAt: expect.any(Date)
        }
      });
      expect(result.lastLoginAt).toBeInstanceOf(Date);
    });
  });

  describe('findActiveUsers', () => {
    it('should find all active users', async () => {
      // Arrange
      const activeUsers = [
        createTestUser({ id: 'user1', status: 'active' }),
        createTestUser({ id: 'user2', status: 'active' })
      ];
      mockPrisma.user.findMany.mockResolvedValue(activeUsers);

      // Act
      const result = await userRepository.findActiveUsers();

      // Assert
      expect(mockPrisma.user.findMany).toHaveBeenCalledWith({
        where: { status: 'active' },
        orderBy: { createdAt: 'desc' }
      });
      expect(result).toHaveLength(2);
      expect(result.every(user => user.status === 'active')).toBe(true);
    });

    it('should return empty array when no active users exist', async () => {
      // Arrange
      mockPrisma.user.findMany.mockResolvedValue([]);

      // Act
      const result = await userRepository.findActiveUsers();

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe('updatePlexToken', () => {
    it('should update user Plex token with encryption', async () => {
      // Arrange
      const newToken = 'new-plex-token';
      const updatedUser = createTestUser({
        plexToken: 'encrypted:new-plex-token'
      });
      mockPrisma.user.update.mockResolvedValue(updatedUser);

      // Act
      const result = await userRepository.updatePlexToken('test-user-id', newToken);

      // Assert
      expect(mockEncryptionService.encryptForStorage).toHaveBeenCalledWith(newToken);
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'test-user-id' },
        data: { plexToken: 'encrypted:new-plex-token' }
      });
      expect(result.plexToken).toBe(newToken);
    });

    it('should handle null token (token removal)', async () => {
      // Arrange
      const updatedUser = createTestUser({ plexToken: null });
      mockPrisma.user.update.mockResolvedValue(updatedUser);

      // Act
      const result = await userRepository.updatePlexToken('test-user-id', null);

      // Assert
      expect(mockEncryptionService.encryptForStorage).not.toHaveBeenCalled();
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'test-user-id' },
        data: { plexToken: null }
      });
      expect(result.plexToken).toBeNull();
    });
  });

  describe('getUserStats', () => {
    it('should return user statistics', async () => {
      // Arrange
      mockPrisma.user.count.mockResolvedValueOnce(10); // total users
      mockPrisma.user.count.mockResolvedValueOnce(8);  // active users
      mockPrisma.user.count.mockResolvedValueOnce(2);  // admin users

      // Act
      const result = await userRepository.getUserStats();

      // Assert
      expect(result).toEqual({
        total: 10,
        active: 8,
        inactive: 2,
        admins: 2
      });
    });

    it('should handle database errors in stats calculation', async () => {
      // Arrange
      mockPrisma.user.count.mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(userRepository.getUserStats()).rejects.toThrow('Database error');
    });
  });

  describe('searchUsers', () => {
    it('should search users by email or username', async () => {
      // Arrange
      const searchResults = [
        createTestUser({ email: 'john@example.com' }),
        createTestUser({ email: 'jane@example.com' })
      ];
      mockPrisma.user.findMany.mockResolvedValue(searchResults);

      // Act
      const result = await userRepository.searchUsers('john', 10, 0);

      // Assert
      expect(mockPrisma.user.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { email: { contains: 'john', mode: 'insensitive' } },
            { username: { contains: 'john', mode: 'insensitive' } }
          ]
        },
        take: 10,
        skip: 0,
        orderBy: { createdAt: 'desc' }
      });
      expect(result).toHaveLength(2);
    });

    it('should handle pagination correctly', async () => {
      // Arrange
      const searchResults = [createTestUser()];
      mockPrisma.user.findMany.mockResolvedValue(searchResults);

      // Act
      await userRepository.searchUsers('test', 5, 10);

      // Assert
      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 5,
          skip: 10
        })
      );
    });
  });
});