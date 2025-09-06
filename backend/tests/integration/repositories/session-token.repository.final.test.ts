import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  SessionTokenRepository,
  CreateSessionTokenInput,
} from '@/repositories/session-token.repository';
import { UserRepository } from '@/repositories/user.repository';

// Mock crypto module
vi.mock('crypto', () => ({
  randomBytes: vi.fn().mockReturnValue(Buffer.from('mock-random-bytes-32-chars-long!!')),
  createHash: vi.fn().mockReturnValue({
    update: vi.fn().mockReturnThis(),
    digest: vi
      .fn()
      .mockReturnValue('mock-hash-64-chars-long-sha256-hex-string-for-testing-purposes'),
  }),
}));

// Mock encryption service
vi.mock('../../../src/services/encryption.service', () => ({
  encryptionService: {
    decryptFromStorage: vi.fn().mockReturnValue('decrypted-token'),
    encryptForStorage: vi.fn().mockReturnValue('encrypted-token'),
  },
}));

// Mock logger
vi.mock('../../../src/utils/logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock Prisma client
const mockPrismaClient = {
  user: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  sessionToken: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
  },
  $disconnect: vi.fn(),
  $transaction: vi.fn((callback) => callback(mockPrismaClient)),
};

// Mock the database helper
vi.mock('../../helpers/database', () => ({
  getTestPrismaClient: () => mockPrismaClient,
  cleanDatabase: vi.fn().mockResolvedValue(undefined),
  disconnectDatabase: vi.fn().mockResolvedValue(undefined),
}));

