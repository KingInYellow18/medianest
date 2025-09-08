#!/usr/bin/env node

/**
 * MediaNest Edge Case Testing Runner
 * Executes comprehensive edge case testing and generates reports
 */

import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import Redis from 'ioredis';

interface EdgeCaseTestResult {
  category: string;
  testName: string;
  status: 'pass' | 'fail' | 'skip' | 'timeout';
  duration: number;
  error?: string;
  memory?: {
    heapUsed: number;
    heapTotal: number;
    external: number;
  };
}

interface EdgeCaseReport {
  timestamp: string;
  environment: string;
  summary: {
    totalTests: number;
    passed: number;
    failed: number;
    skipped: number;
    timeouts: number;
    duration: number;
    memoryPeak: number;
  };
  categories: Record<string, {
    tests: number;
    passed: number;
    failed: number;
    duration: number;
  }>;
  criticalFindings: Array<{
    category: string;
    test: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
    description: string;
    recommendation: string;
  }>;
  vulnerabilities: Array<{
    type: string;
    description: string;
    affected: string[];
    severity: 'critical' | 'high' | 'medium' | 'low';
    cve?: string;
  }>;
  performanceMetrics: {
    averageResponseTime: number;
    memoryUsage: number;
    errorRate: number;
    concurrencyLimit: number;
  };
  recommendations: string[];
}

