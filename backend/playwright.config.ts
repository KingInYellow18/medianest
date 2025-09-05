import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: '.env.e2e' });

/**
 * @see https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './tests/e2e/specs',

  /* Run tests in files in parallel */
  fullyParallel: true,

  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,

  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,

  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 4 : undefined,

  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [
    [
      'html',
      {
        outputFolder: 'tests/e2e/reports/html',
        open: process.env.CI ? 'never' : 'on-failure',
      },
    ],
    [
      'junit',
      {
        outputFile: 'tests/e2e/reports/junit/results.xml',
      },
    ],
    [
      'json',
      {
        outputFile: 'tests/e2e/reports/json/results.json',
      },
    ],
    [
      'allure-playwright',
      {
        detail: true,
        outputFolder: 'tests/e2e/reports/allure-results',
        suiteTitle: false,
      },
    ],
    ['line'],
    ...(process.env.CI ? [['github']] : []),
  ],

  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3001',

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: process.env.CI ? 'retain-on-failure' : 'on-first-retry',

    /* Take screenshot on failure */
    screenshot: 'only-on-failure',

    /* Record video on failure */
    video: 'retain-on-failure',

    /* Global timeout */
    actionTimeout: 30000,
    navigationTimeout: 30000,

    /* Ignore HTTPS errors */
    ignoreHTTPSErrors: true,

    /* Extra HTTP headers */
    extraHTTPHeaders: {
      'Accept-Language': 'en-US,en;q=0.9',
    },
  },

  /* Global setup and teardown */
  globalSetup: require.resolve('./tests/e2e/config/global-setup'),
  globalTeardown: require.resolve('./tests/e2e/config/global-teardown'),

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },

    // Desktop Browsers
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Enable Chrome DevTools Protocol for performance metrics
        launchOptions: {
          args: ['--enable-chrome-browser-cloud-management'],
        },
      },
      dependencies: ['setup'],
    },

    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
      dependencies: ['setup'],
    },

    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
      dependencies: ['setup'],
    },

    // Mobile Browsers (Optional)
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
      dependencies: ['setup'],
      testIgnore: ['**/performance/**'], // Skip performance tests on mobile
    },

    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
      dependencies: ['setup'],
      testIgnore: ['**/performance/**'],
    },

    // API Testing (headless)
    {
      name: 'api',
      use: {
        baseURL: process.env.E2E_BASE_URL || 'http://localhost:3001',
      },
      testMatch: '**/api/**/*.spec.ts',
    },

    // Performance Testing
    {
      name: 'performance',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: [
            '--enable-chrome-browser-cloud-management',
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding',
          ],
        },
      },
      testMatch: '**/performance/**/*.spec.ts',
      dependencies: ['setup'],
    },

    // Accessibility Testing
    {
      name: 'accessibility',
      use: { ...devices['Desktop Chrome'] },
      testMatch: '**/accessibility/**/*.spec.ts',
      dependencies: ['setup'],
    },

    // Security Testing
    {
      name: 'security',
      use: { ...devices['Desktop Chrome'] },
      testMatch: '**/security/**/*.spec.ts',
      dependencies: ['setup'],
    },
  ],

  /* Output directories */
  outputDir: 'tests/e2e/test-results/',

  /* Run your local dev server before starting the tests */
  webServer: process.env.CI
    ? undefined
    : {
        command: 'npm run dev',
        url: 'http://localhost:3001/api/v1/health',
        reuseExistingServer: !process.env.CI,
        timeout: 120 * 1000,
        env: {
          NODE_ENV: 'test',
          DATABASE_URL: 'postgresql://e2e_user:e2e_password@localhost:5434/medianest_e2e',
          REDIS_URL: 'redis://localhost:6381',
          JWT_SECRET: 'e2e-jwt-secret-key-for-testing',
          ENCRYPTION_KEY: 'e2e-encryption-key-32-chars-long',
          PLEX_CLIENT_ID: 'e2e-test-client-id',
          PLEX_CLIENT_SECRET: 'e2e-test-client-secret',
          LOG_LEVEL: 'error',
        },
      },

  /* Expect options */
  expect: {
    // Global expect timeout
    timeout: 10000,

    // Threshold for screenshot comparison
    threshold: 0.2,

    // Enable screenshot comparison
    toHaveScreenshot: {
      mode: 'css',
      animations: 'disabled',
    },
  },

  /* Test timeout */
  timeout: 60000,

  /* Maximum time for the whole test suite */
  globalTimeout: 30 * 60 * 1000, // 30 minutes

  /* Maximum failures before stopping */
  maxFailures: process.env.CI ? 20 : 5,
});
