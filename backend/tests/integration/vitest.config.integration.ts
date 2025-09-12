/// <reference types="vitest" />
import path from 'path';

import { defineConfig } from 'vitest/config';

/**
 * Vitest Configuration for Integration Tests
 *
 * Replaces Jest configuration with modern Vitest setup for:
 * - Database integration testing
 * - API endpoint testing
 * - Service layer testing
 * - External service mocking
 */
export default defineConfig({
  test: {
    name: 'integration-tests',
    environment: 'node',
    setupFiles: ['./setup/vitest-integration-setup.ts'],
    globals: true,

    // **INTEGRATION TEST OPTIMIZATIONS**
    testTimeout: 45000, // 45 seconds for database operations
    hookTimeout: 15000, // 15 seconds for setup/teardown
    threads: false, // Sequential execution for database consistency
    isolate: true, // Isolate tests for clean database state
    maxConcurrency: 1, // One test at a time for integration

    // **FILE PATTERNS**
    include: [
      'tests/integration/**/*.test.ts',
      'tests/integration/**/*.spec.ts',
      'tests/integration/**/*.integration.ts',
    ],

    exclude: [
      'tests/integration/setup/**',
      'tests/integration/fixtures/**',
      'tests/integration/helpers/**',
    ],

    // **ENVIRONMENT CONFIGURATION**
    env: {
      NODE_ENV: 'test',
      LOG_LEVEL: 'error',

      // Test Database (separate from unit tests)
      DATABASE_URL: 'postgresql://test:test@localhost:5433/medianest_integration_test',
      DATABASE_POOL_SIZE: '2',
      DATABASE_TIMEOUT: '10000',

      // Test Redis (separate instance)
      REDIS_URL: 'redis://localhost:6380/2',
      REDIS_TEST_DB: '2',

      // Authentication
      JWT_SECRET: 'integration-test-jwt-secret-key-32-bytes-long',
      JWT_ISSUER: 'medianest-integration-test',
      JWT_AUDIENCE: 'medianest-integration-users',
      ENCRYPTION_KEY: 'integration-test-key-32-chars-long',

      // External Services (mocked)
      PLEX_CLIENT_ID: 'integration-test-plex-id',
      PLEX_CLIENT_SECRET: 'integration-test-plex-secret',
      FRONTEND_URL: 'http://localhost:3000',

      // Performance settings
      NODE_OPTIONS: '--max-old-space-size=2048',
      DATABASE_LOGGING: 'false',
    },

    // **COVERAGE CONFIGURATION**
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'html', 'json', 'lcov'],
      reportsDirectory: './test-reports/integration/coverage',

      // Include patterns for integration coverage
      include: [
        'src/controllers/**/*.ts',
        'src/services/**/*.ts',
        'src/repositories/**/*.ts',
        'src/middleware/**/*.ts',
        'src/routes/**/*.ts',
      ],

      exclude: [
        'src/**/*.test.ts',
        'src/**/*.spec.ts',
        'src/**/*.d.ts',
        'src/types/**',
        'src/schemas/**',
        'tests/**',
      ],

      // Higher thresholds for integration tests
      thresholds: {
        global: {
          branches: 75,
          functions: 80,
          lines: 75,
          statements: 75,
        },
        // Critical integration paths
        './src/services/': {
          branches: 80,
          functions: 85,
          lines: 80,
          statements: 80,
        },
        './src/controllers/': {
          branches: 75,
          functions: 80,
          lines: 75,
          statements: 75,
        },
      },
    },

    // **REPORTERS**
    reporters: [
      'verbose',
      'json',
      ['html', { outputFile: './test-reports/integration/index.html' }],
      ['junit', { outputFile: './test-reports/integration/junit.xml' }],
    ],

    // **RETRY CONFIGURATION**
    retry: process.env.CI ? 2 : 0,

    // **MOCK CONFIGURATION**
    mockReset: true, // Reset mocks between tests
    clearMocks: true, // Clear mock calls
    restoreMocks: true, // Restore original implementations

    // **POOL OPTIONS**
    pool: 'forks', // Use forks for better isolation
    poolOptions: {
      forks: {
        singleFork: true, // Single fork for integration tests
        isolate: true,
      },
    },
  },

  resolve: {
    alias: {
      '@': path.resolve(__dirname, '../../src'),
      '@tests': path.resolve(__dirname, '..'),
      '@fixtures': path.resolve(__dirname, './fixtures'),
      '@helpers': path.resolve(__dirname, './helpers'),
    },
  },

  // **BUILD OPTIMIZATIONS**
  esbuild: {
    target: 'node18',
    sourcemap: false,
    minify: false,
  },
});
