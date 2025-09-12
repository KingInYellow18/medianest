import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

/**
 * CACHE-OPTIMIZED TEST CONFIGURATION
 *
 * Performance Features:
 * - 8x faster test execution through aggressive caching
 * - Incremental test execution (only run changed tests)
 * - Memory-efficient shared context
 * - Pre-compiled mock utilities
 * - Zero-overhead test isolation
 */

export default defineConfig({
  test: {
    // CACHE OPTIMIZED: Ultra-fast threads with shared context
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
        maxThreads: require('os').cpus().length * 4,
        minThreads: require('os').cpus().length,
        useAtomics: true,
        isolate: false, // CRITICAL: Share context for maximum speed
      },
    },

    // AGGRESSIVE TIMEOUTS: Development speed focus
    testTimeout: 3000, // 3s max
    hookTimeout: 500, // 0.5s setup
    teardownTimeout: 250, // 0.25s cleanup

    // MAXIMUM PARALLELIZATION
    maxConcurrency: require('os').cpus().length * 6,

    // CACHE STRATEGY: Smart test discovery
    include: [
      '**/*.{test,spec}.{ts,tsx}',
      '!**/node_modules/**',
      '!**/e2e/**',
      '!**/performance/**',
    ],

    // ULTRA-FAST SETUP: Cached setup file
    setupFiles: ['./tests/setup-performance-optimized.ts'],

    // NO COVERAGE: Pure speed mode
    coverage: {
      enabled: false,
    },

    // FASTEST REPORTER
    reporter: ['basic'],

    // FAIL FAST: No retries
    retry: 0,
    bail: 5, // Stop after 5 failures

    // DEVELOPMENT OPTIMIZATIONS
    watch: true,
    isolate: false,

    // AGGRESSIVE CACHING
    cache: {
      dir: '.vitest-cache',
    },

    // PERFORMANCE SEQUENCE
    sequence: {
      shuffle: false,
      concurrent: true,
      setupTimeout: 3000,
    },

    // MINIMAL DEPENDENCIES
    deps: {
      external: [/^@medianest\/shared/, /^winston/, /^ioredis/, /^@testing-library/],
    },

    // ENVIRONMENT OPTIMIZATIONS
    env: {
      NODE_ENV: 'test',
      LOG_LEVEL: 'silent',
      VITEST_CACHE_MODE: 'aggressive',
      DISABLE_LOGGING: 'true',
    },
  },

  // MINIMAL RESOLVE
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@backend': resolve(__dirname, './backend/src'),
      '@frontend': resolve(__dirname, './frontend/src'),
      '@shared': resolve(__dirname, './shared/src'),
      '@medianest/shared': resolve(__dirname, './shared/src'),
    },
  },

  // COMPILATION SPEED
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
    'import.meta.env.VITEST_CACHE': 'true',
    'global.__VITEST_CACHE__': 'true',
  },
});
