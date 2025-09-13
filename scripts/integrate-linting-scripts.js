#!/usr/bin/env node

/**
 * Script to integrate all missing npm scripts for the linting optimization system
 * This adds the three-tier ESLint system, Prettier development mode, and performance monitoring
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const PACKAGE_JSON_PATH = path.join(ROOT_DIR, 'package.json');

// Missing scripts to be added
const MISSING_SCRIPTS = {
  // Three-tier ESLint system
  'lint:dev': 'eslint --config .eslint.dev.config.mjs . --cache',
  'lint:staging': 'eslint --config .eslint.staging.config.mjs . --cache',
  'lint:prod': 'eslint --config .eslint.prod.config.mjs . --max-warnings 0',
  'lint:dev:fix': 'eslint --config .eslint.dev.config.mjs . --fix --cache',
  'lint:staging:fix': 'eslint --config .eslint.staging.config.mjs . --fix --cache',
  'lint:prod:fix': 'eslint --config .eslint.prod.config.mjs . --fix --max-warnings 0',
  'lint:dev:watch': "nodemon --watch '**/*.{ts,tsx,js,jsx}' --exec 'npm run lint:dev'",
  'lint:performance': 'time npm run lint:dev && time npm run lint:staging && time npm run lint:prod',
  'lint:benchmark': 'node scripts/eslint-performance-monitor.js benchmark',
  'lint:analyze': 'node scripts/eslint-performance-monitor.js analyze',
  'lint:validate': 'node scripts/eslint-config-validator.js',
  'lint:cache:clear': "rm -rf node_modules/.cache/eslint/ && echo 'ESLint cache cleared'",
  'lint:cache:analyze': "find node_modules/.cache/eslint/ -name '*.json' 2>/dev/null | wc -l || echo '0' && echo 'cached files'",
  'lint:summary': "echo '🔍 ESLint Summary:' && npm run lint:dev --silent | grep -E '(error|warning)' | tail -5 || echo 'No issues found'",
  'lint:emergency': 'eslint --config .eslint.dev.config.mjs . --no-cache --no-eslintrc --max-warnings 999',

  // Enhanced Prettier scripts
  'prettier:cache:clear': "rm -rf node_modules/.cache/prettier/ && echo 'Prettier cache cleared'",
  'prettier:cache:analyze': "find node_modules/.cache/prettier/ -name '*' 2>/dev/null | wc -l || echo '0' && echo 'cached files'",
  'prettier:git:pre-commit': 'node scripts/prettier-git-integration.js pre-commit',
  'prettier:git:staged': 'node scripts/prettier-git-integration.js staged',
  'prettier:git:diff': 'node scripts/prettier-git-integration.js diff',
  'prettier:watch': "nodemon --watch '**/*.{ts,tsx,js,jsx,json,css,md}' --exec 'npm run format:dev'",
  'prettier:summary': "echo '🎨 Prettier Summary:' && npm run format:check --silent || echo 'Formatting issues found'",
  'prettier:emergency': 'npx prettier --write . --no-cache --ignore-unknown',

  // Enhanced TypeScript scripts
  'typecheck:dev': 'tsc --noEmit --incremental --tsBuildInfoFile .tsbuildinfo.dev',
  'typecheck:prod': 'tsc --noEmit --strict --exactOptionalPropertyTypes',
  'typecheck:watch': 'tsc --noEmit --watch --incremental',
  'typecheck:performance': 'time npm run typecheck:backend && time npm run typecheck:frontend',
  'typecheck:cache:clear':
    "rm -f .tsbuildinfo* && rm -rf backend/.tsbuildinfo* && rm -rf frontend/.tsbuildinfo* && echo 'TypeScript cache cleared'",
  'typecheck:summary':
    "echo '📝 TypeScript Summary:' && npm run typecheck --silent 2>&1 | grep -E '(error|warning)' | tail -5 || echo 'No type errors found'",

  // Quality control workflows
  'quality:check': 'npm run lint:dev && npm run format:check && npm run typecheck',
  'quality:fix': 'npm run lint:dev:fix && npm run format:dev . && npm run typecheck:fix',
  'quality:staging': 'npm run lint:staging && npm run format:check:ci && npm run typecheck:prod',
  'quality:prod': 'npm run lint:prod && npm run format:check:ci && npm run typecheck:prod',
  'quality:benchmark': 'npm run lint:benchmark && npm run prettier:benchmark',
  'quality:analyze': 'npm run lint:analyze && npm run prettier:analyze',
  'quality:cache:clear': 'npm run lint:cache:clear && npm run prettier:cache:clear && npm run typecheck:cache:clear',
  'quality:summary': "echo '📊 Code Quality Summary:' && npm run lint:summary && npm run prettier:summary && npm run typecheck:summary",
  'quality:emergency': 'npm run lint:emergency && npm run prettier:emergency',
  'quality:watch': 'concurrently "npm run lint:dev:watch" "npm run prettier:watch" "npm run typecheck:watch"',
  'quality:pre-commit': 'npm run quality:check && npm run test:fast',
  'quality:pre-push': 'npm run quality:staging && npm run test:ci',
  'quality:ci': 'npm run quality:prod && npm run test:ci:full',

  // Development workflows
  'workflow:dev': 'npm run quality:fix && npm run test:fast && npm run build:fast',
  'workflow:staging': 'npm run quality:staging && npm run test:ci && npm run build',
  'workflow:prod': 'npm run quality:prod && npm run test:ci:full && npm run build:production',
  'workflow:emergency': 'npm run quality:emergency && npm run test:ultra-fast && npm run build:clean',
};

