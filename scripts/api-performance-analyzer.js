#!/usr/bin/env node

/**
 * MediaNest API Performance Analyzer
 * 
 * Detailed analysis of API endpoint performance including:
 * - Response time distribution analysis
 * - Throughput measurement under load
 * - Error rate monitoring and categorization
 * - Per-endpoint performance profiling
 */

const axios = require('axios');
const { performance } = require('perf_hooks');

class APIPerformanceAnalyzer {
  constructor(config = {}) {
    this.baseURL = config.baseURL || 'http://localhost:4000';
    this.concurrentUsers = config.concurrentUsers || 50;
    this.testDuration = config.testDuration || 300000; // 5 minutes
    this.warmupTime = config.warmupTime || 30000; // 30 seconds
    
    this.results = {
      requests: [],
      errors: [],
      startTime: null,
      endTime: null
    };
    
    // Define critical API endpoints to test
    this.endpoints = [
      // Authentication endpoints (critical)
      { path: '/api/v1/auth/login', method: 'POST', critical: true, weight: 0.1 },
      { path: '/api/v1/auth/session', method: 'GET', critical: true, weight: 0.1 },
      { path: '/api/v1/auth/refresh', method: 'POST', critical: true, weight: 0.05 },
      
      // Core functionality endpoints
      { path: '/api/v1/health', method: 'GET', critical: true, weight: 0.2 },
      { path: '/api/v1/dashboard/stats', method: 'GET', critical: false, weight: 0.15 },
      
      // Media endpoints (high traffic)
      { path: '/api/v1/media/list', method: 'GET', critical: false, weight: 0.2 },
      { path: '/api/v1/media/search', method: 'GET', critical: false, weight: 0.1 },
      { path: '/api/v1/media/details', method: 'GET', critical: false, weight: 0.05 },
      
      // Integration endpoints
      { path: '/api/v1/integrations/status', method: 'GET', critical: false, weight: 0.05 }
    ];
    
    this.thresholds = {
      responseTime: {
        excellent: 100,   // < 100ms
        good: 200,        // < 200ms
        acceptable: 500,  // < 500ms
        poor: 1000,       // < 1000ms
        critical: 2000    // < 2000ms
      },
      throughput: {
        minimum: 50,      // req/s
        target: 100,      // req/s
        excellent: 200    // req/s
      },
      errorRate: {
        acceptable: 0.01,  // 1%
        warning: 0.05,     // 5%
        critical: 0.10     // 10%
      }
    };
  }

  /**
   * Run comprehensive API performance analysis
   */
  async runAnalysis() {
    console.log('🚀 Starting API Performance Analysis');
    console.log(`🎯 Testing ${this.endpoints.length} endpoints`);
    console.log(`👥 ${this.concurrentUsers} concurrent users for ${this.testDuration/1000}s`);
    console.log('=' .repeat(70));

    try {
      // 1. Validate API availability
      await this.validateAPIAvailability();
      
      // 2. Warmup phase
      await this.warmupPhase();
      
      // 3. Load testing phase
      await this.loadTestingPhase();
      
      // 4. Analyze results
      const analysis = await this.analyzeResults();
      
      // 5. Generate report
      const report = this.generateReport(analysis);
      
      // 6. Save results
      await this.saveResults(report);
      
      return report;

    } catch (error) {
      console.error('❌ API Performance Analysis failed:', error.message);
      throw error;
    }
  }

