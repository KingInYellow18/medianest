#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');


// Colors for better output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  bold: '\x1b[1m',
};

function getFileSizeInKB(filePath) {
  try {
    const stats = fs.statSync(filePath);
    return (stats.size / 1024).toFixed(2);
  } catch (error) {
    return 0;
  }
}

function analyzeBundles() {
  const buildDir = '.next/static';
  const chunksDir = path.join(buildDir, 'chunks');


  if (!fs.existsSync(chunksDir)) {
      `${colors.red}❌ Build directory not found. Run 'npm run build' first.${colors.reset}`
    );
    return;
  }

  let totalSize = 0;
  const bundles = [];
  const largeChunks = [];

  // Analyze all JavaScript chunks
  const files = fs.readdirSync(chunksDir, { recursive: true });
  const jsFiles = files.filter((file) => file.endsWith('.js') && !file.includes('.map'));

  jsFiles.forEach((file) => {
    const fullPath = path.join(chunksDir, file);
    const sizeKB = parseFloat(getFileSizeInKB(fullPath));
    totalSize += sizeKB;

    const bundle = {
      name: file,
      size: sizeKB,
      path: fullPath,
    };

    bundles.push(bundle);

    // Flag chunks over 100KB as large
    if (sizeKB > 100) {
      largeChunks.push(bundle);
    }
  });

  // Sort by size descending
  bundles.sort((a, b) => b.size - a.size);


  if (totalSize > 500) {
      `${colors.red}⚠️  EXCEEDS TARGET: ${(totalSize - 500).toFixed(2)} KB over 500KB target${
        colors.reset
      }`
    );
  } else {
      `${colors.green}✅ WITHIN TARGET: ${(500 - totalSize).toFixed(2)} KB under 500KB target${
        colors.reset
      }`
    );
  }

  bundles.slice(0, 10).forEach((bundle, index) => {
    const indicator = bundle.size > 100 ? '🔴' : bundle.size > 50 ? '🟡' : '🟢';
  });

  if (largeChunks.length > 0) {
      `\n${colors.red}${colors.bold}🚨 LARGE CHUNKS REQUIRING OPTIMIZATION (>100KB):${colors.reset}`
    );
    largeChunks.forEach((chunk) => {
    });
  }

  // Bundle recommendations

  if (totalSize > 500) {

    if (largeChunks.some((c) => c.name.includes('vendor') || c.name.includes('framework'))) {
    }

    if (largeChunks.some((c) => c.name.includes('page'))) {
    }

  }

  // Generate performance report
  const report = {
    timestamp: new Date().toISOString(),
    totalSize: totalSize,
    target: 500,
    exceedsTarget: totalSize > 500,
    overageKB: Math.max(0, totalSize - 500),
    largestChunks: bundles.slice(0, 5),
    largeChunksCount: largeChunks.length,
    recommendations: generateRecommendations(bundles, totalSize),
  };

  // Save report
  const reportPath = 'bundle-analysis-report.json';
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  return report;
}

function generateRecommendations(bundles, totalSize) {
  const recommendations = [];

  if (totalSize > 500) {
    recommendations.push('Bundle size exceeds 500KB target - implement aggressive optimization');
  }

  const hasLargeVendor = bundles.some((b) => b.name.includes('vendor') && b.size > 150);
  if (hasLargeVendor) {
    recommendations.push('Split vendor chunks - some exceed 150KB');
  }

  const hasLargeFramework = bundles.some((b) => b.name.includes('framework') && b.size > 100);
  if (hasLargeFramework) {
    recommendations.push('Framework chunk is large - enable more aggressive splitting');
  }

  return recommendations;
}

// Enhanced dependency analysis
function analyzeDependencies() {

  try {
    const packageJson = require('../package.json');
    const heavyDeps = [
      'framer-motion',
      'lucide-react',
      '@headlessui/react',
      '@tabler/icons-react',
      'socket.io-client',
      '@tanstack/react-query',
      'next-auth',
      'axios',
    ];

    heavyDeps.forEach((dep) => {
      if (packageJson.dependencies[dep]) {
      }
    });

  } catch (error) {
  }
}

// Main execution
if (require.main === module) {
  const report = analyzeBundles();
  analyzeDependencies();

}

module.exports = { analyzeBundles, analyzeDependencies };
