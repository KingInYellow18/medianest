/**
 * MIGRATION GUIDE AND UTILITIES
 *
 * Tools and examples for migrating existing test files to use the new shared infrastructure.
 * Provides automated migration scripts and backwards compatibility layers.
 */

import fs from 'fs/promises';
import path from 'path';
import { glob } from 'glob';

/**
 * Test file migration utilities
 */
export class TestMigrationUtils {
  private static readonly BACKUP_DIR = 'tests/shared/backups';
  private static migrationLog: MigrationLogEntry[] = [];

  /**
   * Analyze existing test files to identify migration opportunities
   */
  static async analyzeTestFiles(pattern: string = '**/*.test.ts'): Promise<MigrationAnalysis> {
    const testFiles = await glob(pattern, { cwd: process.cwd() });
    const analysis: MigrationAnalysis = {
      totalFiles: testFiles.length,
      duplicatePatterns: new Map(),
      migrationCandidates: [],
      complexityScores: new Map(),
      recommendations: [],
    };

    console.log(`🔍 Analyzing ${testFiles.length} test files...`);

    for (const file of testFiles) {
      try {
        const content = await fs.readFile(file, 'utf-8');
        const fileAnalysis = this.analyzeTestFile(file, content);

        // Track duplicate patterns
        fileAnalysis.patterns.forEach((pattern) => {
          const existing = analysis.duplicatePatterns.get(pattern) || [];
          existing.push(file);
          analysis.duplicatePatterns.set(pattern, existing);
        });

        // Calculate complexity score
        analysis.complexityScores.set(file, fileAnalysis.complexityScore);

        // Check if file is migration candidate
        if (fileAnalysis.migrationBenefit > 0.3) {
          analysis.migrationCandidates.push({
            file,
            benefit: fileAnalysis.migrationBenefit,
            patterns: fileAnalysis.patterns,
            recommendations: fileAnalysis.recommendations,
          });
        }
      } catch (error) {
        console.warn(`⚠️ Could not analyze ${file}:`, error.message);
      }
    }

    // Generate recommendations
    analysis.recommendations = this.generateRecommendations(analysis);

    console.log(
      `✅ Analysis complete: ${analysis.migrationCandidates.length} migration candidates found`,
    );
    return analysis;
  }

