import { defineConfig, devices } from '@playwright/test'

/**
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './tests/e2e',
  
  /* Run tests in files in parallel */
  fullyParallel: true,
  
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  
  /* PERFORMANCE OPTIMIZATION: Maximize workers for parallel execution */
  workers: process.env.CI ? 2 : Math.max(2, Math.floor(require('os').cpus().length / 2)),
  
  /* OPTIMIZED REPORTER: Faster output for performance */
  reporter: process.env.CI ? [
    ['html', { outputFolder: 'test-results/html' }],
    ['junit', { outputFile: 'test-results/e2e-results.xml' }]
  ] : [['list']],
  
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: 'http://localhost:3000',
    
    /* PERFORMANCE OPTIMIZATION: Reduce overhead in development */
    trace: process.env.CI ? 'on-first-retry' : 'off',
    screenshot: process.env.CI ? 'only-on-failure' : 'off',
    video: process.env.CI ? 'retain-on-failure' : 'off',
    
    /* OPTIMIZED TIMEOUTS: Faster feedback */
    actionTimeout: process.env.CI ? 10000 : 5000,
    navigationTimeout: process.env.CI ? 30000 : 15000
  },

  /* Configure projects for major browsers and devices */
  projects: [
    // Desktop Browsers
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },

    // Mobile Devices
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
    },
    
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 12'] },
    },

    // Tablet
    {
      name: 'tablet',
      use: { ...devices['iPad Pro'] },
    },

    // Accessibility Testing (with high contrast and reduced motion)
    {
      name: 'accessibility',
      use: {
        ...devices['Desktop Chrome'],
        colorScheme: 'dark',
        reducedMotion: 'reduce',
      },
    },

    // Performance Testing (throttled network)
    {
      name: 'performance',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          slowMo: 100, // Slow down by 100ms
        },
      },
    },

    // Edge Browser
    {
      name: 'edge',
      use: { ...devices['Desktop Edge'] },
    },
  ],

  /* Run your local dev server before starting the tests */
  webServer: {
    command: 'npm run dev',
    port: 3000,
    reuseExistingServer: !process.env.CI,
    timeout: 120000, // 2 minutes for dev server startup
  },
  
  /* CONDITIONAL SETUP: Skip setup overhead in development */
  globalSetup: process.env.CI ? require.resolve('./tests/e2e/global-setup.ts') : undefined,
  globalTeardown: process.env.CI ? require.resolve('./tests/e2e/global-teardown.ts') : undefined,
  
  /* PERFORMANCE-OPTIMIZED TIMEOUT */
  timeout: process.env.CI ? 60000 : 30000, // 1 min CI, 30s dev
  
  /* Expect timeout */
  expect: {
    timeout: 10000 // 10 seconds for assertions
  }
})