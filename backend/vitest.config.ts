import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: [
      './tests/setup.ts', 
      './src/__tests__/setup.ts'
    ],
    globals: true,
    isolate: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'text-summary'],
      exclude: [
        'node_modules/',
        'tests/',
        'src/__tests__/',
        '**/*.d.ts',
        '**/*.config.*',
        'dist/',
        'src/types/**',
        'src/schemas/**',
        'src/validations/**',
        '**/test-*.ts',
      ],
      include: [
        'src/controllers/**/*.ts',
        'src/services/**/*.ts',
        'src/middleware/**/*.ts',
        'src/utils/**/*.ts',
        'src/repositories/**/*.ts',
      ],
      thresholds: {
        branches: 70,
        functions: 70,
        lines: 70,
        statements: 70,
      },
    },
    testTimeout: 30000,
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    deps: {
      external: ['@prisma/client'],
    },
    env: {
      NODE_ENV: 'test',
      JWT_SECRET: 'test-jwt-secret-key-32-bytes-long',
      JWT_ISSUER: 'medianest-test',
      JWT_AUDIENCE: 'medianest-test-users',
      ENCRYPTION_KEY: 'test-encryption-key-32-bytes-long',
      DATABASE_URL: 'postgresql://test:test@localhost:5433/medianest_test',
      REDIS_URL: 'redis://localhost:6380/0',
      PLEX_CLIENT_ID: 'test-plex-client-id',
      PLEX_CLIENT_SECRET: 'test-plex-client-secret',
      FRONTEND_URL: 'http://localhost:3000',
      LOG_LEVEL: 'silent',
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@/config': path.resolve(__dirname, './src/config'),
      '@/controllers': path.resolve(__dirname, './src/controllers'),
      '@/middleware': path.resolve(__dirname, './src/middleware'),
      '@/repositories': path.resolve(__dirname, './src/repositories'),
      '@/services': path.resolve(__dirname, './src/services'),
      '@/utils': path.resolve(__dirname, './src/utils'),
      '@/types': path.resolve(__dirname, './src/types'),
      '@/routes': path.resolve(__dirname, './src/routes'),
    },
  },
});
