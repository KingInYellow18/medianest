#!/usr/bin/env node

/**
 * Development-friendly Prettier runner with performance optimizations
 * Provides different formatting modes for development vs production
 */

import { execSync, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

// Development-specific Prettier config (more relaxed)
const DEV_CONFIG = {
  printWidth: 140, // More relaxed line length for development
  trailingComma: 'es5', // Less aggressive than 'all'
  arrowParens: 'avoid', // Cleaner for simple params
  bracketSameLine: false,
  experimentalTernaries: false,
};

// Production config (strict formatting)
const PROD_CONFIG = {
  printWidth: 120,
  trailingComma: 'all',
  arrowParens: 'always',
  bracketSameLine: false,
};

class PrettierDevMode {
  constructor() {
    this.mode = process.env.NODE_ENV || 'development';
    this.tempConfigPath = path.join(ROOT_DIR, '.prettierrc.dev.json');
  }

  createTempConfig(config) {
    const baseConfig = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, '.prettierrc.json'), 'utf8'));
    const mergedConfig = { ...baseConfig, ...config };
    fs.writeFileSync(this.tempConfigPath, JSON.stringify(mergedConfig, null, 2));
    return this.tempConfigPath;
  }

  cleanup() {
    if (fs.existsSync(this.tempConfigPath)) {
      fs.unlinkSync(this.tempConfigPath);
    }
  }

  async runPrettier(files, options = {}) {
    const { write = false, check = false, mode = this.mode } = options;

    try {
      const config = mode === 'production' ? PROD_CONFIG : DEV_CONFIG;
      const configPath = this.createTempConfig(config);

      const args = ['--config', configPath, check ? '--check' : '', write ? '--write' : '', ...files].filter(Boolean);

      console.log(`🎨 Running Prettier in ${mode} mode...`);
      console.log(`📁 Files: ${files.length > 5 ? files.length + ' files' : files.join(', ')}`);

      const result = execSync(`npx prettier ${args.join(' ')}`, {
        cwd: ROOT_DIR,
        encoding: 'utf8',
        stdio: 'pipe',
      });

      console.log('✅ Prettier completed successfully');
      return result;
    } catch (error) {
      console.error('❌ Prettier failed:', error.message);
      if (error.stdout) console.log(error.stdout);
      if (error.stderr) console.error(error.stderr);
      process.exit(1);
    } finally {
      this.cleanup();
    }
  }

  // Fast formatting for staged files only
  async formatStaged() {
    try {
      const stagedFiles = execSync('git diff --cached --name-only --diff-filter=ACMR', {
        encoding: 'utf8',
        cwd: ROOT_DIR,
      })
        .trim()
        .split('\n')
        .filter(Boolean);

      const formattableFiles = stagedFiles.filter(
        file => /\.(ts|tsx|js|jsx|json|css|scss|md|yaml|yml)$/.test(file) && fs.existsSync(path.join(ROOT_DIR, file))
      );

      if (formattableFiles.length === 0) {
        console.log('📝 No formattable staged files found');
        return;
      }

      await this.runPrettier(formattableFiles, { write: true, mode: 'development' });

      // Re-stage formatted files
      execSync(`git add ${formattableFiles.join(' ')}`, { cwd: ROOT_DIR });
      console.log('🔄 Re-staged formatted files');
    } catch (error) {
      console.error('❌ Failed to format staged files:', error.message);
    }
  }

  // Selective formatting for changed files since last commit
  async formatChanged() {
    try {
      const changedFiles = execSync('git diff --name-only HEAD~1..HEAD', {
        encoding: 'utf8',
        cwd: ROOT_DIR,
      })
        .trim()
        .split('\n')
        .filter(Boolean);

      const formattableFiles = changedFiles.filter(
        file => /\.(ts|tsx|js|jsx|json|css|scss|md|yaml|yml)$/.test(file) && fs.existsSync(path.join(ROOT_DIR, file))
      );

      if (formattableFiles.length === 0) {
        console.log('📝 No formattable changed files found');
        return;
      }

      await this.runPrettier(formattableFiles, { write: true });
    } catch (error) {
      console.error('❌ Failed to format changed files:', error.message);
    }
  }

  // Check formatting without writing (CI mode)
  async checkFormatting(files) {
    return this.runPrettier(files, { check: true, mode: 'production' });
  }

  // Batch format with performance monitoring
  async formatBatch(patterns, options = {}) {
    const startTime = Date.now();

    try {
      console.log('🔍 Finding files to format...');

      // Use glob pattern or specific files
      const fileList = Array.isArray(patterns) ? patterns : [patterns];
      const globPattern = fileList.join(' ');

      const files = execSync(`npx glob "${globPattern}"`, {
        encoding: 'utf8',
        cwd: ROOT_DIR,
      })
        .trim()
        .split('\n')
        .filter(Boolean);

      if (files.length === 0) {
        console.log('📝 No files found matching patterns');
        return;
      }

      // Filter out ignored files
      const formattableFiles = files.filter(file => {
        const fullPath = path.join(ROOT_DIR, file);
        return fs.existsSync(fullPath) && /\.(ts|tsx|js|jsx|json|css|scss|md|yaml|yml)$/.test(file);
      });

      console.log(`📊 Found ${formattableFiles.length} files to format`);

      // Split into chunks for better performance
      const chunkSize = 50;
      const chunks = [];
      for (let i = 0; i < formattableFiles.length; i += chunkSize) {
        chunks.push(formattableFiles.slice(i, i + chunkSize));
      }

      for (let i = 0; i < chunks.length; i++) {
        console.log(`📦 Processing chunk ${i + 1}/${chunks.length} (${chunks[i].length} files)`);
        await this.runPrettier(chunks[i], options);
      }

      const duration = Date.now() - startTime;
      console.log(`⚡ Formatted ${formattableFiles.length} files in ${duration}ms`);
    } catch (error) {
      console.error('❌ Batch formatting failed:', error.message);
      process.exit(1);
    }
  }
}

