import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    // MODERN VITEST PROJECTS CONFIGURATION (replaces deprecated workspace)
    projects: [
      {
        name: 'frontend',
        root: './frontend',
        test: {
          environment: 'jsdom',
          globals: true,
          setupFiles: ['./tests/setup.ts'],
          include: ['**/*.{test,spec}.{ts,tsx}'],
          exclude: ['**/node_modules/**', '**/dist/**']
        },
        resolve: {
          alias: {
            '@': resolve(__dirname, './frontend/src'),
            '@/components': resolve(__dirname, './frontend/src/components'),
            '@/utils': resolve(__dirname, './frontend/src/utils'),
            '@/hooks': resolve(__dirname, './frontend/src/hooks'),
            '@/types': resolve(__dirname, './frontend/src/types'),
            '@medianest/shared': resolve(__dirname, './shared/src')
          }
        }
      },
      {
        name: 'backend',
        root: './backend',
        test: {
          environment: 'node',
          globals: true,
          setupFiles: ['../tests/setup-enhanced.ts'],
          include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
          exclude: [
            'node_modules/**',
            'dist/**',
            'coverage/**',
            '**/*.d.ts',
            '**/*.config.*',
            // Exclude slow performance tests from main suite
            '**/e2e/**',
            '**/integration/**',
            '**/performance/**'
          ]
        },
        resolve: {
          alias: {
            '@': resolve(__dirname, './backend/src'),
            '@/config': resolve(__dirname, './backend/src/config'),
            '@/controllers': resolve(__dirname, './backend/src/controllers'),
            '@/middleware': resolve(__dirname, './backend/src/middleware'),
            '@/repositories': resolve(__dirname, './backend/src/repositories'),
            '@/services': resolve(__dirname, './backend/src/services'),
            '@/utils': resolve(__dirname, './backend/src/utils'),
            '@/types': resolve(__dirname, './backend/src/types'),
            '@/routes': resolve(__dirname, './backend/src/routes'),
            '@medianest/shared': resolve(__dirname, './shared/src')
          }
        }
      },
      {
        name: 'shared',
        root: './shared',
        test: {
          environment: 'node', 
          globals: true,
          include: ['**/*.{test,spec}.{ts,js}'],
          exclude: ['**/node_modules/**', '**/dist/**']
        },
        resolve: {
          alias: {
            '@': resolve(__dirname, './shared/src'),
            '@medianest/shared': resolve(__dirname, './shared/src')
          }
        }
      }
    ],
    
    // Global test configuration
    testTimeout: 30000,
    hookTimeout: 30000,
    teardownTimeout: 30000,
    
    // Performance-optimized settings
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: false,
        maxForks: 4,
        minForks: 1
      }
    },
    
    // Modern dependency configuration (replaces deprecated deps.external)
    server: {
      deps: {
        external: ['@medianest/shared'],
        inline: ['@testing-library/jest-dom']
      }
    },
    
    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'coverage/**',
        'dist/**',
        '**/node_modules/**',
        '**/test-results/**',
        '**/*.d.ts',
        // Exclude performance test files from coverage
        'tests/performance/**',
        'tests/e2e/e2e-performance.spec.ts', 
        'tests/security/security-performance.test.ts',
        'scripts/**',
        '**/*.config.{js,ts}',
        '**/*.setup.{js,ts}'
      ],
      thresholds: {
        global: {
          branches: 65,
          functions: 65,
          lines: 65,
          statements: 65
        }
      }
    },
    
    // Reporter configuration
    reporter: process.env.CI ? ['github-actions', 'json'] : ['default'],
    outputFile: process.env.CI ? 'test-results/unit-test-results.json' : undefined,
    
    // Setup files
    setupFiles: [
      'backend/tests/setup/test-setup.ts'
    ],
    
    // File watching (disabled in CI)
    watch: !process.env.CI,
    
    // Memory and performance settings
    isolate: true,
    
    // Maximum number of threads
    maxConcurrency: 5,
    
    // Retry configuration
    retry: process.env.CI ? 2 : 0,
    
    // Bail after first test failure in CI
    bail: process.env.CI ? 1 : 0
  },
  
  // Global resolve configuration (fallback for non-project specific imports)
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@backend': resolve(__dirname, './backend/src'),
      '@frontend': resolve(__dirname, './frontend/src'),
      '@shared': resolve(__dirname, './shared/src'),
      '@tests': resolve(__dirname, './tests'),
      '@medianest/shared': resolve(__dirname, './shared/src')
    }
  },
  
  // Define configuration for different environments
  define: {
    'import.meta.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'test'),
    'import.meta.env.TEST_ENV': JSON.stringify(process.env.TEST_ENV || 'unit')
  }
});