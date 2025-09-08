#!/usr/bin/env node

/**
 * Advanced Bundle Analysis Script
 *
 * Analyzes Next.js bundle structure and provides optimization recommendations
 * Based on Next.js 15 bundle analyzer and custom metrics
 */

const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const readFile = promisify(fs.readFile);
const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);

class BundleAnalyzer {
  constructor() {
    this.buildPath = path.join(__dirname, '../.next');
    this.staticPath = path.join(this.buildPath, 'static');
    this.chunksPath = path.join(this.staticPath, 'chunks');

    this.results = {
      totalSize: 0,
      chunkCount: 0,
      chunks: [],
      recommendations: [],
      performance: {
        loadTime: 0,
        cacheEfficiency: 0,
        compressionRatio: 0,
      },
    };
  }

  async analyze() {
    console.log('🔍 Starting Advanced Bundle Analysis...\n');

    try {
      await this.analyzeChunks();
      await this.analyzeBuildManifest();
      this.generateRecommendations();
      this.displayResults();
    } catch (error) {
      console.error('❌ Analysis failed:', error.message);
      process.exit(1);
    }
  }

  async analyzeChunks() {
    if (!fs.existsSync(this.chunksPath)) {
      throw new Error('Build artifacts not found. Run `npm run build` first.');
    }

    const chunks = await readdir(this.chunksPath);
    const chunkFiles = chunks.filter((file) => file.endsWith('.js') && !file.includes('.map'));

    console.log('📦 Analyzing chunk structure...');

    for (const file of chunkFiles) {
      const filePath = path.join(this.chunksPath, file);
      const stats = await stat(filePath);
      const sizeKB = Math.round(stats.size / 1024);

      const chunkInfo = {
        name: file,
        path: filePath,
        size: stats.size,
        sizeKB,
        category: this.categorizeChunk(file),
        isLarge: sizeKB > 100,
        isCritical: this.isCriticalChunk(file),
      };

      this.results.chunks.push(chunkInfo);
      this.results.totalSize += stats.size;
    }

    this.results.chunkCount = chunkFiles.length;

    // Sort chunks by size
    this.results.chunks.sort((a, b) => b.size - a.size);
  }

  categorizeChunk(filename) {
    if (filename.includes('framework')) return 'framework';
    if (filename.includes('vendors') || filename.includes('vendor')) return 'vendor';
    if (filename.includes('auth')) return 'auth';
    if (filename.includes('ui-libs')) return 'ui';
    if (filename.includes('common')) return 'common';
    if (filename.includes('polyfills')) return 'polyfill';
    if (filename.match(/^app-/)) return 'app';
    if (filename.match(/^\d+\./)) return 'dynamic';
    return 'other';
  }

  isCriticalChunk(filename) {
    const criticalPatterns = ['framework', 'polyfills', 'main', 'webpack', 'runtime'];

    return criticalPatterns.some((pattern) => filename.includes(pattern));
  }

  async analyzeBuildManifest() {
    const manifestPath = path.join(this.buildPath, 'build-manifest.json');

    if (!fs.existsSync(manifestPath)) {
      console.warn('⚠️  Build manifest not found, skipping route analysis');
      return;
    }

    try {
      const manifestContent = await readFile(manifestPath, 'utf8');
      const manifest = JSON.parse(manifestContent);

      console.log('📋 Analyzing route dependencies...');

      // Analyze route dependencies
      Object.entries(manifest.pages || {}).forEach(([route, files]) => {
        const routeSize = files
          .filter((file) => file.endsWith('.js'))
          .reduce((total, file) => {
            const chunk = this.results.chunks.find((c) => c.name.includes(file.split('/').pop()));
            return total + (chunk ? chunk.size : 0);
          }, 0);

        if (routeSize > 500 * 1024) {
          // > 500KB
          this.results.recommendations.push({
            type: 'route-optimization',
            severity: 'high',
            message: `Route "${route}" has large bundle size (${Math.round(
              routeSize / 1024
            )}KB). Consider code splitting.`,
            route,
            size: routeSize,
          });
        }
      });
    } catch (error) {
      console.warn('⚠️  Could not parse build manifest:', error.message);
    }
  }

