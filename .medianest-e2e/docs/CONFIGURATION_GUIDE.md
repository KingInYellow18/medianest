# MediaNest E2E Testing - Configuration Guide

## 🎛️ Environment Configuration

This comprehensive guide covers all configuration aspects of the MediaNest Playwright E2E Testing Framework, from basic setup to advanced HIVE-MIND coordination settings.

## 📁 Configuration Structure

```
.medianest-e2e/
├── config/
│   ├── ci-config.ts              # CI/CD environment settings
│   ├── accessibility-ci-config.ts # Accessibility testing configuration
│   ├── axe-config.ts             # Axe-core accessibility rules
│   ├── global-setup.ts           # Global test setup
│   └── global-teardown.ts        # Global test cleanup
├── .env.example                  # Example environment variables
├── .env.local                    # Local development settings
├── .env.staging                  # Staging environment settings
├── .env.production               # Production environment settings
└── playwright.config.ts          # Playwright configuration
```

## 🌍 Environment Variables

### Core Application Settings

```bash
# .env.local - Local Development Environment
# MediaNest Application URLs
MEDIANEST_BASE_URL=http://localhost:3000
MEDIANEST_API_URL=http://localhost:3001
PLEX_SERVER_URL=http://localhost:32400
OVERSEERR_URL=http://localhost:5055
UPTIME_KUMA_URL=http://localhost:3001

# Authentication Credentials
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your-secure-password
TEST_USER_EMAIL=testuser@medianest.local
TEST_USER_PASSWORD=testpassword123
PLEX_TOKEN=your-plex-token

# Database Configuration (for test data setup)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=medianest_test
DB_USER=testuser
DB_PASSWORD=testpassword

# Redis Configuration (for session management)
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=your-redis-password
```

### HIVE-MIND Coordination Settings

```bash
# HIVE-MIND Configuration
HIVE_MIND_ENABLED=true
HIVE_PERSISTENCE=true
HIVE_NODE_ID=medianest-e2e-local
HIVE_COORDINATION_TYPE=distributed  # centralized, distributed, mesh
HIVE_SYNC_INTERVAL=5000             # milliseconds
HIVE_MAX_STATE_SIZE=1000            # maximum state entries
HIVE_COMPRESSION=true               # enable state compression
HIVE_SESSION_ID=session-$(date +%s) # unique session identifier

# Advanced HIVE Settings
HIVE_STABILIZATION=enhanced         # basic, standard, enhanced
HIVE_INTELLIGENT_SELECTION=true     # enable intelligent test selection
HIVE_PERFORMANCE_TRACKING=true      # track performance metrics
HIVE_BASELINE_MANAGEMENT=true       # manage visual baselines
HIVE_FLAKE_DETECTION=true          # detect and handle flaky tests
```

### Test Execution Settings

```bash
# Test Configuration
TEST_TIMEOUT=30000                  # default test timeout (ms)
TEST_RETRIES=2                      # number of test retries
TEST_WORKERS=4                      # parallel test workers
TEST_REPORTER=html                  # html, json, junit, allure
TEST_HEADED=false                   # run tests in headed mode
TEST_DEBUG=false                    # enable debug mode
TEST_SCREENSHOT=failure             # always, failure, never
TEST_VIDEO=failure                  # always, failure, never
TEST_TRACE=failure                  # always, failure, never

# Browser Configuration
BROWSER_CHANNEL=chrome              # chrome, firefox, safari, edge
BROWSER_HEADLESS=true               # headless browser execution
BROWSER_VIEWPORT_WIDTH=1920         # default viewport width
BROWSER_VIEWPORT_HEIGHT=1080        # default viewport height
BROWSER_DEVICE_SCALE_FACTOR=1       # device pixel ratio

# Mobile Testing
MOBILE_TESTING=false                # enable mobile device testing
MOBILE_DEVICE=iPhone 13             # default mobile device
TABLET_DEVICE=iPad Pro              # default tablet device
```

### Performance & Monitoring

