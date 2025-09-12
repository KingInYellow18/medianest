#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🎯 BUNDLE SIZE OPTIMIZATION ANALYSIS\n');

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

  console.log(`${colors.blue}${colors.bold}📊 CURRENT BUNDLE ANALYSIS${colors.reset}\n`);

  if (!fs.existsSync(chunksDir)) {
    console.log(
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

  console.log(`${colors.cyan}📦 TOTAL BUNDLE SIZE: ${totalSize.toFixed(2)} KB${colors.reset}`);

  if (totalSize > 500) {
    console.log(
      `${colors.red}⚠️  EXCEEDS TARGET: ${(totalSize - 500).toFixed(2)} KB over 500KB target${
        colors.reset
      }`
    );
  } else {
    console.log(
      `${colors.green}✅ WITHIN TARGET: ${(500 - totalSize).toFixed(2)} KB under 500KB target${
        colors.reset
      }`
    );
  }

  console.log(`\n${colors.yellow}${colors.bold}📋 TOP 10 LARGEST CHUNKS:${colors.reset}`);
  bundles.slice(0, 10).forEach((bundle, index) => {
    const indicator = bundle.size > 100 ? '🔴' : bundle.size > 50 ? '🟡' : '🟢';
    console.log(`${indicator} ${index + 1}. ${bundle.name} - ${bundle.size} KB`);
  });

  if (largeChunks.length > 0) {
    console.log(
      `\n${colors.red}${colors.bold}🚨 LARGE CHUNKS REQUIRING OPTIMIZATION (>100KB):${colors.reset}`
    );
    largeChunks.forEach((chunk) => {
      console.log(`   • ${chunk.name} - ${chunk.size} KB`);
    });
  }

  // Bundle recommendations
  console.log(`\n${colors.magenta}${colors.bold}💡 OPTIMIZATION RECOMMENDATIONS:${colors.reset}`);

  if (totalSize > 500) {
    console.log('   🎯 Target: Reduce bundle size by', (totalSize - 500).toFixed(2), 'KB');

    if (largeChunks.some((c) => c.name.includes('vendor') || c.name.includes('framework'))) {
      console.log('   📦 Split large vendor chunks further');
    }

    if (largeChunks.some((c) => c.name.includes('page'))) {
      console.log('   📄 Implement more aggressive page-level code splitting');
    }

    console.log('   🌳 Implement tree-shaking for unused exports');
    console.log('   ⚡ Add dynamic imports for heavy components');
    console.log('   🔄 Replace heavy libraries with lightweight alternatives');
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
  console.log(`\n${colors.green}📄 Report saved: ${reportPath}${colors.reset}`);

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
  console.log(`\n${colors.blue}${colors.bold}📚 DEPENDENCY WEIGHT ANALYSIS${colors.reset}\n`);

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

    console.log('🏋️  Heavy dependencies detected:');
    heavyDeps.forEach((dep) => {
      if (packageJson.dependencies[dep]) {
        console.log(`   • ${dep} - ${packageJson.dependencies[dep]}`);
      }
    });

    console.log('\n💡 Lightweight alternatives to consider:');
    console.log('   • framer-motion → CSS transitions + minimal JS');
    console.log('   • lucide-react → selective imports only');
    console.log('   • axios → native fetch API');
    console.log('   • @tabler/icons-react → tree-shake to specific icons');
  } catch (error) {
    console.log('Could not analyze package.json');
  }
}

// Main execution
if (require.main === module) {
  const report = analyzeBundles();
  analyzeDependencies();

  console.log(`\n${colors.green}${colors.bold}✅ Analysis complete!${colors.reset}`);
  console.log(`Run ${colors.cyan}npm run build:optimized${colors.reset} to apply optimizations\n`);
}

module.exports = { analyzeBundles, analyzeDependencies };
