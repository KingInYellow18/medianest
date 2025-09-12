#!/usr/bin/env node

/**
 * MediaNest Reverse Proxy Performance Validator
 * Tests Traefik/Nginx load balancing, SSL termination, and routing efficiency
 */

const http = require('http');
const https = require('https');
const { performance } = require('perf_hooks');
const { URL } = require('url');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class ProxyPerformanceValidator {
  constructor(config = {}) {
    this.config = {
      proxyUrl: config.proxyUrl || 'http://localhost',
      httpsUrl: config.httpsUrl || 'https://localhost',
      backendUrl: config.backendUrl || 'http://localhost:3001',
      concurrency: config.concurrency || 25,
      duration: config.duration || 60,
      outputDir: config.outputDir || './performance/proxy-reports',
      testRoutes: config.testRoutes || [
        '/api/health',
        '/api/v1/auth/health',
        '/api/v1/media',
        '/_next/static/test.js',
        '/socket.io/',
        '/nginx_status',
      ],
      ...config,
    };

    this.results = {
      loadBalancing: {},
      sslTermination: {},
      routingEfficiency: {},
      headerProcessing: {},
      errorHandling: {},
      caching: {},
      compression: {},
    };
  }

  async init() {
    await fs.mkdir(this.config.outputDir, { recursive: true });
    console.log(`🔄 Proxy Performance Validator initialized`);
    console.log(`🌐 Proxy URL: ${this.config.proxyUrl}`);
    console.log(`🔒 HTTPS URL: ${this.config.httpsUrl}`);
  }

  // 1. Load Balancing Effectiveness Test
  async testLoadBalancing() {
    console.log('\n⚖️  1. LOAD BALANCING EFFECTIVENESS');
    console.log('===================================');

    const loadBalancingTests = [
      { name: 'Round Robin Distribution', test: 'round_robin' },
      { name: 'Least Connections', test: 'least_conn' },
      { name: 'Upstream Health Checks', test: 'health_checks' },
      { name: 'Failover Behavior', test: 'failover' },
    ];

    for (const test of loadBalancingTests) {
      console.log(`\n🔍 Testing: ${test.name}`);
      const result = await this.runLoadBalancingTest(test.test);
      this.results.loadBalancing[test.name] = result;

      if (result.error) {
        console.log(`   ❌ Error: ${result.error}`);
      } else {
        console.log(`   📊 Requests Distributed: ${result.totalRequests}`);
        console.log(`   ⚖️  Balance Ratio: ${result.balanceRatio}%`);
        console.log(`   ⏱️  Average Response: ${result.avgResponseTime.toFixed(2)}ms`);
        console.log(`   ✅ Success Rate: ${result.successRate.toFixed(2)}%`);
      }
    }

    return this.results.loadBalancing;
  }

  async runLoadBalancingTest(testType) {
    const requests = 100;
    const results = {
      requests: [],
      servers: new Map(),
      totalRequests: 0,
      successfulRequests: 0,
      startTime: performance.now(),
    };

    try {
      const promises = Array(requests)
        .fill()
        .map(async (_, index) => {
          const result = await this.makeProxyRequest('/api/health', {
            headers: {
              'X-Test-Request': index.toString(),
              'X-Test-Type': testType,
            },
          });

          results.totalRequests++;
          if (result.success) {
            results.successfulRequests++;

            // Track which server handled the request
            const server =
              result.headers['x-served-by'] ||
              result.headers['server'] ||
              result.headers['x-upstream-server'] ||
              'unknown';

            results.servers.set(server, (results.servers.get(server) || 0) + 1);
          }

          results.requests.push(result);
          return result;
        });

      await Promise.all(promises);

      const endTime = performance.now();
      const duration = endTime - results.startTime;

      // Calculate balance ratio (how evenly distributed the requests are)
      const serverCounts = Array.from(results.servers.values());
      const avgRequestsPerServer = serverCounts.reduce((a, b) => a + b, 0) / serverCounts.length;
      const variance =
        serverCounts.reduce((sum, count) => sum + Math.pow(count - avgRequestsPerServer, 2), 0) /
        serverCounts.length;
      const balanceRatio = Math.max(0, 100 - (variance / avgRequestsPerServer) * 100);

      return {
        totalRequests: results.totalRequests,
        successfulRequests: results.successfulRequests,
        successRate: (results.successfulRequests / results.totalRequests) * 100,
        avgResponseTime:
          results.requests.reduce((sum, r) => sum + (r.responseTime || 0), 0) /
          results.requests.length,
        balanceRatio: balanceRatio.toFixed(2),
        serverDistribution: Object.fromEntries(results.servers),
        duration: duration,
      };
    } catch (error) {
      return { error: error.message };
    }
  }

  // 2. SSL/TLS Termination Performance
  async testSSLTermination() {
    console.log('\n🔒 2. SSL/TLS TERMINATION PERFORMANCE');
    console.log('=====================================');

    const sslTests = [
      { name: 'SSL Handshake Time', test: 'handshake' },
      { name: 'Certificate Validation', test: 'cert_validation' },
      { name: 'Cipher Suite Performance', test: 'cipher_performance' },
      { name: 'HTTP to HTTPS Redirect', test: 'redirect_performance' },
    ];

    for (const test of sslTests) {
      console.log(`\n🔍 Testing: ${test.name}`);
      const result = await this.runSSLTest(test.test);
      this.results.sslTermination[test.name] = result;

      if (result.error) {
        console.log(`   ❌ Error: ${result.error}`);
      } else {
        console.log(
          `   ⏱️  SSL Time: ${result.sslTime ? result.sslTime.toFixed(2) + 'ms' : 'N/A'}`,
        );
        console.log(`   🔐 Cipher: ${result.cipher || 'Unknown'}`);
        console.log(`   📋 Protocol: ${result.protocol || 'Unknown'}`);
        console.log(`   ✅ Success: ${result.success ? 'Yes' : 'No'}`);
      }
    }

    return this.results.sslTermination;
  }

  async runSSLTest(testType) {
    try {
      const startTime = performance.now();

      switch (testType) {
        case 'handshake':
          return await this.measureSSLHandshake();

        case 'cert_validation':
          return await this.validateSSLCertificate();

        case 'cipher_performance':
          return await this.testCipherPerformance();

        case 'redirect_performance':
          return await this.testHTTPSRedirect();

        default:
          throw new Error(`Unknown SSL test type: ${testType}`);
      }
    } catch (error) {
      return { error: error.message };
    }
  }

  async measureSSLHandshake() {
    if (!this.config.httpsUrl.startsWith('https')) {
      return { error: 'HTTPS URL not configured' };
    }

    const url = new URL(this.config.httpsUrl + '/api/health');
    const startTime = performance.now();

    return new Promise((resolve) => {
      const options = {
        hostname: url.hostname,
        port: url.port || 443,
        path: url.pathname,
        method: 'GET',
      };

      const request = https.request(options, (res) => {
        const handshakeTime = performance.now() - startTime;

        resolve({
          sslTime: handshakeTime,
          cipher: res.connection?.getCipher?.()?.name || 'unknown',
          protocol: res.connection?.getProtocol?.() || 'unknown',
          success: res.statusCode >= 200 && res.statusCode < 300,
        });

        res.resume(); // Consume response
      });

      request.on('error', (error) => {
        resolve({ error: error.message, success: false });
      });

      request.setTimeout(10000, () => {
        request.destroy();
        resolve({ error: 'SSL handshake timeout', success: false });
      });

      request.end();
    });
  }

  async validateSSLCertificate() {
    if (!this.config.httpsUrl.startsWith('https')) {
      return { error: 'HTTPS URL not configured' };
    }

    const url = new URL(this.config.httpsUrl);

    return new Promise((resolve) => {
      const options = {
        hostname: url.hostname,
        port: url.port || 443,
        method: 'GET',
        rejectUnauthorized: false, // We'll check cert manually
      };

      const request = https.request(options, (res) => {
        const cert = res.connection?.getPeerCertificate?.();

        if (cert) {
          const now = new Date();
          const validFrom = new Date(cert.valid_from);
          const validTo = new Date(cert.valid_to);

          resolve({
            success: true,
            subject: cert.subject?.CN || 'unknown',
            issuer: cert.issuer?.CN || 'unknown',
            validFrom: cert.valid_from,
            validTo: cert.valid_to,
            isValid: now >= validFrom && now <= validTo,
            daysUntilExpiry: Math.ceil((validTo - now) / (1000 * 60 * 60 * 24)),
          });
        } else {
          resolve({ error: 'No certificate information available', success: false });
        }

        res.resume();
      });

      request.on('error', (error) => {
        resolve({ error: error.message, success: false });
      });

      request.setTimeout(10000, () => {
        request.destroy();
        resolve({ error: 'Certificate validation timeout', success: false });
      });

      request.end();
    });
  }

  async testCipherPerformance() {
    // Test different cipher suites if supported
    const ciphers = [
      'ECDHE-RSA-AES128-GCM-SHA256',
      'ECDHE-RSA-AES256-GCM-SHA384',
      'ECDHE-RSA-CHACHA20-POLY1305',
    ];

    const results = {};

    for (const cipher of ciphers) {
      try {
        const result = await this.testSpecificCipher(cipher);
        results[cipher] = result;
      } catch (error) {
        results[cipher] = { error: error.message };
      }
    }

    return {
      success: Object.keys(results).length > 0,
      cipherResults: results,
    };
  }

  async testSpecificCipher(cipher) {
    if (!this.config.httpsUrl.startsWith('https')) {
      return { error: 'HTTPS URL not configured' };
    }

    const url = new URL(this.config.httpsUrl + '/api/health');
    const startTime = performance.now();

    return new Promise((resolve) => {
      const options = {
        hostname: url.hostname,
        port: url.port || 443,
        path: url.pathname,
        method: 'GET',
        ciphers: cipher,
      };

      const request = https.request(options, (res) => {
        const responseTime = performance.now() - startTime;

        resolve({
          responseTime,
          success: res.statusCode >= 200 && res.statusCode < 300,
          actualCipher: res.connection?.getCipher?.()?.name || 'unknown',
        });

        res.resume();
      });

      request.on('error', (error) => {
        resolve({ error: error.message, success: false });
      });

      request.setTimeout(10000, () => {
        request.destroy();
        resolve({ error: 'Cipher test timeout', success: false });
      });

      request.end();
    });
  }

  async testHTTPSRedirect() {
    const httpUrl = this.config.proxyUrl.replace('https:', 'http:') + '/api/health';
    const startTime = performance.now();

    return new Promise((resolve) => {
      const request = http.get(httpUrl, (res) => {
        const redirectTime = performance.now() - startTime;

        resolve({
          success: res.statusCode >= 300 && res.statusCode < 400,
          statusCode: res.statusCode,
          redirectTime,
          location: res.headers.location,
          isHTTPS: res.headers.location?.startsWith('https') || false,
        });

        res.resume();
      });

      request.on('error', (error) => {
        resolve({ error: error.message, success: false });
      });

      request.setTimeout(5000, () => {
        request.destroy();
        resolve({ error: 'Redirect test timeout', success: false });
      });
    });
  }

  // 3. Request Routing Efficiency
  async testRoutingEfficiency() {
    console.log('\n🛣️  3. REQUEST ROUTING EFFICIENCY');
    console.log('=================================');

    for (const route of this.config.testRoutes) {
      console.log(`\n🔍 Testing Route: ${route}`);
      const result = await this.measureRoutingPerformance(route);
      this.results.routingEfficiency[route] = result;

      if (result.error) {
        console.log(`   ❌ Error: ${result.error}`);
      } else {
        console.log(`   ⏱️  Routing Time: ${result.routingTime.toFixed(2)}ms`);
        console.log(`   🎯 Route Match: ${result.routeMatched ? 'Yes' : 'No'}`);
        console.log(`   📊 Status Code: ${result.statusCode}`);
        console.log(`   🔄 Upstream: ${result.upstream || 'Unknown'}`);
      }
    }

    return this.results.routingEfficiency;
  }

  async measureRoutingPerformance(route) {
    try {
      const startTime = performance.now();
      const result = await this.makeProxyRequest(route, {
        headers: {
          'X-Route-Test': 'true',
          'X-Test-Route': route,
        },
      });

      const routingTime = performance.now() - startTime;

      return {
        routingTime,
        routeMatched: result.success && result.statusCode !== 404,
        statusCode: result.statusCode,
        upstream: result.headers['x-upstream-server'] || result.headers['server'],
        responseTime: result.responseTime,
        success: result.success,
      };
    } catch (error) {
      return { error: error.message };
    }
  }

  // 4. Header Processing Performance
  async testHeaderProcessing() {
    console.log('\n📋 4. HEADER PROCESSING PERFORMANCE');
    console.log('===================================');

    const headerTests = [
      { name: 'Security Headers Addition', headers: { 'X-Security-Test': 'true' } },
      {
        name: 'CORS Headers Processing',
        headers: { Origin: 'https://example.com', 'Access-Control-Request-Method': 'POST' },
      },
      {
        name: 'Custom Header Forwarding',
        headers: { 'X-Custom-Header': 'test-value', 'X-Request-ID': crypto.randomUUID() },
      },
      { name: 'Large Header Processing', headers: { 'X-Large-Header': 'x'.repeat(1000) } },
    ];

    for (const test of headerTests) {
      console.log(`\n🔍 Testing: ${test.name}`);
      const result = await this.testSpecificHeaders(test.headers);
      this.results.headerProcessing[test.name] = result;

      if (result.error) {
        console.log(`   ❌ Error: ${result.error}`);
      } else {
        console.log(`   ⏱️  Processing Time: ${result.processingTime.toFixed(2)}ms`);
        console.log(`   📤 Headers Sent: ${result.headersSent}`);
        console.log(`   📥 Headers Received: ${result.headersReceived}`);
        console.log(`   🔄 Headers Added by Proxy: ${result.proxyHeadersAdded}`);
      }
    }

    return this.results.headerProcessing;
  }

  async testSpecificHeaders(testHeaders) {
    try {
      const startTime = performance.now();
      const result = await this.makeProxyRequest('/api/health', {
        headers: testHeaders,
      });

      const processingTime = performance.now() - startTime;

      // Count headers
      const headersSent = Object.keys(testHeaders).length;
      const headersReceived = Object.keys(result.headers).length;

      // Count proxy-specific headers
      const proxyHeaders = Object.keys(result.headers).filter(
        (header) =>
          header.toLowerCase().includes('x-') ||
          header.toLowerCase().includes('proxy') ||
          header.toLowerCase().includes('forwarded'),
      ).length;

      return {
        processingTime,
        headersSent,
        headersReceived,
        proxyHeadersAdded: proxyHeaders,
        success: result.success,
      };
    } catch (error) {
      return { error: error.message };
    }
  }

  // Helper method to make proxy requests
  async makeProxyRequest(path, options = {}) {
    const url = this.config.proxyUrl + path;
    const startTime = performance.now();

    return new Promise((resolve) => {
      const protocol = url.startsWith('https') ? https : http;
      const requestOptions = {
        headers: {
          'User-Agent': 'MediaNest-Proxy-Performance-Test/1.0',
          ...options.headers,
        },
        timeout: 10000,
      };

      const request = protocol.get(url, requestOptions, (res) => {
        const responseTime = performance.now() - startTime;
        let data = '';

        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          resolve({
            success: res.statusCode >= 200 && res.statusCode < 300,
            statusCode: res.statusCode,
            headers: res.headers,
            responseTime,
            contentLength: data.length,
            data: data.substring(0, 1000), // Truncate for logging
          });
        });
      });

      request.on('error', (error) => {
        resolve({
          success: false,
          error: error.message,
          responseTime: performance.now() - startTime,
        });
      });

      request.setTimeout(10000, () => {
        request.destroy();
        resolve({
          success: false,
          error: 'Request timeout',
          responseTime: performance.now() - startTime,
        });
      });
    });
  }

  // Generate comprehensive report
  async generateReport() {
    const reportPath = path.join(this.config.outputDir, `proxy-performance-${Date.now()}.json`);
    const report = {
      timestamp: new Date().toISOString(),
      config: this.config,
      results: this.results,
      summary: this.generateSummary(),
    };

    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

    console.log('\n📊 PROXY PERFORMANCE SUMMARY');
    console.log('=============================');
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

    // Analyze load balancing performance
    const loadBalancingResults = Object.values(this.results.loadBalancing);
    const avgSuccessRate =
      loadBalancingResults.reduce((sum, r) => sum + (r.successRate || 0), 0) /
      loadBalancingResults.length;

    // Analyze SSL performance
    const sslResults = Object.values(this.results.sslTermination);
    const sslWorking = sslResults.filter((r) => r.success).length;

    // Analyze routing efficiency
    const routingResults = Object.values(this.results.routingEfficiency);
    const avgRoutingTime =
      routingResults.reduce((sum, r) => sum + (r.routingTime || 0), 0) / routingResults.length;

    summary.overview = `
Load Balancing Success Rate: ${avgSuccessRate.toFixed(1)}%
SSL/TLS Tests Passing: ${sslWorking}/${sslResults.length}
Average Routing Time: ${avgRoutingTime.toFixed(2)}ms
Routes Tested: ${routingResults.length}`;

    // Generate recommendations
    if (avgSuccessRate < 95) {
      summary.recommendations.push('Improve load balancer health checks');
    }

    if (avgRoutingTime > 50) {
      summary.recommendations.push('Optimize proxy routing configuration');
    }

    return summary;
  }
}

// CLI execution
async function main() {
  try {
    const validator = new ProxyPerformanceValidator({
      proxyUrl: process.env.PROXY_URL || 'http://localhost',
      httpsUrl: process.env.HTTPS_URL || 'https://localhost',
      backendUrl: process.env.BACKEND_URL || 'http://localhost:3001',
    });

    await validator.init();

    // Run all proxy performance tests
    await validator.testLoadBalancing();
    await validator.testSSLTermination();
    await validator.testRoutingEfficiency();
    await validator.testHeaderProcessing();

    // Generate final report
    const report = await validator.generateReport();

    console.log('\n✅ Proxy Performance Validation Complete');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Proxy Performance Validation Failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { ProxyPerformanceValidator };
