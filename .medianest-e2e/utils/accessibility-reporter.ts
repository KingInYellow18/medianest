import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { AccessibilityReport, AccessibilityTestResult } from './accessibility-utils';
import { CrossPageInsights } from '../fixtures/accessibility-fixtures';

/**
 * Comprehensive accessibility reporting system with automated screenshots
 * and remediation suggestions for MediaNest project
 */

export class AccessibilityReporter {
  private readonly reportsDir: string;
  private readonly screenshotsDir: string;

  constructor(baseDir: string = '.medianest-e2e/reports') {
    this.reportsDir = join(process.cwd(), baseDir);
    this.screenshotsDir = join(this.reportsDir, 'screenshots');
  }

  /**
   * Initialize reporting directories
   */
  async initialize(): Promise<void> {
    await mkdir(this.reportsDir, { recursive: true });
    await mkdir(this.screenshotsDir, { recursive: true });
  }

  /**
   * Generate comprehensive HTML accessibility report
   */
  async generateHtmlReport(
    report: AccessibilityReport,
    testName: string,
    screenshotPath?: string
  ): Promise<string> {
    const html = this.buildHtmlReport(report, testName, screenshotPath);
    const filename = `accessibility-report-${testName}-${Date.now()}.html`;
    const filepath = join(this.reportsDir, filename);
    
    await writeFile(filepath, html);
    return filepath;
  }

  /**
   * Generate JSON report with detailed violation information
   */
  async generateJsonReport(
    report: AccessibilityReport,
    testName: string
  ): Promise<string> {
    const enhancedReport = {
      ...report,
      metadata: {
        testName,
        generatedAt: new Date().toISOString(),
        reportVersion: '2.0.0',
        framework: 'Playwright + Axe-core',
        project: 'MediaNest'
      },
      remediation: this.generateRemediationSuggestions(report),
      compliance: this.generateComplianceReport(report)
    };

    const filename = `accessibility-report-${testName}-${Date.now()}.json`;
    const filepath = join(this.reportsDir, filename);
    
    await writeFile(filepath, JSON.stringify(enhancedReport, null, 2));
    return filepath;
  }

  /**
   * Generate CSV report for spreadsheet analysis
   */
  async generateCsvReport(
    reports: AccessibilityReport[],
    filename: string = 'accessibility-summary'
  ): Promise<string> {
    const headers = [
      'URL',
      'Test Date',
      'Overall Score',
      'Total Violations',
      'Critical Violations',
      'Serious Violations',
      'Moderate Violations',
      'Minor Violations',
      'Keyboard Accessibility %',
      'Color Contrast Pass Rate',
      'Has Proper Landmarks',
      'Has Focus Management'
    ];

    const rows = reports.map(report => [
      report.url,
      report.timestamp,
      report.overallScore,
      report.summary.totalViolations,
      report.summary.criticalIssues,
      report.audit.summary.seriousViolations,
      report.audit.summary.moderateViolations,
      report.audit.summary.minorViolations,
      Math.round(report.summary.keyboardAccessibilityRate * 100),
      Math.round(report.summary.contrastPassRate * 100),
      report.summary.hasProperLandmarks ? 'Yes' : 'No',
      report.summary.hasFocusManagement ? 'Yes' : 'No'
    ]);

    const csv = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const filepath = join(this.reportsDir, `${filename}-${Date.now()}.csv`);
    await writeFile(filepath, csv);
    return filepath;
  }

  /**
   * Generate violation-specific reports with screenshots
   */
  async generateViolationReport(
    violations: any[],
    testName: string,
    screenshotPaths: string[] = []
  ): Promise<string> {
    const violationsByImpact = this.groupViolationsByImpact(violations);
    
    const report = {
      summary: {
        totalViolations: violations.length,
        byImpact: violationsByImpact,
        testName,
        timestamp: new Date().toISOString()
      },
      violations: violations.map(violation => ({
        ...violation,
        remediation: this.getViolationRemediation(violation),
        priority: this.calculateViolationPriority(violation),
        estimatedEffort: this.estimateFixEffort(violation)
      })),
      screenshots: screenshotPaths,
      recommendations: this.generateViolationRecommendations(violations)
    };

    const filename = `violations-${testName}-${Date.now()}.json`;
    const filepath = join(this.reportsDir, filename);
    
    await writeFile(filepath, JSON.stringify(report, null, 2));
    return filepath;
  }

