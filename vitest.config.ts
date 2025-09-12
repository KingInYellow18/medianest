import { cpus } from 'os';
import { resolve } from 'path';

import { defineConfig } from 'vitest/config';

/**
 * MEDIANEST ULTRA-PERFORMANCE VITEST CONFIGURATION
 * 
 * TARGET: Sub-2-minute test execution with maximum performance
 * OPTIMIZATIONS:
 * - Latest Context7 Vitest best practices
 * - Optimal thread pool configuration (1:1 CPU mapping)
 * - Modern dependency optimization with ssr optimizer
 * - Enhanced memory management and caching
 * - Strategic file discovery and exclusion patterns
 * 
 * Performance Architecture:
 * - Thread pool: Optimal CPU utilization with useAtomics
 * - Dependency bundling: ESBuild optimization for external libs
 * - Memory management: Efficient heap allocation per thread
 * - Test isolation: Balanced performance vs reliability
 */

const CPU_CORES = cpus().length;
const IS_CI = !!process.env.CI;
const IS_DEVELOPMENT = !IS_CI;

export default defineConfig({
  // MODERN CACHE CONFIGURATION: Use Vite's cacheDir (replaces deprecated cache.dir)
  cacheDir: '.vitest-performance-cache',
  
  test: {
    // STABILIZED THREAD POOL: Worker thread termination fixes
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
        // CRITICAL: Reduced thread count to prevent worker instability
        maxThreads: Math.min(CPU_CORES, 4), // Cap at 4 workers max
        minThreads: 1, // Start with 1 to prevent resource contention
        // Context7 recommendation: Enable useAtomics for thread synchronization performance
        useAtomics: true,
        // CRITICAL: Enable isolation to prevent worker thread corruption
        isolate: true, // Always isolate to prevent shared state issues
        // CRITICAL: Removed execArgv as it causes ERR_WORKER_INVALID_EXEC_ARGV
        // execArgv: ['--max-old-space-size=512'],
      }
    },
    
    // STABILIZED TIMEOUTS: Prevent worker thread termination
    testTimeout: IS_CI ? 30000 : 15000,  // Increased dev timeout for stability
    hookTimeout: IS_CI ? 15000 : 10000,  // Increased for proper cleanup
    teardownTimeout: IS_CI ? 10000 : 8000, // Critical: Increased teardown time
    
    // STABILIZED CONCURRENCY: Prevent worker thread overload
    maxConcurrency: Math.min(CPU_CORES, 4), // Reduced to prevent worker instability
    
    // DEVELOPMENT ENVIRONMENT OPTIMIZATIONS
    environment: 'node',
    globals: true,
    
    // STRATEGIC FILE DISCOVERY: Focused test patterns for maximum speed
    include: [
      'backend/tests/unit/**/*.test.ts',
      'backend/tests/**/*.test.ts',
      'shared/src/**/*.test.ts',
      'tests/unit/**/*.test.ts',
      'frontend/src/**/*.test.{ts,tsx}',
      // Exclude slow test types for ultra-fast execution
      '!**/e2e/**',
      '!**/integration/**',
      '!**/performance/**',
      '!**/security/**'
    ],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      '**/build/**',
      '**/*.d.ts',
      '**/.next/**'
    ],
    
    // PERFORMANCE-OPTIMIZED SETUP
    setupFiles: ['./tests/setup-performance-optimized.ts'],
    
    // COVERAGE OPTIMIZATION: Disabled for maximum speed in development
    coverage: {
      enabled: IS_CI,
      provider: 'v8', // Fastest coverage provider
      reporter: IS_CI ? ['text', 'json'] : []
    },
    
    // OPTIMAL REPORTER: Modern configuration without deprecation warnings
    reporter: IS_CI 
      ? ['default', 'junit']
      : 'default', // Fast output for development
    
    // FAIL-FAST CONFIGURATION
    retry: IS_CI ? 2 : 0,
    bail: IS_CI ? 5 : 0,
    
    // DEVELOPMENT FEATURES
    watch: IS_DEVELOPMENT,
    
    // MODERN DEPENDENCY OPTIMIZATION: Context7 best practices with ssr optimizer
    deps: {
      optimizer: {
        ssr: {
          // Context7 recommendation: Enable for performance improvements
          enabled: true,
          exclude: [
            // Exclude large libraries that should remain external
            '@medianest/shared',
            'winston',
            'ioredis',
            '@testing-library/react',
            'react',
            'react-dom',
            'express',
            'jsonwebtoken',
            '@types/*'
          ]
        }
      }
    },
    
    // OPTIMIZED TEST EXECUTION SEQUENCE
    sequence: {
      shuffle: false,        // Predictable test order for consistent performance
      concurrent: true,      // Enable concurrent execution within files
      setupTimeout: IS_CI ? 60000 : 10000
    },
    
    // MEMORY OPTIMIZATION
    logHeapUsage: false,
    
    // PERFORMANCE ENVIRONMENT VARIABLES
    env: {
      NODE_ENV: 'test',
      LOG_LEVEL: 'silent',
      VITEST_PERFORMANCE_MODE: 'true',
      DISABLE_LOGGING: 'true',
      DISABLE_ANALYTICS: 'true',
      DISABLE_TELEMETRY: 'true',
      // Context7 optimization: Configure UV thread pool for optimal performance
      UV_THREADPOOL_SIZE: String(CPU_CORES * 2)
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
  
  // OPTIMIZED COMPILATION: Context7 recommendations for maximum speed
  esbuild: {
    target: 'node18',
    format: 'esm',
    sourcemap: false,      // No source maps for performance
    minify: false,         // Skip minification overhead
    keepNames: false,      // Remove names for smaller bundles
    treeShaking: true,
    platform: 'node'
  },
  
  // PERFORMANCE DEFINES
  define: {
    'import.meta.env.NODE_ENV': '"test"',
    'import.meta.env.VITEST_PERFORMANCE': 'true',
    'global.__VITEST_PERFORMANCE__': 'true',
    '__DEV__': 'false'
  },
  
  // VITE OPTIMIZATIONS: Enhanced for test performance
  optimizeDeps: {
    exclude: [
      '@medianest/shared'
    ]
  },
  
  // BUILD OPTIMIZATIONS
  build: {
    target: 'node18',
    minify: false,
    rollupOptions: {
      external: ['@medianest/shared']
    }
  }
});