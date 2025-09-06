import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'text-summary'],
      reportsDirectory: './coverage',
      exclude: [
        'node_modules/', 
        'tests/', 
        'src/__tests__/',
        '**/*.d.ts', 
        '**/*.config.*', 
        'dist/', 
        'src/types/**',
        'src/schemas/**',
        'src/validations/**',
        '**/test-*.ts'
      ],
      include: [
        'src/controllers/**/*.ts',
        'src/services/**/*.ts',
        'src/middleware/**/*.ts',
        'src/utils/**/*.ts',
        'src/repositories/**/*.ts'
      ],
      thresholds: {
        branches: 60,
        functions: 60,
        lines: 60,
        statements: 60,
      },
      reportOnFailure: true,
      clean: true,
      cleanOnRerun: true,
      skipFull: false
    },
    testTimeout: 30000,
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
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
      '@/validation': path.resolve(__dirname, './src/validation')
    },
  },
})