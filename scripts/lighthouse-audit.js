#!/usr/bin/env node

/**
 * Lighthouse Performance Audit Script
 * Automated performance, accessibility, and best practices auditing
 */

const lighthouse = require('lighthouse');
const chromeLauncher = require('chrome-launcher');
const fs = require('fs').promises;
const path = require('path');

class LighthouseAuditor {
  constructor() {
    this.chrome = null;
    this.results = [];
    
    this.config = {
      extends: 'lighthouse:default',
      settings: {
        onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
        formFactor: 'desktop',
        throttling: {
          rttMs: 40,
          throughputKbs: 10240,
          cpuSlowdownMultiplier: 1,
          requestLatencyMs: 0,
          downloadThroughputKbs: 0,
          uploadThroughputKbs: 0
        },
        screenEmulation: {
          mobile: false,
          width: 1350,
          height: 940,
          deviceScaleFactor: 1,
          disabled: false,
        }
      }
    };
    
    this.thresholds = {
      performance: 90,
      accessibility: 95,
      bestPractices: 90,
      seo: 90
    };
    
    this.testUrls = [
      { url: 'http://localhost:3000', name: 'Homepage' },
      { url: 'http://localhost:3000/storybook', name: 'Storybook' },
      // Add more URLs as needed
    ];
  }

  async run() {
    console.log('🚨 Starting Lighthouse Performance Audit...\n');
    
    try {
      // Launch Chrome
      await this.launchChrome();
      
      // Run audits for all URLs
      for (const testUrl of this.testUrls) {
        console.log(`🔍 Auditing: ${testUrl.name} (${testUrl.url})`);
        
        const result = await this.auditUrl(testUrl.url, testUrl.name);
        this.results.push(result);
        
        console.log(`✅ Completed audit for ${testUrl.name}`);
      }
      
      // Generate reports
      await this.generateReports();
      
      // Evaluate results
      const passed = this.evaluateResults();
      
      console.log(`\n🏁 Lighthouse Audit ${passed ? 'PASSED' : 'FAILED'}`);
      
      process.exit(passed ? 0 : 1);
      
    } catch (error) {
      console.error('❌ Lighthouse audit failed:', error.message);
      process.exit(1);
    } finally {
      await this.cleanup();
    }
  }

  async launchChrome() {
    console.log('🚀 Launching Chrome...');
    
    this.chrome = await chromeLauncher.launch({
      chromeFlags: [
        '--headless',
        '--disable-gpu',
        '--no-sandbox',
        '--disable-dev-shm-usage',
        '--disable-extensions'
      ]
    });
    
    console.log(`✅ Chrome launched on port ${this.chrome.port}`);
  }

  async auditUrl(url, name) {
    const options = {
      logLevel: 'info',
      output: 'json',
      onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
      port: this.chrome.port,
    };
    
    const runnerResult = await lighthouse(url, options, this.config);
    
    // Extract key metrics
    const { lhr } = runnerResult;
    const scores = {
      performance: Math.round(lhr.categories.performance.score * 100),
      accessibility: Math.round(lhr.categories.accessibility.score * 100),
      bestPractices: Math.round(lhr.categories['best-practices'].score * 100),
      seo: Math.round(lhr.categories.seo.score * 100)
    };
    
    // Extract performance metrics
    const metrics = {
      firstContentfulPaint: lhr.audits['first-contentful-paint'].numericValue,
      largestContentfulPaint: lhr.audits['largest-contentful-paint'].numericValue,
      firstInputDelay: lhr.audits['max-potential-fid']?.numericValue || 0,
      cumulativeLayoutShift: lhr.audits['cumulative-layout-shift'].numericValue,
      speedIndex: lhr.audits['speed-index'].numericValue,
      totalBlockingTime: lhr.audits['total-blocking-time'].numericValue
    };
    
    // Extract accessibility issues
    const accessibilityIssues = this.extractAccessibilityIssues(lhr);
    
    // Extract performance opportunities
    const opportunities = this.extractPerformanceOpportunities(lhr);
    
    return {
      name,
      url,
      timestamp: new Date().toISOString(),
      scores,
      metrics,
      accessibilityIssues,
      opportunities,
      rawData: lhr
    };
  }

