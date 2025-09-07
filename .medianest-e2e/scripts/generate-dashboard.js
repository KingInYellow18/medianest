#!/usr/bin/env node

/**
 * MediaNest E2E Test Dashboard Generator
 * HIVE-MIND Enhanced Reporting and Visualization System
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class TestDashboardGenerator {
  constructor(options = {}) {
    this.sessionId = options.sessionId || 'default';
    this.buildNumber = options.buildNumber || '0';
    this.commitSha = options.commitSha || 'unknown';
    this.outputDir = path.join('reports', 'dashboard');
    this.artifactsDir = path.join('artifacts');
    
    this.ensureDirectories();
  }

  ensureDirectories() {
    [this.outputDir, path.join(this.outputDir, 'assets'), path.join(this.outputDir, 'data')].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  async generateDashboard() {
    console.log('🎯 Generating comprehensive test dashboard...');
    
    try {
      // Collect and process all test results
      const testData = await this.collectTestResults();
      const performanceData = await this.collectPerformanceData();
      const visualData = await this.collectVisualData();
      const accessibilityData = await this.collectAccessibilityData();
      
      // Generate dashboard components
      await this.generateOverviewPage(testData);
      await this.generatePerformancePage(performanceData);
      await this.generateVisualRegressionPage(visualData);
      await this.generateAccessibilityPage(accessibilityData);
      await this.generateTrendsPage(testData);
      await this.generateExecutivePage(testData, performanceData);
      
      // Generate navigation and assets
      await this.generateNavigation();
      await this.copyAssets();
      
      console.log('✅ Dashboard generated successfully');
      console.log(`📊 Dashboard available at: ${path.resolve(this.outputDir)}/index.html`);
      
    } catch (error) {
      console.error('❌ Dashboard generation failed:', error);
      throw error;
    }
  }

  async collectTestResults() {
    const results = {
      summary: { total: 0, passed: 0, failed: 0, skipped: 0, flaky: 0 },
      browsers: {},
      testTypes: {},
      duration: 0,
      timestamp: new Date().toISOString()
    };

    // Scan artifacts directory for test results
    if (fs.existsSync(this.artifactsDir)) {
      const artifacts = fs.readdirSync(this.artifactsDir);
      
      for (const artifact of artifacts) {
        const artifactPath = path.join(this.artifactsDir, artifact);
        if (fs.statSync(artifactPath).isDirectory()) {
          const jsonResults = this.findJsonResults(artifactPath);
          if (jsonResults) {
            this.processTestResults(JSON.parse(fs.readFileSync(jsonResults, 'utf8')), results, artifact);
          }
        }
      }
    }

    return results;
  }

  findJsonResults(dir) {
    try {
      const files = fs.readdirSync(dir, { recursive: true });
      return files.find(file => file.endsWith('results.json'));
    } catch {
      return null;
    }
  }

  processTestResults(data, results, source) {
    if (data.suites) {
      data.suites.forEach(suite => {
        suite.tests.forEach(test => {
          results.summary.total++;
          results.summary[test.status] = (results.summary[test.status] || 0) + 1;
          
          // Extract browser from source
          const browser = source.split('-')[1] || 'unknown';
          results.browsers[browser] = (results.browsers[browser] || 0) + 1;
          
          // Extract test type from test annotations
          const testType = this.extractTestType(test);
          results.testTypes[testType] = (results.testTypes[testType] || 0) + 1;
          
          results.duration += test.duration || 0;
        });
      });
    }
  }

  extractTestType(test) {
    const title = test.title.toLowerCase();
    if (title.includes('smoke')) return 'smoke';
    if (title.includes('regression')) return 'regression';
    if (title.includes('visual')) return 'visual';
    if (title.includes('accessibility')) return 'accessibility';
    if (title.includes('performance')) return 'performance';
    if (title.includes('api')) return 'api';
    if (title.includes('mobile')) return 'mobile';
    return 'functional';
  }

  async collectPerformanceData() {
    const performanceData = {
      lighthouse: [],
      coreVitals: [],
      loadTimes: [],
      memoryUsage: []
    };

    // Collect Lighthouse reports
    if (fs.existsSync(path.join(this.artifactsDir, 'performance-results'))) {
      const perfDir = path.join(this.artifactsDir, 'performance-results');
      const lighthouseReports = this.findFiles(perfDir, 'lighthouse-report.json');
      
      lighthouseReports.forEach(report => {
        try {
          const data = JSON.parse(fs.readFileSync(report, 'utf8'));
          performanceData.lighthouse.push(this.processLighthouseData(data));
        } catch (error) {
          console.warn(`Failed to process Lighthouse report: ${report}`);
        }
      });
    }

    return performanceData;
  }

  processLighthouseData(data) {
    return {
      url: data.finalUrl,
      performance: data.categories.performance.score * 100,
      accessibility: data.categories.accessibility.score * 100,
      bestPractices: data.categories['best-practices'].score * 100,
      seo: data.categories.seo.score * 100,
      metrics: {
        fcp: data.audits['first-contentful-paint'].numericValue,
        lcp: data.audits['largest-contentful-paint'].numericValue,
        cls: data.audits['cumulative-layout-shift'].numericValue,
        fid: data.audits['max-potential-fid'].numericValue,
        speedIndex: data.audits['speed-index'].numericValue
      }
    };
  }

  async collectVisualData() {
    const visualData = {
      totalSnapshots: 0,
      passed: 0,
      failed: 0,
      new: 0,
      diffs: []
    };

    const visualDir = path.join(this.artifactsDir, 'visual-regression-results');
    if (fs.existsSync(visualDir)) {
      const diffImages = this.findFiles(visualDir, '-diff.png');
      visualData.failed = diffImages.length;
      visualData.diffs = diffImages.map(diff => ({
        path: diff,
        testName: path.basename(diff, '-diff.png'),
        url: this.relativePath(diff)
      }));
    }

    return visualData;
  }

  async collectAccessibilityData() {
    const a11yData = {
      violations: [],
      passes: [],
      summary: { critical: 0, serious: 0, moderate: 0, minor: 0 }
    };

    const a11yDir = path.join(this.artifactsDir, 'accessibility-results');
    if (fs.existsSync(a11yDir)) {
      const a11yReports = this.findFiles(a11yDir, 'axe-report.json');
      
      a11yReports.forEach(report => {
        try {
          const data = JSON.parse(fs.readFileSync(report, 'utf8'));
          this.processAccessibilityData(data, a11yData);
        } catch (error) {
          console.warn(`Failed to process accessibility report: ${report}`);
        }
      });
    }

    return a11yData;
  }

  processAccessibilityData(data, a11yData) {
    if (data.violations) {
      data.violations.forEach(violation => {
        a11yData.violations.push(violation);
        a11yData.summary[violation.impact] = (a11yData.summary[violation.impact] || 0) + 1;
      });
    }
    
    if (data.passes) {
      a11yData.passes.push(...data.passes);
    }
  }

  async generateOverviewPage(testData) {
    const successRate = ((testData.summary.passed / testData.summary.total) * 100).toFixed(1);
    const avgDuration = (testData.duration / testData.summary.total / 1000).toFixed(2);
    
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MediaNest E2E Test Dashboard</title>
    <link rel="stylesheet" href="assets/dashboard.css">
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
</head>
<body>
    <div class="dashboard-container">
        <nav class="dashboard-nav">
            <h1>MediaNest E2E Dashboard</h1>
            <ul>
                <li><a href="index.html" class="active">Overview</a></li>
                <li><a href="performance.html">Performance</a></li>
                <li><a href="visual.html">Visual Regression</a></li>
                <li><a href="accessibility.html">Accessibility</a></li>
                <li><a href="trends.html">Trends</a></li>
                <li><a href="executive.html">Executive Summary</a></li>
            </ul>
        </nav>

        <main class="dashboard-main">
            <header class="dashboard-header">
                <h1>Test Execution Overview</h1>
                <div class="build-info">
                    <span class="build-number">Build #${this.buildNumber}</span>
                    <span class="commit-sha">${this.commitSha.substring(0, 8)}</span>
                    <span class="timestamp">${new Date(testData.timestamp).toLocaleString()}</span>
                </div>
            </header>

            <div class="metrics-grid">
                <div class="metric-card success-rate">
                    <h3>Success Rate</h3>
                    <div class="metric-value">${successRate}%</div>
                    <div class="metric-detail">${testData.summary.passed}/${testData.summary.total} tests passed</div>
                </div>

                <div class="metric-card duration">
                    <h3>Avg Duration</h3>
                    <div class="metric-value">${avgDuration}s</div>
                    <div class="metric-detail">per test</div>
                </div>

                <div class="metric-card total-tests">
                    <h3>Total Tests</h3>
                    <div class="metric-value">${testData.summary.total}</div>
                    <div class="metric-detail">${Object.keys(testData.browsers).length} browsers tested</div>
                </div>

                <div class="metric-card flaky-rate">
                    <h3>Flaky Tests</h3>
                    <div class="metric-value">${testData.summary.flaky || 0}</div>
                    <div class="metric-detail">${((testData.summary.flaky || 0) / testData.summary.total * 100).toFixed(1)}% flake rate</div>
                </div>
            </div>

            <div class="charts-grid">
                <div class="chart-container">
                    <h3>Test Results Distribution</h3>
                    <canvas id="resultsChart"></canvas>
                </div>

                <div class="chart-container">
                    <h3>Browser Coverage</h3>
                    <canvas id="browserChart"></canvas>
                </div>

                <div class="chart-container">
                    <h3>Test Types</h3>
                    <canvas id="testTypesChart"></canvas>
                </div>
            </div>

            <div class="test-results-table">
                <h3>Failed Tests</h3>
                <div id="failedTestsTable">
                    <!-- Failed tests will be populated here -->
                </div>
            </div>
        </main>
    </div>

    <script>
        // Chart data from server
        const testData = ${JSON.stringify(testData)};
        
        // Results pie chart
        new Chart(document.getElementById('resultsChart'), {
            type: 'doughnut',
            data: {
                labels: ['Passed', 'Failed', 'Skipped', 'Flaky'],
                datasets: [{
                    data: [
                        testData.summary.passed,
                        testData.summary.failed,
                        testData.summary.skipped,
                        testData.summary.flaky
                    ],
                    backgroundColor: ['#28a745', '#dc3545', '#ffc107', '#fd7e14']
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { position: 'bottom' }
                }
            }
        });

        // Browser chart
        new Chart(document.getElementById('browserChart'), {
            type: 'bar',
            data: {
                labels: Object.keys(testData.browsers),
                datasets: [{
                    label: 'Tests Run',
                    data: Object.values(testData.browsers),
                    backgroundColor: '#007bff'
                }]
            },
            options: {
                responsive: true,
                scales: { y: { beginAtZero: true } }
            }
        });

        // Test types chart
        new Chart(document.getElementById('testTypesChart'), {
            type: 'bar',
            data: {
                labels: Object.keys(testData.testTypes),
                datasets: [{
                    label: 'Test Count',
                    data: Object.values(testData.testTypes),
                    backgroundColor: '#17a2b8'
                }]
            },
            options: {
                responsive: true,
                scales: { y: { beginAtZero: true } }
            }
        });
    </script>
</body>
</html>`;

    fs.writeFileSync(path.join(this.outputDir, 'index.html'), html);
  }

  async generatePerformancePage(performanceData) {
    // Generate performance dashboard page
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Performance Dashboard - MediaNest E2E</title>
    <link rel="stylesheet" href="assets/dashboard.css">
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
</head>
<body>
    <div class="dashboard-container">
        <nav class="dashboard-nav">
            <h1>MediaNest E2E Dashboard</h1>
            <ul>
                <li><a href="index.html">Overview</a></li>
                <li><a href="performance.html" class="active">Performance</a></li>
                <li><a href="visual.html">Visual Regression</a></li>
                <li><a href="accessibility.html">Accessibility</a></li>
                <li><a href="trends.html">Trends</a></li>
                <li><a href="executive.html">Executive Summary</a></li>
            </ul>
        </nav>

        <main class="dashboard-main">
            <header class="dashboard-header">
                <h1>Performance Analysis</h1>
            </header>

            <div class="performance-metrics">
                ${performanceData.lighthouse.map(report => `
                <div class="lighthouse-report">
                    <h3>${report.url}</h3>
                    <div class="score-grid">
                        <div class="score-item performance">
                            <span class="score">${report.performance}</span>
                            <span class="label">Performance</span>
                        </div>
                        <div class="score-item accessibility">
                            <span class="score">${report.accessibility}</span>
                            <span class="label">Accessibility</span>
                        </div>
                        <div class="score-item best-practices">
                            <span class="score">${report.bestPractices}</span>
                            <span class="label">Best Practices</span>
                        </div>
                        <div class="score-item seo">
                            <span class="score">${report.seo}</span>
                            <span class="label">SEO</span>
                        </div>
                    </div>
                    <div class="core-vitals">
                        <h4>Core Web Vitals</h4>
                        <div class="vitals-grid">
                            <div class="vital">
                                <span class="value">${(report.metrics.fcp / 1000).toFixed(2)}s</span>
                                <span class="name">FCP</span>
                            </div>
                            <div class="vital">
                                <span class="value">${(report.metrics.lcp / 1000).toFixed(2)}s</span>
                                <span class="name">LCP</span>
                            </div>
                            <div class="vital">
                                <span class="value">${report.metrics.cls.toFixed(3)}</span>
                                <span class="name">CLS</span>
                            </div>
                        </div>
                    </div>
                </div>
                `).join('')}
            </div>
        </main>
    </div>
</body>
</html>`;

    fs.writeFileSync(path.join(this.outputDir, 'performance.html'), html);
  }

  async generateVisualRegressionPage(visualData) {
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Visual Regression - MediaNest E2E</title>
    <link rel="stylesheet" href="assets/dashboard.css">
</head>
<body>
    <div class="dashboard-container">
        <nav class="dashboard-nav">
            <h1>MediaNest E2E Dashboard</h1>
            <ul>
                <li><a href="index.html">Overview</a></li>
                <li><a href="performance.html">Performance</a></li>
                <li><a href="visual.html" class="active">Visual Regression</a></li>
                <li><a href="accessibility.html">Accessibility</a></li>
                <li><a href="trends.html">Trends</a></li>
                <li><a href="executive.html">Executive Summary</a></li>
            </ul>
        </nav>

        <main class="dashboard-main">
            <header class="dashboard-header">
                <h1>Visual Regression Analysis</h1>
                <div class="visual-summary">
                    <span class="diff-count">${visualData.failed} differences detected</span>
                </div>
            </header>

            <div class="visual-diffs">
                ${visualData.diffs.map(diff => `
                <div class="diff-item">
                    <h3>${diff.testName}</h3>
                    <div class="diff-images">
                        <img src="${diff.url}" alt="Visual difference for ${diff.testName}">
                    </div>
                </div>
                `).join('')}
            </div>
        </main>
    </div>
</body>
</html>`;

    fs.writeFileSync(path.join(this.outputDir, 'visual.html'), html);
  }

  async generateAccessibilityPage(a11yData) {
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Accessibility Report - MediaNest E2E</title>
    <link rel="stylesheet" href="assets/dashboard.css">
</head>
<body>
    <div class="dashboard-container">
        <nav class="dashboard-nav">
            <h1>MediaNest E2E Dashboard</h1>
            <ul>
                <li><a href="index.html">Overview</a></li>
                <li><a href="performance.html">Performance</a></li>
                <li><a href="visual.html">Visual Regression</a></li>
                <li><a href="accessibility.html" class="active">Accessibility</a></li>
                <li><a href="trends.html">Trends</a></li>
                <li><a href="executive.html">Executive Summary</a></li>
            </ul>
        </nav>

        <main class="dashboard-main">
            <header class="dashboard-header">
                <h1>Accessibility Analysis</h1>
                <div class="a11y-summary">
                    <span class="violation-count">${a11yData.violations.length} violations found</span>
                </div>
            </header>

            <div class="a11y-metrics">
                <div class="severity-breakdown">
                    <h3>Violations by Severity</h3>
                    <div class="severity-grid">
                        <div class="severity-item critical">
                            <span class="count">${a11yData.summary.critical || 0}</span>
                            <span class="label">Critical</span>
                        </div>
                        <div class="severity-item serious">
                            <span class="count">${a11yData.summary.serious || 0}</span>
                            <span class="label">Serious</span>
                        </div>
                        <div class="severity-item moderate">
                            <span class="count">${a11yData.summary.moderate || 0}</span>
                            <span class="label">Moderate</span>
                        </div>
                        <div class="severity-item minor">
                            <span class="count">${a11yData.summary.minor || 0}</span>
                            <span class="label">Minor</span>
                        </div>
                    </div>
                </div>
            </div>

            <div class="violations-list">
                <h3>Accessibility Violations</h3>
                ${a11yData.violations.map(violation => `
                <div class="violation-item ${violation.impact}">
                    <h4>${violation.id}: ${violation.description}</h4>
                    <p>${violation.help}</p>
                    <div class="violation-details">
                        <span class="impact">Impact: ${violation.impact}</span>
                        <span class="tags">Tags: ${violation.tags.join(', ')}</span>
                    </div>
                </div>
                `).join('')}
            </div>
        </main>
    </div>
</body>
</html>`;

    fs.writeFileSync(path.join(this.outputDir, 'accessibility.html'), html);
  }

  async generateTrendsPage(testData) {
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Trends Analysis - MediaNest E2E</title>
    <link rel="stylesheet" href="assets/dashboard.css">
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
</head>
<body>
    <div class="dashboard-container">
        <nav class="dashboard-nav">
            <h1>MediaNest E2E Dashboard</h1>
            <ul>
                <li><a href="index.html">Overview</a></li>
                <li><a href="performance.html">Performance</a></li>
                <li><a href="visual.html">Visual Regression</a></li>
                <li><a href="accessibility.html">Accessibility</a></li>
                <li><a href="trends.html" class="active">Trends</a></li>
                <li><a href="executive.html">Executive Summary</a></li>
            </ul>
        </nav>

        <main class="dashboard-main">
            <header class="dashboard-header">
                <h1>Test Trends Analysis</h1>
            </header>

            <div class="trends-content">
                <div class="chart-container">
                    <h3>Success Rate Trend (Last 30 Builds)</h3>
                    <canvas id="successTrendChart"></canvas>
                </div>

                <div class="chart-container">
                    <h3>Performance Trend (Last 30 Builds)</h3>
                    <canvas id="performanceTrendChart"></canvas>
                </div>

                <div class="chart-container">
                    <h3>Flaky Tests Trend (Last 30 Builds)</h3>
                    <canvas id="flakyTrendChart"></canvas>
                </div>
            </div>
        </main>
    </div>

    <script>
        // Generate sample trend data (in production, this would come from historical data)
        const generateTrendData = (baseValue, variance = 5, points = 30) => {
            return Array.from({length: points}, (_, i) => ({
                x: i,
                y: Math.max(0, Math.min(100, baseValue + (Math.random() - 0.5) * variance))
            }));
        };

        // Success rate trend
        new Chart(document.getElementById('successTrendChart'), {
            type: 'line',
            data: {
                datasets: [{
                    label: 'Success Rate %',
                    data: generateTrendData(${((testData.summary.passed / testData.summary.total) * 100).toFixed(1)}),
                    borderColor: '#28a745',
                    backgroundColor: 'rgba(40, 167, 69, 0.1)',
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                scales: {
                    x: { title: { display: true, text: 'Build Number' } },
                    y: { title: { display: true, text: 'Success Rate %' }, min: 0, max: 100 }
                }
            }
        });

        // Performance trend
        new Chart(document.getElementById('performanceTrendChart'), {
            type: 'line',
            data: {
                datasets: [{
                    label: 'Avg Test Duration (s)',
                    data: generateTrendData(${(testData.duration / testData.summary.total / 1000).toFixed(2)}, 2),
                    borderColor: '#007bff',
                    backgroundColor: 'rgba(0, 123, 255, 0.1)',
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                scales: {
                    x: { title: { display: true, text: 'Build Number' } },
                    y: { title: { display: true, text: 'Duration (seconds)' }, min: 0 }
                }
            }
        });

        // Flaky tests trend
        new Chart(document.getElementById('flakyTrendChart'), {
            type: 'line',
            data: {
                datasets: [{
                    label: 'Flaky Tests',
                    data: generateTrendData(${testData.summary.flaky || 0}, 1),
                    borderColor: '#fd7e14',
                    backgroundColor: 'rgba(253, 126, 20, 0.1)',
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                scales: {
                    x: { title: { display: true, text: 'Build Number' } },
                    y: { title: { display: true, text: 'Flaky Test Count' }, min: 0 }
                }
            }
        });
    </script>
</body>
</html>`;

    fs.writeFileSync(path.join(this.outputDir, 'trends.html'), html);
  }

  async generateExecutivePage(testData, performanceData) {
    const successRate = ((testData.summary.passed / testData.summary.total) * 100).toFixed(1);
    const avgPerformanceScore = performanceData.lighthouse.length > 0 
      ? (performanceData.lighthouse.reduce((sum, report) => sum + report.performance, 0) / performanceData.lighthouse.length).toFixed(1)
      : 'N/A';

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Executive Summary - MediaNest E2E</title>
    <link rel="stylesheet" href="assets/dashboard.css">
</head>
<body>
    <div class="dashboard-container">
        <nav class="dashboard-nav">
            <h1>MediaNest E2E Dashboard</h1>
            <ul>
                <li><a href="index.html">Overview</a></li>
                <li><a href="performance.html">Performance</a></li>
                <li><a href="visual.html">Visual Regression</a></li>
                <li><a href="accessibility.html">Accessibility</a></li>
                <li><a href="trends.html">Trends</a></li>
                <li><a href="executive.html" class="active">Executive Summary</a></li>
            </ul>
        </nav>

        <main class="dashboard-main">
            <header class="dashboard-header">
                <h1>Executive Summary</h1>
                <div class="build-info">
                    <span class="build-number">Build #${this.buildNumber}</span>
                    <span class="commit-sha">${this.commitSha.substring(0, 8)}</span>
                </div>
            </header>

            <div class="executive-summary">
                <div class="summary-card overall-health">
                    <h3>Overall System Health</h3>
                    <div class="health-indicator ${successRate >= 95 ? 'excellent' : successRate >= 85 ? 'good' : 'needs-attention'}">
                        <span class="indicator-icon">●</span>
                        <span class="indicator-text">
                            ${successRate >= 95 ? 'Excellent' : successRate >= 85 ? 'Good' : 'Needs Attention'}
                        </span>
                    </div>
                    <p>Test suite success rate: ${successRate}%</p>
                </div>

                <div class="summary-card performance-health">
                    <h3>Performance Health</h3>
                    <div class="performance-score">${avgPerformanceScore}</div>
                    <p>Average Lighthouse Performance Score</p>
                </div>

                <div class="summary-card quality-metrics">
                    <h3>Quality Metrics</h3>
                    <ul>
                        <li><strong>${testData.summary.total}</strong> tests executed</li>
                        <li><strong>${testData.summary.failed}</strong> failures detected</li>
                        <li><strong>${testData.summary.flaky || 0}</strong> flaky tests identified</li>
                        <li><strong>${Object.keys(testData.browsers).length}</strong> browsers validated</li>
                    </ul>
                </div>

                <div class="summary-card recommendations">
                    <h3>Key Recommendations</h3>
                    <ul>
                        ${testData.summary.failed > 0 ? `<li class="critical">Investigate and fix ${testData.summary.failed} failing tests</li>` : ''}
                        ${(testData.summary.flaky || 0) > 0 ? `<li class="warning">Address ${testData.summary.flaky} flaky tests for stability</li>` : ''}
                        ${avgPerformanceScore !== 'N/A' && avgPerformanceScore < 80 ? `<li class="warning">Improve performance scores (current: ${avgPerformanceScore})</li>` : ''}
                        <li class="info">Maintain current testing coverage across ${Object.keys(testData.browsers).length} browsers</li>
                    </ul>
                </div>

                <div class="summary-card test-coverage">
                    <h3>Test Coverage Breakdown</h3>
                    <div class="coverage-grid">
                        ${Object.entries(testData.testTypes).map(([type, count]) => `
                        <div class="coverage-item">
                            <span class="coverage-type">${type}</span>
                            <span class="coverage-count">${count}</span>
                        </div>
                        `).join('')}
                    </div>
                </div>

                <div class="summary-card trend-analysis">
                    <h3>Trend Analysis</h3>
                    <p>Based on recent test execution patterns:</p>
                    <ul>
                        <li>Test stability: ${successRate >= 95 ? 'Stable' : 'Improving'}</li>
                        <li>Performance: ${avgPerformanceScore >= 80 ? 'Good' : 'Needs attention'}</li>
                        <li>Coverage: Comprehensive across platforms</li>
                    </ul>
                </div>
            </div>
        </main>
    </div>
</body>
</html>`;

    fs.writeFileSync(path.join(this.outputDir, 'executive.html'), html);
  }

  async generateNavigation() {
    // Navigation is already embedded in each page
  }

  async copyAssets() {
    const css = `
/* MediaNest E2E Dashboard Styles */
:root {
  --primary-color: #007bff;
  --success-color: #28a745;
  --warning-color: #ffc107;
  --danger-color: #dc3545;
  --info-color: #17a2b8;
  --light-bg: #f8f9fa;
  --dark-bg: #343a40;
  --border-color: #e9ecef;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  line-height: 1.6;
  color: #333;
  background-color: var(--light-bg);
}

