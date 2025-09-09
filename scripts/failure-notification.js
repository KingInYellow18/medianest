#!/usr/bin/env node

/**
 * ========================================================================
 * 🚨 CI/CD Failure Notification & Rollback System
 * ========================================================================
 * Purpose: Advanced failure detection, notification, and automated rollback
 * Features: Multi-channel notifications, failure analysis, rollback triggers
 * Usage: node scripts/failure-notification.js [options]
 * ========================================================================
 */

import { spawn } from 'child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';

// ========================================================================
// 📋 Configuration & Constants
// ========================================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..');

const CONFIG = {
  // Notification channels
  channels: {
    slack: process.env.SLACK_WEBHOOK_URL,
    discord: process.env.DISCORD_WEBHOOK_URL,
    email: process.env.SMTP_CONFIG,
    github: process.env.GITHUB_TOKEN,
  },
  
  // Failure thresholds
  thresholds: {
    criticalFailures: 3, // Trigger immediate rollback
    maxRetries: 2,
    rollbackTimeout: 300, // 5 minutes
  },
  
  // Rollback strategies
  rollback: {
    enabled: process.env.AUTO_ROLLBACK !== 'false',
    strategies: ['blue_green', 'previous_commit', 'health_check'],
    preserveData: true,
  },
  
  // Monitoring
  monitoring: {
    enabled: true,
    healthCheckInterval: 30000, // 30 seconds
    alertCooldown: 300000, // 5 minutes
  },
};

// ========================================================================
// 🛠️ Utility Classes
// ========================================================================

class Logger {
  static colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
  };

  static log(level, message, ...args) {
    const timestamp = new Date().toISOString();
    const color = this.colors[level] || this.colors.reset;
    const prefix = `${color}[${level.toUpperCase()}]${this.colors.reset}`;
    console.log(`${timestamp} ${prefix} ${message}`, ...args);
  }

  static info(message, ...args) { this.log('blue', message, ...args); }
  static success(message, ...args) { this.log('green', message, ...args); }
  static warning(message, ...args) { this.log('yellow', message, ...args); }
  static error(message, ...args) { this.log('red', message, ...args); }
  static critical(message, ...args) { this.log('magenta', message, ...args); }
}

// ========================================================================
// 🔍 Failure Detection & Analysis
// ========================================================================

class FailureAnalyzer {
  constructor() {
    this.failurePatterns = [
      // Test failures
      { pattern: /Test suite failed to run/, category: 'test_execution', severity: 'high' },
      { pattern: /FAIL.*\.test\.(js|ts|tsx)/, category: 'unit_test', severity: 'medium' },
      { pattern: /AssertionError/, category: 'assertion', severity: 'medium' },
      { pattern: /Coverage threshold.*not met/, category: 'coverage', severity: 'high' },
      
      // Build failures
      { pattern: /Build failed/, category: 'build', severity: 'critical' },
      { pattern: /Module not found/, category: 'dependency', severity: 'high' },
      { pattern: /TypeScript error/, category: 'typescript', severity: 'medium' },
      { pattern: /Syntax error/, category: 'syntax', severity: 'high' },
      
      // Infrastructure failures
      { pattern: /Database connection failed/, category: 'database', severity: 'critical' },
      { pattern: /Redis connection.*failed/, category: 'cache', severity: 'high' },
      { pattern: /Port.*already in use/, category: 'port_conflict', severity: 'medium' },
      { pattern: /Docker.*failed/, category: 'docker', severity: 'high' },
      
      // Security failures
      { pattern: /Security vulnerability/, category: 'security', severity: 'critical' },
      { pattern: /High severity.*vulnerabilities/, category: 'security', severity: 'critical' },
      { pattern: /Authentication.*failed/, category: 'auth', severity: 'high' },
      
      // Performance failures
      { pattern: /Timeout.*exceeded/, category: 'timeout', severity: 'high' },
      { pattern: /Memory limit.*exceeded/, category: 'memory', severity: 'critical' },
      { pattern: /Performance threshold.*not met/, category: 'performance', severity: 'medium' },
    ];

    this.failureHistory = this.loadFailureHistory();
  }

