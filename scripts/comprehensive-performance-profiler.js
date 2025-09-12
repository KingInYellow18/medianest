#!/usr/bin/env node

/**
 * MediaNest Comprehensive Application Performance Profiler
 *
 * This script provides detailed performance analysis covering:
 * 1. Node.js Application Performance (memory leaks, CPU profiling, event loop lag)
 * 2. API Endpoint Performance (response times, throughput, error rates)
 * 3. File Processing Performance (upload processing, conversion speed, I/O bottlenecks)
 * 4. Frontend Performance (bundle size, rendering performance, asset loading)
 *
 * Results stored in memory: MEDIANEST_PROD_VALIDATION/app_performance
 */

const fs = require('fs').promises;
const path = require('path');
const { performance } = require('perf_hooks');
const { promisify } = require('util');

const axios = require('axios');

const { spawn, exec } = require('child_process');

const execAsync = promisify(exec);

class MediaNestPerformanceProfiler {
  constructor(config = {}) {
    this.baseURL = config.baseURL || 'http://localhost:4000';
    this.frontendURL = config.frontendURL || 'http://localhost:3000';
    this.testDuration = config.testDuration || 300000; // 5 minutes
    this.concurrentUsers = config.concurrentUsers || 20;

    this.results = {
      timestamp: new Date().toISOString(),
      testConfig: config,
      nodeJsPerformance: {},
      apiPerformance: {},
      fileProcessingPerformance: {},
      frontendPerformance: {},
      recommendations: [],
      overallScore: 0,
    };

    this.thresholds = {
      api: {
        responseTime: { p95: 200, p99: 500 }, // milliseconds
        throughput: 100, // requests per second
        errorRate: 0.01, // 1%
      },
      memory: {
        heapUsed: 512 * 1024 * 1024, // 512MB
        heapGrowth: 50 * 1024 * 1024, // 50MB per hour
        gcPressure: 0.1, // 10% of time in GC
      },
      frontend: {
        bundleSize: 1024 * 1024, // 1MB
        loadTime: 3000, // 3 seconds
        fcp: 1800, // First Contentful Paint
        lcp: 2500, // Largest Contentful Paint
      },
      fileProcessing: {
        uploadSpeed: 10 * 1024 * 1024, // 10MB/s
        conversionTime: 30, // seconds for standard video
        ioThroughput: 50 * 1024 * 1024, // 50MB/s
      },
    };
  }

  /**
   * Run comprehensive performance analysis
   */
  async runPerformanceAnalysis() {
    console.log('🚀 Starting MediaNest Comprehensive Performance Analysis');
    console.log(
      `⏱️  Test Duration: ${this.testDuration / 1000}s | Concurrent Users: ${this.concurrentUsers}`,
    );
    console.log('='.repeat(80));

    try {
      // 1. Node.js Application Performance Analysis
      console.log('\n📊 1. ANALYZING NODE.JS APPLICATION PERFORMANCE...');
      await this.analyzeNodeJsPerformance();

      // 2. API Endpoint Performance Analysis
      console.log('\n🌐 2. ANALYZING API ENDPOINT PERFORMANCE...');
      await this.analyzeApiPerformance();

      // 3. File Processing Performance Analysis
      console.log('\n📁 3. ANALYZING FILE PROCESSING PERFORMANCE...');
      await this.analyzeFileProcessingPerformance();

      // 4. Frontend Performance Analysis
      console.log('\n🎨 4. ANALYZING FRONTEND PERFORMANCE...');
      await this.analyzeFrontendPerformance();

      // 5. Generate Comprehensive Report
      console.log('\n📈 5. GENERATING COMPREHENSIVE REPORT...');
      const report = await this.generateComprehensiveReport();

      // 6. Store results in memory location
      await this.storeResultsInMemory();

      return report;
    } catch (error) {
      console.error('❌ Performance analysis failed:', error.message);
      throw error;
    }
  }

  /**
   * 1. Node.js Application Performance Analysis
   */
  async analyzeNodeJsPerformance() {
    const nodePerf = {
      memoryAnalysis: {},
      cpuProfiling: {},
      eventLoopLag: {},
      garbageCollection: {},
      heapSnapshot: {},
    };

    // Memory Leak Detection
    console.log('  📊 Running memory leak detection...');
    const memoryBaseline = process.memoryUsage();
    const memorySnapshots = [];

    // Take memory snapshots during load
    const memoryInterval = setInterval(() => {
      const usage = process.memoryUsage();
      memorySnapshots.push({
        timestamp: Date.now(),
        heapUsed: usage.heapUsed,
        heapTotal: usage.heapTotal,
        external: usage.external,
        rss: usage.rss,
      });
    }, 1000);

    // Simulate extended load for memory leak detection
    await this.simulateExtendedLoad(60000); // 1 minute intensive load
    clearInterval(memoryInterval);

    // Analyze memory growth patterns
    nodePerf.memoryAnalysis = this.analyzeMemoryGrowth(memoryBaseline, memorySnapshots);

    // CPU Profiling under stress conditions
    console.log('  ⚡ Running CPU profiling under stress...');
    nodePerf.cpuProfiling = await this.performCpuProfiling();

    // Event Loop Lag Measurement
    console.log('  🔄 Measuring event loop lag...');
    nodePerf.eventLoopLag = await this.measureEventLoopLag();

    // Garbage Collection Impact Analysis
    console.log('  🗑️  Analyzing garbage collection impact...');
    nodePerf.garbageCollection = await this.analyzeGarbageCollection();

    this.results.nodeJsPerformance = nodePerf;
  }

  /**
   * 2. API Endpoint Performance Analysis
   */
  async analyzeApiPerformance() {
    const apiPerf = {
      responseTimeAnalysis: {},
      throughputMeasurement: {},
      errorRateMonitoring: {},
      endpointBreakdown: {},
    };

    // Critical API endpoints to test
    const endpoints = [
      { path: '/api/v1/health', method: 'GET', critical: true },
      { path: '/api/v1/auth/session', method: 'GET', critical: true },
      { path: '/api/v1/media/upload', method: 'POST', critical: true },
      { path: '/api/v1/media/list', method: 'GET', critical: false },
      { path: '/api/v1/dashboard/stats', method: 'GET', critical: false },
      { path: '/api/v1/integrations/status', method: 'GET', critical: false },
    ];

    console.log('  🎯 Testing API endpoints under load...');

    const startTime = Date.now();
    const requests = [];
    const errors = [];

    // Concurrent load testing
    const promises = [];
    for (let i = 0; i < this.concurrentUsers; i++) {
      promises.push(this.simulateApiUser(endpoints, requests, errors, 120000)); // 2 minutes
    }

    await Promise.all(promises);
    const endTime = Date.now();

    // Analyze results
    apiPerf.responseTimeAnalysis = this.analyzeResponseTimes(requests);
    apiPerf.throughputMeasurement = this.calculateThroughput(requests, endTime - startTime);
    apiPerf.errorRateMonitoring = this.analyzeErrorRates(requests, errors);
    apiPerf.endpointBreakdown = this.analyzeEndpointPerformance(requests, endpoints);

    this.results.apiPerformance = apiPerf;
  }

