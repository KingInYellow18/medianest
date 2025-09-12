/**
 * Coverage Setup Configuration
 *
 * Purpose: Configure optimal environment for coverage measurement
 * Strategy: Maximize accuracy while maintaining reasonable performance
 */

import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest';

// Coverage-specific environment setup
beforeAll(() => {
  // Set coverage mode indicators
  process.env.COVERAGE_MODE = 'true';
  process.env.NODE_ENV = 'test';

  // Optimize memory for coverage analysis
  if (!process.env.NODE_OPTIONS) {
    process.env.NODE_OPTIONS = '--max-old-space-size=4096';
  }

  // Disable verbose logging during coverage runs
  process.env.LOG_LEVEL = 'error';

  // Configure coverage-specific timeouts
  if (global.setTimeout) {
    global.setTimeout(() => {
      throw new Error('Coverage test timeout - consider breaking down large test suites');
    }, 30000); // 30 second global timeout
  }

  console.log('🔍 Coverage measurement mode activated');
});

beforeEach(() => {
  // Reset any global state that might affect coverage measurement
  if (global.gc && typeof global.gc === 'function') {
    global.gc();
  }
});

afterEach(() => {
  // Clean up after each test for accurate coverage
  if (process.env.COVERAGE_MODE === 'true') {
    // Force garbage collection if available
    if (global.gc && typeof global.gc === 'function') {
      global.gc();
    }
  }
});

afterAll(() => {
  console.log('✅ Coverage measurement completed');
});
