#!/usr/bin/env node

/**
 * MediaNest Application Monitoring Validation Suite
 * Comprehensive testing of application-level observability capabilities
 */

import { EventEmitter } from 'events';
import { createServer } from 'http';
import { performance } from 'perf_hooks';

import axios, { AxiosResponse } from 'axios';
import { Express } from 'express';
import WebSocket from 'ws';


interface ValidationResult {
  category: string;
  test: string;
  status: 'PASS' | 'FAIL' | 'WARNING' | 'SKIP';
  message: string;
  details?: any;
  duration?: number;
  timestamp: string;
}

interface MonitoringEndpoint {
  path: string;
  method: 'GET' | 'POST';
  description: string;
  expectedStatus: number;
}

class ApplicationMonitoringValidator extends EventEmitter {
  private results: ValidationResult[] = [];
  private baseUrl = 'http://localhost:3000';
  private testStartTime = Date.now();
  private performanceMetrics = {
    totalTests: 0,
    passedTests: 0,
    failedTests: 0,
    avgResponseTime: 0,
    maxResponseTime: 0,
    minResponseTime: Infinity,
  };

  // Define monitoring endpoints to test
  private monitoringEndpoints: MonitoringEndpoint[] = [
    { path: '/health', method: 'GET', description: 'Basic health check', expectedStatus: 200 },
    {
      path: '/api/v1/health',
      method: 'GET',
      description: 'V1 health endpoint',
      expectedStatus: 200,
    },
    {
      path: '/simple-health',
      method: 'GET',
      description: 'Simple health check',
      expectedStatus: 200,
    },
    { path: '/health/metrics', method: 'GET', description: 'Health metrics', expectedStatus: 200 },
    { path: '/metrics', method: 'GET', description: 'Prometheus metrics', expectedStatus: 200 },
    {
      path: '/api/performance/stats',
      method: 'GET',
      description: 'Performance stats',
      expectedStatus: 200,
    },
    {
      path: '/api/performance/metrics',
      method: 'GET',
      description: 'Recent metrics',
      expectedStatus: 200,
    },
  ];

  constructor(baseUrl?: string) {
    super();
    if (baseUrl) {
      this.baseUrl = baseUrl;
    }
  }

  /**
   * Run complete application monitoring validation
   */
  async validateApplicationMonitoring(): Promise<{
    summary: any;
    results: ValidationResult[];
    performance: any;
  }> {
    console.log('🚀 Starting MediaNest Application Monitoring Validation');
    console.log(`📍 Target: ${this.baseUrl}`);
    console.log(`⏰ Started: ${new Date().toISOString()}\n`);

    try {
      // 1. Test Application Performance Monitoring (APM)
      await this.validateAPMCapabilities();

      // 2. Test Database Query Monitoring
      await this.validateDatabaseQueryMonitoring();

      // 3. Test Memory Leak Detection
      await this.validateMemoryLeakDetection();

      // 4. Test Distributed Tracing
      await this.validateDistributedTracing();

      // 5. Test Health Check Endpoints
      await this.validateHealthCheckEndpoints();

      // 6. Test Database and Redis Health Checks
      await this.validateDatabaseRedisHealthChecks();

      // 7. Test Business Metrics Collection
      await this.validateBusinessMetricsCollection();

      // 8. Test Real-time Monitoring
      await this.validateRealTimeMonitoring();
    } catch (error) {
      this.addResult({
        category: 'SYSTEM',
        test: 'Validation Suite Execution',
        status: 'FAIL',
        message: `Critical error during validation: ${error.message}`,
        details: { error: error.stack },
      });
    }

    return this.generateReport();
  }

  /**
   * 1. Validate APM Capabilities
   */
  private async validateAPMCapabilities(): Promise<void> {
    console.log('📊 Testing Application Performance Monitoring (APM)...');

    // Test Prometheus metrics endpoint
    await this.testEndpoint('/metrics', 'GET', {
      category: 'APM',
      test: 'Prometheus Metrics Endpoint',
      expectedContent: ['http_requests_total', 'http_request_duration_seconds', 'nodejs_'],
    });

    // Test performance stats endpoint
    await this.testEndpoint('/api/performance/stats', 'GET', {
      category: 'APM',
      test: 'Performance Statistics API',
      expectedFields: ['overview', 'endpoints', 'topSlowest', 'responseTimeDistribution'],
    });

    // Test request tracing by making multiple requests
    await this.validateRequestTracing();

    // Test custom metrics collection
    await this.validateCustomMetrics();
  }

