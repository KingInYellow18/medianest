#!/usr/bin/env node

const path = require('path');

const chalk = require('chalk');
const fs = require('fs-extra');
const { chromium, firefox, webkit } = require('playwright');

class ResponsiveTester {
  constructor() {
    this.results = {
      tests: [],
      summary: {
        totalTests: 0,
        passed: 0,
        failed: 0,
        warnings: 0,
      },
    };

    this.viewports = [
      { name: 'Mobile Portrait', width: 375, height: 667, device: 'iPhone SE' },
      { name: 'Mobile Landscape', width: 667, height: 375, device: 'iPhone SE Landscape' },
      { name: 'Tablet Portrait', width: 768, height: 1024, device: 'iPad' },
      { name: 'Tablet Landscape', width: 1024, height: 768, device: 'iPad Landscape' },
      { name: 'Desktop Small', width: 1280, height: 720, device: 'Desktop Small' },
      { name: 'Desktop Large', width: 1920, height: 1080, device: 'Desktop Large' },
      { name: 'Ultra-wide', width: 2560, height: 1440, device: 'Ultra-wide Monitor' },
    ];

    this.browsers = ['chromium', 'firefox', 'webkit'];
    this.siteUrl = 'http://localhost:8000';
    this.testPages = [
      '/',
      '/getting-started/',
      '/installation/',
      '/api/',
      '/developers/',
      '/troubleshooting/',
    ];
  }

  async runTests() {
    console.log(chalk.blue('📱 Starting responsive design testing...\n'));

    // Check if site is running
    if (!(await this.checkSiteAvailability())) {
      throw new Error('Documentation site is not running. Please start with `mkdocs serve`');
    }

    for (const browserName of this.browsers) {
      await this.testBrowser(browserName);
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

  async testBrowser(browserName) {
    console.log(chalk.blue(`🌍 Testing ${browserName}...`));

    const browserLib =
      browserName === 'chromium' ? chromium : browserName === 'firefox' ? firefox : webkit;
    const browser = await browserLib.launch({ headless: true });

    try {
      for (const viewport of this.viewports) {
        await this.testViewport(browser, browserName, viewport);
      }
    } finally {
      await browser.close();
    }
  }

  async testViewport(browser, browserName, viewport) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      userAgent: this.getUserAgent(viewport.device),
    });

    const page = await context.newPage();

