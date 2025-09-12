import { cpus } from 'os';
import { resolve } from 'path';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'backend-security-tests',
    environment: 'node',
    globals: true,

    // Security test specific configuration
    testTimeout: 15000,
    hookTimeout: 5000,
    teardownTimeout: 3000,

    // Include backend security tests
    include: ['tests/security/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/coverage/**'],

    // Setup files for security tests
    setupFiles: ['./tests/security/setup.ts'],

    // Thread configuration for security tests
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
        maxThreads: Math.min(4, cpus().length),
        minThreads: 1,
        useAtomics: true,
        isolate: false,
      },
    },

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json'],
      exclude: [
        'coverage/**',
        'dist/**',
        '**/node_modules/**',
        '**/*.d.ts',
        'scripts/**',
        '**/*.config.{js,ts}',
        '**/*.setup.{js,ts}',
      ],
    },

    // Reporter configuration
    reporter: ['default'],

    // Retry configuration for security tests
    retry: 0,
    bail: 0,
  },

  // Resolve configuration
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@/config': resolve(__dirname, './src/config'),
      '@/controllers': resolve(__dirname, './src/controllers'),
      '@/middleware': resolve(__dirname, './src/middleware'),
      '@/repositories': resolve(__dirname, './src/repositories'),
      '@/services': resolve(__dirname, './src/services'),
      '@/utils': resolve(__dirname, './src/utils'),
      '@/types': resolve(__dirname, './src/types'),
      '@/routes': resolve(__dirname, './src/routes'),
      '@medianest/shared': resolve(__dirname, '../shared/src'),
    },
  },
});