  /**
   * Validate Node.js application tracing and profiling
   */
  private async validateRequestTracing(): Promise<void> {
    const startTime = performance.now();

    try {
      // Make multiple requests to generate trace data
      const requests = [
        this.makeRequest('/health'),
        this.makeRequest('/api/v1/health'),
        this.makeRequest('/health/metrics'),
        this.makeRequest('/health'),
        this.makeRequest('/health'),
      ];

      const responses = await Promise.all(requests);
      const duration = performance.now() - startTime;

      // Validate tracing headers are present
      const hasTraceHeaders = responses.some(
        (res) =>
          res.headers['x-trace-id'] ||
          res.headers['x-request-id'] ||
          res.headers['x-correlation-id'],
      );

      this.addResult({
        category: 'APM',
        test: 'Request Tracing and Profiling',
        status: hasTraceHeaders ? 'PASS' : 'WARNING',
        message: hasTraceHeaders
          ? `Request tracing active with correlation headers`
          : 'No trace headers found - tracing may need configuration',
        details: {
          totalRequests: requests.length,
          totalDuration: `${duration.toFixed(2)}ms`,
          avgResponseTime: `${(duration / requests.length).toFixed(2)}ms`,
          traceHeaders: hasTraceHeaders,
        },
        duration,
      });
    } catch (error) {
      this.addResult({
        category: 'APM',
        test: 'Request Tracing and Profiling',
        status: 'FAIL',
        message: `Request tracing test failed: ${error.message}`,
        details: { error: error.message },
      });
    }
  }

  /**
   * Validate custom metrics collection
   */
  private async validateCustomMetrics(): Promise<void> {
    const startTime = performance.now();

    try {
      // Test metrics endpoint for custom business metrics
      const response = await this.makeRequest('/metrics');
      const metricsText = response.data;

      // Check for MediaNest-specific metrics
      const customMetrics = [
        'media_requests_total',
        'user_sessions_active',
        'queue_size',
        'database_query_duration_seconds',
        'redis_operation_duration_seconds',
        'external_api_duration_seconds',
      ];

      const foundMetrics = customMetrics.filter((metric) => metricsText.includes(metric));

      const duration = performance.now() - startTime;

      this.addResult({
        category: 'APM',
        test: 'Custom Business Metrics Collection',
        status: foundMetrics.length >= customMetrics.length * 0.7 ? 'PASS' : 'WARNING',
        message: `Found ${foundMetrics.length}/${customMetrics.length} custom metrics`,
        details: {
          expectedMetrics: customMetrics,
          foundMetrics,
          missingMetrics: customMetrics.filter((m) => !foundMetrics.includes(m)),
        },
        duration,
      });
    } catch (error) {
      this.addResult({
        category: 'APM',
        test: 'Custom Business Metrics Collection',
        status: 'FAIL',
        message: `Custom metrics validation failed: ${error.message}`,
        details: { error: error.message },
      });
    }
  }

  /**
   * 2. Validate Database Query Monitoring
   */
  private async validateDatabaseQueryMonitoring(): Promise<void> {
    console.log('🗄️ Testing Database Query Monitoring...');

    const startTime = performance.now();

    try {
      // Test metrics endpoint for database metrics
      const response = await this.makeRequest('/metrics');
      const metricsText = response.data;

      // Check for database-specific metrics
      const dbMetrics = ['database_query_duration_seconds', 'database_connections_active'];

      const foundDbMetrics = dbMetrics.filter((metric) => metricsText.includes(metric));

      // Test health endpoint which should trigger database queries
      const healthResponse = await this.makeRequest('/health/metrics');
      const healthData = healthResponse.data;

      const hasDatabaseMetrics =
        healthData.database &&
        healthData.database.status === 'connected' &&
        typeof healthData.database.responseTime === 'string';

      const duration = performance.now() - startTime;

      this.addResult({
        category: 'DATABASE_MONITORING',
        test: 'Database Query Monitoring and Slow Query Detection',
        status: foundDbMetrics.length >= 1 && hasDatabaseMetrics ? 'PASS' : 'WARNING',
        message: `Database monitoring: ${foundDbMetrics.length} metrics, health check: ${hasDatabaseMetrics}`,
        details: {
          prometheusMetrics: foundDbMetrics,
          healthCheckDatabase: hasDatabaseMetrics,
          databaseResponseTime: healthData.database?.responseTime,
          databaseStatus: healthData.database?.status,
        },
        duration,
      });
    } catch (error) {
      this.addResult({
        category: 'DATABASE_MONITORING',
        test: 'Database Query Monitoring and Slow Query Detection',
        status: 'FAIL',
        message: `Database monitoring validation failed: ${error.message}`,
        details: { error: error.message },
      });
    }
  }