  generateRecommendations() {
    console.log('💡 Generating optimization recommendations...\n');

    // Large chunks analysis
    const largeChunks = this.results.chunks.filter((chunk) => chunk.sizeKB > 200);
    largeChunks.forEach((chunk) => {
      this.results.recommendations.push({
        type: 'chunk-size',
        severity: chunk.sizeKB > 500 ? 'critical' : 'high',
        message: `Chunk "${chunk.name}" is very large (${chunk.sizeKB}KB). Consider further splitting.`,
        chunk: chunk.name,
        size: chunk.sizeKB,
        suggestions: this.getChunkOptimizationSuggestions(chunk),
      });
    });

    // Framework chunks analysis
    const frameworkChunks = this.results.chunks.filter((chunk) => chunk.category === 'framework');
    const frameworkSize = frameworkChunks.reduce((total, chunk) => total + chunk.size, 0);

    if (frameworkSize > 300 * 1024) {
      // > 300KB
      this.results.recommendations.push({
        type: 'framework-optimization',
        severity: 'medium',
        message: `Framework chunks total ${Math.round(
          frameworkSize / 1024
        )}KB. Consider React optimizations.`,
        suggestions: [
          'Enable React Compiler (experimental.reactCompiler: true)',
          'Use React.lazy() for heavy components',
          'Consider Preact/compat as React alternative',
        ],
      });
    }

    // Vendor chunks analysis
    const vendorChunks = this.results.chunks.filter((chunk) => chunk.category === 'vendor');
    const vendorSize = vendorChunks.reduce((total, chunk) => total + chunk.size, 0);

    if (vendorSize > 500 * 1024) {
      // > 500KB
      this.results.recommendations.push({
        type: 'vendor-optimization',
        severity: 'high',
        message: `Vendor chunks total ${Math.round(vendorSize / 1024)}KB. Review dependencies.`,
        suggestions: [
          'Audit dependencies with npm-bundle-analyzer',
          'Replace heavy libraries with lighter alternatives',
          'Use tree-shaking for lodash, date-fns, etc.',
          'Enable optimizePackageImports in next.config.js',
        ],
      });
    }

    // Dynamic chunks analysis
    const dynamicChunks = this.results.chunks.filter((chunk) => chunk.category === 'dynamic');
    if (dynamicChunks.length < 5) {
      this.results.recommendations.push({
        type: 'code-splitting',
        severity: 'medium',
        message: 'Low number of dynamic chunks detected. Consider more code splitting.',
        suggestions: [
          'Use dynamic imports for route-level components',
          'Split large components with React.lazy()',
          'Implement component-level lazy loading',
        ],
      });
    }

    // Overall bundle size analysis
    const totalSizeMB = this.results.totalSize / (1024 * 1024);
    if (totalSizeMB > 3) {
      this.results.recommendations.push({
        type: 'bundle-size',
        severity: 'critical',
        message: `Total bundle size is ${totalSizeMB.toFixed(2)}MB. This is very large.`,
        suggestions: [
          'Implement aggressive code splitting',
          'Remove unused dependencies',
          'Use CDN for large libraries',
          'Enable compression (gzip/brotli)',
        ],
      });
    }

    // Performance estimates
    this.calculatePerformanceMetrics();
  }

  getChunkOptimizationSuggestions(chunk) {
    const suggestions = [];

    if (chunk.category === 'vendor') {
      suggestions.push('Split vendor chunk by library type (UI, utilities, etc.)');
      suggestions.push('Use webpack bundle analyzer to identify largest dependencies');
    }

    if (chunk.category === 'ui') {
      suggestions.push('Implement dynamic imports for UI components');
      suggestions.push('Use React.lazy() for heavy UI libraries');
    }

    if (chunk.category === 'app') {
      suggestions.push('Split by route using Next.js automatic code splitting');
      suggestions.push('Move heavy logic to separate chunks');
    }

    return suggestions;
  }

  calculatePerformanceMetrics() {
    const criticalChunks = this.results.chunks.filter((chunk) => chunk.isCritical);
    const criticalSize = criticalChunks.reduce((total, chunk) => total + chunk.size, 0);

    // Estimate load time (3G connection ~400KB/s)
    const connectionSpeed = 400 * 1024; // bytes per second
    this.results.performance.loadTime = criticalSize / connectionSpeed;

    // Estimate cache efficiency based on chunk distribution
    const uniqueChunks = this.results.chunks.length;
    const totalChunks = this.results.chunkCount;
    this.results.performance.cacheEfficiency = uniqueChunks / totalChunks;

    // Estimate compression ratio (typical gzip: ~3:1)
    this.results.performance.compressionRatio = 0.33;
  }

  displayResults() {
    console.log('📊 BUNDLE ANALYSIS RESULTS');
    console.log('═'.repeat(50));

    // Summary
    console.log('\n🎯 SUMMARY:');
    console.log(`Total Bundle Size: ${(this.results.totalSize / (1024 * 1024)).toFixed(2)} MB`);
    console.log(`Number of Chunks: ${this.results.chunkCount}`);
    console.log(`Estimated Load Time (3G): ${this.results.performance.loadTime.toFixed(1)}s`);
    console.log(
      `Estimated Compressed Size: ${(
        (this.results.totalSize * this.results.performance.compressionRatio) /
        (1024 * 1024)
      ).toFixed(2)} MB`
    );

    // Top 10 largest chunks
    console.log('\n📦 LARGEST CHUNKS:');
    this.results.chunks.slice(0, 10).forEach((chunk, i) => {
      const indicator = chunk.isLarge ? '🔴' : chunk.sizeKB > 50 ? '🟡' : '🟢';
      console.log(`${i + 1}. ${indicator} ${chunk.name} - ${chunk.sizeKB}KB (${chunk.category})`);
    });

    // Recommendations
    console.log('\n💡 RECOMMENDATIONS:');
    if (this.results.recommendations.length === 0) {
      console.log('🎉 Bundle is well optimized! No major issues found.');
    } else {
      this.results.recommendations
        .sort((a, b) => {
          const severityOrder = { critical: 3, high: 2, medium: 1, low: 0 };
          return severityOrder[b.severity] - severityOrder[a.severity];
        })
        .forEach((rec, i) => {
          const icon =
            rec.severity === 'critical'
              ? '🚨'
              : rec.severity === 'high'
              ? '⚠️'
              : rec.severity === 'medium'
              ? '💡'
              : 'ℹ️';

          console.log(`\n${i + 1}. ${icon} ${rec.severity.toUpperCase()}: ${rec.message}`);

          if (rec.suggestions) {
            rec.suggestions.forEach((suggestion) => {
              console.log(`   • ${suggestion}`);
            });
          }
        });
    }

    // Next steps
    console.log('\n🚀 NEXT STEPS:');
    console.log('1. Run `npm run build:analyze` to open visual bundle analyzer');
    console.log('2. Implement recommended optimizations');
    console.log('3. Use dynamic imports for large components');
    console.log('4. Enable compression in production');
    console.log('5. Consider CDN for static assets');

    console.log('\n' + '═'.repeat(50));
    console.log('Analysis complete! 🎉');
  }
}

// Run analysis if called directly
if (require.main === module) {
  const analyzer = new BundleAnalyzer();
  analyzer.analyze().catch(console.error);
}

module.exports = BundleAnalyzer;
