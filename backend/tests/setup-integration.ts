import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { DatabaseTestUtils } from '../src/config/test-database';

/**
 * Integration test setup for tests that need real database connections
 * Use this when NODE_ENV=test and USE_REAL_DATABASE=true
 */

beforeAll(async () => {
  // Check if we should use real database for integration tests
  if (process.env.USE_REAL_DATABASE === 'true') {
    const isConnected = await DatabaseTestUtils.checkConnection();
    if (!isConnected) {
      throw new Error('Database connection failed. Ensure test database is running on port 5433');
    }
    console.log('✅ Integration test database connected');
  }
});

beforeEach(async () => {
  if (process.env.USE_REAL_DATABASE === 'true') {
    await DatabaseTestUtils.reset();
    await DatabaseTestUtils.seed();
  }
});

afterEach(async () => {
  if (process.env.USE_REAL_DATABASE === 'true') {
    await DatabaseTestUtils.cleanup();
  }
});

afterAll(async () => {
  if (process.env.USE_REAL_DATABASE === 'true') {
    await DatabaseTestUtils.disconnect();
  }
});

// Export test utilities for integration tests
export { DatabaseTestUtils };
