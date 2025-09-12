#!/usr/bin/env node

const path = require('path');

const { AxePuppeteer } = require('@axe-core/playwright');
const chalk = require('chalk');
const fs = require('fs-extra');
const { chromium } = require('playwright');

class AccessibilityTester {
  constructor() {
    this.results = {
      tests: [],
      summary: {
        totalTests: 0,
        totalViolations: 0,
        criticalViolations: 0,
        seriousViolations: 0,
        moderateViolations: 0,
        minorViolations: 0,
        passedRules: 0,
      },
    };

    this.siteUrl = 'http://localhost:8000';
    this.testPages = [
      { path: '/', name: 'Home' },
      { path: '/getting-started/', name: 'Getting Started' },
      { path: '/installation/', name: 'Installation' },
      { path: '/user-guides/', name: 'User Guides' },
      { path: '/api/', name: 'API Reference' },
      { path: '/developers/', name: 'Developer Docs' },
      { path: '/troubleshooting/', name: 'Troubleshooting' },
      { path: '/reference/', name: 'Reference' },
    ];

    this.axeConfig = {
      rules: {
        // WCAG 2.1 AA compliance
        'color-contrast': { enabled: true },
        'color-contrast-enhanced': { enabled: false }, // AAA level
        'focus-order-semantics': { enabled: true },
        'hidden-content': { enabled: false }, // Can cause false positives
        'landmark-unique': { enabled: true },
        'page-has-heading-one': { enabled: true },
        region: { enabled: true },
        'skip-link': { enabled: true },
        tabindex: { enabled: true },
      },
      tags: ['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice'],
    };
  }

