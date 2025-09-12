import { defineConfig, devices } from '@playwright/test';
import path from 'path';

/**
 * MediaNest Frontend E2E Testing Configuration
 * Comprehensive Playwright setup for all MediaNest features
 */
export default defineConfig({
  // Test directory and matching patterns
  testDir: './e2e/tests',
  testMatch: /.*\.e2e\.(test|spec)\.(js|ts|mjs)/,
  
  // Global test timeout
  timeout: 30000,
  
  // Expect configuration
  expect: {
    timeout: 10000,
    toHaveScreenshot: {
      maxDiffPixels: 100,
      threshold: 0.2,
      animations: 'disabled',
    },
  },
  
  // Test execution settings
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 4 : undefined,
  
  // Reporting configuration
  reporter: [
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'e2e/results/test-results.json' }],
    ['junit', { outputFile: 'e2e/results/junit.xml' }],
    ['line'],
  ],
  
  // Global test configuration
  use: {
    // Base URL for MediaNest frontend
    baseURL: process.env.BASE_URL || 'http://localhost:5173',
    
    // Tracing and debugging
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    
    // Timeouts
    actionTimeout: 15000,
    navigationTimeout: 30000,
    
    // Browser settings
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true,
    acceptDownloads: true,
    
    // Headers and authentication
    extraHTTPHeaders: {
      'Accept-Language': 'en-US',
    },
    
    // Permissions for MediaNest features
    permissions: ['geolocation', 'notifications', 'camera', 'microphone'],
    
    // Locale and timezone
    colorScheme: 'light',
    locale: 'en-US',
    timezoneId: 'America/New_York',
    
    // Authentication state
    storageState: 'e2e/fixtures/auth.json',
    
    // Browser launch options
    launchOptions: {
      slowMo: process.env.SLOW_MO ? 1000 : 0,
      args: [
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
        '--allow-running-insecure-content',
      ],
    },
  },
  
  // Test projects for different browsers and scenarios
  projects: [
    // Setup project for authentication
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        channel: 'chrome',
      },
    },
    
    // Desktop browsers
    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
        channel: 'chrome',
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
    
    // Mobile devices for MediaNest responsive testing
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
      dependencies: ['setup'],
    },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 13'] },
      dependencies: ['setup'],
    },
    {
      name: 'tablet',
      use: { ...devices['iPad Pro'] },
      dependencies: ['setup'],
    },
    
    // API testing project
    {
      name: 'api-testing',
      testMatch: /.*\.api\.e2e\.ts/,
      use: {
        baseURL: process.env.API_URL || 'http://localhost:3001',
        extraHTTPHeaders: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${process.env.API_TOKEN || 'test-token'}`,
        },
      },
    },
  ],
  
  // Web server configuration for development
  webServer: [
    {
      command: 'npm run dev',
      port: 5173,
      timeout: 120 * 1000,
      reuseExistingServer: !process.env.CI,
      env: {
        VITE_API_URL: 'http://localhost:3001',
        VITE_WS_URL: 'ws://localhost:3001',
      },
    },
  ],
  
  // Global setup and teardown
  globalSetup: './e2e/global-setup.ts',
  globalTeardown: './e2e/global-teardown.ts',
  
  // Output directories
  outputDir: 'e2e/results',
});