#!/usr/bin/env node

/**
 * Performance Testing Suite for MediaNest Production Readiness
 *
 * This script implements comprehensive performance testing including:
 * - Load testing for API endpoints
 * - Database query performance analysis
 * - Memory usage monitoring
 * - Cache performance validation
 * - Response time distribution analysis
 *
 * Target: <200ms API responses, <50ms DB queries, <512MB memory
 */

const axios = require('axios');

const { performance } = require('perf_hooks');
const os = require('os');
const fs = require('fs').promises;
const path = require('path');

class PerformanceTestSuite {
  constructor(config = {}) {
    this.baseURL = config.baseURL || 'http://localhost:4000';
    this.concurrentUsers = config.concurrentUsers || 10;
    this.testDuration = config.testDuration || 300000; // 5 minutes
    this.rampUpTime = config.rampUpTime || 30000; // 30 seconds

    this.metrics = {
      requests: [],
      errors: [],
      memorySnapshots: [],
      startTime: null,
      endTime: null,
    };

    this.targets = {
      apiResponseTime: {
        p50: 100, // ms
        p95: 200, // ms
        p99: 500, // ms
      },
      memoryUsage: {
        steady: 512 * 1024 * 1024, // 512MB
        peak: 1024 * 1024 * 1024, // 1GB
      },
      errorRate: 0.01, // 1%
      cacheHitRate: 0.8, // 80%
    };
  }

  /**
   * Main performance test execution
   */
  async runPerformanceTests() {
    console.log('🚀 Starting MediaNest Performance Test Suite');
    console.log(
      `📊 Configuration: ${this.concurrentUsers} users, ${this.testDuration / 1000}s duration`,
    );
    console.log(
      `🎯 Targets: P95 <${this.targets.apiResponseTime.p95}ms, Memory <${this.targets.memoryUsage.steady / 1024 / 1024}MB\n`,
    );

    try {
      // Pre-test system validation
      await this.validateSystemHealth();

      // Initialize performance monitoring
      this.startPerformanceMonitoring();

      // Execute load tests
      await this.executeLoadTests();

      // Analyze results
      const results = await this.analyzeResults();

      // Generate report
      await this.generateReport(results);

      return results;
    } catch (error) {
      console.error('❌ Performance test failed:', error.message);
      throw error;
    }
  }

  /**
   * Validate system health before testing
   */
  async validateSystemHealth() {
    console.log('🔍 Validating system health...');

    try {
      const healthResponse = await axios.get(`${this.baseURL}/health`, { timeout: 5000 });
      if (healthResponse.status !== 200) {
        throw new Error('System health check failed');
      }

      console.log('✅ System health check passed');
    } catch (error) {
      throw new Error(`System not ready for testing: ${error.message}`);
    }
  }

  /**
   * Start continuous performance monitoring
   */
  startPerformanceMonitoring() {
    this.metrics.startTime = Date.now();

    // Memory monitoring
    this.memoryMonitor = setInterval(() => {
      this.metrics.memorySnapshots.push({
        timestamp: Date.now(),
        usage: process.memoryUsage(),
        systemMemory: {
          total: os.totalmem(),
          free: os.freemem(),
          used: os.totalmem() - os.freemem(),
        },
      });
    }, 1000);
  }

  /**
   * Execute load tests with concurrent users
   */
  async executeLoadTests() {
    console.log('⚡ Starting load tests...');

    const testEndpoints = [
      { path: '/api/dashboard', weight: 0.3, method: 'GET' },
      { path: '/api/media/requests', weight: 0.2, method: 'GET' },
      { path: '/api/integrations/status', weight: 0.2, method: 'GET' },
      { path: '/api/auth/session', weight: 0.1, method: 'GET' },
      { path: '/health', weight: 0.2, method: 'GET' },
    ];

    const userPromises = [];

    // Ramp up users gradually
    for (let i = 0; i < this.concurrentUsers; i++) {
      const delay = (this.rampUpTime / this.concurrentUsers) * i;
      userPromises.push(
        new Promise((resolve) => {
          setTimeout(() => {
            this.simulateUser(testEndpoints).then(resolve);
          }, delay);
        }),
      );
    }

    await Promise.all(userPromises);

    // Stop monitoring
    clearInterval(this.memoryMonitor);
    this.metrics.endTime = Date.now();

    console.log('✅ Load tests completed');
  }