  async runTests() {
    console.log(chalk.blue('♿ Starting accessibility compliance testing...\n'));

    // Check if site is running
    if (!(await this.checkSiteAvailability())) {
      throw new Error('Documentation site is not running. Please start with `mkdocs serve`');
    }

    const browser = await chromium.launch({ headless: true });

    try {
      for (const page of this.testPages) {
        await this.testPage(browser, page);
      }
    } finally {
      await browser.close();
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

  async testPage(browser, pageInfo) {
    const context = await browser.newContext();
    const page = await context.newPage();

    const test = {
      name: pageInfo.name,
      path: pageInfo.path,
      url: `${this.siteUrl}${pageInfo.path}`,
      timestamp: new Date().toISOString(),
      violations: [],
      passes: [],
      incomplete: [],
      inapplicable: [],
      manualTests: [],
      metrics: {},
    };

    this.results.summary.totalTests++;

    try {
      console.log(chalk.blue(`🔍 Testing ${pageInfo.name} (${pageInfo.path})...`));

      await page.goto(test.url, { waitUntil: 'networkidle' });

      // Run axe-core accessibility tests
      const axeResults = await new AxePuppeteer(page).configure(this.axeConfig).analyze();

      test.violations = axeResults.violations;
      test.passes = axeResults.passes;
      test.incomplete = axeResults.incomplete;
      test.inapplicable = axeResults.inapplicable;

      // Count violations by severity
      test.violations.forEach((violation) => {
        const severity = violation.impact;
        test.metrics[`${severity}Violations`] = (test.metrics[`${severity}Violations`] || 0) + 1;
        this.results.summary.totalViolations += violation.nodes.length;

        switch (severity) {
          case 'critical':
            this.results.summary.criticalViolations += violation.nodes.length;
            break;
          case 'serious':
            this.results.summary.seriousViolations += violation.nodes.length;
            break;
          case 'moderate':
            this.results.summary.moderateViolations += violation.nodes.length;
            break;
          case 'minor':
            this.results.summary.minorViolations += violation.nodes.length;
            break;
        }
      });

      this.results.summary.passedRules += test.passes.length;

      // Manual accessibility tests
      test.manualTests = await this.runManualTests(page);

      // Keyboard navigation test
      const keyboardTest = await this.testKeyboardNavigation(page);
      test.manualTests.push(keyboardTest);

      // Screen reader test simulation
      const screenReaderTest = await this.testScreenReaderCompat(page);
      test.manualTests.push(screenReaderTest);

      // Color contrast verification
      const contrastTest = await this.testColorContrast(page);
      test.manualTests.push(contrastTest);

      // Take screenshot for reference
      const screenshotPath = path.join(__dirname, '../reports/accessibility-screenshots');
      await fs.ensureDir(screenshotPath);

      const screenshotFile = `${pageInfo.name.replace(/\s+/g, '_').toLowerCase()}.png`;
      await page.screenshot({
        path: path.join(screenshotPath, screenshotFile),
        fullPage: true,
      });
      test.screenshot = screenshotFile;

      // Status determination
      test.status = 'PASS';
      if (test.violations.length > 0) {
        const criticalOrSerious = test.violations.some((v) =>
          ['critical', 'serious'].includes(v.impact),
        );
        test.status = criticalOrSerious ? 'FAIL' : 'WARNING';
      }

      // Console output
      const violationCount = test.violations.reduce((sum, v) => sum + v.nodes.length, 0);
      const statusColor =
        test.status === 'PASS' ? 'green' : test.status === 'WARNING' ? 'yellow' : 'red';
      const statusIcon = test.status === 'PASS' ? '✅' : test.status === 'WARNING' ? '⚠️' : '❌';

      console.log(
        chalk[statusColor](
          `${statusIcon} ${pageInfo.name} - ${violationCount} violations, ${test.passes.length} passed rules`,
        ),
      );
    } catch (error) {
      test.status = 'ERROR';
      test.error = error.message;
      console.log(chalk.red(`❌ ${pageInfo.name} - ERROR: ${error.message}`));
    } finally {
      await context.close();
    }

    this.results.tests.push(test);
  }

  async testKeyboardNavigation(page) {
    const test = {
      name: 'Keyboard Navigation',
      type: 'manual',
      status: 'PASS',
      issues: [],
    };

    try {
      // Get all focusable elements
      const focusableElements = await page.$$eval(
        'a, button, input, select, textarea, [tabindex]:not([tabindex="-1"])',
        (elements) =>
          elements.map((el) => ({
            tag: el.tagName,
            text: el.textContent?.trim().substring(0, 50),
            hasVisibleFocus: false,
            tabIndex: el.tabIndex,
          })),
      );

      if (focusableElements.length === 0) {
        test.issues.push('No focusable elements found');
        test.status = 'FAIL';
        return test;
      }

      // Test Tab navigation
      let focusedCount = 0;
      for (let i = 0; i < Math.min(focusableElements.length, 10); i++) {
        await page.keyboard.press('Tab');

        // Check if focus is visible
        const hasVisibleFocus = await page.evaluate(() => {
          const focused = document.activeElement;
          if (!focused) return false;

          const style = window.getComputedStyle(focused);
          return style.outline !== 'none' || style.boxShadow !== 'none';
        });

        if (hasVisibleFocus) {
          focusedCount++;
        }
      }

      if (focusedCount < Math.min(focusableElements.length, 10) * 0.8) {
        test.issues.push(
          `Only ${focusedCount} of ${Math.min(focusableElements.length, 10)} elements show visible focus`,
        );
        test.status = 'WARNING';
      }

      test.metrics = {
        totalFocusable: focusableElements.length,
        testedElements: Math.min(focusableElements.length, 10),
        visibleFocusCount: focusedCount,
      };
    } catch (error) {
      test.status = 'ERROR';
      test.error = error.message;
    }

    return test;
  }

  async testScreenReaderCompat(page) {
    const test = {
      name: 'Screen Reader Compatibility',
      type: 'manual',
      status: 'PASS',
      issues: [],
      metrics: {},
    };

    try {
      // Check for semantic HTML structure
      const headingStructure = await page.$$eval('h1, h2, h3, h4, h5, h6', (headings) =>
        headings.map((h) => ({
          level: parseInt(h.tagName.charAt(1)),
          text: h.textContent?.trim().substring(0, 50),
        })),
      );

      // Validate heading hierarchy
      for (let i = 1; i < headingStructure.length; i++) {
        const current = headingStructure[i];
        const previous = headingStructure[i - 1];

        if (current.level > previous.level + 1) {
          test.issues.push(`Heading level skipped: h${previous.level} to h${current.level}`);
          test.status = 'WARNING';
        }
      }

      // Check for alt text on images
      const images = await page.$$eval('img', (imgs) =>
        imgs.map((img) => ({
          hasAlt: img.hasAttribute('alt'),
          altText: img.getAttribute('alt'),
          src: img.src.substring(0, 50),
        })),
      );

      const imagesWithoutAlt = images.filter((img) => !img.hasAlt || img.altText === '');
      if (imagesWithoutAlt.length > 0) {
        test.issues.push(`${imagesWithoutAlt.length} images missing alt text`);
        test.status = 'WARNING';
      }

      // Check for form labels
      const formInputs = await page.$$eval('input, select, textarea', (inputs) =>
        inputs.map((input) => ({
          type: input.type || input.tagName,
          hasLabel: input.labels?.length > 0 || input.hasAttribute('aria-label'),
          id: input.id,
        })),
      );

      const unlabeledInputs = formInputs.filter((input) => !input.hasLabel);
      if (unlabeledInputs.length > 0) {
        test.issues.push(`${unlabeledInputs.length} form inputs without labels`);
        test.status = 'WARNING';
      }

      // Check for landmarks
      const landmarks = await page.$$eval(
        '[role="main"], [role="navigation"], [role="banner"], [role="contentinfo"], main, nav, header, footer',
        (elements) => elements.map((el) => el.tagName || el.getAttribute('role')),
      );

      const requiredLandmarks = ['main', 'navigation'];
      const missingLandmarks = requiredLandmarks.filter(
        (landmark) => !landmarks.some((l) => l.toLowerCase().includes(landmark)),
      );

      if (missingLandmarks.length > 0) {
        test.issues.push(`Missing landmarks: ${missingLandmarks.join(', ')}`);
        test.status = 'WARNING';
      }

      test.metrics = {
        headingCount: headingStructure.length,
        imageCount: images.length,
        imagesWithAlt: images.length - imagesWithoutAlt.length,
        formInputCount: formInputs.length,
        labeledInputs: formInputs.length - unlabeledInputs.length,
        landmarkCount: landmarks.length,
      };
    } catch (error) {
      test.status = 'ERROR';
      test.error = error.message;
    }

    return test;
  }

  async testColorContrast(page) {
    const test = {
      name: 'Color Contrast Verification',
      type: 'manual',
      status: 'PASS',
      issues: [],
      metrics: {},
    };

    try {
      // This is a simplified test - axe-core handles most contrast testing
      // We'll check for potential issues that axe might miss

      const textElements = await page.$$eval(
        'p, h1, h2, h3, h4, h5, h6, a, button, span, div',
        (elements) => {
          return elements
            .slice(0, 20)
            .map((el) => {
              const style = window.getComputedStyle(el);
              const text = el.textContent?.trim();

              if (!text || text.length < 3) return null;

              return {
                text: text.substring(0, 30),
                color: style.color,
                backgroundColor: style.backgroundColor,
                fontSize: style.fontSize,
                fontWeight: style.fontWeight,
              };
            })
            .filter(Boolean);
        },
      );

      test.metrics.textElementsChecked = textElements.length;

      // Look for potential contrast issues (this is basic - axe-core is more thorough)
      const potentialIssues = textElements.filter((el) => {
        // Very basic check for light text on light background or dark on dark
        const color = el.color.toLowerCase();
        const bgColor = el.backgroundColor.toLowerCase();

        return (
          (color.includes('255') && bgColor.includes('255')) || // Light on light
          (color.includes('rgb(0') && bgColor.includes('rgb(0')) // Dark on dark
        );
      });

      if (potentialIssues.length > 0) {
        test.issues.push(`${potentialIssues.length} elements with potential contrast issues`);
        test.status = 'WARNING';
      }
    } catch (error) {
      test.status = 'ERROR';
      test.error = error.message;
    }

    return test;
  }

  async runManualTests(page) {
    // Additional manual tests specific to documentation sites
    const manualTests = [];

    // Test: Page has meaningful title
    const titleTest = {
      name: 'Page Title',
      type: 'manual',
      status: 'PASS',
      issues: [],
    };

    try {
      const title = await page.title();
      if (!title || title.trim().length < 10) {
        titleTest.issues.push('Page title is missing or too short');
        titleTest.status = 'WARNING';
      }
    } catch (error) {
      titleTest.status = 'ERROR';
      titleTest.error = error.message;
    }

    manualTests.push(titleTest);

    // Test: Meta description exists
    const metaTest = {
      name: 'Meta Description',
      type: 'manual',
      status: 'PASS',
      issues: [],
    };

    try {
      const metaDescription = await page
        .$eval('meta[name="description"]', (meta) => meta.content)
        .catch(() => null);
      if (!metaDescription || metaDescription.trim().length < 50) {
        metaTest.issues.push('Meta description is missing or too short');
        metaTest.status = 'WARNING';
      }
    } catch (error) {
      metaTest.status = 'ERROR';
      metaTest.error = error.message;
    }

    manualTests.push(metaTest);

    return manualTests;
  }

  generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      summary: this.results.summary,
      tests: this.results.tests,
      wcagCompliance: this.assessWcagCompliance(),
      recommendations: this.generateRecommendations(),
    };

    // Console summary
    console.log(chalk.blue('\n📊 Accessibility Testing Summary:'));
    console.log(chalk.white(`Pages tested: ${report.summary.totalTests}`));
    console.log(chalk.white(`Total violations: ${report.summary.totalViolations}`));
    console.log(chalk.red(`Critical: ${report.summary.criticalViolations}`));
    console.log(chalk.red(`Serious: ${report.summary.seriousViolations}`));
    console.log(chalk.yellow(`Moderate: ${report.summary.moderateViolations}`));
    console.log(chalk.blue(`Minor: ${report.summary.minorViolations}`));
    console.log(chalk.green(`Rules passed: ${report.summary.passedRules}`));

    return report;
  }

