/**
 * Flaky Test Detection and Management System for MediaNest E2E Tests
 * HIVE-MIND Enhanced Analysis and Auto-Remediation
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

export interface FlakyTestRecord {
  testId: string;
  testName: string;
  testFile: string;
  flakeRate: number;
  totalRuns: number;
  failures: number;
  passes: number;
  timeouts: number;
  firstDetected: string;
  lastFlake: string;
  consecutiveStableRuns: number;
  patterns: FlakyPattern[];
  browsers: { [browser: string]: number }; // flake count per browser
  environments: { [env: string]: number }; // flake count per environment
  remediation: RemediationSuggestion[];
  status: 'active' | 'monitoring' | 'resolved' | 'quarantined';
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface FlakyPattern {
  type: 'timing' | 'browser' | 'environment' | 'data-dependent' | 'network' | 'race-condition';
  confidence: number;
  description: string;
  evidence: string[];
  frequency: number;
}

export interface RemediationSuggestion {
  type: 'wait-strategy' | 'retry-logic' | 'test-isolation' | 'data-cleanup' | 'network-stubbing';
  priority: number;
  description: string;
  implementation: string;
  estimatedEffort: 'low' | 'medium' | 'high';
}

export interface FlakeDetectionConfig {
  thresholds: {
    minimumRuns: number;
    flakeRateThreshold: number; // 0-1
    severityThresholds: {
      low: number;
      medium: number;
      high: number;
      critical: number;
    };
  };
  analysisWindow: {
    days: number;
    maxRuns: number;
  };
  quarantine: {
    enabled: boolean;
    flakeRateThreshold: number;
    autoQuarantineAfterDays: number;
  };
  patterns: {
    enablePatternDetection: boolean;
    confidenceThreshold: number;
  };
}

export interface BaselineSnapshot {
  timestamp: string;
  totalTests: number;
  flakyTests: number;
  averageFlakeRate: number;
  severityDistribution: { [severity: string]: number };
  topFlakyTests: Array<{
    testName: string;
    flakeRate: number;
    severity: string;
  }>;
}

export class FlakyTestDetector {
  private sessionId: string;
  private config: FlakeDetectionConfig;
  private dataDir: string;
  private baselinesDir: string;
  private flakyTests: Map<string, FlakyTestRecord>;

  constructor(config?: Partial<FlakeDetectionConfig>, sessionId?: string) {
    this.sessionId = sessionId || `flake-detector-${Date.now()}`;
    this.config = this.mergeConfig(config);
    this.dataDir = join('reports', 'flaky-tests');
    this.baselinesDir = join('reports', 'baselines', 'flaky-tests');
    this.flakyTests = new Map();
    
    this.ensureDirectories();
    this.loadFlakyTestData();
  }

  private mergeConfig(config?: Partial<FlakeDetectionConfig>): FlakeDetectionConfig {
    const defaultConfig: FlakeDetectionConfig = {
      thresholds: {
        minimumRuns: 5,
        flakeRateThreshold: 0.1,
        severityThresholds: {
          low: 0.1,
          medium: 0.2,
          high: 0.4,
          critical: 0.6
        }
      },
      analysisWindow: {
        days: 30,
        maxRuns: 100
      },
      quarantine: {
        enabled: true,
        flakeRateThreshold: 0.5,
        autoQuarantineAfterDays: 7
      },
      patterns: {
        enablePatternDetection: true,
        confidenceThreshold: 0.7
      }
    };

    return { ...defaultConfig, ...config };
  }

  private ensureDirectories(): void {
    [this.dataDir, this.baselinesDir, join(this.dataDir, 'quarantined')].forEach(dir => {
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
    });
  }

  /**
   * Analyze test results to detect flaky tests
   */
  async analyzeFlakiness(): Promise<Map<string, FlakyTestRecord>> {
    console.log('🔍 Analyzing test results for flakiness...');
    
    try {
      // Collect recent test results
      const testResults = await this.collectTestResults();
      
      // Analyze each test for flakiness patterns
      await this.analyzeTestResults(testResults);
      
      // Update flaky test records
      await this.updateFlakyTestRecords();
      
      // Detect patterns in flaky tests
      if (this.config.patterns.enablePatternDetection) {
        await this.detectFlakyPatterns();
      }
      
      // Generate remediation suggestions
      await this.generateRemediationSuggestions();
      
      // Handle quarantine logic
      if (this.config.quarantine.enabled) {
        await this.handleQuarantine();
      }
      
      // Update baselines
      await this.updateBaselines();
      
      // Save updated data
      await this.saveFlakyTestData();
      
      console.log(`✅ Flake analysis complete. Found ${this.flakyTests.size} flaky tests`);
      return this.flakyTests;
      
    } catch (error) {
      console.error('❌ Flake analysis failed:', error);
      throw error;
    }
  }

  /**
   * Collect test results from recent runs
   */
  private async collectTestResults(): Promise<any[]> {
    const results: any[] = [];
    const windowMs = this.config.analysisWindow.days * 24 * 60 * 60 * 1000;
    const cutoffDate = new Date(Date.now() - windowMs);
    
    try {
      // Find recent test result files
      const resultFiles = execSync(
        `find test-results -name "*.json" -type f -newer ${cutoffDate.toISOString().split('T')[0]} 2>/dev/null || echo ""`, 
        { encoding: 'utf8' }
      ).split('\n').filter(Boolean);
      
      for (const file of resultFiles.slice(0, this.config.analysisWindow.maxRuns)) {
        try {
          const data = JSON.parse(readFileSync(file, 'utf8'));
          if (data.suites) {
            results.push({
              file,
              timestamp: this.extractTimestamp(file, data),
              data,
              environment: this.extractEnvironment(data),
              browser: this.extractBrowser(data)
            });
          }
        } catch (error) {
          console.warn(`Failed to parse ${file}:`, error.message);
        }
      }
    } catch (error) {
      console.warn('Failed to collect test results:', error.message);
    }
    
    return results.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  private extractTimestamp(filePath: string, data: any): string {
    // Try to extract timestamp from filename or data
    const timestampMatch = filePath.match(/(\d{4}-\d{2}-\d{2}[T_]\d{2}[-:]\d{2}[-:]\d{2})/);
    if (timestampMatch) {
      return timestampMatch[1].replace(/_/g, 'T').replace(/-/g, ':');
    }
    
    return data.timestamp || new Date().toISOString();
  }

  private extractEnvironment(data: any): string {
    return data.config?.metadata?.environment || 
           process.env.NODE_ENV || 
           'development';
  }

  private extractBrowser(data: any): string {
    return data.config?.project || 'unknown';
  }

  /**
   * Analyze test results for flaky behavior
   */
  private async analyzeTestResults(testResults: any[]): Promise<void> {
    console.log(`📊 Analyzing ${testResults.length} test result sets...`);
    
    const testOutcomes = new Map<string, Array<{
      status: string;
      duration: number;
      timestamp: string;
      browser: string;
      environment: string;
      error?: string;
      retries: number;
    }>>();

    // Collect outcomes for each test
    for (const result of testResults) {
      const { data, timestamp, browser, environment } = result;
      
      if (data.suites) {
        for (const suite of data.suites) {
          for (const test of suite.tests || []) {
            const testId = `${suite.file}::${test.title}`;
            
            if (!testOutcomes.has(testId)) {
              testOutcomes.set(testId, []);
            }
            
            testOutcomes.get(testId)!.push({
              status: this.normalizeStatus(test.status),
              duration: test.duration || 0,
              timestamp,
              browser,
              environment,
              error: test.error,
              retries: test.retries || 0
            });
          }
        }
      }
    }

    // Analyze each test's outcomes
    for (const [testId, outcomes] of testOutcomes) {
      await this.analyzeTestOutcomes(testId, outcomes);
    }
  }

  private normalizeStatus(status: string): string {
    switch (status) {
      case 'passed': return 'passed';
      case 'failed': return 'failed';
      case 'timedOut': return 'timeout';
      case 'skipped': return 'skipped';
      default: return 'failed';
    }
  }

  private async analyzeTestOutcomes(testId: string, outcomes: any[]): Promise<void> {
    if (outcomes.length < this.config.thresholds.minimumRuns) {
      return; // Not enough data
    }

    const passes = outcomes.filter(o => o.status === 'passed').length;
    const failures = outcomes.filter(o => o.status === 'failed').length;
    const timeouts = outcomes.filter(o => o.status === 'timeout').length;
    const total = outcomes.length;
    
    const flakeRate = (failures + timeouts) / total;
    
    // Check if test meets flakiness threshold
    if (flakeRate >= this.config.thresholds.flakeRateThreshold) {
      const existingRecord = this.flakyTests.get(testId);
      
      if (existingRecord) {
        // Update existing record
        existingRecord.totalRuns = total;
        existingRecord.failures = failures;
        existingRecord.passes = passes;
        existingRecord.timeouts = timeouts;
        existingRecord.flakeRate = flakeRate;
        existingRecord.lastFlake = this.findLastFlakeTimestamp(outcomes);
        existingRecord.consecutiveStableRuns = this.calculateConsecutiveStableRuns(outcomes);
        existingRecord.severity = this.calculateSeverity(flakeRate);
        
        // Update browser and environment tracking
        this.updateBrowserEnvironmentTracking(existingRecord, outcomes);
        
      } else {
        // Create new flaky test record
        const [testFile, testName] = testId.split('::');
        
        const record: FlakyTestRecord = {
          testId,
          testName,
          testFile,
          flakeRate,
          totalRuns: total,
          failures,
          passes,
          timeouts,
          firstDetected: new Date().toISOString(),
          lastFlake: this.findLastFlakeTimestamp(outcomes),
          consecutiveStableRuns: this.calculateConsecutiveStableRuns(outcomes),
          patterns: [],
          browsers: {},
          environments: {},
          remediation: [],
          status: 'active',
          severity: this.calculateSeverity(flakeRate)
        };
        
        this.updateBrowserEnvironmentTracking(record, outcomes);
        this.flakyTests.set(testId, record);
      }
    }
  }

  private findLastFlakeTimestamp(outcomes: any[]): string {
    const flakeOutcomes = outcomes.filter(o => o.status === 'failed' || o.status === 'timeout');
    if (flakeOutcomes.length === 0) return new Date().toISOString();
    
    return flakeOutcomes.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0].timestamp;
  }

  private calculateConsecutiveStableRuns(outcomes: any[]): number {
    const sortedOutcomes = outcomes.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
    let consecutiveStable = 0;
    for (const outcome of sortedOutcomes) {
      if (outcome.status === 'passed') {
        consecutiveStable++;
      } else {
        break;
      }
    }
    
    return consecutiveStable;
  }

  private calculateSeverity(flakeRate: number): 'low' | 'medium' | 'high' | 'critical' {
    const thresholds = this.config.thresholds.severityThresholds;
    
    if (flakeRate >= thresholds.critical) return 'critical';
    if (flakeRate >= thresholds.high) return 'high';
    if (flakeRate >= thresholds.medium) return 'medium';
    return 'low';
  }

  private updateBrowserEnvironmentTracking(record: FlakyTestRecord, outcomes: any[]): void {
    // Reset counters
    record.browsers = {};
    record.environments = {};
    
    for (const outcome of outcomes) {
      if (outcome.status === 'failed' || outcome.status === 'timeout') {
        record.browsers[outcome.browser] = (record.browsers[outcome.browser] || 0) + 1;
        record.environments[outcome.environment] = (record.environments[outcome.environment] || 0) + 1;
      }
    }
  }

  /**
   * Detect patterns in flaky test behavior
   */
  private async detectFlakyPatterns(): Promise<void> {
    console.log('🔍 Detecting flaky test patterns...');
    
    for (const [testId, record] of this.flakyTests) {
      const patterns: FlakyPattern[] = [];
      
      // Browser-specific flakiness
      const browserPattern = this.detectBrowserPattern(record);
      if (browserPattern) patterns.push(browserPattern);
      
      // Environment-specific flakiness
      const envPattern = this.detectEnvironmentPattern(record);
      if (envPattern) patterns.push(envPattern);
      
      // Timing-based patterns
      const timingPattern = await this.detectTimingPattern(testId, record);
      if (timingPattern) patterns.push(timingPattern);
      
      // Race condition patterns
      const racePattern = await this.detectRaceConditionPattern(testId, record);
      if (racePattern) patterns.push(racePattern);
      
      // Update record with detected patterns
      record.patterns = patterns.filter(p => p.confidence >= this.config.patterns.confidenceThreshold);
    }
  }

  private detectBrowserPattern(record: FlakyTestRecord): FlakyPattern | null {
    const totalFlakes = Object.values(record.browsers).reduce((sum, count) => sum + count, 0);
    if (totalFlakes === 0) return null;
    
    // Check if flakiness is concentrated in specific browsers
    for (const [browser, flakeCount] of Object.entries(record.browsers)) {
      const flakePercentage = flakeCount / totalFlakes;
      
      if (flakePercentage >= 0.7 && flakeCount >= 3) {
        return {
          type: 'browser',
          confidence: flakePercentage,
          description: `Test is primarily flaky in ${browser} (${Math.round(flakePercentage * 100)}% of flakes)`,
          evidence: [`${flakeCount} out of ${totalFlakes} flakes occurred in ${browser}`],
          frequency: flakeCount
        };
      }
    }
    
    return null;
  }

  private detectEnvironmentPattern(record: FlakyTestRecord): FlakyPattern | null {
    const totalFlakes = Object.values(record.environments).reduce((sum, count) => sum + count, 0);
    if (totalFlakes === 0) return null;
    
    for (const [environment, flakeCount] of Object.entries(record.environments)) {
      const flakePercentage = flakeCount / totalFlakes;
      
      if (flakePercentage >= 0.7 && flakeCount >= 3) {
        return {
          type: 'environment',
          confidence: flakePercentage,
          description: `Test is primarily flaky in ${environment} environment (${Math.round(flakePercentage * 100)}% of flakes)`,
          evidence: [`${flakeCount} out of ${totalFlakes} flakes occurred in ${environment}`],
          frequency: flakeCount
        };
      }
    }
    
    return null;
  }

  private async detectTimingPattern(testId: string, record: FlakyTestRecord): Promise<FlakyPattern | null> {
    // This would analyze test execution logs/traces for timing issues
    // For now, return a simple heuristic based on timeouts
    
    if (record.timeouts > record.failures * 0.5) {
      return {
        type: 'timing',
        confidence: Math.min(record.timeouts / record.totalRuns * 2, 1),
        description: 'Test frequently times out, indicating timing-related issues',
        evidence: [`${record.timeouts} timeouts out of ${record.totalRuns} total runs`],
        frequency: record.timeouts
      };
    }
    
    return null;
  }

  private async detectRaceConditionPattern(testId: string, record: FlakyTestRecord): Promise<FlakyPattern | null> {
    // Heuristic: tests with both passes and failures in similar conditions might have race conditions
    
    if (record.failures > 0 && record.passes > 0 && record.flakeRate < 0.8 && record.flakeRate > 0.2) {
      const evidence = [];
      
      // Check for browser-specific race conditions
      const browsersWithBothOutcomes = Object.keys(record.browsers).filter(browser => 
        record.browsers[browser] > 0 && record.browsers[browser] < record.totalRuns
      );
      
      if (browsersWithBothOutcomes.length > 0) {
        evidence.push(`Inconsistent results across browsers: ${browsersWithBothOutcomes.join(', ')}`);
      }
      
      if (evidence.length > 0) {
        return {
          type: 'race-condition',
          confidence: 0.6,
          description: 'Test shows signs of race conditions with inconsistent pass/fail patterns',
          evidence,
          frequency: record.failures
        };
      }
    }
    
    return null;
  }

  /**
   * Generate remediation suggestions for flaky tests
   */
  private async generateRemediationSuggestions(): Promise<void> {
    console.log('💡 Generating remediation suggestions...');
    
    for (const [testId, record] of this.flakyTests) {
      const suggestions: RemediationSuggestion[] = [];
      
      // Pattern-based suggestions
      for (const pattern of record.patterns) {
        const patternSuggestions = this.generatePatternBasedSuggestions(pattern);
        suggestions.push(...patternSuggestions);
      }
      
      // General suggestions based on severity
      if (record.severity === 'critical' || record.severity === 'high') {
        suggestions.push({
          type: 'test-isolation',
          priority: 1,
          description: 'Isolate test data and state to prevent interference',
          implementation: 'Add proper beforeEach/afterEach cleanup and use unique test data',
          estimatedEffort: 'medium'
        });
      }
      
      // Timeout-based suggestions
      if (record.timeouts > 0) {
        suggestions.push({
          type: 'wait-strategy',
          priority: 2,
          description: 'Improve wait strategies to handle async operations',
          implementation: 'Replace fixed waits with dynamic waits for elements/conditions',
          estimatedEffort: 'low'
        });
      }
      
      // Retry logic suggestions
      if (record.flakeRate < 0.3) {
        suggestions.push({
          type: 'retry-logic',
          priority: 3,
          description: 'Implement smart retry logic for intermittent failures',
          implementation: 'Add conditional retries with backoff strategy',
          estimatedEffort: 'low'
        });
      }
      
      // Sort by priority and update record
      record.remediation = suggestions.sort((a, b) => a.priority - b.priority);
    }
  }

  private generatePatternBasedSuggestions(pattern: FlakyPattern): RemediationSuggestion[] {
    switch (pattern.type) {
      case 'browser':
        return [{
          type: 'wait-strategy',
          priority: 1,
          description: 'Browser-specific issues detected, review cross-browser compatibility',
          implementation: 'Add browser-specific waits and feature detection',
          estimatedEffort: 'medium'
        }];
      
      case 'timing':
        return [{
          type: 'wait-strategy',
          priority: 1,
          description: 'Timing issues detected, improve wait conditions',
          implementation: 'Replace sleep() with waitFor() conditions',
          estimatedEffort: 'low'
        }];
      
      case 'race-condition':
        return [{
          type: 'test-isolation',
          priority: 1,
          description: 'Race condition detected, improve test synchronization',
          implementation: 'Add proper locks and state synchronization',
          estimatedEffort: 'high'
        }];
      
      case 'network':
        return [{
          type: 'network-stubbing',
          priority: 1,
          description: 'Network-related flakiness detected',
          implementation: 'Add network request stubbing and retry logic',
          estimatedEffort: 'medium'
        }];
      
      default:
        return [];
    }
  }

  /**
   * Handle test quarantine logic
   */
  private async handleQuarantine(): Promise<void> {
    console.log('🚧 Processing quarantine logic...');
    
    const quarantineThreshold = this.config.quarantine.flakeRateThreshold;
    const autoQuarantineDays = this.config.quarantine.autoQuarantineAfterDays;
    
    for (const [testId, record] of this.flakyTests) {
      // Auto-quarantine highly flaky tests
      if (record.flakeRate >= quarantineThreshold && record.status !== 'quarantined') {
        const daysSinceDetection = (Date.now() - new Date(record.firstDetected).getTime()) / (1000 * 60 * 60 * 24);
        
        if (daysSinceDetection >= autoQuarantineDays) {
          record.status = 'quarantined';
          await this.quarantineTest(testId, record);
        }
      }
      
      // Release from quarantine if stable
      if (record.status === 'quarantined' && record.consecutiveStableRuns >= 10) {
        record.status = 'monitoring';
        await this.releaseFromQuarantine(testId, record);
      }
    }
  }

  private async quarantineTest(testId: string, record: FlakyTestRecord): Promise<void> {
    console.log(`🚧 Quarantining flaky test: ${testId}`);
    
    const quarantineInfo = {
      testId,
      reason: `High flake rate: ${(record.flakeRate * 100).toFixed(1)}%`,
      quarantinedAt: new Date().toISOString(),
      flakeRate: record.flakeRate,
      totalRuns: record.totalRuns,
      remediation: record.remediation
    };
    
    const quarantinePath = join(this.dataDir, 'quarantined', `${testId.replace(/[/\\:]/g, '_')}.json`);
    writeFileSync(quarantinePath, JSON.stringify(quarantineInfo, null, 2));
    
    // Update HIVE-MIND memory
    await this.updateHiveMemory('quarantine', { testId, action: 'quarantined', flakeRate: record.flakeRate });
  }

  private async releaseFromQuarantine(testId: string, record: FlakyTestRecord): Promise<void> {
    console.log(`✅ Releasing from quarantine: ${testId}`);
    
    // Update HIVE-MIND memory
    await this.updateHiveMemory('quarantine', { 
      testId, 
      action: 'released', 
      consecutiveStableRuns: record.consecutiveStableRuns 
    });
  }

  /**
   * Update baseline snapshots
   */
  private async updateBaselines(): Promise<void> {
    const baseline: BaselineSnapshot = {
      timestamp: new Date().toISOString(),
      totalTests: this.flakyTests.size,
      flakyTests: Array.from(this.flakyTests.values()).filter(t => t.status === 'active').length,
      averageFlakeRate: this.calculateAverageFlakeRate(),
      severityDistribution: this.calculateSeverityDistribution(),
      topFlakyTests: this.getTopFlakyTests(10)
    };
    
    const baselinePath = join(this.baselinesDir, `baseline-${new Date().toISOString().split('T')[0]}.json`);
    writeFileSync(baselinePath, JSON.stringify(baseline, null, 2));
    
    // Update current baseline
    const currentBaselinePath = join(this.baselinesDir, 'current.json');
    writeFileSync(currentBaselinePath, JSON.stringify(baseline, null, 2));
  }

  private calculateAverageFlakeRate(): number {
    const activeTests = Array.from(this.flakyTests.values()).filter(t => t.status === 'active');
    if (activeTests.length === 0) return 0;
    
    const totalFlakeRate = activeTests.reduce((sum, test) => sum + test.flakeRate, 0);
    return totalFlakeRate / activeTests.length;
  }

  private calculateSeverityDistribution(): { [severity: string]: number } {
    const distribution = { low: 0, medium: 0, high: 0, critical: 0 };
    
    for (const record of this.flakyTests.values()) {
      if (record.status === 'active') {
        distribution[record.severity]++;
      }
    }
    
    return distribution;
  }

  private getTopFlakyTests(limit: number): Array<{testName: string, flakeRate: number, severity: string}> {
    return Array.from(this.flakyTests.values())
      .filter(t => t.status === 'active')
      .sort((a, b) => b.flakeRate - a.flakeRate)
      .slice(0, limit)
      .map(t => ({
        testName: t.testName,
        flakeRate: t.flakeRate,
        severity: t.severity
      }));
  }

  /**
   * Generate flaky test report
   */
  async generateFlakyTestReport(): Promise<string> {
    const activeFlaky = Array.from(this.flakyTests.values()).filter(t => t.status === 'active');
    const quarantined = Array.from(this.flakyTests.values()).filter(t => t.status === 'quarantined');
    
    const report = `# Flaky Test Analysis Report

## Summary
- **Total Flaky Tests**: ${this.flakyTests.size}
- **Active**: ${activeFlaky.length}
- **Quarantined**: ${quarantined.length}
- **Average Flake Rate**: ${(this.calculateAverageFlakeRate() * 100).toFixed(1)}%

## Top Flaky Tests
${this.getTopFlakyTests(10).map(test => 
  `- **${test.testName}**: ${(test.flakeRate * 100).toFixed(1)}% (${test.severity})`
).join('\n')}

## Patterns Detected
${this.generatePatternSummary()}

## Remediation Recommendations
${this.generateRemediationSummary()}

---
*Generated by HIVE-MIND Flaky Test Detector*`;

    const reportPath = join(this.dataDir, `flaky-test-report-${this.sessionId}.md`);
    writeFileSync(reportPath, report);
    
    return report;
  }

  private generatePatternSummary(): string {
    const patternCounts = new Map<string, number>();
    
    for (const record of this.flakyTests.values()) {
      for (const pattern of record.patterns) {
        patternCounts.set(pattern.type, (patternCounts.get(pattern.type) || 0) + 1);
      }
    }
    
    return Array.from(patternCounts.entries())
      .map(([type, count]) => `- **${type}**: ${count} tests`)
      .join('\n') || 'No clear patterns detected';
  }

  private generateRemediationSummary(): string {
    const remediationCounts = new Map<string, number>();
    
    for (const record of this.flakyTests.values()) {
      for (const remediation of record.remediation) {
        remediationCounts.set(remediation.type, (remediationCounts.get(remediation.type) || 0) + 1);
      }
    }
    
    return Array.from(remediationCounts.entries())
      .map(([type, count]) => `- **${type}**: ${count} tests need this fix`)
      .join('\n') || 'No specific recommendations generated';
  }

  private async updateFlakyTestRecords(): Promise<void> {
    // This method would update existing records with new data
    // Implementation would merge new analysis with existing historical data
  }

  private async updateHiveMemory(operation: string, data: any): Promise<void> {
    try {
      execSync('npx claude-flow@alpha hooks post-edit --file "flaky-tests" --memory-key "flakes/analysis"', {
        input: JSON.stringify({ operation, data, timestamp: new Date().toISOString() }),
        stdio: 'pipe'
      });
    } catch (error) {
      console.warn('Failed to update HIVE memory:', error);
    }
  }

  private loadFlakyTestData(): void {
    const dataPath = join(this.dataDir, 'flaky-tests.json');
    if (existsSync(dataPath)) {
      try {
        const data = JSON.parse(readFileSync(dataPath, 'utf8'));
        this.flakyTests = new Map(Object.entries(data));
      } catch (error) {
        console.warn('Failed to load flaky test data:', error);
        this.flakyTests = new Map();
      }
    }
  }

  private async saveFlakyTestData(): Promise<void> {
    const dataPath = join(this.dataDir, 'flaky-tests.json');
    const data = Object.fromEntries(this.flakyTests);
    writeFileSync(dataPath, JSON.stringify(data, null, 2));
  }
}

export default FlakyTestDetector;