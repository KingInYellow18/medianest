import { defineConfig, devices } from '@playwright/test'
import dotenv from 'dotenv'
import path from 'path'

// Load environment variables
dotenv.config({ path: '.env.test.local' })
dotenv.config({ path: '.env.test' })
dotenv.config({ path: '.env.local' })
dotenv.config({ path: '.env' })

/**
 * Comprehensive Playwright configuration for MediaNest E2E Testing
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './.medianest-e2e/specs',
  
  /* Test execution configuration */
  fullyParallel: !process.env.CI, // Parallel locally, sequential in CI for stability
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 3 : 1, // More retries in CI due to flakiness
  workers: process.env.CI ? 2 : '50%', // Controlled parallelism
  
  /* Test timeout and limits */
  timeout: 60000, // Global test timeout
  expect: {
    timeout: 15000, // Assertion timeout
    toHaveScreenshot: { 
      threshold: 0.2,
      mode: 'pixel',
      animations: 'disabled'
    },
    toMatchSnapshot: { threshold: 0.2 }
  },
  
  /* Output directories */
  outputDir: './.medianest-e2e/test-results',
  
  /* Global test options */
  maxFailures: process.env.CI ? 5 : undefined, // Stop after 5 failures in CI
  
  /* Enhanced reporters */
  reporter: [
    ['html', { 
      outputFolder: './.medianest-e2e/reports/html',
      open: 'never'
    }],
    ['junit', { 
      outputFile: './.medianest-e2e/reports/junit/results.xml'
    }],
    ['json', { 
      outputFile: './.medianest-e2e/reports/json/results.json'
    }],
    ['allure-playwright', {
      outputFolder: './.medianest-e2e/reports/allure-results'
    }],
    process.env.CI ? ['github'] : ['list']
  ],
  
  /* Enhanced global test options */
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    
    /* Tracing and debugging */
    trace: process.env.CI ? 'on-first-retry' : 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    
    /* Timeouts */
    actionTimeout: 15000,
    navigationTimeout: 45000,
    
    /* Browser context options */
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true,
    bypassCSP: false,
    
    /* Locale and timezone */
    locale: 'en-US',
    timezoneId: 'America/New_York',
    
    /* Storage state persistence */
    storageState: './.medianest-e2e/fixtures/auth/anonymous.json',
    
    /* Additional context options */
    extraHTTPHeaders: {
      'Accept-Language': 'en-US,en;q=0.9'
    },
    
    /* Test annotations */
    testIdAttribute: 'data-testid'
  },

  /* Comprehensive browser and device testing matrix */
  projects: [
    // Setup project for global setup
    {
      name: 'setup',
      testMatch: /global\.setup\.ts/,
      teardown: 'cleanup'
    },
    {
      name: 'cleanup',
      testMatch: /global\.teardown\.ts/
    },

    // Desktop Browsers - Core Testing
    {
      name: 'chromium-desktop',
      use: { 
        ...devices['Desktop Chrome'],
        channel: 'chrome'
      },
      dependencies: ['setup']
    },
    
    {
      name: 'firefox-desktop',
      use: { 
        ...devices['Desktop Firefox']
      },
      dependencies: ['setup']
    },
    
    {
      name: 'webkit-desktop',
      use: { 
        ...devices['Desktop Safari']
      },
      dependencies: ['setup']
    },

    // Edge Browser
    {
      name: 'edge-desktop',
      use: { 
        ...devices['Desktop Edge'],
        channel: 'msedge'
      },
      dependencies: ['setup']
    },

    // Mobile Testing
    {
      name: 'mobile-chrome',
      use: { 
        ...devices['Pixel 5']
      },
      dependencies: ['setup'],
      testIgnore: '**/visual/**' // Skip heavy visual tests on mobile
    },
    
    {
      name: 'mobile-safari',
      use: { 
        ...devices['iPhone 12']
      },
      dependencies: ['setup'],
      testIgnore: '**/visual/**'
    },

    // Tablet Testing
    {
      name: 'tablet-chrome',
      use: { 
        ...devices['iPad Pro']
      },
      dependencies: ['setup']
    },

    // Accessibility Testing
    {
      name: 'accessibility',
      use: {
        ...devices['Desktop Chrome'],
        colorScheme: 'dark',
        reducedMotion: 'reduce',
        forcedColors: 'active'
      },
      dependencies: ['setup'],
      testMatch: '**/accessibility/**',
      grep: /@accessibility/
    },

    // Performance Testing
    {
      name: 'performance',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: [
            '--disable-dev-shm-usage',
            '--no-sandbox',
            '--disable-extensions'
          ]
        }
      },
      dependencies: ['setup'],
      testMatch: '**/performance/**',
      grep: /@performance/
    },

    // Visual Regression Testing
    {
      name: 'visual-chrome',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 }
      },
      dependencies: ['setup'],
      testMatch: '**/visual/**',
      grep: /@visual/
    },

    // API Testing (headless)
    {
      name: 'api-testing',
      use: {
        baseURL: process.env.API_BASE_URL || 'http://localhost:3001',
        extraHTTPHeaders: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      },
      dependencies: ['setup'],
      testMatch: '**/api/**',
      grep: /@api/
    },

    // Authenticated User Testing
    {
      name: 'authenticated',
      use: {
        ...devices['Desktop Chrome'],
        storageState: './.medianest-e2e/fixtures/auth/authenticated-user.json'
      },
      dependencies: ['setup'],
      grep: /@auth/
    },

    // Admin User Testing
    {
      name: 'admin',
      use: {
        ...devices['Desktop Chrome'],
        storageState: './.medianest-e2e/fixtures/auth/admin-user.json'
      },
      dependencies: ['setup'],
      grep: /@admin/
    }
  ],

  /* Web server configuration for different environments */
  webServer: process.env.SKIP_SERVER_START ? undefined : [
    // Frontend server
    {
      command: process.env.CI ? 'npm run build && npm run start' : 'npm run dev',
      port: 3000,
      reuseExistingServer: !process.env.CI,
      timeout: 180000, // 3 minutes for server startup
      env: {
        NODE_ENV: process.env.CI ? 'production' : 'development'
      }
    },
    // Backend API server (if separate)
    ...(process.env.BACKEND_URL ? [] : [{
      command: 'cd backend && npm run dev',
      port: 3001,
      reuseExistingServer: !process.env.CI,
      timeout: 120000
    }])
  ],
  
  /* Global setup and teardown */
  globalSetup: require.resolve('./.medianest-e2e/config/global-setup.ts'),
  globalTeardown: require.resolve('./.medianest-e2e/config/global-teardown.ts'),
  
  /* Metadata */
  metadata: {
    'test-suite': 'MediaNest E2E Tests',
    'version': '1.0.0',
    'environment': process.env.NODE_ENV || 'development'
  }
})