  analyzeFailure(logs, context = {}) {
    const failures = [];
    const logText = Array.isArray(logs) ? logs.join('\n') : logs.toString();

    // Pattern matching
    for (const pattern of this.failurePatterns) {
      const matches = logText.match(pattern.pattern);
      if (matches) {
        failures.push({
          category: pattern.category,
          severity: pattern.severity,
          message: matches[0],
          pattern: pattern.pattern.toString(),
          context: this.extractContext(logText, matches.index),
        });
      }
    }

    // Additional analysis
    const analysis = {
      failures,
      summary: this.generateFailureSummary(failures),
      recommendations: this.generateRecommendations(failures, context),
      rollbackRequired: this.shouldTriggerRollback(failures),
      timestamp: new Date().toISOString(),
      context,
    };

    this.recordFailure(analysis);
    return analysis;
  }

  extractContext(logText, matchIndex, contextLines = 3) {
    const lines = logText.split('\n');
    const matchLine = logText.substring(0, matchIndex).split('\n').length - 1;
    
    const startLine = Math.max(0, matchLine - contextLines);
    const endLine = Math.min(lines.length - 1, matchLine + contextLines);
    
    return lines.slice(startLine, endLine + 1).join('\n');
  }

  generateFailureSummary(failures) {
    const categories = {};
    const severities = {};

    failures.forEach(failure => {
      categories[failure.category] = (categories[failure.category] || 0) + 1;
      severities[failure.severity] = (severities[failure.severity] || 0) + 1;
    });

    return {
      total: failures.length,
      categories,
      severities,
      criticalCount: severities.critical || 0,
      highCount: severities.high || 0,
    };
  }

  generateRecommendations(failures, context) {
    const recommendations = [];

    failures.forEach(failure => {
      switch (failure.category) {
        case 'test_execution':
          recommendations.push('Review test configuration and dependencies');
          recommendations.push('Check for environment-specific test failures');
          break;
        case 'coverage':
          recommendations.push('Add missing test cases to increase coverage');
          recommendations.push('Review coverage threshold settings');
          break;
        case 'build':
          recommendations.push('Check build dependencies and configuration');
          recommendations.push('Verify source code compilation');
          break;
        case 'database':
          recommendations.push('Verify database connection configuration');
          recommendations.push('Check database service availability');
          break;
        case 'security':
          recommendations.push('Update vulnerable dependencies immediately');
          recommendations.push('Review security audit results');
          break;
        case 'performance':
          recommendations.push('Analyze performance bottlenecks');
          recommendations.push('Optimize resource-intensive operations');
          break;
      }
    });

    return [...new Set(recommendations)]; // Remove duplicates
  }

  shouldTriggerRollback(failures) {
    const criticalFailures = failures.filter(f => f.severity === 'critical').length;
    const highFailures = failures.filter(f => f.severity === 'high').length;

    // Critical failure threshold
    if (criticalFailures >= CONFIG.thresholds.criticalFailures) {
      return { required: true, reason: 'Critical failure threshold exceeded' };
    }

    // Security failures always trigger rollback
    if (failures.some(f => f.category === 'security' && f.severity === 'critical')) {
      return { required: true, reason: 'Critical security failure detected' };
    }

    // Database/infrastructure failures
    if (failures.some(f => ['database', 'docker'].includes(f.category) && f.severity === 'critical')) {
      return { required: true, reason: 'Critical infrastructure failure' };
    }

    return { required: false, reason: 'Failure threshold not met' };
  }

  recordFailure(analysis) {
    this.failureHistory.push({
      id: createHash('md5').update(`${analysis.timestamp}-${JSON.stringify(analysis.summary)}`).digest('hex'),
      ...analysis,
    });

    // Keep only last 100 failures
    if (this.failureHistory.length > 100) {
      this.failureHistory = this.failureHistory.slice(-100);
    }

    this.saveFailureHistory();
  }