  /**
   * Validate that API endpoints are available
   */
  async validateAPIAvailability() {
    console.log('🔍 Validating API availability...');
    
    // Test health endpoint first
    try {
      const response = await axios.get(`${this.baseURL}/api/v1/health`, { timeout: 5000 });
      if (response.status !== 200) {
        throw new Error('Health check failed');
      }
      console.log('✅ API health check passed');
    } catch (error) {
      throw new Error(`API not available: ${error.message}`);
    }

    // Test a few key endpoints
    const testEndpoints = this.endpoints.filter(e => e.critical).slice(0, 3);
    let availableCount = 0;
    
    for (const endpoint of testEndpoints) {
      try {
        await axios({
          method: endpoint.method,
          url: `${this.baseURL}${endpoint.path}`,
          timeout: 5000,
          validateStatus: () => true // Accept any status for availability check
        });
        availableCount++;
      } catch (error) {
        console.warn(`⚠️  Endpoint ${endpoint.path} not available: ${error.message}`);
      }
    }
    
    if (availableCount < testEndpoints.length * 0.5) {
      throw new Error('Too many critical endpoints are unavailable');
    }
    
    console.log(`✅ ${availableCount}/${testEndpoints.length} critical endpoints available`);
  }

  /**
   * Warmup phase to prime caches and connections
   */
  async warmupPhase() {
    console.log('🔥 Starting warmup phase...');
    
    const warmupPromises = [];
    const warmupUsers = Math.min(10, this.concurrentUsers);
    
    for (let i = 0; i < warmupUsers; i++) {
      warmupPromises.push(this.simulateUser(this.warmupTime, true));
    }
    
    await Promise.all(warmupPromises);
    console.log('✅ Warmup phase complete');
    
    // Clear warmup results
    this.results.requests = [];
    this.results.errors = [];
  }

  /**
   * Main load testing phase
   */
  async loadTestingPhase() {
    console.log('⚡ Starting load testing phase...');
    
    this.results.startTime = Date.now();
    
    const userPromises = [];
    
    // Stagger user start times for more realistic ramp-up
    for (let i = 0; i < this.concurrentUsers; i++) {
      const delay = (i * 1000) / this.concurrentUsers; // Spread over 1 second
      
      userPromises.push(
        new Promise(resolve => {
          setTimeout(() => {
            this.simulateUser(this.testDuration - delay, false).then(resolve);
          }, delay);
        })
      );
    }
    
    // Real-time progress monitoring
    const progressInterval = setInterval(() => {
      const elapsed = Date.now() - this.results.startTime;
      const progress = Math.min((elapsed / this.testDuration) * 100, 100);
      const requestCount = this.results.requests.length;
      const errorCount = this.results.errors.length;
      const rps = requestCount / (elapsed / 1000);
      
      process.stdout.write(`\r📊 Progress: ${progress.toFixed(1)}% | Requests: ${requestCount} | Errors: ${errorCount} | RPS: ${rps.toFixed(1)}`);
    }, 5000);
    
    await Promise.all(userPromises);
    clearInterval(progressInterval);
    
    this.results.endTime = Date.now();
    console.log('\n✅ Load testing phase complete');
  }

  /**
   * Simulate a single user's API interactions
   */
  async simulateUser(duration, isWarmup = false) {
    const startTime = Date.now();
    const endTime = startTime + duration;
    
    while (Date.now() < endTime) {
      const endpoint = this.selectWeightedEndpoint();
      
      try {
        const requestStart = performance.now();
        
        const response = await axios({
          method: endpoint.method,
          url: `${this.baseURL}${endpoint.path}`,
          timeout: 30000,
          headers: {
            'User-Agent': 'MediaNest-Performance-Analyzer',
            'Accept': 'application/json',
            'X-Test-User': isWarmup ? 'warmup' : 'load-test'
          },
          validateStatus: () => true // Don't throw on HTTP errors
        });
        
        const requestEnd = performance.now();
        const duration = requestEnd - requestStart;
        
        if (!isWarmup) {
          this.results.requests.push({
            endpoint: endpoint.path,
            method: endpoint.method,
            status: response.status,
            duration: duration,
            timestamp: Date.now(),
            critical: endpoint.critical,
            responseSize: this.getResponseSize(response),
            headers: {
              contentType: response.headers['content-type'],
              cacheControl: response.headers['cache-control'],
              xResponseTime: response.headers['x-response-time']
            }
          });
        }
        
      } catch (error) {
        if (!isWarmup) {
          this.results.errors.push({
            endpoint: endpoint.path,
            method: endpoint.method,
            error: error.code || error.message,
            timestamp: Date.now(),
            critical: endpoint.critical,
            type: this.categorizeError(error)
          });
        }
      }
      
      // Think time between requests (50-500ms)
      const thinkTime = Math.random() * 450 + 50;
      await new Promise(resolve => setTimeout(resolve, thinkTime));
    }
  }