  /**
   * Generate cross-page accessibility insights report
   */
  async generateCrossPageReport(insights: CrossPageInsights): Promise<string> {
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Cross-Page Accessibility Insights - MediaNest</title>
    <style>
        ${this.getReportStyles()}
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>Cross-Page Accessibility Insights</h1>
            <p class="subtitle">MediaNest Application Analysis</p>
            <div class="metadata">
                Generated: ${new Date().toLocaleString()}<br>
                Pages Analyzed: ${insights.totalPagesTesteds}<br>
                Average Score: ${insights.averageScore.toFixed(1)}/100
            </div>
        </header>

        <section class="summary-cards">
            <div class="card">
                <h3>Overall Health</h3>
                <div class="score ${this.getScoreClass(insights.averageScore)}">
                    ${insights.averageScore.toFixed(1)}/100
                </div>
            </div>
            <div class="card">
                <h3>Pages Tested</h3>
                <div class="metric">${insights.totalPagesTesteds}</div>
            </div>
            <div class="card">
                <h3>Common Issues</h3>
                <div class="metric">${insights.mostCommonViolations.length}</div>
            </div>
        </section>

        <section class="violations-section">
            <h2>Most Common Violations</h2>
            <div class="violations-list">
                ${insights.mostCommonViolations.map(violation => `
                    <div class="violation-item ${violation.impact}">
                        <div class="violation-header">
                            <h3>${violation.id}</h3>
                            <span class="impact-badge ${violation.impact}">${violation.impact}</span>
                        </div>
                        <p>${violation.description}</p>
                        <div class="violation-stats">
                            <span>Affects ${violation.count} pages</span>
                            <span>Pages: ${violation.pages.slice(0, 3).join(', ')}${violation.pages.length > 3 ? '...' : ''}</span>
                        </div>
                    </div>
                `).join('')}
            </div>
        </section>

        <section class="pages-section">
            <h2>Pages by Accessibility Score</h2>
            <div class="pages-list">
                ${insights.pagesByScore.map(page => `
                    <div class="page-item">
                        <div class="page-info">
                            <strong>${page.url}</strong>
                            <div class="score ${this.getScoreClass(page.score)}">${page.score}/100</div>
                        </div>
                        <div class="page-stats">
                            ${page.violations} violations • Tested ${new Date(page.timestamp).toLocaleDateString()}
                        </div>
                    </div>
                `).join('')}
            </div>
        </section>

        <section class="recommendations-section">
            <h2>Global Recommendations</h2>
            <ul class="recommendations-list">
                ${insights.recommendations.map(rec => `<li>${rec}</li>`).join('')}
            </ul>
        </section>
    </div>
</body>
</html>`;

    const filename = `cross-page-insights-${Date.now()}.html`;
    const filepath = join(this.reportsDir, filename);
    
    await writeFile(filepath, html);
    return filepath;
  }

  /**
   * Generate progressive accessibility testing report
   */
  async generateProgressiveReport(
    results: { basic: any; standard: any; comprehensive: AccessibilityReport },
    testName: string
  ): Promise<string> {
    const report = {
      testName,
      timestamp: new Date().toISOString(),
      progression: {
        basic: {
          score: results.basic.summary.complianceScore,
          violations: results.basic.violations?.length || 0,
          level: 'WCAG 2.0 A'
        },
        standard: {
          score: results.standard.summary.complianceScore,
          violations: results.standard.violations?.length || 0,
          level: 'WCAG 2.0 AA'
        },
        comprehensive: {
          score: results.comprehensive.overallScore,
          violations: results.comprehensive.summary.totalViolations,
          level: 'WCAG 2.1 AA + Custom'
        }
      },
      improvement: {
        basicToStandard: results.standard.summary.complianceScore - results.basic.summary.complianceScore,
        standardToComprehensive: results.comprehensive.overallScore - results.standard.summary.complianceScore
      },
      detailedResults: results,
      nextSteps: this.generateProgressiveRecommendations(results)
    };

    const filename = `progressive-report-${testName}-${Date.now()}.json`;
    const filepath = join(this.reportsDir, filename);
    
    await writeFile(filepath, JSON.stringify(report, null, 2));
    return filepath;
  }

  /**
   * Take and save accessibility violation screenshots
   */
  async captureViolationScreenshots(
    page: any,
    violations: any[],
    testName: string
  ): Promise<string[]> {
    const screenshots: string[] = [];

    for (let i = 0; i < Math.min(violations.length, 5); i++) {
      const violation = violations[i];
      
      try {
        // Highlight violation elements
        await page.evaluate((violationData) => {
          const selectors = violationData.nodes?.map((n: any) => n.target).flat() || [];
          selectors.forEach((selector: string) => {
            try {
              const elements = document.querySelectorAll(selector);
              elements.forEach((el: any) => {
                el.style.outline = '3px solid red';
                el.style.outlineOffset = '2px';
              });
            } catch (e) {
              console.warn('Could not highlight element:', selector);
            }
          });
        }, violation);

        // Take screenshot
        const filename = `violation-${testName}-${violation.id}-${i + 1}-${Date.now()}.png`;
        const filepath = join(this.screenshotsDir, filename);
        
        await page.screenshot({
          path: filepath,
          fullPage: true
        });

        screenshots.push(filename);

        // Remove highlights
        await page.evaluate((violationData) => {
          const selectors = violationData.nodes?.map((n: any) => n.target).flat() || [];
          selectors.forEach((selector: string) => {
            try {
              const elements = document.querySelectorAll(selector);
              elements.forEach((el: any) => {
                el.style.outline = '';
                el.style.outlineOffset = '';
              });
            } catch (e) {
              // Ignore cleanup errors
            }
          });
        }, violation);

      } catch (error) {
        console.warn(`Failed to capture screenshot for violation ${violation.id}:`, error);
      }
    }

    return screenshots;
  }

  /**
   * Build comprehensive HTML report
   */
  private buildHtmlReport(
    report: AccessibilityReport,
    testName: string,
    screenshotPath?: string
  ): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Accessibility Report - ${testName}</title>
    <style>
        ${this.getReportStyles()}
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>Accessibility Report</h1>
            <p class="subtitle">${testName}</p>
            <div class="metadata">
                URL: ${report.url}<br>
                Generated: ${new Date(report.timestamp).toLocaleString()}<br>
                Overall Score: <span class="score ${this.getScoreClass(report.overallScore)}">${report.overallScore}/100</span>
            </div>
        </header>

        ${screenshotPath ? `
        <section class="screenshot-section">
            <h2>Page Screenshot</h2>
            <img src="${screenshotPath}" alt="Page screenshot" class="screenshot">
        </section>
        ` : ''}

        <section class="summary-section">
            <h2>Summary</h2>
            <div class="summary-grid">
                <div class="summary-item">
                    <h3>Total Violations</h3>
                    <div class="metric">${report.summary.totalViolations}</div>
                </div>
                <div class="summary-item">
                    <h3>Critical Issues</h3>
                    <div class="metric critical">${report.summary.criticalIssues}</div>
                </div>
                <div class="summary-item">
                    <h3>Keyboard Accessibility</h3>
                    <div class="metric">${Math.round(report.summary.keyboardAccessibilityRate * 100)}%</div>
                </div>
                <div class="summary-item">
                    <h3>Color Contrast</h3>
                    <div class="metric">${Math.round(report.summary.contrastPassRate * 100)}%</div>
                </div>
            </div>
        </section>

        <section class="violations-section">
            <h2>Violations by Impact</h2>
            ${this.buildViolationsHtml(report.audit.violations)}
        </section>

        <section class="recommendations-section">
            <h2>Recommendations</h2>
            <ul class="recommendations-list">
                ${report.recommendations.map(rec => `<li>${rec}</li>`).join('')}
            </ul>
        </section>

        <section class="details-section">
            <h2>Detailed Results</h2>
            <div class="details-tabs">
                <div class="tab-content">
                    <h3>Keyboard Navigation</h3>
                    <p>Total Interactive Elements: ${report.keyboardNavigation.totalInteractiveElements}</p>
                    <p>Keyboard Accessible: ${report.keyboardNavigation.keyboardAccessibleElements}</p>
                    <p>Success Rate: ${Math.round((report.keyboardNavigation.keyboardAccessibleElements / report.keyboardNavigation.totalInteractiveElements) * 100)}%</p>
                </div>
                
                <div class="tab-content">
                    <h3>Screen Reader Support</h3>
                    <p>Landmarks: ${report.screenReader.landmarksCount}</p>
                    <p>Headings: ${report.screenReader.headingStructure.length}</p>
                    <p>ARIA Labels: ${report.screenReader.ariaLabels}</p>
                    <p>Live Regions: ${report.screenReader.liveRegions}</p>
                </div>
            </div>
        </section>
    </div>
</body>
</html>`;
  }

