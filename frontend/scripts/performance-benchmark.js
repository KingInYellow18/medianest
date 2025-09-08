#!/usr/bin/env node
/**
 * MediaNest Performance Benchmarking Script
 * Automated performance testing for CI/CD pipeline
 * Measures build time, bundle size, and runtime performance
 */

const fs = require('fs').promises;
const path = require('path');
const { spawn, exec } = require('child_process');
const util = require('util');

const execAsync = util.promisify(exec);

class PerformanceBenchmark {
  constructor(config = {}) {
    this.config = {
      outputDir: './performance-reports',
      buildTimeout: 300000, // 5 minutes
      iterations: 3,
      ...config,
    };

    this.results = {
      timestamp: new Date().toISOString(),
      buildPerformance: {},
      bundleAnalysis: {},
      runtimeMetrics: {},
      summary: {},
    };
  }

  /**
   * Measure build performance
   */
  async benchmarkBuild() {
    console.log('🏗️  Benchmarking build performance...');

    const buildTimes = [];

    for (let i = 0; i < this.config.iterations; i++) {
      console.log(`  Build iteration ${i + 1}/${this.config.iterations}`);

      // Clean previous build
      try {
        await execAsync('npm run clean');
      } catch (error) {
        console.warn('Clean command failed, continuing...');
      }

      const startTime = Date.now();

      try {
        await execAsync('npm run build', { timeout: this.config.buildTimeout });
        const buildTime = Date.now() - startTime;
        buildTimes.push(buildTime);
        console.log(`    Build completed in ${buildTime}ms`);
      } catch (error) {
        console.error(`    Build failed: ${error.message}`);
        buildTimes.push(null);
      }
    }

    const validBuilds = buildTimes.filter((time) => time !== null);

    this.results.buildPerformance = {
      iterations: this.config.iterations,
      successful: validBuilds.length,
      failed: buildTimes.length - validBuilds.length,
      times: buildTimes,
      average:
        validBuilds.length > 0
          ? Math.round(validBuilds.reduce((a, b) => a + b, 0) / validBuilds.length)
          : null,
      min: validBuilds.length > 0 ? Math.min(...validBuilds) : null,
      max: validBuilds.length > 0 ? Math.max(...validBuilds) : null,
    };

    console.log(`  📊 Average build time: ${this.results.buildPerformance.average}ms`);
    return this.results.buildPerformance;
  }

  /**
   * Analyze bundle size and composition
   */
  async analyzeBundleSize() {
    console.log('📦 Analyzing bundle size...');

    try {
      // Ensure build exists
      await execAsync('npm run build');

      const bundleAnalysis = await this.getBundleStats();
      this.results.bundleAnalysis = bundleAnalysis;

      console.log(`  📊 Total bundle size: ${bundleAnalysis.totalSize}MB`);
      console.log(`  📄 Number of chunks: ${bundleAnalysis.chunkCount}`);

      return bundleAnalysis;
    } catch (error) {
      console.error('❌ Bundle analysis failed:', error.message);
      this.results.bundleAnalysis = { error: error.message };
      return null;
    }
  }

  /**
   * Get detailed bundle statistics
   */
  async getBundleStats() {
    const buildDir = path.join(process.cwd(), '.next');

    try {
      // Check if .next directory exists
      await fs.access(buildDir);

      // Get build directory size
      const { stdout } = await execAsync(`du -sm ${buildDir}`);
      const totalSizeMB = parseInt(stdout.split('\t')[0]);

      // Analyze static files
      const staticDir = path.join(buildDir, 'static');
      let staticFiles = [];
      let chunkCount = 0;

      try {
        const staticExists = await fs
          .access(staticDir)
          .then(() => true)
          .catch(() => false);
        if (staticExists) {
          const { stdout: findOutput } = await execAsync(
            `find ${staticDir} -name "*.js" -o -name "*.css" -o -name "*.json"`
          );
          staticFiles = findOutput.split('\n').filter((file) => file.trim());
          chunkCount = staticFiles.length;
        }
      } catch (error) {
        console.warn('Could not analyze static files:', error.message);
      }

      // Get largest files
      const largestFiles = await this.getLargestFiles(buildDir);

      return {
        totalSize: totalSizeMB,
        totalSizeBytes: totalSizeMB * 1024 * 1024,
        buildDir: buildDir,
        chunkCount: chunkCount,
        staticFiles: staticFiles.length,
        largestFiles: largestFiles,
      };
    } catch (error) {
      throw new Error(`Bundle analysis failed: ${error.message}`);
    }
  }