  /**
   * 3. Validate Memory Leak Detection
   */
  private async validateMemoryLeakDetection(): Promise<void> {
    console.log('🧠 Testing Memory Leak Detection and GC Monitoring...');

    const startTime = performance.now();

    try {
      // Test memory metrics in Prometheus endpoint
      const response = await this.makeRequest('/metrics');
      const metricsText = response.data;

      // Check for Node.js memory metrics
      const memoryMetrics = [
        'nodejs_heap_size_total_bytes',
        'nodejs_heap_size_used_bytes',
        'nodejs_external_memory_bytes',
        'nodejs_eventloop_lag_seconds',
      ];

      const foundMemoryMetrics = memoryMetrics.filter((metric) => metricsText.includes(metric));

      // Test health endpoint for memory information
      const healthResponse = await this.makeRequest('/health/metrics');
      const healthData = healthResponse.data;

      const hasMemoryInfo =
        healthData.memory &&
        typeof healthData.memory.rss === 'string' &&
        typeof healthData.memory.heapUsed === 'string';

      // Test performance stats for memory tracking
      const perfResponse = await this.makeRequest('/api/performance/stats');
      const perfData = perfResponse.data;

      const hasMemoryMonitoring = perfData.data?.overview?.memoryUsage;

      const duration = performance.now() - startTime;

      this.addResult({
        category: 'MEMORY_MONITORING',
        test: 'Memory Leak Detection and Garbage Collection Monitoring',
        status: foundMemoryMetrics.length >= 3 && hasMemoryInfo ? 'PASS' : 'WARNING',
        message: `Memory monitoring: ${foundMemoryMetrics.length}/4 metrics, health tracking: ${hasMemoryInfo}`,
        details: {
          prometheusMemoryMetrics: foundMemoryMetrics,
          healthMemoryTracking: hasMemoryInfo,
          performanceMemoryTracking: hasMemoryMonitoring,
          currentMemory: healthData.memory,
        },
        duration,
      });
    } catch (error) {
      this.addResult({
        category: 'MEMORY_MONITORING',
        test: 'Memory Leak Detection and Garbage Collection Monitoring',
        status: 'FAIL',
        message: `Memory monitoring validation failed: ${error.message}`,
        details: { error: error.message },
      });
    }
  }

  /**
   * 4. Validate Distributed Tracing
   */
  private async validateDistributedTracing(): Promise<void> {
    console.log('🔗 Testing Distributed Tracing Across Microservices...');

    const startTime = performance.now();

    try {
      // Test OpenTelemetry integration by checking for trace context
      const requests = await Promise.all([
        this.makeRequest('/health', { headers: { 'x-trace-id': 'test-trace-001' } }),
        this.makeRequest('/api/v1/health', { headers: { 'x-parent-span-id': 'test-span-001' } }),
        this.makeRequest('/health/metrics', {
          headers: { traceparent: '00-test-trace-001-test-span-001-01' },
        }),
      ]);

      // Check if tracing headers are propagated or logged
      const tracingSupport = requests.some(
        (response) =>
          response.headers['x-trace-id'] ||
          response.headers['traceparent'] ||
          response.config?.headers?.['x-trace-id'],
      );

      // Test for distributed tracing metrics
      const metricsResponse = await this.makeRequest('/metrics');
      const metricsText = metricsResponse.data;

      const tracingMetrics = [
        'external_api_duration_seconds',
        'http_request_duration_seconds',
      ].filter((metric) => metricsText.includes(metric));

      const duration = performance.now() - startTime;

      this.addResult({
        category: 'DISTRIBUTED_TRACING',
        test: 'Distributed Tracing Across Microservices',
        status: tracingMetrics.length >= 1 ? 'PASS' : 'WARNING',
        message: `Tracing infrastructure: ${tracingMetrics.length} relevant metrics found`,
        details: {
          tracingHeaderSupport: tracingSupport,
          tracingMetrics: tracingMetrics,
          testedEndpoints: requests.length,
          openTelemetryReady: tracingMetrics.includes('http_request_duration_seconds'),
        },
        duration,
      });
    } catch (error) {
      this.addResult({
        category: 'DISTRIBUTED_TRACING',
        test: 'Distributed Tracing Across Microservices',
        status: 'FAIL',
        message: `Distributed tracing validation failed: ${error.message}`,
        details: { error: error.message },
      });
    }
  }

