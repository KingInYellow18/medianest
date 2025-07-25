import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/visual',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html'],
    ['json', { outputFile: 'test-results/visual-results.json' }],
    ['list']
  ],
  
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },

  projects: [
    // Desktop browsers
    {
      name: 'chromium-desktop',
      use: { 
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 }
      },
    },
    {
      name: 'firefox-desktop',
      use: { 
        ...devices['Desktop Firefox'],
        viewport: { width: 1280, height: 720 }
      },
    },
    {
      name: 'webkit-desktop',
      use: { 
        ...devices['Desktop Safari'],
        viewport: { width: 1280, height: 720 }
      },
    },

    // Mobile devices
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
      use: { 
        ...devices['iPad Pro'],
        viewport: { width: 1024, height: 768 }
      },
    },

    // High contrast and dark mode testing
    {
      name: 'high-contrast',
      use: {
        ...devices['Desktop Chrome'],
        colorScheme: 'dark',
        extraHTTPHeaders: {
          'prefers-contrast': 'high'
        }
      },
    },

    // Reduced motion testing
    {
      name: 'reduced-motion',
      use: {
        ...devices['Desktop Chrome'],
        extraHTTPHeaders: {
          'prefers-reduced-motion': 'reduce'
        }
      },
    }
  ],

  // Global setup and teardown
  globalSetup: require.resolve('./tests/visual/global-setup.ts'),
  globalTeardown: require.resolve('./tests/visual/global-teardown.ts'),

  // Visual comparison settings
  expect: {
    threshold: 0.2, // Allow 20% difference for visual comparisons
    toHaveScreenshot: {
      threshold: 0.1,
      mode: 'RGB',
      animations: 'disabled' // Disable animations for consistent screenshots
    },
    toMatchSnapshot: {
      threshold: 0.1,
      maxDiffPixels: 1000
    }
  },

  // Local development server
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000, // 2 minutes
  },
});