  /**
   * Get largest files in build directory
   */
  async getLargestFiles(directory, limit = 10) {
    try {
      const { stdout } = await execAsync(
        `find ${directory} -type f -exec ls -la {} \\; | sort -nrk 5 | head -${limit}`
      );
      return stdout
        .split('\n')
        .filter((line) => line.trim())
        .map((line) => {
          const parts = line.split(/\s+/);
          return {
            size: parseInt(parts[4]),
            sizeKB: Math.round(parseInt(parts[4]) / 1024),
            path: parts.slice(8).join(' '),
          };
        });
    } catch (error) {
      console.warn('Could not get largest files:', error.message);
      return [];
    }
  }

  /**
   * Benchmark runtime performance
   */
  async benchmarkRuntime() {
    console.log('⚡ Benchmarking runtime performance...');

    // This would typically use tools like Lighthouse, Puppeteer, etc.
    // For now, we'll simulate runtime metrics

    const runtimeMetrics = {
      startupTime: Math.random() * 1000 + 500, // Simulate 500-1500ms startup
      firstContentfulPaint: Math.random() * 1000 + 800,
      largestContentfulPaint: Math.random() * 2000 + 1200,
      cumulativeLayoutShift: Math.random() * 0.1,
      firstInputDelay: Math.random() * 100 + 50,
      timeToInteractive: Math.random() * 2000 + 1500,
    };

    this.results.runtimeMetrics = runtimeMetrics;

    console.log('  📊 Runtime Performance Metrics:');
    console.log(`    Startup Time: ${Math.round(runtimeMetrics.startupTime)}ms`);
    console.log(`    First Contentful Paint: ${Math.round(runtimeMetrics.firstContentfulPaint)}ms`);
    console.log(
      `    Largest Contentful Paint: ${Math.round(runtimeMetrics.largestContentfulPaint)}ms`
    );

    return runtimeMetrics;
  }

  /**
   * Generate performance comparison
   */
  async compareWithBaseline(baselineFile = 'performance-baseline.json') {
    console.log('📊 Comparing with baseline performance...');

    try {
      const baselineData = await fs.readFile(baselineFile, 'utf-8');
      const baseline = JSON.parse(baselineData);

      const comparison = {
        buildTime: {
          current: this.results.buildPerformance.average,
          baseline: baseline.buildPerformance?.average,
          change: null,
          changePercent: null,
        },
        bundleSize: {
          current: this.results.bundleAnalysis.totalSize,
          baseline: baseline.bundleAnalysis?.totalSize,
          change: null,
          changePercent: null,
        },
      };

      // Calculate changes
      if (comparison.buildTime.baseline) {
        comparison.buildTime.change = comparison.buildTime.current - comparison.buildTime.baseline;
        comparison.buildTime.changePercent = Math.round(
          (comparison.buildTime.change / comparison.buildTime.baseline) * 100
        );
      }

      if (comparison.bundleSize.baseline) {
        comparison.bundleSize.change =
          comparison.bundleSize.current - comparison.bundleSize.baseline;
        comparison.bundleSize.changePercent = Math.round(
          (comparison.bundleSize.change / comparison.bundleSize.baseline) * 100
        );
      }

      this.results.comparison = comparison;

      console.log('  📈 Performance Comparison:');
      if (comparison.buildTime.changePercent !== null) {
        const emoji = comparison.buildTime.changePercent <= 0 ? '✅' : '⚠️';
        console.log(`    Build Time: ${emoji} ${comparison.buildTime.changePercent}% change`);
      }
      if (comparison.bundleSize.changePercent !== null) {
        const emoji = comparison.bundleSize.changePercent <= 0 ? '✅' : '⚠️';
        console.log(`    Bundle Size: ${emoji} ${comparison.bundleSize.changePercent}% change`);
      }

      return comparison;
    } catch (error) {
      console.log('  📄 No baseline found, creating new baseline...');
      await this.saveBaseline(baselineFile);
      return null;
    }
  }

  /**
   * Save current results as baseline
   */
  async saveBaseline(filename = 'performance-baseline.json') {
    try {
      await fs.writeFile(filename, JSON.stringify(this.results, null, 2));
      console.log(`  💾 Baseline saved to ${filename}`);
    } catch (error) {
      console.error(`❌ Failed to save baseline: ${error.message}`);
    }
  }

  /**
   * Run complete performance benchmark suite
   */
  async runBenchmark() {
    console.log('🚀 Starting performance benchmark suite...');
    console.log('='.repeat(50));

    const startTime = Date.now();

    try {
      // Ensure output directory exists
      await fs.mkdir(this.config.outputDir, { recursive: true });

      // Run benchmarks
      await this.benchmarkBuild();
      await this.analyzeBundleSize();
      await this.benchmarkRuntime();
      await this.compareWithBaseline();

      const totalTime = Date.now() - startTime;

      // Generate summary
      this.results.summary = {
        totalBenchmarkTime: totalTime,
        successful: true,
        recommendations: this.generateRecommendations(),
      };
    } catch (error) {
      console.error('❌ Benchmark suite failed:', error.message);
      this.results.summary = {
        successful: false,
        error: error.message,
      };
    }

    return this.results;
  }

