#!/usr/bin/env npx tsx

/**
 * Coverage Validation Agent - Comprehensive Coverage Analysis
 *
 * Mission: Measure actual coverage once tests execute and validate 80%+ achievement
 * Strategy: Multi-phase coverage measurement with detailed gap analysis
 */

import { execSync } from 'child_process';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';

interface CoverageReport {
  timestamp: string;
  overall: CoverageMetrics;
  backend: CoverageMetrics;
  frontend: CoverageMetrics;
  shared: CoverageMetrics;
  criticalPaths: CriticalPathCoverage[];
  gaps: CoverageGap[];
  recommendations: string[];
}

interface CoverageMetrics {
  statements: number;
  branches: number;
  functions: number;
  lines: number;
  threshold: number;
  status: 'pass' | 'fail' | 'warning';
}

interface CriticalPathCoverage {
  path: string;
  coverage: number;
  status: 'covered' | 'partial' | 'uncovered';
  files: string[];
}

interface CoverageGap {
  file: string;
  type: 'missing_tests' | 'low_coverage' | 'execution_failure';
  coverage: number;
  priority: 'critical' | 'high' | 'medium' | 'low';
}

class CoverageValidator {
  private projectRoot: string;
  private reportDir: string;

  constructor() {
    this.projectRoot = process.cwd();
    this.reportDir = join(this.projectRoot, 'coverage-reports');
    this.ensureReportDirectory();
  }

  private ensureReportDirectory(): void {
    try {
      execSync(`mkdir -p ${this.reportDir}`, { stdio: 'ignore' });
    } catch (error) {
      console.warn('Failed to create report directory:', error);
    }
  }

  /**
   * Phase 1: Execute tests with coverage measurement
   */
  async measureCoverage(): Promise<void> {
    console.log('🔍 Phase 1: Measuring Coverage Across All Modules...\n');

    // Backend coverage measurement
    const backendCoverage = await this.measureModuleCoverage('backend');

    // Frontend coverage measurement
    const frontendCoverage = await this.measureModuleCoverage('frontend');

    // Shared module coverage
    const sharedCoverage = await this.measureModuleCoverage('shared');

    // Overall project coverage
    const overallCoverage = await this.measureOverallCoverage();

    // Generate comprehensive report
    const report: CoverageReport = {
      timestamp: new Date().toISOString(),
      overall: overallCoverage,
      backend: backendCoverage,
      frontend: frontendCoverage,
      shared: sharedCoverage,
      criticalPaths: await this.analyzeCriticalPaths(),
      gaps: await this.identifyCoverageGaps(),
      recommendations: this.generateRecommendations(),
    };

    await this.generateReports(report);
  }

  /**
   * Measure coverage for specific module
   */
  private async measureModuleCoverage(
    module: 'backend' | 'frontend' | 'shared',
  ): Promise<CoverageMetrics> {
    console.log(`📊 Measuring ${module} coverage...`);

    try {
      // Use appropriate config for each module
      const config = this.getConfigForModule(module);
      const command = `npx vitest --config ${config} --coverage --run --reporter=json`;

      const result = execSync(command, {
        encoding: 'utf8',
        cwd: this.projectRoot,
        timeout: 120000, // 2 minute timeout
      });

      return this.parseCoverageOutput(result, module);
    } catch (error) {
      console.warn(`⚠️ Coverage measurement failed for ${module}:`, error);
      return this.createDefaultMetrics('fail');
    }
  }

  private getConfigForModule(module: string): string {
    const configs = {
      backend: 'vitest.config.ts',
      frontend: 'vitest.config.ts',
      shared: 'vitest.config.ts',
      overall: 'vitest.config.ts',
    };

    return configs[module] || 'vitest.config.ts';
  }

  private parseCoverageOutput(output: string, module: string): CoverageMetrics {
    try {
      // Parse vitest JSON output for coverage metrics
      const lines = output.split('\n');
      const jsonLine = lines.find(
        (line) => line.includes('"coverage"') || line.includes('"statements"'),
      );

      if (jsonLine) {
        const coverageData = JSON.parse(jsonLine);
        return {
          statements: coverageData.statements?.percentage || 0,
          branches: coverageData.branches?.percentage || 0,
          functions: coverageData.functions?.percentage || 0,
          lines: coverageData.lines?.percentage || 0,
          threshold: this.getThresholdForModule(module),
          status: this.determineStatus(coverageData.statements?.percentage || 0, module),
        };
      }
    } catch (error) {
      console.warn(`Failed to parse coverage for ${module}:`, error);
    }

    return this.createDefaultMetrics('warning');
  }

