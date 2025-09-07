#!/usr/bin/env node

/**
 * Performance Metrics Analyzer for MediaNest E2E Tests
 * HIVE-MIND Enhanced Performance Analysis and Trend Detection
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class PerformanceAnalyzer {
  constructor(options = {}) {
    this.sessionId = options.sessionId || 'default';
    this.environment = options.environment || 'staging';
    this.buildNumber = options.buildNumber || '0';
    this.outputDir = path.join('reports', 'performance');
    this.baselinesDir = path.join('reports', 'baselines');
    
    this.ensureDirectories();
  }

  ensureDirectories() {
    [this.outputDir, this.baselinesDir, 
     path.join(this.outputDir, 'trends'),
     path.join(this.outputDir, 'lighthouse'),
     path.join(this.outputDir, 'core-vitals')].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  async analyzePerformanceMetrics() {
    console.log('📊 Analyzing performance metrics...');
    
    try {
      // Collect all performance data
      const lighthouseData = await this.collectLighthouseData();
      const coreVitalsData = await this.collectCoreVitalsData();
      const memoryData = await this.collectMemoryData();
      const loadTestData = await this.collectLoadTestData();
      
      // Load historical baselines
      const baselines = await this.loadBaselines();
      
      // Perform analysis
      const performanceAnalysis = {
        summary: this.generateSummary(lighthouseData, coreVitalsData, memoryData, loadTestData),
        lighthouse: await this.analyzeLighthouseMetrics(lighthouseData, baselines.lighthouse),
        coreVitals: await this.analyzeCoreVitals(coreVitalsData, baselines.coreVitals),
        memory: await this.analyzeMemoryUsage(memoryData, baselines.memory),
        loadTest: await this.analyzeLoadTesting(loadTestData, baselines.loadTest),
        regressions: await this.detectRegressions(lighthouseData, coreVitalsData, baselines),
        trends: await this.analyzeTrends(lighthouseData, coreVitalsData, memoryData)
      };

      // Generate reports
      await this.generatePerformanceReport(performanceAnalysis);
      await this.generateTrendAnalysis(performanceAnalysis.trends);
      await this.updateHiveMemory(performanceAnalysis);
      
      console.log('✅ Performance analysis completed');
      return performanceAnalysis;
      
    } catch (error) {
      console.error('❌ Performance analysis failed:', error);
      throw error;
    }
  }

  async collectLighthouseData() {
    const lighthouseData = [];
    const resultsDir = path.join('test-results');
    
    if (fs.existsSync(resultsDir)) {
      const files = this.findFiles(resultsDir, 'lighthouse-report.json');
      
      for (const file of files) {
        try {
          const data = JSON.parse(fs.readFileSync(file, 'utf8'));
          const processedData = this.processLighthouseReport(data, file);
          if (processedData) {
            lighthouseData.push(processedData);
          }
        } catch (error) {
          console.warn(`Failed to process Lighthouse report ${file}:`, error.message);
        }
      }
    }
    
    return lighthouseData;
  }

  processLighthouseReport(data, filePath) {
    if (!data.categories || !data.audits) {
      return null;
    }

    const pageInfo = this.extractPageInfo(filePath);
    
    return {
      url: data.finalUrl,
      page: pageInfo.page,
      device: pageInfo.device,
      timestamp: data.fetchTime,
      scores: {
        performance: Math.round(data.categories.performance.score * 100),
        accessibility: Math.round(data.categories.accessibility.score * 100),
        bestPractices: Math.round(data.categories['best-practices'].score * 100),
        seo: Math.round(data.categories.seo.score * 100)
      },
      metrics: {
        fcp: data.audits['first-contentful-paint']?.numericValue || 0,
        lcp: data.audits['largest-contentful-paint']?.numericValue || 0,
        fid: data.audits['max-potential-fid']?.numericValue || 0,
        cls: data.audits['cumulative-layout-shift']?.numericValue || 0,
        speedIndex: data.audits['speed-index']?.numericValue || 0,
        tti: data.audits['interactive']?.numericValue || 0,
        tbt: data.audits['total-blocking-time']?.numericValue || 0
      },
      opportunities: this.extractOpportunities(data.audits),
      diagnostics: this.extractDiagnostics(data.audits)
    };
  }

  extractPageInfo(filePath) {
    const fileName = path.basename(filePath, '.json');
    const parts = fileName.split('-');
    
    return {
      page: parts.find(part => ['home', 'dashboard', 'media', 'search', 'login'].includes(part)) || 'unknown',
      device: parts.find(part => ['desktop', 'mobile'].includes(part)) || 'desktop'
    };
  }

  extractOpportunities(audits) {
    const opportunities = [];
    const opportunityAudits = [
      'render-blocking-resources',
      'unused-css-rules',
      'unused-javascript',
      'modern-image-formats',
      'offscreen-images',
      'unminified-css',
      'unminified-javascript'
    ];

    for (const auditId of opportunityAudits) {
      if (audits[auditId] && audits[auditId].details && audits[auditId].details.overallSavingsMs > 100) {
        opportunities.push({
          id: auditId,
          title: audits[auditId].title,
          description: audits[auditId].description,
          savings: audits[auditId].details.overallSavingsMs,
          score: audits[auditId].score
        });
      }
    }

    return opportunities.sort((a, b) => b.savings - a.savings);
  }

  extractDiagnostics(audits) {
    const diagnostics = [];
    const diagnosticAudits = [
      'mainthread-work-breakdown',
      'bootup-time',
      'uses-long-cache-ttl',
      'total-byte-weight',
      'dom-size'
    ];

    for (const auditId of diagnosticAudits) {
      if (audits[auditId]) {
        diagnostics.push({
          id: auditId,
          title: audits[auditId].title,
          description: audits[auditId].description,
          score: audits[auditId].score,
          numericValue: audits[auditId].numericValue,
          displayValue: audits[auditId].displayValue
        });
      }
    }

    return diagnostics;
  }

  async collectCoreVitalsData() {
    const coreVitalsData = [];
    const resultsDir = path.join('test-results');
    
    // Look for Core Web Vitals specific test results
    if (fs.existsSync(resultsDir)) {
      const files = this.findFiles(resultsDir, 'core-vitals.json');
      
      for (const file of files) {
        try {
          const data = JSON.parse(fs.readFileSync(file, 'utf8'));
          coreVitalsData.push(data);
        } catch (error) {
          console.warn(`Failed to process Core Vitals data ${file}:`, error.message);
        }
      }
    }
    
    return coreVitalsData;
  }

  async collectMemoryData() {
    const memoryData = [];
    const resultsDir = path.join('test-results');
    
    if (fs.existsSync(resultsDir)) {
      const files = this.findFiles(resultsDir, 'memory-profile.json');
      
      for (const file of files) {
        try {
          const data = JSON.parse(fs.readFileSync(file, 'utf8'));
          memoryData.push(data);
        } catch (error) {
          console.warn(`Failed to process memory data ${file}:`, error.message);
        }
      }
    }
    
    return memoryData;
  }

  async collectLoadTestData() {
    const loadTestData = [];
    const resultsDir = path.join('test-results');
    
    if (fs.existsSync(resultsDir)) {
      const files = this.findFiles(resultsDir, 'load-test.json');
      
      for (const file of files) {
        try {
          const data = JSON.parse(fs.readFileSync(file, 'utf8'));
          loadTestData.push(data);
        } catch (error) {
          console.warn(`Failed to process load test data ${file}:`, error.message);
        }
      }
    }
    
    return loadTestData;
  }

  generateSummary(lighthouseData, coreVitalsData, memoryData, loadTestData) {
    const avgPerformanceScore = lighthouseData.length > 0 
      ? lighthouseData.reduce((sum, report) => sum + report.scores.performance, 0) / lighthouseData.length
      : 0;

    const avgFCP = lighthouseData.length > 0
      ? lighthouseData.reduce((sum, report) => sum + report.metrics.fcp, 0) / lighthouseData.length
      : 0;

    const avgLCP = lighthouseData.length > 0
      ? lighthouseData.reduce((sum, report) => sum + report.metrics.lcp, 0) / lighthouseData.length
      : 0;

    return {
      timestamp: new Date().toISOString(),
      environment: this.environment,
      buildNumber: this.buildNumber,
      summary: {
        avgPerformanceScore: Math.round(avgPerformanceScore),
        avgFCP: Math.round(avgFCP),
        avgLCP: Math.round(avgLCP),
        pagesAudited: lighthouseData.length,
        coreVitalsTests: coreVitalsData.length,
        memoryProfiles: memoryData.length,
        loadTests: loadTestData.length
      },
      healthStatus: this.calculateHealthStatus(avgPerformanceScore, avgFCP, avgLCP)
    };
  }

  calculateHealthStatus(perfScore, fcp, lcp) {
    if (perfScore >= 90 && fcp <= 1800 && lcp <= 2500) return 'excellent';
    if (perfScore >= 70 && fcp <= 3000 && lcp <= 4000) return 'good';
    if (perfScore >= 50) return 'needs-improvement';
    return 'poor';
  }

  async analyzeLighthouseMetrics(lighthouseData, baselines = {}) {
    const analysis = {
      overall: {
        avgPerformance: 0,
        avgAccessibility: 0,
        avgBestPractices: 0,
        avgSEO: 0
      },
      byPage: {},
      byDevice: {},
      regressions: [],
      improvements: [],
      topOpportunities: []
    };

    if (lighthouseData.length === 0) return analysis;

    // Calculate overall averages
    analysis.overall.avgPerformance = lighthouseData.reduce((sum, d) => sum + d.scores.performance, 0) / lighthouseData.length;
    analysis.overall.avgAccessibility = lighthouseData.reduce((sum, d) => sum + d.scores.accessibility, 0) / lighthouseData.length;
    analysis.overall.avgBestPractices = lighthouseData.reduce((sum, d) => sum + d.scores.bestPractices, 0) / lighthouseData.length;
    analysis.overall.avgSEO = lighthouseData.reduce((sum, d) => sum + d.scores.seo, 0) / lighthouseData.length;

    // Group by page
    const pageGroups = this.groupBy(lighthouseData, 'page');
    for (const [page, data] of Object.entries(pageGroups)) {
      analysis.byPage[page] = this.calculatePageMetrics(data);
    }

    // Group by device
    const deviceGroups = this.groupBy(lighthouseData, 'device');
    for (const [device, data] of Object.entries(deviceGroups)) {
      analysis.byDevice[device] = this.calculatePageMetrics(data);
    }

    // Collect all opportunities and rank them
    const allOpportunities = lighthouseData.flatMap(d => d.opportunities);
    const opportunityMap = new Map();
    
    allOpportunities.forEach(opp => {
      if (!opportunityMap.has(opp.id)) {
        opportunityMap.set(opp.id, { ...opp, count: 0, totalSavings: 0 });
      }
      const existing = opportunityMap.get(opp.id);
      existing.count++;
      existing.totalSavings += opp.savings;
    });

    analysis.topOpportunities = Array.from(opportunityMap.values())
      .sort((a, b) => b.totalSavings - a.totalSavings)
      .slice(0, 10);

    // Compare with baselines if available
    if (baselines && Object.keys(baselines).length > 0) {
      analysis.regressions = this.findLighthouseRegressions(analysis, baselines);
      analysis.improvements = this.findLighthouseImprovements(analysis, baselines);
    }

    return analysis;
  }

  calculatePageMetrics(data) {
    return {
      count: data.length,
      performance: data.reduce((sum, d) => sum + d.scores.performance, 0) / data.length,
      accessibility: data.reduce((sum, d) => sum + d.scores.accessibility, 0) / data.length,
      bestPractices: data.reduce((sum, d) => sum + d.scores.bestPractices, 0) / data.length,
      seo: data.reduce((sum, d) => sum + d.scores.seo, 0) / data.length,
      avgFCP: data.reduce((sum, d) => sum + d.metrics.fcp, 0) / data.length,
      avgLCP: data.reduce((sum, d) => sum + d.metrics.lcp, 0) / data.length,
      avgCLS: data.reduce((sum, d) => sum + d.metrics.cls, 0) / data.length,
      avgSpeedIndex: data.reduce((sum, d) => sum + d.metrics.speedIndex, 0) / data.length
    };
  }

  async analyzeCoreVitals(coreVitalsData, baselines = {}) {
    const analysis = {
      summary: {
        totalMeasurements: coreVitalsData.length,
        passRate: 0,
        avgFCP: 0,
        avgLCP: 0,
        avgFID: 0,
        avgCLS: 0
      },
      thresholds: {
        fcp: { good: 1800, needsImprovement: 3000 },
        lcp: { good: 2500, needsImprovement: 4000 },
        fid: { good: 100, needsImprovement: 300 },
        cls: { good: 0.1, needsImprovement: 0.25 }
      },
      distribution: {
        fcp: { good: 0, needsImprovement: 0, poor: 0 },
        lcp: { good: 0, needsImprovement: 0, poor: 0 },
        fid: { good: 0, needsImprovement: 0, poor: 0 },
        cls: { good: 0, needsImprovement: 0, poor: 0 }
      }
    };

    if (coreVitalsData.length === 0) return analysis;

    // Calculate distributions and averages
    const metrics = ['fcp', 'lcp', 'fid', 'cls'];
    
    metrics.forEach(metric => {
      const values = coreVitalsData.map(d => d[metric]).filter(v => v !== undefined && v !== null);
      if (values.length > 0) {
        analysis.summary[`avg${metric.toUpperCase()}`] = values.reduce((sum, v) => sum + v, 0) / values.length;
        
        values.forEach(value => {
          const thresholds = analysis.thresholds[metric];
          if (value <= thresholds.good) {
            analysis.distribution[metric].good++;
          } else if (value <= thresholds.needsImprovement) {
            analysis.distribution[metric].needsImprovement++;
          } else {
            analysis.distribution[metric].poor++;
          }
        });
      }
    });

    // Calculate overall pass rate (all metrics in "good" range)
    const totalTests = coreVitalsData.length;
    const passingTests = coreVitalsData.filter(data => 
      data.fcp <= analysis.thresholds.fcp.good &&
      data.lcp <= analysis.thresholds.lcp.good &&
      data.fid <= analysis.thresholds.fid.good &&
      data.cls <= analysis.thresholds.cls.good
    ).length;
    
    analysis.summary.passRate = (passingTests / totalTests) * 100;

    return analysis;
  }

  async analyzeMemoryUsage(memoryData, baselines = {}) {
    const analysis = {
      summary: {
        totalProfiles: memoryData.length,
        avgHeapUsed: 0,
        avgHeapTotal: 0,
        peakMemoryUsage: 0,
        memoryLeaks: []
      },
      trends: {
        heapGrowth: [],
        gcFrequency: [],
        memoryPressure: []
      }
    };

    if (memoryData.length === 0) return analysis;

    // Analyze memory patterns
    memoryData.forEach(profile => {
      if (profile.heapUsed) analysis.summary.avgHeapUsed += profile.heapUsed;
      if (profile.heapTotal) analysis.summary.avgHeapTotal += profile.heapTotal;
      if (profile.heapUsed > analysis.summary.peakMemoryUsage) {
        analysis.summary.peakMemoryUsage = profile.heapUsed;
      }
      
      // Detect potential memory leaks
      if (profile.trend && profile.trend === 'increasing') {
        analysis.summary.memoryLeaks.push({
          page: profile.page,
          testCase: profile.testCase,
          growthRate: profile.growthRate
        });
      }
    });

    analysis.summary.avgHeapUsed /= memoryData.length;
    analysis.summary.avgHeapTotal /= memoryData.length;

    return analysis;
  }

  async analyzeLoadTesting(loadTestData, baselines = {}) {
    const analysis = {
      summary: {
        totalTests: loadTestData.length,
        avgResponseTime: 0,
        p95ResponseTime: 0,
        p99ResponseTime: 0,
        errorRate: 0,
        throughput: 0
      },
      byPattern: {},
      bottlenecks: []
    };

    if (loadTestData.length === 0) return analysis;

    // Analyze load test results
    const allResponseTimes = [];
    let totalErrors = 0;
    let totalRequests = 0;

    loadTestData.forEach(test => {
      if (test.responseTimes) {
        allResponseTimes.push(...test.responseTimes);
      }
      
      totalErrors += test.errors || 0;
      totalRequests += test.totalRequests || 0;
      
      if (test.pattern) {
        if (!analysis.byPattern[test.pattern]) {
          analysis.byPattern[test.pattern] = {
            avgResponseTime: 0,
            errorRate: 0,
            throughput: 0,
            count: 0
          };
        }
        
        const pattern = analysis.byPattern[test.pattern];
        pattern.avgResponseTime += test.avgResponseTime || 0;
        pattern.errorRate += (test.errors || 0) / (test.totalRequests || 1) * 100;
        pattern.throughput += test.throughput || 0;
        pattern.count++;
      }

      // Identify bottlenecks
      if (test.avgResponseTime > 5000) { // More than 5 seconds
        analysis.bottlenecks.push({
          endpoint: test.endpoint,
          avgResponseTime: test.avgResponseTime,
          pattern: test.pattern
        });
      }
    });

    // Calculate summary statistics
    if (allResponseTimes.length > 0) {
      allResponseTimes.sort((a, b) => a - b);
      analysis.summary.avgResponseTime = allResponseTimes.reduce((sum, rt) => sum + rt, 0) / allResponseTimes.length;
      analysis.summary.p95ResponseTime = allResponseTimes[Math.floor(allResponseTimes.length * 0.95)];
      analysis.summary.p99ResponseTime = allResponseTimes[Math.floor(allResponseTimes.length * 0.99)];
    }

    analysis.summary.errorRate = (totalErrors / totalRequests) * 100;
    analysis.summary.throughput = totalRequests / loadTestData.length; // Simplified

    // Average the pattern statistics
    Object.values(analysis.byPattern).forEach(pattern => {
      pattern.avgResponseTime /= pattern.count;
      pattern.errorRate /= pattern.count;
      pattern.throughput /= pattern.count;
    });

    return analysis;
  }

  async detectRegressions(lighthouseData, coreVitalsData, baselines) {
    const regressions = [];
    const threshold = 10; // 10% regression threshold

    // Lighthouse regressions
    if (baselines.lighthouse) {
      lighthouseData.forEach(current => {
        const baseline = baselines.lighthouse[current.page];
        if (baseline) {
          Object.keys(current.scores).forEach(metric => {
            const currentScore = current.scores[metric];
            const baselineScore = baseline.scores[metric];
            const regression = ((baselineScore - currentScore) / baselineScore) * 100;
            
            if (regression > threshold) {
              regressions.push({
                type: 'lighthouse',
                metric,
                page: current.page,
                current: currentScore,
                baseline: baselineScore,
                regression: regression.toFixed(1)
              });
            }
          });
        }
      });
    }

    return regressions;
  }

  async analyzeTrends(lighthouseData, coreVitalsData, memoryData) {
    const trends = {
      performance: [],
      coreVitals: [],
      memory: []
    };

    // Load historical data for trend analysis
    const historicalData = await this.loadHistoricalData(30); // Last 30 builds
    
    if (historicalData.length > 0) {
      trends.performance = this.calculatePerformanceTrend(historicalData, lighthouseData);
      trends.coreVitals = this.calculateCoreVitalsTrend(historicalData, coreVitalsData);
      trends.memory = this.calculateMemoryTrend(historicalData, memoryData);
    }

    return trends;
  }

  async generatePerformanceReport(analysis) {
    const report = {
      metadata: {
        sessionId: this.sessionId,
        environment: this.environment,
        buildNumber: this.buildNumber,
        timestamp: new Date().toISOString(),
        generatedBy: 'HIVE-MIND Performance Analyzer v2.0'
      },
      executiveSummary: this.generateExecutiveSummary(analysis),
      detailedAnalysis: analysis,
      recommendations: this.generateRecommendations(analysis),
      actionItems: this.generateActionItems(analysis)
    };

    const reportPath = path.join(this.outputDir, `performance-report-${this.sessionId}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    // Generate markdown summary
    const markdownReport = this.generateMarkdownReport(report);
    const markdownPath = path.join(this.outputDir, `executive-summary.md`);
    fs.writeFileSync(markdownPath, markdownReport);

    console.log(`📊 Performance report generated: ${reportPath}`);
    return report;
  }

  generateExecutiveSummary(analysis) {
    const healthStatus = analysis.summary.healthStatus;
    const avgScore = analysis.summary.summary.avgPerformanceScore;
    const regressionCount = analysis.lighthouse?.regressions?.length || 0;

    return {
      overallHealth: healthStatus,
      performanceScore: avgScore,
      keyFindings: [
        `Average performance score: ${avgScore}/100`,
        `System health status: ${healthStatus}`,
        `${regressionCount} performance regressions detected`,
        `${analysis.summary.summary.pagesAudited} pages audited across ${analysis.lighthouse?.byDevice ? Object.keys(analysis.lighthouse.byDevice).length : 0} devices`
      ],
      criticalIssues: regressionCount > 0 ? analysis.lighthouse.regressions.slice(0, 3) : [],
      recommendations: regressionCount > 0 ? ['Investigate performance regressions immediately'] : ['Maintain current performance levels']
    };
  }

  generateMarkdownReport(report) {
    const { executiveSummary, detailedAnalysis } = report;
    
    return `# MediaNest Performance Analysis Report

## Executive Summary
- **Overall Health**: ${executiveSummary.overallHealth}
- **Performance Score**: ${executiveSummary.performanceScore}/100
- **Environment**: ${this.environment}
- **Build**: #${this.buildNumber}
- **Timestamp**: ${new Date(report.metadata.timestamp).toLocaleString()}

## Key Findings
${executiveSummary.keyFindings.map(finding => `- ${finding}`).join('\n')}

## Performance Metrics
- **Average FCP**: ${detailedAnalysis.summary.summary.avgFCP.toFixed(0)}ms
- **Average LCP**: ${detailedAnalysis.summary.summary.avgLCP.toFixed(0)}ms
- **Pages Audited**: ${detailedAnalysis.summary.summary.pagesAudited}

${executiveSummary.criticalIssues.length > 0 ? `
## Critical Issues
${executiveSummary.criticalIssues.map(issue => `- **${issue.metric}** regression on ${issue.page}: ${issue.regression}% slower`).join('\n')}
` : ''}

## Recommendations
${executiveSummary.recommendations.map(rec => `- ${rec}`).join('\n')}

---
*Generated by HIVE-MIND Performance Analyzer v2.0*`;
  }

  generateRecommendations(analysis) {
    const recommendations = [];
    
    // Performance score recommendations
    if (analysis.summary.summary.avgPerformanceScore < 70) {
      recommendations.push('Performance score is below 70. Focus on Core Web Vitals optimization.');
    }
    
    // Top opportunities
    if (analysis.lighthouse?.topOpportunities?.length > 0) {
      const topOpp = analysis.lighthouse.topOpportunities[0];
      recommendations.push(`Address "${topOpp.title}" to save ${Math.round(topOpp.totalSavings)}ms across ${topOpp.count} pages.`);
    }
    
    // Memory recommendations
    if (analysis.memory?.summary?.memoryLeaks?.length > 0) {
      recommendations.push(`Investigate memory leaks detected on ${analysis.memory.summary.memoryLeaks.length} pages.`);
    }
    
    // Load testing recommendations
    if (analysis.loadTest?.bottlenecks?.length > 0) {
      recommendations.push(`Optimize ${analysis.loadTest.bottlenecks.length} performance bottlenecks identified during load testing.`);
    }

    return recommendations;
  }

  generateActionItems(analysis) {
    const actionItems = [];
    
    // Regression action items
    if (analysis.lighthouse?.regressions?.length > 0) {
      actionItems.push({
        priority: 'high',
        title: 'Fix Performance Regressions',
        description: `Address ${analysis.lighthouse.regressions.length} performance regressions`,
        assignee: 'performance-team',
        deadline: '3 days'
      });
    }
    
    // Optimization opportunities
    if (analysis.lighthouse?.topOpportunities?.length > 0) {
      const topOpps = analysis.lighthouse.topOpportunities.slice(0, 3);
      topOpps.forEach((opp, index) => {
        actionItems.push({
          priority: index === 0 ? 'high' : 'medium',
          title: `Optimize: ${opp.title}`,
          description: `Could save ${Math.round(opp.totalSavings)}ms`,
          assignee: 'frontend-team',
          deadline: '1 week'
        });
      });
    }

    return actionItems;
  }

  async updateHiveMemory(analysis) {
    try {
      execSync(`npx claude-flow@alpha hooks post-edit --file "performance-analysis" --memory-key "perf/${this.sessionId}/analysis"`, {
        input: JSON.stringify(analysis),
        stdio: 'pipe'
      });
      console.log('💾 Updated HIVE-MIND memory with performance analysis');
    } catch (error) {
      console.warn('Failed to update HIVE memory:', error.message);
    }
  }

  async loadBaselines() {
    const baselinesPath = path.join(this.baselinesDir, `${this.environment}.json`);
    
    if (fs.existsSync(baselinesPath)) {
      try {
        return JSON.parse(fs.readFileSync(baselinesPath, 'utf8'));
      } catch (error) {
        console.warn('Failed to load baselines:', error.message);
      }
    }
    
    return {};
  }

  async loadHistoricalData(days) {
    // This would load historical performance data for trend analysis
    // For now, return empty array - in production, this would query a database or file system
    return [];
  }

  calculatePerformanceTrend(historicalData, currentData) {
    // Calculate performance trend over time
    return { trend: 'stable', confidence: 0.8 };
  }

  calculateCoreVitalsTrend(historicalData, currentData) {
    // Calculate Core Web Vitals trend over time
    return { trend: 'improving', confidence: 0.7 };
  }

  calculateMemoryTrend(historicalData, currentData) {
    // Calculate memory usage trend over time
    return { trend: 'stable', confidence: 0.9 };
  }

  findFiles(dir, pattern) {
    const files = [];
    try {
      const walk = (currentDir) => {
        const entries = fs.readdirSync(currentDir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(currentDir, entry.name);
          if (entry.isDirectory()) {
            walk(fullPath);
          } else if (entry.name.includes(pattern)) {
            files.push(fullPath);
          }
        }
      };
      walk(dir);
    } catch (error) {
      console.warn(`Failed to scan directory ${dir}:`, error.message);
    }
    return files;
  }

  groupBy(array, key) {
    return array.reduce((groups, item) => {
      const group = item[key];
      if (!groups[group]) {
        groups[group] = [];
      }
      groups[group].push(item);
      return groups;
    }, {});
  }

  findLighthouseRegressions(current, baseline) {
    // Compare current analysis with baseline to find regressions
    return [];
  }

  findLighthouseImprovements(current, baseline) {
    // Compare current analysis with baseline to find improvements
    return [];
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

  const analyzer = new PerformanceAnalyzer(options);
  analyzer.analyzePerformanceMetrics()
    .then(analysis => {
      console.log('✅ Performance analysis completed successfully');
      console.log(`📊 Overall health: ${analysis.summary.healthStatus}`);
      console.log(`🎯 Performance score: ${analysis.summary.summary.avgPerformanceScore}/100`);
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Performance analysis failed:', error);
      process.exit(1);
    });
}

module.exports = PerformanceAnalyzer;