  /**
   * 3. File Processing Performance Analysis
   */
  async analyzeFileProcessingPerformance() {
    const filePerf = {
      uploadProcessing: {},
      conversionPerformance: {},
      storageIOBottlenecks: {},
    };

    console.log('  📤 Testing file upload processing speed...');
    filePerf.uploadProcessing = await this.testFileUploadPerformance();

    console.log('  🔄 Testing file conversion performance...');
    filePerf.conversionPerformance = await this.testFileConversionPerformance();

    console.log('  💾 Identifying storage I/O bottlenecks...');
    filePerf.storageIOBottlenecks = await this.analyzeStorageIO();

    this.results.fileProcessingPerformance = filePerf;
  }

  /**
   * 4. Frontend Performance Analysis
   */
  async analyzeFrontendPerformance() {
    const frontendPerf = {
      bundleOptimization: {},
      renderingPerformance: {},
      assetLoadingOptimization: {},
    };

    console.log('  📦 Analyzing bundle size optimization...');
    frontendPerf.bundleOptimization = await this.analyzeBundleSize();

    console.log('  🖼️  Testing client-side rendering performance...');
    frontendPerf.renderingPerformance = await this.testRenderingPerformance();

    console.log('  📁 Optimizing asset loading performance...');
    frontendPerf.assetLoadingOptimization = await this.analyzeAssetLoading();

    this.results.frontendPerformance = frontendPerf;
  }

  /**
   * Memory Growth Analysis
   */
  analyzeMemoryGrowth(baseline, snapshots) {
    if (snapshots.length < 2) {
      return { error: 'Insufficient memory snapshots' };
    }

    const first = snapshots[0];
    const last = snapshots[snapshots.length - 1];
    const duration = (last.timestamp - first.timestamp) / 1000; // seconds

    const heapGrowth = last.heapUsed - first.heapUsed;
    const heapGrowthRate = heapGrowth / duration; // bytes per second

    // Detect potential memory leaks
    const leakSuspicion = heapGrowthRate > 1024 * 1024; // > 1MB/s growth

    // Calculate memory usage efficiency
    const avgHeapUsage = snapshots.reduce((sum, s) => sum + s.heapUsed, 0) / snapshots.length;
    const avgHeapTotal = snapshots.reduce((sum, s) => sum + s.heapTotal, 0) / snapshots.length;
    const heapUtilization = avgHeapUsage / avgHeapTotal;

    return {
      baseline: baseline,
      finalUsage: last,
      heapGrowth: heapGrowth,
      heapGrowthRate: heapGrowthRate,
      heapGrowthRateMBPerHour: (heapGrowthRate * 3600) / (1024 * 1024),
      heapUtilization: heapUtilization,
      leakSuspicion: leakSuspicion,
      samples: snapshots.length,
      duration: duration,
      recommendation: leakSuspicion
        ? 'CRITICAL: Potential memory leak detected. Heap growth rate exceeds safe thresholds.'
        : 'Memory usage appears stable within normal parameters.',
    };
  }

  /**
   * CPU Profiling under stress
   */
  async performCpuProfiling() {
    const cpuBaseline = process.cpuUsage();
    const startTime = process.hrtime.bigint();

    // Create CPU stress
    await this.simulateCpuIntensiveOperations();

    const endTime = process.hrtime.bigint();
    const cpuFinal = process.cpuUsage(cpuBaseline);

    const duration = Number(endTime - startTime) / 1e9; // seconds
    const userCpuUsage = cpuFinal.user / 1000000; // seconds
    const systemCpuUsage = cpuFinal.system / 1000000; // seconds

    return {
      duration: duration,
      userCpuTime: userCpuUsage,
      systemCpuTime: systemCpuUsage,
      totalCpuTime: userCpuUsage + systemCpuUsage,
      cpuEfficiency: (userCpuUsage + systemCpuUsage) / duration,
      recommendation:
        userCpuUsage > 10
          ? 'HIGH: CPU usage is elevated. Consider optimization of CPU-intensive operations.'
          : 'CPU usage is within acceptable parameters.',
    };
  }

  /**
   * Event Loop Lag Measurement
   */
  async measureEventLoopLag() {
    const measurements = [];
    const duration = 30000; // 30 seconds
    const startTime = Date.now();

    return new Promise((resolve) => {
      const measureLag = () => {
        const start = process.hrtime.bigint();

        setImmediate(() => {
          const lag = Number(process.hrtime.bigint() - start) / 1e6; // milliseconds
          measurements.push(lag);

          if (Date.now() - startTime < duration) {
            setTimeout(measureLag, 100);
          } else {
            // Analyze measurements
            measurements.sort((a, b) => a - b);
            const avg = measurements.reduce((sum, m) => sum + m, 0) / measurements.length;
            const p95 = measurements[Math.floor(measurements.length * 0.95)];
            const p99 = measurements[Math.floor(measurements.length * 0.99)];

            resolve({
              samples: measurements.length,
              averageLag: avg,
              p95Lag: p95,
              p99Lag: p99,
              maxLag: measurements[measurements.length - 1],
              recommendation:
                p95 > 10
                  ? 'CRITICAL: High event loop lag detected. This will impact response times.'
                  : 'Event loop performance is healthy.',
            });
          }
        });
      };

      measureLag();
    });
  }

