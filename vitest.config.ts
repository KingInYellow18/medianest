/// <reference types="vitest" />
import { defineConfig } from 'vite'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./tests/setup-enhanced.ts'],
    globals: true,
    
    // **PERFORMANCE OPTIMIZED CONFIGURATION**
    // Maximize parallel execution
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
        minThreads: 2,
        maxThreads: 6,
        isolate: false,
      },
      forks: {
        singleFork: false,
        isolate: false,
      },
    },
    
    // Optimized timeouts for faster execution
    testTimeout: 10000,
    hookTimeout: 3000,
    teardownTimeout: 3000,
    
    // Performance settings
    bail: 0,
    retry: 0,
    sequence: {
      shuffle: true,
      concurrent: true,
    },
    
    // File watching optimizations
    watch: false,
    passWithNoTests: true,
    
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      
      // Enhanced coverage collection for CI/CD
      clean: true,
      cleanOnRerun: false,
      skipFull: true,
      reportOnFailure: true,
      
      // Optimized exclude patterns
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
        'backend/tests/**',
        'frontend/tests/**',
        'shared/tests/**',
        '**/*.test.*',
        '**/*.spec.*'
      ],
      
      // Comprehensive source file inclusion
      include: [
        'src/**/*.ts',
        'src/**/*.js',
        'backend/src/**/*.ts',
        'backend/src/**/*.js',
        'frontend/src/**/*.ts', 
        'frontend/src/**/*.tsx',
        'frontend/src/**/*.js',
        'frontend/src/**/*.jsx',
        'shared/src/**/*.ts',
        'shared/src/**/*.js'
      ],
      
      // CI/CD Quality gate thresholds (65% minimum)
      thresholds: {
        branches: 65,
        functions: 65,
        lines: 65,
        statements: 65,
        'src/**/*.ts': {
          branches: 70,
          functions: 70,
          lines: 70,
          statements: 70,
        },
        'backend/src/**/*.ts': {
          branches: 70,
          functions: 75,
          lines: 75,
          statements: 75,
        },
        'frontend/src/**/*.{ts,tsx}': {
          branches: 60,
          functions: 60,
          lines: 60,
          statements: 60,
        },
      },
      
      // Parallel coverage processing
      processingConcurrency: 4,
    },
    
    // Test file patterns
    include: [
      'tests/**/*.{test,spec}.{js,ts}',
      'backend/tests/**/*.{test,spec}.{js,ts}',
      'frontend/src/**/*.{test,spec}.{js,ts,jsx,tsx}',
      'shared/src/**/*.{test,spec}.{js,ts}'
    ],
    
    exclude: [
      'node_modules/**',
      'dist/**',
      'coverage/**',
      '**/*.config.*',
      '**/e2e/**',
      '**/integration/**'
    ],
  },
  
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@/config': path.resolve(__dirname, './src/config'),
      '@/constants': path.resolve(__dirname, './src/constants'),
      '@/errors': path.resolve(__dirname, './src/errors'),
      '@/middleware': path.resolve(__dirname, './src/middleware'),
      '@/test-utils': path.resolve(__dirname, './src/test-utils'),
      '@/types': path.resolve(__dirname, './src/types'),
      '@/utils': path.resolve(__dirname, './src/utils'),
      '@/validation': path.resolve(__dirname, './src/validation'),
      '@/backend': path.resolve(__dirname, './backend/src'),
      '@/frontend': path.resolve(__dirname, './frontend/src'),
      '@/shared': path.resolve(__dirname, './shared/src')
    },
  },
  
  // Build optimizations for test runs
  esbuild: {
    target: 'node18',
    sourcemap: false,
    minify: false,
  },
  
  // Dependency optimization
  optimizeDeps: {
    include: ['vitest > @vitest/utils > pretty-format'],
    exclude: ['@prisma/client']
  }
})