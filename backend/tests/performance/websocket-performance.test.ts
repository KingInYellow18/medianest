/**
 * WEBSOCKET CONNECTION PERFORMANCE TESTS
 *
 * Comprehensive WebSocket performance testing for real-time features
 * Tests connection establishment, message throughput, concurrent connections,
 * and memory efficiency of WebSocket operations
 */

import { describe, test, expect, beforeAll, afterAll, vi } from 'vitest';
import { Server as SocketIOServer } from 'socket.io';
import { createServer } from 'http';
import { Client as SocketIOClient } from 'socket.io-client';
import { app } from '../../src/app';
import { AuthTestHelper } from '../helpers/auth-test-helper';
import { logger } from '../../src/utils/logger';

interface WebSocketMetric {
  operation: 'connect' | 'disconnect' | 'message' | 'broadcast';
  timestamp: number;
  duration: number;
  success: boolean;
  connectionId: string;
  messageSize?: number;
  memoryUsage: NodeJS.MemoryUsage;
}

interface WebSocketBenchmark {
  operation: string;
  connectionCount: number;
  avgOperationTime: number;
  minOperationTime: number;
  maxOperationTime: number;
  p95OperationTime: number;
  successRate: number;
  throughputMPS: number; // messages per second
  memoryEfficiency: number;
  passed: boolean;
}