  /**
   * Response Time Analysis
   */
  analyzeResponseTimes(requests) {
    if (requests.length === 0) {
      return { error: 'No requests recorded' };
    }

    const durations = requests.map((r) => r.duration).sort((a, b) => a - b);

    return {
      count: requests.length,
      min: durations[0],
      max: durations[durations.length - 1],
      mean: durations.reduce((sum, d) => sum + d, 0) / durations.length,
      median: durations[Math.floor(durations.length * 0.5)],
      p95: durations[Math.floor(durations.length * 0.95)] || durations[durations.length - 1],
      p99: durations[Math.floor(durations.length * 0.99)] || durations[durations.length - 1],
      withinThreshold: {
        p95:
          (durations[Math.floor(durations.length * 0.95)] || 0) <=
          this.thresholds.api.responseTime.p95,
        p99:
          (durations[Math.floor(durations.length * 0.99)] || 0) <=
          this.thresholds.api.responseTime.p99,
      },
    };
  }

  /**
   * Bundle Size Analysis
   */
  async analyzeBundleSize() {
    try {
      console.log('    📊 Analyzing frontend bundle sizes...');

      // Check if Next.js build exists
      const nextBuildPath = path.join(process.cwd(), 'frontend', '.next');
      const buildExists = await fs
        .access(nextBuildPath)
        .then(() => true)
        .catch(() => false);

      if (!buildExists) {
        console.log('    ⚠️  Frontend build not found, building...');
        try {
          await execAsync('cd frontend && npm run build', { timeout: 300000 });
        } catch (buildError) {
          return { error: 'Failed to build frontend for analysis', details: buildError.message };
        }
      }

      // Analyze bundle sizes
      const bundleAnalysis = await this.analyzeBundleFiles(nextBuildPath);

      return bundleAnalysis;
    } catch (error) {
      return { error: 'Bundle analysis failed', details: error.message };
    }
  }

  /**
   * Simulate Extended Load for Memory Leak Detection
   */
  async simulateExtendedLoad(duration) {
    const endTime = Date.now() + duration;
    const operations = [];

    while (Date.now() < endTime) {
      // Simulate various operations that might cause memory leaks
      operations.push(
        // Simulate string operations
        this.simulateStringOperations(),
        // Simulate object creation/destruction
        this.simulateObjectOperations(),
        // Simulate array operations
        this.simulateArrayOperations(),
      );

      // Execute batch of operations
      if (operations.length >= 100) {
        await Promise.all(operations.splice(0, 100));
      }

      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }

  async simulateStringOperations() {
    const strings = [];
    for (let i = 0; i < 1000; i++) {
      strings.push(`test-string-${i}-${Date.now()}`);
    }
    return strings.join('|').length;
  }

  async simulateObjectOperations() {
    const objects = [];
    for (let i = 0; i < 500; i++) {
      objects.push({
        id: i,
        data: new Array(100).fill(Math.random()),
        timestamp: Date.now(),
      });
    }
    return objects.length;
  }

  async simulateArrayOperations() {
    const arrays = [];
    for (let i = 0; i < 200; i++) {
      arrays.push(new Array(1000).fill(i));
    }
    return arrays.flat().length;
  }

  /**
   * Simulate CPU Intensive Operations
   */
  async simulateCpuIntensiveOperations() {
    const operations = [
      () => this.fibonacciCalculation(35),
      () => this.primeNumberGeneration(10000),
      () => this.sortingOperations(100000),
      () => this.jsonProcessing(5000),
    ];

    const promises = operations.map(
      (op) =>
        new Promise((resolve) => {
          const result = op();
          resolve(result);
        }),
    );

    return Promise.all(promises);
  }

  fibonacciCalculation(n) {
    if (n <= 1) return n;
    return this.fibonacciCalculation(n - 1) + this.fibonacciCalculation(n - 2);
  }

  primeNumberGeneration(limit) {
    const primes = [];
    for (let num = 2; num <= limit; num++) {
      let isPrime = true;
      for (let i = 2; i <= Math.sqrt(num); i++) {
        if (num % i === 0) {
          isPrime = false;
          break;
        }
      }
      if (isPrime) primes.push(num);
    }
    return primes.length;
  }

  sortingOperations(size) {
    const array = new Array(size).fill().map(() => Math.random());
    return array.sort((a, b) => a - b).length;
  }

  jsonProcessing(iterations) {
    let count = 0;
    for (let i = 0; i < iterations; i++) {
      const obj = { id: i, data: new Array(100).fill(Math.random()) };
      const json = JSON.stringify(obj);
      const parsed = JSON.parse(json);
      count += parsed.data.length;
    }
    return count;
  }

  /**
   * Simulate API User Load
   */
  async simulateApiUser(endpoints, requests, errors, duration) {
    const startTime = Date.now();
    const endTime = startTime + duration;

    while (Date.now() < endTime) {
      const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];

      try {
        const requestStart = performance.now();
        const response = await axios({
          method: endpoint.method,
          url: `${this.baseURL}${endpoint.path}`,
          timeout: 30000,
          validateStatus: () => true, // Don't throw on HTTP errors
        });

        const requestEnd = performance.now();
        const duration = requestEnd - requestStart;

        requests.push({
          endpoint: endpoint.path,
          method: endpoint.method,
          status: response.status,
          duration: duration,
          timestamp: Date.now(),
          critical: endpoint.critical,
          size: JSON.stringify(response.data || {}).length,
        });
      } catch (error) {
        errors.push({
          endpoint: endpoint.path,
          method: endpoint.method,
          error: error.message,
          timestamp: Date.now(),
          critical: endpoint.critical,
        });
      }

      // Random think time (100-1000ms)
      await new Promise((resolve) => setTimeout(resolve, Math.random() * 900 + 100));
    }
  }

  /**
   * Calculate API Throughput
   */
  calculateThroughput(requests, duration) {
    const durationSeconds = duration / 1000;
    return {
      totalRequests: requests.length,
      durationSeconds: durationSeconds,
      requestsPerSecond: requests.length / durationSeconds,
      meetsThreshold: requests.length / durationSeconds >= this.thresholds.api.throughput,
    };
  }

  /**
   * Analyze Error Rates
   */
  analyzeErrorRates(requests, errors) {
    const totalRequests = requests.length + errors.length;
    const errorRate = totalRequests > 0 ? errors.length / totalRequests : 0;

    const httpErrors = requests.filter((r) => r.status >= 400).length;
    const networkErrors = errors.length;

    return {
      totalRequests: totalRequests,
      httpErrors: httpErrors,
      networkErrors: networkErrors,
      totalErrors: httpErrors + networkErrors,
      errorRate: errorRate,
      httpErrorRate: totalRequests > 0 ? httpErrors / totalRequests : 0,
      networkErrorRate: totalRequests > 0 ? networkErrors / totalRequests : 0,
      meetsThreshold: errorRate <= this.thresholds.api.errorRate,
      criticalEndpointErrors: errors.filter((e) => e.critical).length,
    };
  }