```bash
# Performance Configuration
PERFORMANCE_BUDGET_ENABLED=true     # enable performance budgets
PERFORMANCE_BUDGET_LCP=2500         # Largest Contentful Paint (ms)
PERFORMANCE_BUDGET_FID=100          # First Input Delay (ms)
PERFORMANCE_BUDGET_CLS=0.1          # Cumulative Layout Shift
PERFORMANCE_MONITORING=true         # enable performance monitoring

# Visual Regression Settings
VISUAL_TESTING=true                 # enable visual regression testing
VISUAL_THRESHOLD=0.2                # visual difference threshold (0-1)
VISUAL_UPDATE_BASELINES=false       # auto-update baselines
VISUAL_CROSS_BROWSER=true           # cross-browser visual testing
VISUAL_MOBILE_TESTING=false         # mobile visual testing

# Accessibility Configuration
A11Y_TESTING=true                   # enable accessibility testing
A11Y_LEVEL=AA                       # A, AA, AAA compliance level
A11Y_TAGS=wcag2a,wcag2aa           # axe-core rule tags
A11Y_CONTEXT_TESTING=true          # context-specific a11y tests
A11Y_PROGRESSIVE_TESTING=true      # progressive a11y validation
```

### CI/CD Integration

```bash
# CI/CD Environment Detection
CI=true                            # CI environment flag
CI_PROVIDER=github-actions         # github-actions, gitlab-ci, jenkins
CI_BRANCH=main                     # current branch name
CI_COMMIT_SHA=abc123               # current commit SHA
CI_PULL_REQUEST=123                # PR number (if applicable)

# Notification Settings
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
TEAMS_WEBHOOK_URL=https://outlook.office.com/webhook/...
EMAIL_NOTIFICATIONS=false          # enable email notifications
GITHUB_TOKEN=ghp_your_token_here   # GitHub API token

# Reporting Configuration
ALLURE_RESULTS_DIR=./allure-results
JUNIT_OUTPUT_DIR=./test-results
HTML_REPORT_DIR=./playwright-report
DASHBOARD_URL=http://localhost:8080
DASHBOARD_AUTH_ENABLED=true
DASHBOARD_USERNAME=admin
DASHBOARD_PASSWORD=dashboard123
```

## ⚙️ Playwright Configuration

### `playwright.config.ts`

