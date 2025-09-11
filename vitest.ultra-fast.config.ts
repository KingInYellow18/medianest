import { defineConfig } from 'vitest/config';
import { resolve } from 'path';
import os from 'os';

/**
 * ULTRA-FAST TEST CONFIGURATION - ARCHITECTURE OPTIMIZED
 * 
 * TARGET: Sub-10 second execution for hot reload development
 * STRATEGY: Maximum parallelization with minimal overhead
 * 
 * Performance Optimizations:
 * - Shared context across all tests (isolate: false)
 * - Maximum thread utilization (all CPU cores)
 * - Aggressive timeouts and bail-out settings  
 * - Zero coverage overhead
 * - Minimal file discovery patterns
 * - Pre-optimized mock alignment system
 */

export default defineConfig({
  // MODERN CACHE CONFIGURATION
  cacheDir: '.vitest-ultra-cache',
  test: {
    // MAXIMUM PARALLELIZATION: Use all available CPU cores
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
        maxThreads: os.cpus().length,
        minThreads: os.cpus().length, // Always use all cores
        useAtomics: true,
        isolate: false // CRITICAL: Shared context for 10x speed boost
      }
    },
    
    // ULTRA-AGGRESSIVE TIMEOUTS: Fail ultra-fast
    testTimeout: 2000,   // 2s max per test
    hookTimeout: 500,    // 0.5s setup/teardown
    teardownTimeout: 200, // 0.2s cleanup
    
    // MAXIMUM CONCURRENCY: CPU cores * 6 for ultra-fast execution
    maxConcurrency: os.cpus().length * 6,
    
    // MINIMAL ENVIRONMENT: Node.js only, globals enabled
    environment: 'node',
    globals: true,
    
    // ULTRA-SELECTIVE FILE DISCOVERY: Only unit tests
    include: [
      'tests/unit/**/*.{test,spec}.{ts,tsx}',
      'backend/tests/unit/**/*.{test,spec}.{ts,tsx}',
      '!**/node_modules/**',
    ],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      '**/*.d.ts',
      '**/e2e/**',
      '**/integration/**',
      '**/performance/**',
      '**/security/**'
    ],
    
    // OPTIMIZED SETUP: Mock alignment system included
    setupFiles: [
      './tests/utils/mock-alignment-system.ts'
    ],
    
    // ZERO COVERAGE: Maximum speed priority
    coverage: {
      enabled: false
    },
    
    // OPTIMAL REPORTER: Fast output without deprecation warnings
    reporter: [['default', { summary: false }]],
    
    // NO RETRIES: Ultra-fast failure detection
    retry: 0,
    bail: 5, // Stop after 5 failures
    
    // DEVELOPMENT FEATURES: Watch mode optimized
    watch: true,
    isolate: false,
    
    // Modern caching configuration (cache.dir is deprecated)
    
    // MODERN DEPENDENCY OPTIMIZATION: Use Vitest v3 APIs
    deps: {
      optimizer: {
        ssr: {
          enabled: true,
          exclude: [
            '@medianest/shared',
            'winston',
            'ioredis',
            '@testing-library/react',
            'express',
            'jsonwebtoken'
          ]
        }
      }
    },
    
    // OPTIMIZED SEQUENCE: Concurrent execution
    sequence: {
      shuffle: false,
      concurrent: true,
      setupTimeout: 2000
    },
    
    // MEMORY OPTIMIZATION: Disable heap usage logging
    logHeapUsage: false,
    
    // ENVIRONMENT OPTIMIZATIONS: Silent logging
    env: {
      NODE_ENV: 'test',
      LOG_LEVEL: 'silent',
      VITEST_ULTRA_FAST: 'true',
      DISABLE_LOGGING: 'true',
      DISABLE_ANALYTICS: 'true',
      DISABLE_TELEMETRY: 'true'
    }
  },
  
  // MINIMAL RESOLVE CONFIG: Essential aliases only
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@backend': resolve(__dirname, './backend/src'),
      '@frontend': resolve(__dirname, './frontend/src'),
      '@shared': resolve(__dirname, './shared/src'),
      '@medianest/shared': resolve(__dirname, './shared/src'),
      '@tests': resolve(__dirname, './tests')
    }
  },
  
  // ULTRA-FAST COMPILATION: Maximum speed, minimal features
  esbuild: {
    target: 'node18',
    format: 'esm',
    sourcemap: false,
    minify: false,
    keepNames: false,
    treeShaking: true,
    platform: 'node'
  },
  
  // PERFORMANCE DEFINES: Ultra-fast mode indicators
  define: {
    'import.meta.env.NODE_ENV': '"test"',
    'import.meta.env.VITEST_ULTRA_FAST': 'true',
    'global.__VITEST_ULTRA_FAST__': 'true',
    'global.__DEV__': 'false'
  }
});