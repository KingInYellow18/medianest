#!/usr/bin/env node

/**
 * MediaNest Technical Debt Monitoring & Alerting System
 * Real-time monitoring and regression detection for technical debt accumulation
 */

const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');

class TechnicalDebtMonitor {
  constructor() {
    this.projectRoot = path.resolve(__dirname, '../../..');
    this.metricsDir = path.join(this.projectRoot, 'metrics');
    this.dataDir = path.join(this.metricsDir, 'data');
    this.alertsDir = path.join(this.metricsDir, 'alerts');

    // Alert thresholds
    this.thresholds = {
      security: {
        criticalVulnerabilities: 0,
        highVulnerabilities: 5,
        securityScore: 85,
      },
      build: {
        typeScriptErrors: 10,
        testCoverageMin: 70,
        buildFailureAlert: true,
      },
      performance: {
        bundleSizeMaxKB: 500,
        lighthouseScoreMin: 85,
        apiResponseMaxMs: 100,
      },
      codeQuality: {
        technicalDebtMaxHours: 80,
        codeSmellsMax: 100,
        cyclomaticComplexityMax: 10,
      },
    };

    // Alert channels (can be extended)
    this.alertChannels = {
      console: true,
      file: true,
      email: false, // Configure SMTP settings
      slack: false, // Configure webhook URL
      github: false, // Configure GitHub issues API
    };
  }

  async startMonitoring() {
    console.log('🔍 Starting Technical Debt Monitor...');
    await this.initializeAlerts();

    // Initial assessment
    await this.checkMetrics();

    // Set up periodic monitoring (every 15 minutes)
    setInterval(
      () => {
        this.checkMetrics().catch(console.error);
      },
      15 * 60 * 1000,
    );

    console.log('✅ Technical Debt Monitor is running');
    console.log('📊 Monitoring security, build, performance, and code quality metrics');
    console.log('⏰ Checking every 15 minutes for regressions');
  }

  async initializeAlerts() {
    await fs.mkdir(this.alertsDir, { recursive: true });

    // Initialize alert history
    const alertHistoryPath = path.join(this.alertsDir, 'alert-history.json');
    try {
      await fs.access(alertHistoryPath);
    } catch {
      await fs.writeFile(
        alertHistoryPath,
        JSON.stringify(
          {
            alerts: [],
            lastCheck: new Date().toISOString(),
          },
          null,
          2,
        ),
      );
    }
  }

  async checkMetrics() {
    const timestamp = new Date().toISOString();
    console.log(`🔍 [${timestamp}] Running metrics check...`);

    try {
      // Load current metrics
      const currentMetricsPath = path.join(this.dataDir, 'current-metrics.json');
      const currentMetrics = await this.readJsonFile(currentMetricsPath);

      if (!currentMetrics || !currentMetrics.security) {
        console.log('⚠️ No current metrics found, collecting fresh data...');
        await this.collectFreshMetrics();
        return;
      }

      // Check all metric categories
      const alerts = [];

      alerts.push(...(await this.checkSecurityMetrics(currentMetrics.security)));
      alerts.push(...(await this.checkBuildMetrics(currentMetrics.build)));
      alerts.push(...(await this.checkPerformanceMetrics(currentMetrics.performance)));
      alerts.push(...(await this.checkCodeQualityMetrics(currentMetrics.codeQuality)));

      // Process alerts
      if (alerts.length > 0) {
        await this.processAlerts(alerts);
      } else {
        console.log('✅ All metrics within acceptable thresholds');
      }

      // Update monitoring status
      await this.updateMonitoringStatus(currentMetrics, alerts);
    } catch (error) {
      console.error('❌ Metrics check failed:', error.message);
      await this.sendAlert({
        level: 'critical',
        category: 'monitoring',
        message: 'Metrics monitoring system failure',
        details: { error: error.message },
        timestamp: timestamp,
      });
    }
  }