  /**
   * Select endpoint based on weighted probability
   */
  selectWeightedEndpoint() {
    const random = Math.random();
    let weightSum = 0;
    
    for (const endpoint of this.endpoints) {
      weightSum += endpoint.weight;
      if (random <= weightSum) {
        return endpoint;
      }
    }
    
    return this.endpoints[this.endpoints.length - 1];
  }

  /**
   * Get response size in bytes
   */
  getResponseSize(response) {
    try {
      if (response.data) {
        return JSON.stringify(response.data).length;
      }
    } catch (error) {
      // Could not determine size
    }
    return 0;
  }

  /**
   * Categorize error types
   */
  categorizeError(error) {
    if (error.code === 'ECONNREFUSED') return 'CONNECTION_REFUSED';
    if (error.code === 'ECONNRESET') return 'CONNECTION_RESET';
    if (error.code === 'ENOTFOUND') return 'DNS_ERROR';
    if (error.code === 'ETIMEDOUT') return 'TIMEOUT';
    if (error.message && error.message.includes('timeout')) return 'TIMEOUT';
    if (error.response) {
      if (error.response.status >= 500) return 'SERVER_ERROR';
      if (error.response.status >= 400) return 'CLIENT_ERROR';
    }
    return 'UNKNOWN';
  }

  /**
   * Analyze performance results
   */
  async analyzeResults() {
    const totalRequests = this.results.requests.length;
    const totalErrors = this.results.errors.length;
    const testDuration = this.results.endTime - this.results.startTime;
    
    console.log('\n📊 Analyzing results...');
    
    // Overall statistics
    const overallStats = {
      totalRequests: totalRequests,
      totalErrors: totalErrors,
      testDurationMs: testDuration,
      testDurationSeconds: testDuration / 1000,
      requestsPerSecond: totalRequests / (testDuration / 1000),
      errorRate: (totalErrors / (totalRequests + totalErrors)),
      successRate: totalRequests / (totalRequests + totalErrors)
    };
    
    // Response time analysis
    const responseTimeAnalysis = this.analyzeResponseTimes();
    
    // Throughput analysis
    const throughputAnalysis = this.analyzeThroughput();
    
    // Error analysis
    const errorAnalysis = this.analyzeErrors();
    
    // Per-endpoint analysis
    const endpointAnalysis = this.analyzeEndpointPerformance();
    
    // Performance rating
    const performanceRating = this.calculatePerformanceRating(responseTimeAnalysis, throughputAnalysis, errorAnalysis);
    
    return {
      overall: overallStats,
      responseTime: responseTimeAnalysis,
      throughput: throughputAnalysis,
      errors: errorAnalysis,
      endpoints: endpointAnalysis,
      rating: performanceRating,
      recommendations: this.generateRecommendations(responseTimeAnalysis, throughputAnalysis, errorAnalysis)
    };
  }