```typescript
import { defineConfig, devices } from '@playwright/test';
import { ciConfig } from './config/ci-config';

// Determine environment
const ENV = process.env.NODE_ENV || 'development';
const envConfig = ciConfig.environments[ENV];

export default defineConfig({
  // Test directory
  testDir: './specs',

  // Global test configuration
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? envConfig.retries : 1,
  workers: process.env.CI ? envConfig.workers : undefined,

  // Test timeouts
  timeout: envConfig.timeout,
  expect: {
    timeout: 10000,
    toHaveScreenshot: {
      threshold: parseFloat(process.env.VISUAL_THRESHOLD || '0.2'),
      mode: 'local',
    },
    toMatchAriaSnapshot: { mode: 'local' },
  },

  // Global setup and teardown
  globalSetup: './config/global-setup.ts',
  globalTeardown: './config/global-teardown.ts',

  // Reporter configuration
  reporter: [
    [
      'html',
      {
        outputFolder: 'playwright-report',
        open: process.env.CI ? 'never' : 'on-failure',
      },
    ],
    [
      'json',
      {
        outputFile: 'reports/json/results.json',
      },
    ],
    [
      'junit',
      {
        outputFile: 'reports/junit/results.xml',
      },
    ],
    [
      './utils/hive-mind-reporter.js',
      {
        outputFile: 'reports/hive-mind/results.json',
        enableCoordination: process.env.HIVE_MIND_ENABLED === 'true',
      },
    ],
  ],

  // Common browser settings
  use: {
    baseURL: envConfig.baseUrl,

    // Browser options
    headless: process.env.BROWSER_HEADLESS !== 'false',
    viewport: {
      width: parseInt(process.env.BROWSER_VIEWPORT_WIDTH || '1920'),
      height: parseInt(process.env.BROWSER_VIEWPORT_HEIGHT || '1080'),
    },
    deviceScaleFactor: parseFloat(process.env.BROWSER_DEVICE_SCALE_FACTOR || '1'),

    // Test artifacts
    screenshot:
      (process.env.TEST_SCREENSHOT as 'always' | 'only-on-failure' | 'off') || 'only-on-failure',
    video:
      (process.env.TEST_VIDEO as 'always' | 'retain-on-failure' | 'off') || 'retain-on-failure',
    trace: (process.env.TEST_TRACE as 'always' | 'on-first-retry' | 'off') || 'on-first-retry',

    // Performance and accessibility
    actionTimeout: 15000,
    navigationTimeout: 30000,

    // Extra HTTP headers
    extraHTTPHeaders: {
      'Accept-Language': 'en-US,en;q=0.9',
      'X-Test-Environment': ENV,
      'X-HIVE-Node-ID': process.env.HIVE_NODE_ID || 'unknown',
    },
  },

  // Browser projects
  projects: [
    // Desktop Chrome
    {
      name: 'Desktop Chrome',
      use: {
        ...devices['Desktop Chrome'],
        channel: 'chrome',
      },
    },

    // Desktop Firefox
    {
      name: 'Desktop Firefox',
      use: {
        ...devices['Desktop Firefox'],
      },
    },

    // Desktop Safari
    {
      name: 'Desktop Safari',
      use: {
        ...devices['Desktop Safari'],
      },
    },

    // Mobile Chrome
    {
      name: 'Mobile Chrome',
      use: {
        ...devices['Pixel 5'],
      },
      testIgnore: ['**/visual/**'], // Skip visual tests on mobile
    },

    // Tablet
    {
      name: 'Tablet',
      use: {
        ...devices['iPad Pro'],
      },
    },

    // Accessibility-focused project
    {
      name: 'Accessibility',
      testMatch: '**/accessibility/**/*.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
        // Accessibility-specific settings
        reducedMotion: 'reduce',
        forcedColors: 'none',
        colorScheme: 'light',
      },
    },

    // Performance testing project
    {
      name: 'Performance',
      testMatch: '**/performance/**/*.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
        // Performance-specific settings
        networkProfile: 'slow-3g',
      },
    },

    // Visual regression project
    {
      name: 'Visual',
      testMatch: '**/visual/**/*.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
        // Visual testing specific settings
        animations: 'disabled',
        reducedMotion: 'reduce',
      },
    },
  ],

  // Web server (if needed for local testing)
  webServer:
    process.env.START_SERVER === 'true'
      ? {
          command: 'npm run start:test-server',
          url: envConfig.baseUrl,
          reuseExistingServer: !process.env.CI,
          timeout: 120 * 1000,
        }
      : undefined,

  // Output directory
  outputDir: 'test-results/',

  // Test artifacts
  snapshotPathTemplate:
    '{testDir}/{testFileDir}/__screenshots__/{testFileName}-{projectName}-{arg}{ext}',
});
```

## 🏗️ Environment-Specific Configurations

### Development Environment (`ci-config.ts`)

```typescript
export const developmentConfig = {
  baseUrl: 'http://localhost:3000',
  apiUrl: 'http://localhost:3001',
  timeout: 30000,
  retries: 1,
  workers: 4,

  // Development-specific settings
  debug: true,
  headless: false,
  screenshot: 'always',
  video: 'retain-on-failure',
  trace: 'on-first-retry',

  // HIVE-MIND settings for development
  hiveSettings: {
    sessionPersistence: true,
    intelligentSelection: false, // Disable for predictable local testing
    performanceTracking: true,
    baselineManagement: true,
    flakeDetection: false,
  },
};
```

### Staging Environment

```typescript
export const stagingConfig = {
  baseUrl: 'https://staging.medianest.dev',
  apiUrl: 'https://api-staging.medianest.dev',
  timeout: 45000,
  retries: 2,
  workers: 3,

  // Staging-specific settings
  debug: false,
  headless: true,
  screenshot: 'only-on-failure',
  video: 'retain-on-failure',
  trace: 'on-first-retry',

  // Enhanced HIVE-MIND for staging
  hiveSettings: {
    sessionPersistence: true,
    intelligentSelection: true,
    performanceTracking: true,
    baselineManagement: true,
    flakeDetection: true,
  },
};
```

