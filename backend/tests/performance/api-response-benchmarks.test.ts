/**
 * API RESPONSE TIME BENCHMARKS
 *
 * Comprehensive benchmarking suite for API endpoints to ensure no performance degradation
 * Target: <200ms for most endpoints, <500ms for complex operations
 */

import { describe, test, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { app, httpServer } from '../../src/app';
import { AuthTestHelper } from '../helpers/auth-test-helper';
import { logger } from '../../src/utils/logger';

interface PerformanceMetric {
  endpoint: string;
  method: string;
  responseTime: number;
  status: number;
  timestamp: number;
  memoryUsage: NodeJS.MemoryUsage;
}

interface BenchmarkResult {
  endpoint: string;
  avgResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  p95ResponseTime: number;
  successRate: number;
  totalRequests: number;
  target: number;
  passed: boolean;
}

describe('API Response Time Benchmarks', () => {
  let authHelper: AuthTestHelper;
  let testUser: any;
  let adminUser: any;
  let userToken: string;
  let adminToken: string;
  let performanceMetrics: PerformanceMetric[] = [];
  let benchmarkResults: BenchmarkResult[] = [];

  beforeAll(async () => {
    // Setup test environment
    authHelper = new AuthTestHelper();

    // Create test users
    testUser = await authHelper.createTestUser();
    adminUser = await authHelper.createTestAdmin();

    // Generate tokens
    userToken = await authHelper.generateAccessToken(testUser.id);
    adminToken = await authHelper.generateAccessToken(adminUser.id);

    logger.info('Performance benchmarks starting', {
      testUser: testUser.id,
      adminUser: adminUser.id,
    });
  });

  afterAll(async () => {
    await authHelper.disconnect();
    await httpServer?.close();

    // Log performance summary
    const avgResponseTime =
      performanceMetrics.reduce((sum, m) => sum + m.responseTime, 0) / performanceMetrics.length;
    logger.info('Performance benchmarks completed', {
      totalRequests: performanceMetrics.length,
      avgResponseTime: Math.round(avgResponseTime),
      benchmarksPassed: benchmarkResults.filter((r) => r.passed).length,
      benchmarksTotal: benchmarkResults.length,
    });
  });

  /**
   * Helper function to measure endpoint performance
   */
  const measureEndpoint = async (
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    options: {
      auth?: string;
      body?: any;
      query?: any;
      iterations?: number;
      target?: number;
    } = {}
  ): Promise<BenchmarkResult> => {
    const { auth, body, query, iterations = 10, target = 200 } = options;
    const responseTimes: number[] = [];
    let successCount = 0;

    for (let i = 0; i < iterations; i++) {
      const startTime = performance.now();
      const memoryBefore = process.memoryUsage();

      let req = request(app)[method.toLowerCase() as keyof typeof request](endpoint);

      if (auth) {
        req = req.set('Authorization', `Bearer ${auth}`);
      }

      if (query) {
        req = req.query(query);
      }

      if (body) {
        req = req.send(body);
      }

      try {
        const response = await req;
        const responseTime = performance.now() - startTime;
        const memoryAfter = process.memoryUsage();

        responseTimes.push(responseTime);

        if (response.status >= 200 && response.status < 400) {
          successCount++;
        }

        performanceMetrics.push({
          endpoint,
          method,
          responseTime,
          status: response.status,
          timestamp: Date.now(),
          memoryUsage: {
            rss: memoryAfter.rss - memoryBefore.rss,
            heapTotal: memoryAfter.heapTotal - memoryBefore.heapTotal,
            heapUsed: memoryAfter.heapUsed - memoryBefore.heapUsed,
            external: memoryAfter.external - memoryBefore.external,
            arrayBuffers: memoryAfter.arrayBuffers - memoryBefore.arrayBuffers,
          },
        });

        // Small delay to prevent overwhelming
        if (i < iterations - 1) {
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
      } catch (error) {
        logger.error(`Error measuring ${endpoint}:`, error);
      }
    }

    // Calculate statistics
    responseTimes.sort((a, b) => a - b);
    const result: BenchmarkResult = {
      endpoint,
      avgResponseTime: Math.round(
        responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length
      ),
      minResponseTime: Math.round(responseTimes[0] || 0),
      maxResponseTime: Math.round(responseTimes[responseTimes.length - 1] || 0),
      p95ResponseTime: Math.round(responseTimes[Math.floor(responseTimes.length * 0.95)] || 0),
      successRate: successCount / iterations,
      totalRequests: iterations,
      target,
      passed: false,
    };

    result.passed = result.avgResponseTime <= target && result.successRate >= 0.95;
    benchmarkResults.push(result);

    return result;
  };

  describe('Authentication Endpoints', () => {
    test('POST /api/v1/auth/login should respond within 200ms', async () => {
      const result = await measureEndpoint('/api/v1/auth/login', 'POST', {
        body: { email: testUser.email, password: 'password123' },
        target: 200,
        iterations: 15,
      });

      expect(result.avgResponseTime).toBeLessThan(200);
      expect(result.successRate).toBeGreaterThan(0.8);
      expect(result.p95ResponseTime).toBeLessThan(300);
    });

    test('POST /api/v1/auth/refresh should respond within 150ms', async () => {
      const result = await measureEndpoint('/api/v1/auth/refresh', 'POST', {
        auth: userToken,
        target: 150,
        iterations: 20,
      });

      expect(result.avgResponseTime).toBeLessThan(150);
      expect(result.successRate).toBeGreaterThan(0.9);
    });

    test('POST /api/v1/auth/logout should respond within 100ms', async () => {
      const result = await measureEndpoint('/api/v1/auth/logout', 'POST', {
        auth: userToken,
        target: 100,
        iterations: 15,
      });

      expect(result.avgResponseTime).toBeLessThan(100);
      expect(result.successRate).toBeGreaterThan(0.95);
    });
  });

  describe('Dashboard Endpoints', () => {
    test('GET /api/v1/dashboard/stats should respond within 200ms', async () => {
      const result = await measureEndpoint('/api/v1/dashboard/stats', 'GET', {
        auth: userToken,
        target: 200,
        iterations: 20,
      });

      expect(result.avgResponseTime).toBeLessThan(200);
      expect(result.successRate).toBeGreaterThan(0.95);
    });

    test('GET /api/v1/dashboard/recent-activity should respond within 300ms', async () => {
      const result = await measureEndpoint('/api/v1/dashboard/recent-activity', 'GET', {
        auth: userToken,
        target: 300,
        iterations: 15,
      });

      expect(result.avgResponseTime).toBeLessThan(300);
      expect(result.p95ResponseTime).toBeLessThan(500);
    });
  });

  describe('Media Endpoints', () => {
    test('GET /api/v1/media/search should respond within 250ms', async () => {
      const result = await measureEndpoint('/api/v1/media/search', 'GET', {
        auth: userToken,
        query: { q: 'movie', limit: 20 },
        target: 250,
        iterations: 25,
      });

      expect(result.avgResponseTime).toBeLessThan(250);
      expect(result.successRate).toBeGreaterThan(0.9);
    });

    test('GET /api/v1/media/requests should respond within 200ms', async () => {
      const result = await measureEndpoint('/api/v1/media/requests', 'GET', {
        auth: userToken,
        target: 200,
        iterations: 20,
      });

      expect(result.avgResponseTime).toBeLessThan(200);
      expect(result.successRate).toBeGreaterThan(0.95);
    });

    test('POST /api/v1/media/request should respond within 300ms', async () => {
      const result = await measureEndpoint('/api/v1/media/request', 'POST', {
        auth: userToken,
        body: {
          title: 'Performance Test Movie',
          year: 2024,
          type: 'movie',
          tmdbId: 123456,
        },
        target: 300,
        iterations: 10,
      });

      expect(result.avgResponseTime).toBeLessThan(300);
      expect(result.p95ResponseTime).toBeLessThan(500);
    });
  });

  describe('Health and System Endpoints', () => {
    test('GET /api/v1/health should respond within 50ms', async () => {
      const result = await measureEndpoint('/api/v1/health', 'GET', {
        target: 50,
        iterations: 30,
      });

      expect(result.avgResponseTime).toBeLessThan(50);
      expect(result.successRate).toBe(1);
      expect(result.maxResponseTime).toBeLessThan(100);
    });

    test('GET /api/v1/health/ready should respond within 75ms', async () => {
      const result = await measureEndpoint('/api/v1/health/ready', 'GET', {
        target: 75,
        iterations: 25,
      });

      expect(result.avgResponseTime).toBeLessThan(75);
      expect(result.successRate).toBeGreaterThan(0.95);
    });
  });

  describe('Admin Endpoints', () => {
    test('GET /api/v1/admin/stats should respond within 400ms', async () => {
      const result = await measureEndpoint('/api/v1/admin/stats', 'GET', {
        auth: adminToken,
        target: 400,
        iterations: 15,
      });

      expect(result.avgResponseTime).toBeLessThan(400);
      expect(result.successRate).toBeGreaterThan(0.9);
    });

    test('GET /api/v1/admin/users should respond within 300ms', async () => {
      const result = await measureEndpoint('/api/v1/admin/users', 'GET', {
        auth: adminToken,
        query: { page: 1, limit: 20 },
        target: 300,
        iterations: 15,
      });

      expect(result.avgResponseTime).toBeLessThan(300);
      expect(result.p95ResponseTime).toBeLessThan(500);
    });
  });

  describe('Performance Regression Detection', () => {
    test('should identify performance regressions across all endpoints', async () => {
      // Calculate overall performance metrics
      const overallStats = {
        totalRequests: performanceMetrics.length,
        avgResponseTime:
          performanceMetrics.reduce((sum, m) => sum + m.responseTime, 0) /
          performanceMetrics.length,
        slowRequests: performanceMetrics.filter((m) => m.responseTime > 500).length,
        fastRequests: performanceMetrics.filter((m) => m.responseTime < 100).length,
        memoryPressure:
          performanceMetrics.reduce((sum, m) => sum + m.memoryUsage.heapUsed, 0) /
          performanceMetrics.length,
      };

      // Performance regression thresholds
      expect(overallStats.avgResponseTime).toBeLessThan(250); // Overall average under 250ms
      expect(overallStats.slowRequests / overallStats.totalRequests).toBeLessThan(0.05); // Less than 5% slow requests
      expect(overallStats.fastRequests / overallStats.totalRequests).toBeGreaterThan(0.6); // More than 60% fast requests
      expect(overallStats.memoryPressure).toBeLessThan(50 * 1024 * 1024); // Average memory usage under 50MB

      // Ensure most benchmarks pass
      const passedBenchmarks = benchmarkResults.filter((r) => r.passed).length;
      const passRate = passedBenchmarks / benchmarkResults.length;
      expect(passRate).toBeGreaterThan(0.85); // 85% of benchmarks should pass

      logger.info('Performance regression check completed', {
        overallStats,
        benchmarkPassRate: `${Math.round(passRate * 100)}%`,
        totalBenchmarks: benchmarkResults.length,
      });
    });
  });

  describe('Performance Baseline Documentation', () => {
    test('should document performance baselines for future comparison', () => {
      const baselineReport = {
        timestamp: new Date().toISOString(),
        environment: {
          nodeVersion: process.version,
          platform: process.platform,
          memory: process.memoryUsage(),
          env: process.env.NODE_ENV,
        },
        benchmarks: benchmarkResults.map((r) => ({
          endpoint: r.endpoint,
          target: r.target,
          actual: r.avgResponseTime,
          p95: r.p95ResponseTime,
          passed: r.passed,
          margin: (((r.target - r.avgResponseTime) / r.target) * 100).toFixed(1) + '%',
        })),
        summary: {
          totalEndpoints: benchmarkResults.length,
          passedBenchmarks: benchmarkResults.filter((r) => r.passed).length,
          avgResponseTimeAcrossAll: Math.round(
            benchmarkResults.reduce((sum, r) => sum + r.avgResponseTime, 0) /
              benchmarkResults.length
          ),
          performanceGrade:
            benchmarkResults.filter((r) => r.passed).length / benchmarkResults.length >= 0.9
              ? 'A'
              : benchmarkResults.filter((r) => r.passed).length / benchmarkResults.length >= 0.8
                ? 'B'
                : benchmarkResults.filter((r) => r.passed).length / benchmarkResults.length >= 0.7
                  ? 'C'
                  : 'F',
        },
      };

      // Log baseline for documentation
      logger.info('Performance baseline established', baselineReport);

      // Validate baseline quality
      expect(baselineReport.summary.performanceGrade).not.toBe('F');
      expect(baselineReport.summary.avgResponseTimeAcrossAll).toBeLessThan(300);
      expect(baselineReport.benchmarks.filter((b) => b.passed).length).toBeGreaterThan(
        baselineReport.benchmarks.length * 0.8
      );

      // Store baseline for regression comparison
      const baselineData = {
        version: '1.0.0',
        date: baselineReport.timestamp,
        metrics: baselineReport.benchmarks,
        environment: baselineReport.environment.nodeVersion,
      };

      expect(baselineData).toMatchObject({
        version: expect.any(String),
        date: expect.any(String),
        metrics: expect.any(Array),
        environment: expect.any(String),
      });
    });
  });
});