  /**
   * Generate remediation suggestions based on violations
   */
  private generateRemediationSuggestions(report: AccessibilityReport): any {
    const suggestions: any = {
      immediate: [],
      shortTerm: [],
      longTerm: []
    };

    report.audit.violations.forEach(violation => {
      const suggestion = this.getViolationRemediation(violation);
      
      if (violation.impact === 'critical') {
        suggestions.immediate.push(suggestion);
      } else if (violation.impact === 'serious') {
        suggestions.shortTerm.push(suggestion);
      } else {
        suggestions.longTerm.push(suggestion);
      }
    });

    return suggestions;
  }

  /**
   * Generate compliance report based on WCAG standards
   */
  private generateComplianceReport(report: AccessibilityReport): any {
    const compliance = {
      wcag2a: { passed: 0, failed: 0, notApplicable: 0 },
      wcag2aa: { passed: 0, failed: 0, notApplicable: 0 },
      wcag21aa: { passed: 0, failed: 0, notApplicable: 0 }
    };

    // Simplified compliance calculation
    const totalChecks = report.audit.violations.length + 50; // Estimate total checks
    const failedChecks = report.audit.violations.length;
    const passedChecks = totalChecks - failedChecks;

    compliance.wcag2a.passed = Math.round(passedChecks * 0.8);
    compliance.wcag2a.failed = Math.round(failedChecks * 0.8);
    
    compliance.wcag2aa.passed = Math.round(passedChecks * 0.9);
    compliance.wcag2aa.failed = Math.round(failedChecks * 0.9);
    
    compliance.wcag21aa.passed = passedChecks;
    compliance.wcag21aa.failed = failedChecks;

    return compliance;
  }

