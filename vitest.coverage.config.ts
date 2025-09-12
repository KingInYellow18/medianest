import { cpus } from 'os';
import { resolve } from 'path';

import { defineConfig } from 'vitest/config';

/**
 * COVERAGE-OPTIMIZED CONFIGURATION
 *
 * Purpose: Dedicated configuration for comprehensive coverage measurement
 * Strategy: Maximum accuracy with reasonable performance
 * Target: 80%+ coverage validation across all modules
 */

export default defineConfig({
  test: {
    // Coverage-optimized projects configuration
    projects: [
      {
        name: 'backend-coverage',
        root: './backend',
        test: {
          environment: 'node',
          globals: true,
          setupFiles: ['../tests/setup.ts'],
          include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
          exclude: [
            'node_modules/**',
            'dist/**',
            'coverage/**',
            '**/*.d.ts',
            // Include all tests for coverage measurement
            // '**/e2e/**',
            // '**/integration/**',
            // '**/performance/**'
          ],
        },
        resolve: {
          alias: {
            '@': resolve(__dirname, './backend/src'),
            '@/config': resolve(__dirname, './backend/src/config'),
            '@/controllers': resolve(__dirname, './backend/src/controllers'),
            '@/middleware': resolve(__dirname, './backend/src/middleware'),
            '@/repositories': resolve(__dirname, './backend/src/repositories'),
            '@/services': resolve(__dirname, './backend/src/services'),
            '@/utils': resolve(__dirname, './backend/src/utils'),
            '@/types': resolve(__dirname, './backend/src/types'),
            '@/routes': resolve(__dirname, './backend/src/routes'),
            '@medianest/shared': resolve(__dirname, './shared/src'),
          },
        },
      },
      {
        name: 'frontend-coverage',
        root: './frontend',
        test: {
          environment: 'jsdom',
          globals: true,
          setupFiles: ['./tests/setup.ts'],
          include: ['**/*.{test,spec}.{ts,tsx}'],
          exclude: ['**/node_modules/**', '**/dist/**', '**/.next/**'],
        },
        resolve: {
          alias: {
            '@': resolve(__dirname, './frontend/src'),
            '@/components': resolve(__dirname, './frontend/src/components'),
            '@/utils': resolve(__dirname, './frontend/src/utils'),
            '@/hooks': resolve(__dirname, './frontend/src/hooks'),
            '@/types': resolve(__dirname, './frontend/src/types'),
            '@medianest/shared': resolve(__dirname, './shared/src'),
          },
        },
      },
      {
        name: 'shared-coverage',
        root: './shared',
        test: {
          environment: 'node',
          globals: true,
          include: ['**/*.{test,spec}.{ts,js}'],
          exclude: ['**/node_modules/**', '**/dist/**'],
        },
        resolve: {
          alias: {
            '@': resolve(__dirname, './shared/src'),
            '@medianest/shared': resolve(__dirname, './shared/src'),
          },
        },
      },
    ],

    // Coverage-optimized timeouts (longer for comprehensive measurement)
    testTimeout: 15000, // 15s for complex coverage analysis
    hookTimeout: 8000, // 8s for setup/teardown
    teardownTimeout: 5000, // 5s cleanup

    // Balanced performance for coverage
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
        maxThreads: Math.max(4, Math.floor(cpus().length * 0.75)), // 75% CPU usage
        minThreads: 2,
        useAtomics: true,
        isolate: true, // Enable isolation for accurate coverage
      },
    },

    // Coverage-specific concurrency (reduced for accuracy)
    maxConcurrency: Math.max(8, cpus().length * 2),

    // COMPREHENSIVE COVERAGE CONFIGURATION
    coverage: {
      provider: 'v8',
      enabled: true,
      reporter: ['text', 'text-summary', 'html', 'json', 'lcov', 'clover'],
      reportsDirectory: './coverage',

      // Include all source files for accurate measurement
      include: [
        'backend/src/**/*.{ts,js}',
        'frontend/src/**/*.{ts,tsx,js,jsx}',
        'shared/src/**/*.{ts,js}',
      ],

      // Exclude non-source files
      exclude: [
        'coverage/**',
        'dist/**',
        '**/node_modules/**',
        '**/test-results/**',
        '**/*.d.ts',
        '**/*.config.{js,ts}',
        '**/*.setup.{js,ts}',
        'scripts/**',
        'docs/**',
        '**/tests/**',
        '**/__tests__/**',
        '**/*.test.{ts,tsx,js,jsx}',
        '**/*.spec.{ts,tsx,js,jsx}',
      ],

      // COMPREHENSIVE THRESHOLDS
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80,
        },
        // Module-specific thresholds
        'backend/src/**': {
          branches: 85,
          functions: 85,
          lines: 85,
          statements: 85,
        },
        'frontend/src/**': {
          branches: 75,
          functions: 75,
          lines: 75,
          statements: 75,
        },
        'shared/src/**': {
          branches: 90,
          functions: 90,
          lines: 90,
          statements: 90,
        },
      },

      // Coverage reporting options
      watermarks: {
        statements: [70, 85],
        functions: [70, 85],
        branches: [70, 85],
        lines: [70, 85],
      },
    },

    // Comprehensive reporting
    reporter: ['verbose', 'json', 'html'],
    outputFile: {
      json: './coverage-reports/coverage-results.json',
      html: './coverage-reports/coverage-report.html',
    },

    // Setup files for coverage measurement
    setupFiles: ['./tests/setup/coverage-setup.ts'],

    // File watching disabled for coverage runs
    watch: false,

    // Retry configuration for reliable coverage
    retry: 1,
    bail: 0, // Don't bail - measure all coverage

    // Environment optimization
    env: {
      NODE_ENV: 'test',
      COVERAGE_MODE: 'true',
      LOG_LEVEL: 'error', // Reduce noise during coverage
    },
  },

  // Global resolve configuration
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@backend': resolve(__dirname, './backend/src'),
      '@frontend': resolve(__dirname, './frontend/src'),
      '@shared': resolve(__dirname, './shared/src'),
      '@tests': resolve(__dirname, './tests'),
      '@medianest/shared': resolve(__dirname, './shared/src'),
    },
  },

  // Define configuration
  define: {
    'import.meta.env.NODE_ENV': JSON.stringify('test'),
    'import.meta.env.COVERAGE_MODE': JSON.stringify('true'),
  },
});
