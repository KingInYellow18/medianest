/**
 * Vitest Configuration for Performance Tests
 * Optimized for performance testing with longer timeouts and parallel execution
 */

import { resolve } from 'path';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'performance',
    environment: 'node',
    
    // Performance test specific settings
    testTimeout: 120000, // 2 minutes per test (performance tests can be slow)
    hookTimeout: 30000,  // 30 seconds for setup/teardown
    teardownTimeout: 30000,
    
    // Enable threads for parallel execution
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
        maxThreads: 4,
        minThreads: 2
      }
    },
    
    // Performance test file patterns
    include: [
      '**/*.{test,spec}.performance.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
      '**/performance-suite.test.ts'
    ],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.git/**',
      '**/coverage/**'
    ],
    
    // Globals for performance testing
    globals: true,
    
    // Setup files for performance testing
    setupFiles: [
      './performance-setup.ts'
    ],
    
    // Environment variables for performance tests
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: process.env.TEST_DATABASE_URL || 'postgresql://test_user:test_password@localhost:5432/medianest_performance_test',
      REDIS_URL: process.env.TEST_REDIS_URL || 'redis://localhost:6379/15',
      LOG_LEVEL: 'warn', // Reduce logging noise during performance tests
      PERFORMANCE_TESTING: 'true',
      
      // Performance test specific settings
      ENABLE_RATE_LIMITING: 'false',
      ENABLE_CSRF_PROTECTION: 'false',
      STRICT_VALIDATION: 'false',
      COLLECT_METRICS: 'true',
      ENABLE_PROFILING: 'true'
    },
    
    // Coverage configuration (disabled for performance tests)
    coverage: {
      enabled: false,
      provider: 'v8'
    },
    
    // Reporter configuration
    reporter: [
      'verbose',
      'json',
      ['html', { outputFile: './performance/coverage/index.html' }],
      ['junit', { outputFile: './performance/test-results.xml' }]
    ],
    
    // Output directory for performance test results
    outputFile: {
      json: './performance/test-results.json',
      junit: './performance/junit.xml'
    },
    
    // Watch mode configuration (usually disabled for performance tests)
    watch: false,
    
    // Retry configuration for flaky performance tests
    retry: 1,
    
    // Bail early if tests fail
    bail: 0,
    
    // Memory and resource settings
    maxConcurrency: 4,
    
    // Alias configuration
    alias: {
      '@': resolve(__dirname, '../../src'),
      '@/backend': resolve(__dirname, '../../backend/src'),
      '@/frontend': resolve(__dirname, '../../frontend/src'),
      '@/shared': resolve(__dirname, '../../shared/src'),
      '@/tests': resolve(__dirname, '../')
    },
    
    // Define configuration
    define: {
      __TEST_PERFORMANCE__: true,
      __TEST_TIMEOUT__: 120000
    },
    
    // Dependency optimization for performance tests
    deps: {
      inline: [
        // Include test utilities
        '@testing-library/react',
        '@testing-library/jest-dom',
        '@testing-library/user-event'
      ]
    },
    
    // Isolate performance tests from other test suites
    isolate: true,
    
    // Pool configuration for optimal performance
    sequence: {
      shuffle: false, // Maintain consistent test order for performance comparison
      concurrent: true
    }
  },
  
  // Resolve configuration
  resolve: {
    alias: {
      '@': resolve(__dirname, '../../src'),
      '@/backend': resolve(__dirname, '../../backend/src'),
      '@/frontend': resolve(__dirname, '../../frontend/src'),
      '@/shared': resolve(__dirname, '../../shared/src'),
      '@/tests': resolve(__dirname, '../')
    }
  },
  
  // Define global constants
  define: {
    global: 'globalThis'
  }
});