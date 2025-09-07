/**
 * CI/CD Pipeline Configuration for MediaNest Accessibility Testing
 * Provides configuration for automated accessibility testing in different environments
 */

export interface AccessibilityCIConfig {
  // Environment settings
  environment: 'development' | 'staging' | 'production';
  baseUrl: string;
  
  // Test execution settings
  testLevel: 'basic' | 'standard' | 'comprehensive';
  parallel: boolean;
  maxRetries: number;
  timeout: number;
  
  // Reporting settings
  generateReports: boolean;
  reportFormats: Array<'html' | 'json' | 'csv' | 'junit'>;
  uploadReports: boolean;
  reportDestination?: string;
  
  // Failure thresholds
  failureThresholds: {
    overallScore: number;
    criticalViolations: number;
    seriousViolations: number;
    regressionThreshold: number;
  };
  
  // HIVE-MIND coordination
  enableHiveCoordination: boolean;
  sessionPersistence: boolean;
  crossBuildAnalysis: boolean;
  
  // Integration settings
  slackNotifications?: SlackConfig;
  jiraIntegration?: JiraConfig;
  githubIntegration?: GitHubConfig;
  
  // Advanced features
  progressiveTesting: boolean;
  regressionTesting: boolean;
  performanceTracking: boolean;
  autoScreenshots: boolean;
}

export interface SlackConfig {
  webhookUrl: string;
  channel: string;
  notifyOn: Array<'failure' | 'regression' | 'improvement' | 'summary'>;
  mentionUsers?: string[];
}

export interface JiraConfig {
  serverUrl: string;
  projectKey: string;
  issueType: string;
  createIssuesFor: Array<'critical' | 'serious' | 'regression'>;
  credentials: {
    email: string;
    apiToken: string;
  };
}

export interface GitHubConfig {
  repository: string;
  token: string;
  createPRComments: boolean;
  createIssues: boolean;
  updateStatusChecks: boolean;
}

// Environment-specific configurations
export const ciConfigurations: Record<string, AccessibilityCIConfig> = {
  development: {
    environment: 'development',
    baseUrl: 'http://localhost:3000',
    testLevel: 'basic',
    parallel: true,
    maxRetries: 1,
    timeout: 30000,
    generateReports: true,
    reportFormats: ['html', 'json'],
    uploadReports: false,
    failureThresholds: {
      overallScore: 70,
      criticalViolations: 5,
      seriousViolations: 10,
      regressionThreshold: 10
    },
    enableHiveCoordination: true,
    sessionPersistence: false,
    crossBuildAnalysis: false,
    progressiveTesting: true,
    regressionTesting: false,
    performanceTracking: true,
    autoScreenshots: true
  },

  staging: {
    environment: 'staging',
    baseUrl: 'https://staging.medianest.com',
    testLevel: 'standard',
    parallel: true,
    maxRetries: 2,
    timeout: 45000,
    generateReports: true,
    reportFormats: ['html', 'json', 'csv'],
    uploadReports: true,
    reportDestination: 's3://medianest-accessibility-reports/staging',
    failureThresholds: {
      overallScore: 80,
      criticalViolations: 2,
      seriousViolations: 5,
      regressionThreshold: 5
    },
    enableHiveCoordination: true,
    sessionPersistence: true,
    crossBuildAnalysis: true,
    progressiveTesting: true,
    regressionTesting: true,
    performanceTracking: true,
    autoScreenshots: true,
    slackNotifications: {
      webhookUrl: process.env.SLACK_WEBHOOK_URL || '',
      channel: '#accessibility-testing',
      notifyOn: ['failure', 'regression', 'summary'],
      mentionUsers: ['@accessibility-team']
    }
  },

  production: {
    environment: 'production',
    baseUrl: 'https://medianest.com',
    testLevel: 'comprehensive',
    parallel: false, // More careful in production
    maxRetries: 3,
    timeout: 60000,
    generateReports: true,
    reportFormats: ['html', 'json', 'csv', 'junit'],
    uploadReports: true,
    reportDestination: 's3://medianest-accessibility-reports/production',
    failureThresholds: {
      overallScore: 90,
      criticalViolations: 0,
      seriousViolations: 2,
      regressionThreshold: 3
    },
    enableHiveCoordination: true,
    sessionPersistence: true,
    crossBuildAnalysis: true,
    progressiveTesting: true,
    regressionTesting: true,
    performanceTracking: true,
    autoScreenshots: true,
    slackNotifications: {
      webhookUrl: process.env.SLACK_WEBHOOK_URL || '',
      channel: '#alerts-production',
      notifyOn: ['failure', 'regression'],
      mentionUsers: ['@on-call-engineer', '@accessibility-lead']
    },
    jiraIntegration: {
      serverUrl: process.env.JIRA_SERVER_URL || '',
      projectKey: 'ACCESSIBILITY',
      issueType: 'Bug',
      createIssuesFor: ['critical', 'serious', 'regression'],
      credentials: {
        email: process.env.JIRA_EMAIL || '',
        apiToken: process.env.JIRA_API_TOKEN || ''
      }
    },
    githubIntegration: {
      repository: 'medianest/medianest-app',
      token: process.env.GITHUB_TOKEN || '',
      createPRComments: true,
      createIssues: true,
      updateStatusChecks: true
    }
  }
};

