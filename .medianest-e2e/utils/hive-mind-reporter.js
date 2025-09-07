/**
 * HIVE-MIND Enhanced Playwright Reporter
 * Real-time Test Coordination and Analytics Integration
 */

const { execSync } = require('child_process');
const { writeFileSync, mkdirSync, existsSync } = require('fs');
const path = require('path');

class HiveMindReporter {
  constructor(options = {}) {
    this.sessionId = options.sessionId || `reporter-${Date.now()}`;
    this.enableNotifications = options.enableNotifications || false;
    this.enableAnalytics = options.enableAnalytics || true;
    this.outputDir = path.join('.medianest-e2e', 'reports', 'hive-mind');
    
    this.testResults = [];
    this.startTime = Date.now();
    this.suiteResults = new Map();
    
    this.ensureOutputDir();
    this.initializeHiveSession();
  }

  ensureOutputDir() {
    if (!existsSync(this.outputDir)) {
      mkdirSync(this.outputDir, { recursive: true });
    }
  }

  initializeHiveSession() {
    if (this.enableAnalytics) {
      try {
        execSync(`npx claude-flow@alpha hooks pre-task --description "Test Execution Session: ${this.sessionId}"`, {
          stdio: 'pipe'
        });
        console.log(`🧠 HIVE-MIND reporter initialized: ${this.sessionId}`);
      } catch (error) {
        console.warn('Failed to initialize HIVE session:', error.message);
      }
    }
  }

  onBegin(config, suite) {
    this.config = config;
    this.totalTests = suite.allTests().length;
    
    console.log(`🎭 MediaNest E2E Test Execution Started`);
    console.log(`📊 Total Tests: ${this.totalTests}`);
    console.log(`🧠 HIVE Session: ${this.sessionId}`);
    
    // Store session metadata
    this.sessionMetadata = {
      sessionId: this.sessionId,
      startTime: new Date().toISOString(),
      totalTests: this.totalTests,
      environment: process.env.NODE_ENV || 'development',
      branch: process.env.GITHUB_REF_NAME || 'local',
      buildNumber: process.env.GITHUB_RUN_NUMBER || '0',
      config: {
        workers: config.workers,
        retries: config.retries,
        timeout: config.timeout
      }
    };

    this.updateHiveMemory('session-start', this.sessionMetadata);
  }

  onTestBegin(test) {
    const testInfo = {
      testId: `${test.parent.file}::${test.title}`,
      testName: test.title,
      testFile: test.parent.file,
      project: test.parent.project.name,
      startTime: Date.now(),
      status: 'running'
    };

    this.updateHiveMemory('test-start', testInfo);
  }

  onTestEnd(test, result) {
    const testInfo = {
      testId: `${test.parent.file}::${test.title}`,
      testName: test.title,
      testFile: test.parent.file,
      project: test.parent.project.name,
      status: result.status,
      duration: result.duration,
      error: result.error?.message,
      retry: result.retry,
      attachments: result.attachments?.map(a => ({
        name: a.name,
        path: a.path,
        contentType: a.contentType
      }))
    };

    this.testResults.push(testInfo);

    // Update suite-level results
    const suiteKey = test.parent.file;
    if (!this.suiteResults.has(suiteKey)) {
      this.suiteResults.set(suiteKey, {
        file: suiteKey,
        tests: [],
        passed: 0,
        failed: 0,
        skipped: 0,
        flaky: 0
      });
    }

    const suite = this.suiteResults.get(suiteKey);
    suite.tests.push(testInfo);
    suite[result.status]++;

    // Real-time analytics update
    this.updateHiveMemory('test-end', testInfo);

    // Check for immediate issues
    this.checkForImmediateIssues(testInfo);
  }

  onStepBegin(test, result, step) {
    // Track test step execution for detailed analysis
    if (this.enableAnalytics) {
      const stepInfo = {
        testId: `${test.parent.file}::${test.title}`,
        stepTitle: step.title,
        stepCategory: step.category,
        startTime: Date.now()
      };

      this.updateHiveMemory('step-start', stepInfo);
    }
  }