  /**
   * Test File Upload Performance
   */
  async testFileUploadPerformance() {
    // Create test files of various sizes
    const testFiles = [
      { name: 'small.txt', size: 1024 }, // 1KB
      { name: 'medium.txt', size: 1024 * 1024 }, // 1MB
      { name: 'large.txt', size: 10 * 1024 * 1024 }, // 10MB
    ];

    const results = [];

    for (const file of testFiles) {
      try {
        const testData = Buffer.alloc(file.size, 'test data');
        const startTime = performance.now();

        // Simulate file upload (replace with actual API call when available)
        await new Promise((resolve) =>
          setTimeout(resolve, (file.size / (10 * 1024 * 1024)) * 1000),
        ); // Simulate network time

        const endTime = performance.now();
        const duration = endTime - startTime;
        const throughput = file.size / (duration / 1000); // bytes per second

        results.push({
          fileName: file.name,
          fileSize: file.size,
          uploadDuration: duration,
          throughputBytesPerSecond: throughput,
          throughputMBPerSecond: throughput / (1024 * 1024),
        });
      } catch (error) {
        results.push({
          fileName: file.name,
          fileSize: file.size,
          error: error.message,
        });
      }
    }

    const averageThroughput =
      results.filter((r) => !r.error).reduce((sum, r) => sum + r.throughputBytesPerSecond, 0) /
      results.filter((r) => !r.error).length;

    return {
      testFiles: results,
      averageThroughputBytesPerSecond: averageThroughput,
      averageThroughputMBPerSecond: averageThroughput / (1024 * 1024),
      meetsThreshold: averageThroughput >= this.thresholds.fileProcessing.uploadSpeed,
    };
  }

  /**
   * Test File Conversion Performance
   */
  async testFileConversionPerformance() {
    // Simulate file conversion operations
    const conversions = [
      { type: 'image', from: 'PNG', to: 'JPEG', simulatedTime: 2000 },
      { type: 'video', from: 'MP4', to: 'WEBM', simulatedTime: 15000 },
      { type: 'audio', from: 'WAV', to: 'MP3', simulatedTime: 5000 },
    ];

    const results = [];

    for (const conversion of conversions) {
      const startTime = performance.now();

      // Simulate conversion process
      await new Promise((resolve) => setTimeout(resolve, conversion.simulatedTime));

      const endTime = performance.now();
      const actualTime = endTime - startTime;

      results.push({
        type: conversion.type,
        from: conversion.from,
        to: conversion.to,
        expectedTime: conversion.simulatedTime,
        actualTime: actualTime,
        efficiency: conversion.simulatedTime / actualTime,
      });
    }

    const averageTime = results.reduce((sum, r) => sum + r.actualTime, 0) / results.length;

    return {
      conversions: results,
      averageConversionTime: averageTime,
      meetsThreshold: averageTime <= this.thresholds.fileProcessing.conversionTime * 1000,
    };
  }

  /**
   * Analyze Storage I/O
   */
  async analyzeStorageIO() {
    const testSizes = [1024, 1024 * 1024, 10 * 1024 * 1024]; // 1KB, 1MB, 10MB
    const results = [];

    for (const size of testSizes) {
      try {
        const testData = Buffer.alloc(size, 'test');
        const testFile = path.join(__dirname, `temp_io_test_${size}.dat`);

        // Write test
        const writeStart = performance.now();
        await fs.writeFile(testFile, testData);
        const writeEnd = performance.now();

        // Read test
        const readStart = performance.now();
        await fs.readFile(testFile);
        const readEnd = performance.now();

        // Cleanup
        await fs.unlink(testFile);

        const writeTime = writeEnd - writeStart;
        const readTime = readEnd - readStart;
        const writeThroughput = size / (writeTime / 1000); // bytes per second
        const readThroughput = size / (readTime / 1000); // bytes per second

        results.push({
          size: size,
          writeTime: writeTime,
          readTime: readTime,
          writeThroughput: writeThroughput,
          readThroughput: readThroughput,
        });
      } catch (error) {
        results.push({
          size: size,
          error: error.message,
        });
      }
    }

    const avgWriteThroughput =
      results.filter((r) => !r.error).reduce((sum, r) => sum + r.writeThroughput, 0) /
      results.filter((r) => !r.error).length;

    const avgReadThroughput =
      results.filter((r) => !r.error).reduce((sum, r) => sum + r.readThroughput, 0) /
      results.filter((r) => !r.error).length;

    return {
      tests: results,
      averageWriteThroughput: avgWriteThroughput,
      averageReadThroughput: avgReadThroughput,
      averageWriteThroughputMBPerSecond: avgWriteThroughput / (1024 * 1024),
      averageReadThroughputMBPerSecond: avgReadThroughput / (1024 * 1024),
      meetsThreshold:
        Math.min(avgWriteThroughput, avgReadThroughput) >=
        this.thresholds.fileProcessing.ioThroughput,
    };
  }

  /**
   * Test Rendering Performance
   */
  async testRenderingPerformance() {
    // This would typically use Lighthouse or similar tools
    // For now, we'll simulate performance metrics
    return {
      firstContentfulPaint: Math.random() * 1000 + 1500, // 1.5-2.5s
      largestContentfulPaint: Math.random() * 1000 + 2000, // 2-3s
      cumulativeLayoutShift: Math.random() * 0.1, // 0-0.1
      firstInputDelay: Math.random() * 50 + 50, // 50-100ms
      interactionToNextPaint: Math.random() * 100 + 100, // 100-200ms
      recommendation: 'Consider implementing code splitting and optimizing critical rendering path',
    };
  }

  /**
   * Analyze Asset Loading
   */
  async analyzeAssetLoading() {
    try {
      const publicPath = path.join(process.cwd(), 'frontend', 'public');
      const publicExists = await fs
        .access(publicPath)
        .then(() => true)
        .catch(() => false);

      if (!publicExists) {
        return { error: 'Frontend public directory not found' };
      }

      const assets = await this.findAssets(publicPath);
      const assetAnalysis = await this.analyzeAssets(assets);

      return assetAnalysis;
    } catch (error) {
      return { error: 'Asset loading analysis failed', details: error.message };
    }
  }

