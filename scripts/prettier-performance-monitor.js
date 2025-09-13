#!/usr/bin/env node

/**
 * Prettier Performance Monitor
 * Tracks formatting performance and provides insights for optimization
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

class PrettierPerformanceMonitor {
  constructor() {
    this.metricsPath = path.join(ROOT_DIR, 'test-results', 'prettier-metrics.json');
    this.ensureMetricsDir();
  }

  ensureMetricsDir() {
    const dir = path.dirname(this.metricsPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  loadMetrics() {
    if (!fs.existsSync(this.metricsPath)) {
      return { runs: [], summary: {} };
    }
    return JSON.parse(fs.readFileSync(this.metricsPath, 'utf8'));
  }

  saveMetrics(metrics) {
    fs.writeFileSync(this.metricsPath, JSON.stringify(metrics, null, 2));
  }

  async measurePerformance(command, description) {
    console.log(`📊 Measuring: ${description}`);
    const startTime = Date.now();
    const startMemory = process.memoryUsage();

    try {
      const result = execSync(command, {
        cwd: ROOT_DIR,
        encoding: 'utf8',
        stdio: 'pipe',
        maxBuffer: 50 * 1024 * 1024, // 50MB buffer
      });

      const endTime = Date.now();
      const endMemory = process.memoryUsage();
      const duration = endTime - startTime;

      const metrics = {
        timestamp: new Date().toISOString(),
        command,
        description,
        duration,
        memoryDelta: {
          rss: endMemory.rss - startMemory.rss,
          heapUsed: endMemory.heapUsed - startMemory.heapUsed,
          heapTotal: endMemory.heapTotal - startMemory.heapTotal,
        },
        success: true,
        output: result,
      };

      console.log(`✅ Completed in ${duration}ms`);
      console.log(`💾 Memory delta: RSS ${(metrics.memoryDelta.rss / 1024 / 1024).toFixed(1)}MB`);

      return metrics;
    } catch (error) {
      const endTime = Date.now();
      const duration = endTime - startTime;

      const metrics = {
        timestamp: new Date().toISOString(),
        command,
        description,
        duration,
        success: false,
        error: error.message,
        stdout: error.stdout || '',
        stderr: error.stderr || '',
      };

      console.log(`❌ Failed after ${duration}ms: ${error.message}`);
      return metrics;
    }
  }

  async runBenchmarkSuite() {
    console.log('🚀 Starting Prettier Performance Benchmark Suite\n');

    const benchmarks = [
      {
        command: 'npx prettier --check "src/**/*.{ts,tsx}" --cache',
        description: 'Check TypeScript files with cache',
      },
      {
        command: 'npx prettier --check "src/**/*.{ts,tsx}" --no-cache',
        description: 'Check TypeScript files without cache',
      },
      {
        command: 'npx prettier --write "src/**/*.{ts,tsx}" --cache',
        description: 'Format TypeScript files with cache',
      },
      {
        command: 'npx prettier --check "**/*.json" --cache',
        description: 'Check JSON files with cache',
      },
      {
        command: 'npx prettier --check "**/*.md" --cache',
        description: 'Check Markdown files with cache',
      },
      {
        command: 'node scripts/prettier-dev-mode.js batch-check "src/**/*.{ts,tsx}"',
        description: 'Batch check with dev mode script',
      },
    ];

    const results = [];
    for (const benchmark of benchmarks) {
      const result = await this.measurePerformance(benchmark.command, benchmark.description);
      results.push(result);

      // Small delay between benchmarks
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Store results
    const metrics = this.loadMetrics();
    const runId = Date.now();

    metrics.runs.push({
      id: runId,
      timestamp: new Date().toISOString(),
      results,
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        memory: process.memoryUsage(),
      },
    });

    // Keep only last 10 runs
    if (metrics.runs.length > 10) {
      metrics.runs = metrics.runs.slice(-10);
    }

    this.saveMetrics(metrics);
    this.generateReport(metrics);

    return results;
  }

  generateReport(metrics) {
    if (metrics.runs.length === 0) return;

    const latestRun = metrics.runs[metrics.runs.length - 1];
    const previousRun = metrics.runs.length > 1 ? metrics.runs[metrics.runs.length - 2] : null;

    console.log('\n📈 Performance Report');
    console.log('='.repeat(50));

    // Summary of latest run
    const successful = latestRun.results.filter(r => r.success);
    const failed = latestRun.results.filter(r => !r.success);

    console.log(`\n📊 Latest Run (${latestRun.timestamp})`);
    console.log(`✅ Successful: ${successful.length}`);
    console.log(`❌ Failed: ${failed.length}`);

    if (successful.length > 0) {
      console.log('\n⚡ Performance Metrics:');
      successful.forEach(result => {
        console.log(`  ${result.description}: ${result.duration}ms`);
        if (result.memoryDelta) {
          const memoryMB = (result.memoryDelta.rss / 1024 / 1024).toFixed(1);
          console.log(`    Memory: ${memoryMB}MB`);
        }
      });

      // Performance comparison with previous run
      if (previousRun) {
        console.log('\n📈 Performance Comparison:');
        successful.forEach(result => {
          const previous = previousRun.results.find(r => r.description === result.description);
          if (previous && previous.success) {
            const change = result.duration - previous.duration;
            const changePercent = ((change / previous.duration) * 100).toFixed(1);
            const indicator = change > 0 ? '📈' : '📉';
            console.log(`  ${result.description}: ${change > 0 ? '+' : ''}${change}ms (${changePercent}%) ${indicator}`);
          }
        });
      }
    }

    if (failed.length > 0) {
      console.log('\n❌ Failed Operations:');
      failed.forEach(result => {
        console.log(`  ${result.description}: ${result.error}`);
      });
    }

    // Recommendations
    console.log('\n💡 Recommendations:');
    const totalDuration = successful.reduce((sum, r) => sum + r.duration, 0);
    const avgDuration = totalDuration / successful.length;

    if (avgDuration > 5000) {
      console.log('  • Consider using --cache flag for faster formatting');
      console.log('  • Try formatting smaller file sets at a time');
    }

    const slowOperations = successful.filter(r => r.duration > avgDuration * 1.5);
    if (slowOperations.length > 0) {
      console.log('  • Slow operations detected:');
      slowOperations.forEach(op => {
        console.log(`    - ${op.description} (${op.duration}ms)`);
      });
    }

    console.log('\n📁 Full report saved to:', this.metricsPath);
  }

  async analyzeCodebase() {
    console.log('🔍 Analyzing codebase for Prettier optimization opportunities\n');

    const analysis = {
      timestamp: new Date().toISOString(),
      fileStats: {},
      recommendations: [],
    };

    // Count files by type
    const fileTypes = [
      { pattern: '**/*.ts', name: 'TypeScript' },
      { pattern: '**/*.tsx', name: 'TypeScript React' },
      { pattern: '**/*.js', name: 'JavaScript' },
      { pattern: '**/*.jsx', name: 'JavaScript React' },
      { pattern: '**/*.json', name: 'JSON' },
      { pattern: '**/*.md', name: 'Markdown' },
      { pattern: '**/*.css', name: 'CSS' },
      { pattern: '**/*.scss', name: 'SCSS' },
    ];

    for (const fileType of fileTypes) {
      try {
        const files = execSync(`npx glob "${fileType.pattern}" --ignore="**/node_modules/**" --ignore="**/dist/**"`, {
          cwd: ROOT_DIR,
          encoding: 'utf8',
        })
          .trim()
          .split('\n')
          .filter(Boolean);

        analysis.fileStats[fileType.name] = {
          count: files.length,
          pattern: fileType.pattern,
        };

        console.log(`📄 ${fileType.name}: ${files.length} files`);
      } catch (error) {
        analysis.fileStats[fileType.name] = { count: 0, error: error.message };
      }
    }

    // Generate recommendations
    const totalFiles = Object.values(analysis.fileStats).reduce((sum, stat) => sum + (stat.count || 0), 0);

    if (totalFiles > 1000) {
      analysis.recommendations.push({
        type: 'performance',
        message: 'Large codebase detected. Consider using Prettier cache and selective formatting.',
        action: 'Enable cache with --cache flag and use format:staged for faster development',
      });
    }

    const tsFiles = (analysis.fileStats['TypeScript']?.count || 0) + (analysis.fileStats['TypeScript React']?.count || 0);

    if (tsFiles > 500) {
      analysis.recommendations.push({
        type: 'optimization',
        message: 'Many TypeScript files. Consider development-specific configuration.',
        action: 'Use relaxed printWidth during development and strict formatting in CI',
      });
    }

    console.log('\n💡 Analysis Results:');
    console.log(`📊 Total files: ${totalFiles}`);
    analysis.recommendations.forEach((rec, index) => {
      console.log(`\n${index + 1}. ${rec.type.toUpperCase()}: ${rec.message}`);
      console.log(`   Action: ${rec.action}`);
    });

    // Save analysis
    const analysisPath = path.join(ROOT_DIR, 'test-results', 'prettier-analysis.json');
    fs.writeFileSync(analysisPath, JSON.stringify(analysis, null, 2));
    console.log(`\n📁 Analysis saved to: ${analysisPath}`);

    return analysis;
  }
}

// CLI interface
async function main() {
  const monitor = new PrettierPerformanceMonitor();
  const command = process.argv[2];

  try {
    switch (command) {
      case 'benchmark':
        await monitor.runBenchmarkSuite();
        break;

      case 'analyze':
        await monitor.analyzeCodebase();
        break;

      case 'measure':
        const cmd = process.argv.slice(3).join(' ');
        if (!cmd) {
          console.error('❌ Please provide a command to measure');
          process.exit(1);
        }
        await monitor.measurePerformance(cmd, 'Custom command');
        break;

      default:
        console.log(`
📊 Prettier Performance Monitor

Usage: node scripts/prettier-performance-monitor.js <command>

Commands:
  benchmark  Run full performance benchmark suite
  analyze    Analyze codebase for optimization opportunities  
  measure    Measure performance of a custom command

Examples:
  npm run prettier:benchmark     # Full benchmark
  npm run prettier:analyze       # Codebase analysis
        `);
        break;
    }
  } catch (error) {
    console.error('❌ Command failed:', error.message);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export default PrettierPerformanceMonitor;
