#!/usr/bin/env node

const lighthouse = require('lighthouse');
const { chromium } = require('playwright');
const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const { execSync } = require('child_process');

class PerformanceTester {
  constructor() {
    this.results = {
      tests: [],
      summary: {
        totalTests: 0,
        averagePerformanceScore: 0,
        averageAccessibilityScore: 0,
        averageBestPracticesScore: 0,
        averageSeoScore: 0,
        averageLoadTime: 0,
        failedTests: 0,
      },
    };

    this.siteUrl = 'http://localhost:8000';
    this.testPages = [
      { path: '/', name: 'Home', critical: true },
      { path: '/getting-started/', name: 'Getting Started', critical: true },
      { path: '/installation/', name: 'Installation', critical: true },
      { path: '/api/', name: 'API Reference', critical: false },
      { path: '/developers/', name: 'Developer Docs', critical: false },
      { path: '/troubleshooting/', name: 'Troubleshooting', critical: false },
    ];

    this.performanceThresholds = {
      performanceScore: 90,
      accessibilityScore: 95,
      bestPracticesScore: 90,
      seoScore: 95,
      firstContentfulPaint: 1500, // 1.5s
      largestContentfulPaint: 2500, // 2.5s
      cumulativeLayoutShift: 0.1,
      firstInputDelay: 100, // 100ms
      speedIndex: 3000, // 3s
      totalBlockingTime: 200, // 200ms
    };
  }

  async runTests() {
    console.log(chalk.blue('🚀 Starting performance testing...\n'));

    // Check if site is running
    if (!(await this.checkSiteAvailability())) {
      throw new Error('Documentation site is not running. Please start with `mkdocs serve`');
    }

    // Test build performance
    await this.testBuildPerformance();

    // Test runtime performance
    for (const page of this.testPages) {
      await this.testPagePerformance(page);
    }

    return this.generateReport();
  }

  async checkSiteAvailability() {
    try {
      const browser = await chromium.launch();
      const context = await browser.newContext();
      const page = await context.newPage();

      const response = await page.goto(this.siteUrl, { timeout: 5000 });
      const isAvailable = response && response.ok();

      await browser.close();
      return isAvailable;
    } catch (error) {
      return false;
    }
  }

  async testBuildPerformance() {
    console.log(chalk.blue('🏗️ Testing build performance...'));

    const test = {
      name: 'Build Performance',
      type: 'build',
      timestamp: new Date().toISOString(),
      metrics: {},
      status: 'PASS',
      issues: [],
    };

    try {
      const mkdocsPath = path.join(__dirname, '../../../mkdocs.yml');
      const buildDir = path.join(__dirname, '../../../site');

      // Clean previous build
      await fs.remove(buildDir);

      // Time the build
      const buildStart = Date.now();

      try {
        execSync(`mkdocs build -f ${mkdocsPath} --clean --strict`, {
          cwd: path.dirname(mkdocsPath),
          stdio: 'pipe',
        });
      } catch (buildError) {
        test.issues.push(`Build failed: ${buildError.message}`);
        test.status = 'FAIL';
        this.results.summary.failedTests++;
      }

      const buildTime = Date.now() - buildStart;
      test.metrics.buildTime = buildTime;

      // Analyze build output
      if (await fs.pathExists(buildDir)) {
        const stats = await this.analyzeBuildOutput(buildDir);
        test.metrics = { ...test.metrics, ...stats };

        // Check build size
        if (stats.totalSize > 50 * 1024 * 1024) {
          // 50MB threshold
          test.issues.push(`Large build size: ${(stats.totalSize / 1024 / 1024).toFixed(2)}MB`);
          test.status = 'WARNING';
        }

        // Check build time
        if (buildTime > 30000) {
          // 30 second threshold
          test.issues.push(`Slow build time: ${(buildTime / 1000).toFixed(2)}s`);
          test.status = 'WARNING';
        }
      }

      console.log(chalk.green(`✅ Build completed in ${(buildTime / 1000).toFixed(2)}s`));
    } catch (error) {
      test.status = 'ERROR';
      test.error = error.message;
      console.log(chalk.red(`❌ Build test failed: ${error.message}`));
    }

    this.results.tests.push(test);
  }