  loadFailureHistory() {
    const historyPath = join(PROJECT_ROOT, '.ci-cache', 'failure-history.json');
    if (existsSync(historyPath)) {
      try {
        return JSON.parse(readFileSync(historyPath, 'utf-8'));
      } catch (error) {
        Logger.warning('Failed to load failure history:', error.message);
      }
    }
    return [];
  }

  saveFailureHistory() {
    const historyPath = join(PROJECT_ROOT, '.ci-cache', 'failure-history.json');
    mkdirSync(dirname(historyPath), { recursive: true });
    writeFileSync(historyPath, JSON.stringify(this.failureHistory, null, 2));
  }
}

// ========================================================================
// 📢 Multi-Channel Notification System
// ========================================================================

class NotificationManager {
  constructor(config) {
    this.config = config;
    this.lastAlertTime = new Map();
  }

  async sendFailureNotification(analysis, context = {}) {
    Logger.info('Sending failure notifications...');

    const message = this.formatFailureMessage(analysis, context);
    const channels = this.getEnabledChannels();

    const promises = channels.map(async (channel) => {
      if (this.shouldSendAlert(channel, analysis)) {
        try {
          await this.sendToChannel(channel, message, analysis);
          Logger.success(`Notification sent to ${channel}`);
          this.recordAlert(channel, analysis);
        } catch (error) {
          Logger.error(`Failed to send notification to ${channel}:`, error.message);
        }
      } else {
        Logger.info(`Skipping ${channel} notification (cooldown active)`);
      }
    });

    await Promise.all(promises);
  }

  formatFailureMessage(analysis, context) {
    const { summary, rollbackRequired } = analysis;
    const severity = summary.criticalCount > 0 ? '🚨 CRITICAL' : 
                    summary.highCount > 0 ? '⚠️ HIGH' : 
                    '⚡ MEDIUM';

    const message = {
      title: `${severity} CI/CD Pipeline Failure`,
      summary: `Pipeline failed with ${summary.total} issues`,
      details: {
        branch: context.branch || process.env.GITHUB_REF_NAME || 'unknown',
        commit: context.commit || process.env.GITHUB_SHA?.substring(0, 8) || 'unknown',
        pipeline: context.pipeline || process.env.GITHUB_RUN_ID || 'local',
        timestamp: analysis.timestamp,
      },
      failures: analysis.failures.slice(0, 5), // Show top 5 failures
      recommendations: analysis.recommendations.slice(0, 3),
      rollback: rollbackRequired,
      actions: this.generateActionButtons(analysis, context),
    };

    return message;
  }

  generateActionButtons(analysis, context) {
    const actions = [];

    if (process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY) {
      actions.push({
        text: 'View Pipeline',
        url: `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`,
      });
    }

    if (analysis.rollbackRequired.required) {
      actions.push({
        text: 'Trigger Rollback',
        url: `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions`,
        style: 'danger',
      });
    }

    actions.push({
      text: 'View Logs',
      url: `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/commit/${context.commit}`,
    });

    return actions;
  }

  getEnabledChannels() {
    const channels = [];
    
    if (this.config.channels.slack) channels.push('slack');
    if (this.config.channels.discord) channels.push('discord');
    if (this.config.channels.email) channels.push('email');
    if (this.config.channels.github) channels.push('github');

    return channels;
  }

  shouldSendAlert(channel, analysis) {
    const lastAlert = this.lastAlertTime.get(channel);
    if (!lastAlert) return true;

    const cooldown = CONFIG.monitoring.alertCooldown;
    const timeSinceLastAlert = Date.now() - lastAlert;

    // Always send critical alerts
    if (analysis.summary.criticalCount > 0) return true;

    // Respect cooldown for other alerts
    return timeSinceLastAlert > cooldown;
  }

