import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    // Performance test environment
    environment: 'node',
    globals: true,
    
    // Extended timeouts for performance tests
    testTimeout: 300000,     // 5 minutes for performance tests
    hookTimeout: 60000,      // 1 minute for setup/teardown
    teardownTimeout: 60000,
    
    // Performance test specific settings
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,      // Single fork for performance consistency
        maxForks: 1,
        minForks: 1
      }
    },
    
    // Include only performance tests
    include: [
      'tests/performance/**/*.test.ts',
      'tests/e2e/e2e-performance.spec.ts',
      'tests/security/security-performance.test.ts'
    ],
    
    // Exclude everything else
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**'
    ],
    
    // Disable coverage for performance tests (performance focus)
    coverage: {
      enabled: false
    },
    
    // Performance test specific reporters
    reporter: process.env.CI ? 
      ['json', 'github-actions'] : 
      ['verbose'],
    
    outputFile: 'test-results/performance-test-results.json',
    
    // Setup files for performance tests
    setupFiles: [
      'backend/tests/setup/performance-test-setup.ts'
    ],
    
    // No watching for performance tests
    watch: false,
    
    // Single isolation for consistent performance measurement
    isolate: false,
    
    // No concurrency for performance tests
    maxConcurrency: 1,
    
    // No retries for performance tests (they should be stable)
    retry: 0,
    
    // Don't bail - run all performance tests
    bail: 0,
    
    // Memory settings for performance tests
    pool: 'forks',
    
    // Enable garbage collection in performance tests
    env: {
      NODE_OPTIONS: '--expose-gc --max-old-space-size=8192'
    }
  },
  
  // Resolve configuration
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@backend': resolve(__dirname, './backend/src'),
      '@frontend': resolve(__dirname, './frontend/src'),
      '@shared': resolve(__dirname, './shared/src'),
      '@tests': resolve(__dirname, './tests')
    }
  },
  
  // Performance test specific defines
  define: {
    'import.meta.env.NODE_ENV': JSON.stringify('test'),
    'import.meta.env.TEST_ENV': JSON.stringify('performance'),
    'import.meta.env.PERFORMANCE_MODE': JSON.stringify(true)
  }
});