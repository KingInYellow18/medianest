/**
 * MediaNest Edge Case Testing Framework
 * Systematic exploration of boundary conditions and extreme scenarios
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import Redis from 'ioredis';
import { app } from '../../backend/src/app';

interface TestContext {
  prisma: PrismaClient;
  redis: Redis;
  authToken?: string;
  userId?: string;
}

interface EdgeCaseResult {
  category: string;
  testName: string;
  status: 'pass' | 'fail' | 'unexpected';
  boundary: string;
  expectedBehavior: string;
  actualBehavior: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  vulnerability?: string;
}

export class EdgeCaseTestRunner {
  private context: TestContext;
  private results: EdgeCaseResult[] = [];

  constructor(context: TestContext) {
    this.context = context;
  }

  // =============================================================================
  // BOUNDARY VALUE TESTING
  // =============================================================================

  async testFileSizeBoundaries(): Promise<EdgeCaseResult[]> {
    const results: EdgeCaseResult[] = [];
    const testCases = [
      { size: 0, name: 'empty-file', expected: 'reject' },
      { size: 1, name: 'single-byte', expected: 'accept' },
      { size: 1024 * 1024 - 1, name: 'just-under-1mb', expected: 'accept' },
      { size: 1024 * 1024, name: 'exactly-1mb', expected: 'accept' },
      { size: 1024 * 1024 + 1, name: 'just-over-1mb', expected: 'reject' },
      { size: 10 * 1024 * 1024, name: 'ten-mb', expected: 'reject' },
      { size: 100 * 1024 * 1024, name: 'hundred-mb', expected: 'reject' },
      { size: Number.MAX_SAFE_INTEGER, name: 'max-integer', expected: 'reject' },
    ];

    for (const testCase of testCases) {
      try {
        const buffer = Buffer.alloc(Math.min(testCase.size, 100 * 1024 * 1024));
        
        const response = await request(app)
          .post('/api/v1/media/upload')
          .set('Authorization', `Bearer ${this.context.authToken}`)
          .attach('file', buffer, `test-${testCase.name}.dat`);

        const passed = (testCase.expected === 'reject' && response.status >= 400) ||
                      (testCase.expected === 'accept' && response.status < 400);

        results.push({
          category: 'file-size-boundaries',
          testName: `file-size-${testCase.name}`,
          status: passed ? 'pass' : 'fail',
          boundary: `${testCase.size} bytes`,
          expectedBehavior: testCase.expected,
          actualBehavior: response.status < 400 ? 'accept' : 'reject',
          severity: testCase.size > 10 * 1024 * 1024 ? 'high' : 'medium',
          vulnerability: testCase.size > 100 * 1024 * 1024 && response.status < 400 
            ? 'Potential DoS via large file uploads' : undefined
        });
      } catch (error) {
        results.push({
          category: 'file-size-boundaries',
          testName: `file-size-${testCase.name}`,
          status: 'unexpected',
          boundary: `${testCase.size} bytes`,
          expectedBehavior: testCase.expected,
          actualBehavior: 'error',
          severity: 'high',
          vulnerability: `Unhandled error: ${error instanceof Error ? error.message : 'Unknown'}`
        });
      }
    }

    return results;
  }

  async testStringLengthBoundaries(): Promise<EdgeCaseResult[]> {
    const results: EdgeCaseResult[] = [];
    const testCases = [
      { length: 0, name: 'empty' },
      { length: 1, name: 'single-char' },
      { length: 255, name: 'db-varchar-limit' },
      { length: 256, name: 'over-varchar' },
      { length: 1000, name: 'medium-text' },
      { length: 65535, name: 'text-field-limit' },
      { length: 65536, name: 'over-text-limit' },
      { length: 1000000, name: 'very-long' },
    ];

    for (const testCase of testCases) {
      try {
        const testString = 'A'.repeat(testCase.length);
        
        const response = await request(app)
          .post('/api/v1/media/request')
          .set('Authorization', `Bearer ${this.context.authToken}`)
          .send({
            title: testString,
            mediaType: 'movie'
          });

        const passed = testCase.length <= 1000 ? 
          response.status < 400 : response.status >= 400;

        results.push({
          category: 'string-length-boundaries',
          testName: `string-${testCase.name}`,
          status: passed ? 'pass' : 'fail',
          boundary: `${testCase.length} characters`,
          expectedBehavior: testCase.length <= 1000 ? 'accept' : 'reject',
          actualBehavior: response.status < 400 ? 'accept' : 'reject',
          severity: testCase.length > 100000 ? 'high' : 'medium'
        });
      } catch (error) {
        results.push({
          category: 'string-length-boundaries',
          testName: `string-${testCase.name}`,
          status: 'unexpected',
          boundary: `${testCase.length} characters`,
          expectedBehavior: 'handle-gracefully',
          actualBehavior: 'error',
          severity: 'medium',
          vulnerability: `String handling error: ${error instanceof Error ? error.message : 'Unknown'}`
        });
      }
    }

    return results;
  }

  async testNumericBoundaries(): Promise<EdgeCaseResult[]> {
    const results: EdgeCaseResult[] = [];
    const integerTestCases = [
      { value: -2147483649, name: '32bit-underflow' }, // Below INT32_MIN
      { value: -2147483648, name: '32bit-min' },       // INT32_MIN
      { value: -1, name: 'negative-one' },
      { value: 0, name: 'zero' },
      { value: 1, name: 'positive-one' },
      { value: 2147483647, name: '32bit-max' },        // INT32_MAX
      { value: 2147483648, name: '32bit-overflow' },   // Above INT32_MAX
      { value: Number.MAX_SAFE_INTEGER, name: 'js-max-safe' },
      { value: Number.MAX_SAFE_INTEGER + 1, name: 'unsafe-integer' },
      { value: Infinity, name: 'infinity' },
      { value: -Infinity, name: 'negative-infinity' },
      { value: NaN, name: 'not-a-number' },
    ];

    for (const testCase of integerTestCases) {
      try {
        const response = await request(app)
          .get('/api/v1/system/status')
          .set('Authorization', `Bearer ${this.context.authToken}`)
          .query({ limit: testCase.value });

        const isValidNumber = !isNaN(testCase.value) && isFinite(testCase.value) && 
                             testCase.value > 0 && testCase.value <= 1000;
        const passed = isValidNumber ? response.status < 400 : response.status >= 400;

        results.push({
          category: 'numeric-boundaries',
          testName: `integer-${testCase.name}`,
          status: passed ? 'pass' : 'fail',
          boundary: testCase.value.toString(),
          expectedBehavior: isValidNumber ? 'accept' : 'reject',
          actualBehavior: response.status < 400 ? 'accept' : 'reject',
          severity: ['infinity', 'not-a-number', 'unsafe-integer'].includes(testCase.name) ? 'high' : 'medium'
        });
      } catch (error) {
        results.push({
          category: 'numeric-boundaries',
          testName: `integer-${testCase.name}`,
          status: 'unexpected',
          boundary: testCase.value.toString(),
          expectedBehavior: 'handle-gracefully',
          actualBehavior: 'error',
          severity: 'high',
          vulnerability: `Numeric handling error: ${error instanceof Error ? error.message : 'Unknown'}`
        });
      }
    }

    return results;
  }

  // =============================================================================
  // ERROR CONDITION TESTING
  // =============================================================================

  async testNetworkFailureScenarios(): Promise<EdgeCaseResult[]> {
    const results: EdgeCaseResult[] = [];
    
    // Test timeout scenarios
    const timeoutTests = [
      { timeout: 1, name: 'very-short-timeout' },
      { timeout: 1000, name: 'short-timeout' },
      { timeout: 30000, name: 'normal-timeout' },
      { timeout: 0, name: 'zero-timeout' },
      { timeout: -1, name: 'negative-timeout' },
    ];

    for (const timeoutTest of timeoutTests) {
      try {
        // Simulate timeout by making request to slow endpoint
        const startTime = Date.now();
        const response = await request(app)
          .get('/api/v1/services/plex/status')
          .set('Authorization', `Bearer ${this.context.authToken}`)
          .timeout(timeoutTest.timeout);

        const duration = Date.now() - startTime;
        const timedOut = duration >= timeoutTest.timeout && timeoutTest.timeout > 0;

        results.push({
          category: 'network-failures',
          testName: `timeout-${timeoutTest.name}`,
          status: timeoutTest.timeout > 0 && timedOut ? 'pass' : 'fail',
          boundary: `${timeoutTest.timeout}ms`,
          expectedBehavior: timeoutTest.timeout > 0 ? 'timeout' : 'handle-gracefully',
          actualBehavior: timedOut ? 'timeout' : 'completed',
          severity: 'medium'
        });
      } catch (error) {
        const isTimeoutError = error instanceof Error && 
          (error.message.includes('timeout') || error.message.includes('ETIMEDOUT'));

        results.push({
          category: 'network-failures',
          testName: `timeout-${timeoutTest.name}`,
          status: isTimeoutError ? 'pass' : 'unexpected',
          boundary: `${timeoutTest.timeout}ms`,
          expectedBehavior: 'timeout-error',
          actualBehavior: 'error',
          severity: 'medium'
        });
      }
    }

    return results;
  }

  async testDatabaseFailureScenarios(): Promise<EdgeCaseResult[]> {
    const results: EdgeCaseResult[] = [];

    try {
      // Test maximum connections
      const connections: PrismaClient[] = [];
      let connectionCount = 0;
      
      // Attempt to exceed connection pool
      for (let i = 0; i < 50; i++) {
        try {
          const client = new PrismaClient();
          await client.$connect();
          connections.push(client);
          connectionCount++;
        } catch (error) {
          break;
        }
      }

      // Test behavior with saturated connection pool
      try {
        const response = await request(app)
          .get('/api/v1/dashboard')
          .set('Authorization', `Bearer ${this.context.authToken}`);

        results.push({
          category: 'database-failures',
          testName: 'connection-pool-saturation',
          status: response.status < 500 ? 'pass' : 'fail',
          boundary: `${connectionCount} connections`,
          expectedBehavior: 'graceful-degradation',
          actualBehavior: response.status < 500 ? 'handled' : 'error',
          severity: 'high'
        });
      } catch (error) {
        results.push({
          category: 'database-failures',
          testName: 'connection-pool-saturation',
          status: 'fail',
          boundary: `${connectionCount} connections`,
          expectedBehavior: 'graceful-degradation',
          actualBehavior: 'error',
          severity: 'critical',
          vulnerability: 'Connection pool exhaustion causes system failure'
        });
      }

      // Cleanup connections
      await Promise.allSettled(connections.map(conn => conn.$disconnect()));

    } catch (error) {
      results.push({
        category: 'database-failures',
        testName: 'connection-pool-test',
        status: 'unexpected',
        boundary: 'unknown',
        expectedBehavior: 'test-execution',
        actualBehavior: 'setup-error',
        severity: 'high',
        vulnerability: `Database test setup failed: ${error instanceof Error ? error.message : 'Unknown'}`
      });
    }

    return results;
  }

  // =============================================================================
  // CONCURRENT ACCESS TESTING
  // =============================================================================

  async testConcurrentRequestLimits(): Promise<EdgeCaseResult[]> {
    const results: EdgeCaseResult[] = [];
    const concurrencyLevels = [1, 5, 10, 25, 50, 100, 200, 500];

    for (const concurrency of concurrencyLevels) {
      try {
        const startTime = Date.now();
        const promises = Array(concurrency).fill(null).map(() =>
          request(app)
            .get('/api/v1/health')
            .set('Authorization', `Bearer ${this.context.authToken}`)
        );

        const responses = await Promise.allSettled(promises);
        const successCount = responses.filter(r => 
          r.status === 'fulfilled' && r.value.status < 400
        ).length;
        const duration = Date.now() - startTime;

        const successRate = successCount / concurrency;
        const avgResponseTime = duration / concurrency;

        results.push({
          category: 'concurrent-access',
          testName: `concurrent-requests-${concurrency}`,
          status: successRate >= 0.95 ? 'pass' : 'fail',
          boundary: `${concurrency} concurrent requests`,
          expectedBehavior: '95% success rate',
          actualBehavior: `${(successRate * 100).toFixed(1)}% success rate`,
          severity: concurrency > 100 ? 'high' : 'medium'
        });

        // Test for rate limiting
        if (concurrency >= 100) {
          const rateLimitedCount = responses.filter(r => 
            r.status === 'fulfilled' && r.value.status === 429
          ).length;

          if (rateLimitedCount === 0 && concurrency > 200) {
            results.push({
              category: 'concurrent-access',
              testName: `rate-limiting-${concurrency}`,
              status: 'fail',
              boundary: `${concurrency} concurrent requests`,
              expectedBehavior: 'rate limiting active',
              actualBehavior: 'no rate limiting detected',
              severity: 'high',
              vulnerability: 'Rate limiting may be insufficient for DoS protection'
            });
          }
        }

      } catch (error) {
        results.push({
          category: 'concurrent-access',
          testName: `concurrent-requests-${concurrency}`,
          status: 'unexpected',
          boundary: `${concurrency} concurrent requests`,
          expectedBehavior: 'handle-gracefully',
          actualBehavior: 'error',
          severity: 'high',
          vulnerability: `Concurrency error: ${error instanceof Error ? error.message : 'Unknown'}`
        });
      }
    }

    return results;
  }

  async testRaceConditions(): Promise<EdgeCaseResult[]> {
    const results: EdgeCaseResult[] = [];

    try {
      // Test concurrent user creation
      const username = `racetest_${Date.now()}`;
      const promises = Array(10).fill(null).map(() =>
        request(app)
          .post('/api/v1/auth/register')
          .send({
            email: `${username}@test.com`,
            password: 'TestPassword123!',
            name: 'Race Test User'
          })
      );

      const responses = await Promise.allSettled(promises);
      const successCount = responses.filter(r => 
        r.status === 'fulfilled' && r.value.status < 400
      ).length;

      results.push({
        category: 'race-conditions',
        testName: 'concurrent-user-creation',
        status: successCount === 1 ? 'pass' : 'fail',
        boundary: '10 concurrent registrations',
        expectedBehavior: 'only one success',
        actualBehavior: `${successCount} successful registrations`,
        severity: successCount > 1 ? 'high' : 'low',
        vulnerability: successCount > 1 ? 'Race condition in user creation' : undefined
      });

    } catch (error) {
      results.push({
        category: 'race-conditions',
        testName: 'concurrent-user-creation',
        status: 'unexpected',
        boundary: '10 concurrent registrations',
        expectedBehavior: 'handle-gracefully',
        actualBehavior: 'error',
        severity: 'high',
        vulnerability: `Race condition test failed: ${error instanceof Error ? error.message : 'Unknown'}`
      });
    }

    return results;
  }

  // =============================================================================
  // SECURITY EDGE CASES
  // =============================================================================

  async testInjectionVulnerabilities(): Promise<EdgeCaseResult[]> {
    const results: EdgeCaseResult[] = [];
    
    const sqlInjectionPayloads = [
      "' OR '1'='1",
      "1; DROP TABLE users; --",
      "1' UNION SELECT password FROM users--",
      "admin'; DELETE FROM users WHERE role='admin'--",
      "1' AND (SELECT COUNT(*) FROM users) > 0--"
    ];

    const xssPayloads = [
      "<script>alert('xss')</script>",
      "javascript:alert('xss')",
      "<img src=x onerror=alert('xss')>",
      "<svg onload=alert('xss')>",
      "';alert('xss');//"
    ];

    // Test SQL injection in search
    for (const payload of sqlInjectionPayloads) {
      try {
        const response = await request(app)
          .get('/api/v1/media/search')
          .set('Authorization', `Bearer ${this.context.authToken}`)
          .query({ q: payload });

        const vulnerable = response.status === 200 && 
          (response.body.data?.length > 0 || 
           response.body.message?.includes('password') ||
           response.body.message?.includes('users'));

        results.push({
          category: 'security-injection',
          testName: 'sql-injection-search',
          status: vulnerable ? 'fail' : 'pass',
          boundary: 'malicious input',
          expectedBehavior: 'sanitized query',
          actualBehavior: vulnerable ? 'potential data leak' : 'secure',
          severity: vulnerable ? 'critical' : 'low',
          vulnerability: vulnerable ? 'SQL injection vulnerability detected' : undefined
        });
      } catch (error) {
        results.push({
          category: 'security-injection',
          testName: 'sql-injection-search',
          status: 'unexpected',
          boundary: 'malicious input',
          expectedBehavior: 'handle-securely',
          actualBehavior: 'error',
          severity: 'medium'
        });
      }
    }

    // Test XSS in user inputs
    for (const payload of xssPayloads) {
      try {
        const response = await request(app)
          .post('/api/v1/media/request')
          .set('Authorization', `Bearer ${this.context.authToken}`)
          .send({
            title: payload,
            mediaType: 'movie'
          });

        // Check if payload is reflected in response
        const reflected = response.body.data?.title === payload ||
                         response.body.message?.includes(payload);

        results.push({
          category: 'security-injection',
          testName: 'xss-media-request',
          status: reflected ? 'fail' : 'pass',
          boundary: 'malicious script',
          expectedBehavior: 'sanitized output',
          actualBehavior: reflected ? 'script reflected' : 'secure',
          severity: reflected ? 'high' : 'low',
          vulnerability: reflected ? 'XSS vulnerability detected' : undefined
        });
      } catch (error) {
        results.push({
          category: 'security-injection',
          testName: 'xss-media-request',
          status: 'unexpected',
          boundary: 'malicious script',
          expectedBehavior: 'handle-securely',
          actualBehavior: 'error',
          severity: 'medium'
        });
      }
    }

    return results;
  }

  async testAuthenticationEdgeCases(): Promise<EdgeCaseResult[]> {
    const results: EdgeCaseResult[] = [];

    const authTestCases = [
      { token: '', name: 'empty-token' },
      { token: 'invalid', name: 'invalid-format' },
      { token: 'Bearer invalid', name: 'malformed-bearer' },
      { token: 'a'.repeat(10000), name: 'oversized-token' },
      { token: 'null', name: 'null-string' },
      { token: 'undefined', name: 'undefined-string' },
      { token: '../../etc/passwd', name: 'path-traversal' },
      { token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c', name: 'fake-jwt' }
    ];

    for (const testCase of authTestCases) {
      try {
        const response = await request(app)
          .get('/api/v1/dashboard')
          .set('Authorization', `Bearer ${testCase.token}`);

        const properlyRejected = response.status === 401;

        results.push({
          category: 'authentication-edge-cases',
          testName: `auth-${testCase.name}`,
          status: properlyRejected ? 'pass' : 'fail',
          boundary: 'invalid authentication',
          expectedBehavior: 'reject with 401',
          actualBehavior: `status ${response.status}`,
          severity: !properlyRejected ? 'critical' : 'low',
          vulnerability: !properlyRejected ? 'Authentication bypass vulnerability' : undefined
        });
      } catch (error) {
        results.push({
          category: 'authentication-edge-cases',
          testName: `auth-${testCase.name}`,
          status: 'unexpected',
          boundary: 'invalid authentication',
          expectedBehavior: 'reject-gracefully',
          actualBehavior: 'error',
          severity: 'high'
        });
      }
    }

    return results;
  }

  // =============================================================================
  // TEST EXECUTION
  // =============================================================================

  async runAllEdgeCaseTests(): Promise<EdgeCaseResult[]> {
    const allResults: EdgeCaseResult[] = [];
    
    console.log('🔍 Starting comprehensive edge case testing...');

    try {
      console.log('🔢 Testing boundary values...');
      const boundaryResults = await Promise.all([
        this.testFileSizeBoundaries(),
        this.testStringLengthBoundaries(),
        this.testNumericBoundaries()
      ]);
      allResults.push(...boundaryResults.flat());

      console.log('❌ Testing error conditions...');
      const errorResults = await Promise.all([
        this.testNetworkFailureScenarios(),
        this.testDatabaseFailureScenarios()
      ]);
      allResults.push(...errorResults.flat());

      console.log('⚡ Testing concurrent access...');
      const concurrencyResults = await Promise.all([
        this.testConcurrentRequestLimits(),
        this.testRaceConditions()
      ]);
      allResults.push(...concurrencyResults.flat());

      console.log('🛡️ Testing security edge cases...');
      const securityResults = await Promise.all([
        this.testInjectionVulnerabilities(),
        this.testAuthenticationEdgeCases()
      ]);
      allResults.push(...securityResults.flat());

    } catch (error) {
      allResults.push({
        category: 'test-framework',
        testName: 'test-execution-error',
        status: 'unexpected',
        boundary: 'test framework',
        expectedBehavior: 'complete test execution',
        actualBehavior: 'framework error',
        severity: 'critical',
        vulnerability: `Test framework failure: ${error instanceof Error ? error.message : 'Unknown'}`
      });
    }

    this.results = allResults;
    return allResults;
  }

  generateReport(): string {
    const total = this.results.length;
    const passed = this.results.filter(r => r.status === 'pass').length;
    const failed = this.results.filter(r => r.status === 'fail').length;
    const unexpected = this.results.filter(r => r.status === 'unexpected').length;
    const vulnerabilities = this.results.filter(r => r.vulnerability).length;

    const criticalIssues = this.results.filter(r => r.severity === 'critical').length;
    const highIssues = this.results.filter(r => r.severity === 'high').length;

    return `
# MediaNest Edge Case Testing Report

## Summary
- **Total Tests**: ${total}
- **Passed**: ${passed} (${((passed/total) * 100).toFixed(1)}%)
- **Failed**: ${failed} (${((failed/total) * 100).toFixed(1)}%)
- **Unexpected**: ${unexpected} (${((unexpected/total) * 100).toFixed(1)}%)

## Security Assessment
- **Vulnerabilities Found**: ${vulnerabilities}
- **Critical Issues**: ${criticalIssues}
- **High Severity Issues**: ${highIssues}

## Category Breakdown
${this.getCategoryBreakdown()}

## Critical Findings
${this.getCriticalFindings()}

## Recommendations
${this.getRecommendations()}

## Detailed Results
${this.getDetailedResults()}
`;
  }

  private getCategoryBreakdown(): string {
    const categories = [...new Set(this.results.map(r => r.category))];
    return categories.map(category => {
      const categoryResults = this.results.filter(r => r.category === category);
      const passed = categoryResults.filter(r => r.status === 'pass').length;
      const total = categoryResults.length;
      
      return `- **${category}**: ${passed}/${total} passed (${((passed/total) * 100).toFixed(1)}%)`;
    }).join('\n');
  }

  private getCriticalFindings(): string {
    const criticalResults = this.results.filter(r => r.severity === 'critical' && r.vulnerability);
    
    if (criticalResults.length === 0) {
      return '✅ No critical vulnerabilities detected';
    }

    return criticalResults.map(result => 
      `- **${result.testName}**: ${result.vulnerability}`
    ).join('\n');
  }

  private getRecommendations(): string {
    const recommendations = [];
    
    if (this.results.some(r => r.vulnerability?.includes('SQL injection'))) {
      recommendations.push('- Implement parameterized queries for all database operations');
    }
    
    if (this.results.some(r => r.vulnerability?.includes('XSS'))) {
      recommendations.push('- Implement proper input sanitization and output encoding');
    }
    
    if (this.results.some(r => r.vulnerability?.includes('DoS'))) {
      recommendations.push('- Implement stricter rate limiting and resource constraints');
    }

    if (this.results.some(r => r.vulnerability?.includes('Authentication bypass'))) {
      recommendations.push('- Review authentication middleware for edge case handling');
    }

    if (this.results.some(r => r.category === 'concurrent-access' && r.status === 'fail')) {
      recommendations.push('- Implement proper concurrency controls and connection pooling');
    }

    return recommendations.length > 0 ? recommendations.join('\n') : '✅ No specific recommendations at this time';
  }

  private getDetailedResults(): string {
    return this.results
      .filter(r => r.status !== 'pass')
      .map(result => `
### ${result.testName}
- **Category**: ${result.category}
- **Status**: ${result.status}
- **Severity**: ${result.severity}
- **Boundary**: ${result.boundary}
- **Expected**: ${result.expectedBehavior}
- **Actual**: ${result.actualBehavior}
${result.vulnerability ? `- **Vulnerability**: ${result.vulnerability}` : ''}
`).join('\n');
  }
}