  /**
   * Simulate a single user's behavior
   */
  async simulateUser(endpoints) {
    const userStartTime = Date.now();
    const userEndTime = userStartTime + this.testDuration - (Date.now() - this.metrics.startTime);

    while (Date.now() < userEndTime) {
      // Select endpoint based on weight
      const endpoint = this.selectWeightedEndpoint(endpoints);

      try {
        const startTime = performance.now();
        const response = await axios({
          method: endpoint.method,
          url: `${this.baseURL}${endpoint.path}`,
          timeout: 10000,
          headers: {
            'User-Agent': 'MediaNest-Performance-Test',
            Accept: 'application/json',
          },
        });

        const duration = performance.now() - startTime;

        this.metrics.requests.push({
          endpoint: endpoint.path,
          method: endpoint.method,
          status: response.status,
          duration,
          timestamp: Date.now(),
          cacheHit: response.headers['x-cache'] === 'HIT',
          size: JSON.stringify(response.data).length,
        });
      } catch (error) {
        this.metrics.errors.push({
          endpoint: endpoint.path,
          method: endpoint.method,
          error: error.message,
          timestamp: Date.now(),
        });
      }

      // Random think time between requests (100-2000ms)
      await this.sleep(Math.random() * 1900 + 100);
    }
  }

  /**
   * Select endpoint based on weighted probability
   */
  selectWeightedEndpoint(endpoints) {
    const random = Math.random();
    let weightSum = 0;

    for (const endpoint of endpoints) {
      weightSum += endpoint.weight;
      if (random <= weightSum) {
        return endpoint;
      }
    }

    return endpoints[endpoints.length - 1];
  }

  /**
   * Analyze performance test results
   */
  async analyzeResults() {
    console.log('📊 Analyzing performance results...');

    const totalRequests = this.metrics.requests.length;
    const totalErrors = this.metrics.errors.length;
    const testDurationMs = this.metrics.endTime - this.metrics.startTime;

    // Response time analysis
    const durations = this.metrics.requests.map((r) => r.duration).sort((a, b) => a - b);
    const responseTimeStats = {
      count: totalRequests,
      min: durations[0] || 0,
      max: durations[durations.length - 1] || 0,
      mean: durations.reduce((sum, d) => sum + d, 0) / durations.length || 0,
      p50: durations[Math.floor(durations.length * 0.5)] || 0,
      p95: durations[Math.floor(durations.length * 0.95)] || 0,
      p99: durations[Math.floor(durations.length * 0.99)] || 0,
    };

    // Error rate analysis
    const errorRate = totalErrors / (totalRequests + totalErrors);

    // Throughput analysis
    const throughput = totalRequests / (testDurationMs / 1000);

    // Cache performance
    const cacheHits = this.metrics.requests.filter((r) => r.cacheHit).length;
    const cacheHitRate = cacheHits / totalRequests;

    // Memory analysis
    const memoryStats = this.analyzeMemoryUsage();

    // Performance by endpoint
    const endpointStats = this.analyzeEndpointPerformance();

    const results = {
      summary: {
        testDuration: testDurationMs / 1000,
        totalRequests,
        totalErrors,
        errorRate,
        throughput,
        cacheHitRate,
      },
      responseTime: responseTimeStats,
      memory: memoryStats,
      endpoints: endpointStats,
      targets: this.evaluateTargets({
        responseTime: responseTimeStats,
        errorRate,
        memory: memoryStats,
        cacheHitRate,
      }),
    };

    return results;
  }

