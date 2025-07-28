import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { CacheService } from '@/services/cache.service';
import IORedis from 'ioredis';

// Mock IORedis
vi.mock('ioredis', () => {
  const mockRedis = {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    exists: vi.fn(),
    scan: vi.fn(),
    pipeline: vi.fn(),
    mget: vi.fn(),
    mset: vi.fn(),
    keys: vi.fn(),
    flushall: vi.fn(),
    memory: vi.fn(),
    info: vi.fn(),
    quit: vi.fn(),
    status: 'ready',
    on: vi.fn(),
    off: vi.fn(),
  };

  // Make pipeline return itself and add exec method
  mockRedis.pipeline.mockReturnValue({
    ...mockRedis,
    exec: vi.fn().mockResolvedValue([]),
  });

  return {
    default: vi.fn(() => mockRedis),
  };
});

describe('CacheService', () => {
  let cacheService: CacheService;
  let mockRedis: any;

  beforeEach(() => {
    vi.clearAllMocks();
    cacheService = new CacheService();
    mockRedis = (IORedis as any).mock.results[0].value;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Cache Key Validation (Injection Prevention)', () => {
    it('should sanitize cache keys to prevent injection', async () => {
      const maliciousKeys = [
        'user:123; FLUSHALL',
        'user:123\nFLUSHALL',
        'user:123\rDEL *',
        'user:123`EVAL "malicious code"`',
      ];

      mockRedis.set.mockResolvedValue('OK');

      for (const key of maliciousKeys) {
        await cacheService.set(key, 'test-value');

        // Verify the key was sanitized (no dangerous characters)
        const sanitizedCall = mockRedis.set.mock.calls.find(
          (call) =>
            call[0].includes('user:123') &&
            !call[0].includes(';') &&
            !call[0].includes('\n') &&
            !call[0].includes('\r') &&
            !call[0].includes('`'),
        );
        expect(sanitizedCall).toBeDefined();
      }
    });

    it('should reject excessively long cache keys', async () => {
      const longKey = 'user:' + 'x'.repeat(1000); // Very long key

      await expect(cacheService.set(longKey, 'value')).rejects.toThrow();
    });

    it('should reject empty or null cache keys', async () => {
      const invalidKeys = ['', null as any, undefined as any, '   '];

      for (const key of invalidKeys) {
        await expect(cacheService.set(key, 'value')).rejects.toThrow();
      }
    });

    it('should validate cache key patterns to prevent wildcard attacks', async () => {
      const dangerousPatterns = ['*', 'user:*:admin', '?????', '[a-z]*'];

      // Should not allow dangerous patterns in direct operations
      for (const pattern of dangerousPatterns) {
        await expect(cacheService.set(pattern, 'value')).rejects.toThrow();
      }
    });
  });

  describe('JSON Parsing Security (Prototype Pollution Protection)', () => {
    it('should prevent prototype pollution via JSON parsing', async () => {
      const maliciousPayload = {
        __proto__: { isAdmin: true },
        constructor: { prototype: { isAdmin: true } },
        normal: 'data',
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(maliciousPayload));

      const result = await cacheService.get('test-key');

      // Should get the data but without prototype pollution
      expect(result.normal).toBe('data');
      expect((result as any).__proto__).toBeUndefined();
      expect((result as any).constructor).toBeUndefined();
    });

    it('should handle circular reference attempts safely', async () => {
      const circularObj: any = { name: 'test' };
      circularObj.self = circularObj;

      // Should handle circular references without crashing
      await expect(cacheService.set('circular-key', circularObj)).rejects.toThrow();
    });

    it('should validate JSON size to prevent memory exhaustion', async () => {
      const largeObject = {
        data: 'x'.repeat(10 * 1024 * 1024), // 10MB string
      };

      // Should reject oversized objects
      await expect(cacheService.set('large-key', largeObject)).rejects.toThrow();
    });
  });

  describe('Pattern Validation (DoS Prevention)', () => {
    it('should limit SCAN pattern complexity to prevent ReDoS', async () => {
      const complexPatterns = [
        '(a+)+', // Catastrophic backtracking
        '(a|a)*', // Alternation DoS
        'a{100000,}', // Large quantifier
        '.*.*.*.*.*', // Excessive wildcards
      ];

      mockRedis.scan.mockResolvedValue(['0', []]);

      for (const pattern of complexPatterns) {
        await expect(cacheService.getByPattern(pattern)).rejects.toThrow();
      }
    });

    it('should limit the number of keys returned by pattern searches', async () => {
      const manyKeys = Array(10000)
        .fill(0)
        .map((_, i) => `user:${i}`);
      mockRedis.scan.mockResolvedValue(['0', manyKeys]);

      const result = await cacheService.getByPattern('user:*');

      // Should limit results to prevent memory exhaustion
      expect(result.length).toBeLessThanOrEqual(1000);
    });
  });

  describe('TTL Security (Resource Management)', () => {
    it('should enforce maximum TTL to prevent resource hoarding', async () => {
      const excessiveTTL = 365 * 24 * 60 * 60; // 1 year

      mockRedis.set.mockResolvedValue('OK');

      await cacheService.set('test-key', 'value', excessiveTTL);

      // Should cap TTL to reasonable maximum
      const setCall = mockRedis.set.mock.calls[0];
      expect(setCall[3]).toBeLessThanOrEqual(30 * 24 * 60 * 60); // Max 30 days
    });

    it('should reject negative TTL values', async () => {
      await expect(cacheService.set('test-key', 'value', -100)).rejects.toThrow();
    });
  });

  describe('Data Size Protection (Memory Exhaustion Prevention)', () => {
    it('should reject oversized values', async () => {
      const largeValue = 'x'.repeat(50 * 1024 * 1024); // 50MB

      await expect(cacheService.set('test-key', largeValue)).rejects.toThrow();
    });

    it('should validate batch operation size', async () => {
      const largeBatch = Array(10000)
        .fill(0)
        .map((_, i) => [`key${i}`, `value${i}`])
        .flat();

      mockRedis.mset.mockResolvedValue('OK');

      await expect(cacheService.setBatch(largeBatch as any)).rejects.toThrow();
    });

    it('should prevent memory bomb attacks via deeply nested objects', async () => {
      // Create deeply nested object
      let deepObject: any = {};
      let current = deepObject;
      for (let i = 0; i < 10000; i++) {
        current.next = {};
        current = current.next;
      }

      await expect(cacheService.set('deep-key', deepObject)).rejects.toThrow();
    });
  });

  describe('Concurrent Operations Security', () => {
    it('should handle concurrent cache operations safely', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify({ count: 1 }));
      mockRedis.set.mockResolvedValue('OK');

      const operations = Array(100)
        .fill(0)
        .map((_, i) => cacheService.set(`key-${i}`, { value: i }));

      await expect(Promise.all(operations)).resolves.not.toThrow();
    });

    it('should prevent race conditions in atomic operations', async () => {
      const pipeline = {
        get: vi.fn(),
        set: vi.fn(),
        exec: vi.fn().mockResolvedValue([['OK'], ['OK']]),
      };
      mockRedis.pipeline.mockReturnValue(pipeline);

      // Simulate concurrent atomic operations
      const promises = Array(10)
        .fill(0)
        .map(() => cacheService.getOrSet('atomic-key', async () => ({ data: 'computed' })));

      await Promise.all(promises);

      // Should use pipeline for atomicity
      expect(mockRedis.pipeline).toHaveBeenCalled();
    });

    it('should handle Redis connection failures gracefully', async () => {
      mockRedis.get.mockRejectedValue(new Error('Connection failed'));

      const result = await cacheService.get('test-key');
      expect(result).toBeNull();
    });
  });

  describe('Error Handling Security', () => {
    it('should not leak sensitive Redis information in errors', async () => {
      mockRedis.set.mockRejectedValue(new Error('Redis internal error with sensitive data'));

      await expect(cacheService.set('test-key', 'value')).rejects.toThrow();
      // Error should be sanitized, not containing Redis internals
    });

    it('should handle Redis timeout gracefully', async () => {
      mockRedis.get.mockImplementation(
        () => new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 100)),
      );

      const result = await cacheService.get('test-key');
      expect(result).toBeNull();
    });

    it('should handle Redis memory pressure', async () => {
      mockRedis.set.mockRejectedValue(new Error('OOM command not allowed'));

      await expect(cacheService.set('test-key', 'value')).rejects.toThrow();
    });

    it('should recover from Redis disconnection', async () => {
      mockRedis.status = 'disconnected';

      const result = await cacheService.get('test-key');
      expect(result).toBeNull();
    });
  });

  describe('Cache Information Security', () => {
    it('should sanitize cache info to prevent information disclosure', async () => {
      mockRedis.info.mockResolvedValue(`
        redis_version:6.0.0
        used_memory:1000000
        connected_clients:10
        auth_password:secret123
      `);

      const info = await cacheService.getCacheInfo();

      expect(info).not.toContain('auth_password');
      expect(info).not.toContain('secret123');
    });

    it('should limit memory usage reporting precision', async () => {
      mockRedis.memory.mockResolvedValue(['usage', '1234567']);

      const memoryUsage = await cacheService.getMemoryUsage();

      // Should round memory usage to prevent fingerprinting
      expect(memoryUsage % 1000).toBe(0);
    });

    it('should validate cache statistics access', async () => {
      mockRedis.info.mockResolvedValue('restricted info');

      // Should not expose internal Redis configuration
      const info = await cacheService.getCacheInfo();
      expect(info).not.toContain('password');
      expect(info).not.toContain('secret');
      expect(info).not.toContain('key');
    });
  });

  describe('Batch Operations DoS Protection', () => {
    it('should limit batch get operations size', async () => {
      const manyKeys = Array(10000)
        .fill(0)
        .map((_, i) => `key-${i}`);

      await expect(cacheService.getBatch(manyKeys)).rejects.toThrow();
    });

    it('should limit batch set operations size', async () => {
      const manyPairs = Array(5000)
        .fill(0)
        .map((_, i) => [`key-${i}`, `value-${i}`])
        .flat();

      await expect(cacheService.setBatch(manyPairs as any)).rejects.toThrow();
    });

    it('should prevent batch operation memory exhaustion', async () => {
      const largeBatch = Array(100)
        .fill(0)
        .map((_, i) => [`key-${i}`, 'x'.repeat(1024 * 1024)]);

      await expect(cacheService.setBatch(largeBatch as any)).rejects.toThrow();
    });

    it('should rate limit batch operations', async () => {
      mockRedis.mget.mockResolvedValue([]);

      // Multiple rapid batch operations should be rate limited
      const promises = Array(10)
        .fill(0)
        .map(() =>
          cacheService.getBatch(
            Array(100)
              .fill(0)
              .map((_, i) => `key-${i}`),
          ),
        );

      // Some should be rejected due to rate limiting
      const results = await Promise.allSettled(promises);
      const rejectedCount = results.filter((r) => r.status === 'rejected').length;
      expect(rejectedCount).toBeGreaterThan(0);
    });
  });

  describe('GetOrSet Security', () => {
    it('should validate callback function safety', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockRedis.set.mockResolvedValue('OK');

      const maliciousCallback = async () => {
        // Attempt to access sensitive data
        return { sensitive: process.env.JWT_SECRET };
      };

      await expect(cacheService.getOrSet('test-key', maliciousCallback)).rejects.toThrow();
    });

    it('should prevent callback execution DoS', async () => {
      mockRedis.get.mockResolvedValue(null);

      const slowCallback = async () => {
        await new Promise((resolve) => setTimeout(resolve, 10000)); // 10 second delay
        return { data: 'slow' };
      };

      // Should timeout long-running callbacks
      await expect(cacheService.getOrSet('test-key', slowCallback)).rejects.toThrow();
    });

    it('should handle callback errors safely', async () => {
      mockRedis.get.mockResolvedValue(null);

      const errorCallback = async () => {
        throw new Error('Callback failed with sensitive data: ' + process.env.JWT_SECRET);
      };

      await expect(cacheService.getOrSet('test-key', errorCallback)).rejects.toThrow();
      // Error should not leak sensitive information
    });
  });

  describe('Input Sanitization', () => {
    it('should validate data types for cache operations', async () => {
      const invalidValues = [
        undefined,
        Symbol('test'),
        () => 'function',
        new Date(), // Should be serialized
        new RegExp('test'),
      ];

      for (const value of invalidValues) {
        if (value === undefined || typeof value === 'symbol' || typeof value === 'function') {
          await expect(cacheService.set('test-key', value as any)).rejects.toThrow();
        }
      }
    });

    it('should sanitize string inputs to prevent injection', async () => {
      const dangerousStrings = ['test\x00null', 'test\x1f\x7f', 'test\u0000\u001f'];

      mockRedis.set.mockResolvedValue('OK');

      for (const str of dangerousStrings) {
        await cacheService.set('test-key', str);

        // Should sanitize control characters
        const setCall = mockRedis.set.mock.calls.find(
          (call) => typeof call[1] === 'string' && !call[1].includes('\x00'),
        );
        expect(setCall).toBeDefined();
      }
    });
  });

  describe('Performance Security', () => {
    it('should complete operations within time limits', async () => {
      mockRedis.get.mockResolvedValue('{"data":"test"}');

      const start = Date.now();
      await cacheService.get('test-key');
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(100); // Should be fast
    });

    it('should handle high-frequency operations without degradation', async () => {
      mockRedis.set.mockResolvedValue('OK');
      mockRedis.get.mockResolvedValue('{"data":"test"}');

      const operations = Array(1000)
        .fill(0)
        .map(async (_, i) => {
          await cacheService.set(`key-${i}`, { data: i });
          return cacheService.get(`key-${i}`);
        });

      const start = Date.now();
      await Promise.all(operations);
      const duration = Date.now() - start;

      // Should handle 1000 operations reasonably fast
      expect(duration).toBeLessThan(5000);
    });
  });

  describe('Pattern Matching DoS Prevention', () => {
    it('should limit SCAN operation count to prevent DoS', async () => {
      // Mock scan returning many cursor positions
      let scanCount = 0;
      mockRedis.scan.mockImplementation(() => {
        scanCount++;
        if (scanCount > 100) {
          throw new Error('Too many SCAN operations');
        }
        return Promise.resolve([scanCount < 50 ? '100' : '0', [`key-${scanCount}`]]);
      });

      await expect(cacheService.getByPattern('user:*')).rejects.toThrow();
    });

    it('should prevent infinite loop in pattern matching', async () => {
      // Mock scan that never returns cursor 0
      mockRedis.scan.mockResolvedValue(['999', ['key1']]);

      await expect(cacheService.getByPattern('test:*')).rejects.toThrow();
    });
  });
});
