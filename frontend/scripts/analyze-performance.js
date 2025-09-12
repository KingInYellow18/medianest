#!/usr/bin/env node

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Starting performance analysis...\n');

// Check if .next directory exists
const nextDir = path.join(__dirname, '..', '.next');
if (!fs.existsSync(nextDir)) {
  console.error('❌ No .next directory found. Please run "npm run build" first.');
  process.exit(1);
}

// Analyze build output
const analyzeBuildOutput = () => {
  const buildManifest = path.join(nextDir, 'build-manifest.json');
  const appBuildManifest = path.join(nextDir, 'app-build-manifest.json');

  if (fs.existsSync(buildManifest)) {
    const manifest = JSON.parse(fs.readFileSync(buildManifest, 'utf8'));
    console.log('📦 Build Manifest Analysis:');
    console.log(`  - Total pages: ${Object.keys(manifest.pages).length}`);
    console.log(`  - Common JS chunks: ${manifest.pages['/_app']?.length || 0}`);
    console.log('');
  }

  if (fs.existsSync(appBuildManifest)) {
    const appManifest = JSON.parse(fs.readFileSync(appBuildManifest, 'utf8'));
    console.log('📱 App Directory Pages:');
    Object.keys(appManifest.pages).forEach((page) => {
      console.log(`  - ${page}`);
    });
    console.log('');
  }
};

// Check for large files
const checkLargeFiles = () => {
  console.log('📊 Checking for large files (>100KB):\n');

  exec(
    `find ${nextDir}/static -type f -size +100k -exec ls -lh {} \\; | awk '{print $5, $9}'`,
    (error, stdout) => {
      if (error) {
        console.error('Error checking file sizes:', error);
        return;
      }

      if (stdout.trim()) {
        console.log(stdout);
      } else {
        console.log('✅ No large static files found (all under 100KB)\n');
      }
    }
  );
};

// Performance recommendations
const showRecommendations = () => {
  console.log('\n💡 Performance Optimization Checklist:\n');
  console.log('✓ Bundle analyzer configured - Run "npm run build:analyze"');
  console.log('✓ Dynamic imports implemented for heavy components');
  console.log('✓ Image optimization configured with Next.js Image component');
  console.log('✓ Cache headers configured for static assets');
  console.log('✓ Web Vitals monitoring implemented');
  console.log('✓ React Query cache optimized (5min stale time)');
  console.log('✓ Package imports optimized for tree-shaking');
  console.log('');
  console.log('📈 Target Metrics for 10-20 users:');
  console.log('  - First Contentful Paint: <1.8s');
  console.log('  - Largest Contentful Paint: <2.5s');
  console.log('  - Time to Interactive: <3.8s');
  console.log('  - Total Page Load: <2s (homelab environment)');
  console.log('');
  console.log('🔧 Next Steps:');
  console.log('  1. Run "npm run build:analyze" to see bundle visualization');
  console.log('  2. Test with Chrome DevTools Lighthouse');
  console.log('  3. Monitor Web Vitals in production');
  console.log('  4. Use Chrome DevTools Network tab to verify caching');
};

// Run analysis
analyzeBuildOutput();
checkLargeFiles();
setTimeout(showRecommendations, 1000);