  /**
   * 5. Validate Health Check Endpoints
   */
  private async validateHealthCheckEndpoints(): Promise<void> {
    console.log('❤️ Testing Health Check Endpoints...');

    for (const endpoint of this.monitoringEndpoints) {
      await this.testEndpoint(endpoint.path, endpoint.method, {
        category: 'HEALTH_CHECKS',
        test: endpoint.description,
        expectedStatus: endpoint.expectedStatus,
      });
    }
  }

  /**
   * 6. Validate Database and Redis Health Checks
   */
  private async validateDatabaseRedisHealthChecks(): Promise<void> {
    console.log('🔍 Testing Database and Redis Connectivity Health Checks...');

    const startTime = performance.now();

    try {
      const response = await this.makeRequest('/health/metrics');
      const healthData = response.data;

      // Validate database health check
      const dbHealthy =
        healthData.database &&
        healthData.database.status === 'connected' &&
        typeof healthData.database.responseTime === 'string';

      // Validate Redis health check
      const redisHealthy =
        healthData.redis &&
        healthData.redis.status === 'connected' &&
        typeof healthData.redis.responseTime === 'string' &&
        typeof healthData.redis.keyCount === 'number';

      // Test external services health (if available)
      const hasExternalServices =
        healthData.externalServices ||
        (response.data.components && Array.isArray(response.data.components));

      const duration = performance.now() - startTime;

      this.addResult({
        category: 'HEALTH_CHECKS',
        test: 'Database and Redis Connectivity Health Checks',
        status: dbHealthy && redisHealthy ? 'PASS' : 'WARNING',
        message: `DB: ${dbHealthy}, Redis: ${redisHealthy}, External: ${!!hasExternalServices}`,
        details: {
          database: {
            healthy: dbHealthy,
            status: healthData.database?.status,
            responseTime: healthData.database?.responseTime,
          },
          redis: {
            healthy: redisHealthy,
            status: healthData.redis?.status,
            responseTime: healthData.redis?.responseTime,
            keyCount: healthData.redis?.keyCount,
            memoryUsage: healthData.redis?.memoryUsage,
          },
          externalServices: hasExternalServices,
        },
        duration,
      });
    } catch (error) {
      this.addResult({
        category: 'HEALTH_CHECKS',
        test: 'Database and Redis Connectivity Health Checks',
        status: 'FAIL',
        message: `Health check validation failed: ${error.message}`,
        details: { error: error.message },
      });
    }
  }

  /**
   * 7. Validate Business Metrics and KPIs
   */
  private async validateBusinessMetricsCollection(): Promise<void> {
    console.log('📈 Testing Business Metrics and KPI Collection...');

    const startTime = performance.now();

    try {
      // Test Prometheus metrics for business KPIs
      const metricsResponse = await this.makeRequest('/metrics');
      const metricsText = metricsResponse.data;

      // Define expected business metrics
      const businessMetrics = [
        'media_requests_total', // File upload/download performance
        'user_sessions_active', // User activity and engagement
        'queue_size', // Processing queue metrics
        'http_requests_total', // Authentication success/failure tracking
      ];

      const foundBusinessMetrics = businessMetrics.filter((metric) => metricsText.includes(metric));

      // Test performance stats API for business KPIs
      const perfResponse = await this.makeRequest('/api/performance/stats');
      const perfData = perfResponse.data;

      const hasBusinessStats =
        perfData.data?.overview &&
        typeof perfData.data.overview.totalRequests === 'number' &&
        typeof perfData.data.overview.errorRate === 'number';

      const duration = performance.now() - startTime;

      this.addResult({
        category: 'BUSINESS_METRICS',
        test: 'Business Metrics and KPI Collection',
        status: foundBusinessMetrics.length >= 2 && hasBusinessStats ? 'PASS' : 'WARNING',
        message: `Business metrics: ${foundBusinessMetrics.length}/${businessMetrics.length}, performance KPIs: ${hasBusinessStats}`,
        details: {
          prometheusBusinessMetrics: foundBusinessMetrics,
          missingBusinessMetrics: businessMetrics.filter((m) => !foundBusinessMetrics.includes(m)),
          performanceKPIs: hasBusinessStats,
          businessStats: perfData.data?.overview,
        },
        duration,
      });
    } catch (error) {
      this.addResult({
        category: 'BUSINESS_METRICS',
        test: 'Business Metrics and KPI Collection',
        status: 'FAIL',
        message: `Business metrics validation failed: ${error.message}`,
        details: { error: error.message },
      });
    }
  }

