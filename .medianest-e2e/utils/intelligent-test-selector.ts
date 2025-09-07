/**
 * Intelligent Test Selection System for MediaNest E2E Tests
 * HIVE-MIND Enhanced Dynamic Test Selection and Optimization
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

export interface TestImpactMapping {
  [filePath: string]: {
    affectedTests: string[];
    impactScore: number;
    lastUpdated: string;
  };
}

export interface TestHistoryData {
  testId: string;
  testName: string;
  successRate: number;
  avgDuration: number;
  flakeRate: number;
  lastRun: string;
  totalRuns: number;
  recentFailures: number;
  browsers: string[];
  priority: 'high' | 'medium' | 'low';
  tags: string[];
}

export interface SelectionCriteria {
  changedFiles: string[];
  testType: 'smoke' | 'regression' | 'full' | 'custom';
  timeConstraint?: number; // minutes
  maxTests?: number;
  priorityFilter?: ('high' | 'medium' | 'low')[];
  browserFilter?: string[];
  includeFlaky?: boolean;
  riskThreshold?: number; // 0-100
}

export interface TestSelectionResult {
  selectedTests: string[];
  estimatedDuration: number;
  riskScore: number;
  optimizationApplied: {
    parallelization: number;
    browserOptimization: boolean;
    testSharding: boolean;
    smartRetries: boolean;
  };
  reasoning: string[];
  skippedTests: {
    testName: string;
    reason: string;
  }[];
}

export interface ParallelExecutionPlan {
  shards: {
    shardId: string;
    tests: string[];
    estimatedDuration: number;
    browsers: string[];
    priority: number;
  }[];
  totalEstimatedTime: number;
  parallelEfficiency: number;
}

export class IntelligentTestSelector {
  private sessionId: string;
  private cacheDir: string;
  private historyDir: string;
  private impactMapping: TestImpactMapping;
  private testHistory: Map<string, TestHistoryData>;

  constructor(sessionId?: string) {
    this.sessionId = sessionId || `selector-${Date.now()}`;
    this.cacheDir = join('.swarm', 'cache');
    this.historyDir = join('reports', 'test-history');
    this.impactMapping = {};
    this.testHistory = new Map();
    
    this.ensureDirectories();
    this.loadCachedData();
  }

  private ensureDirectories(): void {
    [this.cacheDir, this.historyDir].forEach(dir => {
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
    });
  }

  /**
   * Select tests intelligently based on criteria and historical data
   */
  async selectTests(criteria: SelectionCriteria): Promise<TestSelectionResult> {
    console.log('🧠 Analyzing test selection criteria...');
    
    try {
      // Update impact mapping and test history
      await this.updateImpactMapping(criteria.changedFiles);
      await this.updateTestHistory();
      
      // Get initial test candidates
      let candidates = await this.getTestCandidates(criteria);
      
      // Apply intelligent filtering and scoring
      const scoredTests = await this.scoreTests(candidates, criteria);
      
      // Apply constraints and optimization
      const selectedTests = await this.applyConstraints(scoredTests, criteria);
      
      // Generate execution plan
      const executionPlan = await this.generateExecutionPlan(selectedTests, criteria);
      
      // Create final result
      const result = await this.buildSelectionResult(selectedTests, executionPlan, criteria);
      
      // Cache the selection for future use
      await this.cacheSelection(criteria, result);
      
      console.log(`✅ Selected ${result.selectedTests.length} tests (estimated: ${result.estimatedDuration}min)`);
      return result;
      
    } catch (error) {
      console.error('❌ Test selection failed:', error);
      throw error;
    }
  }

  /**
   * Update impact mapping based on changed files
   */
  private async updateImpactMapping(changedFiles: string[]): Promise<void> {
    console.log('🔄 Updating test impact mapping...');
    
    // Load existing mapping
    await this.loadImpactMapping();
    
    for (const file of changedFiles) {
      if (!this.impactMapping[file]) {
        // Analyze file to determine affected tests
        const affectedTests = await this.analyzeFileImpact(file);
        
        this.impactMapping[file] = {
          affectedTests,
          impactScore: this.calculateImpactScore(affectedTests),
          lastUpdated: new Date().toISOString()
        };
      } else {
        // Update existing mapping if stale
        const lastUpdated = new Date(this.impactMapping[file].lastUpdated);
        const hoursOld = (Date.now() - lastUpdated.getTime()) / (1000 * 60 * 60);
        
        if (hoursOld > 24) {
          const affectedTests = await this.analyzeFileImpact(file);
          this.impactMapping[file].affectedTests = affectedTests;
          this.impactMapping[file].lastUpdated = new Date().toISOString();
        }
      }
    }
    
    // Save updated mapping
    await this.saveImpactMapping();
  }

  /**
   * Analyze which tests are affected by a changed file
   */
  private async analyzeFileImpact(filePath: string): Promise<string[]> {
    const affectedTests: string[] = [];
    
    // Direct mapping based on file patterns
    const directMappings = {
      'frontend/src/components/auth/': ['@auth', '@login'],
      'frontend/src/components/dashboard/': ['@dashboard', '@core'],
      'frontend/src/components/media/': ['@media', '@browser'],
      'backend/src/routes/auth': ['@auth', '@api'],
      'backend/src/routes/media': ['@media', '@api'],
      'shared/types/': ['@integration', '@types'],
      'database/': ['@integration', '@database']
    };

    // Find matching patterns
    for (const [pattern, tests] of Object.entries(directMappings)) {
      if (filePath.includes(pattern)) {
        affectedTests.push(...tests);
      }
    }

    // Analyze imports and dependencies (simplified)
    if (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) {
      try {
        const content = readFileSync(filePath, 'utf8');
        
        // Check for component imports
        const componentMatches = content.match(/from ['"](\.\.?\/.*)['"]/g);
        if (componentMatches) {
          for (const match of componentMatches) {
            if (match.includes('components/auth')) affectedTests.push('@auth');
            if (match.includes('components/dashboard')) affectedTests.push('@dashboard');
            if (match.includes('components/media')) affectedTests.push('@media');
          }
        }
        
        // Check for API calls
        if (content.includes('fetch(') || content.includes('axios.')) {
          affectedTests.push('@api', '@integration');
        }
        
      } catch (error) {
        console.warn(`Failed to analyze file ${filePath}:`, error.message);
      }
    }

    return [...new Set(affectedTests)];
  }

  private calculateImpactScore(tests: string[]): number {
    // Higher score means more impact
    let score = tests.length * 10;
    
    // Critical tests have higher impact
    if (tests.some(t => t.includes('auth') || t.includes('critical'))) score += 50;
    if (tests.some(t => t.includes('api') || t.includes('integration'))) score += 30;
    if (tests.some(t => t.includes('smoke'))) score += 40;
    
    return Math.min(score, 100);
  }

  /**
   * Update test history from recent runs
   */
  private async updateTestHistory(): Promise<void> {
    console.log('📊 Updating test history...');
    
    // Load existing history
    await this.loadTestHistory();
    
    // Scan recent test results
    const recentResults = await this.scanRecentTestResults();
    
    for (const result of recentResults) {
      const existing = this.testHistory.get(result.testId);
      
      if (existing) {
        // Update existing record
        existing.totalRuns++;
        if (result.status === 'passed') {
          existing.successRate = (existing.successRate * (existing.totalRuns - 1) + 100) / existing.totalRuns;
        } else {
          existing.successRate = (existing.successRate * (existing.totalRuns - 1)) / existing.totalRuns;
          existing.recentFailures++;
        }
        
        if (result.status === 'flaky') {
          existing.flakeRate = Math.min(existing.flakeRate + 0.1, 1.0);
        }
        
        existing.avgDuration = (existing.avgDuration * (existing.totalRuns - 1) + result.duration) / existing.totalRuns;
        existing.lastRun = result.timestamp;
        
      } else {
        // Create new record
        this.testHistory.set(result.testId, {
          testId: result.testId,
          testName: result.testName,
          successRate: result.status === 'passed' ? 100 : 0,
          avgDuration: result.duration,
          flakeRate: result.status === 'flaky' ? 0.1 : 0,
          lastRun: result.timestamp,
          totalRuns: 1,
          recentFailures: result.status === 'failed' ? 1 : 0,
          browsers: [result.browser],
          priority: this.determinePriority(result.testName),
          tags: this.extractTags(result.testName)
        });
      }
    }
    
    // Save updated history
    await this.saveTestHistory();
  }

  private async scanRecentTestResults(): Promise<any[]> {
    const results: any[] = [];
    
    try {
      // Scan for recent JSON test results
      const resultFiles = execSync('find test-results -name "*.json" -type f -mtime -1 2>/dev/null || echo ""', {
        encoding: 'utf8'
      }).split('\n').filter(Boolean);
      
      for (const file of resultFiles) {
        try {
          const data = JSON.parse(readFileSync(file, 'utf8'));
          if (data.suites) {
            for (const suite of data.suites) {
              for (const test of suite.tests || []) {
                results.push({
                  testId: `${suite.file}-${test.title}`,
                  testName: test.title,
                  status: test.status,
                  duration: test.duration || 0,
                  browser: data.config?.project || 'unknown',
                  timestamp: new Date().toISOString()
                });
              }
            }
          }
        } catch (error) {
          console.warn(`Failed to parse ${file}:`, error.message);
        }
      }
    } catch (error) {
      console.warn('Failed to scan test results:', error.message);
    }
    
    return results;
  }

  private determinePriority(testName: string): 'high' | 'medium' | 'low' {
    const name = testName.toLowerCase();
    
    if (name.includes('smoke') || name.includes('critical') || name.includes('auth')) {
      return 'high';
    }
    if (name.includes('core') || name.includes('integration')) {
      return 'medium';
    }
    return 'low';
  }

  private extractTags(testName: string): string[] {
    const tags: string[] = [];
    const name = testName.toLowerCase();
    
    if (name.includes('smoke')) tags.push('smoke');
    if (name.includes('auth')) tags.push('auth');
    if (name.includes('dashboard')) tags.push('dashboard');
    if (name.includes('media')) tags.push('media');
    if (name.includes('api')) tags.push('api');
    if (name.includes('visual')) tags.push('visual');
    if (name.includes('accessibility')) tags.push('accessibility');
    if (name.includes('performance')) tags.push('performance');
    
    return tags;
  }

  /**
   * Get initial test candidates based on criteria
   */
  private async getTestCandidates(criteria: SelectionCriteria): Promise<string[]> {
    let candidates: string[] = [];
    
    if (criteria.changedFiles.length > 0) {
      // Impact-based selection
      const impactedTests = new Set<string>();
      
      for (const file of criteria.changedFiles) {
        if (this.impactMapping[file]) {
          this.impactMapping[file].affectedTests.forEach(test => impactedTests.add(test));
        }
      }
      
      candidates.push(...impactedTests);
    }
    
    // Add tests based on type
    switch (criteria.testType) {
      case 'smoke':
        candidates.push('@smoke', '@critical');
        break;
      case 'regression':
        candidates.push('@regression', '@core', '@integration');
        break;
      case 'full':
        candidates.push('@smoke', '@regression', '@core', '@integration', '@visual', '@accessibility');
        break;
    }
    
    // Remove duplicates and return
    return [...new Set(candidates)];
  }

  /**
   * Score tests based on various factors
   */
  private async scoreTests(candidates: string[], criteria: SelectionCriteria): Promise<Array<{test: string, score: number}>> {
    const scoredTests: Array<{test: string, score: number}> = [];
    
    for (const test of candidates) {
      let score = 50; // Base score
      
      // Priority scoring
      const history = this.findTestHistory(test);
      if (history) {
        // Success rate factor
        score += history.successRate * 0.3;
        
        // Flakiness penalty
        score -= history.flakeRate * 20;
        
        // Recent failures boost
        if (history.recentFailures > 0) {
          score += 20;
        }
        
        // Priority boost
        switch (history.priority) {
          case 'high': score += 30; break;
          case 'medium': score += 15; break;
          case 'low': score += 0; break;
        }
      }
      
      // Impact scoring
      for (const file of criteria.changedFiles) {
        if (this.impactMapping[file]?.affectedTests.includes(test)) {
          score += this.impactMapping[file].impactScore * 0.5;
        }
      }
      
      // Type-specific scoring
      if (criteria.testType === 'smoke' && test.includes('smoke')) {
        score += 40;
      }
      
      scoredTests.push({ test, score });
    }
    
    return scoredTests.sort((a, b) => b.score - a.score);
  }

  private findTestHistory(testPattern: string): TestHistoryData | undefined {
    for (const [testId, history] of this.testHistory) {
      if (testId.includes(testPattern) || history.tags.some(tag => testPattern.includes(tag))) {
        return history;
      }
    }
    return undefined;
  }

  /**
   * Apply constraints and select final test set
   */
  private async applyConstraints(
    scoredTests: Array<{test: string, score: number}>, 
    criteria: SelectionCriteria
  ): Promise<string[]> {
    let selectedTests = scoredTests.map(t => t.test);
    const skippedTests: Array<{testName: string, reason: string}> = [];
    
    // Apply max tests constraint
    if (criteria.maxTests && selectedTests.length > criteria.maxTests) {
      const excess = selectedTests.splice(criteria.maxTests);
      excess.forEach(test => {
        skippedTests.push({ testName: test, reason: 'Exceeded max test limit' });
      });
    }
    
    // Apply time constraint
    if (criteria.timeConstraint) {
      const timeConstraintMs = criteria.timeConstraint * 60 * 1000;
      let estimatedTime = 0;
      const timeBoundTests: string[] = [];
      
      for (const test of selectedTests) {
        const history = this.findTestHistory(test);
        const testDuration = history?.avgDuration || 30000; // Default 30s
        
        if (estimatedTime + testDuration <= timeConstraintMs) {
          timeBoundTests.push(test);
          estimatedTime += testDuration;
        } else {
          skippedTests.push({ testName: test, reason: 'Time constraint exceeded' });
        }
      }
      
      selectedTests = timeBoundTests;
    }
    
    // Filter out flaky tests if specified
    if (!criteria.includeFlaky) {
      selectedTests = selectedTests.filter(test => {
        const history = this.findTestHistory(test);
        if (history && history.flakeRate > 0.2) {
          skippedTests.push({ testName: test, reason: 'High flake rate excluded' });
          return false;
        }
        return true;
      });
    }
    
    return selectedTests;
  }

  /**
   * Generate optimized execution plan
   */
  private async generateExecutionPlan(selectedTests: string[], criteria: SelectionCriteria): Promise<ParallelExecutionPlan> {
    const plan: ParallelExecutionPlan = {
      shards: [],
      totalEstimatedTime: 0,
      parallelEfficiency: 0
    };
    
    // Group tests by estimated duration and dependencies
    const testGroups = await this.groupTestsForParallelization(selectedTests);
    
    // Create shards
    const optimalShardCount = Math.min(testGroups.length, 4); // Max 4 shards
    
    for (let i = 0; i < optimalShardCount; i++) {
      const shardTests = testGroups[i] || [];
      const estimatedDuration = this.calculateShardDuration(shardTests);
      
      plan.shards.push({
        shardId: `shard-${i + 1}`,
        tests: shardTests,
        estimatedDuration,
        browsers: criteria.browserFilter || ['chromium-desktop'],
        priority: i === 0 ? 1 : 2
      });
    }
    
    // Calculate total time and efficiency
    plan.totalEstimatedTime = Math.max(...plan.shards.map(s => s.estimatedDuration));
    const sequentialTime = plan.shards.reduce((sum, s) => sum + s.estimatedDuration, 0);
    plan.parallelEfficiency = sequentialTime / plan.totalEstimatedTime;
    
    return plan;
  }

  private async groupTestsForParallelization(tests: string[]): Promise<string[][]> {
    const groups: string[][] = [];
    const testData = tests.map(test => ({
      test,
      duration: this.findTestHistory(test)?.avgDuration || 30000,
      priority: this.findTestHistory(test)?.priority || 'low'
    }));
    
    // Sort by duration (longest first) and priority
    testData.sort((a, b) => {
      if (a.priority !== b.priority) {
        const priorityWeight = { high: 3, medium: 2, low: 1 };
        return priorityWeight[b.priority] - priorityWeight[a.priority];
      }
      return b.duration - a.duration;
    });
    
    // Distribute tests across groups (bin packing approach)
    const groupDurations: number[] = [];
    
    for (const testInfo of testData) {
      // Find the group with minimum total duration
      let targetGroup = 0;
      let minDuration = groupDurations[0] || 0;
      
      for (let i = 1; i < groupDurations.length; i++) {
        if (groupDurations[i] < minDuration) {
          minDuration = groupDurations[i];
          targetGroup = i;
        }
      }
      
      // Create new group if needed
      if (!groups[targetGroup]) {
        groups[targetGroup] = [];
        groupDurations[targetGroup] = 0;
      }
      
      groups[targetGroup].push(testInfo.test);
      groupDurations[targetGroup] += testInfo.duration;
    }
    
    return groups;
  }

  private calculateShardDuration(tests: string[]): number {
    return tests.reduce((total, test) => {
      const history = this.findTestHistory(test);
      return total + (history?.avgDuration || 30000);
    }, 0);
  }

  /**
   * Build final selection result
   */
  private async buildSelectionResult(
    selectedTests: string[], 
    executionPlan: ParallelExecutionPlan, 
    criteria: SelectionCriteria
  ): Promise<TestSelectionResult> {
    const totalDuration = executionPlan.totalEstimatedTime / 1000 / 60; // Convert to minutes
    const riskScore = this.calculateRiskScore(selectedTests);
    
    return {
      selectedTests,
      estimatedDuration: Math.round(totalDuration),
      riskScore,
      optimizationApplied: {
        parallelization: executionPlan.shards.length,
        browserOptimization: (criteria.browserFilter?.length || 0) > 0,
        testSharding: executionPlan.shards.length > 1,
        smartRetries: true
      },
      reasoning: await this.generateSelectionReasoning(selectedTests, criteria),
      skippedTests: [] // Would be populated during constraint application
    };
  }

  private calculateRiskScore(selectedTests: string[]): number {
    let totalRisk = 0;
    let testCount = 0;
    
    for (const test of selectedTests) {
      const history = this.findTestHistory(test);
      if (history) {
        // Risk factors: low success rate, high flake rate, recent failures
        let testRisk = 100 - history.successRate;
        testRisk += history.flakeRate * 30;
        testRisk += history.recentFailures * 10;
        
        totalRisk += Math.min(testRisk, 100);
        testCount++;
      }
    }
    
    return testCount > 0 ? Math.round(totalRisk / testCount) : 0;
  }

  private async generateSelectionReasoning(selectedTests: string[], criteria: SelectionCriteria): Promise<string[]> {
    const reasoning: string[] = [];
    
    if (criteria.changedFiles.length > 0) {
      reasoning.push(`Selected tests impacted by ${criteria.changedFiles.length} changed files`);
    }
    
    reasoning.push(`Test type: ${criteria.testType} (${selectedTests.length} tests selected)`);
    
    if (criteria.timeConstraint) {
      reasoning.push(`Time constraint applied: ${criteria.timeConstraint} minutes`);
    }
    
    const highPriorityTests = selectedTests.filter(test => {
      const history = this.findTestHistory(test);
      return history?.priority === 'high';
    }).length;
    
    if (highPriorityTests > 0) {
      reasoning.push(`${highPriorityTests} high-priority tests included`);
    }
    
    return reasoning;
  }

  /**
   * Cache selection for future reference
   */
  private async cacheSelection(criteria: SelectionCriteria, result: TestSelectionResult): Promise<void> {
    const cacheKey = this.generateCacheKey(criteria);
    const cacheData = {
      criteria,
      result,
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId
    };
    
    const cachePath = join(this.cacheDir, `${cacheKey}.json`);
    writeFileSync(cachePath, JSON.stringify(cacheData, null, 2));
  }

  private generateCacheKey(criteria: SelectionCriteria): string {
    const hash = JSON.stringify({
      changedFiles: criteria.changedFiles.sort(),
      testType: criteria.testType,
      timeConstraint: criteria.timeConstraint,
      maxTests: criteria.maxTests
    });
    
    return `selection-${Buffer.from(hash).toString('base64').substr(0, 16)}`;
  }

  // Data persistence methods
  private loadCachedData(): void {
    this.loadImpactMapping();
    this.loadTestHistory();
  }

  private async loadImpactMapping(): Promise<void> {
    const impactPath = join(this.cacheDir, 'impact-mapping.json');
    if (existsSync(impactPath)) {
      try {
        this.impactMapping = JSON.parse(readFileSync(impactPath, 'utf8'));
      } catch (error) {
        console.warn('Failed to load impact mapping:', error);
        this.impactMapping = {};
      }
    }
  }

  private async saveImpactMapping(): Promise<void> {
    const impactPath = join(this.cacheDir, 'impact-mapping.json');
    writeFileSync(impactPath, JSON.stringify(this.impactMapping, null, 2));
  }

  private async loadTestHistory(): Promise<void> {
    const historyPath = join(this.historyDir, 'test-history.json');
    if (existsSync(historyPath)) {
      try {
        const data = JSON.parse(readFileSync(historyPath, 'utf8'));
        this.testHistory = new Map(Object.entries(data));
      } catch (error) {
        console.warn('Failed to load test history:', error);
        this.testHistory = new Map();
      }
    }
  }

  private async saveTestHistory(): Promise<void> {
    const historyPath = join(this.historyDir, 'test-history.json');
    const data = Object.fromEntries(this.testHistory);
    writeFileSync(historyPath, JSON.stringify(data, null, 2));
  }
}

export default IntelligentTestSelector;