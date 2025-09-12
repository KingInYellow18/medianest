/**
 * TypeScript Error Testing Protocol - HIVE-MIND Build Validation
 * Created by: Tester Agent - MediaNest HIVE-MIND Phase 2
 * Purpose: Systematic validation of TypeScript fixes and error prevention
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

interface TypeScriptError {
  file: string;
  line: number;
  column: number;
  code: string;
  message: string;
  severity: 'error' | 'warning';
}

interface ValidationResult {
  success: boolean;
  errors: TypeScriptError[];
  warnings: TypeScriptError[];
  fixedCount: number;
  totalFiles: number;
  validationTime: number;
}

export class TypeScriptValidator {
  private readonly rootDir: string;
  private readonly logFile: string;
  private readonly memoryKey = 'medianest-phase2-build/typescript';

  constructor(rootDir: string = process.cwd()) {
    this.rootDir = rootDir;
    this.logFile = path.join(rootDir, 'typescript-validation.log');
  }

  /**
   * Run comprehensive TypeScript validation across all packages
   */
  async validateAllPackages(): Promise<ValidationResult> {
    const startTime = Date.now();
    const result: ValidationResult = {
      success: true,
      errors: [],
      warnings: [],
      fixedCount: 0,
      totalFiles: 0,
      validationTime: 0,
    };

    try {
      // Validate backend package
      const backendResult = await this.validatePackage('backend');
      result.errors.push(...backendResult.errors);
      result.warnings.push(...backendResult.warnings);
      result.totalFiles += backendResult.totalFiles;

      // Validate frontend package
      const frontendResult = await this.validatePackage('frontend');
      result.errors.push(...frontendResult.errors);
      result.warnings.push(...frontendResult.warnings);
      result.totalFiles += frontendResult.totalFiles;

      // Validate shared package
      const sharedResult = await this.validatePackage('shared');
      result.errors.push(...sharedResult.errors);
      result.warnings.push(...sharedResult.warnings);
      result.totalFiles += sharedResult.totalFiles;

      result.success = result.errors.length === 0;
      result.validationTime = Date.now() - startTime;

      await this.logValidationResult(result);
      await this.storeInMemory(result);

      return result;
    } catch (error) {
      result.success = false;
      result.errors.push({
        file: 'validation-process',
        line: 0,
        column: 0,
        code: 'VALIDATION_ERROR',
        message: `Validation process failed: ${error.message}`,
        severity: 'error',
      });
      result.validationTime = Date.now() - startTime;
      return result;
    }
  }

  /**
   * Validate a specific package (backend, frontend, shared)
   */
  async validatePackage(packageName: string): Promise<ValidationResult> {
    const packageDir = path.join(this.rootDir, packageName);
    const result: ValidationResult = {
      success: true,
      errors: [],
      warnings: [],
      fixedCount: 0,
      totalFiles: 0,
      validationTime: 0,
    };

    if (!fs.existsSync(packageDir)) {
      result.errors.push({
        file: packageName,
        line: 0,
        column: 0,
        code: 'PACKAGE_NOT_FOUND',
        message: `Package directory not found: ${packageDir}`,
        severity: 'error',
      });
      return result;
    }

    try {
      // Count TypeScript files
      result.totalFiles = this.countTypeScriptFiles(packageDir);

      // Run TypeScript compilation check
      const output = execSync(`cd ${packageDir} && npm run type-check`, {
        encoding: 'utf8',
        timeout: 60000,
        stdio: 'pipe',
      });

      // If we get here, compilation succeeded
      this.log(`✅ ${packageName}: TypeScript compilation successful`);
    } catch (error) {
      // Parse TypeScript errors from output
      const errors = this.parseTypeScriptErrors(error.stdout + error.stderr, packageName);
      result.errors.push(...errors.filter((e) => e.severity === 'error'));
      result.warnings.push(...errors.filter((e) => e.severity === 'warning'));

      this.log(
        `❌ ${packageName}: ${result.errors.length} errors, ${result.warnings.length} warnings`,
      );
    }

    result.success = result.errors.length === 0;
    return result;
  }

  /**
   * Test incremental fixes to prevent regressions
   */
  async testIncrementalFix(
    filePath: string,
    originalContent: string,
    fixedContent: string,
  ): Promise<boolean> {
    const backupPath = `${filePath}.backup`;

    try {
      // Create backup
      fs.writeFileSync(backupPath, originalContent);

      // Apply fix
      fs.writeFileSync(filePath, fixedContent);

      // Run validation on affected package
      const packageName = this.getPackageFromPath(filePath);
      const result = await this.validatePackage(packageName);

      if (result.success) {
        // Fix successful, remove backup
        fs.unlinkSync(backupPath);
        this.log(`✅ Incremental fix successful: ${filePath}`);
        return true;
      } else {
        // Fix caused issues, restore backup
        fs.writeFileSync(filePath, originalContent);
        fs.unlinkSync(backupPath);
        this.log(`❌ Incremental fix caused issues: ${filePath}`);
        return false;
      }
    } catch (error) {
      // Restore backup if it exists
      if (fs.existsSync(backupPath)) {
        fs.writeFileSync(filePath, fs.readFileSync(backupPath, 'utf8'));
        fs.unlinkSync(backupPath);
      }
      this.log(`❌ Error testing incremental fix: ${filePath} - ${error.message}`);
      return false;
    }
  }

  /**
   * Validate cross-package dependencies and type consistency
   */
  async validateCrossPackageDependencies(): Promise<ValidationResult> {
    const result: ValidationResult = {
      success: true,
      errors: [],
      warnings: [],
      fixedCount: 0,
      totalFiles: 0,
      validationTime: 0,
    };

    try {
      // Check if shared package types are correctly imported
      const backendSharedImports = this.findSharedImports('backend');
      const frontendSharedImports = this.findSharedImports('frontend');

      // Validate shared package is properly linked
      const backendSharedPath = path.join(
        this.rootDir,
        'backend',
        'node_modules',
        '@medianest',
        'shared',
      );
      const frontendSharedPath = path.join(
        this.rootDir,
        'frontend',
        'node_modules',
        '@medianest',
        'shared',
      );

      if (!fs.existsSync(backendSharedPath)) {
        result.errors.push({
          file: 'backend/package.json',
          line: 0,
          column: 0,
          code: 'SHARED_PACKAGE_NOT_LINKED',
          message: 'Shared package not linked in backend',
          severity: 'error',
        });
      }

      if (!fs.existsSync(frontendSharedPath)) {
        result.errors.push({
          file: 'frontend/package.json',
          line: 0,
          column: 0,
          code: 'SHARED_PACKAGE_NOT_LINKED',
          message: 'Shared package not linked in frontend',
          severity: 'error',
        });
      }

      // Validate type consistency across packages
      await this.validateTypeConsistency(result);

      result.success = result.errors.length === 0;
      return result;
    } catch (error) {
      result.errors.push({
        file: 'cross-package-validation',
        line: 0,
        column: 0,
        code: 'VALIDATION_ERROR',
        message: `Cross-package validation failed: ${error.message}`,
        severity: 'error',
      });
      return result;
    }
  }

  /**
   * Generate test failure rollback procedure
   */
  async generateRollbackProcedure(failedFiles: string[]): Promise<string> {
    const rollbackScript = path.join(this.rootDir, 'rollback-typescript-fixes.sh');

    let content = `#!/bin/bash
# Auto-generated rollback script for failed TypeScript fixes
# Generated at: ${new Date().toISOString()}

set -euo pipefail

echo "🔄 Rolling back failed TypeScript fixes..."

`;

    for (const file of failedFiles) {
      const backupFile = `${file}.backup`;
      content += `
if [[ -f "${backupFile}" ]]; then
    echo "Restoring: ${file}"
    cp "${backupFile}" "${file}"
    rm "${backupFile}"
fi
`;
    }

    content += `
echo "✅ Rollback completed"
npm run typecheck
`;

    fs.writeFileSync(rollbackScript, content);
    fs.chmodSync(rollbackScript, 0o755);

    this.log(`📋 Rollback procedure generated: ${rollbackScript}`);
    return rollbackScript;
  }

  private parseTypeScriptErrors(output: string, packageName: string): TypeScriptError[] {
    const errors: TypeScriptError[] = [];
    const lines = output.split('\n');

    for (const line of lines) {
      // Match TypeScript error format: filename(line,col): error TSxxxx: message
      const match = line.match(/^(.+?)\((\d+),(\d+)\):\s+(error|warning)\s+(TS\d+):\s+(.+)$/);

      if (match) {
        errors.push({
          file: path.join(packageName, match[1]),
          line: parseInt(match[2]),
          column: parseInt(match[3]),
          code: match[5],
          message: match[6],
          severity: match[4] as 'error' | 'warning',
        });
      }
    }

    return errors;
  }

  private countTypeScriptFiles(dir: string): number {
    let count = 0;
    const items = fs.readdirSync(dir);

    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
        count += this.countTypeScriptFiles(fullPath);
      } else if (stat.isFile() && (item.endsWith('.ts') || item.endsWith('.tsx'))) {
        count++;
      }
    }

    return count;
  }

  private getPackageFromPath(filePath: string): string {
    const relativePath = path.relative(this.rootDir, filePath);
    return relativePath.split(path.sep)[0];
  }

  private findSharedImports(packageName: string): string[] {
    const imports: string[] = [];
    const packageDir = path.join(this.rootDir, packageName);

    const findImports = (dir: string) => {
      const items = fs.readdirSync(dir);

      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory() && item !== 'node_modules') {
          findImports(fullPath);
        } else if (stat.isFile() && (item.endsWith('.ts') || item.endsWith('.tsx'))) {
          const content = fs.readFileSync(fullPath, 'utf8');
          const sharedImportMatch = content.match(/from ['"]@medianest\/shared['"]/g);
          if (sharedImportMatch) {
            imports.push(fullPath);
          }
        }
      }
    };

    if (fs.existsSync(packageDir)) {
      findImports(packageDir);
    }

    return imports;
  }

  private async validateTypeConsistency(result: ValidationResult): Promise<void> {
    // Check for common type inconsistencies between packages
    const sharedTypesPath = path.join(this.rootDir, 'shared', 'src', 'types');

    if (!fs.existsSync(sharedTypesPath)) {
      result.warnings.push({
        file: 'shared/src/types',
        line: 0,
        column: 0,
        code: 'SHARED_TYPES_NOT_FOUND',
        message: 'Shared types directory not found',
        severity: 'warning',
      });
      return;
    }

    // Additional type consistency checks can be added here
  }

  private async logValidationResult(result: ValidationResult): Promise<void> {
    const logEntry = {
      timestamp: new Date().toISOString(),
      success: result.success,
      errors: result.errors.length,
      warnings: result.warnings.length,
      totalFiles: result.totalFiles,
      validationTime: result.validationTime,
      details: result,
    };

    fs.appendFileSync(this.logFile, JSON.stringify(logEntry) + '\n');
  }

  private async storeInMemory(result: ValidationResult): Promise<void> {
    try {
      execSync(
        `npx claude-flow@alpha hooks memory-store --key "${this.memoryKey}/last-validation" --value '${JSON.stringify(result)}' --ttl 3600`,
        { stdio: 'ignore' },
      );
    } catch {
      // Memory storage is optional, continue if it fails
    }
  }

  private log(message: string): void {
    const timestamp = new Date().toISOString();
    const logMessage = `${timestamp}: ${message}`;
    console.log(logMessage);
    fs.appendFileSync(this.logFile, logMessage + '\n');
  }
}

