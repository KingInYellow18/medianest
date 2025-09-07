import { AccessibilityReport } from './accessibility-utils';
import { writeFile, readFile, mkdir } from 'fs/promises';
import { join } from 'path';

/**
 * HIVE-MIND Accessibility Coordinator for MediaNest
 * Manages cross-test state sharing, pattern detection, and coordinated insights
 */

export class HiveAccessibilityCoordinator {
  private sharedState: Map<string, any> = new Map();
  private persistencePath: string;
  private sessionId: string;
  private testResults: AccessibilityReport[] = [];
  private patterns: AccessibilityPattern[] = [];
  private regressionBaseline: AccessibilityBaseline | null = null;

  constructor(sessionId: string = `hive-${Date.now()}`) {
    this.sessionId = sessionId;
    this.persistencePath = join(process.cwd(), '.medianest-e2e/reports/hive-coordination');
    this.initializeHiveCoordination();
  }

  /**
   * Initialize HIVE coordination system
   */
  private initializeHiveCoordination(): void {
    this.sharedState.set('sessionId', this.sessionId);
    this.sharedState.set('startTime', new Date().toISOString());
    this.sharedState.set('globalViolations', []);
    this.sharedState.set('testedPages', []);
    this.sharedState.set('componentPatterns', new Map());
    this.sharedState.set('userFlowInsights', []);
    this.sharedState.set('performanceMetrics', []);
    
    console.log(`HIVE-MIND Accessibility Coordinator initialized with session: ${this.sessionId}`);
  }

  /**
   * Store accessibility test result in shared coordination state
   */
  async storeTestResult(pageUrl: string, report: AccessibilityReport, context?: any): Promise<void> {
    // Store the complete report
    this.testResults.push(report);
    
    // Update tested pages
    const testedPages = this.sharedState.get('testedPages') || [];
    const pageEntry = {
      url: pageUrl,
      timestamp: new Date().toISOString(),
      score: report.overallScore,
      violations: report.summary.totalViolations,
      criticalIssues: report.summary.criticalIssues,
      keyboardAccessibility: report.summary.keyboardAccessibilityRate,
      context: context || {},
      sessionId: this.sessionId
    };
    
    testedPages.push(pageEntry);
    this.sharedState.set('testedPages', testedPages);

    // Update global violations patterns\n    await this.updateGlobalViolationPatterns(pageUrl, report.audit.violations);
    
    // Detect and store component patterns
    await this.detectAndStoreComponentPatterns(pageUrl, report);
    
    // Update performance metrics
    this.updatePerformanceMetrics(pageUrl, report);
    
    // Persist state to disk
    await this.persistState();
    
    console.log(`Stored accessibility results for ${pageUrl} in HIVE coordination`);
  }

  /**
   * Update global violation patterns across all tests
   */
  private async updateGlobalViolationPatterns(pageUrl: string, violations: any[]): Promise<void> {
    const globalViolations = this.sharedState.get('globalViolations') || [];
    
    violations.forEach(violation => {
      const existingPattern = globalViolations.find((v: any) => 
        v.id === violation.id && v.impact === violation.impact
      );
      
      if (existingPattern) {
        existingPattern.count++;
        existingPattern.pages.push(pageUrl);
        existingPattern.lastSeen = new Date().toISOString();
        
        // Track selectors affected
        if (violation.nodes) {
          violation.nodes.forEach((node: any) => {
            if (node.target && !existingPattern.selectors.includes(node.target[0])) {
              existingPattern.selectors.push(node.target[0]);
            }
          });
        }
      } else {\n        globalViolations.push({\n          id: violation.id,\n          count: 1,\n          pages: [pageUrl],\n          impact: violation.impact,\n          description: violation.description,\n          help: violation.help,\n          helpUrl: violation.helpUrl,\n          selectors: violation.nodes ? violation.nodes.map((n: any) => n.target[0]).filter(Boolean) : [],\n          firstSeen: new Date().toISOString(),\n          lastSeen: new Date().toISOString(),\n          tags: violation.tags || []\n        });
      }\n    });
    \n    this.sharedState.set('globalViolations', globalViolations);\n  }