  async checkSecurityMetrics(security) {
    const alerts = [];

    if (security.criticalVulnerabilities > this.thresholds.security.criticalVulnerabilities) {
      alerts.push({
        level: 'critical',
        category: 'security',
        message: `Critical vulnerabilities detected: ${security.criticalVulnerabilities}`,
        threshold: this.thresholds.security.criticalVulnerabilities,
        actual: security.criticalVulnerabilities,
        impact: 'Immediate security breach risk',
        recommendation: 'Stop all deployment activities and fix vulnerabilities immediately',
      });
    }

    if (security.highVulnerabilities > this.thresholds.security.highVulnerabilities) {
      alerts.push({
        level: 'high',
        category: 'security',
        message: `High vulnerabilities exceed threshold: ${security.highVulnerabilities}`,
        threshold: this.thresholds.security.highVulnerabilities,
        actual: security.highVulnerabilities,
        impact: 'Elevated security risk',
        recommendation: 'Schedule immediate security review and remediation',
      });
    }

    if (security.securityScore < this.thresholds.security.securityScore) {
      alerts.push({
        level: 'high',
        category: 'security',
        message: `Security score below threshold: ${security.securityScore}/100`,
        threshold: this.thresholds.security.securityScore,
        actual: security.securityScore,
        impact: 'Overall security posture degraded',
        recommendation: 'Comprehensive security audit required',
      });
    }

    return alerts;
  }

  async checkBuildMetrics(build) {
    const alerts = [];

    if (
      build.typeScriptErrors &&
      build.typeScriptErrors.count > this.thresholds.build.typeScriptErrors
    ) {
      alerts.push({
        level: 'high',
        category: 'build',
        message: `TypeScript errors exceed threshold: ${build.typeScriptErrors.count}`,
        threshold: this.thresholds.build.typeScriptErrors,
        actual: build.typeScriptErrors.count,
        impact: 'Build instability and potential runtime errors',
        recommendation: 'Allocate developer time to fix TypeScript errors',
      });
    }

    if (!build.buildSuccess) {
      alerts.push({
        level: 'critical',
        category: 'build',
        message: 'Build process failing',
        threshold: 'Build must succeed',
        actual: 'Build failing',
        impact: 'Development and deployment blocked',
        recommendation: 'Immediate investigation of build failures required',
      });
    }

    if (build.testCoverage < this.thresholds.build.testCoverageMin) {
      alerts.push({
        level: 'medium',
        category: 'build',
        message: `Test coverage below threshold: ${build.testCoverage}%`,
        threshold: this.thresholds.build.testCoverageMin,
        actual: build.testCoverage,
        impact: 'Increased risk of production bugs',
        recommendation: 'Implement comprehensive test suite',
      });
    }

    return alerts;
  }

  async checkPerformanceMetrics(performance) {
    const alerts = [];

    if (
      performance.bundleSize &&
      performance.bundleSize.totalKB > this.thresholds.performance.bundleSizeMaxKB
    ) {
      alerts.push({
        level: 'medium',
        category: 'performance',
        message: `Bundle size exceeds threshold: ${performance.bundleSize.totalKB}KB`,
        threshold: this.thresholds.performance.bundleSizeMaxKB,
        actual: performance.bundleSize.totalKB,
        impact: 'Poor user experience due to slow loading',
        recommendation: 'Implement code splitting and bundle optimization',
      });
    }

    if (
      performance.lighthouse &&
      performance.lighthouse < this.thresholds.performance.lighthouseScoreMin
    ) {
      alerts.push({
        level: 'medium',
        category: 'performance',
        message: `Lighthouse score below threshold: ${performance.lighthouse}`,
        threshold: this.thresholds.performance.lighthouseScoreMin,
        actual: performance.lighthouse,
        impact: 'Poor user experience and SEO impact',
        recommendation: 'Performance optimization required',
      });
    }

    return alerts;
  }

  async checkCodeQualityMetrics(codeQuality) {
    const alerts = [];

    if (codeQuality.technicalDebtHours > this.thresholds.codeQuality.technicalDebtMaxHours) {
      alerts.push({
        level: 'medium',
        category: 'codeQuality',
        message: `Technical debt exceeds threshold: ${codeQuality.technicalDebtHours}h`,
        threshold: this.thresholds.codeQuality.technicalDebtMaxHours,
        actual: codeQuality.technicalDebtHours,
        impact: 'Decreased development velocity',
        recommendation: 'Schedule technical debt reduction sprints',
      });
    }

    if (codeQuality.codeSmells > this.thresholds.codeQuality.codeSmellsMax) {
      alerts.push({
        level: 'low',
        category: 'codeQuality',
        message: `Code smells exceed threshold: ${codeQuality.codeSmells}`,
        threshold: this.thresholds.codeQuality.codeSmellsMax,
        actual: codeQuality.codeSmells,
        impact: 'Code maintainability concerns',
        recommendation: 'Refactoring and code cleanup needed',
      });
    }

    return alerts;
  }

