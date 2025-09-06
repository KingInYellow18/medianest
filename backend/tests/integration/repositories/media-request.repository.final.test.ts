import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  MediaRequestRepository,
  CreateMediaRequestInput,
  MediaRequestFilters,
} from '@/repositories/media-request.repository';
import { UserRepository } from '@/repositories/user.repository';

// Mock Prisma client at the module level
const mockPrismaClient = {
  user: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  mediaRequest: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
    aggregate: vi.fn(),
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

// Mock error classes
vi.mock('@/utils/errors', () => ({
  NotFoundError: class extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'NotFoundError';
    }
  },
  ValidationError: class extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'ValidationError';
    }
  },
}));

describe('MediaRequestRepository Integration Tests', () => {
  let repository: MediaRequestRepository;
  let userRepository: UserRepository;
  let testUserId: string;
  let secondUserId: string;

  beforeEach(() => {
    repository = new MediaRequestRepository(mockPrismaClient as any);
    userRepository = new UserRepository(mockPrismaClient as any);

    // Setup test user IDs
    testUserId = 'test-user-id-1';
    secondUserId = 'test-user-id-2';

    // Reset all mocks
    vi.resetAllMocks();

    // Setup basic user mock
    mockPrismaClient.user.create.mockResolvedValue({
      id: testUserId,
      email: 'test@example.com',
      name: 'Test User',
      plexId: 'plex-123',
      plexUsername: 'testuser',
      plexToken: null,
      role: 'user',
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
      lastLoginAt: null,
      requiresPasswordChange: false,
    });

    // Setup basic media request mocks
    let requestCounter = 0;
    mockPrismaClient.mediaRequest.create.mockImplementation(({ data }) => {
      requestCounter++;
      return Promise.resolve({
        id: `mock-request-${requestCounter}`,
        userId: data.userId,
        title: data.title,
        mediaType: data.mediaType,
        tmdbId: data.tmdbId || null,
        overseerrId: data.overseerrId || null,
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
        completedAt: null,
        user: {
          id: data.userId,
          email: data.userId === testUserId ? 'test@example.com' : 'test2@example.com',
          name: data.userId === testUserId ? 'Test User' : 'Second User',
          role: 'user',
          status: 'active',
        },
      });
    });

    // Mock findUnique
    mockPrismaClient.mediaRequest.findUnique.mockImplementation(({ where }) => {
      if (where.id === 'mock-request-1') {
        return Promise.resolve({
          id: 'mock-request-1',
          userId: testUserId,
          title: 'The Matrix',
          mediaType: 'movie',
          tmdbId: '603',
          status: 'pending',
          createdAt: new Date(),
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

  describe('create', () => {
    it('should create a media request with required fields', async () => {
      const requestData: CreateMediaRequestInput = {
        userId: testUserId,
        title: 'The Matrix',
        mediaType: 'movie',
        tmdbId: '603',
      };

      const result = await repository.create(requestData);

      expect(result).toMatchObject({
        id: expect.any(String),
        userId: testUserId,
        title: 'The Matrix',
        mediaType: 'movie',
        tmdbId: '603',
        status: 'pending',
        createdAt: expect.any(Date),
      });
      expect(result.user).toMatchObject({
        id: testUserId,
        email: 'test@example.com',
        name: 'Test User',
      });
      expect(mockPrismaClient.mediaRequest.create).toHaveBeenCalledWith({
        data: requestData,
        include: { user: true },
      });
    });

    it('should create a media request without optional fields', async () => {
      const requestData: CreateMediaRequestInput = {
        userId: testUserId,
        title: 'Breaking Bad',
        mediaType: 'tv',
      };

      const result = await repository.create(requestData);

      expect(result).toMatchObject({
        userId: testUserId,
        title: 'Breaking Bad',
        mediaType: 'tv',
        tmdbId: null,
        overseerrId: null,
      });
    });

    it('should fail with invalid userId', async () => {
      mockPrismaClient.mediaRequest.create.mockRejectedValue(
        new Error('Foreign key constraint failed'),
      );

      const requestData: CreateMediaRequestInput = {
        userId: 'invalid-user-id',
        title: 'The Matrix',
        mediaType: 'movie',
      };

      await expect(repository.create(requestData)).rejects.toThrow('Foreign key constraint failed');
    });
  });

  describe('findById', () => {
    it('should find media request by id with user info', async () => {
      const result = await repository.findById('mock-request-1');

      expect(result).toMatchObject({
        id: 'mock-request-1',
        title: 'The Matrix',
        user: {
          id: testUserId,
          email: 'test@example.com',
          name: 'Test User',
        },
      });
    });

    it('should return null for non-existent id', async () => {
      const result = await repository.findById('non-existent-id');
      expect(result).toBeNull();
    });
  });

  describe('findByUser', () => {
    beforeEach(() => {
      // Mock findMany to return paginated results
      mockPrismaClient.mediaRequest.findMany.mockImplementation(() => {
        return Promise.resolve([
          { id: 'req-1', userId: testUserId, title: 'The Matrix', mediaType: 'movie' },
          { id: 'req-2', userId: testUserId, title: 'Breaking Bad', mediaType: 'tv' },
        ]);
      });

      mockPrismaClient.mediaRequest.count.mockResolvedValue(2);
    });

    it('should return only requests for specified user', async () => {
      const result = await repository.findByUser(testUserId);

      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.items[0].userId).toBe(testUserId);
      expect(result.items[1].userId).toBe(testUserId);
    });

    it('should support pagination', async () => {
      mockPrismaClient.mediaRequest.findMany.mockResolvedValueOnce([
        { id: 'req-1', userId: testUserId, title: 'The Matrix', mediaType: 'movie' },
      ]);

      const result = await repository.findByUser(testUserId, {
        limit: 1,
        page: 1,
      });

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(2);
      expect(result.totalPages).toBe(2);
    });

    it('should return empty array for user with no requests', async () => {
      mockPrismaClient.mediaRequest.findMany.mockResolvedValueOnce([]);
      mockPrismaClient.mediaRequest.count.mockResolvedValueOnce(0);

      const result = await repository.findByUser('empty-user-id');

      expect(result.items).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  describe('update', () => {
    it('should update status', async () => {
      mockPrismaClient.mediaRequest.update.mockResolvedValue({
        id: 'test-request-id',
        status: 'approved',
        updatedAt: new Date(),
      });

      const result = await repository.update('test-request-id', { status: 'approved' });

      expect(result.status).toBe('approved');
      expect(result.updatedAt).toBeInstanceOf(Date);
    });

    it('should fail for non-existent request', async () => {
      const { NotFoundError } = await import('@/utils/errors');
      mockPrismaClient.mediaRequest.update.mockRejectedValue(new Error('Record not found'));

      await expect(repository.update('non-existent', { status: 'approved' })).rejects.toThrow();
    });
  });

  describe('updateStatus', () => {
    it('should update status to approved', async () => {
      mockPrismaClient.mediaRequest.update.mockResolvedValue({
        id: 'test-id',
        status: 'approved',
        completedAt: null,
      });

      const result = await repository.updateStatus('test-id', 'approved');

      expect(result.status).toBe('approved');
      expect(result.completedAt).toBeNull();
    });

    it('should set completedAt when status is completed', async () => {
      const completedAt = new Date();
      mockPrismaClient.mediaRequest.update.mockResolvedValue({
        id: 'test-id',
        status: 'completed',
        completedAt,
      });

      const result = await repository.updateStatus('test-id', 'completed');

      expect(result.status).toBe('completed');
      expect(result.completedAt).toBeInstanceOf(Date);
    });
  });

  describe('bulkUpdateStatus', () => {
    it('should update multiple requests status', async () => {
      mockPrismaClient.mediaRequest.updateMany.mockResolvedValue({ count: 2 });

      const count = await repository.bulkUpdateStatus(['id1', 'id2'], 'approved');

      expect(count).toBe(2);
    });

    it('should return 0 for empty array', async () => {
      mockPrismaClient.mediaRequest.updateMany.mockResolvedValue({ count: 0 });

      const count = await repository.bulkUpdateStatus([], 'approved');
      expect(count).toBe(0);
    });
  });

  describe('statistics methods', () => {
    it('should count all requests', async () => {
      mockPrismaClient.mediaRequest.count.mockResolvedValue(3);

      const count = await repository.countByStatus();
      expect(count).toBe(3);
    });

    it('should count by specific status', async () => {
      mockPrismaClient.mediaRequest.count
        .mockResolvedValueOnce(2) // pending
        .mockResolvedValueOnce(1); // approved

      const pendingCount = await repository.countByStatus('pending');
      const approvedCount = await repository.countByStatus('approved');

      expect(pendingCount).toBe(2);
      expect(approvedCount).toBe(1);
    });

    it('should get recent requests', async () => {
      const mockRequests = [
        { id: '1', title: 'Recent 1', createdAt: new Date(), user: { name: 'User 1' } },
        {
          id: '2',
          title: 'Recent 2',
          createdAt: new Date(Date.now() - 1000),
          user: { name: 'User 2' },
        },
      ];
      mockPrismaClient.mediaRequest.findMany.mockResolvedValue(mockRequests);

      const recent = await repository.getRecentRequests(2);

      expect(recent).toHaveLength(2);
      expect(recent[0].user).toBeDefined();
    });
  });

  describe('delete', () => {
    it('should delete existing request', async () => {
      mockPrismaClient.mediaRequest.delete.mockResolvedValue({ id: 'test-id' });

      const deleted = await repository.delete('test-id');
      expect(deleted.id).toBe('test-id');
    });

    it('should fail for non-existent request', async () => {
      mockPrismaClient.mediaRequest.delete.mockRejectedValue(new Error('Record not found'));

      await expect(repository.delete('non-existent')).rejects.toThrow('Record not found');
    });
  });
});