### Production Environment

```typescript
export const productionConfig = {
  baseUrl: 'https://medianest.com',
  apiUrl: 'https://api.medianest.com',
  timeout: 60000,
  retries: 3,
  workers: 2,

  // Production-specific settings (smoke tests only)
  debug: false,
  headless: true,
  screenshot: 'only-on-failure',
  video: 'off', // Minimize storage usage
  trace: 'off',

  // Conservative HIVE-MIND for production
  hiveSettings: {
    sessionPersistence: false, // Don't persist production test data
    intelligentSelection: true,
    performanceTracking: true,
    baselineManagement: false, // Don't update baselines in production
    flakeDetection: true,
  },
};
```

## 🎯 Test Matrix Configuration

### Test Categories and Tags

```typescript
export const testMatrices = {
  // Quick smoke tests for critical functionality
  smoke: ['@smoke', '@critical', '@auth and @login', '@dashboard and @health'],

  // Core regression testing
  regression: ['@regression', '@core', '@integration', '@api and not @slow'],

  // Comprehensive full-suite testing
  comprehensive: ['@visual', '@accessibility', '@performance', '@cross-browser', '@mobile'],

  // Performance and load testing
  performance: ['@performance', '@load', '@benchmark', '@memory'],

  // Security and compliance testing
  security: ['@security', '@auth', '@permissions', '@data-protection'],

  // Mobile and responsive testing
  mobile: ['@mobile', '@responsive', '@touch', '@device-specific'],
};
```

### Environment-Specific Test Selection

```typescript
export const environmentTestFilters = {
  development: {
    include: ['@smoke', '@regression', '@visual'],
    exclude: ['@slow', '@external-service'],
  },

  staging: {
    include: ['@smoke', '@regression', '@comprehensive'],
    exclude: ['@production-only'],
  },

  production: {
    include: ['@smoke', '@monitoring'],
    exclude: ['@destructive', '@data-modification'],
  },
};
```

## 📊 Reporting Configuration

### Multi-Reporter Setup

```typescript
export const reportingConfig = {
  // HTML report for development
  html: {
    outputFolder: 'playwright-report',
    open: process.env.CI ? 'never' : 'on-failure',
    attachmentsBaseURL: process.env.ATTACHMENTS_BASE_URL || undefined,
  },

  // JUnit for CI integration
  junit: {
    outputFile: 'reports/junit/results.xml',
    includeProjectInTestName: true,
    stripANSIControlSequences: true,
  },

  // JSON for programmatic analysis
  json: {
    outputFile: 'reports/json/results.json',
    includeAttachments: false,
  },

  // Allure for rich reporting
  allure: {
    outputFolder: 'allure-results',
    environmentInfo: {
      Environment: process.env.NODE_ENV || 'development',
      'Base URL': process.env.MEDIANEST_BASE_URL || 'localhost',
      'HIVE-MIND': process.env.HIVE_MIND_ENABLED || 'false',
      Browser: process.env.BROWSER_CHANNEL || 'chrome',
    },
  },

  // HIVE-MIND intelligent reporting
  hiveMind: {
    outputFile: 'reports/hive-mind/results.json',
    enableCoordination: process.env.HIVE_MIND_ENABLED === 'true',
    includePerformanceMetrics: true,
    includeAccessibilityResults: true,
    includeVisualDiffs: true,
  },
};
```

### Notification Configuration

```typescript
export const notificationConfig = {
  slack: {
    enabled: !!process.env.SLACK_WEBHOOK_URL,
    webhook: process.env.SLACK_WEBHOOK_URL,
    channel: '#medianest-e2e-tests',
    username: 'MediaNest E2E Bot',
    onFailure: true,
    onSuccess: process.env.CI === 'true',
    includeScreenshots: true,
    includeMetrics: true,
  },

  email: {
    enabled: process.env.EMAIL_NOTIFICATIONS === 'true',
    smtp: {
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    },
    recipients: (process.env.EMAIL_RECIPIENTS || '').split(','),
    onFailure: true,
    onSuccess: false,
  },

  github: {
    enabled: !!process.env.GITHUB_TOKEN,
    token: process.env.GITHUB_TOKEN,
    repository: process.env.GITHUB_REPOSITORY,
    createPRComments: true,
    updateCommitStatus: true,
  },
};
```

