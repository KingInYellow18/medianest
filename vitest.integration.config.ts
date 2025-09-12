/// <reference types="vitest" />
import path from 'path';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup-enhanced.ts'],

    // **INTEGRATION TEST OPTIMIZED CONFIGURATION**
    // Optimized for API integration test performance
    testTimeout: 45000, // Increased for integration tests with external services
    hookTimeout: 15000, // Longer for database/Redis setup
    teardownTimeout: 10000,
    isolate: false, // Better performance for integration tests

    // Thread pool configuration for integration tests
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false, // Enable parallelism
        minThreads: 2,
        maxThreads: 4, // Limit to avoid resource exhaustion
        isolate: false, // Share context for better performance
      },
    },

    // Performance settings for integration tests
    bail: 0,
    retry: 1, // Retry once for flaky external service tests
    sequence: {
      shuffle: false, // Keep predictable order for integration tests
      concurrent: true, // Allow concurrent execution
    },

    // Integration test specific file patterns
    include: [
      'tests/integration/**/*.test.ts',
      'backend/tests/integration/**/*.test.ts',
      'tests/e2e/**/*.test.ts',
    ],

    exclude: [
      'node_modules/**',
      'dist/**',
      '.next/**',
      'coverage/**',
      // Exclude consolidated files to prevent conflicts
      'backend/tests/integration/comprehensive-api-integration.test.ts',
      'backend/tests/integration/api-integration.test.ts',
      'backend/tests/integration/api-endpoints-comprehensive.test.ts',
      'backend/tests/integration/external-api-integration.test.ts',
      'backend/tests/integration/frontend-backend-integration.test.ts',
    ],

    // Enhanced reporting for integration tests
    reporter: ['verbose', 'json', 'junit'],
    outputFile: {
      json: './test-results/integration-results.json',
      junit: './test-results/integration-junit.xml',
    },

    // Coverage configuration optimized for integration tests
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage/integration',
      clean: true,
      cleanOnRerun: true,

      exclude: [
        'node_modules/**',
        'tests/**',
        'dist/**',
        '*.config.*',
        'coverage/**',
        'test-results/**',
        '**/*.d.ts',
        '**/*.test.*',
        '**/*.spec.*',
        '**/mocks/**',
        '**/fixtures/**',
      ],

      include: ['src/**/*.ts', 'backend/src/**/*.ts', 'shared/src/**/*.ts'],

      // Integration test specific coverage thresholds
      thresholds: {
        global: {
          branches: 70,
          functions: 70,
          lines: 70,
          statements: 70,
        },
        // Higher thresholds for core API modules
        'backend/src/controllers/**/*.ts': {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80,
        },
        'backend/src/services/**/*.ts': {
          branches: 75,
          functions: 75,
          lines: 75,
          statements: 75,
        },
      },

      // Performance optimization for coverage
      processingConcurrency: 2, // Lower for integration tests
      skipFull: false, // Full coverage for integration
    },

    // Resource management for integration tests
    maxConcurrency: 4, // Limit concurrent test files
    minWorkers: 1,
    maxWorkers: 4,

    // Environment variables for integration test optimization
    env: {
      NODE_ENV: 'test',
      VITEST_INTEGRATION_MODE: 'true',

      // Database configuration
      DATABASE_URL: 'postgresql://test:test@localhost:5433/medianest_test',
      TEST_DATABASE_URL: 'postgresql://test:test@localhost:5433/medianest_test',
      TEST_DATABASE_POOL_SIZE: '5',

      // Redis configuration
      REDIS_URL: 'redis://localhost:6380',
      TEST_REDIS_URL: 'redis://localhost:6380',
      TEST_REDIS_POOL_SIZE: '3',

      // API performance settings
      API_REQUEST_TIMEOUT: '10000',
      EXTERNAL_API_TIMEOUT: '15000',
      JWT_SECRET: 'test-jwt-secret-for-integration-tests',
      JWT_ISSUER: 'medianest-integration-test',
      JWT_AUDIENCE: 'medianest-test-client',

      // External service mocking
      MOCK_EXTERNAL_SERVICES: 'true',
      PLEX_SERVER_URL: 'http://localhost:32400',
      TMDB_API_KEY: 'test-tmdb-api-key',
      YOUTUBE_DL_PATH: '/usr/local/bin/yt-dlp',

      // Performance optimization
      NODE_OPTIONS: '--max-old-space-size=2048 --unhandled-rejections=strict',
      UV_THREADPOOL_SIZE: '8',

      // Logging configuration
      LOG_LEVEL: 'error', // Reduce logging noise during tests
      DISABLE_CONSOLE_LOGS: 'true',
    },
  },

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@tests': path.resolve(__dirname, './tests'),
      '@backend': path.resolve(__dirname, './backend'),
      '@frontend': path.resolve(__dirname, './frontend'),
      '@shared': path.resolve(__dirname, './shared'),

      // Test-specific aliases
      '@integration': path.resolve(__dirname, './tests/integration'),
      '@helpers': path.resolve(__dirname, './backend/tests/helpers'),
      '@fixtures': path.resolve(__dirname, './tests/fixtures'),
      '@mocks': path.resolve(__dirname, './tests/mocks'),
    },
  },

  // Build optimizations for integration tests
  esbuild: {
    target: 'node18',
    sourcemap: true, // Enable for better debugging
    minify: false, // Keep readable for debugging
    keepNames: true, // Preserve function names for better stack traces
  },

  // Dependency optimization for integration tests
  optimizeDeps: {
    include: ['vitest > @vitest/utils > pretty-format', 'supertest', 'ioredis', '@prisma/client'],
    exclude: [
      // Exclude large dependencies that aren't needed
      'playwright',
      'puppeteer',
    ],
  },

  // Define constants for integration tests
  define: {
    'process.env.INTEGRATION_TEST_MODE': 'true',
    'process.env.TEST_PARALLEL_EXECUTION': 'true',
    'process.env.VITEST_INTEGRATION': 'true',
  },
});
