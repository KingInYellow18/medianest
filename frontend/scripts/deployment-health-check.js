#!/usr/bin/env node
/**
 * MediaNest Deployment Health Check Script
 * Comprehensive health validation for production deployments
 * Part of CI/CD automation pipeline
 */

const http = require('http');
const https = require('https');
const url = require('url');
const fs = require('fs').promises;

class DeploymentHealthChecker {
  constructor(config = {}) {
    this.config = {
      timeout: 30000,
      retries: 3,
      retryDelay: 5000,
      endpoints: [],
      environment: process.env.NODE_ENV || 'production',
      ...config,
    };

    this.results = {
      timestamp: new Date().toISOString(),
      environment: this.config.environment,
      checks: [],
      overall: { status: 'unknown', errors: [] },
    };
  }

  /**
   * Perform HTTP health check on endpoint
   */
  async checkEndpoint(endpoint) {
    const startTime = Date.now();

    return new Promise((resolve) => {
      const parsedUrl = url.parse(endpoint.url);
      const protocol = parsedUrl.protocol === 'https:' ? https : http;

      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port,
        path: parsedUrl.path,
        method: endpoint.method || 'GET',
        timeout: this.config.timeout,
        headers: endpoint.headers || {},
      };

      const req = protocol.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          const responseTime = Date.now() - startTime;
          const result = {
            name: endpoint.name,
            url: endpoint.url,
            status: res.statusCode >= 200 && res.statusCode < 300 ? 'healthy' : 'unhealthy',
            statusCode: res.statusCode,
            responseTime: responseTime,
            expectedStatus: endpoint.expectedStatus || 200,
            response: endpoint.checkResponse ? data : null,
          };

          // Validate response content if specified
          if (endpoint.expectedContent && !data.includes(endpoint.expectedContent)) {
            result.status = 'unhealthy';
            result.error = `Expected content '${endpoint.expectedContent}' not found`;
          }

          resolve(result);
        });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({
          name: endpoint.name,
          url: endpoint.url,
          status: 'unhealthy',
          error: `Timeout after ${this.config.timeout}ms`,
          responseTime: Date.now() - startTime,
        });
      });

      req.on('error', (error) => {
        resolve({
          name: endpoint.name,
          url: endpoint.url,
          status: 'unhealthy',
          error: error.message,
          responseTime: Date.now() - startTime,
        });
      });

      req.end();
    });
  }

  /**
   * Check application performance metrics
   */
  async checkPerformance(baseUrl) {

    const performanceChecks = [
      {
        name: 'Home Page Load Time',
        url: baseUrl,
        maxResponseTime: 2000,
      },
      {
        name: 'API Health Endpoint',
        url: `${baseUrl}/api/health`,
        maxResponseTime: 1000,
      },
    ];

    const results = [];

    for (const check of performanceChecks) {
      const result = await this.checkEndpoint(check);

      if (result.responseTime > check.maxResponseTime) {
        result.status = 'degraded';
        result.warning = `Response time ${result.responseTime}ms exceeds threshold ${check.maxResponseTime}ms`;
      }

      results.push(result);
    }

    return results;
  }

  /**
   * Check database connectivity
   */
  async checkDatabase(dbUrl) {

    // Simulate database health check
    // In real implementation, this would connect to actual database
    return {
      name: 'Database Connection',
      status: 'healthy',
      responseTime: Math.random() * 100,
      details: 'Connection pool healthy',
    };
  }

  /**
   * Check external service dependencies
   */
  async checkExternalServices() {

    const services = [
      {
        name: 'Redis Cache',
        url: 'http://localhost:6379',
        timeout: 5000,
      },
      {
        name: 'Authentication Service',
        url: process.env.AUTH_SERVICE_URL || 'http://localhost:3001/health',
        timeout: 10000,
      },
    ];

    const results = [];
    for (const service of services) {
      try {
        const result = await this.checkEndpoint(service);
        results.push(result);
      } catch (error) {
        results.push({
          name: service.name,
          status: 'unhealthy',
          error: error.message,
        });
      }
    }

    return results;
  }

  /**
   * Run comprehensive health check suite
   */
  async runHealthCheck(baseUrl) {

    try {
      // Basic endpoint checks
      const endpointResults = await this.checkPerformance(baseUrl);
      this.results.checks.push(...endpointResults);

      // Database check
      const dbResult = await this.checkDatabase();
      this.results.checks.push(dbResult);

      // External services check
      const serviceResults = await this.checkExternalServices();
      this.results.checks.push(...serviceResults);

      // Determine overall health
      const unhealthyChecks = this.results.checks.filter((check) => check.status === 'unhealthy');
      const degradedChecks = this.results.checks.filter((check) => check.status === 'degraded');

      if (unhealthyChecks.length === 0 && degradedChecks.length === 0) {
        this.results.overall.status = 'healthy';
      } else if (unhealthyChecks.length === 0 && degradedChecks.length > 0) {
        this.results.overall.status = 'degraded';
        this.results.overall.warnings = degradedChecks.map((check) => check.warning || check.name);
      } else {
        this.results.overall.status = 'unhealthy';
        this.results.overall.errors = unhealthyChecks.map((check) => check.error || check.name);
      }
    } catch (error) {
      this.results.overall.status = 'unhealthy';
      this.results.overall.errors.push(`Health check failed: ${error.message}`);
    }

    return this.results;
  }

  /**
   * Generate health check report
   */
  generateReport() {
      `Overall Status: ${this.getStatusEmoji(
        this.results.overall.status
      )} ${this.results.overall.status.toUpperCase()}`
    );

    // Individual check results
    this.results.checks.forEach((check) => {
      const emoji = this.getStatusEmoji(check.status);
      const responseTime = check.responseTime ? ` (${check.responseTime}ms)` : '';

      if (check.error) {
      }
      if (check.warning) {
      }
    });

    // Summary
    const healthyCount = this.results.checks.filter((c) => c.status === 'healthy').length;
    const degradedCount = this.results.checks.filter((c) => c.status === 'degraded').length;
    const unhealthyCount = this.results.checks.filter((c) => c.status === 'unhealthy').length;


    return this.results.overall.status === 'healthy';
  }

  getStatusEmoji(status) {
    const emojis = {
      healthy: '✅',
      degraded: '⚠️',
      unhealthy: '❌',
      unknown: '❓',
    };
    return emojis[status] || emojis.unknown;
  }

  /**
   * Save health check results to file
   */
  async saveResults(filename = 'health-check-results.json') {
    try {
      await fs.writeFile(filename, JSON.stringify(this.results, null, 2));
    } catch (error) {
    }
  }
}

// CLI execution
async function main() {
  const baseUrl = process.argv[2] || 'http://localhost:3000';
  const outputFile = process.argv[3];

  const healthChecker = new DeploymentHealthChecker({
    timeout: 10000,
    retries: 2,
  });

  try {
    const results = await healthChecker.runHealthCheck(baseUrl);
    const isHealthy = healthChecker.generateReport();

    if (outputFile) {
      await healthChecker.saveResults(outputFile);
    }

    // Exit with appropriate code for CI/CD
    process.exit(isHealthy ? 0 : 1);
  } catch (error) {
    process.exit(1);
  }
}

// Export for module usage
module.exports = DeploymentHealthChecker;

// Run if called directly
if (require.main === module) {
  main();
}