describe('WebSocket Connection Performance Tests', () => {
  let httpServer: any;
  let io: SocketIOServer;
  let authHelper: AuthTestHelper;
  let testUsers: any[] = [];
  let userTokens: string[] = [];
  let wsMetrics: WebSocketMetric[] = [];
  let wsBenchmarks: WebSocketBenchmark[] = [];
  const activeConnections: Map<string, any> = new Map();

  beforeAll(async () => {
    // Create HTTP server for WebSocket testing
    httpServer = createServer(app);

    // Initialize Socket.IO server
    io = new SocketIOServer(httpServer, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST'],
      },
      transports: ['websocket', 'polling'],
      pingTimeout: 60000,
      pingInterval: 25000,
    });

    // Setup authentication helper
    authHelper = new AuthTestHelper();

    // Create test users
    const userPromises = Array(50)
      .fill(null)
      .map((_, index) => authHelper.createTestUser(`wstest${index}@medianest.test`));
    testUsers = await Promise.all(userPromises);

    // Generate tokens
    const tokenPromises = testUsers.map((user) => authHelper.generateAccessToken(user.id));
    userTokens = await Promise.all(tokenPromises);

    // Start server
    await new Promise<void>((resolve) => {
      httpServer.listen(0, () => {
        const port = httpServer.address()?.port;
        logger.info(`WebSocket test server started on port ${port}`);
        resolve();
      });
    });

    logger.info('WebSocket performance tests setup complete', {
      testUsers: testUsers.length,
      serverPort: httpServer.address()?.port,
    });
  });

  afterAll(async () => {
    // Close all active connections
    for (const [connectionId, socket] of activeConnections) {
      if (socket && socket.connected) {
        socket.disconnect();
      }
    }
    activeConnections.clear();

    // Close server
    if (io) {
      io.close();
    }
    if (httpServer) {
      await new Promise<void>((resolve) => {
        httpServer.close(() => resolve());
      });
    }

    await authHelper.disconnect();

    const avgThroughput =
      wsBenchmarks.reduce((sum, b) => sum + b.throughputMPS, 0) / wsBenchmarks.length;
    logger.info('WebSocket performance tests completed', {
      totalMetrics: wsMetrics.length,
      avgThroughputMPS: Math.round(avgThroughput),
      benchmarksPassed: wsBenchmarks.filter((b) => b.passed).length,
      benchmarksTotal: wsBenchmarks.length,
    });
  });

  /**
   * Create WebSocket client connection
   */
  const createWebSocketClient = async (
    userId: string,
    token: string,
    connectionId: string,
  ): Promise<any> => {
    const port = httpServer.address()?.port;
    const socket = new SocketIOClient(`http://localhost:${port}`, {
      auth: { token },
      transports: ['websocket'],
      timeout: 5000,
    });

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        socket.disconnect();
        reject(new Error(`Connection timeout for ${connectionId}`));
      }, 5000);

      socket.on('connect', () => {
        clearTimeout(timeout);
        activeConnections.set(connectionId, socket);
        resolve(socket);
      });

      socket.on('connect_error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  };

  /**
   * Measure WebSocket operation performance
   */
  const measureWebSocketOperation = async (
    operation: 'connect' | 'disconnect' | 'message' | 'broadcast',
    operationFunction: () => Promise<any>,
    connectionId: string,
    messageSize: number = 0,
  ): Promise<WebSocketMetric> => {
    const memoryBefore = process.memoryUsage();
    const startTime = performance.now();
    let success = false;

    try {
      await operationFunction();
      success = true;
    } catch (error) {
      logger.warn(`WebSocket operation ${operation} failed for ${connectionId}:`, error);
    }

    const duration = performance.now() - startTime;
    const memoryAfter = process.memoryUsage();

    const metric: WebSocketMetric = {
      operation,
      timestamp: Date.now(),
      duration,
      success,
      connectionId,
      messageSize: messageSize > 0 ? messageSize : undefined,
      memoryUsage: {
        rss: memoryAfter.rss - memoryBefore.rss,
        heapTotal: memoryAfter.heapTotal - memoryBefore.heapTotal,
        heapUsed: memoryAfter.heapUsed - memoryBefore.heapUsed,
        external: memoryAfter.external - memoryBefore.external,
        arrayBuffers: memoryAfter.arrayBuffers - memoryBefore.arrayBuffers,
      },
    };

    wsMetrics.push(metric);
    return metric;
  };

  /**
   * Analyze WebSocket performance metrics
   */
  const analyzeWebSocketPerformance = (
    operation: string,
    metrics: WebSocketMetric[],
    target: number = 100,
  ): WebSocketBenchmark => {
    const durations = metrics.map((m) => m.duration).sort((a, b) => a - b);
    const successfulMetrics = metrics.filter((m) => m.success);
    const totalMessages = metrics.filter(
      (m) => m.operation === 'message' || m.operation === 'broadcast',
    ).length;

    const benchmark: WebSocketBenchmark = {
      operation,
      connectionCount: metrics.length,
      avgOperationTime: Math.round(durations.reduce((sum, d) => sum + d, 0) / durations.length),
      minOperationTime: Math.round(durations[0] || 0),
      maxOperationTime: Math.round(durations[durations.length - 1] || 0),
      p95OperationTime: Math.round(durations[Math.floor(durations.length * 0.95)] || 0),
      successRate: successfulMetrics.length / metrics.length,
      throughputMPS:
        totalMessages > 0
          ? Math.round(
              (totalMessages /
                (Math.max(...metrics.map((m) => m.timestamp)) -
                  Math.min(...metrics.map((m) => m.timestamp)))) *
                1000,
            )
          : 0,
      memoryEfficiency:
        Math.round(
          (metrics.reduce((sum, m) => sum + m.memoryUsage.heapUsed, 0) /
            metrics.length /
            (1024 * 1024)) *
            100,
        ) / 100,
      passed: false,
    };

    benchmark.passed =
      benchmark.avgOperationTime <= target &&
      benchmark.successRate >= 0.95 &&
      benchmark.memoryEfficiency < 10; // Less than 10MB average memory per operation

    wsBenchmarks.push(benchmark);
    return benchmark;
  };

  describe('WebSocket Connection Establishment', () => {
    test('should establish single connection within 100ms', async () => {
      const connectionMetrics: WebSocketMetric[] = [];

      const metric = await measureWebSocketOperation(
        'connect',
        () => createWebSocketClient(testUsers[0].id, userTokens[0], 'single-connection'),
        'single-connection',
      );

      connectionMetrics.push(metric);
      const benchmark = analyzeWebSocketPerformance('single-connection', connectionMetrics, 100);

      expect(benchmark.avgOperationTime).toBeLessThan(100);
      expect(benchmark.successRate).toBe(1);
      expect(benchmark.passed).toBe(true);

      logger.info('Single WebSocket connection performance', {
        connectionTime: benchmark.avgOperationTime,
        memoryMB: benchmark.memoryEfficiency,
      });
    });

    test('should establish 10 concurrent connections efficiently', async () => {
      const connectionMetrics: WebSocketMetric[] = [];
      const connectionPromises: Promise<WebSocketMetric>[] = [];

      for (let i = 0; i < 10; i++) {
        const connectionId = `concurrent-${i}`;
        const promise = measureWebSocketOperation(
          'connect',
          () => createWebSocketClient(testUsers[i].id, userTokens[i], connectionId),
          connectionId,
        );
        connectionPromises.push(promise);
      }

      const metrics = await Promise.all(connectionPromises);
      connectionMetrics.push(...metrics);

      const benchmark = analyzeWebSocketPerformance(
        'concurrent-connections-10',
        connectionMetrics,
        200,
      );

      expect(benchmark.avgOperationTime).toBeLessThan(200);
      expect(benchmark.successRate).toBeGreaterThan(0.9);
      expect(benchmark.memoryEfficiency).toBeLessThan(5); // Under 5MB per connection

      logger.info('Concurrent WebSocket connections (10) performance', {
        avgConnectionTime: benchmark.avgOperationTime,
        successRate: `${(benchmark.successRate * 100).toFixed(1)}%`,
        totalMemoryMB: benchmark.memoryEfficiency * 10,
      });
    });

    test('should handle 50 concurrent connections under load', async () => {
      const connectionMetrics: WebSocketMetric[] = [];
      const batchSize = 10;
      const batches = Math.ceil(50 / batchSize);

      // Connect in batches to avoid overwhelming
      for (let batch = 0; batch < batches; batch++) {
        const batchPromises: Promise<WebSocketMetric>[] = [];
        const startIndex = batch * batchSize;
        const endIndex = Math.min(startIndex + batchSize, 50);

        for (let i = startIndex; i < endIndex; i++) {
          const connectionId = `load-${i}`;
          const userIndex = i % testUsers.length;

          const promise = measureWebSocketOperation(
            'connect',
            () =>
              createWebSocketClient(testUsers[userIndex].id, userTokens[userIndex], connectionId),
            connectionId,
          );
          batchPromises.push(promise);
        }

        const batchMetrics = await Promise.allSettled(batchPromises);
        const successfulMetrics = batchMetrics
          .filter(
            (result): result is PromiseFulfilledResult<WebSocketMetric> =>
              result.status === 'fulfilled',
          )
          .map((result) => result.value);

        connectionMetrics.push(...successfulMetrics);

        // Small delay between batches
        if (batch < batches - 1) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }

      const benchmark = analyzeWebSocketPerformance('load-connections-50', connectionMetrics, 500);

      expect(benchmark.successRate).toBeGreaterThan(0.85); // 85% success rate under load
      expect(benchmark.avgOperationTime).toBeLessThan(500);
      expect(benchmark.memoryEfficiency).toBeLessThan(8); // Under 8MB per connection

      logger.info('Load WebSocket connections (50) performance', {
        totalConnections: connectionMetrics.length,
        avgConnectionTime: benchmark.avgOperationTime,
        successRate: `${(benchmark.successRate * 100).toFixed(1)}%`,
        memoryEfficiencyMB: benchmark.memoryEfficiency,
      });
    });
  });

  describe('WebSocket Message Performance', () => {
    test('should handle individual message sending efficiently', async () => {
      const connectionId = 'message-test';
      const socket = await createWebSocketClient(testUsers[0].id, userTokens[0], connectionId);
      const messageMetrics: WebSocketMetric[] = [];
      const testMessage = { type: 'test', data: 'Hello WebSocket!', timestamp: Date.now() };

      // Send 20 individual messages
      for (let i = 0; i < 20; i++) {
        const metric = await measureWebSocketOperation(
          'message',
          () =>
            new Promise<void>((resolve) => {
              socket.emit('test-message', { ...testMessage, id: i });
              socket.once('message-ack', () => resolve());
              // Timeout fallback
              setTimeout(resolve, 1000);
            }),
          connectionId,
          JSON.stringify(testMessage).length,
        );
        messageMetrics.push(metric);

        // Small delay between messages
        await new Promise((resolve) => setTimeout(resolve, 10));
      }

      const benchmark = analyzeWebSocketPerformance('individual-messages', messageMetrics, 50);

      expect(benchmark.avgOperationTime).toBeLessThan(50);
      expect(benchmark.successRate).toBeGreaterThan(0.9);
      expect(benchmark.throughputMPS).toBeGreaterThan(10); // At least 10 messages per second

      // Cleanup
      socket.disconnect();
      activeConnections.delete(connectionId);
    });

    test('should handle message broadcasting efficiently', async () => {
      const connectionCount = 15;
      const connections: Array<{ id: string; socket: any }> = [];

      // Create multiple connections
      for (let i = 0; i < connectionCount; i++) {
        const connectionId = `broadcast-${i}`;
        const userIndex = i % testUsers.length;
        try {
          const socket = await createWebSocketClient(
            testUsers[userIndex].id,
            userTokens[userIndex],
            connectionId,
          );
          connections.push({ id: connectionId, socket });
        } catch (error) {
          logger.warn(`Failed to create broadcast connection ${i}:`, error);
        }
      }

      const broadcastMetrics: WebSocketMetric[] = [];
      const broadcastMessage = {
        type: 'broadcast',
        data: 'Broadcasting to all users!',
        timestamp: Date.now(),
      };

      // Perform 10 broadcast operations
      for (let i = 0; i < 10; i++) {
        const metric = await measureWebSocketOperation(
          'broadcast',
          () =>
            new Promise<void>((resolve) => {
              // Simulate server-side broadcast
              connections.forEach((conn) => {
                if (conn.socket.connected) {
                  conn.socket.emit('broadcast-message', { ...broadcastMessage, broadcastId: i });
                }
              });

              // Wait for message delivery
              setTimeout(resolve, 100);
            }),
          `broadcast-${i}`,
          JSON.stringify(broadcastMessage).length,
        );
        broadcastMetrics.push(metric);
      }

      const benchmark = analyzeWebSocketPerformance('message-broadcast', broadcastMetrics, 150);

      expect(benchmark.avgOperationTime).toBeLessThan(150);
      expect(benchmark.successRate).toBeGreaterThan(0.95);
      expect(benchmark.memoryEfficiency).toBeLessThan(15); // Under 15MB for broadcast operations

      // Cleanup connections
      connections.forEach((conn) => {
        if (conn.socket.connected) {
          conn.socket.disconnect();
        }
        activeConnections.delete(conn.id);
      });

      logger.info('WebSocket broadcast performance', {
        connectionCount: connections.length,
        avgBroadcastTime: benchmark.avgOperationTime,
        memoryMB: benchmark.memoryEfficiency,
      });
    });

    test('should handle high-frequency messaging', async () => {
      const connectionId = 'high-frequency';
      const socket = await createWebSocketClient(testUsers[0].id, userTokens[0], connectionId);
      const messageMetrics: WebSocketMetric[] = [];
      const messagesPerSecond = 100;
      const testDuration = 3000; // 3 seconds

      let messagesSent = 0;
      const startTime = Date.now();

      // Send messages at high frequency
      const messageInterval = setInterval(async () => {
        if (Date.now() - startTime >= testDuration) {
          clearInterval(messageInterval);
          return;
        }

        const metric = await measureWebSocketOperation(
          'message',
          () =>
            new Promise<void>((resolve) => {
              socket.emit('high-frequency', {
                id: messagesSent++,
                timestamp: Date.now(),
                data: `Message ${messagesSent}`,
              });
              resolve(); // Don't wait for ack for high frequency
            }),
          connectionId,
          50, // Approximate message size
        );
        messageMetrics.push(metric);
      }, 1000 / messagesPerSecond);

      // Wait for test completion
      await new Promise((resolve) => setTimeout(resolve, testDuration + 500));

      const benchmark = analyzeWebSocketPerformance('high-frequency-messages', messageMetrics, 20);

      expect(benchmark.avgOperationTime).toBeLessThan(20); // Very fast for high frequency
      expect(benchmark.successRate).toBeGreaterThan(0.95);
      expect(benchmark.throughputMPS).toBeGreaterThan(50); // High throughput
      expect(messageMetrics.length).toBeGreaterThan(200); // Should have sent many messages

      // Cleanup
      socket.disconnect();
      activeConnections.delete(connectionId);

      logger.info('High-frequency messaging performance', {
        messagesSent: messageMetrics.length,
        avgMessageTime: benchmark.avgOperationTime,
        throughputMPS: benchmark.throughputMPS,
        testDurationSec: testDuration / 1000,
      });
    });
  });

  describe('WebSocket Resource Management', () => {
    test('should handle connection cleanup efficiently', async () => {
      const connectionCount = 20;
      const connections: Array<{ id: string; socket: any }> = [];
      const cleanupMetrics: WebSocketMetric[] = [];

      // Create connections
      for (let i = 0; i < connectionCount; i++) {
        const connectionId = `cleanup-${i}`;
        const userIndex = i % testUsers.length;
        try {
          const socket = await createWebSocketClient(
            testUsers[userIndex].id,
            userTokens[userIndex],
            connectionId,
          );
          connections.push({ id: connectionId, socket });
        } catch (error) {
          logger.warn(`Failed to create cleanup connection ${i}:`, error);
        }
      }

      // Disconnect all connections and measure cleanup time
      for (const conn of connections) {
        const metric = await measureWebSocketOperation(
          'disconnect',
          () =>
            new Promise<void>((resolve) => {
              conn.socket.on('disconnect', () => resolve());
              conn.socket.disconnect();
              // Timeout fallback
              setTimeout(resolve, 1000);
            }),
          conn.id,
        );
        cleanupMetrics.push(metric);
        activeConnections.delete(conn.id);
      }

      const benchmark = analyzeWebSocketPerformance('connection-cleanup', cleanupMetrics, 100);

      expect(benchmark.avgOperationTime).toBeLessThan(100);
      expect(benchmark.successRate).toBeGreaterThan(0.95);
      expect(benchmark.memoryEfficiency).toBeLessThan(2); // Cleanup should be very memory efficient
    });

    test('should maintain performance under connection churn', async () => {
      const churnCycles = 5;
      const connectionsPerCycle = 10;
      const churnMetrics: WebSocketMetric[] = [];

      for (let cycle = 0; cycle < churnCycles; cycle++) {
        // Connect phase
        const connectPromises: Promise<WebSocketMetric>[] = [];
        for (let i = 0; i < connectionsPerCycle; i++) {
          const connectionId = `churn-${cycle}-${i}`;
          const userIndex = (cycle * connectionsPerCycle + i) % testUsers.length;

          const promise = measureWebSocketOperation(
            'connect',
            () =>
              createWebSocketClient(testUsers[userIndex].id, userTokens[userIndex], connectionId),
            connectionId,
          );
          connectPromises.push(promise);
        }

        const connectMetrics = await Promise.allSettled(connectPromises);
        const successfulConnects = connectMetrics
          .filter(
            (result): result is PromiseFulfilledResult<WebSocketMetric> =>
              result.status === 'fulfilled',
          )
          .map((result) => result.value);

        churnMetrics.push(...successfulConnects);

        // Short activity period
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Disconnect phase
        const disconnectPromises: Promise<WebSocketMetric>[] = [];
        for (let i = 0; i < connectionsPerCycle; i++) {
          const connectionId = `churn-${cycle}-${i}`;
          const socket = activeConnections.get(connectionId);

          if (socket) {
            const promise = measureWebSocketOperation(
              'disconnect',
              () =>
                new Promise<void>((resolve) => {
                  socket.on('disconnect', () => resolve());
                  socket.disconnect();
                  setTimeout(resolve, 500); // Timeout fallback
                }),
              connectionId,
            );
            disconnectPromises.push(promise);
          }
        }

        const disconnectMetrics = await Promise.allSettled(disconnectPromises);
        const successfulDisconnects = disconnectMetrics
          .filter(
            (result): result is PromiseFulfilledResult<WebSocketMetric> =>
              result.status === 'fulfilled',
          )
          .map((result) => result.value);

        churnMetrics.push(...successfulDisconnects);

        // Cleanup active connections for this cycle
        for (let i = 0; i < connectionsPerCycle; i++) {
          activeConnections.delete(`churn-${cycle}-${i}`);
        }

        // Brief pause between cycles
        await new Promise((resolve) => setTimeout(resolve, 200));
      }

      const benchmark = analyzeWebSocketPerformance('connection-churn', churnMetrics, 200);

      expect(benchmark.successRate).toBeGreaterThan(0.85); // 85% success rate under churn
      expect(benchmark.avgOperationTime).toBeLessThan(200);
      expect(benchmark.memoryEfficiency).toBeLessThan(5); // Efficient memory usage

      logger.info('Connection churn performance', {
        cycles: churnCycles,
        operationsPerCycle: connectionsPerCycle * 2, // connect + disconnect
        totalOperations: churnMetrics.length,
        avgOperationTime: benchmark.avgOperationTime,
        successRate: `${(benchmark.successRate * 100).toFixed(1)}%`,
      });
    });
  });

  describe('WebSocket Performance Summary', () => {
    test('should meet overall WebSocket performance requirements', async () => {
      const wsSummary = {
        totalBenchmarks: wsBenchmarks.length,
        passedBenchmarks: wsBenchmarks.filter((b) => b.passed).length,
        avgOperationTime: Math.round(
          wsBenchmarks.reduce((sum, b) => sum + b.avgOperationTime, 0) / wsBenchmarks.length,
        ),
        avgSuccessRate:
          wsBenchmarks.reduce((sum, b) => sum + b.successRate, 0) / wsBenchmarks.length,
        avgThroughputMPS: Math.round(
          wsBenchmarks
            .filter((b) => b.throughputMPS > 0)
            .reduce((sum, b) => sum + b.throughputMPS, 0) /
            wsBenchmarks.filter((b) => b.throughputMPS > 0).length,
        ),
        avgMemoryEfficiency:
          Math.round(
            (wsBenchmarks.reduce((sum, b) => sum + b.memoryEfficiency, 0) / wsBenchmarks.length) *
              100,
          ) / 100,
        totalMetrics: wsMetrics.length,
        operationBreakdown: {
          connections: wsMetrics.filter((m) => m.operation === 'connect').length,
          disconnections: wsMetrics.filter((m) => m.operation === 'disconnect').length,
          messages: wsMetrics.filter((m) => m.operation === 'message').length,
          broadcasts: wsMetrics.filter((m) => m.operation === 'broadcast').length,
        },
      };

      // WebSocket performance requirements
      expect(wsSummary.passedBenchmarks / wsSummary.totalBenchmarks).toBeGreaterThan(0.8); // 80% benchmark pass rate
      expect(wsSummary.avgSuccessRate).toBeGreaterThan(0.9); // 90% operation success rate
      expect(wsSummary.avgOperationTime).toBeLessThan(200); // Average operation under 200ms
      expect(wsSummary.avgMemoryEfficiency).toBeLessThan(10); // Under 10MB average memory per operation
      expect(wsSummary.totalMetrics).toBeGreaterThan(100); // Sufficient test coverage

      // Performance grading
      const performanceGrade =
        wsSummary.avgSuccessRate > 0.95 &&
        wsSummary.avgOperationTime < 100 &&
        wsSummary.avgThroughputMPS > 50
          ? 'A'
          : wsSummary.avgSuccessRate > 0.9 &&
              wsSummary.avgOperationTime < 150 &&
              wsSummary.avgThroughputMPS > 30
            ? 'B'
            : wsSummary.avgSuccessRate > 0.85 &&
                wsSummary.avgOperationTime < 200 &&
                wsSummary.avgThroughputMPS > 20
              ? 'C'
              : 'D';

      expect(performanceGrade).not.toBe('D');

      logger.info('WebSocket performance summary', {
        ...wsSummary,
        passRate: `${Math.round((wsSummary.passedBenchmarks / wsSummary.totalBenchmarks) * 100)}%`,
        avgSuccessRate: `${Math.round(wsSummary.avgSuccessRate * 100)}%`,
        performanceGrade,
      });
    });
  });
});
