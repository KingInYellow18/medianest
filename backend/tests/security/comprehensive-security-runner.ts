/**
 * Comprehensive Security Test Runner
 *
 * Orchestrates all security tests and generates consolidated security reports
 * Provides detailed analysis of security posture and vulnerability coverage
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

interface SecurityTestResult {
  suite: string;
  passed: number;
  failed: number;
  total: number;
  duration: number;
  coverage: string[];
  vulnerabilities: SecurityVulnerability[];
}

interface SecurityVulnerability {
  type: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  category: string;
  description: string;
  remediation: string;
  affected: string;
}

interface SecurityReport {
  timestamp: string;
  overallScore: number;
  grade: string;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  testSuites: SecurityTestResult[];
  vulnerabilities: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  coverage: {
    owaspTop10: number;
    injectionAttacks: number;
    authenticationSecurity: number;
    sessionManagement: number;
    accessControl: number;
    cryptographicSecurity: number;
    rateLimiting: number;
    inputValidation: number;
    fileUploadSecurity: number;
  };
  recommendations: string[];
  complianceStatus: {
    owasp: boolean;
    pciDss: boolean;
    gdpr: boolean;
    hipaa: boolean;
  };
}

export class ComprehensiveSecurityRunner {
  private securityTestSuites = [
    {
      name: 'SQL Injection Prevention',
      file: 'sql-injection-tests.test.ts',
      category: 'Injection Attacks',
      owaspCategory: 'A03:2021 – Injection',
    },
    {
      name: 'XSS Prevention',
      file: 'xss-prevention-tests.test.ts',
      category: 'Injection Attacks',
      owaspCategory: 'A03:2021 – Injection',
    },
    {
      name: 'CSRF Protection',
      file: 'csrf-protection-tests.test.ts',
      category: 'Authentication Security',
      owaspCategory: 'A01:2021 – Broken Access Control',
    },
    {
      name: 'Authentication Bypass Prevention',
      file: 'authentication-bypass-tests.test.ts',
      category: 'Authentication Security',
      owaspCategory: 'A07:2021 – Identification and Authentication Failures',
    },
    {
      name: 'Session Security',
      file: 'session-security-tests.test.ts',
      category: 'Session Management',
      owaspCategory: 'A07:2021 – Identification and Authentication Failures',
    },
    {
      name: 'Rate Limiting & DoS Prevention',
      file: 'rate-limiting-tests.test.ts',
      category: 'Rate Limiting',
      owaspCategory: 'A05:2021 – Security Misconfiguration',
    },
    {
      name: 'OWASP Top 10 Compliance',
      file: 'owasp-top10-tests.test.ts',
      category: 'Comprehensive Security',
      owaspCategory: 'All OWASP Top 10',
    },
    {
      name: 'Security Penetration Testing',
      file: 'security-penetration.test.ts',
      category: 'Penetration Testing',
      owaspCategory: 'Multi-category',
    },
    {
      name: 'Security Integration Testing',
      file: 'security-integration.test.ts',
      category: 'Integration Security',
      owaspCategory: 'Multi-category',
    },
  ];

  async runAllSecurityTests(): Promise<SecurityReport> {
    console.log('🔒 Starting Comprehensive Security Test Suite...');
    console.log(`📋 Running ${this.securityTestSuites.length} security test suites`);

    const results: SecurityTestResult[] = [];
    const startTime = Date.now();

    for (const suite of this.securityTestSuites) {
      console.log(`\n🔍 Running ${suite.name}...`);

      try {
        const result = await this.runSecurityTestSuite(suite);
        results.push(result);

        console.log(`✅ ${suite.name}: ${result.passed}/${result.total} tests passed`);
      } catch (error) {
        console.error(`❌ ${suite.name} failed:`, error);

        results.push({
          suite: suite.name,
          passed: 0,
          failed: 1,
          total: 1,
          duration: 0,
          coverage: [],
          vulnerabilities: [
            {
              type: 'HIGH',
              category: suite.category,
              description: `${suite.name} test suite failed to execute`,
              remediation: 'Fix test suite configuration and dependencies',
              affected: suite.file,
            },
          ],
        });
      }
    }

    const totalDuration = Date.now() - startTime;
    const report = this.generateSecurityReport(results, totalDuration);

    await this.saveSecurityReport(report);
    this.printSecuritySummary(report);

    return report;
  }

  private async runSecurityTestSuite(suite: any): Promise<SecurityTestResult> {
    const testFile = path.join(__dirname, suite.file);

    if (!fs.existsSync(testFile)) {
      throw new Error(`Test file not found: ${testFile}`);
    }

    const startTime = Date.now();

    try {
      // Run the specific test suite
      const output = execSync(`npx vitest run ${testFile} --reporter=json`, {
        encoding: 'utf-8',
        cwd: path.join(__dirname, '../..'),
        timeout: 300000, // 5 minutes
      });

      const testResults = JSON.parse(output);
      const duration = Date.now() - startTime;

      return {
        suite: suite.name,
        passed: testResults.numPassedTests || 0,
        failed: testResults.numFailedTests || 0,
        total: testResults.numTotalTests || 0,
        duration,
        coverage: this.extractCoverage(suite),
        vulnerabilities: this.extractVulnerabilities(testResults, suite),
      };
    } catch (error: any) {
      // Parse error output for failed tests
      const duration = Date.now() - startTime;

      return {
        suite: suite.name,
        passed: 0,
        failed: 1,
        total: 1,
        duration,
        coverage: [],
        vulnerabilities: [
          {
            type: 'CRITICAL',
            category: suite.category,
            description: `Critical security test failure: ${error.message}`,
            remediation: 'Investigate and fix security test infrastructure',
            affected: suite.file,
          },
        ],
      };
    }
  }

  private extractCoverage(suite: any): string[] {
    const coverageMap: { [key: string]: string[] } = {
      'SQL Injection Prevention': [
        'SQL Injection in Authentication',
        'SQL Injection in Search Queries',
        'SQL Injection in User Management',
        'SQL Injection in Media Requests',
        'Time-based SQL Injection',
        'Boolean-based Blind SQL Injection',
        'Second-order SQL Injection',
        'ORM-specific Injection Prevention',
      ],
      'XSS Prevention': [
        'Reflected XSS Prevention',
        'Stored XSS Prevention',
        'DOM-based XSS Prevention',
        'Content Security Policy',
        'Input Sanitization',
        'Output Encoding',
        'Template Injection Prevention',
        'XSS Filter Bypass Prevention',
      ],
      'CSRF Protection': [
        'CSRF Token Generation',
        'CSRF Token Validation',
        'Double Submit Cookie Pattern',
        'SameSite Cookie Attributes',
        'Origin Validation',
        'Referer Validation',
        'State-changing Operation Protection',
      ],
      'Authentication Bypass Prevention': [
        'JWT Token Security',
        'Session Fixation Prevention',
        'Brute Force Protection',
        'Parameter Pollution Prevention',
        'Header Manipulation Prevention',
        'Timing Attack Prevention',
        'Directory Traversal Prevention',
      ],
      'Session Security': [
        'Session Cookie Security',
        'Session Regeneration',
        'Session Invalidation',
        'Concurrent Session Management',
        'Session Hijacking Prevention',
        'Device Fingerprinting',
        'Session Storage Security',
      ],
      'Rate Limiting & DoS Prevention': [
        'Authentication Rate Limiting',
        'API Endpoint Rate Limiting',
        'DoS Attack Prevention',
        'Distributed Rate Limiting',
        'Rate Limit Bypass Prevention',
        'Adaptive Rate Limiting',
        'Graceful Degradation',
      ],
      'OWASP Top 10 Compliance': [
        'A01 - Broken Access Control',
        'A02 - Cryptographic Failures',
        'A03 - Injection',
        'A04 - Insecure Design',
        'A05 - Security Misconfiguration',
        'A06 - Vulnerable Components',
        'A07 - Authentication Failures',
        'A08 - Data Integrity Failures',
        'A09 - Security Logging Failures',
        'A10 - Server-Side Request Forgery',
      ],
    };

    return coverageMap[suite.name] || [];
  }

  private extractVulnerabilities(testResults: any, suite: any): SecurityVulnerability[] {
    const vulnerabilities: SecurityVulnerability[] = [];

    if (testResults.numFailedTests > 0) {
      // High-priority vulnerabilities based on failed tests
      const failureTypes: { [key: string]: SecurityVulnerability } = {
        'SQL Injection Prevention': {
          type: 'CRITICAL',
          category: 'Injection Attacks',
          description: 'SQL injection vulnerabilities detected',
          remediation: 'Implement parameterized queries and input validation',
          affected: 'Database queries',
        },
        'XSS Prevention': {
          type: 'HIGH',
          category: 'Injection Attacks',
          description: 'Cross-site scripting vulnerabilities detected',
          remediation: 'Implement proper input sanitization and output encoding',
          affected: 'User input handling',
        },
        'Authentication Bypass Prevention': {
          type: 'CRITICAL',
          category: 'Authentication Security',
          description: 'Authentication bypass vulnerabilities detected',
          remediation: 'Strengthen authentication mechanisms and token validation',
          affected: 'Authentication system',
        },
        'CSRF Protection': {
          type: 'HIGH',
          category: 'Authentication Security',
          description: 'CSRF protection vulnerabilities detected',
          remediation: 'Implement CSRF tokens and proper origin validation',
          affected: 'State-changing operations',
        },
      };

      const vulnerability = failureTypes[suite.name];
      if (vulnerability) {
        vulnerabilities.push(vulnerability);
      }
    }

    return vulnerabilities;
  }

  private generateSecurityReport(results: SecurityTestResult[], duration: number): SecurityReport {
    const totalTests = results.reduce((sum, r) => sum + r.total, 0);
    const passedTests = results.reduce((sum, r) => sum + r.passed, 0);
    const failedTests = results.reduce((sum, r) => sum + r.failed, 0);

    const allVulnerabilities = results.flatMap((r) => r.vulnerabilities);
    const vulnerabilityCounts = {
      critical: allVulnerabilities.filter((v) => v.type === 'CRITICAL').length,
      high: allVulnerabilities.filter((v) => v.type === 'HIGH').length,
      medium: allVulnerabilities.filter((v) => v.type === 'MEDIUM').length,
      low: allVulnerabilities.filter((v) => v.type === 'LOW').length,
    };

    // Calculate security score
    const passRate = totalTests > 0 ? (passedTests / totalTests) * 100 : 0;
    const vulnerabilityPenalty =
      vulnerabilityCounts.critical * 20 +
      vulnerabilityCounts.high * 10 +
      vulnerabilityCounts.medium * 5 +
      vulnerabilityCounts.low * 2;

    const overallScore = Math.max(0, Math.min(100, passRate - vulnerabilityPenalty));
    const grade = this.calculateSecurityGrade(overallScore);

    return {
      timestamp: new Date().toISOString(),
      overallScore,
      grade,
      totalTests,
      passedTests,
      failedTests,
      testSuites: results,
      vulnerabilities: vulnerabilityCounts,
      coverage: {
        owaspTop10: this.calculateOwaspCoverage(results),
        injectionAttacks: this.calculateCategoryCoverage(results, 'Injection Attacks'),
        authenticationSecurity: this.calculateCategoryCoverage(results, 'Authentication Security'),
        sessionManagement: this.calculateCategoryCoverage(results, 'Session Management'),
        accessControl: this.calculateCategoryCoverage(results, 'Access Control'),
        cryptographicSecurity: this.calculateCategoryCoverage(results, 'Cryptographic Security'),
        rateLimiting: this.calculateCategoryCoverage(results, 'Rate Limiting'),
        inputValidation: this.calculateCategoryCoverage(results, 'Input Validation'),
        fileUploadSecurity: this.calculateCategoryCoverage(results, 'File Upload Security'),
      },
      recommendations: this.generateRecommendations(allVulnerabilities, overallScore),
      complianceStatus: {
        owasp: vulnerabilityCounts.critical === 0 && vulnerabilityCounts.high <= 2,
        pciDss: vulnerabilityCounts.critical === 0 && overallScore >= 85,
        gdpr: overallScore >= 80,
        hipaa: vulnerabilityCounts.critical === 0 && overallScore >= 90,
      },
    };
  }

  private calculateSecurityGrade(score: number): string {
    if (score >= 95) return 'A+';
    if (score >= 90) return 'A';
    if (score >= 85) return 'B+';
    if (score >= 80) return 'B';
    if (score >= 75) return 'C+';
    if (score >= 70) return 'C';
    if (score >= 65) return 'D+';
    if (score >= 60) return 'D';
    return 'F';
  }

  private calculateOwaspCoverage(results: SecurityTestResult[]): number {
    const owaspSuite = results.find((r) => r.suite === 'OWASP Top 10 Compliance');
    if (!owaspSuite) return 0;

    return owaspSuite.total > 0 ? (owaspSuite.passed / owaspSuite.total) * 100 : 0;
  }

  private calculateCategoryCoverage(results: SecurityTestResult[], category: string): number {
    const categoryResults = results.filter(
      (r) => this.securityTestSuites.find((s) => s.name === r.suite)?.category === category
    );

    if (categoryResults.length === 0) return 0;

    const totalTests = categoryResults.reduce((sum, r) => sum + r.total, 0);
    const passedTests = categoryResults.reduce((sum, r) => sum + r.passed, 0);

    return totalTests > 0 ? (passedTests / totalTests) * 100 : 0;
  }

  private generateRecommendations(
    vulnerabilities: SecurityVulnerability[],
    score: number
  ): string[] {
    const recommendations = new Set<string>();

    // Critical recommendations based on vulnerabilities
    vulnerabilities.forEach((vuln) => {
      recommendations.add(vuln.remediation);
    });

    // General security recommendations
    recommendations.add('Implement comprehensive input validation and sanitization');
    recommendations.add('Use parameterized queries for all database operations');
    recommendations.add('Implement proper session management with secure tokens');
    recommendations.add('Set up comprehensive security monitoring and alerting');
    recommendations.add('Regular security code reviews and penetration testing');
    recommendations.add('Keep all dependencies updated and scan for vulnerabilities');
    recommendations.add('Implement Content Security Policy (CSP) headers');
    recommendations.add('Use HTTPS for all communications');
    recommendations.add('Implement proper error handling without information disclosure');
    recommendations.add('Regular security training for development team');

    // Score-based recommendations
    if (score < 70) {
      recommendations.add('URGENT: Address critical security vulnerabilities immediately');
      recommendations.add('Conduct immediate security audit and remediation');
    } else if (score < 85) {
      recommendations.add('Prioritize fixing high-severity vulnerabilities');
      recommendations.add('Enhance security testing coverage');
    }

    return Array.from(recommendations);
  }

  private async saveSecurityReport(report: SecurityReport): Promise<void> {
    const reportsDir = path.join(__dirname, '../reports');

    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportFile = path.join(reportsDir, `security-report-${timestamp}.json`);

    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));

    // Also save as latest
    const latestFile = path.join(reportsDir, 'security-report-latest.json');
    fs.writeFileSync(latestFile, JSON.stringify(report, null, 2));

    console.log(`\n📊 Security report saved to: ${reportFile}`);
  }

  private printSecuritySummary(report: SecurityReport): void {
    console.log('\n' + '='.repeat(80));
    console.log('🔒 MEDIANEST SECURITY TEST SUMMARY');
    console.log('='.repeat(80));

    console.log(
      `\n🎯 OVERALL SECURITY SCORE: ${report.overallScore.toFixed(1)}/100 (Grade: ${report.grade})`
    );

    console.log(`\n📊 TEST RESULTS:`);
    console.log(`   Total Tests: ${report.totalTests}`);
    console.log(
      `   Passed: ${report.passedTests} (${((report.passedTests / report.totalTests) * 100).toFixed(1)}%)`
    );
    console.log(
      `   Failed: ${report.failedTests} (${((report.failedTests / report.totalTests) * 100).toFixed(1)}%)`
    );

    console.log(`\n🚨 VULNERABILITIES:`);
    console.log(`   Critical: ${report.vulnerabilities.critical}`);
    console.log(`   High: ${report.vulnerabilities.high}`);
    console.log(`   Medium: ${report.vulnerabilities.medium}`);
    console.log(`   Low: ${report.vulnerabilities.low}`);

    console.log(`\n📋 COMPLIANCE STATUS:`);
    console.log(`   OWASP Top 10: ${report.complianceStatus.owasp ? '✅' : '❌'}`);
    console.log(`   PCI DSS: ${report.complianceStatus.pciDss ? '✅' : '❌'}`);
    console.log(`   GDPR: ${report.complianceStatus.gdpr ? '✅' : '❌'}`);
    console.log(`   HIPAA: ${report.complianceStatus.hipaa ? '✅' : '❌'}`);

    console.log(`\n🎯 COVERAGE:`);
    console.log(`   OWASP Top 10: ${report.coverage.owaspTop10.toFixed(1)}%`);
    console.log(`   Injection Attacks: ${report.coverage.injectionAttacks.toFixed(1)}%`);
    console.log(`   Authentication: ${report.coverage.authenticationSecurity.toFixed(1)}%`);
    console.log(`   Session Management: ${report.coverage.sessionManagement.toFixed(1)}%`);
    console.log(`   Rate Limiting: ${report.coverage.rateLimiting.toFixed(1)}%`);

    if (report.recommendations.length > 0) {
      console.log(`\n💡 TOP RECOMMENDATIONS:`);
      report.recommendations.slice(0, 5).forEach((rec, i) => {
        console.log(`   ${i + 1}. ${rec}`);
      });
    }

    console.log('\n' + '='.repeat(80));

    if (report.overallScore >= 90) {
      console.log('🎉 EXCELLENT SECURITY POSTURE!');
    } else if (report.overallScore >= 80) {
      console.log('👍 GOOD SECURITY POSTURE - Some improvements needed');
    } else if (report.overallScore >= 70) {
      console.log('⚠️  MODERATE SECURITY RISKS - Priority fixes required');
    } else {
      console.log('🚨 CRITICAL SECURITY ISSUES - Immediate action required!');
    }

    console.log('='.repeat(80));
  }
}

// CLI execution
if (require.main === module) {
  const runner = new ComprehensiveSecurityRunner();
  runner
    .runAllSecurityTests()
    .then((report) => {
      process.exit(report.vulnerabilities.critical > 0 ? 1 : 0);
    })
    .catch((error) => {
      console.error('❌ Security test suite failed:', error);
      process.exit(1);
    });
}

export default ComprehensiveSecurityRunner;
