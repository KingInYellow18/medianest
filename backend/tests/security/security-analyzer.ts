/**
 * Security Issue Analyzer - Categorizes and analyzes security test failures
 */

import { SecurityIssue } from './security-runner';

export class SecurityIssueAnalyzer {
  static categorizeSecurityIssue(assertion: any, suiteName: string): SecurityIssue | null {
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

    // Data exposure issues
    if (title.includes('sensitive') && title.includes('exposed')) {
      return {
        type: 'HIGH',
        description: 'Sensitive data exposure vulnerability',
        file: assertion.ancestorTitles?.[0] || suiteName,
        remediation: 'Implement proper data masking and access controls',
      };
    }

    if (title.includes('privilege') && title.includes('escalation')) {
      return {
        type: 'CRITICAL',
        description: 'Privilege escalation vulnerability',
        file: assertion.ancestorTitles?.[0] || suiteName,
        remediation: 'Review authorization logic and role validation',
      };
    }

    // Authorization issues
    if (title.includes('unauthorized') && title.includes('access')) {
      return {
        type: 'HIGH',
        description: 'Unauthorized access vulnerability',
        file: assertion.ancestorTitles?.[0] || suiteName,
        remediation: 'Implement proper authorization checks',
      };
    }

    if (title.includes('directory') && title.includes('traversal')) {
      return {
        type: 'HIGH',
        description: 'Directory traversal vulnerability',
        file: assertion.ancestorTitles?.[0] || suiteName,
        remediation: 'Implement path validation and sanitization',
      };
    }

    // Input validation issues
    if (title.includes('buffer') && title.includes('overflow')) {
      return {
        type: 'HIGH',
        description: 'Buffer overflow vulnerability',
        file: assertion.ancestorTitles?.[0] || suiteName,
        remediation: 'Implement proper input length validation',
      };
    }

    if (title.includes('injection') && !title.includes('SQL')) {
      return {
        type: 'HIGH',
        description: 'Code injection vulnerability detected',
        file: assertion.ancestorTitles?.[0] || suiteName,
        remediation: 'Implement input validation and sanitization',
      };
    }

    // Cryptographic issues
    if (title.includes('weak') && title.includes('crypto')) {
      return {
        type: 'MEDIUM',
        description: 'Weak cryptographic implementation',
        file: assertion.ancestorTitles?.[0] || suiteName,
        remediation: 'Use strong cryptographic algorithms and proper key management',
      };
    }

    if (title.includes('insecure') && (title.includes('random') || title.includes('entropy'))) {
      return {
        type: 'MEDIUM',
        description: 'Insecure random number generation',
        file: assertion.ancestorTitles?.[0] || suiteName,
        remediation: 'Use cryptographically secure random number generators',
      };
    }

    // Generic security issue
    if (title.includes('security') || title.includes('vulnerability')) {
      return {
        type: 'MEDIUM',
        description: `Security test failure: ${title}`,
        file: assertion.ancestorTitles?.[0] || suiteName,
        remediation: 'Review test failure details and implement appropriate fixes',
      };
    }

    return null;
  }

  static analyzeSecurityIssues(testOutput: any, suiteName: string): SecurityIssue[] {
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

  static generateSecurityRecommendations(issues: SecurityIssue[]): string[] {
    const recommendations = new Set<string>();

    issues.forEach((issue) => {
      if (issue.remediation) {
        recommendations.add(issue.remediation);
      }
    });

    // Add general security recommendations
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

    return Array.from(recommendations);
  }

  static calculateSecurityScore(issues: SecurityIssue[]): { score: number; grade: string } {
    const weights = {
      CRITICAL: 10,
      HIGH: 5,
      MEDIUM: 2,
      LOW: 1,
    };

    const totalPenalty = issues.reduce((sum, issue) => {
      return sum + weights[issue.type];
    }, 0);

    // Base score of 100, subtract penalties
    const score = Math.max(0, 100 - totalPenalty);

    let grade: string;
    if (score >= 95) grade = 'A+';
    else if (score >= 90) grade = 'A';
    else if (score >= 85) grade = 'B+';
    else if (score >= 80) grade = 'B';
    else if (score >= 75) grade = 'C+';
    else if (score >= 70) grade = 'C';
    else if (score >= 60) grade = 'D';
    else grade = 'F';

    return { score, grade };
  }

  static generateSecuritySummary(issues: SecurityIssue[]): {
    critical: number;
    high: number;
    medium: number;
    low: number;
    totalRiskScore: number;
    topVulnerabilities: string[];
  } {
    const critical = issues.filter((i) => i.type === 'CRITICAL').length;
    const high = issues.filter((i) => i.type === 'HIGH').length;
    const medium = issues.filter((i) => i.type === 'MEDIUM').length;
    const low = issues.filter((i) => i.type === 'LOW').length;

    const totalRiskScore = critical * 10 + high * 5 + medium * 2 + low * 1;

    // Get top vulnerabilities by frequency
    const vulnerabilityTypes = issues.reduce((acc, issue) => {
      acc[issue.description] = (acc[issue.description] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const topVulnerabilities = Object.entries(vulnerabilityTypes)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([type]) => type);

    return {
      critical,
      high,
      medium,
      low,
      totalRiskScore,
      topVulnerabilities,
    };
  }
}

export { SecurityIssueAnalyzer };
