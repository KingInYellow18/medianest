/**
 * TEST ISOLATION ANALYZER AND VALIDATOR
 *
 * Analyzes test files to identify isolation issues and provides automated fixes.
 * This tool systematically applies Phase F proven patterns to eliminate cascade failures.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';

interface IsolationIssue {
  file: string;
  line: number;
  issue:
    | 'missing_beforeEach'
    | 'missing_afterEach'
    | 'shared_state'
    | 'mock_leakage'
    | 'no_cleanup';
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  fix: string;
}

interface IsolationReport {
  totalFiles: number;
  filesWithIssues: number;
  issuesByType: Record<string, number>;
  criticalIssues: IsolationIssue[];
  recommendedFixes: string[];
}

export class TestIsolationAnalyzer {
  private issues: IsolationIssue[] = [];
  private processedFiles: Set<string> = new Set();

  /**
   * Analyze a test file for isolation issues
   */
  analyzeFile(filePath: string): IsolationIssue[] {
    if (this.processedFiles.has(filePath)) {
      return [];
    }

    this.processedFiles.add(filePath);

    if (!existsSync(filePath)) {
      return [
        {
          file: filePath,
          line: 0,
          issue: 'missing_beforeEach',
          severity: 'critical',
          description: 'File does not exist',
          fix: 'Create file with proper isolation setup',
        },
      ];
    }

    const content = readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const fileIssues: IsolationIssue[] = [];

    // Check for basic isolation patterns
    const hasBeforeEach = /beforeEach\s*\(/.test(content);
    const hasAfterEach = /afterEach\s*\(/.test(content);
    const hasDescribe = /describe\s*\(/.test(content);
    const hasTest = /(test|it)\s*\(/.test(content);

    // Only analyze files with actual tests
    if (!hasDescribe && !hasTest) {
      return fileIssues;
    }

    // Critical: Missing beforeEach cleanup
    if (!hasBeforeEach) {
      fileIssues.push({
        file: filePath,
        line: 1,
        issue: 'missing_beforeEach',
        severity: 'critical',
        description: 'Missing beforeEach hook for test isolation',
        fix: 'Add beforeEach(() => { vi.clearAllMocks(); vi.resetAllMocks(); isolationManager.reset(); });',
      });
    }

    // Critical: Missing afterEach cleanup
    if (!hasAfterEach) {
      fileIssues.push({
        file: filePath,
        line: 1,
        issue: 'missing_afterEach',
        severity: 'critical',
        description: 'Missing afterEach hook for cleanup',
        fix: 'Add afterEach(() => { isolationManager?.cleanup(); vi.restoreAllMocks(); });',
      });
    }

    // Check for shared state issues
    lines.forEach((line, index) => {
      const lineNum = index + 1;

      // Global variable mutations
      if (
        /^\s*(let|var|const)\s+\w+.*=.*(?!vi\.fn|Mock)/.test(line) &&
        !/import|export/.test(line) &&
        !line.includes('beforeEach') &&
        !line.includes('afterEach')
      ) {
        fileIssues.push({
          file: filePath,
          line: lineNum,
          issue: 'shared_state',
          severity: 'high',
          description: 'Potential shared state variable outside test scope',
          fix: 'Move variable inside beforeEach or use isolation manager',
        });
      }

      // Mock leakage patterns
      if (/vi\.mock\(.*\)/.test(line) && !line.includes('factory')) {
        fileIssues.push({
          file: filePath,
          line: lineNum,
          issue: 'mock_leakage',
          severity: 'medium',
          description: 'Mock without factory pattern may leak between tests',
          fix: 'Use isolation manager or factory pattern for mocks',
        });
      }

      // Missing cleanup in describe blocks
      if (/describe\s*\(/.test(line)) {
        const describeBlock = this.extractBlock(lines, index);
        if (!describeBlock.includes('beforeEach') || !describeBlock.includes('afterEach')) {
          fileIssues.push({
            file: filePath,
            line: lineNum,
            issue: 'no_cleanup',
            severity: 'high',
            description: 'Describe block missing proper cleanup hooks',
            fix: 'Add beforeEach/afterEach hooks to describe block',
          });
        }
      }
    });

    this.issues.push(...fileIssues);
    return fileIssues;
  }

  /**
   * Generate comprehensive isolation report
   */
  generateReport(): IsolationReport {
    const issuesByType: Record<string, number> = {};
    const criticalIssues: IsolationIssue[] = [];

    this.issues.forEach((issue) => {
      issuesByType[issue.issue] = (issuesByType[issue.issue] || 0) + 1;
      if (issue.severity === 'critical' || issue.severity === 'high') {
        criticalIssues.push(issue);
      }
    });

    const recommendedFixes = this.generateRecommendedFixes();

    return {
      totalFiles: this.processedFiles.size,
      filesWithIssues: new Set(this.issues.map((i) => i.file)).size,
      issuesByType,
      criticalIssues,
      recommendedFixes,
    };
  }

  /**
   * Apply automated fixes to a test file
   */
  applyFixes(filePath: string, dryRun: boolean = false): boolean {
    if (!existsSync(filePath)) {
      return false;
    }

    const content = readFileSync(filePath, 'utf-8');
    const issues = this.analyzeFile(filePath);

    if (issues.length === 0) {
      return true; // No issues to fix
    }

    const fixedContent = this.applyUniversalIsolationPattern(content, filePath);

    if (dryRun) {
      console.log(`Would apply fixes to ${filePath}:`);
      console.log(fixedContent);
      return true;
    }

    writeFileSync(filePath, fixedContent);
    return true;
  }

  /**
   * Apply universal isolation pattern to test file
   */
  private applyUniversalIsolationPattern(content: string, filePath: string): string {
    const lines = content.split('\n');
    const imports = [];
    const nonImports = [];

    // Separate imports from rest of content
    let inImportSection = true;
    for (const line of lines) {
      if (
        inImportSection &&
        (line.startsWith('import ') || line.startsWith('export ') || line.trim() === '')
      ) {
        imports.push(line);
      } else {
        inImportSection = false;
        nonImports.push(line);
      }
    }

    // Add universal isolation import
    const isolationImport =
      "import { setupUniversalTestIsolation } from './mocks/foundation/universal-test-isolation';";
    if (!imports.some((line) => line.includes('universal-test-isolation'))) {
      imports.push(isolationImport);
    }

    // Find first describe or test block
    const firstTestIndex = nonImports.findIndex((line) =>
      /describe\s*\(|test\s*\(|it\s*\(/.test(line),
    );

    if (firstTestIndex === -1) {
      return [...imports, ...nonImports].join('\n');
    }

    // Insert isolation setup before first test
    const isolationSetup = [
      '',
      '// UNIVERSAL TEST ISOLATION - Phase F Proven Pattern',
      'let isolationManager: any;',
      '',
      'beforeAll(async () => {',
      '  isolationManager = setupUniversalTestIsolation();',
      '});',
      '',
      'beforeEach(async () => {',
      '  // CRITICAL: Complete isolation reset before each test',
      '  vi.clearAllMocks();',
      '  vi.resetAllMocks();',
      '  isolationManager?.reset();',
      '});',
      '',
      'afterEach(async () => {',
      '  // CRITICAL: Aggressive cleanup after each test',
      '  isolationManager?.cleanup();',
      '  vi.restoreAllMocks();',
      '});',
      '',
      'afterAll(async () => {',
      '  // Final cleanup',
      '  isolationManager?.cleanup();',
      '});',
      '',
    ];

    // Check if isolation is already present
    const hasIsolation = nonImports.some((line) => line.includes('isolationManager'));

    if (!hasIsolation) {
      nonImports.splice(firstTestIndex, 0, ...isolationSetup);
    }

    return [...imports, ...nonImports].join('\n');
  }

  private extractBlock(lines: string[], startIndex: number): string {
    let braceCount = 0;
    let endIndex = startIndex;

    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i];
      braceCount += (line.match(/\{/g) || []).length;
      braceCount -= (line.match(/\}/g) || []).length;

      if (braceCount === 0 && i > startIndex) {
        endIndex = i;
        break;
      }
    }

    return lines.slice(startIndex, endIndex + 1).join('\n');
  }

  private generateRecommendedFixes(): string[] {
    const fixes = [];

    if (this.issues.some((i) => i.issue === 'missing_beforeEach')) {
      fixes.push('Add beforeEach hooks with vi.clearAllMocks() and isolation manager reset');
    }

    if (this.issues.some((i) => i.issue === 'missing_afterEach')) {
      fixes.push('Add afterEach hooks with comprehensive cleanup');
    }

    if (this.issues.some((i) => i.issue === 'shared_state')) {
      fixes.push('Move shared variables into beforeEach scope or use isolation boundaries');
    }

    if (this.issues.some((i) => i.issue === 'mock_leakage')) {
      fixes.push('Replace direct vi.mock calls with isolation manager patterns');
    }

    fixes.push('Apply universal isolation pattern to all test files');
    fixes.push('Use proven Phase F isolation boundaries for critical services');

    return fixes;
  }

  /**
   * Validate isolation effectiveness
   */
  validateIsolation(filePath: string): boolean {
    const issues = this.analyzeFile(filePath);
    const criticalIssues = issues.filter((i) => i.severity === 'critical' || i.severity === 'high');
    return criticalIssues.length === 0;
  }

  /**
   * Reset analyzer state
   */
  reset(): void {
    this.issues = [];
    this.processedFiles.clear();
  }
}

// CLI interface for batch processing
export function analyzeProjectIsolation(testDir: string): IsolationReport {
  const analyzer = new TestIsolationAnalyzer();
  const glob = require('glob');

  const testFiles = glob.sync('**/*.test.{ts,js,tsx,jsx}', { cwd: testDir });

  testFiles.forEach((file: string) => {
    const fullPath = resolve(testDir, file);
    analyzer.analyzeFile(fullPath);
  });

  return analyzer.generateReport();
}

export function fixProjectIsolation(testDir: string, dryRun: boolean = false): void {
  const analyzer = new TestIsolationAnalyzer();
  const glob = require('glob');

  const testFiles = glob.sync('**/*.test.{ts,js,tsx,jsx}', { cwd: testDir });

  testFiles.forEach((file: string) => {
    const fullPath = resolve(testDir, file);
    console.log(`Processing: ${file}`);
    analyzer.applyFixes(fullPath, dryRun);
  });

  const report = analyzer.generateReport();
  console.log(`\nIsolation Fix Summary:`);
  console.log(`- Files processed: ${report.totalFiles}`);
  console.log(`- Critical issues: ${report.criticalIssues.length}`);
  console.log(`- Recommended fixes applied: ${report.recommendedFixes.length}`);
}
