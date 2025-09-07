#!/usr/bin/env node

/**
 * Accessibility CI/CD Pipeline Runner for MediaNest
 * Orchestrates accessibility testing in different pipeline stages with comprehensive reporting
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, mkdir, readFile } from 'fs/promises';
import { join } from 'path';
import { 
  getConfigForEnvironment, 
  getConfigForPipelineStage, 
  validateCIConfig, 
  loadConfigFromEnvironment,
  AccessibilityCIConfig 
} from '../config/accessibility-ci-config';
import { AccessibilityReporter } from '../utils/accessibility-reporter';
import { HiveAccessibilityCoordinator } from '../utils/hive-accessibility-coordinator';

const execAsync = promisify(exec);

export class AccessibilityCIRunner {
  private config: AccessibilityCIConfig;
  private reporter: AccessibilityReporter;
  private hiveCoordinator: HiveAccessibilityCoordinator;
  private testResults: any[] = [];
  private exitCode: number = 0;

  constructor(environment?: string, pipelineStage?: string) {
    // Load base configuration
    if (pipelineStage) {
      const stageConfig = getConfigForPipelineStage(pipelineStage);
      this.config = { ...getConfigForEnvironment(environment || 'development'), ...stageConfig };
    } else {
      this.config = getConfigForEnvironment(environment || 'development');
    }

    // Override with environment variables
    const envConfig = loadConfigFromEnvironment();
    this.config = { ...this.config, ...envConfig };

    // Validate configuration
    const configErrors = validateCIConfig(this.config);
    if (configErrors.length > 0) {
      console.error('Configuration errors:', configErrors);
      process.exit(1);
    }

    this.reporter = new AccessibilityReporter('.medianest-e2e/reports/ci');
    this.hiveCoordinator = new HiveAccessibilityCoordinator(`ci-${Date.now()}`);

    console.log(`Accessibility CI Runner initialized for ${this.config.environment} environment`);
  }

  /**
   * Run complete accessibility testing pipeline
   */
  async runPipeline(): Promise<void> {
    const startTime = Date.now();
    console.log('🚀 Starting MediaNest Accessibility Testing Pipeline');
    
    try {
      await this.reporter.initialize();
      
      // Step 1: Setup and validation
      await this.setupEnvironment();
      
      // Step 2: Run accessibility tests
      await this.runAccessibilityTests();
      
      // Step 3: Process and analyze results
      await this.processResults();
      
      // Step 4: Generate reports
      await this.generateReports();
      
      // Step 5: Check failure thresholds
      await this.checkFailureThresholds();
      
      // Step 6: Send notifications
      await this.sendNotifications();
      
      // Step 7: Integration actions
      await this.performIntegrationActions();
      
      const duration = Date.now() - startTime;
      console.log(`✅ Accessibility testing pipeline completed in ${duration}ms`);
      
    } catch (error) {
      console.error('❌ Accessibility testing pipeline failed:', error);
      this.exitCode = 1;
      
      // Send failure notifications
      await this.sendFailureNotifications(error as Error);
      
    } finally {
      // Always export HIVE coordination data
      await this.exportHiveData();
      process.exit(this.exitCode);
    }
  }

  /**
   * Setup testing environment
   */
  private async setupEnvironment(): Promise<void> {
    console.log('🔧 Setting up testing environment...');
    
    // Create necessary directories
    await mkdir('.medianest-e2e/reports/ci', { recursive: true });
    await mkdir('.medianest-e2e/reports/screenshots', { recursive: true });
    
    // Check if application is running
    try {
      const { stdout } = await execAsync(`curl -f ${this.config.baseUrl}/health || echo "Health check failed"`);
      if (stdout.includes('Health check failed')) {
        throw new Error(`Application not available at ${this.config.baseUrl}`);
      }
      console.log(`✅ Application is available at ${this.config.baseUrl}`);
    } catch (error) {
      console.warn(`⚠️  Health check failed, proceeding anyway: ${error}`);
    }
    
    // Load previous HIVE state if enabled
    if (this.config.sessionPersistence) {
      const previousSessionId = process.env.PREVIOUS_A11Y_SESSION_ID;
      if (previousSessionId) {
        await this.hiveCoordinator.loadPreviousState(previousSessionId);
        console.log(`📂 Loaded previous HIVE state from session: ${previousSessionId}`);
      }
    }
  }

  /**
   * Run accessibility tests based on configuration
   */
  private async runAccessibilityTests(): Promise<void> {
    console.log(`🧪 Running accessibility tests (${this.config.testLevel} level)...`);
    
    const playwrightConfig = this.buildPlaywrightConfig();
    
    try {
      // Build Playwright command
      const cmd = this.buildPlaywrightCommand();
      console.log(`Executing: ${cmd}`);
      
      const { stdout, stderr } = await execAsync(cmd, { 
        maxBuffer: 1024 * 1024 * 10, // 10MB buffer
        timeout: this.config.timeout 
      });
      
      console.log('Test output:', stdout);
      if (stderr) {
        console.warn('Test warnings:', stderr);
      }
      
    } catch (error: any) {
      console.error('Test execution error:', error);
      
      // Don't fail immediately - we want to process any partial results
      if (error.code === 1) {
        console.log('Some tests failed, but continuing with result processing...');
        this.exitCode = 1;
      } else {
        throw error; // Re-throw for unexpected errors
      }
    }
  }

  /**
   * Build Playwright command for test execution
   */
  private buildPlaywrightCommand(): string {
    const baseCmd = 'npx playwright test';
    const options: string[] = [];
    
    // Add test files
    if (this.config.tests && this.config.tests.length > 0) {
      options.push(...this.config.tests);
    } else {
      options.push('specs/accessibility/');
    }
    
    // Add configuration options
    if (this.config.parallel) {
      options.push('--workers=auto');
    } else {
      options.push('--workers=1');
    }
    
    if (this.config.maxRetries > 0) {
      options.push(`--retries=${this.config.maxRetries}`);
    }
    
    // Add reporter
    options.push('--reporter=json');
    
    // Add timeout
    options.push(`--timeout=${this.config.timeout}`);
    
    return `${baseCmd} ${options.join(' ')}`;
  }

  /**
   * Build Playwright configuration
   */
  private buildPlaywrightConfig(): any {
    return {
      use: {
        baseURL: this.config.baseUrl,
        screenshot: this.config.autoScreenshots ? 'only-on-failure' : 'off',
        video: 'retain-on-failure'
      },
      timeout: this.config.timeout,
      retries: this.config.maxRetries,
      workers: this.config.parallel ? undefined : 1,
      reporter: [
        ['json', { outputFile: '.medianest-e2e/reports/ci/test-results.json' }],
        ['html', { open: 'never', outputFolder: '.medianest-e2e/reports/ci/html' }]
      ]
    };
  }

  /**
   * Process test results and extract accessibility data
   */
  private async processResults(): Promise<void> {
    console.log('📊 Processing accessibility test results...');
    
    try {
      // Read test results
      const resultsPath = '.medianest-e2e/reports/ci/test-results.json';
      const resultsData = await readFile(resultsPath, 'utf-8');
      const testResults = JSON.parse(resultsData);
      
      this.testResults = testResults.suites || [];
      
      // Process accessibility reports from test attachments
      await this.processAccessibilityAttachments(testResults);
      
      console.log(`✅ Processed ${this.testResults.length} test suites`);
      
    } catch (error) {
      console.warn('⚠️  Failed to process test results:', error);
      // Continue without detailed results
    }
  }

  /**
   * Process accessibility attachments from test results
   */
  private async processAccessibilityAttachments(testResults: any): Promise<void> {
    const specs = testResults.specs || [];
    
    for (const spec of specs) {
      for (const test of spec.tests || []) {
        for (const result of test.results || []) {
          for (const attachment of result.attachments || []) {
            if (attachment.name === 'accessibility-report.json') {
              try {
                const reportData = await readFile(attachment.path, 'utf-8');
                const accessibilityReport = JSON.parse(reportData);
                
                // Store in HIVE coordination
                await this.hiveCoordinator.storeTestResult(
                  accessibilityReport.url || spec.file,
                  accessibilityReport,
                  { testTitle: test.title }
                );
                
              } catch (error) {
                console.warn(`Failed to process accessibility report from ${attachment.path}:`, error);
              }
            }
          }
        }
      }
    }
  }

  /**
   * Generate comprehensive accessibility reports
   */
  private async generateReports(): Promise<void> {
    console.log('📈 Generating accessibility reports...');
    
    const insights = this.hiveCoordinator.generateCrossPageInsights();
    
    // Generate reports based on configured formats
    for (const format of this.config.reportFormats) {
      try {
        switch (format) {
          case 'html':
            await this.generateHtmlReport(insights);
            break;
          case 'json':
            await this.generateJsonReport(insights);
            break;
          case 'csv':
            await this.generateCsvReport(insights);
            break;
          case 'junit':
            await this.generateJunitReport(insights);
            break;
        }
      } catch (error) {
        console.warn(`Failed to generate ${format} report:`, error);
      }
    }
    
    // Upload reports if configured
    if (this.config.uploadReports && this.config.reportDestination) {
      await this.uploadReports();
    }
  }

  /**
   * Generate HTML report
   */
  private async generateHtmlReport(insights: any): Promise<void> {
    const htmlPath = await this.reporter.generateCrossPageReport(insights);
    console.log(`📄 HTML report generated: ${htmlPath}`);
  }

  /**
   * Generate JSON report
   */
  private async generateJsonReport(insights: any): Promise<void> {
    const reportData = {
      timestamp: new Date().toISOString(),
      environment: this.config.environment,
      config: this.config,
      insights,
      testResults: this.testResults.length,
      sessionStats: this.hiveCoordinator.getSessionStats()
    };
    
    const jsonPath = join('.medianest-e2e/reports/ci', 'accessibility-report.json');
    await writeFile(jsonPath, JSON.stringify(reportData, null, 2));
    console.log(`📄 JSON report generated: ${jsonPath}`);
  }

  /**
   * Generate CSV report
   */
  private async generateCsvReport(insights: any): Promise<void> {
    const csvPath = await this.reporter.generateCsvReport(
      insights.pagesByScore.map((page: any) => ({
        url: page.url,
        timestamp: page.timestamp,
        overallScore: page.score,
        summary: {
          totalViolations: page.violations,
          criticalIssues: page.criticalIssues,
          keyboardAccessibilityRate: 0, // Would need to be populated from actual reports
          contrastPassRate: 0,
          hasProperLandmarks: true,
          hasFocusManagement: true
        }
      })),
      'ci-accessibility-summary'
    );
    console.log(`📄 CSV report generated: ${csvPath}`);
  }

  /**
   * Generate JUnit XML report for CI systems
   */
  private async generateJunitReport(insights: any): Promise<void> {
    const testSuites = this.testResults.map(suite => ({
      name: suite.title || 'Accessibility Tests',
      tests: suite.specs?.length || 0,
      failures: suite.specs?.filter((s: any) => s.ok === false).length || 0,
      time: (suite.duration || 0) / 1000
    }));
    
    const junitXml = this.buildJunitXml(testSuites, insights);
    const junitPath = join('.medianest-e2e/reports/ci', 'accessibility-junit.xml');
    
    await writeFile(junitPath, junitXml);
    console.log(`📄 JUnit report generated: ${junitPath}`);
  }

  /**
   * Build JUnit XML format
   */
  private buildJunitXml(testSuites: any[], insights: any): string {
    const totalTests = testSuites.reduce((sum, suite) => sum + suite.tests, 0);
    const totalFailures = testSuites.reduce((sum, suite) => sum + suite.failures, 0);
    const totalTime = testSuites.reduce((sum, suite) => sum + suite.time, 0);
    
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += `<testsuites name="Accessibility Tests" tests="${totalTests}" failures="${totalFailures}" time="${totalTime}">\n`;
    
    testSuites.forEach(suite => {
      xml += `  <testsuite name="${suite.name}" tests="${suite.tests}" failures="${suite.failures}" time="${suite.time}">\n`;
      
      // Add overall accessibility score as a test case
      const scoreTest = insights.averageScore >= this.config.failureThresholds.overallScore;
      xml += `    <testcase name="Overall Accessibility Score" time="0">\n`;
      if (!scoreTest) {
        xml += `      <failure message="Accessibility score ${insights.averageScore} below threshold ${this.config.failureThresholds.overallScore}"></failure>\n`;
      }
      xml += `    </testcase>\n`;
      
      xml += `  </testsuite>\n`;
    });
    
    xml += '</testsuites>';
    return xml;
  }

  /**
   * Upload reports to configured destination
   */
  private async uploadReports(): Promise<void> {
    if (!this.config.reportDestination) return;
    
    console.log(`📤 Uploading reports to ${this.config.reportDestination}...`);
    
    try {
      // This would typically use AWS SDK or other cloud storage APIs
      // For now, we'll just log the action
      console.log(`Reports would be uploaded to: ${this.config.reportDestination}`);
      
      // Example AWS S3 upload (commented out - would need AWS SDK)
      /*
      const AWS = require('aws-sdk');
      const s3 = new AWS.S3();
      
      const files = await glob('.medianest-e2e/reports/ci/**/*');
      for (const file of files) {
        const key = file.replace('.medianest-e2e/reports/ci/', '');
        await s3.upload({
          Bucket: this.config.reportDestination.replace('s3://', ''),
          Key: key,
          Body: await readFile(file)
        }).promise();
      }
      */
      
    } catch (error) {
      console.warn('Failed to upload reports:', error);
    }
  }

  /**
   * Check failure thresholds and set exit code
   */
  private async checkFailureThresholds(): Promise<void> {
    console.log('🎯 Checking failure thresholds...');
    
    const insights = this.hiveCoordinator.generateCrossPageInsights();
    const violations = this.hiveCoordinator.getSharedViolations();
    
    let failures: string[] = [];
    
    // Check overall score
    if (insights.averageScore < this.config.failureThresholds.overallScore) {
      failures.push(`Overall accessibility score ${insights.averageScore} below threshold ${this.config.failureThresholds.overallScore}`);
      this.exitCode = 1;
    }
    
    // Check critical violations
    const criticalViolations = violations.filter(v => v.impact === 'critical');
    if (criticalViolations.length > this.config.failureThresholds.criticalViolations) {
      failures.push(`${criticalViolations.length} critical violations exceed threshold ${this.config.failureThresholds.criticalViolations}`);
      this.exitCode = 1;
    }
    
    // Check serious violations
    const seriousViolations = violations.filter(v => v.impact === 'serious');
    if (seriousViolations.length > this.config.failureThresholds.seriousViolations) {
      failures.push(`${seriousViolations.length} serious violations exceed threshold ${this.config.failureThresholds.seriousViolations}`);
      this.exitCode = 1;
    }
    
    // Check regression if enabled
    if (this.config.regressionTesting) {
      const regressions = await this.checkRegressions();
      if (regressions.length > this.config.failureThresholds.regressionThreshold) {
        failures.push(`${regressions.length} regressions exceed threshold ${this.config.failureThresholds.regressionThreshold}`);
        this.exitCode = 1;
      }
    }
    
    if (failures.length > 0) {
      console.log('❌ Failure thresholds exceeded:');
      failures.forEach(failure => console.log(`  - ${failure}`));
    } else {
      console.log('✅ All thresholds passed');
    }
  }

  /**
   * Check for accessibility regressions
   */
  private async checkRegressions(): Promise<any[]> {
    // This would compare against a baseline stored in the CI system
    // For now, return empty array
    return [];
  }

  /**
   * Send notifications based on configuration
   */
  private async sendNotifications(): Promise<void> {
    const insights = this.hiveCoordinator.generateCrossPageInsights();
    
    if (this.config.slackNotifications) {
      await this.sendSlackNotification(insights);
    }
  }

  /**
   * Send Slack notification
   */
  private async sendSlackNotification(insights: any): Promise<void> {
    if (!this.config.slackNotifications?.webhookUrl) return;
    
    const shouldNotify = this.shouldSendNotification();
    if (!shouldNotify) return;
    
    const color = this.exitCode === 0 ? 'good' : 'danger';
    const emoji = this.exitCode === 0 ? '✅' : '❌';
    
    const message = {
      channel: this.config.slackNotifications.channel,
      username: 'Accessibility CI Bot',
      icon_emoji: ':wheelchair:',
      attachments: [{
        color,
        title: `${emoji} MediaNest Accessibility Testing - ${this.config.environment}`,
        fields: [
          {
            title: 'Overall Score',
            value: `${insights.averageScore.toFixed(1)}/100`,
            short: true
          },
          {
            title: 'Pages Tested',
            value: insights.totalPagesTesteds.toString(),
            short: true
          },
          {
            title: 'Total Violations',
            value: insights.mostCommonViolations.length.toString(),
            short: true
          },
          {
            title: 'Status',
            value: this.exitCode === 0 ? 'Passed' : 'Failed',
            short: true
          }
        ],
        footer: `Environment: ${this.config.environment} | Session: ${this.hiveCoordinator.getSessionStats().sessionId}`
      }]
    };
    
    // Add mentions if configured
    if (this.config.slackNotifications.mentionUsers) {
      message.text = this.config.slackNotifications.mentionUsers.join(' ');
    }
    
    try {
      const response = await fetch(this.config.slackNotifications.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message)
      });
      
      if (response.ok) {
        console.log('✅ Slack notification sent');
      } else {
        console.warn('⚠️  Failed to send Slack notification:', response.statusText);
      }
    } catch (error) {
      console.warn('⚠️  Failed to send Slack notification:', error);
    }
  }

  /**
   * Determine if notification should be sent based on configuration
   */
  private shouldSendNotification(): boolean {
    const config = this.config.slackNotifications;
    if (!config) return false;
    
    const insights = this.hiveCoordinator.generateCrossPageInsights();
    
    // Check notification triggers
    if (this.exitCode !== 0 && config.notifyOn.includes('failure')) return true;
    if (config.notifyOn.includes('summary')) return true;
    
    // Check for improvements
    if (config.notifyOn.includes('improvement') && insights.performanceTrends.trend === 'improving') return true;
    
    // Check for regressions
    if (config.notifyOn.includes('regression') && insights.performanceTrends.trend === 'declining') return true;
    
    return false;
  }

  /**
   * Perform integration actions (GitHub, JIRA, etc.)
   */
  private async performIntegrationActions(): Promise<void> {
    if (this.config.githubIntegration) {
      await this.performGitHubIntegration();
    }
    
    if (this.config.jiraIntegration) {
      await this.performJiraIntegration();
    }
  }

  /**
   * Perform GitHub integration actions
   */
  private async performGitHubIntegration(): Promise<void> {
    console.log('🐙 Performing GitHub integration actions...');
    
    // This would use GitHub API to:
    // - Update status checks
    // - Create PR comments
    // - Create issues for critical violations
    
    console.log('GitHub integration would be performed here');
  }

  /**
   * Perform JIRA integration actions
   */
  private async performJiraIntegration(): Promise<void> {
    console.log('📋 Performing JIRA integration actions...');
    
    // This would use JIRA API to:
    // - Create issues for critical/serious violations
    // - Update existing accessibility issues
    
    console.log('JIRA integration would be performed here');
  }

  /**
   * Send failure notifications
   */
  private async sendFailureNotifications(error: Error): Promise<void> {
    if (this.config.slackNotifications) {
      const message = {
        channel: this.config.slackNotifications.channel,
        username: 'Accessibility CI Bot',
        icon_emoji: ':wheelchair:',
        text: `❌ MediaNest Accessibility Testing Pipeline Failed - ${this.config.environment}`,
        attachments: [{
          color: 'danger',
          title: 'Pipeline Failure',
          text: error.message,
          footer: `Environment: ${this.config.environment}`
        }]
      };
      
      try {
        await fetch(this.config.slackNotifications.webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(message)
        });
      } catch (notificationError) {
        console.warn('Failed to send failure notification:', notificationError);
      }
    }
  }

  /**
   * Export HIVE coordination data
   */
  private async exportHiveData(): Promise<void> {
    try {
      const exportPath = await this.hiveCoordinator.exportCoordinationData();
      console.log(`📊 HIVE coordination data exported: ${exportPath}`);
      
      // Set environment variable for next run
      if (this.config.sessionPersistence) {
        console.log(`Export A11Y_SESSION_ID=${this.hiveCoordinator.getSessionStats().sessionId} for next run`);
      }
    } catch (error) {
      console.warn('Failed to export HIVE data:', error);
    }
  }
}

// CLI entry point
if (require.main === module) {
  const args = process.argv.slice(2);
  const environment = args[0] || process.env.NODE_ENV || 'development';
  const pipelineStage = args[1] || process.env.CI_PIPELINE_STAGE;
  
  const runner = new AccessibilityCIRunner(environment, pipelineStage);
  runner.runPipeline().catch((error) => {
    console.error('Pipeline execution failed:', error);
    process.exit(1);
  });
}

export default AccessibilityCIRunner;