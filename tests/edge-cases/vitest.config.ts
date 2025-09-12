import path from 'path';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'edge-case-testing',
    root: path.resolve(__dirname, '../..'),
    testTimeout: 300000, // 5 minutes for comprehensive tests
    hookTimeout: 30000,  // 30 seconds for setup/teardown
    threads: false, // Run tests sequentially for better resource control
    maxConcurrency: 1,
    isolate: false, // Share context between tests for performance
    
    // Test file patterns
    include: [
      'tests/edge-cases/**/*.ts',
      'tests/edge-cases/**/*.test.ts'
    ],
    
    // Environment setup
    env: {
      NODE_ENV: 'test',
      LOG_LEVEL: 'warn',
      // Use separate test database
      DATABASE_URL: process.env.TEST_DATABASE_URL || 
        'postgresql://medianest:test_password@localhost:5432/medianest_test',
      REDIS_HOST: 'localhost',
      REDIS_PORT: '6379',
      REDIS_DB: '1', // Separate Redis DB for tests
      JWT_SECRET: 'test-jwt-secret-for-edge-case-testing',
      ENCRYPTION_KEY: 'test-encryption-key-32-characters!!'
    },
    
    // Global setup and teardown
    globalSetup: ['./tests/edge-cases/global-setup.ts'],
    setupFiles: ['./tests/edge-cases/test-setup.ts'],
    
    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './coverage/edge-cases',
      include: [
        'backend/src/**/*.ts',
        'shared/src/**/*.ts'
      ],
      exclude: [
        'backend/src/**/*.test.ts',
        'backend/src/**/*.spec.ts',
        'tests/**/*'
      ],
      thresholds: {
        global: {
          branches: 70,
          functions: 70,
          lines: 70,
          statements: 70
        }
      }
    },
    
    // Reporters
    reporters: [
      'verbose',
      'json',
      ['html', { outputFile: './test-results/edge-cases/index.html' }]
    ],
    
    // Output configuration
    outputFile: {
      json: './test-results/edge-cases/results.json',
      junit: './test-results/edge-cases/junit.xml'
    }
  },
  
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '../../backend/src'),
      '@shared': path.resolve(__dirname, '../../shared/src'),
      '@tests': path.resolve(__dirname, '..')
    }
  }
});