// CLI interface
async function main() {
  const prettier = new PrettierDevMode();
  const command = process.argv[2];
  const files = process.argv.slice(3);

  try {
    switch (command) {
      case 'staged':
        await prettier.formatStaged();
        break;

      case 'changed':
        await prettier.formatChanged();
        break;

      case 'check':
        if (files.length === 0) {
          console.error('❌ Please specify files to check');
          process.exit(1);
        }
        await prettier.checkFormatting(files);
        break;

      case 'batch':
        const patterns = files.length > 0 ? files : ['src/**/*.{ts,tsx,js,jsx}'];
        await prettier.formatBatch(patterns, { write: true });
        break;

      case 'batch-check':
        const checkPatterns = files.length > 0 ? files : ['src/**/*.{ts,tsx,js,jsx}'];
        await prettier.formatBatch(checkPatterns, { check: true, mode: 'production' });
        break;

      case 'dev':
        if (files.length === 0) {
          console.error('❌ Please specify files to format in dev mode');
          process.exit(1);
        }
        await prettier.runPrettier(files, { write: true, mode: 'development' });
        break;

      case 'prod':
        if (files.length === 0) {
          console.error('❌ Please specify files to format in prod mode');
          process.exit(1);
        }
        await prettier.runPrettier(files, { write: true, mode: 'production' });
        break;

      default:
        console.log(`
🎨 Prettier Dev Mode - Development-friendly formatting

Usage: node scripts/prettier-dev-mode.js <command> [files...]

Commands:
  staged        Format only staged files (git hook friendly)
  changed       Format files changed since last commit
  check <files> Check formatting without writing (CI mode)
  batch [glob]  Format files matching glob pattern (default: src/**/*.{ts,tsx,js,jsx})
  batch-check   Check formatting in batch mode
  dev <files>   Format with relaxed development settings
  prod <files>  Format with strict production settings

Examples:
  npm run format:staged     # Format staged files
  npm run format:changed    # Format changed files
  npm run format:dev src/   # Dev format for src folder
  npm run format:check .    # Check all files
        `);
        break;
    }
  } catch (error) {
    console.error('❌ Command failed:', error.message);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export default PrettierDevMode;
