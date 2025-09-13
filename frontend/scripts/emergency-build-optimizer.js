#!/usr/bin/env node

/**
 * EMERGENCY: Bundle Size Crisis Optimizer
 * Target: Reduce 346MB bundle to <10MB
 * Strategy: Aggressive production optimization
 */

const { execSync, exec } = require('child_process');
const fs = require('fs');
const path = require('path');


async function emergencyOptimization() {
  const startTime = Date.now();

  try {
    // Step 1: Clean everything

    try {
      execSync('rm -rf .next node_modules/.cache', { stdio: 'inherit' });
    } catch (error) {
    }

    // Step 2: Install PRODUCTION ONLY dependencies

    // Backup current config and use emergency config
    if (fs.existsSync('next.config.js')) {
      fs.copyFileSync('next.config.js', 'next.config.backup.js');
    }

    if (fs.existsSync('next.config.emergency.js')) {
      fs.copyFileSync('next.config.emergency.js', 'next.config.js');
    }

    try {
      // Use npm ci for clean install
      execSync('npm ci --omit=dev --omit=optional --production', {
        stdio: 'inherit',
        env: {
          ...process.env,
          NODE_ENV: 'production',
          NEXT_TELEMETRY_DISABLED: '1',
        },
      });
    } catch (error) {

      // Alternative: npm install with production flag
      try {
        execSync('npm install --production --no-optional', {
          stdio: 'inherit',
          env: {
            ...process.env,
            NODE_ENV: 'production',
            NEXT_TELEMETRY_DISABLED: '1',
          },
        });
      } catch (altError) {
        throw altError;
      }
    }

    // Step 3: Emergency build with aggressive optimizations

    const buildEnv = {
      ...process.env,
      NODE_ENV: 'production',
      NODE_OPTIONS: '--max-old-space-size=4096',
      NEXT_TELEMETRY_DISABLED: '1',
      // Disable source maps to reduce size
      GENERATE_SOURCEMAP: 'false',
    };

    try {
      execSync('next build', {
        stdio: 'inherit',
        env: buildEnv,
        timeout: 300000, // 5 minutes timeout
      });
    } catch (buildError) {
      throw buildError;
    }

    // Step 4: Analyze results

    const buildSize = execSync('du -sh .next | cut -f1', { encoding: 'utf8' }).trim();
    const sizeBytes = execSync('du -sb .next | cut -f1', { encoding: 'utf8' }).trim();
    const sizeMB = parseInt(sizeBytes) / (1024 * 1024);


    // Calculate reduction
    const originalSizeMB = 346;
    const reductionMB = originalSizeMB - sizeMB;
    const reductionPercent = (reductionMB / originalSizeMB) * 100;


    // Status assessment
    if (sizeMB < 10) {
      if (sizeMB < 0.5) {
      }
    } else if (sizeMB < 50) {
    } else {
    }

    // List largest files for further optimization
    try {
      execSync('find .next -type f -exec du -h {} + | sort -hr | head -10', { stdio: 'inherit' });
    } catch (error) {
    }

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(1);

    return {
      success: sizeMB < 10,
      sizeMB: sizeMB,
      reductionPercent: reductionPercent,
    };
  } catch (error) {

    // Restore original config if available
    if (fs.existsSync('next.config.backup.js')) {
      fs.copyFileSync('next.config.backup.js', 'next.config.js');
    }

    throw error;
  }
}

// Execute emergency optimization
if (require.main === module) {
  emergencyOptimization()
    .then((result) => {
      if (result.success) {
        process.exit(0);
      } else {
        process.exit(1);
      }
    })
    .catch((error) => {
      process.exit(2);
    });
}

module.exports = { emergencyOptimization };