  /**
   * Detect and store component accessibility patterns
   */
  private async detectAndStoreComponentPatterns(pageUrl: string, report: AccessibilityReport): Promise<void> {
    const componentPatterns = this.sharedState.get('componentPatterns') || new Map();
    
    // Analyze violations by component type (inferred from selectors)
    const componentTypes = this.inferComponentTypes(report.audit.violations);
    
    componentTypes.forEach(({ type, violations, selectors }) => {
      const patternKey = type;
      
      if (componentPatterns.has(patternKey)) {
        const existing = componentPatterns.get(patternKey);
        existing.occurrences++;
        existing.pages.add(pageUrl);
        existing.violations.push(...violations);
        existing.selectors = [...new Set([...existing.selectors, ...selectors])];
      } else {
        componentPatterns.set(patternKey, {
          type,
          occurrences: 1,
          pages: new Set([pageUrl]),
          violations,
          selectors,
          firstDetected: new Date().toISOString(),
          recommendations: this.generateComponentRecommendations(type, violations)
        });
      }
    });
    
    this.sharedState.set('componentPatterns', componentPatterns);
  }

  /**
   * Infer component types from violation selectors
   */
  private inferComponentTypes(violations: any[]): ComponentTypeInference[] {
    const componentMap = new Map<string, { violations: any[], selectors: string[] }>();
    
    violations.forEach(violation => {
      if (violation.nodes) {
        violation.nodes.forEach((node: any) => {
          const selector = node.target[0];
          const componentType = this.classifySelector(selector);
          
          if (!componentMap.has(componentType)) {
            componentMap.set(componentType, { violations: [], selectors: [] });
          }
          
          const component = componentMap.get(componentType)!;
          component.violations.push(violation);
          component.selectors.push(selector);
        });
      }
    });
    
    return Array.from(componentMap.entries()).map(([type, data]) => ({
      type,
      violations: data.violations,
      selectors: [...new Set(data.selectors)]
    }));
  }

  /**
   * Classify selector to component type
   */
  private classifySelector(selector: string): string {
    const patterns = [
      { pattern: /\[data-testid.*card\]/i, type: 'service-card' },
      { pattern: /\[data-testid.*nav\]/i, type: 'navigation' },
      { pattern: /\[data-testid.*modal\]/i, type: 'modal' },
      { pattern: /\[data-testid.*form\]/i, type: 'form' },
      { pattern: /\[data-testid.*button\]/i, type: 'button' },
      { pattern: /\[data-testid.*input\]/i, type: 'input' },
      { pattern: /\[data-testid.*loading\]/i, type: 'loading-state' },
      { pattern: /\[data-testid.*error\]/i, type: 'error-state' },
      { pattern: /form/i, type: 'form' },
      { pattern: /button/i, type: 'button' },
      { pattern: /input/i, type: 'input' },
      { pattern: /nav/i, type: 'navigation' },
      { pattern: /modal|dialog/i, type: 'modal' },
      { pattern: /table/i, type: 'table' },
      { pattern: /list/i, type: 'list' }
    ];
    
    for (const { pattern, type } of patterns) {
      if (pattern.test(selector)) {
        return type;
      }
    }
    
    return 'generic';
  }

  /**
   * Generate component-specific recommendations
   */
  private generateComponentRecommendations(componentType: string, violations: any[]): string[] {
    const recommendationMap: { [key: string]: string[] } = {
      'service-card': [
        'Ensure each service card has a descriptive heading',
        'Add aria-label to status indicators',
        'Make all card actions keyboard accessible'
      ],
      'form': [
        'Associate all form controls with labels',
        'Use fieldset and legend for related controls',
        'Ensure error messages are announced to screen readers'
      ],
      'navigation': [
        'Use semantic nav elements',
        'Provide skip links for keyboard users',
        'Label multiple navigation areas'
      ],
      'modal': [
        'Implement proper focus management',
        'Use aria-modal and role="dialog"',
        'Provide accessible close buttons'
      ],
      'loading-state': [
        'Use role="status" or aria-live for loading announcements',
        'Provide descriptive loading messages',
        'Ensure loading states are keyboard accessible'
      ]
    };
    
    return recommendationMap[componentType] || ['Follow WCAG guidelines for this component type'];
  }

