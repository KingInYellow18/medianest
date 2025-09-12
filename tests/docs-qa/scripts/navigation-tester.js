#!/usr/bin/env node

const path = require('path');

const chalk = require('chalk');
const fs = require('fs-extra');
const { chromium } = require('playwright');

class NavigationTester {
  constructor() {
    this.results = {
      tests: [],
      summary: {
        totalTests: 0,
        passed: 0,
        failed: 0,
        warnings: 0,
        navigationErrors: 0,
        searchErrors: 0,
      },
    };

    this.siteUrl = 'http://localhost:8000';
    this.viewports = [
      { name: 'Desktop', width: 1280, height: 720 },
      { name: 'Tablet', width: 768, height: 1024 },
      { name: 'Mobile', width: 375, height: 667 },
    ];
  }

  async runTests() {
    console.log(chalk.blue('🧭 Starting navigation and UX testing...\n'));

    // Check if site is running
    if (!(await this.checkSiteAvailability())) {
      throw new Error('Documentation site is not running. Please start with `mkdocs serve`');
    }

    // Test navigation functionality
    await this.testMainNavigation();

    // Test search functionality
    await this.testSearchFunctionality();

    // Test responsive navigation
    await this.testResponsiveNavigation();

    // Test breadcrumbs
    await this.testBreadcrumbs();

    // Test table of contents
    await this.testTableOfContents();

    // Test footer links
    await this.testFooterLinks();

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

  async testMainNavigation() {
    console.log(chalk.blue('🗺️ Testing main navigation...'));

    const test = {
      name: 'Main Navigation',
      type: 'navigation',
      status: 'PASS',
      issues: [],
      metrics: {},
      timestamp: new Date().toISOString(),
    };

    this.results.summary.totalTests++;

    const browser = await chromium.launch();

    try {
      const context = await browser.newContext();
      const page = await context.newPage();

      await page.goto(this.siteUrl);

      // Test primary navigation
      const navLinks = await page.locator('nav a, [role="navigation"] a').all();
      test.metrics.totalNavLinks = navLinks.length;

      if (navLinks.length === 0) {
        test.issues.push({
          type: 'navigation-missing',
          severity: 'error',
          message: 'No navigation links found',
        });
        test.status = 'FAIL';
      }

      // Test each navigation link
      let workingLinks = 0;
      const linkTests = [];

      for (const [index, link] of navLinks.entries()) {
        if (index >= 10) break; // Limit to first 10 links for performance

        try {
          const href = await link.getAttribute('href');
          const text = await link.textContent();

          if (!href || href === '#') {
            linkTests.push({ text, href, status: 'invalid', error: 'Empty or invalid href' });
            continue;
          }

          // Test link navigation
          const linkResponse = await page.goto(
            href.startsWith('http')
              ? href
              : `${this.siteUrl}${href.startsWith('/') ? href : '/' + href}`,
            { timeout: 5000, waitUntil: 'networkidle' },
          );

          if (linkResponse && linkResponse.ok()) {
            workingLinks++;
            linkTests.push({ text, href, status: 'working' });
          } else {
            linkTests.push({
              text,
              href,
              status: 'broken',
              error: `HTTP ${linkResponse?.status()}`,
            });
          }

          // Go back to home for next test
          await page.goto(this.siteUrl);
        } catch (error) {
          linkTests.push({
            text: await link.textContent(),
            href: await link.getAttribute('href'),
            status: 'error',
            error: error.message,
          });
        }
      }

      test.metrics.workingLinks = workingLinks;
      test.metrics.brokenLinks = linkTests.filter(
        (l) => l.status === 'broken' || l.status === 'error',
      ).length;
      test.linkTests = linkTests;

      // Test navigation consistency
      const pages = ['/', '/getting-started/', '/installation/'];
      const navConsistency = [];

      for (const pagePath of pages) {
        await page.goto(`${this.siteUrl}${pagePath}`);
        const pageNavLinks = await page.locator('nav a, [role="navigation"] a').count();
        navConsistency.push({ page: pagePath, navLinkCount: pageNavLinks });
      }

      // Check if navigation is consistent across pages
      const navCounts = navConsistency.map((n) => n.navLinkCount);
      const isConsistent = navCounts.every((count) => count === navCounts[0]);

      if (!isConsistent) {
        test.issues.push({
          type: 'navigation-inconsistent',
          severity: 'warning',
          message: 'Navigation structure varies across pages',
        });
        test.status = 'WARNING';
      }

      test.metrics.navigationConsistency = navConsistency;

      // Test active page highlighting
      await page.goto(`${this.siteUrl}/getting-started/`);
      const hasActiveIndicator =
        (await page.locator('nav .active, nav [aria-current], .navigation .current').count()) > 0;

      if (!hasActiveIndicator) {
        test.issues.push({
          type: 'active-indicator',
          severity: 'warning',
          message: 'No active page indicator found in navigation',
        });
      }

      test.metrics.hasActiveIndicator = hasActiveIndicator;
    } catch (error) {
      test.status = 'ERROR';
      test.error = error.message;
    } finally {
      await browser.close();
    }

    this.updateTestSummary(test);
    this.results.tests.push(test);

    const statusColor =
      test.status === 'PASS' ? 'green' : test.status === 'WARNING' ? 'yellow' : 'red';
    const statusIcon = test.status === 'PASS' ? '✅' : test.status === 'WARNING' ? '⚠️' : '❌';
    console.log(chalk[statusColor](`${statusIcon} Main Navigation - ${test.issues.length} issues`));
  }

  async testSearchFunctionality() {
    console.log(chalk.blue('🔍 Testing search functionality...'));

    const test = {
      name: 'Search Functionality',
      type: 'search',
      status: 'PASS',
      issues: [],
      metrics: {},
      timestamp: new Date().toISOString(),
    };

    this.results.summary.totalTests++;

    const browser = await chromium.launch();

    try {
      const context = await browser.newContext();
      const page = await context.newPage();

      await page.goto(this.siteUrl);

      // Look for search input
      const searchInput = page.locator(
        'input[type="search"], input[placeholder*="search" i], .search input',
      );
      const searchInputCount = await searchInput.count();

      if (searchInputCount === 0) {
        test.issues.push({
          type: 'search-missing',
          severity: 'warning',
          message: 'No search input found',
        });
        test.status = 'WARNING';
        test.metrics.hasSearch = false;
      } else {
        test.metrics.hasSearch = true;

        // Test search functionality
        const searchQueries = ['installation', 'api', 'getting started', 'nonexistent'];
        const searchResults = [];

        for (const query of searchQueries) {
          try {
            await searchInput.first().fill(query);
            await page.waitForTimeout(1000); // Wait for search suggestions/results

            // Look for search results or suggestions
            const resultsVisible = await page
              .locator('.search-results, .suggestions, [role="listbox"]')
              .isVisible()
              .catch(() => false);

            const resultCount = await page
              .locator('.search-results li, .suggestions li, [role="option"]')
              .count()
              .catch(() => 0);

            searchResults.push({
              query,
              resultsVisible,
              resultCount,
              hasResults: resultCount > 0,
            });

            // Clear search for next test
            await searchInput.first().fill('');
            await page.waitForTimeout(500);
          } catch (error) {
            searchResults.push({
              query,
              error: error.message,
              hasResults: false,
            });
          }
        }

        test.metrics.searchResults = searchResults;

        // Check if search produces results for valid queries
        const validQueries = searchResults.filter((r) => r.query !== 'nonexistent');
        const workingSearches = validQueries.filter((r) => r.hasResults);

        if (workingSearches.length === 0) {
          test.issues.push({
            type: 'search-no-results',
            severity: 'error',
            message: 'Search does not return results for any test queries',
          });
          test.status = 'FAIL';
          this.results.summary.searchErrors++;
        } else if (workingSearches.length < validQueries.length / 2) {
          test.issues.push({
            type: 'search-limited',
            severity: 'warning',
            message: 'Search returns results for less than half of test queries',
          });
          test.status = 'WARNING';
        }

        test.metrics.searchEffectiveness = workingSearches.length / validQueries.length;

        // Test search keyboard navigation
        try {
          await searchInput.first().focus();
          await page.keyboard.press('ArrowDown');
          await page.keyboard.press('Enter');

          // Wait to see if navigation occurred
          await page.waitForTimeout(1000);
          const currentUrl = page.url();

          test.metrics.keyboardNavigationWorks = currentUrl !== this.siteUrl;
        } catch (error) {
          test.metrics.keyboardNavigationWorks = false;
        }
      }
    } catch (error) {
      test.status = 'ERROR';
      test.error = error.message;
    } finally {
      await browser.close();
    }

    this.updateTestSummary(test);
    this.results.tests.push(test);

    const statusColor =
      test.status === 'PASS' ? 'green' : test.status === 'WARNING' ? 'yellow' : 'red';
    const statusIcon = test.status === 'PASS' ? '✅' : test.status === 'WARNING' ? '⚠️' : '❌';
    console.log(
      chalk[statusColor](`${statusIcon} Search Functionality - ${test.issues.length} issues`),
    );
  }

  async testResponsiveNavigation() {
    console.log(chalk.blue('📱 Testing responsive navigation...'));

    const browser = await chromium.launch();

    for (const viewport of this.viewports) {
      const test = {
        name: `Responsive Navigation - ${viewport.name}`,
        type: 'responsive-navigation',
        viewport: viewport,
        status: 'PASS',
        issues: [],
        metrics: {},
        timestamp: new Date().toISOString(),
      };

      this.results.summary.totalTests++;

      try {
        const context = await browser.newContext({
          viewport: { width: viewport.width, height: viewport.height },
        });
        const page = await context.newPage();

        await page.goto(this.siteUrl);

        // Test mobile menu behavior
        if (viewport.width <= 768) {
          // Look for mobile menu toggle
          const mobileToggle = page.locator(
            '.hamburger, .mobile-menu-toggle, [aria-label*="menu" i]',
          );
          const toggleExists = (await mobileToggle.count()) > 0;

          test.metrics.hasMobileToggle = toggleExists;

          if (!toggleExists) {
            test.issues.push({
              type: 'mobile-menu-missing',
              severity: 'error',
              message: 'No mobile menu toggle found',
            });
            test.status = 'FAIL';
          } else {
            // Test mobile menu functionality
            const navVisible = await page.locator('nav, .navigation').isVisible();

            // Click toggle to open menu
            await mobileToggle.first().click();
            await page.waitForTimeout(500);

            const navVisibleAfterToggle = await page.locator('nav, .navigation').isVisible();

            test.metrics.mobileMenuWorks = navVisibleAfterToggle !== navVisible;

            if (!test.metrics.mobileMenuWorks) {
              test.issues.push({
                type: 'mobile-menu-broken',
                severity: 'error',
                message: 'Mobile menu toggle does not work',
              });
              test.status = 'FAIL';
            }
          }
        } else {
          // Test desktop navigation visibility
          const navVisible = await page.locator('nav, .navigation').isVisible();
          test.metrics.desktopNavVisible = navVisible;

          if (!navVisible) {
            test.issues.push({
              type: 'desktop-nav-hidden',
              severity: 'error',
              message: 'Desktop navigation not visible',
            });
            test.status = 'FAIL';
          }
        }

        // Test navigation text readability at different sizes
        const navLinks = await page.locator('nav a, .navigation a').all();
        let smallTextCount = 0;

        for (const link of navLinks.slice(0, 5)) {
          // Test first 5 links
          const fontSize = await link.evaluate((el) => {
            const style = window.getComputedStyle(el);
            return parseFloat(style.fontSize);
          });

          const minSize = viewport.width <= 768 ? 14 : 16;
          if (fontSize < minSize) {
            smallTextCount++;
          }
        }

        if (smallTextCount > 0) {
          test.issues.push({
            type: 'text-too-small',
            severity: 'warning',
            message: `${smallTextCount} navigation links have small text`,
          });
          test.status = 'WARNING';
        }

        test.metrics.smallTextLinks = smallTextCount;

        await context.close();
      } catch (error) {
        test.status = 'ERROR';
        test.error = error.message;
      }

      this.updateTestSummary(test);
      this.results.tests.push(test);

      const statusColor =
        test.status === 'PASS' ? 'green' : test.status === 'WARNING' ? 'yellow' : 'red';
      const statusIcon = test.status === 'PASS' ? '✅' : test.status === 'WARNING' ? '⚠️' : '❌';
      console.log(chalk[statusColor](`${statusIcon} ${test.name} - ${test.issues.length} issues`));
    }

    await browser.close();
  }

  async testBreadcrumbs() {
    console.log(chalk.blue('🍞 Testing breadcrumbs...'));

    const test = {
      name: 'Breadcrumbs',
      type: 'breadcrumbs',
      status: 'PASS',
      issues: [],
      metrics: {},
      timestamp: new Date().toISOString(),
    };

    this.results.summary.totalTests++;

    const browser = await chromium.launch();

    try {
      const context = await browser.newContext();
      const page = await context.newPage();

      // Test breadcrumbs on different pages
      const testPages = [
        { path: '/getting-started/', expectedDepth: 2 },
        { path: '/installation/docker/', expectedDepth: 3 },
        { path: '/api/authentication/', expectedDepth: 3 },
      ];

      const breadcrumbTests = [];

      for (const testPage of testPages) {
        try {
          await page.goto(`${this.siteUrl}${testPage.path}`);

          // Look for breadcrumbs
          const breadcrumbs = page.locator(
            '.breadcrumb, [aria-label="breadcrumb"], nav[aria-label="Breadcrumb"]',
          );
          const hasBreadcrumbs = (await breadcrumbs.count()) > 0;

          if (hasBreadcrumbs) {
            const breadcrumbLinks = await page
              .locator('.breadcrumb a, [aria-label="breadcrumb"] a')
              .count();
            breadcrumbTests.push({
              path: testPage.path,
              hasBreadcrumbs: true,
              linkCount: breadcrumbLinks,
              expectedDepth: testPage.expectedDepth,
            });
          } else {
            breadcrumbTests.push({
              path: testPage.path,
              hasBreadcrumbs: false,
              linkCount: 0,
              expectedDepth: testPage.expectedDepth,
            });
          }
        } catch (error) {
          breadcrumbTests.push({
            path: testPage.path,
            error: error.message,
          });
        }
      }

      test.metrics.breadcrumbTests = breadcrumbTests;

      // Analyze breadcrumb consistency
      const pagesWithBreadcrumbs = breadcrumbTests.filter((t) => t.hasBreadcrumbs).length;
      const totalTestPages = breadcrumbTests.length;

      if (pagesWithBreadcrumbs === 0) {
        test.issues.push({
          type: 'breadcrumbs-missing',
          severity: 'warning',
          message: 'No breadcrumbs found on any test pages',
        });
        test.status = 'WARNING';
      } else if (pagesWithBreadcrumbs < totalTestPages) {
        test.issues.push({
          type: 'breadcrumbs-inconsistent',
          severity: 'warning',
          message: `Breadcrumbs missing on ${totalTestPages - pagesWithBreadcrumbs} of ${totalTestPages} pages`,
        });
        test.status = 'WARNING';
      }

      test.metrics.breadcrumbCoverage = pagesWithBreadcrumbs / totalTestPages;
    } catch (error) {
      test.status = 'ERROR';
      test.error = error.message;
    } finally {
      await browser.close();
    }

    this.updateTestSummary(test);
    this.results.tests.push(test);

    const statusColor =
      test.status === 'PASS' ? 'green' : test.status === 'WARNING' ? 'yellow' : 'red';
    const statusIcon = test.status === 'PASS' ? '✅' : test.status === 'WARNING' ? '⚠️' : '❌';
    console.log(chalk[statusColor](`${statusIcon} Breadcrumbs - ${test.issues.length} issues`));
  }

  async testTableOfContents() {
    console.log(chalk.blue('📜 Testing table of contents...'));

    const test = {
      name: 'Table of Contents',
      type: 'toc',
      status: 'PASS',
      issues: [],
      metrics: {},
      timestamp: new Date().toISOString(),
    };

    this.results.summary.totalTests++;

    const browser = await chromium.launch();

    try {
      const context = await browser.newContext();
      const page = await context.newPage();

      // Test TOC on pages with substantial content
      const testPages = ['/installation/', '/api/', '/developers/'];
      const tocTests = [];

      for (const testPage of testPages) {
        await page.goto(`${this.siteUrl}${testPage}`);

        // Look for table of contents
        const toc = page.locator(
          '.toc, .table-of-contents, [role="navigation"][aria-label*="contents" i]',
        );
        const hasToc = (await toc.count()) > 0;

        if (hasToc) {
          const tocLinks = await page.locator('.toc a, .table-of-contents a').count();
          const headings = await page.locator('h2, h3, h4, h5, h6').count();

          tocTests.push({
            path: testPage,
            hasToc: true,
            tocLinks,
            headings,
            coverage: tocLinks / Math.max(headings, 1),
          });

          // Test TOC link functionality
          if (tocLinks > 0) {
            try {
              await page.locator('.toc a, .table-of-contents a').first().click();
              await page.waitForTimeout(500);
              // If we're still on the same page, the anchor link worked
              const currentUrl = page.url();
              const hasAnchor = currentUrl.includes('#');
              tocTests[tocTests.length - 1].linksWork = hasAnchor;
            } catch (error) {
              tocTests[tocTests.length - 1].linkError = error.message;
            }
          }
        } else {
          const headings = await page.locator('h2, h3, h4, h5, h6').count();
          tocTests.push({
            path: testPage,
            hasToc: false,
            headings,
          });
        }
      }

      test.metrics.tocTests = tocTests;

      // Analyze TOC coverage
      const pagesWithToc = tocTests.filter((t) => t.hasToc).length;
      const pagesNeedingToc = tocTests.filter((t) => t.headings >= 3).length; // Pages with 3+ headings should have TOC

      if (pagesNeedingToc > 0 && pagesWithToc === 0) {
        test.issues.push({
          type: 'toc-missing',
          severity: 'warning',
          message: 'No table of contents found on pages with multiple headings',
        });
        test.status = 'WARNING';
      } else if (pagesWithToc < pagesNeedingToc) {
        test.issues.push({
          type: 'toc-incomplete',
          severity: 'info',
          message: `${pagesNeedingToc - pagesWithToc} pages with multiple headings lack table of contents`,
        });
      }

      test.metrics.tocCoverage = pagesNeedingToc > 0 ? pagesWithToc / pagesNeedingToc : 1;
    } catch (error) {
      test.status = 'ERROR';
      test.error = error.message;
    } finally {
      await browser.close();
    }

    this.updateTestSummary(test);
    this.results.tests.push(test);

    const statusColor =
      test.status === 'PASS' ? 'green' : test.status === 'WARNING' ? 'yellow' : 'red';
    const statusIcon = test.status === 'PASS' ? '✅' : test.status === 'WARNING' ? '⚠️' : '❌';
    console.log(
      chalk[statusColor](`${statusIcon} Table of Contents - ${test.issues.length} issues`),
    );
  }

  async testFooterLinks() {
    console.log(chalk.blue('🦶 Testing footer links...'));

    const test = {
      name: 'Footer Links',
      type: 'footer',
      status: 'PASS',
      issues: [],
      metrics: {},
      timestamp: new Date().toISOString(),
    };

    this.results.summary.totalTests++;

    const browser = await chromium.launch();

    try {
      const context = await browser.newContext();
      const page = await context.newPage();

      await page.goto(this.siteUrl);

      // Look for footer
      const footer = page.locator('footer, .footer');
      const hasFooter = (await footer.count()) > 0;

      test.metrics.hasFooter = hasFooter;

      if (!hasFooter) {
        test.issues.push({
          type: 'footer-missing',
          severity: 'warning',
          message: 'No footer found',
        });
        test.status = 'WARNING';
      } else {
        // Test footer links
        const footerLinks = await page.locator('footer a, .footer a').all();
        test.metrics.footerLinkCount = footerLinks.length;

        const linkTests = [];

        for (const [index, link] of footerLinks.entries()) {
          if (index >= 10) break; // Limit testing for performance

          const href = await link.getAttribute('href');
          const text = await link.textContent();

          if (!href || href === '#') {
            linkTests.push({ text, href, status: 'invalid' });
            continue;
          }

          // Test external links (just check if they're properly formed)
          if (href.startsWith('http')) {
            linkTests.push({ text, href, status: 'external', type: 'external' });
          } else {
            // Test internal links
            try {
              const fullUrl = href.startsWith('/')
                ? `${this.siteUrl}${href}`
                : `${this.siteUrl}/${href}`;
              const response = await page.goto(fullUrl, { timeout: 5000 });

              if (response && response.ok()) {
                linkTests.push({ text, href, status: 'working', type: 'internal' });
              } else {
                linkTests.push({
                  text,
                  href,
                  status: 'broken',
                  type: 'internal',
                  statusCode: response?.status(),
                });
              }
            } catch (error) {
              linkTests.push({
                text,
                href,
                status: 'error',
                type: 'internal',
                error: error.message,
              });
            }
          }
        }

        test.metrics.linkTests = linkTests;

        const brokenLinks = linkTests.filter(
          (l) => l.status === 'broken' || l.status === 'error',
        ).length;
        const invalidLinks = linkTests.filter((l) => l.status === 'invalid').length;

        if (brokenLinks > 0) {
          test.issues.push({
            type: 'footer-broken-links',
            severity: 'error',
            message: `${brokenLinks} broken footer links found`,
          });
          test.status = 'FAIL';
        }

        if (invalidLinks > 0) {
          test.issues.push({
            type: 'footer-invalid-links',
            severity: 'warning',
            message: `${invalidLinks} invalid footer links found`,
          });
          test.status = 'WARNING';
        }

        test.metrics.brokenFooterLinks = brokenLinks;
        test.metrics.invalidFooterLinks = invalidLinks;
      }
    } catch (error) {
      test.status = 'ERROR';
      test.error = error.message;
    } finally {
      await browser.close();
    }

    this.updateTestSummary(test);
    this.results.tests.push(test);

    const statusColor =
      test.status === 'PASS' ? 'green' : test.status === 'WARNING' ? 'yellow' : 'red';
    const statusIcon = test.status === 'PASS' ? '✅' : test.status === 'WARNING' ? '⚠️' : '❌';
    console.log(chalk[statusColor](`${statusIcon} Footer Links - ${test.issues.length} issues`));
  }

  updateTestSummary(test) {
    if (test.status === 'PASS') {
      this.results.summary.passed++;
    } else if (test.status === 'WARNING') {
      this.results.summary.warnings++;
    } else {
      this.results.summary.failed++;
    }

    if (test.type === 'navigation' && test.status === 'FAIL') {
      this.results.summary.navigationErrors++;
    }

    if (test.type === 'search' && test.status === 'FAIL') {
      this.results.summary.searchErrors++;
    }
  }

  generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      summary: this.results.summary,
      tests: this.results.tests,
      analysis: this.analyzeResults(),
    };

