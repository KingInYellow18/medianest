import { defineConfig, devices } from '@playwright/test';

/**
 * Comprehensive Playwright Configuration for MediaNest E2E Tests
 * Supports multiple browsers, devices, and testing scenarios including:
 * - Cross-browser testing (Chrome, Firefox, Safari, Edge)
 * - Mobile and tablet device testing
 * - Visual regression testing
 * - Performance testing
 * - Accessibility testing
 */

export default defineConfig({
  testDir: './backend/tests/e2e',
  
  /* Run tests in files in parallel */
  fullyParallel: true,
  
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  
  /* Timeout configuration */
  timeout: 60 * 1000, // 60 seconds per test
  expect: {
    timeout: 10 * 1000, // 10 seconds for expect assertions
  },
  
  /* Global test timeout */
  globalTimeout: 30 * 60 * 1000, // 30 minutes for entire test suite
  
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [
    ['html', { 
      outputFolder: 'backend/tests/e2e/test-results/html-report',
      open: 'never'
    }],
    ['json', { 
      outputFile: 'backend/tests/e2e/test-results/results.json'
    }],
    ['junit', { 
      outputFile: 'backend/tests/e2e/test-results/junit.xml'
    }],
    ['list'],
    ...(process.env.CI ? [['github']] : [])
  ],

  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000',

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
    
    /* Take screenshot on test failure */
    screenshot: 'only-on-failure',
    
    /* Record video on test failure */
    video: 'retain-on-failure',
    
    /* Global timeout for all actions */
    actionTimeout: 15 * 1000,
    
    /* Global timeout for navigation */
    navigationTimeout: 30 * 1000,
    
    /* Ignore HTTPS errors */
    ignoreHTTPSErrors: true,
    
    /* Accept downloads */
    acceptDownloads: true,
    
    /* Locale and timezone */
    locale: 'en-US',
    timezoneId: 'America/New_York',
    
    /* Extra HTTP headers */
    extraHTTPHeaders: {
      'Accept-Language': 'en-US,en;q=0.9'
    }
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
      teardown: 'cleanup',
    },
    {
      name: 'cleanup',
      testMatch: /.*\.teardown\.ts/,
    },

    /* Desktop Browsers */
    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
        channel: 'chrome',
        // Chrome-specific launch options
        launchOptions: {
          args: [
            '--disable-web-security',
            '--disable-dev-shm-usage',
            '--no-sandbox',
            '--disable-gpu'
          ]
        }
      },
      dependencies: ['setup']
    },
    {
      name: 'firefox',
      use: { 
        ...devices['Desktop Firefox'],
        // Firefox-specific launch options
        launchOptions: {
          firefoxUserPrefs: {
            'media.navigator.streams.fake': true,
            'media.navigator.permission.disabled': true
          }
        }
      },
      dependencies: ['setup']
    },
    {
      name: 'webkit',
      use: { 
        ...devices['Desktop Safari']
      },
      dependencies: ['setup']
    },
    {
      name: 'edge',
      use: { 
        ...devices['Desktop Edge'],
        channel: 'msedge'
      },
      dependencies: ['setup']
    },

    /* Mobile Browsers */
    {
      name: 'Mobile Chrome',
      use: { 
        ...devices['Pixel 5']
      },
      dependencies: ['setup']
    },
    {
      name: 'Mobile Safari',
      use: { 
        ...devices['iPhone 14']
      },
      dependencies: ['setup']
    },
    {
      name: 'Mobile Safari Large',
      use: { 
        ...devices['iPhone 14 Pro Max']
      },
      dependencies: ['setup']
    },

    /* Tablet Browsers */
    {
      name: 'iPad',
      use: { 
        ...devices['iPad Pro']
      },
      dependencies: ['setup']
    },
    {
      name: 'iPad Mini',
      use: { 
        ...devices['iPad Mini']
      },
      dependencies: ['setup']
    },
    {
      name: 'Galaxy Tab',
      use: { 
        ...devices['Galaxy Tab S4']
      },
      dependencies: ['setup']
    },

    /* Custom Responsive Testing Viewports */
    {
      name: 'Small Mobile',
      use: {
        viewport: { width: 320, height: 568 },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true
      },
      dependencies: ['setup']
    },
    {
      name: 'Large Mobile',
      use: {
        viewport: { width: 414, height: 896 },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true
      },
      dependencies: ['setup']
    },
    {
      name: 'Small Tablet Portrait',
      use: {
        viewport: { width: 768, height: 1024 },
        deviceScaleFactor: 2,
        isMobile: false,
        hasTouch: true
      },
      dependencies: ['setup']
    },
    {
      name: 'Large Tablet Landscape',
      use: {
        viewport: { width: 1366, height: 1024 },
        deviceScaleFactor: 1,
        isMobile: false,
        hasTouch: true
      },
      dependencies: ['setup']
    },
    {
      name: 'Desktop HD',
      use: {
        viewport: { width: 1920, height: 1080 },
        deviceScaleFactor: 1,
        isMobile: false,
        hasTouch: false
      },
      dependencies: ['setup']
    },
    {
      name: '4K Desktop',
      use: {
        viewport: { width: 3840, height: 2160 },
        deviceScaleFactor: 2,
        isMobile: false,
        hasTouch: false
      },
      dependencies: ['setup']
    },

    /* Performance Testing Configuration */
    {
      name: 'Performance Tests',
      testMatch: /.*performance.*\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: [
            '--enable-precise-memory-info',
            '--enable-automation',
            '--no-first-run',
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding'
          ]
        }
      },
      dependencies: ['setup']
    },

    /* Accessibility Testing Configuration */
    {
      name: 'Accessibility Tests',
      testMatch: /.*accessibility.*\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: [
            '--force-prefers-reduced-motion',
            '--force-prefers-no-animation'
          ]
        }
      },
      dependencies: ['setup']
    },

    /* Visual Regression Testing */
    {
      name: 'Visual Regression',
      testMatch: /.*visual.*\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        // Consistent rendering for screenshots
        launchOptions: {
          args: [
            '--font-render-hinting=none',
            '--disable-skia-runtime-opts',
            '--disable-system-font-check',
            '--disable-font-subpixel-positioning',
            '--disable-lcd-text'
          ]
        }
      },
      dependencies: ['setup']
    }
  ],

  /* Test directory structure */
  testIgnore: [
    '**/node_modules/**',
    '**/test-results/**',
    '**/playwright-report/**'
  ],

  /* Output directories */
  outputDir: 'backend/tests/e2e/test-results/artifacts',
  
  /* Global setup and teardown */
  globalSetup: require.resolve('./backend/tests/e2e/global-setup.ts'),
  globalTeardown: require.resolve('./backend/tests/e2e/global-teardown.ts'),

  /* Web Server configuration for local development */
  webServer: process.env.CI ? undefined : {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000, // 2 minutes to start
    stdout: 'ignore',
    stderr: 'pipe'
  },

  /* Environment-specific configuration */
  ...(process.env.E2E_HEADED && {
    use: {
      headless: false,
      slowMo: 500
    }
  }),

  /* CI-specific optimizations */
  ...(process.env.CI && {
    workers: 2,
    retries: 3,
    use: {
      trace: 'on-all-retry',
      video: 'retain-on-failure'
    }
  }),

  /* Metadata for test results */
  metadata: {
    'Test Environment': process.env.NODE_ENV || 'development',
    'Base URL': process.env.E2E_BASE_URL || 'http://localhost:3000',
    'Timestamp': new Date().toISOString(),
    'OS': process.platform,
    'Node Version': process.version,
    'CI': process.env.CI || 'false'
  }
});