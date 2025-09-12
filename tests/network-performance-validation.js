#!/usr/bin/env node

/**
 * MediaNest Network Performance Validator
 * Comprehensive network throughput, latency, and performance analysis
 */

const { spawn } = require('child_process');
const http = require('http');
const https = require('https');
const net = require('net');
const { performance } = require('perf_hooks');
const fs = require('fs').promises;
const path = require('path');

class NetworkPerformanceValidator {
  constructor(config = {}) {
    this.config = {
      baseUrl: config.baseUrl || 'http://localhost:3000',
      apiUrl: config.apiUrl || 'http://localhost:3001',
      concurrency: config.concurrency || 50,
      duration: config.duration || 60, // seconds
      intervals: config.intervals || 1000, // ms
      outputDir: config.outputDir || './performance/network-reports',
      ...config,
    };
    this.results = {
      throughput: {},
      latency: {},
      network: {},
      proxy: {},
      container: {},
      bandwidth: {},
    };
  }

  async init() {
    // Ensure output directory exists
    await fs.mkdir(this.config.outputDir, { recursive: true });
    console.log(`🚀 Network Performance Validator initialized`);
    console.log(`📊 Base URL: ${this.config.baseUrl}`);
    console.log(`🔗 API URL: ${this.config.apiUrl}`);
  }

  // 1. Network Throughput Analysis
  async validateThroughput() {
    console.log('\n📊 1. NETWORK THROUGHPUT ANALYSIS');
    console.log('====================================');

    const tests = [
      { name: 'Frontend Health Check', url: `${this.config.baseUrl}/api/health` },
      { name: 'Backend API Health', url: `${this.config.apiUrl}/api/health` },
      { name: 'Authentication Endpoint', url: `${this.config.apiUrl}/api/v1/auth/health` },
      { name: 'Media API Endpoint', url: `${this.config.apiUrl}/api/v1/media` },
      { name: 'Static Asset Request', url: `${this.config.baseUrl}/_next/static/test.js` },
    ];

    for (const test of tests) {
      console.log(`\n🔍 Testing: ${test.name}`);
      const result = await this.measureThroughput(test.url);
      this.results.throughput[test.name] = result;

      console.log(`   ⏱️  Average Latency: ${result.avgLatency.toFixed(2)}ms`);
      console.log(`   📈 Requests/sec: ${result.rps.toFixed(2)}`);
      console.log(`   ✅ Success Rate: ${result.successRate.toFixed(2)}%`);
      console.log(`   📦 Data Transfer: ${(result.bytesTransferred / 1024).toFixed(2)} KB`);
    }

    return this.results.throughput;
  }

  async measureThroughput(url, duration = 30) {
    const results = {
      requests: 0,
      successes: 0,
      errors: 0,
      latencies: [],
      bytesTransferred: 0,
      startTime: performance.now(),
      errors: [],
    };

    return new Promise((resolve) => {
      const endTime = Date.now() + duration * 1000;
      let activeRequests = 0;

      const makeRequest = () => {
        if (Date.now() > endTime && activeRequests === 0) {
          const endTime = performance.now();
          const totalTime = (endTime - results.startTime) / 1000;

          resolve({
            totalRequests: results.requests,
            successfulRequests: results.successes,
            failedRequests: results.errors.length,
            avgLatency:
              results.latencies.reduce((a, b) => a + b, 0) / results.latencies.length || 0,
            minLatency: Math.min(...results.latencies) || 0,
            maxLatency: Math.max(...results.latencies) || 0,
            rps: results.successes / totalTime,
            successRate: (results.successes / results.requests) * 100,
            bytesTransferred: results.bytesTransferred,
            duration: totalTime,
            errors: results.errors.slice(0, 5), // Keep first 5 errors
          });
          return;
        }

        if (Date.now() <= endTime) {
          activeRequests++;
          const requestStart = performance.now();
          results.requests++;

          const protocol = url.startsWith('https') ? https : http;
          const request = protocol.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => {
              data += chunk;
              results.bytesTransferred += chunk.length;
            });

            res.on('end', () => {
              const requestEnd = performance.now();
              const latency = requestEnd - requestStart;
              results.latencies.push(latency);

              if (res.statusCode >= 200 && res.statusCode < 300) {
                results.successes++;
              } else {
                results.errors.push(`HTTP ${res.statusCode}: ${url}`);
              }

              activeRequests--;
              setImmediate(makeRequest);
            });
          });

          request.on('error', (error) => {
            results.errors.push(`Request Error: ${error.message}`);
            activeRequests--;
            setImmediate(makeRequest);
          });

          request.setTimeout(10000, () => {
            request.destroy();
            results.errors.push(`Timeout: ${url}`);
            activeRequests--;
            setImmediate(makeRequest);
          });
        }
      };

