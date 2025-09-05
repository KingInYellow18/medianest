import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { BaseRepository, PaginationOptions } from '@/repositories/base.repository';
import { AppError } from '@/utils/errors';

// Mock Prisma client
const mockPrismaClient = {
  $connect: vi.fn(),
  $disconnect: vi.fn(),
} as unknown as PrismaClient;

// Create a test implementation of BaseRepository
class TestRepository extends BaseRepository<any, any, any> {
  constructor(prisma: PrismaClient) {
    super(prisma);
  }

  // Expose protected methods for testing
  public testHandleDatabaseError = this.handleDatabaseError;
  public testGetPaginationParams = this.getPaginationParams;
  public testPaginate = this.paginate;
}

describe('BaseRepository', () => {
  let repository: TestRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repository = new TestRepository(mockPrismaClient);
  });

  describe('handleDatabaseError', () => {
    it('should handle P2002 (unique constraint) errors', () => {
      const error = {
        code: 'P2002',
        message: 'Unique constraint failed'
      };

      expect(() => repository.testHandleDatabaseError(error)).toThrow(AppError);
      expect(() => repository.testHandleDatabaseError(error)).toThrow('Duplicate entry');
    });

    it('should handle P2025 (record not found) errors', () => {
      const error = {
        code: 'P2025',
        message: 'Record not found'
      };

      expect(() => repository.testHandleDatabaseError(error)).toThrow(AppError);
      expect(() => repository.testHandleDatabaseError(error)).toThrow('Record not found');
    });

    it('should handle P2003 (foreign key constraint) errors', () => {
      const error = {
        code: 'P2003',
        message: 'Foreign key constraint failed'
      };

      expect(() => repository.testHandleDatabaseError(error)).toThrow(AppError);
      expect(() => repository.testHandleDatabaseError(error)).toThrow('Foreign key constraint failed');
    });

    it('should handle P2016 (query interpretation) errors', () => {
      const error = {
        code: 'P2016',
        message: 'Query interpretation error'
      };

      expect(() => repository.testHandleDatabaseError(error)).toThrow(AppError);
      expect(() => repository.testHandleDatabaseError(error)).toThrow('Query interpretation error');
    });

    it('should re-throw unknown errors', () => {
      const unknownError = new Error('Unknown database error');

      expect(() => repository.testHandleDatabaseError(unknownError)).toThrow(unknownError);
    });

    it('should handle errors without codes', () => {
      const genericError = {
        message: 'Generic database error'
      };

      expect(() => repository.testHandleDatabaseError(genericError)).toThrow(genericError);
    });

    it('should handle null errors', () => {
      expect(() => repository.testHandleDatabaseError(null)).toThrow(null);
    });

    it('should handle string errors', () => {
      const stringError = 'String error message';

      expect(() => repository.testHandleDatabaseError(stringError)).toThrow(stringError);
    });

    it('should preserve error properties in AppError', () => {
      const error = {
        code: 'P2002',
        message: 'Unique constraint failed',
        meta: { target: ['email'] }
      };

      try {
        repository.testHandleDatabaseError(error);
      } catch (thrownError) {
        expect(thrownError).toBeInstanceOf(AppError);
        expect(thrownError.statusCode).toBe(409);
        expect(thrownError.code).toBe('DUPLICATE_ENTRY');
      }
    });
  });

  describe('getPaginationParams', () => {
    it('should return default pagination params', () => {
      const result = repository.testGetPaginationParams();

      expect(result).toEqual({
        page: 1,
        limit: 20,
        skip: 0,
        take: 20
      });
    });

    it('should handle custom page and limit', () => {
      const options: PaginationOptions = { page: 3, limit: 10 };
      const result = repository.testGetPaginationParams(options);

      expect(result).toEqual({
        page: 3,
        limit: 10,
        skip: 20, // (3-1) * 10
        take: 10
      });
    });

    it('should enforce minimum page value', () => {
      const options: PaginationOptions = { page: 0 };
      const result = repository.testGetPaginationParams(options);

      expect(result.page).toBe(1);
      expect(result.skip).toBe(0);
    });

    it('should enforce minimum limit value', () => {
      const options: PaginationOptions = { limit: 0 };
      const result = repository.testGetPaginationParams(options);

      expect(result.limit).toBe(1);
      expect(result.take).toBe(1);
    });

    it('should enforce maximum limit value', () => {
      const options: PaginationOptions = { limit: 200 };
      const result = repository.testGetPaginationParams(options);

      expect(result.limit).toBe(100);
      expect(result.take).toBe(100);
    });

    it('should handle negative page values', () => {
      const options: PaginationOptions = { page: -5 };
      const result = repository.testGetPaginationParams(options);

      expect(result.page).toBe(1);
      expect(result.skip).toBe(0);
    });

    it('should handle negative limit values', () => {
      const options: PaginationOptions = { limit: -10 };
      const result = repository.testGetPaginationParams(options);

      expect(result.limit).toBe(1);
      expect(result.take).toBe(1);
    });

    it('should handle fractional values', () => {
      const options: PaginationOptions = { page: 2.7, limit: 15.9 };
      const result = repository.testGetPaginationParams(options);

      expect(result.page).toBe(2);
      expect(result.limit).toBe(15);
      expect(result.skip).toBe(15); // (2-1) * 15
    });

    it('should handle null/undefined options', () => {
      const result1 = repository.testGetPaginationParams(null as any);
      const result2 = repository.testGetPaginationParams(undefined);

      expect(result1).toEqual({
        page: 1,
        limit: 20,
        skip: 0,
        take: 20
      });

      expect(result2).toEqual({
        page: 1,
        limit: 20,
        skip: 0,
        take: 20
      });
    });

    it('should handle very large page numbers', () => {
      const options: PaginationOptions = { page: 1000000, limit: 50 };
      const result = repository.testGetPaginationParams(options);

      expect(result.page).toBe(1000000);
      expect(result.limit).toBe(50);
      expect(result.skip).toBe(49999950); // (1000000-1) * 50
    });
  });

  describe('paginate', () => {
    let mockModel: any;

    beforeEach(() => {
      mockModel = {
        findMany: vi.fn(),
        count: vi.fn()
      };
    });

    it('should paginate results successfully', async () => {
      const mockItems = [{ id: 1, name: 'Item 1' }, { id: 2, name: 'Item 2' }];
      const mockTotal = 50;

      mockModel.findMany.mockResolvedValue(mockItems);
      mockModel.count.mockResolvedValue(mockTotal);

      const result = await repository.testPaginate(
        mockModel,
        {},
        { page: 2, limit: 10 }
      );

      expect(result).toEqual({
        items: mockItems,
        total: 50,
        page: 2,
        limit: 10,
        totalPages: 5
      });

      expect(mockModel.findMany).toHaveBeenCalledWith({
        where: {},
        skip: 10,
        take: 10,
        orderBy: { createdAt: 'desc' }
      });

      expect(mockModel.count).toHaveBeenCalledWith({ where: {} });
    });

    it('should handle custom orderBy', async () => {
      const mockItems = [{ id: 1 }];
      mockModel.findMany.mockResolvedValue(mockItems);
      mockModel.count.mockResolvedValue(1);

      const options: PaginationOptions = {
        orderBy: { name: 'asc', createdAt: 'desc' }
      };

      await repository.testPaginate(mockModel, {}, options);

      expect(mockModel.findMany).toHaveBeenCalledWith({
        where: {},
        skip: 0,
        take: 20,
        orderBy: { name: 'asc', createdAt: 'desc' }
      });
    });

    it('should handle select parameter', async () => {
      const mockItems = [{ id: 1, name: 'Item' }];
      mockModel.findMany.mockResolvedValue(mockItems);
      mockModel.count.mockResolvedValue(1);

      const select = { id: true, name: true };
      await repository.testPaginate(mockModel, {}, {}, select);

      expect(mockModel.findMany).toHaveBeenCalledWith({
        where: {},
        skip: 0,
        take: 20,
        orderBy: { createdAt: 'desc' },
        select
      });
    });

    it('should handle include parameter', async () => {
      const mockItems = [{ id: 1, user: { name: 'User' } }];
      mockModel.findMany.mockResolvedValue(mockItems);
      mockModel.count.mockResolvedValue(1);

      const include = { user: true };
      await repository.testPaginate(mockModel, {}, {}, undefined, include);

      expect(mockModel.findMany).toHaveBeenCalledWith({
        where: {},
        skip: 0,
        take: 20,
        orderBy: { createdAt: 'desc' },
        include
      });
    });

    it('should handle where conditions', async () => {
      const mockItems = [];
      mockModel.findMany.mockResolvedValue(mockItems);
      mockModel.count.mockResolvedValue(0);

      const whereCondition = { status: 'active', userId: 123 };
      await repository.testPaginate(mockModel, whereCondition);

      expect(mockModel.findMany).toHaveBeenCalledWith({
        where: whereCondition,
        skip: 0,
        take: 20,
        orderBy: { createdAt: 'desc' }
      });

      expect(mockModel.count).toHaveBeenCalledWith({ where: whereCondition });
    });

    it('should calculate totalPages correctly', async () => {
      const testCases = [
        { total: 0, limit: 10, expectedPages: 0 },
        { total: 5, limit: 10, expectedPages: 1 },
        { total: 10, limit: 10, expectedPages: 1 },
        { total: 11, limit: 10, expectedPages: 2 },
        { total: 25, limit: 7, expectedPages: 4 },
        { total: 100, limit: 33, expectedPages: 4 }
      ];

      for (const testCase of testCases) {
        mockModel.findMany.mockResolvedValue([]);
        mockModel.count.mockResolvedValue(testCase.total);

        const result = await repository.testPaginate(
          mockModel,
          {},
          { limit: testCase.limit }
        );

        expect(result.totalPages).toBe(testCase.expectedPages);
      }
    });

    it('should handle database errors during find', async () => {
      const dbError = new Error('Database connection lost');
      mockModel.findMany.mockRejectedValue(dbError);
      mockModel.count.mockResolvedValue(0);

      await expect(repository.testPaginate(mockModel, {})).rejects.toThrow(dbError);
    });

    it('should handle database errors during count', async () => {
      const dbError = { code: 'P2025', message: 'Record not found' };
      mockModel.findMany.mockResolvedValue([]);
      mockModel.count.mockRejectedValue(dbError);

      await expect(repository.testPaginate(mockModel, {})).rejects.toThrow(AppError);
    });

    it('should handle Prisma-specific errors', async () => {
      const prismaError = { code: 'P2002', message: 'Unique constraint failed' };
      mockModel.findMany.mockRejectedValue(prismaError);
      mockModel.count.mockResolvedValue(0);

      await expect(repository.testPaginate(mockModel, {})).rejects.toThrow(AppError);
    });

    it('should execute findMany and count in parallel', async () => {
      const findManyDelay = 100;
      const countDelay = 150;

      mockModel.findMany.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve([]), findManyDelay))
      );
      mockModel.count.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve(0), countDelay))
      );

      const startTime = Date.now();
      await repository.testPaginate(mockModel, {});
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should take approximately the longer of the two delays (150ms), not their sum (250ms)
      expect(duration).toBeLessThan(200);
      expect(duration).toBeGreaterThan(140);
    });
  });

  describe('Edge cases and error scenarios', () => {
    it('should handle empty results', async () => {
      const mockModel = {
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(0)
      };

      const result = await repository.testPaginate(mockModel, {});

      expect(result).toEqual({
        items: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0
      });
    });

    it('should handle single item results', async () => {
      const mockModel = {
        findMany: vi.fn().mockResolvedValue([{ id: 1 }]),
        count: vi.fn().mockResolvedValue(1)
      };

      const result = await repository.testPaginate(mockModel, {});

      expect(result.totalPages).toBe(1);
      expect(result.items).toHaveLength(1);
    });

    it('should handle very large datasets', async () => {
      const mockModel = {
        findMany: vi.fn().mockResolvedValue(new Array(100).fill({ id: 1 })),
        count: vi.fn().mockResolvedValue(1000000)
      };

      const result = await repository.testPaginate(mockModel, {}, { limit: 100 });

      expect(result.totalPages).toBe(10000);
      expect(result.total).toBe(1000000);
    });

    it('should handle concurrent pagination requests', async () => {
      const mockModel = {
        findMany: vi.fn().mockResolvedValue([{ id: 1 }]),
        count: vi.fn().mockResolvedValue(10)
      };

      const promises = [
        repository.testPaginate(mockModel, {}, { page: 1 }),
        repository.testPaginate(mockModel, {}, { page: 2 }),
        repository.testPaginate(mockModel, {}, { page: 3 })
      ];

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result.total).toBe(10);
        expect(result.items).toHaveLength(1);
      });
    });
  });
});