  /**
   * Analyze response times
   */
  analyzeResponseTimes() {
    if (this.results.requests.length === 0) {
      return { error: 'No requests to analyze' };
    }
    
    const durations = this.results.requests.map(r => r.duration).sort((a, b) => a - b);
    
    const stats = {
      count: durations.length,
      min: durations[0],
      max: durations[durations.length - 1],
      mean: durations.reduce((sum, d) => sum + d, 0) / durations.length,
      median: durations[Math.floor(durations.length * 0.5)],
      p75: durations[Math.floor(durations.length * 0.75)],
      p90: durations[Math.floor(durations.length * 0.90)],
      p95: durations[Math.floor(durations.length * 0.95)],
      p99: durations[Math.floor(durations.length * 0.99)] || durations[durations.length - 1]
    };
    
    // Distribution analysis
    const distribution = {
      excellent: durations.filter(d => d < this.thresholds.responseTime.excellent).length,
      good: durations.filter(d => d >= this.thresholds.responseTime.excellent && d < this.thresholds.responseTime.good).length,
      acceptable: durations.filter(d => d >= this.thresholds.responseTime.good && d < this.thresholds.responseTime.acceptable).length,
      poor: durations.filter(d => d >= this.thresholds.responseTime.acceptable && d < this.thresholds.responseTime.poor).length,
      critical: durations.filter(d => d >= this.thresholds.responseTime.poor).length
    };
    
    return {
      statistics: stats,
      distribution: distribution,
      distributionPercentages: {
        excellent: (distribution.excellent / durations.length) * 100,
        good: (distribution.good / durations.length) * 100,
        acceptable: (distribution.acceptable / durations.length) * 100,
        poor: (distribution.poor / durations.length) * 100,
        critical: (distribution.critical / durations.length) * 100
      }
    };
  }

  /**
   * Analyze throughput patterns
   */
  analyzeThroughput() {
    const timeWindows = this.calculateThroughputWindows(10000); // 10-second windows
    
    const throughputStats = {
      overall: this.results.requests.length / ((this.results.endTime - this.results.startTime) / 1000),
      windows: timeWindows,
      peak: Math.max(...timeWindows.map(w => w.rps)),
      low: Math.min(...timeWindows.map(w => w.rps)),
      average: timeWindows.reduce((sum, w) => sum + w.rps, 0) / timeWindows.length,
      stability: this.calculateThroughputStability(timeWindows)
    };
    
    return throughputStats;
  }

  /**
   * Calculate throughput in time windows
   */
  calculateThroughputWindows(windowSize) {
    const windows = [];
    const startTime = this.results.startTime;
    const endTime = this.results.endTime;
    
    for (let windowStart = startTime; windowStart < endTime; windowStart += windowSize) {
      const windowEnd = Math.min(windowStart + windowSize, endTime);
      const requestsInWindow = this.results.requests.filter(
        r => r.timestamp >= windowStart && r.timestamp < windowEnd
      );
      
      windows.push({
        start: windowStart,
        end: windowEnd,
        requests: requestsInWindow.length,
        rps: requestsInWindow.length / (windowSize / 1000),
        averageResponseTime: requestsInWindow.length > 0 ? 
          requestsInWindow.reduce((sum, r) => sum + r.duration, 0) / requestsInWindow.length : 0
      });
    }
    
    return windows;
  }

  /**
   * Calculate throughput stability
   */
  calculateThroughputStability(windows) {
    const rpsValues = windows.map(w => w.rps);
    const mean = rpsValues.reduce((sum, rps) => sum + rps, 0) / rpsValues.length;
    const variance = rpsValues.reduce((sum, rps) => sum + Math.pow(rps - mean, 2), 0) / rpsValues.length;
    const standardDeviation = Math.sqrt(variance);
    const coefficientOfVariation = standardDeviation / mean;
    
    return {
      standardDeviation: standardDeviation,
      coefficientOfVariation: coefficientOfVariation,
      stability: coefficientOfVariation < 0.2 ? 'STABLE' : 
                coefficientOfVariation < 0.5 ? 'MODERATE' : 'UNSTABLE'
    };
  }