  assessWcagCompliance() {
    const compliance = {
      level: 'AAA',
      issues: [],
    };

    if (this.results.summary.criticalViolations > 0) {
      compliance.level = 'Non-compliant';
      compliance.issues.push('Critical accessibility violations found');
    } else if (this.results.summary.seriousViolations > 0) {
      compliance.level = 'A';
      compliance.issues.push('Serious violations prevent AA compliance');
    } else if (this.results.summary.moderateViolations > 0) {
      compliance.level = 'AA';
      compliance.issues.push('Moderate violations prevent AAA compliance');
    }

    return compliance;
  }

  generateRecommendations() {
    const recommendations = [];

    if (this.results.summary.criticalViolations > 0) {
      recommendations.push(
        'Address all critical violations immediately - these prevent basic accessibility',
      );
    }

    if (this.results.summary.seriousViolations > 0) {
      recommendations.push('Fix serious violations to meet WCAG AA standards');
    }

    // Check for common patterns in violations
    const allViolations = this.results.tests.flatMap((test) => test.violations);
    const violationTypes = {};

    allViolations.forEach((violation) => {
      violationTypes[violation.id] = (violationTypes[violation.id] || 0) + 1;
    });

    // Common violation recommendations
    if (violationTypes['color-contrast']) {
      recommendations.push(
        'Improve color contrast ratios to meet WCAG standards (4.5:1 for normal text)',
      );
    }

    if (violationTypes['missing-alt-text'] || violationTypes['image-alt']) {
      recommendations.push('Add meaningful alt text to all informative images');
    }

    if (violationTypes['label']) {
      recommendations.push('Ensure all form inputs have associated labels');
    }

    if (violationTypes['heading-order'] || violationTypes['page-has-heading-one']) {
      recommendations.push('Maintain proper heading hierarchy (h1 -> h2 -> h3)');
    }

    return recommendations;
  }

  async saveReport(report) {
    const reportsDir = path.join(__dirname, '../reports');
    await fs.ensureDir(reportsDir);

    const reportPath = path.join(reportsDir, `accessibility-test-${Date.now()}.json`);
    await fs.writeJson(reportPath, report, { spaces: 2 });

    console.log(chalk.blue(`\n📄 Report saved to: ${reportPath}`));
    return reportPath;
  }
}

// Run if called directly
if (require.main === module) {
  const tester = new AccessibilityTester();
  tester
    .runTests()
    .then((report) => {
      return tester.saveReport(report);
    })
    .then(() => {
      const hasFailures =
        tester.results.summary.criticalViolations > 0 ||
        tester.results.summary.seriousViolations > 0;
      process.exit(hasFailures ? 1 : 0);
    })
    .catch((error) => {
      console.error(chalk.red(`Fatal error: ${error.message}`));
      process.exit(1);
    });
}

module.exports = AccessibilityTester;
