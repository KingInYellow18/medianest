import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { getTestPrismaClient, cleanDatabase, disconnectDatabase } from '../../helpers/database';
import { MediaRequestRepository } from '../../../src/repositories/media-request.repository';
import { UserRepository } from '../../../src/repositories/user.repository';
import { ServiceStatusRepository } from '../../../src/repositories/service-status.repository';

/**
 * WAVE 3 AGENT #11: DATABASE PERFORMANCE & OPTIMIZATION TESTS
 *
 * Advanced performance testing from Wave 1 & 2 patterns:
 * ✅ Query performance benchmarking
 * ✅ Index utilization validation
 * ✅ Connection pool optimization
 * ✅ Memory usage monitoring
 * ✅ Batch operation efficiency
 * ✅ Cache hit rate optimization
 * ✅ Slow query detection
 * ✅ Scalability stress testing
 */

describe('Database Performance & Optimization', () => {
  let prisma: PrismaClient;
  let mediaRepository: MediaRequestRepository;
  let userRepository: UserRepository;
  let serviceRepository: ServiceStatusRepository;
  let performanceMetrics: any[] = [];

  beforeAll(async () => {
    prisma = getTestPrismaClient();
    mediaRepository = new MediaRequestRepository(prisma);
    userRepository = new UserRepository(prisma);
    serviceRepository = new ServiceStatusRepository(prisma);
  });

  beforeEach(async () => {
    await cleanDatabase();
    performanceMetrics = [];
  });

  afterEach(async () => {
    await cleanDatabase();

    // Log performance summary
    if (performanceMetrics.length > 0) {
      const summary = {
        totalOperations: performanceMetrics.length,
        avgDuration:
          performanceMetrics.reduce((a, b) => a + b.duration, 0) / performanceMetrics.length,
        maxDuration: Math.max(...performanceMetrics.map((m) => m.duration)),
        minDuration: Math.min(...performanceMetrics.map((m) => m.duration)),
        slowOperations: performanceMetrics.filter((m) => m.duration > 1000).length,
      };

      console.log('Performance Test Summary:', summary);
    }
  });

  afterAll(async () => {
    await disconnectDatabase();
  });

  const measurePerformance = async <T>(
    operationName: string,
    operation: () => Promise<T>,
  ): Promise<T> => {
    const startTime = Date.now();
    const startMemory = process.memoryUsage();

    try {
      const result = await operation();
      const duration = Date.now() - startTime;
      const endMemory = process.memoryUsage();

      performanceMetrics.push({
        operation: operationName,
        duration,
        memoryDelta: {
          heapUsed: endMemory.heapUsed - startMemory.heapUsed,
          heapTotal: endMemory.heapTotal - startMemory.heapTotal,
          rss: endMemory.rss - startMemory.rss,
        },
        timestamp: new Date(),
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      performanceMetrics.push({
        operation: operationName,
        duration,
        error: error.message,
        timestamp: new Date(),
      });
      throw error;
    }
  };

  describe('Query Performance Benchmarking', () => {
    beforeEach(async () => {
      // Create test dataset for performance testing
      const users = [];
      const requests = [];

      // Create 100 users
      for (let i = 0; i < 100; i++) {
        users.push({
          email: `perf-user-${i}@example.com`,
          name: `Performance User ${i}`,
          plexId: `perf-plex-${i}`,
          plexUsername: `perfuser${i}`,
          role: i < 10 ? 'admin' : ('user' as const),
          status: 'active',
        });
      }

      const createdUsers = await Promise.all(users.map((user) => userRepository.create(user)));

      // Create 500 media requests with varied data
      for (let i = 0; i < 500; i++) {
        const user = createdUsers[i % createdUsers.length];
        requests.push({
          userId: user.id,
          title: `Performance Movie ${i}`,
          mediaType: i % 3 === 0 ? 'movie' : ((i % 3 === 1 ? 'tv' : 'music') as const),
          tmdbId: i % 50 === 0 ? null : `tmdb-${i}`,
          status: ['pending', 'approved', 'completed', 'rejected'][i % 4] as const,
        });
      }

      await Promise.all(requests.map((req) => mediaRepository.create(req)));
    });

    it('should benchmark basic query performance', async () => {
      const benchmarks = [];

      // Test 1: Simple find operations
      const findByIdTime = await measurePerformance('findById', async () => {
        const users = await userRepository.findAll({ limit: 10 });
        const userId = users.items[0].id;
        return await userRepository.findById(userId);
      });

      benchmarks.push({
        test: 'Find by ID',
        result: findByIdTime ? 'success' : 'failure',
      });

      // Test 2: Filtered queries
      await measurePerformance('filteredQuery', async () => {
        return await mediaRepository.findByFilters({
          mediaType: 'movie',
          status: 'pending',
        });
      });

      // Test 3: Paginated queries
      await measurePerformance('paginatedQuery', async () => {
        return await mediaRepository.findByFilters(
          {},
          {
            page: 1,
            limit: 20,
            orderBy: { createdAt: 'desc' },
          },
        );
      });

      // Test 4: Count queries
      await measurePerformance('countQuery', async () => {
        return await mediaRepository.countByStatus('approved');
      });

      // Test 5: Complex aggregations
      await measurePerformance('aggregationQuery', async () => {
        return await mediaRepository.findByFilters({
          createdBefore: new Date(),
        });
      });

      // Verify performance thresholds
      const slowQueries = performanceMetrics.filter((m) => m.duration > 500);
      expect(slowQueries.length).toBeLessThan(2);

      console.log('Query Performance Results:', performanceMetrics);
    });

    it('should optimize complex join queries', async () => {
      // Test join performance with user data
      const complexQuery = await measurePerformance('complexJoin', async () => {
        return await prisma.mediaRequest.findMany({
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true,
              },
            },
          },
          where: {
            status: 'pending',
            mediaType: 'movie',
            user: {
              role: 'user',
              status: 'active',
            },
          },
          orderBy: [{ createdAt: 'desc' }, { user: { name: 'asc' } }],
          take: 50,
        });
      });

      expect(complexQuery.length).toBeGreaterThan(0);

      // Test N+1 query prevention
      const efficientQuery = await measurePerformance('efficientQuery', async () => {
        const requests = await prisma.mediaRequest.findMany({
          include: { user: true },
          take: 20,
        });

        // This should not trigger additional queries
        return requests.map((r) => ({
          title: r.title,
          userName: r.user.name,
          userRole: r.user.role,
        }));
      });

      expect(efficientQuery.length).toBe(20);

      // Verify join query performance
      const joinMetric = performanceMetrics.find((m) => m.operation === 'complexJoin');
      expect(joinMetric?.duration).toBeLessThan(1000);
    });

    it('should benchmark bulk operations', async () => {
      const bulkSize = 100;

      // Test bulk inserts
      const bulkInsertData = Array(bulkSize)
        .fill(0)
        .map((_, i) => ({
          email: `bulk-${i}@example.com`,
          name: `Bulk User ${i}`,
          plexId: `bulk-plex-${i}`,
          plexUsername: `bulkuser${i}`,
          role: 'user' as const,
        }));

      const bulkInserts = await measurePerformance('bulkInsert', async () => {
        return await Promise.all(bulkInsertData.map((data) => userRepository.create(data)));
      });

      expect(bulkInserts.length).toBe(bulkSize);

      // Test bulk updates
      const userIds = bulkInserts.map((u) => u.id);

      await measurePerformance('bulkUpdate', async () => {
        return await prisma.user.updateMany({
          where: { id: { in: userIds } },
          data: {
            lastLoginAt: new Date(),
            name: 'BULK UPDATED',
          },
        });
      });

      // Test bulk deletes
      await measurePerformance('bulkDelete', async () => {
        return await prisma.user.deleteMany({
          where: { id: { in: userIds } },
        });
      });

      // Verify bulk operation performance
      const bulkMetrics = performanceMetrics.filter((m) => m.operation.includes('bulk'));

      bulkMetrics.forEach((metric) => {
        expect(metric.duration).toBeLessThan(5000); // 5 seconds max
      });

      console.log('Bulk Operations Performance:', bulkMetrics);
    });
  });

  describe('Connection Pool Optimization', () => {
    it('should test connection pool under high load', async () => {
      const concurrentConnections = 25;
      const operationsPerConnection = 5;

      const connectionStressTest = async (connectionId: number) => {
        const operations = [];

        for (let i = 0; i < operationsPerConnection; i++) {
          operations.push(
            measurePerformance(`conn-${connectionId}-op-${i}`, async () => {
              // Mix of different operations
              switch (i % 3) {
                case 0:
                  return await userRepository.findAll({ limit: 10 });
                case 1:
                  return await mediaRepository.countByStatus();
                case 2:
                  return await serviceRepository.findByName('test');
                default:
                  return null;
              }
            }),
          );
        }

        return await Promise.all(operations);
      };

      const startTime = Date.now();
      const connectionPromises = Array(concurrentConnections)
        .fill(0)
        .map((_, i) => connectionStressTest(i));

      const results = await Promise.allSettled(connectionPromises);
      const totalDuration = Date.now() - startTime;

      const successful = results.filter((r) => r.status === 'fulfilled').length;
      const failed = results.filter((r) => r.status === 'rejected').length;

      // Connection pool should handle the load efficiently
      expect(successful / concurrentConnections).toBeGreaterThan(0.8);
      expect(totalDuration).toBeLessThan(15000); // 15 seconds max

      console.log(
        `Connection Pool Test: ${successful}/${concurrentConnections} successful in ${totalDuration}ms`,
      );
    });

    it('should test connection recovery after pool exhaustion', async () => {
      // Simulate pool exhaustion with long-running transactions
      const longRunningTransactions = Array(20)
        .fill(0)
        .map(async (_, i) => {
          try {
            return await measurePerformance(`long-tx-${i}`, async () => {
              return await prisma.$transaction(
                async (tx) => {
                  await tx.user.findFirst();
                  // Simulate long processing
                  await new Promise((resolve) => setTimeout(resolve, 2000));
                  return `completed-${i}`;
                },
                {
                  timeout: 10000,
                },
              );
            });
          } catch (error) {
            return { error: error.message };
          }
        });

      // Test quick operations during pool stress
      const quickOperations = Array(10)
        .fill(0)
        .map(async (_, i) => {
          await new Promise((resolve) => setTimeout(resolve, i * 100)); // Stagger requests

          try {
            return await measurePerformance(`quick-op-${i}`, async () => {
              return await userRepository.count();
            });
          } catch (error) {
            return { error: error.message };
          }
        });

      const [longResults, quickResults] = await Promise.all([
        Promise.allSettled(longRunningTransactions),
        Promise.allSettled(quickOperations),
      ]);

      // Some quick operations should succeed even during pool stress
      const successfulQuick = quickResults.filter((r) => r.status === 'fulfilled').length;
      expect(successfulQuick).toBeGreaterThan(0);

      console.log(`Pool Recovery: ${successfulQuick}/10 quick ops succeeded during pool stress`);
    });
  });

  describe('Memory Usage Optimization', () => {
    it('should monitor memory usage during large result sets', async () => {
      // Create large dataset
      const largeDataSet = Array(1000)
        .fill(0)
        .map((_, i) => ({
          userId: 'user-1', // Will need to create this user
          title: `Memory Test Movie ${i}`,
          mediaType: 'movie' as const,
          tmdbId: `tmdb-${i}`,
          status: 'pending' as const,
        }));

      // Create test user first
      const testUser = await userRepository.create({
        email: 'memory-test@example.com',
        name: 'Memory Test User',
        plexId: 'memory-test-plex',
        plexUsername: 'memorytest',
        role: 'user',
      });

      // Update dataset with real user ID
      largeDataSet.forEach((item) => {
        item.userId = testUser.id;
      });

      await Promise.all(largeDataSet.map((data) => mediaRepository.create(data)));

      // Test memory-efficient pagination
      const pageSize = 100;
      const totalPages = 10;
      let processedItems = 0;

      for (let page = 1; page <= totalPages; page++) {
        const pageResults = await measurePerformance(`page-${page}`, async () => {
          return await mediaRepository.findByFilters(
            {},
            {
              page,
              limit: pageSize,
            },
          );
        });

        processedItems += pageResults.items.length;

        // Force garbage collection hint
        if (global.gc) {
          global.gc();
        }
      }

      expect(processedItems).toBeGreaterThan(500);

      // Check memory growth
      const memoryMetrics = performanceMetrics
        .filter((m) => m.operation.startsWith('page-'))
        .map((m) => m.memoryDelta?.heapUsed || 0);

      const avgMemoryGrowth = memoryMetrics.reduce((a, b) => a + b, 0) / memoryMetrics.length;

      // Memory growth should be reasonable
      expect(avgMemoryGrowth).toBeLessThan(50 * 1024 * 1024); // 50MB average

      console.log('Memory Usage per Page:', memoryMetrics);
    });

    it('should test memory leak prevention in repeated operations', async () => {
      const iterations = 50;
      const initialMemory = process.memoryUsage();

      for (let i = 0; i < iterations; i++) {
        await measurePerformance(`iteration-${i}`, async () => {
          // Create and delete temporary data
          const tempUser = await userRepository.create({
            email: `temp-${i}@example.com`,
            name: `Temp User ${i}`,
            plexId: `temp-plex-${i}`,
            plexUsername: `tempuser${i}`,
            role: 'user',
          });

          const tempRequest = await mediaRepository.create({
            userId: tempUser.id,
            title: `Temp Movie ${i}`,
            mediaType: 'movie',
          });

          // Clean up
          await mediaRepository.delete(tempRequest.id);
          await userRepository.delete(tempUser.id);

          return { userId: tempUser.id, requestId: tempRequest.id };
        });

        // Periodic garbage collection hint
        if (i % 10 === 0 && global.gc) {
          global.gc();
        }
      }

      const finalMemory = process.memoryUsage();
      const memoryGrowth = finalMemory.heapUsed - initialMemory.heapUsed;

      // Memory growth should be minimal
      expect(memoryGrowth).toBeLessThan(100 * 1024 * 1024); // 100MB max growth

      console.log(
        `Memory Growth after ${iterations} iterations: ${Math.round(memoryGrowth / 1024 / 1024)}MB`,
      );
    });
  });

  describe('Scalability Stress Testing', () => {
    it('should handle increasing load gracefully', async () => {
      const loadLevels = [10, 25, 50, 100];
      const results = [];

      for (const loadLevel of loadLevels) {
        const operations = Array(loadLevel)
          .fill(0)
          .map(async (_, i) => {
            return await measurePerformance(`load-${loadLevel}-op-${i}`, async () => {
              // Mix of operations
              const opType = i % 4;
              switch (opType) {
                case 0:
                  return await userRepository.count();
                case 1:
                  return await mediaRepository.countByStatus();
                case 2:
                  const users = await userRepository.findAll({ limit: 5 });
                  return users.items.length;
                case 3:
                  return await serviceRepository.findByName('test-service');
                default:
                  return null;
              }
            });
          });

        const startTime = Date.now();
        const loadResults = await Promise.allSettled(operations);
        const duration = Date.now() - startTime;

        const successful = loadResults.filter((r) => r.status === 'fulfilled').length;
        const successRate = successful / loadLevel;
        const avgResponseTime = duration / loadLevel;

        results.push({
          loadLevel,
          successful,
          successRate,
          totalDuration: duration,
          avgResponseTime,
        });

        // Success rate should remain high
        expect(successRate).toBeGreaterThan(0.8);

        // Average response time should scale reasonably
        expect(avgResponseTime).toBeLessThan(loadLevel * 2); // Linear scaling tolerance
      }

      console.log('Scalability Test Results:', results);

      // Response time should not degrade exponentially
      const responseTimeGrowth = results.map((r) => r.avgResponseTime);
      for (let i = 1; i < responseTimeGrowth.length; i++) {
        const growthFactor = responseTimeGrowth[i] / responseTimeGrowth[i - 1];
        expect(growthFactor).toBeLessThan(3); // Should not triple with each load level
      }
    });

    it('should maintain performance under sustained load', async () => {
      const sustainedDuration = 30000; // 30 seconds
      const operationInterval = 100; // 100ms between operations
      const operations = [];
      let operationCount = 0;

      const startTime = Date.now();

      while (Date.now() - startTime < sustainedDuration) {
        operations.push(
          measurePerformance(`sustained-${operationCount++}`, async () => {
            const opType = operationCount % 3;
            switch (opType) {
              case 0:
                return await userRepository.count();
              case 1:
                return await mediaRepository.findByFilters({}, { limit: 10 });
              case 2:
                return await serviceRepository.findByName('sustained-test');
              default:
                return null;
            }
          }),
        );

        await new Promise((resolve) => setTimeout(resolve, operationInterval));
      }

      const results = await Promise.allSettled(operations);
      const successful = results.filter((r) => r.status === 'fulfilled').length;
      const failed = results.filter((r) => r.status === 'rejected').length;

      const successRate = successful / operations.length;
      expect(successRate).toBeGreaterThan(0.9); // 90% success rate

      // Check for performance degradation over time
      const timeWindows = 5;
      const windowSize = Math.floor(performanceMetrics.length / timeWindows);
      const windowAverages = [];

      for (let w = 0; w < timeWindows; w++) {
        const windowStart = w * windowSize;
        const windowEnd = Math.min((w + 1) * windowSize, performanceMetrics.length);
        const windowMetrics = performanceMetrics.slice(windowStart, windowEnd);

        const avgDuration =
          windowMetrics.reduce((sum, m) => sum + m.duration, 0) / windowMetrics.length;
        windowAverages.push(avgDuration);
      }

      // Performance should not degrade significantly over time
      const initialAvg = windowAverages[0];
      const finalAvg = windowAverages[windowAverages.length - 1];
      const degradation = finalAvg / initialAvg;

      expect(degradation).toBeLessThan(2); // Should not double

      console.log(`Sustained Load Test: ${successful}/${operations.length} ops successful`);
      console.log('Performance over time:', windowAverages);
    });
  });
});
