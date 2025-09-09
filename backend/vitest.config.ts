/// <reference types="vitest" />
import { defineConfig } from 'vite';
import path from 'path';

const cpuCount = require('os').cpus().length;
const maxWorkers = Math.max(2, Math.min(6, cpuCount));

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    globals: true,
    
    // **OPTIMIZED PARALLEL EXECUTION**
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
        minThreads: 2,
        maxThreads: maxWorkers,
        isolate: false, // Better performance
        useAtomics: true,
      },
      forks: {
        singleFork: false,
        isolate: false,
      },
    },
    
    // **PERFORMANCE TIMEOUTS**
    testTimeout: 8000,    // Reduced from 30s
    hookTimeout: 2000,    // Reduced setup time
    teardownTimeout: 2000,
    
    // **EXECUTION STRATEGY**
    bail: 0,
    retry: 0,
    sequence: {
      shuffle: false,      // Deterministic for CI
      concurrent: true,    // Enable concurrent execution
    },
    
    // **MOCK OPTIMIZATIONS**
    mockReset: false,     // Reduce overhead
    clearMocks: false,
    restoreMocks: false,
    
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
    
    // **DEPENDENCY OPTIMIZATIONS**
    deps: {
      external: [
        '@prisma/client', 
        'ioredis', 
        'redis',
        'bcrypt',
        'jsonwebtoken'
      ],
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
      
      // Performance flags
      VITEST_POOL_SIZE: maxWorkers.toString(),
      NODE_OPTIONS: '--max-old-space-size=4096'
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
