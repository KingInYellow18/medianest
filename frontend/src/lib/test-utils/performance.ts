import React from 'react';
import { render, RenderResult } from '@testing-library/react';
import { act } from '@testing-library/react';

export interface PerformanceMetrics {
  renderTime: number;
  memoryUsage?: {
    used: number;
    total: number;
    limit: number;
  };
  renderCount: number;
  bundleSize?: number;
}

export interface PerformanceBenchmarks {
  RENDER_TIME_THRESHOLD: number;
  MEMORY_LEAK_THRESHOLD: number;
  MAX_RENDERS_PER_INTERACTION: number;
  BUNDLE_SIZE_THRESHOLD: number;
  FPS_THRESHOLD: number;
  LCP_THRESHOLD: number; // Largest Contentful Paint
  FID_THRESHOLD: number; // First Input Delay
  CLS_THRESHOLD: number; // Cumulative Layout Shift
}

export class PerformanceTester {
  private static benchmarks: PerformanceBenchmarks = {
    RENDER_TIME_THRESHOLD: 16, // 16ms for 60fps
    MEMORY_LEAK_THRESHOLD: 1024 * 1024, // 1MB
    MAX_RENDERS_PER_INTERACTION: 3,
    BUNDLE_SIZE_THRESHOLD: 500 * 1024, // 500KB
    FPS_THRESHOLD: 55, // 55+ FPS target
    LCP_THRESHOLD: 2500, // 2.5s
    FID_THRESHOLD: 100, // 100ms
    CLS_THRESHOLD: 0.1 // 0.1 cumulative layout shift
  };

  /**
   * Measure component render performance
   */
  static async measureRenderPerformance<T extends Record<string, any>>(
    Component: React.ComponentType<T>,
    props: T,
    iterations: number = 10
  ): Promise<PerformanceMetrics> {
    const renderTimes: number[] = [];
    let renderCount = 0;
    const startMemory = this.getMemoryUsage();

    // Wrap component to count renders
    const WrappedComponent = (componentProps: T) => {
      renderCount++;
      return React.createElement(Component, componentProps);
    };

    for (let i = 0; i < iterations; i++) {
      const startTime = performance.now();
      
      const { unmount } = render(React.createElement(WrappedComponent, props));
      
      // Wait for React to complete rendering
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });
      
      const endTime = performance.now();
      renderTimes.push(endTime - startTime);
      
