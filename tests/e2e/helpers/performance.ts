import { Page, expect } from '@playwright/test';

/**
 * Performance Testing Helper for E2E Tests
 * 
 * Provides utilities for measuring and asserting performance metrics
 * including page load times, Core Web Vitals, and resource loading
 */
export class PerformanceHelper {
  constructor(private page: Page) {}

  /**
   * Measure page load performance
   */
  async measurePageLoad(url: string, options?: {
    timeout?: number;
    waitFor?: 'load' | 'domcontentloaded' | 'networkidle';
  }): Promise<{
    loadTime: number;
    domContentLoaded: number;
    networkIdle: number;
    firstPaint: number;
    firstContentfulPaint: number;
    largestContentfulPaint: number;
    cumulativeLayoutShift: number;
    firstInputDelay: number;
  }> {
    const { timeout = 30000, waitFor = 'networkidle' } = options || {};
    
    // Start measuring
    const startTime = Date.now();
    
    await this.page.goto(url, { 
      timeout,
      waitUntil: waitFor 
    });
    
    const loadTime = Date.now() - startTime;
    
    // Get performance metrics
    const metrics = await this.page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      const paintEntries = performance.getEntriesByType('paint');
      
      const firstPaint = paintEntries.find(entry => entry.name === 'first-paint')?.startTime || 0;
      const firstContentfulPaint = paintEntries.find(entry => entry.name === 'first-contentful-paint')?.startTime || 0;
      
      return {
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
        networkIdle: navigation.loadEventEnd - navigation.loadEventStart,
        firstPaint,
        firstContentfulPaint
      };
    });
    
    // Get Core Web Vitals
    const webVitals = await this.getCoreWebVitals();
    
    return {
      loadTime,
      ...metrics,
      ...webVitals
    };
  }

  /**
   * Get Core Web Vitals metrics
   */
  async getCoreWebVitals(): Promise<{
    largestContentfulPaint: number;
    cumulativeLayoutShift: number;
    firstInputDelay: number;
  }> {
    return await this.page.evaluate(() => {
      return new Promise((resolve) => {
        let lcp = 0;
        let cls = 0;
        let fid = 0;
        
        // Largest Contentful Paint
        new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1];
          lcp = lastEntry.startTime;
        }).observe({ entryTypes: ['largest-contentful-paint'] });
        
        // Cumulative Layout Shift
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if ((entry as any).hadRecentInput) continue;
            cls += (entry as any).value;
          }
        }).observe({ entryTypes: ['layout-shift'] });
        
        // First Input Delay
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            fid = (entry as any).processingStart - entry.startTime;
            break;
          }
        }).observe({ entryTypes: ['first-input'] });
        
        // Wait a bit for metrics to be collected
        setTimeout(() => {
          resolve({
            largestContentfulPaint: lcp,
            cumulativeLayoutShift: cls,
            firstInputDelay: fid
          });
        }, 2000);
      });
    });
  }

  /**
   * Assert performance budgets
   */
  async assertPerformanceBudget(metrics: {
    loadTime?: number;
    firstContentfulPaint?: number;
    largestContentfulPaint?: number;
    cumulativeLayoutShift?: number;
    firstInputDelay?: number;
  }, budgets: {
    maxLoadTime?: number;
    maxFirstContentfulPaint?: number;
    maxLargestContentfulPaint?: number;
    maxCumulativeLayoutShift?: number;
    maxFirstInputDelay?: number;
  }): void {
    if (budgets.maxLoadTime && metrics.loadTime) {
      expect(metrics.loadTime).toBeLessThan(budgets.maxLoadTime);
    }
    
    if (budgets.maxFirstContentfulPaint && metrics.firstContentfulPaint) {
      expect(metrics.firstContentfulPaint).toBeLessThan(budgets.maxFirstContentfulPaint);
    }
    
    if (budgets.maxLargestContentfulPaint && metrics.largestContentfulPaint) {
      expect(metrics.largestContentfulPaint).toBeLessThan(budgets.maxLargestContentfulPaint);
    }
    
    if (budgets.maxCumulativeLayoutShift && metrics.cumulativeLayoutShift) {
      expect(metrics.cumulativeLayoutShift).toBeLessThan(budgets.maxCumulativeLayoutShift);
    }
    
    if (budgets.maxFirstInputDelay && metrics.firstInputDelay) {
      expect(metrics.firstInputDelay).toBeLessThan(budgets.maxFirstInputDelay);
    }
  }

  /**
   * Measure resource loading performance
   */
  async measureResourceLoading(): Promise<{
    totalResources: number;
    totalSize: number;
    slowResources: Array<{ url: string; duration: number; size: number }>;
    failedResources: Array<{ url: string; status: number }>;
  }> {
    const resources = await this.page.evaluate(() => {
      const entries = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
      const slowThreshold = 1000; // 1 second
      
      return {
        totalResources: entries.length,
        totalSize: entries.reduce((sum, entry) => sum + (entry.transferSize || 0), 0),
        slowResources: entries
          .filter(entry => entry.duration > slowThreshold)
          .map(entry => ({
            url: entry.name,
            duration: entry.duration,
            size: entry.transferSize || 0
          })),
        resources: entries.map(entry => ({
          url: entry.name,
          duration: entry.duration,
          size: entry.transferSize || 0
        }))
      };
    });
    
    // Check for failed resources
    const failedResources = await this.page.evaluate(() => {
      const errors: Array<{ url: string; status: number }> = [];
      
      // This would need to be implemented with network monitoring
      // For now, returning empty array
      return errors;
    });
    
    return {
      ...resources,
      failedResources
    };
  }

  /**
   * Test memory usage
   */
  async measureMemoryUsage(): Promise<{
    usedJSHeapSize: number;
    totalJSHeapSize: number;
    jsHeapSizeLimit: number;
  }> {
    return await this.page.evaluate(() => {
      if ((performance as any).memory) {
        const memory = (performance as any).memory;
        return {
          usedJSHeapSize: memory.usedJSHeapSize,
          totalJSHeapSize: memory.totalJSHeapSize,
          jsHeapSizeLimit: memory.jsHeapSizeLimit
        };
      }
      
      return {
        usedJSHeapSize: 0,
        totalJSHeapSize: 0,
        jsHeapSizeLimit: 0
      };
    });
  }

  /**
   * Measure rendering performance
   */
  async measureRenderingPerformance(action: () => Promise<void>): Promise<{
    renderTime: number;
    frameDrops: number;
    averageFPS: number;
  }> {
    // Start measuring
    await this.page.evaluate(() => {
      (window as any).renderingMetrics = {
        startTime: performance.now(),
        frameCount: 0,
        frameDrops: 0
      };
      
      // Monitor frame rendering
      function measureFrame() {
        (window as any).renderingMetrics.frameCount++;
        requestAnimationFrame(measureFrame);
      }
      requestAnimationFrame(measureFrame);
    });
    
    const startTime = Date.now();
    
    // Perform the action
    await action();
    
    const endTime = Date.now();
    const renderTime = endTime - startTime;
    
    // Get metrics
    const metrics = await this.page.evaluate(() => {
      const metrics = (window as any).renderingMetrics;
      const duration = performance.now() - metrics.startTime;
      const averageFPS = (metrics.frameCount / duration) * 1000;
      
      return {
        frameCount: metrics.frameCount,
        frameDrops: metrics.frameDrops,
        averageFPS
      };
    });
    
    return {
      renderTime,
      frameDrops: metrics.frameDrops,
      averageFPS: metrics.averageFPS
    };
  }

  /**
   * Test scroll performance
   */
  async testScrollPerformance(distance: number = 1000): Promise<{
    scrollTime: number;
    averageFPS: number;
    jankyFrames: number;
  }> {
    return await this.measureRenderingPerformance(async () => {
      await this.page.evaluate((scrollDistance) => {
        return new Promise<void>((resolve) => {
          const startY = window.scrollY;
          const targetY = startY + scrollDistance;
          const duration = 1000; // 1 second
          const startTime = performance.now();
          
          function animateScroll() {
            const currentTime = performance.now();
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            const currentY = startY + (targetY - startY) * progress;
            window.scrollTo(0, currentY);
            
            if (progress < 1) {
              requestAnimationFrame(animateScroll);
            } else {
              resolve();
            }
          }
          
          animateScroll();
        });
      }, distance);
    });
  }

  /**
   * Test interaction performance
   */
  async testInteractionPerformance(
    selector: string,
    interaction: 'click' | 'hover' | 'focus'
  ): Promise<{
    responseTime: number;
    renderTime: number;
  }> {
    const element = this.page.locator(selector);
    
    const startTime = Date.now();
    
    switch (interaction) {
      case 'click':
        await element.click();
        break;
      case 'hover':
        await element.hover();
        break;
      case 'focus':
        await element.focus();
        break;
    }
    
    // Wait for any animations or updates
    await this.page.waitForTimeout(100);
    
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    
    // Measure rendering after interaction
    const renderMetrics = await this.measureRenderingPerformance(async () => {
      await this.page.waitForTimeout(500);
    });
    
    return {
      responseTime,
      renderTime: renderMetrics.renderTime
    };
  }

  /**
   * Profile JavaScript performance
   */
  async profileJavaScript(action: () => Promise<void>): Promise<{
    executionTime: number;
    cpuUsage: number;
  }> {
    // Start profiling
    await this.page.evaluate(() => {
      if ((performance as any).mark) {
        (performance as any).mark('profile-start');
      }
    });
    
    const startTime = Date.now();
    
    // Perform action
    await action();
    
    const endTime = Date.now();
    const executionTime = endTime - startTime;
    
    // End profiling
    const cpuMetrics = await this.page.evaluate(() => {
      if ((performance as any).mark) {
        (performance as any).mark('profile-end');
        (performance as any).measure('profile-duration', 'profile-start', 'profile-end');
        
        const measure = performance.getEntriesByName('profile-duration')[0];
        return {
          duration: measure ? measure.duration : 0
        };
      }
      
      return { duration: 0 };
    });
    
    return {
      executionTime,
      cpuUsage: cpuMetrics.duration
    };
  }

  /**
   * Test bundle size and compression
   */
  async analyzeBundleSize(): Promise<{
    totalSize: number;
    compressedSize: number;
    jsSize: number;
    cssSize: number;
    imageSize: number;
  }> {
    const resources = await this.page.evaluate(() => {
      const entries = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
      
      let totalSize = 0;
      let compressedSize = 0;
      let jsSize = 0;
      let cssSize = 0;
      let imageSize = 0;
      
      entries.forEach(entry => {
        const size = entry.transferSize || 0;
        const uncompressedSize = entry.decodedBodySize || 0;
        
        totalSize += uncompressedSize;
        compressedSize += size;
        
        if (entry.name.endsWith('.js')) {
          jsSize += uncompressedSize;
        } else if (entry.name.endsWith('.css')) {
          cssSize += uncompressedSize;
        } else if (entry.name.match(/\.(jpg|jpeg|png|gif|webp|svg)$/)) {
          imageSize += uncompressedSize;
        }
      });
      
      return {
        totalSize,
        compressedSize,
        jsSize,
        cssSize,
        imageSize
      };
    });
    
    return resources;
  }

  /**
   * Assert bundle size budgets
   */
  assertBundleBudget(
    bundleMetrics: {
      totalSize: number;
      jsSize: number;
      cssSize: number;
      imageSize: number;
    },
    budgets: {
      maxTotalSize?: number;
      maxJsSize?: number;
      maxCssSize?: number;
      maxImageSize?: number;
    }
  ): void {
    if (budgets.maxTotalSize) {
      expect(bundleMetrics.totalSize).toBeLessThan(budgets.maxTotalSize);
    }
    
    if (budgets.maxJsSize) {
      expect(bundleMetrics.jsSize).toBeLessThan(budgets.maxJsSize);
    }
    
    if (budgets.maxCssSize) {
      expect(bundleMetrics.cssSize).toBeLessThan(budgets.maxCssSize);
    }
    
    if (budgets.maxImageSize) {
      expect(bundleMetrics.imageSize).toBeLessThan(budgets.maxImageSize);
    }
  }

  /**
   * Test performance under load
   */
  async testUnderLoad(
    action: () => Promise<void>,
    iterations: number = 10
  ): Promise<{
    averageTime: number;
    minTime: number;
    maxTime: number;
    memoryIncrease: number;
  }> {
    const times: number[] = [];
    const initialMemory = await this.measureMemoryUsage();
    
    for (let i = 0; i < iterations; i++) {
      const startTime = Date.now();
      await action();
      const endTime = Date.now();
      times.push(endTime - startTime);
      
      // Small delay between iterations
      await this.page.waitForTimeout(100);
    }
    
    const finalMemory = await this.measureMemoryUsage();
    
    return {
      averageTime: times.reduce((sum, time) => sum + time, 0) / times.length,
      minTime: Math.min(...times),
      maxTime: Math.max(...times),
      memoryIncrease: finalMemory.usedJSHeapSize - initialMemory.usedJSHeapSize
    };
  }

  /**
   * Generate performance report
   */
  async generatePerformanceReport(url: string): Promise<{
    pageMetrics: any;
    resourceMetrics: any;
    bundleMetrics: any;
    memoryMetrics: any;
    recommendations: string[];
  }> {
    const pageMetrics = await this.measurePageLoad(url);
    const resourceMetrics = await this.measureResourceLoading();
    const bundleMetrics = await this.analyzeBundleSize();
    const memoryMetrics = await this.measureMemoryUsage();
    
    const recommendations: string[] = [];
    
    // Generate recommendations based on metrics
    if (pageMetrics.loadTime > 3000) {
      recommendations.push('Page load time exceeds 3 seconds. Consider optimizing critical resources.');
    }
    
    if (pageMetrics.largestContentfulPaint > 2500) {
      recommendations.push('LCP is above 2.5 seconds. Optimize largest content elements.');
    }
    
    if (pageMetrics.cumulativeLayoutShift > 0.1) {
      recommendations.push('CLS exceeds 0.1. Minimize layout shifts during page load.');
    }
    
    if (bundleMetrics.jsSize > 500000) {
      recommendations.push('JavaScript bundle size exceeds 500KB. Consider code splitting.');
    }
    
    if (resourceMetrics.slowResources.length > 0) {
      recommendations.push(`${resourceMetrics.slowResources.length} resources loading slowly. Review network requests.`);
    }
    
    return {
      pageMetrics,
      resourceMetrics,
      bundleMetrics,
      memoryMetrics,
      recommendations
    };
  }
}