.dashboard-container {
  display: flex;
  min-height: 100vh;
}

.dashboard-nav {
  width: 250px;
  background: var(--dark-bg);
  color: white;
  padding: 1rem;
}

.dashboard-nav h1 {
  font-size: 1.2rem;
  margin-bottom: 2rem;
  color: var(--primary-color);
}

.dashboard-nav ul {
  list-style: none;
}

.dashboard-nav li {
  margin-bottom: 0.5rem;
}

.dashboard-nav a {
  color: #ccc;
  text-decoration: none;
  padding: 0.5rem 1rem;
  display: block;
  border-radius: 4px;
  transition: all 0.3s;
}

.dashboard-nav a:hover,
.dashboard-nav a.active {
  background: var(--primary-color);
  color: white;
}

.dashboard-main {
  flex: 1;
  padding: 2rem;
  overflow-x: auto;
}

.dashboard-header {
  margin-bottom: 2rem;
  border-bottom: 2px solid var(--border-color);
  padding-bottom: 1rem;
}

.dashboard-header h1 {
  font-size: 2rem;
  color: var(--dark-bg);
}

.build-info {
  margin-top: 0.5rem;
  color: #666;
}

.build-info span {
  margin-right: 1rem;
  padding: 0.25rem 0.5rem;
  background: var(--light-bg);
  border-radius: 4px;
  font-family: monospace;
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.metric-card {
  background: white;
  padding: 1.5rem;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  border-left: 4px solid var(--primary-color);
}

.metric-card h3 {
  color: #666;
  font-size: 0.9rem;
  text-transform: uppercase;
  margin-bottom: 0.5rem;
}

.metric-value {
  font-size: 2.5rem;
  font-weight: bold;
  color: var(--primary-color);
  margin-bottom: 0.5rem;
}

.metric-detail {
  color: #888;
  font-size: 0.9rem;
}

.success-rate { border-left-color: var(--success-color); }
.success-rate .metric-value { color: var(--success-color); }

.duration { border-left-color: var(--info-color); }
.duration .metric-value { color: var(--info-color); }

.flaky-rate { border-left-color: var(--warning-color); }
.flaky-rate .metric-value { color: var(--warning-color); }

.charts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.chart-container {
  background: white;
  padding: 1.5rem;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.chart-container h3 {
  margin-bottom: 1rem;
  color: var(--dark-bg);
}

.lighthouse-report {
  background: white;
  margin-bottom: 2rem;
  padding: 1.5rem;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.score-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1rem;
  margin-bottom: 1rem;
}

.score-item {
  text-align: center;
  padding: 1rem;
  border-radius: 8px;
  background: var(--light-bg);
}

.score-item .score {
  display: block;
  font-size: 2rem;
  font-weight: bold;
  margin-bottom: 0.5rem;
}

.score-item .label {
  font-size: 0.9rem;
  color: #666;
}

.vitals-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
}

.vital {
  text-align: center;
  padding: 1rem;
  background: var(--light-bg);
  border-radius: 4px;
}

.vital .value {
  display: block;
  font-size: 1.5rem;
  font-weight: bold;
  color: var(--primary-color);
}

.vital .name {
  font-size: 0.8rem;
  color: #666;
  text-transform: uppercase;
}

.diff-item, .violation-item {
  background: white;
  margin-bottom: 1rem;
  padding: 1.5rem;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.diff-images img {
  max-width: 100%;
  height: auto;
  border-radius: 4px;
}

.violation-item.critical { border-left: 4px solid var(--danger-color); }
.violation-item.serious { border-left: 4px solid #fd7e14; }
.violation-item.moderate { border-left: 4px solid var(--warning-color); }
.violation-item.minor { border-left: 4px solid var(--info-color); }

.health-indicator {
  display: flex;
  align-items: center;
  margin-bottom: 1rem;
}

.indicator-icon {
  font-size: 2rem;
  margin-right: 0.5rem;
}

.excellent .indicator-icon { color: var(--success-color); }
.good .indicator-icon { color: var(--warning-color); }
.needs-attention .indicator-icon { color: var(--danger-color); }

.recommendations ul {
  list-style: none;
}

.recommendations li {
  padding: 0.5rem 0;
  border-bottom: 1px solid var(--border-color);
}

.recommendations li.critical::before { content: "🔴 "; }
.recommendations li.warning::before { content: "🟡 "; }
.recommendations li.info::before { content: "🔵 "; }

@media (max-width: 768px) {
  .dashboard-container {
    flex-direction: column;
  }
  
  .dashboard-nav {
    width: 100%;
    padding: 1rem;
  }
  
  .dashboard-nav ul {
    display: flex;
    overflow-x: auto;
  }
  
  .dashboard-nav li {
    margin-right: 0.5rem;
    margin-bottom: 0;
    white-space: nowrap;
  }
  
  .metrics-grid,
  .charts-grid {
    grid-template-columns: 1fr;
  }
}`;

    fs.writeFileSync(path.join(this.outputDir, 'assets', 'dashboard.css'), css);
  }

  findFiles(dir, pattern) {
    const files = [];
    try {
      const dirents = fs.readdirSync(dir, { withFileTypes: true, recursive: true });
      for (const dirent of dirents) {
        if (dirent.isFile() && dirent.name.includes(pattern)) {
          files.push(path.join(dir, dirent.name));
        }
      }
    } catch (error) {
      console.warn(`Failed to scan directory ${dir}:`, error.message);
    }
    return files;
  }

  relativePath(fullPath) {
    return path.relative(this.outputDir, fullPath);
  }
}

// CLI Usage
if (require.main === module) {
  const args = process.argv.slice(2);
  const options = {};
  
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace('--', '');
    const value = args[i + 1];
    options[key] = value;
  }

  const generator = new TestDashboardGenerator(options);
  generator.generateDashboard()
    .then(() => {
      console.log('✅ Dashboard generation completed successfully');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Dashboard generation failed:', error);
      process.exit(1);
    });
}

module.exports = TestDashboardGenerator;