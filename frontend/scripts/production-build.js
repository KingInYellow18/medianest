#!/usr/bin/env node

/**
 * Production Build Optimizer - Emergency Bundle Size Reduction
 * Target: <10MB bundle (from 346MB)
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');


// Step 1: Clean build directories
try {
  execSync('rm -rf .next node_modules/.cache', { stdio: 'inherit' });
} catch (error) {
}

// Step 2: Install ONLY production dependencies
try {
  execSync('npm ci --omit=dev --omit=optional --prefer-offline', {
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'production' },
  });
} catch (error) {
  try {
    execSync('npm install --production --no-optional --prefer-offline', {
      stdio: 'inherit',
      env: { ...process.env, NODE_ENV: 'production' },
    });
  } catch (installError) {
    process.exit(1);
  }
}

// Step 3: Build with production optimizations
try {
  execSync('NODE_ENV=production npm run build:production', {
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_ENV: 'production',
      NEXT_TELEMETRY_DISABLED: '1',
    },
  });
} catch (error) {
  process.exit(1);
}

// Step 4: Analyze bundle size
try {
  const buildSize = execSync('du -sh .next | cut -f1', { encoding: 'utf8' }).trim();

  // Check if under emergency target
  const sizeBytes = execSync('du -sb .next | cut -f1', { encoding: 'utf8' }).trim();
  const sizeMB = parseInt(sizeBytes) / (1024 * 1024);


  if (sizeMB < 10) {
  } else if (sizeMB < 50) {
  } else {
  }
} catch (error) {
}