  /**
   * Update performance metrics
   */
  private updatePerformanceMetrics(pageUrl: string, report: AccessibilityReport): void {
    const performanceMetrics = this.sharedState.get('performanceMetrics') || [];
    
    performanceMetrics.push({
      url: pageUrl,
      timestamp: new Date().toISOString(),
      overallScore: report.overallScore,
      totalViolations: report.summary.totalViolations,
      keyboardAccessibilityRate: report.summary.keyboardAccessibilityRate,
      contrastPassRate: report.summary.contrastPassRate,
      // Additional performance metrics could be added here
      testDuration: 0 // Would be populated if we tracked test timing
    });
    
    this.sharedState.set('performanceMetrics', performanceMetrics);
  }

  /**
   * Get shared violations across all tests
   */
  getSharedViolations(): GlobalViolationPattern[] {
    return this.sharedState.get('globalViolations') || [];
  }

  /**
   * Get accessibility patterns that appear across multiple pages
   */
  getCommonAccessibilityPatterns(): GlobalViolationPattern[] {
    const violations = this.getSharedViolations();
    return violations.filter((v: any) => v.count > 1).sort((a: any, b: any) => b.count - a.count);
  }

  /**
   * Get component patterns across the application
   */
  getComponentPatterns(): ComponentPattern[] {
    const componentPatterns = this.sharedState.get('componentPatterns') || new Map();
    return Array.from(componentPatterns.entries()).map(([type, data]) => ({
      type,
      ...data,
      pages: Array.from(data.pages)
    }));
  }

  /**
   * Check for accessibility regressions
   */
  checkForRegressions(currentReport: AccessibilityReport, pageUrl: string): AccessibilityRegression[] {
    if (!this.regressionBaseline) return [];

    const regressions: AccessibilityRegression[] = [];
    const baselineForPage = this.regressionBaseline.pages[pageUrl];

    if (baselineForPage) {
      // Check score regression
      if (currentReport.overallScore < baselineForPage.score - 5) {
        regressions.push({
          type: 'score',
          severity: 'moderate',
          pageUrl,
          message: `Accessibility score decreased from ${baselineForPage.score} to ${currentReport.overallScore}`,
          impact: baselineForPage.score - currentReport.overallScore,
          timestamp: new Date().toISOString()
        });
      }

      // Check for new violations
      const baselineViolationIds = baselineForPage.violations.map(v => v.id);
      const newViolations = currentReport.audit.violations.filter(v => 
        !baselineViolationIds.includes(v.id)
      );

      if (newViolations.length > 0) {
        regressions.push({
          type: 'new-violations',
          severity: 'serious',
          pageUrl,
          message: `${newViolations.length} new accessibility violations introduced`,
          violations: newViolations,
          timestamp: new Date().toISOString()
        });
      }

      // Check for increased violation severity
      currentReport.audit.violations.forEach(currentViolation => {
        const baselineViolation = baselineForPage.violations.find(v => v.id === currentViolation.id);
        if (baselineViolation && this.getImpactWeight(currentViolation.impact) > this.getImpactWeight(baselineViolation.impact)) {
          regressions.push({
            type: 'severity-increase',
            severity: 'moderate',
            pageUrl,
            message: `Violation ${currentViolation.id} severity increased from ${baselineViolation.impact} to ${currentViolation.impact}`,
            timestamp: new Date().toISOString()
          });
        }
      });
    }

    return regressions;
  }

  /**
   * Set regression baseline for future comparison
   */
  setRegressionBaseline(reports: AccessibilityReport[]): void {
    const baseline: AccessibilityBaseline = {
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      overallScore: reports.reduce((sum, r) => sum + r.overallScore, 0) / reports.length,
      pages: {}
    };

    reports.forEach(report => {
      baseline.pages[report.url] = {
        score: report.overallScore,
        violations: report.audit.violations.map(v => ({
          id: v.id,
          impact: v.impact,
          description: v.description
        })),
        timestamp: report.timestamp
      };
    });

    this.regressionBaseline = baseline;
    this.sharedState.set('regressionBaseline', baseline);
  }

