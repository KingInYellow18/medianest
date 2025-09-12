/**
 * QA VALIDATION RUNNER
 *
 * Comprehensive quality gate enforcement system for MediaNest
 * Runs all validation tests and generates quality reports
 */

import { execSync } from 'child_process';
import { writeFileSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';

interface QualityGate {
  name: string;
  command: string;
  threshold?: number;
  critical: boolean;
  timeout?: number;
}

interface TestResult {
  gate: string;
  passed: boolean;
  score?: number;
  threshold?: number;
  output: string;
  duration: number;
  error?: string;
}

interface QualityReport {
  timestamp: string;
  overallStatus: 'PASSED' | 'FAILED' | 'WARNING';
  totalGates: number;
  passedGates: number;
  failedGates: number;
  criticalFailures: number;
  results: TestResult[];
  recommendations: string[];
  coverageMetrics: {
    statements: number;
    branches: number;
    functions: number;
    lines: number;
  };
  buildInfo: {
    version: string;
    environment: string;
    timestamp: string;
  };
}

class QAValidationRunner {
  private qualityGates: QualityGate[] = [
    // Core Test Coverage Gates
    {
      name: 'Unit Test Coverage',
      command: 'npm run test:coverage -- --reporter=json',
      threshold: 70,
      critical: true,
      timeout: 300000, // 5 minutes
    },
    {
      name: 'Integration Test Suite',
      command: 'npm run test:integration -- --reporter=json',
      critical: true,
      timeout: 600000, // 10 minutes
    },
    {
      name: 'Security Validation',
      command: 'npm run test:security -- --reporter=json',
      critical: true,
      timeout: 300000, // 5 minutes
    },
    {
      name: 'Performance Testing',
      command: 'npm run test:performance -- --reporter=json',
      threshold: 95, // 95% requests should meet performance targets
      critical: false,
      timeout: 900000, // 15 minutes
    },
    {
      name: 'API Endpoint Validation',
      command: 'npx vitest run tests/unit/controllers-validation.test.ts --reporter=json',
      critical: true,
      timeout: 180000, // 3 minutes
    },
    {
      name: 'Security Penetration Testing',
      command: 'npx vitest run tests/security/security-penetration.test.ts --reporter=json',
      critical: true,
      timeout: 600000, // 10 minutes
    },
    {
      name: 'Load Testing Validation',
      command: 'npx vitest run tests/performance/load-testing-enhanced.test.ts --reporter=json',
      critical: false,
      timeout: 1200000, // 20 minutes
    },
    {
      name: 'API Integration Comprehensive',
      command:
        'npx vitest run tests/integration/api-endpoints-comprehensive.test.ts --reporter=json',
      critical: true,
      timeout: 900000, // 15 minutes
    },
    // Build System Gates
    {
      name: 'TypeScript Compilation',
      command: 'npm run type-check',
      critical: true,
      timeout: 120000, // 2 minutes
    },
    {
      name: 'Linting Validation',
      command: 'npm run lint',
      critical: false,
      timeout: 60000, // 1 minute
    },
    {
      name: 'Build System Validation',
      command: 'npm run build',
      critical: true,
      timeout: 300000, // 5 minutes
    },
    // Security Gates
    {
      name: 'Security Audit',
      command: 'npm audit --audit-level=high --json',
      critical: true,
      timeout: 120000, // 2 minutes
    },
    {
      name: 'Dependency Vulnerability Check',
      command: 'npm audit --audit-level=moderate --json',
      critical: false,
      timeout: 60000, // 1 minute
    },
  ];

  async runValidation(): Promise<QualityReport> {
    console.log('🚀 Starting QA Validation Runner...');
    console.log(`Running ${this.qualityGates.length} quality gates...`);

    const results: TestResult[] = [];
    let passedGates = 0;
    let failedGates = 0;
    let criticalFailures = 0;

    for (const gate of this.qualityGates) {
      console.log(`\n🔍 Running: ${gate.name}`);
      const result = await this.runGate(gate);
      results.push(result);

      if (result.passed) {
        passedGates++;
        console.log(`✅ ${gate.name}: PASSED`);
        if (result.score !== undefined) {
          console.log(`   Score: ${result.score}${result.threshold ? `/${result.threshold}` : ''}`);
        }
      } else {
        failedGates++;
        if (gate.critical) {
          criticalFailures++;
          console.log(`❌ ${gate.name}: CRITICAL FAILURE`);
        } else {
          console.log(`⚠️ ${gate.name}: FAILED (non-critical)`);
        }
        if (result.error) {
          console.log(`   Error: ${result.error}`);
        }
      }
    }

    // Generate coverage metrics
    const coverageMetrics = await this.extractCoverageMetrics();

    // Generate quality report
    const report: QualityReport = {
      timestamp: new Date().toISOString(),
      overallStatus: criticalFailures > 0 ? 'FAILED' : failedGates > 0 ? 'WARNING' : 'PASSED',
      totalGates: this.qualityGates.length,
      passedGates,
      failedGates,
      criticalFailures,
      results,
      recommendations: this.generateRecommendations(results),
      coverageMetrics,
      buildInfo: {
        version: this.getBuildVersion(),
        environment: process.env.NODE_ENV || 'development',
        timestamp: new Date().toISOString(),
      },
    };

    // Save report
    await this.saveReport(report);

    // Print summary
    this.printSummary(report);

    return report;
  }

  private async runGate(gate: QualityGate): Promise<TestResult> {
    const startTime = Date.now();

    try {
      const output = execSync(gate.command, {
        encoding: 'utf8',
        timeout: gate.timeout || 300000, // Default 5 minutes
        env: { ...process.env, NODE_ENV: 'test' },
      });

      const duration = Date.now() - startTime;

      // Parse output based on gate type
      const { passed, score } = this.parseGateOutput(gate, output);

      return {
        gate: gate.name,
        passed,
        score,
        threshold: gate.threshold,
        output,
        duration,
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;

      return {
        gate: gate.name,
        passed: false,
        output: error.stdout || '',
        duration,
        error: error.message,
      };
    }
  }

  private parseGateOutput(gate: QualityGate, output: string): { passed: boolean; score?: number } {
    try {
      // Try to parse as JSON for test reporters
      const jsonOutput = JSON.parse(output);

      // Handle Vitest JSON reporter format
      if (jsonOutput.testResults || jsonOutput.numTotalTests) {
        const totalTests = jsonOutput.numTotalTests || jsonOutput.testResults?.length || 0;
        const passedTests =
          jsonOutput.numPassedTests ||
          jsonOutput.testResults?.filter((t: any) => t.status === 'passed').length ||
          0;

        const successRate = totalTests > 0 ? (passedTests / totalTests) * 100 : 0;
        const passed = gate.threshold ? successRate >= gate.threshold : passedTests === totalTests;

        return { passed, score: successRate };
      }

      // Handle npm audit JSON format
      if (jsonOutput.vulnerabilities) {
        const highVulns = jsonOutput.metadata?.vulnerabilities?.high || 0;
        const criticalVulns = jsonOutput.metadata?.vulnerabilities?.critical || 0;

        const passed = gate.name.includes('high')
          ? highVulns === 0 && criticalVulns === 0
          : criticalVulns === 0;

        return { passed, score: Math.max(0, 100 - highVulns - criticalVulns * 2) };
      }

      // Handle coverage JSON format
      if (jsonOutput.total) {
        const coverage = jsonOutput.total;
        const avgCoverage =
          (coverage.statements.pct +
            coverage.branches.pct +
            coverage.functions.pct +
            coverage.lines.pct) /
          4;

        const passed = gate.threshold ? avgCoverage >= gate.threshold : avgCoverage > 80;
        return { passed, score: avgCoverage };
      }
    } catch (e) {
      // If not JSON, parse text output
      if (output.includes('PASS') || output.includes('✓') || output.includes('success')) {
        // Look for test results
        const passedMatch = output.match(/(\d+) passing/);
        const failedMatch = output.match(/(\d+) failing/);

        if (passedMatch) {
          const passed = failedMatch ? parseInt(failedMatch[1]) === 0 : true;
          const total = parseInt(passedMatch[1]) + (failedMatch ? parseInt(failedMatch[1]) : 0);
          const score = total > 0 ? (parseInt(passedMatch[1]) / total) * 100 : 100;

          return { passed, score };
        }

        return { passed: true };
      }
    }

    // Default: assume failure if we can't parse
    return { passed: false };
  }

  private async extractCoverageMetrics(): Promise<QualityReport['coverageMetrics']> {
    const coveragePath = join(process.cwd(), 'coverage', 'coverage-summary.json');

    if (existsSync(coveragePath)) {
      try {
        const coverageData = JSON.parse(readFileSync(coveragePath, 'utf8'));
        const total = coverageData.total;

        return {
          statements: total.statements.pct,
          branches: total.branches.pct,
          functions: total.functions.pct,
          lines: total.lines.pct,
        };
      } catch (e) {
        console.warn('Could not parse coverage data');
      }
    }

    return {
      statements: 0,
      branches: 0,
      functions: 0,
      lines: 0,
    };
  }

  private generateRecommendations(results: TestResult[]): string[] {
    const recommendations: string[] = [];

    // Analyze failed gates and generate specific recommendations
    const failedResults = results.filter((r) => !r.passed);

    for (const result of failedResults) {
      switch (result.gate) {
        case 'Unit Test Coverage':
          recommendations.push(
            `Increase unit test coverage to at least ${result.threshold}%. Current: ${result.score?.toFixed(1)}%`,
          );
          break;

        case 'Security Validation':
          recommendations.push(
            'Address security test failures. Review authentication, authorization, and input validation.',
          );
          break;

        case 'Performance Testing':
          recommendations.push(
            'Performance tests indicate potential bottlenecks. Review database queries, API response times, and resource usage.',
          );
          break;

        case 'TypeScript Compilation':
          recommendations.push(
            'Fix TypeScript compilation errors. Review type definitions and ensure strict mode compliance.',
          );
          break;

        case 'Security Audit':
          recommendations.push(
            'Address high/critical security vulnerabilities identified in dependencies. Run npm audit fix or update vulnerable packages.',
          );
          break;

        case 'Build System Validation':
          recommendations.push(
            'Build process failed. Check for missing dependencies, configuration issues, or compilation errors.',
          );
          break;

        default:
          recommendations.push(
            `Address failures in ${result.gate}. Review test output for specific issues.`,
          );
      }
    }

    // Add general recommendations based on overall results
    const coverageGate = results.find((r) => r.gate === 'Unit Test Coverage');
    if (coverageGate && coverageGate.score && coverageGate.score < 80) {
      recommendations.push(
        'Consider implementing additional unit tests for critical business logic components.',
      );
    }

    const performanceGate = results.find((r) => r.gate === 'Performance Testing');
    if (performanceGate && !performanceGate.passed) {
      recommendations.push(
        'Consider implementing performance monitoring and optimization strategies.',
      );
    }

    // Add proactive recommendations
    if (results.every((r) => r.passed)) {
      recommendations.push(
        'All quality gates passed! Consider implementing additional E2E tests for comprehensive coverage.',
      );
      recommendations.push(
        'Consider setting up continuous monitoring and alerting for production environments.',
      );
    }

    return recommendations;
  }

  private getBuildVersion(): string {
    try {
      const packageJson = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8'));
      return packageJson.version || '1.0.0';
    } catch (e) {
      return '1.0.0';
    }
  }

  private async saveReport(report: QualityReport): Promise<void> {
    const reportsDir = join(process.cwd(), 'tests', 'reports');
    const reportPath = join(reportsDir, `qa-validation-${Date.now()}.json`);
    const summaryPath = join(reportsDir, 'qa-validation-latest.json');

    try {
      // Ensure reports directory exists
      execSync(`mkdir -p ${reportsDir}`);

      // Save detailed report
      writeFileSync(reportPath, JSON.stringify(report, null, 2));

      // Save latest summary
      writeFileSync(summaryPath, JSON.stringify(report, null, 2));

      console.log(`\n📊 Quality report saved: ${reportPath}`);

      // Generate markdown summary
      const markdownSummary = this.generateMarkdownSummary(report);
      const markdownPath = join(reportsDir, 'qa-validation-summary.md');
      writeFileSync(markdownPath, markdownSummary);

      console.log(`📋 Markdown summary: ${markdownPath}`);
    } catch (e) {
      console.warn('Could not save quality report:', e);
    }
  }

  private generateMarkdownSummary(report: QualityReport): string {
    const status =
      report.overallStatus === 'PASSED' ? '✅' : report.overallStatus === 'WARNING' ? '⚠️' : '❌';

    let markdown = `# QA Validation Report ${status}\n\n`;
    markdown += `**Generated:** ${new Date(report.timestamp).toLocaleString()}\n`;
    markdown += `**Status:** ${report.overallStatus}\n`;
    markdown += `**Environment:** ${report.buildInfo.environment}\n`;
    markdown += `**Version:** ${report.buildInfo.version}\n\n`;

    // Summary statistics
    markdown += '## Summary\n\n';
    markdown += `- **Total Gates:** ${report.totalGates}\n`;
    markdown += `- **Passed:** ${report.passedGates}\n`;
    markdown += `- **Failed:** ${report.failedGates}\n`;
    markdown += `- **Critical Failures:** ${report.criticalFailures}\n\n`;

    // Coverage metrics
    markdown += '## Coverage Metrics\n\n';
    markdown += `- **Statements:** ${report.coverageMetrics.statements.toFixed(1)}%\n`;
    markdown += `- **Branches:** ${report.coverageMetrics.branches.toFixed(1)}%\n`;
    markdown += `- **Functions:** ${report.coverageMetrics.functions.toFixed(1)}%\n`;
    markdown += `- **Lines:** ${report.coverageMetrics.lines.toFixed(1)}%\n\n`;

    // Detailed results
    markdown += '## Gate Results\n\n';
    markdown += '| Gate | Status | Score | Duration |\n';
    markdown += '|------|--------|-------|----------|\n';

    for (const result of report.results) {
      const status = result.passed ? '✅ PASS' : '❌ FAIL';
      const score = result.score ? `${result.score.toFixed(1)}%` : '-';
      const duration = `${(result.duration / 1000).toFixed(1)}s`;

      markdown += `| ${result.gate} | ${status} | ${score} | ${duration} |\n`;
    }

    // Recommendations
    if (report.recommendations.length > 0) {
      markdown += '\n## Recommendations\n\n';
      for (const rec of report.recommendations) {
        markdown += `- ${rec}\n`;
      }
    }

    return markdown;
  }

  private printSummary(report: QualityReport): void {
    console.log('\n' + '='.repeat(60));
    console.log('🏆 QA VALIDATION SUMMARY');
    console.log('='.repeat(60));

    const statusIcon =
      report.overallStatus === 'PASSED' ? '✅' : report.overallStatus === 'WARNING' ? '⚠️' : '❌';

    console.log(`\n${statusIcon} Overall Status: ${report.overallStatus}`);
    console.log(`📊 Gates Passed: ${report.passedGates}/${report.totalGates}`);
    console.log(`⚡ Critical Failures: ${report.criticalFailures}`);

    if (report.coverageMetrics.statements > 0) {
      console.log(`\n📈 Coverage Metrics:`);
      console.log(`   Statements: ${report.coverageMetrics.statements.toFixed(1)}%`);
      console.log(`   Branches: ${report.coverageMetrics.branches.toFixed(1)}%`);
      console.log(`   Functions: ${report.coverageMetrics.functions.toFixed(1)}%`);
      console.log(`   Lines: ${report.coverageMetrics.lines.toFixed(1)}%`);
    }

    if (report.recommendations.length > 0) {
      console.log(`\n💡 Key Recommendations:`);
      report.recommendations.slice(0, 3).forEach((rec) => {
        console.log(`   • ${rec}`);
      });
    }

    console.log('\n' + '='.repeat(60));

    // Exit with appropriate code
    if (report.criticalFailures > 0) {
      console.log('❌ CRITICAL FAILURES DETECTED - BUILD SHOULD NOT PROCEED');
      process.exit(1);
    } else if (report.overallStatus === 'WARNING') {
      console.log('⚠️ WARNINGS DETECTED - REVIEW REQUIRED');
      process.exit(0); // Don't fail build for warnings
    } else {
      console.log('✅ ALL QUALITY GATES PASSED - BUILD APPROVED');
      process.exit(0);
    }
  }
}

// CLI execution
if (require.main === module) {
  const runner = new QAValidationRunner();
  runner.runValidation().catch((error) => {
    console.error('❌ QA Validation Runner failed:', error);
    process.exit(1);
  });
}

export { QAValidationRunner, QualityReport, TestResult };
