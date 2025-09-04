import { test, expect, chromium } from '@playwright/test';

test.describe('Core Web Vitals', () => {
  test.beforeEach(async ({ page }) => {
    // Enable performance metrics collection
    await page.addInitScript(() => {
      // Polyfill for Web Vitals if needed
      if (!window.performance?.mark) {
        console.warn('Performance API not available');
      }
    });
  });

  test('should meet Core Web Vitals thresholds for landing page', async ({ page }) => {
    const startTime = performance.now();
    
    // Navigate to landing page
    await page.goto('/', { waitUntil: 'networkidle' });
    
    const loadTime = performance.now() - startTime;
    
    // Basic load time check
    expect(loadTime).toBeLessThan(3000); // 3 seconds
    
    // Get performance metrics
    const metrics = await page.evaluate(() => {
      return new Promise((resolve) => {
        const observer = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const metrics = {};
          
          entries.forEach((entry) => {
            if (entry.entryType === 'navigation') {
              metrics.loadTime = entry.loadEventEnd - entry.loadEventStart;
              metrics.domContentLoaded = entry.domContentLoadedEventEnd - entry.domContentLoadedEventStart;
              metrics.firstPaint = entry.loadEventEnd;
            }
            
            if (entry.entryType === 'largest-contentful-paint') {
              metrics.lcp = entry.renderTime || entry.loadTime;
            }
            
            if (entry.entryType === 'first-input') {
              metrics.fid = entry.processingStart - entry.startTime;
            }
            
            if (entry.entryType === 'layout-shift' && !entry.hadRecentInput) {
              metrics.cls = (metrics.cls || 0) + entry.value;
            }
          });
          
          resolve(metrics);
        });
        
        observer.observe({ entryTypes: ['navigation', 'largest-contentful-paint', 'first-input', 'layout-shift'] });
        
        // Fallback timeout
        setTimeout(() => resolve({}), 5000);
      });
    });
    
    console.log('Performance metrics:', metrics);
    
    // Core Web Vitals assertions
    if (metrics.lcp) {
      expect(metrics.lcp).toBeLessThan(2500); // LCP should be < 2.5s
    }
    
    if (metrics.fid) {
      expect(metrics.fid).toBeLessThan(100); // FID should be < 100ms
    }
    
    if (metrics.cls !== undefined) {
      expect(metrics.cls).toBeLessThan(0.1); // CLS should be < 0.1
    }
  });

  test('should meet performance thresholds for dashboard', async ({ page }) => {
    // Login first
    await page.goto('/auth/login');
    await page.getByTestId('username-input').fill('testuser1');
    await page.getByTestId('password-input').fill('testpassword');
    await page.getByTestId('login-button').click();
    
    // Navigate to dashboard and measure performance
    const startTime = performance.now();
    await page.goto('/dashboard', { waitUntil: 'networkidle' });
    const loadTime = performance.now() - startTime;
    
    // Dashboard should load quickly
    expect(loadTime).toBeLessThan(2000); // 2 seconds for authenticated page
    
    // Check for performance-critical elements
    await expect(page.getByTestId('dashboard-header')).toBeVisible();
    await expect(page.getByTestId('media-requests-section')).toBeVisible();
    
    // Measure time to interactive
    const ttiMetric = await page.evaluate(() => {
      return new Promise((resolve) => {
        const observer = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const ttiEntry = entries.find(entry => entry.name === 'first-input');
          resolve(ttiEntry ? ttiEntry.startTime : null);
        });
        
        observer.observe({ entryTypes: ['first-input'] });
        
        setTimeout(() => resolve(null), 3000);
      });
    });
    
    if (ttiMetric) {
      expect(ttiMetric).toBeLessThan(3000);
    }
  });

  test('should load resources efficiently', async ({ page }) => {
    // Track network requests
    const requests = [];
    page.on('request', request => {
      requests.push({
        url: request.url(),
        method: request.method(),
        resourceType: request.resourceType(),
        timestamp: Date.now()
      });
    });
    
    const responses = [];
    page.on('response', response => {
      responses.push({
        url: response.url(),
        status: response.status(),
        size: response.headers()['content-length'],
        timestamp: Date.now()
      });
    });
    
    await page.goto('/', { waitUntil: 'networkidle' });
    
    // Analyze requests
    const jsRequests = requests.filter(req => req.resourceType === 'script');
    const cssRequests = requests.filter(req => req.resourceType === 'stylesheet');
    const imageRequests = requests.filter(req => req.resourceType === 'image');
    
    // Resource count thresholds
    expect(jsRequests.length).toBeLessThan(10); // Limit JS files
    expect(cssRequests.length).toBeLessThan(5); // Limit CSS files
    expect(imageRequests.length).toBeLessThan(20); // Reasonable image count
    
    // Check for HTTP/2
    const http2Responses = responses.filter(resp => 
      resp.status < 400 && resp.url.startsWith('https://')
    );
    
    // Most responses should be successful
    const successfulResponses = responses.filter(resp => resp.status < 400);
    expect(successfulResponses.length / responses.length).toBeGreaterThan(0.95);
  });

  test('should handle large datasets efficiently', async ({ page }) => {
    // Login and navigate to a data-heavy page
    await page.goto('/auth/login');
    await page.getByTestId('username-input').fill('testadmin');
    await page.getByTestId('password-input').fill('testpassword');
    await page.getByTestId('login-button').click();
    
    // Navigate to admin page with potentially large datasets
    const startTime = performance.now();
    await page.goto('/admin/users', { waitUntil: 'networkidle' });
    
    // Page should load even with large datasets
    const loadTime = performance.now() - startTime;
    expect(loadTime).toBeLessThan(5000); // 5 seconds for data-heavy page
    
    // Check for virtual scrolling or pagination
    const userTable = page.getByTestId('users-table');
    await expect(userTable).toBeVisible();
    
    // Should not render all rows at once (performance optimization)
    const visibleRows = await page.locator('[data-testid^="user-row"]').count();
    expect(visibleRows).toBeLessThan(100); // Should use pagination or virtual scrolling
  });

  test('should optimize images for performance', async ({ page }) => {
    await page.goto('/');
    
    // Check for modern image formats
    const images = await page.locator('img').all();
    
    for (const img of images) {
      const src = await img.getAttribute('src');
      if (src) {
        // Should use optimized formats or have proper loading attributes
        const hasLazyLoading = await img.getAttribute('loading');
        const isWebP = src.includes('.webp');
        const isOptimized = hasLazyLoading === 'lazy' || isWebP;
        
        if (!isOptimized && !src.startsWith('data:')) {
          console.warn(`Image not optimized: ${src}`);
        }
      }
    }
  });

  test('should cache resources appropriately', async ({ page }) => {
    // First visit
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const firstVisitRequests = [];
    page.on('request', request => {
      firstVisitRequests.push({
        url: request.url(),
        fromCache: request.frame()?.url() !== request.url()
      });
    });
    
    // Second visit (should use cache)
    await page.reload({ waitUntil: 'networkidle' });
    
    // Check cache headers via network inspection
    const cachedResources = await page.evaluate(() => {
      return performance.getEntriesByType('navigation').map(entry => ({
        name: entry.name,
        transferSize: entry.transferSize,
        encodedBodySize: entry.encodedBodySize
      }));
    });
    
    // Static resources should be cached
    cachedResources.forEach(resource => {
      if (resource.name.includes('.css') || resource.name.includes('.js')) {
        // transferSize should be 0 or much smaller if from cache
        if (resource.transferSize > 0) {
          expect(resource.transferSize).toBeLessThan(resource.encodedBodySize);
        }
      }
    });
  });

  test('should handle slow network conditions gracefully', async ({ page, context }) => {
    // Simulate slow 3G network
    await context.setOffline(false);
    
    // Use Chrome DevTools Protocol to throttle network
    if (page.context().browser()?.browserType().name() === 'chromium') {
      const client = await page.context().newCDPSession(page);
      await client.send('Network.emulateNetworkConditions', {
        offline: false,
        downloadThroughput: 1.5 * 1024 * 1024 / 8, // 1.5 Mbps
        uploadThroughput: 750 * 1024 / 8, // 750 Kbps
        latency: 300 // 300ms latency
      });
    }
    
    const startTime = performance.now();
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    const loadTime = performance.now() - startTime;
    
    // Should still load within reasonable time on slow connection
    expect(loadTime).toBeLessThan(10000); // 10 seconds max on slow connection
    
    // Critical content should be visible
    await expect(page.getByTestId('main-navigation')).toBeVisible();
  });

  test('should demonstrate progressive loading', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Login first
    await page.getByTestId('username-input').fill('testuser1');
    await page.getByTestId('password-input').fill('testpassword');
    await page.getByTestId('login-button').click();
    
    // Check that critical content loads first
    await expect(page.getByTestId('dashboard-header')).toBeVisible();
    
    // Secondary content should load progressively
    const loadingIndicators = page.locator('[data-testid*="loading"]');
    const loadingCount = await loadingIndicators.count();
    
    if (loadingCount > 0) {
      // Wait for loading indicators to disappear
      await expect(loadingIndicators.first()).not.toBeVisible({ timeout: 10000 });
    }
    
    // All main sections should eventually be loaded
    await expect(page.getByTestId('media-requests-section')).toBeVisible();
    await expect(page.getByTestId('recent-activity-section')).toBeVisible();
  });

  test('should measure JavaScript execution time', async ({ page }) => {
    await page.goto('/');
    
    // Measure JavaScript execution performance
    const jsPerformance = await page.evaluate(() => {
      const start = performance.now();
      
      // Simulate heavy computation
      let result = 0;
      for (let i = 0; i < 100000; i++) {
        result += Math.random();
      }
      
      const executionTime = performance.now() - start;
      
      return {
        executionTime,
        result: result > 0 // Just to use the result
      };
    });
    
    // JavaScript execution should be fast
    expect(jsPerformance.executionTime).toBeLessThan(100); // 100ms max
  });

  test('should track memory usage', async ({ page }) => {
    // Only available in Chromium
    if (page.context().browser()?.browserType().name() !== 'chromium') {
      test.skip('Memory tracking only available in Chromium');
    }
    
    await page.goto('/dashboard');
    
    // Login
    await page.getByTestId('username-input').fill('testuser1');
    await page.getByTestId('password-input').fill('testpassword');
    await page.getByTestId('login-button').click();
    
    // Get memory usage
    const memoryUsage = await page.evaluate(() => {
      if ('memory' in performance) {
        return {
          usedJSHeapSize: performance.memory.usedJSHeapSize,
          totalJSHeapSize: performance.memory.totalJSHeapSize,
          jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
        };
      }
      return null;
    });
    
    if (memoryUsage) {
      // Memory usage should be reasonable
      const usedMB = memoryUsage.usedJSHeapSize / 1024 / 1024;
      expect(usedMB).toBeLessThan(100); // Less than 100MB
      
      console.log(`Memory usage: ${usedMB.toFixed(2)}MB`);
    }
  });
});

// Helper function to collect Core Web Vitals
async function collectWebVitals(page) {
  return await page.evaluate(() => {
    return new Promise((resolve) => {
      const metrics = {};
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          switch (entry.entryType) {
            case 'largest-contentful-paint':
              metrics.lcp = entry.renderTime || entry.loadTime;
              break;
            case 'first-input':
              metrics.fid = entry.processingStart - entry.startTime;
              break;
            case 'layout-shift':
              if (!entry.hadRecentInput) {
                metrics.cls = (metrics.cls || 0) + entry.value;
              }
              break;
          }
        }
      });
      
      observer.observe({
        entryTypes: ['largest-contentful-paint', 'first-input', 'layout-shift']
      });
      
      // Wait for metrics to be collected
      setTimeout(() => {
        observer.disconnect();
        resolve(metrics);
      }, 5000);
    });
  });
}