## ♿ Accessibility Configuration

### Axe-Core Configuration (`axe-config.ts`)

```typescript
export const accessibilityConfig = {
  // Base configuration for all accessibility tests
  base: {
    rules: {
      'color-contrast': { enabled: true },
      'keyboard-navigation': { enabled: true },
      'focus-management': { enabled: true },
      'semantic-markup': { enabled: true },
      'aria-usage': { enabled: true },
    },
    tags: ['wcag2a', 'wcag2aa'],
    context: {
      include: [['body']],
      exclude: [['.skip-axe']],
    },
  },

  // Context-specific configurations
  contexts: {
    forms: {
      rules: {
        'form-labels': { enabled: true },
        'form-validation': { enabled: true },
        'input-requirements': { enabled: true },
      },
      tags: ['wcag2a', 'wcag2aa', 'section508', 'best-practice'],
    },

    navigation: {
      rules: {
        'skip-links': { enabled: true },
        'landmark-navigation': { enabled: true },
        'heading-hierarchy': { enabled: true },
      },
    },

    media: {
      rules: {
        'alt-text': { enabled: true },
        'video-captions': { enabled: true },
        'audio-transcripts': { enabled: true },
      },
    },
  },

  // Compliance level configurations
  levels: {
    basic: {
      tags: ['wcag2a'],
      rules: {
        'critical-violations-only': { enabled: true },
      },
    },

    standard: {
      tags: ['wcag2a', 'wcag2aa'],
      rules: {
        'color-contrast': { enabled: true },
        'keyboard-navigation': { enabled: true },
      },
    },

    comprehensive: {
      tags: ['wcag2a', 'wcag2aa', 'wcag2aaa'],
      rules: {
        'enhanced-color-contrast': { enabled: true },
        'advanced-keyboard-support': { enabled: true },
        'assistive-technology-support': { enabled: true },
      },
    },
  },
};
```

## 🎨 Visual Testing Configuration

### Visual Comparison Settings

```typescript
export const visualConfig = {
  // Default visual comparison options
  defaults: {
    threshold: 0.2, // 20% difference threshold
    animations: 'disabled', // Disable animations for consistency
    mask: [
      // Elements to mask in comparisons
      '[data-testid="timestamp"]',
      '[data-testid="random-content"]',
      '.animate-pulse',
    ],
    clip: undefined, // Full page comparison by default
    fullPage: true, // Capture entire page
  },

  // Browser-specific configurations
  browsers: {
    chrome: {
      threshold: 0.2,
      waitForFonts: true,
    },
    firefox: {
      threshold: 0.25, // Slightly higher threshold for Firefox
      waitForFonts: true,
    },
    safari: {
      threshold: 0.3, // Higher threshold for Safari
      waitForFonts: true,
    },
  },

  // Mobile visual testing
  mobile: {
    threshold: 0.3, // Higher threshold for mobile
    viewports: [
      { width: 375, height: 667 }, // iPhone SE
      { width: 414, height: 896 }, // iPhone 11
      { width: 768, height: 1024 }, // iPad
    ],
  },

  // Baseline management
  baselines: {
    updateMode: 'manual', // manual, auto, ci-only
    storageLocation: 'local', // local, s3, azure
    versionControl: true, // Track baseline changes in git
    retention: {
      keepVersions: 10, // Number of baseline versions to keep
      maxAge: '30d', // Maximum age of baselines
    },
  },
};
```

## 🔄 HIVE-MIND Advanced Configuration

### Coordination Topology Settings

