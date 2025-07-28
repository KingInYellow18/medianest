import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { UserRepository } from '../../../src/repositories/user.repository';
import { encryptionService } from '../../../src/services/encryption.service';
import { NotFoundError } from '@medianest/shared';
import bcrypt from 'bcrypt';

// Mock dependencies
vi.mock('../../../src/services/encryption.service');
vi.mock('../../../src/utils/logger');
vi.mock('bcrypt');

// Mock Prisma client
const mockPrisma = {
  user: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
};

describe('UserRepository', () => {
  let userRepository: UserRepository;
  let mockEncryption: any;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Setup encryption service mock
    mockEncryption = {
      decryptFromStorage: vi.fn(),
      encryptForStorage: vi.fn(),
    };
    vi.mocked(encryptionService).decryptFromStorage = mockEncryption.decryptFromStorage;
    vi.mocked(encryptionService).encryptForStorage = mockEncryption.encryptForStorage;

    userRepository = new UserRepository();
    // Inject mock prisma
    (userRepository as any).prisma = mockPrisma;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('decryptUserData', () => {
    it('should decrypt Plex token if present', () => {
      const user = {
        id: 'user-123',
        email: 'test@example.com',
        plexToken: 'encrypted-token',
      };
      const decryptedToken = 'decrypted-token';

      mockEncryption.decryptFromStorage.mockReturnValue(decryptedToken);

      const result = (userRepository as any).decryptUserData(user);

      expect(mockEncryption.decryptFromStorage).toHaveBeenCalledWith('encrypted-token');
      expect(result.plexToken).toBe(decryptedToken);
    });

    it('should handle null Plex token', () => {
      const user = {
        id: 'user-123',
        email: 'test@example.com',
        plexToken: null,
      };

      const result = (userRepository as any).decryptUserData(user);

      expect(mockEncryption.decryptFromStorage).not.toHaveBeenCalled();
      expect(result.plexToken).toBeNull();
    });

    it('should handle decryption error gracefully', () => {
      const user = {
        id: 'user-123',
        email: 'test@example.com',
        plexToken: 'invalid-encrypted-token',
      };

      mockEncryption.decryptFromStorage.mockImplementation(() => {
        throw new Error('Decryption failed');
      });

      const result = (userRepository as any).decryptUserData(user);

      expect(result.plexToken).toBeNull();
    });

    it('should handle general error gracefully', () => {
      const user = {
        id: 'user-123',
        email: 'test@example.com',
        plexToken: 'encrypted-token',
      };

      mockEncryption.decryptFromStorage.mockImplementation(() => {
        throw new Error('General error');
      });

      const result = (userRepository as any).decryptUserData(user);

      expect(result).toEqual(user); // Should return original user on error
    });
  });

  describe('findById', () => {
    it('should find user by ID and decrypt data', async () => {
      const userId = 'user-123';
      const user = {
        id: userId,
        email: 'test@example.com',
        plexToken: 'encrypted-token',
      };
      const decryptedToken = 'decrypted-token';

      mockPrisma.user.findUnique.mockResolvedValue(user);
      mockEncryption.decryptFromStorage.mockReturnValue(decryptedToken);

      const result = await userRepository.findById(userId);

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: userId },
      });
      expect(result?.plexToken).toBe(decryptedToken);
    });

    it('should return null if user not found', async () => {
      const userId = 'user-123';
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const result = await userRepository.findById(userId);

      expect(result).toBeNull();
    });

    it('should handle database error', async () => {
      const userId = 'user-123';
      const error = new Error('Database error');
      mockPrisma.user.findUnique.mockRejectedValue(error);

      // Mock the handleDatabaseError method to throw
      const handleDatabaseErrorSpy = vi.spyOn(userRepository as any, 'handleDatabaseError');
      handleDatabaseErrorSpy.mockImplementation(() => {
        throw error;
      });

      await expect(userRepository.findById(userId)).rejects.toThrow('Database error');
    });
  });

  describe('findByEmail', () => {
    it('should find user by email and decrypt data', async () => {
      const email = 'test@example.com';
      const user = {
        id: 'user-123',
        email,
        plexToken: 'encrypted-token',
      };

      mockPrisma.user.findUnique.mockResolvedValue(user);
      mockEncryption.decryptFromStorage.mockReturnValue('decrypted-token');

      const result = await userRepository.findByEmail(email);

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email },
      });
      expect(result?.email).toBe(email);
    });

    it('should return null if user not found', async () => {
      const email = 'test@example.com';
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const result = await userRepository.findByEmail(email);

      expect(result).toBeNull();
    });
  });

  describe('findByPlexId', () => {
    it('should find user by Plex ID and decrypt data', async () => {
      const plexId = 'plex-123';
      const user = {
        id: 'user-123',
        plexId,
        plexToken: 'encrypted-token',
      };

      mockPrisma.user.findUnique.mockResolvedValue(user);
      mockEncryption.decryptFromStorage.mockReturnValue('decrypted-token');

      const result = await userRepository.findByPlexId(plexId);

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { plexId },
      });
      expect(result?.plexId).toBe(plexId);
    });
  });

  describe('findAll', () => {
    it('should return paginated users with default options', async () => {
      const paginatedResult = {
        items: [{ id: 'user-1' }, { id: 'user-2' }],
        total: 2,
        page: 1,
        pageSize: 20,
      };

      // Mock the paginate method
      const paginateSpy = vi.spyOn(userRepository as any, 'paginate');
      paginateSpy.mockResolvedValue(paginatedResult);

      const result = await userRepository.findAll();

      expect(paginateSpy).toHaveBeenCalledWith(
        mockPrisma.user,
        {},
        {},
        {
          id: true,
          email: true,
          name: true,
          plexUsername: true,
          role: true,
          status: true,
          createdAt: true,
          lastLoginAt: true,
        },
      );
      expect(result).toEqual(paginatedResult);
    });

    it('should return paginated users with custom options', async () => {
      const options = { page: 2, pageSize: 10 };
      const paginatedResult = {
        items: [{ id: 'user-1' }],
        total: 1,
        page: 2,
        pageSize: 10,
      };

      const paginateSpy = vi.spyOn(userRepository as any, 'paginate');
      paginateSpy.mockResolvedValue(paginatedResult);

      const result = await userRepository.findAll(options);

      expect(paginateSpy).toHaveBeenCalledWith(mockPrisma.user, {}, options, expect.any(Object));
      expect(result).toEqual(paginatedResult);
    });
  });

  describe('findByRole', () => {
    it('should return users filtered by role', async () => {
      const role = 'admin';
      const paginatedResult = {
        items: [{ id: 'user-1', role: 'admin' }],
        total: 1,
        page: 1,
        pageSize: 20,
      };

      const paginateSpy = vi.spyOn(userRepository as any, 'paginate');
      paginateSpy.mockResolvedValue(paginatedResult);

      const result = await userRepository.findByRole(role);

      expect(paginateSpy).toHaveBeenCalledWith(mockPrisma.user, { role }, {});
      expect(result).toEqual(paginatedResult);
    });
  });

  describe('create', () => {
    it('should create user with encrypted Plex token', async () => {
      const userData = {
        email: 'test@example.com',
        name: 'Test User',
        plexToken: 'plain-token',
      };
      const encryptedToken = 'encrypted-token';
      const createdUser = {
        id: 'user-123',
        ...userData,
        plexToken: encryptedToken,
      };

      mockEncryption.encryptForStorage.mockReturnValue(encryptedToken);
      mockPrisma.user.create.mockResolvedValue(createdUser);
      mockEncryption.decryptFromStorage.mockReturnValue('plain-token');

      const result = await userRepository.create(userData);

      expect(mockEncryption.encryptForStorage).toHaveBeenCalledWith('plain-token');
      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: {
          email: 'test@example.com',
          name: 'Test User',
          plexToken: encryptedToken,
        },
      });
      expect(result.plexToken).toBe('plain-token'); // Should be decrypted in result
    });

    it('should create user with password hash', async () => {
      const userData = {
        email: 'test@example.com',
        name: 'Test User',
        password: 'plain-password',
      };
      const hashedPassword = 'hashed-password';
      const createdUser = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        passwordHash: hashedPassword,
      };

      vi.mocked(bcrypt.hash).mockResolvedValue(hashedPassword as never);
      mockPrisma.user.create.mockResolvedValue(createdUser);

      const result = await userRepository.create(userData);

      expect(bcrypt.hash).toHaveBeenCalledWith('plain-password', 10);
      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: {
          email: 'test@example.com',
          name: 'Test User',
          passwordHash: hashedPassword,
        },
      });
    });

    it('should create user without encryption if no sensitive data', async () => {
      const userData = {
        email: 'test@example.com',
        name: 'Test User',
      };
      const createdUser = {
        id: 'user-123',
        ...userData,
      };

      mockPrisma.user.create.mockResolvedValue(createdUser);

      const result = await userRepository.create(userData);

      expect(mockEncryption.encryptForStorage).not.toHaveBeenCalled();
      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: userData,
      });
    });
  });

  describe('update', () => {
    it('should update user and encrypt Plex token', async () => {
      const userId = 'user-123';
      const updateData = {
        name: 'Updated Name',
        plexToken: 'new-plain-token',
      };
      const encryptedToken = 'new-encrypted-token';
      const updatedUser = {
        id: userId,
        ...updateData,
        plexToken: encryptedToken,
      };

      mockPrisma.user.findUnique.mockResolvedValue({ id: userId });
      mockEncryption.encryptForStorage.mockReturnValue(encryptedToken);
      mockPrisma.user.update.mockResolvedValue(updatedUser);
      mockEncryption.decryptFromStorage.mockReturnValue('new-plain-token');

      const result = await userRepository.update(userId, updateData);

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: userId },
        select: { id: true },
      });
      expect(mockEncryption.encryptForStorage).toHaveBeenCalledWith('new-plain-token');
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: {
          name: 'Updated Name',
          plexToken: encryptedToken,
        },
      });
      expect(result.plexToken).toBe('new-plain-token');
    });

    it('should throw NotFoundError if user does not exist', async () => {
      const userId = 'user-123';
      const updateData = { name: 'Updated Name' };

      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(userRepository.update(userId, updateData)).rejects.toThrow(
        new NotFoundError('User'),
      );
    });
  });

  describe('updateLastLogin', () => {
    it('should update last login timestamp', async () => {
      const userId = 'user-123';
      const updatedUser = {
        id: userId,
        lastLoginAt: new Date(),
      };

      const updateSpy = vi.spyOn(userRepository, 'update');
      updateSpy.mockResolvedValue(updatedUser as any);

      const result = await userRepository.updateLastLogin(userId);

      expect(updateSpy).toHaveBeenCalledWith(userId, {
        lastLoginAt: expect.any(Date),
      });
      expect(result).toEqual(updatedUser);
    });
  });

  describe('delete', () => {
    it('should delete user', async () => {
      const userId = 'user-123';
      const deletedUser = { id: userId };

      mockPrisma.user.delete.mockResolvedValue(deletedUser);

      const result = await userRepository.delete(userId);

      expect(mockPrisma.user.delete).toHaveBeenCalledWith({
        where: { id: userId },
      });
      expect(result).toEqual(deletedUser);
    });
  });

  describe('count', () => {
    it('should return user count', async () => {
      const count = 42;
      mockPrisma.user.count.mockResolvedValue(count);

      const result = await userRepository.count();

      expect(mockPrisma.user.count).toHaveBeenCalled();
      expect(result).toBe(count);
    });
  });

  describe('countByRole', () => {
    it('should return user count by role', async () => {
      const role = 'admin';
      const count = 5;
      mockPrisma.user.count.mockResolvedValue(count);

      const result = await userRepository.countByRole(role);

      expect(mockPrisma.user.count).toHaveBeenCalledWith({
        where: { role },
      });
      expect(result).toBe(count);
    });
  });

  describe('isFirstUser', () => {
    it('should return true if no users exist', async () => {
      mockPrisma.user.count.mockResolvedValue(0);

      const result = await userRepository.isFirstUser();

      expect(result).toBe(true);
    });

    it('should return false if users exist', async () => {
      mockPrisma.user.count.mockResolvedValue(5);

      const result = await userRepository.isFirstUser();

      expect(result).toBe(false);
    });
  });

  describe('updatePlexToken', () => {
    it('should update Plex token', async () => {
      const userId = 'user-123';
      const plexToken = 'new-token';
      const updatedUser = { id: userId, plexToken };

      const updateSpy = vi.spyOn(userRepository, 'update');
      updateSpy.mockResolvedValue(updatedUser as any);

      const result = await userRepository.updatePlexToken(userId, plexToken);

      expect(updateSpy).toHaveBeenCalledWith(userId, { plexToken });
      expect(result).toEqual(updatedUser);
    });
  });

  describe('findActiveUsers', () => {
    it('should return active users', async () => {
      const paginatedResult = {
        items: [{ id: 'user-1', status: 'active' }],
        total: 1,
        page: 1,
        pageSize: 20,
      };

      const paginateSpy = vi.spyOn(userRepository as any, 'paginate');
      paginateSpy.mockResolvedValue(paginatedResult);

      const result = await userRepository.findActiveUsers();

      expect(paginateSpy).toHaveBeenCalledWith(mockPrisma.user, { status: 'active' }, {});
      expect(result).toEqual(paginatedResult);
    });
  });

  describe('updatePassword', () => {
    it('should update password hash and reset password change requirement', async () => {
      const userId = 'user-123';
      const newPasswordHash = 'new-hashed-password';
      const updatedUser = {
        id: userId,
        passwordHash: newPasswordHash,
        requiresPasswordChange: false,
      };

      mockPrisma.user.update.mockResolvedValue(updatedUser);

      const result = await userRepository.updatePassword(userId, newPasswordHash);

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: {
          passwordHash: newPasswordHash,
          requiresPasswordChange: false,
        },
      });
      expect(result).toEqual(updatedUser);
    });
  });
});