  async analyzeBuildOutput(buildDir) {
    const stats = {
      totalFiles: 0,
      totalSize: 0,
      htmlFiles: 0,
      cssFiles: 0,
      jsFiles: 0,
      imageFiles: 0,
      largestFiles: [],
    };

    const glob = require('glob');

    try {
      const files = glob.sync('**/*', { cwd: buildDir, nodir: true });

      for (const file of files) {
        const filePath = path.join(buildDir, file);
        const stat = await fs.stat(filePath);

        stats.totalFiles++;
        stats.totalSize += stat.size;

        const ext = path.extname(file).toLowerCase();
        switch (ext) {
          case '.html':
            stats.htmlFiles++;
            break;
          case '.css':
            stats.cssFiles++;
            break;
          case '.js':
            stats.jsFiles++;
            break;
          case '.png':
          case '.jpg':
          case '.jpeg':
          case '.gif':
          case '.svg':
            stats.imageFiles++;
            break;
        }

        // Track largest files
        stats.largestFiles.push({ file, size: stat.size });
      }

      // Sort and keep top 10 largest files
      stats.largestFiles.sort((a, b) => b.size - a.size);
      stats.largestFiles = stats.largestFiles.slice(0, 10);
    } catch (error) {
      console.warn(chalk.yellow(`Warning: Could not analyze build output: ${error.message}`));
    }

    return stats;
  }

  async testPagePerformance(pageInfo) {
    console.log(chalk.blue(`🔍 Testing ${pageInfo.name} performance...`));

    const test = {
      name: pageInfo.name,
      path: pageInfo.path,
      url: `${this.siteUrl}${pageInfo.path}`,
      critical: pageInfo.critical,
      type: 'runtime',
      timestamp: new Date().toISOString(),
      lighthouse: {},
      customMetrics: {},
      status: 'PASS',
      issues: [],
    };

    this.results.summary.totalTests++;

    try {
      // Run Lighthouse audit
      const lighthouseResult = await this.runLighthouseAudit(test.url);
      test.lighthouse = lighthouseResult;

      // Run custom performance tests
      const customMetrics = await this.runCustomMetrics(test.url);
      test.customMetrics = customMetrics;

      // Evaluate against thresholds
      test.status = this.evaluatePerformance(test);

      // Update summary stats
      this.updateSummaryStats(test);

      const statusColor =
        test.status === 'PASS' ? 'green' : test.status === 'WARNING' ? 'yellow' : 'red';
      const statusIcon = test.status === 'PASS' ? '✅' : test.status === 'WARNING' ? '⚠️' : '❌';

      console.log(
        chalk[statusColor](
          `${statusIcon} ${pageInfo.name} - Performance: ${test.lighthouse.performanceScore}, Issues: ${test.issues.length}`,
        ),
      );
    } catch (error) {
      test.status = 'ERROR';
      test.error = error.message;
      this.results.summary.failedTests++;
      console.log(chalk.red(`❌ ${pageInfo.name} - ERROR: ${error.message}`));
    }

    this.results.tests.push(test);
  }