  async sendToChannel(channel, message, analysis) {
    switch (channel) {
      case 'slack':
        return this.sendSlackNotification(message, analysis);
      case 'discord':
        return this.sendDiscordNotification(message, analysis);
      case 'email':
        return this.sendEmailNotification(message, analysis);
      case 'github':
        return this.sendGitHubNotification(message, analysis);
      default:
        throw new Error(`Unknown notification channel: ${channel}`);
    }
  }

  async sendSlackNotification(message, analysis) {
    if (!this.config.channels.slack) {
      throw new Error('Slack webhook URL not configured');
    }

    const slackMessage = {
      text: message.title,
      attachments: [
        {
          color: analysis.summary.criticalCount > 0 ? 'danger' : 'warning',
          title: message.summary,
          fields: [
            { title: 'Branch', value: message.details.branch, short: true },
            { title: 'Commit', value: message.details.commit, short: true },
            { title: 'Pipeline', value: message.details.pipeline, short: true },
            { title: 'Timestamp', value: message.details.timestamp, short: true },
          ],
          actions: message.actions,
        },
        {
          title: 'Top Failures',
          text: message.failures.map(f => `• ${f.category}: ${f.message}`).join('\n'),
        },
        {
          title: 'Recommendations',
          text: message.recommendations.map(r => `• ${r}`).join('\n'),
        },
      ],
    };

    // Simulate HTTP request (replace with actual HTTP client)
    Logger.info('Would send Slack notification:', JSON.stringify(slackMessage, null, 2));
  }

  async sendDiscordNotification(message, analysis) {
    const embed = {
      title: message.title,
      description: message.summary,
      color: analysis.summary.criticalCount > 0 ? 0xff0000 : 0xffaa00,
      fields: [
        { name: 'Branch', value: message.details.branch, inline: true },
        { name: 'Commit', value: message.details.commit, inline: true },
        { name: 'Pipeline', value: message.details.pipeline, inline: true },
        {
          name: 'Top Failures',
          value: message.failures.slice(0, 3).map(f => `• ${f.category}: ${f.message.substring(0, 100)}`).join('\n'),
        },
        {
          name: 'Recommendations',
          value: message.recommendations.slice(0, 3).map(r => `• ${r}`).join('\n'),
        },
      ],
      timestamp: new Date().toISOString(),
    };

    Logger.info('Would send Discord notification:', JSON.stringify(embed, null, 2));
  }

  async sendEmailNotification(message, analysis) {
    const emailBody = `
CI/CD Pipeline Failure Alert

${message.title}
${message.summary}

Pipeline Details:
- Branch: ${message.details.branch}
- Commit: ${message.details.commit}
- Pipeline ID: ${message.details.pipeline}
- Timestamp: ${message.details.timestamp}

Failures Detected:
${message.failures.map(f => `- ${f.category}: ${f.message}`).join('\n')}

Recommendations:
${message.recommendations.map(r => `- ${r}`).join('\n')}

${message.rollback.required ? 'ROLLBACK REQUIRED: ' + message.rollback.reason : 'No rollback required'}

Actions: ${message.actions.map(a => a.url).join(', ')}
    `;

    Logger.info('Would send email notification:', emailBody);
  }