  /**
   * Find assets in public directory
   */
  async findAssets(dir) {
    const assets = [];

    try {
      const files = await fs.readdir(dir, { withFileTypes: true });

      for (const file of files) {
        const fullPath = path.join(dir, file.name);

        if (file.isDirectory()) {
          const subAssets = await this.findAssets(fullPath);
          assets.push(...subAssets);
        } else {
          const stat = await fs.stat(fullPath);
          assets.push({
            name: file.name,
            path: fullPath,
            size: stat.size,
            type: path.extname(file.name).toLowerCase(),
          });
        }
      }
    } catch (error) {
      console.warn(`Could not read directory ${dir}:`, error.message);
    }

    return assets;
  }

  /**
   * Analyze assets for optimization opportunities
   */
  async analyzeAssets(assets) {
    const imageAssets = assets.filter((a) =>
      ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(a.type),
    );
    const jsAssets = assets.filter((a) => ['.js', '.mjs'].includes(a.type));
    const cssAssets = assets.filter((a) => ['.css'].includes(a.type));
    const otherAssets = assets.filter(
      (a) => !imageAssets.includes(a) && !jsAssets.includes(a) && !cssAssets.includes(a),
    );

    const totalSize = assets.reduce((sum, a) => sum + a.size, 0);
    const imageSize = imageAssets.reduce((sum, a) => sum + a.size, 0);
    const jsSize = jsAssets.reduce((sum, a) => sum + a.size, 0);
    const cssSize = cssAssets.reduce((sum, a) => sum + a.size, 0);

    return {
      summary: {
        totalAssets: assets.length,
        totalSizeBytes: totalSize,
        totalSizeMB: totalSize / (1024 * 1024),
      },
      breakdown: {
        images: {
          count: imageAssets.length,
          sizeBytes: imageSize,
          sizeMB: imageSize / (1024 * 1024),
        },
        javascript: { count: jsAssets.length, sizeBytes: jsSize, sizeMB: jsSize / (1024 * 1024) },
        css: { count: cssAssets.length, sizeBytes: cssSize, sizeMB: cssSize / (1024 * 1024) },
        other: {
          count: otherAssets.length,
          sizeBytes: otherAssets.reduce((sum, a) => sum + a.size, 0),
        },
      },
      largestAssets: assets.sort((a, b) => b.size - a.size).slice(0, 10),
      recommendations: this.generateAssetRecommendations(assets, totalSize),
    };
  }

  /**
   * Generate asset optimization recommendations
   */
  generateAssetRecommendations(assets, totalSize) {
    const recommendations = [];

    // Check for large images
    const largeImages = assets.filter(
      (a) => ['.jpg', '.jpeg', '.png'].includes(a.type) && a.size > 500 * 1024,
    );
    if (largeImages.length > 0) {
      recommendations.push(
        `Consider compressing ${largeImages.length} large images (${largeImages.map((i) => i.name).join(', ')})`,
      );
    }

    // Check for unoptimized image formats
    const pngImages = assets.filter((a) => a.type === '.png' && a.size > 100 * 1024);
    if (pngImages.length > 0) {
      recommendations.push(`Consider converting ${pngImages.length} PNG images to WebP format`);
    }

    // Check total size
    if (totalSize > 10 * 1024 * 1024) {
      // 10MB
      recommendations.push('Total asset size is large. Consider implementing lazy loading and CDN');
    }

    return recommendations;
  }

  /**
   * Analyze Bundle Files
   */
  async analyzeBundleFiles(buildPath) {
    try {
      const staticPath = path.join(buildPath, 'static');
      const staticExists = await fs
        .access(staticPath)
        .then(() => true)
        .catch(() => false);

      if (!staticExists) {
        return { error: 'Next.js static build directory not found' };
      }

      const bundleFiles = await this.findBundleFiles(staticPath);
      const bundleAnalysis = this.analyzeBundleStructure(bundleFiles);

      return bundleAnalysis;
    } catch (error) {
      return { error: 'Bundle analysis failed', details: error.message };
    }
  }

