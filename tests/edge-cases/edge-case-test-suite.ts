/**
 * MediaNest Edge Case Test Suite
 * Comprehensive test runner for edge cases and boundary conditions
 */

import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'vitest';

import { EdgeCaseTestRunner } from './edge-case-testing-framework';
import { createTestUser, generateAuthToken, cleanupTestData } from '../utils/test-helpers';

describe('MediaNest Edge Case Testing', () => {
  let prisma: PrismaClient;
  let redis: Redis;
  let testRunner: EdgeCaseTestRunner;
  let authToken: string;
  let userId: string;

  beforeAll(async () => {
    // Initialize test infrastructure
    prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL,
        },
      },
    });

    redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD || undefined,
      db: 1, // Use separate DB for tests
    });

    // Create test user
    const testUser = await createTestUser(prisma);
    userId = testUser.id;
    authToken = generateAuthToken(testUser);

    // Initialize test runner
    testRunner = new EdgeCaseTestRunner({
      prisma,
      redis,
      authToken,
      userId,
    });

    console.log('🧪 Edge case test environment initialized');
  });

  afterAll(async () => {
    // Cleanup
    await cleanupTestData(prisma, userId);
    await prisma.$disconnect();
    await redis.disconnect();
    console.log('🧹 Edge case test cleanup completed');
  });

  beforeEach(async () => {
    // Clear Redis test data
    await redis.flushdb();
  });

  describe('🔢 Boundary Value Testing', () => {
    test('File size boundaries', async () => {
      const results = await testRunner.testFileSizeBoundaries();

      // Log results for analysis
      console.log(`File size boundary tests: ${results.length} tests executed`);

      const criticalFailures = results.filter(
        (r) => r.severity === 'critical' && r.status !== 'pass',
      );

      expect(criticalFailures).toHaveLength(0);

      const vulnerabilities = results.filter((r) => r.vulnerability);
      if (vulnerabilities.length > 0) {
        console.warn(
          '⚠️ File size vulnerabilities detected:',
          vulnerabilities.map((v) => v.vulnerability),
        );
      }
    }, 30000);

    test('String length boundaries', async () => {
      const results = await testRunner.testStringLengthBoundaries();

      console.log(`String length boundary tests: ${results.length} tests executed`);

      const unexpectedErrors = results.filter((r) => r.status === 'unexpected');
      expect(unexpectedErrors).toHaveLength(0);

      // Check for proper handling of extreme lengths
      const extremeLengthTests = results.filter(
        (r) => r.testName.includes('very-long') || r.testName.includes('over-text-limit'),
      );

      extremeLengthTests.forEach((test) => {
        expect(test.actualBehavior).toBe('reject');
      });
    }, 20000);

    test('Numeric boundaries', async () => {
      const results = await testRunner.testNumericBoundaries();

      console.log(`Numeric boundary tests: ${results.length} tests executed`);

      // Special values should be handled gracefully
      const specialValueTests = results.filter((r) =>
        ['infinity', 'not-a-number', 'unsafe-integer'].includes(r.testName.split('-').pop() || ''),
      );

      specialValueTests.forEach((test) => {
        expect(test.status).not.toBe('unexpected');
        expect(test.actualBehavior).toBe('reject');
      });
    }, 15000);
  });

  describe('❌ Error Condition Testing', () => {
    test('Network failure scenarios', async () => {
      const results = await testRunner.testNetworkFailureScenarios();

      console.log(`Network failure tests: ${results.length} tests executed`);

      // Timeout handling should be consistent
      const timeoutTests = results.filter((r) => r.testName.includes('timeout'));
      const failedTimeouts = timeoutTests.filter((r) => r.status === 'fail');

      // Allow some tolerance for timing variability
      expect(failedTimeouts.length).toBeLessThanOrEqual(timeoutTests.length * 0.2);
    }, 45000);

    test('Database connection limits', async () => {
      const results = await testRunner.testDatabaseFailureScenarios();

      console.log(`Database failure tests: ${results.length} tests executed`);

      const connectionPoolTests = results.filter((r) => r.testName.includes('connection-pool'));

      connectionPoolTests.forEach((test) => {
        // System should handle connection exhaustion gracefully
        expect(test.actualBehavior).not.toBe('error');
        if (test.severity === 'critical') {
          console.error('🚨 Critical database vulnerability:', test.vulnerability);
        }
      });
    }, 60000);
  });

  describe('⚡ Concurrent Access Testing', () => {
    test('Concurrent request handling', async () => {
      const results = await testRunner.testConcurrentRequestLimits();

      console.log(`Concurrent access tests: ${results.length} tests executed`);

      // High concurrency tests should have reasonable success rates
      const highConcurrencyTests = results.filter((r) => {
        const concurrency = parseInt(r.boundary.split(' ')[0]);
        return concurrency >= 50;
      });

      highConcurrencyTests.forEach((test) => {
        const successRate = parseFloat(test.actualBehavior.split('%')[0]);
        expect(successRate).toBeGreaterThan(70); // At least 70% success under load
      });
    }, 120000);

    test('Race condition detection', async () => {
      const results = await testRunner.testRaceConditions();

      console.log(`Race condition tests: ${results.length} tests executed`);

      // Race conditions should be prevented
      const raceConditionVulns = results.filter((r) => r.vulnerability?.includes('Race condition'));

      expect(raceConditionVulns).toHaveLength(0);
    }, 30000);
  });

  describe('🛡️ Security Edge Cases', () => {
    test('Injection vulnerability testing', async () => {
      const results = await testRunner.testInjectionVulnerabilities();

      console.log(`Injection tests: ${results.length} tests executed`);

      // No injection vulnerabilities should be present
      const injectionVulns = results.filter(
        (r) => r.vulnerability?.includes('injection') || r.vulnerability?.includes('XSS'),
      );

      if (injectionVulns.length > 0) {
        console.error('🚨 SECURITY CRITICAL: Injection vulnerabilities detected!');
        injectionVulns.forEach((vuln) => {
          console.error(`  - ${vuln.testName}: ${vuln.vulnerability}`);
        });
      }

      expect(injectionVulns).toHaveLength(0);
    }, 30000);

    test('Authentication edge cases', async () => {
      const results = await testRunner.testAuthenticationEdgeCases();

      console.log(`Authentication tests: ${results.length} tests executed`);

      // Authentication bypasses are critical
      const authBypass = results.filter((r) => r.vulnerability?.includes('Authentication bypass'));

      expect(authBypass).toHaveLength(0);

      // All invalid tokens should be rejected
      const authTests = results.filter((r) => r.expectedBehavior === 'reject with 401');

      authTests.forEach((test) => {
        expect(test.status).toBe('pass');
      });
    }, 20000);
  });

  describe('📊 Comprehensive Edge Case Analysis', () => {
    test('Generate complete edge case report', async () => {
      console.log('🔍 Running comprehensive edge case analysis...');

      const allResults = await testRunner.runAllEdgeCaseTests();
      const report = testRunner.generateReport();

      // Log summary statistics
      const total = allResults.length;
      const passed = allResults.filter((r) => r.status === 'pass').length;
      const failed = allResults.filter((r) => r.status === 'fail').length;
      const unexpected = allResults.filter((r) => r.status === 'unexpected').length;
      const vulnerabilities = allResults.filter((r) => r.vulnerability).length;
      const critical = allResults.filter(
        (r) => r.severity === 'critical' && r.status !== 'pass',
      ).length;

      console.log(`\n📈 EDGE CASE TESTING SUMMARY:`);
      console.log(`   Total Tests: ${total}`);
      console.log(`   Passed: ${passed} (${((passed / total) * 100).toFixed(1)}%)`);
      console.log(`   Failed: ${failed} (${((failed / total) * 100).toFixed(1)}%)`);
      console.log(`   Unexpected: ${unexpected} (${((unexpected / total) * 100).toFixed(1)}%)`);
      console.log(`   Vulnerabilities: ${vulnerabilities}`);
      console.log(`   Critical Issues: ${critical}`);

      // Save report to memory for production validation
      await testRunner.context.redis.setex(
        'MEDIANEST_PROD_VALIDATION:edge_case_testing',
        3600, // 1 hour TTL
        JSON.stringify({
          timestamp: new Date().toISOString(),
          summary: {
            total,
            passed,
            failed,
            unexpected,
            vulnerabilities,
            critical,
          },
          report,
          results: allResults.slice(0, 50), // Store first 50 detailed results
        }),
      );

      // Write report to file system
      await import('fs/promises').then((fs) =>
        fs.writeFile(
          '/home/kinginyellow/projects/medianest/tests/edge-cases/edge-case-testing-report.md',
          report,
          'utf-8',
        ),
      );

      console.log('📋 Edge case report generated and stored');

      // Assert critical quality gates
      expect(critical).toBe(0); // No critical issues allowed
      expect(vulnerabilities).toBeLessThanOrEqual(2); // Max 2 low-severity vulnerabilities
      expect(passed / total).toBeGreaterThan(0.8); // At least 80% success rate
      expect(unexpected).toBeLessThanOrEqual(total * 0.05); // Max 5% unexpected errors
    }, 300000); // 5 minutes timeout for comprehensive testing
  });
});

