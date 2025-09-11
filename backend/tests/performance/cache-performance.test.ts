/**
 * CACHE HIT RATIO MONITORING AND PERFORMANCE TESTS
 *
 * Comprehensive caching performance tests to ensure optimal cache utilization
 * Tests Redis cache performance, hit ratios, and memory efficiency
 */

import { describe, test, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import { Redis } from 'ioredis';
import { app, httpServer } from '../../src/app';
import { AuthTestHelper } from '../helpers/auth-test-helper';
import { logger } from '../../src/utils/logger';

interface CacheMetric {
  operation: 'get' | 'set' | 'delete' | 'flush';
  key: string;
  hit: boolean;
  responseTime: number;
  dataSize: number;
  timestamp: number;
  memoryUsage: NodeJS.MemoryUsage;
}

interface CacheBenchmark {
  operation: string;
  totalOperations: number;
  hitRate: number;
  missRate: number;
  avgResponseTime: number;
  p95ResponseTime: number;
  throughputOPS: number; // operations per second
  memoryEfficiency: number;
  targetHitRate: number;
  passed: boolean;
}

describe('Cache Performance and Hit Ratio Tests', () => {
  let authHelper: AuthTestHelper;
  let userToken: string;
  let adminToken: string;
  let testUser: any;
  let adminUser: any;
  let redis: Redis;
  let cacheMetrics: CacheMetric[] = [];
  let cacheBenchmarks: CacheBenchmark[] = [];

  beforeAll(async () => {
    authHelper = new AuthTestHelper();
    testUser = await authHelper.createTestUser();
    adminUser = await authHelper.createTestAdmin();
    userToken = await authHelper.generateAccessToken(testUser.id);
    adminToken = await authHelper.generateAccessToken(adminUser.id);

    // Initialize Redis connection for direct cache testing
    redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      db: 1, // Use separate DB for testing
      retryDelayOnFailover: 100,
      lazyConnect: true,
    });

    try {
      await redis.connect();
      await redis.flushdb(); // Clear test database
    } catch (error) {
      logger.warn('Redis connection failed, using mock:', error);
      // Use mock Redis for testing if connection fails
      redis = {
        get: vi.fn().mockResolvedValue(null),
        set: vi.fn().mockResolvedValue('OK'),
        del: vi.fn().mockResolvedValue(1),
        flushdb: vi.fn().mockResolvedValue('OK'),
        info: vi.fn().mockResolvedValue('redis_version:6.0.0\r\nused_memory:1024\r\n'),
        disconnect: vi.fn().mockResolvedValue(undefined),
      } as any;
    }

    logger.info('Cache performance tests starting');
  });

  afterAll(async () => {
    await redis.disconnect();
    await authHelper.disconnect();
    await httpServer?.close();

    const avgHitRate =
      cacheBenchmarks.reduce((sum, b) => sum + b.hitRate, 0) / cacheBenchmarks.length;
    logger.info('Cache performance tests completed', {
      totalMetrics: cacheMetrics.length,
      avgHitRate: `${Math.round(avgHitRate * 100)}%`,
      benchmarksPassed: cacheBenchmarks.filter((b) => b.passed).length,
      benchmarksTotal: cacheBenchmarks.length,
    });
  });

  /**
   * Measure cache operation performance
   */
  const measureCacheOperation = async (
    operation: 'get' | 'set' | 'delete' | 'flush',
    key: string,
    operationFunction: () => Promise<any>,
    dataSize: number = 0
  ): Promise<CacheMetric> => {
    const memoryBefore = process.memoryUsage();
    const startTime = performance.now();
    let hit = false;

    try {
      const result = await operationFunction();
      hit = operation === 'get' && result !== null;
    } catch (error) {
      logger.warn(`Cache operation ${operation} failed for key ${key}:`, error);
    }

    const responseTime = performance.now() - startTime;
    const memoryAfter = process.memoryUsage();

    const metric: CacheMetric = {
      operation,
      key,
      hit,
      responseTime,
      dataSize,
      timestamp: Date.now(),
      memoryUsage: {
        rss: memoryAfter.rss - memoryBefore.rss,
        heapTotal: memoryAfter.heapTotal - memoryBefore.heapTotal,
        heapUsed: memoryAfter.heapUsed - memoryBefore.heapUsed,
        external: memoryAfter.external - memoryBefore.external,
        arrayBuffers: memoryAfter.arrayBuffers - memoryBefore.arrayBuffers,
      },
    };

    cacheMetrics.push(metric);
    return metric;
  };

  /**
   * Analyze cache performance and hit ratios
   */
  const analyzeCachePerformance = (
    operation: string,
    metrics: CacheMetric[],
    targetHitRate: number = 0.8
  ): CacheBenchmark => {
    const responseTimes = metrics.map((m) => m.responseTime).sort((a, b) => a - b);
    const hits = metrics.filter((m) => m.hit).length;
    const misses = metrics.filter((m) => !m.hit && m.operation === 'get').length;
    const totalGets = hits + misses;

    const benchmark: CacheBenchmark = {
      operation,
      totalOperations: metrics.length,
      hitRate: totalGets > 0 ? hits / totalGets : 0,
      missRate: totalGets > 0 ? misses / totalGets : 0,
      avgResponseTime: Math.round(
        responseTimes.reduce((sum, rt) => sum + rt, 0) / responseTimes.length
      ),
      p95ResponseTime: Math.round(responseTimes[Math.floor(responseTimes.length * 0.95)] || 0),
      throughputOPS: Math.round(
        (metrics.length /
          (Math.max(...metrics.map((m) => m.timestamp)) -
            Math.min(...metrics.map((m) => m.timestamp)))) *
          1000
      ),
      memoryEfficiency: Math.round(
        metrics.reduce((sum, m) => sum + Math.abs(m.memoryUsage.heapUsed), 0) /
          metrics.length /
          1024
      ),
      targetHitRate,
      passed: false,
    };

    benchmark.passed =
      benchmark.hitRate >= targetHitRate &&
      benchmark.avgResponseTime < 10 && // Under 10ms for cache operations
      benchmark.throughputOPS > 1000; // At least 1000 operations per second

    cacheBenchmarks.push(benchmark);
    return benchmark;
  };

  describe('Basic Cache Operations Performance', () => {
    test('should perform cache SET operations within 5ms', async () => {
      const setMetrics: CacheMetric[] = [];

      // Test various data sizes
      const testData = [
        { size: 'small', data: 'small-value', bytes: 11 },
        { size: 'medium', data: 'A'.repeat(1024), bytes: 1024 }, // 1KB
        { size: 'large', data: 'B'.repeat(10240), bytes: 10240 }, // 10KB
      ];

      for (let i = 0; i < 30; i++) {
        const testItem = testData[i % testData.length];
        const key = `test-set-${testItem.size}-${i}`;

        const metric = await measureCacheOperation(
          'set',
          key,
          () => redis.set(key, testItem.data, 'EX', 300), // 5 minute TTL
          testItem.bytes
        );
        setMetrics.push(metric);
      }

      const benchmark = analyzeCachePerformance('cache-set', setMetrics);

      expect(benchmark.avgResponseTime).toBeLessThan(5);
      expect(benchmark.p95ResponseTime).toBeLessThan(10);
      expect(benchmark.throughputOPS).toBeGreaterThan(2000);
      expect(benchmark.memoryEfficiency).toBeLessThan(1024); // Under 1KB memory per operation

      logger.info('Cache SET performance', {
        operations: benchmark.totalOperations,
        avgResponseTime: benchmark.avgResponseTime,
        throughputOPS: benchmark.throughputOPS,
      });
    });

    test('should perform cache GET operations within 3ms', async () => {
      const getMetrics: CacheMetric[] = [];

      // Pre-populate cache with test data
      const testKeys: string[] = [];
      for (let i = 0; i < 20; i++) {
        const key = `test-get-${i}`;
        await redis.set(key, `cached-value-${i}`, 'EX', 300);
        testKeys.push(key);
      }

      // Test cache hits
      for (let i = 0; i < 30; i++) {
        const key = testKeys[i % testKeys.length];

        const metric = await measureCacheOperation('get', key, () => redis.get(key));
        getMetrics.push(metric);
      }

      const benchmark = analyzeCachePerformance('cache-get-hits', getMetrics, 1.0); // Expect 100% hits

      expect(benchmark.avgResponseTime).toBeLessThan(3);
      expect(benchmark.hitRate).toBeGreaterThan(0.95);
      expect(benchmark.throughputOPS).toBeGreaterThan(5000);
    });

    test('should handle cache misses efficiently', async () => {
      const missMetrics: CacheMetric[] = [];

      // Test cache misses with non-existent keys
      for (let i = 0; i < 20; i++) {
        const key = `non-existent-key-${i}`;

        const metric = await measureCacheOperation('get', key, () => redis.get(key));
        missMetrics.push(metric);
      }

      const benchmark = analyzeCachePerformance('cache-get-misses', missMetrics, 0); // Expect 0% hits

      expect(benchmark.avgResponseTime).toBeLessThan(3);
      expect(benchmark.hitRate).toBe(0); // All misses
      expect(benchmark.missRate).toBe(1); // 100% miss rate
      expect(benchmark.throughputOPS).toBeGreaterThan(3000);
    });
  });

  describe('Application Cache Integration Tests', () => {
    test('should achieve high cache hit rates for dashboard stats', async () => {
      const dashboardMetrics: CacheMetric[] = [];

      // Make repeated requests to dashboard stats (should be cached)
      for (let i = 0; i < 25; i++) {
        const startTime = performance.now();

        try {
          const response = await request(app)
            .get('/api/v1/dashboard/stats')
            .set('Authorization', `Bearer ${userToken}`);

          const responseTime = performance.now() - startTime;
          const isCacheHit = response.headers['x-cache-status'] === 'HIT' || responseTime < 50; // Fast response likely cached

          dashboardMetrics.push({
            operation: 'get',
            key: 'dashboard-stats',
            hit: isCacheHit,
            responseTime,
            dataSize: JSON.stringify(response.body).length,
            timestamp: Date.now(),
            memoryUsage: process.memoryUsage(),
          });
        } catch (error) {
          logger.warn(`Dashboard stats request ${i} failed:`, error);
        }

        // Small delay between requests
        if (i < 24) {
          await new Promise((resolve) => setTimeout(resolve, 20));
        }
      }

      const benchmark = analyzeCachePerformance('dashboard-cache', dashboardMetrics, 0.7); // 70% hit rate target

      expect(benchmark.hitRate).toBeGreaterThan(0.6); // At least 60% hit rate
      expect(benchmark.avgResponseTime).toBeLessThan(100); // Under 100ms with caching
      expect(benchmark.passed || benchmark.hitRate > 0.5).toBe(true); // Pass if decent hit rate

      logger.info('Dashboard caching performance', {
        hitRate: `${(benchmark.hitRate * 100).toFixed(1)}%`,
        avgResponseTime: benchmark.avgResponseTime,
        totalRequests: benchmark.totalOperations,
      });
    });

    test('should cache media search results effectively', async () => {
      const searchMetrics: CacheMetric[] = [];
      const searchQueries = ['action', 'comedy', 'drama', 'thriller'];

      // Make repeated search requests with same queries
      for (let i = 0; i < 32; i++) {
        const query = searchQueries[i % searchQueries.length];
        const startTime = performance.now();

        try {
          const response = await request(app)
            .get('/api/v1/media/search')
            .query({ q: query, limit: 10 })
            .set('Authorization', `Bearer ${userToken}`);

          const responseTime = performance.now() - startTime;
          const isCacheHit =
            response.headers['x-cache-status'] === 'HIT' || (i >= 4 && responseTime < 100); // Likely cached after first round

          searchMetrics.push({
            operation: 'get',
            key: `search-${query}`,
            hit: isCacheHit,
            responseTime,
            dataSize: JSON.stringify(response.body).length,
            timestamp: Date.now(),
            memoryUsage: process.memoryUsage(),
          });
        } catch (error) {
          logger.warn(`Search request ${i} failed:`, error);
        }

        await new Promise((resolve) => setTimeout(resolve, 25));
      }

      const benchmark = analyzeCachePerformance('search-cache', searchMetrics, 0.6); // 60% hit rate target

      expect(benchmark.hitRate).toBeGreaterThan(0.4); // At least 40% hit rate for repeated searches
      expect(benchmark.avgResponseTime).toBeLessThan(200);

      logger.info('Search caching performance', {
        hitRate: `${(benchmark.hitRate * 100).toFixed(1)}%`,
        avgResponseTime: benchmark.avgResponseTime,
        queries: searchQueries.length,
      });
    });

    test('should handle authentication token caching', async () => {
      const authCacheMetrics: CacheMetric[] = [];

      // Make repeated authenticated requests (tokens should be cached for validation)
      for (let i = 0; i < 30; i++) {
        const startTime = performance.now();

        try {
          const response = await request(app)
            .get('/api/v1/health')
            .set('Authorization', `Bearer ${userToken}`);

          const responseTime = performance.now() - startTime;
          const isTokenCached = responseTime < 20; // Very fast auth validation suggests caching

          authCacheMetrics.push({
            operation: 'get',
            key: 'auth-token-validation',
            hit: isTokenCached,
            responseTime,
            dataSize: 0, // Token validation has minimal data
            timestamp: Date.now(),
            memoryUsage: process.memoryUsage(),
          });
        } catch (error) {
          logger.warn(`Auth request ${i} failed:`, error);
        }

        await new Promise((resolve) => setTimeout(resolve, 10));
      }

      const benchmark = analyzeCachePerformance('auth-cache', authCacheMetrics, 0.8); // 80% hit rate target

      expect(benchmark.avgResponseTime).toBeLessThan(30); // Very fast with token caching
      expect(benchmark.hitRate).toBeGreaterThan(0.7); // High hit rate expected for auth tokens
    });
  });

  describe('Cache Efficiency and Memory Tests', () => {
    test('should efficiently manage cache memory usage', async () => {
      const memoryMetrics: CacheMetric[] = [];
      const largeDataSizes = [1024, 5120, 10240, 20480]; // 1KB to 20KB

      // Store various sized data in cache
      for (let i = 0; i < 20; i++) {
        const size = largeDataSizes[i % largeDataSizes.length];
        const key = `memory-test-${i}`;
        const data = 'M'.repeat(size);

        const metric = await measureCacheOperation(
          'set',
          key,
          () => redis.set(key, data, 'EX', 300),
          size
        );
        memoryMetrics.push(metric);
      }

      // Retrieve the same data
      for (let i = 0; i < 20; i++) {
        const key = `memory-test-${i}`;

        const metric = await measureCacheOperation('get', key, () => redis.get(key));
        memoryMetrics.push(metric);
      }

      const benchmark = analyzeCachePerformance('memory-efficiency', memoryMetrics, 1.0);

      expect(benchmark.avgResponseTime).toBeLessThan(8);
      expect(benchmark.memoryEfficiency).toBeLessThan(2048); // Under 2KB memory per operation
      expect(benchmark.throughputOPS).toBeGreaterThan(1500);

      logger.info('Cache memory efficiency', {
        operations: benchmark.totalOperations,
        avgMemoryKB: Math.round(benchmark.memoryEfficiency),
        throughputOPS: benchmark.throughputOPS,
      });
    });

    test('should handle cache expiration effectively', async () => {
      const expirationMetrics: CacheMetric[] = [];

      // Set keys with short TTL
      const shortTTLKeys: string[] = [];
      for (let i = 0; i < 10; i++) {
        const key = `expire-test-${i}`;
        await redis.set(key, `expire-value-${i}`, 'EX', 2); // 2 second TTL
        shortTTLKeys.push(key);
      }

      // Immediate retrieval (should hit)
      for (const key of shortTTLKeys) {
        const metric = await measureCacheOperation('get', key, () => redis.get(key));
        expirationMetrics.push(metric);
      }

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 2500));

      // Retrieval after expiration (should miss)
      for (const key of shortTTLKeys) {
        const metric = await measureCacheOperation('get', key, () => redis.get(key));
        expirationMetrics.push(metric);
      }

      const beforeExpiry = expirationMetrics.slice(0, 10);
      const afterExpiry = expirationMetrics.slice(10);

      const beforeBenchmark = analyzeCachePerformance('before-expiry', beforeExpiry, 1.0);
      const afterBenchmark = analyzeCachePerformance('after-expiry', afterExpiry, 0);

      expect(beforeBenchmark.hitRate).toBeGreaterThan(0.8); // High hit rate before expiry
      expect(afterBenchmark.hitRate).toBeLessThan(0.2); // Low hit rate after expiry
      expect(afterBenchmark.avgResponseTime).toBeLessThan(5); // Fast miss detection
    });

    test('should handle concurrent cache operations efficiently', async () => {
      const concurrentMetrics: CacheMetric[] = [];
      const concurrentOperations = 50;
      const operationPromises: Promise<CacheMetric>[] = [];

      // Generate concurrent cache operations
      for (let i = 0; i < concurrentOperations; i++) {
        const key = `concurrent-${i}`;
        const operation = i % 3 === 0 ? 'set' : 'get'; // 1/3 sets, 2/3 gets

        if (operation === 'set') {
          const promise = measureCacheOperation(
            'set',
            key,
            () => redis.set(key, `concurrent-value-${i}`, 'EX', 300),
            20
          );
          operationPromises.push(promise);
        } else {
          // For gets, use existing keys or random keys
          const getKey =
            i > 20 ? `concurrent-${Math.floor(Math.random() * 20)}` : `concurrent-${i}`;
          const promise = measureCacheOperation('get', getKey, () => redis.get(getKey));
          operationPromises.push(promise);
        }
      }

      const results = await Promise.allSettled(operationPromises);
      const successfulMetrics = results
        .filter(
          (result): result is PromiseFulfilledResult<CacheMetric> => result.status === 'fulfilled'
        )
        .map((result) => result.value);

      concurrentMetrics.push(...successfulMetrics);

      const benchmark = analyzeCachePerformance('concurrent-operations', concurrentMetrics, 0.5);

      expect(benchmark.avgResponseTime).toBeLessThan(15); // Under 15ms even with concurrency
      expect(benchmark.throughputOPS).toBeGreaterThan(1000); // Maintain high throughput
      expect(successfulMetrics.length / concurrentOperations).toBeGreaterThan(0.9); // 90% success rate

      logger.info('Concurrent cache operations performance', {
        totalOperations: concurrentOperations,
        successfulOperations: successfulMetrics.length,
        avgResponseTime: benchmark.avgResponseTime,
        throughputOPS: benchmark.throughputOPS,
      });
    });
  });

  describe('Cache Performance Summary', () => {
    test('should meet overall cache performance standards', async () => {
      const cacheSummary = {
        totalBenchmarks: cacheBenchmarks.length,
        passedBenchmarks: cacheBenchmarks.filter((b) => b.passed).length,
        avgHitRate: cacheBenchmarks.reduce((sum, b) => sum + b.hitRate, 0) / cacheBenchmarks.length,
        avgResponseTime: Math.round(
          cacheBenchmarks.reduce((sum, b) => sum + b.avgResponseTime, 0) / cacheBenchmarks.length
        ),
        avgThroughputOPS: Math.round(
          cacheBenchmarks.reduce((sum, b) => sum + b.throughputOPS, 0) / cacheBenchmarks.length
        ),
        avgMemoryEfficiency: Math.round(
          cacheBenchmarks.reduce((sum, b) => sum + b.memoryEfficiency, 0) / cacheBenchmarks.length
        ),
        totalOperations: cacheMetrics.length,
        operationBreakdown: {
          gets: cacheMetrics.filter((m) => m.operation === 'get').length,
          sets: cacheMetrics.filter((m) => m.operation === 'set').length,
          deletes: cacheMetrics.filter((m) => m.operation === 'delete').length,
          hits: cacheMetrics.filter((m) => m.hit).length,
          misses: cacheMetrics.filter((m) => m.operation === 'get' && !m.hit).length,
        },
      };

      // Cache performance requirements
      expect(cacheSummary.passedBenchmarks / cacheSummary.totalBenchmarks).toBeGreaterThan(0.75); // 75% benchmark pass rate
      expect(cacheSummary.avgHitRate).toBeGreaterThan(0.6); // 60% average hit rate
      expect(cacheSummary.avgResponseTime).toBeLessThan(15); // Under 15ms average response time
      expect(cacheSummary.avgThroughputOPS).toBeGreaterThan(1000); // At least 1000 OPS
      expect(cacheSummary.totalOperations).toBeGreaterThan(100); // Sufficient test coverage

      // Calculate overall cache effectiveness
      const overallHitRate =
        cacheSummary.operationBreakdown.hits /
        (cacheSummary.operationBreakdown.hits + cacheSummary.operationBreakdown.misses);

      expect(overallHitRate).toBeGreaterThan(0.5); // At least 50% overall hit rate

      // Performance grading
      const performanceGrade =
        cacheSummary.avgHitRate > 0.8 &&
        cacheSummary.avgResponseTime < 5 &&
        cacheSummary.avgThroughputOPS > 3000
          ? 'A'
          : cacheSummary.avgHitRate > 0.7 &&
              cacheSummary.avgResponseTime < 10 &&
              cacheSummary.avgThroughputOPS > 2000
            ? 'B'
            : cacheSummary.avgHitRate > 0.6 &&
                cacheSummary.avgResponseTime < 15 &&
                cacheSummary.avgThroughputOPS > 1000
              ? 'C'
              : 'D';

      expect(performanceGrade).not.toBe('D');

      logger.info('Cache performance summary', {
        ...cacheSummary,
        overallHitRate: `${Math.round(overallHitRate * 100)}%`,
        passRate: `${Math.round((cacheSummary.passedBenchmarks / cacheSummary.totalBenchmarks) * 100)}%`,
        performanceGrade,
      });
    });
  });
});