  /**
   * Get violation-specific remediation guidance
   */
  private getViolationRemediation(violation: any): any {
    const remediationMap: { [key: string]: any } = {
      'color-contrast': {
        title: 'Improve Color Contrast',
        description: 'Increase the contrast ratio between text and background colors',
        steps: [
          'Use a color contrast checker tool',
          'Aim for 4.5:1 ratio for normal text',
          'Aim for 3:1 ratio for large text',
          'Consider using design system colors'
        ],
        tools: ['WebAIM Contrast Checker', 'Color Oracle'],
        effort: 'low'
      },
      'label': {
        title: 'Add Form Labels',
        description: 'Associate form controls with descriptive labels',
        steps: [
          'Add <label> elements for each form control',
          'Use for/id attributes to associate labels',
          'Consider aria-label for icon buttons',
          'Ensure labels are descriptive'
        ],
        effort: 'medium'
      },
      'heading-order': {
        title: 'Fix Heading Hierarchy',
        description: 'Ensure headings follow proper hierarchical order',
        steps: [
          'Start with one H1 per page',
          'Use H2-H6 in sequential order',
          'Don\'t skip heading levels',
          'Use headings for structure, not styling'
        ],
        effort: 'medium'
      }
    };

    return remediationMap[violation.id] || {
      title: `Fix ${violation.id}`,
      description: violation.description,
      steps: ['Review WCAG guidelines for this rule'],
      effort: 'medium'
    };
  }

