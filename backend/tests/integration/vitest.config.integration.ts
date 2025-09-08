/**
 * Vitest Configuration for Integration Tests
 * 
 * Optimized configuration for integration testing with:
 * - Extended timeouts and memory management
 * - Database and service setup hooks
 * - Coverage reporting with integration focus
 * - Parallel execution coordination
 */

import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    // Test environment
    environment: 'node',
    
    // Test file patterns
    include: [
      'tests/integration/**/*.test.{ts,js}',
      'tests/integration/**/*.integration.{ts,js}'
    ],
    
    // Exclude patterns
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/*.d.ts'
    ],
    
    // Timeout configuration
    testTimeout: 300000, // 5 minutes for integration tests
    hookTimeout: 60000,  // 1 minute for setup/teardown hooks
    
    // Global setup and teardown
    globalSetup: [
      './tests/integration/setup/global-setup.ts'
    ],
    
    globalTeardown: [
      './tests/integration/setup/global-teardown.ts'
    ],
    
    // Setup files run for each test file
    setupFiles: [
      './tests/integration/setup/test-setup.ts'
    ],
    
    // Parallel execution configuration
    pool: 'threads',
    threads: {
      minThreads: 1,
      maxThreads: process.env.CI ? 2 : 4
    },
    
    // Isolation configuration
    isolate: true,
    
    // Coverage configuration
    coverage: {
      enabled: process.env.COLLECT_COVERAGE === 'true',
      provider: 'v8',
      
      // Include patterns
      include: [
        'src/**/*.{ts,js}',
        '!src/**/*.d.ts',
        '!src/**/*.test.{ts,js}',
        '!src/**/__tests__/**'
      ],
      
      // Exclude patterns
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/tests/**',
        '**/*.config.*',
        '**/*.setup.*'
      ],
      
      // Coverage thresholds
      thresholds: {
        global: {
          lines: 75,
          functions: 75,
          branches: 70,
          statements: 75
        }
      },
      
      // Reporters
      reporter: [
        'text',
        'text-summary',
        'html',
        'lcov',
        'json'
      ],
      
      // Output directory
      reportsDirectory: './test-reports/integration/coverage'
    },
    
    // Reporters
    reporter: [
      'verbose',
      'json',
      ['html', { 
        outputFile: './test-reports/integration/index.html',
        subdir: '.'
      }],
      ['junit', { 
        outputFile: './test-reports/integration/junit.xml'
      }]
    ],
    
    // Output configuration
    outputFile: {
      json: './test-reports/integration/results.json',
      html: './test-reports/integration/index.html',
      junit: './test-reports/integration/junit.xml'
    },
    
    // Watch mode configuration
    watch: false, // Integration tests typically don't run in watch mode
    
    // Retry configuration
    retry: process.env.CI ? 2 : 0,
    
    // Bail configuration
    bail: process.env.CI ? 1 : 0,
    
    // Sequence configuration
    sequence: {
      hooks: 'stack', // Run hooks in sequence
      concurrent: false // Don't run different test files concurrently by default
    },
    
    // Pool options for better resource management
    poolOptions: {
      threads: {
        // Minimum number of threads
        minThreads: 1,
        // Maximum number of threads  
        maxThreads: process.env.CI ? 2 : 4,
        // Thread isolation
        isolate: true,
        // Use single thread for heavy integration tests
        singleThread: process.env.SINGLE_THREAD === 'true'
      }
    },
    
    // File parallelism
    fileParallelism: process.env.PARALLEL_FILES !== 'false',
    
    // Test name pattern
    testNamePattern: process.env.TEST_NAME_PATTERN,
    
    // Globals (if needed)
    globals: true,
    
    // Log heap usage
    logHeapUsage: process.env.LOG_HEAP === 'true',
    
    // Open handles detection
    detectOpenHandles: true,
    
    // Environment variables
    env: {
      NODE_ENV: 'test',
      TEST_ENV: 'integration'
    }
  },
  
  // Resolve configuration
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '../../src'),
      '@tests': path.resolve(__dirname, '../'),
      '@integration': path.resolve(__dirname, './')
    }
  },
  
  // Define configuration
  define: {
    __TEST__: true,
    __INTEGRATION_TEST__: true
  },
  
  // Esbuild configuration for TypeScript
  esbuild: {
    target: 'node18'
  }
});