// Test suite configurations for different scenarios
export const testSuiteConfigurations = {
  smoke: {
    name: 'Accessibility Smoke Tests',
    tests: [
      'specs/accessibility/smoke-a11y.spec.ts'
    ],
    config: {
      testLevel: 'basic',
      timeout: 15000,
      failureThresholds: {
        overallScore: 60,
        criticalViolations: 10
      }
    }
  },

  regression: {
    name: 'Accessibility Regression Tests',
    tests: [
      'specs/accessibility/a11y.spec.ts'
    ],
    config: {
      testLevel: 'standard',
      regressionTesting: true,
      timeout: 45000,
      failureThresholds: {
        overallScore: 80,
        regressionThreshold: 5
      }
    }
  },

  comprehensive: {
    name: 'Comprehensive Accessibility Audit',
    tests: [
      'specs/accessibility/a11y.spec.ts',
      'specs/accessibility/progressive-a11y.spec.ts',
      'specs/accessibility/component-a11y.spec.ts'
    ],
    config: {
      testLevel: 'comprehensive',
      progressiveTesting: true,
      timeout: 120000,
      failureThresholds: {
        overallScore: 85,
        criticalViolations: 0,
        seriousViolations: 3
      }
    }
  },

  pr_validation: {
    name: 'PR Accessibility Validation',
    tests: [
      'specs/accessibility/pr-validation-a11y.spec.ts'
    ],
    config: {
      testLevel: 'standard',
      regressionTesting: true,
      timeout: 30000,
      failureThresholds: {
        overallScore: 75,
        criticalViolations: 1,
        regressionThreshold: 10
      }
    }
  }
};

// CI/CD pipeline stage configurations
export const pipelineStageConfigurations = {
  'pre-commit': {
    suite: 'smoke',
    blocking: false,
    reportFormats: ['json'],
    notifications: false
  },

  'pr-validation': {
    suite: 'pr_validation',
    blocking: true,
    reportFormats: ['html', 'json'],
    notifications: true,
    githubIntegration: true
  },

  'staging-deployment': {
    suite: 'regression',
    blocking: true,
    reportFormats: ['html', 'json', 'csv'],
    notifications: true,
    slackNotifications: true
  },

  'production-deployment': {
    suite: 'comprehensive',
    blocking: true,
    reportFormats: ['html', 'json', 'csv', 'junit'],
    notifications: true,
    slackNotifications: true,
    jiraIntegration: true
  },

  'nightly-audit': {
    suite: 'comprehensive',
    blocking: false,
    reportFormats: ['html', 'json', 'csv'],
    notifications: true,
    performanceTracking: true,
    crossBuildAnalysis: true
  }
};

// Utility functions for CI configuration
export function getConfigForEnvironment(env: string): AccessibilityCIConfig {
  return ciConfigurations[env] || ciConfigurations.development;
}

