import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./test-setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/**',
        'dist/**',
        '**/*.d.ts',
        'test-setup.ts',
        'vitest.config.ts',
        '**/*.stories.tsx',
        '**/storybook-static/**'
      ],
      thresholds: {
        global: {
          branches: 90,
          functions: 90,
          lines: 90,
          statements: 90
        },
        './frontend/src/components/': {
          branches: 95,
          functions: 95,
          lines: 95,
          statements: 95
        },
        './frontend/src/hooks/': {
          branches: 92,
          functions: 92,
          lines: 92,
          statements: 92
        }
      }
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