      // Start concurrent requests
      for (let i = 0; i < Math.min(this.config.concurrency, 10); i++) {
        setImmediate(makeRequest);
      }
    });
  }

  // 2. External API Response Times
  async validateExternalAPIs() {
    console.log('\n🌐 2. EXTERNAL API RESPONSE TIMES');
    console.log('==================================');

    const apis = [
      { name: 'Plex Discovery', url: 'https://plex.tv/api/servers.xml', timeout: 5000 },
      {
        name: 'CDN Asset Test',
        url: 'https://cdnjs.cloudflare.com/ajax/libs/jquery/3.6.0/jquery.min.js',
        timeout: 3000,
      },
      { name: 'DNS Resolution Test', host: 'google.com', timeout: 2000 },
    ];

    for (const api of apis) {
      console.log(`\n🔍 Testing: ${api.name}`);
      try {
        if (api.url) {
          const result = await this.measureAPIResponse(api.url, api.timeout);
          this.results.latency[api.name] = result;
          console.log(`   ⏱️  Response Time: ${result.responseTime.toFixed(2)}ms`);
          console.log(`   📊 Status: ${result.status}`);
          console.log(`   📦 Content Length: ${result.contentLength} bytes`);
        } else if (api.host) {
          const result = await this.measureDNSResolution(api.host, api.timeout);
          this.results.latency[api.name] = result;
          console.log(`   ⏱️  DNS Resolution: ${result.resolutionTime.toFixed(2)}ms`);
          console.log(`   📊 IP Address: ${result.address}`);
        }
      } catch (error) {
        console.log(`   ❌ Error: ${error.message}`);
        this.results.latency[api.name] = { error: error.message };
      }
    }

    return this.results.latency;
  }

  async measureAPIResponse(url, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const startTime = performance.now();
      const protocol = url.startsWith('https') ? https : http;

      const request = protocol.get(url, (res) => {
        const endTime = performance.now();
        let contentLength = 0;

        res.on('data', (chunk) => {
          contentLength += chunk.length;
        });

        res.on('end', () => {
          resolve({
            responseTime: endTime - startTime,
            status: res.statusCode,
            contentLength,
            headers: res.headers,
          });
        });
      });

      request.setTimeout(timeout, () => {
        request.destroy();
        reject(new Error(`Request timeout after ${timeout}ms`));
      });

      request.on('error', reject);
    });
  }

  async measureDNSResolution(hostname, timeout = 2000) {
    const dns = require('dns');
    const util = require('util');
    const lookup = util.promisify(dns.lookup);

    return new Promise(async (resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`DNS resolution timeout after ${timeout}ms`));
      }, timeout);

      try {
        const startTime = performance.now();
        const result = await lookup(hostname);
        const endTime = performance.now();

        clearTimeout(timer);
        resolve({
          resolutionTime: endTime - startTime,
          address: result.address,
          family: result.family,
        });
      } catch (error) {
        clearTimeout(timer);
        reject(error);
      }
    });
  }

  // 3. CDN Performance Validation
  async validateCDNPerformance() {
    console.log('\n🚀 3. CDN PERFORMANCE VALIDATION');
    console.log('=================================');

    const cdnTests = [
      { name: 'Next.js Static Assets', path: '/_next/static/' },
      { name: 'Public Assets', path: '/public/' },
      { name: 'Image Assets', path: '/_next/image/' },
      { name: 'Font Assets', path: '/fonts/' },
    ];

    for (const test of cdnTests) {
      console.log(`\n🔍 Testing: ${test.name}`);
      const result = await this.measureCDNPerformance(`${this.config.baseUrl}${test.path}test`);
      this.results.network[test.name] = result;

      if (result.error) {
        console.log(`   ❌ Error: ${result.error}`);
      } else {
        console.log(`   ⏱️  First Byte: ${result.firstByteTime.toFixed(2)}ms`);
        console.log(`   📊 Cache Status: ${result.cacheStatus || 'Unknown'}`);
        console.log(`   📦 Compression: ${result.contentEncoding || 'None'}`);
      }
    }

    return this.results.network;
  }

  async measureCDNPerformance(url) {
    try {
      const startTime = performance.now();
      const protocol = url.startsWith('https') ? https : http;

      return new Promise((resolve, reject) => {
        const request = protocol.get(url, (res) => {
          const firstByteTime = performance.now() - startTime;

          resolve({
            firstByteTime,
            statusCode: res.statusCode,
            cacheStatus: res.headers['x-cache'] || res.headers['cf-cache-status'],
            contentEncoding: res.headers['content-encoding'],
            server: res.headers['server'],
            headers: res.headers,
          });

          res.resume(); // Consume the response
        });

        request.setTimeout(5000, () => {
          request.destroy();
          resolve({ error: 'Request timeout' });
        });

        request.on('error', (error) => {
          resolve({ error: error.message });
        });
      });
    } catch (error) {
      return { error: error.message };
    }
  }

  // 4. Network Latency Measurement
  async measureNetworkLatency() {
    console.log('\n📡 4. NETWORK LATENCY MEASUREMENT');
    console.log('=================================');

    const targets = [
      { name: 'Frontend Service', host: 'localhost', port: 3000 },
      { name: 'Backend Service', host: 'localhost', port: 3001 },
      { name: 'PostgreSQL', host: 'localhost', port: 5432 },
      { name: 'Redis', host: 'localhost', port: 6379 },
      { name: 'Nginx Proxy', host: 'localhost', port: 80 },
    ];

    for (const target of targets) {
      console.log(`\n🔍 Testing: ${target.name} (${target.host}:${target.port})`);
      const result = await this.measureTCPLatency(target.host, target.port);
      this.results.network[`${target.name}_latency`] = result;

      if (result.error) {
        console.log(`   ❌ Connection Error: ${result.error}`);
      } else {
        console.log(`   ⏱️  Connection Time: ${result.connectionTime.toFixed(2)}ms`);
        console.log(`   🟢 Status: Connected`);
      }
    }

    return this.results.network;
  }

  async measureTCPLatency(host, port, timeout = 3000) {
    return new Promise((resolve) => {
      const startTime = performance.now();
      const socket = new net.Socket();

      const timer = setTimeout(() => {
        socket.destroy();
        resolve({ error: `Connection timeout after ${timeout}ms` });
      }, timeout);

      socket.connect(port, host, () => {
        const endTime = performance.now();
        clearTimeout(timer);
        socket.destroy();
        resolve({
          connectionTime: endTime - startTime,
          connected: true,
        });
      });

      socket.on('error', (error) => {
        clearTimeout(timer);
        resolve({ error: error.message });
      });
    });
  }

  // 5. Reverse Proxy Performance (Traefik/Nginx)
  async validateProxyPerformance() {
    console.log('\n🔄 5. REVERSE PROXY PERFORMANCE');
    console.log('===============================');

    const proxyTests = [
      { name: 'Direct Backend', url: `${this.config.apiUrl}/api/health` },
      { name: 'Via Nginx Proxy', url: `http://localhost/api/health` },
      { name: 'SSL Termination', url: `https://localhost/api/health` },
      { name: 'Load Balancing', url: `http://localhost/api/v1/media` },
    ];

    for (const test of proxyTests) {
      console.log(`\n🔍 Testing: ${test.name}`);
      try {
        const result = await this.measureProxyPerformance(test.url);
        this.results.proxy[test.name] = result;

        console.log(`   ⏱️  Response Time: ${result.responseTime.toFixed(2)}ms`);
        console.log(`   📊 Headers Added: ${result.proxyHeaders}`);
        console.log(`   🔒 SSL: ${result.ssl ? 'Yes' : 'No'}`);
        console.log(`   📋 Status: ${result.statusCode}`);
      } catch (error) {
        console.log(`   ❌ Error: ${error.message}`);
        this.results.proxy[test.name] = { error: error.message };
      }
    }

    return this.results.proxy;
  }

  async measureProxyPerformance(url) {
    const startTime = performance.now();
    const protocol = url.startsWith('https') ? https : http;

    return new Promise((resolve, reject) => {
      const request = protocol.get(url, (res) => {
        const endTime = performance.now();
        let proxyHeaders = 0;

        // Count proxy-related headers
        Object.keys(res.headers).forEach((header) => {
          if (header.includes('x-') || header.includes('proxy') || header.includes('forwarded')) {
            proxyHeaders++;
          }
        });

        resolve({
          responseTime: endTime - startTime,
          statusCode: res.statusCode,
          proxyHeaders,
          ssl: url.startsWith('https'),
          server: res.headers['server'],
          headers: res.headers,
        });

        res.resume(); // Consume response
      });

      request.setTimeout(10000, () => {
        request.destroy();
        reject(new Error('Request timeout'));
      });

      request.on('error', reject);
    });
  }

  // 6. Container Network Performance
  async validateContainerNetwork() {
    console.log('\n🐳 6. CONTAINER NETWORK PERFORMANCE');
    console.log('===================================');

    // Test Docker network bridge performance
    const containerTests = [
      { name: 'Inter-service Communication', from: 'frontend', to: 'backend' },
      { name: 'Database Connection Pool', from: 'backend', to: 'postgres' },
      { name: 'Cache Performance', from: 'backend', to: 'redis' },
      { name: 'Service Discovery', test: 'dns' },
    ];

    for (const test of containerTests) {
      console.log(`\n🔍 Testing: ${test.name}`);

      if (test.test === 'dns') {
        const result = await this.testServiceDiscovery();
        this.results.container[test.name] = result;
      } else {
        const result = await this.testInterServiceCommunication(test.from, test.to);
        this.results.container[test.name] = result;
      }
    }

    return this.results.container;
  }

  async testServiceDiscovery() {
    const services = ['frontend', 'backend', 'postgres', 'redis', 'nginx'];
    const results = {};

    for (const service of services) {
      try {
        const result = await this.measureDNSResolution(service, 1000);
        results[service] = {
          resolutionTime: result.resolutionTime,
          resolved: true,
          address: result.address,
        };
        console.log(`   🔍 ${service}: ${result.resolutionTime.toFixed(2)}ms -> ${result.address}`);
      } catch (error) {
        results[service] = {
          resolved: false,
          error: error.message,
        };
        console.log(`   ❌ ${service}: ${error.message}`);
      }
    }

    return results;
  }

  async testInterServiceCommunication(from, to) {
    // This would ideally run from within containers
    // For now, we'll simulate by testing the exposed ports
    const portMap = {
      frontend: 3000,
      backend: 3001,
      postgres: 5432,
      redis: 6379,
      nginx: 80,
    };

    const toPort = portMap[to];
    if (!toPort) {
      return { error: `Unknown service: ${to}` };
    }

    const result = await this.measureTCPLatency('localhost', toPort);
    console.log(
      `   🔗 ${from} -> ${to}: ${result.connectionTime ? result.connectionTime.toFixed(2) + 'ms' : result.error}`,
    );

    return result;
  }

  // 7. Bandwidth Utilization
  async validateBandwidthUtilization() {
    console.log('\n📊 7. BANDWIDTH UTILIZATION');
    console.log('============================');

    const bandwidthTests = [
      { name: 'Small Request (1KB)', size: 1024 },
      { name: 'Medium Request (100KB)', size: 102400 },
      { name: 'Large Request (1MB)', size: 1048576 },
      { name: 'Concurrent Load Test', concurrent: true },
    ];

    for (const test of bandwidthTests) {
      console.log(`\n🔍 Testing: ${test.name}`);

      if (test.concurrent) {
        const result = await this.measureConcurrentBandwidth();
        this.results.bandwidth[test.name] = result;
      } else {
        const result = await this.measureBandwidthForSize(test.size);
        this.results.bandwidth[test.name] = result;

        console.log(`   ⏱️  Transfer Time: ${result.transferTime.toFixed(2)}ms`);
        console.log(`   📊 Throughput: ${result.throughputMbps.toFixed(2)} Mbps`);
        console.log(`   📦 Bytes Transferred: ${result.bytesTransferred}`);
      }
    }

    return this.results.bandwidth;
  }

  async measureBandwidthForSize(size) {
    // Create test payload
    const payload = 'x'.repeat(size);
    const url = `${this.config.apiUrl}/api/health`;

    const startTime = performance.now();

    try {
      const result = await new Promise((resolve, reject) => {
        const protocol = url.startsWith('https') ? https : http;
        const postData = JSON.stringify({ data: payload });

        const options = {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData),
          },
        };

        const request = protocol.request(url, options, (res) => {
          let responseData = '';
          res.on('data', (chunk) => {
            responseData += chunk;
          });

          res.on('end', () => {
            const endTime = performance.now();
            resolve({
              transferTime: endTime - startTime,
              bytesTransferred: Buffer.byteLength(postData) + responseData.length,
              statusCode: res.statusCode,
            });
          });
        });

        request.setTimeout(30000, () => {
          request.destroy();
          reject(new Error('Request timeout'));
        });

        request.on('error', reject);
        request.write(postData);
        request.end();
      });

      const throughputMbps = (result.bytesTransferred * 8) / (result.transferTime * 1000); // Convert to Mbps

      return {
        ...result,
        throughputMbps,
      };
    } catch (error) {
      return { error: error.message };
    }
  }

  async measureConcurrentBandwidth() {
    const concurrentRequests = 10;
    const requestSize = 10240; // 10KB per request
    const startTime = performance.now();

    const promises = Array(concurrentRequests)
      .fill()
      .map(async () => {
        return this.measureBandwidthForSize(requestSize);
      });

    try {
      const results = await Promise.all(promises);
      const endTime = performance.now();

      const successfulResults = results.filter((r) => !r.error);
      const totalBytes = successfulResults.reduce((sum, r) => sum + r.bytesTransferred, 0);
      const totalTime = endTime - startTime;
      const totalThroughputMbps = (totalBytes * 8) / (totalTime * 1000);

      console.log(`   🚀 Concurrent Requests: ${concurrentRequests}`);
      console.log(`   ✅ Successful: ${successfulResults.length}`);
      console.log(`   📊 Total Throughput: ${totalThroughputMbps.toFixed(2)} Mbps`);
      console.log(`   📦 Total Bytes: ${totalBytes}`);

      return {
        concurrentRequests,
        successfulRequests: successfulResults.length,
        totalThroughputMbps,
        totalBytes,
        totalTime,
      };
    } catch (error) {
      return { error: error.message };
    }
  }

  // Generate comprehensive report
  async generateReport() {
    const reportPath = path.join(this.config.outputDir, `network-performance-${Date.now()}.json`);
    const report = {
      timestamp: new Date().toISOString(),
      config: this.config,
      results: this.results,
      summary: this.generateSummary(),
    };

    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

    console.log('\n📊 PERFORMANCE SUMMARY');
    console.log('======================');
    console.log(report.summary.overview);
    console.log(`\n📁 Full report saved to: ${reportPath}`);

    return report;
  }

  generateSummary() {
    const summary = {
      overview: '',
      recommendations: [],
      alerts: [],
    };

    // Analyze results and generate insights
    const avgLatency = this.calculateAverageLatency();
    const throughputIssues = this.identifyThroughputIssues();
    const networkProblems = this.identifyNetworkProblems();

    summary.overview = `
Average Response Time: ${avgLatency.toFixed(2)}ms
Throughput Status: ${throughputIssues.length === 0 ? 'GOOD' : 'NEEDS ATTENTION'}
Network Issues: ${networkProblems.length}
Proxy Performance: ${this.assessProxyPerformance()}`;

    if (avgLatency > 1000) {
      summary.alerts.push('HIGH LATENCY: Average response time exceeds 1 second');
    }

    if (throughputIssues.length > 0) {
      summary.alerts.push(`THROUGHPUT ISSUES: ${throughputIssues.join(', ')}`);
    }

    return summary;
  }

  calculateAverageLatency() {
    const latencies = [];
    Object.values(this.results.throughput).forEach((result) => {
      if (result.avgLatency) latencies.push(result.avgLatency);
    });
    return latencies.length ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0;
  }

  identifyThroughputIssues() {
    const issues = [];
    Object.entries(this.results.throughput).forEach(([name, result]) => {
      if (result.successRate < 95) {
        issues.push(`${name}: ${result.successRate.toFixed(1)}% success rate`);
      }
      if (result.rps < 10) {
        issues.push(`${name}: Low RPS (${result.rps.toFixed(1)})`);
      }
    });
    return issues;
  }

  identifyNetworkProblems() {
    const problems = [];
    Object.entries(this.results.network).forEach(([name, result]) => {
      if (result.error) {
        problems.push(`${name}: ${result.error}`);
      }
    });
    return problems;
  }

  assessProxyPerformance() {
    const proxyResults = Object.values(this.results.proxy);
    const workingProxies = proxyResults.filter((r) => !r.error).length;
    return workingProxies === proxyResults.length ? 'OPTIMAL' : 'DEGRADED';
  }
}