  async runLighthouseAudit(url) {
    const browser = await chromium.launch();

    try {
      const { port } = await browser.wsEndpoint().match(/:([0-9]+)\//);

      const result = await lighthouse(url, {
        port: parseInt(port),
        output: 'json',
        logLevel: 'error',
        onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
        settings: {
          maxWaitForFcp: 15 * 1000,
          maxWaitForLoad: 35 * 1000,
          formFactor: 'desktop',
          throttling: {
            rttMs: 40,
            throughputKbps: 10240,
            requestLatencyMs: 0,
            downloadThroughputKbps: 0,
            uploadThroughputKbps: 0,
            cpuSlowdownMultiplier: 1,
          },
          screenEmulation: {
            mobile: false,
            width: 1350,
            height: 940,
            deviceScaleFactor: 1,
            disabled: false,
          },
          emulatedUserAgent: false,
        },
      });

      const report = result.report ? JSON.parse(result.report) : result;

      return {
        performanceScore: Math.round(report.categories.performance.score * 100),
        accessibilityScore: Math.round(report.categories.accessibility.score * 100),
        bestPracticesScore: Math.round(report.categories['best-practices'].score * 100),
        seoScore: Math.round(report.categories.seo.score * 100),
        metrics: {
          firstContentfulPaint: report.audits['first-contentful-paint']?.numericValue,
          largestContentfulPaint: report.audits['largest-contentful-paint']?.numericValue,
          cumulativeLayoutShift: report.audits['cumulative-layout-shift']?.numericValue,
          speedIndex: report.audits['speed-index']?.numericValue,
          totalBlockingTime: report.audits['total-blocking-time']?.numericValue,
          firstInputDelay: report.audits['max-potential-fid']?.numericValue,
        },
        opportunities: report.audits ? this.extractOpportunities(report.audits) : [],
      };
    } finally {
      await browser.close();
    }
  }

  extractOpportunities(audits) {
    const opportunities = [];

    const opportunityAudits = [
      'unused-css-rules',
      'unused-javascript',
      'unminified-css',
      'unminified-javascript',
      'render-blocking-resources',
      'uses-responsive-images',
      'efficient-animated-content',
      'uses-optimized-images',
      'uses-webp-images',
    ];

    opportunityAudits.forEach((auditId) => {
      const audit = audits[auditId];
      if (audit && audit.score < 1 && audit.details?.overallSavingsMs > 100) {
        opportunities.push({
          id: auditId,
          title: audit.title,
          description: audit.description,
          savingsMs: audit.details.overallSavingsMs,
          savingsBytes: audit.details.overallSavingsBytes,
        });
      }
    });

    return opportunities;
  }

  async runCustomMetrics(url) {
    const browser = await chromium.launch();
    const context = await browser.newContext();
    const page = await context.newPage();

    const metrics = {};

    try {
      // Measure load time
      const loadStart = Date.now();
      await page.goto(url, { waitUntil: 'networkidle' });
      metrics.loadTime = Date.now() - loadStart;

      // Measure DOM ready time
      metrics.domReadyTime = await page.evaluate(() => {
        return performance.timing.domContentLoadedEventEnd - performance.timing.navigationStart;
      });

      // Measure resource count and sizes
      const resources = await page.evaluate(() => {
        const entries = performance.getEntriesByType('resource');
        return {
          totalRequests: entries.length,
          totalTransferSize: entries.reduce((sum, entry) => sum + (entry.transferSize || 0), 0),
          requestsByType: entries.reduce((acc, entry) => {
            const type = entry.name.split('.').pop()?.toLowerCase() || 'other';
            acc[type] = (acc[type] || 0) + 1;
            return acc;
          }, {}),
        };
      });

      metrics.resources = resources;

      // Measure core web vitals with JS
      const coreWebVitals = await page.evaluate(() => {
        return new Promise((resolve) => {
          const vitals = {};

          // Measure LCP
          new PerformanceObserver((list) => {
            const entries = list.getEntries();
            const lastEntry = entries[entries.length - 1];
            vitals.lcp = lastEntry.startTime;
          }).observe({ entryTypes: ['largest-contentful-paint'] });

          // Measure CLS
          let clsValue = 0;
          new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              if (!entry.hadRecentInput) {
                clsValue += entry.value;
              }
            }
            vitals.cls = clsValue;
          }).observe({ entryTypes: ['layout-shift'] });

          // Wait and resolve
          setTimeout(() => resolve(vitals), 3000);
        });
      });

      metrics.coreWebVitals = coreWebVitals;

