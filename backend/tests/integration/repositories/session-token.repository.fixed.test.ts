import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  SessionTokenRepository,
  CreateSessionTokenInput,
} from '@/repositories/session-token.repository';
import { UserRepository } from '@/repositories/user.repository';
import { getTestPrismaClient, cleanDatabase, disconnectDatabase } from '../../helpers/database';
import { setupPrismaMock } from '../../helpers/prisma-mock';

// Setup Prisma mocking for this test suite
setupPrismaMock();

// Mock crypto and encryption services
vi.mock('../../../src/services/encryption.service', () => ({
  encryptionService: {
    decryptFromStorage: vi.fn().mockReturnValue('decrypted-token'),
    encryptForStorage: vi.fn().mockReturnValue('encrypted-token'),
  },
}));

vi.mock('crypto', () => ({
  randomBytes: vi.fn().mockReturnValue(Buffer.from('mock-random-bytes-32-chars-long!!')),
  createHash: vi.fn().mockReturnValue({
    update: vi.fn().mockReturnThis(),
    digest: vi
      .fn()
      .mockReturnValue('mock-hash-64-chars-long-sha256-hex-string-for-testing-purposes'),
  }),
}));

describe('SessionTokenRepository Integration Tests', () => {
  let repository: SessionTokenRepository;
  let userRepository: UserRepository;
  let testUserId: string;
  let secondUserId: string;
  let mockPrisma: any;

  beforeEach(async () => {
    mockPrisma = getTestPrismaClient();
    repository = new SessionTokenRepository(mockPrisma);
    userRepository = new UserRepository(mockPrisma);

    await cleanDatabase();

    // Setup test user IDs
    testUserId = 'test-user-id-1';
    secondUserId = 'test-user-id-2';

    // Mock user creation
    mockPrisma.user.create.mockImplementation(({ data }) =>
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

    // Mock session token operations
    let tokenCounter = 0;
    mockPrisma.sessionToken.create.mockImplementation(({ data }) => {
      tokenCounter++;
      const sessionToken = {
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
      };

      return Promise.resolve(sessionToken);
    });

    // Mock findUnique for session tokens
    mockPrisma.sessionToken.findUnique.mockImplementation(({ where }) => {
      if (where?.id === 'mock-session-1') {
        return Promise.resolve({
          id: 'mock-session-1',
          userId: testUserId,
          tokenHash: 'mock-hash-1'.padEnd(64, '0'),
          expiresAt: new Date(Date.now() + 86400000), // Tomorrow
          createdAt: new Date(),
          lastUsedAt: null,
          user: {
            id: testUserId,
            email: 'test@example.com',
            name: 'Test User',
            role: 'user',
            status: 'active',
          },
        });
      }
      return Promise.resolve(null);
    });

    // Mock findMany for user sessions
    mockPrisma.sessionToken.findMany.mockImplementation(({ where, orderBy }) => {
      const sessions = [];
      if (where?.userId === testUserId) {
        sessions.push(
          { id: 'session-1', userId: testUserId, createdAt: new Date() },
          { id: 'session-2', userId: testUserId, createdAt: new Date(Date.now() - 1000) },
        );
      }
      return Promise.resolve(sessions);
    });

    // Mock update operations
    mockPrisma.sessionToken.update.mockImplementation(({ where, data }) => {
      return Promise.resolve({
        id: where.id,
        ...data,
        lastUsedAt: new Date(),
      });
    });

    // Mock delete operations
    mockPrisma.sessionToken.delete.mockImplementation(({ where }) => {
      if (where.id === 'non-existent-id') {
        throw new Error('Record not found');
      }
      return Promise.resolve({ id: where.id });
    });

    // Mock deleteMany
    mockPrisma.sessionToken.deleteMany.mockResolvedValue({ count: 2 });

    // Mock count operations
    mockPrisma.sessionToken.count.mockImplementation(({ where }) => {
      if (where?.userId === testUserId && where?.expiresAt?.gt) {
        return Promise.resolve(2); // Active sessions
      }
      return Promise.resolve(0);
    });
  });

  afterEach(async () => {
    await cleanDatabase();
    vi.resetAllMocks();
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
    });

    it('should generate unique tokens for each session', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const tokenData: CreateSessionTokenInput = {
        userId: testUserId,
        expiresAt: tomorrow,
      };

      // Mock different token generations
      mockPrisma.sessionToken.create
        .mockResolvedValueOnce({
          id: 'session-1',
          tokenHash: 'hash-1'.padEnd(64, '0'),
          userId: testUserId,
          expiresAt: tomorrow,
        })
        .mockResolvedValueOnce({
          id: 'session-2',
          tokenHash: 'hash-2'.padEnd(64, '0'),
          userId: testUserId,
          expiresAt: tomorrow,
        });

      const result1 = await repository.create(tokenData);
      const result2 = await repository.create(tokenData);

      expect(result1.token).not.toBe(result2.token);
      expect(result1.sessionToken.tokenHash).not.toBe(result2.sessionToken.tokenHash);
    });

    it('should fail with invalid userId', async () => {
      mockPrisma.sessionToken.create.mockRejectedValue(new Error('Foreign key constraint failed'));

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const tokenData: CreateSessionTokenInput = {
        userId: 'invalid-user-id',
        expiresAt: tomorrow,
      };

      await expect(repository.create(tokenData)).rejects.toThrow();
    });
  });

  describe('findByToken', () => {
    let createdToken: string;
    let sessionTokenId: string;

    beforeEach(async () => {
      createdToken = 'mock-raw-token';
      sessionTokenId = 'mock-session-1';

      // Mock successful token lookup
      mockPrisma.sessionToken.findUnique.mockImplementation(({ where }) => {
        if (where?.tokenHash === 'mock-hash-64-chars-long-sha256-hex-string-for-testing-purposes') {
          return Promise.resolve({
            id: sessionTokenId,
            userId: testUserId,
            tokenHash: 'mock-hash-64-chars-long-sha256-hex-string-for-testing-purposes',
            user: {
              id: testUserId,
              email: 'test@example.com',
              name: 'Test User',
            },
          });
        }
        return Promise.resolve(null);
      });
    });

    it('should find session token by raw token', async () => {
      const result = await repository.findByToken(createdToken);

      expect(result).toMatchObject({
        id: sessionTokenId,
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
      const result = await repository.findByToken('invalid-token');
      expect(result).toBeNull();
    });

    it('should return null for non-existent token', async () => {
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
      mockPrisma.sessionToken.findMany.mockResolvedValueOnce([]);

      const result = await repository.findByUserId('empty-user-id');
      expect(result).toHaveLength(0);
    });
  });

  describe('validate', () => {
    it('should validate and update lastUsedAt for valid token', async () => {
      const validToken = 'valid-token';
      const sessionId = 'valid-session-id';

      // Mock finding valid token
      mockPrisma.sessionToken.findUnique.mockResolvedValueOnce({
        id: sessionId,
        userId: testUserId,
        expiresAt: new Date(Date.now() + 86400000), // Tomorrow
        lastUsedAt: null,
      });

      // Mock update
      mockPrisma.sessionToken.update.mockResolvedValueOnce({
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
      mockPrisma.sessionToken.findUnique.mockResolvedValueOnce({
        id: 'expired-session-id',
        userId: testUserId,
        expiresAt: new Date(Date.now() - 86400000), // Yesterday
      });

      // Mock deletion
      mockPrisma.sessionToken.delete.mockResolvedValueOnce({ id: 'expired-session-id' });

      const result = await repository.validate(expiredToken);
      expect(result).toBeNull();
    });

    it('should return null for non-existent token', async () => {
      mockPrisma.sessionToken.findUnique.mockResolvedValueOnce(null);

      const result = await repository.validate('non-existent-token');
      expect(result).toBeNull();
    });
  });

  describe('updateLastUsed', () => {
    it('should update lastUsedAt timestamp', async () => {
      const sessionTokenId = 'test-session-id';
      const beforeUpdate = new Date();

      mockPrisma.sessionToken.update.mockResolvedValueOnce({
        id: sessionTokenId,
        lastUsedAt: beforeUpdate,
      });

      const result = await repository.updateLastUsed(sessionTokenId);

      expect(result.lastUsedAt).toBeInstanceOf(Date);
      expect(result.lastUsedAt!.getTime()).toBeGreaterThanOrEqual(beforeUpdate.getTime());
    });

    it('should fail for non-existent session', async () => {
      mockPrisma.sessionToken.update.mockRejectedValue(new Error('Record not found'));

      await expect(repository.updateLastUsed('non-existent-id')).rejects.toThrow();
    });
  });

  describe('delete operations', () => {
    describe('delete by id', () => {
      it('should delete session by id', async () => {
        const sessionId = 'test-session-id';
        mockPrisma.sessionToken.delete.mockResolvedValueOnce({ id: sessionId });

        const deleted = await repository.delete(sessionId);
        expect(deleted.id).toBe(sessionId);
      });

      it('should fail for non-existent id', async () => {
        await expect(repository.delete('non-existent-id')).rejects.toThrow();
      });
    });

    describe('deleteByUserId', () => {
      it('should delete all sessions for user', async () => {
        const count = await repository.deleteByUserId(testUserId);
        expect(count).toBe(2);
      });

      it('should return 0 for user with no sessions', async () => {
        mockPrisma.sessionToken.deleteMany.mockResolvedValueOnce({ count: 0 });

        const count = await repository.deleteByUserId('empty-user-id');
        expect(count).toBe(0);
      });
    });
  });

  describe('deleteExpired', () => {
    it('should delete only expired sessions', async () => {
      mockPrisma.sessionToken.deleteMany.mockResolvedValueOnce({ count: 2 });

      const count = await repository.deleteExpired();
      expect(count).toBe(2);
    });
  });

  describe('getActiveSessionCount', () => {
    it('should count only active sessions for user', async () => {
      const count = await repository.getActiveSessionCount(testUserId);
      expect(count).toBe(2);
    });

    it('should return 0 for user with no active sessions', async () => {
      mockPrisma.sessionToken.count.mockResolvedValueOnce(0);

      const count = await repository.getActiveSessionCount('empty-user-id');
      expect(count).toBe(0);
    });
  });

  describe('extendExpiry', () => {
    it('should extend session expiry', async () => {
      const sessionTokenId = 'test-session-id';
      const newExpiry = new Date();
      newExpiry.setDate(newExpiry.getDate() + 7); // One week from now

      mockPrisma.sessionToken.update.mockResolvedValueOnce({
        id: sessionTokenId,
        expiresAt: newExpiry,
      });

      const result = await repository.extendExpiry(sessionTokenId, newExpiry);

      expect(result.expiresAt.getTime()).toBe(newExpiry.getTime());
    });

    it('should fail for non-existent session', async () => {
      mockPrisma.sessionToken.update.mockRejectedValue(new Error('Record not found'));

      const newExpiry = new Date();
      newExpiry.setDate(newExpiry.getDate() + 7);

      await expect(repository.extendExpiry('non-existent-id', newExpiry)).rejects.toThrow();
    });
  });
});