  /**
   * Analyze errors in detail
   */
  analyzeErrors() {
    const totalAttempts = this.results.requests.length + this.results.errors.length;
    const errorRate = this.results.errors.length / totalAttempts;
    
    // Group errors by type
    const errorsByType = {};
    const errorsByEndpoint = {};
    const criticalErrors = this.results.errors.filter(e => e.critical);
    
    this.results.errors.forEach(error => {
      // By type
      if (!errorsByType[error.type]) {
        errorsByType[error.type] = [];
      }
      errorsByType[error.type].push(error);
      
      // By endpoint
      const key = `${error.method} ${error.endpoint}`;
      if (!errorsByEndpoint[key]) {
        errorsByEndpoint[key] = [];
      }
      errorsByEndpoint[key].push(error);
    });
    
    // Calculate HTTP status code distribution from requests
    const httpStatusDistribution = {};
    this.results.requests.forEach(req => {
      const statusCategory = `${Math.floor(req.status / 100)}xx`;
      httpStatusDistribution[statusCategory] = (httpStatusDistribution[statusCategory] || 0) + 1;
    });
    
    return {
      totalErrors: this.results.errors.length,
      errorRate: errorRate,
      criticalErrors: criticalErrors.length,
      errorsByType: Object.keys(errorsByType).map(type => ({
        type: type,
        count: errorsByType[type].length,
        percentage: (errorsByType[type].length / this.results.errors.length) * 100,
        examples: errorsByType[type].slice(0, 3).map(e => ({
          endpoint: e.endpoint,
          error: e.error,
          timestamp: e.timestamp
        }))
      })),
      errorsByEndpoint: Object.keys(errorsByEndpoint).map(endpoint => ({
        endpoint: endpoint,
        count: errorsByEndpoint[endpoint].length,
        errors: errorsByEndpoint[endpoint]
      })),
      httpStatusDistribution: httpStatusDistribution
    };
  }

  /**
   * Analyze performance by endpoint
   */
  analyzeEndpointPerformance() {
    const endpointStats = {};
    
    this.endpoints.forEach(endpoint => {
      const key = `${endpoint.method} ${endpoint.path}`;
      const requests = this.results.requests.filter(r => 
        r.endpoint === endpoint.path && r.method === endpoint.method
      );
      const errors = this.results.errors.filter(e => 
        e.endpoint === endpoint.path && e.method === endpoint.method
      );
      
      if (requests.length > 0) {
        const durations = requests.map(r => r.duration).sort((a, b) => a - b);
        const statusCodes = {};
        
        requests.forEach(r => {
          statusCodes[r.status] = (statusCodes[r.status] || 0) + 1;
        });
        
        endpointStats[key] = {
          endpoint: endpoint.path,
          method: endpoint.method,
          critical: endpoint.critical,
          weight: endpoint.weight,
          requests: requests.length,
          errors: errors.length,
          errorRate: errors.length / (requests.length + errors.length),
          responseTime: {
            min: durations[0],
            max: durations[durations.length - 1],
            mean: durations.reduce((sum, d) => sum + d, 0) / durations.length,
            p50: durations[Math.floor(durations.length * 0.5)],
            p95: durations[Math.floor(durations.length * 0.95)] || durations[durations.length - 1],
            p99: durations[Math.floor(durations.length * 0.99)] || durations[durations.length - 1]
          },
          statusCodes: statusCodes,
          averageResponseSize: requests.reduce((sum, r) => sum + r.responseSize, 0) / requests.length,
          rating: this.rateEndpointPerformance(durations, errors.length / (requests.length + errors.length), endpoint.critical)
        };
      } else {
        endpointStats[key] = {
          endpoint: endpoint.path,
          method: endpoint.method,
          critical: endpoint.critical,
          weight: endpoint.weight,
          requests: 0,
          errors: errors.length,
          errorRate: errors.length > 0 ? 1 : 0,
          rating: 'NO_DATA'
        };
      }
    });
    
    return endpointStats;
  }

