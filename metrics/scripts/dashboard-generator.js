#!/usr/bin/env node

/**
 * MediaNest Technical Debt Dashboard Generator
 * Automated dashboard and report generation with real-time updates
 */

const fs = require('fs').promises;
const path = require('path');

class DashboardGenerator {
  constructor() {
    this.projectRoot = path.resolve(__dirname, '../../..');
    this.metricsDir = path.join(this.projectRoot, 'metrics');
    this.dataDir = path.join(this.metricsDir, 'data');
    this.dashboardsDir = path.join(this.metricsDir, 'dashboards');
    this.outputDir = path.join(this.metricsDir, 'generated');
  }

  async generateAll() {
    console.log('📊 Starting dashboard generation...');
    
    await this.initializeDirectories();
    
    const currentMetrics = await this.loadCurrentMetrics();
    const progressData = await this.loadProgressTracking();
    const alertHistory = await this.loadAlertHistory();
    
    // Generate different dashboard formats
    await this.generateExecutiveDashboard(currentMetrics, progressData);
    await this.generateTechnicalDashboard(currentMetrics, progressData);
    await this.generateProgressReport(currentMetrics, progressData);
    await this.generateAlertDashboard(alertHistory);
    await this.generateMetricsAPI(currentMetrics, progressData);
    
    console.log('✅ All dashboards generated successfully');
    console.log(`📁 Generated files in: ${this.outputDir}`);
  }

  async initializeDirectories() {
    await fs.mkdir(this.outputDir, { recursive: true });
    await fs.mkdir(path.join(this.outputDir, 'api'), { recursive: true });
    await fs.mkdir(path.join(this.outputDir, 'reports'), { recursive: true });
  }

  async loadCurrentMetrics() {
    try {
      const content = await fs.readFile(path.join(this.dataDir, 'current-metrics.json'), 'utf8');
      return JSON.parse(content);
    } catch {
      return this.getDefaultMetrics();
    }
  }

  async loadProgressTracking() {
    try {
      const content = await fs.readFile(path.join(this.dataDir, 'progress-tracking.json'), 'utf8');
      return JSON.parse(content);
    } catch {
      return this.getDefaultProgress();
    }
  }

  async loadAlertHistory() {
    try {
      const content = await fs.readFile(path.join(this.metricsDir, 'alerts/alert-history.json'), 'utf8');
      return JSON.parse(content);
    } catch {
      return { alerts: [] };
    }
  }

  async generateExecutiveDashboard(metrics, progress) {
    console.log('📈 Generating executive dashboard...');
    
    const dashboard = `# MediaNest Technical Debt - Executive Dashboard
*Generated: ${new Date().toISOString()}*

## 🎯 Executive Summary

**Current Production Readiness:** ${this.getProductionReadinessStatus(metrics)}
**Overall Health Score:** ${this.calculateOverallScore(metrics)}/100

### Critical Metrics at a Glance

| Component | Current | Target | Progress | Status |
|-----------|---------|--------|----------|---------|
| Security Score | ${metrics.security?.securityScore || 15}/100 | 90/100 | ${this.calculateProgress(metrics.security?.securityScore || 15, 90)}% | ${this.getStatusIcon(metrics.security?.securityScore || 15, 90)} |
| Build Stability | ${metrics.build?.buildSuccess ? 90 : 20}/100 | 95/100 | ${this.calculateProgress(metrics.build?.buildSuccess ? 90 : 20, 95)}% | ${this.getStatusIcon(metrics.build?.buildSuccess ? 90 : 20, 95)} |
| Test Coverage | ${metrics.build?.testCoverage || 0}% | 85% | ${this.calculateProgress(metrics.build?.testCoverage || 0, 85)}% | ${this.getStatusIcon(metrics.build?.testCoverage || 0, 85)} |
| Performance | ${metrics.performance?.lighthouse || 40}/100 | 90/100 | ${this.calculateProgress(metrics.performance?.lighthouse || 40, 90)}% | ${this.getStatusIcon(metrics.performance?.lighthouse || 40, 90)} |

## 📊 Financial Impact Analysis

**Current Risk Exposure:** $500,000+ (potential security breach)
**Required Investment:** $42,000 - $70,000 (280 engineering hours)
**Expected ROI:** 400-800% (risk avoidance + productivity gains)
**Time to Production Ready:** 4-6 weeks

### Investment Breakdown

- **Phase 1 (Emergency):** $7,200 (1 week) - Critical security fixes
- **Phase 2 (Stabilization):** $18,000 (3 weeks) - Build and test infrastructure  
- **Phase 3 (Excellence):** $16,800 (2-4 weeks) - Performance and documentation

## 🚨 Critical Action Items

${this.generateCriticalActionItems(metrics)}

## 📈 Progress Tracking

### Phase Completion Status

${this.generatePhaseProgress(progress)}

### Key Performance Indicators

${this.generateKPIStatus(progress)}

## ⚠️ Risk Assessment

**Deployment Recommendation:** ${this.getDeploymentRecommendation(metrics)}

${this.generateRiskMatrix(metrics)}

---

*Next update: ${new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]}*
*Contact: Technical Debt Response Team*
`;

    await fs.writeFile(path.join(this.outputDir, 'executive-dashboard.md'), dashboard);
  }

