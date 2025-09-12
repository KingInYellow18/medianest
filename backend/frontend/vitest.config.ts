/// <reference types="vitest" />
import path from 'path';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-utils/setup.ts'],
    globals: true,
    
    // Configure error handling for React Error Boundary tests
    onConsoleLog: (log, type) => {
      // Suppress specific error logs during tests
      if (type === 'stderr' && typeof log === 'string') {
        // Suppress React error boundary test errors
        const suppressPatterns = [
          'Test error message',
          'Stack trace test',
          'Callback test error', 
          'Custom fallback test',
          'Fallback info test',
          'Original error',
          'Retry test error',
          'Development logging test',
          'Production logging test',
          'HOC error test',
          'Wrapped component error',
          'Deep nested error'
        ];
        
        if (suppressPatterns.some(pattern => log.includes(pattern))) {
          return false; // Suppress this log
        }
      }
      return true; // Allow other logs
    },
    
    // Test execution configuration
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
        minThreads: 1,
        maxThreads: 4,
        isolate: true,
        useAtomics: true,
      },
    },
    
    // Timeouts optimized for React component testing
    testTimeout: 10000,
    hookTimeout: 5000,
    teardownTimeout: 3000,
    
    // Test patterns for React components
    include: [
      'src/**/*.{test,spec}.{ts,tsx}',
      'src/**/__tests__/**/*.{ts,tsx}',
    ],
    
    exclude: [
      'node_modules/**',
      'dist/**',
      'build/**',
      'coverage/**',
      '**/*.d.ts',
      '**/*.config.*',
      '**/e2e/**',
      '**/integration/**',
    ],
    
    // Mock configuration
    mockReset: true,
    clearMocks: true,
    restoreMocks: true,
    
    // Coverage configuration for React components
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test-utils/**',
        'src/**/*.d.ts',
        'src/**/*.config.*',
        'src/**/__tests__/**',
        'src/**/test-*.{ts,tsx}',
        'src/**/mock*.{ts,tsx}',
      ],
      include: [
        'src/components/**/*.{ts,tsx}',
        'src/hooks/**/*.{ts,tsx}',
        'src/utils/**/*.{ts,tsx}',
        'src/services/**/*.{ts,tsx}',
      ],
      thresholds: {
        branches: 80,
        functions: 80,
        lines: 85,
        statements: 85,
      },
    },
    
    // React Testing Library environment
    env: {
      NODE_ENV: 'test',
      VITE_APP_ENV: 'test',
    },
    
    // Performance optimizations
    sequence: {
      shuffle: false,
      concurrent: true,
      setupTimeout: 10000,
    },
    
    maxConcurrency: 4,
    
    // Reporter configuration
    reporter: ['default', 'json'],
    
    // File watching configuration
    watch: false,
    
    // Dependency configuration
    deps: {
      external: ['/node_modules/'],
      inline: [
        '@testing-library/react',
        '@testing-library/jest-dom',
        '@testing-library/user-event',
      ],
    },
  },
  
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@/components': path.resolve(__dirname, './src/components'),
      '@/hooks': path.resolve(__dirname, './src/hooks'),
      '@/utils': path.resolve(__dirname, './src/utils'),
      '@/services': path.resolve(__dirname, './src/services'),
      '@/types': path.resolve(__dirname, './src/types'),
      '@/test-utils': path.resolve(__dirname, './src/test-utils'),
    },
  },
  
  // Build optimizations for testing
  esbuild: {
    target: 'es2020',
    sourcemap: true,
    minify: false,
  },
  
  // Dependency optimization
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      '@testing-library/react',
      '@testing-library/jest-dom',
      '@testing-library/user-event',
    ],
  },
});