  /**
   * Rate individual endpoint performance
   */
  rateEndpointPerformance(durations, errorRate, isCritical) {
    if (durations.length === 0) return 'NO_DATA';
    
    const p95 = durations[Math.floor(durations.length * 0.95)] || durations[durations.length - 1];
    const threshold = isCritical ? this.thresholds.responseTime.good : this.thresholds.responseTime.acceptable;
    
    // High error rate automatically downgrades rating
    if (errorRate > this.thresholds.errorRate.critical) return 'CRITICAL';
    if (errorRate > this.thresholds.errorRate.warning) return 'POOR';
    
    // Rate based on response time
    if (p95 <= this.thresholds.responseTime.excellent) return 'EXCELLENT';
    if (p95 <= this.thresholds.responseTime.good) return 'GOOD';
    if (p95 <= this.thresholds.responseTime.acceptable) return 'ACCEPTABLE';
    if (p95 <= this.thresholds.responseTime.poor) return 'POOR';
    return 'CRITICAL';
  }

  /**
   * Calculate overall performance rating
   */
  calculatePerformanceRating(responseTime, throughput, errors) {
    let score = 100;
    
    // Response time impact (40% weight)
    if (responseTime.statistics && responseTime.statistics.p95 > this.thresholds.responseTime.critical) {
      score -= 40;
    } else if (responseTime.statistics && responseTime.statistics.p95 > this.thresholds.responseTime.poor) {
      score -= 30;
    } else if (responseTime.statistics && responseTime.statistics.p95 > this.thresholds.responseTime.acceptable) {
      score -= 20;
    } else if (responseTime.statistics && responseTime.statistics.p95 > this.thresholds.responseTime.good) {
      score -= 10;
    }
    
    // Throughput impact (30% weight)
    if (throughput.overall < this.thresholds.throughput.minimum) {
      score -= 30;
    } else if (throughput.overall < this.thresholds.throughput.target) {
      score -= 15;
    }
    
    // Error rate impact (30% weight)
    if (errors.errorRate > this.thresholds.errorRate.critical) {
      score -= 30;
    } else if (errors.errorRate > this.thresholds.errorRate.warning) {
      score -= 20;
    } else if (errors.errorRate > this.thresholds.errorRate.acceptable) {
      score -= 10;
    }
    
    return {
      score: Math.max(0, score),
      grade: score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : score >= 60 ? 'D' : 'F',
      rating: score >= 90 ? 'EXCELLENT' : 
              score >= 80 ? 'GOOD' : 
              score >= 70 ? 'ACCEPTABLE' : 
              score >= 60 ? 'POOR' : 'CRITICAL'
    };
  }

  /**
   * Generate performance recommendations
   */
  generateRecommendations(responseTime, throughput, errors) {
    const recommendations = [];
    
    // Response time recommendations
    if (responseTime.statistics && responseTime.statistics.p95 > this.thresholds.responseTime.acceptable) {
      recommendations.push({
        category: 'Response Time',
        priority: responseTime.statistics.p95 > this.thresholds.responseTime.critical ? 'CRITICAL' : 'HIGH',
        issue: `P95 response time (${responseTime.statistics.p95.toFixed(2)}ms) exceeds acceptable threshold`,
        suggestions: [
          'Optimize database queries with proper indexing',
          'Implement response caching for frequently requested data',
          'Review and optimize slow endpoints identified in analysis',
          'Consider implementing query result pagination',
          'Add connection pooling if not already implemented'
        ]
      });
    }
    
    // Throughput recommendations
    if (throughput.overall < this.thresholds.throughput.target) {
      recommendations.push({
        category: 'Throughput',
        priority: throughput.overall < this.thresholds.throughput.minimum ? 'CRITICAL' : 'HIGH',
        issue: `Throughput (${throughput.overall.toFixed(2)} req/s) below target (${this.thresholds.throughput.target} req/s)`,
        suggestions: [
          'Scale horizontally by adding more server instances',
          'Implement load balancing across multiple instances',
          'Optimize application code for better CPU utilization',
          'Consider implementing request queuing for high-load scenarios',
          'Review server resource allocation (CPU, memory)'
        ]
      });
    }
    
    // Error rate recommendations
    if (errors.errorRate > this.thresholds.errorRate.acceptable) {
      recommendations.push({
        category: 'Error Rate',
        priority: errors.errorRate > this.thresholds.errorRate.critical ? 'CRITICAL' : 'HIGH',
        issue: `Error rate (${(errors.errorRate * 100).toFixed(2)}%) exceeds acceptable threshold`,
        suggestions: [
          'Investigate and fix endpoints with high error rates',
          'Implement proper error handling and recovery mechanisms',
          'Add health checks for external dependencies',
          'Implement circuit breakers for external service calls',
          'Review and improve input validation'
        ]
      });
    }
    
    // Stability recommendations
    if (throughput.stability && throughput.stability.stability !== 'STABLE') {
      recommendations.push({
        category: 'Performance Stability',
        priority: 'MEDIUM',
        issue: `Throughput stability is ${throughput.stability.stability}`,
        suggestions: [
          'Investigate causes of performance variability',
          'Implement performance monitoring and alerting',
          'Review resource allocation and auto-scaling policies',
          'Check for garbage collection or memory pressure issues'
        ]
      });
    }
    
    return recommendations;
  }

