import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    testTimeout: 10000,
    hookTimeout: 10000,
    teardownTimeout: 10000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/**',
        'dist/**',
        'tests/**',
        'scripts/**',
        '**/*.d.ts',
        '**/*.config.*',
      ],
    },
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://test:test@localhost:5433/medianest_test',
      REDIS_URL: 'redis://localhost:6380',
      JWT_SECRET: 'test-jwt-secret-key-for-testing-only',
      SESSION_SECRET: 'test-session-secret-for-testing-only',
      LOG_LEVEL: 'warn',
      RATE_LIMIT_WINDOW_MS: '900000',
      RATE_LIMIT_MAX: '100',
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@tests': resolve(__dirname, 'tests'),
    },
  },
});