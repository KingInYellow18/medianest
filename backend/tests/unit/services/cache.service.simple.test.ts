import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';

// Direct imports with type assertion
const mockRedisClient = {
  get: vi.fn(),
  setex: vi.fn(),
  del: vi.fn(),
  exists: vi.fn(),
  ttl: vi.fn(),
  flushall: vi.fn(),
  ping: vi.fn(),
  info: vi.fn(),
  dbsize: vi.fn(),
  mget: vi.fn(),
  keys: vi.fn(),
};

const mockLogger = {
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
};

const mockHandleAsync = vi.fn();
const mockSafeAsyncTry = vi.fn();
const mockSafeJsonParse = vi.fn();
const mockSafeJsonStringify = vi.fn();

// Mock all modules explicitly
vi.mock('../../../src/config/redis', () => ({
  redisClient: mockRedisClient,
}));

vi.mock('../../../src/utils/logger', () => ({
  logger: mockLogger,
}));

vi.mock('../../../src/utils/error-handler', () => ({
  handleAsync: mockHandleAsync,
  safeAsyncTry: mockSafeAsyncTry,
  handleCacheError: vi.fn(),
}));

vi.mock('../../../src/utils/transform.utils', () => ({
  safeJsonParse: mockSafeJsonParse,
  safeJsonStringify: mockSafeJsonStringify,
}));

// Import after mocking
const { CacheService } = await import('../../../src/services/cache.service');