export function getConfigForPipelineStage(stage: string): any {
  const stageConfig = pipelineStageConfigurations[stage as keyof typeof pipelineStageConfigurations];
  if (!stageConfig) {
    throw new Error(`Unknown pipeline stage: ${stage}`);
  }

  const suiteConfig = testSuiteConfigurations[stageConfig.suite as keyof typeof testSuiteConfigurations];
  if (!suiteConfig) {
    throw new Error(`Unknown test suite: ${stageConfig.suite}`);
  }

  return {
    ...suiteConfig.config,
    ...stageConfig,
    tests: suiteConfig.tests
  };
}

export function validateCIConfig(config: AccessibilityCIConfig): string[] {
  const errors: string[] = [];

  if (!config.baseUrl) {
    errors.push('baseUrl is required');
  }

  if (config.failureThresholds.overallScore < 0 || config.failureThresholds.overallScore > 100) {
    errors.push('overallScore threshold must be between 0 and 100');
  }

  if (config.uploadReports && !config.reportDestination) {
    errors.push('reportDestination is required when uploadReports is true');
  }

  if (config.slackNotifications && !config.slackNotifications.webhookUrl) {
    errors.push('Slack webhook URL is required for Slack notifications');
  }

  if (config.jiraIntegration) {
    if (!config.jiraIntegration.serverUrl || !config.jiraIntegration.credentials.email || !config.jiraIntegration.credentials.apiToken) {
      errors.push('Complete JIRA credentials are required for JIRA integration');
    }
  }

  if (config.githubIntegration && !config.githubIntegration.token) {
    errors.push('GitHub token is required for GitHub integration');
  }

  return errors;
}

// Environment variable mapping
export const environmentVariables = {
  // Basic configuration
  'A11Y_TEST_LEVEL': 'testLevel',
  'A11Y_PARALLEL': 'parallel',
  'A11Y_TIMEOUT': 'timeout',
  'A11Y_BASE_URL': 'baseUrl',
  
  // Thresholds
  'A11Y_SCORE_THRESHOLD': 'failureThresholds.overallScore',
  'A11Y_CRITICAL_THRESHOLD': 'failureThresholds.criticalViolations',
  'A11Y_SERIOUS_THRESHOLD': 'failureThresholds.seriousViolations',
  
  // Features
  'A11Y_PROGRESSIVE_TESTING': 'progressiveTesting',
  'A11Y_REGRESSION_TESTING': 'regressionTesting',
  'A11Y_HIVE_COORDINATION': 'enableHiveCoordination',
  
  // Reporting
  'A11Y_REPORT_FORMATS': 'reportFormats',
  'A11Y_UPLOAD_REPORTS': 'uploadReports',
  'A11Y_REPORT_DESTINATION': 'reportDestination',
  
  // Integrations
  'SLACK_WEBHOOK_URL': 'slackNotifications.webhookUrl',
  'JIRA_SERVER_URL': 'jiraIntegration.serverUrl',
  'JIRA_EMAIL': 'jiraIntegration.credentials.email',
  'JIRA_API_TOKEN': 'jiraIntegration.credentials.apiToken',
  'GITHUB_TOKEN': 'githubIntegration.token'
};

export function loadConfigFromEnvironment(): Partial<AccessibilityCIConfig> {
  const config: any = {};
  
  Object.entries(environmentVariables).forEach(([envVar, configPath]) => {
    const value = process.env[envVar];
    if (value) {
      // Handle nested paths
      const pathSegments = configPath.split('.');
      let current = config;
      
      for (let i = 0; i < pathSegments.length - 1; i++) {
        const segment = pathSegments[i];
        if (!current[segment]) current[segment] = {};
        current = current[segment];
      }
      
      const finalSegment = pathSegments[pathSegments.length - 1];
      
      // Type conversion
      if (value === 'true' || value === 'false') {
        current[finalSegment] = value === 'true';
      } else if (!isNaN(Number(value))) {
        current[finalSegment] = Number(value);
      } else if (value.includes(',')) {
        current[finalSegment] = value.split(',').map(s => s.trim());
      } else {
        current[finalSegment] = value;
      }
    }
  });
  
  return config;
}

export default {
  ciConfigurations,
  testSuiteConfigurations,
  pipelineStageConfigurations,
  getConfigForEnvironment,
  getConfigForPipelineStage,
  validateCIConfig,
  loadConfigFromEnvironment
};