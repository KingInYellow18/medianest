import { FullConfig } from '@playwright/test';
import { dbHelpers } from './utils/db-helpers';
import { apiHelpers } from './utils/api-helpers';
import { getTestConfig } from '../config/test-constants';

/**
 * Global teardown for E2E tests
 * Runs once after all tests to clean up the test environment
 */
async function globalTeardown(config: FullConfig): Promise<void> {
  console.log('🧹 Starting E2E test global teardown...');

  try {
    // Step 1: Clean up test data
    console.log('🗑️ Cleaning up test data...');
    await cleanupTestData();

    // Step 2: Generate test report
    console.log('📋 Generating test report...');
    await generateTestReport();

    // Step 3: Clean up test files
    console.log('📁 Cleaning up test files...');
    await cleanupTestFiles();

    // Step 4: Close database connection
    console.log('💾 Closing database connection...');
    await dbHelpers.disconnect();

    console.log('✅ Global teardown completed successfully!');
  } catch (error) {
    console.error('❌ Global teardown failed:', error);

    // Try to cleanup critical resources even if other steps failed
    try {
      await dbHelpers.disconnect();
    } catch (cleanupError) {
      console.error('Failed to cleanup database connection:', cleanupError);
    }

    // Don't throw the error to avoid masking test results
    console.warn('⚠️ Some teardown steps failed, but continuing...');
  }
}

/**
 * Clean up test data from database
 */
async function cleanupTestData(): Promise<void> {
  try {
    // Get statistics before cleanup
    const statsBefore = await dbHelpers.getDatabaseStats();
    console.log('  📊 Database stats before cleanup:', statsBefore);

    // Clean up test-specific data
    await dbHelpers.cleanTestData();

    // Verify cleanup
    const statsAfter = await dbHelpers.getDatabaseStats();
    console.log('  📊 Database stats after cleanup:', statsAfter);

    console.log('  ✅ Test data cleanup completed');
  } catch (error) {
    console.error('  ❌ Failed to clean test data:', error);
    throw error;
  }
}

/**
 * Generate comprehensive test report
 */
async function generateTestReport(): Promise<void> {
  const fs = require('fs').promises;

  try {
    const testConfig = getTestConfig('e2e');
    const report = {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'test',
      baseUrl: process.env.BASE_URL || testConfig.server.frontendUrl,
      testEndTime: Date.now(),
      databaseStats: await dbHelpers.getDatabaseStats(),
      cleanup: {
        testDataCleaned: true,
        screenshotsCleaned: false,
        downloadsCleaned: false,
      },
    };

    // Write report
    const reportPath = 'tests/e2e/test-results/teardown-report.json';
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

    console.log('  ✅ Test report generated:', reportPath);
  } catch (error) {
    console.warn('  ⚠️ Failed to generate test report:', error);
  }
}

/**
 * Clean up temporary test files
 */
async function cleanupTestFiles(): Promise<void> {
  const fs = require('fs').promises;
  const path = require('path');

  try {
    const cleanupTasks = [
      {
        name: 'Screenshots',
        path: 'tests/e2e/screenshots',
        keepLatest: 5,
      },
      {
        name: 'Downloads',
        path: 'tests/e2e/downloads',
        keepLatest: 0, // Clean all downloads
      },
    ];

    for (const task of cleanupTasks) {
      try {
        const files = await fs.readdir(task.path).catch(() => []);

        if (files.length > task.keepLatest) {
          // Sort files by modification time
          const fileStats = await Promise.all(
            files.map(async (file) => {
              const filePath = path.join(task.path, file);
              const stat = await fs.stat(filePath);
              return { file, path: filePath, mtime: stat.mtime };
            }),
          );

          // Sort by modification time (oldest first)
          fileStats.sort((a, b) => a.mtime.getTime() - b.mtime.getTime());

          // Remove oldest files
          const filesToRemove = fileStats.slice(0, fileStats.length - task.keepLatest);

          for (const fileToRemove of filesToRemove) {
            await fs.unlink(fileToRemove.path);
          }

          console.log(`  ✅ Cleaned ${filesToRemove.length} ${task.name.toLowerCase()} files`);
        }
      } catch (error) {
        console.warn(`  ⚠️ Failed to clean ${task.name.toLowerCase()}:`, error);
      }
    }
  } catch (error) {
    console.warn('  ⚠️ Failed to cleanup test files:', error);
  }
}

export default globalTeardown;