describe('SessionTokenRepository Integration Tests', () => {
  let repository: SessionTokenRepository;
  let userRepository: UserRepository;
  let testUserId: string;
  let secondUserId: string;

  beforeEach(() => {
    repository = new SessionTokenRepository(mockPrismaClient as any);
    userRepository = new UserRepository(mockPrismaClient as any);

    // Setup test user IDs
    testUserId = 'test-user-id-1';
    secondUserId = 'test-user-id-2';

    // Reset all mocks
    vi.resetAllMocks();

    // Setup basic user mocks
    mockPrismaClient.user.create.mockImplementation(({ data }) =>
      Promise.resolve({
        id: data.email === 'test@example.com' ? testUserId : secondUserId,
        email: data.email,
        name: data.name || null,
        plexId: data.plexId || null,
        plexUsername: data.plexUsername || null,
        plexToken: null,
        role: data.role || 'user',
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
        lastLoginAt: null,
        requiresPasswordChange: false,
      }),
    );

    // Setup basic session token mocks
    let tokenCounter = 0;
    mockPrismaClient.sessionToken.create.mockImplementation(({ data }) => {
      tokenCounter++;
      return Promise.resolve({
        id: `mock-session-${tokenCounter}`,
        userId: data.userId,
        tokenHash: `mock-hash-${tokenCounter}`.padEnd(64, '0'),
        expiresAt: data.expiresAt,
        createdAt: new Date(),
        lastUsedAt: null,
        user: {
          id: data.userId,
          email: data.userId === testUserId ? 'test@example.com' : 'test2@example.com',
          name: data.userId === testUserId ? 'Test User' : 'Second User',
          role: 'user',
          status: 'active',
        },
      });
    });

    // Setup findUnique mocks
    mockPrismaClient.sessionToken.findUnique.mockImplementation(({ where }) => {
      if (where?.tokenHash === 'mock-hash-64-chars-long-sha256-hex-string-for-testing-purposes') {
        return Promise.resolve({
          id: 'mock-session-1',
          userId: testUserId,
          tokenHash: 'mock-hash-64-chars-long-sha256-hex-string-for-testing-purposes',
          expiresAt: new Date(Date.now() + 86400000), // Tomorrow
          user: {
            id: testUserId,
            email: 'test@example.com',
            name: 'Test User',
          },
        });
      }
      if (where?.id === 'mock-session-1') {
        return Promise.resolve({
          id: 'mock-session-1',
          userId: testUserId,
          tokenHash: 'mock-hash-1'.padEnd(64, '0'),
          expiresAt: new Date(Date.now() + 86400000),
          user: {
            id: testUserId,
            email: 'test@example.com',
            name: 'Test User',
          },
        });
      }
      return Promise.resolve(null);
    });

    // Setup findMany mocks
    mockPrismaClient.sessionToken.findMany.mockImplementation(({ where }) => {
      if (where?.userId === testUserId) {
        return Promise.resolve([
          { id: 'session-1', userId: testUserId, createdAt: new Date() },
          { id: 'session-2', userId: testUserId, createdAt: new Date(Date.now() - 1000) },
        ]);
      }
      return Promise.resolve([]);
    });

    // Setup update mocks
    mockPrismaClient.sessionToken.update.mockImplementation(({ where, data }) => {
      if (where.id === 'non-existent-id') {
        throw new Error('Record not found');
      }
      return Promise.resolve({
        id: where.id,
        ...data,
        lastUsedAt: new Date(),
      });
    });

    // Setup delete mocks
    mockPrismaClient.sessionToken.delete.mockImplementation(({ where }) => {
      if (where.id === 'non-existent-id') {
        throw new Error('Record not found');
      }
      return Promise.resolve({ id: where.id });
    });

    // Setup deleteMany and count mocks
    mockPrismaClient.sessionToken.deleteMany.mockResolvedValue({ count: 2 });
    mockPrismaClient.sessionToken.count.mockResolvedValue(2);
  });

  describe('create', () => {
    it('should create a session token with secure token generation', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const tokenData: CreateSessionTokenInput = {
        userId: testUserId,
        expiresAt: tomorrow,
      };

      const result = await repository.create(tokenData);

      expect(result).toMatchObject({
        token: expect.any(String),
        sessionToken: {
          id: expect.any(String),
          userId: testUserId,
          tokenHash: expect.any(String),
          expiresAt: tomorrow,
          createdAt: expect.any(Date),
          lastUsedAt: null,
          user: {
            id: testUserId,
            email: 'test@example.com',
            name: 'Test User',
            role: 'user',
            status: 'active',
          },
        },
      });

      // Token hash should be present and different from raw token
      expect(result.sessionToken.tokenHash).toBeTruthy();
      expect(result.sessionToken.tokenHash).not.toBe(result.token);
      expect(result.sessionToken.tokenHash).toHaveLength(64); // SHA-256 hex

      // Verify Prisma create was called correctly
      expect(mockPrismaClient.sessionToken.create).toHaveBeenCalledWith({
        data: {
          userId: testUserId,
          tokenHash: expect.any(String),
          expiresAt: tomorrow,
        },
        include: { user: true },
      });
    });

    it('should generate unique tokens for each session', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const tokenData: CreateSessionTokenInput = {
        userId: testUserId,
        expiresAt: tomorrow,
      };

      // Mock different token generations
      mockPrismaClient.sessionToken.create
        .mockResolvedValueOnce({
          id: 'session-1',
          tokenHash: 'hash-1'.padEnd(64, '0'),
          userId: testUserId,
          expiresAt: tomorrow,
          user: { id: testUserId, email: 'test@example.com' },
        })
        .mockResolvedValueOnce({
          id: 'session-2',
          tokenHash: 'hash-2'.padEnd(64, '0'),
          userId: testUserId,
          expiresAt: tomorrow,
          user: { id: testUserId, email: 'test@example.com' },
        });

      const result1 = await repository.create(tokenData);
      const result2 = await repository.create(tokenData);

      expect(result1.token).not.toBe(result2.token);
      expect(result1.sessionToken.tokenHash).not.toBe(result2.sessionToken.tokenHash);
    });

    it('should fail with invalid userId', async () => {
      mockPrismaClient.sessionToken.create.mockRejectedValue(
        new Error('Foreign key constraint failed'),
      );

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const tokenData: CreateSessionTokenInput = {
        userId: 'invalid-user-id',
        expiresAt: tomorrow,
      };

      await expect(repository.create(tokenData)).rejects.toThrow('Foreign key constraint failed');
    });
  });

  describe('findByToken', () => {
    it('should find session token by raw token', async () => {
      const result = await repository.findByToken('mock-raw-token');

      expect(result).toMatchObject({
        id: 'mock-session-1',
        userId: testUserId,
        tokenHash: expect.any(String),
        user: {
          id: testUserId,
          email: 'test@example.com',
          name: 'Test User',
        },
      });
    });

    it('should return null for invalid token', async () => {
      mockPrismaClient.sessionToken.findUnique.mockResolvedValueOnce(null);

      const result = await repository.findByToken('invalid-token');
      expect(result).toBeNull();
    });

    it('should return null for non-existent token', async () => {
      mockPrismaClient.sessionToken.findUnique.mockResolvedValueOnce(null);

      const result = await repository.findByToken('a'.repeat(64));
      expect(result).toBeNull();
    });
  });

  describe('findByUserId', () => {
    it('should return all sessions for user ordered by creation date', async () => {
      const result = await repository.findByUserId(testUserId);

      expect(result).toHaveLength(2);
      expect(result[0].userId).toBe(testUserId);
      expect(result[1].userId).toBe(testUserId);

      // Should be ordered by createdAt desc
      expect(result[0].createdAt.getTime()).toBeGreaterThanOrEqual(result[1].createdAt.getTime());
    });

    it('should return empty array for user with no sessions', async () => {
      mockPrismaClient.sessionToken.findMany.mockResolvedValueOnce([]);

      const result = await repository.findByUserId('empty-user-id');
      expect(result).toHaveLength(0);
    });
  });

  describe('validate', () => {
    it('should validate and update lastUsedAt for valid token', async () => {
      const validToken = 'valid-token';
      const sessionId = 'valid-session-id';

      // Mock finding valid token
      mockPrismaClient.sessionToken.findUnique.mockResolvedValueOnce({
        id: sessionId,
        userId: testUserId,
        expiresAt: new Date(Date.now() + 86400000), // Tomorrow
        lastUsedAt: null,
      });

      // Mock update
      mockPrismaClient.sessionToken.update.mockResolvedValueOnce({
        id: sessionId,
        userId: testUserId,
        lastUsedAt: new Date(),
      });

      const result = await repository.validate(validToken);

      expect(result).toMatchObject({
        id: sessionId,
        userId: testUserId,
        lastUsedAt: expect.any(Date),
      });

      // lastUsedAt should be very recent
      const timeDiff = Date.now() - result!.lastUsedAt!.getTime();
      expect(timeDiff).toBeLessThan(1000); // Less than 1 second ago
    });

    it('should return null and delete expired token', async () => {
      const expiredToken = 'expired-token';

      // Mock finding expired token
      mockPrismaClient.sessionToken.findUnique.mockResolvedValueOnce({
        id: 'expired-session-id',
        userId: testUserId,
        expiresAt: new Date(Date.now() - 86400000), // Yesterday
      });

      // Mock deletion
      mockPrismaClient.sessionToken.delete.mockResolvedValueOnce({ id: 'expired-session-id' });

      const result = await repository.validate(expiredToken);
      expect(result).toBeNull();
    });

    it('should return null for non-existent token', async () => {
      mockPrismaClient.sessionToken.findUnique.mockResolvedValueOnce(null);

      const result = await repository.validate('non-existent-token');
      expect(result).toBeNull();
    });
  });

  describe('updateLastUsed', () => {
    it('should update lastUsedAt timestamp', async () => {
      const sessionTokenId = 'test-session-id';
      const beforeUpdate = new Date();

      mockPrismaClient.sessionToken.update.mockResolvedValueOnce({
        id: sessionTokenId,
        lastUsedAt: beforeUpdate,
      });

      const result = await repository.updateLastUsed(sessionTokenId);

      expect(result.lastUsedAt).toBeInstanceOf(Date);
      expect(result.lastUsedAt!.getTime()).toBeGreaterThanOrEqual(beforeUpdate.getTime());
    });

    it('should fail for non-existent session', async () => {
      await expect(repository.updateLastUsed('non-existent-id')).rejects.toThrow(
        'Record not found',
      );
    });
  });

  describe('delete operations', () => {
    describe('delete by id', () => {
      it('should delete session by id', async () => {
        const sessionId = 'test-session-id';
        mockPrismaClient.sessionToken.delete.mockResolvedValueOnce({ id: sessionId });

        const deleted = await repository.delete(sessionId);
        expect(deleted.id).toBe(sessionId);
      });

      it('should fail for non-existent id', async () => {
        await expect(repository.delete('non-existent-id')).rejects.toThrow('Record not found');
      });
    });

    describe('deleteByToken', () => {
      it('should delete session by raw token', async () => {
        const token = 'test-token';
        const sessionId = 'mock-session-1';

        mockPrismaClient.sessionToken.delete.mockResolvedValueOnce({ id: sessionId });

        const deleted = await repository.deleteByToken(token);
        expect(deleted.id).toBe(sessionId);
      });

      it('should fail for non-existent token', async () => {
        mockPrismaClient.sessionToken.delete.mockRejectedValue(new Error('Record not found'));

        await expect(repository.deleteByToken('non-existent-token')).rejects.toThrow(
          'Record not found',
        );
      });
    });

    describe('deleteByUserId', () => {
      it('should delete all sessions for user', async () => {
        const count = await repository.deleteByUserId(testUserId);
        expect(count).toBe(2);
      });

      it('should return 0 for user with no sessions', async () => {
        mockPrismaClient.sessionToken.deleteMany.mockResolvedValueOnce({ count: 0 });

        const count = await repository.deleteByUserId('empty-user-id');
        expect(count).toBe(0);
      });
    });
  });

  describe('deleteExpired', () => {
    it('should delete only expired sessions', async () => {
      mockPrismaClient.sessionToken.deleteMany.mockResolvedValueOnce({ count: 2 });

      const count = await repository.deleteExpired();
      expect(count).toBe(2);

      // Verify the correct where clause was used
      expect(mockPrismaClient.sessionToken.deleteMany).toHaveBeenCalledWith({
        where: {
          expiresAt: {
            lt: expect.any(Date),
          },
        },
      });
    });
  });

  describe('getActiveSessionCount', () => {
    it('should count only active sessions for user', async () => {
      const count = await repository.getActiveSessionCount(testUserId);
      expect(count).toBe(2);

      // Verify the correct where clause was used
      expect(mockPrismaClient.sessionToken.count).toHaveBeenCalledWith({
        where: {
          userId: testUserId,
          expiresAt: {
            gt: expect.any(Date),
          },
        },
      });
    });

    it('should return 0 for user with no active sessions', async () => {
      mockPrismaClient.sessionToken.count.mockResolvedValueOnce(0);

      const count = await repository.getActiveSessionCount('empty-user-id');
      expect(count).toBe(0);
    });
  });

  describe('extendExpiry', () => {
    it('should extend session expiry', async () => {
      const sessionTokenId = 'test-session-id';
      const newExpiry = new Date();
      newExpiry.setDate(newExpiry.getDate() + 7); // One week from now

      mockPrismaClient.sessionToken.update.mockResolvedValueOnce({
        id: sessionTokenId,
        expiresAt: newExpiry,
      });

      const result = await repository.extendExpiry(sessionTokenId, newExpiry);

      expect(result.expiresAt.getTime()).toBe(newExpiry.getTime());
    });

    it('should fail for non-existent session', async () => {
      const newExpiry = new Date();
      newExpiry.setDate(newExpiry.getDate() + 7);

      await expect(repository.extendExpiry('non-existent-id', newExpiry)).rejects.toThrow(
        'Record not found',
      );
    });
  });
});