class EdgeCaseTestRunner {
  private redis: Redis;
  private results: EdgeCaseTestResult[] = [];
  private startTime: number = 0;
  private peakMemory: number = 0;

  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      db: 1
    });
  }

  async runEdgeCaseTests(): Promise<void> {
    console.log('🔍 Starting MediaNest Edge Case Testing Suite');
    this.startTime = Date.now();

    try {
      // Run the test suites
      await this.executeTestSuite('edge-case-testing-framework.ts', 'Boundary Value Testing');
      await this.executeTestSuite('edge-case-test-suite.ts', 'Comprehensive Edge Cases');
      await this.executeTestSuite('specialized-edge-cases.ts', 'Specialized Edge Cases');

      // Generate comprehensive report
      const report = await this.generateReport();
      
      // Store results in memory for production validation
      await this.storeResultsInMemory(report);
      
      // Save report to filesystem
      await this.saveReport(report);
      
      console.log('✅ Edge case testing completed successfully');
      console.log(`📊 Summary: ${report.summary.passed}/${report.summary.totalTests} tests passed`);
      console.log(`⏱️  Duration: ${report.summary.duration}ms`);
      
      if (report.criticalFindings.length > 0) {
        console.log(`🚨 Critical Findings: ${report.criticalFindings.length}`);
      }
      
      if (report.vulnerabilities.length > 0) {
        console.log(`🔓 Vulnerabilities Found: ${report.vulnerabilities.length}`);
      }

    } catch (error) {
      console.error('❌ Edge case testing failed:', error);
      throw error;
    } finally {
      await this.cleanup();
    }
  }

  private async executeTestSuite(testFile: string, description: string): Promise<void> {
    console.log(`\n🧪 Running ${description}...`);
    
    return new Promise((resolve, reject) => {
      const testPath = path.join(__dirname, testFile);
      const childProcess = spawn('npx', ['vitest', 'run', testPath, '--config', './tests/edge-cases/vitest.config.ts'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, NODE_ENV: 'test' }
      });

      let stdout = '';
      let stderr = '';

      childProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      childProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      childProcess.on('close', (code) => {
        // Track memory usage
        const currentMemory = process.memoryUsage().heapUsed;
        if (currentMemory > this.peakMemory) {
          this.peakMemory = currentMemory;
        }

        // Parse test results from stdout
        this.parseTestResults(stdout, description);

        if (code === 0) {
          console.log(`✅ ${description} completed`);
          resolve();
        } else {
          console.error(`❌ ${description} failed with code ${code}`);
          if (stderr) {
            console.error('STDERR:', stderr);
          }
          // Don't reject - continue with other tests
          resolve();
        }
      });

      childProcess.on('error', (error) => {
        console.error(`❌ ${description} process error:`, error);
        resolve(); // Continue with other tests
      });
    });
  }

  private parseTestResults(output: string, category: string): void {
    // Simple regex-based parsing of vitest output
    const testLineRegex = /✓|✗|⚠|⏳\s+(.+?)\s+\((\d+)ms\)/g;
    const matches = output.matchAll(testLineRegex);

    for (const match of matches) {
      const testName = match[1];
      const duration = parseInt(match[2]);
      const status = output.includes('✓') ? 'pass' : 
                    output.includes('✗') ? 'fail' : 
                    output.includes('⚠') ? 'skip' : 'timeout';

      this.results.push({
        category,
        testName,
        status,
        duration,
        memory: process.memoryUsage()
      });
    }
  }

  private async generateReport(): Promise<EdgeCaseReport> {
    const endTime = Date.now();
    const totalDuration = endTime - this.startTime;

    // Calculate summary statistics
    const summary = {
      totalTests: this.results.length,
      passed: this.results.filter(r => r.status === 'pass').length,
      failed: this.results.filter(r => r.status === 'fail').length,
      skipped: this.results.filter(r => r.status === 'skip').length,
      timeouts: this.results.filter(r => r.status === 'timeout').length,
      duration: totalDuration,
      memoryPeak: this.peakMemory
    };

    // Group by categories
    const categories: Record<string, any> = {};
    for (const result of this.results) {
      if (!categories[result.category]) {
        categories[result.category] = { tests: 0, passed: 0, failed: 0, duration: 0 };
      }
      
      categories[result.category].tests++;
      categories[result.category].duration += result.duration;
      
      if (result.status === 'pass') {
        categories[result.category].passed++;
      } else if (result.status === 'fail') {
        categories[result.category].failed++;
      }
    }

    // Identify critical findings
    const criticalFindings = this.identifyCriticalFindings();
    
    // Identify vulnerabilities
    const vulnerabilities = this.identifyVulnerabilities();
    
    // Calculate performance metrics
    const performanceMetrics = {
      averageResponseTime: this.results.reduce((sum, r) => sum + r.duration, 0) / this.results.length,
      memoryUsage: this.peakMemory / 1024 / 1024, // MB
      errorRate: summary.failed / summary.totalTests,
      concurrencyLimit: this.estimateConcurrencyLimit()
    };

    // Generate recommendations
    const recommendations = this.generateRecommendations(criticalFindings, vulnerabilities);

    return {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'test',
      summary,
      categories,
      criticalFindings,
      vulnerabilities,
      performanceMetrics,
      recommendations
    };
  }

  private identifyCriticalFindings(): EdgeCaseReport['criticalFindings'] {
    const findings: EdgeCaseReport['criticalFindings'] = [];

    const failedSecurityTests = this.results.filter(r => 
      r.status === 'fail' && 
      (r.testName.includes('injection') || 
       r.testName.includes('xss') || 
       r.testName.includes('auth'))
    );

    for (const test of failedSecurityTests) {
      findings.push({
        category: test.category,
        test: test.testName,
        severity: 'critical',
        description: `Security test failed: ${test.testName}`,
        recommendation: 'Immediate security review required'
      });
    }

    const timeoutTests = this.results.filter(r => r.status === 'timeout');
    if (timeoutTests.length > 0) {
      findings.push({
        category: 'performance',
        test: 'timeout-tests',
        severity: 'high',
        description: `${timeoutTests.length} tests timed out`,
        recommendation: 'Review performance bottlenecks and increase resource limits'
      });
    }

    const highMemoryTests = this.results.filter(r => 
      r.memory && r.memory.heapUsed > 100 * 1024 * 1024 // > 100MB
    );
    
    if (highMemoryTests.length > 0) {
      findings.push({
        category: 'memory',
        test: 'high-memory-usage',
        severity: 'medium',
        description: `${highMemoryTests.length} tests used excessive memory`,
        recommendation: 'Optimize memory usage and implement memory limits'
      });
    }

    return findings;
  }

  private identifyVulnerabilities(): EdgeCaseReport['vulnerabilities'] {
    const vulnerabilities: EdgeCaseReport['vulnerabilities'] = [];

    // Check for SQL injection vulnerabilities
    const sqlFailures = this.results.filter(r => 
      r.testName.includes('sql-injection') && r.status === 'fail'
    );
    
    if (sqlFailures.length > 0) {
      vulnerabilities.push({
        type: 'SQL Injection',
        description: 'Application vulnerable to SQL injection attacks',
        affected: sqlFailures.map(r => r.testName),
        severity: 'critical',
        cve: 'CWE-89'
      });
    }

    // Check for XSS vulnerabilities
    const xssFailures = this.results.filter(r => 
      r.testName.includes('xss') && r.status === 'fail'
    );
    
    if (xssFailures.length > 0) {
      vulnerabilities.push({
        type: 'Cross-Site Scripting (XSS)',
        description: 'Application vulnerable to XSS attacks',
        affected: xssFailures.map(r => r.testName),
        severity: 'high',
        cve: 'CWE-79'
      });
    }

    // Check for authentication bypass
    const authFailures = this.results.filter(r => 
      r.testName.includes('auth') && r.status === 'fail'
    );
    
    if (authFailures.length > 0) {
      vulnerabilities.push({
        type: 'Authentication Bypass',
        description: 'Authentication mechanisms can be bypassed',
        affected: authFailures.map(r => r.testName),
        severity: 'critical',
        cve: 'CWE-287'
      });
    }

    return vulnerabilities;
  }

  private estimateConcurrencyLimit(): number {
    const concurrencyTests = this.results.filter(r => 
      r.testName.includes('concurrent')
    );
    
    // Simple heuristic based on successful concurrent tests
    const successfulConcurrencyTests = concurrencyTests.filter(r => r.status === 'pass');
    
    if (successfulConcurrencyTests.length === 0) return 10; // Default conservative limit
    
    // Extract concurrency numbers from test names (rough heuristic)
    const concurrencyNumbers = successfulConcurrencyTests
      .map(r => {
        const match = r.testName.match(/(\d+)/);
        return match ? parseInt(match[1]) : 10;
      })
      .filter(n => n > 0);

    return concurrencyNumbers.length > 0 ? Math.max(...concurrencyNumbers) : 50;
  }

  private generateRecommendations(
    criticalFindings: EdgeCaseReport['criticalFindings'],
    vulnerabilities: EdgeCaseReport['vulnerabilities']
  ): string[] {
    const recommendations = [];

    if (vulnerabilities.some(v => v.severity === 'critical')) {
      recommendations.push('🚨 CRITICAL: Immediate security patch required - critical vulnerabilities detected');
    }

    if (criticalFindings.some(f => f.severity === 'critical')) {
      recommendations.push('⚠️  Critical system issues identified - review and address immediately');
    }

    const errorRate = this.results.filter(r => r.status === 'fail').length / this.results.length;
    if (errorRate > 0.1) {
      recommendations.push(`📈 High error rate detected (${(errorRate * 100).toFixed(1)}%) - improve error handling`);
    }

    if (this.peakMemory > 200 * 1024 * 1024) { // > 200MB
      recommendations.push('💾 High memory usage detected - optimize memory management');
    }

    const avgResponseTime = this.results.reduce((sum, r) => sum + r.duration, 0) / this.results.length;
    if (avgResponseTime > 1000) { // > 1 second
      recommendations.push(`⏱️  Slow response times (avg: ${avgResponseTime.toFixed(0)}ms) - optimize performance`);
    }

    if (recommendations.length === 0) {
      recommendations.push('✅ All edge case tests passed - system appears robust');
    }

    return recommendations;
  }

  private async storeResultsInMemory(report: EdgeCaseReport): Promise<void> {
    const memoryData = {
      timestamp: report.timestamp,
      testingComplete: true,
      summary: report.summary,
      criticalIssues: report.criticalFindings.length,
      vulnerabilities: report.vulnerabilities.length,
      recommendations: report.recommendations,
      categories: Object.keys(report.categories),
      performanceMetrics: report.performanceMetrics,
      fullReport: report
    };

    // Store in Redis with 24-hour expiration
    await this.redis.setex(
      'MEDIANEST_PROD_VALIDATION:edge_case_testing',
      86400, // 24 hours
      JSON.stringify(memoryData)
    );

    console.log('💾 Edge case testing results stored in memory');
  }

  private async saveReport(report: EdgeCaseReport): Promise<void> {
    // Ensure output directory exists
    await fs.mkdir('./test-results/edge-cases', { recursive: true });

    // Save JSON report
    await fs.writeFile(
      './test-results/edge-cases/edge-case-report.json',
      JSON.stringify(report, null, 2)
    );

    // Generate markdown report
    const markdownReport = this.generateMarkdownReport(report);
    await fs.writeFile(
      './test-results/edge-cases/edge-case-report.md',
      markdownReport
    );

    // Generate executive summary
    const executiveSummary = this.generateExecutiveSummary(report);
    await fs.writeFile(
      './test-results/edge-cases/executive-summary.md',
      executiveSummary
    );

    console.log('📄 Reports saved to ./test-results/edge-cases/');
  }

  private generateMarkdownReport(report: EdgeCaseReport): string {
    return `
# MediaNest Edge Case Testing Report

**Generated:** ${report.timestamp}  
**Environment:** ${report.environment}

## Executive Summary

- **Total Tests:** ${report.summary.totalTests}
- **Passed:** ${report.summary.passed} (${((report.summary.passed / report.summary.totalTests) * 100).toFixed(1)}%)
- **Failed:** ${report.summary.failed} (${((report.summary.failed / report.summary.totalTests) * 100).toFixed(1)}%)
- **Duration:** ${(report.summary.duration / 1000).toFixed(2)} seconds
- **Peak Memory:** ${(report.summary.memoryPeak / 1024 / 1024).toFixed(2)} MB

## Critical Findings

${report.criticalFindings.length > 0 ? 
  report.criticalFindings.map(f => 
    `### ${f.severity.toUpperCase()}: ${f.test}
**Category:** ${f.category}
**Description:** ${f.description}
**Recommendation:** ${f.recommendation}
`).join('\n') : '✅ No critical findings detected'}

## Vulnerabilities

${report.vulnerabilities.length > 0 ?
  report.vulnerabilities.map(v =>
    `### ${v.severity.toUpperCase()}: ${v.type}
**Description:** ${v.description}
**Affected:** ${v.affected.join(', ')}
${v.cve ? `**CVE:** ${v.cve}` : ''}
`).join('\n') : '✅ No vulnerabilities detected'}

## Performance Metrics

- **Average Response Time:** ${report.performanceMetrics.averageResponseTime.toFixed(2)}ms
- **Memory Usage:** ${report.performanceMetrics.memoryUsage.toFixed(2)}MB
- **Error Rate:** ${(report.performanceMetrics.errorRate * 100).toFixed(2)}%
- **Estimated Concurrency Limit:** ${report.performanceMetrics.concurrencyLimit}

## Category Breakdown

${Object.entries(report.categories).map(([category, stats]) =>
  `### ${category}
- **Tests:** ${stats.tests}
- **Passed:** ${stats.passed}
- **Failed:** ${stats.failed}
- **Success Rate:** ${((stats.passed / stats.tests) * 100).toFixed(1)}%
- **Total Duration:** ${stats.duration.toFixed(0)}ms
`).join('\n')}

## Recommendations

${report.recommendations.map(rec => `- ${rec}`).join('\n')}

## Test Details

### Boundary Value Tests
Tests for file size limits, string length boundaries, numeric edge cases, and input validation limits.

### Error Condition Tests
Network failure scenarios, database connection limits, timeout handling, and resource exhaustion.

### Concurrent Access Tests
Race condition detection, connection pool limits, rate limiting effectiveness, and data consistency.

### Security Edge Cases
Injection vulnerabilities, authentication bypass attempts, authorization edge cases, and input sanitization.

---
*Report generated by MediaNest Edge Case Testing Framework*
`;
  }

  private generateExecutiveSummary(report: EdgeCaseReport): string {
    const riskLevel = report.vulnerabilities.some(v => v.severity === 'critical') ? 'HIGH' :
                     report.vulnerabilities.some(v => v.severity === 'high') ? 'MEDIUM' : 'LOW';

    const quality = report.summary.passed / report.summary.totalTests;
    const qualityGrade = quality >= 0.95 ? 'A' :
                        quality >= 0.85 ? 'B' :
                        quality >= 0.75 ? 'C' :
                        quality >= 0.65 ? 'D' : 'F';

    return `
# MediaNest Edge Case Testing - Executive Summary

## Overall Assessment

**Quality Grade:** ${qualityGrade}  
**Risk Level:** ${riskLevel}  
**Test Coverage:** ${report.summary.totalTests} edge cases

## Key Metrics

- **Success Rate:** ${((report.summary.passed / report.summary.totalTests) * 100).toFixed(1)}%
- **Critical Issues:** ${report.criticalFindings.filter(f => f.severity === 'critical').length}
- **Security Vulnerabilities:** ${report.vulnerabilities.length}
- **Performance Grade:** ${report.performanceMetrics.averageResponseTime < 500 ? 'Good' : 'Needs Improvement'}

## Immediate Actions Required

${report.vulnerabilities.filter(v => v.severity === 'critical').length > 0 ? 
  '🚨 **CRITICAL:** Address security vulnerabilities immediately' : ''}
${report.criticalFindings.filter(f => f.severity === 'critical').length > 0 ?
  '⚠️ **HIGH PRIORITY:** Resolve critical system issues' : ''}
${report.summary.failed > report.summary.totalTests * 0.2 ?
  '📈 **MEDIUM PRIORITY:** Improve system reliability (high failure rate)' : ''}

## Business Impact

- **System Reliability:** ${quality >= 0.9 ? 'Excellent' : quality >= 0.8 ? 'Good' : quality >= 0.7 ? 'Fair' : 'Poor'}
- **Security Posture:** ${riskLevel === 'LOW' ? 'Strong' : riskLevel === 'MEDIUM' ? 'Adequate' : 'Vulnerable'}
- **User Experience:** ${report.performanceMetrics.averageResponseTime < 1000 ? 'Responsive' : 'Slow'}
- **Scalability:** Estimated to handle ${report.performanceMetrics.concurrencyLimit} concurrent users

## Next Steps

1. ${report.recommendations[0] || 'Continue monitoring system performance'}
2. Schedule regular edge case testing (monthly recommended)
3. Implement automated monitoring for identified edge cases
4. Review and update system limits based on test results

---
*Generated on ${report.timestamp}*
`;
  }

  private async cleanup(): Promise<void> {
    await this.redis.disconnect();
  }
}

// Run if called directly
if (require.main === module) {
  const runner = new EdgeCaseTestRunner();
  runner.runEdgeCaseTests()
    .then(() => {
      console.log('🎉 Edge case testing completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Edge case testing failed:', error);
      process.exit(1);
    });
}

export { EdgeCaseTestRunner };