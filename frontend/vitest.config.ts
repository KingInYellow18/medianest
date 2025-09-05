/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  plugins: [],
  esbuild: {
    jsxInject: `import React from 'react'`,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.tsx'],
    css: true,
    // Include TypeScript declaration files
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    exclude: [
      'node_modules',
      'dist',
      '.next',
      'out',
    ],
    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'coverage/**',
        'dist/**',
        '.next/**',
        'out/**',
        'node_modules/**',
        'src/**/*.d.ts',
        'src/test/**',
        'src/**/*.config.*',
      ],
    },
    // Mock CSS and static assets
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@/components': path.resolve(__dirname, './src/components'),
      '@/lib': path.resolve(__dirname, './src/lib'),
      '@/hooks': path.resolve(__dirname, './src/hooks'),
      '@/services': path.resolve(__dirname, './src/services'),
      '@/contexts': path.resolve(__dirname, './src/contexts'),
      '@/types': path.resolve(__dirname, './types'),
      '@/utils': path.resolve(__dirname, './src/utils'),
      '@medianest/shared': path.resolve(__dirname, '../shared/src'),
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@/components': path.resolve(__dirname, './src/components'),
      '@/lib': path.resolve(__dirname, './src/lib'),
      '@/hooks': path.resolve(__dirname, './src/hooks'),
      '@/services': path.resolve(__dirname, './src/services'),
      '@/contexts': path.resolve(__dirname, './src/contexts'),
      '@/types': path.resolve(__dirname, './types'),
      '@/utils': path.resolve(__dirname, './src/utils'),
      '@medianest/shared': path.resolve(__dirname, '../shared/src'),
    },
  },
})