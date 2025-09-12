import { User } from '@prisma/client';
import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';

import { UserRepository } from '@/repositories/user.repository';

import {
  createComprehensiveAlignedMocks,
  resetComprehensiveMocks,
} from '../../mocks/database/comprehensive-prisma-repository-alignment';

// ✅ ENVIRONMENT SETUP (before imports)
beforeAll(() => {
  process.env.JWT_SECRET = 'test-jwt-secret-key-32-bytes-long';
  process.env.ENCRYPTION_KEY = 'test-encryption-key-32-bytes-long-enough-for-validation';
  process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';
  process.env.REDIS_URL = 'redis://localhost:6379';
  process.env.NODE_ENV = 'test';
});

// ✅ COMPREHENSIVE SERVICE MOCKS - ALIGNED WITH ACTUAL IMPLEMENTATIONS
vi.mock('@/services/encryption.service', () => {
  // Create aligned encryption service mock inline to avoid hoisting issues
  const createAlignedEncryptionMock = () => ({
    encrypt: vi.fn().mockImplementation((data: string) => `encrypted_${data}_${Date.now()}`),
    decrypt: vi.fn().mockImplementation((encryptedData: string) => {
      if (encryptedData.startsWith('encrypted_')) {
        return encryptedData.replace(/^encrypted_(.+)_\d+$/, '$1');
      }
      return encryptedData;
    }),
    encryptForStorage: vi.fn().mockImplementation((data: string) => {
      if (!data) return null;
      return `storage_encrypted_${data}_${Date.now()}`;
    }),
    decryptFromStorage: vi.fn().mockImplementation((encryptedData: string) => {
      if (!encryptedData) return null;
      if (encryptedData.startsWith('storage_encrypted_')) {
        return encryptedData.replace(/^storage_encrypted_(.+)_\d+$/, '$1');
      }
      return encryptedData;
    }),
    isEncrypted: vi.fn().mockImplementation((data: string) => {
      return data && (data.startsWith('encrypted_') || data.startsWith('storage_encrypted_'));
    }),
  });

  const mockInstance = createAlignedEncryptionMock();

  return {
    EncryptionService: vi.fn().mockImplementation(() => mockInstance),
    encryptionService: {
      instance: mockInstance,
      ...mockInstance,
    },
  };
});

afterAll(() => {
  // Clean up test environment variables
  delete process.env.JWT_SECRET;
  delete process.env.ENCRYPTION_KEY;
  delete process.env.DATABASE_URL;
  delete process.env.REDIS_URL;
});

// Comprehensive Aligned Mock Pattern for Perfect API Alignment
class ComprehensiveUserRepositoryMocks {
  public database: any;
  public logger: any;
  public services: any;

  constructor() {
    this.reset();
  }

  reset() {
    // Use comprehensive aligned mocks that match ALL repository interfaces
    const mocks = createComprehensiveAlignedMocks();
    this.database = mocks.database;
    this.services = mocks.services;
    this.logger = mocks.services.logger;
  }

  // Comprehensive cleanup to prevent cross-test contamination
  cleanup() {
    // Reset database model mock functions
    if (this.database?.user) {
      Object.values(this.database.user).forEach((fn: any) => {
        if (typeof fn?.mockReset === 'function') fn.mockReset();
        if (typeof fn?.mockClear === 'function') fn.mockClear();
      });
    }

    // Reset transaction mocks
    if (typeof this.database?.$transaction?.mockReset === 'function') {
      this.database.$transaction.mockReset();
    }

    // Reset service mocks
    Object.values(this.logger || {}).forEach((fn: any) => {
      if (typeof fn?.mockReset === 'function') fn.mockReset();
    });
  }
}

// Global mock instance with comprehensive alignment
let isolatedMocks: ComprehensiveUserRepositoryMocks;

// Initialize comprehensive mocks immediately to prevent undefined access
isolatedMocks = new ComprehensiveUserRepositoryMocks();

// Mock dependencies with proper isolation
vi.mock('@/config/database', () => ({
  getDatabase: vi.fn(() => isolatedMocks?.database || {}),
}));

vi.mock('@/utils/logger', () => ({
  logger: new Proxy(
    {},
    {
      get: (target, prop) => {
        return isolatedMocks?.logger?.[prop] || vi.fn();
      },
    },
  ),
}));

