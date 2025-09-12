/**
 * DATABASE QUERY PERFORMANCE TESTS
 *
 * Comprehensive database performance testing to ensure query optimization
 * Target: <100ms for simple queries, <500ms for complex operations
 */

import { PrismaClient } from '@prisma/client';
import { describe, test, expect, beforeAll, afterAll, vi } from 'vitest';

import { logger } from '../../src/utils/logger';
import { AuthTestHelper } from '../helpers/auth-test-helper';

interface QueryPerformanceMetric {
  queryName: string;
  executionTime: number;
  recordCount: number;
  memoryBefore: NodeJS.MemoryUsage;
  memoryAfter: NodeJS.MemoryUsage;
  queryType: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'COMPLEX';
  timestamp: number;
}

interface DatabaseBenchmark {
  queryName: string;
  avgExecutionTime: number;
  minExecutionTime: number;
  maxExecutionTime: number;
  p95ExecutionTime: number;
  target: number;
  iterations: number;
  passed: boolean;
  memoryImpact: number;
}

describe('Database Query Performance Tests', () => {
  let prisma: PrismaClient;
  let authHelper: AuthTestHelper;
  const performanceMetrics: QueryPerformanceMetric[] = [];
  const benchmarkResults: DatabaseBenchmark[] = [];
  const testUsers: any[] = [];
  const testMediaRequests: any[] = [];

  beforeAll(async () => {
    prisma = new PrismaClient();
    authHelper = new AuthTestHelper();

    // Create test data for performance testing
    await setupTestData();

    logger.info('Database performance tests starting', {
      testUsers: testUsers.length,
      testMediaRequests: testMediaRequests.length,
    });
  });

  afterAll(async () => {
    await cleanupTestData();
    await prisma.$disconnect();
    await authHelper.disconnect();

    const avgQueryTime =
      performanceMetrics.reduce((sum, m) => sum + m.executionTime, 0) / performanceMetrics.length;
    logger.info('Database performance tests completed', {
      totalQueries: performanceMetrics.length,
      avgQueryTime: Math.round(avgQueryTime),
      benchmarksPassed: benchmarkResults.filter((r) => r.passed).length,
      benchmarksTotal: benchmarkResults.length,
    });
  });

  const setupTestData = async () => {
    // Create test users for database performance testing
    for (let i = 0; i < 50; i++) {
      const user = await authHelper.createTestUser(`dbperf${i}@test.com`);
      testUsers.push(user);
    }

    // Create test media requests
    for (let i = 0; i < 100; i++) {
      const mediaRequest = await prisma.mediaRequest.create({
        data: {
          title: `Performance Test Movie ${i}`,
          type: 'MOVIE',
          year: 2020 + (i % 5),
          status: i % 3 === 0 ? 'APPROVED' : i % 3 === 1 ? 'PENDING' : 'REJECTED',
          requestedBy: testUsers[i % testUsers.length].id,
          tmdbId: 100000 + i,
          imdbId: `tt${String(1000000 + i)}`,
          overview: `Performance test overview for movie ${i}`,
          genres: ['Action', 'Drama', 'Comedy'][i % 3],
          runtime: 90 + (i % 60),
          posterUrl: `https://example.com/poster${i}.jpg`,
          backdropUrl: `https://example.com/backdrop${i}.jpg`,
        },
      });
      testMediaRequests.push(mediaRequest);
    }
  };

  const cleanupTestData = async () => {
    // Clean up test data
    await prisma.mediaRequest.deleteMany({
      where: {
        title: {
          startsWith: 'Performance Test Movie',
        },
      },
    });

    await prisma.user.deleteMany({
      where: {
        email: {
          startsWith: 'dbperf',
        },
      },
    });
  };

  /**
   * Helper function to measure database query performance
   */
  const measureDatabaseQuery = async <T>(
    queryName: string,
    queryFunction: () => Promise<T>,
    options: {
      iterations?: number;
      target?: number;
      queryType?: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'COMPLEX';
    } = {},
  ): Promise<DatabaseBenchmark> => {
    const { iterations = 10, target = 100, queryType = 'SELECT' } = options;
    const executionTimes: number[] = [];
    let totalMemoryImpact = 0;

    for (let i = 0; i < iterations; i++) {
      const memoryBefore = process.memoryUsage();
      const startTime = performance.now();

      try {
        const result = await queryFunction();
        const executionTime = performance.now() - startTime;
        const memoryAfter = process.memoryUsage();
        const memoryImpact = memoryAfter.heapUsed - memoryBefore.heapUsed;

        executionTimes.push(executionTime);
        totalMemoryImpact += memoryImpact;

        performanceMetrics.push({
          queryName,
          executionTime,
          recordCount: Array.isArray(result) ? result.length : 1,
          memoryBefore,
          memoryAfter,
          queryType,
          timestamp: Date.now(),
        });

        // Small delay to prevent overwhelming the database
        if (i < iterations - 1) {
          await new Promise((resolve) => setTimeout(resolve, 5));
        }
      } catch (error) {
        logger.error(`Error measuring query ${queryName}:`, error);
        executionTimes.push(target * 2); // Penalty for failed queries
      }
    }

    executionTimes.sort((a, b) => a - b);
    const benchmark: DatabaseBenchmark = {
      queryName,
      avgExecutionTime: Math.round(
        executionTimes.reduce((sum, time) => sum + time, 0) / executionTimes.length,
      ),
      minExecutionTime: Math.round(executionTimes[0]),
      maxExecutionTime: Math.round(executionTimes[executionTimes.length - 1]),
      p95ExecutionTime: Math.round(executionTimes[Math.floor(executionTimes.length * 0.95)]),
      target,
      iterations,
      passed: false,
      memoryImpact: Math.round(totalMemoryImpact / iterations),
    };

    benchmark.passed = benchmark.avgExecutionTime <= target;
    benchmarkResults.push(benchmark);

    return benchmark;
  };

  describe('User Query Performance', () => {
    test('should find user by ID within 50ms', async () => {
      const result = await measureDatabaseQuery(
        'findUserById',
        () =>
          prisma.user.findUnique({
            where: { id: testUsers[0].id },
          }),
        { target: 50, iterations: 20 },
      );

      expect(result.avgExecutionTime).toBeLessThan(50);
      expect(result.p95ExecutionTime).toBeLessThan(100);
      expect(result.passed).toBe(true);
    });

    test('should find user by email within 75ms', async () => {
      const result = await measureDatabaseQuery(
        'findUserByEmail',
        () =>
          prisma.user.findUnique({
            where: { email: testUsers[0].email },
          }),
        { target: 75, iterations: 20 },
      );

      expect(result.avgExecutionTime).toBeLessThan(75);
      expect(result.passed).toBe(true);
    });

    test('should list users with pagination within 100ms', async () => {
      const result = await measureDatabaseQuery(
        'listUsersWithPagination',
        () =>
          prisma.user.findMany({
            take: 20,
            skip: 0,
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              email: true,
              plexUsername: true,
              role: true,
              status: true,
              createdAt: true,
            },
          }),
        { target: 100, iterations: 15 },
      );

      expect(result.avgExecutionTime).toBeLessThan(100);
      expect(result.p95ExecutionTime).toBeLessThan(200);
    });

    test('should count total users within 50ms', async () => {
      const result = await measureDatabaseQuery('countUsers', () => prisma.user.count(), {
        target: 50,
        iterations: 25,
      });

      expect(result.avgExecutionTime).toBeLessThan(50);
      expect(result.maxExecutionTime).toBeLessThan(100);
    });
  });

  describe('Media Request Query Performance', () => {
    test('should find media request by ID within 50ms', async () => {
      const result = await measureDatabaseQuery(
        'findMediaRequestById',
        () =>
          prisma.mediaRequest.findUnique({
            where: { id: testMediaRequests[0].id },
            include: {
              requestedByUser: {
                select: { id: true, email: true, plexUsername: true },
              },
            },
          }),
        { target: 50, iterations: 20 },
      );

      expect(result.avgExecutionTime).toBeLessThan(50);
      expect(result.passed).toBe(true);
    });

    test('should list media requests with pagination within 150ms', async () => {
      const result = await measureDatabaseQuery(
        'listMediaRequestsWithPagination',
        () =>
          prisma.mediaRequest.findMany({
            take: 20,
            skip: 0,
            orderBy: { createdAt: 'desc' },
            include: {
              requestedByUser: {
                select: { id: true, plexUsername: true },
              },
            },
          }),
        { target: 150, iterations: 15 },
      );

      expect(result.avgExecutionTime).toBeLessThan(150);
      expect(result.p95ExecutionTime).toBeLessThan(300);
    });

    test('should search media requests by title within 200ms', async () => {
      const result = await measureDatabaseQuery(
        'searchMediaRequestsByTitle',
        () =>
          prisma.mediaRequest.findMany({
            where: {
              title: {
                contains: 'Performance Test',
                mode: 'insensitive',
              },
            },
            take: 50,
          }),
        { target: 200, iterations: 10 },
      );

      expect(result.avgExecutionTime).toBeLessThan(200);
      expect(result.passed).toBe(true);
    });

    test('should filter media requests by status within 100ms', async () => {
      const result = await measureDatabaseQuery(
        'filterMediaRequestsByStatus',
        () =>
          prisma.mediaRequest.findMany({
            where: { status: 'PENDING' },
            orderBy: { createdAt: 'desc' },
            take: 30,
          }),
        { target: 100, iterations: 15 },
      );

      expect(result.avgExecutionTime).toBeLessThan(100);
      expect(result.p95ExecutionTime).toBeLessThan(200);
    });

    test('should count media requests by status within 75ms', async () => {
      const result = await measureDatabaseQuery(
        'countMediaRequestsByStatus',
        () =>
          prisma.mediaRequest.groupBy({
            by: ['status'],
            _count: { status: true },
          }),
        { target: 75, iterations: 20 },
      );

      expect(result.avgExecutionTime).toBeLessThan(75);
      expect(result.passed).toBe(true);
    });
  });

  describe('Complex Query Performance', () => {
    test('should get user statistics within 300ms', async () => {
      const result = await measureDatabaseQuery(
        'getUserStatistics',
        async () => {
          const [totalUsers, activeUsers, adminUsers, totalRequests] = await Promise.all([
            prisma.user.count(),
            prisma.user.count({ where: { status: 'ACTIVE' } }),
            prisma.user.count({ where: { role: 'ADMIN' } }),
            prisma.mediaRequest.count(),
          ]);
          return { totalUsers, activeUsers, adminUsers, totalRequests };
        },
        { target: 300, iterations: 10, queryType: 'COMPLEX' },
      );

      expect(result.avgExecutionTime).toBeLessThan(300);
      expect(result.p95ExecutionTime).toBeLessThan(500);
    });

    test('should get dashboard statistics within 400ms', async () => {
      const result = await measureDatabaseQuery(
        'getDashboardStatistics',
        async () => {
          const [totalRequests, pendingRequests, approvedRequests, recentRequests, topRequesters] =
            await Promise.all([
              prisma.mediaRequest.count(),
              prisma.mediaRequest.count({ where: { status: 'PENDING' } }),
              prisma.mediaRequest.count({ where: { status: 'APPROVED' } }),
              prisma.mediaRequest.findMany({
                where: {
                  createdAt: {
                    gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
                  },
                },
                take: 10,
                orderBy: { createdAt: 'desc' },
                include: { requestedByUser: { select: { plexUsername: true } } },
              }),
              prisma.mediaRequest.groupBy({
                by: ['requestedBy'],
                _count: { requestedBy: true },
                orderBy: { _count: { requestedBy: 'desc' } },
                take: 5,
              }),
            ]);

          return {
            totalRequests,
            pendingRequests,
            approvedRequests,
            recentRequests,
            topRequesters,
          };
        },
        { target: 400, iterations: 8, queryType: 'COMPLEX' },
      );

      expect(result.avgExecutionTime).toBeLessThan(400);
      expect(result.passed).toBe(true);
    });

    test('should perform user activity analysis within 500ms', async () => {
      const result = await measureDatabaseQuery(
        'userActivityAnalysis',
        async () => {
          const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

          return await prisma.user.findMany({
            select: {
              id: true,
              email: true,
              plexUsername: true,
              createdAt: true,
              _count: {
                select: {
                  mediaRequests: {
                    where: {
                      createdAt: { gte: thirtyDaysAgo },
                    },
                  },
                },
              },
              mediaRequests: {
                where: {
                  createdAt: { gte: thirtyDaysAgo },
                },
                select: {
                  status: true,
                  createdAt: true,
                },
              },
            },
          });
        },
        { target: 500, iterations: 5, queryType: 'COMPLEX' },
      );

      expect(result.avgExecutionTime).toBeLessThan(500);
      expect(result.p95ExecutionTime).toBeLessThan(800);
    });
  });

  describe('Database Write Performance', () => {
    test('should insert user within 100ms', async () => {
      let userCounter = 1000;
      const result = await measureDatabaseQuery(
        'insertUser',
        async () => {
          return await prisma.user.create({
            data: {
              email: `perftest${userCounter++}@test.com`,
              plexId: `plex-perf-${userCounter}`,
              plexUsername: `perftest${userCounter}`,
              role: 'USER',
              status: 'ACTIVE',
            },
          });
        },
        { target: 100, iterations: 10, queryType: 'INSERT' },
      );

      expect(result.avgExecutionTime).toBeLessThan(100);
      expect(result.passed).toBe(true);

      // Cleanup
      await prisma.user.deleteMany({
        where: {
          email: { startsWith: 'perftest' },
        },
      });
    });

    test('should insert media request within 150ms', async () => {
      let requestCounter = 2000;
      const result = await measureDatabaseQuery(
        'insertMediaRequest',
        async () => {
          return await prisma.mediaRequest.create({
            data: {
              title: `Perf Test Movie ${requestCounter++}`,
              type: 'MOVIE',
              year: 2024,
              status: 'PENDING',
              requestedBy: testUsers[0].id,
              tmdbId: 200000 + requestCounter,
              overview: 'Performance test movie',
            },
          });
        },
        { target: 150, iterations: 8, queryType: 'INSERT' },
      );

      expect(result.avgExecutionTime).toBeLessThan(150);
      expect(result.p95ExecutionTime).toBeLessThan(300);

      // Cleanup
      await prisma.mediaRequest.deleteMany({
        where: {
          title: { startsWith: 'Perf Test Movie' },
        },
      });
    });

    test('should update media request status within 75ms', async () => {
      const result = await measureDatabaseQuery(
        'updateMediaRequestStatus',
        async () => {
          return await prisma.mediaRequest.update({
            where: { id: testMediaRequests[0].id },
            data: { status: 'APPROVED' },
          });
        },
        { target: 75, iterations: 15, queryType: 'UPDATE' },
      );

      expect(result.avgExecutionTime).toBeLessThan(75);
      expect(result.passed).toBe(true);
    });
  });

  describe('Database Connection and Transaction Performance', () => {
    test('should handle database connection within 50ms', async () => {
      const result = await measureDatabaseQuery(
        'databaseConnection',
        () => prisma.$queryRaw`SELECT 1 as connection_test`,
        { target: 50, iterations: 20 },
      );

      expect(result.avgExecutionTime).toBeLessThan(50);
      expect(result.maxExecutionTime).toBeLessThan(100);
    });

    test('should handle transaction within 200ms', async () => {
      let transactionCounter = 3000;
      const result = await measureDatabaseQuery(
        'transactionPerformance',
        async () => {
          return await prisma.$transaction(async (tx) => {
            const user = await tx.user.create({
              data: {
                email: `transaction${transactionCounter++}@test.com`,
                plexId: `plex-tx-${transactionCounter}`,
                plexUsername: `txtest${transactionCounter}`,
                role: 'USER',
                status: 'ACTIVE',
              },
            });

            const mediaRequest = await tx.mediaRequest.create({
              data: {
                title: `Transaction Test Movie ${transactionCounter}`,
                type: 'MOVIE',
                year: 2024,
                status: 'PENDING',
                requestedBy: user.id,
                tmdbId: 300000 + transactionCounter,
              },
            });

            return { user, mediaRequest };
          });
        },
        { target: 200, iterations: 5, queryType: 'COMPLEX' },
      );

      expect(result.avgExecutionTime).toBeLessThan(200);
      expect(result.passed).toBe(true);

      // Cleanup
      await prisma.user.deleteMany({
        where: { email: { startsWith: 'transaction' } },
      });
    });
  });

  describe('Database Performance Summary', () => {
    test('should maintain overall database performance standards', async () => {
      const overallStats = {
        totalQueries: performanceMetrics.length,
        avgQueryTime:
          performanceMetrics.reduce((sum, m) => sum + m.executionTime, 0) /
          performanceMetrics.length,
        slowQueries: performanceMetrics.filter((m) => m.executionTime > 300).length,
        fastQueries: performanceMetrics.filter((m) => m.executionTime < 50).length,
        avgMemoryImpact:
          performanceMetrics.reduce(
            (sum, m) => sum + (m.memoryAfter.heapUsed - m.memoryBefore.heapUsed),
            0,
          ) / performanceMetrics.length,
        queryTypeBreakdown: {
          select: performanceMetrics.filter((m) => m.queryType === 'SELECT').length,
          insert: performanceMetrics.filter((m) => m.queryType === 'INSERT').length,
          update: performanceMetrics.filter((m) => m.queryType === 'UPDATE').length,
          complex: performanceMetrics.filter((m) => m.queryType === 'COMPLEX').length,
        },
      };

      // Overall performance expectations
      expect(overallStats.avgQueryTime).toBeLessThan(150); // Average query time under 150ms
      expect(overallStats.slowQueries / overallStats.totalQueries).toBeLessThan(0.1); // Less than 10% slow queries
      expect(overallStats.fastQueries / overallStats.totalQueries).toBeGreaterThan(0.4); // More than 40% fast queries
      expect(overallStats.avgMemoryImpact).toBeLessThan(10 * 1024 * 1024); // Average memory impact under 10MB

      // Benchmark pass rate
      const passedBenchmarks = benchmarkResults.filter((r) => r.passed).length;
      const passRate = passedBenchmarks / benchmarkResults.length;
      expect(passRate).toBeGreaterThan(0.8); // 80% of database benchmarks should pass

      logger.info('Database performance summary', {
        overallStats,
        benchmarkPassRate: `${Math.round(passRate * 100)}%`,
        totalBenchmarks: benchmarkResults.length,
      });
    });
  });
});
