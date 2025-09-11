import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    // Simple reporter configuration
    reporter: 'default',
    
    // Basic environment
    environment: 'node',
    globals: true,
    
    // Test file patterns
    include: ['**/*.{test,spec}.{ts,tsx}'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    
    // Timeout settings
    testTimeout: 5000,
    hookTimeout: 1000,
  },
  
  resolve: {
    alias: {
      '@': resolve(__dirname, './backend/src'),
      '@backend': resolve(__dirname, './backend/src'),
      '@shared': resolve(__dirname, './shared/src'),
      '@medianest/shared': resolve(__dirname, './shared/src'),
    }
  }
});