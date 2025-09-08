#!/usr/bin/env node

/**
 * EMERGENCY: Bundle Size Crisis Optimizer
 * Target: Reduce 346MB bundle to <10MB
 * Strategy: Aggressive production optimization
 */

const { execSync, exec } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚨 EMERGENCY: Bundle Size Crisis - Starting Aggressive Optimization');
console.log('Current Target: <10MB (Emergency) | <500KB (Final)');

async function emergencyOptimization() {
  const startTime = Date.now();

  try {
    // Step 1: Clean everything
    console.log('\n1️⃣ EMERGENCY CLEANUP');
    console.log('Removing build cache and node_modules...');

    try {
      execSync('rm -rf .next node_modules/.cache', { stdio: 'inherit' });
      console.log('✅ Build directories cleaned');
    } catch (error) {
      console.warn('⚠️ Partial cleanup completed');
    }

    // Step 2: Install PRODUCTION ONLY dependencies
    console.log('\n2️⃣ PRODUCTION-ONLY INSTALL');
    console.log('Installing only production dependencies...');

    // Backup current config and use emergency config
    if (fs.existsSync('next.config.js')) {
      fs.copyFileSync('next.config.js', 'next.config.backup.js');
      console.log('✅ Original config backed up');
    }

    if (fs.existsSync('next.config.emergency.js')) {
      fs.copyFileSync('next.config.emergency.js', 'next.config.js');
      console.log('✅ Emergency config activated');
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
      console.log('✅ Production dependencies installed');
    } catch (error) {
      console.warn('⚠️ npm ci failed, trying alternative approach...');

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
        console.log('✅ Production dependencies installed (alternative)');
      } catch (altError) {
        console.error('❌ Failed to install production dependencies');
        throw altError;
      }
    }

    // Step 3: Emergency build with aggressive optimizations
    console.log('\n3️⃣ EMERGENCY BUILD');
    console.log('Building with maximum optimizations...');

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
      console.log('✅ Emergency build completed');
    } catch (buildError) {
      console.error('❌ Build failed:', buildError.message);
      throw buildError;
    }

    // Step 4: Analyze results
    console.log('\n4️⃣ EMERGENCY ANALYSIS');

    const buildSize = execSync('du -sh .next | cut -f1', { encoding: 'utf8' }).trim();
    const sizeBytes = execSync('du -sb .next | cut -f1', { encoding: 'utf8' }).trim();
    const sizeMB = parseInt(sizeBytes) / (1024 * 1024);

    console.log(`📊 Bundle Size: ${buildSize} (${sizeMB.toFixed(2)}MB)`);

    // Calculate reduction
    const originalSizeMB = 346;
    const reductionMB = originalSizeMB - sizeMB;
    const reductionPercent = (reductionMB / originalSizeMB) * 100;

    console.log(`📉 Reduction: ${reductionMB.toFixed(2)}MB (${reductionPercent.toFixed(1)}%)`);

    // Status assessment
    if (sizeMB < 10) {
      console.log('🎉 SUCCESS: Emergency target achieved! (<10MB)');
      if (sizeMB < 0.5) {
        console.log('🏆 EXCELLENT: Final target achieved! (<500KB)');
      }
    } else if (sizeMB < 50) {
      console.log('⚠️ PROGRESS: Significant reduction, but still above emergency target');
    } else {
      console.log('❌ CRITICAL: Bundle still too large');
    }

    // List largest files for further optimization
    console.log('\n📈 LARGEST BUILD FILES:');
    try {
      execSync('find .next -type f -exec du -h {} + | sort -hr | head -10', { stdio: 'inherit' });
    } catch (error) {
      console.warn('Could not analyze build file sizes');
    }

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(1);
    console.log(`\n⏱️ Optimization completed in ${duration}s`);

    return {
      success: sizeMB < 10,
      sizeMB: sizeMB,
      reductionPercent: reductionPercent,
    };
  } catch (error) {
    console.error('\n❌ EMERGENCY OPTIMIZATION FAILED');
    console.error('Error:', error.message);

    // Restore original config if available
    if (fs.existsSync('next.config.backup.js')) {
      fs.copyFileSync('next.config.backup.js', 'next.config.js');
      console.log('✅ Original config restored');
    }

    throw error;
  }
}

// Execute emergency optimization
if (require.main === module) {
  emergencyOptimization()
    .then((result) => {
      if (result.success) {
        console.log('\n🚀 EMERGENCY PROTOCOL SUCCESS');
        process.exit(0);
      } else {
        console.log('\n⚠️ EMERGENCY PROTOCOL PARTIAL SUCCESS');
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error('\n💥 EMERGENCY PROTOCOL FAILED');
      process.exit(2);
    });
}

module.exports = { emergencyOptimization };
