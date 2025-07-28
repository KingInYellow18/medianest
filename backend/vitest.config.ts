import { defineConfig } from 'vitest/config';
import path from 'path';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  esbuild: {
    target: 'node18',
  },
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/helpers/test-setup.ts'],
    testTimeout: 15000, // Reduced timeout
    hookTimeout: 5000,
    teardownTimeout: 3000,

    // Test file patterns
    include: ['tests/**/*.test.ts', 'tests/**/*.spec.ts'],
    exclude: ['node_modules/**', 'dist/**', 'coverage/**'],

    // Simplified sequencing to prevent hanging
    sequence: {
      concurrent: false,
      shuffle: false,
      hooks: 'stack',
    },

    // Vitest 3.0 - Smart caching for faster test runs (using Vite's cacheDir)

    // Coverage configuration with Vitest 3.0 enhancements
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
        '**/migrations/',
        'prisma/seed.ts',
      ],
      // Simplified coverage to prevent hanging
      all: false, // Disable to prevent hanging
      skipFull: true,
      thresholds: {
        global: {
          branches: 85,
          functions: 85,
          lines: 85,
          statements: 85,
        },
        // Security-critical services - 100% required
        './src/services/encryption.service.ts': {
          branches: 100,
          functions: 100,
          lines: 100,
          statements: 100,
        },
        './src/services/jwt.service.ts': {
          branches: 100,
          functions: 100,
          lines: 100,
          statements: 100,
        },
        './src/services/cache.service.ts': {
          branches: 100,
          functions: 100,
          lines: 100,
          statements: 100,
        },
        // Business-critical services - 95% required
        './src/services/': {
          branches: 95,
          functions: 95,
          lines: 95,
          statements: 95,
        },
        // Repository layer - 90% required
        './src/repositories/': {
          branches: 90,
          functions: 90,
          lines: 90,
          statements: 90,
        },
        // Middleware (security-critical) - 95% required
        './src/middleware/': {
          branches: 95,
          functions: 95,
          lines: 95,
          statements: 95,
        },
        // Controllers - 85% required
        './src/controllers/': {
          branches: 85,
          functions: 85,
          lines: 85,
          statements: 85,
        },
        // Integration clients - 80% required
        './src/integrations/': {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80,
        },
      },
    },

    // Pool configuration optimized for backend API testing
    pool: 'forks', // Changed from threads to fix hanging tests

    // Use single thread for more reliable test execution
    poolOptions: {
      forks: {
        singleFork: true, // Run tests in a single fork to prevent hanging
      },
    },

    // Vitest 3.0 - Improved retry mechanism for flaky backend tests
    retry: {
      count: 2, // Reduced for faster feedback
      delay: 100, // milliseconds between retries
    },
    bail: 3, // Stop after 3 failures for faster feedback

    // Simplified reporter to prevent hanging
    reporter: ['default'],
    outputFile: {
      json: './test-results/results.json',
      junit: './test-results/junit.xml',
    },

    // Force test completion
    passWithNoTests: true,
    allowOnly: false,

    // Load environment variables from .env.test
    envDir: '../',
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://test:test@localhost:5432/medianest_test',
      REDIS_URL: 'redis://localhost:6379/15',
      JWT_SECRET: 'test-jwt-secret-key-for-testing-only-32-chars-long',
      ENCRYPTION_KEY: '***REMOVED***-12345678',
      PLEX_CLIENT_ID: 'MediaNest-Test',
      PLEX_CLIENT_SECRET: 'test-secret',
      LOG_LEVEL: 'error',
    },

    // Vitest 3.0 - Enhanced typecheck configuration
    typecheck: {
      enabled: true,
      only: false,
      checker: 'tsc',
      include: ['src/**/*.ts'],
      exclude: ['**/*.test.ts', '**/*.spec.ts'],
    },

    // Memory optimization for backend tests
    logHeapUsage: false, // Disable to reduce overhead

    // Test isolation improvements
    isolate: false, // Disable to prevent hanging

    // Vitest 3.0 - Enhanced watch mode
    watchExclude: ['node_modules/**', 'dist/**', 'coverage/**', '.vitest/**'],
  },

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@tests': path.resolve(__dirname, './tests'),
      '@/lib': path.resolve(__dirname, './src/lib'),
      '@/db': path.resolve(__dirname, './src/db'),
      '@medianest/shared': path.resolve(__dirname, '../shared/dist'),
    },
  },

  // Different test configurations for different environments
  define: {
    __TEST__: true,
  },
});
