import { chromium, FullConfig } from '@playwright/test';
import { dbHelpers } from './utils/db-helpers';
import { apiHelpers } from './utils/api-helpers';
import { getTestConfig } from '../config/test-constants';

/**
 * Global setup for E2E tests
 * Runs once before all tests to set up the test environment
 */
async function globalSetup(config: FullConfig): Promise<void> {
  console.log('🚀 Starting E2E test global setup...');

  try {
    // Step 1: Initialize database connection
    console.log('📊 Connecting to test database...');
    await dbHelpers.connect();

    // Step 2: Clean and reset test database
    console.log('🧹 Cleaning test database...');
    await dbHelpers.cleanTestData();

    // Step 3: Run database migrations if needed
    console.log('📋 Running database migrations...');
    await dbHelpers.runMigrations();

    // Step 4: Seed test data
    console.log('🌱 Seeding test users...');
    const testUsers = await dbHelpers.seedTestUsers();
    console.log(`✅ Created ${testUsers.length} test users`);

    // Step 5: Seed test media requests for default user
    console.log('🎬 Seeding test media requests...');
    const testRequests = await dbHelpers.seedTestMediaRequests();
    console.log(`✅ Created ${testRequests.length} test media requests`);

    // Step 6: Verify API is healthy
    console.log('🏥 Checking API health...');
    const healthCheck = await apiHelpers.healthCheck();
    console.log('✅ API is healthy:', healthCheck);

    // Step 7: Create test directories
    console.log('📁 Creating test directories...');
    await createTestDirectories();

    // Step 8: Setup browser for authentication state
    console.log('🌐 Setting up browser authentication...');
    await setupBrowserAuth();

    console.log('✅ Global setup completed successfully!');

  } catch (error) {
    console.error('❌ Global setup failed:', error);
    
    // Cleanup on failure
    try {
      await dbHelpers.disconnect();
    } catch (cleanupError) {
      console.error('Failed to cleanup database connection:', cleanupError);
    }
    
    throw error;
  }
}

/**
 * Create necessary test directories
 */
async function createTestDirectories(): Promise<void> {
  const fs = require('fs').promises;
  const path = require('path');

  const directories = [
    'tests/e2e/screenshots',
    'tests/e2e/downloads',
    'tests/e2e/test-results',
    'tests/e2e/auth-states'
  ];

  for (const dir of directories) {
    try {
      await fs.mkdir(path.resolve(dir), { recursive: true });
      console.log(`  ✅ Created directory: ${dir}`);
    } catch (error) {
      console.warn(`  ⚠️ Failed to create directory ${dir}:`, error);
    }
  }
}

/**
 * Setup browser authentication states for faster test execution
 */
async function setupBrowserAuth(): Promise<void> {
  const browser = await chromium.launch();
  
  try {
    // Setup authenticated state for regular user
    await setupUserAuthState(browser, 'regular-user', {
      email: 'user@medianest.test',
      password: 'UserPassword123!'
    });

    // Setup authenticated state for admin user
    await setupUserAuthState(browser, 'admin-user', {
      email: 'admin@medianest.test',
      password: 'AdminPassword123!'
    });

    // Setup authenticated state for editor user
    await setupUserAuthState(browser, 'editor-user', {
      email: 'editor@medianest.test',
      password: 'EditorPassword123!'
    });

    console.log('  ✅ Browser authentication states created');

  } catch (error) {
    console.warn('  ⚠️ Failed to setup browser auth states:', error);
  } finally {
    await browser.close();
  }
}

/**
 * Setup authentication state for a specific user
 */
async function setupUserAuthState(browser: any, stateName: string, credentials: { email: string; password: string }): Promise<void> {
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Navigate to login page
    const testConfig = getTestConfig('e2e');
    await page.goto(process.env.BASE_URL || `${testConfig.server.frontendUrl}/login`);
    
    // Fill login form
    await page.fill('[data-testid="email-input"]', credentials.email);
    await page.fill('[data-testid="password-input"]', credentials.password);
    
    // Submit form and wait for navigation
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle' }),
      page.click('[data-testid="login-button"]')
    ]);

    // Verify successful login
    const isAuthenticated = page.url().includes('/dashboard');
    
    if (isAuthenticated) {
      // Save authentication state
      await context.storageState({ 
        path: `tests/e2e/auth-states/${stateName}.json` 
      });
      console.log(`  ✅ Authentication state saved for ${stateName}`);
    } else {
      console.warn(`  ⚠️ Failed to authenticate ${stateName}`);
    }

  } catch (error) {
    console.warn(`  ⚠️ Error setting up auth state for ${stateName}:`, error);
  } finally {
    await context.close();
  }
}

export default globalSetup;