  /**
   * Analyze memory usage patterns
   */
  analyzeMemoryUsage() {
    const snapshots = this.metrics.memorySnapshots;
    if (snapshots.length === 0) return null;

    const heapUsed = snapshots.map((s) => s.usage.heapUsed);
    const heapTotal = snapshots.map((s) => s.usage.heapTotal);

    return {
      samples: snapshots.length,
      heapUsed: {
        min: Math.min(...heapUsed),
        max: Math.max(...heapUsed),
        mean: heapUsed.reduce((sum, h) => sum + h, 0) / heapUsed.length,
        final: heapUsed[heapUsed.length - 1],
      },
      heapTotal: {
        min: Math.min(...heapTotal),
        max: Math.max(...heapTotal),
        mean: heapTotal.reduce((sum, h) => sum + h, 0) / heapTotal.length,
        final: heapTotal[heapTotal.length - 1],
      },
    };
  }

  /**
   * Analyze performance by endpoint
   */
  analyzeEndpointPerformance() {
    const endpointGroups = {};

    this.metrics.requests.forEach((req) => {
      if (!endpointGroups[req.endpoint]) {
        endpointGroups[req.endpoint] = [];
      }
      endpointGroups[req.endpoint].push(req.duration);
    });

    const endpointStats = {};

    Object.entries(endpointGroups).forEach(([endpoint, durations]) => {
      durations.sort((a, b) => a - b);

      endpointStats[endpoint] = {
        count: durations.length,
        min: durations[0],
        max: durations[durations.length - 1],
        mean: durations.reduce((sum, d) => sum + d, 0) / durations.length,
        p95: durations[Math.floor(durations.length * 0.95)] || durations[durations.length - 1],
      };
    });

    return endpointStats;
  }

  /**
   * Evaluate performance against targets
   */
  evaluateTargets(results) {
    const evaluation = {
      passed: 0,
      failed: 0,
      details: {},
    };

    // API Response Time targets
    if (results.responseTime.p95 <= this.targets.apiResponseTime.p95) {
      evaluation.passed++;
      evaluation.details.apiResponseTimeP95 = {
        status: 'PASS',
        actual: results.responseTime.p95,
        target: this.targets.apiResponseTime.p95,
      };
    } else {
      evaluation.failed++;
      evaluation.details.apiResponseTimeP95 = {
        status: 'FAIL',
        actual: results.responseTime.p95,
        target: this.targets.apiResponseTime.p95,
      };
    }

    // Memory usage targets
    if (results.memory && results.memory.heapUsed.max <= this.targets.memoryUsage.steady) {
      evaluation.passed++;
      evaluation.details.memoryUsage = {
        status: 'PASS',
        actual: results.memory.heapUsed.max,
        target: this.targets.memoryUsage.steady,
      };
    } else {
      evaluation.failed++;
      evaluation.details.memoryUsage = {
        status: 'FAIL',
        actual: results.memory?.heapUsed?.max || 0,
        target: this.targets.memoryUsage.steady,
      };
    }

    // Error rate targets
    if (results.errorRate <= this.targets.errorRate) {
      evaluation.passed++;
      evaluation.details.errorRate = {
        status: 'PASS',
        actual: results.errorRate,
        target: this.targets.errorRate,
      };
    } else {
      evaluation.failed++;
      evaluation.details.errorRate = {
        status: 'FAIL',
        actual: results.errorRate,
        target: this.targets.errorRate,
      };
    }

    // Cache hit rate targets
    if (results.cacheHitRate >= this.targets.cacheHitRate) {
      evaluation.passed++;
      evaluation.details.cacheHitRate = {
        status: 'PASS',
        actual: results.cacheHitRate,
        target: this.targets.cacheHitRate,
      };
    } else {
      evaluation.failed++;
      evaluation.details.cacheHitRate = {
        status: 'FAIL',
        actual: results.cacheHitRate,
        target: this.targets.cacheHitRate,
      };
    }

    evaluation.overall = evaluation.failed === 0 ? 'PASS' : 'FAIL';

    return evaluation;
  }

