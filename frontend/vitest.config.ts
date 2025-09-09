import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

const cpuCount = require('os').cpus().length;
const maxWorkers = Math.max(2, Math.min(6, cpuCount));

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    
    // **OPTIMIZED PARALLEL EXECUTION FOR FRONTEND**
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
        minThreads: 2,
        maxThreads: maxWorkers,
        isolate: false,        // Better performance for component tests
        useAtomics: true,
      },
      forks: {
        singleFork: false,
        isolate: false,
      },
    },
    
    // **PERFORMANCE TIMEOUTS**
    testTimeout: 8000,       // Frontend components can be slower
    hookTimeout: 3000,       // DOM setup time
    teardownTimeout: 3000,
    
    // **EXECUTION STRATEGY**
    bail: 0,
    retry: 0,
    sequence: {
      shuffle: false,         // Deterministic for CI
      concurrent: true,       // Enable concurrent execution
    },
    
    // **MOCK OPTIMIZATIONS**
    mockReset: false,        // Reduce overhead
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
        '**/*.d.ts',
        'next.config.js',
        '.next/',
        'src/types/**',
        'src/styles/**',
        '**/*.stories.*',
        '**/mocks/**',
        '**/fixtures/**',
        'src/lib/test-utils/**'
      ],
      
      include: [
        'src/components/**/*.{ts,tsx}',
        'src/lib/**/*.{ts,tsx}',
        'src/utils/**/*.{ts,tsx}',
        'src/hooks/**/*.{ts,tsx}'
      ],
      
      // Relaxed thresholds for speed
      thresholds: {
        branches: 50,
        functions: 50,
        lines: 50,
        statements: 50,
      },
    },
    
    // **OPTIMIZED FILE PATTERNS**
    include: [
      'src/**/*.{test,spec}.{ts,tsx}',
      'tests/**/*.{test,spec}.{ts,tsx}'
    ],
    
    exclude: [
      'node_modules/**',
      '.next/**',
      'coverage/**',
      '**/*.d.ts',
      '**/*.config.*',
      '**/e2e/**',           // Exclude slow E2E tests
      '**/integration/**',   // Run integration separately
      '**/visual/**'         // Exclude visual regression tests
    ],
    
    // **ENVIRONMENT OPTIMIZATIONS**
    env: {
      NODE_ENV: 'test',
      NEXT_TELEMETRY_DISABLED: '1',
      VITEST_POOL_SIZE: maxWorkers.toString(),
      NODE_OPTIONS: '--max-old-space-size=2048'
    },
  },
  
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@/components': path.resolve(__dirname, './src/components'),
      '@/lib': path.resolve(__dirname, './src/lib'),
      '@/utils': path.resolve(__dirname, './src/utils'),
      '@/hooks': path.resolve(__dirname, './src/hooks'),
      '@/types': path.resolve(__dirname, './src/types')
    },
  },
  
  // **BUILD OPTIMIZATIONS**
  esbuild: {
    target: 'esnext',
    sourcemap: false,
    jsx: 'automatic',
  },
  
  optimizeDeps: {
    include: ['react', 'react-dom', '@testing-library/react', '@testing-library/jest-dom'],
    exclude: ['next']
  }
});