  /**
   * Generate comprehensive cross-page accessibility insights
   */
  generateCrossPageInsights(): CrossPageInsights {
    const testedPages = this.sharedState.get('testedPages') || [];
    const globalViolations = this.getSharedViolations();
    const componentPatterns = this.getComponentPatterns();
    const performanceMetrics = this.sharedState.get('performanceMetrics') || [];
    
    const insights: CrossPageInsights = {
      sessionId: this.sessionId,
      totalPagesTesteds: testedPages.length,
      averageScore: testedPages.length > 0 ? 
        testedPages.reduce((sum: number, p: any) => sum + p.score, 0) / testedPages.length : 0,
      scoreDistribution: this.calculateScoreDistribution(testedPages),
      mostCommonViolations: globalViolations
        .sort((a: any, b: any) => b.count - a.count)
        .slice(0, 10),
      componentPatterns: componentPatterns
        .filter(p => p.occurrences > 1)
        .sort((a, b) => b.occurrences - a.occurrences),
      pagesByScore: testedPages.sort((a: any, b: any) => b.score - a.score),
      performanceTrends: this.analyzePerformanceTrends(performanceMetrics),
      recommendations: this.generateGlobalRecommendations(globalViolations, componentPatterns),
      complianceStatus: this.calculateComplianceStatus(testedPages),
      timeline: this.generateAccessibilityTimeline(testedPages)
    };

    return insights;
  }

  /**
   * Calculate score distribution
   */
  private calculateScoreDistribution(pages: any[]): ScoreDistribution {
    const distribution: ScoreDistribution = {
      excellent: 0, // 90-100
      good: 0,      // 75-89
      fair: 0,      // 60-74
      poor: 0       // 0-59
    };

    pages.forEach(page => {
      if (page.score >= 90) distribution.excellent++;
      else if (page.score >= 75) distribution.good++;
      else if (page.score >= 60) distribution.fair++;
      else distribution.poor++;
    });

    return distribution;
  }

  /**
   * Analyze performance trends
   */
  private analyzePerformanceTrends(metrics: any[]): PerformanceTrends {
    if (metrics.length < 2) {
      return { trend: 'stable', changeRate: 0, recommendation: 'Insufficient data for trend analysis' };
    }

    const recent = metrics.slice(-5); // Last 5 tests
    const older = metrics.slice(-10, -5); // Previous 5 tests

    const recentAvg = recent.reduce((sum: number, m: any) => sum + m.overallScore, 0) / recent.length;
    const olderAvg = older.length > 0 ? 
      older.reduce((sum: number, m: any) => sum + m.overallScore, 0) / older.length : recentAvg;

    const changeRate = ((recentAvg - olderAvg) / olderAvg) * 100;

    let trend: 'improving' | 'declining' | 'stable' = 'stable';
    if (changeRate > 5) trend = 'improving';
    else if (changeRate < -5) trend = 'declining';

    return {
      trend,
      changeRate,
      recommendation: this.getTrendRecommendation(trend, changeRate)
    };
  }

  /**
   * Get trend-based recommendation
   */
  private getTrendRecommendation(trend: string, changeRate: number): string {
    switch (trend) {
      case 'improving':
        return `Accessibility is improving (${changeRate.toFixed(1)}% increase). Continue current practices.`;
      case 'declining':
        return `Accessibility is declining (${Math.abs(changeRate).toFixed(1)}% decrease). Review recent changes and implement corrective measures.`;
      default:
        return 'Accessibility remains stable. Consider implementing proactive improvements.';
    }
  }

  /**
   * Calculate overall compliance status
   */
  private calculateComplianceStatus(pages: any[]): ComplianceStatus {
    const totalPages = pages.length;
    if (totalPages === 0) {
      return { level: 'unknown', percentage: 0, description: 'No pages tested' };
    }

    const averageScore = pages.reduce((sum: number, p: any) => sum + p.score, 0) / totalPages;
    const criticalIssues = pages.reduce((sum: number, p: any) => sum + p.criticalIssues, 0);

    let level: 'excellent' | 'good' | 'fair' | 'poor';
    let description: string;

    if (averageScore >= 90 && criticalIssues === 0) {
      level = 'excellent';
      description = 'Meets or exceeds all accessibility standards';
    } else if (averageScore >= 75 && criticalIssues <= 1) {
      level = 'good';
      description = 'Meets most accessibility standards with minor issues';
    } else if (averageScore >= 60) {
      level = 'fair';
      description = 'Meets basic accessibility standards but needs improvement';
    } else {
      level = 'poor';
      description = 'Does not meet accessibility standards, immediate action required';
    }

    return { level, percentage: averageScore, description };
  }

