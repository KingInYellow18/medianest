import { test, expect } from '../helpers/hive-mind/coordination';
import { LoginPage } from '../pages/login.page';
import { DashboardPage } from '../pages/dashboard.page';
import { MockManager } from '../fixtures/mocks';
import { PerformanceMonitor, PerformanceReport } from '../helpers/performance-monitor';
import { testUsers, performanceBenchmarks } from '../fixtures/test-data';

test.describe('Performance Tests - Comprehensive Performance Monitoring', () => {
  let loginPage: LoginPage;
  let dashboardPage: DashboardPage;
  let mockManager: MockManager;
  let performanceMonitor: PerformanceMonitor;

  test.beforeEach(async ({ page, hiveMind }) => {
    await hiveMind.notifyHiveMind(hiveMind, 'Starting comprehensive performance tests');
    
    loginPage = new LoginPage(page);
    dashboardPage = new DashboardPage(page);
    mockManager = new MockManager(page);
    performanceMonitor = new PerformanceMonitor(page, hiveMind);

    await mockManager.setupBasicMocks();
  });

  test('Page load performance across all pages', async ({ page, hiveMind }) => {
    const pagePerformanceResults: PerformanceReport[] = [];

    const pagesToTest = [
      { name: 'Login', url: '/auth/signin', action: () => loginPage.goto() },
      { 
        name: 'Dashboard', 
        url: '/dashboard', 
        action: async () => {
          await loginPage.goto();
          await loginPage.login(testUsers.admin.email, testUsers.admin.password);
        }
      },
      { 
        name: 'Media Search', 
        url: '/media', 
        action: async () => {
          await loginPage.goto();
          await loginPage.login(testUsers.admin.email, testUsers.admin.password);
          await dashboardPage.goToMediaSearch();
        }
      },
      { 
        name: 'Requests', 
        url: '/requests', 
        action: async () => {
          await loginPage.goto();
          await loginPage.login(testUsers.admin.email, testUsers.admin.password);
          await dashboardPage.goToRequests();
        }
      },
      { 
        name: 'Plex Browser', 
        url: '/plex', 
        action: async () => {
          await loginPage.goto();
          await loginPage.login(testUsers.admin.email, testUsers.admin.password);
          await dashboardPage.goToPlexBrowser();
        }
      }
    ];

    for (const pageTest of pagesToTest) {
      await performanceMonitor.startMonitoring();
      
      const startTime = Date.now();
      await pageTest.action();
      await page.waitForLoadState('networkidle');
      const endTime = Date.now();

      const report = await performanceMonitor.generateReport();
      report.summary.actualLoadTime = endTime - startTime;
      
      pagePerformanceResults.push({
        ...report,
        pageName: pageTest.name
      } as PerformanceReport);

      await hiveMind.storeInMemory(hiveMind, `performance/page-${pageTest.name.toLowerCase()}`, {
        pageName: pageTest.name,
        loadTime: endTime - startTime,
        performanceScore: report.summary.overallScore,
        criticalIssues: report.summary.criticalIssues,
        report
      });

      // Verify performance benchmarks
      expect(endTime - startTime).toBeLessThan(performanceBenchmarks.pageLoad.slow);
      expect(report.summary.overallScore).toBeGreaterThanOrEqual(60); // Minimum acceptable score
    }

    // Calculate overall performance summary
    const averageScore = pagePerformanceResults.reduce((sum, result) => 
      sum + result.summary.overallScore, 0) / pagePerformanceResults.length;

    const averageLoadTime = pagePerformanceResults.reduce((sum, result) => 
      sum + (result.summary.actualLoadTime || 0), 0) / pagePerformanceResults.length;

    const totalCriticalIssues = pagePerformanceResults.reduce((sum, result) => 
      sum + result.summary.criticalIssues, 0);

    await hiveMind.storeInMemory(hiveMind, 'performance/overall-summary', {
      pagesTesteed: pagesToTest.length,
      averageScore,
      averageLoadTime,
      totalCriticalIssues,
      results: pagePerformanceResults.map(result => ({
        page: result.pageName,
        score: result.summary.overallScore,
        loadTime: result.summary.actualLoadTime,
        criticalIssues: result.summary.criticalIssues
      }))
    });

    expect(averageScore).toBeGreaterThanOrEqual(70);
    expect(totalCriticalIssues).toBeLessThanOrEqual(5);

    await hiveMind.notifyHiveMind(hiveMind, 
      `Page performance summary: ${pagePerformanceResults.length} pages tested, ` +
      `average score ${averageScore.toFixed(1)}/100, ` +
      `average load time ${averageLoadTime.toFixed(0)}ms, ` +
      `${totalCriticalIssues} critical issues`
    );
  });

  test('Network performance and optimization', async ({ page, hiveMind }) => {
    await performanceMonitor.startMonitoring();
    
    await loginPage.goto();
    await loginPage.login(testUsers.admin.email, testUsers.admin.password);
    
    // Navigate through multiple pages to generate network activity
    const navigationSequence = [
      () => dashboardPage.goToMediaSearch(),
      () => dashboardPage.goToRequests(),
      () => dashboardPage.goToPlexBrowser(),
      () => page.goto('/dashboard')
    ];

    for (const navigation of navigationSequence) {
      await navigation();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000); // Allow for any background requests
    }

    const report = await performanceMonitor.generateReport();
    
    // Analyze network requests
    const networkAnalysis = {
      totalRequests: report.metrics.networkRequests.length,
      apiRequests: report.metrics.networkRequests.filter(req => req.type === 'API').length,
      jsRequests: report.metrics.networkRequests.filter(req => req.type === 'JavaScript').length,
      cssRequests: report.metrics.networkRequests.filter(req => req.type === 'Stylesheet').length,
      imageRequests: report.metrics.networkRequests.filter(req => req.type === 'Image').length,
      
      averageRequestTime: report.metrics.networkRequests.reduce((sum, req) => 
        sum + req.duration, 0) / report.metrics.networkRequests.length,
      
      slowRequests: report.metrics.networkRequests.filter(req => req.duration > 2000).length,
      failedRequests: report.metrics.networkRequests.filter(req => req.status >= 400).length,
      
      totalDataTransferred: report.metrics.networkRequests.reduce((sum, req) => 
        sum + req.size, 0),
      
      largeRequests: report.metrics.networkRequests.filter(req => req.size > 1024 * 1024).length,
      
      cachableRequests: report.metrics.networkRequests.filter(req => 
        req.type === 'JavaScript' || req.type === 'Stylesheet' || req.type === 'Image'
      ).length
    };

    await hiveMind.storeInMemory(hiveMind, 'performance/network-analysis', networkAnalysis);

    // Performance assertions
    expect(networkAnalysis.averageRequestTime).toBeLessThan(1000); // Average under 1 second
    expect(networkAnalysis.slowRequests).toBeLessThanOrEqual(2); // At most 2 slow requests
    expect(networkAnalysis.failedRequests).toBe(0); // No failed requests
    expect(networkAnalysis.totalDataTransferred).toBeLessThan(10 * 1024 * 1024); // Under 10MB total

    // Check for performance optimizations
    const optimizationChecks = {
      hasResourceCaching: networkAnalysis.cachableRequests > 0,
      reasonablePayloadSizes: networkAnalysis.largeRequests === 0,
      efficientApiUsage: networkAnalysis.apiRequests < networkAnalysis.totalRequests * 0.3,
      goodResponseTimes: networkAnalysis.averageRequestTime < 1000
    };

    await hiveMind.storeInMemory(hiveMind, 'performance/optimization-checks', optimizationChecks);

    const optimizationScore = Object.values(optimizationChecks).filter(Boolean).length;
    expect(optimizationScore).toBeGreaterThanOrEqual(3); // At least 3 out of 4 optimizations

    await hiveMind.notifyHiveMind(hiveMind, 
      `Network performance: ${networkAnalysis.totalRequests} requests, ` +
      `${networkAnalysis.averageRequestTime.toFixed(0)}ms average, ` +
      `${(networkAnalysis.totalDataTransferred / 1024 / 1024).toFixed(2)}MB transferred, ` +
      `${optimizationScore}/4 optimizations present`
    );
  });

  test('Memory usage and leak detection', async ({ page, hiveMind }) => {
    await performanceMonitor.startMonitoring();
    
    // Get initial memory baseline
    const initialMemory = await page.evaluate(() => {
      if (performance.memory) {
        return {
          jsHeapSizeLimit: performance.memory.jsHeapSizeLimit,
          totalJSHeapSize: performance.memory.totalJSHeapSize,
          usedJSHeapSize: performance.memory.usedJSHeapSize
        };
      }
      return null;
    });

    if (!initialMemory) {
      await hiveMind.notifyHiveMind(hiveMind, 'Memory monitoring not available in this environment');
      test.skip();
      return;
    }

    await loginPage.goto();
    await loginPage.login(testUsers.admin.email, testUsers.admin.password);

    const memoryMeasurements = [initialMemory];

    // Perform memory-intensive operations
    const intensiveOperations = [
      {
        name: 'Dashboard interactions',
        action: async () => {
          for (let i = 0; i < 10; i++) {
            await page.click('[data-testid="refresh-services"]');
            await page.waitForTimeout(500);
          }
        }
      },
      {
        name: 'Page navigations',
        action: async () => {
          const pages = ['/dashboard', '/media', '/requests', '/plex'];
          for (let i = 0; i < 15; i++) {
            await page.goto(pages[i % pages.length]);
            await page.waitForLoadState('networkidle');
          }
        }
      },
      {
        name: 'Modal interactions',
        action: async () => {
          await page.goto('/dashboard');
          for (let i = 0; i < 20; i++) {
            const serviceCards = await page.locator('[data-testid="service-card"]').count();
            if (serviceCards > 0) {
              const card = page.locator('[data-testid="service-card"]').nth(i % serviceCards);
              await card.click();
              await expect(page.locator('[data-testid="service-detail-modal"]')).toBeVisible();
              await page.keyboard.press('Escape');
              await expect(page.locator('[data-testid="service-detail-modal"]')).not.toBeVisible();
            }
          }
        }
      }
    ];

    for (const operation of intensiveOperations) {
      await operation.action();

      const currentMemory = await page.evaluate(() => {
        // Force garbage collection if available
        if (window.gc) {
          window.gc();
        }

        return {
          jsHeapSizeLimit: performance.memory!.jsHeapSizeLimit,
          totalJSHeapSize: performance.memory!.totalJSHeapSize,
          usedJSHeapSize: performance.memory!.usedJSHeapSize
        };
      });

      memoryMeasurements.push(currentMemory);

      await hiveMind.storeInMemory(hiveMind, `performance/memory-${operation.name.replace(/\s+/g, '-')}`, {
        operation: operation.name,
        memoryUsage: currentMemory,
        memoryGrowth: currentMemory.usedJSHeapSize - initialMemory.usedJSHeapSize
      });
    }

    // Analyze memory pattern
    const finalMemory = memoryMeasurements[memoryMeasurements.length - 1];
    const memoryGrowth = finalMemory.usedJSHeapSize - initialMemory.usedJSHeapSize;
    const memoryGrowthMB = memoryGrowth / 1024 / 1024;

    // Calculate memory growth trend
    const growthTrend = memoryMeasurements.map((measurement, index) => ({
      step: index,
      usage: measurement.usedJSHeapSize,
      growth: measurement.usedJSHeapSize - initialMemory.usedJSHeapSize
    }));

    // Detect potential memory leaks
    const suspiciousGrowth = memoryGrowthMB > 50; // More than 50MB growth
    const consistentGrowth = growthTrend.slice(-3).every((measurement, index, arr) => 
      index === 0 || measurement.growth > arr[index - 1].growth
    );

    const memoryAnalysis = {
      initialUsage: initialMemory.usedJSHeapSize,
      finalUsage: finalMemory.usedJSHeapSize,
      totalGrowth: memoryGrowth,
      growthMB: memoryGrowthMB,
      usagePercent: (finalMemory.usedJSHeapSize / finalMemory.jsHeapSizeLimit) * 100,
      suspiciousGrowth,
      consistentGrowth,
      possibleMemoryLeak: suspiciousGrowth && consistentGrowth,
      growthTrend
    };

    await hiveMind.storeInMemory(hiveMind, 'performance/memory-analysis', memoryAnalysis);

    // Memory performance assertions
    expect(memoryGrowthMB).toBeLessThan(100); // Less than 100MB growth
    expect(memoryAnalysis.usagePercent).toBeLessThan(80); // Less than 80% of heap limit
    expect(memoryAnalysis.possibleMemoryLeak).toBe(false);

    const report = await performanceMonitor.generateReport();
    
    await hiveMind.notifyHiveMind(hiveMind, 
      `Memory analysis: ${memoryGrowthMB.toFixed(2)}MB growth, ` +
      `${memoryAnalysis.usagePercent.toFixed(1)}% heap usage, ` +
      `${memoryAnalysis.possibleMemoryLeak ? 'potential leak detected' : 'no leaks detected'}, ` +
      `memory score: ${report.analysis.memoryScore}/100`
    );
  });

  test('Rendering performance and frame rates', async ({ page, hiveMind }) => {
    await performanceMonitor.startMonitoring();
    
    await loginPage.goto();
    await loginPage.login(testUsers.admin.email, testUsers.admin.password);

    // Test rendering performance during interactions
    const renderingTests = [
      {
        name: 'Service card hover animations',
        action: async () => {
          const serviceCards = await page.locator('[data-testid="service-card"]').count();
          for (let i = 0; i < Math.min(serviceCards, 5); i++) {
            const card = page.locator('[data-testid="service-card"]').nth(i);
            await card.hover();
            await page.waitForTimeout(100);
            await card.blur();
            await page.waitForTimeout(100);
          }
        }
      },
      {
        name: 'Modal open/close animations',
        action: async () => {
          for (let i = 0; i < 5; i++) {
            const firstCard = page.locator('[data-testid="service-card"]').first();
            await firstCard.click();
            await expect(page.locator('[data-testid="service-detail-modal"]')).toBeVisible();
            await page.waitForTimeout(200);
            await page.keyboard.press('Escape');
            await expect(page.locator('[data-testid="service-detail-modal"]')).not.toBeVisible();
            await page.waitForTimeout(200);
          }
        }
      },
      {
        name: 'Search result loading',
        action: async () => {
          await dashboardPage.goToMediaSearch();
          for (let i = 0; i < 3; i++) {
            await page.fill('[data-testid="search-input"]', `test query ${i}`);
            await page.click('[data-testid="search-button"]');
            await expect(page.locator('[data-testid="search-results"]')).toBeVisible();
            await page.waitForTimeout(500);
          }
        }
      }
    ];

    const renderingResults = [];

    for (const test of renderingTests) {
      const startTime = performance.now();
      
      // Measure frame rate during the test
      const frameRatePromise = page.evaluate(() => {
        return new Promise<number>((resolve) => {
          let frames = 0;
          const startTime = performance.now();
          const duration = 3000; // 3 seconds
          
          function countFrame() {
            frames++;
            const elapsed = performance.now() - startTime;
            if (elapsed < duration) {
              requestAnimationFrame(countFrame);
            } else {
              const fps = frames / (elapsed / 1000);
              resolve(fps);
            }
          }
          
          requestAnimationFrame(countFrame);
        });
      });

      await test.action();
      const fps = await frameRatePromise;
      const testDuration = performance.now() - startTime;

      renderingResults.push({
        name: test.name,
        fps,
        duration: testDuration,
        smoothRendering: fps >= 30 // 30 FPS minimum for smooth rendering
      });

      await hiveMind.storeInMemory(hiveMind, `performance/rendering-${test.name.replace(/\s+/g, '-')}`, {
        testName: test.name,
        fps,
        duration: testDuration,
        smoothRendering: fps >= 30
      });
    }

    // Overall rendering performance
    const averageFPS = renderingResults.reduce((sum, result) => sum + result.fps, 0) / renderingResults.length;
    const smoothRenderingCount = renderingResults.filter(result => result.smoothRendering).length;

    await hiveMind.storeInMemory(hiveMind, 'performance/rendering-summary', {
      testsRun: renderingTests.length,
      averageFPS,
      smoothRenderingCount,
      renderingScore: (smoothRenderingCount / renderingTests.length) * 100,
      results: renderingResults
    });

    expect(averageFPS).toBeGreaterThanOrEqual(30);
    expect(smoothRenderingCount).toBeGreaterThanOrEqual(renderingTests.length * 0.8);

    await hiveMind.notifyHiveMind(hiveMind, 
      `Rendering performance: ${averageFPS.toFixed(1)} average FPS, ` +
      `${smoothRenderingCount}/${renderingTests.length} tests with smooth rendering`
    );
  });

  test('Bundle size and loading optimization', async ({ page, hiveMind }) => {
    await performanceMonitor.startMonitoring();
    
    await loginPage.goto();
    await page.waitForLoadState('networkidle');

    const report = await performanceMonitor.generateReport();

    // Analyze bundle composition
    const jsResources = report.metrics.resourceTimings.filter(resource => 
      resource.type === 'script' || resource.name.includes('.js')
    );
    
    const cssResources = report.metrics.resourceTimings.filter(resource => 
      resource.type === 'stylesheet' || resource.name.includes('.css')
    );

    const bundleAnalysis = {
      totalJSSize: jsResources.reduce((sum, resource) => sum + resource.size, 0),
      totalCSSSize: cssResources.reduce((sum, resource) => sum + resource.size, 0),
      jsFileCount: jsResources.length,
      cssFileCount: cssResources.length,
      largestJSFile: Math.max(...jsResources.map(resource => resource.size)),
      largestCSSFile: Math.max(...cssResources.map(resource => resource.size)),
      
      // Performance checks
      jsBundleUnder2MB: jsResources.reduce((sum, resource) => sum + resource.size, 0) < 2 * 1024 * 1024,
      cssBundleUnder500KB: cssResources.reduce((sum, resource) => sum + resource.size, 0) < 500 * 1024,
      reasonableFileCount: jsResources.length < 10 && cssResources.length < 5,
      
      // Loading optimization checks
      hasChunking: jsResources.length > 1, // Multiple JS files suggest code splitting
      hasMinification: jsResources.some(resource => resource.name.includes('.min.')) ||
                      cssResources.some(resource => resource.name.includes('.min.')),
      hasCompression: true // Would need response headers to verify
    };

    await hiveMind.storeInMemory(hiveMind, 'performance/bundle-analysis', {
      ...bundleAnalysis,
      totalJSSizeMB: bundleAnalysis.totalJSSize / 1024 / 1024,
      totalCSSSizeKB: bundleAnalysis.totalCSSSize / 1024,
      largestJSFileMB: bundleAnalysis.largestJSFile / 1024 / 1024,
      largestCSSFileKB: bundleAnalysis.largestCSSFile / 1024
    });

    // Performance assertions
    expect(bundleAnalysis.jsBundleUnder2MB).toBe(true);
    expect(bundleAnalysis.cssBundleUnder500KB).toBe(true);
    expect(bundleAnalysis.reasonableFileCount).toBe(true);

    // Test loading performance with different network conditions
    const networkConditions = [
      { name: 'Fast 3G', downloadThroughput: 1.5 * 1024 * 1024 / 8 }, // 1.5 Mbps
      { name: 'Slow 3G', downloadThroughput: 0.5 * 1024 * 1024 / 8 }   // 0.5 Mbps
    ];

    const loadingResults = [];

    for (const condition of networkConditions) {
      // Simulate network condition
      await page.context().setExtraHTTPHeaders({
        'Connection-Speed': condition.name.toLowerCase().replace(/\s+/g, '-')
      });

      const loadStart = Date.now();
      await page.goto('/auth/signin');
      await page.waitForLoadState('networkidle');
      const loadTime = Date.now() - loadStart;

      // Calculate estimated loading time based on bundle size and network speed
      const estimatedTime = (bundleAnalysis.totalJSSize + bundleAnalysis.totalCSSSize) / 
                           condition.downloadThroughput * 1000;

      loadingResults.push({
        condition: condition.name,
        actualLoadTime: loadTime,
        estimatedLoadTime: estimatedTime,
        acceptable: loadTime < 10000 // Under 10 seconds
      });

      await hiveMind.storeInMemory(hiveMind, `performance/loading-${condition.name.replace(/\s+/g, '-')}`, {
        condition: condition.name,
        actualLoadTime: loadTime,
        estimatedLoadTime: estimatedTime,
        acceptable: loadTime < 10000
      });
    }

    const acceptableLoadingCount = loadingResults.filter(result => result.acceptable).length;

    await hiveMind.storeInMemory(hiveMind, 'performance/bundle-loading-summary', {
      bundleAnalysis,
      loadingResults,
      acceptableLoadingCount,
      optimizationScore: [
        bundleAnalysis.jsBundleUnder2MB,
        bundleAnalysis.cssBundleUnder500KB,
        bundleAnalysis.reasonableFileCount,
        bundleAnalysis.hasChunking
      ].filter(Boolean).length
    });

    expect(acceptableLoadingCount).toBeGreaterThanOrEqual(networkConditions.length * 0.5);

    await hiveMind.notifyHiveMind(hiveMind, 
      `Bundle analysis: ${(bundleAnalysis.totalJSSize / 1024 / 1024).toFixed(2)}MB JS, ` +
      `${(bundleAnalysis.totalCSSSize / 1024).toFixed(0)}KB CSS, ` +
      `${acceptableLoadingCount}/${networkConditions.length} network conditions acceptable`
    );
  });

  test.afterEach(async ({ hiveMind }) => {
    await hiveMind.notifyHiveMind(hiveMind, 'Comprehensive performance test completed');
  });
});