```typescript
export const hiveMindAdvancedConfig = {
  // Node configuration
  node: {
    id: process.env.HIVE_NODE_ID || `node-${process.env.HOSTNAME}-${Date.now()}`,
    type: 'test-executor',
    capabilities: [
      'test-execution',
      'state-management',
      'performance-monitoring',
      'accessibility-testing',
      'visual-regression',
    ],
    metadata: {
      environment: process.env.NODE_ENV || 'development',
      version: process.env.npm_package_version || '1.0.0',
      playwright_version: process.env.npm_package_dependencies_playwright || 'unknown',
    },
  },

  // Coordination settings
  coordination: {
    type:
      (process.env.HIVE_COORDINATION_TYPE as 'centralized' | 'distributed' | 'mesh') ||
      'distributed',
    syncInterval: parseInt(process.env.HIVE_SYNC_INTERVAL || '5000'),
    maxStateSize: parseInt(process.env.HIVE_MAX_STATE_SIZE || '1000'),
    compressionEnabled: process.env.HIVE_COMPRESSION === 'true',
    encryptionEnabled: process.env.HIVE_ENCRYPTION === 'true',
    heartbeatInterval: 10000, // 10 seconds
    nodeTimeout: 30000, // 30 seconds
  },

  // State management
  state: {
    persistence: {
      enabled: process.env.HIVE_PERSISTENCE === 'true',
      storage: process.env.HIVE_STORAGE_TYPE || 'file', // file, redis, mongodb
      ttl: parseInt(process.env.HIVE_STATE_TTL || '3600'), // 1 hour
      cleanupInterval: 60000, // 1 minute
    },

    conflict_resolution: {
      strategy: 'last-write-wins', // last-write-wins, version-vector, custom
      autoResolve: true,
      preserveHistory: true,
    },
  },

  // Performance optimization
  optimization: {
    intelligentSelection: {
      enabled: process.env.HIVE_INTELLIGENT_SELECTION === 'true',
      algorithm: 'risk-based', // risk-based, change-based, time-based
      confidenceThreshold: 0.8,
      maxSelectionRatio: 0.3, // Maximum 30% of tests selected
    },

    flakeDetection: {
      enabled: process.env.HIVE_FLAKE_DETECTION === 'true',
      threshold: 3, // Number of failures to consider flaky
      windowSize: 10, // Number of recent runs to analyze
      quarantineFlaky: true,
      retryStrategy: 'exponential-backoff',
    },

    loadBalancing: {
      enabled: true,
      algorithm: 'round-robin', // round-robin, least-loaded, capability-based
      considerNodeCapabilities: true,
      maxLoadFactor: 0.8,
    },
  },
};
```

## 🛡️ Security Configuration

### Authentication and Secrets Management

```typescript
export const securityConfig = {
  // Authentication settings
  authentication: {
    enabled: true,
    methods: ['local', 'plex-oauth'],
    sessionTimeout: 3600000, // 1 hour

    // Test user management
    testUsers: {
      isolation: true, // Isolate test users from production
      cleanup: 'after-each', // never, after-each, after-suite
      generateRandom: true, // Generate random test users
    },
  },

  // Secrets management
  secrets: {
    // Never commit real secrets to version control
    encryption: {
      enabled: process.env.ENCRYPT_SECRETS === 'true',
      algorithm: 'aes-256-gcm',
      keySource: 'env', // env, file, vault
    },

    // Credential rotation
    rotation: {
      enabled: process.env.ROTATE_CREDENTIALS === 'true',
      interval: '7d',
      notify: true,
    },
  },

  // Data protection
  dataProtection: {
    maskSensitiveData: true,
    anonymizeTestData: true,
    purgeAfterTests: true,

    // GDPR compliance
    gdprCompliance: {
      enabled: true,
      dataRetention: '30d',
      rightToDelete: true,
    },
  },
};
```

## 📱 Mobile and Device Configuration

### Device-Specific Settings