  /**
   * Generate accessibility timeline
   */
  private generateAccessibilityTimeline(pages: any[]): TimelineEntry[] {
    const timeline = pages.map(page => ({
      timestamp: page.timestamp,
      url: page.url,
      score: page.score,
      violations: page.violations,
      criticalIssues: page.criticalIssues
    }));

    return timeline.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }

  /**
   * Generate global recommendations based on patterns
   */
  private generateGlobalRecommendations(
    violations: GlobalViolationPattern[], 
    componentPatterns: ComponentPattern[]
  ): string[] {
    const recommendations: string[] = [];

    // Recommendations based on violation patterns
    const criticalViolations = violations.filter(v => v.impact === 'critical');
    if (criticalViolations.length > 0) {
      recommendations.push(`Address ${criticalViolations.length} critical accessibility violations immediately`);
    }

    const commonViolations = violations.filter(v => v.count > 2);
    if (commonViolations.length > 0) {
      recommendations.push('Focus on fixing violations that appear across multiple pages');
      
      // Specific recommendations for common violation types
      const colorContrastIssues = commonViolations.filter(v => v.id.includes('color-contrast'));
      if (colorContrastIssues.length > 0) {
        recommendations.push('Implement a design system with validated color combinations');
      }

      const formIssues = commonViolations.filter(v => 
        v.id.includes('label') || v.id.includes('form-field')
      );
      if (formIssues.length > 0) {
        recommendations.push('Standardize form accessibility patterns across the application');
      }

      const headingIssues = commonViolations.filter(v => v.id.includes('heading'));
      if (headingIssues.length > 0) {
        recommendations.push('Establish consistent heading hierarchy guidelines');
      }
    }

    // Recommendations based on component patterns
    const problematicComponents = componentPatterns.filter(p => p.violations.length > 0);
    if (problematicComponents.length > 0) {
      recommendations.push('Create accessibility guidelines for commonly used components');
      
      problematicComponents.forEach(component => {
        if (component.occurrences > 2) {
          recommendations.push(`Improve accessibility for ${component.type} components (used in ${component.occurrences} places)`);
        }
      });
    }

    // General recommendations
    if (violations.length > 10) {
      recommendations.push('Consider implementing accessibility linting in your development workflow');
      recommendations.push('Provide accessibility training for the development team');
    }

    return [...new Set(recommendations)]; // Remove duplicates
  }

  /**
   * Persist HIVE coordination state to disk
   */
  private async persistState(): Promise<void> {
    try {
      await mkdir(this.persistencePath, { recursive: true });
      
      const stateData = {
        sessionId: this.sessionId,
        timestamp: new Date().toISOString(),
        state: Object.fromEntries(this.sharedState),
        testResults: this.testResults.length, // Don't persist full reports, too large
        patterns: this.patterns
      };

      const filePath = join(this.persistencePath, `hive-state-${this.sessionId}.json`);
      await writeFile(filePath, JSON.stringify(stateData, null, 2));
    } catch (error) {
      console.warn('Failed to persist HIVE state:', error);
    }
  }

  /**
   * Load previous HIVE coordination state
   */
  async loadPreviousState(sessionId: string): Promise<boolean> {
    try {
      const filePath = join(this.persistencePath, `hive-state-${sessionId}.json`);
      const data = await readFile(filePath, 'utf-8');
      const stateData = JSON.parse(data);
      
      // Restore shared state
      Object.entries(stateData.state).forEach(([key, value]) => {
        this.sharedState.set(key, value);
      });
      
      this.patterns = stateData.patterns || [];
      console.log(`Loaded previous HIVE state from session: ${sessionId}`);
      return true;
    } catch (error) {
      console.warn(`Failed to load previous HIVE state for session ${sessionId}:`, error);
      return false;
    }
  }

  /**
   * Get impact weight for comparison
   */
  private getImpactWeight(impact: string): number {
    const weights = { critical: 4, serious: 3, moderate: 2, minor: 1 };
    return weights[impact as keyof typeof weights] || 0;
  }