  extractAccessibilityIssues(lhr) {
    const issues = [];
    
    Object.values(lhr.audits).forEach(audit => {
      if (audit.scoreDisplayMode === 'binary' && 
          audit.score === 0 && 
          audit.details?.items?.length > 0) {
        
        issues.push({
          id: audit.id,
          title: audit.title,
          description: audit.description,
          impact: this.getImpactLevel(audit.id),
          items: audit.details.items.length,
          details: audit.details.items.slice(0, 5) // First 5 items
        });
      }
    });
    
    return issues;
  }

  extractPerformanceOpportunities(lhr) {
    const opportunities = [];
    
    Object.values(lhr.audits).forEach(audit => {
      if (audit.details?.type === 'opportunity' && 
          audit.details.overallSavingsMs > 100) {
        
        opportunities.push({
          id: audit.id,
          title: audit.title,
          description: audit.description,
          savingsMs: audit.details.overallSavingsMs,
          savingsBytes: audit.details.overallSavingsBytes || 0,
          items: audit.details.items?.length || 0
        });
      }
    });
    
    // Sort by potential savings
    return opportunities.sort((a, b) => b.savingsMs - a.savingsMs);
  }

  getImpactLevel(auditId) {
    const highImpact = [
      'color-contrast',
      'keyboard',
      'focus-traps',
      'focusable-controls',
      'interactive-element-affordance',
      'logical-tab-order'
    ];
    
    const mediumImpact = [
      'image-alt',
      'label',
      'link-name',
      'button-name'
    ];
    
    if (highImpact.includes(auditId)) return 'high';
    if (mediumImpact.includes(auditId)) return 'medium';
    return 'low';
  }

  async generateReports() {
    console.log('\n📋 Generating Lighthouse reports...');
    
    // Ensure reports directory exists
    const reportsDir = path.join(process.cwd(), 'lighthouse-reports');
    await fs.mkdir(reportsDir, { recursive: true });
    
    // Generate JSON report
    const jsonReport = {
      timestamp: new Date().toISOString(),
      summary: this.generateSummary(),
      results: this.results,
      thresholds: this.thresholds
    };
    
    const jsonPath = path.join(reportsDir, 'lighthouse-report.json');
    await fs.writeFile(jsonPath, JSON.stringify(jsonReport, null, 2));
    
    // Generate HTML report
    await this.generateHTMLReport(jsonReport, reportsDir);
    
    // Generate individual HTML reports
    for (const result of this.results) {
      const htmlPath = path.join(reportsDir, `${result.name.toLowerCase().replace(/\s+/g, '-')}-lighthouse.html`);
      const html = this.generateLighthouseHTML(result.rawData);
      await fs.writeFile(htmlPath, html);
    }
    
    console.log(`📄 Reports saved to: ${reportsDir}`);
  }

  generateSummary() {
    const summary = {
      totalAudits: this.results.length,
      passed: 0,
      failed: 0,
      averageScores: {
        performance: 0,
        accessibility: 0,
        bestPractices: 0,
        seo: 0
      },
      totalIssues: 0,
      criticalIssues: 0
    };
    
    this.results.forEach(result => {
      const passed = this.isResultPassing(result);
      if (passed) {
        summary.passed++;
      } else {
        summary.failed++;
      }
      
      // Calculate averages
      Object.keys(summary.averageScores).forEach(key => {
        summary.averageScores[key] += result.scores[key];
      });
      
      // Count issues
      summary.totalIssues += result.accessibilityIssues.length;
      summary.criticalIssues += result.accessibilityIssues.filter(
        issue => issue.impact === 'high'
      ).length;
    });
    
    // Finalize averages
    Object.keys(summary.averageScores).forEach(key => {
      summary.averageScores[key] = Math.round(
        summary.averageScores[key] / this.results.length
      );
    });
    
    return summary;
  }