  /**
   * Generate comprehensive report
   */
  generateReport(analysis) {
    return {
      metadata: {
        timestamp: new Date().toISOString(),
        testConfiguration: {
          baseURL: this.baseURL,
          concurrentUsers: this.concurrentUsers,
          testDuration: this.testDuration,
          endpointsTested: this.endpoints.length
        },
        thresholds: this.thresholds
      },
      summary: {
        overallRating: analysis.rating.rating,
        score: analysis.rating.score,
        grade: analysis.rating.grade,
        totalRequests: analysis.overall.totalRequests,
        totalErrors: analysis.overall.totalErrors,
        averageResponseTime: analysis.responseTime.statistics?.mean?.toFixed(2) || 'N/A',
        p95ResponseTime: analysis.responseTime.statistics?.p95?.toFixed(2) || 'N/A',
        throughput: analysis.throughput.overall?.toFixed(2) || 'N/A',
        errorRate: `${(analysis.errors.errorRate * 100).toFixed(2)}%`
      },
      detailedAnalysis: analysis,
      recommendations: analysis.recommendations || []
    };
  }

  /**
   * Save results to memory location
   */
  async saveResults(report) {
    try {
      const fs = require('fs').promises;
      const path = require('path');
      
      const memoryPath = path.join(process.cwd(), 'docs', 'memory', 'MEDIANEST_PROD_VALIDATION');
      await fs.mkdir(memoryPath, { recursive: true });
      
      // Save detailed JSON report
      const reportPath = path.join(memoryPath, 'api_performance_analysis.json');
      await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
      
      // Save summary markdown
      const summaryPath = path.join(memoryPath, 'api_performance_summary.md');
      const summaryMarkdown = this.generateMarkdownSummary(report);
      await fs.writeFile(summaryPath, summaryMarkdown);
      
      console.log(`\n📁 Results saved:`);
      console.log(`   Detailed report: ${reportPath}`);
      console.log(`   Summary: ${summaryPath}`);
      
    } catch (error) {
      console.error('Failed to save results:', error.message);
    }
  }

