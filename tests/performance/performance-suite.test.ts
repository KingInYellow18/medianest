/**
 * Dedicated Performance Test Suite
 * Separated from main test suite for focused performance benchmarking
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { TestDatabase, setupTestDatabase, cleanupTestDatabase } from '../shared/test-database';
import { TestServer, setupTestServer, cleanupTestServer } from '../shared/test-server';
import { AuthenticationMock, setupAuthMocks, cleanupAuthMocks } from '../shared/test-authentication';
import { UserFixtures, MediaFixtures } from '../shared/test-fixtures';

interface PerformanceMetrics {
  executionTime: number;
  memoryUsage: number;
  throughput: number;
  responseTime: number;
  errorRate: number;
}

describe('Performance Test Suite', () => {
  let testDb: TestDatabase;
  let testServer: TestServer;
  let authMock: AuthenticationMock;

  beforeAll(async () => {
    // Setup optimized test infrastructure for performance testing
    testDb = await setupTestDatabase({ 
      seed: false, 
      isolate: true,
      cleanup: false // Keep data for multiple tests
    });
    
    testServer = await setupTestServer({ 
      database: testDb,
      port: 0 // Random port for parallel execution
    });
    
    authMock = setupAuthMocks({ database: testDb });
    
    // Pre-populate with large dataset for realistic testing
    await setupLargeTestDataset();
  });

  afterAll(async () => {
    await cleanupTestDatabase(testDb);
    await cleanupTestServer(testServer);
    cleanupAuthMocks(authMock);
  });

  beforeEach(() => {
    // Clear any test-specific state but preserve data
    global.gc && global.gc(); // Trigger garbage collection if available
  });

  /**
   * Setup large test dataset for performance testing
   */
  async function setupLargeTestDataset(): Promise<void> {
    const client = testDb.getClient();
    
    // Create 1000 users
    const users = UserFixtures.createUsers(1000);
    await client.user.createMany({ data: users.map(user => ({
      ...user,
      createdAt: new Date(),
      updatedAt: new Date()
    })) });
    
    // Create 5000 media items
    const movies = MediaFixtures.createMovies(5000);
    await client.media.createMany({ data: movies.map(movie => ({
      ...movie,
      addedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    })) });
    
    console.log('Performance test dataset created: 1000 users, 5000 media items');
  }

  /**
   * Measure performance metrics for a given operation
   */
  async function measurePerformance<T>(
    operation: () => Promise<T>,
    name: string
  ): Promise<{ result: T; metrics: PerformanceMetrics }> {
    const startTime = Date.now();
    const startMemory = process.memoryUsage();
    
    let result: T;
    let errorOccurred = false;
    
    try {
      result = await operation();
    } catch (error) {
      errorOccurred = true;
      throw error;
    } finally {
      const endTime = Date.now();
      const endMemory = process.memoryUsage();
      
      const metrics: PerformanceMetrics = {
        executionTime: endTime - startTime,
        memoryUsage: endMemory.heapUsed - startMemory.heapUsed,
        throughput: 1000 / (endTime - startTime), // Operations per second
        responseTime: endTime - startTime,
        errorRate: errorOccurred ? 1 : 0
      };
      
      console.log(`Performance [${name}]:`, {
        time: `${metrics.executionTime}ms`,
        memory: `${Math.round(metrics.memoryUsage / 1024 / 1024)}MB`,
        throughput: `${metrics.throughput.toFixed(2)} ops/sec`
      });
    }
    
    return { result: result!, metrics };
  }

  describe('Database Performance', () => {
    it('should efficiently query large user dataset', async () => {
      const client = testDb.getClient();
      
      const { result, metrics } = await measurePerformance(async () => {
        return client.user.findMany({
          take: 100,
          skip: 0,
          orderBy: { createdAt: 'desc' }
        });
      }, 'Large User Query');
      
      expect(result).toHaveLength(100);
      expect(metrics.executionTime).toBeLessThan(500); // Should complete within 500ms
      expect(metrics.memoryUsage).toBeLessThan(50 * 1024 * 1024); // Less than 50MB
    });

    it('should efficiently perform complex media searches', async () => {
      const client = testDb.getClient();
      
      const { result, metrics } = await measurePerformance(async () => {
        return client.media.findMany({
          where: {
            OR: [
              { title: { contains: 'Test', mode: 'insensitive' } },
              { summary: { contains: 'test', mode: 'insensitive' } }
            ],
            type: 'movie',
            year: { gte: 2020 }
          },
          take: 50,
          orderBy: { rating: 'desc' }
        });
      }, 'Complex Media Search');
      
      expect(result.length).toBeGreaterThan(0);
      expect(metrics.executionTime).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should handle concurrent database operations', async () => {
      const client = testDb.getClient();
      const concurrentQueries = 50;
      
      const { result, metrics } = await measurePerformance(async () => {
        const promises = Array.from({ length: concurrentQueries }, (_, i) =>
          client.user.findMany({
            take: 10,
            skip: i * 10,
            orderBy: { createdAt: 'desc' }
          })
        );
        
        return Promise.all(promises);
      }, 'Concurrent Database Operations');
      
      expect(result).toHaveLength(concurrentQueries);
      expect(metrics.executionTime).toBeLessThan(3000); // Should complete within 3 seconds
      expect(metrics.errorRate).toBe(0);
    });

    it('should efficiently perform pagination with large offsets', async () => {
      const client = testDb.getClient();
      
      const { result, metrics } = await measurePerformance(async () => {
        return client.media.findMany({
          take: 20,
          skip: 4000, // Large offset
          orderBy: { createdAt: 'desc' }
        });
      }, 'Large Offset Pagination');
      
      expect(result).toHaveLength(20);
      expect(metrics.executionTime).toBeLessThan(800); // Should complete within 800ms
    });

    it('should handle batch operations efficiently', async () => {
      const client = testDb.getClient();
      const batchSize = 100;
      
      const watchHistoryData = Array.from({ length: batchSize }, (_, i) => ({
        userId: `user-batch-${String(Math.floor(i / 10) + 1).padStart(3, '0')}`,
        mediaId: `movie-batch-${String((i % 100) + 1).padStart(3, '0')}`,
        watchedAt: new Date(Date.now() - i * 3600000),
        progress: Math.random(),
        duration: 7200000,
        sessionId: `session-batch-${i}`,
        deviceType: 'web',
        deviceName: 'Test Device',
        createdAt: new Date(),
        updatedAt: new Date()
      }));
      
      const { result, metrics } = await measurePerformance(async () => {
        return client.watchHistory.createMany({
          data: watchHistoryData,
          skipDuplicates: true
        });
      }, 'Batch Insert Operations');
      
      expect(result.count).toBeLessThanOrEqual(batchSize);
      expect(metrics.executionTime).toBeLessThan(1000); // Should complete within 1 second
    });
  });

  describe('API Performance', () => {
    it('should handle high-throughput API requests', async () => {
      const user = UserFixtures.testUser();
      authMock.mockAuthenticatedRequest(user);
      
      const requestCount = 100;
      
      const { result, metrics } = await measurePerformance(async () => {
        const promises = Array.from({ length: requestCount }, (_, i) =>
          testServer.request('GET', `/api/media?page=${i % 10 + 1}&limit=10`, {
            headers: authMock.createAuthHeaders(user)
          })
        );
        
        return Promise.all(promises);
      }, 'High Throughput API Requests');
      
      const successfulRequests = result.filter(r => r.status === 200);
      expect(successfulRequests.length).toBeGreaterThan(requestCount * 0.9); // At least 90% success
      expect(metrics.executionTime).toBeLessThan(10000); // Should complete within 10 seconds
      expect(metrics.throughput).toBeGreaterThan(5); // At least 5 requests per second
    });

    it('should efficiently handle search operations', async () => {
      const user = UserFixtures.testUser();
      authMock.mockAuthenticatedRequest(user);
      
      const searchTerms = ['test', 'movie', 'action', 'drama', 'comedy'];
      
      const { result, metrics } = await measurePerformance(async () => {
        const promises = searchTerms.map(term =>
          testServer.request('GET', `/api/media/search?q=${term}&limit=20`, {
            headers: authMock.createAuthHeaders(user)
          })
        );
        
        return Promise.all(promises);
      }, 'API Search Operations');
      
      result.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.data.results).toBeDefined();
      });
      
      expect(metrics.executionTime).toBeLessThan(2000); // Should complete within 2 seconds
    });

    it('should handle concurrent user sessions', async () => {
      const users = UserFixtures.createUsers(50);
      const sessionCount = users.length;
      
      const { result, metrics } = await measurePerformance(async () => {
        const promises = users.map(user => {
          authMock.mockAuthenticatedRequest(user);
          return testServer.request('GET', '/api/user/profile', {
            headers: authMock.createAuthHeaders(user)
          });
        });
        
        return Promise.all(promises);
      }, 'Concurrent User Sessions');
      
      const successfulSessions = result.filter(r => r.status === 200);
      expect(successfulSessions.length).toBe(sessionCount);
      expect(metrics.executionTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should efficiently stream large responses', async () => {
      const user = UserFixtures.testUser();
      authMock.mockAuthenticatedRequest(user);
      
      const { result, metrics } = await measurePerformance(async () => {
        return testServer.request('GET', '/api/media?limit=1000', {
          headers: authMock.createAuthHeaders(user)
        });
      }, 'Large Response Streaming');
      
      expect(result.status).toBe(200);
      expect(result.body.data.items.length).toBeGreaterThan(0);
      expect(metrics.executionTime).toBeLessThan(3000); // Should complete within 3 seconds
      expect(metrics.memoryUsage).toBeLessThan(100 * 1024 * 1024); // Less than 100MB
    });
  });

  describe('Memory and Resource Management', () => {
    it('should maintain stable memory usage under load', async () => {
      const user = UserFixtures.testUser();
      authMock.mockAuthenticatedRequest(user);
      
      const iterations = 10;
      const memorySnapshots: number[] = [];
      
      for (let i = 0; i < iterations; i++) {
        await testServer.request('GET', '/api/media?limit=100', {
          headers: authMock.createAuthHeaders(user)
        });
        
        // Force garbage collection if available
        global.gc && global.gc();
        
        memorySnapshots.push(process.memoryUsage().heapUsed);
        
        // Small delay to allow for cleanup
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // Check for memory leaks (memory should stabilize, not continuously grow)
      const firstHalf = memorySnapshots.slice(0, Math.floor(iterations / 2));
      const secondHalf = memorySnapshots.slice(Math.floor(iterations / 2));
      
      const avgFirstHalf = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
      const avgSecondHalf = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
      
      const memoryGrowth = (avgSecondHalf - avgFirstHalf) / avgFirstHalf;
      
      expect(memoryGrowth).toBeLessThan(0.1); // Less than 10% memory growth
    });

    it('should handle connection pool efficiently', async () => {
      const client = testDb.getClient();
      const connectionTests = 20;
      
      const { result, metrics } = await measurePerformance(async () => {
        const promises = Array.from({ length: connectionTests }, async () => {
          const startTime = Date.now();
          await client.user.count();
          return Date.now() - startTime;
        });
        
        return Promise.all(promises);
      }, 'Connection Pool Management');
      
      const avgConnectionTime = result.reduce((a, b) => a + b, 0) / result.length;
      
      expect(avgConnectionTime).toBeLessThan(50); // Average connection time less than 50ms
      expect(metrics.executionTime).toBeLessThan(2000); // Total time less than 2 seconds
    });

    it('should recover gracefully from resource exhaustion', async () => {
      // Simulate resource exhaustion scenario
      const heavyOperations = Array.from({ length: 100 }, (_, i) => ({
        operation: () => testDb.getClient().media.findMany({ 
          take: 100, 
          skip: i * 100,
          include: { userMedia: true, watchHistory: true }
        }),
        id: i
      }));
      
      const { result, metrics } = await measurePerformance(async () => {
        const results = [];
        const errors = [];
        
        // Execute operations with some expected to fail
        for (const { operation, id } of heavyOperations) {
          try {
            const result = await operation();
            results.push({ id, success: true, count: result.length });
          } catch (error) {
            errors.push({ id, error: error.message });
          }
        }
        
        return { results, errors };
      }, 'Resource Exhaustion Recovery');
      
      // Should complete most operations successfully
      const successRate = result.results.length / heavyOperations.length;
      expect(successRate).toBeGreaterThan(0.8); // At least 80% success rate
      
      // Should recover from errors gracefully
      expect(metrics.errorRate).toBeLessThan(0.2); // Less than 20% error rate
    });
  });

  describe('Performance Benchmarks', () => {
    it('should meet response time SLA for critical endpoints', async () => {
      const user = UserFixtures.testUser();
      authMock.mockAuthenticatedRequest(user);
      
      const criticalEndpoints = [
        { path: '/api/user/profile', maxTime: 200 },
        { path: '/api/media?limit=20', maxTime: 500 },
        { path: '/api/media/search?q=test', maxTime: 800 },
        { path: '/api/user/preferences', maxTime: 300 }
      ];
      
      for (const endpoint of criticalEndpoints) {
        const { metrics } = await measurePerformance(async () => {
          return testServer.request('GET', endpoint.path, {
            headers: authMock.createAuthHeaders(user)
          });
        }, `SLA Check: ${endpoint.path}`);
        
        expect(metrics.executionTime).toBeLessThan(endpoint.maxTime);
      }
    });

    it('should scale linearly with data size', async () => {
      const client = testDb.getClient();
      const dataSizes = [10, 50, 100, 500];
      const results = [];
      
      for (const size of dataSizes) {
        const { metrics } = await measurePerformance(async () => {
          return client.media.findMany({
            take: size,
            orderBy: { createdAt: 'desc' }
          });
        }, `Scale Test: ${size} items`);
        
        results.push({ size, time: metrics.executionTime });
      }
      
      // Check if scaling is roughly linear (not exponential)
      const timeGrowthRatio = results[3].time / results[0].time; // 500 vs 10 items
      const dataGrowthRatio = dataSizes[3] / dataSizes[0]; // 50x data
      
      expect(timeGrowthRatio).toBeLessThan(dataGrowthRatio * 2); // Time should not grow more than 2x data growth
    });

    it('should maintain performance under sustained load', async () => {
      const user = UserFixtures.testUser();
      authMock.mockAuthenticatedRequest(user);
      
      const loadDuration = 30000; // 30 seconds
      const requestInterval = 100; // Request every 100ms
      const startTime = Date.now();
      const results = [];
      
      while (Date.now() - startTime < loadDuration) {
        const requestStart = Date.now();
        
        const response = await testServer.request('GET', '/api/media?limit=10', {
          headers: authMock.createAuthHeaders(user)
        });
        
        const requestTime = Date.now() - requestStart;
        
        results.push({
          timestamp: Date.now() - startTime,
          responseTime: requestTime,
          success: response.status === 200
        });
        
        // Wait for next interval
        await new Promise(resolve => setTimeout(resolve, requestInterval));
      }
      
      // Analyze performance over time
      const avgResponseTime = results.reduce((sum, r) => sum + r.responseTime, 0) / results.length;
      const successRate = results.filter(r => r.success).length / results.length;
      
      expect(avgResponseTime).toBeLessThan(500); // Average response time under 500ms
      expect(successRate).toBeGreaterThan(0.95); // 95% success rate
      
      // Check for performance degradation over time
      const firstQuarter = results.slice(0, Math.floor(results.length / 4));
      const lastQuarter = results.slice(-Math.floor(results.length / 4));
      
      const avgFirstQuarter = firstQuarter.reduce((sum, r) => sum + r.responseTime, 0) / firstQuarter.length;
      const avgLastQuarter = lastQuarter.reduce((sum, r) => sum + r.responseTime, 0) / lastQuarter.length;
      
      const performanceDegradation = (avgLastQuarter - avgFirstQuarter) / avgFirstQuarter;
      
      expect(performanceDegradation).toBeLessThan(0.3); // Less than 30% performance degradation
    });
  });

  describe('Performance Regression Detection', () => {
    it('should detect performance regressions in database queries', async () => {
      const client = testDb.getClient();
      const baselineMetrics = [];
      const currentMetrics = [];
      
      // Run baseline tests
      for (let i = 0; i < 5; i++) {
        const { metrics } = await measurePerformance(async () => {
          return client.user.findMany({ take: 100 });
        }, `Baseline Run ${i + 1}`);
        
        baselineMetrics.push(metrics.executionTime);
      }
      
      // Simulate some system changes (could be actual code changes in real scenario)
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Run current tests
      for (let i = 0; i < 5; i++) {
        const { metrics } = await measurePerformance(async () => {
          return client.user.findMany({ take: 100 });
        }, `Current Run ${i + 1}`);
        
        currentMetrics.push(metrics.executionTime);
      }
      
      const avgBaseline = baselineMetrics.reduce((a, b) => a + b) / baselineMetrics.length;
      const avgCurrent = currentMetrics.reduce((a, b) => a + b) / currentMetrics.length;
      
      const performanceChange = (avgCurrent - avgBaseline) / avgBaseline;
      
      // Alert if performance degraded by more than 20%
      if (performanceChange > 0.2) {
        console.warn(`Performance regression detected: ${(performanceChange * 100).toFixed(1)}% slower`);
      }
      
      expect(performanceChange).toBeLessThan(0.5); // Fail test if more than 50% regression
    });
  });
});