  async processAlerts(alerts) {
    console.log(`🚨 Processing ${alerts.length} alerts...`);

    const timestamp = new Date().toISOString();
    const processedAlerts = alerts.map((alert) => ({
      ...alert,
      id: this.generateAlertId(alert),
      timestamp,
      acknowledged: false,
    }));

    // Send alerts through configured channels
    for (const alert of processedAlerts) {
      await this.sendAlert(alert);
    }

    // Save to alert history
    await this.saveAlertHistory(processedAlerts);

    // Generate alert summary
    await this.generateAlertSummary(processedAlerts);
  }

  async sendAlert(alert) {
    if (this.alertChannels.console) {
      this.sendConsoleAlert(alert);
    }

    if (this.alertChannels.file) {
      await this.sendFileAlert(alert);
    }

    // Additional channels can be implemented
    // if (this.alertChannels.email) await this.sendEmailAlert(alert);
    // if (this.alertChannels.slack) await this.sendSlackAlert(alert);
    // if (this.alertChannels.github) await this.sendGitHubAlert(alert);
  }

  sendConsoleAlert(alert) {
    const icons = {
      critical: '🔴',
      high: '🟠',
      medium: '🟡',
      low: '🔵',
    };

    const icon = icons[alert.level] || '⚪';
    console.log(`\n${icon} ${alert.level.toUpperCase()} ALERT - ${alert.category}`);
    console.log(`   Message: ${alert.message}`);
    if (alert.threshold) console.log(`   Threshold: ${alert.threshold} | Actual: ${alert.actual}`);
    if (alert.impact) console.log(`   Impact: ${alert.impact}`);
    if (alert.recommendation) console.log(`   Recommendation: ${alert.recommendation}`);
    console.log(`   Time: ${alert.timestamp}\n`);
  }

  async sendFileAlert(alert) {
    const alertsLogPath = path.join(this.alertsDir, 'alerts.log');
    const logEntry = `[${alert.timestamp}] ${alert.level.toUpperCase()} ${alert.category}: ${alert.message}\n`;

    try {
      await fs.appendFile(alertsLogPath, logEntry);
    } catch (error) {
      console.error('Failed to write alert to file:', error.message);
    }
  }

  async saveAlertHistory(alerts) {
    const historyPath = path.join(this.alertsDir, 'alert-history.json');

    try {
      const history = await this.readJsonFile(historyPath);

      if (!history.alerts) history.alerts = [];

      history.alerts.push(...alerts);
      history.lastCheck = new Date().toISOString();

      // Keep only last 1000 alerts
      if (history.alerts.length > 1000) {
        history.alerts = history.alerts.slice(-1000);
      }

      await fs.writeFile(historyPath, JSON.stringify(history, null, 2));
    } catch (error) {
      console.error('Failed to save alert history:', error.message);
    }
  }

  async generateAlertSummary(alerts) {
    const summaryPath = path.join(this.alertsDir, 'alert-summary.json');

    const summary = {
      timestamp: new Date().toISOString(),
      totalAlerts: alerts.length,
      byLevel: this.groupBy(alerts, 'level'),
      byCategory: this.groupBy(alerts, 'category'),
      criticalAlerts: alerts.filter((a) => a.level === 'critical'),
      highAlerts: alerts.filter((a) => a.level === 'high'),
      recommendations: [...new Set(alerts.map((a) => a.recommendation).filter(Boolean))],
    };

    await fs.writeFile(summaryPath, JSON.stringify(summary, null, 2));
  }

  async updateMonitoringStatus(metrics, alerts) {
    const statusPath = path.join(this.metricsDir, 'monitoring-status.json');

    const status = {
      lastCheck: new Date().toISOString(),
      systemHealth: this.calculateSystemHealth(metrics, alerts),
      alerts: {
        active: alerts.length,
        critical: alerts.filter((a) => a.level === 'critical').length,
        high: alerts.filter((a) => a.level === 'high').length,
      },
      metrics: {
        security: metrics.security?.securityScore || 0,
        build: metrics.build?.buildSuccess ? 100 : 0,
        performance: metrics.performance?.lighthouse || 0,
        codeQuality: Math.max(0, 100 - (metrics.codeQuality?.technicalDebtHours || 0)),
      },
      nextCheck: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    };

    await fs.writeFile(statusPath, JSON.stringify(status, null, 2));
  }

