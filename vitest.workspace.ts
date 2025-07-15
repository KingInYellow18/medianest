import { defineWorkspace } from 'vitest/config'

export default defineWorkspace([
  {
    extends: './frontend/vitest.config.mts',
    test: {
      name: 'frontend',
      root: './frontend',
      coverage: {
        provider: 'v8',
        enabled: true,
        include: ['src/**/*.{ts,tsx}'],
        exclude: [
          '**/*.d.ts',
          '**/*.test.{ts,tsx}',
          '**/__tests__/**',
          '**/tests/**',
          '**/node_modules/**',
          'src/types/**',
          'src/**/*.stories.tsx'
        ],
        thresholds: {
          branches: 60,
          functions: 60,
          lines: 60,
          statements: 60
        }
      }
    }
  },
  {
    extends: './backend/vitest.config.ts',
    test: {
      name: 'backend', 
      root: './backend',
      coverage: {
        provider: 'v8',
        enabled: true,
        include: ['src/**/*.ts'],
        exclude: [
          '**/*.d.ts',
          '**/*.test.ts',
          '**/__tests__/**',
          '**/tests/**',
          '**/node_modules/**',
          'src/types/**'
        ],
        thresholds: {
          branches: 60,
          functions: 60,
          lines: 60,
          statements: 60
        }
      }
    }
  },
  {
    test: {
      name: 'shared',
      root: './shared',
      environment: 'node',
      globals: true,
      coverage: {
        provider: 'v8',
        enabled: true,
        include: ['src/**/*.ts'],
        exclude: [
          '**/*.d.ts',
          '**/*.test.ts',
          '**/__tests__/**',
          '**/tests/**',
          '**/node_modules/**',
          'src/types/**'
        ],
        thresholds: {
          branches: 60,
          functions: 60,
          lines: 60,
          statements: 60
        }
      }
    }
  }
])