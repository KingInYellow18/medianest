import { test as base, expect } from '@playwright/test';
import { AccessibilityTester, AccessibilityReport } from '../utils/accessibility-utils';
import { AriaValidator } from '../utils/aria-validator';
import { SemanticHtmlValidator } from '../utils/semantic-html-validator';
import { ContextType } from '../config/axe-config';

/**
 * Accessibility-specific test fixtures for MediaNest
 * Provides comprehensive accessibility testing capabilities
 */

export interface AccessibilityFixtures {
  accessibilityTester: AccessibilityTester;
  ariaValidator: AriaValidator;
  semanticValidator: SemanticHtmlValidator;
  accessibilityReport: AccessibilityReport;
  hiveCoordinator: HiveAccessibilityCoordinator;
}

export interface AccessibilityWorkerFixtures {
  accessibilityConfig: AccessibilityConfig;
}

export interface AccessibilityConfig {
  enableAutoScreenshots: boolean;
  violationThreshold: 'none' | 'minor' | 'moderate' | 'serious' | 'critical';
  skipComplexComponents: boolean;
  enableHiveCoordination: boolean;
  reportFormat: 'json' | 'html' | 'csv';
}

// HIVE-MIND coordination for accessibility testing
export class HiveAccessibilityCoordinator {
  private sharedState: Map<string, any> = new Map();
  private testResults: AccessibilityReport[] = [];

  constructor() {
    this.initializeHiveCoordination();
  }

  private initializeHiveCoordination(): void {
    // Initialize shared memory for cross-test coordination
    this.sharedState.set('globalViolations', []);
    this.sharedState.set('testedPages', []);
    this.sharedState.set('commonPatterns', []);
    this.sharedState.set('regressionBaseline', null);
  }

  /**
   * Store test result in shared state
   */
  storeTestResult(pageUrl: string, report: AccessibilityReport): void {
    this.testResults.push(report);
    
    const testedPages = this.sharedState.get('testedPages') || [];
    testedPages.push({
      url: pageUrl,
      timestamp: new Date().toISOString(),
      score: report.overallScore,
      violations: report.summary.totalViolations
    });
    this.sharedState.set('testedPages', testedPages);

    // Track global violations patterns
    const globalViolations = this.sharedState.get('globalViolations') || [];
    report.audit.violations.forEach(violation => {
      const existingPattern = globalViolations.find((v: any) => v.id === violation.id);
      if (existingPattern) {
        existingPattern.count++;
        existingPattern.pages.push(pageUrl);
      } else {
        globalViolations.push({
          id: violation.id,
          count: 1,
          pages: [pageUrl],
          impact: violation.impact,
          description: violation.description
        });
      }
    });
    this.sharedState.set('globalViolations', globalViolations);
  }

  /**
   * Get shared violations across all tests
   */
  getSharedViolations(): any[] {
    return this.sharedState.get('globalViolations') || [];
  }

  /**
   * Get accessibility patterns that appear across multiple pages
   */
  getCommonAccessibilityPatterns(): any[] {
    const violations = this.getSharedViolations();
    return violations.filter((v: any) => v.count > 1);
  }

  /**
   * Check if accessibility regression occurred
   */
  checkForRegressions(currentReport: AccessibilityReport): AccessibilityRegression[] {
    const baseline = this.sharedState.get('regressionBaseline');
    if (!baseline) return [];

    const regressions: AccessibilityRegression[] = [];

    // Check score regression
    if (currentReport.overallScore < baseline.overallScore - 5) {
      regressions.push({
        type: 'score',
        message: `Accessibility score decreased from ${baseline.overallScore} to ${currentReport.overallScore}`,
        severity: 'moderate'
      });
    }

    // Check for new violations
    const newViolations = currentReport.audit.violations.filter(v => 
      !baseline.violations.some((bv: any) => bv.id === v.id)
    );

    if (newViolations.length > 0) {
      regressions.push({
        type: 'new-violations',
        message: `${newViolations.length} new accessibility violations found`,
        violations: newViolations,
        severity: 'serious'
      });
    }

    return regressions;
  }

