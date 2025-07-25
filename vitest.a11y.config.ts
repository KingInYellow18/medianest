import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./test-setup.ts', './test-setup.a11y.ts'],
    include: [
      'frontend/src/**/*.a11y.test.{ts,tsx}',
      'frontend/src/**/*.accessibility.test.{ts,tsx}'
    ],
    testTimeout: 30000, // Longer timeout for accessibility tests
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['frontend/src/**/*.{ts,tsx}'],
      exclude: [
        'node_modules/**',
        'dist/**',
        '**/*.d.ts',
        '**/*.stories.tsx',
        '**/storybook-static/**'
      ]
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './frontend/src'),
      '@shared': path.resolve(__dirname, './shared/src'),
      '@backend': path.resolve(__dirname, './backend/src')
    }
  }
});