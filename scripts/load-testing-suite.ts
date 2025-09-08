#!/usr/bin/env tsx
/**
 * Comprehensive Load Testing Suite
 * Validates system performance under production-level traffic
 */

import { execSync } from 'child_process';
import fs from 'fs';
import { performance } from 'perf_hooks';

interface LoadTestConfig {
  baseUrl: string;
  duration: number; // seconds
  concurrency: number;
  rampUpTime: number; // seconds
  endpoints: TestEndpoint[];
}

interface TestEndpoint {
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  weight: number; // 1-10, higher means more frequent
  payload?: any;
  expectedStatus: number[];
  maxResponseTime: number; // milliseconds
}

interface LoadTestResult {
  endpoint: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  requestsPerSecond: number;
  errorRate: number;
  errors: string[];
}

interface LoadTestSummary {
  overallScore: number;
  totalDuration: number;
  totalRequests: number;
  successfulRequests: number;
  overallRps: number;
  averageResponseTime: number;
  errorRate: number;
  passed: boolean;
  results: LoadTestResult[];
  recommendations: string[];
}

class LoadTestingSuite {
  private config: LoadTestConfig;
  private results: LoadTestResult[] = [];
  private startTime: number = 0;

  constructor() {
    this.config = {
      baseUrl: process.env.LOAD_TEST_URL || 'http://localhost:3000',
      duration: parseInt(process.env.LOAD_TEST_DURATION || '300'), // 5 minutes default
      concurrency: parseInt(process.env.LOAD_TEST_CONCURRENCY || '50'),
      rampUpTime: parseInt(process.env.LOAD_TEST_RAMP_UP || '30'), // 30 seconds
      endpoints: [
        {
          path: '/api/health',
          method: 'GET',
          weight: 10,
          expectedStatus: [200],
          maxResponseTime: 500
        },
        {
          path: '/',
          method: 'GET',
          weight: 8,
          expectedStatus: [200],
          maxResponseTime: 2000
        },
        {
          path: '/api/auth/status',
          method: 'GET',
          weight: 6,
          expectedStatus: [200, 401],
          maxResponseTime: 1000
        },
        {
          path: '/api/media/search',
          method: 'GET',
          weight: 7,
          expectedStatus: [200, 401],
          maxResponseTime: 3000
        },
        {
          path: '/api/users/profile',
          method: 'GET',
          weight: 5,
          expectedStatus: [200, 401],
          maxResponseTime: 1500
        },
        {
          path: '/api/auth/login',
          method: 'POST',
          weight: 3,
          payload: { email: 'test@example.com', password: 'testpass' },
          expectedStatus: [200, 400, 401],
          maxResponseTime: 2000
        },
        {
          path: '/api/media/upload',
          method: 'POST',
          weight: 2,
          payload: { filename: 'test.jpg', size: 1024 },
          expectedStatus: [200, 400, 401],
          maxResponseTime: 5000
        }
      ]
    };

    console.log('🚀 Load Testing Suite v2.0');
    console.log('🎯 Target: Production-level traffic simulation');
    console.log('='.repeat(60));
  }