  onStepEnd(test, result, step) {
    if (this.enableAnalytics) {
      const stepInfo = {
        testId: `${test.parent.file}::${test.title}`,
        stepTitle: step.title,
        stepCategory: step.category,
        duration: step.duration,
        error: step.error?.message
      };

      this.updateHiveMemory('step-end', stepInfo);
    }
  }

  onEnd(result) {
    const endTime = Date.now();
    const totalDuration = endTime - this.startTime;

    const summary = {
      sessionId: this.sessionId,
      status: result.status,
      startTime: new Date(this.startTime).toISOString(),
      endTime: new Date(endTime).toISOString(),
      duration: totalDuration,
      totalTests: this.totalTests,
      passed: this.testResults.filter(t => t.status === 'passed').length,
      failed: this.testResults.filter(t => t.status === 'failed').length,
      skipped: this.testResults.filter(t => t.status === 'skipped').length,
      flaky: this.testResults.filter(t => t.status === 'flaky').length,
      interrupted: this.testResults.filter(t => t.status === 'interrupted').length
    };

    summary.successRate = (summary.passed / summary.totalTests) * 100;
    summary.flakeRate = (summary.flaky / summary.totalTests) * 100;

    // Generate HIVE-MIND report
    this.generateHiveMindReport(summary);

    // Update final analytics
    this.updateHiveMemory('session-end', summary);

    // Send notifications if enabled
    if (this.enableNotifications) {
      this.sendNotifications(summary);
    }

    // Finalize HIVE session
    this.finalizeHiveSession(summary);

    console.log(`\n📊 MediaNest E2E Test Execution Complete`);
    console.log(`⏱️ Duration: ${Math.round(totalDuration / 1000)}s`);
    console.log(`✅ Success Rate: ${summary.successRate.toFixed(1)}%`);
    console.log(`🔥 Flake Rate: ${summary.flakeRate.toFixed(1)}%`);
    console.log(`🧠 HIVE Report: ${path.join(this.outputDir, 'hive-report.json')}`);
  }

  checkForImmediateIssues(testInfo) {
    // Check for critical issues that need immediate attention
    if (testInfo.status === 'failed' && testInfo.error) {
      const isCritical = 
        testInfo.error.includes('timeout') ||
        testInfo.error.includes('Network') ||
        testInfo.testName.toLowerCase().includes('critical') ||
        testInfo.testName.toLowerCase().includes('smoke');

      if (isCritical && this.enableNotifications) {
        this.sendImmediateAlert(testInfo);
      }
    }
  }

  generateHiveMindReport(summary) {
    const report = {
      metadata: this.sessionMetadata,
      summary,
      testResults: this.testResults,
      suiteResults: Array.from(this.suiteResults.values()),
      analytics: {
        avgTestDuration: this.testResults.length > 0 
          ? this.testResults.reduce((sum, t) => sum + (t.duration || 0), 0) / this.testResults.length 
          : 0,
        slowestTests: this.testResults
          .sort((a, b) => (b.duration || 0) - (a.duration || 0))
          .slice(0, 10),
        flakyTests: this.testResults.filter(t => t.status === 'flaky'),
        failedTests: this.testResults.filter(t => t.status === 'failed'),
        browserDistribution: this.getBrowserDistribution(),
        testTagDistribution: this.getTestTagDistribution()
      },
      recommendations: this.generateRecommendations(summary),
      timestamp: new Date().toISOString()
    };

    // Save comprehensive report
    const reportPath = path.join(this.outputDir, 'hive-report.json');
    writeFileSync(reportPath, JSON.stringify(report, null, 2));

    // Save summary for quick access
    const summaryPath = path.join(this.outputDir, 'summary.json');
    writeFileSync(summaryPath, JSON.stringify(summary, null, 2));

    return report;
  }

  getBrowserDistribution() {
    const distribution = {};
    for (const test of this.testResults) {
      distribution[test.project] = (distribution[test.project] || 0) + 1;
    }
    return distribution;
  }

  getTestTagDistribution() {
    const distribution = {};
    for (const test of this.testResults) {
      // Extract tags from test names (assuming @tag format)
      const tags = test.testName.match(/@\w+/g) || [];
      for (const tag of tags) {
        distribution[tag] = (distribution[tag] || 0) + 1;
      }
    }
    return distribution;
  }

