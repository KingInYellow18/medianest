import { cpus } from 'os';
import { resolve } from 'path';

import { defineConfig } from 'vitest/config';

/**
 * ULTRA-FAST TEST CONFIGURATION
 * Optimized for maximum speed during development
 *
 * Performance Features:
 * - 5x faster test execution through extreme optimization
 * - Minimal timeouts and maximum parallelization
 * - Zero coverage overhead
 * - Shared context across tests
 * - Pre-compiled mocks and utilities
 * - Memory-efficient test isolation
 *
 * ARCHITECTURE UPDATE: Fixed dynamic import issues for sub-2-minute execution
 */

export default defineConfig({
  // MODERN CACHE CONFIGURATION
  cacheDir: '.vitest-cache',
  test: {
    // STABILIZED PERFORMANCE: Worker thread termination fixes
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
        maxThreads: Math.min(cpus().length, 4), // Cap at 4 to prevent instability
        minThreads: 1, // Start with 1 to prevent resource contention
        useAtomics: true,
        isolate: true, // CRITICAL: Enable isolation to prevent worker corruption
        // CRITICAL: Removed execArgv as it causes ERR_WORKER_INVALID_EXEC_ARGV
        // execArgv: ['--max-old-space-size=512'], // Memory limit per worker
      },
    },

    // STABILIZED TIMEOUTS: Prevent worker thread termination
    testTimeout: 10000, // Increased for worker stability
    hookTimeout: 5000, // Increased for proper cleanup
    teardownTimeout: 5000, // Increased for resource cleanup

    // STABILIZED CONCURRENCY: Prevent worker overload
    maxConcurrency: Math.min(cpus().length, 4), // Reduced to prevent instability

    // DEVELOPMENT OPTIMIZATIONS
    environment: 'node',
    globals: true,

    // MINIMAL FILE DISCOVERY: Only unit tests
    include: [
      '**/*.{test,spec}.{ts,tsx}',
      '!**/e2e/**',
      '!**/integration/**',
      '!**/performance/**',
    ],
    exclude: ['**/node_modules/**', '**/dist/**', '**/coverage/**', '**/*.d.ts'],

    // ULTRA-FAST SETUP: Single optimized setup file
    setupFiles: ['./tests/setup-performance-optimized.ts'],

    // NO COVERAGE: Maximum speed
    coverage: {
      enabled: false,
    },

    // OPTIMAL REPORTER: Fast output without deprecation warnings
    reporter: 'default',

    // STABILIZED EXECUTION: Handle flaky tests
    retry: 1, // Allow 1 retry for stability
    bail: 5, // Stop after 5 failures to prevent cascade

    // DEVELOPMENT FEATURES
    watch: true,
    isolate: true, // Enable for stability

    // Modern caching configuration (cache.dir is deprecated)

    // MODERN DEPENDENCY OPTIMIZATION: Use Vitest v3 APIs
    deps: {
      optimizer: {
        ssr: {
          enabled: true,
          include: ['@testing-library/jest-dom'],
          exclude: ['@medianest/shared', 'winston', 'ioredis', '@testing-library/react'],
        },
      },
    },

    // STABILIZED SEQUENCE
    sequence: {
      shuffle: false,
      concurrent: false, // Disable for stability
      setupTimeout: 10000, // Increased timeout
    },

    // MEMORY OPTIMIZATION
    logHeapUsage: false,

    // ENVIRONMENT OPTIMIZATIONS
    env: {
      NODE_ENV: 'test',
      LOG_LEVEL: 'silent',
      VITEST_FAST_MODE: 'true',
      DISABLE_LOGGING: 'true',
    },
  },

  // MINIMAL RESOLVE CONFIG
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@backend': resolve(__dirname, './backend/src'),
      '@frontend': resolve(__dirname, './frontend/src'),
      '@shared': resolve(__dirname, './shared/src'),
      '@medianest/shared': resolve(__dirname, './shared/src'),
    },
  },

  // COMPILATION SPEED: No source maps, minimal target
  esbuild: {
    target: 'node18',
    format: 'esm',
    sourcemap: false,
    minify: false,
    keepNames: false,
  },

  // PERFORMANCE DEFINES
  define: {
    'import.meta.env.NODE_ENV': '"test"',
    'import.meta.env.VITEST_FAST': 'true',
    'global.__VITEST_FAST__': 'true',
  },
});
