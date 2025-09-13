/**
 * NULL SAFETY REPORTING SYSTEM
 * Generates comprehensive null safety reports and metrics
 */

import type { NullSafetyViolation, NullSafetyAuditResult } from './null-safety-audit';

export interface NullSafetyReport {
  timestamp: Date;
  auditResult: NullSafetyAuditResult;
  summary: {
    totalFiles: number;
    violationsPerSeverity: Record<string, number>;
    topRiskAreas: string[];
    improvementTrends: string[];
  };
  recommendations: {
    immediate: string[];
    shortTerm: string[];
    longTerm: string[];
  };
}

/**
 * Generates comprehensive null safety reports
 */
export class NullSafetyReporter {
  /**
   * Generate a comprehensive null safety report
   */
  generateReport(auditResult: NullSafetyAuditResult): NullSafetyReport {
    const violations = [
      ...auditResult.criticalViolations,
      ...auditResult.highPriorityViolations,
      ...auditResult.mediumPriorityViolations,
      ...auditResult.lowPriorityViolations
    ];

    const violationsPerSeverity = violations.reduce((acc, violation) => {
      acc[violation.severity] = (acc[violation.severity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const topRiskAreas = violations
      .filter(v => v.riskLevel >= 7)
      .map(v => v.location)
      .slice(0, 5);

    return {
      timestamp: new Date(),
      auditResult,
      summary: {
        totalFiles: 0, // Would be calculated from actual file scan
        violationsPerSeverity,
        topRiskAreas,
        improvementTrends: this.calculateTrends(auditResult)
      },
      recommendations: this.generateRecommendations(auditResult)
    };
  }

  private calculateTrends(auditResult: NullSafetyAuditResult): string[] {
    const trends: string[] = [];
    
    if (auditResult.criticalViolations.length > 0) {
      trends.push(`${auditResult.criticalViolations.length} critical violations need immediate attention`);
    }
    
    if (auditResult.overallScore < 70) {
      trends.push('Overall null safety score is below acceptable threshold');
    }
    
    return trends;
  }

  private generateRecommendations(auditResult: NullSafetyAuditResult): NullSafetyReport['recommendations'] {
    const immediate: string[] = [];
    const shortTerm: string[] = [];
    const longTerm: string[] = [];

    if (auditResult.criticalViolations.length > 0) {
      immediate.push('Address all critical null safety violations immediately');
      immediate.push('Implement strict null checking in critical paths');
    }

    if (auditResult.highPriorityViolations.length > 0) {
      shortTerm.push('Refactor high-priority violation areas');
      shortTerm.push('Add comprehensive null checking middleware');
    }

    longTerm.push('Implement comprehensive type safety across codebase');
    longTerm.push('Add automated null safety testing to CI/CD pipeline');

    return { immediate, shortTerm, longTerm };
  }

  /**
   * Export report to JSON format
   */
  exportToJson(report: NullSafetyReport): string {
    return JSON.stringify(report, null, 2);
  }

  /**
   * Generate summary text for report
   */
  generateSummary(report: NullSafetyReport): string {
    const { auditResult } = report;
    
    return `
NULL SAFETY REPORT SUMMARY
=========================
Generated: ${report.timestamp.toISOString()}
Overall Score: ${auditResult.overallScore}/100

Violations by Severity:
- Critical: ${auditResult.criticalViolations.length}
- High: ${auditResult.highPriorityViolations.length}
- Medium: ${auditResult.mediumPriorityViolations.length}
- Low: ${auditResult.lowPriorityViolations.length}

Top Risk Areas:
${report.summary.topRiskAreas.map(area => `- ${area}`).join('\n')}

Immediate Actions Required:
${report.recommendations.immediate.map(rec => `- ${rec}`).join('\n')}
    `.trim();
  }
}