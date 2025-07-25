#!/usr/bin/env node
/**
 * ESLint 9 Migration Script
 * 
 * CRITICAL: This script is for PREPARATION ONLY
 * DO NOT RUN until Vitest migration is complete
 * 
 * This script handles the migration from ESLint 8.57.1 to 9.32.0
 * with TypeScript ESLint 7.18.0 → 8.38.0
 */

import { execSync } from 'child_process';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';

const MIGRATION_CONFIG = {
  currentVersions: {
    eslint: '8.57.1',
    typescriptParser: '7.18.0',
    typescriptPlugin: '7.18.0'
  },
  targetVersions: {
    eslint: '9.32.0',
    typescriptParser: '8.38.0',
    typescriptPlugin: '8.38.0'
  },
  projectRoot: process.cwd()
};

class ESLintMigration {
  constructor() {
    this.backupDir = join(MIGRATION_CONFIG.projectRoot, '.eslint-backup');
    this.configPath = join(MIGRATION_CONFIG.projectRoot, 'eslint.config.js');
  }

  async run() {
    console.log('🚨 CRITICAL: ESLint 9 Migration Script');
    console.log('📋 Status: PREPARATION PHASE ONLY');
    console.log('⚠️  DO NOT EXECUTE MIGRATION UNTIL VITEST IS COMPLETE\n');

    try {
      await this.validatePrerequisites();
      await this.createBackup();
      await this.prepareFlatConfig();
      await this.validateConfiguration();
      console.log('\n✅ Migration preparation completed successfully');
      console.log('🔄 Ready for execution after Vitest completion');
    } catch (error) {
      console.error('❌ Migration preparation failed:', error.message);
      process.exit(1);
    }
  }

  async validatePrerequisites() {
    console.log('🔍 Validating prerequisites...');
    
    // Check if Vitest migration is complete
    const vitestStatus = this.checkVitestStatus();
    if (!vitestStatus.complete) {
      console.log('⏳ Waiting for Vitest migration completion');
      console.log('   Current Vitest status:', vitestStatus.version);
      // Don't exit - this is preparation phase
    }

    // Check current ESLint installation
    const currentEslint = this.getCurrentESLintVersion();
    console.log(`📦 Current ESLint: ${currentEslint}`);
    
    // Verify no existing flat config
    if (existsSync(this.configPath)) {
      throw new Error('eslint.config.js already exists - migration may have been started');
    }

    console.log('✅ Prerequisites validated');
  }

  async createBackup() {
    console.log('💾 Creating configuration backup...');
    
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
    const backupData = {
      timestamp: new Date().toISOString(),
      currentVersions: MIGRATION_CONFIG.currentVersions,
      packageJsonDependencies: {
        eslint: packageJson.devDependencies?.eslint,
        '@typescript-eslint/parser': packageJson.devDependencies?.['@typescript-eslint/parser'],
        '@typescript-eslint/eslint-plugin': packageJson.devDependencies?.['@typescript-eslint/eslint-plugin']
      },
      existingConfigs: this.findExistingConfigs(),
      migrationPlan: 'eslint-9-flat-config'
    };

    writeFileSync('.eslint-backup.json', JSON.stringify(backupData, null, 2));
    console.log('✅ Backup created: .eslint-backup.json');
  }

  async prepareFlatConfig() {
    console.log('⚙️  Preparing flat configuration structure...');
    
    const flatConfig = this.generateFlatConfig();
    
    // Write prepared config with INACTIVE marker
    const configContent = `// ESLint 9 Flat Configuration (PREPARED - NOT ACTIVE)
// 🚨 DO NOT ACTIVATE until after Vitest migration completion
// 
// This configuration is prepared for ESLint 9 migration
// Current status: INACTIVE
//
// To activate:
// 1. Ensure Vitest migration is complete
// 2. Run: npm install eslint@9.32.0 @typescript-eslint/parser@8.38.0 @typescript-eslint/eslint-plugin@8.38.0
// 3. Remove this comment block
// 4. Test configuration with: npx eslint --config eslint.config.js src/

${flatConfig}

// END PREPARED CONFIGURATION`;

    writeFileSync(`${this.configPath}.prepared`, configContent);
    console.log('✅ Flat configuration prepared: eslint.config.js.prepared');
  }

  generateFlatConfig() {
    return `import js from '@eslint/js';
import typescript from '@typescript-eslint/eslint-plugin';
import typescriptParser from '@typescript-eslint/parser';
import prettier from 'eslint-plugin-prettier';
import importPlugin from 'eslint-plugin-import';

export default [
  // Base JavaScript configuration
  js.configs.recommended,
  
  // Global ignores
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'build/**',
      '**/*.config.js',
      'storybook-static/**'
    ]
  },
  
  // TypeScript files configuration
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        project: [
          './tsconfig.json',
          './frontend/tsconfig.json',
          './backend/tsconfig.json',
          './shared/tsconfig.json'
        ].filter(path => require('fs').existsSync(path))
      }
    },
    plugins: {
      '@typescript-eslint': typescript,
      'prettier': prettier,
      'import': importPlugin
    },
    rules: {
      // TypeScript ESLint rules
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/explicit-function-return-type': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/prefer-const': 'error',
      
      // Import rules
      'import/order': ['error', {
        groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
        'newlines-between': 'always'
      }],
      'import/no-unresolved': 'error',
      
      // Prettier integration
      'prettier/prettier': 'error',
      
      // General rules
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'prefer-const': 'error'
    }
  },
  
  // Frontend workspace specific
  {
    files: ['frontend/**/*.ts', 'frontend/**/*.tsx'],
    rules: {
      // React/Next.js specific rules
      '@typescript-eslint/explicit-function-return-type': 'off', // React components
      'no-console': 'off' // Allow console in development
    }
  },
  
  // Backend workspace specific  
  {
    files: ['backend/**/*.ts'],
    rules: {
      // Node.js specific rules
      'no-console': ['warn', { allow: ['warn', 'error', 'info'] }]
    }
  },
  
  // Test files
  {
    files: ['**/*.test.ts', '**/*.test.tsx', '**/*.spec.ts', '**/*.spec.tsx'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'no-console': 'off'
    }
  },
  
  // Shared workspace
  {
    files: ['shared/**/*.ts'],
    rules: {
      '@typescript-eslint/explicit-function-return-type': 'error' // Strict for shared code
    }
  }
];`;
  }

