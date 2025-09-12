/**
 * ENHANCED LOAD TESTING SUITE
 *
 * Comprehensive performance testing for MediaNest production readiness
 * Tests system behavior under various load conditions and identifies bottlenecks
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import { createApp } from '../../src/app';

describe('Enhanced Load Testing Suite', () => {
  let app: any;
  let request: supertest.SuperTest<supertest.Test>;
  const performanceMetrics: any = {};

  beforeAll(async () => {
    app = createApp();
    request = supertest(app);
    performanceMetrics.startTime = Date.now();
  });

  afterAll(() => {
    performanceMetrics.endTime = Date.now();
    performanceMetrics.totalDuration = performanceMetrics.endTime - performanceMetrics.startTime;
    console.log('Load Testing Metrics:', performanceMetrics);
  });

  describe('API Endpoint Performance Tests', () => {
    test('should handle authentication load efficiently', async () => {
      const concurrentLogins = 50;
      const startTime = Date.now();

      const loginRequests = Array(concurrentLogins)
        .fill(null)
        .map((_, index) =>
          request.post('/api/auth/login').send({
            username: `testuser${index}`,
            password: 'testpass123',
          }),
        );

      const responses = await Promise.allSettled(loginRequests);
      const endTime = Date.now();
      const duration = endTime - startTime;

      performanceMetrics.authLoad = {
        concurrentRequests: concurrentLogins,
        duration,
        avgResponseTime: duration / concurrentLogins,
        successRate: responses.filter((r) => r.status === 'fulfilled').length / concurrentLogins,
      };

      // Performance expectations
      expect(duration).toBeLessThan(10000); // All requests under 10 seconds
      expect(performanceMetrics.authLoad.avgResponseTime).toBeLessThan(200); // Avg under 200ms
      expect(performanceMetrics.authLoad.successRate).toBeGreaterThan(0.8); // 80% success rate minimum
    });

    test('should handle media search load efficiently', async () => {
      const concurrentSearches = 100;
      const searchQueries = [
        'action movie 2024',
        'comedy series',
        'documentary nature',
        'thriller suspense',
        'sci-fi adventure',
      ];

      const startTime = Date.now();

      const searchRequests = Array(concurrentSearches)
        .fill(null)
        .map((_, index) =>
          request.get('/api/media/search').query({
            q: searchQueries[index % searchQueries.length],
            page: Math.floor(index / 20) + 1,
          }),
        );

      const responses = await Promise.allSettled(searchRequests);
      const endTime = Date.now();
      const duration = endTime - startTime;

      performanceMetrics.searchLoad = {
        concurrentRequests: concurrentSearches,
        duration,
        avgResponseTime: duration / concurrentSearches,
        successCount: responses.filter(
          (r) => r.status === 'fulfilled' && (r.value as any).status === 200,
        ).length,
      };

      expect(duration).toBeLessThan(15000); // All searches under 15 seconds
      expect(performanceMetrics.searchLoad.avgResponseTime).toBeLessThan(150);
      expect(performanceMetrics.searchLoad.successCount).toBeGreaterThan(concurrentSearches * 0.85);
    });

    test('should handle dashboard load efficiently', async () => {
      const concurrentDashboards = 75;
      const startTime = Date.now();

      const dashboardRequests = Array(concurrentDashboards)
        .fill(null)
        .map(() => request.get('/api/dashboard').set('Authorization', 'Bearer valid-test-token'));

      const responses = await Promise.allSettled(dashboardRequests);
      const endTime = Date.now();
      const duration = endTime - startTime;

      performanceMetrics.dashboardLoad = {
        concurrentRequests: concurrentDashboards,
        duration,
        avgResponseTime: duration / concurrentDashboards,
      };

      expect(duration).toBeLessThan(8000); // All dashboard loads under 8 seconds
      expect(performanceMetrics.dashboardLoad.avgResponseTime).toBeLessThan(100);
    });
  });

  describe('Database Performance Tests', () => {
    test('should handle concurrent database queries efficiently', async () => {
      const concurrentQueries = 200;
      const startTime = Date.now();

      const databaseRequests = Array(concurrentQueries)
        .fill(null)
        .map((_, index) => {
          const endpoints = [
            '/api/media/recent',
            '/api/users/stats',
            '/api/admin/system-info',
            '/api/media/popular',
          ];

          return request.get(endpoints[index % endpoints.length]);
        });

      const responses = await Promise.allSettled(databaseRequests);
      const endTime = Date.now();
      const duration = endTime - startTime;

      performanceMetrics.databaseLoad = {
        concurrentQueries,
        duration,
        avgQueryTime: duration / concurrentQueries,
        successfulQueries: responses.filter((r) => r.status === 'fulfilled').length,
      };

      expect(duration).toBeLessThan(20000); // All DB queries under 20 seconds
      expect(performanceMetrics.databaseLoad.avgQueryTime).toBeLessThan(100);
      expect(performanceMetrics.databaseLoad.successfulQueries).toBeGreaterThan(
        concurrentQueries * 0.9,
      );
    });

    test('should handle database write operations under load', async () => {
      const concurrentWrites = 50;
      const startTime = Date.now();

      const writeRequests = Array(concurrentWrites)
        .fill(null)
        .map((_, index) =>
          request.post('/api/media/request').send({
            title: `Load Test Movie ${index}`,
            type: 'movie',
            year: 2024,
            imdbId: `tt${1000000 + index}`,
          }),
        );

      const responses = await Promise.allSettled(writeRequests);
      const endTime = Date.now();
      const duration = endTime - startTime;

      performanceMetrics.databaseWrites = {
        concurrentWrites,
        duration,
        avgWriteTime: duration / concurrentWrites,
        successfulWrites: responses.filter(
          (r) => r.status === 'fulfilled' && [200, 201].includes((r.value as any).status),
        ).length,
      };

      expect(duration).toBeLessThan(15000); // All writes under 15 seconds
      expect(performanceMetrics.databaseWrites.avgWriteTime).toBeLessThan(300);
    });
  });

  describe('Memory and Resource Performance Tests', () => {
    test('should handle large payload processing efficiently', async () => {
      const largePayload = {
        data: 'A'.repeat(100000), // 100KB payload
        metadata: Array(1000)
          .fill(null)
          .map((_, i) => ({
            id: i,
            name: `item-${i}`,
            description: 'Large payload test item with substantial content',
          })),
      };

      const startTime = Date.now();
      const memoryBefore = process.memoryUsage();

      const response = await request.post('/api/admin/bulk-import').send(largePayload);

      const endTime = Date.now();
      const memoryAfter = process.memoryUsage();
      const duration = endTime - startTime;

      performanceMetrics.largePayload = {
        payloadSize: JSON.stringify(largePayload).length,
        processingTime: duration,
        memoryIncrease: memoryAfter.heapUsed - memoryBefore.heapUsed,
        response: response.status,
      };

      expect(duration).toBeLessThan(5000); // Process large payload under 5 seconds
      expect(performanceMetrics.largePayload.memoryIncrease).toBeLessThan(50 * 1024 * 1024); // Less than 50MB increase
    });

    test('should handle file upload performance', async () => {
      const fileSize = 5 * 1024 * 1024; // 5MB file
      const testFile = Buffer.alloc(fileSize, 'test data');

      const startTime = Date.now();

      const response = await request
        .post('/api/upload')
        .attach('file', testFile, 'test-file.txt')
        .field('metadata', 'performance test');

      const endTime = Date.now();
      const duration = endTime - startTime;

      performanceMetrics.fileUpload = {
        fileSize,
        uploadTime: duration,
        throughput: fileSize / (duration / 1000), // bytes per second
        response: response.status,
      };

      expect(duration).toBeLessThan(30000); // Upload 5MB file under 30 seconds
      expect(performanceMetrics.fileUpload.throughput).toBeGreaterThan(100000); // At least 100KB/s
    });
  });

  describe('External API Integration Performance', () => {
    test('should handle Plex API integration under load', async () => {
      const concurrentPlexRequests = 25;
      const startTime = Date.now();

      const plexRequests = Array(concurrentPlexRequests)
        .fill(null)
        .map((_, index) =>
          request
            .get('/api/plex/libraries')
            .set('Authorization', 'Bearer valid-plex-token')
            .query({ server: `server-${index % 3}` }),
        );

      const responses = await Promise.allSettled(plexRequests);
      const endTime = Date.now();
      const duration = endTime - startTime;

      performanceMetrics.plexIntegration = {
        concurrentRequests: concurrentPlexRequests,
        duration,
        avgResponseTime: duration / concurrentPlexRequests,
        successRate:
          responses.filter((r) => r.status === 'fulfilled' && (r.value as any).status === 200)
            .length / concurrentPlexRequests,
      };

      expect(duration).toBeLessThan(20000); // All Plex requests under 20 seconds
      expect(performanceMetrics.plexIntegration.avgResponseTime).toBeLessThan(800);
    });

    test('should handle YouTube API integration performance', async () => {
      const concurrentYouTubeRequests = 20;
      const searchTerms = [
        'movie trailer',
        'tv show review',
        'behind the scenes',
        'official soundtrack',
      ];

      const startTime = Date.now();

      const youtubeRequests = Array(concurrentYouTubeRequests)
        .fill(null)
        .map((_, index) =>
          request.get('/api/youtube/search').query({
            q: searchTerms[index % searchTerms.length],
            maxResults: 10,
          }),
        );

      const responses = await Promise.allSettled(youtubeRequests);
      const endTime = Date.now();
      const duration = endTime - startTime;

      performanceMetrics.youtubeIntegration = {
        concurrentRequests: concurrentYouTubeRequests,
        duration,
        avgResponseTime: duration / concurrentYouTubeRequests,
        apiCallsSuccessful: responses.filter(
          (r) => r.status === 'fulfilled' && (r.value as any).status === 200,
        ).length,
      };

      expect(duration).toBeLessThan(25000); // All YouTube requests under 25 seconds
      expect(performanceMetrics.youtubeIntegration.avgResponseTime).toBeLessThan(1250);
    });
  });

  describe('WebSocket Performance Tests', () => {
    test('should handle concurrent WebSocket connections efficiently', async () => {
      const concurrentConnections = 100;
      const startTime = Date.now();
      const connections: any[] = [];

      // Simulate WebSocket connections
      for (let i = 0; i < concurrentConnections; i++) {
        const response = await request
          .get('/api/socket/connect')
          .set('Upgrade', 'websocket')
          .set('Connection', 'Upgrade');

        connections.push(response);
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      performanceMetrics.websocketConnections = {
        concurrentConnections,
        connectionTime: duration,
        avgConnectionTime: duration / concurrentConnections,
        successfulConnections: connections.filter((c) => c.status === 101).length,
      };

      expect(duration).toBeLessThan(10000); // Connect all sockets under 10 seconds
      expect(performanceMetrics.websocketConnections.avgConnectionTime).toBeLessThan(100);
    });

    test('should handle real-time message broadcasting', async () => {
      const messageCount = 1000;
      const startTime = Date.now();

      const messageRequests = Array(messageCount)
        .fill(null)
        .map((_, index) =>
          request.post('/api/socket/broadcast').send({
            type: 'notification',
            message: `Test message ${index}`,
            timestamp: Date.now(),
          }),
        );

      const responses = await Promise.allSettled(messageRequests);
      const endTime = Date.now();
      const duration = endTime - startTime;

      performanceMetrics.messageBroadcast = {
        messageCount,
        broadcastTime: duration,
        avgMessageTime: duration / messageCount,
        messagesDelivered: responses.filter(
          (r) => r.status === 'fulfilled' && (r.value as any).status === 200,
        ).length,
      };

      expect(duration).toBeLessThan(5000); // Broadcast 1000 messages under 5 seconds
      expect(performanceMetrics.messageBroadcast.avgMessageTime).toBeLessThan(5);
    });
  });

  describe('Stress Testing', () => {
    test('should handle peak load gracefully', async () => {
      const peakLoad = 500; // Simulate peak concurrent users
      const endpointMix = [
        { path: '/api/health', weight: 0.4 },
        { path: '/api/media/search?q=popular', weight: 0.3 },
        { path: '/api/dashboard', weight: 0.2 },
        { path: '/api/media/recent', weight: 0.1 },
      ];

      const startTime = Date.now();
      const stressRequests: Promise<any>[] = [];

      for (let i = 0; i < peakLoad; i++) {
        const random = Math.random();
        let cumulativeWeight = 0;

        for (const endpoint of endpointMix) {
          cumulativeWeight += endpoint.weight;
          if (random <= cumulativeWeight) {
            stressRequests.push(request.get(endpoint.path));
            break;
          }
        }
      }

      const responses = await Promise.allSettled(stressRequests);
      const endTime = Date.now();
      const duration = endTime - startTime;

      performanceMetrics.stressTest = {
        peakLoad,
        duration,
        avgResponseTime: duration / peakLoad,
        successRate:
          responses.filter((r) => r.status === 'fulfilled' && (r.value as any).status === 200)
            .length / peakLoad,
        errorRate:
          responses.filter((r) => r.status === 'fulfilled' && (r.value as any).status >= 500)
            .length / peakLoad,
      };

      expect(duration).toBeLessThan(30000); // Handle peak load under 30 seconds
      expect(performanceMetrics.stressTest.successRate).toBeGreaterThan(0.75); // 75% success under stress
      expect(performanceMetrics.stressTest.errorRate).toBeLessThan(0.05); // Less than 5% server errors
    });

    test('should recover from overload conditions', async () => {
      // Simulate system overload
      const overloadRequests = Array(1000)
        .fill(null)
        .map(() => request.post('/api/admin/heavy-operation').send({ data: 'A'.repeat(50000) }));

      const startTime = Date.now();

      // Start overload requests
      const overloadResponses = await Promise.allSettled(overloadRequests);

      // Wait for system to recover
      await new Promise((resolve) => setTimeout(resolve, 5000));

      // Test normal operation after overload
      const recoveryResponse = await request.get('/api/health');
      const endTime = Date.now();

      performanceMetrics.overloadRecovery = {
        overloadDuration: endTime - startTime,
        overloadRequests: overloadRequests.length,
        recoveryStatus: recoveryResponse.status,
        systemRecovered: recoveryResponse.status === 200,
      };

      expect(recoveryResponse.status).toBe(200); // System should recover
      expect(performanceMetrics.overloadRecovery.systemRecovered).toBe(true);
    });
  });

  describe('Performance Regression Tests', () => {
    test('should maintain response time baselines', async () => {
      const baselineTests = [
        { endpoint: '/api/health', maxTime: 50 },
        { endpoint: '/api/media/search?q=test', maxTime: 200 },
        { endpoint: '/api/dashboard', maxTime: 300 },
        { endpoint: '/api/admin/stats', maxTime: 500 },
      ];

      const regressionResults: any[] = [];

      for (const test of baselineTests) {
        const runs = 10;
        const times: number[] = [];

        for (let i = 0; i < runs; i++) {
          const startTime = Date.now();
          await request.get(test.endpoint);
          times.push(Date.now() - startTime);
        }

        const avgTime = times.reduce((a, b) => a + b) / times.length;
        const maxTime = Math.max(...times);
        const minTime = Math.min(...times);

        regressionResults.push({
          endpoint: test.endpoint,
          avgTime,
          maxTime,
          minTime,
          baseline: test.maxTime,
          passed: avgTime <= test.maxTime,
        });
      }

      performanceMetrics.regressionTests = regressionResults;

      // All baseline tests should pass
      const allPassed = regressionResults.every((result) => result.passed);
      expect(allPassed).toBe(true);
    });
  });
});