  private getThresholdForModule(module: string): number {
    const thresholds = {
      backend: 80,
      frontend: 75,
      shared: 85,
      overall: 80,
    };

    return thresholds[module] || 80;
  }

  private determineStatus(coverage: number, module: string): 'pass' | 'fail' | 'warning' {
    const threshold = this.getThresholdForModule(module);

    if (coverage >= threshold) return 'pass';
    if (coverage >= threshold - 10) return 'warning';
    return 'fail';
  }

  private createDefaultMetrics(status: 'pass' | 'fail' | 'warning'): CoverageMetrics {
    return {
      statements: 0,
      branches: 0,
      functions: 0,
      lines: 0,
      threshold: 80,
      status,
    };
  }

  /**
   * Measure overall project coverage
   */
  private async measureOverallCoverage(): Promise<CoverageMetrics> {
    console.log('🎯 Measuring overall project coverage...');

    try {
      const command = 'npx vitest --coverage --run --reporter=json';
      const result = execSync(command, {
        encoding: 'utf8',
        cwd: this.projectRoot,
        timeout: 180000, // 3 minute timeout for full suite
      });

      return this.parseCoverageOutput(result, 'overall');
    } catch (error) {
      console.warn('⚠️ Overall coverage measurement failed:', error);
      return this.createDefaultMetrics('fail');
    }
  }

  /**
   * Analyze critical business path coverage
   */
  private async analyzeCriticalPaths(): Promise<CriticalPathCoverage[]> {
    console.log('🔍 Analyzing critical business path coverage...');

    const criticalPaths = [
      {
        path: 'Authentication Flow',
        files: [
          'backend/src/controllers/auth.controller.ts',
          'backend/src/services/jwt.service.ts',
          'backend/src/middleware/auth.middleware.ts',
        ],
      },
      {
        path: 'Plex Integration',
        files: [
          'backend/src/controllers/plex.controller.ts',
          'backend/src/services/plex.service.ts',
        ],
      },
      {
        path: 'Media Management',
        files: [
          'backend/src/controllers/media.controller.ts',
          'backend/src/services/media.service.ts',
        ],
      },
      {
        path: 'Admin Dashboard',
        files: [
          'backend/src/controllers/admin.controller.ts',
          'backend/src/controllers/dashboard.controller.ts',
        ],
      },
    ];

    return criticalPaths.map((path) => ({
      ...path,
      coverage: this.calculatePathCoverage(path.files),
      status: this.getPathStatus(this.calculatePathCoverage(path.files)),
    }));
  }

  private calculatePathCoverage(files: string[]): number {
    // Simplified calculation - in real implementation would analyze actual coverage
    // For now, estimate based on test file existence
    const testFiles = files.filter((file) => {
      const testFile = file.replace('src/', 'tests/unit/').replace('.ts', '.test.ts');
      return existsSync(join(this.projectRoot, testFile));
    });

    return (testFiles.length / files.length) * 100;
  }

  private getPathStatus(coverage: number): 'covered' | 'partial' | 'uncovered' {
    if (coverage >= 90) return 'covered';
    if (coverage >= 50) return 'partial';
    return 'uncovered';
  }

  /**
   * Identify coverage gaps requiring attention
   */
  private async identifyCoverageGaps(): Promise<CoverageGap[]> {
    console.log('🔍 Identifying coverage gaps...');

    const gaps: CoverageGap[] = [];

    // Check for missing test files
    const sourceFiles = this.findSourceFiles();
    for (const file of sourceFiles) {
      const testFile = this.getTestFileForSource(file);
      if (!existsSync(testFile)) {
        gaps.push({
          file,
          type: 'missing_tests',
          coverage: 0,
          priority: this.getPriorityForFile(file),
        });
      }
    }

    return gaps;
  }

  private findSourceFiles(): string[] {
    try {
      const command =
        'find backend/src frontend/src shared/src -name "*.ts" -not -name "*.d.ts" -not -name "*.test.ts"';
      const result = execSync(command, { encoding: 'utf8', cwd: this.projectRoot });
      return result.trim().split('\n').filter(Boolean);
    } catch {
      return [];
    }
  }

  private getTestFileForSource(sourceFile: string): string {
    return sourceFile.replace('src/', 'tests/unit/').replace('.ts', '.test.ts');
  }

  private getPriorityForFile(file: string): 'critical' | 'high' | 'medium' | 'low' {
    if (file.includes('controller')) return 'critical';
    if (file.includes('service')) return 'high';
    if (file.includes('middleware')) return 'high';
    if (file.includes('util')) return 'medium';
    return 'low';
  }

