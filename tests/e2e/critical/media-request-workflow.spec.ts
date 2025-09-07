import { test, expect } from '../helpers/hive-mind/coordination';
import { LoginPage } from '../pages/login.page';
import { DashboardPage } from '../pages/dashboard.page';
import { MediaPage } from '../pages/media.page';
import { MockManager } from '../fixtures/mocks';
import { testUsers, mediaTestData } from '../fixtures/test-data';

test.describe('Critical User Journey - Media Request Workflow', () => {
  let loginPage: LoginPage;
  let dashboardPage: DashboardPage;
  let mediaPage: MediaPage;
  let mockManager: MockManager;

  test.beforeEach(async ({ page, hiveMind }) => {
    await hiveMind.notifyHiveMind(hiveMind, 'Starting media request workflow tests');
    
    loginPage = new LoginPage(page);
    dashboardPage = new DashboardPage(page);
    mediaPage = new MediaPage(page);
    mockManager = new MockManager(page);

    await mockManager.setupBasicMocks();
    await mockManager.mockMediaSearch();

    // Login before each test
    await loginPage.goto();
    await loginPage.login(testUsers.admin.email, testUsers.admin.password);
    await dashboardPage.waitForLoad();
  });

  test('Complete media search and request workflow', async ({ page, hiveMind }) => {
    await hiveMind.storeInMemory(hiveMind, 'media-request/workflow-start', {
      testType: 'complete-media-request',
      startTime: Date.now()
    });

    // Step 1: Navigate to media search
    await dashboardPage.goToMediaSearch();
    await mediaPage.waitForLoad();

    await expect(page.locator('[data-testid="media-search-container"]')).toBeVisible();
    await hiveMind.notifyHiveMind(hiveMind, 'Media search page loaded');

    // Step 2: Perform media search
    const searchQuery = 'The Matrix';
    const searchStartTime = Date.now();
    
    await mediaPage.searchMedia(searchQuery);
    
    // Wait for search results
    await expect(page.locator('[data-testid="search-results"]')).toBeVisible();
    const searchTime = Date.now() - searchStartTime;

    await hiveMind.storeInMemory(hiveMind, 'media-request/search', {
      query: searchQuery,
      searchTime,
      success: true
    });

    // Verify search results are displayed
    const resultCount = await page.locator('[data-testid="media-result-item"]').count();
    expect(resultCount).toBeGreaterThan(0);

    await hiveMind.notifyHiveMind(hiveMind, `Search completed in ${searchTime}ms, found ${resultCount} results`);

    // Step 3: Select media item for request
    const firstResult = page.locator('[data-testid="media-result-item"]').first();
    await expect(firstResult).toBeVisible();

    const mediaTitle = await firstResult.locator('[data-testid="media-title"]').textContent();
    const mediaYear = await firstResult.locator('[data-testid="media-year"]').textContent();

    // Click request button
    await firstResult.locator('[data-testid="request-button"]').click();

    // Step 4: Fill request modal
    await expect(page.locator('[data-testid="request-modal"]')).toBeVisible();
    await expect(page.locator('[data-testid="request-form"]')).toBeVisible();

    // Verify pre-filled information
    await expect(page.locator('[data-testid="request-title"]')).toHaveValue(mediaTitle || '');
    
    // Add request reason
    await page.fill('[data-testid="request-reason"]', 'Highly requested by family members');

    // Select quality preference
    await page.selectOption('[data-testid="quality-select"]', '1080p');

    await hiveMind.storeInMemory(hiveMind, 'media-request/form-data', {
      title: mediaTitle,
      year: mediaYear,
      reason: 'Highly requested by family members',
      quality: '1080p'
    });

    // Step 5: Submit request
    const requestStartTime = Date.now();
    await page.click('[data-testid="submit-request-button"]');

    // Wait for request confirmation
    await expect(page.locator('[data-testid="request-success-message"]')).toBeVisible();
    const requestTime = Date.now() - requestStartTime;

    await hiveMind.storeInMemory(hiveMind, 'media-request/submission', {
      submissionTime: requestTime,
      success: true,
      timestamp: new Date().toISOString()
    });

    // Verify success message content
    await expect(page.locator('[data-testid="request-success-message"]')).toContainText('Request submitted successfully');

    // Close modal
    await page.click('[data-testid="close-request-modal"]');
    await expect(page.locator('[data-testid="request-modal"]')).not.toBeVisible();

    await hiveMind.notifyHiveMind(hiveMind, `Media request submitted in ${requestTime}ms`);

    // Step 6: Verify request appears in requests list
    await dashboardPage.goToRequests();
    await expect(page.locator('[data-testid="requests-container"]')).toBeVisible();

    // Wait for requests to load
    await expect(page.locator('[data-testid="request-list"]')).toBeVisible();

    // Find the submitted request
    const requestItems = page.locator('[data-testid="request-item"]');
    const requestCount = await requestItems.count();
    expect(requestCount).toBeGreaterThan(0);

    // Look for our specific request
    let requestFound = false;
    for (let i = 0; i < requestCount; i++) {
      const item = requestItems.nth(i);
      const title = await item.locator('[data-testid="request-item-title"]').textContent();
      if (title && title.includes(mediaTitle || '')) {
        requestFound = true;
        
        // Verify request details
        await expect(item.locator('[data-testid="request-status"]')).toBeVisible();
        const status = await item.locator('[data-testid="request-status"]').textContent();
        
        await hiveMind.storeInMemory(hiveMind, 'media-request/verification', {
          requestFound: true,
          title: title,
          status: status,
          position: i + 1
        });
        
        break;
      }
    }

    expect(requestFound).toBe(true);
    await hiveMind.notifyHiveMind(hiveMind, 'Request verified in requests list');

    // Calculate total workflow time
    const workflowData = await hiveMind.retrieveFromMemory(hiveMind, 'media-request/workflow-start');
    const totalTime = Date.now() - workflowData?.startTime;

    await hiveMind.storeInMemory(hiveMind, 'media-request/workflow-complete', {
      totalTime,
      steps: ['search', 'select', 'request', 'submit', 'verify'],
      success: true
    });

    await hiveMind.notifyHiveMind(hiveMind, `Complete media request workflow completed in ${totalTime}ms`);
  });

  test('TV show season selection request', async ({ page, hiveMind }) => {
    await dashboardPage.goToMediaSearch();
    await mediaPage.waitForLoad();

    // Search for TV show
    await mediaPage.searchMedia('Breaking Bad');
    await expect(page.locator('[data-testid="search-results"]')).toBeVisible();

    // Select TV show result
    const tvShowResult = page.locator('[data-testid="media-result-item"]').first();
    await tvShowResult.locator('[data-testid="request-button"]').click();

    // Verify request modal shows season selection for TV shows
    await expect(page.locator('[data-testid="request-modal"]')).toBeVisible();
    await expect(page.locator('[data-testid="season-selector"]')).toBeVisible();

    // Select specific seasons
    await page.check('[data-testid="season-1-checkbox"]');
    await page.check('[data-testid="season-2-checkbox"]');
    await page.check('[data-testid="season-3-checkbox"]');

    const selectedSeasons = await page.locator('[data-testid*="season-"][checked]').count();
    expect(selectedSeasons).toBe(3);

    await hiveMind.storeInMemory(hiveMind, 'media-request/tv-show-seasons', {
      showTitle: 'Breaking Bad',
      selectedSeasons: 3,
      seasons: [1, 2, 3]
    });

    // Add request details
    await page.fill('[data-testid="request-reason"]', 'Want to rewatch this amazing series');
    await page.selectOption('[data-testid="quality-select"]', '4K');

    // Submit request
    await page.click('[data-testid="submit-request-button"]');
    await expect(page.locator('[data-testid="request-success-message"]')).toBeVisible();

    await hiveMind.notifyHiveMind(hiveMind, 'TV show season selection request completed');

    // Verify request details include season information
    await page.click('[data-testid="close-request-modal"]');
    await dashboardPage.goToRequests();

    const requestItems = page.locator('[data-testid="request-item"]');
    const latestRequest = requestItems.first();

    await expect(latestRequest.locator('[data-testid="request-seasons-info"]')).toBeVisible();
    const seasonsInfo = await latestRequest.locator('[data-testid="request-seasons-info"]').textContent();
    expect(seasonsInfo).toContain('Seasons: 1, 2, 3');

    await hiveMind.storeInMemory(hiveMind, 'media-request/tv-verification', {
      seasonsInfoDisplayed: true,
      seasonsText: seasonsInfo
    });

    await hiveMind.notifyHiveMind(hiveMind, 'TV show season information verified in requests list');
  });

  test('Request status tracking and updates', async ({ page, hiveMind }) => {
    // Submit a media request first
    await dashboardPage.goToMediaSearch();
    await mediaPage.searchMedia('The Matrix');
    
    const firstResult = page.locator('[data-testid="media-result-item"]').first();
    await firstResult.locator('[data-testid="request-button"]').click();
    
    await page.fill('[data-testid="request-reason"]', 'Testing request tracking');
    await page.click('[data-testid="submit-request-button"]');
    await expect(page.locator('[data-testid="request-success-message"]')).toBeVisible();
    await page.click('[data-testid="close-request-modal"]');

    // Navigate to requests list
    await dashboardPage.goToRequests();
    await expect(page.locator('[data-testid="requests-container"]')).toBeVisible();

    // Find the submitted request
    const requestItems = page.locator('[data-testid="request-item"]');
    const latestRequest = requestItems.first();

    // Verify initial status
    await expect(latestRequest.locator('[data-testid="request-status"]')).toBeVisible();
    const initialStatus = await latestRequest.locator('[data-testid="request-status"]').textContent();

    await hiveMind.storeInMemory(hiveMind, 'media-request/initial-status', {
      status: initialStatus,
      timestamp: new Date().toISOString()
    });

    // Click on request for details
    await latestRequest.click();
    await expect(page.locator('[data-testid="request-detail-modal"]')).toBeVisible();

    // Verify request timeline/history
    await expect(page.locator('[data-testid="request-timeline"]')).toBeVisible();
    const timelineEvents = await page.locator('[data-testid="timeline-event"]').count();
    expect(timelineEvents).toBeGreaterThanOrEqual(1); // At least the submission event

    // Verify request information
    await expect(page.locator('[data-testid="request-title"]')).toBeVisible();
    await expect(page.locator('[data-testid="request-date"]')).toBeVisible();
    await expect(page.locator('[data-testid="request-user"]')).toBeVisible();

    const requestDetails = {
      title: await page.locator('[data-testid="request-title"]').textContent(),
      date: await page.locator('[data-testid="request-date"]').textContent(),
      user: await page.locator('[data-testid="request-user"]').textContent(),
      timelineEvents
    };

    await hiveMind.storeInMemory(hiveMind, 'media-request/details', requestDetails);

    // Mock status update
    await page.route('/api/media/requests/*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: '1',
          title: 'The Matrix',
          status: 'approved',
          requestedAt: new Date().toISOString(),
          approvedAt: new Date().toISOString(),
          requestedBy: 'testuser',
          approvedBy: 'admin'
        })
      });
    });

    // Refresh to get updated status
    await page.click('[data-testid="refresh-request-status"]');
    
    // Wait for status update
    await expect(page.locator('[data-testid="request-status-approved"]')).toBeVisible({ timeout: 5000 });

    const updatedStatus = await page.locator('[data-testid="request-status"]').textContent();
    expect(updatedStatus).toContain('approved');

    await hiveMind.storeInMemory(hiveMind, 'media-request/status-update', {
      previousStatus: initialStatus,
      newStatus: updatedStatus,
      updateDetected: true,
      timestamp: new Date().toISOString()
    });

    await hiveMind.notifyHiveMind(hiveMind, `Request status updated from ${initialStatus} to ${updatedStatus}`);

    // Close modal
    await page.click('[data-testid="close-request-detail"]');

    // Verify status change is reflected in the list view
    const updatedListStatus = await latestRequest.locator('[data-testid="request-status"]').textContent();
    expect(updatedListStatus).toContain('approved');

    await hiveMind.notifyHiveMind(hiveMind, 'Request status tracking completed successfully');
  });

  test('Bulk media request handling', async ({ page, hiveMind }) => {
    await dashboardPage.goToMediaSearch();
    await mediaPage.waitForLoad();

    const mediaItems = [
      { title: 'The Matrix', type: 'movie' },
      { title: 'Breaking Bad', type: 'tv' },
      { title: 'Inception', type: 'movie' }
    ];

    const requestResults = [];

    for (const media of mediaItems) {
      // Search for media
      await mediaPage.searchMedia(media.title);
      await expect(page.locator('[data-testid="search-results"]')).toBeVisible();

      // Select first result
      const firstResult = page.locator('[data-testid="media-result-item"]').first();
      await firstResult.locator('[data-testid="request-button"]').click();

      // Fill request form
      await expect(page.locator('[data-testid="request-modal"]')).toBeVisible();
      await page.fill('[data-testid="request-reason"]', `Bulk request for ${media.title}`);
      
      if (media.type === 'tv') {
        // Select all seasons for TV shows
        await page.check('[data-testid="select-all-seasons"]');
      }

      // Submit request
      const requestStartTime = Date.now();
      await page.click('[data-testid="submit-request-button"]');
      await expect(page.locator('[data-testid="request-success-message"]')).toBeVisible();
      const requestTime = Date.now() - requestStartTime;

      requestResults.push({
        title: media.title,
        type: media.type,
        requestTime,
        success: true
      });

      await page.click('[data-testid="close-request-modal"]');
      await hiveMind.notifyHiveMind(hiveMind, `Bulk request ${media.title} completed in ${requestTime}ms`);
    }

    await hiveMind.storeInMemory(hiveMind, 'media-request/bulk-requests', {
      totalRequests: mediaItems.length,
      results: requestResults,
      averageTime: requestResults.reduce((sum, req) => sum + req.requestTime, 0) / requestResults.length
    });

    // Verify all requests appear in the list
    await dashboardPage.goToRequests();
    await expect(page.locator('[data-testid="requests-container"]')).toBeVisible();

    const totalRequestItems = await page.locator('[data-testid="request-item"]').count();
    expect(totalRequestItems).toBeGreaterThanOrEqual(mediaItems.length);

    // Verify each request is present
    for (const media of mediaItems) {
      const requestExists = await page.locator(`[data-testid="request-item"]:has-text("${media.title}")`).isVisible();
      expect(requestExists).toBe(true);
    }

    const totalTime = requestResults.reduce((sum, req) => sum + req.requestTime, 0);
    await hiveMind.notifyHiveMind(hiveMind, 
      `Bulk request handling completed: ${mediaItems.length} requests in ${totalTime}ms total`
    );
  });

  test('Request cancellation and modification', async ({ page, hiveMind }) => {
    // Submit a request first
    await dashboardPage.goToMediaSearch();
    await mediaPage.searchMedia('The Matrix');
    
    const firstResult = page.locator('[data-testid="media-result-item"]').first();
    await firstResult.locator('[data-testid="request-button"]').click();
    
    await page.fill('[data-testid="request-reason"]', 'Testing cancellation');
    await page.click('[data-testid="submit-request-button"]');
    await expect(page.locator('[data-testid="request-success-message"]')).toBeVisible();
    await page.click('[data-testid="close-request-modal"]');

    // Navigate to requests and find the request
    await dashboardPage.goToRequests();
    const requestItems = page.locator('[data-testid="request-item"]');
    const latestRequest = requestItems.first();

    // Open request details
    await latestRequest.click();
    await expect(page.locator('[data-testid="request-detail-modal"]')).toBeVisible();

    // Test request cancellation
    if (await page.locator('[data-testid="cancel-request-button"]').isVisible()) {
      await page.click('[data-testid="cancel-request-button"]');
      
      // Confirm cancellation
      await expect(page.locator('[data-testid="cancel-confirmation-modal"]')).toBeVisible();
      await page.fill('[data-testid="cancellation-reason"]', 'Changed my mind');
      await page.click('[data-testid="confirm-cancel"]');

      // Verify cancellation
      await expect(page.locator('[data-testid="request-cancelled-message"]')).toBeVisible();
      
      const cancelledStatus = await page.locator('[data-testid="request-status"]').textContent();
      expect(cancelledStatus).toContain('cancelled');

      await hiveMind.storeInMemory(hiveMind, 'media-request/cancellation', {
        success: true,
        reason: 'Changed my mind',
        status: cancelledStatus
      });

      await hiveMind.notifyHiveMind(hiveMind, 'Request cancellation completed successfully');
    } else {
      await hiveMind.notifyHiveMind(hiveMind, 'Request cancellation not available for current status');
    }

    await page.click('[data-testid="close-request-detail"]');

    // Test request modification (if available)
    if (await latestRequest.locator('[data-testid="modify-request-button"]').isVisible()) {
      await latestRequest.locator('[data-testid="modify-request-button"]').click();
      
      await expect(page.locator('[data-testid="modify-request-modal"]')).toBeVisible();
      
      // Modify request reason
      await page.fill('[data-testid="request-reason"]', 'Updated: Really want to watch this');
      await page.selectOption('[data-testid="quality-select"]', '4K');
      
      await page.click('[data-testid="save-modifications"]');
      await expect(page.locator('[data-testid="modification-success-message"]')).toBeVisible();
      
      await hiveMind.storeInMemory(hiveMind, 'media-request/modification', {
        success: true,
        newReason: 'Updated: Really want to watch this',
        newQuality: '4K'
      });

      await hiveMind.notifyHiveMind(hiveMind, 'Request modification completed successfully');
    }

    await hiveMind.notifyHiveMind(hiveMind, 'Request cancellation and modification testing completed');
  });
});