    // Console summary
    console.log(chalk.blue('\n📊 Navigation Testing Summary:'));
    console.log(chalk.white(`Total tests: ${report.summary.totalTests}`));
    console.log(chalk.green(`Passed: ${report.summary.passed}`));
    console.log(chalk.yellow(`Warnings: ${report.summary.warnings}`));
    console.log(chalk.red(`Failed: ${report.summary.failed}`));
    console.log(chalk.red(`Navigation errors: ${report.summary.navigationErrors}`));
    console.log(chalk.red(`Search errors: ${report.summary.searchErrors}`));

    const successRate = ((report.summary.passed / report.summary.totalTests) * 100).toFixed(1);
    console.log(chalk.white(`Success rate: ${successRate}%`));

    return report;
  }

  analyzeResults() {
    const analysis = {
      criticalIssues: [],
      recommendations: [],
      usabilityScore: 0,
    };

    // Identify critical issues
    this.results.tests.forEach((test) => {
      test.issues.forEach((issue) => {
        if (issue.severity === 'error') {
          analysis.criticalIssues.push({
            test: test.name,
            issue: issue.message,
          });
        }
      });
    });

    // Generate recommendations
    if (this.results.summary.navigationErrors > 0) {
      analysis.recommendations.push('Fix navigation functionality to improve user experience');
    }

    if (this.results.summary.searchErrors > 0) {
      analysis.recommendations.push('Repair search functionality to help users find content');
    }

    const responsiveNavTest = this.results.tests.find((t) => t.name.includes('Mobile'));
    if (responsiveNavTest && responsiveNavTest.status !== 'PASS') {
      analysis.recommendations.push('Optimize mobile navigation for better mobile experience');
    }

    // Calculate usability score
    const totalPossiblePoints = this.results.summary.totalTests * 100;
    const earnedPoints = this.results.summary.passed * 100 + this.results.summary.warnings * 60;
    analysis.usabilityScore = Math.round((earnedPoints / totalPossiblePoints) * 100);

    return analysis;
  }

  async saveReport(report) {
    const reportsDir = path.join(__dirname, '../reports');
    await fs.ensureDir(reportsDir);

    const reportPath = path.join(reportsDir, `navigation-test-${Date.now()}.json`);
    await fs.writeJson(reportPath, report, { spaces: 2 });

    console.log(chalk.blue(`\n📄 Report saved to: ${reportPath}`));
    return reportPath;
  }
}

// Run if called directly
if (require.main === module) {
  const tester = new NavigationTester();
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

module.exports = NavigationTester;