  /**
   * Generate comprehensive performance report
   */
  async generateReport(results) {
    console.log('\n📈 PERFORMANCE TEST RESULTS');
    console.log('='.repeat(50));

    // Summary
    console.log(`\n📊 Test Summary:`);
    console.log(`   Duration: ${results.summary.testDuration}s`);
    console.log(`   Total Requests: ${results.summary.totalRequests}`);
    console.log(`   Total Errors: ${results.summary.totalErrors}`);
    console.log(`   Error Rate: ${(results.summary.errorRate * 100).toFixed(2)}%`);
    console.log(`   Throughput: ${results.summary.throughput.toFixed(2)} req/s`);
    console.log(`   Cache Hit Rate: ${(results.summary.cacheHitRate * 100).toFixed(2)}%`);

    // Response Time Analysis
    console.log(`\n⚡ Response Time Analysis:`);
    console.log(`   Mean: ${results.responseTime.mean.toFixed(2)}ms`);
    console.log(`   P50:  ${results.responseTime.p50.toFixed(2)}ms`);
    console.log(`   P95:  ${results.responseTime.p95.toFixed(2)}ms`);
    console.log(`   P99:  ${results.responseTime.p99.toFixed(2)}ms`);
    console.log(`   Max:  ${results.responseTime.max.toFixed(2)}ms`);

    // Memory Analysis
    if (results.memory) {
      console.log(`\n💾 Memory Usage Analysis:`);
      console.log(`   Peak Heap: ${(results.memory.heapUsed.max / 1024 / 1024).toFixed(2)}MB`);
      console.log(`   Final Heap: ${(results.memory.heapUsed.final / 1024 / 1024).toFixed(2)}MB`);
      console.log(`   Mean Heap: ${(results.memory.heapUsed.mean / 1024 / 1024).toFixed(2)}MB`);
    }

    // Target Evaluation
    console.log(`\n🎯 Target Evaluation:`);
    console.log(`   Overall: ${results.targets.overall}`);
    console.log(`   Passed: ${results.targets.passed}`);
    console.log(`   Failed: ${results.targets.failed}`);

    Object.entries(results.targets.details).forEach(([metric, result]) => {
      const status = result.status === 'PASS' ? '✅' : '❌';
      const unit = metric.includes('Time')
        ? 'ms'
        : metric.includes('Memory')
          ? 'MB'
          : metric.includes('Rate')
            ? '%'
            : '';

      let actual = result.actual;
      let target = result.target;

      if (unit === 'MB') {
        actual = (actual / 1024 / 1024).toFixed(2);
        target = (target / 1024 / 1024).toFixed(2);
      } else if (unit === '%') {
        actual = (actual * 100).toFixed(2);
        target = (target * 100).toFixed(2);
      } else {
        actual = actual.toFixed(2);
        target = target.toFixed(2);
      }

      console.log(`   ${status} ${metric}: ${actual}${unit} (target: ${target}${unit})`);
    });

    // Endpoint Performance
    console.log(`\n🔗 Endpoint Performance:`);
    Object.entries(results.endpoints).forEach(([endpoint, stats]) => {
      console.log(`   ${endpoint}:`);
      console.log(`     Requests: ${stats.count}`);
      console.log(`     Mean: ${stats.mean.toFixed(2)}ms`);
      console.log(`     P95: ${stats.p95.toFixed(2)}ms`);
    });

    // Save detailed report to file
    const reportPath = path.join(__dirname, '..', 'docs', 'performance-test-report.json');
    await fs.writeFile(reportPath, JSON.stringify(results, null, 2));
    console.log(`\n💾 Detailed report saved to: ${reportPath}`);
  }

  /**
   * Utility function for delays
   */
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// CLI execution
if (require.main === module) {
  const config = {
    baseURL: process.env.BASE_URL || 'http://localhost:4000',
    concurrentUsers: parseInt(process.env.CONCURRENT_USERS) || 10,
    testDuration: parseInt(process.env.TEST_DURATION) || 300000, // 5 minutes
    rampUpTime: parseInt(process.env.RAMP_UP_TIME) || 30000, // 30 seconds
  };

  const testSuite = new PerformanceTestSuite(config);

  testSuite
    .runPerformanceTests()
    .then((results) => {
      console.log('\n🎉 Performance testing completed successfully!');
      process.exit(results.targets.overall === 'PASS' ? 0 : 1);
    })
    .catch((error) => {
      console.error('\n💥 Performance testing failed:', error);
      process.exit(1);
    });
}

module.exports = { PerformanceTestSuite };
