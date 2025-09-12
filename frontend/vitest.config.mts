/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    globals: true,
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockData.ts'
      ],
      thresholds: {
        branches: 60,
        functions: 60,
        lines: 60,
        statements: 60
      }
    },
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
        isolate: true
      }
    },
    // Prevent worker thread termination errors
    maxWorkers: 1,
    minWorkers: 1
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@/components': fileURLToPath(new URL('./src/components', import.meta.url)),
      '@/lib': fileURLToPath(new URL('./src/lib', import.meta.url)),
      '@/types': fileURLToPath(new URL('./src/types', import.meta.url)),
      '@/hooks': fileURLToPath(new URL('./src/hooks', import.meta.url)),
      '@/services': fileURLToPath(new URL('./src/services', import.meta.url))
    }
  }
})