  generateRecommendations(summary) {
    const recommendations = [];

    if (summary.successRate < 90) {
      recommendations.push({
        type: 'stability',
        priority: 'high',
        message: `Success rate is ${summary.successRate.toFixed(1)}%. Investigate failing tests.`
      });
    }

    if (summary.flakeRate > 5) {
      recommendations.push({
        type: 'flakiness',
        priority: 'medium',
        message: `Flake rate is ${summary.flakeRate.toFixed(1)}%. Review and stabilize flaky tests.`
      });
    }

    const avgDuration = summary.duration / summary.totalTests;
    if (avgDuration > 30000) { // 30 seconds
      recommendations.push({
        type: 'performance',
        priority: 'medium',
        message: `Average test duration is ${Math.round(avgDuration / 1000)}s. Consider optimization.`
      });
    }

    return recommendations;
  }

  updateHiveMemory(operation, data) {
    if (!this.enableAnalytics) return;

    try {
      const memoryKey = `hive-reporter/${this.sessionId}/${operation}`;
      execSync('npx claude-flow@alpha hooks post-edit --file "test-execution" --memory-key "' + memoryKey + '"', {
        input: JSON.stringify({
          operation,
          data,
          timestamp: new Date().toISOString()
        }),
        stdio: 'pipe'
      });
    } catch (error) {
      // Silently fail - don't disrupt test execution
    }
  }

  sendImmediateAlert(testInfo) {
    try {
      // This would integrate with the notification system
      console.warn(`🚨 CRITICAL TEST FAILURE: ${testInfo.testName}`);
      console.warn(`📝 Error: ${testInfo.error}`);
      
      // In a real implementation, this would send to Slack/Teams/etc
    } catch (error) {
      console.warn('Failed to send immediate alert:', error.message);
    }
  }

  sendNotifications(summary) {
    try {
      // Integrate with the notification system
      const NotificationSystem = require('./notification-system.ts').default;
      const { defaultNotificationConfig } = require('./notification-system.ts');
      
      const notificationSystem = new NotificationSystem(defaultNotificationConfig, this.sessionId);
      
      const payload = {
        sessionId: this.sessionId,
        buildNumber: this.sessionMetadata.buildNumber,
        branch: this.sessionMetadata.branch,
        environment: this.sessionMetadata.environment,
        timestamp: new Date().toISOString(),
        type: summary.status === 'passed' ? 'build_complete' : 'test_failure',
        severity: summary.successRate < 80 ? 'high' : summary.successRate < 95 ? 'medium' : 'low',
        title: `MediaNest E2E Tests ${summary.status === 'passed' ? 'Passed' : 'Failed'}`,
        message: `Test execution completed with ${summary.successRate.toFixed(1)}% success rate`,
        data: {
          totalTests: summary.totalTests,
          failedTests: summary.failed,
          successRate: summary.successRate,
          duration: Math.round(summary.duration / 60000), // minutes
          flakeRate: summary.flakeRate
        },
        metadata: {
          testResults: this.testResults.slice(0, 10), // Top 10 for payload size
          summary
        }
      };

      notificationSystem.sendNotifications(payload);
    } catch (error) {
      console.warn('Failed to send notifications:', error.message);
    }
  }

  finalizeHiveSession(summary) {
    if (!this.enableAnalytics) return;

    try {
      execSync('npx claude-flow@alpha hooks post-task --task-id "' + this.sessionId + '"', {
        input: JSON.stringify({
          sessionId: this.sessionId,
          status: summary.status,
          duration: summary.duration,
          successRate: summary.successRate,
          testCount: summary.totalTests,
          timestamp: new Date().toISOString()
        }),
        stdio: 'pipe'
      });

      execSync('npx claude-flow@alpha hooks session-end --export-metrics true', {
        stdio: 'pipe'
      });

      console.log('🧠 HIVE-MIND session finalized');
    } catch (error) {
      console.warn('Failed to finalize HIVE session:', error.message);
    }
  }

  // Additional methods for integration
  
  onError(error) {
    console.error('🚨 Test execution error:', error);
    
    this.updateHiveMemory('error', {
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });

    if (this.enableNotifications) {
      this.sendImmediateAlert({
        testName: 'Test Execution',
        error: error.message,
        status: 'failed'
      });
    }
  }
}

module.exports = HiveMindReporter;