describe('CacheService - Simple Test', () => {
  let cacheService: CacheService;

  beforeEach(() => {
    // Reset all mocks
    vi.resetAllMocks();
    
    // Create fresh instance
    cacheService = new CacheService();
  });

  describe('basic functionality', () => {
    it('should get cached value successfully', async () => {
      const key = 'test:key';
      const cachedValue = '{"data": "test"}';
      const parsedValue = { data: 'test' };

      // Mock handleAsync to simulate successful Redis get
      mockHandleAsync.mockResolvedValue([cachedValue, null]);
      
      // Mock safeJsonParse to parse the JSON
      mockSafeJsonParse.mockReturnValue(parsedValue);

      const result = await cacheService.get<typeof parsedValue>(key);

      expect(result).toEqual(parsedValue);
      expect(mockHandleAsync).toHaveBeenCalled();
      expect(mockSafeJsonParse).toHaveBeenCalledWith(cachedValue, null);
    });

    it('should return null for non-existent key', async () => {
      const key = 'non:existent';

      // Mock handleAsync to return null for non-existent key
      mockHandleAsync.mockResolvedValue([null, null]);

      const result = await cacheService.get(key);

      expect(result).toBeNull();
    });

    it('should set cached value with default TTL', async () => {
      const key = 'test:key';
      const value = { data: 'test' };
      const jsonValue = '{"data":"test"}';

      // Mock safeJsonStringify to return JSON string
      mockSafeJsonStringify.mockReturnValue(jsonValue);
      
      // Mock safeAsyncTry to execute successfully
      mockSafeAsyncTry.mockImplementation(async (fn) => {
        return await fn();
      });
      
      // Mock the actual Redis setex call
      mockRedisClient.setex.mockResolvedValue('OK');

      await cacheService.set(key, value);

      expect(mockSafeJsonStringify).toHaveBeenCalledWith(value);
      expect(mockSafeAsyncTry).toHaveBeenCalled();
    });

    it('should delete single key', async () => {
      const key = 'test:key';

      // Mock safeAsyncTry to execute the delete function
      mockSafeAsyncTry.mockImplementation(async (fn) => {
        return await fn();
      });
      
      mockRedisClient.del.mockResolvedValue(1);

      await cacheService.del(key);

      expect(mockSafeAsyncTry).toHaveBeenCalled();
    });

    it('should check if key exists', async () => {
      const key = 'test:key';

      // Mock handleAsync to return exists result
      mockHandleAsync.mockResolvedValue([1, null]);

      const result = await cacheService.exists(key);

      expect(result).toBe(true);
      expect(mockHandleAsync).toHaveBeenCalled();
    });

    it('should get TTL for key', async () => {
      const key = 'test:key';
      const ttlValue = 300;

      mockHandleAsync.mockResolvedValue([ttlValue, null]);

      const result = await cacheService.ttl(key);

      expect(result).toBe(ttlValue);
    });

    it('should ping Redis successfully', async () => {
      mockHandleAsync.mockResolvedValue(['PONG', null]);

      const result = await cacheService.ping();

      expect(result).toBe(true);
    });

    it('should clear all cache', async () => {
      mockSafeAsyncTry.mockImplementation(async (fn) => await fn());
      mockRedisClient.flushall.mockResolvedValue('OK');

      await cacheService.clear();

      expect(mockSafeAsyncTry).toHaveBeenCalled();
    });

    it('should get multiple values', async () => {
      // Clear all previous mock calls to prevent contamination
      vi.resetAllMocks();
      
      const keys = ['key1', 'key2'];
      const values = ['{"data1": "test"}', '{"data2": "test"}'];
      const parsedValues = [{ data1: 'test' }, { data2: 'test' }];

      // Mock handleAsync to return the values
      mockHandleAsync.mockResolvedValue([values, null]);
      
      // Mock safeJsonParse for each value
      mockSafeJsonParse
        .mockReturnValueOnce(parsedValues[0])
        .mockReturnValueOnce(parsedValues[1]);

      const result = await cacheService.mget(keys);

      expect(result).toEqual(parsedValues);
    });

    it('should set multiple key-value pairs', async () => {
      // Clear all previous mock calls to prevent contamination
      vi.resetAllMocks();
      
      const keyValuePairs = {
        'key1': { data: 'test1' },
        'key2': { data: 'test2' },
      };

      // Mock safeJsonStringify for each value
      mockSafeJsonStringify
        .mockReturnValueOnce('{"data":"test1"}')
        .mockReturnValueOnce('{"data":"test2"}');

      // Mock safeAsyncTry to execute successfully
      mockSafeAsyncTry.mockImplementation(async (fn) => await fn());
      
      mockRedisClient.setex.mockResolvedValue('OK');

      await cacheService.mset(keyValuePairs);

      expect(mockSafeAsyncTry).toHaveBeenCalledTimes(2);
      expect(mockSafeJsonStringify).toHaveBeenCalledTimes(2);
    });

    it('should get cache information successfully', async () => {
      const memoryInfo = 'used_memory_human:16.25M\nused_memory:17032192';
      const dbSize = 42;

      // Mock handleAsync to return successful results for both calls
      mockHandleAsync
        .mockResolvedValueOnce([memoryInfo, null])
        .mockResolvedValueOnce([dbSize, null]);

      const result = await cacheService.getInfo();

      expect(result).toEqual({
        keyCount: 42,
        memoryUsage: '16.25M'
      });
    });

    it('should handle empty mset object', async () => {
      await cacheService.mset({});

      // Should not call safeAsyncTry for empty object
      expect(mockSafeAsyncTry).not.toHaveBeenCalled();
    });

    it('should handle empty mget array', async () => {
      // Clear all previous mock calls to prevent contamination
      vi.resetAllMocks();
      
      const result = await cacheService.mget([]);

      expect(result).toEqual([]);
      // Should not call handleAsync for empty array
      expect(mockHandleAsync).not.toHaveBeenCalled();
    });

    it('should handle empty del array', async () => {
      const keys: string[] = [];

      await cacheService.del(keys);

      // Should not call safeAsyncTry for empty array
      expect(mockSafeAsyncTry).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should return null on Redis get error', async () => {
      const key = 'error:key';
      const error = new Error('Redis connection failed');

      // Mock handleAsync to return error
      mockHandleAsync.mockResolvedValue([null, error]);

      const result = await cacheService.get(key);

      expect(result).toBeNull();
    });

    it('should handle Redis set errors gracefully', async () => {
      const key = 'error:key';
      const value = { data: 'test' };

      mockSafeJsonStringify.mockReturnValue('{"data":"test"}');
      mockSafeAsyncTry.mockRejectedValue(new Error('Redis error'));

      // Should not throw
      await expect(cacheService.set(key, value)).resolves.toBeUndefined();
    });

    it('should handle Redis delete errors gracefully', async () => {
      const key = 'error:key';

      mockSafeAsyncTry.mockRejectedValue(new Error('Redis error'));

      // Should not throw
      await expect(cacheService.del(key)).resolves.toBeUndefined();
    });

    it('should return false on exists error', async () => {
      const key = 'error:key';
      const error = new Error('Redis error');

      mockHandleAsync.mockResolvedValue([null, error]);

      const result = await cacheService.exists(key);

      expect(result).toBe(false);
    });

    it('should return -1 on TTL error', async () => {
      const key = 'error:key';
      const error = new Error('Redis error');

      mockHandleAsync.mockResolvedValue([null, error]);

      const result = await cacheService.ttl(key);

      expect(result).toBe(-1);
    });

    it('should return false on ping error', async () => {
      const error = new Error('Redis error');

      mockHandleAsync.mockResolvedValue([null, error]);

      const result = await cacheService.ping();

      expect(result).toBe(false);
    });

    it('should handle clear errors gracefully', async () => {
      mockSafeAsyncTry.mockRejectedValue(new Error('Redis error'));

      // Should not throw
      await expect(cacheService.clear()).resolves.toBeUndefined();
    });

    it('should handle mget errors', async () => {
      const keys = ['key1', 'key2'];
      const error = new Error('Redis error');

      mockHandleAsync.mockResolvedValue([null, error]);

      const result = await cacheService.mget(keys);

      expect(result).toEqual([]);
    });

    it('should handle getInfo errors', async () => {
      const error = new Error('Redis info error');

      // Mock handleAsync to return error for info, success for dbsize
      mockHandleAsync
        .mockResolvedValueOnce([null, error])
        .mockResolvedValueOnce([100, null]);

      const result = await cacheService.getInfo();

      expect(result).toEqual({
        keyCount: 0,
        memoryUsage: 'unknown'
      });
    });
  });
});