      unmount();
    }

    const endMemory = this.getMemoryUsage();
    const avgRenderTime = renderTimes.reduce((sum, time) => sum + time, 0) / iterations;

    return {
      renderTime: avgRenderTime,
      memoryUsage: endMemory,
      renderCount: renderCount / iterations,
      bundleSize: this.estimateBundleSize(Component)
    };
  }

  /**
   * Test for memory leaks during component lifecycle
   */
  static async testMemoryLeaks<T extends Record<string, any>>(
    Component: React.ComponentType<T>,
    props: T,
    cycles: number = 50
  ): Promise<{ leaked: boolean; growthBytes: number; snapshots: any[] }> {
    const memorySnapshots: any[] = [];
    
    for (let i = 0; i < cycles; i++) {
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const beforeMemory = this.getMemoryUsage();
      memorySnapshots.push({
        cycle: i,
        before: beforeMemory,
        timestamp: Date.now()
      });

      // Mount and unmount component
      const { unmount } = await act(async () => {
        return render(React.createElement(Component, props));
      });

      await act(async () => {
        unmount();
        await new Promise(resolve => setTimeout(resolve, 10));
      });
    }

    const startMemory = memorySnapshots[0]?.before?.used || 0;
    const endMemory = memorySnapshots[memorySnapshots.length - 1]?.before?.used || 0;
    const growthBytes = endMemory - startMemory;

    return {
      leaked: growthBytes > this.benchmarks.MEMORY_LEAK_THRESHOLD,
      growthBytes,
      snapshots: memorySnapshots
    };
  }

  /**
   * Measure rendering performance with user interactions
   */
  static async measureInteractionPerformance(
    component: RenderResult,
    interactions: Array<() => Promise<void> | void>
  ): Promise<{ interactions: Array<{ duration: number; renders: number }> }> {
    const results = [];
    
    for (const interaction of interactions) {
      let renderCount = 0;
      
      // Hook into React's render cycle (simplified)
      const startTime = performance.now();
      
      await act(async () => {
        await interaction();
      });
      
      const endTime = performance.now();
      
      results.push({
        duration: endTime - startTime,
        renders: renderCount
      });
    }

    return { interactions: results };
  }

  /**
   * Test component performance under load
   */
  static async loadTest<T extends Record<string, any>>(
    Component: React.ComponentType<T>,
    props: T,
    concurrentInstances: number = 10
  ): Promise<{ avgRenderTime: number; memoryPeak: number; crashed: boolean }> {
    const startMemory = this.getMemoryUsage();
    let memoryPeak = startMemory?.used || 0;
    let crashed = false;
    const renderTimes: number[] = [];

    try {
      const promises = Array.from({ length: concurrentInstances }, async (_, index) => {
        const startTime = performance.now();
        
        const result = await act(async () => {
          return render(React.createElement(Component, { ...props, key: index }));
        });
        
        const endTime = performance.now();
        renderTimes.push(endTime - startTime);
        
        const currentMemory = this.getMemoryUsage();
        if (currentMemory?.used && currentMemory.used > memoryPeak) {
          memoryPeak = currentMemory.used;
        }
        
        return result;
      });

      const results = await Promise.all(promises);
      
      // Cleanup
      results.forEach(({ unmount }) => {
        act(() => {
          unmount();
        });
      });

    } catch (error) {
      crashed = true;
      console.error('Load test crashed:', error);
    }

    return {
      avgRenderTime: renderTimes.reduce((sum, time) => sum + time, 0) / renderTimes.length || 0,
      memoryPeak: memoryPeak - (startMemory?.used || 0),
      crashed
    };
  }

  /**
   * Measure First Contentful Paint simulation
   */
  static async measureFCP(
    renderFn: () => RenderResult
  ): Promise<{ fcp: number; lcp: number; elements: number }> {
    const startTime = performance.now();
    
    const result = await act(async () => {
      return renderFn();
    });

    // Simulate contentful paint detection
    const elements = result.container.querySelectorAll('*').length;
    const fcp = performance.now() - startTime;
    
    // Simulate LCP (largest contentful paint)
    const images = result.container.querySelectorAll('img').length;
    const textBlocks = result.container.querySelectorAll('p, h1, h2, h3, h4, h5, h6, div').length;
    const lcp = fcp + (images * 50) + (textBlocks * 10); // Rough simulation
    
    return { fcp, lcp, elements };
  }

  /**
   * Test bundle size impact
   */
  static estimateBundleSize(Component: React.ComponentType<any>): number {
    // This is a simplified estimation - in real scenarios you'd use webpack-bundle-analyzer
    const componentString = Component.toString();
    return new Blob([componentString]).size;
  }

  /**
   * Get current memory usage
   */
  static getMemoryUsage(): { used: number; total: number; limit: number } | null {
    if ('memory' in performance) {
      return {
        used: (performance as any).memory.usedJSHeapSize,
        total: (performance as any).memory.totalJSHeapSize,
        limit: (performance as any).memory.jsHeapSizeLimit
      };
    }
    return null;
  }

  /**
   * Comprehensive performance test suite
   */
  static async runComprehensiveTest<T extends Record<string, any>>(
    Component: React.ComponentType<T>,
    props: T,
    options: {
      renderIterations?: number;
      memoryLeakCycles?: number;
      loadTestInstances?: number;
      testMemoryLeaks?: boolean;
      testLoadPerformance?: boolean;
      testBundleSize?: boolean;
    } = {}
  ) {
    const results: any = {};

    // Basic render performance
    results.renderPerformance = await this.measureRenderPerformance(
      Component, 
      props, 
      options.renderIterations || 10
    );

    // Memory leak test
    if (options.testMemoryLeaks !== false) {
      results.memoryLeaks = await this.testMemoryLeaks(
        Component, 
        props, 
        options.memoryLeakCycles || 25
      );
    }

    // Load test
    if (options.testLoadPerformance !== false) {
      results.loadTest = await this.loadTest(
        Component, 
        props, 
        options.loadTestInstances || 5
      );
    }

    // FCP/LCP measurement
    results.contentfulPaint = await this.measureFCP(() => 
      render(React.createElement(Component, props))
    );

    // Bundle size analysis
    if (options.testBundleSize !== false) {
      results.bundleSize = this.estimateBundleSize(Component);
    }

    // Performance assertions
    results.assertions = {
      renderTimeAcceptable: results.renderPerformance.renderTime < this.benchmarks.RENDER_TIME_THRESHOLD,
      memoryLeakAcceptable: !results.memoryLeaks?.leaked,
      loadTestPassed: !results.loadTest?.crashed,
      bundleSizeAcceptable: (results.bundleSize || 0) < this.benchmarks.BUNDLE_SIZE_THRESHOLD,
      fcpAcceptable: results.contentfulPaint.fcp < this.benchmarks.LCP_THRESHOLD
    };

    return results;
  }

  /**
   * Custom performance assertions
   */
  static createPerformanceMatchers() {
    return {
      toRenderWithin: (received: number, threshold: number) => ({
        pass: received < threshold,
        message: () => `Expected render time ${received}ms to be less than ${threshold}ms`
      }),
      
      toNotLeakMemory: (received: { leaked: boolean; growthBytes: number }) => ({
        pass: !received.leaked,
        message: () => `Expected no memory leak, but detected ${received.growthBytes} bytes growth`
      }),
      
      toHandleLoad: (received: { crashed: boolean }) => ({
        pass: !received.crashed,
        message: () => 'Expected component to handle concurrent load without crashing'
      }),
      
      toHaveAcceptableBundleSize: (received: number, threshold: number = this.benchmarks.BUNDLE_SIZE_THRESHOLD) => ({
        pass: received < threshold,
        message: () => `Expected bundle size ${received} bytes to be less than ${threshold} bytes`
      })
    };
  }

  /**
   * Get performance benchmarks
   */
  static getBenchmarks(): PerformanceBenchmarks {
    return { ...this.benchmarks };
  }

  /**
   * Update performance benchmarks
   */
  static setBenchmarks(newBenchmarks: Partial<PerformanceBenchmarks>) {
    this.benchmarks = { ...this.benchmarks, ...newBenchmarks };
  }
}

// Export performance testing utilities
export const perfUtils = {
  measure: PerformanceTester.measureRenderPerformance,
  testMemoryLeaks: PerformanceTester.testMemoryLeaks,
  testInteractions: PerformanceTester.measureInteractionPerformance,
  loadTest: PerformanceTester.loadTest,
  measureFCP: PerformanceTester.measureFCP,
  runComprehensive: PerformanceTester.runComprehensiveTest,
  matchers: PerformanceTester.createPerformanceMatchers(),
  benchmarks: PerformanceTester.getBenchmarks()
};

// Extend expect with performance matchers
declare global {
  namespace jest {
    interface Matchers<R> {
      toRenderWithin(threshold: number): R;
      toNotLeakMemory(): R;
      toHandleLoad(): R;
      toHaveAcceptableBundleSize(threshold?: number): R;
    }
  }
}

export default PerformanceTester;