#!/usr/bin/env node

/**
 * EMERGENCY: Force Production Dependencies Install
 * Resolves React version conflicts and installs production-only packages
 */

const { execSync } = require('child_process');
const fs = require('fs');

console.log('🚨 FORCING PRODUCTION INSTALL WITH DEPENDENCY RESOLUTION');

try {
  // Step 1: Force install with legacy peer deps
  console.log('1️⃣ Installing with --legacy-peer-deps...');
  execSync('npm install --production --legacy-peer-deps --no-optional', {
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_ENV: 'production',
      NEXT_TELEMETRY_DISABLED: '1',
    },
  });
  console.log('✅ Production dependencies installed');

  // Step 2: Remove dev dependencies manually
  console.log('2️⃣ Manually removing dev dependencies...');

  const devDeps = [
    '@testing-library',
    '@vitest',
    'vitest',
    'eslint',
    'prettier',
    'typescript',
    'postcss',
    'tailwindcss',
    'autoprefixer',
    'jsdom',
    'msw',
    '@types/bcryptjs',
    '@types/ioredis',
    'bcryptjs', // Move to runtime if needed
  ];

  // Remove dev dependency folders
  devDeps.forEach((dep) => {
    try {
      execSync(`rm -rf node_modules/${dep}*`, { stdio: 'pipe' });
    } catch (e) {
      // Ignore if not exists
    }
  });

  console.log('✅ Dev dependencies removed');

  // Step 3: Check final size
  const nodeModulesSize = execSync('du -sh node_modules | cut -f1', { encoding: 'utf8' }).trim();
  console.log(`📊 node_modules size: ${nodeModulesSize}`);
} catch (error) {
  console.error('❌ Force install failed:', error.message);
  process.exit(1);
}

console.log('🚀 Production install completed!');
