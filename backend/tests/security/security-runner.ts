/**
 * Security Test Runner - Orchestrates security test execution
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

export interface TestResult {
  suite: string;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
  coverage?: number;
  securityIssues: SecurityIssue[];
}

export interface SecurityIssue {
  type: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  description: string;
  file: string;
  line?: number;
  remediation?: string;
}

export class SecurityTestRunner {
  private results: TestResult[] = [];
  private startTime: number = 0;

  private readonly testSuites = [
    {
      name: 'Authentication Security',
      pattern: 'tests/unit/auth/authentication-security.test.ts',
      critical: true,
    },
    {
      name: 'Authorization & RBAC',
      pattern: 'tests/unit/auth/authorization-rbac.test.ts',
      critical: true,
    },
    {
      name: 'Attack Prevention',
      pattern: 'tests/unit/security/attack-prevention.test.ts',
      critical: true,
    },
    {
      name: 'Session Security',
      pattern: 'tests/unit/auth/session-security.test.ts',
      critical: true,
    },
    {
      name: 'Input Validation',
      pattern: 'tests/unit/security/input-validation.test.ts',
      critical: false,
    },
    {
      name: 'Rate Limiting',
      pattern: 'tests/unit/security/rate-limiting.test.ts',
      critical: false,
    },
  ];

  async run(): Promise<void> {
    console.log('🔒 Starting Security Test Suite');
    console.log('================================\n');

    this.startTime = Date.now();

    await this.runSecurityTests();
    await this.generateSecurityReport();
    await this.validateSecurityBaseline();

    console.log('\n🎉 Security testing completed!');
  }

  private async runSecurityTests(): Promise<void> {
    console.log('🧪 Running security test suites...\n');

    for (const suite of this.testSuites) {
      console.log(`📍 Running: ${suite.name}`);

      const result = await this.runTestSuite(suite);
      this.results.push(result);

      this.displaySuiteResult(result);

      // Fail fast on critical security failures
      if (suite.critical && result.failed > 0) {
        console.error(`❌ Critical security test failures detected in ${suite.name}`);
        console.error('   Security baseline not met. Stopping execution.');
        process.exit(1);
      }

      console.log(''); // Empty line for readability
    }
  }

  private async runTestSuite(suite: {
    name: string;
    pattern: string;
    critical: boolean;
  }): Promise<TestResult> {
    const startTime = Date.now();

    try {
      const output = execSync(`npx vitest run ${suite.pattern} --reporter=json`, {
        encoding: 'utf-8',
        stdio: 'pipe',
        timeout: 300000, // 5 minutes per suite
      });

      const testOutput = JSON.parse(output);
      const duration = Date.now() - startTime;

      return {
        suite: suite.name,
        passed: testOutput.numPassedTests || 0,
        failed: testOutput.numFailedTests || 0,
        skipped: testOutput.numSkippedTests || 0,
        duration,
        securityIssues: this.analyzeSecurityIssues(testOutput, suite.name),
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;

      return {
        suite: suite.name,
        passed: 0,
        failed: 1,
        skipped: 0,
        duration,
        securityIssues: [
          {
            type: 'CRITICAL',
            description: `Test suite execution failed: ${error.message}`,
            file: suite.pattern,
            remediation: 'Check test configuration and dependencies',
          },
        ],
      };
    }
  }

  private analyzeSecurityIssues(testOutput: any, suiteName: string): SecurityIssue[] {
    // Security issue analysis logic would go here
    // This is simplified for the split file
    return [];
  }

  private displaySuiteResult(result: TestResult): void {
    const status = result.failed === 0 ? '✅' : '❌';
    const duration = (result.duration / 1000).toFixed(2);

    console.log(
      `   ${status} ${result.passed} passed, ${result.failed} failed, ${result.skipped} skipped (${duration}s)`
    );

    if (result.securityIssues.length > 0) {
      console.log(`   🚨 Security issues found: ${result.securityIssues.length}`);
      result.securityIssues.forEach((issue) => {
        console.log(`      ${issue.type}: ${issue.description}`);
      });
    }
  }

  private async generateSecurityReport(): Promise<void> {
    console.log('📊 Generating security report...');

    const totalTests = this.results.reduce((sum, r) => sum + r.passed + r.failed, 0);
    const totalPassed = this.results.reduce((sum, r) => sum + r.passed, 0);
    const totalFailed = this.results.reduce((sum, r) => sum + r.failed, 0);
    const totalDuration = Date.now() - this.startTime;

    const allIssues = this.results.flatMap((r) => r.securityIssues);
    const criticalIssues = allIssues.filter((i) => i.type === 'CRITICAL');
    const highIssues = allIssues.filter((i) => i.type === 'HIGH');

    const report = {
      summary: {
        timestamp: new Date().toISOString(),
        totalTests,
        totalPassed,
        totalFailed,
        duration: totalDuration,
        successRate: ((totalPassed / totalTests) * 100).toFixed(2),
      },
      securityBaseline: {
        criticalIssues: criticalIssues.length,
        highIssues: highIssues.length,
        overallRisk: this.calculateRiskLevel(allIssues),
      },
      suiteResults: this.results,
    };

    // Save detailed report
    const reportPath = path.join(__dirname, '../security-test-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    // Display summary
    console.log('\n📋 Security Test Summary');
    console.log('========================');
    console.log(`Total Tests: ${totalTests}`);
    console.log(`Passed: ${totalPassed}`);
    console.log(`Failed: ${totalFailed}`);
    console.log(`Success Rate: ${report.summary.successRate}%`);
    console.log(`Duration: ${(totalDuration / 1000).toFixed(2)}s`);
    console.log(`Overall Risk: ${report.securityBaseline.overallRisk}`);

    if (criticalIssues.length > 0) {
      console.log(`\n🚨 CRITICAL ISSUES: ${criticalIssues.length}`);
      criticalIssues.forEach((issue) => {
        console.log(`   - ${issue.description} (${issue.file})`);
      });
    }

    console.log(`\n📄 Detailed report saved to: ${reportPath}`);
  }

  private calculateRiskLevel(issues: SecurityIssue[]): string {
    const critical = issues.filter((i) => i.type === 'CRITICAL').length;
    const high = issues.filter((i) => i.type === 'HIGH').length;
    const medium = issues.filter((i) => i.type === 'MEDIUM').length;

    if (critical > 0) return 'CRITICAL';
    if (high > 2) return 'HIGH';
    if (high > 0 || medium > 5) return 'MEDIUM';
    if (medium > 0) return 'LOW';
    return 'MINIMAL';
  }

  private async validateSecurityBaseline(): Promise<void> {
    console.log('\n🔍 Validating security baseline...');

    const criticalIssues = this.results
      .flatMap((r) => r.securityIssues)
      .filter((i) => i.type === 'CRITICAL');

    // Security baseline requirements
    const baselineRequirements = [
      { name: 'No critical security issues', passed: criticalIssues.length === 0 },
      { name: 'All critical tests pass', passed: this.getCriticalTestsStatus() },
      { name: 'Overall test success rate > 95%', passed: this.getSuccessRate() > 95 },
    ];

    console.log('Security Baseline Validation:');
    baselineRequirements.forEach((req) => {
      const status = req.passed ? '✅' : '❌';
      console.log(`   ${status} ${req.name}`);
    });

    const baselinePassed = baselineRequirements.every((req) => req.passed);

    if (baselinePassed) {
      console.log('\n🎉 Security baseline validation PASSED');
    } else {
      console.log('\n❌ Security baseline validation FAILED');
      console.log('   Application does not meet minimum security requirements');
      process.exit(1);
    }
  }

  private getCriticalTestsStatus(): boolean {
    const criticalSuites = this.testSuites.filter((s) => s.critical);
    const criticalResults = this.results.filter((r) =>
      criticalSuites.some((s) => s.name === r.suite)
    );

    return criticalResults.every((r) => r.failed === 0);
  }

  private getSuccessRate(): number {
    const totalTests = this.results.reduce((sum, r) => sum + r.passed + r.failed, 0);
    const totalPassed = this.results.reduce((sum, r) => sum + r.passed, 0);
    return totalTests > 0 ? (totalPassed / totalTests) * 100 : 0;
  }
}

// Run security tests if called directly
if (require.main === module) {
  const runner = new SecurityTestRunner();
  runner.run().catch((error) => {
    console.error('❌ Security test runner failed:', error);
    process.exit(1);
  });
}

export { SecurityTestRunner };