    try {
      for (const testPage of this.testPages) {
        await this.testPage(page, browserName, viewport, testPage);
      }
    } finally {
      await context.close();
    }
  }

  async testPage(page, browserName, viewport, pagePath) {
    const testName = `${browserName}-${viewport.name}-${pagePath}`;
    const test = {
      name: testName,
      browser: browserName,
      viewport: viewport,
      page: pagePath,
      status: 'PASS',
      issues: [],
      metrics: {},
      timestamp: new Date().toISOString(),
    };

    this.results.summary.totalTests++;

    try {
      const url = `${this.siteUrl}${pagePath}`;
      await page.goto(url, { waitUntil: 'networkidle' });

      // Test 1: No horizontal scrolling
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);

      if (scrollWidth > clientWidth + 1) {
        // Allow 1px tolerance
        test.issues.push({
          type: 'horizontal-scroll',
          severity: 'error',
          message: `Horizontal scrolling detected (${scrollWidth}px > ${clientWidth}px)`,
        });
      }

      // Test 2: Navigation accessibility
      const navVisible = await page.isVisible('nav, .navigation, [role="navigation"]');
      if (!navVisible) {
        test.issues.push({
          type: 'navigation',
          severity: 'error',
          message: 'Navigation not found or not visible',
        });
      }

      // Test 3: Mobile menu behavior (for mobile viewports)
      if (viewport.width <= 768) {
        const mobileMenuExists =
          (await page.locator('.hamburger, .mobile-menu-toggle, [aria-label*="menu"]').count()) > 0;
        if (!mobileMenuExists) {
          test.issues.push({
            type: 'mobile-menu',
            severity: 'warning',
            message: 'Mobile menu toggle not found',
          });
        }
      }

      // Test 4: Text readability
      const textElements = await page.locator('p, h1, h2, h3, h4, h5, h6, li').all();
      for (const element of textElements.slice(0, 10)) {
        // Test first 10 elements
        const fontSize = await element.evaluate((el) => {
          const style = window.getComputedStyle(el);
          return parseFloat(style.fontSize);
        });

        const minFontSize = viewport.width <= 768 ? 14 : 16; // Smaller minimum for mobile
        if (fontSize < minFontSize) {
          test.issues.push({
            type: 'font-size',
            severity: 'warning',
            message: `Small font size detected: ${fontSize}px (minimum: ${minFontSize}px)`,
          });
          break; // Only report once per page
        }
      }

      // Test 5: Touch targets (for mobile)
      if (viewport.width <= 768) {
        const buttons = await page
          .locator('button, a, input[type="submit"], [role="button"]')
          .all();
        for (const button of buttons.slice(0, 10)) {
          // Test first 10 buttons
          const box = await button.boundingBox();
          if (box && (box.width < 44 || box.height < 44)) {
            test.issues.push({
              type: 'touch-target',
              severity: 'warning',
              message: `Small touch target: ${box.width}x${box.height}px (minimum: 44x44px)`,
            });
            break; // Only report once per page
          }
        }
      }

      // Test 6: Layout stability
      await page.waitForTimeout(1000); // Allow layout to settle
      const layoutShifts = await page.evaluate(() => {
        return new Promise((resolve) => {
          const shifts = [];
          new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              if (entry.hadRecentInput) continue;
              shifts.push(entry.value);
            }
          }).observe({ entryTypes: ['layout-shift'] });

          setTimeout(() => resolve(shifts), 2000);
        });
      });

      const totalCLS = layoutShifts.reduce((sum, shift) => sum + shift, 0);
      test.metrics.cumulativeLayoutShift = totalCLS;

      if (totalCLS > 0.1) {
        test.issues.push({
          type: 'layout-shift',
          severity: 'warning',
          message: `High cumulative layout shift: ${totalCLS.toFixed(3)} (threshold: 0.1)`,
        });
      }

      // Test 7: Image responsiveness
      const images = await page.locator('img').all();
      for (const img of images.slice(0, 5)) {
        // Test first 5 images
        const isResponsive = await img.evaluate((el) => {
          const style = window.getComputedStyle(el);
          return style.maxWidth === '100%' || style.width === '100%' || el.hasAttribute('srcset');
        });

        if (!isResponsive) {
          test.issues.push({
            type: 'image-responsive',
            severity: 'warning',
            message: 'Non-responsive images detected',
          });
          break;
        }
      }

      // Take screenshot for visual validation
      const screenshotPath = path.join(__dirname, '../reports/screenshots');
      await fs.ensureDir(screenshotPath);

      const screenshotFile = `${testName.replace(/\//g, '_')}.png`;
      await page.screenshot({
        path: path.join(screenshotPath, screenshotFile),
        fullPage: true,
      });
      test.screenshot = screenshotFile;

      // Determine test status
      const errorCount = test.issues.filter((issue) => issue.severity === 'error').length;
      const warningCount = test.issues.filter((issue) => issue.severity === 'warning').length;

      if (errorCount > 0) {
        test.status = 'FAIL';
        this.results.summary.failed++;
      } else if (warningCount > 0) {
        test.status = 'WARNING';
        this.results.summary.warnings++;
      } else {
        this.results.summary.passed++;
      }

      // Console output
      const statusColor =
        test.status === 'PASS' ? 'green' : test.status === 'WARNING' ? 'yellow' : 'red';
      const statusIcon = test.status === 'PASS' ? '✅' : test.status === 'WARNING' ? '⚠️' : '❌';

      console.log(chalk[statusColor](`${statusIcon} ${testName} - ${test.issues.length} issues`));
    } catch (error) {
      test.status = 'ERROR';
      test.error = error.message;
      this.results.summary.failed++;
      console.log(chalk.red(`❌ ${testName} - ERROR: ${error.message}`));
    }

    this.results.tests.push(test);
  }

  getUserAgent(device) {
    const userAgents = {
      'iPhone SE':
        'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1',
      iPad: 'Mozilla/5.0 (iPad; CPU OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1',
      'Desktop Small':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Desktop Large':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    };

    return userAgents[device] || userAgents['Desktop Large'];
  }

  generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      summary: this.results.summary,
      tests: this.results.tests,
      analysis: this.analyzeResults(),
    };

    // Console summary
    console.log(chalk.blue('\n📊 Responsive Testing Summary:'));
    console.log(chalk.white(`Total tests: ${report.summary.totalTests}`));
    console.log(chalk.green(`Passed: ${report.summary.passed}`));
    console.log(chalk.yellow(`Warnings: ${report.summary.warnings}`));
    console.log(chalk.red(`Failed: ${report.summary.failed}`));

    const passRate = ((report.summary.passed / report.summary.totalTests) * 100).toFixed(1);
    console.log(chalk.white(`Pass rate: ${passRate}%`));

    return report;
  }

  analyzeResults() {
    const analysis = {
      commonIssues: {},
      browserComparison: {},
      viewportIssues: {},
      recommendations: [],
    };

    // Count common issues
    this.results.tests.forEach((test) => {
      test.issues.forEach((issue) => {
        analysis.commonIssues[issue.type] = (analysis.commonIssues[issue.type] || 0) + 1;
      });
    });

    // Generate recommendations
    if (analysis.commonIssues['horizontal-scroll'] > 0) {
      analysis.recommendations.push(
        'Implement responsive CSS units (%, vw, rem) instead of fixed pixel widths',
      );
    }

    if (analysis.commonIssues['font-size'] > 0) {
      analysis.recommendations.push(
        'Increase font sizes for better readability, especially on mobile devices',
      );
    }

    if (analysis.commonIssues['touch-target'] > 0) {
      analysis.recommendations.push(
        'Ensure all interactive elements meet the minimum 44x44px touch target size',
      );
    }

    if (analysis.commonIssues['layout-shift'] > 0) {
      analysis.recommendations.push(
        'Optimize layout stability by reserving space for dynamic content',
      );
    }

    return analysis;
  }

  async saveReport(report) {
    const reportsDir = path.join(__dirname, '../reports');
    await fs.ensureDir(reportsDir);

    const reportPath = path.join(reportsDir, `responsive-test-${Date.now()}.json`);
    await fs.writeJson(reportPath, report, { spaces: 2 });

    console.log(chalk.blue(`\n📄 Report saved to: ${reportPath}`));
    return reportPath;
  }
}

// Run if called directly
if (require.main === module) {
  const tester = new ResponsiveTester();
  tester
    .runTests()
    .then((report) => {
      return tester.saveReport(report);
    })
    .then(() => {
      process.exit(tester.results.summary.failed > 0 ? 1 : 0);
    })
    .catch((error) => {
      console.error(chalk.red(`Fatal error: ${error.message}`));
      process.exit(1);
    });
}

module.exports = ResponsiveTester;