// CLI execution
async function main() {
  try {
    const validator = new NetworkPerformanceValidator({
      baseUrl: process.env.BASE_URL || 'http://localhost:3000',
      apiUrl: process.env.API_URL || 'http://localhost:3001',
      concurrency: parseInt(process.env.CONCURRENCY) || 10,
      duration: parseInt(process.env.DURATION) || 30,
    });

    await validator.init();

    // Run all validation tests
    await validator.validateThroughput();
    await validator.validateExternalAPIs();
    await validator.validateCDNPerformance();
    await validator.measureNetworkLatency();
    await validator.validateProxyPerformance();
    await validator.validateContainerNetwork();
    await validator.validateBandwidthUtilization();

    // Generate final report
    const report = await validator.generateReport();

    // Store in memory for coordination
    const memoryStore = {
      timestamp: new Date().toISOString(),
      validator: 'network-performance',
      status: 'completed',
      results: report,
      key_metrics: {
        avg_latency: validator.calculateAverageLatency(),
        throughput_issues: validator.identifyThroughputIssues().length,
        network_problems: validator.identifyNetworkProblems().length,
        proxy_status: validator.assessProxyPerformance(),
      },
    };

    console.log('\n✅ Network Performance Validation Complete');
    console.log(`📊 Results stored in: ${validator.config.outputDir}`);

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Network Performance Validation Failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { NetworkPerformanceValidator };