// Additional specialized edge case tests
describe('🎯 Specialized Edge Cases', () => {
  test('Memory exhaustion boundaries', async () => {
    // Test memory usage under extreme conditions
    const largeArrays = [];
    let memoryExhausted = false;

    try {
      for (let i = 0; i < 100; i++) {
        const largeArray = new Array(1000000).fill('memory-test-data');
        largeArrays.push(largeArray);

        const memUsage = process.memoryUsage();
        if (memUsage.heapUsed > 500 * 1024 * 1024) {
          // 500MB threshold
          memoryExhausted = true;
          break;
        }
      }
    } catch (error) {
      memoryExhausted = true;
    }

    // Cleanup
    largeArrays.length = 0;
    if (global.gc) global.gc();

    expect(memoryExhausted).toBe(true); // Should hit memory limits
  });

  test('CPU intensive operation limits', async () => {
    const startTime = Date.now();
    let iterations = 0;

    // Simulate CPU-intensive task
    while (Date.now() - startTime < 1000) {
      // Run for 1 second
      for (let i = 0; i < 10000; i++) {
        Math.random() * Math.random();
      }
      iterations++;
    }

    console.log(`CPU test completed ${iterations} iterations in 1 second`);
    expect(iterations).toBeGreaterThan(0);
  });

  test('File system limits', async () => {
    const fs = await import('fs/promises');
    const path = await import('path');

    const testDir = '/tmp/medianest-edge-test';
    const maxFiles = 1000;
    const createdFiles: string[] = [];

    try {
      await fs.mkdir(testDir, { recursive: true });

      // Attempt to create many small files
      for (let i = 0; i < maxFiles; i++) {
        const filePath = path.join(testDir, `test-file-${i}.txt`);
        await fs.writeFile(filePath, `Test content ${i}`);
        createdFiles.push(filePath);
      }

      expect(createdFiles).toHaveLength(maxFiles);
    } finally {
      // Cleanup
      await Promise.allSettled(createdFiles.map((file) => fs.unlink(file)));
      await fs.rmdir(testDir).catch(() => {}); // Ignore cleanup errors
    }
  });
});
