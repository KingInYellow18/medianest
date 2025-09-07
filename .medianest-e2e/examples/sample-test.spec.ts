/**
 * Sample E2E Test demonstrating MediaNest Page Object Models
 * 
 * This file showcases how to use the POMs in real test scenarios
 * with proper HIVE-MIND coordination patterns.
 */

import { test, expect } from '@playwright/test';
import { 
  createPageFactory, 
  SignInPage, 
  DashboardPage, 
  PlexBrowserPage,
  MediaRequestPage,
  RequestsListPage 
} from '../pages';

test.describe('MediaNest E2E Tests', () => {
  test('Complete user authentication workflow', async ({ page }) => {
    const signIn = new SignInPage(page);
    const dashboard = new DashboardPage(page);
    
    // Navigate to sign in page
    await signIn.navigate();
    await signIn.verifyPageElements();
    
    // Test admin authentication
    await signIn.adminLogin('admin', 'admin');
    
    // Verify landing on dashboard
    await dashboard.verifyPageElements();
    const statuses = await dashboard.getAllServiceStatuses();
    
    // At least one service should be online
    const onlineServices = Object.values(statuses).filter(status => status === 'online');
    expect(onlineServices.length).toBeGreaterThan(0);
  });

  test('Plex library browsing workflow', async ({ page }) => {
    const { pages, workflows } = createPageFactory(page);
    
    // Authenticate user
    await workflows.authenticateUser();
    
    // Navigate to Plex browser
    await pages.plexBrowser.navigate();
    await pages.plexBrowser.verifyPageElements();
    
    // Get available libraries
    const libraries = await pages.plexBrowser.getAvailableLibraries();
    expect(libraries.length).toBeGreaterThan(0);
    
    if (libraries.length > 0) {
      // Select first library
      await pages.plexBrowser.selectLibrary(libraries[0]);
      
      // Get media items
      const mediaItems = await pages.plexBrowser.getMediaItems();
      console.log(`Found ${mediaItems.length} media items in ${libraries[0]}`);
      
      // Test search functionality
      if (mediaItems.length > 0) {
        const searchTerm = mediaItems[0].title.substring(0, 3);
        await pages.plexBrowser.searchMedia(searchTerm);
        
        const searchResults = await pages.plexBrowser.getSearchResultsCount();
        expect(searchResults).toBeGreaterThan(0);
        
        await pages.plexBrowser.clearSearch();
      }
    }
  });

  test('Media request submission and monitoring', async ({ page }) => {
    const { pages, workflows } = createPageFactory(page);
    
    // Authenticate user
    await workflows.authenticateUser();
    
    // Submit a media request
    const requestId = await workflows.requestMedia('Inception', 'Inception (2010)', {
      type: 'movie',
      quality: '1080p',
      priority: 'normal',
      notes: 'Test request from automated test'
    });
    
    expect(requestId).toBeTruthy();
    console.log(`Submitted request with ID: ${requestId}`);
    
    // Navigate to requests list to verify
    await pages.requestsList.navigate();
    await pages.requestsList.verifyPageElements();
    
    // Get requests and verify our request exists
    const requests = await pages.requestsList.getRequests();
    const ourRequest = requests.find(r => r.title.includes('Inception'));
    
    expect(ourRequest).toBeTruthy();
    expect(ourRequest?.status).toMatch(/pending|approved|in-progress/);
    
    // Test request filtering
    await pages.requestsList.filterByStatus('pending');
    const pendingRequests = await pages.requestsList.getRequests();
    console.log(`Found ${pendingRequests.length} pending requests`);
    
    await pages.requestsList.clearAllFilters();
  });

  test('Service status monitoring and health check', async ({ page }) => {
    const dashboard = new DashboardPage(page);
    
    // Navigate directly to dashboard (assuming user is already authenticated)
    await dashboard.navigate();
    await dashboard.waitForServiceCards();
    
    // Get service statuses
    const statuses = await dashboard.getAllServiceStatuses();
    console.log('Service statuses:', statuses);
    
    // Verify critical services
    expect(['online', 'loading'].includes(statuses.plex)).toBe(true);
    expect(['online', 'loading'].includes(statuses.overseerr)).toBe(true);
    
    // Test refresh functionality
    await dashboard.refreshServices();
    
    // Measure performance
    const loadTimes = await dashboard.measureServiceLoadTimes();
    console.log('Service load times:', loadTimes);
    
    // All services should load within reasonable time (10 seconds)
    Object.values(loadTimes).forEach(time => {
      expect(time).toBeLessThan(10000);
    });
  });

  test('YouTube downloader workflow', async ({ page }) => {
    const youTube = new pages.YouTubeDownloaderPage(page);
    
    await youTube.navigate();
    await youTube.verifyPageElements();
    
    // Test with a sample YouTube URL (use a short, public domain video)
    const testUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'; // Rick Roll for testing
    
    // Submit URL
    await youTube.submitUrl(testUrl, false);
    
    // Check URL validation
    const isValid = await youTube.isUrlValid();
    expect(isValid).toBe(true);
    
    if (isValid) {
      // Get video metadata
      const metadata = await youTube.getVideoMetadata();
      expect(metadata.title).toBeTruthy();
      expect(metadata.duration).toBeTruthy();
      
      console.log(`Video: ${metadata.title} (${metadata.duration})`);
      
      // Configure download options
      await youTube.setDownloadOptions({
        quality: '720p',
        format: 'mp4',
        audioOnly: false
      });
      
      // For testing, we'll just verify the download can be started
      // In real tests, you might want to actually complete the download
      // await youTube.startDownload();
    }
  });

  test('Accessibility compliance check', async ({ page }) => {
    const { utilities } = createPageFactory(page);
    
    // Run accessibility audit on all pages
    const auditResults = await utilities.auditAccessibility();
    
    console.log('Accessibility audit results:', auditResults);
    
    // Verify that critical pages pass accessibility tests
    expect(auditResults.signIn).toBe(true);
    expect(auditResults.dashboard).toBe(true);
    
    // Log any failures for investigation
    Object.entries(auditResults).forEach(([pageName, passed]) => {
      if (!passed) {
        console.warn(`Accessibility issues found on ${pageName} page`);
      }
    });
  });

  test('Performance monitoring across application', async ({ page }) => {
    const { utilities } = createPageFactory(page);
    
    // Measure performance across all pages
    const performanceMetrics = await utilities.measurePerformance();
    
    console.log('Performance metrics:', performanceMetrics);
    
    // Verify pages load within acceptable time limits
    Object.entries(performanceMetrics).forEach(([pageName, loadTime]) => {
      if (loadTime > 0) { // -1 indicates measurement failure
        expect(loadTime).toBeLessThan(15000); // 15 second max load time
        
        if (loadTime > 5000) {
          console.warn(`Page ${pageName} loaded slowly: ${loadTime}ms`);
        }
      }
    });
  });

  test('Error handling and recovery', async ({ page }) => {
    const signIn = new SignInPage(page);
    
    await signIn.navigate();
    
    // Test invalid login credentials
    await signIn.switchToAdminSetup();
    await signIn.adminLogin('admin', 'wrongpassword');
    
    // Should handle error gracefully
    const error = await signIn.getAuthenticationError();
    expect(error).toBeTruthy();
    
    // Test network error simulation
    await page.route('/api/auth/plex/pin', (route) => {
      route.abort('failed');
    });
    
    await signIn.switchBackToPlexLogin();
    await signIn.startPlexAuthentication();
    
    // Should handle network error gracefully
    const hasError = await signIn.checkForErrors();
    expect(hasError).toBeTruthy();
  });

  test('End-to-end complete workflow', async ({ page }) => {
    const { pages, workflows, utilities } = createPageFactory(page);
    
    // 1. Authentication
    await workflows.authenticateUser();
    console.log('✓ User authenticated successfully');
    
    // 2. Verify system health
    const isHealthy = await workflows.verifySystemHealth();
    expect(isHealthy).toBe(true);
    console.log('✓ System health verified');
    
    // 3. Browse Plex library
    await workflows.browsePlexLibrary();
    console.log('✓ Plex library browsed successfully');
    
    // 4. Submit media request
    const requestId = await workflows.requestMedia('The Matrix', 'The Matrix (1999)', {
      type: 'movie',
      quality: '4K',
      priority: 'high'
    });
    expect(requestId).toBeTruthy();
    console.log(`✓ Media request submitted: ${requestId}`);
    
    // 5. Monitor request status
    await pages.requestsList.navigate();
    const requests = await pages.requestsList.getRequests();
    const ourRequest = requests.find(r => r.id === requestId);
    expect(ourRequest).toBeTruthy();
    console.log(`✓ Request verified in list with status: ${ourRequest?.status}`);
    
    // 6. Take screenshots for verification
    const screenshots = await utilities.capturePageScreenshots();
    expect(Object.keys(screenshots).length).toBeGreaterThan(0);
    console.log(`✓ Captured ${Object.keys(screenshots).length} screenshots`);
    
    console.log('🎉 Complete workflow test passed successfully!');
  });
});

/**
 * Test configuration and setup
 */
test.beforeEach(async ({ page }) => {
  // Set up any global test prerequisites
  await page.goto('/');
  
  // Wait for initial page load
  await page.waitForLoadState('networkidle');
  
  // Set reasonable timeouts
  page.setDefaultTimeout(30000);
});

test.afterEach(async ({ page }, testInfo) => {
  // Take screenshot on failure
  if (testInfo.status !== 'passed') {
    const screenshot = await page.screenshot({ 
      path: `test-results/failure-${testInfo.title.replace(/\s+/g, '-')}-${Date.now()}.png`,
      fullPage: true 
    });
    await testInfo.attach('screenshot', { 
      body: screenshot, 
      contentType: 'image/png' 
    });
  }
});