async function integrateScripts() {
  try {
    console.log('🚀 Integrating npm scripts for linting optimization system...\n');

    // Read current package.json
    const packageJson = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, 'utf8'));

    console.log('📦 Current package.json loaded');
    console.log(`📋 Found ${Object.keys(packageJson.scripts || {}).length} existing scripts`);

    // Check which scripts are missing
    const existingScripts = packageJson.scripts || {};
    const missingScripts = {};
    const existingOptimizedScripts = {};

    for (const [scriptName, scriptCommand] of Object.entries(MISSING_SCRIPTS)) {
      if (!existingScripts[scriptName]) {
        missingScripts[scriptName] = scriptCommand;
      } else {
        existingOptimizedScripts[scriptName] = scriptCommand;
      }
    }

    console.log(`\n📊 Analysis:`);
    console.log(`  ✅ Already present: ${Object.keys(existingOptimizedScripts).length} scripts`);
    console.log(`  ➕ Missing: ${Object.keys(missingScripts).length} scripts`);

    if (Object.keys(missingScripts).length === 0) {
      console.log('\n🎉 All scripts are already integrated!');
      return;
    }

    // Add missing scripts
    console.log('\n📝 Adding missing scripts:');
    for (const [scriptName, scriptCommand] of Object.entries(missingScripts)) {
      packageJson.scripts[scriptName] = scriptCommand;
      console.log(`  ➕ ${scriptName}`);
    }

    // Sort scripts alphabetically for better organization
    const sortedScripts = {};
    const scriptKeys = Object.keys(packageJson.scripts).sort();
    for (const key of scriptKeys) {
      sortedScripts[key] = packageJson.scripts[key];
    }
    packageJson.scripts = sortedScripts;

    // Write updated package.json
    fs.writeFileSync(PACKAGE_JSON_PATH, JSON.stringify(packageJson, null, 2) + '\n');

    console.log('\n✅ Integration completed successfully!');
    console.log(`📦 Total scripts: ${Object.keys(packageJson.scripts).length}`);

    // Validate that all required files exist
    console.log('\n🔍 Validating linting system files...');
    const requiredFiles = [
      '.eslint.dev.config.mjs',
      '.eslint.staging.config.mjs',
      '.eslint.prod.config.mjs',
      'eslint.ci.config.js',
      'scripts/prettier-dev-mode.js',
      'scripts/prettier-performance-monitor.js',
      'scripts/eslint-performance-monitor.js',
      'scripts/eslint-config-validator.js',
    ];

    let allFilesExist = true;
    for (const file of requiredFiles) {
      const filePath = path.join(ROOT_DIR, file);
      const exists = fs.existsSync(filePath);
      console.log(`  ${exists ? '✅' : '❌'} ${file}`);
      if (!exists) allFilesExist = false;
    }

    if (allFilesExist) {
      console.log('\n🎉 All linting optimization files are in place!');
    } else {
      console.log('\n⚠️  Some required files are missing. Please ensure all files are created.');
    }

    // Show usage examples
    console.log('\n📚 Usage Examples:');
    console.log('  Development workflow:');
    console.log('    npm run quality:check         # Quick quality check');
    console.log('    npm run workflow:dev          # Full dev workflow');
    console.log('    npm run lint:dev:watch        # Watch mode linting');
    console.log('');
    console.log('  Three-tier linting:');
    console.log('    npm run lint:dev              # Development (fast, permissive)');
    console.log('    npm run lint:staging          # Staging (moderate strictness)');
    console.log('    npm run lint:prod             # Production (maximum strictness)');
    console.log('');
    console.log('  Performance analysis:');
    console.log('    npm run lint:benchmark        # ESLint performance benchmark');
    console.log('    npm run prettier:benchmark    # Prettier performance benchmark');
    console.log('    npm run quality:analyze       # Combined analysis');
    console.log('');
    console.log('  Emergency operations:');
    console.log('    npm run quality:emergency     # Skip strict rules for urgent fixes');
    console.log('    npm run workflow:emergency    # Ultra-fast emergency workflow');
  } catch (error) {
    console.error('❌ Integration failed:', error.message);
    process.exit(1);
  }
}

// Run integration if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  integrateScripts().catch(console.error);
}

export default integrateScripts;
