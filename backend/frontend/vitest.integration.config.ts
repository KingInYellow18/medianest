/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-utils/integration-setup.ts'],
    globals: true,
    
    // Test execution configuration optimized for integration tests
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
        minThreads: 1,
        maxThreads: 2, // Reduced for integration tests to avoid resource conflicts
        isolate: true,
        useAtomics: true,
      },
    },
    
    // Extended timeouts for integration tests
    testTimeout: 10000, // 10 seconds for integration scenarios
    hookTimeout: 10000, // 10 seconds for setup/teardown
    teardownTimeout: 5000,
    
    // Integration test patterns - simplified for debugging
    include: [
      'src/__tests__/integration/**/*.{ts,tsx}',
      'src/**/*.integration.test.{ts,tsx}',
    ],
    
    exclude: [
      'node_modules/**',
      'dist/**',
      'build/**',
      'coverage/**',
      '**/*.d.ts',
      '**/*.config.*',
      '**/e2e/**',
      // Note: Removed exclusion that might catch integration tests
    ],
    
    // Mock configuration for integration tests
    mockReset: true,
    clearMocks: true,
    restoreMocks: true,
    
    // Coverage configuration for integration tests
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './coverage/integration',
      exclude: [
        'node_modules/',
        'src/test-utils/**',
        'src/**/*.d.ts',
        'src/**/*.config.*',
        'src/**/__tests__/**',
        'src/**/test-*.{ts,tsx}',
        'src/**/mock*.{ts,tsx}',
        'src/**/*.integration.test.{ts,tsx}',
      ],
      include: [
        'src/components/**/*.{ts,tsx}',
        'src/hooks/**/*.{ts,tsx}',
        'src/contexts/**/*.{ts,tsx}',
        'src/utils/**/*.{ts,tsx}',
        'src/services/**/*.{ts,tsx}',
      ],
      thresholds: {
        branches: 70, // Slightly lower for integration tests
        functions: 75,
        lines: 80,
        statements: 80,
      },
    },
    
    // Environment variables for integration tests
    env: {
      NODE_ENV: 'test',
      VITE_APP_ENV: 'integration-test',
      VITE_API_URL: 'http://localhost:3000/api',
      VITE_WS_URL: 'ws://localhost:3000/ws',
      VITEST_INTEGRATION_MODE: 'true',
    },
    
    // Performance optimizations
    sequence: {
      shuffle: false, // Keep deterministic for integration tests
      concurrent: false, // Run integration tests sequentially to avoid conflicts
      setupTimeout: 15000,
    },
    
    maxConcurrency: 1, // Single concurrent test for integration
    
    // Reporter configuration
    reporter: ['verbose', 'json', 'html'],
    outputFile: {
      json: './test-results/integration-results.json',
      html: './test-results/integration-report.html',
    },
    
    // File watching configuration - disabled for CI
    watch: false,
    
    // Dependency configuration
    deps: {
      optimizer: {
        web: {
          include: [
            '@testing-library/react',
            '@testing-library/jest-dom',
            '@testing-library/user-event',
            'msw',
          ],
        },
      },
    },
    
    // Retry configuration for flaky integration tests
    retry: 2,
    bail: 5, // Stop after 5 failures
  },
  
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@/components': path.resolve(__dirname, './src/components'),
      '@/hooks': path.resolve(__dirname, './src/hooks'),
      '@/contexts': path.resolve(__dirname, './src/contexts'),
      '@/utils': path.resolve(__dirname, './src/utils'),
      '@/services': path.resolve(__dirname, './src/services'),
      '@/types': path.resolve(__dirname, './src/types'),
      '@/test-utils': path.resolve(__dirname, './src/test-utils'),
    },
  },
  
  // Build optimizations for integration testing
  esbuild: {
    target: 'es2020',
    sourcemap: true,
    minify: false,
  },
  
  // Dependency optimization
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      '@testing-library/react',
      '@testing-library/jest-dom',
      '@testing-library/user-event',
      'msw',
      'msw/node',
    ],
  },
  
});