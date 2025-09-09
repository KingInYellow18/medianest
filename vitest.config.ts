import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    // Test environment configuration
    environment: 'node',
    globals: true,
    
    // Timeout configuration
    testTimeout: 30000,      // 30 seconds for regular tests
    hookTimeout: 30000,      // 30 seconds for hooks
    teardownTimeout: 30000,  // 30 seconds for teardown
    
    // Performance-optimized settings
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: false,
        maxForks: 4,
        minForks: 1
      }
    },
    
    // Exclude slow performance tests from main suite
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      // Performance tests (run separately)
      'tests/performance/**',
      'tests/e2e/e2e-performance.spec.ts',
      'tests/security/security-performance.test.ts',
      // Specific slow tests
      'backend/tests/performance/load-testing-enhanced.test.ts',
      'backend/tests/performance/load-testing.test.ts',
      'backend/tests/e2e/end-to-end-workflows.test.ts',
      'backend/tests/integration/comprehensive-api-integration.test.ts',
      'backend/tests/security/security-penetration.test.ts',
      'backend/tests/integration/database-transaction-tests.test.ts'
    ],
    
    // Test discovery patterns
    include: [
      '**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'
    ],
    
    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'coverage/**',
        'dist/**',
        '**/node_modules/**',
        '**/test-results/**',
        '**/*.d.ts',
        // Exclude performance test files from coverage
        'tests/performance/**',
        'tests/e2e/e2e-performance.spec.ts', 
        'tests/security/security-performance.test.ts',
        'scripts/**',
        '**/*.config.{js,ts}',
        '**/*.setup.{js,ts}'
      ],
      thresholds: {
        global: {
          branches: 65,
          functions: 65,
          lines: 65,
          statements: 65
        }
      }
    },
    
    // Reporter configuration
    reporter: process.env.CI ? ['github-actions', 'json'] : ['default'],
    outputFile: process.env.CI ? 'test-results/unit-test-results.json' : undefined,
    
    // Setup files
    setupFiles: [
      'backend/tests/setup/test-setup.ts'
    ],
    
    // File watching (disabled in CI)
    watch: !process.env.CI,
    
    // Memory and performance settings
    isolate: true,
    
    // Maximum number of threads
    maxConcurrency: 5,
    
    // Retry configuration
    retry: process.env.CI ? 2 : 0,
    
    // Bail after first test failure in CI
    bail: process.env.CI ? 1 : 0
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
  
  // Define configuration for different environments
  define: {
    'import.meta.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'test'),
    'import.meta.env.TEST_ENV': JSON.stringify(process.env.TEST_ENV || 'unit')
  }
});