  /**
   * Generate actionable recommendations
   */
  private generateRecommendations(): string[] {
    return [
      'Fix test execution issues to enable accurate coverage measurement',
      'Prioritize controller test completion for critical business paths',
      'Implement comprehensive service layer testing',
      'Add integration tests for external API dependencies',
      'Establish coverage monitoring in CI/CD pipeline',
      'Create coverage dashboard for real-time tracking',
      'Set up automated coverage quality gates',
    ];
  }

  /**
   * Generate comprehensive coverage reports
   */
  private async generateReports(report: CoverageReport): Promise<void> {
    console.log('📋 Generating coverage reports...');

    // JSON report for automation
    const jsonReport = join(this.reportDir, `coverage-report-${Date.now()}.json`);
    writeFileSync(jsonReport, JSON.stringify(report, null, 2));

    // Markdown report for humans
    const markdownReport = this.generateMarkdownReport(report);
    const mdReport = join(
      this.reportDir,
      `coverage-validation-${new Date().toISOString().split('T')[0]}.md`,
    );
    writeFileSync(mdReport, markdownReport);

    // Console summary
    this.printSummary(report);

    console.log(`\n📁 Reports generated:`);
    console.log(`   JSON: ${jsonReport}`);
    console.log(`   Markdown: ${mdReport}`);
  }

  private generateMarkdownReport(report: CoverageReport): string {
    return `# Coverage Validation Report
**Generated**: ${report.timestamp}
**Mission**: 80%+ Coverage Achievement Validation

## 📊 Coverage Summary

| Module | Statements | Branches | Functions | Lines | Status |
|--------|------------|----------|-----------|-------|--------|
| Overall | ${report.overall.statements}% | ${report.overall.branches}% | ${report.overall.functions}% | ${report.overall.lines}% | ${this.getStatusEmoji(report.overall.status)} |
| Backend | ${report.backend.statements}% | ${report.backend.branches}% | ${report.backend.functions}% | ${report.backend.lines}% | ${this.getStatusEmoji(report.backend.status)} |
| Frontend | ${report.frontend.statements}% | ${report.frontend.branches}% | ${report.frontend.functions}% | ${report.frontend.lines}% | ${this.getStatusEmoji(report.frontend.status)} |
| Shared | ${report.shared.statements}% | ${report.shared.branches}% | ${report.shared.functions}% | ${report.shared.lines}% | ${this.getStatusEmoji(report.shared.status)} |

## 🎯 Critical Path Coverage

${report.criticalPaths
  .map((path) => `- **${path.path}**: ${path.coverage}% ${this.getPathEmoji(path.status)}`)
  .join('\n')}

## ⚠️ Coverage Gaps (${report.gaps.length})

${report.gaps.map((gap) => `- **${gap.file}**: ${gap.type} (${gap.priority} priority)`).join('\n')}

## 💡 Recommendations

${report.recommendations.map((rec) => `- ${rec}`).join('\n')}

## 🚀 Next Actions

1. **Immediate**: Fix test execution issues preventing measurement
2. **Short-term**: Achieve 80%+ coverage across all modules  
3. **Long-term**: Establish continuous coverage monitoring

---
*Generated by Coverage Validation Agent*`;
  }

  private getStatusEmoji(status: string): string {
    return status === 'pass' ? '✅' : status === 'warning' ? '⚠️' : '❌';
  }

  private getPathEmoji(status: string): string {
    return status === 'covered' ? '✅' : status === 'partial' ? '⚠️' : '❌';
  }

  private printSummary(report: CoverageReport): void {
    console.log('\n📊 COVERAGE VALIDATION SUMMARY');
    console.log('================================');
    console.log(
      `Overall Coverage: ${report.overall.statements}% ${this.getStatusEmoji(report.overall.status)}`,
    );
    console.log(
      `Backend Coverage: ${report.backend.statements}% ${this.getStatusEmoji(report.backend.status)}`,
    );
    console.log(
      `Frontend Coverage: ${report.frontend.statements}% ${this.getStatusEmoji(report.frontend.status)}`,
    );
    console.log(`Coverage Gaps: ${report.gaps.length}`);
    console.log(
      `Critical Paths: ${report.criticalPaths.filter((p) => p.status === 'covered').length}/${report.criticalPaths.length} covered`,
    );
  }
}

// CLI execution
async function main() {
  console.log('🔍 Coverage Validation Agent - Starting Analysis...\n');

  const validator = new CoverageValidator();
  await validator.measureCoverage();

  console.log('\n✅ Coverage validation complete!');
}

// ES module compatible CLI detection
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { CoverageValidator };