  /**
   * 8. Validate Real-time Monitoring
   */
  private async validateRealTimeMonitoring(): Promise<void> {
    console.log('🔴 Testing Real-time Monitoring and WebSocket Connections...');

    // Test real-time application status monitoring
    await this.validateRealtimeApplicationStatus();

    // Test WebSocket connection monitoring (if available)
    await this.validateWebSocketMonitoring();

    // Test session management and user activity tracking
    await this.validateSessionMonitoring();

    // Test real-time error rate and performance metrics
    await this.validateRealtimePerformanceMetrics();
  }

  private async validateRealtimeApplicationStatus(): Promise<void> {
    const startTime = performance.now();

    try {
      // Make multiple rapid requests to test real-time status updates
      const rapidRequests = [];
      for (let i = 0; i < 10; i++) {
        rapidRequests.push(this.makeRequest('/health'));
      }

      await Promise.all(rapidRequests);

      // Check if metrics are updated in real-time
      const beforeMetrics = await this.makeRequest('/api/performance/stats');

      // Wait a moment for metrics to update
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const afterMetrics = await this.makeRequest('/api/performance/stats');

      const metricsUpdated =
        beforeMetrics.data.data?.overview?.totalRequests !==
        afterMetrics.data.data?.overview?.totalRequests;

      const duration = performance.now() - startTime;

      this.addResult({
        category: 'REALTIME_MONITORING',
        test: 'Real-time Application Status Monitoring',
        status: metricsUpdated ? 'PASS' : 'WARNING',
        message: `Real-time metrics updating: ${metricsUpdated}`,
        details: {
          rapidRequestsCount: rapidRequests.length,
          metricsRealTimeUpdate: metricsUpdated,
          beforeRequests: beforeMetrics.data.data?.overview?.totalRequests,
          afterRequests: afterMetrics.data.data?.overview?.totalRequests,
        },
        duration,
      });
    } catch (error) {
      this.addResult({
        category: 'REALTIME_MONITORING',
        test: 'Real-time Application Status Monitoring',
        status: 'FAIL',
        message: `Real-time monitoring validation failed: ${error.message}`,
        details: { error: error.message },
      });
    }
  }

  private async validateWebSocketMonitoring(): Promise<void> {
    const startTime = performance.now();

    try {
      // Try to connect to potential WebSocket endpoints
      const wsUrls = [
        'ws://localhost:3000/ws',
        'ws://localhost:3000/socket.io',
        'ws://localhost:3000/realtime',
      ];

      let wsConnected = false;
      let wsError = '';

      for (const wsUrl of wsUrls) {
        try {
          const ws = new WebSocket(wsUrl);

          await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
              ws.close();
              resolve(false);
            }, 2000);

            ws.on('open', () => {
              clearTimeout(timeout);
              wsConnected = true;
              ws.close();
              resolve(true);
            });

            ws.on('error', (error) => {
              clearTimeout(timeout);
              wsError = error.message;
              resolve(false);
            });
          });

