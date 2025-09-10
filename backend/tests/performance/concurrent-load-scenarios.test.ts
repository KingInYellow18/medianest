/**
 * CONCURRENT USER HANDLING AND LOAD SCENARIO TESTS
 * 
 * Comprehensive load testing for different user scenarios:
 * - Normal Load (10-20 concurrent users)
 * - Peak Load (50-100 concurrent users)  
 * - Stress Testing (200+ concurrent users)
 * - Mixed workload patterns
 */

import { describe, test, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import { app, httpServer } from '../../src/app';
import { AuthTestHelper } from '../helpers/auth-test-helper';
import { logger } from '../../src/utils/logger';

interface LoadScenarioResult {
  scenario: string;
  concurrentUsers: number;
  totalRequests: number;
  duration: number;
  avgResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  successRate: number;
  errorRate: number;
  throughputRPS: number; // requests per second
  memoryImpact: number;
  cpuStress: boolean;
  passed: boolean;
}

interface WorkloadPattern {
  name: string;
  endpoints: Array<{
    path: string;
    method: string;
    weight: number; // probability of selection
    auth?: boolean;
    body?: any;
    query?: any;
  }>;
}

describe('Concurrent User Handling and Load Scenarios', () => {
  let authHelper: AuthTestHelper;
  let testUsers: any[] = [];
  let userTokens: string[] = [];
  let adminToken: string;
  let loadResults: LoadScenarioResult[] = [];

  beforeAll(async () => {
    authHelper = new AuthTestHelper();
    
    // Create pool of test users for concurrent testing
    const userCreationPromises = Array(100).fill(null).map((_, index) =>
      authHelper.createTestUser(`loadtest${index}@medianest.test`)
    );
    testUsers = await Promise.all(userCreationPromises);

    // Generate tokens for all users
    const tokenPromises = testUsers.map(user => authHelper.generateAccessToken(user.id));
    userTokens = await Promise.all(tokenPromises);

    // Create admin user
    const adminUser = await authHelper.createTestAdmin();
    adminToken = await authHelper.generateAccessToken(adminUser.id);

    logger.info('Load testing setup complete', {
      testUsers: testUsers.length,
      userTokens: userTokens.length
    });
  });

  afterAll(async () => {
    await authHelper.disconnect();
    await httpServer?.close();

    const avgThroughput = loadResults.reduce((sum, r) => sum + r.throughputRPS, 0) / loadResults.length;
    const passedScenarios = loadResults.filter(r => r.passed).length;

    logger.info('Load testing completed', {
      totalScenarios: loadResults.length,
      passedScenarios,
      avgThroughputRPS: Math.round(avgThroughput),
      maxConcurrentUsers: Math.max(...loadResults.map(r => r.concurrentUsers))
    });
  });

  /**
   * Define workload patterns for different scenarios
   */
  const workloadPatterns: { [key: string]: WorkloadPattern } = {
    browsing: {
      name: 'browsing',
      endpoints: [
        { path: '/api/v1/health', method: 'GET', weight: 0.1 },
        { path: '/api/v1/dashboard/stats', method: 'GET', weight: 0.3, auth: true },
        { path: '/api/v1/media/search', method: 'GET', weight: 0.4, auth: true, query: { q: 'movie', limit: 20 } },
        { path: '/api/v1/media/requests', method: 'GET', weight: 0.2, auth: true }
      ]
    },
    interactive: {
      name: 'interactive',
      endpoints: [
        { path: '/api/v1/dashboard/stats', method: 'GET', weight: 0.2, auth: true },
        { path: '/api/v1/media/search', method: 'GET', weight: 0.3, auth: true, query: { q: 'action', limit: 10 } },
        { path: '/api/v1/media/request', method: 'POST', weight: 0.2, auth: true, 
          body: { title: 'Load Test Movie', year: 2024, type: 'movie', tmdbId: 123456 } },
        { path: '/api/v1/media/requests', method: 'GET', weight: 0.3, auth: true }
      ]
    },
    admin: {
      name: 'admin',
      endpoints: [
        { path: '/api/v1/admin/stats', method: 'GET', weight: 0.4, auth: true },
        { path: '/api/v1/admin/users', method: 'GET', weight: 0.3, auth: true, query: { page: 1, limit: 20 } },
        { path: '/api/v1/admin/media-requests', method: 'GET', weight: 0.3, auth: true }
      ]
    },
    mixed: {
      name: 'mixed',
      endpoints: [
        { path: '/api/v1/health', method: 'GET', weight: 0.1 },
        { path: '/api/v1/dashboard/stats', method: 'GET', weight: 0.25, auth: true },
        { path: '/api/v1/media/search', method: 'GET', weight: 0.3, auth: true, query: { q: 'popular', limit: 15 } },
        { path: '/api/v1/media/request', method: 'POST', weight: 0.15, auth: true,
          body: { title: 'Stress Test Movie', year: 2024, type: 'movie', tmdbId: 789012 } },
        { path: '/api/v1/media/requests', method: 'GET', weight: 0.2, auth: true }
      ]
    }
  };

  /**
   * Execute a load scenario with specified parameters
   */
  const executeLoadScenario = async (
    scenarioName: string,
    concurrentUsers: number,
    duration: number, // in milliseconds
    workloadPattern: string,
    targetRPS: number = 50,
    targetSuccessRate: number = 0.95
  ): Promise<LoadScenarioResult> => {
    const pattern = workloadPatterns[workloadPattern];
    const startTime = performance.now();
    const memoryBefore = process.memoryUsage();
    const responses: Array<{ status: number; responseTime: number; timestamp: number }> = [];
    
    // Create user sessions
    const userSessions = Array(concurrentUsers).fill(null).map((_, index) => ({
      userId: index,
      token: userTokens[index % userTokens.length],
      isAdmin: index < Math.floor(concurrentUsers * 0.1) // 10% admin users
    }));

    // Run concurrent user simulation
    const userPromises = userSessions.map(async (session) => {
      const sessionResponses: Array<{ status: number; responseTime: number; timestamp: number }> = [];
      const sessionStartTime = performance.now();

      while (performance.now() - sessionStartTime < duration) {
        try {
          // Select endpoint based on weights
          const random = Math.random();
          let cumulativeWeight = 0;
          let selectedEndpoint = pattern.endpoints[0];

          for (const endpoint of pattern.endpoints) {
            cumulativeWeight += endpoint.weight;
            if (random <= cumulativeWeight) {
              selectedEndpoint = endpoint;
              break;
            }
          }

          const requestStartTime = performance.now();
          
          // Build request
          let req = request(app)[selectedEndpoint.method.toLowerCase() as keyof typeof request](selectedEndpoint.path);
          
          // Add authentication if required
          if (selectedEndpoint.auth) {
            const token = session.isAdmin ? adminToken : session.token;
            req = req.set('Authorization', `Bearer ${token}`);
          }

          // Add query parameters
          if (selectedEndpoint.query) {
            req = req.query(selectedEndpoint.query);
          }

          // Add body for POST requests
          if (selectedEndpoint.body) {
            req = req.send(selectedEndpoint.body);
          }

          const response = await req;
          const responseTime = performance.now() - requestStartTime;

          sessionResponses.push({
            status: response.status,
            responseTime,
            timestamp: Date.now()
          });

          // Simulate user think time (50-200ms)
          const thinkTime = 50 + Math.random() * 150;
          await new Promise(resolve => setTimeout(resolve, thinkTime));

        } catch (error) {
          sessionResponses.push({
            status: 500,
            responseTime: 5000, // Penalty for errors
            timestamp: Date.now()
          });
        }
      }

      return sessionResponses;
    });

    // Wait for all user sessions to complete
    const allSessionResponses = await Promise.all(userPromises);
    const allResponses = allSessionResponses.flat();
    responses.push(...allResponses);

    const endTime = performance.now();
    const memoryAfter = process.memoryUsage();
    const actualDuration = endTime - startTime;

    // Calculate metrics
    const responseTimes = responses.map(r => r.responseTime).sort((a, b) => a - b);
    const successfulResponses = responses.filter(r => r.status >= 200 && r.status < 400);
    const errorResponses = responses.filter(r => r.status >= 400 || r.status < 200);

    const result: LoadScenarioResult = {
      scenario: scenarioName,
      concurrentUsers,
      totalRequests: responses.length,
      duration: actualDuration,
      avgResponseTime: Math.round(responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length),
      minResponseTime: Math.round(responseTimes[0] || 0),
      maxResponseTime: Math.round(responseTimes[responseTimes.length - 1] || 0),
      p95ResponseTime: Math.round(responseTimes[Math.floor(responseTimes.length * 0.95)] || 0),
      p99ResponseTime: Math.round(responseTimes[Math.floor(responseTimes.length * 0.99)] || 0),
      successRate: successfulResponses.length / responses.length,
      errorRate: errorResponses.length / responses.length,
      throughputRPS: Math.round((responses.length / actualDuration) * 1000),
      memoryImpact: memoryAfter.heapUsed - memoryBefore.heapUsed,
      cpuStress: actualDuration > duration * 1.2, // If took 20% longer, indicates CPU stress
      passed: false
    };

    // Determine if scenario passed
    result.passed = (
      result.successRate >= targetSuccessRate &&
      result.throughputRPS >= targetRPS * 0.8 && // Allow 20% variance
      result.avgResponseTime < 1000 && // Under 1 second average
      result.p95ResponseTime < 2000 && // 95th percentile under 2 seconds
      !result.cpuStress
    );

    loadResults.push(result);
    return result;
  };

  describe('Normal Load Scenarios (10-20 users)', () => {
    test('should handle 10 concurrent browsing users', async () => {
      const result = await executeLoadScenario(
        'normal-browsing-10',
        10,
        30000, // 30 seconds
        'browsing',
        30, // 30 RPS target
        0.98 // 98% success rate
      );

      expect(result.passed).toBe(true);
      expect(result.successRate).toBeGreaterThan(0.95);
      expect(result.avgResponseTime).toBeLessThan(300);
      expect(result.throughputRPS).toBeGreaterThan(25);

      logger.info('Normal load (10 browsing users) results', {
        throughputRPS: result.throughputRPS,
        avgResponseTime: result.avgResponseTime,
        successRate: `${(result.successRate * 100).toFixed(1)}%`,
        totalRequests: result.totalRequests
      });
    });

    test('should handle 15 concurrent interactive users', async () => {
      const result = await executeLoadScenario(
        'normal-interactive-15',
        15,
        25000, // 25 seconds
        'interactive',
        40, // 40 RPS target
        0.95
      );

      expect(result.passed).toBe(true);
      expect(result.successRate).toBeGreaterThan(0.93);
      expect(result.p95ResponseTime).toBeLessThan(800);
      expect(result.errorRate).toBeLessThan(0.05);
    });

    test('should handle 20 concurrent mixed workload users', async () => {
      const result = await executeLoadScenario(
        'normal-mixed-20',
        20,
        20000, // 20 seconds
        'mixed',
        50, // 50 RPS target
        0.95
      );

      expect(result.passed).toBe(true);
      expect(result.avgResponseTime).toBeLessThan(400);
      expect(result.memoryImpact).toBeLessThan(100 * 1024 * 1024); // Under 100MB
    });
  });

  describe('Peak Load Scenarios (50-100 users)', () => {
    test('should handle 50 concurrent users under peak load', async () => {
      const result = await executeLoadScenario(
        'peak-load-50',
        50,
        30000, // 30 seconds
        'mixed',
        100, // 100 RPS target
        0.90 // 90% success rate under peak load
      );

      expect(result.passed).toBe(true);
      expect(result.successRate).toBeGreaterThan(0.85);
      expect(result.avgResponseTime).toBeLessThan(800);
      expect(result.p95ResponseTime).toBeLessThan(2000);
      expect(result.throughputRPS).toBeGreaterThan(80);

      logger.info('Peak load (50 users) results', {
        throughputRPS: result.throughputRPS,
        avgResponseTime: result.avgResponseTime,
        p95ResponseTime: result.p95ResponseTime,
        successRate: `${(result.successRate * 100).toFixed(1)}%`,
        memoryImpactMB: Math.round(result.memoryImpact / (1024 * 1024))
      });
    });

    test('should handle 75 concurrent users browsing heavily', async () => {
      const result = await executeLoadScenario(
        'peak-browsing-75',
        75,
        25000, // 25 seconds
        'browsing',
        120, // 120 RPS target
        0.88
      );

      expect(result.successRate).toBeGreaterThan(0.85);
      expect(result.avgResponseTime).toBeLessThan(1000);
      expect(result.errorRate).toBeLessThan(0.15);
    });

    test('should handle 100 concurrent users with mixed workload', async () => {
      const result = await executeLoadScenario(
        'peak-mixed-100',
        100,
        30000, // 30 seconds
        'mixed',
        150, // 150 RPS target
        0.85
      );

      expect(result.successRate).toBeGreaterThan(0.80);
      expect(result.avgResponseTime).toBeLessThan(1200);
      expect(result.p99ResponseTime).toBeLessThan(5000);
      expect(result.cpuStress).toBe(false);
    });
  });

  describe('Stress Testing Scenarios (200+ users)', () => {
    test('should survive 200 concurrent users stress test', async () => {
      const result = await executeLoadScenario(
        'stress-test-200',
        200,
        20000, // 20 seconds
        'browsing', // Lighter workload for stress test
        200, // 200 RPS target
        0.75 // 75% success rate acceptable under stress
      );

      // Stress test is about survival, not optimal performance
      expect(result.successRate).toBeGreaterThan(0.70);
      expect(result.avgResponseTime).toBeLessThan(3000);
      expect(result.errorRate).toBeLessThan(0.30);
      expect(result.totalRequests).toBeGreaterThan(1000); // Should handle significant load

      logger.info('Stress test (200 users) results', {
        throughputRPS: result.throughputRPS,
        avgResponseTime: result.avgResponseTime,
        successRate: `${(result.successRate * 100).toFixed(1)}%`,
        totalRequests: result.totalRequests,
        survived: result.successRate > 0.7
      });
    });

    test('should handle 150 concurrent admin users', async () => {
      // Admin operations are typically heavier
      const result = await executeLoadScenario(
        'stress-admin-150',
        150,
        15000, // 15 seconds
        'admin',
        120, // 120 RPS target
        0.70 // 70% success rate for heavy admin operations
      );

      expect(result.successRate).toBeGreaterThan(0.65);
      expect(result.avgResponseTime).toBeLessThan(5000);
      expect(result.memoryImpact).toBeLessThan(500 * 1024 * 1024); // Under 500MB
    });
  });

  describe('Burst and Spike Testing', () => {
    test('should handle sudden traffic spikes', async () => {
      // Simulate sudden spike by starting with fewer users and ramping up
      const spikeResults: LoadScenarioResult[] = [];
      
      // Baseline: 10 users
      const baseline = await executeLoadScenario('baseline-10', 10, 10000, 'browsing', 25, 0.95);
      spikeResults.push(baseline);
      
      // Sudden spike: 80 users
      const spike = await executeLoadScenario('spike-80', 80, 15000, 'browsing', 80, 0.80);
      spikeResults.push(spike);
      
      // Recovery: back to 10 users
      const recovery = await executeLoadScenario('recovery-10', 10, 10000, 'browsing', 25, 0.95);
      spikeResults.push(recovery);

      // Analyze spike handling
      const spikeSuccessRate = spike.successRate;
      const recoverySuccessRate = recovery.successRate;
      const spikeResponseTime = spike.avgResponseTime;

      expect(spikeSuccessRate).toBeGreaterThan(0.70); // Should handle spike reasonably
      expect(recoverySuccessRate).toBeGreaterThan(0.90); // Should recover well
      expect(spikeResponseTime).toBeLessThan(2000); // Response time degradation acceptable
      expect(recovery.avgResponseTime).toBeLessThan(baseline.avgResponseTime * 1.5); // Recovery should be close to baseline

      logger.info('Traffic spike test results', {
        baselineRPS: baseline.throughputRPS,
        spikeRPS: spike.throughputRPS,
        recoveryRPS: recovery.throughputRPS,
        spikeSuccessRate: `${(spikeSuccessRate * 100).toFixed(1)}%`,
        spikeHandled: spikeSuccessRate > 0.7
      });
    });

    test('should handle sustained high load', async () => {
      // Run sustained load for longer duration
      const sustainedResult = await executeLoadScenario(
        'sustained-load-60',
        60,
        60000, // 60 seconds - longer duration
        'mixed',
        90, // 90 RPS target
        0.88
      );

      expect(sustainedResult.successRate).toBeGreaterThan(0.85);
      expect(sustainedResult.avgResponseTime).toBeLessThan(1000);
      expect(sustainedResult.throughputRPS).toBeGreaterThan(70);
      
      // Check for performance degradation over time
      const timeBasedAnalysis = {
        totalDuration: sustainedResult.duration,
        avgThroughput: sustainedResult.throughputRPS,
        sustainabilityScore: sustainedResult.successRate * (sustainedResult.throughputRPS / 90)
      };

      expect(timeBasedAnalysis.sustainabilityScore).toBeGreaterThan(0.7);
      expect(sustainedResult.cpuStress).toBe(false);

      logger.info('Sustained load test results', {
        durationSeconds: Math.round(sustainedResult.duration / 1000),
        throughputRPS: sustainedResult.throughputRPS,
        sustainabilityScore: Math.round(timeBasedAnalysis.sustainabilityScore * 100) / 100,
        memoryImpactMB: Math.round(sustainedResult.memoryImpact / (1024 * 1024))
      });
    });
  });

  describe('Load Testing Summary', () => {
    test('should meet overall load handling requirements', async () => {
      const loadSummary = {
        totalScenarios: loadResults.length,
        passedScenarios: loadResults.filter(r => r.passed).length,
        avgThroughputRPS: Math.round(loadResults.reduce((sum, r) => sum + r.throughputRPS, 0) / loadResults.length),
        avgSuccessRate: loadResults.reduce((sum, r) => sum + r.successRate, 0) / loadResults.length,
        maxConcurrentUsers: Math.max(...loadResults.map(r => r.concurrentUsers)),
        avgResponseTime: Math.round(loadResults.reduce((sum, r) => sum + r.avgResponseTime, 0) / loadResults.length),
        totalRequests: loadResults.reduce((sum, r) => sum + r.totalRequests, 0),
        totalMemoryImpact: loadResults.reduce((sum, r) => sum + r.memoryImpact, 0),
        scenariosByLoad: {
          normal: loadResults.filter(r => r.concurrentUsers <= 20).length,
          peak: loadResults.filter(r => r.concurrentUsers > 20 && r.concurrentUsers <= 100).length,
          stress: loadResults.filter(r => r.concurrentUsers > 100).length
        }
      };

      // Overall load testing requirements
      expect(loadSummary.passedScenarios / loadSummary.totalScenarios).toBeGreaterThan(0.75); // 75% pass rate
      expect(loadSummary.avgSuccessRate).toBeGreaterThan(0.80); // 80% average success rate
      expect(loadSummary.avgThroughputRPS).toBeGreaterThan(50); // Average 50+ RPS
      expect(loadSummary.maxConcurrentUsers).toBeGreaterThan(100); // Should handle 100+ users
      expect(loadSummary.avgResponseTime).toBeLessThan(1500); // Average under 1.5 seconds
      expect(loadSummary.totalMemoryImpact).toBeLessThan(1024 * 1024 * 1024); // Under 1GB total impact

      // Performance grading
      const performanceGrade = 
        loadSummary.avgSuccessRate > 0.90 && loadSummary.avgThroughputRPS > 100 && loadSummary.avgResponseTime < 500 ? 'A' :
        loadSummary.avgSuccessRate > 0.85 && loadSummary.avgThroughputRPS > 75 && loadSummary.avgResponseTime < 800 ? 'B' :
        loadSummary.avgSuccessRate > 0.80 && loadSummary.avgThroughputRPS > 50 && loadSummary.avgResponseTime < 1200 ? 'C' : 'D';

      expect(performanceGrade).not.toBe('D');

      logger.info('Load testing summary', {
        ...loadSummary,
        passRate: `${Math.round((loadSummary.passedScenarios / loadSummary.totalScenarios) * 100)}%`,
        avgSuccessRate: `${Math.round(loadSummary.avgSuccessRate * 100)}%`,
        totalMemoryImpactMB: Math.round(loadSummary.totalMemoryImpact / (1024 * 1024)),
        performanceGrade
      });
    });
  });
});