/**
 * Performance Test Setup
 * Global setup for performance testing environment
 */

import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { performance } from 'perf_hooks';

// Performance monitoring globals
declare global {
  var __PERFORMANCE_START_TIME__: number;
  var __PERFORMANCE_METRICS__: Map<string, number[]>;
  var __MEMORY_SNAPSHOTS__: number[];
}

// Initialize performance tracking
global.__PERFORMANCE_METRICS__ = new Map();
global.__MEMORY_SNAPSHOTS__ = [];

beforeAll(async () => {
  console.log('🚀 Performance Test Suite Starting...');
  global.__PERFORMANCE_START_TIME__ = performance.now();

  // Enable garbage collection if available
  if (global.gc) {
    console.log('✅ Garbage collection enabled for performance testing');
  } else {
    console.log(
      '⚠️  Garbage collection not available. Run with --expose-gc for better memory tracking',
    );
  }

  // Set Node.js performance settings for testing
  process.env.NODE_OPTIONS = '--max-old-space-size=2048'; // 2GB heap limit

  // Initialize database connection pool settings for performance
  process.env.DATABASE_POOL_SIZE = '20';
  process.env.DATABASE_POOL_TIMEOUT = '30000';
  process.env.DATABASE_CONNECTION_LIMIT = '100';

  // Redis performance settings
  process.env.REDIS_MAX_MEMORY_POLICY = 'allkeys-lru';
  process.env.REDIS_MAX_CLIENTS = '1000';

  console.log('📊 Performance monitoring initialized');
});

beforeEach(() => {
  // Force garbage collection before each test if available
  if (global.gc) {
    global.gc();
  }

  // Record memory usage at test start
  const memoryUsage = process.memoryUsage();
  global.__MEMORY_SNAPSHOTS__.push(memoryUsage.heapUsed);
});

afterEach(() => {
  // Record memory usage after test completion
  const memoryUsage = process.memoryUsage();
  global.__MEMORY_SNAPSHOTS__.push(memoryUsage.heapUsed);

  // Force cleanup if available
  if (global.gc) {
    global.gc();
  }
});

afterAll(async () => {
  const totalTime = performance.now() - global.__PERFORMANCE_START_TIME__;

  console.log('📈 Performance Test Suite Complete');
  console.log(`⏱️  Total execution time: ${totalTime.toFixed(2)}ms`);

  // Memory usage analysis
  if (global.__MEMORY_SNAPSHOTS__.length > 0) {
    const maxMemory = Math.max(...global.__MEMORY_SNAPSHOTS__);
    const avgMemory =
      global.__MEMORY_SNAPSHOTS__.reduce((a, b) => a + b, 0) / global.__MEMORY_SNAPSHOTS__.length;

    console.log(
      `💾 Memory Usage - Max: ${Math.round(maxMemory / 1024 / 1024)}MB, Avg: ${Math.round(avgMemory / 1024 / 1024)}MB`,
    );
  }

  // Performance metrics summary
  if (global.__PERFORMANCE_METRICS__.size > 0) {
    console.log('📊 Performance Metrics Summary:');
    for (const [testName, times] of global.__PERFORMANCE_METRICS__) {
      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      const maxTime = Math.max(...times);
      const minTime = Math.min(...times);

      console.log(
        `  ${testName}: avg ${avgTime.toFixed(2)}ms, min ${minTime.toFixed(2)}ms, max ${maxTime.toFixed(2)}ms`,
      );
    }
  }

  // Cleanup
  global.__PERFORMANCE_METRICS__.clear();
  global.__MEMORY_SNAPSHOTS__.length = 0;
});

// Utility function to track performance metrics
export function trackPerformanceMetric(testName: string, duration: number): void {
  if (!global.__PERFORMANCE_METRICS__.has(testName)) {
    global.__PERFORMANCE_METRICS__.set(testName, []);
  }
  global.__PERFORMANCE_METRICS__.get(testName)!.push(duration);
}

// Utility function to get current memory usage
export function getMemoryUsage(): NodeJS.MemoryUsage {
  return process.memoryUsage();
}

// Utility function to format bytes
export function formatBytes(bytes: number): string {
  const sizes = ['B', 'KB', 'MB', 'GB'];
  if (bytes === 0) return '0 B';
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
}

// Utility function to create performance benchmark
export function createBenchmark(name: string) {
  const startTime = performance.now();
  let endTime: number;

  return {
    end: () => {
      endTime = performance.now();
      const duration = endTime - startTime;
      trackPerformanceMetric(name, duration);
      return duration;
    },
    getDuration: () => endTime - startTime,
  };
}

// Performance assertion helpers
export function expectPerformance(actualMs: number, expectedMs: number, tolerance = 0.1): void {
  const lowerBound = expectedMs * (1 - tolerance);
  const upperBound = expectedMs * (1 + tolerance);

  if (actualMs < lowerBound || actualMs > upperBound) {
    throw new Error(
      `Performance expectation failed: ${actualMs}ms not within ${tolerance * 100}% of expected ${expectedMs}ms (${lowerBound}-${upperBound}ms)`,
    );
  }
}

// Memory leak detection helper
export function detectMemoryLeak(
  beforeMemory: number,
  afterMemory: number,
  threshold = 0.1, // 10% increase threshold
): boolean {
  const memoryIncrease = (afterMemory - beforeMemory) / beforeMemory;
  return memoryIncrease > threshold;
}

console.log('🔧 Performance test utilities loaded');