  /**
   * Export coordination data for external analysis
   */
  async exportCoordinationData(): Promise<string> {
    const exportData = {
      sessionId: this.sessionId,
      exportTimestamp: new Date().toISOString(),
      insights: this.generateCrossPageInsights(),
      globalViolations: this.getSharedViolations(),
      componentPatterns: this.getComponentPatterns(),
      testResults: this.testResults.map(r => ({
        url: r.url,
        timestamp: r.timestamp,
        overallScore: r.overallScore,
        violationCount: r.summary.totalViolations,
        criticalIssues: r.summary.criticalIssues
      }))
    };

    const exportPath = join(this.persistencePath, `hive-export-${this.sessionId}.json`);
    await writeFile(exportPath, JSON.stringify(exportData, null, 2));
    
    console.log(`HIVE coordination data exported to: ${exportPath}`);
    return exportPath;
  }

  /**
   * Get current session statistics
   */
  getSessionStats(): SessionStats {
    const testedPages = this.sharedState.get('testedPages') || [];
    const globalViolations = this.getSharedViolations();
    
    return {
      sessionId: this.sessionId,
      startTime: this.sharedState.get('startTime'),
      currentTime: new Date().toISOString(),
      pagesTestedCount: testedPages.length,
      uniqueViolationTypes: globalViolations.length,
      totalViolationInstances: globalViolations.reduce((sum: number, v: any) => sum + v.count, 0),
      averageScore: testedPages.length > 0 ?
        testedPages.reduce((sum: number, p: any) => sum + p.score, 0) / testedPages.length : 0
    };
  }
}

// Type definitions
export interface GlobalViolationPattern {
  id: string;
  count: number;
  pages: string[];
  impact: string;
  description: string;
  help: string;
  helpUrl: string;
  selectors: string[];
  firstSeen: string;
  lastSeen: string;
  tags: string[];
}

export interface ComponentPattern {
  type: string;
  occurrences: number;
  pages: string[];
  violations: any[];
  selectors: string[];
  firstDetected: string;
  recommendations: string[];
}

export interface ComponentTypeInference {
  type: string;
  violations: any[];
  selectors: string[];
}

export interface AccessibilityPattern {
  id: string;
  type: 'violation' | 'success' | 'component';
  pattern: string;
  frequency: number;
  pages: string[];
  recommendations: string[];
}

export interface AccessibilityRegression {
  type: 'score' | 'new-violations' | 'severity-increase';
  severity: 'minor' | 'moderate' | 'serious' | 'critical';
  pageUrl: string;
  message: string;
  impact?: number;
  violations?: any[];
  timestamp: string;
}

export interface AccessibilityBaseline {
  timestamp: string;
  sessionId: string;
  overallScore: number;
  pages: {
    [url: string]: {
      score: number;
      violations: Array<{ id: string; impact: string; description: string }>;
      timestamp: string;
    };
  };
}

export interface CrossPageInsights {
  sessionId: string;
  totalPagesTesteds: number;
  averageScore: number;
  scoreDistribution: ScoreDistribution;
  mostCommonViolations: GlobalViolationPattern[];
  componentPatterns: ComponentPattern[];
  pagesByScore: any[];
  performanceTrends: PerformanceTrends;
  recommendations: string[];
  complianceStatus: ComplianceStatus;
  timeline: TimelineEntry[];
}

export interface ScoreDistribution {
  excellent: number; // 90-100
  good: number;      // 75-89
  fair: number;      // 60-74
  poor: number;      // 0-59
}

export interface PerformanceTrends {
  trend: 'improving' | 'declining' | 'stable';
  changeRate: number;
  recommendation: string;
}

export interface ComplianceStatus {
  level: 'excellent' | 'good' | 'fair' | 'poor' | 'unknown';
  percentage: number;
  description: string;
}

export interface TimelineEntry {
  timestamp: string;
  url: string;
  score: number;
  violations: number;
  criticalIssues: number;
}

export interface SessionStats {
  sessionId: string;
  startTime: string;
  currentTime: string;
  pagesTestedCount: number;
  uniqueViolationTypes: number;
  totalViolationInstances: number;
  averageScore: number;
}

export default HiveAccessibilityCoordinator;