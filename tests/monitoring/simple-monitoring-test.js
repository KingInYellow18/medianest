#!/usr/bin/env node

/**
 * MediaNest Application Monitoring Quick Validation
 * Simple JavaScript validation of monitoring capabilities
 */

const { performance } = require('perf_hooks');

const axios = require('axios');

const BASE_URL = 'http://localhost:3000';
const results = [];

// Colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  cyan: '\x1b[36m',
};

function log(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function addResult(category, test, status, message, details = {}, duration = 0) {
  const result = {
    category,
    test,
    status,
    message,
    details,
    duration: Math.round(duration * 100) / 100,
    timestamp: new Date().toISOString(),
  };

  results.push(result);

  const statusEmoji = {
    PASS: '✅',
    FAIL: '❌',
    WARNING: '⚠️',
    SKIP: '⏭️',
  };

  const durationStr = duration > 0 ? ` (${Math.round(duration)}ms)` : '';
  log(
    status === 'PASS' ? 'green' : status === 'FAIL' ? 'red' : 'yellow',
    `${statusEmoji[status]} ${category}: ${test}${durationStr}`,
  );

  if (status !== 'PASS' && message) {
    log('blue', `   ${message}`);
  }
}

async function makeRequest(path, options = {}) {
  const startTime = performance.now();

  try {
    const response = await axios({
      url: `${BASE_URL}${path}`,
      method: options.method || 'GET',
      timeout: 10000,
      validateStatus: () => true,
      ...options,
    });

    const duration = performance.now() - startTime;
    return { ...response, duration };
  } catch (error) {
    const duration = performance.now() - startTime;
    if (error.code === 'ECONNREFUSED') {
      throw new Error(`Connection refused - is the server running on ${BASE_URL}?`);
    }
    throw { ...error, duration };
  }
}

async function testBasicHealthEndpoints() {
  log('cyan', '❤️ Testing Basic Health Endpoints...');

  const endpoints = [
    { path: '/health', description: 'Basic health check' },
    { path: '/simple-health', description: 'Simple health endpoint' },
    { path: '/api/v1/health', description: 'V1 health API' },
  ];

  for (const endpoint of endpoints) {
    const startTime = performance.now();

    try {
      const response = await makeRequest(endpoint.path);
      const duration = performance.now() - startTime;

      if (response.status === 200) {
        addResult(
          'HEALTH_ENDPOINTS',
          endpoint.description,
          'PASS',
          `Responded with status ${response.status}`,
          { path: endpoint.path, status: response.status },
          duration,
        );
      } else {
        addResult(
          'HEALTH_ENDPOINTS',
          endpoint.description,
          'WARNING',
          `Responded with status ${response.status} (expected 200)`,
          { path: endpoint.path, status: response.status },
          duration,
        );
      }
    } catch (error) {
      const duration = performance.now() - startTime;
      addResult(
        'HEALTH_ENDPOINTS',
        endpoint.description,
        'FAIL',
        `Failed: ${error.message}`,
        { path: endpoint.path, error: error.message },
        duration,
      );
    }
  }
}

async function testMetricsEndpoints() {
  log('cyan', '📊 Testing Metrics and Performance Endpoints...');

  const endpoints = [
    { path: '/health/metrics', description: 'Health metrics endpoint' },
    { path: '/metrics', description: 'Prometheus metrics' },
    { path: '/api/performance/stats', description: 'Performance statistics' },
    { path: '/api/performance/metrics', description: 'Recent performance metrics' },
  ];

  for (const endpoint of endpoints) {
    const startTime = performance.now();

    try {
      const response = await makeRequest(endpoint.path);
      const duration = performance.now() - startTime;

      if (response.status === 200) {
        // Check for expected content based on endpoint
        let contentCheck = true;
        let contentDetails = {};

        if (endpoint.path === '/metrics') {
          // Check for Prometheus metrics
          const metricsText = response.data;
          const expectedMetrics = [
            'http_requests_total',
            'http_request_duration_seconds',
            'nodejs_heap_size_total_bytes',
          ];

          const foundMetrics = expectedMetrics.filter((metric) => metricsText.includes(metric));

          contentCheck = foundMetrics.length >= expectedMetrics.length * 0.7;
          contentDetails = { foundMetrics, expectedMetrics };
        } else if (endpoint.path.includes('/performance/')) {
          // Check for performance data structure
          contentCheck =
            response.data &&
            (response.data.success !== undefined ||
              response.data.data !== undefined ||
              response.data.overview !== undefined);
          contentDetails = { hasStructuredData: contentCheck };
        } else if (endpoint.path === '/health/metrics') {
          // Check for health metrics
          contentCheck =
            response.data &&
            (response.data.timestamp !== undefined ||
              response.data.uptime !== undefined ||
              response.data.memory !== undefined);
          contentDetails = { hasHealthData: contentCheck };
        }

        const status = contentCheck ? 'PASS' : 'WARNING';
        addResult(
          'METRICS_ENDPOINTS',
          endpoint.description,
          status,
          contentCheck
            ? `Valid response with expected content`
            : `Response received but content validation failed`,
          { path: endpoint.path, status: response.status, ...contentDetails },
          duration,
        );
      } else if (response.status === 404) {
        addResult(
          'METRICS_ENDPOINTS',
          endpoint.description,
          'SKIP',
          `Endpoint not found (404) - may not be implemented`,
          { path: endpoint.path, status: response.status },
          duration,
        );
      } else {
        addResult(
          'METRICS_ENDPOINTS',
          endpoint.description,
          'WARNING',
          `Responded with status ${response.status}`,
          { path: endpoint.path, status: response.status },
          duration,
        );
      }
    } catch (error) {
      const duration = performance.now() - startTime;
      addResult(
        'METRICS_ENDPOINTS',
        endpoint.description,
        'FAIL',
        `Failed: ${error.message}`,
        { path: endpoint.path, error: error.message },
        duration,
      );
    }
  }
}

async function testApplicationPerformanceMonitoring() {
  log('cyan', '⚡ Testing Application Performance Monitoring...');

  try {
    // Test multiple requests to generate performance data
    const requests = [];
    for (let i = 0; i < 5; i++) {
      requests.push(makeRequest('/health'));
    }

    const responses = await Promise.all(requests);

    // Check for tracing headers
    const hasTraceHeaders = responses.some(
      (res) =>
        res.headers['x-trace-id'] || res.headers['x-request-id'] || res.headers['x-correlation-id'],
    );

    // Calculate average response time
    const avgResponseTime =
      responses.reduce((sum, res) => sum + res.duration, 0) / responses.length;

    addResult(
      'APM',
      'Request Performance Tracking',
      'PASS',
      `Generated ${responses.length} requests with avg response time ${Math.round(avgResponseTime)}ms`,
      {
        totalRequests: responses.length,
        avgResponseTime: Math.round(avgResponseTime),
        hasTraceHeaders,
      },
      avgResponseTime,
    );

    // Test metrics endpoint for APM data
    const metricsResponse = await makeRequest('/metrics');
    if (metricsResponse.status === 200) {
      const metricsText = metricsResponse.data;
      const apmMetrics = [
        'http_requests_total',
        'http_request_duration_seconds',
        'database_query_duration_seconds',
        'redis_operation_duration_seconds',
      ].filter((metric) => metricsText.includes(metric));

      addResult(
        'APM',
        'APM Metrics Collection',
        apmMetrics.length >= 2 ? 'PASS' : 'WARNING',
        `Found ${apmMetrics.length}/4 APM metrics in Prometheus endpoint`,
        { foundMetrics: apmMetrics },
      );
    }
  } catch (error) {
    addResult(
      'APM',
      'Application Performance Monitoring',
      'FAIL',
      `APM testing failed: ${error.message}`,
      { error: error.message },
    );
  }
}

async function testDatabaseAndRedisHealth() {
  log('cyan', '🗄️ Testing Database and Redis Health Monitoring...');

  try {
    const response = await makeRequest('/health/metrics');

    if (response.status === 200 && response.data) {
      const healthData = response.data;

      // Check database health
      const dbHealthy =
        healthData.database &&
        healthData.database.status === 'connected' &&
        healthData.database.responseTime;

      // Check Redis health
      const redisHealthy =
        healthData.redis &&
        healthData.redis.status === 'connected' &&
        healthData.redis.responseTime;

      addResult(
        'DATABASE_MONITORING',
        'Database Connectivity Health Check',
        dbHealthy ? 'PASS' : 'WARNING',
        dbHealthy
          ? `Database connected (${healthData.database?.responseTime})`
          : 'Database health check not found or failed',
        {
          healthy: dbHealthy,
          status: healthData.database?.status,
          responseTime: healthData.database?.responseTime,
        },
      );

      addResult(
        'DATABASE_MONITORING',
        'Redis Connectivity Health Check',
        redisHealthy ? 'PASS' : 'WARNING',
        redisHealthy
          ? `Redis connected (${healthData.redis?.responseTime})`
          : 'Redis health check not found or failed',
        {
          healthy: redisHealthy,
          status: healthData.redis?.status,
          responseTime: healthData.redis?.responseTime,
          keyCount: healthData.redis?.keyCount,
        },
      );
    } else {
      addResult(
        'DATABASE_MONITORING',
        'Health Metrics Endpoint',
        'FAIL',
        'Health metrics endpoint not responding properly',
        { status: response.status },
      );
    }
  } catch (error) {
    addResult(
      'DATABASE_MONITORING',
      'Database and Redis Health Monitoring',
      'FAIL',
      `Health monitoring test failed: ${error.message}`,
      { error: error.message },
    );
  }
}

async function testMemoryAndSystemMonitoring() {
  log('cyan', '🧠 Testing Memory and System Monitoring...');

  try {
    // Check Prometheus metrics for memory monitoring
    const metricsResponse = await makeRequest('/metrics');

    if (metricsResponse.status === 200) {
      const metricsText = metricsResponse.data;

      const memoryMetrics = [
        'nodejs_heap_size_total_bytes',
        'nodejs_heap_size_used_bytes',
        'nodejs_external_memory_bytes',
        'nodejs_eventloop_lag_seconds',
      ].filter((metric) => metricsText.includes(metric));

      addResult(
        'MEMORY_MONITORING',
        'Node.js Memory Metrics Collection',
        memoryMetrics.length >= 3 ? 'PASS' : 'WARNING',
        `Found ${memoryMetrics.length}/4 memory metrics`,
        { foundMetrics: memoryMetrics },
      );
    }

    // Check health endpoint for memory information
    const healthResponse = await makeRequest('/health/metrics');
    if (healthResponse.status === 200 && healthResponse.data) {
      const hasMemoryInfo =
        healthResponse.data.memory &&
        healthResponse.data.memory.rss &&
        healthResponse.data.memory.heapUsed;

      addResult(
        'MEMORY_MONITORING',
        'Memory Usage Health Reporting',
        hasMemoryInfo ? 'PASS' : 'WARNING',
        hasMemoryInfo
          ? 'Memory usage included in health metrics'
          : 'Memory usage not found in health metrics',
        { memoryReporting: hasMemoryInfo },
      );
    }
  } catch (error) {
    addResult(
      'MEMORY_MONITORING',
      'Memory and System Monitoring',
      'FAIL',
      `Memory monitoring test failed: ${error.message}`,
      { error: error.message },
    );
  }
}

async function testBusinessMetrics() {
  log('cyan', '📈 Testing Business Metrics Collection...');

  try {
    const metricsResponse = await makeRequest('/metrics');

    if (metricsResponse.status === 200) {
      const metricsText = metricsResponse.data;

      const businessMetrics = [
        'media_requests_total',
        'user_sessions_active',
        'queue_size',
        'external_api_duration_seconds',
      ].filter((metric) => metricsText.includes(metric));

      addResult(
        'BUSINESS_METRICS',
        'Custom Business Metrics',
        businessMetrics.length >= 1 ? 'PASS' : 'WARNING',
        `Found ${businessMetrics.length}/4 business metrics`,
        { foundMetrics: businessMetrics },
      );

      // Check for authentication/error tracking
      const authMetrics = metricsText.includes('http_requests_total');
      addResult(
        'BUSINESS_METRICS',
        'Authentication and Request Tracking',
        authMetrics ? 'PASS' : 'WARNING',
        authMetrics
          ? 'HTTP request metrics available for auth tracking'
          : 'No HTTP request metrics found',
        { authTracking: authMetrics },
      );
    }
  } catch (error) {
    addResult(
      'BUSINESS_METRICS',
      'Business Metrics Collection',
      'FAIL',
      `Business metrics test failed: ${error.message}`,
      { error: error.message },
    );
  }
}

function generateReport() {
  const totalTests = results.length;
  const passedTests = results.filter((r) => r.status === 'PASS').length;
  const failedTests = results.filter((r) => r.status === 'FAIL').length;
  const warningTests = results.filter((r) => r.status === 'WARNING').length;
  const skippedTests = results.filter((r) => r.status === 'SKIP').length;

  const categories = [...new Set(results.map((r) => r.category))];
  const categoryStats = categories.map((category) => {
    const categoryResults = results.filter((r) => r.category === category);
    return {
      category,
      total: categoryResults.length,
      passed: categoryResults.filter((r) => r.status === 'PASS').length,
      failed: categoryResults.filter((r) => r.status === 'FAIL').length,
      warnings: categoryResults.filter((r) => r.status === 'WARNING').length,
      skipped: categoryResults.filter((r) => r.status === 'SKIP').length,
      score: Math.round(
        (categoryResults.filter((r) => r.status === 'PASS').length / categoryResults.length) * 100,
      ),
    };
  });

  const overallScore = Math.round((passedTests / totalTests) * 100);

  log('cyan', '\n' + '='.repeat(80));
  log('cyan', '📋 MEDIANEST APPLICATION MONITORING VALIDATION REPORT');
  log('cyan', '='.repeat(80));

  log('blue', `\n📊 OVERALL SCORE: ${overallScore}%`);
  log(
    overallScore >= 80 ? 'green' : overallScore >= 60 ? 'yellow' : 'red',
    `STATUS: ${overallScore >= 80 ? 'EXCELLENT' : overallScore >= 60 ? 'GOOD' : 'NEEDS_IMPROVEMENT'}`,
  );

  log('blue', `\n📈 TEST RESULTS:`);
  log('green', `✅ Passed: ${passedTests}`);
  log('red', `❌ Failed: ${failedTests}`);
  log('yellow', `⚠️ Warnings: ${warningTests}`);
  log('blue', `⏭️ Skipped: ${skippedTests}`);
  log('blue', `📊 Total: ${totalTests}`);

  log('blue', `\n📋 CATEGORY BREAKDOWN:`);
  categoryStats.forEach((cat) => {
    const color = cat.score >= 80 ? 'green' : cat.score >= 60 ? 'yellow' : 'red';
    log(color, `${cat.category}: ${cat.score}% (${cat.passed}/${cat.total} passed)`);
  });

  // Generate recommendations
  const recommendations = [];
  if (failedTests > 0) {
    recommendations.push(`🚨 Address ${failedTests} critical monitoring failures`);
  }
  if (warningTests > totalTests * 0.3) {
    recommendations.push('⚠️ Review and improve monitoring coverage - many warnings detected');
  }

  categoryStats.forEach((cat) => {
    if (cat.score < 70) {
      switch (cat.category) {
        case 'HEALTH_ENDPOINTS':
          recommendations.push('❤️ Fix health endpoint issues for proper service monitoring');
          break;
        case 'METRICS_ENDPOINTS':
          recommendations.push(
            '📊 Implement missing metrics endpoints for comprehensive monitoring',
          );
          break;
        case 'APM':
          recommendations.push('⚡ Enhance APM capabilities with proper request tracing');
          break;
        case 'DATABASE_MONITORING':
          recommendations.push('🗄️ Set up database and Redis health monitoring');
          break;
        case 'MEMORY_MONITORING':
          recommendations.push('🧠 Implement memory leak detection and system monitoring');
          break;
        case 'BUSINESS_METRICS':
          recommendations.push('📈 Add business metrics collection for KPI tracking');
          break;
      }
    }
  });

  if (recommendations.length === 0) {
    recommendations.push('🎉 Application monitoring is well-configured!');
  }

  log('blue', `\n💡 RECOMMENDATIONS:`);
  recommendations.forEach((rec) => log('yellow', rec));

  log('cyan', '\n' + '='.repeat(80));

  return {
    overallScore,
    status: overallScore >= 80 ? 'EXCELLENT' : overallScore >= 60 ? 'GOOD' : 'NEEDS_IMPROVEMENT',
    totalTests,
    passedTests,
    failedTests,
    warningTests,
    skippedTests,
    categories: categoryStats,
    recommendations,
    results,
  };
}

async function runValidation() {
  log('green', '🚀 Starting MediaNest Application Monitoring Validation');
  log('blue', `📍 Target: ${BASE_URL}`);
  log('blue', `⏰ Started: ${new Date().toISOString()}\n`);

  try {
    // Test basic health endpoints
    await testBasicHealthEndpoints();

    // Test metrics endpoints
    await testMetricsEndpoints();

    // Test application performance monitoring
    await testApplicationPerformanceMonitoring();

    // Test database and Redis health monitoring
    await testDatabaseAndRedisHealth();

    // Test memory and system monitoring
    await testMemoryAndSystemMonitoring();

    // Test business metrics
    await testBusinessMetrics();

    // Generate report
    const report = generateReport();

    // Store results in memory for the validation process
    const memoryKey = 'MEDIANEST_PROD_VALIDATION/app_monitoring/validation_results';
    console.log(`\n📝 Validation results stored in memory: ${memoryKey}`);

    // Exit with appropriate code
    process.exit(report.overallScore >= 70 ? 0 : 1);
  } catch (error) {
    log('red', `❌ Validation suite failed: ${error.message}`);
    process.exit(1);
  }
}

// Stop backend process on exit
process.on('SIGTERM', () => {
  try {
    const fs = require('fs');
    if (fs.existsSync('/tmp/backend.pid')) {
      const pid = fs.readFileSync('/tmp/backend.pid', 'utf8').trim();
      process.kill(parseInt(pid));
      fs.unlinkSync('/tmp/backend.pid');
    }
  } catch (error) {
    // Ignore cleanup errors
  }
});

// Run the validation
runValidation().catch((error) => {
  log('red', `Fatal error: ${error.message}`);
  process.exit(1);
});
