/**
 * Cross-Browser Compatibility Matrix Reporter for MediaNest E2E Tests
 * HIVE-MIND Enhanced Browser Coverage Analysis and Reporting
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { execSync } from 'child_process';

export interface BrowserTestResult {
  browser: string;
  browserVersion: string;
  testName: string;
  testFile: string;
  status: 'passed' | 'failed' | 'skipped' | 'flaky';
  duration: number;
  error?: string;
  retry?: number;
  screenshot?: string;
  trace?: string;
}

export interface CompatibilityIssue {
  testName: string;
  affectedBrowsers: string[];
  issueType: 'layout' | 'functionality' | 'performance' | 'accessibility';
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  workaround?: string;
}

export interface CrossBrowserMatrix {
  summary: {
    totalTests: number;
    totalBrowsers: number;
    overallCompatibility: number;
    timestamp: string;
  };
  browsers: {
    [browserName: string]: {
      version: string;
      platform: string;
      totalTests: number;
      passed: number;
      failed: number;
      skipped: number;
      flaky: number;
      compatibilityScore: number;
      uniqueFailures: string[];
    }
  };
  testMatrix: {
    [testName: string]: {
      [browser: string]: BrowserTestResult;
    }
  };
  compatibilityIssues: CompatibilityIssue[];
  recommendations: string[];
}

export class CrossBrowserMatrixReporter {
  private sessionId: string;
  private outputDir: string;
  private artifactsDir: string;

  constructor(sessionId?: string) {
    this.sessionId = sessionId || `cross-browser-${Date.now()}`;
    this.outputDir = join('reports', 'cross-browser');
    this.artifactsDir = 'artifacts';
    
    this.ensureDirectories();
  }

  private ensureDirectories(): void {
    [
      this.outputDir,
      join(this.outputDir, 'matrices'),
      join(this.outputDir, 'issues'),
      join(this.outputDir, 'assets')
    ].forEach(dir => {
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
    });
  }

  /**
   * Generate comprehensive cross-browser compatibility matrix
   */
  async generateCompatibilityMatrix(): Promise<CrossBrowserMatrix> {
    console.log('🔄 Generating cross-browser compatibility matrix...');
    
    try {
      // Collect test results from all browsers
      const browserResults = await this.collectBrowserResults();
      
      // Generate compatibility matrix
      const matrix = await this.buildCompatibilityMatrix(browserResults);
      
      // Analyze compatibility issues
      matrix.compatibilityIssues = await this.analyzeCompatibilityIssues(browserResults);
      
      // Generate recommendations
      matrix.recommendations = this.generateRecommendations(matrix);
      
      // Save matrix data
      await this.saveMatrixData(matrix);
      
      // Generate HTML report
      await this.generateHTMLReport(matrix);
      
      // Update HIVE-MIND memory
      await this.updateHiveMemory(matrix);
      
      console.log('✅ Cross-browser compatibility matrix generated successfully');
      return matrix;
      
    } catch (error) {
      console.error('❌ Failed to generate compatibility matrix:', error);
      throw error;
    }
  }

  /**
   * Collect test results from all browser artifacts
   */
  private async collectBrowserResults(): Promise<{ [browser: string]: BrowserTestResult[] }> {
    const browserResults: { [browser: string]: BrowserTestResult[] } = {};
    
    if (!existsSync(this.artifactsDir)) {
      console.warn('No artifacts directory found');
      return browserResults;
    }

    const browsers = [
      'chromium-desktop', 'firefox-desktop', 'webkit-desktop', 'edge-desktop',
      'mobile-chrome', 'mobile-safari', 'tablet-chrome'
    ];

    for (const browser of browsers) {
      const results = await this.loadBrowserTestResults(browser);
      if (results.length > 0) {
        browserResults[browser] = results;
      }
    }

    return browserResults;
  }

  /**
   * Load test results for a specific browser
   */
  private async loadBrowserTestResults(browser: string): Promise<BrowserTestResult[]> {
    const results: BrowserTestResult[] = [];
    
    // Look for artifacts containing this browser name
    const browserArtifacts = this.findBrowserArtifacts(browser);
    
    for (const artifactPath of browserArtifacts) {
      const jsonResults = this.findJsonResults(artifactPath);
      if (jsonResults) {
        try {
          const data = JSON.parse(readFileSync(jsonResults, 'utf8'));
          const parsedResults = this.parsePlaywrightResults(data, browser);
          results.push(...parsedResults);
        } catch (error) {
          console.warn(`Failed to parse results from ${jsonResults}:`, error);
        }
      }
    }

    return results;
  }

  /**
   * Find artifacts for a specific browser
   */
  private findBrowserArtifacts(browser: string): string[] {
    const artifacts: string[] = [];
    
    try {
      const artifactDirs = execSync('find artifacts -type d -name "*" 2>/dev/null || echo ""', { 
        encoding: 'utf8' 
      }).split('\n').filter(Boolean);
      
      for (const dir of artifactDirs) {
        if (dir.includes(browser)) {
          artifacts.push(dir);
        }
      }
    } catch (error) {
      console.warn('Failed to scan artifacts directory:', error);
    }
    
    return artifacts;
  }

  /**
   * Find JSON results file in artifact directory
   */
  private findJsonResults(artifactPath: string): string | null {
    try {
      const files = execSync(`find "${artifactPath}" -name "*.json" -type f`, { 
        encoding: 'utf8' 
      }).split('\n').filter(Boolean);
      
      return files.find(file => 
        file.includes('results.json') || 
        file.includes('test-results.json')
      ) || null;
      
    } catch (error) {
      return null;
    }
  }

  /**
   * Parse Playwright test results
   */
  private parsePlaywrightResults(data: any, browser: string): BrowserTestResult[] {
    const results: BrowserTestResult[] = [];
    
    if (data.suites) {
      for (const suite of data.suites) {
        for (const test of suite.tests || []) {
          results.push({
            browser,
            browserVersion: this.extractBrowserVersion(browser, data),
            testName: test.title,
            testFile: suite.file || 'unknown',
            status: this.normalizeStatus(test.status),
            duration: test.duration || 0,
            error: test.error,
            retry: test.retries || 0,
            screenshot: this.findScreenshot(test),
            trace: this.findTrace(test)
          });
        }
      }
    }
    
    return results;
  }

  private extractBrowserVersion(browser: string, data: any): string {
    // Extract browser version from test metadata
    return data.config?.projects?.find((p: any) => p.name === browser)?.use?.browserVersion || 'unknown';
  }

  private normalizeStatus(status: string): 'passed' | 'failed' | 'skipped' | 'flaky' {
    switch (status) {
      case 'passed': return 'passed';
      case 'failed': return 'failed';
      case 'skipped': return 'skipped';
      case 'timedOut': return 'failed';
      default: 
        // If test passed after retries, consider it flaky
        return status.includes('flaky') ? 'flaky' : 'failed';
    }
  }

  private findScreenshot(test: any): string | undefined {
    return test.attachments?.find((a: any) => a.name === 'screenshot')?.path;
  }

  private findTrace(test: any): string | undefined {
    return test.attachments?.find((a: any) => a.name === 'trace')?.path;
  }

  /**
   * Build the compatibility matrix from browser results
   */
  private async buildCompatibilityMatrix(
    browserResults: { [browser: string]: BrowserTestResult[] }
  ): Promise<CrossBrowserMatrix> {
    const matrix: CrossBrowserMatrix = {
      summary: {
        totalTests: 0,
        totalBrowsers: Object.keys(browserResults).length,
        overallCompatibility: 0,
        timestamp: new Date().toISOString()
      },
      browsers: {},
      testMatrix: {},
      compatibilityIssues: [],
      recommendations: []
    };

    // Calculate browser-specific metrics
    for (const [browser, results] of Object.entries(browserResults)) {
      const passed = results.filter(r => r.status === 'passed').length;
      const failed = results.filter(r => r.status === 'failed').length;
      const skipped = results.filter(r => r.status === 'skipped').length;
      const flaky = results.filter(r => r.status === 'flaky').length;
      
      const uniqueFailures = [...new Set(results.filter(r => r.status === 'failed').map(r => r.testName))];
      
      matrix.browsers[browser] = {
        version: results[0]?.browserVersion || 'unknown',
        platform: this.extractPlatform(browser),
        totalTests: results.length,
        passed,
        failed,
        skipped,
        flaky,
        compatibilityScore: results.length > 0 ? (passed / results.length) * 100 : 0,
        uniqueFailures
      };

      // Update summary
      matrix.summary.totalTests = Math.max(matrix.summary.totalTests, results.length);
    }

    // Build test matrix (test x browser grid)
    const allTestNames = new Set<string>();
    Object.values(browserResults).forEach(results => {
      results.forEach(result => allTestNames.add(result.testName));
    });

    for (const testName of allTestNames) {
      matrix.testMatrix[testName] = {};
      
      for (const [browser, results] of Object.entries(browserResults)) {
        const testResult = results.find(r => r.testName === testName);
        if (testResult) {
          matrix.testMatrix[testName][browser] = testResult;
        }
      }
    }

    // Calculate overall compatibility
    const totalBrowserTestCombinations = matrix.summary.totalTests * matrix.summary.totalBrowsers;
    const successfulCombinations = Object.values(matrix.browsers)
      .reduce((sum, browser) => sum + browser.passed, 0);
    
    matrix.summary.overallCompatibility = totalBrowserTestCombinations > 0 
      ? (successfulCombinations / totalBrowserTestCombinations) * 100 
      : 0;

    return matrix;
  }

  private extractPlatform(browser: string): string {
    if (browser.includes('mobile')) return 'mobile';
    if (browser.includes('tablet')) return 'tablet';
    return 'desktop';
  }

  /**
   * Analyze compatibility issues across browsers
   */
  private async analyzeCompatibilityIssues(
    browserResults: { [browser: string]: BrowserTestResult[] }
  ): Promise<CompatibilityIssue[]> {
    const issues: CompatibilityIssue[] = [];
    
    // Get all unique test names
    const allTestNames = new Set<string>();
    Object.values(browserResults).forEach(results => {
      results.forEach(result => allTestNames.add(result.testName));
    });

    // Analyze each test across browsers
    for (const testName of allTestNames) {
      const testResults: { [browser: string]: BrowserTestResult } = {};
      
      // Collect results for this test across all browsers
      for (const [browser, results] of Object.entries(browserResults)) {
        const result = results.find(r => r.testName === testName);
        if (result) {
          testResults[browser] = result;
        }
      }

      // Analyze for compatibility issues
      const issue = this.detectCompatibilityIssue(testName, testResults);
      if (issue) {
        issues.push(issue);
      }
    }

    return issues.sort((a, b) => this.getSeverityWeight(b.severity) - this.getSeverityWeight(a.severity));
  }

  /**
   * Detect compatibility issues for a specific test
   */
  private detectCompatibilityIssue(
    testName: string, 
    testResults: { [browser: string]: BrowserTestResult }
  ): CompatibilityIssue | null {
    const browsers = Object.keys(testResults);
    const failedBrowsers = browsers.filter(browser => 
      testResults[browser]?.status === 'failed'
    );
    const passedBrowsers = browsers.filter(browser => 
      testResults[browser]?.status === 'passed'
    );

    // No issue if test passes/fails consistently across all browsers
    if (failedBrowsers.length === 0 || passedBrowsers.length === 0) {
      return null;
    }

    // Determine issue type and severity
    const issueType = this.classifyIssueType(testName, testResults);
    const severity = this.calculateIssueSeverity(failedBrowsers, browsers);

    return {
      testName,
      affectedBrowsers: failedBrowsers,
      issueType,
      severity,
      description: this.generateIssueDescription(testName, failedBrowsers, issueType),
      workaround: this.suggestWorkaround(issueType, failedBrowsers)
    };
  }

  private classifyIssueType(
    testName: string, 
    testResults: { [browser: string]: BrowserTestResult }
  ): 'layout' | 'functionality' | 'performance' | 'accessibility' {
    const name = testName.toLowerCase();
    
    if (name.includes('visual') || name.includes('layout') || name.includes('css')) {
      return 'layout';
    }
    if (name.includes('accessibility') || name.includes('a11y')) {
      return 'accessibility';
    }
    if (name.includes('performance') || name.includes('speed')) {
      return 'performance';
    }
    
    return 'functionality';
  }

  private calculateIssueSeverity(
    failedBrowsers: string[], 
    totalBrowsers: string[]
  ): 'critical' | 'high' | 'medium' | 'low' {
    const failureRate = failedBrowsers.length / totalBrowsers.length;
    
    if (failureRate >= 0.75) return 'critical';
    if (failureRate >= 0.5) return 'high';
    if (failureRate >= 0.25) return 'medium';
    return 'low';
  }

  private getSeverityWeight(severity: string): number {
    switch (severity) {
      case 'critical': return 4;
      case 'high': return 3;
      case 'medium': return 2;
      case 'low': return 1;
      default: return 0;
    }
  }

  private generateIssueDescription(
    testName: string, 
    failedBrowsers: string[], 
    issueType: string
  ): string {
    return `${issueType} issue in "${testName}" affecting ${failedBrowsers.join(', ')}`;
  }

  private suggestWorkaround(issueType: string, failedBrowsers: string[]): string | undefined {
    const browserFamily = failedBrowsers[0]?.split('-')[0];
    
    switch (issueType) {
      case 'layout':
        return 'Consider using CSS prefixes or polyfills for better cross-browser support';
      case 'functionality':
        if (browserFamily === 'webkit') {
          return 'Check for Safari-specific JavaScript compatibility issues';
        }
        return 'Review browser-specific API usage and add feature detection';
      case 'performance':
        return 'Optimize for the slowest browser or implement progressive enhancement';
      case 'accessibility':
        return 'Review ARIA implementation and screen reader compatibility';
      default:
        return undefined;
    }
  }

  /**
   * Generate recommendations based on compatibility analysis
   */
  private generateRecommendations(matrix: CrossBrowserMatrix): string[] {
    const recommendations: string[] = [];
    
    // Overall compatibility recommendations
    if (matrix.summary.overallCompatibility < 90) {
      recommendations.push('Overall browser compatibility is below 90%. Focus on critical cross-browser issues.');
    }

    // Browser-specific recommendations
    for (const [browser, stats] of Object.entries(matrix.browsers)) {
      if (stats.compatibilityScore < 80) {
        recommendations.push(`${browser} compatibility is low (${stats.compatibilityScore.toFixed(1)}%). Investigate ${stats.uniqueFailures.length} unique failures.`);
      }
      
      if (stats.flaky > stats.totalTests * 0.1) {
        recommendations.push(`${browser} has high flakiness (${stats.flaky} flaky tests). Review test stability.`);
      }
    }

    // Issue-specific recommendations
    const criticalIssues = matrix.compatibilityIssues.filter(issue => issue.severity === 'critical');
    if (criticalIssues.length > 0) {
      recommendations.push(`Address ${criticalIssues.length} critical compatibility issues immediately.`);
    }

    const layoutIssues = matrix.compatibilityIssues.filter(issue => issue.issueType === 'layout');
    if (layoutIssues.length > 0) {
      recommendations.push(`Review CSS compatibility for ${layoutIssues.length} layout-related issues.`);
    }

    return recommendations;
  }

  /**
   * Save matrix data to JSON file
   */
  private async saveMatrixData(matrix: CrossBrowserMatrix): Promise<void> {
    const dataPath = join(this.outputDir, `compatibility-matrix-${this.sessionId}.json`);
    writeFileSync(dataPath, JSON.stringify(matrix, null, 2));
    
    // Also save a timestamped version
    const timestamp = new Date().toISOString().split('T')[0];
    const archivePath = join(this.outputDir, 'matrices', `matrix-${timestamp}.json`);
    writeFileSync(archivePath, JSON.stringify(matrix, null, 2));
    
    console.log(`💾 Compatibility matrix saved: ${dataPath}`);
  }

  /**
   * Generate comprehensive HTML report
   */
  private async generateHTMLReport(matrix: CrossBrowserMatrix): Promise<void> {
    const html = this.generateMatrixHTML(matrix);
    const reportPath = join(this.outputDir, 'compatibility-matrix.html');
    writeFileSync(reportPath, html);
    
    console.log(`📊 HTML report generated: ${reportPath}`);
  }

  private generateMatrixHTML(matrix: CrossBrowserMatrix): string {
    const browsers = Object.keys(matrix.browsers);
    const tests = Object.keys(matrix.testMatrix);
    
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Cross-Browser Compatibility Matrix - MediaNest E2E</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        .header { background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 30px; }
        .metric { background: white; padding: 15px; border-radius: 8px; text-align: center; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .metric-value { font-size: 2em; font-weight: bold; color: #007bff; }
        .metric-label { color: #666; font-size: 0.9em; }
        .matrix-container { background: white; border-radius: 8px; padding: 20px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); overflow-x: auto; }
        .matrix-table { width: 100%; border-collapse: collapse; font-size: 0.8em; }
        .matrix-table th, .matrix-table td { border: 1px solid #ddd; padding: 8px; text-align: center; }
        .matrix-table th { background: #f8f9fa; font-weight: bold; }
        .status-passed { background: #d4edda; color: #155724; }
        .status-failed { background: #f8d7da; color: #721c24; }
        .status-skipped { background: #fff3cd; color: #856404; }
        .status-flaky { background: #d1ecf1; color: #0c5460; }
        .browser-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px; margin-bottom: 30px; }
        .browser-card { background: white; border-radius: 8px; padding: 15px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .browser-name { font-size: 1.1em; font-weight: bold; margin-bottom: 10px; }
        .compatibility-score { font-size: 1.5em; font-weight: bold; margin-bottom: 10px; }
        .score-excellent { color: #28a745; }
        .score-good { color: #ffc107; }
        .score-poor { color: #dc3545; }
        .issues-section { background: white; border-radius: 8px; padding: 20px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .issue-item { border-left: 4px solid #007bff; padding: 10px; margin-bottom: 10px; background: #f8f9fa; }
        .issue-critical { border-left-color: #dc3545; }
        .issue-high { border-left-color: #fd7e14; }
        .issue-medium { border-left-color: #ffc107; }
        .issue-low { border-left-color: #17a2b8; }
        .recommendations { background: white; border-radius: 8px; padding: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .test-name { max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-align: left; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Cross-Browser Compatibility Matrix</h1>
        <p>Generated: ${new Date(matrix.summary.timestamp).toLocaleString()}</p>
        <p>Session ID: ${this.sessionId}</p>
    </div>

    <div class="summary">
        <div class="metric">
            <div class="metric-value">${matrix.summary.overallCompatibility.toFixed(1)}%</div>
            <div class="metric-label">Overall Compatibility</div>
        </div>
        <div class="metric">
            <div class="metric-value">${matrix.summary.totalTests}</div>
            <div class="metric-label">Total Tests</div>
        </div>
        <div class="metric">
            <div class="metric-value">${matrix.summary.totalBrowsers}</div>
            <div class="metric-label">Browsers Tested</div>
        </div>
        <div class="metric">
            <div class="metric-value">${matrix.compatibilityIssues.length}</div>
            <div class="metric-label">Issues Found</div>
        </div>
    </div>

    <div class="browser-stats">
        ${browsers.map(browser => {
          const stats = matrix.browsers[browser];
          const scoreClass = stats.compatibilityScore >= 90 ? 'score-excellent' : 
                           stats.compatibilityScore >= 70 ? 'score-good' : 'score-poor';
          return `
          <div class="browser-card">
              <div class="browser-name">${browser}</div>
              <div class="compatibility-score ${scoreClass}">${stats.compatibilityScore.toFixed(1)}%</div>
              <div>Passed: ${stats.passed} | Failed: ${stats.failed} | Flaky: ${stats.flaky}</div>
              <div>Version: ${stats.version}</div>
              <div>Platform: ${stats.platform}</div>
          </div>`;
        }).join('')}
    </div>

    <div class="matrix-container">
        <h2>Test x Browser Matrix</h2>
        <table class="matrix-table">
            <thead>
                <tr>
                    <th class="test-name">Test</th>
                    ${browsers.map(browser => `<th>${browser}</th>`).join('')}
                </tr>
            </thead>
            <tbody>
                ${tests.slice(0, 50).map(testName => `
                <tr>
                    <td class="test-name" title="${testName}">${testName}</td>
                    ${browsers.map(browser => {
                      const result = matrix.testMatrix[testName][browser];
                      const status = result ? result.status : 'skipped';
                      const statusClass = `status-${status}`;
                      const title = result ? `${status} (${result.duration}ms)` : 'not run';
                      return `<td class="${statusClass}" title="${title}">${status.charAt(0).toUpperCase()}</td>`;
                    }).join('')}
                </tr>
                `).join('')}
                ${tests.length > 50 ? `<tr><td colspan="${browsers.length + 1}">... and ${tests.length - 50} more tests</td></tr>` : ''}
            </tbody>
        </table>
    </div>

    <div class="issues-section">
        <h2>Compatibility Issues</h2>
        ${matrix.compatibilityIssues.length === 0 ? '<p>No compatibility issues found!</p>' : 
          matrix.compatibilityIssues.map(issue => `
          <div class="issue-item issue-${issue.severity}">
              <h4>${issue.testName}</h4>
              <p><strong>Type:</strong> ${issue.issueType} | <strong>Severity:</strong> ${issue.severity}</p>
              <p><strong>Affected Browsers:</strong> ${issue.affectedBrowsers.join(', ')}</p>
              <p>${issue.description}</p>
              ${issue.workaround ? `<p><strong>Suggested Fix:</strong> ${issue.workaround}</p>` : ''}
          </div>
          `).join('')}
    </div>

    <div class="recommendations">
        <h2>Recommendations</h2>
        ${matrix.recommendations.length === 0 ? '<p>No specific recommendations at this time.</p>' :
          `<ul>${matrix.recommendations.map(rec => `<li>${rec}</li>`).join('')}</ul>`}
    </div>
</body>
</html>`;
  }

  /**
   * Update HIVE-MIND memory with compatibility data
   */
  private async updateHiveMemory(matrix: CrossBrowserMatrix): Promise<void> {
    try {
      execSync('npx claude-flow@alpha hooks post-edit --file "cross-browser-matrix" --memory-key "compatibility/matrix"', {
        input: JSON.stringify({
          sessionId: this.sessionId,
          overallCompatibility: matrix.summary.overallCompatibility,
          issuesCount: matrix.compatibilityIssues.length,
          browsersCount: matrix.summary.totalBrowsers,
          timestamp: matrix.summary.timestamp
        }),
        stdio: 'pipe'
      });
      console.log('💾 Updated HIVE-MIND memory with compatibility data');
    } catch (error) {
      console.warn('Failed to update HIVE memory:', error);
    }
  }
}

export default CrossBrowserMatrixReporter;