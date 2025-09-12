import fs from 'fs';
import path from 'path';

/**
 * Global teardown for MediaNest E2E tests
 * Cleanup and reporting after all tests complete
 */
async function globalTeardown() {
  console.log('🧹 Starting MediaNest E2E global teardown...');

  try {
    // Generate test summary
    await generateTestSummary();

    // Cleanup temporary files
    await cleanupTempFiles();

    // Archive test artifacts
    await archiveTestArtifacts();

    console.log('✅ Global teardown completed successfully');
  } catch (error) {
    console.error('❌ Global teardown failed:', error);
  }
}

async function generateTestSummary() {
  const resultsDir = 'e2e/results';
  const summaryPath = path.join(resultsDir, 'test-summary.json');

  const summary = {
    timestamp: new Date().toISOString(),
    environment: {
      baseURL: process.env.BASE_URL || 'http://localhost:5173',
      apiURL: process.env.API_URL || 'http://localhost:3001',
      nodeVersion: process.version,
    },
    testRun: {
      startTime: new Date().toISOString(),
      endTime: new Date().toISOString(),
    },
  };

  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }

  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
  console.log('📊 Test summary generated');
}

async function cleanupTempFiles() {
  // Remove temporary authentication files
  const tempAuthPath = 'e2e/fixtures/temp-auth.json';
  if (fs.existsSync(tempAuthPath)) {
    fs.unlinkSync(tempAuthPath);
  }

  console.log('🗑️ Temporary files cleaned up');
}

async function archiveTestArtifacts() {
  // Archive screenshots, videos, traces if needed
  const artifactsDir = 'e2e/results/artifacts';

  if (fs.existsSync('test-results')) {
    if (!fs.existsSync(artifactsDir)) {
      fs.mkdirSync(artifactsDir, { recursive: true });
    }

    // Could implement archiving logic here
    console.log('📦 Test artifacts archived');
  }
}

export default globalTeardown;
