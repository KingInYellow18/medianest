import { vi } from 'vitest';

// Performance testing utilities
global.performanceHelpers = {
  // Measure render time
  measureRender: async (renderFn: () => void) => {
    const start = performance.now();
    renderFn();
    // Wait for React to complete rendering
    await new Promise(resolve => setTimeout(resolve, 0));
    const end = performance.now();
    return end - start;
  },
  
  // Measure memory usage
  measureMemory: () => {
    if ('memory' in performance) {
      return {
        used: (performance as any).memory.usedJSHeapSize,
        total: (performance as any).memory.totalJSHeapSize,
        limit: (performance as any).memory.jsHeapSizeLimit
      };
    }
    return null;
  },
  
  // Test component re-render count
  countRenders: () => {
    let renderCount = 0;
    const originalCreateElement = React.createElement;
    
    React.createElement = function(...args) {
      renderCount++;
      return originalCreateElement.apply(this, args);
    };
    
    return {
      reset: () => { renderCount = 0; },
      count: () => renderCount,
      restore: () => { React.createElement = originalCreateElement; }
    };
  },
  
  // Performance benchmarks
  benchmarks: {
    RENDER_TIME_THRESHOLD: 16, // 16ms for 60fps
    MEMORY_LEAK_THRESHOLD: 1024 * 1024, // 1MB
    MAX_RENDERS_PER_INTERACTION: 3,
    BUNDLE_SIZE_THRESHOLD: 500 * 1024 // 500KB
  }
};

// Mock Performance Observer
global.PerformanceObserver = vi.fn().mockImplementation((callback) => ({
  observe: vi.fn(),
  disconnect: vi.fn(),
  takeRecords: vi.fn(() => [])
}));

// Enhanced performance metrics collection
global.performanceMetrics = {
  renderTimes: [] as number[],
  memorySnapshots: [] as any[],
  renderCounts: new Map<string, number>(),
  
  recordRender: (componentName: string, time: number) => {
    global.performanceMetrics.renderTimes.push(time);
    const current = global.performanceMetrics.renderCounts.get(componentName) || 0;
    global.performanceMetrics.renderCounts.set(componentName, current + 1);
  },
  
  recordMemory: () => {
    const memory = global.performanceHelpers.measureMemory();
    if (memory) {
      global.performanceMetrics.memorySnapshots.push({
        ...memory,
        timestamp: Date.now()
      });
    }
  },
  
  getStats: () => ({
    avgRenderTime: global.performanceMetrics.renderTimes.reduce((a, b) => a + b, 0) / global.performanceMetrics.renderTimes.length || 0,
    maxRenderTime: Math.max(...global.performanceMetrics.renderTimes, 0),
    totalRenderCount: Array.from(global.performanceMetrics.renderCounts.values()).reduce((a, b) => a + b, 0),
    memoryGrowth: global.performanceMetrics.memorySnapshots.length > 1 
      ? global.performanceMetrics.memorySnapshots[global.performanceMetrics.memorySnapshots.length - 1].used - global.performanceMetrics.memorySnapshots[0].used 
      : 0
  }),
  
  reset: () => {
    global.performanceMetrics.renderTimes = [];
    global.performanceMetrics.memorySnapshots = [];
    global.performanceMetrics.renderCounts.clear();
  }
};

// Mock Web Vitals metrics
global.webVitalsMetrics = {
  LCP: 0, // Largest Contentful Paint
  FID: 0, // First Input Delay
  CLS: 0, // Cumulative Layout Shift
  FCP: 0, // First Contentful Paint
  TTFB: 0 // Time to First Byte
};

// Performance testing assertions
global.expectPerformance = {
  renderTimeToBeLessThan: (threshold: number) => ({
    passes: (actual: number) => actual < threshold,
    message: () => `Expected render time ${global.performanceMetrics.getStats().avgRenderTime}ms to be less than ${threshold}ms`
  }),
  
  memoryLeakToBeWithin: (threshold: number) => ({
    passes: (actual: number) => actual < threshold,
    message: () => `Expected memory growth ${global.performanceMetrics.getStats().memoryGrowth} bytes to be within ${threshold} bytes`
  }),
  
  renderCountToBeLessThan: (componentName: string, threshold: number) => ({
    passes: () => (global.performanceMetrics.renderCounts.get(componentName) || 0) < threshold,
    message: () => `Expected ${componentName} render count ${global.performanceMetrics.renderCounts.get(componentName)} to be less than ${threshold}`
  })
};

// Mock requestIdleCallback for performance testing
global.requestIdleCallback = vi.fn((callback) => {
  setTimeout(() => callback({ 
    didTimeout: false, 
    timeRemaining: () => 50 
  }), 0);
  return 1;
});

global.cancelIdleCallback = vi.fn();

// Setup bundle size analysis
global.bundleAnalysis = {
  analyzedModules: new Set<string>(),
  totalSize: 0,
  
  trackModule: (moduleName: string, size: number) => {
    global.bundleAnalysis.analyzedModules.add(moduleName);
    global.bundleAnalysis.totalSize += size;
  },
  
  getReport: () => ({
    moduleCount: global.bundleAnalysis.analyzedModules.size,
    totalSize: global.bundleAnalysis.totalSize,
    averageModuleSize: global.bundleAnalysis.totalSize / global.bundleAnalysis.analyzedModules.size || 0
  })
};

console.log('⚡ Performance testing setup complete - metrics collection enabled');