  /**
   * Analyze individual test file for migration patterns
   */
  private static analyzeTestFile(filePath: string, content: string): TestFileAnalysis {
    const patterns: string[] = [];
    let complexityScore = 0;
    const recommendations: string[] = [];

    // Check for common duplication patterns
    const checks = [
      {
        pattern: 'user creation',
        regex: /createTestUser|createUser|new.*User|user.*create/gi,
        weight: 0.2,
      },
      {
        pattern: 'JWT creation',
        regex: /jwt\.sign|generateToken|createToken|sign\(/gi,
        weight: 0.15,
      },
      {
        pattern: 'database setup',
        regex: /beforeEach.*prisma|beforeAll.*database|setupDatabase/gi,
        weight: 0.25,
      },
      {
        pattern: 'mock setup',
        regex: /vi\.mock|jest\.mock|mockImplementation|mockReturnValue/gi,
        weight: 0.1,
      },
      {
        pattern: 'beforeEach/afterEach',
        regex: /(beforeEach|afterEach)\(/gi,
        weight: 0.1,
      },
      {
        pattern: 'test data cleanup',
        regex: /clearTestData|deleteMany|cleanup|teardown/gi,
        weight: 0.15,
      },
    ];

    for (const check of checks) {
      const matches = content.match(check.regex);
      if (matches && matches.length > 0) {
        patterns.push(check.pattern);
        complexityScore += matches.length * check.weight;

        if (matches.length > 3) {
          recommendations.push(`Consider using shared ${check.pattern} utilities`);
        }
      }
    }

    // Calculate migration benefit (0-1 score)
    const migrationBenefit = Math.min(complexityScore / 10, 1);

    return {
      patterns,
      complexityScore,
      migrationBenefit,
      recommendations,
    };
  }

  /**
   * Generate migration recommendations
   */
  private static generateRecommendations(analysis: MigrationAnalysis): string[] {
    const recommendations: string[] = [];

    // Check for patterns duplicated across many files
    analysis.duplicatePatterns.forEach((files, pattern) => {
      if (files.length > 5) {
        recommendations.push(
          `High Priority: "${pattern}" pattern found in ${files.length} files - use shared ${pattern} utilities`,
        );
      } else if (files.length > 2) {
        recommendations.push(
          `Medium Priority: "${pattern}" pattern found in ${files.length} files - consider consolidation`,
        );
      }
    });

    // Check for high complexity files
    const highComplexityFiles = Array.from(analysis.complexityScores.entries())
      .filter(([_, score]) => score > 5)
      .sort(([_, a], [__, b]) => b - a)
      .slice(0, 10);

    if (highComplexityFiles.length > 0) {
      recommendations.push(
        `High complexity files requiring immediate migration: ${highComplexityFiles
          .map(([file]) => path.basename(file))
          .join(', ')}`,
      );
    }

    return recommendations;
  }

  /**
   * Migrate a specific test file to use shared infrastructure
   */
  static async migrateTestFile(
    filePath: string,
    options: MigrationOptions = {},
  ): Promise<MigrationResult> {
    console.log(`🔄 Migrating ${filePath}...`);

    try {
      // Create backup
      if (options.createBackup !== false) {
        await this.createBackup(filePath);
      }

      // Read original file
      const originalContent = await fs.readFile(filePath, 'utf-8');

      // Apply migrations
      let migratedContent = originalContent;
      const appliedMigrations: string[] = [];

      // Migration 1: Replace user creation patterns
      const userMigration = this.migrateUserCreation(migratedContent);
      if (userMigration.changed) {
        migratedContent = userMigration.content;
        appliedMigrations.push('user-creation');
      }

      // Migration 2: Replace JWT patterns
      const jwtMigration = this.migrateJWTCreation(migratedContent);
      if (jwtMigration.changed) {
        migratedContent = jwtMigration.content;
        appliedMigrations.push('jwt-creation');
      }

      // Migration 3: Replace database setup patterns
      const dbMigration = this.migrateDatabaseSetup(migratedContent);
      if (dbMigration.changed) {
        migratedContent = dbMigration.content;
        appliedMigrations.push('database-setup');
      }

      // Migration 4: Replace mock patterns
      const mockMigration = this.migrateMockSetup(migratedContent);
      if (mockMigration.changed) {
        migratedContent = mockMigration.content;
        appliedMigrations.push('mock-setup');
      }

      // Migration 5: Replace setup/teardown patterns
      const setupMigration = this.migrateSetupTeardown(migratedContent);
      if (setupMigration.changed) {
        migratedContent = setupMigration.content;
        appliedMigrations.push('setup-teardown');
      }

      // Write migrated file if changes were made
      const hasChanges = appliedMigrations.length > 0;
      if (hasChanges) {
        await fs.writeFile(filePath, migratedContent, 'utf-8');
        console.log(
          `  ✅ Applied ${appliedMigrations.length} migrations: ${appliedMigrations.join(', ')}`,
        );
      } else {
        console.log(`  ℹ️ No migrations needed`);
      }

      // Log migration
      const logEntry: MigrationLogEntry = {
        file: filePath,
        timestamp: new Date(),
        migrations: appliedMigrations,
        success: true,
        linesChanged: hasChanges ? this.countLineChanges(originalContent, migratedContent) : 0,
      };
      this.migrationLog.push(logEntry);

      return {
        success: true,
        appliedMigrations,
        linesChanged: logEntry.linesChanged,
        backupPath: options.createBackup !== false ? await this.getBackupPath(filePath) : undefined,
      };
    } catch (error) {
      const logEntry: MigrationLogEntry = {
        file: filePath,
        timestamp: new Date(),
        migrations: [],
        success: false,
        error: error.message,
      };
      this.migrationLog.push(logEntry);

      console.error(`  ❌ Migration failed:`, error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Migrate user creation patterns
   */
  private static migrateUserCreation(content: string): MigrationPatch {
    let changed = false;
    let newContent = content;

    // Add import if not present
    if (!content.includes('TestUserFactory')) {
      const importMatch = content.match(/^import.*from.*['"][^'"]*['"];?$/gm);
      if (importMatch) {
        const lastImport = importMatch[importMatch.length - 1];
        const importLine =
          "import { TestUserFactory, createTestUser } from '../shared/test-factories';";
        newContent = newContent.replace(lastImport, `${lastImport}\n${importLine}`);
        changed = true;
      }
    }

    // Replace user creation patterns
    const replacements = [
      {
        from: /const\s+(\w+)\s*=\s*await\s+prisma\.user\.create\s*\(\s*\{[^}]+\}\s*\)/g,
        to: 'const $1 = await createTestUser()',
      },
      {
        from: /createTestUser\s*\([^)]*\)/g,
        to: 'TestUserFactory.createTestUser()',
      },
      {
        from: /new User\(\{[^}]+\}\)/g,
        to: 'await TestUserFactory.createTestUser()',
      },
    ];

    for (const replacement of replacements) {
      if (replacement.from.test(newContent)) {
        newContent = newContent.replace(replacement.from, replacement.to);
        changed = true;
      }
    }

    return { content: newContent, changed };
  }

  /**
   * Migrate JWT creation patterns
   */
  private static migrateJWTCreation(content: string): MigrationPatch {
    let changed = false;
    let newContent = content;

    // Add import if not present
    if (!content.includes('TestJWTFactory')) {
      const importMatch = content.match(/import.*test-factories.*;/);
      if (importMatch) {
        newContent = newContent.replace(
          importMatch[0],
          importMatch[0]
            .replace('test-factories', 'test-factories')
            .replace(/{([^}]+)}/, '{ $1, TestJWTFactory, createTestJWT }'),
        );
        changed = true;
      }
    }

    // Replace JWT creation patterns
    const replacements = [
      {
        from: /jwt\.sign\s*\([^)]+\)/g,
        to: 'TestJWTFactory.createTestJWT()',
      },
      {
        from: /generateToken\s*\([^)]*\)/g,
        to: 'TestJWTFactory.createTestJWT()',
      },
      {
        from: /createTestJWT\s*\([^)]*\)/g,
        to: 'TestJWTFactory.createTestJWT()',
      },
    ];

    for (const replacement of replacements) {
      if (replacement.from.test(newContent)) {
        newContent = newContent.replace(replacement.from, replacement.to);
        changed = true;
      }
    }

    return { content: newContent, changed };
  }

  /**
   * Migrate database setup patterns
   */
  private static migrateDatabaseSetup(content: string): MigrationPatch {
    let changed = false;
    let newContent = content;

    // Add import if not present
    if (!content.includes('DatabaseTestUtils')) {
      const importMatch = content.match(/import.*test-factories.*;/);
      if (importMatch) {
        newContent = newContent.replace(
          importMatch[0],
          `${importMatch[0]}\nimport { DatabaseTestUtils, setupTestDatabase, clearTestData } from '../shared/database-utils';`,
        );
        changed = true;
      }
    }

    // Replace database setup patterns
    const replacements = [
      {
        from: /beforeAll\s*\(\s*async\s*\(\s*\)\s*=>\s*\{[\s\S]*?prisma[\s\S]*?\}\s*\)/g,
        to: 'beforeAll(async () => { await setupTestDatabase(); })',
      },
      {
        from: /afterAll\s*\(\s*async\s*\(\s*\)\s*=>\s*\{[\s\S]*?disconnect[\s\S]*?\}\s*\)/g,
        to: 'afterAll(async () => { await DatabaseTestUtils.cleanup(); })',
      },
      {
        from: /afterEach\s*\(\s*async\s*\(\s*\)\s*=>\s*\{[\s\S]*?deleteMany[\s\S]*?\}\s*\)/g,
        to: 'afterEach(async () => { await clearTestData(); })',
      },
    ];

    for (const replacement of replacements) {
      if (replacement.from.test(newContent)) {
        newContent = newContent.replace(replacement.from, replacement.to);
        changed = true;
      }
    }

    return { content: newContent, changed };
  }

  /**
   * Migrate mock setup patterns
   */
  private static migrateMockSetup(content: string): MigrationPatch {
    let changed = false;
    let newContent = content;

    // Add import if not present
    if (!content.includes('MockInfrastructure')) {
      const importMatch = content.match(/import.*test-factories.*;/);
      if (importMatch) {
        newContent = newContent.replace(
          importMatch[0],
          `${importMatch[0]}\nimport { MockInfrastructure, setupAllMocks, resetAllMocks } from '../shared/mock-infrastructure';`,
        );
        changed = true;
      }
    }

    // Replace mock setup patterns
    if (content.includes('vi.mock') && !content.includes('setupAllMocks')) {
      const beforeEachMatch = content.match(/beforeEach\s*\(\s*[^{]*\{/);
      if (beforeEachMatch) {
        newContent = newContent.replace(
          beforeEachMatch[0],
          `${beforeEachMatch[0]}\n    setupAllMocks();`,
        );
        changed = true;
      }
    }

    return { content: newContent, changed };
  }

  /**
   * Migrate setup/teardown patterns
   */
  private static migrateSetupTeardown(content: string): MigrationPatch {
    let changed = false;
    let newContent = content;

    // Check if file has complex setup/teardown that can be simplified
    const hasComplexSetup =
      /beforeEach[\s\S]{100,}/.test(content) || /afterEach[\s\S]{100,}/.test(content);

    if (hasComplexSetup && !content.includes('TestSetupPresets')) {
      // Add import
      newContent = `import { integrationTestSetup } from '../shared/setup-utils';\n${newContent}`;

      // Add setup call
      const describeMatch = newContent.match(/describe\s*\(\s*['"][^'"]*['"],\s*\(\s*\)\s*=>\s*\{/);
      if (describeMatch) {
        newContent = newContent.replace(
          describeMatch[0],
          `${describeMatch[0]}\n  const testSuite = integrationTestSetup();\n  testSuite.setupSuite();`,
        );
        changed = true;
      }
    }

    return { content: newContent, changed };
  }

  /**
   * Create backup of original file
   */
  private static async createBackup(filePath: string): Promise<string> {
    const backupDir = path.join(process.cwd(), this.BACKUP_DIR);
    await fs.mkdir(backupDir, { recursive: true });

    const fileName = path.basename(filePath);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(backupDir, `${fileName}.${timestamp}.backup`);

    const originalContent = await fs.readFile(filePath, 'utf-8');
    await fs.writeFile(backupPath, originalContent, 'utf-8');

    return backupPath;
  }

  /**
   * Get backup path for a file
   */
  private static async getBackupPath(filePath: string): Promise<string> {
    const fileName = path.basename(filePath);
    const backupDir = path.join(process.cwd(), this.BACKUP_DIR);
    const backups = await fs.readdir(backupDir);
    const latestBackup = backups
      .filter((f) => f.startsWith(fileName))
      .sort()
      .pop();

    return latestBackup ? path.join(backupDir, latestBackup) : '';
  }

  /**
   * Count line changes between original and migrated content
   */
  private static countLineChanges(original: string, migrated: string): number {
    const originalLines = original.split('\n');
    const migratedLines = migrated.split('\n');

    let changes = Math.abs(originalLines.length - migratedLines.length);
    const minLength = Math.min(originalLines.length, migratedLines.length);

    for (let i = 0; i < minLength; i++) {
      if (originalLines[i] !== migratedLines[i]) {
        changes++;
      }
    }

    return changes;
  }

  /**
   * Batch migrate multiple test files
   */
  static async batchMigrate(
    pattern: string = '**/*.test.ts',
    options: MigrationOptions = {},
  ): Promise<BatchMigrationResult> {
    const testFiles = await glob(pattern, { cwd: process.cwd() });
    console.log(`🚀 Starting batch migration of ${testFiles.length} files...`);

    const results: MigrationResult[] = [];
    let successful = 0;
    let failed = 0;

    for (const file of testFiles) {
      const result = await this.migrateTestFile(file, options);
      results.push({ ...result, file });

      if (result.success) {
        successful++;
      } else {
        failed++;
      }
    }

    const summary: BatchMigrationResult = {
      totalFiles: testFiles.length,
      successful,
      failed,
      results,
      migrationLog: this.migrationLog.slice(-testFiles.length), // Last N entries
    };

    console.log(`✅ Batch migration complete: ${successful} successful, ${failed} failed`);
    return summary;
  }

  /**
   * Generate migration report
   */
  static async generateMigrationReport(outputPath?: string): Promise<string> {
    const analysis = await this.analyzeTestFiles();
    const report = this.formatMigrationReport(analysis);

    if (outputPath) {
      await fs.writeFile(outputPath, report, 'utf-8');
      console.log(`📊 Migration report written to ${outputPath}`);
    }

    return report;
  }

  /**
   * Format migration report
   */
  private static formatMigrationReport(analysis: MigrationAnalysis): string {
    let report = '# Test Infrastructure Migration Report\n\n';
    report += `Generated: ${new Date().toISOString()}\n\n`;
    report += `## Summary\n`;
    report += `- Total files analyzed: ${analysis.totalFiles}\n`;
    report += `- Migration candidates: ${analysis.migrationCandidates.length}\n`;
    report += `- Duplicate patterns identified: ${analysis.duplicatePatterns.size}\n\n`;

    report += `## High Priority Migration Candidates\n`;
    analysis.migrationCandidates
      .sort((a, b) => b.benefit - a.benefit)
      .slice(0, 20)
      .forEach((candidate) => {
        report += `- **${path.basename(candidate.file)}** (benefit: ${(candidate.benefit * 100).toFixed(1)}%)\n`;
        report += `  - Patterns: ${candidate.patterns.join(', ')}\n`;
        candidate.recommendations.forEach((rec) => {
          report += `  - ${rec}\n`;
        });
        report += '\n';
      });

    report += `## Duplicate Patterns\n`;
    Array.from(analysis.duplicatePatterns.entries())
      .sort(([, a], [, b]) => b.length - a.length)
      .forEach(([pattern, files]) => {
        if (files.length > 2) {
          report += `- **${pattern}**: ${files.length} files\n`;
          files.slice(0, 5).forEach((file) => {
            report += `  - ${path.basename(file)}\n`;
          });
          if (files.length > 5) {
            report += `  - ... and ${files.length - 5} more\n`;
          }
          report += '\n';
        }
      });

    report += `## Recommendations\n`;
    analysis.recommendations.forEach((rec) => {
      report += `- ${rec}\n`;
    });

    if (this.migrationLog.length > 0) {
      report += `\n## Migration Log\n`;
      this.migrationLog
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        .slice(0, 20)
        .forEach((entry) => {
          report += `- **${path.basename(entry.file)}** (${entry.timestamp.toISOString()})\n`;
          if (entry.success) {
            report += `  - ✅ Success: ${entry.migrations.join(', ')}\n`;
            if (entry.linesChanged) {
              report += `  - Lines changed: ${entry.linesChanged}\n`;
            }
          } else {
            report += `  - ❌ Failed: ${entry.error}\n`;
          }
          report += '\n';
        });
    }

    return report;
  }
}

// Type definitions
export interface MigrationAnalysis {
  totalFiles: number;
  duplicatePatterns: Map<string, string[]>;
  migrationCandidates: MigrationCandidate[];
  complexityScores: Map<string, number>;
  recommendations: string[];
}

export interface MigrationCandidate {
  file: string;
  benefit: number;
  patterns: string[];
  recommendations: string[];
}

export interface TestFileAnalysis {
  patterns: string[];
  complexityScore: number;
  migrationBenefit: number;
  recommendations: string[];
}

export interface MigrationOptions {
  createBackup?: boolean;
  dryRun?: boolean;
  preserveComments?: boolean;
}

export interface MigrationResult {
  success: boolean;
  appliedMigrations?: string[];
  linesChanged?: number;
  backupPath?: string;
  error?: string;
  file?: string;
}

export interface BatchMigrationResult {
  totalFiles: number;
  successful: number;
  failed: number;
  results: MigrationResult[];
  migrationLog: MigrationLogEntry[];
}

export interface MigrationLogEntry {
  file: string;
  timestamp: Date;
  migrations: string[];
  success: boolean;
  linesChanged?: number;
  error?: string;
}

export interface MigrationPatch {
  content: string;
  changed: boolean;
}

// Migration CLI interface
export const migrationCommands = {
  analyze: TestMigrationUtils.analyzeTestFiles,
  migrate: TestMigrationUtils.migrateTestFile,
  batchMigrate: TestMigrationUtils.batchMigrate,
  report: TestMigrationUtils.generateMigrationReport,
};