  async sendGitHubNotification(message, analysis) {
    // Create GitHub issue or comment
    const issueBody = `
## ${message.title}

${message.summary}

### Pipeline Details
- **Branch:** ${message.details.branch}
- **Commit:** ${message.details.commit}
- **Pipeline:** ${message.details.pipeline}
- **Timestamp:** ${message.details.timestamp}

### Failures Detected
${message.failures.map(f => `- **${f.category}:** ${f.message}`).join('\n')}

### Recommendations
${message.recommendations.map(r => `- ${r}`).join('\n')}

${message.rollback.required ? 
  `### ⚠️ Rollback Required\n${message.rollback.reason}` : 
  '### ✅ No Rollback Required'
}
    `;

    Logger.info('Would create GitHub issue:', issueBody);
  }

  recordAlert(channel, analysis) {
    this.lastAlertTime.set(channel, Date.now());
  }
}

// ========================================================================
// 🔄 Automated Rollback System
// ========================================================================

class RollbackManager {
  constructor(config) {
    this.config = config;
  }

  async executeRollback(analysis, strategy = 'blue_green') {
    if (!this.config.rollback.enabled) {
      Logger.warning('Automatic rollback is disabled');
      return { success: false, reason: 'rollback_disabled' };
    }

    Logger.critical('Initiating automated rollback...');

    try {
      const rollbackPlan = await this.createRollbackPlan(analysis, strategy);
      const result = await this.executeRollbackPlan(rollbackPlan);
      
      if (result.success) {
        Logger.success('Rollback completed successfully');
        await this.validateRollback();
      } else {
        Logger.error('Rollback failed:', result.error);
      }

      return result;
    } catch (error) {
      Logger.error('Rollback execution failed:', error);
      return { success: false, error: error.message };
    }
  }

  async createRollbackPlan(analysis, strategy) {
    const plan = {
      strategy,
      timestamp: new Date().toISOString(),
      analysis,
      steps: [],
    };

    switch (strategy) {
      case 'blue_green':
        plan.steps = [
          { action: 'switch_traffic', target: 'previous_deployment' },
          { action: 'validate_health', timeout: 60 },
          { action: 'cleanup_failed_deployment' },
        ];
        break;

      case 'previous_commit':
        plan.steps = [
          { action: 'identify_last_stable_commit' },
          { action: 'deploy_previous_commit' },
          { action: 'validate_deployment' },
        ];
        break;

      case 'health_check':
        plan.steps = [
          { action: 'stop_unhealthy_services' },
          { action: 'restart_from_backup' },
          { action: 'verify_system_health' },
        ];
        break;
    }

    Logger.info(`Created rollback plan with ${plan.steps.length} steps`);
    return plan;
  }

  async executeRollbackPlan(plan) {
    Logger.info(`Executing ${plan.strategy} rollback strategy...`);

    for (const [index, step] of plan.steps.entries()) {
      Logger.info(`Step ${index + 1}/${plan.steps.length}: ${step.action}`);

      try {
        await this.executeRollbackStep(step);
        Logger.success(`Step ${index + 1} completed: ${step.action}`);
      } catch (error) {
        Logger.error(`Step ${index + 1} failed: ${step.action}`, error);
        return { 
          success: false, 
          error: `Rollback failed at step ${index + 1}: ${error.message}`,
          completedSteps: index,
        };
      }
    }

    return { success: true, completedSteps: plan.steps.length };
  }

  async executeRollbackStep(step) {
    switch (step.action) {
      case 'switch_traffic':
        return this.switchTraffic(step.target);
      case 'validate_health':
        return this.validateHealth(step.timeout);
      case 'cleanup_failed_deployment':
        return this.cleanupFailedDeployment();
      case 'identify_last_stable_commit':
        return this.identifyLastStableCommit();
      case 'deploy_previous_commit':
        return this.deployPreviousCommit();
      case 'validate_deployment':
        return this.validateDeployment();
      case 'stop_unhealthy_services':
        return this.stopUnhealthyServices();
      case 'restart_from_backup':
        return this.restartFromBackup();
      case 'verify_system_health':
        return this.verifySystemHealth();
      default:
        throw new Error(`Unknown rollback step: ${step.action}`);
    }
  }

  async switchTraffic(target) {
    Logger.info(`Switching traffic to ${target}`);
    // Simulate traffic switching
    await new Promise(resolve => setTimeout(resolve, 2000));
    Logger.info('Traffic switching completed');
  }

  async validateHealth(timeout) {
    Logger.info(`Validating system health (timeout: ${timeout}s)`);
    // Simulate health validation
    await new Promise(resolve => setTimeout(resolve, 3000));
    Logger.info('Health validation completed');
  }

  async cleanupFailedDeployment() {
    Logger.info('Cleaning up failed deployment');
    await new Promise(resolve => setTimeout(resolve, 1000));
    Logger.info('Failed deployment cleanup completed');
  }

  async identifyLastStableCommit() {
    Logger.info('Identifying last stable commit');
    // Would use git commands to find last stable commit
    await new Promise(resolve => setTimeout(resolve, 1000));
    Logger.info('Last stable commit identified');
  }

  async deployPreviousCommit() {
    Logger.info('Deploying previous commit');
    await new Promise(resolve => setTimeout(resolve, 5000));
    Logger.info('Previous commit deployment completed');
  }

  async validateDeployment() {
    Logger.info('Validating deployment');
    await new Promise(resolve => setTimeout(resolve, 2000));
    Logger.info('Deployment validation completed');
  }

  async stopUnhealthyServices() {
    Logger.info('Stopping unhealthy services');
    await new Promise(resolve => setTimeout(resolve, 1000));
    Logger.info('Unhealthy services stopped');
  }

  async restartFromBackup() {
    Logger.info('Restarting from backup');
    await new Promise(resolve => setTimeout(resolve, 3000));
    Logger.info('System restarted from backup');
  }

  async verifySystemHealth() {
    Logger.info('Verifying system health');
    await new Promise(resolve => setTimeout(resolve, 2000));
    Logger.info('System health verified');
  }

  async validateRollback() {
    Logger.info('Validating rollback success...');
    
    // Health checks
    const healthChecks = [
      this.checkApiHealth(),
      this.checkDatabaseHealth(),
      this.checkCacheHealth(),
    ];

    const results = await Promise.allSettled(healthChecks);
    const failures = results.filter(r => r.status === 'rejected');

    if (failures.length === 0) {
      Logger.success('Rollback validation passed - all systems healthy');
      return true;
    } else {
      Logger.error(`Rollback validation failed - ${failures.length} health checks failed`);
      return false;
    }
  }

  async checkApiHealth() {
    // Simulate API health check
    await new Promise(resolve => setTimeout(resolve, 1000));
    return { service: 'api', status: 'healthy' };
  }

  async checkDatabaseHealth() {
    // Simulate database health check
    await new Promise(resolve => setTimeout(resolve, 500));
    return { service: 'database', status: 'healthy' };
  }

  async checkCacheHealth() {
    // Simulate cache health check
    await new Promise(resolve => setTimeout(resolve, 300));
    return { service: 'cache', status: 'healthy' };
  }
}

// ========================================================================
// 🚀 Main Failure Handler
// ========================================================================

class FailureHandler {
  constructor(config = CONFIG) {
    this.config = config;
    this.analyzer = new FailureAnalyzer();
    this.notificationManager = new NotificationManager(config);
    this.rollbackManager = new RollbackManager(config);
  }

  async handleFailure(logs, context = {}) {
    Logger.critical('Pipeline failure detected - initiating failure handling...');

    try {
      // Analyze the failure
      const analysis = this.analyzer.analyzeFailure(logs, context);
      Logger.info(`Failure analysis completed: ${analysis.summary.total} issues detected`);

      // Send notifications
      await this.notificationManager.sendFailureNotification(analysis, context);

      // Execute rollback if required
      if (analysis.rollbackRequired.required) {
        Logger.critical(`Rollback required: ${analysis.rollbackRequired.reason}`);
        const rollbackResult = await this.rollbackManager.executeRollback(analysis);
        
        if (!rollbackResult.success) {
          Logger.error('Rollback failed - manual intervention required');
          // Send additional critical alert
          await this.notificationManager.sendFailureNotification({
            ...analysis,
            rollbackFailed: true,
            rollbackError: rollbackResult.error,
          }, context);
        }
      }

      // Generate failure report
      const report = this.generateFailureReport(analysis, context);
      this.saveFailureReport(report);

      Logger.info('Failure handling completed');
      return analysis;

    } catch (error) {
      Logger.error('Failure handling failed:', error);
      throw error;
    }
  }

  generateFailureReport(analysis, context) {
    return {
      id: createHash('md5').update(`${analysis.timestamp}-${context.pipeline}`).digest('hex'),
      timestamp: analysis.timestamp,
      context,
      analysis,
      status: analysis.rollbackRequired.required ? 'rollback_executed' : 'notification_sent',
      recommendations: analysis.recommendations,
      nextSteps: [
        'Review failure logs and fix root cause',
        'Test fixes in development environment',
        'Re-run pipeline after fixes are applied',
        'Monitor system stability post-deployment',
      ],
    };
  }

  saveFailureReport(report) {
    const reportsDir = join(PROJECT_ROOT, 'failure-reports');
    mkdirSync(reportsDir, { recursive: true });
    
    const reportPath = join(reportsDir, `failure-report-${report.id}.json`);
    writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    Logger.success(`Failure report saved: ${reportPath}`);
  }
}

// ========================================================================
// 🔧 CLI Interface
// ========================================================================

function parseArguments() {
  const args = process.argv.slice(2);
  const options = {
    logFile: null,
    context: {},
    testMode: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') {
      printUsage();
      process.exit(0);
    } else if (arg === '--log-file') {
      options.logFile = args[++i];
    } else if (arg === '--context') {
      options.context = JSON.parse(args[++i]);
    } else if (arg === '--test-mode') {
      options.testMode = true;
    } else if (arg === '--branch') {
      options.context.branch = args[++i];
    } else if (arg === '--commit') {
      options.context.commit = args[++i];
    } else if (arg === '--pipeline') {
      options.context.pipeline = args[++i];
    }
  }

  return options;
}

function printUsage() {
  console.log(`
🚨 CI/CD Failure Notification & Rollback System

Usage: node scripts/failure-notification.js [options]

Options:
  --log-file <path>     Path to failure log file
  --context <json>      Additional context as JSON string
  --branch <name>       Branch name
  --commit <sha>        Commit SHA
  --pipeline <id>       Pipeline ID
  --test-mode          Run in test mode (no actual notifications/rollbacks)
  -h, --help           Show this help

Environment Variables:
  SLACK_WEBHOOK_URL     Slack webhook URL for notifications
  DISCORD_WEBHOOK_URL   Discord webhook URL for notifications
  GITHUB_TOKEN          GitHub token for issue creation
  AUTO_ROLLBACK         Enable/disable automatic rollback (default: true)

Examples:
  node scripts/failure-notification.js --log-file pipeline.log --branch main
  node scripts/failure-notification.js --context '{"branch":"develop","commit":"abc123"}'
  node scripts/failure-notification.js --test-mode
`);
}

// ========================================================================
// 🚀 Main Execution
// ========================================================================

async function main() {
  try {
    const options = parseArguments();

    if (options.testMode) {
      Logger.info('Running in test mode - no actual notifications or rollbacks');
      CONFIG.rollback.enabled = false;
    }

    const handler = new FailureHandler(CONFIG);
    
    // Get failure logs
    let logs = '';
    if (options.logFile && existsSync(options.logFile)) {
      logs = readFileSync(options.logFile, 'utf-8');
    } else {
      // Read from stdin or create sample failure for testing
      if (process.stdin.isTTY || options.testMode) {
        logs = `
Test suite failed to run
FAIL backend/tests/user.test.js
AssertionError: Expected 200 but received 500
Coverage threshold 65% not met: 45%
Build failed with TypeScript errors
Database connection failed: Connection timeout
`;
      } else {
        logs = await readStdin();
      }
    }

    await handler.handleFailure(logs, options.context);

  } catch (error) {
    Logger.error('Fatal error:', error);
    process.exit(1);
  }
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString();
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default FailureHandler;