#!/usr/bin/env node

/**
 * PERFORMANCE MONITORING AND BASELINE SYSTEM
 * 
 * Monitors performance test results, tracks baselines, and generates alerts
 * for performance regressions across the MediaNest application.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class PerformanceMonitor {
  constructor() {
    this.baselineDir = 'test-results/baselines';
    this.resultsDir = 'test-results';
    this.alertThresholds = {
      responseTime: 0.20,    // 20% increase triggers alert
      throughput: 0.15,      // 15% decrease triggers alert
      errorRate: 0.05,       // 5% increase triggers alert  
      memoryUsage: 0.25      // 25% increase triggers alert
    };
    
    this.ensureDirectories();
  }

  ensureDirectories() {
    [this.baselineDir, this.resultsDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  async recordBaseline(testSuite = 'all') {
    console.log(`📊 Recording performance baseline for: ${testSuite}`);
    
    const timestamp = new Date().toISOString();
    const baseline = {
      timestamp,
      commit: this.getGitCommit(),
      branch: this.getGitBranch(),
      testSuite,
      metrics: {}
    };

    try {
      // Run performance tests and collect results
      const results = await this.runPerformanceTests(testSuite);
      baseline.metrics = this.extractMetrics(results);
      
      // Save baseline
      const baselineFile = path.join(this.baselineDir, `${testSuite}-baseline.json`);
      fs.writeFileSync(baselineFile, JSON.stringify(baseline, null, 2));
      
      console.log(`✅ Baseline recorded: ${baselineFile}`);
      return baseline;
      
    } catch (error) {
      console.error('❌ Error recording baseline:', error.message);
      throw error;
    }
  }

  async runPerformanceTests(testSuite) {
    console.log(`🏃 Running performance tests: ${testSuite}`);
    
    const commands = {
      'all': 'npm run test:performance:all',
      'suite': 'npm run test:performance:suite', 
      'e2e': 'npm run test:performance:e2e',
      'security': 'npm run test:performance:security'
    };

    const command = commands[testSuite] || commands['all'];
    
    try {
      // Run with JSON output
      const jsonCommand = `${command} -- --reporter=json --outputFile=test-results/current-performance.json`;
      execSync(jsonCommand, { stdio: 'inherit' });
      
      // Load results
      const resultsFile = path.join(this.resultsDir, 'current-performance.json');
      if (fs.existsSync(resultsFile)) {
        return JSON.parse(fs.readFileSync(resultsFile, 'utf8'));
      } else {
        throw new Error('Performance test results file not found');
      }
      
    } catch (error) {
      console.error('❌ Performance test execution failed:', error.message);
      throw error;
    }
  }

  extractMetrics(testResults) {
    const metrics = {
      responseTime: {
        avg: 0,
        p95: 0,
        p99: 0
      },
      throughput: {
        requestsPerSecond: 0,
        successRate: 0
      },
      errorRate: 0,
      memoryUsage: {
        heapUsed: 0,
        maxHeapUsed: 0
      },
      testCount: 0,
      passedTests: 0,
      failedTests: 0
    };

    if (!testResults || !testResults.tests) {
      return metrics;
    }

    const tests = testResults.tests;
    metrics.testCount = tests.length;
    metrics.passedTests = tests.filter(t => t.status === 'passed').length;
    metrics.failedTests = tests.filter(t => t.status === 'failed').length;

    // Extract performance metrics from test metadata
    const performanceTests = tests.filter(t => 
      t.title && (
        t.title.includes('performance') || 
        t.title.includes('load') || 
        t.title.includes('response time')
      )
    );

    if (performanceTests.length > 0) {
      const responseTimes = this.extractResponseTimes(performanceTests);
      if (responseTimes.length > 0) {
        metrics.responseTime.avg = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
        metrics.responseTime.p95 = this.percentile(responseTimes, 95);
        metrics.responseTime.p99 = this.percentile(responseTimes, 99);
      }

      const throughputData = this.extractThroughputData(performanceTests);
      if (throughputData.length > 0) {
        metrics.throughput.requestsPerSecond = throughputData.reduce((a, b) => a + b, 0) / throughputData.length;
      }

      metrics.errorRate = metrics.failedTests / metrics.testCount;
    }

    return metrics;
  }

  extractResponseTimes(tests) {
    const responseTimes = [];
    
    tests.forEach(test => {
      // Look for response time data in test metadata
      if (test.meta && test.meta.responseTime) {
        responseTimes.push(test.meta.responseTime);
      } else if (test.duration) {
        responseTimes.push(test.duration);
      }
    });

    return responseTimes;
  }

  extractThroughputData(tests) {
    const throughputData = [];
    
    tests.forEach(test => {
      if (test.meta && test.meta.throughput) {
        throughputData.push(test.meta.throughput);
      } else if (test.meta && test.meta.requestsPerSecond) {
        throughputData.push(test.meta.requestsPerSecond);
      }
    });

    return throughputData;
  }

  percentile(arr, p) {
    if (arr.length === 0) return 0;
    
    const sorted = [...arr].sort((a, b) => a - b);
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  async compareWithBaseline(testSuite = 'all') {
    console.log(`🔍 Comparing current results with baseline: ${testSuite}`);
    
    const baselineFile = path.join(this.baselineDir, `${testSuite}-baseline.json`);
    
    if (!fs.existsSync(baselineFile)) {
      console.log('📝 No baseline found, recording new baseline...');
      return await this.recordBaseline(testSuite);
    }

    try {
      const baseline = JSON.parse(fs.readFileSync(baselineFile, 'utf8'));
      const currentResults = await this.runPerformanceTests(testSuite);
      const currentMetrics = this.extractMetrics(currentResults);

      const comparison = this.analyzePerformanceChange(baseline.metrics, currentMetrics);
      
      // Generate comparison report
      const report = {
        timestamp: new Date().toISOString(),
        testSuite,
        baseline: {
          timestamp: baseline.timestamp,
          commit: baseline.commit,
          metrics: baseline.metrics
        },
        current: {
          commit: this.getGitCommit(),
          branch: this.getGitBranch(),
          metrics: currentMetrics
        },
        comparison,
        regressions: comparison.regressions,
        improvements: comparison.improvements,
        alerts: comparison.alerts
      };

      // Save comparison report
      const reportFile = path.join(this.resultsDir, `performance-comparison-${Date.now()}.json`);
      fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));

      // Log summary
      console.log(`📈 Performance Comparison Summary:`);
      console.log(`  Response Time: ${this.formatChange(comparison.responseTimeChange)}`);
      console.log(`  Throughput: ${this.formatChange(comparison.throughputChange)}`);
      console.log(`  Error Rate: ${this.formatChange(comparison.errorRateChange)}`);
      console.log(`  Memory Usage: ${this.formatChange(comparison.memoryChange)}`);

      if (comparison.alerts.length > 0) {
        console.log(`⚠️  Performance Alerts (${comparison.alerts.length}):`);
        comparison.alerts.forEach(alert => {
          console.log(`    - ${alert.metric}: ${alert.message}`);
        });
      }

      if (comparison.regressions.length === 0) {
        console.log('✅ No significant performance regressions detected');
      } else {
        console.log(`❌ Found ${comparison.regressions.length} performance regressions`);
      }

      return report;

    } catch (error) {
      console.error('❌ Error comparing with baseline:', error.message);
      throw error;
    }
  }

  analyzePerformanceChange(baseline, current) {
    const comparison = {
      responseTimeChange: this.calculateChange(baseline.responseTime.avg, current.responseTime.avg),
      throughputChange: this.calculateChange(baseline.throughput.requestsPerSecond, current.throughput.requestsPerSecond),
      errorRateChange: this.calculateChange(baseline.errorRate, current.errorRate),
      memoryChange: this.calculateChange(baseline.memoryUsage.heapUsed, current.memoryUsage.heapUsed),
      regressions: [],
      improvements: [],
      alerts: []
    };

    // Check for regressions
    if (comparison.responseTimeChange > this.alertThresholds.responseTime) {
      comparison.regressions.push({
        metric: 'responseTime',
        change: comparison.responseTimeChange,
        baseline: baseline.responseTime.avg,
        current: current.responseTime.avg
      });
      comparison.alerts.push({
        metric: 'Response Time',
        message: `Response time increased by ${(comparison.responseTimeChange * 100).toFixed(1)}%`,
        severity: 'warning'
      });
    }

    if (comparison.throughputChange < -this.alertThresholds.throughput) {
      comparison.regressions.push({
        metric: 'throughput',
        change: comparison.throughputChange,
        baseline: baseline.throughput.requestsPerSecond,
        current: current.throughput.requestsPerSecond
      });
      comparison.alerts.push({
        metric: 'Throughput',
        message: `Throughput decreased by ${Math.abs(comparison.throughputChange * 100).toFixed(1)}%`,
        severity: 'warning'
      });
    }

    if (comparison.errorRateChange > this.alertThresholds.errorRate) {
      comparison.regressions.push({
        metric: 'errorRate',
        change: comparison.errorRateChange,
        baseline: baseline.errorRate,
        current: current.errorRate
      });
      comparison.alerts.push({
        metric: 'Error Rate',
        message: `Error rate increased by ${(comparison.errorRateChange * 100).toFixed(1)}%`,
        severity: 'critical'
      });
    }

    if (comparison.memoryChange > this.alertThresholds.memoryUsage) {
      comparison.regressions.push({
        metric: 'memoryUsage',
        change: comparison.memoryChange,
        baseline: baseline.memoryUsage.heapUsed,
        current: current.memoryUsage.heapUsed
      });
      comparison.alerts.push({
        metric: 'Memory Usage',
        message: `Memory usage increased by ${(comparison.memoryChange * 100).toFixed(1)}%`,
        severity: 'warning'
      });
    }

    // Check for improvements
    if (comparison.responseTimeChange < -0.05) { // 5% improvement
      comparison.improvements.push({
        metric: 'responseTime',
        change: comparison.responseTimeChange
      });
    }

    if (comparison.throughputChange > 0.05) { // 5% improvement
      comparison.improvements.push({
        metric: 'throughput', 
        change: comparison.throughputChange
      });
    }

    return comparison;
  }

  calculateChange(baseline, current) {
    if (baseline === 0) return current > 0 ? 1 : 0;
    return (current - baseline) / baseline;
  }

  formatChange(change) {
    const percentage = (change * 100).toFixed(1);
    if (change > 0) {
      return `+${percentage}% ⬆️`;
    } else if (change < 0) {
      return `${percentage}% ⬇️`;
    } else {
      return `${percentage}% ➡️`;
    }
  }

  getGitCommit() {
    try {
      return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
    } catch {
      return 'unknown';
    }
  }

  getGitBranch() {
    try {
      return execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
    } catch {
      return 'unknown';
    }
  }

  async generateTrendReport(days = 30) {
    console.log(`📊 Generating performance trend report (${days} days)`);
    
    const reportsPattern = path.join(this.resultsDir, 'performance-comparison-*.json');
    const reportFiles = this.getRecentFiles(reportsPattern, days);
    
    if (reportFiles.length === 0) {
      console.log('📝 No performance comparison reports found');
      return;
    }

    const trends = {
      period: `${days} days`,
      reportCount: reportFiles.length,
      metrics: {
        responseTime: [],
        throughput: [],
        errorRate: [],
        memoryUsage: []
      },
      averageChanges: {},
      worstRegressions: [],
      bestImprovements: []
    };

    // Process reports
    reportFiles.forEach(file => {
      try {
        const report = JSON.parse(fs.readFileSync(file, 'utf8'));
        
        trends.metrics.responseTime.push({
          timestamp: report.timestamp,
          value: report.current.metrics.responseTime.avg,
          change: report.comparison.responseTimeChange
        });

        trends.metrics.throughput.push({
          timestamp: report.timestamp,
          value: report.current.metrics.throughput.requestsPerSecond,
          change: report.comparison.throughputChange
        });

        trends.metrics.errorRate.push({
          timestamp: report.timestamp,
          value: report.current.metrics.errorRate,
          change: report.comparison.errorRateChange
        });

        trends.metrics.memoryUsage.push({
          timestamp: report.timestamp,
          value: report.current.metrics.memoryUsage.heapUsed,
          change: report.comparison.memoryChange
        });

        // Track worst regressions
        report.comparison.regressions.forEach(regression => {
          trends.worstRegressions.push({
            timestamp: report.timestamp,
            commit: report.current.commit,
            ...regression
          });
        });

        // Track best improvements
        report.comparison.improvements.forEach(improvement => {
          trends.bestImprovements.push({
            timestamp: report.timestamp,
            commit: report.current.commit,
            ...improvement
          });
        });

      } catch (error) {
        console.warn(`⚠️ Error processing report ${file}:`, error.message);
      }
    });

    // Calculate average changes
    Object.keys(trends.metrics).forEach(metric => {
      const changes = trends.metrics[metric].map(m => m.change).filter(c => !isNaN(c));
      trends.averageChanges[metric] = changes.length > 0 ? 
        changes.reduce((a, b) => a + b, 0) / changes.length : 0;
    });

    // Sort worst regressions and best improvements
    trends.worstRegressions.sort((a, b) => b.change - a.change);
    trends.bestImprovements.sort((a, b) => b.change - a.change);
    
    // Keep top 10
    trends.worstRegressions = trends.worstRegressions.slice(0, 10);
    trends.bestImprovements = trends.bestImprovements.slice(0, 10);

    // Save trend report
    const trendFile = path.join(this.resultsDir, `performance-trends-${Date.now()}.json`);
    fs.writeFileSync(trendFile, JSON.stringify(trends, null, 2));

    console.log(`📈 Performance Trends (${days} days):`);
    console.log(`  Reports analyzed: ${trends.reportCount}`);
    console.log(`  Avg Response Time change: ${this.formatChange(trends.averageChanges.responseTime)}`);
    console.log(`  Avg Throughput change: ${this.formatChange(trends.averageChanges.throughput)}`);
    console.log(`  Avg Error Rate change: ${this.formatChange(trends.averageChanges.errorRate)}`);
    console.log(`  Avg Memory Usage change: ${this.formatChange(trends.averageChanges.memoryUsage)}`);

    return trends;
  }

  getRecentFiles(pattern, days) {
    const cutoffDate = new Date(Date.now() - (days * 24 * 60 * 60 * 1000));
    const files = [];
    
    try {
      const dir = path.dirname(pattern);
      const filenamePattern = path.basename(pattern).replace('*', '');
      
      if (fs.existsSync(dir)) {
        fs.readdirSync(dir)
          .filter(file => file.includes(filenamePattern.replace('*', '')))
          .forEach(file => {
            const filePath = path.join(dir, file);
            const stats = fs.statSync(filePath);
            
            if (stats.mtime > cutoffDate) {
              files.push(filePath);
            }
          });
      }
    } catch (error) {
      console.warn('⚠️ Error reading files:', error.message);
    }

    return files.sort((a, b) => {
      const aTime = fs.statSync(a).mtime;
      const bTime = fs.statSync(b).mtime;
      return bTime - aTime; // Newest first
    });
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const testSuite = args[1] || 'all';

  const monitor = new PerformanceMonitor();

  try {
    switch (command) {
      case 'baseline':
        await monitor.recordBaseline(testSuite);
        break;
      
      case 'compare':
        await monitor.compareWithBaseline(testSuite);
        break;
      
      case 'trends':
        const days = parseInt(args[1]) || 30;
        await monitor.generateTrendReport(days);
        break;
      
      default:
        console.log(`
Performance Monitor Usage:

  node performance-monitor.js baseline [suite]   - Record performance baseline
  node performance-monitor.js compare [suite]    - Compare with baseline  
  node performance-monitor.js trends [days]      - Generate trend report

Test Suites: all (default), suite, e2e, security
        `);
        break;
    }
  } catch (error) {
    console.error('❌ Command failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = PerformanceMonitor;