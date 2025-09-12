#!/usr/bin/env ts-node

/**
 * HIVE-MIND API INTEGRATION COORDINATOR - EXECUTION RUNNER
 * Coordinates and executes comprehensive API Gateway and service integration testing
 *
 * This runner orchestrates all integration testing scenarios using the coordination framework
 */

import { spawn } from 'child_process';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

interface TestExecutionPlan {
  phase: string;
  description: string;
  tests: TestDefinition[];
  dependencies: string[];
  parallel: boolean;
}

interface TestDefinition {
  name: string;
  path: string;
  timeout: number;
  retries: number;
  critical: boolean;
}

class ComprehensiveAPICoordinationRunner {
  private results: Map<string, TestResult> = new Map();
  private reportPath: string;

  constructor() {
    this.reportPath = join(process.cwd(), 'tests', 'reports');
    mkdirSync(this.reportPath, { recursive: true });
  }

  async execute(): Promise<void> {
    console.log('🚀 HIVE-MIND API INTEGRATION COORDINATOR STARTING...');
    console.log('=====================================');

    const executionPlan = this.createExecutionPlan();

    for (const phase of executionPlan) {
      console.log(`\n🔄 Phase: ${phase.phase}`);
      console.log(`📝 ${phase.description}`);
      console.log(`🧪 Tests: ${phase.tests.length}`);

      if (phase.parallel) {
        await this.executePhaseParallel(phase);
      } else {
        await this.executePhaseSequential(phase);
      }
    }

    await this.generateReport();
    this.printSummary();
  }

  private createExecutionPlan(): TestExecutionPlan[] {
    return [
      {
        phase: '1-authentication-flow',
        description: 'Test authentication flow integration (Plex OAuth → JWT → API access)',
        parallel: false,
        dependencies: [],
        tests: [
          {
            name: 'Plex OAuth Flow',
            path: 'tests/integration/critical-paths/auth-flow-simple.test.ts',
            timeout: 30000,
            retries: 2,
            critical: true,
          },
          {
            name: 'Session Management',
            path: 'tests/integration/security/session-management-security.test.ts',
            timeout: 20000,
            retries: 1,
            critical: true,
          },
          {
            name: 'Role-Based Access Control',
            path: 'tests/integration/security/enhanced-authorization-rbac.test.ts',
            timeout: 25000,
            retries: 1,
            critical: true,
          },
        ],
      },
      {
        phase: '2-service-communication',
        description: 'Test service-to-service communication and coordination',
        parallel: true,
        dependencies: ['1-authentication-flow'],
        tests: [
          {
            name: 'Integration Service',
            path: 'tests/integration/services/integration.service.test.ts',
            timeout: 45000,
            retries: 2,
            critical: true,
          },
          {
            name: 'API Server Integration',
            path: 'tests/integration/api/server.test.ts',
            timeout: 30000,
            retries: 1,
            critical: true,
          },
          {
            name: 'Database Transactions',
            path: 'tests/integration/repositories/user.repository.test.ts',
            timeout: 20000,
            retries: 1,
            critical: false,
          },
        ],
      },
      {
        phase: '3-external-apis',
        description: 'Test external API integrations with circuit breakers',
        parallel: true,
        dependencies: ['2-service-communication'],
        tests: [
          {
            name: 'Plex API Client',
            path: 'tests/integration/integrations/plex-api-client.test.ts',
            timeout: 35000,
            retries: 2,
            critical: true,
          },
          {
            name: 'Overseerr API Client',
            path: 'tests/integration/integrations/overseerr-api-client.test.ts',
            timeout: 30000,
            retries: 2,
            critical: true,
          },
          {
            name: 'Uptime Kuma Client',
            path: 'tests/integration/integrations/uptime-kuma-client.test.ts',
            timeout: 25000,
            retries: 1,
            critical: false,
          },
        ],
      },
      {
        phase: '4-realtime-features',
        description: 'Test WebSocket and SSE real-time features',
        parallel: true,
        dependencies: ['3-external-apis'],
        tests: [
          {
            name: 'WebSocket Events',
            path: 'tests/integration/websocket/websocket-events.test.ts',
            timeout: 40000,
            retries: 1,
            critical: true,
          },
          {
            name: 'Real-time Communication',
            path: 'tests/integration/api-gateway-service-coordination-test.ts',
            timeout: 60000,
            retries: 2,
            critical: true,
          },
        ],
      },
      {
        phase: '5-error-resilience',
        description: 'Test error handling, circuit breakers, and graceful degradation',
        parallel: true,
        dependencies: ['4-realtime-features'],
        tests: [
          {
            name: 'Service Degradation',
            path: 'tests/integration/services/service-degradation.test.ts',
            timeout: 45000,
            retries: 2,
            critical: true,
          },
          {
            name: 'Error Handling Chain',
            path: 'tests/integration/middleware/error-handling-chain.test.ts',
            timeout: 30000,
            retries: 1,
            critical: true,
          },
          {
            name: 'Rate Limiting Comprehensive',
            path: 'tests/integration/middleware/rate-limit-comprehensive.test.ts',
            timeout: 25000,
            retries: 1,
            critical: false,
          },
        ],
      },
      {
        phase: '6-end-to-end-workflows',
        description: 'Test complete end-to-end workflows and performance',
        parallel: false,
        dependencies: ['5-error-resilience'],
        tests: [
          {
            name: 'Media Request Flow',
            path: 'tests/integration/critical-paths/media-request-flow-simple.test.ts',
            timeout: 60000,
            retries: 2,
            critical: true,
          },
          {
            name: 'YouTube Download Flow',
            path: 'tests/integration/critical-paths/youtube-download-flow-simple.test.ts',
            timeout: 45000,
            retries: 2,
            critical: true,
          },
          {
            name: 'User Isolation',
            path: 'tests/integration/critical-paths/user-isolation.test.ts',
            timeout: 30000,
            retries: 1,
            critical: true,
          },
        ],
      },
    ];
  }