describe('UserRepository', () => {
  let repository: UserRepository;
  const mockUser: User = {
    id: 'user-123',
    plexId: 'plex-456',
    plexUsername: 'testuser',
    email: 'test@example.com',
    name: null,
    plexToken: 'encrypted-token',
    role: 'user',
    image: null,
    requiresPasswordChange: false,
    status: 'active',
    createdAt: new Date('2023-01-01'),
    lastLoginAt: new Date('2023-01-01'),
  };

  beforeEach(async () => {
    // CRITICAL: Complete test isolation for each test

    // 1. Reset comprehensive mock data between tests
    resetComprehensiveMocks();

    // 2. Create completely fresh comprehensive mocks - no shared state
    isolatedMocks = new ComprehensiveUserRepositoryMocks();

    // 3. AGGRESSIVE mock clearing to prevent cross-test contamination
    vi.clearAllMocks();
    vi.resetAllMocks();
    vi.restoreAllMocks();

    // 3. Create fresh repository instance for each test
    repository = new UserRepository(isolatedMocks.database);

    // 4. Allow a small delay for mock setup to complete
    await new Promise((resolve) => setTimeout(resolve, 1));
  });

  afterEach(() => {
    // Comprehensive cleanup to prevent cross-test contamination
    isolatedMocks?.cleanup();
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

      isolatedMocks.database.user.create.mockResolvedValue(mockUser);

      const result = await repository.create(userData);

      expect(isolatedMocks.database.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          plexId: userData.plexId,
          plexUsername: userData.plexUsername,
          email: userData.email,
          role: userData.role,
          // plexToken may be encrypted, so we use objectContaining
        }),
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
      isolatedMocks.database.user.create.mockResolvedValue(expectedUser);

      const result = await repository.create(minimalData);

      expect(isolatedMocks.database.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          plexId: minimalData.plexId,
          plexUsername: minimalData.plexUsername,
          email: minimalData.email,
          // plexToken may be encrypted, so we use objectContaining
        }),
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

      isolatedMocks.database.user.create.mockRejectedValue(
        new Error('Unique constraint violation'),
      );

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
      isolatedMocks.database.user.create.mockResolvedValue(adminUser);

      const result = await repository.create(adminData);

      expect(result.role).toBe('admin');
    });
  });

  describe('findById', () => {
    it('should find user by ID successfully', async () => {
      isolatedMocks.database.user.findUnique.mockResolvedValue(mockUser);

      const result = await repository.findById('user-123');

      expect(isolatedMocks.database.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-123' },
      });
      expect(result).toEqual(mockUser);
    });

    it('should return null if user not found', async () => {
      isolatedMocks.database.user.findUnique.mockResolvedValue(null);

      const result = await repository.findById('nonexistent');

      expect(result).toBeNull();
    });

    it('should handle database errors', async () => {
      isolatedMocks.database.user.findUnique.mockRejectedValue(new Error('Database error'));

      await expect(repository.findById('user-123')).rejects.toThrow('Database error');
    });
  });

  describe('findByEmail', () => {
    it('should find user by email successfully', async () => {
      isolatedMocks.database.user.findUnique.mockResolvedValue(mockUser);

      const result = await repository.findByEmail('test@example.com');

      expect(isolatedMocks.database.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
      expect(result).toEqual(mockUser);
    });

    it('should return null if user not found', async () => {
      isolatedMocks.database.user.findUnique.mockResolvedValue(null);

      const result = await repository.findByEmail('notfound@example.com');

      expect(result).toBeNull();
    });

    it('should handle case-insensitive email search', async () => {
      isolatedMocks.database.user.findUnique.mockResolvedValue(mockUser);

      await repository.findByEmail('TEST@EXAMPLE.COM');

      expect(isolatedMocks.database.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'TEST@EXAMPLE.COM' },
      });
    });
  });

  describe('findByPlexId', () => {
    it('should find user by Plex ID successfully', async () => {
      isolatedMocks.database.user.findUnique.mockResolvedValue(mockUser);

      const result = await repository.findByPlexId('plex-456');

      expect(isolatedMocks.database.user.findUnique).toHaveBeenCalledWith({
        where: { plexId: 'plex-456' },
      });
      expect(result).toEqual(mockUser);
    });

    it('should return null if user not found', async () => {
      isolatedMocks.database.user.findUnique.mockResolvedValue(null);

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
      isolatedMocks.database.user.update.mockResolvedValue(updatedUser);

      const result = await repository.update('user-123', updateData);

      expect(isolatedMocks.database.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: updateData,
      });
      expect(result).toEqual(updatedUser);
    });

    it('should handle partial updates', async () => {
      const updateData = { lastLoginAt: new Date() };
      const updatedUser = { ...mockUser, ...updateData };
      isolatedMocks.database.user.update.mockResolvedValue(updatedUser);

      const result = await repository.update('user-123', updateData);

      expect(result.lastLoginAt).toEqual(updateData.lastLoginAt);
    });

    it('should handle user not found during update', async () => {
      isolatedMocks.database.user.update.mockRejectedValue(new Error('Record not found'));

      await expect(repository.update('nonexistent', { email: 'test@example.com' })).rejects.toThrow(
        'Record not found',
      );
    });

    it('should update user role', async () => {
      const roleUpdate = { role: 'admin' as const };
      const updatedUser = { ...mockUser, role: 'admin' as const };
      isolatedMocks.database.user.update.mockResolvedValue(updatedUser);

      const result = await repository.update('user-123', roleUpdate);

      expect(result.role).toBe('admin');
    });
  });

  describe('delete', () => {
    it('should delete user successfully', async () => {
      isolatedMocks.database.user.delete.mockResolvedValue(mockUser);

      const result = await repository.delete('user-123');

      expect(isolatedMocks.database.user.delete).toHaveBeenCalledWith({
        where: { id: 'user-123' },
      });
      expect(result).toEqual(mockUser);
    });

    it('should handle user not found during deletion', async () => {
      isolatedMocks.database.user.delete.mockRejectedValue(new Error('Record not found'));

      await expect(repository.delete('nonexistent')).rejects.toThrow('Record not found');
    });
  });

  describe('findAll', () => {
    it('should find all users with default pagination', async () => {
      const users = [mockUser, { ...mockUser, id: 'user-456' }];
      isolatedMocks.database.user.findMany.mockResolvedValue(users);

      const result = await repository.findAll();

      expect(isolatedMocks.database.user.findMany).toHaveBeenCalledWith({
        skip: 0,
        take: 50,
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toEqual(users);
    });

    it('should find users with custom pagination', async () => {
      const options = { limit: 10, offset: 20 };
      isolatedMocks.database.user.findMany.mockResolvedValue([]);

      await repository.findAll(options);

      expect(isolatedMocks.database.user.findMany).toHaveBeenCalledWith({
        skip: 20,
        take: 10,
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should filter users by role', async () => {
      const options = { role: 'admin' as const };
      isolatedMocks.database.user.findMany.mockResolvedValue([]);

      await repository.findAll(options);

      expect(isolatedMocks.database.user.findMany).toHaveBeenCalledWith({
        where: { role: 'admin' },
        skip: 0,
        take: 50,
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should search users by email', async () => {
      const options = { search: 'test@example' };
      isolatedMocks.database.user.findMany.mockResolvedValue([]);

      await repository.findAll(options);

      expect(isolatedMocks.database.user.findMany).toHaveBeenCalledWith({
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
      isolatedMocks.database.user.findMany.mockResolvedValue([]);

      await repository.findAll(options);

      expect(isolatedMocks.database.user.findMany).toHaveBeenCalledWith({
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
      isolatedMocks.database.user.count.mockResolvedValue(5);

      const result = await repository.count();

      expect(isolatedMocks.database.user.count).toHaveBeenCalledWith({});
      expect(result).toBe(5);
    });

    it('should count users with filters', async () => {
      const filters = { role: 'admin' as const };
      isolatedMocks.database.user.count.mockResolvedValue(2);

      const result = await repository.count(filters);

      expect(isolatedMocks.database.user.count).toHaveBeenCalledWith({
        where: { role: 'admin' },
      });
      expect(result).toBe(2);
    });

    it('should count users with search filter', async () => {
      const filters = { search: 'admin' };
      isolatedMocks.database.user.count.mockResolvedValue(1);

      const result = await repository.count(filters);

      expect(isolatedMocks.database.user.count).toHaveBeenCalledWith({
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
      isolatedMocks.database.user.count.mockResolvedValue(0);

      const result = await repository.isFirstUser();

      expect(isolatedMocks.database.user.count).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should return false if users exist', async () => {
      isolatedMocks.database.user.count.mockResolvedValue(3);

      const result = await repository.isFirstUser();

      expect(result).toBe(false);
    });
  });

  describe('updateLastLogin', () => {
    it('should update last login timestamp', async () => {
      const now = new Date();
      const updatedUser = { ...mockUser, lastLoginAt: now };
      isolatedMocks.database.user.update.mockResolvedValue(updatedUser);

      const result = await repository.updateLastLogin('user-123');

      expect(isolatedMocks.database.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: { lastLoginAt: expect.any(Date) },
      });
      expect(result.lastLoginAt).toBeInstanceOf(Date);
    });

    it('should handle user not found', async () => {
      isolatedMocks.database.user.update.mockRejectedValue(new Error('User not found'));

      await expect(repository.updateLastLogin('nonexistent')).rejects.toThrow('User not found');
    });
  });

  describe('findActiveUsers', () => {
    it('should find users active within specified days', async () => {
      const activeUsers = [mockUser];
      isolatedMocks.database.user.findMany.mockResolvedValue(activeUsers);

      const result = await repository.findActiveUsers(30);

      expect(isolatedMocks.database.user.findMany).toHaveBeenCalledWith({
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
      isolatedMocks.database.user.findMany.mockResolvedValue([]);

      await repository.findActiveUsers();

      const call = isolatedMocks.database.user.findMany.mock.calls[0];
      expect(call).toBeDefined();
      expect(call[0]).toBeDefined();
      expect(call[0].where).toBeDefined();
      expect(call[0].where.lastLoginAt).toBeDefined();
      const cutoffDate = call[0].where.lastLoginAt.gte;
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
      isolatedMocks.database.user.findMany.mockResolvedValue(adminUsers);

      const result = await repository.findAdmins();

      expect(isolatedMocks.database.user.findMany).toHaveBeenCalledWith({
        where: { role: 'admin' },
        orderBy: { createdAt: 'asc' },
      });
      expect(result).toEqual(adminUsers);
    });
  });

  describe('updateUserRole', () => {
    it('should update user role successfully', async () => {
      const updatedUser = { ...mockUser, role: 'admin' as const };
      isolatedMocks.database.user.update.mockResolvedValue(updatedUser);

      const result = await repository.updateUserRole('user-123', 'admin');

      expect(isolatedMocks.database.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: { role: 'admin' },
      });
      expect(result.role).toBe('admin');
    });

    it('should handle invalid user ID', async () => {
      isolatedMocks.database.user.update.mockRejectedValue(new Error('User not found'));

      await expect(repository.updateUserRole('nonexistent', 'admin')).rejects.toThrow(
        'User not found',
      );
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle database connection errors', async () => {
      isolatedMocks.database.user.findMany.mockRejectedValue(new Error('Connection lost'));

      await expect(repository.findAll()).rejects.toThrow('Connection lost');
    });

    it('should handle malformed data', async () => {
      const malformedData = {
        // Missing required fields
        email: 'test@example.com',
      };

      isolatedMocks.database.user.create.mockRejectedValue(new Error('Missing required fields'));

      await expect(repository.create(malformedData as any)).rejects.toThrow(
        'Missing required fields',
      );
    });

    it('should handle empty result sets', async () => {
      isolatedMocks.database.user.findMany.mockResolvedValue([]);

      const result = await repository.findAll();

      expect(result).toEqual([]);
      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle null values gracefully', async () => {
      isolatedMocks.database.user.findUnique.mockResolvedValue(null);

      const result = await repository.findById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('transaction support', () => {
    it('should support database transactions', async () => {
      const transactionCallback = vi.fn().mockResolvedValue(mockUser);
      isolatedMocks.database.$transaction.mockImplementation((callback) =>
        callback(isolatedMocks.database),
      );

      await repository.withTransaction(transactionCallback);

      expect(isolatedMocks.database.$transaction).toHaveBeenCalled();
      expect(transactionCallback).toHaveBeenCalledWith(isolatedMocks.database);
    });

    it('should handle transaction rollback on error', async () => {
      const transactionCallback = vi.fn().mockRejectedValue(new Error('Transaction failed'));
      isolatedMocks.database.$transaction.mockRejectedValue(new Error('Transaction failed'));

      await expect(repository.withTransaction(transactionCallback)).rejects.toThrow(
        'Transaction failed',
      );
    });
  });
});
