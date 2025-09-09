import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    // Performance Optimizations
    pool: 'threads',
    poolOptions: {
      threads: {
        minThreads: 2,
        maxThreads: 8,
        useAtomics: true
      }
    },
    
    // Memory Management
    isolate: false, // Faster but less isolated
    environment: 'node',
    
    // Timeout Optimizations
    testTimeout: 5000,
    hookTimeout: 10000,
    teardownTimeout: 5000,
    
    // Setup Optimizations
    setupFiles: [
      './tests/setup-enhanced.ts',
      './tests/setup-performance.ts'
    ],
    
    // Coverage Optimizations
    coverage: {
      provider: 'v8', // Faster than c8
      reporter: ['text-summary', 'json'],
      reportsDirectory: './coverage',
      clean: true,
      cleanOnRerun: true,
      
      // Optimized thresholds
      thresholds: {
        global: {
          branches: 60,
          functions: 60,
          lines: 65,
          statements: 65
        }
      },
      
      // Exclude patterns for faster coverage
      exclude: [
        'coverage/**',
        'dist/**',
        'node_modules/**',
        '**/*.d.ts',
        '**/*.config.*',
        '**/fixtures/**',
        '**/mocks/**'
      ]
    },
    
    // File watching optimizations
    watchExclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      '**/.git/**'
    ],
    
    // Reporter optimizations
    reporter: process.env.CI ? ['basic'] : ['default'],
    
    // Global setup for infrastructure
    globalSetup: './tests/global-setup-optimized.ts',
    
    // Selective test inclusion
    include: [
      'tests/**/*.{test,spec}.{ts,js}',
      'src/**/*.{test,spec}.{ts,js}'
    ],
    
    // Optimized exclusions
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/*.d.ts',
      '**/e2e/**', // Run separately
      '**/performance/**' // Run separately
    ]
  },
  
  // Build optimizations for testing
  esbuild: {
    target: 'node18',
    sourcemap: false, // Faster builds
    minify: false
  },
  
  // Resolve optimizations
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@tests': path.resolve(__dirname, './tests'),
      '@shared': path.resolve(__dirname, './shared/src')
    }
  }
});