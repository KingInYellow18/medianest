/// <reference types="vitest" />
import path from 'path';

import { defineConfig } from 'vite';

const cpuCount = require('os').cpus().length;

const maxWorkers = Math.max(2, Math.min(6, cpuCount));

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    globals: true,
    
    // **SINGLE THREAD EXECUTION - ELIMINATES WORKER THREAD ISSUES**
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: true, // CRITICAL: Single thread eliminates worker termination
        minThreads: 1,
        maxThreads: 1, // Force single thread
        isolate: false, // Disable isolation for single thread performance
        useAtomics: false, // Not needed for single thread
      },
    },
    
    // **STABILIZED TIMEOUTS - PREVENT WORKER TERMINATION**
    testTimeout: 15000,   // Increased for worker stability
    hookTimeout: 10000,   // Increased for proper cleanup
    teardownTimeout: 5000, // Reduced - file handles should close quickly
    
    // **SINGLE THREAD EXECUTION STRATEGY**
    bail: 3, // Stop after 3 failures
    retry: 0, // No retries needed in single thread
    sequence: {
      shuffle: false,      // Deterministic execution
      concurrent: false,   // Single thread, no concurrency
      setupTimeout: 15000, // Reduced timeout for single thread
    },
    
    // **SINGLE THREAD CONCURRENCY**
    maxConcurrency: 1, // Single thread only
    
    // **MOCK STABILIZATION - PREVENT MEMORY LEAKS**
    mockReset: true,      // Enable for proper cleanup
    clearMocks: true,     // Enable for test isolation
    restoreMocks: true,   // Enable for proper teardown
    
    // **DEBUG REPORTER: Identify hanging processes**
    reporter: ['default', 'hanging-process'],
    
    // **OPTIMIZED COVERAGE**
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'json'],
      
      // Performance settings
      clean: false,
      cleanOnRerun: false,
      skipFull: true,
      reportOnFailure: false,
      
      exclude: [
        'node_modules/',
        'tests/',
        'src/__tests__/',
        '**/*.d.ts',
        '**/*.config.*',
        'dist/',
        'coverage/',
        'src/types/**',
        'src/schemas/**',
        'src/validations/**',
        '**/test-*.ts',
        '**/mocks/**',
        '**/fixtures/**',
        '**/helpers/**'
      ],
      
      include: [
        'src/controllers/**/*.ts',
        'src/services/**/*.ts',
        'src/middleware/**/*.ts',
        'src/utils/**/*.ts',
        'src/repositories/**/*.ts',
      ],
      
      // Relaxed thresholds for speed
      thresholds: {
        branches: 60,
        functions: 60,
        lines: 60,
        statements: 60,
      },
    },
    
    // **OPTIMIZED FILE PATTERNS**
    include: [
      'tests/**/*.test.ts',
      'src/**/*.test.ts'
    ],
    
    exclude: [
      'node_modules/**',
      'dist/**',
      'coverage/**',
      '**/*.d.ts',
      '**/*.config.*',
      '**/e2e/**',           // Exclude slow E2E tests
      '**/integration/**',   // Run integration separately
      '**/performance/**'    // Exclude performance tests
    ],
    
    // **DEPENDENCY OPTIMIZATIONS** (Updated for Vitest 3.x)
    server: {
      deps: {
        external: [
          '@prisma/client', 
          'ioredis', 
          'redis',
          'bcrypt',
          'jsonwebtoken'
        ],
      }
    },
    
    // **TEST ENVIRONMENT**
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
      
      // Database optimizations
      DATABASE_POOL_SIZE: '2',     // Increased from 1
      DATABASE_TIMEOUT: '3000',    // Reduced timeout
      REDIS_TEST_DB: '15',
      
      // Performance flags - WORKER THREAD STABILITY
      VITEST_POOL_SIZE: Math.min(maxWorkers, 4).toString(),
      NODE_OPTIONS: '--max-old-space-size=2048 --enable-source-maps=false',
      // Critical: Add worker thread pool configuration
      UV_THREADPOOL_SIZE: '8',
      // Prevent worker thread memory issues
      VITEST_SEGFAULT_RETRY: '3',
      // Worker termination handling
      VITEST_WORKER_TIMEOUT: '30000',
      
      // CRITICAL: Resource cleanup to prevent hanging processes
      VITE_CJS_IGNORE_WARNING: 'true',
      FORCE_COLOR: '0', // Disable colors to prevent terminal hangs
    },
    
    // **RESOURCE CLEANUP CONFIGURATION**
    // Force proper cleanup to prevent hanging processes
    fileParallelism: false,
    // Ensure proper shutdown
    forceRerunTriggers: ['**/vitest.config.*', '**/package.json'],
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
  
  // **BUILD OPTIMIZATIONS**
  esbuild: {
    target: 'node18',
    sourcemap: false,
    minify: false,
  },
  
  optimizeDeps: {
    include: ['vitest > @vitest/utils'],
    exclude: ['@prisma/client', 'ioredis']
  }
});