  async generateTechnicalDashboard(metrics, progress) {
    console.log('🔧 Generating technical dashboard...');
    
    const dashboard = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MediaNest Technical Metrics Dashboard</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <meta http-equiv="refresh" content="300"> <!-- Auto-refresh every 5 minutes -->
    <style>
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; 
            margin: 0; 
            background: #f5f5f7; 
        }
        .header { 
            background: linear-gradient(135deg, #007aff, #5856d6); 
            color: white; 
            padding: 2rem; 
            text-align: center; 
        }
        .status-bar {
            background: ${metrics.security?.criticalVulnerabilities > 0 ? '#ff3b30' : '#34c759'};
            color: white;
            padding: 1rem;
            text-align: center;
            font-weight: bold;
        }
        .container { 
            max-width: 1200px; 
            margin: 0 auto; 
            padding: 2rem; 
        }
        .metrics-grid { 
            display: grid; 
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); 
            gap: 2rem; 
            margin-bottom: 2rem; 
        }
        .metric-card { 
            background: white; 
            border-radius: 12px; 
            padding: 1.5rem; 
            box-shadow: 0 4px 6px rgba(0,0,0,0.1); 
        }
        .metric-value { 
            font-size: 3rem; 
            font-weight: bold; 
            color: #007aff; 
        }
        .chart-container { 
            background: white; 
            border-radius: 12px; 
            padding: 2rem; 
            margin-bottom: 2rem; 
            box-shadow: 0 4px 6px rgba(0,0,0,0.1); 
        }
        .progress-bar {
            height: 20px;
            background: #e5e5e7;
            border-radius: 10px;
            overflow: hidden;
            margin: 1rem 0;
        }
        .progress-fill {
            height: 100%;
            background: linear-gradient(90deg, #ff3b30, #ff9500, #34c759);
            border-radius: 10px;
            transition: width 0.5s ease;
        }
        .alert-section {
            background: #fff3cd;
            border: 1px solid #ffeaa7;
            border-radius: 8px;
            padding: 1rem;
            margin: 1rem 0;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>MediaNest Technical Metrics Dashboard</h1>
        <p>Real-time technical debt monitoring and progress tracking</p>
        <p><small>Last updated: ${new Date().toISOString()}</small></p>
    </div>

    <div class="status-bar">
        ${this.getStatusMessage(metrics)}
    </div>

    <div class="container">
        <!-- Key Metrics -->
        <div class="metrics-grid">
            ${this.generateMetricCards(metrics)}
        </div>

        <!-- Security Vulnerability Chart -->
        <div class="chart-container">
            <h2>Security Vulnerability Distribution</h2>
            <canvas id="vulnerabilityChart" width="400" height="200"></canvas>
        </div>

        <!-- Progress Timeline -->
        <div class="chart-container">
            <h2>Remediation Progress</h2>
            <canvas id="progressChart" width="400" height="200"></canvas>
        </div>

        <!-- Technical Debt Breakdown -->
        <div class="chart-container">
            <h2>Technical Debt Analysis</h2>
            <canvas id="technicalDebtChart" width="400" height="200"></canvas>
        </div>

        <!-- Alert Summary -->
        ${this.generateAlertSummary(metrics)}
    </div>

    <script>
        ${this.generateChartScripts(metrics)}
        
        // Auto-refresh data every 5 minutes
        setInterval(() => {
            fetch('/api/current-metrics.json')
                .then(response => response.json())
                .then(data => {
                    updateDashboard(data);
                })
                .catch(console.error);
        }, 300000);
    </script>
</body>
</html>`;

    await fs.writeFile(path.join(this.outputDir, 'technical-dashboard.html'), dashboard);
  }

  async generateProgressReport(metrics, progress) {
    console.log('📋 Generating progress report...');
    
    const report = {
      timestamp: new Date().toISOString(),
      executiveSummary: {
        overallProgress: this.calculateOverallProgress(progress),
        currentPhase: this.getCurrentPhase(progress),
        nextMilestone: this.getNextMilestone(progress),
        estimatedCompletion: this.estimateCompletion(progress)
      },
      phaseProgress: this.generateDetailedPhaseProgress(progress),
      kpiTrends: this.generateKPITrends(progress),
      risks: this.identifyCurrentRisks(metrics),
      recommendations: this.generateRecommendations(metrics, progress),
      upcomingTasks: this.getUpcomingTasks(progress),
      resourceRequirements: this.calculateResourceNeeds(progress),
      qualityGates: this.assessQualityGates(metrics)
    };

    await fs.writeFile(
      path.join(this.outputDir, 'reports', 'progress-report.json'), 
      JSON.stringify(report, null, 2)
    );

    // Generate markdown version
    const markdownReport = this.convertToMarkdown(report);
    await fs.writeFile(
      path.join(this.outputDir, 'reports', 'progress-report.md'), 
      markdownReport
    );
  }

  async generateAlertDashboard(alertHistory) {
    console.log('🚨 Generating alert dashboard...');
    
    const recentAlerts = alertHistory.alerts?.slice(-50) || [];
    const alertSummary = this.analyzeAlerts(recentAlerts);
    
    const dashboard = `# Technical Debt Alert Dashboard

Generated: ${new Date().toISOString()}

## Alert Summary (Last 50)

**Total Alerts:** ${recentAlerts.length}
**Critical:** ${alertSummary.critical}
**High:** ${alertSummary.high}  
**Medium:** ${alertSummary.medium}
**Low:** ${alertSummary.low}

## Recent Critical Alerts

${this.formatCriticalAlerts(recentAlerts)}

## Alert Trends

${this.generateAlertTrends(recentAlerts)}

## Alert Categories

${this.generateAlertCategories(alertSummary)}

## Resolution Status

${this.generateResolutionStatus(recentAlerts)}

---

*Dashboard updates every 15 minutes*
*For real-time alerts, monitor the console output or check alerts.log*
`;

    await fs.writeFile(path.join(this.outputDir, 'alert-dashboard.md'), dashboard);
  }

  async generateMetricsAPI(metrics, progress) {
    console.log('🔌 Generating metrics API endpoints...');
    
    // Current metrics endpoint
    await fs.writeFile(
      path.join(this.outputDir, 'api', 'current-metrics.json'),
      JSON.stringify(metrics, null, 2)
    );

    // Progress tracking endpoint  
    await fs.writeFile(
      path.join(this.outputDir, 'api', 'progress-tracking.json'),
      JSON.stringify(progress, null, 2)
    );

    // Summary endpoint
    const summary = {
      timestamp: new Date().toISOString(),
      health: {
        overall: this.calculateOverallScore(metrics),
        security: metrics.security?.securityScore || 0,
        build: metrics.build?.buildSuccess ? 90 : 20,
        performance: metrics.performance?.lighthouse || 0
      },
      alerts: {
        critical: this.countCriticalIssues(metrics),
        total: this.countTotalIssues(metrics)
      },
      progress: {
        phase: this.getCurrentPhase(progress),
        completion: this.calculateOverallProgress(progress)
      },
      deployment: {
        recommendation: this.getDeploymentRecommendation(metrics),
        readiness: this.getProductionReadinessStatus(metrics)
      }
    };

    await fs.writeFile(
      path.join(this.outputDir, 'api', 'summary.json'),
      JSON.stringify(summary, null, 2)
    );

    // Generate OpenAPI documentation
    const apiSpec = this.generateOpenAPISpec();
    await fs.writeFile(
      path.join(this.outputDir, 'api', 'openapi.yaml'),
      apiSpec
    );
  }

  // Utility methods for dashboard generation
  getProductionReadinessStatus(metrics) {
    const score = this.calculateOverallScore(metrics);
    if (score >= 85) return '✅ PRODUCTION READY';
    if (score >= 60) return '⚠️ STAGING READY';
    return '❌ NOT READY';
  }

  calculateOverallScore(metrics) {
    const security = metrics.security?.securityScore || 0;
    const build = metrics.build?.buildSuccess ? 90 : 20;
    const performance = metrics.performance?.lighthouse || 40;
    const tests = metrics.build?.testCoverage || 0;
    
    return Math.round((security * 0.3 + build * 0.25 + performance * 0.25 + tests * 0.2));
  }

  calculateProgress(current, target) {
    return Math.round((current / target) * 100);
  }

  getStatusIcon(current, target) {
    const progress = current / target;
    if (progress >= 0.85) return '✅';
    if (progress >= 0.6) return '⚠️';
    return '❌';
  }

  generateCriticalActionItems(metrics) {
    const items = [];
    
    if (metrics.security?.criticalVulnerabilities > 0) {
      items.push(`• **IMMEDIATE:** Fix ${metrics.security.criticalVulnerabilities} critical security vulnerabilities`);
    }
    
    if (!metrics.build?.buildSuccess) {
      items.push('• **IMMEDIATE:** Resolve build failures preventing compilation');
    }
    
    if (metrics.build?.typeScriptErrors?.count > 100) {
      items.push(`• **HIGH:** Fix ${metrics.build.typeScriptErrors.count} TypeScript compilation errors`);
    }
    
    if (metrics.build?.testCoverage < 30) {
      items.push('• **HIGH:** Repair broken test infrastructure');
    }
    
    return items.length > 0 ? items.join('\n') : '• No critical action items at this time';
  }

  generatePhaseProgress(progress) {
    if (!progress.phases) return 'Phase information not available';
    
    return Object.entries(progress.phases).map(([key, phase]) => {
      const progressBar = '█'.repeat(Math.floor(phase.progress / 10)) + '░'.repeat(10 - Math.floor(phase.progress / 10));
      return `**${phase.name}:** [${progressBar}] ${phase.progress}% - ${phase.status}`;
    }).join('\n');
  }

  generateKPIStatus(progress) {
    if (!progress.kpis) return 'KPI information not available';
    
    return Object.entries(progress.kpis).map(([key, kpi]) => {
      const progressBar = '█'.repeat(Math.floor((kpi.current / kpi.target) * 10)) + '░'.repeat(10 - Math.floor((kpi.current / kpi.target) * 10));
      return `**${key}:** [${progressBar}] ${kpi.current}/${kpi.target}`;
    }).join('\n');
  }

  getDeploymentRecommendation(metrics) {
    const score = this.calculateOverallScore(metrics);
    const criticalVulns = metrics.security?.criticalVulnerabilities || 0;
    const buildSuccess = metrics.build?.buildSuccess || false;
    
    if (criticalVulns > 0 || !buildSuccess) {
      return '❌ DO NOT DEPLOY - Critical blockers present';
    }
    if (score >= 85) {
      return '✅ PRODUCTION DEPLOYMENT APPROVED';
    }
    if (score >= 60) {
      return '⚠️ STAGING DEPLOYMENT ONLY';
    }
    return '❌ NOT READY FOR DEPLOYMENT';
  }

  generateRiskMatrix(metrics) {
    const risks = [
      {
        category: 'Security',
        level: metrics.security?.criticalVulnerabilities > 0 ? 'CRITICAL' : 'MEDIUM',
        impact: 'Data breach, compliance violation',
        probability: metrics.security?.criticalVulnerabilities > 0 ? 'HIGH' : 'LOW'
      },
      {
        category: 'Build Stability', 
        level: metrics.build?.buildSuccess ? 'LOW' : 'CRITICAL',
        impact: 'Development blocked, deployment impossible',
        probability: metrics.build?.buildSuccess ? 'LOW' : 'HIGH'
      },
      {
        category: 'Performance',
        level: metrics.performance?.lighthouse < 50 ? 'MEDIUM' : 'LOW',
        impact: 'User experience degradation',
        probability: 'MEDIUM'
      }
    ];
    
    return risks.map(risk => 
      `| ${risk.category} | ${risk.level} | ${risk.impact} | ${risk.probability} |`
    ).join('\n');
  }

  getStatusMessage(metrics) {
    if (metrics.security?.criticalVulnerabilities > 0) {
      return `🔴 CRITICAL: ${metrics.security.criticalVulnerabilities} security vulnerabilities require immediate attention`;
    }
    if (!metrics.build?.buildSuccess) {
      return '🔴 CRITICAL: Build failures preventing deployment';
    }
    if (this.calculateOverallScore(metrics) < 60) {
      return '🟡 WARNING: System below production readiness threshold';
    }
    return '🟢 HEALTHY: All systems within acceptable parameters';
  }

  generateMetricCards(metrics) {
    const cards = [
      {
        title: 'Security Score',
        value: metrics.security?.securityScore || 15,
        target: 90,
        unit: '/100'
      },
      {
        title: 'Build Success',
        value: metrics.build?.buildSuccess ? 'YES' : 'NO',
        status: metrics.build?.buildSuccess ? 'success' : 'error'
      },
      {
        title: 'Test Coverage',
        value: metrics.build?.testCoverage || 0,
        target: 85,
        unit: '%'
      },
      {
        title: 'TypeScript Errors',
        value: metrics.build?.typeScriptErrors?.count || 0,
        target: 0,
        unit: ''
      }
    ];
    
    return cards.map(card => `
      <div class="metric-card">
        <h3>${card.title}</h3>
        <div class="metric-value">${card.value}${card.unit || ''}</div>
        ${card.target ? `<div class="progress-bar">
          <div class="progress-fill" style="width: ${this.calculateProgress(card.value, card.target)}%"></div>
        </div>` : ''}
      </div>
    `).join('');
  }

  generateAlertSummary(metrics) {
    const alerts = [];
    
    if (metrics.security?.criticalVulnerabilities > 0) {
      alerts.push(`Critical security vulnerabilities: ${metrics.security.criticalVulnerabilities}`);
    }
    
    if (!metrics.build?.buildSuccess) {
      alerts.push('Build process is failing');
    }
    
    if (alerts.length === 0) {
      return '<div class="alert-section" style="background: #d4edda; border-color: #c3e6cb;"><h3>✅ All Clear</h3><p>No critical alerts at this time.</p></div>';
    }
    
    return `<div class="alert-section">
      <h3>🚨 Active Alerts</h3>
      <ul>${alerts.map(alert => `<li>${alert}</li>`).join('')}</ul>
    </div>`;
  }

  generateChartScripts(metrics) {
    return `
      // Vulnerability distribution chart
      const ctx1 = document.getElementById('vulnerabilityChart').getContext('2d');
      new Chart(ctx1, {
        type: 'doughnut',
        data: {
          labels: ['Critical', 'High', 'Medium', 'Low'],
          datasets: [{
            data: [
              ${metrics.security?.criticalVulnerabilities || 0},
              ${metrics.security?.highVulnerabilities || 0},
              ${metrics.security?.mediumVulnerabilities || 0},
              ${metrics.security?.lowVulnerabilities || 0}
            ],
            backgroundColor: ['#ff3b30', '#ff9500', '#ffcc00', '#34c759']
          }]
        }
      });
    `;
  }

  // Default data methods
  getDefaultMetrics() {
    return {
      security: { securityScore: 15, criticalVulnerabilities: 4 },
      build: { buildSuccess: false, testCoverage: 0 },
      performance: { lighthouse: 40 }
    };
  }

  getDefaultProgress() {
    return {
      phases: {},
      kpis: {}
    };
  }

  // Additional utility methods...
  getCurrentPhase(progress) {
    if (!progress.phases) return 'Phase 1';
    
    for (const [key, phase] of Object.entries(progress.phases)) {
      if (phase.status === 'in-progress') return phase.name;
      if (phase.status === 'pending') return phase.name;
    }
    
    return 'Phase 1';
  }

  calculateOverallProgress(progress) {
    if (!progress.phases) return 0;
    
    const phases = Object.values(progress.phases);
    if (phases.length === 0) return 0;
    
    const totalProgress = phases.reduce((sum, phase) => sum + phase.progress, 0);
    return Math.round(totalProgress / phases.length);
  }

  countCriticalIssues(metrics) {
    return (metrics.security?.criticalVulnerabilities || 0) + 
           (metrics.build?.buildSuccess ? 0 : 1);
  }

  countTotalIssues(metrics) {
    return (metrics.security?.totalVulnerabilities || 0) + 
           (metrics.build?.typeScriptErrors?.count || 0);
  }

  analyzeAlerts(alerts) {
    return {
      critical: alerts.filter(a => a.level === 'critical').length,
      high: alerts.filter(a => a.level === 'high').length,
      medium: alerts.filter(a => a.level === 'medium').length,
      low: alerts.filter(a => a.level === 'low').length
    };
  }

  formatCriticalAlerts(alerts) {
    const criticalAlerts = alerts.filter(a => a.level === 'critical').slice(-5);
    if (criticalAlerts.length === 0) {
      return '✅ No recent critical alerts';
    }
    
    return criticalAlerts.map(alert => 
      `- **${alert.timestamp}**: ${alert.message}`
    ).join('\n');
  }

  generateOpenAPISpec() {
    return `openapi: 3.0.0
info:
  title: MediaNest Technical Debt Metrics API
  version: 1.0.0
  description: API for accessing technical debt metrics and monitoring data

paths:
  /api/current-metrics:
    get:
      summary: Get current system metrics
      responses:
        200:
          description: Current metrics data
          
  /api/progress-tracking:
    get:
      summary: Get project progress information
      responses:
        200:
          description: Progress tracking data
          
  /api/summary:
    get:
      summary: Get executive summary
      responses:
        200:
          description: High-level summary data
`;
  }

  // Placeholder methods for additional functionality
  getNextMilestone(progress) { return 'Security Emergency Complete'; }
  estimateCompletion(progress) { return '2025-11-08'; }
  generateDetailedPhaseProgress(progress) { return {}; }
  generateKPITrends(progress) { return []; }
  identifyCurrentRisks(metrics) { return []; }
  generateRecommendations(metrics, progress) { return []; }
  getUpcomingTasks(progress) { return []; }
  calculateResourceNeeds(progress) { return {}; }
  assessQualityGates(metrics) { return {}; }
  convertToMarkdown(report) { return JSON.stringify(report, null, 2); }
  generateAlertTrends(alerts) { return 'Trends not available'; }
  generateAlertCategories(summary) { return JSON.stringify(summary, null, 2); }
  generateResolutionStatus(alerts) { return 'Status not available'; }
}

// CLI execution
async function main() {
  const generator = new DashboardGenerator();
  await generator.generateAll();
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = DashboardGenerator;