#!/usr/bin/env tsx

/**
 * Comprehensive Security Test Runner
 * 
 * This script orchestrates the execution of all security tests with proper
 * reporting, metrics collection, and validation.
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

interface TestResult {
  suite: string;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
  coverage?: number;
  securityIssues: SecurityIssue[];
}

interface SecurityIssue {
  type: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  description: string;
  file: string;
  line?: number;
  remediation?: string;
}

class SecurityTestRunner {
  private results: TestResult[] = [];
  private startTime: number = 0;

  private readonly testSuites = [
    {
      name: 'Authentication Security',
      pattern: 'tests/integration/security/enhanced-authentication-security.test.ts',
      critical: true,
    },
    {
      name: 'Authorization & RBAC',
      pattern: 'tests/integration/security/enhanced-authorization-rbac.test.ts',
      critical: true,
    },
    {
      name: 'Attack Prevention',
      pattern: 'tests/integration/security/advanced-attack-prevention.test.ts',
      critical: true,
    },
    {
      name: 'OAuth Security',
      pattern: 'tests/integration/security/oauth-security-comprehensive.test.ts',
      critical: false,
    },
    {
      name: 'API Security',
      pattern: 'tests/integration/security/comprehensive-api-security.test.ts',
      critical: true,
    },
    {
      name: 'Session Management',
      pattern: 'tests/integration/security/session-management-security.test.ts',
      critical: true,
    },
    {
      name: 'Database Security',
      pattern: 'tests/integration/security/database-security-validation.test.ts',
      critical: true,
    },
    {
      name: 'Middleware Security',
      pattern: 'tests/unit/middleware/security-middleware.test.ts',
      critical: false,
    },
    {
      name: 'Rate Limiting',
      pattern: 'tests/integration/security/rate-limiting-bypass.test.ts',
      critical: false,
    },
    {
      name: 'Authentication Bypass',
      pattern: 'tests/integration/security/authentication-bypass.test.ts',
      critical: true,
    },
  ];

  async run(): Promise<void> {
    console.log('🔒 Starting Comprehensive Security Test Suite');
    console.log('============================================\n');

    this.startTime = Date.now();

    await this.setupTestEnvironment();
    await this.runSecurityTests();
    await this.generateSecurityReport();
    await this.validateSecurityBaseline();
    await this.cleanup();

    console.log('\n🎉 Security testing completed!');
  }

  private async setupTestEnvironment(): Promise<void> {
    console.log('📋 Setting up test environment...');
    
    try {
      // Ensure test database is clean
      execSync('npm run db:reset:test', { stdio: 'pipe' });
      
      // Start test services
      execSync('npm run test:services:start', { stdio: 'pipe' });
      
      // Wait for services to be ready
      await this.waitForServices();
      
      console.log('✅ Test environment ready\n');
    } catch (error) {
      console.error('❌ Failed to setup test environment:', error);
      process.exit(1);
    }
  }

  private async waitForServices(): Promise<void> {
    const maxRetries = 30;
    let retries = 0;

    while (retries < maxRetries) {
      try {
        execSync('curl -f http://localhost:3001/api/health', { stdio: 'pipe' });
        return;
      } catch {
        await new Promise(resolve => setTimeout(resolve, 1000));
        retries++;
      }
    }

    throw new Error('Test services failed to start within timeout');
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

  private async runTestSuite(suite: { name: string; pattern: string; critical: boolean }): Promise<TestResult> {
    const startTime = Date.now();

    try {
      const output = execSync(
        `npx vitest run ${suite.pattern} --reporter=json --coverage`,
        { 
          encoding: 'utf-8',
          stdio: 'pipe',
          timeout: 300000, // 5 minutes per suite
        }
      );

      const testOutput = JSON.parse(output);
      const duration = Date.now() - startTime;

      return {
        suite: suite.name,
        passed: testOutput.numPassedTests || 0,
        failed: testOutput.numFailedTests || 0,
        skipped: testOutput.numSkippedTests || 0,
        duration,
        coverage: this.extractCoverage(output),
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
        securityIssues: [{
          type: 'CRITICAL',
          description: `Test suite execution failed: ${error.message}`,
          file: suite.pattern,
          remediation: 'Check test configuration and dependencies',
        }],
      };
    }
  }

  private extractCoverage(output: string): number {
    try {
      const coverageMatch = output.match(/Statements\s+:\s+(\d+\.?\d*)%/);
      return coverageMatch ? parseFloat(coverageMatch[1]) : 0;
    } catch {
      return 0;
    }
  }

  private analyzeSecurityIssues(testOutput: any, suiteName: string): SecurityIssue[] {
    const issues: SecurityIssue[] = [];

    // Analyze failed tests for security implications
    if (testOutput.testResults) {
      testOutput.testResults.forEach((result: any) => {
        result.assertionResults?.forEach((assertion: any) => {
          if (assertion.status === 'failed') {
            const issue = this.categorizeSecurityIssue(assertion, suiteName);
            if (issue) {
              issues.push(issue);
            }
          }
        });
      });
    }

    return issues;
  }

  private categorizeSecurityIssue(assertion: any, suiteName: string): SecurityIssue | null {
    const title = assertion.title || '';
    const message = assertion.failureMessages?.[0] || '';

    // Critical security issues
    if (title.includes('SQL injection') || message.includes('DROP TABLE')) {
      return {
        type: 'CRITICAL',
        description: 'SQL injection vulnerability detected',
        file: assertion.ancestorTitles?.[0] || suiteName,
        remediation: 'Use parameterized queries and input validation',
      };
    }

    if (title.includes('authentication') && title.includes('bypass')) {
      return {
        type: 'CRITICAL',
        description: 'Authentication bypass vulnerability',
        file: assertion.ancestorTitles?.[0] || suiteName,
        remediation: 'Review authentication middleware and token validation',
      };
    }

    if (title.includes('XSS') || title.includes('script')) {
      return {
        type: 'HIGH',
        description: 'Cross-site scripting (XSS) vulnerability',
        file: assertion.ancestorTitles?.[0] || suiteName,
        remediation: 'Implement proper input sanitization and output encoding',
      };
    }

    if (title.includes('CSRF') || title.includes('cross-site request')) {
      return {
        type: 'HIGH',
        description: 'Cross-site request forgery (CSRF) vulnerability',
        file: assertion.ancestorTitles?.[0] || suiteName,
        remediation: 'Implement CSRF tokens and same-origin validation',
      };
    }

    if (title.includes('rate limit') || title.includes('brute force')) {
      return {
        type: 'MEDIUM',
        description: 'Rate limiting bypass or brute force vulnerability',
        file: assertion.ancestorTitles?.[0] || suiteName,
        remediation: 'Implement proper rate limiting and account lockout',
      };
    }

    if (title.includes('session') && (title.includes('hijack') || title.includes('fixation'))) {
      return {
        type: 'HIGH',
        description: 'Session security vulnerability',
        file: assertion.ancestorTitles?.[0] || suiteName,
        remediation: 'Review session management and implement proper token rotation',
      };
    }

    // Generic security issue
    return {
      type: 'MEDIUM',
      description: `Security test failure: ${title}`,
      file: assertion.ancestorTitles?.[0] || suiteName,
      remediation: 'Review test failure details and implement appropriate fixes',
    };
  }

  private displaySuiteResult(result: TestResult): void {
    const status = result.failed === 0 ? '✅' : '❌';
    const duration = (result.duration / 1000).toFixed(2);
    
    console.log(`   ${status} ${result.passed} passed, ${result.failed} failed, ${result.skipped} skipped (${duration}s)`);
    
    if (result.coverage) {
      console.log(`   📊 Coverage: ${result.coverage.toFixed(1)}%`);
    }

    if (result.securityIssues.length > 0) {
      console.log(`   🚨 Security issues found: ${result.securityIssues.length}`);
      result.securityIssues.forEach(issue => {
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

    const allIssues = this.results.flatMap(r => r.securityIssues);
    const criticalIssues = allIssues.filter(i => i.type === 'CRITICAL');
    const highIssues = allIssues.filter(i => i.type === 'HIGH');
    
    const report = {
      summary: {
        timestamp: new Date().toISOString(),
        totalTests,
        totalPassed,
        totalFailed,
        duration: totalDuration,
        successRate: (totalPassed / totalTests * 100).toFixed(2),
      },
      securityBaseline: {
        criticalIssues: criticalIssues.length,
        highIssues: highIssues.length,
        overallRisk: this.calculateRiskLevel(allIssues),
      },
      suiteResults: this.results,
      recommendations: this.generateRecommendations(allIssues),
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
      criticalIssues.forEach(issue => {
        console.log(`   - ${issue.description} (${issue.file})`);
      });
    }

    if (highIssues.length > 0) {
      console.log(`\n⚠️  HIGH PRIORITY ISSUES: ${highIssues.length}`);
      highIssues.forEach(issue => {
        console.log(`   - ${issue.description} (${issue.file})`);
      });
    }

    console.log(`\n📄 Detailed report saved to: ${reportPath}`);
  }

  private calculateRiskLevel(issues: SecurityIssue[]): string {
    const critical = issues.filter(i => i.type === 'CRITICAL').length;
    const high = issues.filter(i => i.type === 'HIGH').length;
    const medium = issues.filter(i => i.type === 'MEDIUM').length;

    if (critical > 0) return 'CRITICAL';
    if (high > 2) return 'HIGH';
    if (high > 0 || medium > 5) return 'MEDIUM';
    if (medium > 0) return 'LOW';
    return 'MINIMAL';
  }

  private generateRecommendations(issues: SecurityIssue[]): string[] {
    const recommendations = new Set<string>();

    issues.forEach(issue => {
      if (issue.remediation) {
        recommendations.add(issue.remediation);
      }
    });

    // Add general recommendations
    recommendations.add('Implement comprehensive input validation and sanitization');
    recommendations.add('Use parameterized queries for all database operations');
    recommendations.add('Implement proper session management with secure tokens');
    recommendations.add('Set up comprehensive security monitoring and alerting');
    recommendations.add('Regular security code reviews and penetration testing');
    recommendations.add('Keep all dependencies updated and scan for vulnerabilities');

    return Array.from(recommendations);
  }

  private async validateSecurityBaseline(): Promise<void> {
    console.log('\n🔍 Validating security baseline...');

    const criticalIssues = this.results.flatMap(r => r.securityIssues).filter(i => i.type === 'CRITICAL');
    const totalFailed = this.results.reduce((sum, r) => sum + r.failed, 0);

    // Security baseline requirements
    const baselineRequirements = [
      { name: 'No critical security issues', passed: criticalIssues.length === 0 },
      { name: 'Authentication tests pass', passed: this.getSuiteResult('Authentication Security').failed === 0 },
      { name: 'Authorization tests pass', passed: this.getSuiteResult('Authorization & RBAC').failed === 0 },
      { name: 'Attack prevention tests pass', passed: this.getSuiteResult('Attack Prevention').failed === 0 },
      { name: 'Overall test success rate > 95%', passed: (this.getSuccessRate()) > 95 },
    ];

    console.log('Security Baseline Validation:');
    baselineRequirements.forEach(req => {
      const status = req.passed ? '✅' : '❌';
      console.log(`   ${status} ${req.name}`);
    });

    const baselinePassed = baselineRequirements.every(req => req.passed);
    
    if (baselinePassed) {
      console.log('\n🎉 Security baseline validation PASSED');
    } else {
      console.log('\n❌ Security baseline validation FAILED');
      console.log('   Application does not meet minimum security requirements');
      process.exit(1);
    }
  }

  private getSuiteResult(suiteName: string): TestResult {
    return this.results.find(r => r.suite === suiteName) || { 
      suite: suiteName, passed: 0, failed: 1, skipped: 0, duration: 0, securityIssues: [] 
    };
  }

  private getSuccessRate(): number {
    const totalTests = this.results.reduce((sum, r) => sum + r.passed + r.failed, 0);
    const totalPassed = this.results.reduce((sum, r) => sum + r.passed, 0);
    return totalTests > 0 ? (totalPassed / totalTests * 100) : 0;
  }

  private async cleanup(): Promise<void> {
    try {
      console.log('\n🧹 Cleaning up test environment...');
      execSync('npm run test:services:stop', { stdio: 'pipe' });
      execSync('npm run db:reset:test', { stdio: 'pipe' });
      console.log('✅ Cleanup completed');
    } catch (error) {
      console.warn('⚠️  Cleanup warning:', error);
    }
  }
}

// Run security tests if called directly
if (require.main === module) {
  const runner = new SecurityTestRunner();
  runner.run().catch(error => {
    console.error('❌ Security test runner failed:', error);
    process.exit(1);
  });
}

export { SecurityTestRunner };