/// <reference types="vitest" />
import path from 'path';

import { defineConfig } from 'vite';

const cpuCount = require('os').cpus().length;

const maxWorkers = Math.max(2, Math.min(4, cpuCount));

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    
    // **OPTIMIZED PARALLEL EXECUTION**
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
        minThreads: 1,
        maxThreads: maxWorkers,
        isolate: false,
        useAtomics: true,
      },
    },
    
    // **PERFORMANCE TIMEOUTS**
    testTimeout: 5000,    // Shared utilities should be fast
    hookTimeout: 1000,
    teardownTimeout: 1000,
    
    // **EXECUTION STRATEGY**
    bail: 0,
    retry: 0,
    sequence: {
      shuffle: false,
      concurrent: true,
    },
    
    // **OPTIMIZED FILE PATTERNS**
    include: [
      'src/**/*.{test,spec}.{js,ts}'
    ],
    
    exclude: [
      'node_modules/**',
      'dist/**',
      'coverage/**',
      '**/*.d.ts',
      '**/*.config.*',
      '**/mocks/**',
      '**/fixtures/**'
    ],
    
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
        'dist/',
        'coverage/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/test-utils/**',
        '**/mocks/**',
        '**/fixtures/**',
        'src/types/**',
        'src/schemas/**'
      ],
      
      include: [
        'src/utils/**/*.ts',
        'src/services/**/*.ts',
        'src/lib/**/*.ts'
      ],
      
      thresholds: {
        branches: 50,
        functions: 50,
        lines: 50,
        statements: 50,
      },
    },
    
    // **ENVIRONMENT OPTIMIZATIONS**
    env: {
      NODE_ENV: 'test',
      VITEST_POOL_SIZE: maxWorkers.toString(),
      NODE_OPTIONS: '--max-old-space-size=1024'
    },
  },
  
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@/types': path.resolve(__dirname, './src/types'),
      '@/utils': path.resolve(__dirname, './src/utils'),
      '@/services': path.resolve(__dirname, './src/services')
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
    exclude: []
  }
});
