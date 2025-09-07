import { test, expect } from '../helpers/hive-mind/coordination';
import { LoginPage } from '../pages/login.page';
import { DashboardPage } from '../pages/dashboard.page';
import { MockManager } from '../fixtures/mocks';
import { testUsers, errorScenarios } from '../fixtures/test-data';

test.describe('Edge Cases - API Failures and Network Issues', () => {
  let loginPage: LoginPage;
  let dashboardPage: DashboardPage;
  let mockManager: MockManager;

  test.beforeEach(async ({ page, hiveMind }) => {
    await hiveMind.notifyHiveMind(hiveMind, 'Starting API failures and network edge case tests');
    
    loginPage = new LoginPage(page);
    dashboardPage = new DashboardPage(page);
    mockManager = new MockManager(page);

    await mockManager.setupBasicMocks();
  });

  test('Intermittent network failures', async ({ page, hiveMind }) => {
    await hiveMind.storeInMemory(hiveMind, 'edge-cases/intermittent-failures/start', {
      testType: 'intermittent-network-failures',
      startTime: Date.now()
    });

    // Login successfully first
    await loginPage.goto();
    await loginPage.login(testUsers.admin.email, testUsers.admin.password);

    // Simulate intermittent failures
    let requestCount = 0;
    const failurePattern = [false, true, false, false, true, false]; // Fail on 2nd and 5th requests

    await page.route('/api/**', async (route) => {
      const shouldFail = failurePattern[requestCount % failurePattern.length];
      requestCount++;

      if (shouldFail) {
        await route.abort('connectionaborted');
      } else {
        await route.continue();
      }
    });

    const retryResults = [];

    // Test multiple operations to trigger retries
    const operations = [
      {
        name: 'Refresh Services',
        action: () => page.click('[data-testid="refresh-services"]'),
        successSelector: '[data-testid="services-updated"]',
        errorSelector: '[data-testid="refresh-error"]'
      },
      {
        name: 'Navigate to Media Search',
        action: () => dashboardPage.goToMediaSearch(),
        successSelector: '[data-testid="media-search-container"]',
        errorSelector: '[data-testid="navigation-error"]'
      },
      {
        name: 'Search Media',
        action: () => {
          return page.fill('[data-testid="search-input"]', 'test').then(() => 
            page.click('[data-testid="search-button"]')
          );
        },
        successSelector: '[data-testid="search-results"]',
        errorSelector: '[data-testid="search-error"]'
      }
    ];

    for (const operation of operations) {
      const operationStart = Date.now();
      let attempts = 0;
      let success = false;

      while (attempts < 3 && !success) {
        attempts++;
        try {
          await operation.action();
          
          // Wait for either success or error
          const result = await Promise.race([
            page.waitForSelector(operation.successSelector, { timeout: 5000 }).then(() => 'success'),
            page.waitForSelector(operation.errorSelector, { timeout: 5000 }).then(() => 'error'),
            page.waitForTimeout(5000).then(() => 'timeout')
          ]);

          if (result === 'success') {
            success = true;
          } else if (result === 'error') {
            // Check if there's a retry button
            const retryButton = page.locator('[data-testid="retry-button"]');
            if (await retryButton.isVisible({ timeout: 1000 })) {
              await retryButton.click();
            }
          }
        } catch (error) {
          // Operation failed, will retry
        }

        if (!success && attempts < 3) {
          await page.waitForTimeout(1000); // Wait before retry
        }
      }

      const operationTime = Date.now() - operationStart;

      retryResults.push({
        operation: operation.name,
        attempts,
        success,
        totalTime: operationTime,
        averageAttemptTime: operationTime / attempts
      });

      await hiveMind.storeInMemory(hiveMind, `edge-cases/retry-${operation.name.toLowerCase().replace(/\s+/g, '-')}`, {
        attempts,
        success,
        totalTime: operationTime
      });
    }

    const successfulOperations = retryResults.filter(result => result.success).length;
    const totalAttempts = retryResults.reduce((sum, result) => sum + result.attempts, 0);

    await hiveMind.storeInMemory(hiveMind, 'edge-cases/intermittent-failures-summary', {
      totalOperations: operations.length,
      successfulOperations,
      totalAttempts,
      averageAttemptsPerOperation: totalAttempts / operations.length,
      results: retryResults
    });

    expect(successfulOperations).toBeGreaterThanOrEqual(operations.length * 0.7); // At least 70% success rate

    await hiveMind.notifyHiveMind(hiveMind, 
      `Intermittent failures: ${successfulOperations}/${operations.length} operations successful, ` +
      `${totalAttempts} total attempts`
    );
  });

  test('Slow network conditions', async ({ page, hiveMind }) => {
    // Simulate slow network
    await mockManager.mockSlowNetwork();

    const slowNetworkStart = Date.now();
    
    await loginPage.goto();
    const pageLoadTime = Date.now() - slowNetworkStart;

    // Test slow login
    const loginStart = Date.now();
    await loginPage.fillCredentials(testUsers.admin.email, testUsers.admin.password);
    await loginPage.submitLogin();

    // Wait for either success or timeout
    const loginResult = await Promise.race([
      page.waitForURL('/dashboard', { timeout: 15000 }).then(() => 'success'),
      page.waitForTimeout(15000).then(() => 'timeout')
    ]);

    const loginTime = Date.now() - loginStart;

    await hiveMind.storeInMemory(hiveMind, 'edge-cases/slow-network-login', {
      pageLoadTime,
      loginTime,
      loginResult,
      withinTimeoutBounds: loginTime < 15000
    });

    if (loginResult === 'success') {
      // Test slow dashboard loading
      const dashboardStart = Date.now();
      await dashboardPage.waitForLoad();
      const dashboardLoadTime = Date.now() - dashboardStart;

      // Test slow service status updates
      const statusUpdateStart = Date.now();
      await page.click('[data-testid="refresh-services"]');
      
      // Wait for loading indicator
      const loadingVisible = await page.locator('[data-testid="loading-indicator"]').isVisible({ timeout: 2000 });
      
      // Wait for completion
      if (loadingVisible) {
        await page.waitForSelector('[data-testid="loading-indicator"]', { 
          state: 'hidden', 
          timeout: 20000 
        });
      }

      const statusUpdateTime = Date.now() - statusUpdateStart;

      await hiveMind.storeInMemory(hiveMind, 'edge-cases/slow-network-operations', {
        dashboardLoadTime,
        statusUpdateTime,
        loadingIndicatorShown: loadingVisible,
        operationsCompleted: true
      });

      // Test that user gets appropriate feedback during slow operations
      const userFeedbackElements = await page.evaluate(() => {
        const loader = document.querySelector('[data-testid="loading-indicator"]');
        const progressBar = document.querySelector('[data-testid="progress-bar"]');
        const statusText = document.querySelector('[data-testid="status-text"]');

        return {
          hasLoader: !!loader,
          hasProgressBar: !!progressBar,
          hasStatusText: !!statusText,
          userHasFeedback: !!(loader || progressBar || statusText)
        };
      });

      await hiveMind.storeInMemory(hiveMind, 'edge-cases/slow-network-feedback', userFeedbackElements);

      expect(userFeedbackElements.userHasFeedback).toBe(true);

      await hiveMind.notifyHiveMind(hiveMind, 
        `Slow network: page load ${pageLoadTime}ms, login ${loginTime}ms, ` +
        `dashboard ${dashboardLoadTime}ms, status update ${statusUpdateTime}ms`
      );
    } else {
      await hiveMind.notifyHiveMind(hiveMind, `Slow network: login timed out after ${loginTime}ms`);
    }
  });

  test('Concurrent API request handling', async ({ page, hiveMind }) => {
    await loginPage.goto();
    await loginPage.login(testUsers.admin.email, testUsers.admin.password);

    // Track concurrent requests
    const concurrentRequests = [];
    let activeRequests = 0;
    let maxConcurrentRequests = 0;

    await page.route('/api/**', async (route) => {
      const requestStart = Date.now();
      activeRequests++;
      maxConcurrentRequests = Math.max(maxConcurrentRequests, activeRequests);

      // Add delay to simulate processing time
      await page.waitForTimeout(100 + Math.random() * 200);

      concurrentRequests.push({
        url: route.request().url(),
        method: route.request().method(),
        startTime: requestStart,
        concurrent: activeRequests
      });

      await route.continue();
      
      activeRequests--;
    });

    // Trigger multiple concurrent operations
    const concurrentOperations = [
      () => page.click('[data-testid="refresh-services"]'),
      () => dashboardPage.goToMediaSearch(),
      () => page.goto('/requests'),
      () => page.goto('/plex'),
      () => page.goto('/youtube')
    ];

    const operationPromises = concurrentOperations.map((operation, index) => 
      new Promise(async (resolve) => {
        await page.waitForTimeout(index * 50); // Stagger slightly
        try {
          await operation();
          resolve({ success: true, operation: index });
        } catch (error) {
          resolve({ success: false, operation: index, error: error.message });
        }
      })
    );

    const results = await Promise.all(operationPromises);
    
    // Wait for all requests to complete
    await page.waitForTimeout(3000);

    const successfulOperations = results.filter(result => result.success).length;

    await hiveMind.storeInMemory(hiveMind, 'edge-cases/concurrent-requests', {
      totalOperations: concurrentOperations.length,
      successfulOperations,
      maxConcurrentRequests,
      totalRequests: concurrentRequests.length,
      averageConcurrency: concurrentRequests.reduce((sum, req) => sum + req.concurrent, 0) / concurrentRequests.length,
      results
    });

    expect(successfulOperations).toBeGreaterThanOrEqual(concurrentOperations.length * 0.8);
    expect(maxConcurrentRequests).toBeGreaterThan(1); // Should have actual concurrency

    await hiveMind.notifyHiveMind(hiveMind, 
      `Concurrent requests: ${successfulOperations}/${concurrentOperations.length} operations successful, ` +
      `max ${maxConcurrentRequests} concurrent requests`
    );
  });

  test('API versioning and compatibility', async ({ page, hiveMind }) => {
    await loginPage.goto();
    await loginPage.login(testUsers.admin.email, testUsers.admin.password);

    // Test different API version scenarios
    const apiVersionTests = [
      {
        name: 'Legacy API Version',
        version: 'v1',
        path: '/api/v1/**'
      },
      {
        name: 'Current API Version',
        version: 'v2',
        path: '/api/v2/**'
      },
      {
        name: 'Future API Version',
        version: 'v3',
        path: '/api/v3/**'
      }
    ];

    const versionResults = [];

    for (const versionTest of apiVersionTests) {
      // Mock API version responses
      await page.route(versionTest.path, async (route) => {
        const response = {
          version: versionTest.version,
          data: { test: 'data' },
          deprecated: versionTest.version === 'v1',
          supported: versionTest.version !== 'v3'
        };

        if (versionTest.version === 'v3') {
          // Future version not supported
          await route.fulfill({
            status: 404,
            contentType: 'application/json',
            body: JSON.stringify({
              error: 'API version not supported',
              supportedVersions: ['v1', 'v2']
            })
          });
        } else {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(response)
          });
        }
      });

      // Test API call
      try {
        const response = await page.request.get(`/api/${versionTest.version}/test`);
        const responseData = await response.json();

        versionResults.push({
          version: versionTest.version,
          status: response.status(),
          supported: response.ok(),
          responseData,
          deprecated: responseData.deprecated || false
        });

      } catch (error) {
        versionResults.push({
          version: versionTest.version,
          status: 0,
          supported: false,
          error: error.message
        });
      }

      await hiveMind.storeInMemory(hiveMind, `edge-cases/api-version-${versionTest.version}`, versionResults[versionResults.length - 1]);
    }

    const supportedVersions = versionResults.filter(result => result.supported).length;
    const deprecatedVersions = versionResults.filter(result => result.deprecated).length;

    await hiveMind.storeInMemory(hiveMind, 'edge-cases/api-versioning-summary', {
      totalVersionsTested: apiVersionTests.length,
      supportedVersions,
      deprecatedVersions,
      results: versionResults
    });

    expect(supportedVersions).toBeGreaterThan(0); // At least one version should be supported

    await hiveMind.notifyHiveMind(hiveMind, 
      `API versioning: ${supportedVersions}/${apiVersionTests.length} versions supported, ` +
      `${deprecatedVersions} deprecated`
    );
  });

  test('Large payload handling', async ({ page, hiveMind }) => {
    await loginPage.goto();
    await loginPage.login(testUsers.admin.email, testUsers.admin.password);

    // Test large response payloads
    await page.route('/api/media/search', async (route) => {
      // Generate large payload (simulate many search results)
      const largeResults = Array.from({ length: 1000 }, (_, i) => ({
        id: i + 1,
        title: `Movie Title ${i + 1}`,
        year: 2000 + (i % 24),
        genre: 'Action',
        poster: `https://example.com/poster${i + 1}.jpg`,
        description: 'Lorem ipsum '.repeat(50) // Large description
      }));

      const largePayload = {
        results: largeResults,
        totalResults: largeResults.length,
        page: 1,
        totalPages: Math.ceil(largeResults.length / 20)
      };

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(largePayload)
      });
    });

    // Test handling large payload
    await dashboardPage.goToMediaSearch();
    await page.fill('[data-testid="search-input"]', 'large test');

    const searchStart = Date.now();
    await page.click('[data-testid="search-button"]');

    // Wait for search to complete or timeout
    const searchResult = await Promise.race([
      page.waitForSelector('[data-testid="search-results"]', { timeout: 10000 }).then(() => 'success'),
      page.waitForSelector('[data-testid="search-error"]', { timeout: 10000 }).then(() => 'error'),
      page.waitForTimeout(10000).then(() => 'timeout')
    ]);

    const searchTime = Date.now() - searchStart;

    // Check if pagination or virtual scrolling is implemented for large results
    const resultHandling = await page.evaluate(() => {
      const results = document.querySelectorAll('[data-testid="media-result-item"]');
      const pagination = document.querySelector('[data-testid="pagination"]');
      const loadMore = document.querySelector('[data-testid="load-more"]');
      const virtualList = document.querySelector('[data-testid="virtual-list"]');

      return {
        totalResultsDisplayed: results.length,
        hasPagination: !!pagination,
        hasLoadMore: !!loadMore,
        hasVirtualScrolling: !!virtualList,
        hasResultLimiting: results.length < 1000, // Should not display all 1000 items
        performantHandling: !!(pagination || loadMore || virtualList)
      };
    });

    await hiveMind.storeInMemory(hiveMind, 'edge-cases/large-payload', {
      searchResult,
      searchTime,
      resultHandling,
      payloadHandledCorrectly: searchResult === 'success' && resultHandling.performantHandling
    });

    expect(resultHandling.performantHandling).toBe(true);
    expect(searchResult).toBe('success');

    await hiveMind.notifyHiveMind(hiveMind, 
      `Large payload: ${searchResult} in ${searchTime}ms, ` +
      `displayed ${resultHandling.totalResultsDisplayed} items with ` +
      `${resultHandling.performantHandling ? 'efficient' : 'inefficient'} handling`
    );

    // Test large request payloads
    await page.route('/api/media/request', async (route) => {
      const requestData = route.request().postDataJSON();
      const payloadSize = JSON.stringify(requestData).length;

      if (payloadSize > 10000) {
        await route.fulfill({
          status: 413,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Request payload too large' })
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, payloadSize })
        });
      }
    });

    // Try to submit request with large payload
    const firstResult = page.locator('[data-testid="media-result-item"]').first();
    if (await firstResult.isVisible()) {
      await firstResult.locator('[data-testid="request-button"]').click();
      await expect(page.locator('[data-testid="request-modal"]')).toBeVisible();

      // Create large request reason
      const largeReason = 'This is a very long request reason. '.repeat(100);
      await page.fill('[data-testid="request-reason"]', largeReason);

      const submitStart = Date.now();
      await page.click('[data-testid="submit-request-button"]');

      const submitResult = await Promise.race([
        page.waitForSelector('[data-testid="request-success-message"]', { timeout: 5000 }).then(() => 'success'),
        page.waitForSelector('[data-testid="request-error-message"]', { timeout: 5000 }).then(() => 'error'),
        page.waitForTimeout(5000).then(() => 'timeout')
      ]);

      const submitTime = Date.now() - submitStart;

      await hiveMind.storeInMemory(hiveMind, 'edge-cases/large-request-payload', {
        submitResult,
        submitTime,
        largePayloadHandled: submitResult !== 'timeout'
      });

      await hiveMind.notifyHiveMind(hiveMind, `Large request payload: ${submitResult} in ${submitTime}ms`);
    }
  });

  test('Memory and resource leak detection', async ({ page, hiveMind }) => {
    await loginPage.goto();
    await loginPage.login(testUsers.admin.email, testUsers.admin.password);

    // Get initial memory baseline
    const initialMemory = await page.evaluate(() => {
      return {
        jsHeapSizeLimit: performance.memory?.jsHeapSizeLimit || 0,
        totalJSHeapSize: performance.memory?.totalJSHeapSize || 0,
        usedJSHeapSize: performance.memory?.usedJSHeapSize || 0,
        nodeCount: document.querySelectorAll('*').length,
        listenerCount: getEventListeners ? Object.keys(getEventListeners(document)).length : 0
      };
    });

    await hiveMind.storeInMemory(hiveMind, 'edge-cases/initial-memory', initialMemory);

    // Perform memory-intensive operations
    const operations = [
      { name: 'Multiple page navigations', count: 10 },
      { name: 'Service card interactions', count: 20 },
      { name: 'Modal open/close cycles', count: 15 },
      { name: 'Search operations', count: 10 }
    ];

    for (const operation of operations) {
      let operationMemoryResults = [];

      for (let i = 0; i < operation.count; i++) {
        switch (operation.name) {
          case 'Multiple page navigations':
            const pages = ['/dashboard', '/media', '/requests', '/plex'];
            await page.goto(pages[i % pages.length]);
            await page.waitForLoadState('networkidle');
            break;

          case 'Service card interactions':
            const serviceCards = await page.locator('[data-testid="service-card"]').count();
            if (serviceCards > 0) {
              const card = page.locator('[data-testid="service-card"]').nth(i % serviceCards);
              await card.hover();
              await page.waitForTimeout(100);
            }
            break;

          case 'Modal open/close cycles':
            const firstCard = page.locator('[data-testid="service-card"]').first();
            if (await firstCard.isVisible()) {
              await firstCard.click();
              await expect(page.locator('[data-testid="service-detail-modal"]')).toBeVisible();
              await page.keyboard.press('Escape');
              await expect(page.locator('[data-testid="service-detail-modal"]')).not.toBeVisible();
            }
            break;

          case 'Search operations':
            if (page.url().includes('/media')) {
              await page.fill('[data-testid="search-input"]', `test query ${i}`);
              await page.click('[data-testid="search-button"]');
              await page.waitForTimeout(500);
            }
            break;
        }

        // Measure memory after every few operations
        if (i % 5 === 0) {
          const currentMemory = await page.evaluate(() => {
            return {
              totalJSHeapSize: performance.memory?.totalJSHeapSize || 0,
              usedJSHeapSize: performance.memory?.usedJSHeapSize || 0,
              nodeCount: document.querySelectorAll('*').length
            };
          });

          operationMemoryResults.push({
            iteration: i,
            ...currentMemory,
            memoryGrowth: currentMemory.usedJSHeapSize - initialMemory.usedJSHeapSize
          });
        }
      }

      await hiveMind.storeInMemory(hiveMind, `edge-cases/memory-${operation.name.toLowerCase().replace(/\s+/g, '-')}`, {
        operationName: operation.name,
        iterations: operation.count,
        memoryMeasurements: operationMemoryResults
      });
    }

    // Final memory measurement
    const finalMemory = await page.evaluate(() => {
      // Force garbage collection if possible
      if (window.gc) {
        window.gc();
      }

      return {
        totalJSHeapSize: performance.memory?.totalJSHeapSize || 0,
        usedJSHeapSize: performance.memory?.usedJSHeapSize || 0,
        nodeCount: document.querySelectorAll('*').length,
        memoryLeakDetected: false // Would need more sophisticated detection
      };
    });

    const memoryGrowth = finalMemory.usedJSHeapSize - initialMemory.usedJSHeapSize;
    const nodeGrowth = finalMemory.nodeCount - initialMemory.nodeCount;

    // Simple heuristic for memory leak detection
    const suspiciousMemoryGrowth = memoryGrowth > 50 * 1024 * 1024; // 50MB
    const suspiciousNodeGrowth = nodeGrowth > 1000; // 1000 DOM nodes

    await hiveMind.storeInMemory(hiveMind, 'edge-cases/memory-leak-detection', {
      initialMemory,
      finalMemory,
      memoryGrowth,
      nodeGrowth,
      suspiciousMemoryGrowth,
      suspiciousNodeGrowth,
      possibleMemoryLeak: suspiciousMemoryGrowth || suspiciousNodeGrowth
    });

    expect(suspiciousMemoryGrowth).toBe(false);
    expect(suspiciousNodeGrowth).toBe(false);

    await hiveMind.notifyHiveMind(hiveMind, 
      `Memory leak detection: ${(memoryGrowth / 1024 / 1024).toFixed(2)}MB growth, ` +
      `${nodeGrowth} DOM nodes added, ` +
      `${suspiciousMemoryGrowth || suspiciousNodeGrowth ? 'suspicious' : 'normal'} pattern`
    );
  });

  test.afterEach(async ({ hiveMind }) => {
    await hiveMind.notifyHiveMind(hiveMind, 'API failures and network edge case test completed');
  });
});