  async generateHTMLReport(report, reportsDir) {
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Lighthouse Audit Report</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; border-radius: 8px; padding: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 30px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 20px 0; }
        .summary-card { background: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; }
        .score { font-size: 48px; font-weight: bold; margin: 10px 0; }
        .score.good { color: #0cce6b; }
        .score.average { color: #ffa400; }
        .score.poor { color: #ff4e42; }
        .results { margin: 30px 0; }
        .result-card { border: 1px solid #ddd; border-radius: 8px; margin: 20px 0; overflow: hidden; }
        .result-header { background: #f8f9fa; padding: 15px; border-bottom: 1px solid #ddd; }
        .result-content { padding: 20px; }
        .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px; }
        .metric { display: flex; justify-content: space-between; align-items: center; padding: 10px; background: #f8f9fa; border-radius: 4px; }
        .issues { margin-top: 20px; }
        .issue { background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 4px; padding: 10px; margin: 10px 0; }
        .issue.high { background: #f8d7da; border-color: #f5c6cb; }
        .opportunities { margin-top: 20px; }
        .opportunity { background: #d1ecf1; border: 1px solid #bee5eb; border-radius: 4px; padding: 10px; margin: 10px 0; }
        .timestamp { color: #666; font-size: 14px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚨 Lighthouse Audit Report</h1>
            <div class="timestamp">Generated: ${new Date(report.timestamp).toLocaleString()}</div>
        </div>
        
        <div class="summary">
            <div class="summary-card">
                <h3>Performance</h3>
                <div class="score ${this.getScoreClass(report.summary.averageScores.performance)}">
                    ${report.summary.averageScores.performance}
                </div>
            </div>
            <div class="summary-card">
                <h3>Accessibility</h3>
                <div class="score ${this.getScoreClass(report.summary.averageScores.accessibility)}">
                    ${report.summary.averageScores.accessibility}
                </div>
            </div>
            <div class="summary-card">
                <h3>Best Practices</h3>
                <div class="score ${this.getScoreClass(report.summary.averageScores.bestPractices)}">
                    ${report.summary.averageScores.bestPractices}
                </div>
            </div>
            <div class="summary-card">
                <h3>SEO</h3>
                <div class="score ${this.getScoreClass(report.summary.averageScores.seo)}">
                    ${report.summary.averageScores.seo}
                </div>
            </div>
        </div>
        
        <div class="results">
            ${report.results.map(result => `
                <div class="result-card">
                    <div class="result-header">
                        <h2>${result.name}</h2>
                        <p>${result.url}</p>
                    </div>
                    <div class="result-content">
                        <h3>Scores</h3>
                        <div class="metrics">
                            <div class="metric">
                                <span>Performance:</span>
                                <span class="score ${this.getScoreClass(result.scores.performance)}" style="font-size: 24px;">
                                    ${result.scores.performance}
                                </span>
                            </div>
                            <div class="metric">
                                <span>Accessibility:</span>
                                <span class="score ${this.getScoreClass(result.scores.accessibility)}" style="font-size: 24px;">
                                    ${result.scores.accessibility}
                                </span>
                            </div>
                            <div class="metric">
                                <span>Best Practices:</span>
                                <span class="score ${this.getScoreClass(result.scores.bestPractices)}" style="font-size: 24px;">
                                    ${result.scores.bestPractices}
                                </span>
                            </div>
                            <div class="metric">
                                <span>SEO:</span>
                                <span class="score ${this.getScoreClass(result.scores.seo)}" style="font-size: 24px;">
                                    ${result.scores.seo}
                                </span>
                            </div>
                        </div>
                        
                        <h3>Core Web Vitals</h3>
                        <div class="metrics">
                            <div class="metric">
                                <span>First Contentful Paint:</span>
                                <span>${Math.round(result.metrics.firstContentfulPaint)}ms</span>
                            </div>
                            <div class="metric">
                                <span>Largest Contentful Paint:</span>
                                <span>${Math.round(result.metrics.largestContentfulPaint)}ms</span>
                            </div>
                            <div class="metric">
                                <span>Cumulative Layout Shift:</span>
                                <span>${result.metrics.cumulativeLayoutShift.toFixed(3)}</span>
                            </div>
                            <div class="metric">
                                <span>Total Blocking Time:</span>
                                <span>${Math.round(result.metrics.totalBlockingTime)}ms</span>
                            </div>
                        </div>
                        
                        ${result.accessibilityIssues.length > 0 ? `
                        <div class="issues">
                            <h3>Accessibility Issues (${result.accessibilityIssues.length})</h3>
                            ${result.accessibilityIssues.map(issue => `
                                <div class="issue ${issue.impact}">
                                    <strong>${issue.title}</strong> (${issue.impact} impact)
                                    <p>${issue.description}</p>
                                    <small>${issue.items} affected elements</small>
                                </div>
                            `).join('')}
                        </div>
                        ` : ''}
                        
                        ${result.opportunities.length > 0 ? `
                        <div class="opportunities">
                            <h3>Performance Opportunities</h3>
                            ${result.opportunities.slice(0, 5).map(opp => `
                                <div class="opportunity">
                                    <strong>${opp.title}</strong>
                                    <p>${opp.description}</p>
                                    <small>Potential savings: ${Math.round(opp.savingsMs)}ms</small>
                                </div>
                            `).join('')}
                        </div>
                        ` : ''}
                    </div>
                </div>
            `).join('')}
        </div>
    </div>
</body>
</html>`;
    
    const htmlPath = path.join(reportsDir, 'lighthouse-summary.html');
    await fs.writeFile(htmlPath, html);
  }

  generateLighthouseHTML(lhr) {
    // This would generate the full Lighthouse HTML report
    // For now, return a simplified version
    return `
<!DOCTYPE html>
<html>
<head>
    <title>Lighthouse Report</title>
</head>
<body>
    <h1>Lighthouse Report</h1>
    <p>Full report data available in JSON format.</p>
    <pre>${JSON.stringify(lhr, null, 2)}</pre>
</body>
</html>`;
  }

  getScoreClass(score) {
    if (score >= 90) return 'good';
    if (score >= 50) return 'average';
    return 'poor';
  }

  isResultPassing(result) {
    return (
      result.scores.performance >= this.thresholds.performance &&
      result.scores.accessibility >= this.thresholds.accessibility &&
      result.scores.bestPractices >= this.thresholds.bestPractices &&
      result.scores.seo >= this.thresholds.seo
    );
  }

  evaluateResults() {
    const summary = this.generateSummary();
    
    console.log('\n📊 Lighthouse Audit Summary:');
    console.log(`Total Audits: ${summary.totalAudits}`);
    console.log(`Passed: ${summary.passed}`);
    console.log(`Failed: ${summary.failed}`);
    console.log(`Critical Issues: ${summary.criticalIssues}`);
    
    console.log('\n📈 Average Scores:');
    console.log(`Performance: ${summary.averageScores.performance}`);
    console.log(`Accessibility: ${summary.averageScores.accessibility}`);
    console.log(`Best Practices: ${summary.averageScores.bestPractices}`);
    console.log(`SEO: ${summary.averageScores.seo}`);
    
    const passed = summary.failed === 0 && summary.criticalIssues === 0;
    
    return passed;
  }

  async cleanup() {
    if (this.chrome) {
      console.log('🧹 Cleaning up Chrome...');
      await this.chrome.kill();
    }
  }
}

// Run if called directly
if (require.main === module) {
  const auditor = new LighthouseAuditor();
  auditor.run().catch(error => {
    console.error('Lighthouse audit execution failed:', error);
    process.exit(1);
  });
}

module.exports = LighthouseAuditor;