  /**
   * Set regression baseline
   */
  setRegressionBaseline(report: AccessibilityReport): void {
    this.sharedState.set('regressionBaseline', {
      overallScore: report.overallScore,
      violations: report.audit.violations,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Generate cross-page accessibility insights
   */
  generateCrossPageInsights(): CrossPageInsights {
    const testedPages = this.sharedState.get('testedPages') || [];
    const globalViolations = this.getSharedViolations();
    
    const insights: CrossPageInsights = {
      totalPagesTesteds: testedPages.length,
      averageScore: testedPages.length > 0 ? 
        testedPages.reduce((sum: number, p: any) => sum + p.score, 0) / testedPages.length : 0,
      mostCommonViolations: globalViolations
        .sort((a: any, b: any) => b.count - a.count)
        .slice(0, 5),
      pagesByScore: testedPages.sort((a: any, b: any) => b.score - a.score),
      recommendations: this.generateGlobalRecommendations(globalViolations)
    };

    return insights;
  }

  private generateGlobalRecommendations(violations: any[]): string[] {
    const recommendations: string[] = [];
    
    const violationsByImpact = violations.reduce((acc: any, v: any) => {
      acc[v.impact] = (acc[v.impact] || 0) + v.count;
      return acc;
    }, {});

    if (violationsByImpact.critical > 0) {
      recommendations.push('Address critical accessibility violations immediately');
    }

    const commonViolations = violations.filter((v: any) => v.count > 2);
    if (commonViolations.length > 0) {
      recommendations.push('Focus on fixing violations that appear across multiple pages');
    }

    const colorContrastIssues = violations.filter((v: any) => v.id.includes('color-contrast'));
    if (colorContrastIssues.length > 0) {
      recommendations.push('Implement a design system with validated color combinations');
    }

    const formIssues = violations.filter((v: any) => 
      v.id.includes('label') || v.id.includes('form-field')
    );
    if (formIssues.length > 0) {
      recommendations.push('Standardize form accessibility patterns across the application');
    }

    return recommendations;
  }
}

// Extended test with accessibility fixtures
export const test = base.extend<AccessibilityFixtures, AccessibilityWorkerFixtures>({
  // Worker-scoped fixtures
  accessibilityConfig: [async ({}, use) => {
    const config: AccessibilityConfig = {
      enableAutoScreenshots: true,
      violationThreshold: 'serious',
      skipComplexComponents: false,
      enableHiveCoordination: true,
      reportFormat: 'json'
    };
    await use(config);
  }, { scope: 'worker' }],

  // Test-scoped fixtures
  accessibilityTester: async ({ page }, use) => {
    const tester = new AccessibilityTester(page);
    await tester.initialize();
    await use(tester);
  },

  ariaValidator: async ({ page }, use) => {
    const validator = new AriaValidator(page);
    await use(validator);
  },

  semanticValidator: async ({ page }, use) => {
    const validator = new SemanticHtmlValidator(page);
    await use(validator);
  },

  hiveCoordinator: async ({}, use) => {
    const coordinator = new HiveAccessibilityCoordinator();
    await use(coordinator);
  },

  accessibilityReport: async ({ 
    page, 
    accessibilityTester, 
    hiveCoordinator,
    accessibilityConfig
  }, use, testInfo) => {
    let report: AccessibilityReport;
    
    await use(report!);
    
    // Generate report after test completion
    try {
      report = await accessibilityTester.generateComprehensiveReport();
      
      // Store in HIVE coordination
      if (accessibilityConfig.enableHiveCoordination) {
        hiveCoordinator.storeTestResult(page.url(), report);
      }

      // Auto-screenshot on violations
      if (accessibilityConfig.enableAutoScreenshots && report.summary.totalViolations > 0) {
        const screenshot = await page.screenshot({ 
          fullPage: true,
          path: `test-results/${testInfo.title}-accessibility-violations.png`
        });
        
        await testInfo.attach('accessibility-violations', {
          body: screenshot,
          contentType: 'image/png'
        });
      }

      // Attach detailed report
      await testInfo.attach('accessibility-report.json', {
        body: JSON.stringify(report, null, 2),
        contentType: 'application/json'
      });

      // Check violation threshold
      const thresholdMap = {
        'none': 0,
        'minor': 1,
        'moderate': 2, 
        'serious': 3,
        'critical': 4
      };

      const violationLevel = Math.max(...report.audit.violations.map(v => {
        const impactMap: any = { minor: 1, moderate: 2, serious: 3, critical: 4 };
        return impactMap[v.impact] || 0;
      }), 0);

      const threshold = thresholdMap[accessibilityConfig.violationThreshold];
      
      if (violationLevel > threshold) {
        throw new Error(
          `Accessibility violations exceed threshold. ` +
          `Found ${report.summary.totalViolations} violations with highest impact: ` +
          `${report.audit.violations.find(v => v.impact === Object.keys(thresholdMap)[violationLevel])?.impact}`
        );
      }

    } catch (error) {
      console.error('Failed to generate accessibility report:', error);
    }
  }
});

// Accessibility-specific test utilities
export class AccessibilityTestUtils {
  /**
   * Run contextual accessibility audit
   */
  static async runContextualAudit(
    tester: AccessibilityTester, 
    context: ContextType
  ) {
    return await tester.runContextualAudit(context);
  }

  /**
   * Test accessibility across multiple user flows
   */
  static async testUserFlowAccessibility(
    page: any,
    flows: Array<{ name: string; steps: () => Promise<void> }>
  ): Promise<AccessibilityReport[]> {
    const reports: AccessibilityReport[] = [];
    const tester = new AccessibilityTester(page);
    await tester.initialize();

    for (const flow of flows) {
      console.log(`Testing accessibility for flow: ${flow.name}`);
      
      try {
        await flow.steps();
        await page.waitForLoadState('networkidle');
        
        const report = await tester.generateComprehensiveReport();
        report.url = `${report.url} (${flow.name})`;
        reports.push(report);
        
      } catch (error) {
        console.error(`Flow ${flow.name} failed:`, error);
      }
    }

    return reports;
  }

  /**
   * Progressive accessibility testing (basic → comprehensive)
   */
  static async runProgressiveTests(tester: AccessibilityTester): Promise<{
    basic: any;
    standard: any;
    comprehensive: AccessibilityReport;
  }> {
    console.log('Running progressive accessibility tests...');
    
    const basic = await tester.runBasicAudit();
    console.log(`Basic test complete. Score: ${basic.summary.complianceScore}`);
    
    const standard = await tester.runStandardAudit();  
    console.log(`Standard test complete. Score: ${standard.summary.complianceScore}`);
    
    const comprehensive = await tester.generateComprehensiveReport();
    console.log(`Comprehensive test complete. Overall score: ${comprehensive.overallScore}`);
    
    return { basic, standard, comprehensive };
  }

  /**
   * Compare accessibility across different states
   */
  static async compareAccessibilityStates(
    page: any,
    states: Array<{ name: string; setup: () => Promise<void> }>
  ): Promise<StateComparisonResult> {
    const tester = new AccessibilityTester(page);
    await tester.initialize();
    
    const results: { [key: string]: AccessibilityReport } = {};
    
    for (const state of states) {
      await state.setup();
      await page.waitForLoadState('networkidle');
      
      const report = await tester.generateComprehensiveReport();
      results[state.name] = report;
    }

    // Compare results
    const comparison: StateComparisonResult = {
      states: Object.keys(results),
      scores: Object.entries(results).map(([name, report]) => ({
        state: name,
        score: report.overallScore
      })),
      regressions: [],
      improvements: []
    };

    // Find regressions and improvements
    const scores = comparison.scores.sort((a, b) => b.score - a.score);
    const bestScore = scores[0].score;
    const worstScore = scores[scores.length - 1].score;

    if (bestScore - worstScore > 10) {
      comparison.regressions.push({
        type: 'score',
        message: `Significant score variation detected: ${worstScore} to ${bestScore}`,
        severity: 'moderate'
      });
    }

    return comparison;
  }
}

// Accessibility matchers for expect
export const accessibilityMatchers = {
  toHaveAccessibilityScore: (report: AccessibilityReport, expectedScore: number) => {
    const pass = report.overallScore >= expectedScore;
    return {
      pass,
      message: () => 
        pass 
          ? `Expected accessibility score to be below ${expectedScore}, but got ${report.overallScore}`
          : `Expected accessibility score to be at least ${expectedScore}, but got ${report.overallScore}`
    };
  },

  toHaveNoAccessibilityViolations: (report: AccessibilityReport) => {
    const pass = report.summary.totalViolations === 0;
    return {
      pass,
      message: () => 
        pass
          ? 'Expected to have accessibility violations, but found none'
          : `Expected no accessibility violations, but found ${report.summary.totalViolations}`
    };
  },

  toHaveNoCriticalViolations: (report: AccessibilityReport) => {
    const pass = report.summary.criticalIssues === 0;
    return {
      pass,
      message: () =>
        pass
          ? 'Expected to have critical accessibility violations, but found none'
          : `Expected no critical accessibility violations, but found ${report.summary.criticalIssues}`
    };
  }
};

// Add custom matchers to expect
expect.extend(accessibilityMatchers);

// Type definitions
export interface AccessibilityRegression {
  type: 'score' | 'new-violations' | 'pattern-change';
  message: string;
  violations?: any[];
  severity: 'minor' | 'moderate' | 'serious' | 'critical';
}

export interface CrossPageInsights {
  totalPagesTesteds: number;
  averageScore: number;
  mostCommonViolations: any[];
  pagesByScore: any[];
  recommendations: string[];
}

export interface StateComparisonResult {
  states: string[];
  scores: { state: string; score: number }[];
  regressions: AccessibilityRegression[];
  improvements: string[];
}

// Export the enhanced test
export { expect } from '@playwright/test';