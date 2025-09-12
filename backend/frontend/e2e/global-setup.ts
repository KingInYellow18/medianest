import fs from 'fs';
import path from 'path';

import { chromium, FullConfig } from '@playwright/test';

/**
 * Global setup for MediaNest E2E tests
 * Handles authentication and test environment preparation
 */
async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting MediaNest E2E global setup...');

  const { baseURL, storageState } = config.projects[0].use;
  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    // Navigate to MediaNest frontend
    console.log('🌐 Navigating to MediaNest frontend...');
    await page.goto(baseURL!);

    // Wait for app to load
    await page.waitForLoadState('networkidle');

    // Check if we need to authenticate
    const needsAuth = await page
      .locator('[data-testid="login-form"]')
      .isVisible()
      .catch(() => false);

    if (needsAuth) {
      console.log('🔐 Performing authentication...');

      // Fill login form
      await page.fill('[data-testid="email-input"]', 'test@medianest.com');
      await page.fill('[data-testid="password-input"]', 'testpassword123');
      await page.click('[data-testid="login-submit"]');

      // Wait for successful login
      await page.waitForURL('**/dashboard');
      await page.waitForSelector('[data-testid="user-menu"]');

      console.log('✅ Authentication successful');
    }

    // Save authentication state
    const authDir = path.dirname(storageState as string);
    if (!fs.existsSync(authDir)) {
      fs.mkdirSync(authDir, { recursive: true });
    }

    await page.context().storageState({ path: storageState as string });
    console.log('💾 Authentication state saved');

    // Setup test data and environment
    await setupTestEnvironment(page);
  } catch (error) {
    console.error('❌ Global setup failed:', error);
    throw error;
  } finally {
    await browser.close();
  }

  console.log('🎉 Global setup completed successfully');

  return async () => {
    console.log('🧹 Running global teardown...');
    await cleanupTestEnvironment();
  };
}

async function setupTestEnvironment(page: any) {
  console.log('🔧 Setting up test environment...');

  // Add test data to localStorage for testing
  await page.evaluate(() => {
    // Mock services in localStorage for testing
    const testServices = [
      {
        id: 'test-service-1',
        name: 'Test Media Server',
        status: 'active',
        lastChecked: new Date().toISOString(),
        uptime: 0.99,
        responseTime: 120,
        errorCount: 0,
      },
      {
        id: 'test-service-2',
        name: 'Test Database',
        status: 'active',
        lastChecked: new Date().toISOString(),
        uptime: 0.98,
        responseTime: 45,
        errorCount: 1,
      },
    ];

    // Mock media items for testing
    const testMediaItems = [
      {
        id: 'test-video-1',
        title: 'Test Video 1',
        type: 'video',
        duration: '10:45',
        thumbnail: '/api/thumbnails/test-video-1.jpg',
      },
      {
        id: 'test-audio-1',
        title: 'Test Audio 1',
        type: 'audio',
        duration: '03:22',
      },
    ];

    localStorage.setItem('test-services', JSON.stringify(testServices));
    localStorage.setItem('test-media', JSON.stringify(testMediaItems));
    localStorage.setItem('test-environment', 'true');
  });

  console.log('✅ Test environment setup complete');
}

async function cleanupTestEnvironment() {
  // Cleanup test data, reset states, etc.
  console.log('🧹 Test environment cleanup complete');
}

export default globalSetup;