  private async makeRequest(endpoint: TestEndpoint): Promise<{
    responseTime: number;
    statusCode: number;
    success: boolean;
    error?: string;
  }> {
    const startTime = performance.now();
    const url = `${this.config.baseUrl}${endpoint.path}`;

    try {
      const curlCommand = this.buildCurlCommand(url, endpoint);
      
      const result = execSync(curlCommand, { 
        encoding: 'utf8',
        timeout: endpoint.maxResponseTime + 1000,
        stdio: 'pipe'
      });

      const responseTime = performance.now() - startTime;
      
      // Extract status code from curl output
      const statusMatch = result.match(/HTTP_STATUS:(\d+)/);
      const statusCode = statusMatch ? parseInt(statusMatch[1]) : 0;
      
      const success = endpoint.expectedStatus.includes(statusCode);
      
      return {
        responseTime,
        statusCode,
        success,
        error: success ? undefined : `Unexpected status code: ${statusCode}`
      };

    } catch (error) {
      const responseTime = performance.now() - startTime;
      return {
        responseTime,
        statusCode: 0,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private buildCurlCommand(url: string, endpoint: TestEndpoint): string {
    let command = `curl -s -w "HTTP_STATUS:%{http_code}" --max-time ${endpoint.maxResponseTime / 1000}`;
    
    if (endpoint.method === 'POST' || endpoint.method === 'PUT') {
      command += ' -H "Content-Type: application/json"';
      if (endpoint.payload) {
        command += ` -d '${JSON.stringify(endpoint.payload)}'`;
      }
    }
    
    command += ` -X ${endpoint.method} "${url}"`;
    
    return command;
  }

  private async runEndpointTest(endpoint: TestEndpoint): Promise<LoadTestResult> {
    console.log(`\n🎯 Testing ${endpoint.method} ${endpoint.path}`);
    console.log(`   Concurrency: ${this.config.concurrency}, Duration: ${this.config.duration}s`);

    const results: Array<{ responseTime: number; statusCode: number; success: boolean; error?: string }> = [];
    const errors: string[] = [];
    const testStartTime = performance.now();
    
    // Calculate number of requests based on weight and duration
    const requestsPerSecond = Math.ceil((this.config.concurrency * endpoint.weight) / 10);
    const totalRequests = requestsPerSecond * this.config.duration;
    
    console.log(`   Target: ${requestsPerSecond} RPS, ${totalRequests} total requests`);

    // Ramp up phase
    const rampUpRequests = Math.ceil(totalRequests * (this.config.rampUpTime / this.config.duration));
    const steadyStateRequests = totalRequests - rampUpRequests;

    // Execute ramp-up phase
    console.log('   📈 Ramp-up phase...');
    for (let i = 0; i < rampUpRequests; i++) {
      const delay = (this.config.rampUpTime * 1000 * i) / rampUpRequests;
      
      setTimeout(async () => {
        try {
          const result = await this.makeRequest(endpoint);
          results.push(result);
          
          if (!result.success && result.error) {
            errors.push(result.error);
          }
        } catch (error) {
          errors.push(error instanceof Error ? error.message : 'Unknown error');
        }
      }, delay);
    }

    // Wait for ramp-up to complete
    await new Promise(resolve => setTimeout(resolve, this.config.rampUpTime * 1000));

    // Execute steady-state phase
    console.log('   🚀 Steady-state phase...');
    const steadyStateDuration = this.config.duration - this.config.rampUpTime;
    const steadyStateInterval = (steadyStateDuration * 1000) / steadyStateRequests;

    const steadyStatePromises: Promise<void>[] = [];
    
    for (let i = 0; i < steadyStateRequests; i++) {
      const promise = new Promise<void>((resolve) => {
        setTimeout(async () => {
          try {
            const result = await this.makeRequest(endpoint);
            results.push(result);
            
            if (!result.success && result.error) {
              errors.push(result.error);
            }
          } catch (error) {
            errors.push(error instanceof Error ? error.message : 'Unknown error');
          }
          resolve();
        }, i * steadyStateInterval);
      });
      
      steadyStatePromises.push(promise);
    }

    // Wait for all steady-state requests to complete
    await Promise.all(steadyStatePromises);

    const testEndTime = performance.now();
    const actualDuration = (testEndTime - testStartTime) / 1000;

    // Calculate metrics
    const successfulRequests = results.filter(r => r.success).length;
    const failedRequests = results.length - successfulRequests;
    const responseTimes = results.map(r => r.responseTime).sort((a, b) => a - b);
    
    const averageResponseTime = responseTimes.length > 0 
      ? responseTimes.reduce((sum, rt) => sum + rt, 0) / responseTimes.length 
      : 0;
    
    const p95ResponseTime = responseTimes.length > 0 
      ? responseTimes[Math.floor(responseTimes.length * 0.95)] 
      : 0;
    
    const p99ResponseTime = responseTimes.length > 0 
      ? responseTimes[Math.floor(responseTimes.length * 0.99)] 
      : 0;
    
    const requestsPerSecond = results.length / actualDuration;
    const errorRate = (failedRequests / results.length) * 100;

    const result: LoadTestResult = {
      endpoint: `${endpoint.method} ${endpoint.path}`,
      totalRequests: results.length,
      successfulRequests,
      failedRequests,
      averageResponseTime,
      p95ResponseTime,
      p99ResponseTime,
      requestsPerSecond,
      errorRate,
      errors: [...new Set(errors)].slice(0, 10) // Unique errors, max 10
    };

    console.log(`   📊 Results:`);
    console.log(`      Total Requests: ${result.totalRequests}`);
    console.log(`      Success Rate: ${((result.successfulRequests / result.totalRequests) * 100).toFixed(2)}%`);
    console.log(`      RPS: ${result.requestsPerSecond.toFixed(2)}`);
    console.log(`      Avg Response Time: ${result.averageResponseTime.toFixed(2)}ms`);
    console.log(`      P95 Response Time: ${result.p95ResponseTime.toFixed(2)}ms`);
    console.log(`      Error Rate: ${result.errorRate.toFixed(2)}%`);

    return result;
  }

  async executeLoadTests(): Promise<LoadTestSummary> {
    console.log('🎯 Starting comprehensive load testing...');
    console.log(`Base URL: ${this.config.baseUrl}`);
    console.log(`Duration: ${this.config.duration}s`);
    console.log(`Concurrency: ${this.config.concurrency}`);
    console.log(`Ramp-up Time: ${this.config.rampUpTime}s`);

    this.startTime = performance.now();

    // Warm-up phase
    console.log('\n🔥 Warm-up phase...');
    for (const endpoint of this.config.endpoints.slice(0, 2)) {
      await this.makeRequest(endpoint);
    }
    console.log('✅ Warm-up completed');

    // Execute load tests for each endpoint
    for (const endpoint of this.config.endpoints) {
      const result = await this.runEndpointTest(endpoint);
      this.results.push(result);
    }

    return this.generateSummary();
  }

  private generateSummary(): LoadTestSummary {
    const endTime = performance.now();
    const totalDuration = (endTime - this.startTime) / 1000;

    const totalRequests = this.results.reduce((sum, r) => sum + r.totalRequests, 0);
    const successfulRequests = this.results.reduce((sum, r) => sum + r.successfulRequests, 0);
    const overallRps = totalRequests / totalDuration;
    const overallErrorRate = ((totalRequests - successfulRequests) / totalRequests) * 100;
    
    const allResponseTimes = this.results.flatMap(r => 
      Array(r.successfulRequests).fill(r.averageResponseTime)
    );
    const averageResponseTime = allResponseTimes.length > 0 
      ? allResponseTimes.reduce((sum, rt) => sum + rt, 0) / allResponseTimes.length 
      : 0;

    // Performance scoring
    let overallScore = 100;

    // Deduct points for high error rates
    if (overallErrorRate > 1) overallScore -= 20;
    if (overallErrorRate > 5) overallScore -= 30;

    // Deduct points for slow response times
    if (averageResponseTime > 1000) overallScore -= 15;
    if (averageResponseTime > 3000) overallScore -= 25;

    // Deduct points for low throughput
    const expectedRps = this.config.concurrency / 2;
    if (overallRps < expectedRps * 0.7) overallScore -= 20;
    if (overallRps < expectedRps * 0.5) overallScore -= 30;

    // Individual endpoint performance
    this.results.forEach(result => {
      if (result.errorRate > 5) overallScore -= 10;
      if (result.averageResponseTime > result.maxResponseTime) overallScore -= 5;
    });

    overallScore = Math.max(0, overallScore);

    const recommendations: string[] = [];
    
    if (overallErrorRate > 1) {
      recommendations.push('🔧 Investigate and reduce error rates');
    }
    
    if (averageResponseTime > 1000) {
      recommendations.push('⚡ Optimize response times - consider caching, database indexing, or CDN');
    }
    
    if (overallRps < expectedRps * 0.7) {
      recommendations.push('📈 Improve throughput - scale horizontally or optimize bottlenecks');
    }
    
    this.results.forEach(result => {
      if (result.averageResponseTime > result.maxResponseTime) {
        recommendations.push(`⏱️ ${result.endpoint} exceeds target response time`);
      }
    });

    if (recommendations.length === 0) {
      recommendations.push('✅ Performance meets all targets - system ready for production load');
    }

    const passed = overallScore >= 75 && overallErrorRate < 5 && averageResponseTime < 3000;

    return {
      overallScore,
      totalDuration,
      totalRequests,
      successfulRequests,
      overallRps,
      averageResponseTime,
      errorRate: overallErrorRate,
      passed,
      results: this.results,
      recommendations
    };
  }

  private generateReport(summary: LoadTestSummary): void {
    console.log('\n' + '='.repeat(80));
    console.log('📊 COMPREHENSIVE LOAD TEST RESULTS');
    console.log('='.repeat(80));
    
    console.log(`\n🎯 Overall Performance Score: ${summary.overallScore.toFixed(1)}/100`);
    console.log(`⏱️  Total Duration: ${summary.totalDuration.toFixed(2)}s`);
    console.log(`📈 Total Requests: ${summary.totalRequests.toLocaleString()}`);
    console.log(`✅ Successful Requests: ${summary.successfulRequests.toLocaleString()}`);
    console.log(`🚀 Overall RPS: ${summary.overallRps.toFixed(2)}`);
    console.log(`⚡ Average Response Time: ${summary.averageResponseTime.toFixed(2)}ms`);
    console.log(`❌ Error Rate: ${summary.errorRate.toFixed(2)}%`);

    const status = summary.passed ? '✅ PASSED' : '❌ FAILED';
    const bgColor = summary.passed ? '\x1b[42m' : '\x1b[41m';
    console.log(`\n${bgColor}\x1b[30m ${status} \x1b[0m`);

    console.log('\n📋 Detailed Results by Endpoint:');
    console.log('─'.repeat(80));
    
    this.results.forEach(result => {
      console.log(`\n${result.endpoint}:`);
      console.log(`  📊 Requests: ${result.totalRequests.toLocaleString()} (${result.successfulRequests.toLocaleString()} successful)`);
      console.log(`  🚀 RPS: ${result.requestsPerSecond.toFixed(2)}`);
      console.log(`  ⚡ Response Times: Avg ${result.averageResponseTime.toFixed(2)}ms, P95 ${result.p95ResponseTime.toFixed(2)}ms, P99 ${result.p99ResponseTime.toFixed(2)}ms`);
      console.log(`  ❌ Error Rate: ${result.errorRate.toFixed(2)}%`);
      
      if (result.errors.length > 0) {
        console.log(`  🔍 Sample Errors: ${result.errors.slice(0, 3).join(', ')}`);
      }
    });

    console.log('\n🔧 Recommendations:');
    summary.recommendations.forEach((rec, index) => {
      console.log(`  ${index + 1}. ${rec}`);
    });

    // Save detailed report
    const report = {
      timestamp: new Date().toISOString(),
      config: this.config,
      summary,
      detailed_results: this.results
    };

    const reportPath = `./load-test-report-${Date.now()}.json`;
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n📄 Detailed report saved: ${reportPath}`);
  }

  async run(): Promise<void> {
    try {
      const summary = await this.executeLoadTests();
      this.generateReport(summary);
      
      // Exit with appropriate code
      process.exit(summary.passed ? 0 : 1);
      
    } catch (error) {
      console.error('\n💥 Load testing failed:', error);
      process.exit(1);
    }
  }
}

// Execute if run directly
if (require.main === module) {
  const loadTester = new LoadTestingSuite();
  loadTester.run();
}

export default LoadTestingSuite;