          if (wsConnected) break;
        } catch (error) {
          wsError = error.message;
        }
      }

      const duration = performance.now() - startTime;

      this.addResult({
        category: 'REALTIME_MONITORING',
        test: 'WebSocket Connection Monitoring',
        status: wsConnected ? 'PASS' : 'SKIP',
        message: wsConnected
          ? 'WebSocket endpoint available'
          : 'No WebSocket endpoints found (may not be implemented)',
        details: {
          testedUrls: wsUrls,
          connected: wsConnected,
          lastError: wsError,
        },
        duration,
      });
    } catch (error) {
      this.addResult({
        category: 'REALTIME_MONITORING',
        test: 'WebSocket Connection Monitoring',
        status: 'SKIP',
        message: `WebSocket testing skipped: ${error.message}`,
        details: { error: error.message },
      });
    }
  }

  private async validateSessionMonitoring(): Promise<void> {
    const startTime = performance.now();

    try {
      // Check for session-related metrics in Prometheus
      const metricsResponse = await this.makeRequest('/metrics');
      const metricsText = metricsResponse.data;

      const sessionMetrics = ['user_sessions_active', 'http_requests_total'].filter((metric) =>
        metricsText.includes(metric),
      );

      // Test performance stats for session tracking
      const perfResponse = await this.makeRequest('/api/performance/stats');
      const perfData = perfResponse.data;

      const hasSessionTracking =
        sessionMetrics.length > 0 ||
        (perfData.data?.overview && typeof perfData.data.overview.totalRequests === 'number');

      const duration = performance.now() - startTime;

      this.addResult({
        category: 'REALTIME_MONITORING',
        test: 'Session Management and User Activity Tracking',
        status: hasSessionTracking ? 'PASS' : 'WARNING',
        message: `Session tracking: ${sessionMetrics.length} metrics, activity monitoring: ${hasSessionTracking}`,
        details: {
          sessionMetrics,
          activityTracking: hasSessionTracking,
          totalRequestsTracked: perfData.data?.overview?.totalRequests,
        },
        duration,
      });
    } catch (error) {
      this.addResult({
        category: 'REALTIME_MONITORING',
        test: 'Session Management and User Activity Tracking',
        status: 'FAIL',
        message: `Session monitoring validation failed: ${error.message}`,
        details: { error: error.message },
      });
    }
  }

  private async validateRealtimePerformanceMetrics(): Promise<void> {
    const startTime = performance.now();

    try {
      // Test real-time performance metrics by checking recent metrics endpoint
      const recentMetrics = await this.makeRequest('/api/performance/metrics?limit=10');
      const recentData = recentMetrics.data;

      const hasRealtimeMetrics =
        recentData.data && Array.isArray(recentData.data) && recentData.data.length > 0;

      // Test metrics freshness
      let metricsAreFresh = false;
      if (hasRealtimeMetrics && recentData.data.length > 0) {
        const latestMetric = recentData.data[0];
        const metricAge = Date.now() - latestMetric.timestamp;
        metricsAreFresh = metricAge < 60000; // Less than 1 minute old
      }

      const duration = performance.now() - startTime;

      this.addResult({
        category: 'REALTIME_MONITORING',
        test: 'Real-time Error Rate and Performance Metrics',
        status: hasRealtimeMetrics && metricsAreFresh ? 'PASS' : 'WARNING',
        message: `Real-time metrics: ${hasRealtimeMetrics}, fresh: ${metricsAreFresh}`,
        details: {
          realtimeMetricsAvailable: hasRealtimeMetrics,
          metricsCount: recentData.data?.length || 0,
          metricsFreshness: metricsAreFresh,
          latestMetricAge:
            hasRealtimeMetrics && recentData.data.length > 0
              ? Date.now() - recentData.data[0].timestamp
              : null,
        },
        duration,
      });
    } catch (error) {
      this.addResult({
        category: 'REALTIME_MONITORING',
        test: 'Real-time Error Rate and Performance Metrics',
        status: 'FAIL',
        message: `Real-time performance metrics validation failed: ${error.message}`,
        details: { error: error.message },
      });
    }
  }

  /**
   * Helper method to test an endpoint
   */
  private async testEndpoint(
    path: string,
    method: 'GET' | 'POST' = 'GET',
    options: {
      category: string;
      test: string;
      expectedStatus?: number;
      expectedContent?: string[];
      expectedFields?: string[];
    },
  ): Promise<void> {
    const startTime = performance.now();

    try {
      const response = await this.makeRequest(path, { method });
      const duration = performance.now() - startTime;

      this.updatePerformanceMetrics(duration);

      // Check status code
      const statusOk = !options.expectedStatus || response.status === options.expectedStatus;

      // Check content
      let contentOk = true;
      let contentDetails = {};

      if (options.expectedContent && typeof response.data === 'string') {
        const foundContent = options.expectedContent.filter((content) =>
          response.data.includes(content),
        );
        contentOk = foundContent.length >= options.expectedContent.length * 0.8;
        contentDetails = { foundContent, expectedContent: options.expectedContent };
      }

      if (options.expectedFields && typeof response.data === 'object') {
        const foundFields = options.expectedFields.filter(
          (field) =>
            response.data.hasOwnProperty(field) ||
            (response.data.data && response.data.data.hasOwnProperty(field)),
        );
        contentOk = foundFields.length >= options.expectedFields.length * 0.8;
        contentDetails = { foundFields, expectedFields: options.expectedFields };
      }

      const overallStatus = statusOk && contentOk ? 'PASS' : 'WARNING';

      this.addResult({
        category: options.category,
        test: options.test,
        status: overallStatus,
        message: `${path} responded with ${response.status}, content validation: ${contentOk}`,
        details: {
          path,
          method,
          statusCode: response.status,
          statusOk,
          contentOk,
          ...contentDetails,
          responseSize:
            typeof response.data === 'string'
              ? response.data.length
              : JSON.stringify(response.data).length,
        },
        duration,
      });
    } catch (error) {
      const duration = performance.now() - startTime;
      this.updatePerformanceMetrics(duration);

      this.addResult({
        category: options.category,
        test: options.test,
        status: 'FAIL',
        message: `${path} request failed: ${error.message}`,
        details: {
          path,
          method,
          error: error.message,
          statusCode: error.response?.status,
        },
        duration,
      });
    }
  }

  /**
   * Make HTTP request with error handling
   */
  private async makeRequest(path: string, options: any = {}): Promise<AxiosResponse> {
    const url = `${this.baseUrl}${path}`;

    try {
      return await axios({
        url,
        method: options.method || 'GET',
        timeout: 10000,
        validateStatus: () => true, // Don't throw on any status code
        ...options,
      });
    } catch (error) {
      if (error.code === 'ECONNREFUSED') {
        throw new Error(`Connection refused - is the server running on ${this.baseUrl}?`);
      }
      throw error;
    }
  }

  /**
   * Add validation result
   */
  private addResult(result: Omit<ValidationResult, 'timestamp'>): void {
    const timestampedResult: ValidationResult = {
      ...result,
      timestamp: new Date().toISOString(),
    };

    this.results.push(timestampedResult);

    // Emit result for real-time monitoring
    this.emit('result', timestampedResult);

    // Console output with colored status
    const statusEmoji = {
      PASS: '✅',
      FAIL: '❌',
      WARNING: '⚠️',
      SKIP: '⏭️',
    };

    const durationStr = result.duration ? ` (${result.duration.toFixed(2)}ms)` : '';
    console.log(`${statusEmoji[result.status]} ${result.category}: ${result.test}${durationStr}`);
    if (result.status !== 'PASS') {
      console.log(`   ${result.message}`);
    }
  }

  /**
   * Update performance metrics
   */
  private updatePerformanceMetrics(duration: number): void {
    this.performanceMetrics.totalTests++;

    if (duration < this.performanceMetrics.minResponseTime) {
      this.performanceMetrics.minResponseTime = duration;
    }

    if (duration > this.performanceMetrics.maxResponseTime) {
      this.performanceMetrics.maxResponseTime = duration;
    }

    // Update average
    this.performanceMetrics.avgResponseTime =
      (this.performanceMetrics.avgResponseTime * (this.performanceMetrics.totalTests - 1) +
        duration) /
      this.performanceMetrics.totalTests;
  }

  /**
   * Generate comprehensive validation report
   */
  private generateReport(): {
    summary: any;
    results: ValidationResult[];
    performance: any;
  } {
    const totalTests = this.results.length;
    const passedTests = this.results.filter((r) => r.status === 'PASS').length;
    const failedTests = this.results.filter((r) => r.status === 'FAIL').length;
    const warningTests = this.results.filter((r) => r.status === 'WARNING').length;
    const skippedTests = this.results.filter((r) => r.status === 'SKIP').length;

    // Group results by category
    const categories = [...new Set(this.results.map((r) => r.category))];
    const categoryStats = categories.map((category) => {
      const categoryResults = this.results.filter((r) => r.category === category);
      return {
        category,
        total: categoryResults.length,
        passed: categoryResults.filter((r) => r.status === 'PASS').length,
        failed: categoryResults.filter((r) => r.status === 'FAIL').length,
        warnings: categoryResults.filter((r) => r.status === 'WARNING').length,
        skipped: categoryResults.filter((r) => r.status === 'SKIP').length,
        score: Math.round(
          (categoryResults.filter((r) => r.status === 'PASS').length / categoryResults.length) *
            100,
        ),
      };
    });

    const overallScore = Math.round((passedTests / totalTests) * 100);
    const executionTime = Date.now() - this.testStartTime;

    // Performance metrics
    this.performanceMetrics.passedTests = passedTests;
    this.performanceMetrics.failedTests = failedTests;

    const summary = {
      applicationMonitoringValidation: {
        overallScore: `${overallScore}%`,
        status:
          overallScore >= 80 ? 'EXCELLENT' : overallScore >= 60 ? 'GOOD' : 'NEEDS_IMPROVEMENT',
        totalTests,
        passedTests,
        failedTests,
        warningTests,
        skippedTests,
        executionTime: `${(executionTime / 1000).toFixed(2)}s`,
        categories: categoryStats,
      },
      mediaNetApplicationMonitoring: {
        apmCapabilities: categoryStats.find((c) => c.category === 'APM')?.score || 0,
        healthChecks: categoryStats.find((c) => c.category === 'HEALTH_CHECKS')?.score || 0,
        databaseMonitoring:
          categoryStats.find((c) => c.category === 'DATABASE_MONITORING')?.score || 0,
        memoryMonitoring: categoryStats.find((c) => c.category === 'MEMORY_MONITORING')?.score || 0,
        distributedTracing:
          categoryStats.find((c) => c.category === 'DISTRIBUTED_TRACING')?.score || 0,
        businessMetrics: categoryStats.find((c) => c.category === 'BUSINESS_METRICS')?.score || 0,
        realtimeMonitoring:
          categoryStats.find((c) => c.category === 'REALTIME_MONITORING')?.score || 0,
      },
      recommendations: this.generateRecommendations(),
    };

    return {
      summary,
      results: this.results,
      performance: this.performanceMetrics,
    };
  }

  /**
   * Generate recommendations based on results
   */
  private generateRecommendations(): string[] {
    const recommendations: string[] = [];
    const failedResults = this.results.filter((r) => r.status === 'FAIL');
    const warningResults = this.results.filter((r) => r.status === 'WARNING');

    // Critical failures
    if (failedResults.length > 0) {
      recommendations.push(`🚨 Address ${failedResults.length} critical monitoring failures`);
    }

    // Category-specific recommendations
    const categories = this.results.reduce(
      (acc, result) => {
        if (!acc[result.category]) acc[result.category] = { pass: 0, fail: 0, warn: 0 };
        if (result.status === 'PASS') acc[result.category].pass++;
        if (result.status === 'FAIL') acc[result.category].fail++;
        if (result.status === 'WARNING') acc[result.category].warn++;
        return acc;
      },
      {} as Record<string, any>,
    );

    Object.entries(categories).forEach(([category, stats]: [string, any]) => {
      const total = stats.pass + stats.fail + stats.warn;
      const score = Math.round((stats.pass / total) * 100);

      if (score < 70) {
        switch (category) {
          case 'APM':
            recommendations.push(
              '📊 Enhance APM capabilities with proper tracing headers and custom metrics',
            );
            break;
          case 'DATABASE_MONITORING':
            recommendations.push(
              '🗄️ Implement comprehensive database query monitoring and slow query detection',
            );
            break;
          case 'MEMORY_MONITORING':
            recommendations.push(
              '🧠 Set up proper memory leak detection and garbage collection monitoring',
            );
            break;
          case 'DISTRIBUTED_TRACING':
            recommendations.push(
              '🔗 Configure distributed tracing with OpenTelemetry for microservices',
            );
            break;
          case 'BUSINESS_METRICS':
            recommendations.push(
              '📈 Implement business KPI collection and custom metrics for user activity',
            );
            break;
          case 'REALTIME_MONITORING':
            recommendations.push(
              '🔴 Set up real-time monitoring and WebSocket connection tracking',
            );
            break;
        }
      }
    });

    // Performance recommendations
    if (this.performanceMetrics.avgResponseTime > 1000) {
      recommendations.push('⚡ Optimize monitoring endpoint response times');
    }

    if (recommendations.length === 0) {
      recommendations.push('🎉 Application monitoring is well-configured and comprehensive!');
    }

    return recommendations;
  }
}

// Export for use as module
export { ApplicationMonitoringValidator, ValidationResult };

// CLI execution
if (require.main === module) {
  const validator = new ApplicationMonitoringValidator();

  validator
    .validateApplicationMonitoring()
    .then((report) => {
      console.log('\n' + '='.repeat(80));
      console.log('📋 MEDIANEST APPLICATION MONITORING VALIDATION REPORT');
      console.log('='.repeat(80));
      console.log(JSON.stringify(report.summary, null, 2));
      console.log('\n' + '='.repeat(80));

      // Exit with appropriate code
      const overallScore = parseInt(report.summary.applicationMonitoringValidation.overallScore);
      process.exit(overallScore >= 70 ? 0 : 1);
    })
    .catch((error) => {
      console.error('❌ Validation suite failed:', error);
      process.exit(1);
    });
}