```typescript
export const deviceConfig = {
  // Mobile devices
  mobile: {
    enabled: process.env.MOBILE_TESTING === 'true',
    devices: [
      {
        name: 'iPhone 13',
        viewport: { width: 390, height: 844 },
        userAgent: 'iPhone',
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
      },
      {
        name: 'Samsung Galaxy S21',
        viewport: { width: 360, height: 800 },
        userAgent: 'Android',
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
      },
    ],

    // Mobile-specific test settings
    testSettings: {
      timeout: 45000, // Longer timeout for mobile
      retries: 3, // More retries for mobile instability
      screenshot: 'always', // Always capture mobile screenshots
      slowMo: 100, // Add delay between actions
    },
  },

  // Tablet devices
  tablet: {
    enabled: true,
    devices: [
      {
        name: 'iPad Pro',
        viewport: { width: 1024, height: 1366 },
        deviceScaleFactor: 2,
        isMobile: false,
        hasTouch: true,
      },
    ],
  },

  // Desktop variations
  desktop: {
    resolutions: [
      { width: 1920, height: 1080, name: 'Full HD' },
      { width: 2560, height: 1440, name: '2K' },
      { width: 3840, height: 2160, name: '4K' },
    ],

    browsers: [
      { name: 'chrome', channel: 'chrome' },
      { name: 'firefox', channel: 'firefox' },
      { name: 'safari', channel: 'safari' },
      { name: 'edge', channel: 'msedge' },
    ],
  },
};
```

## 🔧 Advanced Customization

### Custom Reporter Configuration

```typescript
// utils/custom-reporter.ts
export class MediaNestReporter {
  constructor(options: ReporterOptions) {
    this.options = {
      outputFile: 'reports/medianest-results.json',
      includeScreenshots: true,
      includeHiveMindData: true,
      generateTrends: true,
      ...options,
    };
  }

  onBegin(config: FullConfig, suite: Suite) {
    console.log(`🚀 Starting MediaNest E2E tests with ${config.projects.length} projects`);

    if (process.env.HIVE_MIND_ENABLED === 'true') {
      console.log('🧠 HIVE-MIND coordination enabled');
    }
  }

  onTestEnd(test: TestCase, result: TestResult) {
    // Custom test result processing
    if (result.status === 'failed' && process.env.HIVE_MIND_ENABLED === 'true') {
      // Store failure information in HIVE-MIND for intelligent retry
      this.storeFailureContext(test, result);
    }
  }
}
```

### Environment Detection and Auto-Configuration

```typescript
// config/auto-config.ts
export function detectAndConfigureEnvironment() {
  const env = {
    isCI: !!process.env.CI,
    isLocal: !process.env.CI && process.env.NODE_ENV !== 'production',
    isDocker: !!process.env.DOCKER_CONTAINER,
    isGitHubActions: !!process.env.GITHUB_ACTIONS,
    isGitLabCI: !!process.env.GITLAB_CI,
  };

  // Auto-configure based on environment
  const config = {
    workers: env.isCI ? 2 : 4,
    retries: env.isCI ? 2 : 1,
    reporter: env.isCI ? 'github' : 'html',
    headless: env.isCI || env.isDocker,
    screenshot: env.isCI ? 'only-on-failure' : 'always',
    video: env.isCI ? 'retain-on-failure' : 'off',
  };

  return { env, config };
}
```

## 📋 Configuration Validation

### Environment Validation Script

```bash
#!/bin/bash
# scripts/validate-config.sh

echo "🔍 Validating MediaNest E2E Configuration..."

# Check required environment variables
required_vars=("MEDIANEST_BASE_URL" "ADMIN_USERNAME" "ADMIN_PASSWORD")
for var in "${required_vars[@]}"; do
  if [ -z "${!var}" ]; then
    echo "❌ Missing required environment variable: $var"
    exit 1
  fi
done

# Validate URLs are accessible
if ! curl -f -s "$MEDIANEST_BASE_URL/health" > /dev/null; then
  echo "❌ MediaNest application not accessible at $MEDIANEST_BASE_URL"
  exit 1
fi

# Validate HIVE-MIND settings
if [ "$HIVE_MIND_ENABLED" = "true" ]; then
  if [ -z "$HIVE_NODE_ID" ]; then
    echo "⚠️  HIVE_NODE_ID not set, using default"
    export HIVE_NODE_ID="auto-$(hostname)-$(date +%s)"
  fi
fi

echo "✅ Configuration validation passed"
```

This comprehensive configuration guide provides complete control over every aspect of the MediaNest E2E testing framework, from basic setup to advanced HIVE-MIND coordination and multi-environment deployment.
