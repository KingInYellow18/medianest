import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    testTimeout: 30000,
    hookTimeout: 10000,
    teardownTimeout: 5000,

    // Test file patterns - include security tests
    include: [
      'src/**/*.test.{ts,tsx}',
      'src/**/*.spec.{ts,tsx}',
      'src/**/*.security.test.{ts,tsx}',
      'tests/**/*.test.{ts,tsx}',
    ],
    exclude: ['node_modules/**', 'dist/**', 'coverage/**'],

    // Enhanced performance configuration for frontend testing
    poolOptions: {
      threads: {
        singleThread: false,
        maxThreads: 4,
        minThreads: 2,
        useAtomics: true,
        isolate: true,
      },
    },

    // Coverage configuration with security test requirements
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      exclude: [
        'node_modules/',
        'tests/',
        'dist/',
        '**/*.d.ts',
        '**/*.config.ts',
        '**/stories/**',
        'storybook-static/',
      ],
      // Enhanced coverage thresholds for security-critical components
      all: true,
      skipFull: false,
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80,
        },
        // Security-critical components - 95% required
        './src/components/ErrorBoundary.tsx': {
          branches: 95,
          functions: 95,
          lines: 95,
          statements: 95,
        },
        './src/components/ServiceErrorBoundary.tsx': {
          branches: 95,
          functions: 95,
          lines: 95,
          statements: 95,
        },
        './src/app/auth/signin/page.tsx': {
          branches: 90,
          functions: 90,
          lines: 90,
          statements: 90,
        },
        // Security hooks - 90% required
        './src/hooks/useMediaRequest.ts': {
          branches: 90,
          functions: 90,
          lines: 90,
          statements: 90,
        },
        './src/hooks/useWebSocket.ts': {
          branches: 90,
          functions: 90,
          lines: 90,
          statements: 90,
        },
        './src/hooks/useServiceStatus.ts': {
          branches: 90,
          functions: 90,
          lines: 90,
          statements: 90,
        },
        // All hooks directory - 85% required
        './src/hooks/': {
          branches: 85,
          functions: 85,
          lines: 85,
          statements: 85,
        },
        // Authentication components - 85% required
        './src/app/auth/': {
          branches: 85,
          functions: 85,
          lines: 85,
          statements: 85,
        },
      },
    },

    // Enhanced test sequencing
    sequence: {
      concurrent: true,
      shuffle: false,
      hooks: 'parallel',
      setupFiles: 'parallel',
    },

    pool: 'threads',

    // Retry mechanism for potentially flaky frontend tests
    retry: {
      count: 2,
      delay: 100,
    },
    bail: 3,

    // Enhanced reporter with security test focus
    reporter: ['default', 'json', 'junit'],
    outputFile: {
      json: './test-results/results.json',
      junit: './test-results/junit.xml',
    },

    // Environment variables for testing
    env: {
      NODE_ENV: 'test',
      NEXT_PUBLIC_API_URL: 'http://localhost:3001',
      NEXTAUTH_URL: 'http://localhost:3000',
      NEXTAUTH_SECRET: 'test-secret-for-testing-only',
    },

    // TypeScript configuration
    typecheck: {
      enabled: true,
      only: false,
      checker: 'tsc',
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      exclude: ['**/*.test.ts', '**/*.test.tsx', '**/*.security.test.ts'],
    },

    // Memory optimization
    logHeapUsage: true,
    isolate: true,

    // Watch mode optimization
    watchExclude: ['node_modules/**', 'dist/**', 'coverage/**', '.next/**'],
  },

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@/components': path.resolve(__dirname, './src/components'),
      '@/hooks': path.resolve(__dirname, './src/hooks'),
      '@/lib': path.resolve(__dirname, './src/lib'),
      '@/types': path.resolve(__dirname, './src/types'),
      '@/config': path.resolve(__dirname, './src/config'),
      '@medianest/shared': path.resolve(__dirname, '../shared/dist'),
    },
  },

  define: {
    __TEST__: true,
  },
});