  /**
   * Generate markdown summary
   */
  generateMarkdownSummary(report) {
    const analysis = report.detailedAnalysis;
    
    return `# MediaNest API Performance Analysis

**Generated:** ${report.metadata.timestamp}
**Overall Rating:** ${report.summary.overallRating} (${report.summary.score}/100)

## Executive Summary

- **Total Requests:** ${report.summary.totalRequests.toLocaleString()}
- **Success Rate:** ${((1 - analysis.errors.errorRate) * 100).toFixed(2)}%
- **Average Response Time:** ${report.summary.averageResponseTime}ms
- **P95 Response Time:** ${report.summary.p95ResponseTime}ms
- **Throughput:** ${report.summary.throughput} req/s

## Performance Metrics

### Response Time Distribution
- **Excellent (<100ms):** ${analysis.responseTime.distributionPercentages?.excellent?.toFixed(1) || 'N/A'}%
- **Good (100-200ms):** ${analysis.responseTime.distributionPercentages?.good?.toFixed(1) || 'N/A'}%
- **Acceptable (200-500ms):** ${analysis.responseTime.distributionPercentages?.acceptable?.toFixed(1) || 'N/A'}%
- **Poor (500-1000ms):** ${analysis.responseTime.distributionPercentages?.poor?.toFixed(1) || 'N/A'}%
- **Critical (>1000ms):** ${analysis.responseTime.distributionPercentages?.critical?.toFixed(1) || 'N/A'}%

### Endpoint Performance
${Object.values(analysis.endpoints).map(endpoint => 
`**${endpoint.method} ${endpoint.endpoint}** ${endpoint.critical ? '(Critical)' : ''}
- Rating: ${endpoint.rating}
- Requests: ${endpoint.requests}
- P95 Response: ${endpoint.responseTime?.p95?.toFixed(2) || 'N/A'}ms
- Error Rate: ${(endpoint.errorRate * 100).toFixed(2)}%`
).join('\n\n')}

## Issues and Recommendations

${report.recommendations.map(rec => 
`### ${rec.priority}: ${rec.category}
**Issue:** ${rec.issue}

**Recommendations:**
${rec.suggestions.map(s => `- ${s}`).join('\n')}
`).join('\n')}

---
**Test Configuration:** ${report.metadata.testConfiguration.concurrentUsers} users, ${report.metadata.testConfiguration.testDuration/1000}s duration
`;
  }

  /**
   * Print summary to console
   */
  printSummary(report) {
    console.log('\n' + '='.repeat(70));
    console.log('📊 API PERFORMANCE ANALYSIS RESULTS');
    console.log('='.repeat(70));
    
    console.log(`\n🎯 OVERALL RATING: ${report.summary.overallRating} (${report.summary.score}/100)`);
    console.log(`📈 SUMMARY METRICS:`);
    console.log(`   Requests: ${report.summary.totalRequests.toLocaleString()}`);
    console.log(`   Success Rate: ${((1 - report.detailedAnalysis.errors.errorRate) * 100).toFixed(2)}%`);
    console.log(`   Avg Response: ${report.summary.averageResponseTime}ms`);
    console.log(`   P95 Response: ${report.summary.p95ResponseTime}ms`);
    console.log(`   Throughput: ${report.summary.throughput} req/s`);
    
    if (report.recommendations.length > 0) {
      console.log(`\n⚠️  RECOMMENDATIONS (${report.recommendations.length}):`);
      report.recommendations.forEach(rec => {
        console.log(`   ${rec.priority}: ${rec.issue}`);
      });
    }
    
    console.log('\n📁 Detailed results saved to memory: MEDIANEST_PROD_VALIDATION/');
    console.log('='.repeat(70));
  }
}

// CLI execution
if (require.main === module) {
  const config = {
    baseURL: process.env.BASE_URL || 'http://localhost:4000',
    concurrentUsers: parseInt(process.env.CONCURRENT_USERS) || 50,
    testDuration: parseInt(process.env.TEST_DURATION) || 300000,
    warmupTime: parseInt(process.env.WARMUP_TIME) || 30000
  };
  
  const analyzer = new APIPerformanceAnalyzer(config);
  
  analyzer.runAnalysis()
    .then(report => {
      analyzer.printSummary(report);
      
      // Exit with appropriate code based on performance rating
      const exitCode = report.summary.score >= 70 ? 0 : 1;
      process.exit(exitCode);
    })
    .catch(error => {
      console.error('\n💥 API PERFORMANCE ANALYSIS FAILED:');
      console.error(error.message);
      process.exit(1);
    });
}

module.exports = { APIPerformanceAnalyzer };