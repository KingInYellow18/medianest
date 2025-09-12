/**
 * MEMORY USAGE AND LEAK DETECTION TESTS
 *
 * Comprehensive memory performance testing to detect leaks and ensure efficient memory usage
 * Monitors heap growth, garbage collection efficiency, and memory patterns
 */

import request from 'supertest';
import { describe, test, expect, beforeAll, afterAll, vi } from 'vitest';

import { app, httpServer } from '../../src/app';
import { logger } from '../../src/utils/logger';
import { AuthTestHelper } from '../helpers/auth-test-helper';

interface MemorySnapshot {
  timestamp: number;
  operation: string;
  iteration: number;
  heapUsed: number;
  heapTotal: number;
  external: number;
  rss: number;
  arrayBuffers: number;
}

interface MemoryAnalysis {
  operation: string;
  initialMemory: number;
  finalMemory: number;
  peakMemory: number;
  memoryGrowth: number;
  memoryGrowthRate: number; // bytes per iteration
  gcEfficiency: number; // percentage of memory reclaimed
  leakDetected: boolean;
  memoryEfficient: boolean;
}

describe('Memory Usage and Leak Detection Tests', () => {
  let authHelper: AuthTestHelper;
  let userToken: string;
  let adminToken: string;
  let testUser: any;
  let adminUser: any;
  const memorySnapshots: MemorySnapshot[] = [];
  const memoryAnalyses: MemoryAnalysis[] = [];

  beforeAll(async () => {
    authHelper = new AuthTestHelper();
    testUser = await authHelper.createTestUser();
    adminUser = await authHelper.createTestAdmin();
    userToken = await authHelper.generateAccessToken(testUser.id);
    adminToken = await authHelper.generateAccessToken(adminUser.id);

    // Enable garbage collection if available
    if (global.gc) {
      global.gc();
    }

    logger.info('Memory leak detection tests starting', {
      initialMemoryMB: Math.round(process.memoryUsage().heapUsed / (1024 * 1024)),
      gcAvailable: !!global.gc,
    });
  });

  afterAll(async () => {
    await authHelper.disconnect();
    await httpServer?.close();

    // Force final garbage collection
    if (global.gc) {
      global.gc();
    }

    const finalMemoryMB = Math.round(process.memoryUsage().heapUsed / (1024 * 1024));
    logger.info('Memory leak detection tests completed', {
      totalSnapshots: memorySnapshots.length,
      finalMemoryMB,
      leaksDetected: memoryAnalyses.filter((a) => a.leakDetected).length,
      totalAnalyses: memoryAnalyses.length,
    });
  });

  /**
   * Take a memory snapshot
   */
  const takeMemorySnapshot = (operation: string, iteration: number): MemorySnapshot => {
    const memory = process.memoryUsage();
    const snapshot: MemorySnapshot = {
      timestamp: Date.now(),
      operation,
      iteration,
      heapUsed: memory.heapUsed,
      heapTotal: memory.heapTotal,
      external: memory.external,
      rss: memory.rss,
      arrayBuffers: memory.arrayBuffers,
    };
    memorySnapshots.push(snapshot);
    return snapshot;
  };

  /**
   * Analyze memory usage patterns for leaks
   */
  const analyzeMemoryUsage = (operation: string, snapshots: MemorySnapshot[]): MemoryAnalysis => {
    if (snapshots.length < 2) {
      throw new Error('Need at least 2 snapshots for analysis');
    }

    const initialMemory = snapshots[0].heapUsed;
    const finalMemory = snapshots[snapshots.length - 1].heapUsed;
    const peakMemory = Math.max(...snapshots.map((s) => s.heapUsed));
    const memoryGrowth = finalMemory - initialMemory;
    const memoryGrowthRate = memoryGrowth / (snapshots.length - 1);

    // Calculate GC efficiency by looking at memory drops
    let totalGCReclaimed = 0;
    let gcEvents = 0;
    for (let i = 1; i < snapshots.length; i++) {
      const memoryDrop = snapshots[i - 1].heapUsed - snapshots[i].heapUsed;
      if (memoryDrop > 1024 * 1024) {
        // Consider drops > 1MB as GC events
        totalGCReclaimed += memoryDrop;
        gcEvents++;
      }
    }
    const gcEfficiency = gcEvents > 0 ? (totalGCReclaimed / (peakMemory - initialMemory)) * 100 : 0;

    // Leak detection heuristics
    const leakDetected =
      memoryGrowth > 50 * 1024 * 1024 || // More than 50MB growth
      (memoryGrowthRate > 1024 * 1024 && snapshots.length > 10) || // More than 1MB per iteration over 10+ iterations
      gcEfficiency < 20; // Very low GC efficiency

    // Memory efficiency check
    const memoryEfficient =
      memoryGrowth < 20 * 1024 * 1024 && // Less than 20MB growth
      gcEfficiency > 50 && // Good GC efficiency
      peakMemory < initialMemory + 100 * 1024 * 1024; // Peak doesn't exceed initial + 100MB

    const analysis: MemoryAnalysis = {
      operation,
      initialMemory,
      finalMemory,
      peakMemory,
      memoryGrowth,
      memoryGrowthRate,
      gcEfficiency,
      leakDetected,
      memoryEfficient,
    };

    memoryAnalyses.push(analysis);
    return analysis;
  };

  /**
   * Run an operation multiple times and monitor memory
   */
  const runMemoryTest = async (
    operation: string,
    operationFunction: () => Promise<any>,
    iterations: number = 50,
    forceGC: boolean = true,
  ): Promise<MemoryAnalysis> => {
    const operationSnapshots: MemorySnapshot[] = [];

    // Take initial snapshot
    if (global.gc && forceGC) global.gc();
    operationSnapshots.push(takeMemorySnapshot(operation, 0));

    for (let i = 1; i <= iterations; i++) {
      try {
        await operationFunction();

        // Take snapshot every few iterations
        if (i % 5 === 0 || i === iterations) {
          operationSnapshots.push(takeMemorySnapshot(operation, i));
        }

        // Occasionally force GC to test efficiency
        if (global.gc && forceGC && i % 20 === 0) {
          global.gc();
          operationSnapshots.push(takeMemorySnapshot(`${operation}-post-gc`, i));
        }

        // Small delay to prevent overwhelming
        if (i % 10 === 0) {
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
      } catch (error) {
        logger.warn(`Memory test operation failed at iteration ${i}:`, error);
      }
    }

    return analyzeMemoryUsage(operation, operationSnapshots);
  };

  describe('Authentication Memory Tests', () => {
    test('should not leak memory during repeated login operations', async () => {
      const analysis = await runMemoryTest(
        'auth-login',
        () =>
          request(app)
            .post('/api/v1/auth/login')
            .send({ email: testUser.email, password: 'password123' }),
        60,
      );

      expect(analysis.leakDetected).toBe(false);
      expect(analysis.memoryGrowth).toBeLessThan(30 * 1024 * 1024); // Less than 30MB growth
      expect(analysis.memoryGrowthRate).toBeLessThan(500 * 1024); // Less than 500KB per iteration
      expect(analysis.gcEfficiency).toBeGreaterThan(30); // At least 30% GC efficiency

      logger.info('Auth login memory analysis', {
        memoryGrowthMB: Math.round((analysis.memoryGrowth / (1024 * 1024)) * 100) / 100,
        gcEfficiency: Math.round(analysis.gcEfficiency),
        leakDetected: analysis.leakDetected,
      });
    });

    test('should not leak memory during token refresh operations', async () => {
      const analysis = await runMemoryTest(
        'auth-refresh',
        () => request(app).post('/api/v1/auth/refresh').set('Authorization', `Bearer ${userToken}`),
        40,
      );

      expect(analysis.leakDetected).toBe(false);
      expect(analysis.memoryGrowth).toBeLessThan(20 * 1024 * 1024); // Less than 20MB growth
      expect(analysis.gcEfficiency).toBeGreaterThan(40);
    });
  });

  describe('API Endpoint Memory Tests', () => {
    test('should not leak memory during dashboard stats requests', async () => {
      const analysis = await runMemoryTest(
        'dashboard-stats',
        () =>
          request(app).get('/api/v1/dashboard/stats').set('Authorization', `Bearer ${userToken}`),
        50,
      );

      expect(analysis.leakDetected).toBe(false);
      expect(analysis.memoryEfficient).toBe(true);
      expect(analysis.memoryGrowth).toBeLessThan(25 * 1024 * 1024);
    });

    test('should not leak memory during media search operations', async () => {
      const searchQueries = ['movie', 'series', 'action', 'comedy', 'drama'];
      let queryIndex = 0;

      const analysis = await runMemoryTest(
        'media-search',
        () =>
          request(app)
            .get('/api/v1/media/search')
            .query({ q: searchQueries[queryIndex++ % searchQueries.length], limit: 20 })
            .set('Authorization', `Bearer ${userToken}`),
        40,
      );

      expect(analysis.leakDetected).toBe(false);
      expect(analysis.memoryGrowth).toBeLessThan(30 * 1024 * 1024);
      expect(analysis.gcEfficiency).toBeGreaterThan(25);
    });

    test('should not leak memory during media request creation', async () => {
      let requestCounter = 1000;

      const analysis = await runMemoryTest(
        'media-request-creation',
        () =>
          request(app)
            .post('/api/v1/media/request')
            .set('Authorization', `Bearer ${userToken}`)
            .send({
              title: `Memory Test Movie ${requestCounter++}`,
              year: 2024,
              type: 'movie',
              tmdbId: 500000 + requestCounter,
            }),
        30,
      );

      expect(analysis.leakDetected).toBe(false);
      expect(analysis.memoryGrowth).toBeLessThan(40 * 1024 * 1024);

      // Cleanup
      try {
        const prisma = new (require('@prisma/client').PrismaClient)();
        await prisma.mediaRequest.deleteMany({
          where: { title: { startsWith: 'Memory Test Movie' } },
        });
        await prisma.$disconnect();
      } catch (error) {
        logger.warn('Cleanup failed:', error);
      }
    });
  });

  describe('Database Operation Memory Tests', () => {
    test('should not leak memory during database queries', async () => {
      const analysis = await runMemoryTest(
        'database-queries',
        async () => {
          const prisma = new (require('@prisma/client').PrismaClient)();
          try {
            const [userCount, requestCount] = await Promise.all([
              prisma.user.count(),
              prisma.mediaRequest.count(),
            ]);
            return { userCount, requestCount };
          } finally {
            await prisma.$disconnect();
          }
        },
        30,
      );

      expect(analysis.leakDetected).toBe(false);
      expect(analysis.memoryGrowth).toBeLessThan(35 * 1024 * 1024);
      expect(analysis.gcEfficiency).toBeGreaterThan(20);
    });

    test('should handle database connection pooling efficiently', async () => {
      const prisma = new (require('@prisma/client').PrismaClient)();

      const analysis = await runMemoryTest(
        'database-pooling',
        () => prisma.user.findMany({ take: 10 }),
        50,
      );

      await prisma.$disconnect();

      expect(analysis.leakDetected).toBe(false);
      expect(analysis.memoryEfficient).toBe(true);
    });
  });

  describe('File Upload Memory Tests', () => {
    test('should not leak memory during file uploads', async () => {
      // Create a test buffer for upload
      const testBuffer = Buffer.alloc(1024 * 100, 0xff); // 100KB buffer
      let uploadCounter = 2000;

      const analysis = await runMemoryTest(
        'file-uploads',
        () =>
          request(app)
            .post('/api/v1/files/upload')
            .set('Authorization', `Bearer ${userToken}`)
            .attach('file', testBuffer, `memory-test-${uploadCounter++}.bin`)
            .field('category', 'memory-test'),
        25,
      );

      expect(analysis.leakDetected).toBe(false);
      expect(analysis.memoryGrowth).toBeLessThan(50 * 1024 * 1024);
      expect(analysis.gcEfficiency).toBeGreaterThan(30);
    });
  });

  describe('Concurrent Operations Memory Tests', () => {
    test('should not leak memory under concurrent load', async () => {
      const concurrentOperations = 20;
      const iterations = 10;

      for (let i = 0; i < iterations; i++) {
        const initialSnapshot = takeMemorySnapshot('concurrent-load', i);

        // Run concurrent operations
        const promises = Array(concurrentOperations)
          .fill(null)
          .map((_, index) =>
            request(app).get('/api/v1/dashboard/stats').set('Authorization', `Bearer ${userToken}`),
          );

        await Promise.allSettled(promises);

        // Force GC and take snapshot
        if (global.gc) global.gc();
        const postSnapshot = takeMemorySnapshot('concurrent-load-post', i);

        // Small delay between iterations
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      const concurrentSnapshots = memorySnapshots.filter((s) =>
        s.operation.includes('concurrent-load'),
      );
      const analysis = analyzeMemoryUsage('concurrent-load', concurrentSnapshots);

      expect(analysis.leakDetected).toBe(false);
      expect(analysis.memoryGrowth).toBeLessThan(60 * 1024 * 1024);
      expect(analysis.memoryGrowthRate).toBeLessThan(2 * 1024 * 1024); // Less than 2MB per iteration
    });
  });

  describe('Long-Running Process Memory Tests', () => {
    test('should maintain stable memory usage over extended periods', async () => {
      const longRunningIterations = 100;
      const operationSnapshots: MemorySnapshot[] = [];

      // Take initial snapshot
      if (global.gc) global.gc();
      operationSnapshots.push(takeMemorySnapshot('long-running', 0));

      for (let i = 1; i <= longRunningIterations; i++) {
        // Simulate long-running operations
        await Promise.all([
          request(app).get('/api/v1/health').set('Authorization', `Bearer ${userToken}`),
          request(app).get('/api/v1/dashboard/stats').set('Authorization', `Bearer ${userToken}`),
        ]);

        // Take snapshots at intervals
        if (i % 10 === 0) {
          operationSnapshots.push(takeMemorySnapshot('long-running', i));
        }

        // Force GC every 25 iterations
        if (global.gc && i % 25 === 0) {
          global.gc();
          operationSnapshots.push(takeMemorySnapshot('long-running-post-gc', i));
        }

        // Small delay to simulate real usage
        if (i % 20 === 0) {
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
      }

      const analysis = analyzeMemoryUsage('long-running', operationSnapshots);

      expect(analysis.leakDetected).toBe(false);
      expect(analysis.memoryGrowth).toBeLessThan(40 * 1024 * 1024);
      expect(analysis.gcEfficiency).toBeGreaterThan(20);

      // Additional stability checks
      const memoryTrend = operationSnapshots.slice(-5).map((s) => s.heapUsed);
      const avgRecentMemory = memoryTrend.reduce((sum, mem) => sum + mem, 0) / memoryTrend.length;
      const memoryVariance = Math.max(...memoryTrend) - Math.min(...memoryTrend);
      const variancePercentage = (memoryVariance / avgRecentMemory) * 100;

      expect(variancePercentage).toBeLessThan(25); // Less than 25% variance in recent memory usage

      logger.info('Long-running process memory analysis', {
        iterations: longRunningIterations,
        memoryGrowthMB: Math.round((analysis.memoryGrowth / (1024 * 1024)) * 100) / 100,
        gcEfficiency: Math.round(analysis.gcEfficiency),
        memoryVariance: Math.round(variancePercentage),
        leakDetected: analysis.leakDetected,
      });
    });
  });

  describe('Memory Leak Detection Summary', () => {
    test('should pass overall memory efficiency standards', async () => {
      const overallStats = {
        totalTests: memoryAnalyses.length,
        leaksDetected: memoryAnalyses.filter((a) => a.leakDetected).length,
        efficientOperations: memoryAnalyses.filter((a) => a.memoryEfficient).length,
        avgMemoryGrowthMB:
          Math.round(
            (memoryAnalyses.reduce((sum, a) => sum + a.memoryGrowth, 0) /
              memoryAnalyses.length /
              (1024 * 1024)) *
              100,
          ) / 100,
        avgGCEfficiency: Math.round(
          memoryAnalyses.reduce((sum, a) => sum + a.gcEfficiency, 0) / memoryAnalyses.length,
        ),
        totalSnapshots: memorySnapshots.length,
        currentMemoryMB: Math.round(process.memoryUsage().heapUsed / (1024 * 1024)),
      };

      // Overall memory health checks
      expect(overallStats.leaksDetected).toBe(0); // No memory leaks detected
      expect(overallStats.avgMemoryGrowthMB).toBeLessThan(25); // Average growth under 25MB
      expect(overallStats.avgGCEfficiency).toBeGreaterThan(25); // Average GC efficiency above 25%
      expect(overallStats.efficientOperations / overallStats.totalTests).toBeGreaterThan(0.7); // 70% operations should be efficient

      // Memory stability check
      const finalMemory = process.memoryUsage().heapUsed;
      const initialMemory = memorySnapshots[0]?.heapUsed || finalMemory;
      const overallGrowth = finalMemory - initialMemory;
      expect(overallGrowth).toBeLessThan(100 * 1024 * 1024); // Less than 100MB overall growth

      logger.info('Memory leak detection summary', {
        overallStats,
        overallMemoryGrowthMB: Math.round((overallGrowth / (1024 * 1024)) * 100) / 100,
        memoryHealthGrade:
          overallStats.leaksDetected === 0 && overallStats.avgGCEfficiency > 30
            ? 'A'
            : overallStats.leaksDetected === 0 && overallStats.avgGCEfficiency > 20
              ? 'B'
              : overallStats.leaksDetected <= 1
                ? 'C'
                : 'F',
      });
    });
  });
});