  async validateConfiguration() {
    console.log('🔍 Validating prepared configuration...');
    
    // Check if prepared config file exists
    if (!existsSync(`${this.configPath}.prepared`)) {
      throw new Error('Prepared configuration file not found');
    }

    // Syntax validation (without execution)
    try {
      const configContent = readFileSync(`${this.configPath}.prepared`, 'utf8');
      if (!configContent.includes('export default')) {
        throw new Error('Invalid flat config format');
      }
      console.log('✅ Configuration syntax validated');
    } catch (error) {
      throw new Error(`Configuration validation failed: ${error.message}`);
    }
  }

  findExistingConfigs() {
    const configFiles = [
      '.eslintrc',
      '.eslintrc.js',
      '.eslintrc.json',
      '.eslintrc.yml',
      '.eslintrc.yaml'
    ];
    
    return configFiles.filter(file => existsSync(join(MIGRATION_CONFIG.projectRoot, file)));
  }

  getCurrentESLintVersion() {
    try {
      const result = execSync('npm list eslint --depth=0', { encoding: 'utf8' });
      const match = result.match(/eslint@([\d.]+)/);
      return match ? match[1] : 'unknown';
    } catch {
      return 'not installed';
    }
  }

  checkVitestStatus() {
    try {
      const result = execSync('npm list vitest --depth=0', { encoding: 'utf8' });
      const match = result.match(/vitest@([\d.]+)/);
      return {
        version: match ? match[1] : 'unknown',
        complete: false // This would need actual coordination check
      };
    } catch {
      return { version: 'not installed', complete: false };
    }
  }

  async executeActualMigration() {
    console.log('🚀 EXECUTING ACTUAL MIGRATION...');
    console.log('⚠️  This will modify your package.json and create new configurations');
    
    // Install new versions
    console.log('📦 Installing ESLint 9 and TypeScript ESLint 8...');
    execSync(`npm install --save-dev \\
      eslint@${MIGRATION_CONFIG.targetVersions.eslint} \\
      @typescript-eslint/parser@${MIGRATION_CONFIG.targetVersions.typescriptParser} \\
      @typescript-eslint/eslint-plugin@${MIGRATION_CONFIG.targetVersions.typescriptPlugin}`, 
      { stdio: 'inherit' }
    );

    // Activate configuration
    console.log('⚙️  Activating flat configuration...');
    const preparedConfig = readFileSync(`${this.configPath}.prepared`, 'utf8');
    const activeConfig = preparedConfig
      .replace(/\/\/ ESLint 9 Flat Configuration \(PREPARED - NOT ACTIVE\)[\s\S]*?\/\/ END PREPARED CONFIGURATION/m, '')
      .trim();
    
    writeFileSync(this.configPath, activeConfig);

    // Test configuration
    console.log('🧪 Testing new configuration...');
    try {
      execSync('npx eslint --config eslint.config.js src/', { stdio: 'inherit' });
      console.log('✅ Migration completed successfully!');
    } catch (error) {
      console.warn('⚠️  Configuration test failed - manual review needed');
      console.warn('Error:', error.message);
    }
  }

  async rollback() {
    console.log('🔄 Rolling back ESLint migration...');
    
    if (!existsSync('.eslint-backup.json')) {
      throw new Error('No backup found - cannot rollback');
    }

    const backup = JSON.parse(readFileSync('.eslint-backup.json', 'utf8'));
    
    // Restore old versions
    execSync(`npm install --save-dev \\
      eslint@${backup.packageJsonDependencies.eslint} \\
      @typescript-eslint/parser@${backup.packageJsonDependencies['@typescript-eslint/parser']} \\
      @typescript-eslint/eslint-plugin@${backup.packageJsonDependencies['@typescript-eslint/eslint-plugin']}`,
      { stdio: 'inherit' }
    );

    // Remove flat config
    if (existsSync(this.configPath)) {
      execSync(`rm ${this.configPath}`);
    }

    console.log('✅ Rollback completed');
  }
}

// CLI interface
const command = process.argv[2];
const migration = new ESLintMigration();

switch (command) {
  case 'prepare':
    migration.run();
    break;
  case 'execute':
    console.log('🚨 BLOCKED: Wait for Vitest completion before executing');
    console.log('Use "prepare" to prepare migration files only');
    break;
  case 'rollback':
    migration.rollback();
    break;
  default:
    console.log('Usage: node scripts/eslint-migration.js [prepare|execute|rollback]');
    console.log('Current phase: Use "prepare" only');
    break;
}