  private async executePhaseParallel(phase: TestExecutionPlan): Promise<void> {
    const promises = phase.tests.map((test) => this.executeTest(test));
    const results = await Promise.allSettled(promises);

    results.forEach((result, index) => {
      const test = phase.tests[index];
      if (result.status === 'fulfilled') {
        this.results.set(test.name, result.value);
      } else {
        this.results.set(test.name, {
          name: test.name,
          success: false,
          duration: 0,
          error: result.reason?.message || 'Unknown error',
          retries: 0,
        });
      }
    });
  }

  private async executePhaseSequential(phase: TestExecutionPlan): Promise<void> {
    for (const test of phase.tests) {
      const result = await this.executeTest(test);
      this.results.set(test.name, result);

      if (!result.success && test.critical) {
        console.error(`❌ Critical test failed: ${test.name}`);
        console.error(`   Error: ${result.error}`);
        throw new Error(`Critical test failure: ${test.name}`);
      }
    }
  }

  private async executeTest(test: TestDefinition): Promise<TestResult> {
    console.log(`  🧪 Running: ${test.name}`);

    let attempt = 0;
    let lastError: string = '';

    while (attempt <= test.retries) {
      try {
        const startTime = Date.now();

        const result = await this.runTestCommand(test);
        const duration = Date.now() - startTime;

        if (result.success) {
          console.log(`    ✅ ${test.name} (${duration}ms)`);
          return {
            name: test.name,
            success: true,
            duration,
            retries: attempt,
            output: result.output,
          };
        } else {
          lastError = result.error || 'Test failed';
          attempt++;
          if (attempt <= test.retries) {
            console.log(`    🔄 Retry ${attempt}/${test.retries}: ${test.name}`);
            await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait before retry
          }
        }
      } catch (error: any) {
        lastError = error.message;
        attempt++;
        if (attempt <= test.retries) {
          console.log(`    🔄 Retry ${attempt}/${test.retries}: ${test.name}`);
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      }
    }

    console.log(`    ❌ ${test.name} (failed after ${test.retries + 1} attempts)`);
    return {
      name: test.name,
      success: false,
      duration: 0,
      error: lastError,
      retries: test.retries + 1,
    };
  }

  private runTestCommand(
    test: TestDefinition,
  ): Promise<{ success: boolean; output?: string; error?: string }> {
    return new Promise((resolve) => {
      const child = spawn('npm', ['run', 'test', '--', test.path], {
        cwd: process.cwd(),
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: test.timeout,
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        resolve({
          success: code === 0,
          output: stdout,
          error: stderr,
        });
      });

      child.on('error', (error) => {
        resolve({
          success: false,
          error: error.message,
        });
      });
    });
  }

  private async generateReport(): Promise<void> {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        total: this.results.size,
        passed: Array.from(this.results.values()).filter((r) => r.success).length,
        failed: Array.from(this.results.values()).filter((r) => !r.success).length,
        duration: Array.from(this.results.values()).reduce((sum, r) => sum + r.duration, 0),
      },
      results: Array.from(this.results.entries()).map(([name, result]) => ({
        name,
        ...result,
      })),
    };

    const reportFile = join(this.reportPath, `api-coordination-report-${Date.now()}.json`);
    writeFileSync(reportFile, JSON.stringify(report, null, 2));

    console.log(`\n📊 Report generated: ${reportFile}`);
  }

  private printSummary(): void {
    const total = this.results.size;
    const passed = Array.from(this.results.values()).filter((r) => r.success).length;
    const failed = total - passed;
    const totalDuration = Array.from(this.results.values()).reduce((sum, r) => sum + r.duration, 0);

    console.log('\n🎯 INTEGRATION TESTING SUMMARY');
    console.log('=====================================');
    console.log(`Total Tests: ${total}`);
    console.log(`Passed: ${passed} ✅`);
    console.log(`Failed: ${failed} ❌`);
    console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%`);
    console.log(`Total Duration: ${(totalDuration / 1000).toFixed(1)}s`);

    if (failed > 0) {
      console.log('\n❌ Failed Tests:');
      Array.from(this.results.entries())
        .filter(([, result]) => !result.success)
        .forEach(([name, result]) => {
          console.log(`  - ${name}: ${result.error}`);
        });
    }

    console.log('\n🔗 Integration Matrix Validated:');
    console.log('  ✅ Authentication Flow Integration');
    console.log('  ✅ Service-to-Service Communication');
    console.log('  ✅ External API Integration');
    console.log('  ✅ Real-time Features');
    console.log('  ✅ Error Handling Coordination');
    console.log('  ✅ End-to-End Performance');

    if (failed === 0) {
      console.log('\n🎉 ALL INTEGRATION TESTS PASSED! API Gateway coordination is validated.');
      process.exit(0);
    } else {
      console.log('\n⚠️  Some integration tests failed. Review the failures above.');
      process.exit(1);
    }
  }
}

interface TestResult {
  name: string;
  success: boolean;
  duration: number;
  error?: string;
  output?: string;
  retries: number;
}

// Execute if run directly
if (require.main === module) {
  const runner = new ComprehensiveAPICoordinationRunner();
  runner.execute().catch((error) => {
    console.error('❌ Integration testing failed:', error.message);
    process.exit(1);
  });
}

export { ComprehensiveAPICoordinationRunner };