      // Check for console errors
      const errors = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          errors.push(msg.text());
        }
      });

      // Reload to catch console errors
      await page.reload({ waitUntil: 'networkidle' });
      metrics.consoleErrors = errors;
    } finally {
      await browser.close();
    }

    return metrics;
  }

  evaluatePerformance(test) {
    const issues = test.issues;
    let status = 'PASS';

    // Check Lighthouse scores
    if (test.lighthouse.performanceScore < this.performanceThresholds.performanceScore) {
      issues.push(
        `Low performance score: ${test.lighthouse.performanceScore} (threshold: ${this.performanceThresholds.performanceScore})`,
      );
      status = test.critical ? 'FAIL' : 'WARNING';
    }

    if (test.lighthouse.accessibilityScore < this.performanceThresholds.accessibilityScore) {
      issues.push(
        `Low accessibility score: ${test.lighthouse.accessibilityScore} (threshold: ${this.performanceThresholds.accessibilityScore})`,
      );
      status = 'WARNING';
    }

    if (test.lighthouse.seoScore < this.performanceThresholds.seoScore) {
      issues.push(
        `Low SEO score: ${test.lighthouse.seoScore} (threshold: ${this.performanceThresholds.seoScore})`,
      );
      status = 'WARNING';
    }

    // Check Core Web Vitals
    if (
      test.lighthouse.metrics.largestContentfulPaint >
      this.performanceThresholds.largestContentfulPaint
    ) {
      issues.push(
        `Slow LCP: ${Math.round(test.lighthouse.metrics.largestContentfulPaint)}ms (threshold: ${this.performanceThresholds.largestContentfulPaint}ms)`,
      );
      status = test.critical ? 'FAIL' : 'WARNING';
    }

    if (
      test.lighthouse.metrics.cumulativeLayoutShift >
      this.performanceThresholds.cumulativeLayoutShift
    ) {
      issues.push(
        `High CLS: ${test.lighthouse.metrics.cumulativeLayoutShift.toFixed(3)} (threshold: ${this.performanceThresholds.cumulativeLayoutShift})`,
      );
      status = 'WARNING';
    }

    // Check custom metrics
    if (test.customMetrics.loadTime > 5000) {
      // 5 second threshold
      issues.push(`Slow load time: ${(test.customMetrics.loadTime / 1000).toFixed(2)}s`);
      status = 'WARNING';
    }

    if (test.customMetrics.consoleErrors.length > 0) {
      issues.push(`${test.customMetrics.consoleErrors.length} console errors detected`);
      status = 'WARNING';
    }

    // Check for too many requests
    if (test.customMetrics.resources.totalRequests > 50) {
      issues.push(`High request count: ${test.customMetrics.resources.totalRequests} requests`);
      status = 'WARNING';
    }

    return status;
  }

  updateSummaryStats(test) {
    this.results.summary.averagePerformanceScore += test.lighthouse.performanceScore;
    this.results.summary.averageAccessibilityScore += test.lighthouse.accessibilityScore;
    this.results.summary.averageBestPracticesScore += test.lighthouse.bestPracticesScore;
    this.results.summary.averageSeoScore += test.lighthouse.seoScore;
    this.results.summary.averageLoadTime += test.customMetrics.loadTime;

    if (test.status === 'FAIL' || test.status === 'ERROR') {
      this.results.summary.failedTests++;
    }
  }

  generateReport() {
    // Calculate final averages
    const testCount = this.results.summary.totalTests;
    if (testCount > 0) {
      this.results.summary.averagePerformanceScore = Math.round(
        this.results.summary.averagePerformanceScore / testCount,
      );
      this.results.summary.averageAccessibilityScore = Math.round(
        this.results.summary.averageAccessibilityScore / testCount,
      );
      this.results.summary.averageBestPracticesScore = Math.round(
        this.results.summary.averageBestPracticesScore / testCount,
      );
      this.results.summary.averageSeoScore = Math.round(
        this.results.summary.averageSeoScore / testCount,
      );
      this.results.summary.averageLoadTime = Math.round(
        this.results.summary.averageLoadTime / testCount,
      );
    }

    const report = {
      timestamp: new Date().toISOString(),
      summary: this.results.summary,
      tests: this.results.tests,
      recommendations: this.generateRecommendations(),
      thresholds: this.performanceThresholds,
    };

    // Console summary
    console.log(chalk.blue('\n📊 Performance Testing Summary:'));
    console.log(chalk.white(`Tests completed: ${report.summary.totalTests}`));
    console.log(
      chalk.white(`Average Performance Score: ${report.summary.averagePerformanceScore}`),
    );
    console.log(
      chalk.white(`Average Accessibility Score: ${report.summary.averageAccessibilityScore}`),
    );
    console.log(
      chalk.white(`Average Load Time: ${(report.summary.averageLoadTime / 1000).toFixed(2)}s`),
    );
    console.log(chalk.red(`Failed Tests: ${report.summary.failedTests}`));

    return report;
  }

  generateRecommendations() {
    const recommendations = [];
    const allOpportunities = this.results.tests.flatMap(
      (test) => test.lighthouse.opportunities || [],
    );

    // Group opportunities by type
    const opportunityGroups = {};
    allOpportunities.forEach((opp) => {
      opportunityGroups[opp.id] = (opportunityGroups[opp.id] || 0) + 1;
    });

    // Generate recommendations based on common opportunities
    if (opportunityGroups['unused-css-rules'] > 1) {
      recommendations.push(
        'Remove unused CSS rules to reduce file size and improve loading performance',
      );
    }

    if (opportunityGroups['unused-javascript'] > 1) {
      recommendations.push('Remove unused JavaScript code to reduce bundle size');
    }

    if (opportunityGroups['render-blocking-resources'] > 1) {
      recommendations.push(
        'Optimize CSS and JavaScript delivery to reduce render-blocking resources',
      );
    }

    if (opportunityGroups['uses-webp-images'] > 1) {
      recommendations.push('Convert images to WebP format for better compression and loading');
    }

    // Check for common performance issues
    const slowPages = this.results.tests.filter(
      (test) => test.lighthouse.performanceScore < this.performanceThresholds.performanceScore,
    );

    if (slowPages.length > 0) {
      recommendations.push(`Optimize ${slowPages.length} pages with low performance scores`);
    }

    return recommendations;
  }

  async saveReport(report) {
    const reportsDir = path.join(__dirname, '../reports');
    await fs.ensureDir(reportsDir);

    const reportPath = path.join(reportsDir, `performance-test-${Date.now()}.json`);
    await fs.writeJson(reportPath, report, { spaces: 2 });

    // Also save a human-readable summary
    const summaryPath = path.join(reportsDir, `performance-summary-${Date.now()}.md`);
    const summaryContent = this.generateMarkdownSummary(report);
    await fs.writeFile(summaryPath, summaryContent);

    console.log(chalk.blue(`\n📄 Report saved to: ${reportPath}`));
    console.log(chalk.blue(`📄 Summary saved to: ${summaryPath}`));

    return { reportPath, summaryPath };
  }

  generateMarkdownSummary(report) {
    let summary = `# MediaNest Documentation Performance Report\n\n`;
    summary += `**Generated:** ${new Date(report.timestamp).toLocaleString()}\n\n`;

    summary += `## Summary\n\n`;
    summary += `- **Tests Completed:** ${report.summary.totalTests}\n`;
    summary += `- **Average Performance Score:** ${report.summary.averagePerformanceScore}/100\n`;
    summary += `- **Average Accessibility Score:** ${report.summary.averageAccessibilityScore}/100\n`;
    summary += `- **Average Load Time:** ${(report.summary.averageLoadTime / 1000).toFixed(2)}s\n`;
    summary += `- **Failed Tests:** ${report.summary.failedTests}\n\n`;

    if (report.recommendations.length > 0) {
      summary += `## Recommendations\n\n`;
      report.recommendations.forEach((rec) => {
        summary += `- ${rec}\n`;
      });
      summary += `\n`;
    }

    summary += `## Detailed Results\n\n`;
    report.tests.forEach((test) => {
      if (test.type === 'runtime') {
        summary += `### ${test.name}\n\n`;
        summary += `- **Status:** ${test.status}\n`;
        summary += `- **Performance:** ${test.lighthouse.performanceScore}/100\n`;
        summary += `- **Accessibility:** ${test.lighthouse.accessibilityScore}/100\n`;
        summary += `- **Load Time:** ${(test.customMetrics.loadTime / 1000).toFixed(2)}s\n`;

        if (test.issues.length > 0) {
          summary += `\n**Issues:**\n`;
          test.issues.forEach((issue) => {
            summary += `- ${issue}\n`;
          });
        }

        summary += `\n`;
      }
    });

    return summary;
  }
}

// Run if called directly
if (require.main === module) {
  const tester = new PerformanceTester();
  tester
    .runTests()
    .then((report) => {
      return tester.saveReport(report);
    })
    .then(() => {
      process.exit(tester.results.summary.failedTests > 0 ? 1 : 0);
    })
    .catch((error) => {
      console.error(chalk.red(`Fatal error: ${error.message}`));
      process.exit(1);
    });
}

module.exports = PerformanceTester;