  /**
   * Calculate violation priority for remediation
   */
  private calculateViolationPriority(violation: any): number {
    const impactWeight = {
      'critical': 4,
      'serious': 3,
      'moderate': 2,
      'minor': 1
    };

    const frequencyWeight = violation.nodes?.length || 1;
    return (impactWeight[violation.impact as keyof typeof impactWeight] || 1) * Math.min(frequencyWeight, 5);
  }

  /**
   * Estimate effort required to fix violation
   */
  private estimateFixEffort(violation: any): 'low' | 'medium' | 'high' {
    const lowEffortRules = ['color-contrast', 'image-alt', 'link-name'];
    const highEffortRules = ['keyboard-navigation', 'focus-order-semantics', 'aria-required-children'];

    if (lowEffortRules.includes(violation.id)) return 'low';
    if (highEffortRules.includes(violation.id)) return 'high';
    return 'medium';
  }

  /**
   * Group violations by impact level
   */
  private groupViolationsByImpact(violations: any[]): any {
    return violations.reduce((acc, violation) => {
      acc[violation.impact] = (acc[violation.impact] || 0) + 1;
      return acc;
    }, {});
  }

  /**
   * Generate recommendations based on violation patterns
   */
  private generateViolationRecommendations(violations: any[]): string[] {
    const recommendations: string[] = [];
    const violationTypes = new Set(violations.map(v => v.id));

    if (violationTypes.has('color-contrast')) {
      recommendations.push('Implement a design system with validated color combinations');
    }

    if (violationTypes.has('label') || violationTypes.has('form-field-multiple-labels')) {
      recommendations.push('Standardize form labeling patterns across the application');
    }

    if (violationTypes.has('heading-order')) {
      recommendations.push('Create a heading style guide and enforce consistent usage');
    }

    if (violations.filter(v => v.impact === 'critical').length > 0) {
      recommendations.push('Address critical violations immediately to ensure basic accessibility');
    }

    return recommendations;
  }

  /**
   * Generate recommendations for progressive testing
   */
  private generateProgressiveRecommendations(results: any): string[] {
    const recommendations: string[] = [];

    if (results.basic.violations?.length > 0) {
      recommendations.push('Focus on basic WCAG 2.0 A compliance first');
    }

    if (results.comprehensive.overallScore < 80) {
      recommendations.push('Consider accessibility training for the development team');
    }

    if (results.comprehensive.summary.keyboardAccessibilityRate < 0.9) {
      recommendations.push('Implement comprehensive keyboard testing in CI/CD pipeline');
    }

    return recommendations;
  }

  /**
   * Build violations HTML section
   */
  private buildViolationsHtml(violations: any[]): string {
    const violationsByImpact = this.groupViolationsByImpact(violations);
    
    return Object.entries(violationsByImpact)
      .sort(([a], [b]) => this.getImpactWeight(b as string) - this.getImpactWeight(a as string))
      .map(([impact, count]) => `
        <div class="impact-section">
            <h3 class="impact-title ${impact}">${impact.toUpperCase()} (${count})</h3>
            ${violations
              .filter(v => v.impact === impact)
              .map(violation => `
                <div class="violation-item">
                    <h4>${violation.id}</h4>
                    <p>${violation.description}</p>
                    <div class="violation-help">
                        <strong>How to fix:</strong> ${violation.help}
                    </div>
                    ${violation.helpUrl ? `<a href="${violation.helpUrl}" target="_blank">Learn more</a>` : ''}
                </div>
              `).join('')}
        </div>
      `).join('');
  }

