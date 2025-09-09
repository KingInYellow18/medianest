import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { CacheService } from '../../../src/services/cache.service';
import { redisClient } from '../../../src/config/redis';
import { logger } from '../../../src/utils/logger';
import { handleAsync, handleCacheError, safeAsyncTry } from '../../../src/utils/error-handler';
import { safeJsonParse, safeJsonStringify } from '../../../src/utils/transform.utils';

// Mock dependencies
vi.mock('../../../src/config/redis', () => ({
  redisClient: {
    get: vi.fn(),
    setex: vi.fn(),
    del: vi.fn(),
    exists: vi.fn(),
    ttl: vi.fn(),
    flushall: vi.fn(),
    ping: vi.fn(),
  },
}));

vi.mock('../../../src/utils/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../../../src/utils/error-handler', () => ({
  handleAsync: vi.fn(),
  handleCacheError: vi.fn(),
  safeAsyncTry: vi.fn(),
}));

vi.mock('../../../src/utils/transform.utils', () => ({
  safeJsonParse: vi.fn(),
  safeJsonStringify: vi.fn(),
}));

describe('CacheService', () => {
  let cacheService: CacheService;

  beforeEach(() => {
    vi.clearAllMocks();
    cacheService = new CacheService();
    
    // Setup default mock implementations
    (handleAsync as Mock).mockImplementation(async (fn) => {
      try {
        const result = await fn();
        return [result, null];
      } catch (error) {
        return [null, error];
      }
    });
    
    (safeAsyncTry as Mock).mockImplementation(async (fn) => {
      return await fn();
    });
    
    (safeJsonStringify as Mock).mockImplementation((value) => JSON.stringify(value));
    (safeJsonParse as Mock).mockImplementation((value, fallback) => {
      try {
        return JSON.parse(value);
      } catch {
        return fallback;
      }
    });
  });

  describe('get', () => {
    it('should get cached value successfully', async () => {
      const key = 'test:key';
      const cachedValue = '{"data": "test"}';
      const parsedValue = { data: 'test' };

      (redisClient.get as Mock).mockResolvedValue(cachedValue);
      (safeJsonParse as Mock).mockReturnValue(parsedValue);

      const result = await cacheService.get<typeof parsedValue>(key);

      expect(handleAsync).toHaveBeenCalledWith(
        expect.any(Function),
        'Cache get error'
      );
      expect(redisClient.get).toHaveBeenCalledWith(key);
      expect(safeJsonParse).toHaveBeenCalledWith(cachedValue, null);
      expect(result).toEqual(parsedValue);
    });

    it('should return null for non-existent key', async () => {
      const key = 'non:existent';

      (redisClient.get as Mock).mockResolvedValue(null);

      const result = await cacheService.get(key);

      expect(result).toBeNull();
    });

    it('should return null on Redis error', async () => {
      const key = 'error:key';
      const error = new Error('Redis connection failed');

      (handleAsync as Mock).mockResolvedValue([null, error]);

      const result = await cacheService.get(key);

      expect(result).toBeNull();
    });

    it('should return fallback value for invalid JSON', async () => {
      const key = 'invalid:json';
      const invalidJson = '{"invalid": json}';

      (redisClient.get as Mock).mockResolvedValue(invalidJson);
      (safeJsonParse as Mock).mockReturnValue(null);

      const result = await cacheService.get(key);

      expect(safeJsonParse).toHaveBeenCalledWith(invalidJson, null);
      expect(result).toBeNull();
    });

    it('should handle empty string values', async () => {
      const key = 'empty:key';

      (redisClient.get as Mock).mockResolvedValue('');

      const result = await cacheService.get(key);

      expect(result).toBeNull();
    });

    it('should preserve type information', async () => {
      const key = 'typed:key';
      const typedValue = { id: 1, name: 'test', active: true };
      const jsonValue = JSON.stringify(typedValue);

      (redisClient.get as Mock).mockResolvedValue(jsonValue);
      (safeJsonParse as Mock).mockReturnValue(typedValue);

      const result = await cacheService.get<typeof typedValue>(key);

      expect(result).toEqual(typedValue);
      expect(typeof result?.id).toBe('number');
      expect(typeof result?.active).toBe('boolean');
    });
  });

  describe('set', () => {
    it('should set cached value with default TTL', async () => {
      const key = 'test:key';
      const value = { data: 'test' };
      const jsonValue = '{"data":"test"}';

      (safeJsonStringify as Mock).mockReturnValue(jsonValue);

      await cacheService.set(key, value);

      expect(safeJsonStringify).toHaveBeenCalledWith(value);
      expect(safeAsyncTry).toHaveBeenCalledWith(
        expect.any(Function),
        undefined,
        `Cache set error for key: ${key}`
      );
      // Verify the function passed to safeAsyncTry calls setex with default TTL
      const setFunction = (safeAsyncTry as Mock).mock.calls[0][0];
      await setFunction();
      expect(redisClient.setex).toHaveBeenCalledWith(key, 300, jsonValue);
    });

    it('should set cached value with custom TTL', async () => {
      const key = 'test:key';
      const value = { data: 'test' };
      const customTtl = 600;
      const jsonValue = '{"data":"test"}';

      (safeJsonStringify as Mock).mockReturnValue(jsonValue);

      await cacheService.set(key, value, customTtl);

      const setFunction = (safeAsyncTry as Mock).mock.calls[0][0];
      await setFunction();
      expect(redisClient.setex).toHaveBeenCalledWith(key, customTtl, jsonValue);
    });

    it('should handle complex objects', async () => {
      const key = 'complex:key';
      const complexValue = {
        id: 1,
        nested: { prop: 'value' },
        array: [1, 2, 3],
        date: new Date().toISOString(),
        bool: true,
      };
      const jsonValue = JSON.stringify(complexValue);

      (safeJsonStringify as Mock).mockReturnValue(jsonValue);

      await cacheService.set(key, complexValue);

      expect(safeJsonStringify).toHaveBeenCalledWith(complexValue);
    });

    it('should handle null and undefined values', async () => {
      const key = 'null:key';

      (safeJsonStringify as Mock).mockReturnValue('null');
      await cacheService.set(key, null);
      expect(safeJsonStringify).toHaveBeenCalledWith(null);

      (safeJsonStringify as Mock).mockReturnValue('undefined');
      await cacheService.set(key, undefined);
      expect(safeJsonStringify).toHaveBeenCalledWith(undefined);
    });

    it('should handle primitive values', async () => {
      const key = 'primitive:key';

      // String
      (safeJsonStringify as Mock).mockReturnValue('"test"');
      await cacheService.set(key, 'test');
      expect(safeJsonStringify).toHaveBeenCalledWith('test');

      // Number
      (safeJsonStringify as Mock).mockReturnValue('42');
      await cacheService.set(key, 42);
      expect(safeJsonStringify).toHaveBeenCalledWith(42);

      // Boolean
      (safeJsonStringify as Mock).mockReturnValue('true');
      await cacheService.set(key, true);
      expect(safeJsonStringify).toHaveBeenCalledWith(true);
    });

    it('should handle Redis errors gracefully', async () => {
      const key = 'error:key';
      const value = { data: 'test' };

      (safeAsyncTry as Mock).mockRejectedValue(new Error('Redis error'));

      // Should not throw
      await expect(cacheService.set(key, value)).resolves.toBeUndefined();
    });
  });

  describe('del', () => {
    it('should delete single key', async () => {
      const key = 'test:key';

      await cacheService.del(key);

      expect(safeAsyncTry).toHaveBeenCalledWith(
        expect.any(Function),
        undefined,
        `Cache delete error for key: ${key}`
      );
      
      const deleteFunction = (safeAsyncTry as Mock).mock.calls[0][0];
      await deleteFunction();
      expect(redisClient.del).toHaveBeenCalledWith(key);
    });

    it('should delete multiple keys', async () => {
      const keys = ['key1', 'key2', 'key3'];

      await cacheService.del(keys);

      expect(safeAsyncTry).toHaveBeenCalledWith(
        expect.any(Function),
        undefined,
        'Cache delete error for array keys'
      );
      
      const deleteFunction = (safeAsyncTry as Mock).mock.calls[0][0];
      await deleteFunction();
      expect(redisClient.del).toHaveBeenCalledWith(keys);
    });

    it('should handle empty array', async () => {
      const keys: string[] = [];

      await cacheService.del(keys);

      // Should not call Redis del for empty array
      expect(redisClient.del).not.toHaveBeenCalled();
    });

    it('should handle single key in array', async () => {
      const keys = ['single:key'];

      await cacheService.del(keys);

      const deleteFunction = (safeAsyncTry as Mock).mock.calls[0][0];
      await deleteFunction();
      expect(redisClient.del).toHaveBeenCalledWith(keys);
    });

    it('should handle Redis errors gracefully', async () => {
      const key = 'error:key';

      (safeAsyncTry as Mock).mockRejectedValue(new Error('Redis error'));

      // Should not throw
      await expect(cacheService.del(key)).resolves.toBeUndefined();
    });
  });

  describe('exists', () => {
    it('should check if key exists', async () => {
      const key = 'test:key';

      (redisClient.exists as Mock).mockResolvedValue(1);

      const result = await cacheService.exists(key);

      expect(handleAsync).toHaveBeenCalledWith(
        expect.any(Function),
        `Cache exists error for key: ${key}`
      );
      expect(redisClient.exists).toHaveBeenCalledWith(key);
      expect(result).toBe(true);
    });

    it('should return false for non-existent key', async () => {
      const key = 'non:existent';

      (redisClient.exists as Mock).mockResolvedValue(0);

      const result = await cacheService.exists(key);

      expect(result).toBe(false);
    });

    it('should handle Redis errors', async () => {
      const key = 'error:key';
      const error = new Error('Redis error');

      (handleAsync as Mock).mockResolvedValue([null, error]);

      const result = await cacheService.exists(key);

      expect(result).toBe(false);
    });
  });

  describe('ttl', () => {
    it('should get TTL for key', async () => {
      const key = 'test:key';
      const ttlValue = 300;

      (redisClient.ttl as Mock).mockResolvedValue(ttlValue);

      const result = await cacheService.ttl(key);

      expect(handleAsync).toHaveBeenCalledWith(
        expect.any(Function),
        `Cache TTL error for key: ${key}`
      );
      expect(redisClient.ttl).toHaveBeenCalledWith(key);
      expect(result).toBe(ttlValue);
    });

    it('should return -1 for key without TTL', async () => {
      const key = 'persistent:key';

      (redisClient.ttl as Mock).mockResolvedValue(-1);

      const result = await cacheService.ttl(key);

      expect(result).toBe(-1);
    });

    it('should return -2 for non-existent key', async () => {
      const key = 'non:existent';

      (redisClient.ttl as Mock).mockResolvedValue(-2);

      const result = await cacheService.ttl(key);

      expect(result).toBe(-2);
    });

    it('should handle Redis errors', async () => {
      const key = 'error:key';
      const error = new Error('Redis error');

      (handleAsync as Mock).mockResolvedValue([null, error]);

      const result = await cacheService.ttl(key);

      expect(result).toBe(-1);
    });
  });

  describe('clear', () => {
    it('should clear all cache', async () => {
      await cacheService.clear();

      expect(safeAsyncTry).toHaveBeenCalledWith(
        expect.any(Function),
        undefined,
        'Cache clear error'
      );
      
      const clearFunction = (safeAsyncTry as Mock).mock.calls[0][0];
      await clearFunction();
      expect(redisClient.flushall).toHaveBeenCalled();
    });

    it('should handle Redis errors gracefully', async () => {
      (safeAsyncTry as Mock).mockRejectedValue(new Error('Redis error'));

      // Should not throw
      await expect(cacheService.clear()).resolves.toBeUndefined();
    });
  });

  describe('ping', () => {
    it('should ping Redis successfully', async () => {
      (redisClient.ping as Mock).mockResolvedValue('PONG');

      const result = await cacheService.ping();

      expect(handleAsync).toHaveBeenCalledWith(
        expect.any(Function),
        'Cache ping error'
      );
      expect(redisClient.ping).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should return false on Redis error', async () => {
      const error = new Error('Redis error');

      (handleAsync as Mock).mockResolvedValue([null, error]);

      const result = await cacheService.ping();

      expect(result).toBe(false);
    });

    it('should return false on invalid response', async () => {
      (redisClient.ping as Mock).mockResolvedValue('INVALID');

      const result = await cacheService.ping();

      expect(result).toBe(false);
    });
  });

  describe('mget', () => {
    it('should get multiple values', async () => {
      const keys = ['key1', 'key2', 'key3'];
      const values = ['{"data1": "test"}', '{"data2": "test"}', null];
      const parsedValues = [{ data1: 'test' }, { data2: 'test' }, null];

      (redisClient.mget as Mock).mockResolvedValue(values);
      (safeJsonParse as Mock)
        .mockReturnValueOnce(parsedValues[0])
        .mockReturnValueOnce(parsedValues[1])
        .mockReturnValueOnce(null);

      const result = await cacheService.mget(keys);

      expect(handleAsync).toHaveBeenCalledWith(
        expect.any(Function),
        'Cache mget error'
      );
      expect(result).toEqual(parsedValues);
    });

    it('should handle empty keys array', async () => {
      const result = await cacheService.mget([]);

      expect(result).toEqual([]);
      expect(redisClient.mget).not.toHaveBeenCalled();
    });

    it('should handle Redis errors', async () => {
      const keys = ['key1', 'key2'];
      const error = new Error('Redis error');

      (handleAsync as Mock).mockResolvedValue([null, error]);

      const result = await cacheService.mget(keys);

      expect(result).toEqual([]);
    });
  });

  describe('mset', () => {
    it('should set multiple key-value pairs', async () => {
      const keyValuePairs = {
        'key1': { data: 'test1' },
        'key2': { data: 'test2' },
        'key3': { data: 'test3' },
      };
      const ttl = 600;

      (safeJsonStringify as Mock)
        .mockReturnValueOnce('{"data":"test1"}')
        .mockReturnValueOnce('{"data":"test2"}')
        .mockReturnValueOnce('{"data":"test3"}');

      await cacheService.mset(keyValuePairs, ttl);

      // Should call set for each key-value pair
      expect(safeAsyncTry).toHaveBeenCalledTimes(3);
      expect(safeJsonStringify).toHaveBeenCalledTimes(3);
    });

    it('should handle empty object', async () => {
      await cacheService.mset({});

      expect(safeAsyncTry).not.toHaveBeenCalled();
    });

    it('should use default TTL when not specified', async () => {
      const keyValuePairs = { 'key1': 'value1' };

      await cacheService.mset(keyValuePairs);

      // Verify default TTL is used (300 seconds)
      expect(safeAsyncTry).toHaveBeenCalledWith(
        expect.any(Function),
        undefined,
        expect.stringContaining('key1')
      );
    });
  });
});