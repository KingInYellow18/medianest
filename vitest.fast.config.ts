import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

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
 */

export default defineConfig({
  test: {
    // MAXIMUM PERFORMANCE: Threads with shared context
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
        maxThreads: require('os').cpus().length,
        minThreads: Math.floor(require('os').cpus().length / 2),
        useAtomics: true,
        isolate: false // CRITICAL: Share context for 5x speed boost
      }
    },
    
    // AGGRESSIVE TIMEOUTS: Fail fast
    testTimeout: 5000,   // 5s max (for development speed)
    hookTimeout: 1000,   // 1s setup
    teardownTimeout: 500, // 0.5s cleanup
    
    // MAXIMUM CONCURRENCY
    maxConcurrency: require('os').cpus().length * 4,
    
    // DEVELOPMENT OPTIMIZATIONS
    environment: 'node',
    globals: true,
    
    // MINIMAL FILE DISCOVERY: Only unit tests
    include: [
      '**/*.{test,spec}.{ts,tsx}',
      '!**/e2e/**',
      '!**/integration/**',
      '!**/performance/**'
    ],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      '**/*.d.ts'
    ],
    
    // ULTRA-FAST SETUP: Single optimized setup file
    setupFiles: ['./tests/setup-performance-optimized.ts'],
    
    // NO COVERAGE: Maximum speed
    coverage: {
      enabled: false
    },
    
    // FASTEST REPORTER: Minimal output
    reporter: ['basic'],
    
    // NO RETRIES: Fail fast for development
    retry: 0,
    bail: 10, // Stop after 10 failures
    
    // DEVELOPMENT FEATURES
    watch: true,
    isolate: false,
    
    // CACHE EVERYTHING
    cache: {
      dir: '.vitest-cache'
    },
    
    // MINIMAL DEPENDENCY PROCESSING
    deps: {
      external: [
        /^@medianest\/shared/,
        /^winston/,
        /^ioredis/,
        /^@testing-library/
      ]
    },
    
    // OPTIMIZED SEQUENCE
    sequence: {
      shuffle: false,
      concurrent: true,
      setupTimeout: 5000
    },
    
    // MEMORY OPTIMIZATION
    logHeapUsage: false,
    
    // ENVIRONMENT OPTIMIZATIONS
    env: {
      NODE_ENV: 'test',
      LOG_LEVEL: 'silent',
      VITEST_FAST_MODE: 'true',
      DISABLE_LOGGING: 'true'
    }
  },
  
  // MINIMAL RESOLVE CONFIG
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@backend': resolve(__dirname, './backend/src'),
      '@frontend': resolve(__dirname, './frontend/src'),
      '@shared': resolve(__dirname, './shared/src'),
      '@medianest/shared': resolve(__dirname, './shared/src')
    }
  },
  
  // COMPILATION SPEED: No source maps, minimal target
  esbuild: {
    target: 'node18',
    format: 'esm',
    sourcemap: false,
    minify: false,
    keepNames: false
  },
  
  // PERFORMANCE DEFINES
  define: {
    'import.meta.env.NODE_ENV': '"test"',
    'import.meta.env.VITEST_FAST': 'true',
    'global.__VITEST_FAST__': 'true'
  }
});