  /**
   * Get CSS styles for HTML reports
   */
  private getReportStyles(): string {
    return `
      * { box-sizing: border-box; }
      body { 
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        line-height: 1.6; 
        margin: 0; 
        background: #f8f9fa; 
        color: #333;
      }
      .container { 
        max-width: 1200px; 
        margin: 0 auto; 
        padding: 20px; 
      }
      header { 
        background: white; 
        padding: 2rem; 
        border-radius: 8px; 
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        margin-bottom: 2rem;
      }
      h1 { 
        color: #2563eb; 
        margin: 0 0 0.5rem 0;
        font-size: 2.5rem;
      }
      .subtitle { 
        color: #64748b; 
        font-size: 1.2rem;
        margin: 0 0 1rem 0;
      }
      .metadata { 
        color: #64748b; 
        font-size: 0.9rem;
        line-height: 1.8;
      }
      .score { 
        font-weight: bold; 
        font-size: 1.1em;
        padding: 2px 8px;
        border-radius: 4px;
      }
      .score.excellent { background: #dcfce7; color: #166534; }
      .score.good { background: #fef3c7; color: #92400e; }
      .score.fair { background: #fed7aa; color: #c2410c; }
      .score.poor { background: #fecaca; color: #dc2626; }
      
      .summary-section, .violations-section, .recommendations-section, .details-section {
        background: white;
        padding: 2rem;
        margin-bottom: 2rem;
        border-radius: 8px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      }
      
      .summary-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 1rem;
        margin-top: 1rem;
      }
      
      .summary-item {
        text-align: center;
        padding: 1rem;
        background: #f8f9fa;
        border-radius: 6px;
      }
      
      .summary-item h3 {
        margin: 0 0 0.5rem 0;
        font-size: 0.9rem;
        color: #64748b;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }
      
      .metric {
        font-size: 2rem;
        font-weight: bold;
        color: #2563eb;
      }
      
      .metric.critical { color: #dc2626; }
      
      .violation-item {
        border-left: 4px solid #e5e7eb;
        padding: 1rem;
        margin-bottom: 1rem;
        background: #f9fafb;
        border-radius: 0 6px 6px 0;
      }
      
      .violation-item.critical { border-color: #dc2626; }
      .violation-item.serious { border-color: #f59e0b; }
      .violation-item.moderate { border-color: #3b82f6; }
      .violation-item.minor { border-color: #6b7280; }
      
      .impact-title {
        color: #374151;
        margin: 1.5rem 0 1rem 0;
        padding-bottom: 0.5rem;
        border-bottom: 2px solid #e5e7eb;
      }
      
      .impact-title.critical { color: #dc2626; border-color: #dc2626; }
      .impact-title.serious { color: #f59e0b; border-color: #f59e0b; }
      .impact-title.moderate { color: #3b82f6; border-color: #3b82f6; }
      .impact-title.minor { color: #6b7280; border-color: #6b7280; }
      
      .recommendations-list {
        padding-left: 1.5rem;
      }
      
      .recommendations-list li {
        margin-bottom: 0.5rem;
        color: #4b5563;
      }
      
      .screenshot {
        max-width: 100%;
        height: auto;
        border: 1px solid #e5e7eb;
        border-radius: 6px;
        box-shadow: 0 4px 16px rgba(0,0,0,0.1);
      }
      
      .tab-content {
        background: #f8f9fa;
        padding: 1rem;
        margin-bottom: 1rem;
        border-radius: 6px;
      }
      
      .tab-content h3 {
        margin-top: 0;
        color: #2563eb;
      }
      
      .violation-help {
        margin-top: 0.5rem;
        padding: 0.5rem;
        background: #eff6ff;
        border-radius: 4px;
        font-size: 0.9rem;
      }
      
      .impact-badge {
        display: inline-block;
        padding: 2px 8px;
        border-radius: 12px;
        font-size: 0.75rem;
        font-weight: bold;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }
      
      .impact-badge.critical { background: #fecaca; color: #dc2626; }
      .impact-badge.serious { background: #fed7aa; color: #c2410c; }
      .impact-badge.moderate { background: #dbeafe; color: #2563eb; }
      .impact-badge.minor { background: #f3f4f6; color: #6b7280; }
      
      @media (max-width: 768px) {
        .container { padding: 1rem; }
        .summary-grid { grid-template-columns: 1fr; }
        h1 { font-size: 2rem; }
      }
    `;
  }

  /**
   * Get CSS class for accessibility score
   */
  private getScoreClass(score: number): string {
    if (score >= 90) return 'excellent';
    if (score >= 75) return 'good';
    if (score >= 60) return 'fair';
    return 'poor';
  }

  /**
   * Get numeric weight for impact level
   */
  private getImpactWeight(impact: string): number {
    const weights = { critical: 4, serious: 3, moderate: 2, minor: 1 };
    return weights[impact as keyof typeof weights] || 0;
  }
}

export default AccessibilityReporter;