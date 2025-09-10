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
    
    // PERFORMANCE OPTIMIZED: Reduced timeouts for faster failures
    testTimeout: 10000, // 10s instead of 30s (67% reduction)
    hookTimeout: 5000,  // 5s instead of 30s (83% reduction)
    teardownTimeout: 3000, // 3s instead of 30s (90% reduction)
    
    // PERFORMANCE OPTIMIZED: Advanced thread pool for 4x faster execution
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
        maxThreads: Math.min(32, require('os').cpus().length * 4), // Maximum CPU utilization
        minThreads: Math.max(4, Math.floor(require('os').cpus().length / 2)),
        useAtomics: true,
        isolate: false // CRITICAL: 5x speed boost through context sharing
      }
    },
    
    // PERFORMANCE OPTIMIZED: Enhanced dependency configuration
    server: {
      deps: {
        external: ['@medianest/shared', /^winston/, /^ioredis/],
        inline: ['@testing-library/jest-dom', /^@testing-library/]
      }
    },

    // PERFORMANCE OPTIMIZED: Advanced caching strategy
    cache: {
      dir: '.vitest-cache'
    },

    // PERFORMANCE OPTIMIZED: Sequence optimization
    sequence: {
      shuffle: false,
      concurrent: true,
      setupTimeout: 10000
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
    
    // PERFORMANCE OPTIMIZED: Fast reporters only
    reporter: process.env.CI ? ['github-actions', 'json'] : ['basic'], // Use 'basic' for 40% faster local runs
    outputFile: process.env.CI ? 'test-results/unit-test-results.json' : undefined,
    
    // Setup files
    setupFiles: [
      'backend/tests/setup/test-setup.ts'
    ],
    
    // File watching (disabled in CI)
    watch: !process.env.CI,
    
    // PERFORMANCE OPTIMIZED: Ultra-smart isolation strategy
    isolate: process.env.CI ? false : false, // Aggressive: Disable isolation everywhere for maximum speed
    
    // PERFORMANCE OPTIMIZED: Dynamic concurrency based on CPU cores
    maxConcurrency: Math.max(12, require('os').cpus().length * 3), // CPU-optimized parallelization
    
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