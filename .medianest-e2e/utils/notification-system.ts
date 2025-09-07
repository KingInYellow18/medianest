/**
 * Comprehensive Notification System for MediaNest E2E Tests
 * HIVE-MIND Enhanced Multi-Channel Alert and Reporting System
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

export interface NotificationConfig {
  channels: {
    slack?: {
      webhookUrl: string;
      channels: {
        general: string;
        performance: string;
        critical: string;
        nightly: string;
      };
    };
    email?: {
      smtp: {
        host: string;
        port: number;
        secure: boolean;
        username: string;
        password: string;
      };
      recipients: {
        developers: string[];
        qa: string[];
        stakeholders: string[];
        performanceTeam: string[];
      };
    };
    github?: {
      token: string;
      repository: string;
    };
    teams?: {
      webhookUrl: string;
      channels: string[];
    };
    discord?: {
      webhookUrl: string;
      channels: string[];
    };
  };
  rules: NotificationRule[];
  templates: NotificationTemplate[];
}

export interface NotificationRule {
  id: string;
  name: string;
  triggers: NotificationTrigger[];
  conditions: NotificationCondition[];
  channels: string[];
  priority: 'low' | 'medium' | 'high' | 'critical';
  throttle?: {
    enabled: boolean;
    duration: number; // minutes
    maxNotifications: number;
  };
}

export interface NotificationTrigger {
  type: 'test_failure' | 'performance_regression' | 'compatibility_issue' | 'build_complete' | 'flaky_test' | 'accessibility_violation';
  threshold?: number;
  metric?: string;
}

export interface NotificationCondition {
  field: string;
  operator: 'gt' | 'lt' | 'eq' | 'contains' | 'in';
  value: any;
}

export interface NotificationTemplate {
  id: string;
  type: 'slack' | 'email' | 'github' | 'teams' | 'discord';
  subject?: string;
  body: string;
  attachments?: string[];
}

export interface NotificationPayload {
  sessionId: string;
  buildNumber: string;
  branch: string;
  environment: string;
  timestamp: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  data: any;
  metadata: {
    testResults?: any;
    performanceData?: any;
    compatibilityIssues?: any;
    regressions?: any;
  };
}

export class NotificationSystem {
  private config: NotificationConfig;
  private sessionId: string;
  private throttleHistory: Map<string, number[]> = new Map();

  constructor(config: NotificationConfig, sessionId?: string) {
    this.config = config;
    this.sessionId = sessionId || `notify-${Date.now()}`;
    
    this.ensureDirectories();
  }

  private ensureDirectories(): void {
    const dirs = ['reports/notifications', 'reports/notifications/history'];
    dirs.forEach(dir => {
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
    });
  }

  /**
   * Process and send notifications based on test results and rules
   */
  async sendNotifications(payload: NotificationPayload): Promise<void> {
    console.log(`📨 Processing notifications for ${payload.type}...`);
    
    try {
      // Evaluate notification rules
      const applicableRules = await this.evaluateRules(payload);
      
      for (const rule of applicableRules) {
        // Check throttling
        if (this.isThrottled(rule)) {
          console.log(`⏸️ Notification throttled for rule: ${rule.name}`);
          continue;
        }

        // Send notifications to configured channels
        for (const channelType of rule.channels) {
          await this.sendToChannel(channelType, payload, rule);
        }

        // Update throttle history
        this.updateThrottleHistory(rule);
      }

      // Log notification history
      await this.logNotificationHistory(payload, applicableRules);
      
      console.log(`✅ Notifications processed successfully`);
      
    } catch (error) {
      console.error('❌ Failed to send notifications:', error);
      throw error;
    }
  }

  /**
   * Evaluate notification rules against payload
   */
  private async evaluateRules(payload: NotificationPayload): Promise<NotificationRule[]> {
    const applicableRules: NotificationRule[] = [];

    for (const rule of this.config.rules) {
      // Check triggers
      const triggerMatches = rule.triggers.some(trigger => this.evaluateTrigger(trigger, payload));
      
      if (!triggerMatches) continue;

      // Check conditions
      const conditionMatches = rule.conditions.length === 0 || 
        rule.conditions.every(condition => this.evaluateCondition(condition, payload));

      if (conditionMatches) {
        applicableRules.push(rule);
      }
    }

    return applicableRules.sort((a, b) => this.getPriorityWeight(b.priority) - this.getPriorityWeight(a.priority));
  }

  private evaluateTrigger(trigger: NotificationTrigger, payload: NotificationPayload): boolean {
    switch (trigger.type) {
      case 'test_failure':
        return payload.type === 'test_failure' && 
               (trigger.threshold === undefined || payload.data?.failedTests >= trigger.threshold);
      
      case 'performance_regression':
        return payload.type === 'performance_regression' &&
               (trigger.threshold === undefined || payload.data?.regressionPercent >= trigger.threshold);
      
      case 'compatibility_issue':
        return payload.type === 'compatibility_issue' &&
               (trigger.threshold === undefined || payload.data?.issuesCount >= trigger.threshold);
      
      case 'build_complete':
        return payload.type === 'build_complete';
      
      case 'flaky_test':
        return payload.type === 'flaky_test' &&
               (trigger.threshold === undefined || payload.data?.flakyTests >= trigger.threshold);
      
      case 'accessibility_violation':
        return payload.type === 'accessibility_violation' &&
               (trigger.threshold === undefined || payload.data?.violations >= trigger.threshold);
      
      default:
        return false;
    }
  }

  private evaluateCondition(condition: NotificationCondition, payload: NotificationPayload): boolean {
    const value = this.getValueFromPayload(condition.field, payload);
    
    switch (condition.operator) {
      case 'gt': return Number(value) > Number(condition.value);
      case 'lt': return Number(value) < Number(condition.value);
      case 'eq': return value === condition.value;
      case 'contains': return String(value).includes(String(condition.value));
      case 'in': return Array.isArray(condition.value) && condition.value.includes(value);
      default: return false;
    }
  }

  private getValueFromPayload(field: string, payload: NotificationPayload): any {
    const paths = field.split('.');
    let value: any = payload;
    
    for (const path of paths) {
      value = value?.[path];
    }
    
    return value;
  }

  private getPriorityWeight(priority: string): number {
    switch (priority) {
      case 'critical': return 4;
      case 'high': return 3;
      case 'medium': return 2;
      case 'low': return 1;
      default: return 0;
    }
  }

  /**
   * Check if rule is throttled
   */
  private isThrottled(rule: NotificationRule): boolean {
    if (!rule.throttle?.enabled) return false;

    const ruleHistory = this.throttleHistory.get(rule.id) || [];
    const now = Date.now();
    const windowStart = now - (rule.throttle.duration * 60 * 1000);
    
    const recentNotifications = ruleHistory.filter(timestamp => timestamp > windowStart);
    
    return recentNotifications.length >= rule.throttle.maxNotifications;
  }

  private updateThrottleHistory(rule: NotificationRule): void {
    if (!rule.throttle?.enabled) return;

    const history = this.throttleHistory.get(rule.id) || [];
    history.push(Date.now());
    
    // Keep only recent history
    const windowStart = Date.now() - (rule.throttle.duration * 60 * 1000);
    const filteredHistory = history.filter(timestamp => timestamp > windowStart);
    
    this.throttleHistory.set(rule.id, filteredHistory);
  }

  /**
   * Send notification to specific channel
   */
  private async sendToChannel(channelType: string, payload: NotificationPayload, rule: NotificationRule): Promise<void> {
    switch (channelType) {
      case 'slack':
        await this.sendSlackNotification(payload, rule);
        break;
      case 'email':
        await this.sendEmailNotification(payload, rule);
        break;
      case 'github':
        await this.sendGitHubNotification(payload, rule);
        break;
      case 'teams':
        await this.sendTeamsNotification(payload, rule);
        break;
      case 'discord':
        await this.sendDiscordNotification(payload, rule);
        break;
      default:
        console.warn(`Unknown notification channel: ${channelType}`);
    }
  }

  /**
   * Send Slack notification
   */
  private async sendSlackNotification(payload: NotificationPayload, rule: NotificationRule): Promise<void> {
    if (!this.config.channels.slack) return;

    const template = this.getTemplate('slack', payload.type);
    const message = this.renderTemplate(template, payload);
    
    const slackPayload = {
      text: payload.title,
      attachments: [{
        color: this.getSeverityColor(payload.severity),
        title: payload.title,
        text: message,
        fields: [
          { title: 'Build', value: payload.buildNumber, short: true },
          { title: 'Branch', value: payload.branch, short: true },
          { title: 'Environment', value: payload.environment, short: true },
          { title: 'Session', value: payload.sessionId, short: true }
        ],
        footer: 'MediaNest E2E Tests',
        ts: Math.floor(new Date(payload.timestamp).getTime() / 1000)
      }]
    };

    // Choose appropriate channel
    const channel = this.selectSlackChannel(payload.type, payload.severity);
    
    try {
      const response = await fetch(this.config.channels.slack.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...slackPayload, channel })
      });

      if (!response.ok) {
        throw new Error(`Slack API error: ${response.status}`);
      }

      console.log(`📱 Slack notification sent to ${channel}`);
    } catch (error) {
      console.error('Failed to send Slack notification:', error);
    }
  }

  private selectSlackChannel(type: string, severity: string): string {
    const channels = this.config.channels.slack?.channels;
    if (!channels) return '#general';

    if (severity === 'critical') return channels.critical;
    if (type.includes('performance')) return channels.performance;
    if (type.includes('nightly')) return channels.nightly;
    
    return channels.general;
  }

  /**
   * Send email notification
   */
  private async sendEmailNotification(payload: NotificationPayload, rule: NotificationRule): Promise<void> {
    if (!this.config.channels.email) return;

    const template = this.getTemplate('email', payload.type);
    const subject = this.renderTemplate({ body: template?.subject || payload.title }, payload);
    const body = this.renderTemplate(template, payload);
    
    const recipients = this.selectEmailRecipients(payload.type, payload.severity);
    
    try {
      // Use a simple mail sending approach (in production, use a proper email service)
      const mailCommand = `echo "${body}" | mail -s "${subject}" ${recipients.join(' ')}`;
      execSync(mailCommand, { stdio: 'pipe' });
      
      console.log(`📧 Email notification sent to ${recipients.length} recipients`);
    } catch (error) {
      console.warn('Failed to send email notification:', error);
    }
  }

  private selectEmailRecipients(type: string, severity: string): string[] {
    const recipients = this.config.channels.email?.recipients;
    if (!recipients) return [];

    let selected: string[] = [];
    
    if (severity === 'critical' || severity === 'high') {
      selected.push(...recipients.developers, ...recipients.qa);
    }
    
    if (type.includes('performance')) {
      selected.push(...recipients.performanceTeam);
    }
    
    if (type.includes('build_complete')) {
      selected.push(...recipients.stakeholders);
    }
    
    return [...new Set(selected)]; // Remove duplicates
  }

  /**
   * Send GitHub notification (issue/comment)
   */
  private async sendGitHubNotification(payload: NotificationPayload, rule: NotificationRule): Promise<void> {
    if (!this.config.channels.github) return;

    const template = this.getTemplate('github', payload.type);
    const body = this.renderTemplate(template, payload);
    
    try {
      // Create GitHub issue for critical failures
      if (payload.severity === 'critical') {
        const issueData = {
          title: `🚨 ${payload.title}`,
          body,
          labels: ['bug', 'e2e-tests', `severity-${payload.severity}`]
        };

        execSync(`gh issue create --title "${issueData.title}" --body "${body}" --label "${issueData.labels.join(',')}"`, {
          stdio: 'pipe'
        });
        
        console.log('📝 GitHub issue created for critical failure');
      }
    } catch (error) {
      console.warn('Failed to send GitHub notification:', error);
    }
  }

  /**
   * Send Teams notification
   */
  private async sendTeamsNotification(payload: NotificationPayload, rule: NotificationRule): Promise<void> {
    if (!this.config.channels.teams) return;

    const template = this.getTemplate('teams', payload.type);
    const message = this.renderTemplate(template, payload);
    
    const teamsPayload = {
      '@type': 'MessageCard',
      '@context': 'http://schema.org/extensions',
      themeColor: this.getSeverityColor(payload.severity),
      summary: payload.title,
      sections: [{
        activityTitle: payload.title,
        activitySubtitle: `${payload.environment} - Build ${payload.buildNumber}`,
        text: message,
        facts: [
          { name: 'Branch', value: payload.branch },
          { name: 'Session', value: payload.sessionId },
          { name: 'Severity', value: payload.severity }
        ]
      }]
    };

    try {
      const response = await fetch(this.config.channels.teams.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(teamsPayload)
      });

      if (!response.ok) {
        throw new Error(`Teams API error: ${response.status}`);
      }

      console.log('💼 Teams notification sent');
    } catch (error) {
      console.error('Failed to send Teams notification:', error);
    }
  }

  /**
   * Send Discord notification
   */
  private async sendDiscordNotification(payload: NotificationPayload, rule: NotificationRule): Promise<void> {
    if (!this.config.channels.discord) return;

    const template = this.getTemplate('discord', payload.type);
    const message = this.renderTemplate(template, payload);
    
    const discordPayload = {
      embeds: [{
        title: payload.title,
        description: message,
        color: parseInt(this.getSeverityColor(payload.severity).replace('#', ''), 16),
        fields: [
          { name: 'Build', value: payload.buildNumber, inline: true },
          { name: 'Branch', value: payload.branch, inline: true },
          { name: 'Environment', value: payload.environment, inline: true }
        ],
        timestamp: payload.timestamp,
        footer: { text: 'MediaNest E2E Tests' }
      }]
    };

    try {
      const response = await fetch(this.config.channels.discord.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(discordPayload)
      });

      if (!response.ok) {
        throw new Error(`Discord API error: ${response.status}`);
      }

      console.log('🎮 Discord notification sent');
    } catch (error) {
      console.error('Failed to send Discord notification:', error);
    }
  }

  /**
   * Get notification template
   */
  private getTemplate(type: string, notificationType: string): NotificationTemplate | undefined {
    return this.config.templates.find(t => t.type === type && t.id.includes(notificationType)) ||
           this.config.templates.find(t => t.type === type && t.id === 'default');
  }

  /**
   * Render template with payload data
   */
  private renderTemplate(template: NotificationTemplate | undefined, payload: NotificationPayload): string {
    if (!template) return payload.message;

    let rendered = template.body;
    
    // Replace variables in template
    const variables = {
      ...payload,
      ...payload.data,
      ...payload.metadata
    };

    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      rendered = rendered.replace(regex, String(value || ''));
    }

    return rendered;
  }

  /**
   * Get severity color for UI
   */
  private getSeverityColor(severity: string): string {
    switch (severity) {
      case 'critical': return '#dc3545';
      case 'high': return '#fd7e14';
      case 'medium': return '#ffc107';
      case 'low': return '#17a2b8';
      default: return '#6c757d';
    }
  }

  /**
   * Log notification history
   */
  private async logNotificationHistory(payload: NotificationPayload, rules: NotificationRule[]): Promise<void> {
    const historyEntry = {
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      payload,
      appliedRules: rules.map(r => r.id),
      channels: rules.flatMap(r => r.channels)
    };

    const historyPath = join('reports/notifications/history', `${payload.sessionId}.json`);
    
    let history: any[] = [];
    if (existsSync(historyPath)) {
      try {
        history = JSON.parse(readFileSync(historyPath, 'utf8'));
      } catch (error) {
        console.warn('Failed to read notification history:', error);
      }
    }

    history.push(historyEntry);
    writeFileSync(historyPath, JSON.stringify(history, null, 2));
  }
}

