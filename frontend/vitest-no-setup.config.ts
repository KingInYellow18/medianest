import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    
    // **STABILIZED EXECUTION - NO WORKER THREAD ISSUES**
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
        isolate: true,
      },
    },
    maxWorkers: 1,
    minWorkers: 1,
    
    // Remove problematic setup file for now
    // setupFiles: ['./tests/setup.ts'],
    
    // Basic timeouts
    testTimeout: 8000,
    hookTimeout: 3000,
    teardownTimeout: 3000,
    
    // Simple reporter
    reporters: ['default'],
    
    // Coverage disabled for speed
    coverage: {
      enabled: false
    },
    
    // Include patterns
    include: [
      'src/**/*.{test,spec}.{ts,tsx}',
    ],
    
    exclude: [
      'node_modules/**',
      '.next/**',
      'coverage/**',
    ],
    
    // Environment
    env: {
      NODE_ENV: 'test',
      NEXT_PUBLIC_BACKEND_URL: 'http://localhost:4000',
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
});