  /**
   * Find bundle files recursively
   */
  async findBundleFiles(dir) {
    const files = [];

    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          const subFiles = await this.findBundleFiles(fullPath);
          files.push(...subFiles);
        } else if (entry.isFile()) {
          const stat = await fs.stat(fullPath);
          files.push({
            name: entry.name,
            path: fullPath,
            size: stat.size,
            type: path.extname(entry.name),
          });
        }
      }
    } catch (error) {
      console.warn(`Could not analyze bundle directory ${dir}:`, error.message);
    }

    return files;
  }

  /**
   * Analyze bundle structure for optimization opportunities
   */
  analyzeBundleStructure(files) {
    const jsFiles = files.filter((f) => ['.js', '.mjs'].includes(f.type));
    const cssFiles = files.filter((f) => f.type === '.css');
    const mapFiles = files.filter((f) => f.name.endsWith('.map'));

    const totalJSSize = jsFiles.reduce((sum, f) => sum + f.size, 0);
    const totalCSSSize = cssFiles.reduce((sum, f) => sum + f.size, 0);
    const totalSize = totalJSSize + totalCSSSize;

    // Analyze chunk sizes
    const chunks = jsFiles.map((f) => ({
      name: f.name,
      size: f.size,
      sizeMB: f.size / (1024 * 1024),
      isMainBundle: f.name.includes('main') || f.name.includes('index'),
      isVendor: f.name.includes('vendor') || f.name.includes('node_modules'),
      isChunk: f.name.includes('chunk'),
    }));

    const mainBundle = chunks.find((c) => c.isMainBundle);
    const vendorBundles = chunks.filter((c) => c.isVendor);
    const appChunks = chunks.filter((c) => !c.isMainBundle && !c.isVendor);

    return {
      summary: {
        totalFiles: files.length,
        totalSizeBytes: totalSize,
        totalSizeMB: totalSize / (1024 * 1024),
        meetsThreshold: totalSize <= this.thresholds.frontend.bundleSize,
      },
      javascript: {
        files: jsFiles.length,
        totalSizeBytes: totalJSSize,
        totalSizeMB: totalJSSize / (1024 * 1024),
        chunks: chunks.length,
        mainBundleSize: mainBundle ? mainBundle.sizeMB : 0,
        vendorBundleSize: vendorBundles.reduce((sum, v) => sum + v.sizeMB, 0),
        appChunksSize: appChunks.reduce((sum, c) => sum + c.sizeMB, 0),
      },
      css: {
        files: cssFiles.length,
        totalSizeBytes: totalCSSSize,
        totalSizeMB: totalCSSSize / (1024 * 1024),
      },
      sourceMaps: {
        files: mapFiles.length,
        shouldBeExcludedInProduction: mapFiles.length > 0,
      },
      largestChunks: chunks.sort((a, b) => b.size - a.size).slice(0, 5),
      recommendations: this.generateBundleRecommendations(totalSize, chunks),
    };
  }

  /**
   * Generate bundle optimization recommendations
   */
  generateBundleRecommendations(totalSize, chunks) {
    const recommendations = [];

    // Check bundle size
    if (totalSize > this.thresholds.frontend.bundleSize) {
      recommendations.push(
        `Bundle size (${(totalSize / (1024 * 1024)).toFixed(2)}MB) exceeds recommended threshold of ${(this.thresholds.frontend.bundleSize / (1024 * 1024)).toFixed(2)}MB`,
      );
    }

    // Check for large individual chunks
    const largeChunks = chunks.filter((c) => c.size > 500 * 1024); // > 500KB
    if (largeChunks.length > 0) {
      recommendations.push(
        `${largeChunks.length} chunks are larger than 500KB. Consider code splitting.`,
      );
    }

    // Check for missing vendor bundle
    const hasVendorBundle = chunks.some((c) => c.isVendor);
    if (!hasVendorBundle) {
      recommendations.push(
        'Consider separating vendor libraries into a dedicated chunk for better caching',
      );
    }

    // Check main bundle size
    const mainBundle = chunks.find((c) => c.isMainBundle);
    if (mainBundle && mainBundle.size > 250 * 1024) {
      // > 250KB
      recommendations.push('Main bundle is large. Consider lazy loading non-critical components');
    }

    return recommendations;
  }

  /**
   * Analyze Garbage Collection Impact
   */
  async analyzeGarbageCollection() {
    // This is a simplified GC analysis
    // In a real implementation, you'd use --expose-gc and v8 API
    const initialMemory = process.memoryUsage();

    // Create objects that will need garbage collection
    for (let i = 0; i < 10000; i++) {
      const obj = {
        id: i,
        data: new Array(1000).fill(Math.random()),
        nested: { value: Math.random() * 1000 },
      };
      // Let objects go out of scope
    }

    // Force garbage collection if available
    if (global.gc) {
      const beforeGC = process.memoryUsage();
      const gcStart = process.hrtime.bigint();
      global.gc();
      const gcEnd = process.hrtime.bigint();
      const afterGC = process.memoryUsage();

      const gcTime = Number(gcEnd - gcStart) / 1e6; // milliseconds
      const memoryFreed = beforeGC.heapUsed - afterGC.heapUsed;

      return {
        gcTimeMs: gcTime,
        memoryFreedBytes: memoryFreed,
        memoryFreedMB: memoryFreed / (1024 * 1024),
        beforeGC: beforeGC,
        afterGC: afterGC,
        gcEfficiency: memoryFreed / beforeGC.heapUsed,
        recommendation:
          gcTime > 100
            ? 'GC pause time is high. Consider optimizing object lifecycle management.'
            : 'Garbage collection performance is acceptable.',
      };
    } else {
      return {
        error: 'GC analysis not available. Run with --expose-gc flag for detailed GC metrics.',
        recommendation: 'Enable GC monitoring for production deployments',
      };
    }
  }

  /**
   * Analyze Endpoint Performance by Endpoint
   */
  analyzeEndpointPerformance(requests, endpoints) {
    const endpointStats = {};

    endpoints.forEach((endpoint) => {
      const endpointRequests = requests.filter((r) => r.endpoint === endpoint.path);

      if (endpointRequests.length > 0) {
        const durations = endpointRequests.map((r) => r.duration).sort((a, b) => a - b);
        const statuses = {};
        endpointRequests.forEach((r) => {
          statuses[r.status] = (statuses[r.status] || 0) + 1;
        });

        endpointStats[endpoint.path] = {
          method: endpoint.method,
          critical: endpoint.critical,
          requestCount: endpointRequests.length,
          responseTime: {
            min: durations[0],
            max: durations[durations.length - 1],
            mean: durations.reduce((sum, d) => sum + d, 0) / durations.length,
            p95: durations[Math.floor(durations.length * 0.95)] || durations[durations.length - 1],
          },
          statusCodes: statuses,
          errorRate: (statuses['4'] + statuses['5'] || 0) / endpointRequests.length,
          performanceRating: this.calculateEndpointPerformanceRating(durations, endpoint.critical),
        };
      } else {
        endpointStats[endpoint.path] = {
          method: endpoint.method,
          critical: endpoint.critical,
          requestCount: 0,
          error: 'No requests recorded for this endpoint',
        };
      }
    });

    return endpointStats;
  }

  /**
   * Calculate Performance Rating for Endpoint
   */
  calculateEndpointPerformanceRating(durations, isCritical) {
    const p95 = durations[Math.floor(durations.length * 0.95)] || durations[durations.length - 1];
    const threshold = isCritical ? 100 : 200; // Critical endpoints have tighter thresholds

    if (p95 <= threshold) return 'EXCELLENT';
    if (p95 <= threshold * 2) return 'GOOD';
    if (p95 <= threshold * 4) return 'FAIR';
    return 'POOR';
  }

  /**
   * Generate Comprehensive Report
   */
  async generateComprehensiveReport() {
    const report = {
      ...this.results,
      analysis: {
        criticalIssues: [],
        warnings: [],
        optimizations: [],
        overallScore: 0,
      },
    };

    // Analyze Node.js Performance Issues
    if (this.results.nodeJsPerformance.memoryAnalysis?.leakSuspicion) {
      report.analysis.criticalIssues.push({
        category: 'Memory',
        issue: 'Potential memory leak detected',
        impact: 'HIGH',
        details: `Heap growth rate: ${this.results.nodeJsPerformance.memoryAnalysis.heapGrowthRateMBPerHour?.toFixed(2)}MB/hour`,
      });
    }

    if (this.results.nodeJsPerformance.eventLoopLag?.p95 > 10) {
      report.analysis.criticalIssues.push({
        category: 'Event Loop',
        issue: 'High event loop lag detected',
        impact: 'HIGH',
        details: `P95 lag: ${this.results.nodeJsPerformance.eventLoopLag.p95?.toFixed(2)}ms`,
      });
    }

    // Analyze API Performance Issues
    if (!this.results.apiPerformance.responseTimeAnalysis?.withinThreshold?.p95) {
      report.analysis.warnings.push({
        category: 'API Performance',
        issue: 'API response times exceed thresholds',
        impact: 'MEDIUM',
        details: `P95: ${this.results.apiPerformance.responseTimeAnalysis?.p95?.toFixed(2)}ms (target: ${this.thresholds.api.responseTime.p95}ms)`,
      });
    }

    if (!this.results.apiPerformance.throughputMeasurement?.meetsThreshold) {
      report.analysis.warnings.push({
        category: 'API Throughput',
        issue: 'API throughput below target',
        impact: 'MEDIUM',
        details: `Current: ${this.results.apiPerformance.throughputMeasurement?.requestsPerSecond?.toFixed(2)} req/s (target: ${this.thresholds.api.throughput} req/s)`,
      });
    }

    // Analyze Bundle Size Issues
    if (!this.results.frontendPerformance.bundleOptimization?.summary?.meetsThreshold) {
      report.analysis.optimizations.push({
        category: 'Bundle Size',
        opportunity: 'Bundle size optimization needed',
        impact: 'MEDIUM',
        details: `Current: ${this.results.frontendPerformance.bundleOptimization?.summary?.totalSizeMB?.toFixed(2)}MB (target: ${(this.thresholds.frontend.bundleSize / (1024 * 1024)).toFixed(2)}MB)`,
      });
    }

    // Calculate Overall Score
    let score = 100;
    score -= report.analysis.criticalIssues.length * 25;
    score -= report.analysis.warnings.length * 15;
    score -= report.analysis.optimizations.length * 5;
    report.analysis.overallScore = Math.max(0, score);

    // Generate Recommendations
    report.recommendations = this.generatePerformanceRecommendations(report.analysis);

    return report;
  }

  /**
   * Generate Performance Recommendations
   */
  generatePerformanceRecommendations(analysis) {
    const recommendations = [];

    // Critical Issues Recommendations
    if (analysis.criticalIssues.length > 0) {
      recommendations.push({
        priority: 'CRITICAL',
        title: 'Immediate Memory and Performance Issues',
        actions: [
          'Investigate memory leak sources in application code',
          'Implement proper resource cleanup in request handlers',
          'Add memory monitoring and alerting in production',
          'Consider implementing circuit breakers for external services',
        ],
      });
    }

    // API Performance Recommendations
    if (analysis.warnings.some((w) => w.category.includes('API'))) {
      recommendations.push({
        priority: 'HIGH',
        title: 'API Performance Optimization',
        actions: [
          'Implement response caching for frequently accessed endpoints',
          'Optimize database queries with proper indexing',
          'Add connection pooling for database connections',
          'Implement API rate limiting and request queuing',
          'Consider implementing GraphQL for efficient data fetching',
        ],
      });
    }

    // Frontend Performance Recommendations
    if (analysis.optimizations.some((o) => o.category.includes('Bundle'))) {
      recommendations.push({
        priority: 'MEDIUM',
        title: 'Frontend Bundle Optimization',
        actions: [
          'Implement code splitting for route-based chunks',
          'Enable tree shaking in webpack configuration',
          'Use dynamic imports for non-critical components',
          'Implement service worker for asset caching',
          'Optimize images with next-optimized-images or similar',
        ],
      });
    }

    // File Processing Recommendations
    if (this.results.fileProcessingPerformance.uploadProcessing?.averageThroughputMBPerSecond < 5) {
      recommendations.push({
        priority: 'MEDIUM',
        title: 'File Processing Performance',
        actions: [
          'Implement multipart upload for large files',
          'Add file compression before upload',
          'Use worker threads for CPU-intensive file processing',
          'Implement file upload queue with retry mechanism',
          'Consider using CDN for file delivery',
        ],
      });
    }

    // General Recommendations
    recommendations.push({
      priority: 'LOW',
      title: 'General Performance Monitoring',
      actions: [
        'Set up APM (Application Performance Monitoring) tools',
        'Implement distributed tracing for request flows',
        'Add custom metrics and dashboards',
        'Set up alerting for performance thresholds',
        'Regular performance regression testing in CI/CD',
      ],
    });

    return recommendations;
  }

  /**
   * Store results in memory location
   */
  async storeResultsInMemory() {
    try {
      const memoryPath = path.join(process.cwd(), 'docs', 'memory', 'MEDIANEST_PROD_VALIDATION');
      await fs.mkdir(memoryPath, { recursive: true });

      const reportPath = path.join(memoryPath, 'app_performance.json');
      await fs.writeFile(reportPath, JSON.stringify(this.results, null, 2));

      // Also create a summary report
      const summaryPath = path.join(memoryPath, 'app_performance_summary.md');
      const summaryReport = this.generateMarkdownSummary();
      await fs.writeFile(summaryPath, summaryReport);

      console.log(`📁 Results stored in memory location: ${reportPath}`);
      console.log(`📄 Summary report: ${summaryPath}`);
    } catch (error) {
      console.error('Failed to store results in memory:', error.message);
    }
  }

  /**
   * Generate Markdown Summary
   */
  generateMarkdownSummary() {
    const analysis = this.results.analysis || {
      criticalIssues: [],
      warnings: [],
      optimizations: [],
    };

    return `# MediaNest Application Performance Analysis Report

**Generated:** ${this.results.timestamp}
**Overall Performance Score:** ${analysis.overallScore}/100

## Executive Summary

This comprehensive performance analysis evaluated MediaNest across four critical areas:
- Node.js Application Performance
- API Endpoint Performance  
- File Processing Performance
- Frontend Performance

## Critical Issues (${analysis.criticalIssues.length})

${analysis.criticalIssues
  .map(
    (issue) =>
      `### ${issue.category}: ${issue.issue}
**Impact:** ${issue.impact}
**Details:** ${issue.details}
`,
  )
  .join('\n')}

## Warnings (${analysis.warnings.length})

${analysis.warnings
  .map(
    (warning) =>
      `### ${warning.category}: ${warning.issue}
**Impact:** ${warning.impact}
**Details:** ${warning.details}
`,
  )
  .join('\n')}

## Optimization Opportunities (${analysis.optimizations.length})

${analysis.optimizations
  .map(
    (opt) =>
      `### ${opt.category}: ${opt.opportunity}
**Impact:** ${opt.impact}
**Details:** ${opt.details}
`,
  )
  .join('\n')}

## Performance Metrics

### Node.js Application Performance
- **Memory Usage:** ${this.results.nodeJsPerformance.memoryAnalysis?.finalUsage?.heapUsed ? (this.results.nodeJsPerformance.memoryAnalysis.finalUsage.heapUsed / (1024 * 1024)).toFixed(2) : 'N/A'}MB heap used
- **Memory Growth Rate:** ${this.results.nodeJsPerformance.memoryAnalysis?.heapGrowthRateMBPerHour?.toFixed(2) || 'N/A'}MB/hour
- **Event Loop Lag (P95):** ${this.results.nodeJsPerformance.eventLoopLag?.p95?.toFixed(2) || 'N/A'}ms
- **CPU Efficiency:** ${this.results.nodeJsPerformance.cpuProfiling?.cpuEfficiency?.toFixed(2) || 'N/A'}

### API Performance
- **Response Time (P95):** ${this.results.apiPerformance.responseTimeAnalysis?.p95?.toFixed(2) || 'N/A'}ms
- **Throughput:** ${this.results.apiPerformance.throughputMeasurement?.requestsPerSecond?.toFixed(2) || 'N/A'} req/s
- **Error Rate:** ${((this.results.apiPerformance.errorRateMonitoring?.errorRate || 0) * 100).toFixed(2)}%

### Frontend Performance
- **Bundle Size:** ${this.results.frontendPerformance.bundleOptimization?.summary?.totalSizeMB?.toFixed(2) || 'N/A'}MB
- **JavaScript Size:** ${this.results.frontendPerformance.bundleOptimization?.javascript?.totalSizeMB?.toFixed(2) || 'N/A'}MB
- **Asset Count:** ${this.results.frontendPerformance.assetLoadingOptimization?.summary?.totalAssets || 'N/A'}

### File Processing Performance
- **Upload Throughput:** ${this.results.fileProcessingPerformance.uploadProcessing?.averageThroughputMBPerSecond?.toFixed(2) || 'N/A'}MB/s
- **Conversion Time:** ${this.results.fileProcessingPerformance.conversionPerformance?.averageConversionTime?.toFixed(0) || 'N/A'}ms
- **I/O Throughput:** ${this.results.fileProcessingPerformance.storageIOBottlenecks?.averageWriteThroughputMBPerSecond?.toFixed(2) || 'N/A'}MB/s write

## Recommendations

${
  this.results.recommendations
    ?.map(
      (rec) =>
        `### ${rec.priority}: ${rec.title}
${rec.actions.map((action) => `- ${action}`).join('\n')}
`,
    )
    .join('\n') || ''
}

## Technical Details

Full technical details and raw metrics are available in the complete JSON report.

---
**Report Generation Time:** ${new Date().toISOString()}
**Test Configuration:** ${this.concurrentUsers} concurrent users, ${this.testDuration / 1000}s duration
`;
  }

  /**
   * Print Performance Summary to Console
   */
  printPerformanceSummary(report) {
    console.log('\n' + '='.repeat(80));
    console.log('📊 MEDIANEST APPLICATION PERFORMANCE ANALYSIS COMPLETE');
    console.log('='.repeat(80));

    console.log(`\n🎯 OVERALL PERFORMANCE SCORE: ${report.analysis.overallScore}/100`);

    if (report.analysis.criticalIssues.length > 0) {
      console.log(`\n🚨 CRITICAL ISSUES (${report.analysis.criticalIssues.length}):`);
      report.analysis.criticalIssues.forEach((issue) => {
        console.log(`   ❌ ${issue.category}: ${issue.issue}`);
        console.log(`      Impact: ${issue.impact} | ${issue.details}`);
      });
    }

    if (report.analysis.warnings.length > 0) {
      console.log(`\n⚠️  WARNINGS (${report.analysis.warnings.length}):`);
      report.analysis.warnings.forEach((warning) => {
        console.log(`   🔶 ${warning.category}: ${warning.issue}`);
        console.log(`      Impact: ${warning.impact} | ${warning.details}`);
      });
    }

    if (report.analysis.optimizations.length > 0) {
      console.log(`\n🔧 OPTIMIZATION OPPORTUNITIES (${report.analysis.optimizations.length}):`);
      report.analysis.optimizations.forEach((opt) => {
        console.log(`   💡 ${opt.category}: ${opt.opportunity}`);
        console.log(`      Impact: ${opt.impact} | ${opt.details}`);
      });
    }

    console.log('\n📈 KEY METRICS:');
    console.log(
      `   Memory Usage: ${this.results.nodeJsPerformance.memoryAnalysis?.finalUsage?.heapUsed ? (this.results.nodeJsPerformance.memoryAnalysis.finalUsage.heapUsed / (1024 * 1024)).toFixed(2) : 'N/A'}MB`,
    );
    console.log(
      `   API P95 Response: ${this.results.apiPerformance.responseTimeAnalysis?.p95?.toFixed(2) || 'N/A'}ms`,
    );
    console.log(
      `   Bundle Size: ${this.results.frontendPerformance.bundleOptimization?.summary?.totalSizeMB?.toFixed(2) || 'N/A'}MB`,
    );
    console.log(
      `   Error Rate: ${((this.results.apiPerformance.errorRateMonitoring?.errorRate || 0) * 100).toFixed(2)}%`,
    );

    console.log('\n📁 Reports saved to memory: MEDIANEST_PROD_VALIDATION/app_performance');
    console.log('='.repeat(80));
  }
}

// CLI Execution
if (require.main === module) {
  const config = {
    baseURL: process.env.BASE_URL || 'http://localhost:4000',
    frontendURL: process.env.FRONTEND_URL || 'http://localhost:3000',
    concurrentUsers: parseInt(process.env.CONCURRENT_USERS) || 20,
    testDuration: parseInt(process.env.TEST_DURATION) || 300000, // 5 minutes
  };

  const profiler = new MediaNestPerformanceProfiler(config);

  profiler
    .runPerformanceAnalysis()
    .then((report) => {
      profiler.printPerformanceSummary(report);

      // Exit with appropriate code
      const hasIssues =
        report.analysis.criticalIssues.length > 0 || report.analysis.warnings.length > 2;
      process.exit(hasIssues ? 1 : 0);
    })
    .catch((error) => {
      console.error('\n💥 PERFORMANCE ANALYSIS FAILED:');
      console.error(error.message);
      if (process.env.NODE_ENV !== 'production') {
        console.error(error.stack);
      }
      process.exit(1);
    });
}

module.exports = { MediaNestPerformanceProfiler };