/**
 * Default notification configuration
 */
export const defaultNotificationConfig: NotificationConfig = {
  channels: {
    slack: {
      webhookUrl: process.env.SLACK_WEBHOOK_URL || '',
      channels: {
        general: '#medianest-e2e',
        performance: '#medianest-performance',
        critical: '#medianest-critical',
        nightly: '#medianest-nightly'
      }
    }
  },
  rules: [
    {
      id: 'critical-failures',
      name: 'Critical Test Failures',
      triggers: [{ type: 'test_failure', threshold: 5 }],
      conditions: [{ field: 'severity', operator: 'eq', value: 'critical' }],
      channels: ['slack', 'email'],
      priority: 'critical',
      throttle: { enabled: true, duration: 30, maxNotifications: 2 }
    },
    {
      id: 'performance-regression',
      name: 'Performance Regression',
      triggers: [{ type: 'performance_regression', threshold: 20 }],
      conditions: [],
      channels: ['slack', 'email'],
      priority: 'high',
      throttle: { enabled: true, duration: 60, maxNotifications: 1 }
    },
    {
      id: 'compatibility-issues',
      name: 'Cross-Browser Compatibility Issues',
      triggers: [{ type: 'compatibility_issue', threshold: 3 }],
      conditions: [],
      channels: ['slack'],
      priority: 'medium',
      throttle: { enabled: true, duration: 120, maxNotifications: 1 }
    },
    {
      id: 'nightly-summary',
      name: 'Nightly Test Summary',
      triggers: [{ type: 'build_complete' }],
      conditions: [{ field: 'type', operator: 'contains', value: 'nightly' }],
      channels: ['slack'],
      priority: 'low'
    }
  ],
  templates: [
    {
      id: 'slack-test-failure',
      type: 'slack',
      body: `🚨 Test failures detected in {{environment}} environment\n\n` +
            `Failed tests: {{failedTests}}\n` +
            `Success rate: {{successRate}}%\n` +
            `Build: #{{buildNumber}} ({{branch}})\n\n` +
            `Dashboard: {{dashboardUrl}}`
    },
    {
      id: 'email-performance-regression',
      type: 'email',
      subject: 'Performance Regression Detected - {{environment}}',
      body: `Performance regression detected in {{environment}} environment.\n\n` +
            `Regression: {{regressionPercent}}%\n` +
            `Affected metrics: {{affectedMetrics}}\n` +
            `Build: #{{buildNumber}} ({{branch}})\n\n` +
            `Please investigate and address the performance issues.`
    }
  ]
};

export default NotificationSystem;