// CLI interface
if (require.main === module) {
  const validator = new TypeScriptValidator();

  async function main() {
    const command = process.argv[2];

    switch (command) {
      case 'validate-all':
        const result = await validator.validateAllPackages();
        console.log(JSON.stringify(result, null, 2));
        process.exit(result.success ? 0 : 1);
        break;

      case 'validate-package':
        const packageName = process.argv[3];
        if (!packageName) {
          console.error('Package name required');
          process.exit(1);
        }
        const pkgResult = await validator.validatePackage(packageName);
        console.log(JSON.stringify(pkgResult, null, 2));
        process.exit(pkgResult.success ? 0 : 1);
        break;

      case 'validate-cross-deps':
        const crossResult = await validator.validateCrossPackageDependencies();
        console.log(JSON.stringify(crossResult, null, 2));
        process.exit(crossResult.success ? 0 : 1);
        break;

      default:
        console.log('Usage: typescript-validator.ts <command>');
        console.log('Commands:');
        console.log('  validate-all      - Validate all packages');
        console.log('  validate-package  - Validate specific package');
        console.log('  validate-cross-deps - Validate cross-package dependencies');
        process.exit(1);
    }
  }

  main().catch((error) => {
    console.error('Validation failed:', error);
    process.exit(1);
  });
}
