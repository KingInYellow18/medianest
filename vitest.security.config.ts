import { cpus } from 'os';
import { resolve } from 'path';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'security-tests',
    environment: 'node',
    globals: true,

    // Security test specific configuration
    testTimeout: 15000,
    hookTimeout: 5000,
    teardownTimeout: 3000,

    // Include security tests
    include: ['tests/security/**/*.test.ts', 'backend/tests/security/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/coverage/**'],

    // Setup files for security tests
    setupFiles: ['./tests/setup.ts'],

    // Environment variables for security tests
    env: {
      NODE_ENV: 'test',
      JWT_SECRET: 'test-jwt-secret-key-32-bytes-long-for-security-testing',
      JWT_ISSUER: 'medianest',
      JWT_AUDIENCE: 'medianest-users',
      ENCRYPTION_KEY: 'test-encryption-key-32-bytes-long-for-testing',
      DATABASE_URL: 'postgresql://test:test@localhost:5433/medianest_test',
      REDIS_URL: 'redis://localhost:6380',
      LOG_LEVEL: 'error',
    },

    // Thread configuration for security tests
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
        maxThreads: Math.min(8, cpus().length * 2),
        minThreads: 2,
        useAtomics: true,
        isolate: false,
      },
    },

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'coverage/**',
        'dist/**',
        '**/node_modules/**',
        '**/*.d.ts',
        'scripts/**',
        '**/*.config.{js,ts}',
        '**/*.setup.{js,ts}',
      ],
      thresholds: {
        global: {
          branches: 70,
          functions: 70,
          lines: 70,
          statements: 70,
        },
      },
    },

    // Reporter configuration
    reporter: ['basic', 'json'],
    outputFile: 'test-results/security-test-results.json',

    // Retry configuration for flaky security tests
    retry: 1,
    bail: 0,
  },

  // Resolve configuration
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

  // Define configuration for security test environment
  define: {
    'import.meta.env.NODE_ENV': JSON.stringify('test'),
    'import.meta.env.TEST_ENV': JSON.stringify('security'),
  },
});