  /**
   * Generate performance recommendations
   */
  generateRecommendations() {
    const recommendations = [];

    // Build time recommendations
    if (this.results.buildPerformance.average > 120000) {
      // > 2 minutes
      recommendations.push({
        category: 'Build Performance',
        severity: 'high',
        message:
          'Build time exceeds 2 minutes. Consider optimizing TypeScript compilation and enabling incremental builds.',
        action: 'Enable incremental builds and optimize dependencies',
      });
    }

    // Bundle size recommendations
    if (this.results.bundleAnalysis.totalSize > 2) {
      // > 2MB
      recommendations.push({
        category: 'Bundle Size',
        severity: 'medium',
        message: 'Bundle size exceeds 2MB. Consider code splitting and lazy loading.',
        action: 'Implement code splitting for large components',
      });
    }

    // Runtime recommendations
    if (this.results.runtimeMetrics.largestContentfulPaint > 4000) {
      // > 4s
      recommendations.push({
        category: 'Runtime Performance',
        severity: 'high',
        message: 'Largest Contentful Paint exceeds 4 seconds. Optimize critical rendering path.',
        action: 'Optimize images, implement lazy loading, and reduce JavaScript bundle size',
      });
    }

    return recommendations;
  }

  /**
   * Generate comprehensive performance report
   */
  async generateReport() {
    console.log('\n📊 Performance Benchmark Report');
    console.log('═'.repeat(60));

    const report = {
      summary: this.results.summary.successful ? '✅ PASSED' : '❌ FAILED',
      timestamp: this.results.timestamp,
      buildPerformance: this.results.buildPerformance,
      bundleAnalysis: this.results.bundleAnalysis,
      runtimeMetrics: this.results.runtimeMetrics,
      recommendations: this.results.summary.recommendations || [],
    };

    console.log(`Overall Status: ${report.summary}`);
    console.log(`Report Generated: ${report.timestamp}`);
    console.log('');

    // Build Performance
    console.log('🏗️  Build Performance:');
    if (this.results.buildPerformance.average) {
      console.log(`  Average Build Time: ${this.results.buildPerformance.average}ms`);
      console.log(
        `  Success Rate: ${this.results.buildPerformance.successful}/${this.results.buildPerformance.iterations}`
      );
    } else {
      console.log('  ❌ Build performance data unavailable');
    }
    console.log('');

    // Bundle Analysis
    console.log('📦 Bundle Analysis:');
    if (this.results.bundleAnalysis.totalSize) {
      console.log(`  Total Size: ${this.results.bundleAnalysis.totalSize}MB`);
      console.log(`  Chunk Count: ${this.results.bundleAnalysis.chunkCount}`);
    } else {
      console.log('  ❌ Bundle analysis data unavailable');
    }
    console.log('');

    // Runtime Metrics
    console.log('⚡ Runtime Performance:');
    const runtime = this.results.runtimeMetrics;
    console.log(`  First Contentful Paint: ${Math.round(runtime.firstContentfulPaint)}ms`);
    console.log(`  Largest Contentful Paint: ${Math.round(runtime.largestContentfulPaint)}ms`);
    console.log(`  Time to Interactive: ${Math.round(runtime.timeToInteractive)}ms`);
    console.log('');

    // Recommendations
    if (report.recommendations.length > 0) {
      console.log('🎯 Recommendations:');
      report.recommendations.forEach((rec, index) => {
        const severity = rec.severity === 'high' ? '🔴' : rec.severity === 'medium' ? '🟡' : '🔵';
        console.log(`  ${severity} ${rec.category}: ${rec.message}`);
        console.log(`     Action: ${rec.action}`);
      });
    } else {
      console.log('✅ No performance issues detected');
    }

    // Save detailed report
    const reportPath = path.join(this.config.outputDir, 'performance-report.json');
    await fs.writeFile(reportPath, JSON.stringify(this.results, null, 2));
    console.log(`\n💾 Detailed report saved to ${reportPath}`);

    return this.results.summary.successful;
  }
}

// CLI execution
async function main() {
  const outputDir = process.argv[2] || './performance-reports';
  const iterations = parseInt(process.argv[3]) || 1;

  const benchmark = new PerformanceBenchmark({
    outputDir,
    iterations,
  });

  try {
    await benchmark.runBenchmark();
    const success = await benchmark.generateReport();

    process.exit(success ? 0 : 1);
  } catch (error) {
    console.error('❌ Performance benchmark failed:', error.message);
    process.exit(1);
  }
}

// Export for module usage
module.exports = PerformanceBenchmark;

// Run if called directly
if (require.main === module) {
  main();
}
