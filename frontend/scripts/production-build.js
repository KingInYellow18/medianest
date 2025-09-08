#!/usr/bin/env node

/**
 * Production Build Optimizer - Emergency Bundle Size Reduction
 * Target: <10MB bundle (from 346MB)
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚨 EMERGENCY: Starting production bundle optimization...');

// Step 1: Clean build directories
console.log('1️⃣ Cleaning build directories...');
try {
  execSync('rm -rf .next node_modules/.cache', { stdio: 'inherit' });
  console.log('✅ Build directories cleaned');
} catch (error) {
  console.error('❌ Failed to clean directories:', error.message);
}

// Step 2: Install ONLY production dependencies
console.log('2️⃣ Installing ONLY production dependencies...');
try {
  execSync('npm ci --omit=dev --omit=optional --prefer-offline', {
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'production' },
  });
  console.log('✅ Production dependencies installed');
} catch (error) {
  console.warn('⚠️ npm ci failed, trying npm install...');
  try {
    execSync('npm install --production --no-optional --prefer-offline', {
      stdio: 'inherit',
      env: { ...process.env, NODE_ENV: 'production' },
    });
    console.log('✅ Production dependencies installed via npm install');
  } catch (installError) {
    console.error('❌ Failed to install dependencies:', installError.message);
    process.exit(1);
  }
}

// Step 3: Build with production optimizations
console.log('3️⃣ Building with production optimizations...');
try {
  execSync('NODE_ENV=production npm run build:production', {
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_ENV: 'production',
      NEXT_TELEMETRY_DISABLED: '1',
    },
  });
  console.log('✅ Production build complete');
} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
}

// Step 4: Analyze bundle size
console.log('4️⃣ Analyzing bundle size...');
try {
  const buildSize = execSync('du -sh .next | cut -f1', { encoding: 'utf8' }).trim();
  console.log(`📊 Current build size: ${buildSize}`);

  // Check if under emergency target
  const sizeBytes = execSync('du -sb .next | cut -f1', { encoding: 'utf8' }).trim();
  const sizeMB = parseInt(sizeBytes) / (1024 * 1024);

  console.log(`📏 Actual size: ${sizeMB.toFixed(2)}MB`);

  if (sizeMB < 10) {
    console.log('🎉 SUCCESS: Bundle size under 10MB emergency target!');
  } else if (sizeMB < 50) {
    console.log('⚠️ WARNING: Bundle size reduced but still over 10MB target');
  } else {
    console.log('❌ CRITICAL: Bundle size still too large');
  }
} catch (error) {
  console.error('❌ Failed to analyze bundle size:', error.message);
}

console.log('🚀 Production build optimization complete!');