  calculateSystemHealth(metrics, alerts) {
    const criticalAlerts = alerts.filter((a) => a.level === 'critical').length;
    const highAlerts = alerts.filter((a) => a.level === 'high').length;

    if (criticalAlerts > 0) return 'CRITICAL';
    if (highAlerts > 3) return 'DEGRADED';
    if (alerts.length > 5) return 'WARNING';

    return 'HEALTHY';
  }

  async collectFreshMetrics() {
    console.log('🔄 Collecting fresh metrics...');

    try {
      const MetricsCollector = require('./metrics-collector.js');
      const collector = new MetricsCollector();
      await collector.collectAll();
    } catch (error) {
      console.error('Failed to collect fresh metrics:', error.message);
    }
  }

  // Utility methods
  generateAlertId(alert) {
    const hash = require('crypto')
      .createHash('md5')
      .update(`${alert.category}-${alert.message}-${alert.level}`)
      .digest('hex');
    return hash.substring(0, 8);
  }

  groupBy(array, key) {
    return array.reduce((groups, item) => {
      const group = item[key] || 'unknown';
      groups[group] = (groups[group] || 0) + 1;
      return groups;
    }, {});
  }

  async readJsonFile(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      return JSON.parse(content);
    } catch {
      return {};
    }
  }
}

// Regression detection utilities
class RegressionDetector {
  constructor(monitor) {
    this.monitor = monitor;
  }

  async detectRegressions() {
    console.log('🔍 Detecting technical debt regressions...');

    const historyDir = path.join(this.monitor.dataDir, 'history');

    try {
      const historyFiles = await fs.readdir(historyDir);
      const recentFiles = historyFiles
        .filter((f) => f.startsWith('metrics-'))
        .sort()
        .slice(-7); // Last 7 days

      if (recentFiles.length < 2) {
        console.log('⚠️ Insufficient history for regression analysis');
        return [];
      }

      const regressions = [];

      // Compare latest with previous
      const latest = await this.monitor.readJsonFile(
        path.join(historyDir, recentFiles[recentFiles.length - 1]),
      );
      const previous = await this.monitor.readJsonFile(
        path.join(historyDir, recentFiles[recentFiles.length - 2]),
      );

      // Detect security regressions
      if (latest.security && previous.security) {
        if (latest.security.securityScore < previous.security.securityScore - 5) {
          regressions.push({
            type: 'security_regression',
            message: `Security score decreased from ${previous.security.securityScore} to ${latest.security.securityScore}`,
            severity: 'high',
          });
        }
      }

      // Detect build regressions
      if (latest.build && previous.build) {
        if (latest.build.typeScriptErrors?.count > previous.build.typeScriptErrors?.count) {
          regressions.push({
            type: 'build_regression',
            message: `TypeScript errors increased from ${previous.build.typeScriptErrors?.count || 0} to ${latest.build.typeScriptErrors?.count}`,
            severity: 'medium',
          });
        }
      }

      // Detect performance regressions
      if (latest.performance && previous.performance) {
        if (latest.performance.lighthouse < previous.performance.lighthouse - 10) {
          regressions.push({
            type: 'performance_regression',
            message: `Lighthouse score decreased from ${previous.performance.lighthouse} to ${latest.performance.lighthouse}`,
            severity: 'medium',
          });
        }
      }

      if (regressions.length > 0) {
        console.log(`⚠️ Detected ${regressions.length} regressions`);
        await this.reportRegressions(regressions);
      }

      return regressions;
    } catch (error) {
      console.error('Failed to detect regressions:', error.message);
      return [];
    }
  }

  async reportRegressions(regressions) {
    const reportPath = path.join(this.monitor.alertsDir, 'regression-report.json');

    const report = {
      timestamp: new Date().toISOString(),
      regressions,
      summary: `${regressions.length} technical debt regressions detected`,
      recommendations: [
        'Review recent code changes',
        'Run comprehensive test suite',
        'Consider reverting problematic changes',
      ],
    };

    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

    // Send regression alerts
    for (const regression of regressions) {
      await this.monitor.sendAlert({
        level: regression.severity,
        category: 'regression',
        message: regression.message,
        timestamp: new Date().toISOString(),
      });
    }
  }
}

// CLI execution
async function main() {
  const monitor = new TechnicalDebtMonitor();
  const detector = new RegressionDetector(monitor);

  // Check for regressions first
  await detector.detectRegressions();

  // Start continuous monitoring
  await monitor.startMonitoring();
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { TechnicalDebtMonitor, RegressionDetector };
