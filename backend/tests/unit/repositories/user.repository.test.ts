import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { UserRepository } from '@/repositories/user.repository';
import { User } from '@prisma/client';

// Mock dependencies
vi.mock('@/config/database', () => ({
  getDatabase: vi.fn(() => mockDatabase),
}));

vi.mock('@/utils/logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

const mockDatabase = {
  user: {
    create: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
    upsert: vi.fn(),
  },
  $transaction: vi.fn(),
};

describe('UserRepository', () => {
  let repository: UserRepository;
  const mockUser: User = {
    id: 'user-123',
    plexId: 'plex-456',
    plexUsername: 'testuser',
    email: 'test@example.com',
    plexToken: 'encrypted-token',
    role: 'user',
    createdAt: new Date('2023-01-01'),
    updatedAt: new Date('2023-01-01'),
    lastLoginAt: new Date('2023-01-01'),
  };

  beforeEach(() => {
    repository = new UserRepository();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('create', () => {
    it('should create a new user successfully', async () => {
      const userData = {
        plexId: 'plex-456',
        plexUsername: 'testuser',
        email: 'test@example.com',
        plexToken: 'encrypted-token',
        role: 'user' as const,
      };

      mockDatabase.user.create.mockResolvedValue(mockUser);

      const result = await repository.create(userData);

      expect(mockDatabase.user.create).toHaveBeenCalledWith({
        data: userData,
      });
      expect(result).toEqual(mockUser);
    });

    it('should create user with minimal required data', async () => {
      const minimalData = {
        plexId: 'plex-456',
        plexUsername: 'testuser',
        email: 'test@example.com',
        plexToken: 'encrypted-token',
      };

      const expectedUser = { ...mockUser, role: 'user' };
      mockDatabase.user.create.mockResolvedValue(expectedUser);

      const result = await repository.create(minimalData);

      expect(mockDatabase.user.create).toHaveBeenCalledWith({
        data: minimalData,
      });
      expect(result).toEqual(expectedUser);
    });

    it('should handle database errors during creation', async () => {
      const userData = {
        plexId: 'plex-456',
        plexUsername: 'testuser',
        email: 'test@example.com',
        plexToken: 'encrypted-token',
      };

      mockDatabase.user.create.mockRejectedValue(new Error('Unique constraint violation'));

      await expect(repository.create(userData)).rejects.toThrow('Unique constraint violation');
    });

    it('should create admin user', async () => {
      const adminData = {
        plexId: 'plex-admin',
        plexUsername: 'admin',
        email: 'admin@example.com',
        plexToken: 'encrypted-token',
        role: 'admin' as const,
      };

      const adminUser = { ...mockUser, ...adminData };
      mockDatabase.user.create.mockResolvedValue(adminUser);

      const result = await repository.create(adminData);

      expect(result.role).toBe('admin');
    });
  });

  describe('findById', () => {
    it('should find user by ID successfully', async () => {
      mockDatabase.user.findUnique.mockResolvedValue(mockUser);

      const result = await repository.findById('user-123');

      expect(mockDatabase.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-123' },
      });
      expect(result).toEqual(mockUser);
    });

    it('should return null if user not found', async () => {
      mockDatabase.user.findUnique.mockResolvedValue(null);

      const result = await repository.findById('nonexistent');

      expect(result).toBeNull();
    });

    it('should handle database errors', async () => {
      mockDatabase.user.findUnique.mockRejectedValue(new Error('Database error'));

      await expect(repository.findById('user-123')).rejects.toThrow('Database error');
    });
  });

  describe('findByEmail', () => {
    it('should find user by email successfully', async () => {
      mockDatabase.user.findFirst.mockResolvedValue(mockUser);

      const result = await repository.findByEmail('test@example.com');

      expect(mockDatabase.user.findFirst).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
      expect(result).toEqual(mockUser);
    });

    it('should return null if user not found', async () => {
      mockDatabase.user.findFirst.mockResolvedValue(null);

      const result = await repository.findByEmail('notfound@example.com');

      expect(result).toBeNull();
    });

    it('should handle case-insensitive email search', async () => {
      mockDatabase.user.findFirst.mockResolvedValue(mockUser);

      await repository.findByEmail('TEST@EXAMPLE.COM');

      expect(mockDatabase.user.findFirst).toHaveBeenCalledWith({
        where: { email: 'TEST@EXAMPLE.COM' },
      });
    });
  });

  describe('findByPlexId', () => {
    it('should find user by Plex ID successfully', async () => {
      mockDatabase.user.findFirst.mockResolvedValue(mockUser);

      const result = await repository.findByPlexId('plex-456');

      expect(mockDatabase.user.findFirst).toHaveBeenCalledWith({
        where: { plexId: 'plex-456' },
      });
      expect(result).toEqual(mockUser);
    });

    it('should return null if user not found', async () => {
      mockDatabase.user.findFirst.mockResolvedValue(null);

      const result = await repository.findByPlexId('nonexistent-plex-id');

      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    it('should update user successfully', async () => {
      const updateData = {
        email: 'updated@example.com',
        plexUsername: 'updateduser',
        lastLoginAt: new Date(),
      };

      const updatedUser = { ...mockUser, ...updateData };
      mockDatabase.user.update.mockResolvedValue(updatedUser);

      const result = await repository.update('user-123', updateData);

      expect(mockDatabase.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: updateData,
      });
      expect(result).toEqual(updatedUser);
    });

    it('should handle partial updates', async () => {
      const updateData = { lastLoginAt: new Date() };
      const updatedUser = { ...mockUser, ...updateData };
      mockDatabase.user.update.mockResolvedValue(updatedUser);

      const result = await repository.update('user-123', updateData);

      expect(result.lastLoginAt).toEqual(updateData.lastLoginAt);
    });

    it('should handle user not found during update', async () => {
      mockDatabase.user.update.mockRejectedValue(new Error('Record not found'));

      await expect(repository.update('nonexistent', { email: 'test@example.com' }))
        .rejects.toThrow('Record not found');
    });

    it('should update user role', async () => {
      const roleUpdate = { role: 'admin' as const };
      const updatedUser = { ...mockUser, role: 'admin' as const };
      mockDatabase.user.update.mockResolvedValue(updatedUser);

      const result = await repository.update('user-123', roleUpdate);

      expect(result.role).toBe('admin');
    });
  });

  describe('delete', () => {
    it('should delete user successfully', async () => {
      mockDatabase.user.delete.mockResolvedValue(mockUser);

      const result = await repository.delete('user-123');

      expect(mockDatabase.user.delete).toHaveBeenCalledWith({
        where: { id: 'user-123' },
      });
      expect(result).toEqual(mockUser);
    });

    it('should handle user not found during deletion', async () => {
      mockDatabase.user.delete.mockRejectedValue(new Error('Record not found'));

      await expect(repository.delete('nonexistent')).rejects.toThrow('Record not found');
    });
  });

  describe('findAll', () => {
    it('should find all users with default pagination', async () => {
      const users = [mockUser, { ...mockUser, id: 'user-456' }];
      mockDatabase.user.findMany.mockResolvedValue(users);

      const result = await repository.findAll();

      expect(mockDatabase.user.findMany).toHaveBeenCalledWith({
        skip: 0,
        take: 50,
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toEqual(users);
    });

    it('should find users with custom pagination', async () => {
      const options = { limit: 10, offset: 20 };
      mockDatabase.user.findMany.mockResolvedValue([]);

      await repository.findAll(options);

      expect(mockDatabase.user.findMany).toHaveBeenCalledWith({
        skip: 20,
        take: 10,
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should filter users by role', async () => {
      const options = { role: 'admin' as const };
      mockDatabase.user.findMany.mockResolvedValue([]);

      await repository.findAll(options);

      expect(mockDatabase.user.findMany).toHaveBeenCalledWith({
        where: { role: 'admin' },
        skip: 0,
        take: 50,
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should search users by email', async () => {
      const options = { search: 'test@example' };
      mockDatabase.user.findMany.mockResolvedValue([]);

      await repository.findAll(options);

      expect(mockDatabase.user.findMany).toHaveBeenCalledWith({
        where: {
          email: {
            contains: 'test@example',
            mode: 'insensitive',
          },
        },
        skip: 0,
        take: 50,
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should combine multiple filters', async () => {
      const options = {
        role: 'user' as const,
        search: 'test',
        limit: 25,
        offset: 10,
      };
      mockDatabase.user.findMany.mockResolvedValue([]);

      await repository.findAll(options);

      expect(mockDatabase.user.findMany).toHaveBeenCalledWith({
        where: {
          role: 'user',
          email: {
            contains: 'test',
            mode: 'insensitive',
          },
        },
        skip: 10,
        take: 25,
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('count', () => {
    it('should count all users', async () => {
      mockDatabase.user.count.mockResolvedValue(5);

      const result = await repository.count();

      expect(mockDatabase.user.count).toHaveBeenCalledWith({});
      expect(result).toBe(5);
    });

    it('should count users with filters', async () => {
      const filters = { role: 'admin' as const };
      mockDatabase.user.count.mockResolvedValue(2);

      const result = await repository.count(filters);

      expect(mockDatabase.user.count).toHaveBeenCalledWith({
        where: { role: 'admin' },
      });
      expect(result).toBe(2);
    });

    it('should count users with search filter', async () => {
      const filters = { search: 'admin' };
      mockDatabase.user.count.mockResolvedValue(1);

      const result = await repository.count(filters);

      expect(mockDatabase.user.count).toHaveBeenCalledWith({
        where: {
          email: {
            contains: 'admin',
            mode: 'insensitive',
          },
        },
      });
      expect(result).toBe(1);
    });
  });

  describe('isFirstUser', () => {
    it('should return true if no users exist', async () => {
      mockDatabase.user.count.mockResolvedValue(0);

      const result = await repository.isFirstUser();

      expect(mockDatabase.user.count).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should return false if users exist', async () => {
      mockDatabase.user.count.mockResolvedValue(3);

      const result = await repository.isFirstUser();

      expect(result).toBe(false);
    });
  });

  describe('updateLastLogin', () => {
    it('should update last login timestamp', async () => {
      const now = new Date();
      const updatedUser = { ...mockUser, lastLoginAt: now };
      mockDatabase.user.update.mockResolvedValue(updatedUser);

      const result = await repository.updateLastLogin('user-123');

      expect(mockDatabase.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: { lastLoginAt: expect.any(Date) },
      });
      expect(result.lastLoginAt).toBeInstanceOf(Date);
    });

    it('should handle user not found', async () => {
      mockDatabase.user.update.mockRejectedValue(new Error('User not found'));

      await expect(repository.updateLastLogin('nonexistent')).rejects.toThrow('User not found');
    });
  });

  describe('findActiveUsers', () => {
    it('should find users active within specified days', async () => {
      const activeUsers = [mockUser];
      mockDatabase.user.findMany.mockResolvedValue(activeUsers);

      const result = await repository.findActiveUsers(30);

      expect(mockDatabase.user.findMany).toHaveBeenCalledWith({
        where: {
          lastLoginAt: {
            gte: expect.any(Date),
          },
        },
        orderBy: { lastLoginAt: 'desc' },
      });
      expect(result).toEqual(activeUsers);
    });

    it('should use default of 30 days if not specified', async () => {
      mockDatabase.user.findMany.mockResolvedValue([]);

      await repository.findActiveUsers();

      const call = mockDatabase.user.findMany.mock.calls[0][0];
      const cutoffDate = call.where.lastLoginAt.gte;
      const expectedDate = new Date();
      expectedDate.setDate(expectedDate.getDate() - 30);
      
      const timeDiff = Math.abs(cutoffDate.getTime() - expectedDate.getTime());
      expect(timeDiff).toBeLessThan(60000); // Within 1 minute
    });
  });

  describe('findAdmins', () => {
    it('should find all admin users', async () => {
      const adminUsers = [
        { ...mockUser, role: 'admin' as const },
        { ...mockUser, id: 'admin-2', role: 'admin' as const },
      ];
      mockDatabase.user.findMany.mockResolvedValue(adminUsers);

      const result = await repository.findAdmins();

      expect(mockDatabase.user.findMany).toHaveBeenCalledWith({
        where: { role: 'admin' },
        orderBy: { createdAt: 'asc' },
      });
      expect(result).toEqual(adminUsers);
    });
  });

  describe('updateUserRole', () => {
    it('should update user role successfully', async () => {
      const updatedUser = { ...mockUser, role: 'admin' as const };
      mockDatabase.user.update.mockResolvedValue(updatedUser);

      const result = await repository.updateUserRole('user-123', 'admin');

      expect(mockDatabase.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: { role: 'admin' },
      });
      expect(result.role).toBe('admin');
    });

    it('should handle invalid user ID', async () => {
      mockDatabase.user.update.mockRejectedValue(new Error('User not found'));

      await expect(repository.updateUserRole('nonexistent', 'admin'))
        .rejects.toThrow('User not found');
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle database connection errors', async () => {
      mockDatabase.user.findMany.mockRejectedValue(new Error('Connection lost'));

      await expect(repository.findAll()).rejects.toThrow('Connection lost');
    });

    it('should handle malformed data', async () => {
      const malformedData = {
        // Missing required fields
        email: 'test@example.com',
      };

      mockDatabase.user.create.mockRejectedValue(new Error('Missing required fields'));

      await expect(repository.create(malformedData as any)).rejects.toThrow('Missing required fields');
    });

    it('should handle empty result sets', async () => {
      mockDatabase.user.findMany.mockResolvedValue([]);

      const result = await repository.findAll();

      expect(result).toEqual([]);
      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle null values gracefully', async () => {
      mockDatabase.user.findUnique.mockResolvedValue(null);

      const result = await repository.findById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('transaction support', () => {
    it('should support database transactions', async () => {
      const transactionCallback = vi.fn().mockResolvedValue(mockUser);
      mockDatabase.$transaction.mockImplementation(callback => callback(mockDatabase));

      await repository.withTransaction(transactionCallback);

      expect(mockDatabase.$transaction).toHaveBeenCalled();
      expect(transactionCallback).toHaveBeenCalledWith(mockDatabase);
    });

    it('should handle transaction rollback on error', async () => {
      const transactionCallback = vi.fn().mockRejectedValue(new Error('Transaction failed'));
      mockDatabase.$transaction.mockRejectedValue(new Error('Transaction failed'));

      await expect(repository.withTransaction(transactionCallback))
        .rejects.toThrow('Transaction failed');
    });
  });
});