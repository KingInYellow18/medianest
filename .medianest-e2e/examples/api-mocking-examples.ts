/**
 * MediaNest API Mocking Framework - Example Usage
 * Comprehensive examples demonstrating all framework capabilities
 */

import { test, expect, Page } from '@playwright/test'
import { 
  setupApiTesting,
  createMockServer,
  DEFAULT_SCENARIOS,
  SCENARIO_GROUPS,
  PERFORMANCE_TEST_PRESETS,
  EnhancedPageBase,
  MockIntegration
} from '../fixtures/api'

// ==================== BASIC API MOCKING ====================

test.describe('Basic API Mocking Examples', () => {
  test('Simple API endpoint mocking', async ({ page }) => {
    // Setup basic API mocking
    const mockIntegration = await setupApiTesting(page, {
      scenarios: ['network.timeout', 'server.internal-error']
    })

    await page.goto('http://localhost:3000/dashboard')

    // Wait for specific API calls
    await mockIntegration.waitForApiResponse(page, '/api/v1/dashboard/status', {
      status: 200,
      maxResponseTime: 3000
    })

    // Assert API response was mocked correctly
    const stats = await mockIntegration.getStatistics()
    expect(stats.requests.mocked).toBeGreaterThan(0)

    await mockIntegration.cleanup()
  })

  test('Mock server with custom scenarios', async ({ page }) => {
    // Create mock server with specific configuration
    const mockServer = createMockServer({
      mode: 'testing',
      baseUrl: 'http://localhost:3001',
      scenarios: [DEFAULT_SCENARIOS.NETWORK_TIMEOUT, DEFAULT_SCENARIOS.AUTH_TOKEN_EXPIRED],
      enableHiveMind: true
    })

    await mockServer.start()

    // Navigate and interact with mocked APIs
    await page.goto('http://localhost:3000/login')
    await page.fill('[data-testid="email"]', 'test@example.com')
    await page.fill('[data-testid="password"]', 'password123')
    await page.click('[data-testid="login-submit"]')

    // Verify error handling for expired token scenario
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible()

    await mockServer.stop()
  })
})

// ==================== EDGE CASE TESTING ====================

test.describe('Edge Case Testing Examples', () => {
  test('Network failure simulation', async ({ page }) => {
    const mockIntegration = await setupApiTesting(page, {
      scenarios: SCENARIO_GROUPS.NETWORK_ISSUES,
      edgeCaseTesting: true
    })

    // Apply aggressive network failure scenarios
    await mockIntegration.applyScenarios([
      'network.timeout',
      'network.connection-drop',
      'network.intermittent.failure'
    ])

    await page.goto('http://localhost:3000/media/search')
    await page.fill('[data-testid="search-input"]', 'Breaking Bad')
    await page.click('[data-testid="search-button"]')

    // Test that the application handles network failures gracefully
    await expect(page.locator('[data-testid="search-loading"]')).toBeVisible()
    
    // Wait for either success or error state
    await Promise.race([
      page.waitForSelector('[data-testid="search-results"]', { timeout: 10000 }),
      page.waitForSelector('[data-testid="network-error"]', { timeout: 10000 })
    ])

    // Verify error handling UI is present
    const hasErrorUI = await page.locator('[data-testid="retry-button"]').isVisible()
    expect(hasErrorUI).toBeTruthy()

    await mockIntegration.cleanup()
  })

  test('Service unavailability scenarios', async ({ page }) => {
    const mockIntegration = await setupApiTesting(page, {
      scenarios: [
        DEFAULT_SCENARIOS.PLEX_SERVER_OFFLINE,
        DEFAULT_SCENARIOS.OVERSEERR_MAINTENANCE
      ]
    })

    await page.goto('http://localhost:3000/services')

    // Wait for service status to load with failures
    await mockIntegration.waitForApiResponse(page, '/api/v1/services/status', {
      status: 503,
      errorHandling: true
    })

    // Verify service status indicators show problems
    await expect(page.locator('[data-testid="plex-status"]')).toContainText('offline')
    await expect(page.locator('[data-testid="overseerr-status"]')).toContainText('maintenance')

    await mockIntegration.cleanup()
  })

  test('Data corruption handling', async ({ page }) => {
    const mockIntegration = await setupApiTesting(page)

    // Apply data corruption scenarios
    await mockIntegration.applyScenarios([
      DEFAULT_SCENARIOS.DATA_CORRUPTION,
      DEFAULT_SCENARIOS.DATA_EMPTY_RESPONSE
    ])

    await page.goto('http://localhost:3000/requests')

    // Test application handles malformed data gracefully
    const hasErrorBoundary = await page.locator('[data-testid="error-boundary"]').isVisible()
    const hasEmptyState = await page.locator('[data-testid="empty-requests"]').isVisible()
    
    expect(hasErrorBoundary || hasEmptyState).toBeTruthy()

    await mockIntegration.cleanup()
  })
})

// ==================== ENHANCED PAGE OBJECTS ====================

class EnhancedLoginPage extends EnhancedPageBase {
  constructor(page: Page) {
    super(page, {
      enableMocking: true,
      scenarios: ['auth.token-expired', 'rate-limit.too-many-requests'],
      performanceMonitoring: true
    })
  }

  async goto() {
    await this.navigateWithApiCheck('http://localhost:3000/login', {
      waitForApi: ['/api/v1/health'],
      expectedResponses: [{ url: '/api/v1/health', status: 200 }]
    })
  }

  async login(email: string, password: string) {
    await this.initializeApiTesting()

    // Fill form with API validation
    await this.fillFormWithApiValidation(
      { email, password },
      {
        submitButton: this.page.locator('[data-testid="login-submit"]'),
        validationEndpoint: '/api/v1/auth/login'
      }
    )

    // Wait for authentication response with comprehensive validation
    return await this.waitForApiResponse('/api/v1/auth/login', {
      expectedStatus: 200,
      maxResponseTime: 3000,
      contentType: 'application/json',
      bodySchema: {
        token: 'string',
        user: 'object'
      }
    })
  }

  async testLoginPerformance(credentials: { email: string; password: string }) {
    return await this.testApiPerformance(
      () => this.login(credentials.email, credentials.password),
      {
        iterations: 20,
        concurrency: 3,
        maxResponseTime: 2000
      }
    )
  }
}

test.describe('Enhanced Page Object Examples', () => {
  test('Login with comprehensive API testing', async ({ page }) => {
    const loginPage = new EnhancedLoginPage(page)
    await loginPage.goto()

    // Test successful login
    const loginResult = await loginPage.login('user@example.com', 'password123')
    expect(loginResult.response.status()).toBe(200)
    expect(loginResult.responseTime).toBeLessThan(3000)

    // Verify redirect after login
    await expect(page).toHaveURL(/dashboard/)

    await loginPage.cleanupApiTesting()
  })

  test('Login performance testing', async ({ page }) => {
    const loginPage = new EnhancedLoginPage(page)
    await loginPage.goto()

    // Test login performance under load
    const performanceResults = await loginPage.testLoginPerformance({
      email: 'user@example.com',
      password: 'password123'
    })

    expect(performanceResults.averageResponseTime).toBeLessThan(1500)
    expect(performanceResults.errorCount).toBeLessThanOrEqual(1)

    console.log('Login Performance Results:', performanceResults)

    await loginPage.cleanupApiTesting()
  })

  test('Login with error scenarios', async ({ page }) => {
    const loginPage = new EnhancedLoginPage(page)
    await loginPage.goto()

    // Apply authentication failure scenarios
    await loginPage.simulateApiFailures(['auth.invalid-credentials', 'rate-limit.too-many-requests'])

    // Attempt login with various failure scenarios
    await loginPage.login('invalid@example.com', 'wrongpassword')

    // Verify error handling
    await expect(page.locator('[data-testid="login-error"]')).toBeVisible()
    await expect(page.locator('[data-testid="retry-button"]')).toBeVisible()

    await loginPage.cleanupApiTesting()
  })
})

// ==================== PERFORMANCE TESTING ====================

class EnhancedMediaPage extends EnhancedPageBase {
  constructor(page: Page) {
    super(page, {
      enableMocking: true,
      performanceMonitoring: true
    })
  }

  async searchMedia(query: string) {
    return await this.performActionWithApiMonitoring(
      async () => {
        await this.page.fill('[data-testid="search-input"]', query)
        await this.clickWithApiVerification(
          this.page.locator('[data-testid="search-button"]'),
          { url: '/api/v1/media/search', status: 200 }
        )
      },
      [
        { url: '/api/v1/media/search', status: 200 },
        { url: '/api/v1/media/popular', status: 200 }
      ]
    )
  }

  async requestMedia(mediaId: string) {
    return await this.performActionWithApiMonitoring(
      async () => {
        await this.clickWithApiVerification(
          this.page.locator(`[data-testid="request-${mediaId}"]`),
          { url: '/api/v1/media/request', status: 201 }
        )
      },
      [{ url: '/api/v1/media/request', status: 201 }]
    )
  }
}

test.describe('Performance Testing Examples', () => {
  test('Media search performance analysis', async ({ page }) => {
    const mockIntegration = await setupApiTesting(page, {
      performanceTesting: true
    })

    const mediaPage = new EnhancedMediaPage(page)
    await page.goto('http://localhost:3000/media')

    // Run comprehensive performance test suite
    const performanceResults = await mockIntegration.runPerformanceTests()

    console.log('Performance Test Results:', {
      baseline: performanceResults.baseline,
      loadTests: Object.keys(performanceResults.loadTests),
      recommendations: performanceResults.recommendations
    })

    // Assert performance expectations
    expect(performanceResults.baseline.responseTime.avg).toBeLessThan(1000)
    expect(performanceResults.loadTests['heavy-load'].errors.rate).toBeLessThan(0.05)

    await mockIntegration.cleanup()
  })

  test('Search under load conditions', async ({ page }) => {
    const mockIntegration = await setupApiTesting(page, {
      performanceTesting: true
    })

    const mediaPage = new EnhancedMediaPage(page)
    await page.goto('http://localhost:3000/media')

    // Test search performance under various load conditions
    const searchTests = [
      { query: 'Breaking Bad', expectedResults: 5 },
      { query: 'Marvel', expectedResults: 20 },
      { query: 'Comedy Movies', expectedResults: 15 }
    ]

    for (const searchTest of searchTests) {
      const searchResult = await mediaPage.searchMedia(searchTest.query)
      
      console.log(`Search "${searchTest.query}":`, {
        totalTime: searchResult.performance.totalTime,
        apiResponseTimes: searchResult.performance.apiResponseTimes
      })

      expect(searchResult.performance.totalTime).toBeLessThan(5000)
      expect(searchResult.performance.apiResponseTimes.every(time => time < 3000)).toBeTruthy()
    }

    await mockIntegration.cleanup()
  })

  test('Concurrent request performance', async ({ page }) => {
    const mockIntegration = await setupApiTesting(page)
    const mediaPage = new EnhancedMediaPage(page)
    await page.goto('http://localhost:3000/media')

    // Test concurrent media requests
    const concurrentRequests = Array.from({ length: 10 }, (_, i) => 
      mediaPage.requestMedia(`media-${i}`)
    )

    const startTime = Date.now()
    const results = await Promise.allSettled(concurrentRequests)
    const totalTime = Date.now() - startTime

    const successfulRequests = results.filter(r => r.status === 'fulfilled').length
    const failedRequests = results.length - successfulRequests

    console.log('Concurrent Request Results:', {
      total: results.length,
      successful: successfulRequests,
      failed: failedRequests,
      totalTime,
      averageTimePerRequest: totalTime / results.length
    })

    // Assert acceptable performance and error rates
    expect(totalTime).toBeLessThan(10000) // Total time under 10 seconds
    expect(failedRequests).toBeLessThanOrEqual(2) // Max 2 failures acceptable

    await mockIntegration.cleanup()
  })
})

// ==================== COMPREHENSIVE INTEGRATION ====================

test.describe('Comprehensive Integration Examples', () => {
  test('Full user journey with API mocking', async ({ page }) => {
    const mockIntegration = await setupApiTesting(page, {
      scenarios: SCENARIO_GROUPS.ALL_SCENARIOS.slice(0, 5), // Sample of scenarios
      performanceTesting: true,
      edgeCaseTesting: true
    })

    // 1. Login
    const loginPage = new EnhancedLoginPage(page)
    await loginPage.goto()
    await loginPage.login('user@example.com', 'password123')

    // 2. Navigate to media search
    const mediaPage = new EnhancedMediaPage(page)
    await page.goto('http://localhost:3000/media')

    // 3. Search for media
    const searchResult = await mediaPage.searchMedia('Science Fiction')
    expect(searchResult.apiCalls.length).toBeGreaterThan(0)

    // 4. Request media
    await mediaPage.requestMedia('media-123')

    // 5. Check request status
    await page.goto('http://localhost:3000/requests')
    await mockIntegration.waitForApiResponse(page, '/api/v1/requests/me', {
      status: 200,
      maxResponseTime: 2000
    })

    // 6. View dashboard
    await page.goto('http://localhost:3000/dashboard')
    await mockIntegration.waitForApiResponse(page, '/api/v1/dashboard/status', {
      status: 200
    })

    // Export comprehensive test data
    const testData = await mockIntegration.exportData()
    console.log('Complete User Journey Test Data:', {
      totalRequests: testData.requests.length,
      hiveMindEntries: Object.keys(testData.hiveMindState).length,
      statistics: testData.statistics
    })

    // Take final screenshot with API context
    await loginPage.takeScreenshotWithApiContext('full-user-journey-completed')

    await mockIntegration.cleanup()
  })

  test('Chaos testing simulation', async ({ page }) => {
    const mockIntegration = await setupApiTesting(page, {
      edgeCaseTesting: true
    })

    // Start chaos testing with random failures
    await mockIntegration.startEdgeCaseSimulation({
      networkFailures: { enabled: true, frequency: 0.3, types: ['timeout', 'connection-drop'] },
      serverErrors: { enabled: true, frequency: 0.2, types: [500, 503] },
      dataCorruption: { enabled: true, frequency: 0.1, types: ['malformed-json'] }
    })

    // Perform various operations under chaos conditions
    await page.goto('http://localhost:3000')
    
    // Navigate through different pages randomly
    const pages = ['/dashboard', '/media', '/requests', '/services']
    
    for (let i = 0; i < 10; i++) {
      const randomPage = pages[Math.floor(Math.random() * pages.length)]
      
      try {
        await page.goto(`http://localhost:3000${randomPage}`, { 
          timeout: 10000,
          waitUntil: 'networkidle' 
        })
        
        // Wait briefly between navigation
        await page.waitForTimeout(1000)
        
      } catch (error) {
        console.log(`Navigation to ${randomPage} failed (expected under chaos): ${error.message}`)
        // Continue testing - failures are expected during chaos
      }
    }

    // Get chaos testing statistics
    const chaosStats = await mockIntegration.getStatistics()
    console.log('Chaos Testing Results:', chaosStats)

    // Verify application remained functional despite chaos
    const isPageResponsive = await page.locator('body').isVisible()
    expect(isPageResponsive).toBeTruthy()

    await mockIntegration.cleanup()
  })
})

// ==================== UTILITY EXAMPLES ====================

test.describe('Utility Function Examples', () => {
  test('Test data generation and validation', async ({ page }) => {
    const mockIntegration = await setupApiTesting(page, {
      dataGeneration: true
    })

    // Generate test data
    const testData = mockIntegration.generateTestData()
    
    console.log('Generated Test Data:', {
      movies: testData.movies.length,
      tvShows: testData.tvShows.length,
      users: testData.users.length,
      requests: testData.requests.length,
      services: testData.services.length
    })

    // Validate data structure
    expect(testData.movies.length).toBeGreaterThan(0)
    expect(testData.users.every(user => user.email.includes('@'))).toBeTruthy()
    expect(testData.requests.every(req => ['pending', 'approved', 'completed'].includes(req.status))).toBeTruthy()

    await mockIntegration.cleanup()
  })

  test('Scenario group selection', async ({ page }) => {
    const mockIntegration = await setupApiTesting(page, {
      scenarios: SCENARIO_GROUPS.NETWORK_ISSUES
    })

    // Apply different scenario groups dynamically
    await mockIntegration.applyScenarios(SCENARIO_GROUPS.AUTH_ISSUES)
    
    // Test authentication with auth-specific failures
    await page.goto('http://localhost:3000/login')
    await page.fill('[data-testid="email"]', 'test@example.com')
    await page.fill('[data-testid="password"]', 'password')
    await page.click('[data-testid="login-submit"]')

    // Switch to data issues
    await mockIntegration.applyScenarios(SCENARIO_GROUPS.DATA_ISSUES)

    // Navigate to data-heavy page
    await page.goto('http://localhost:3000/media')

    const stats = await mockIntegration.getStatistics()
    console.log('Scenario Application Results:', stats.scenarios)

    await mockIntegration.cleanup()
  })
})

// ==================== DEBUGGING EXAMPLES ====================

test.describe('Debugging and Analysis Examples', () => {
  test('Request history analysis', async ({ page }) => {
    const mockIntegration = await setupApiTesting(page)

    await page.goto('http://localhost:3000')
    await page.click('[data-testid="dashboard-link"]')
    await page.click('[data-testid="media-link"]')
    await page.fill('[data-testid="search-input"]', 'test query')
    await page.click('[data-testid="search-button"]')

    // Analyze request history
    const requestHistory = mockIntegration.getRequestHistory()
    
    console.log('Request History Analysis:', {
      totalRequests: requestHistory.length,
      uniqueEndpoints: [...new Set(requestHistory.map(r => r.request.url()))],
      responseTimes: requestHistory
        .filter(r => r.performance)
        .map(r => r.performance!.responseTime),
      errorRequests: requestHistory.filter(r => r.response && r.response.status() >= 400)
    })

    // Verify expected API calls were made
    expect(requestHistory.some(r => r.request.url().includes('/api/v1/media/search'))).toBeTruthy()

    await mockIntegration.cleanup()
  })

  test('Performance bottleneck identification', async ({ page }) => {
    const mockIntegration = await setupApiTesting(page, {
      performanceTesting: true
    })

    await page.goto('http://localhost:3000/dashboard')

    // Wait for all dashboard APIs to complete
    await Promise.all([
      mockIntegration.waitForApiResponse(page, '/api/v1/dashboard/status'),
      mockIntegration.waitForApiResponse(page, '/api/v1/services/status'),
      mockIntegration.waitForApiResponse(page, '/api/v1/dashboard/stats')
    ])

    // Analyze performance bottlenecks
    const stats = await mockIntegration.getStatistics()
    const performanceData = stats.performance

    console.log('Performance Bottleneck Analysis:', performanceData)

    // Identify slow endpoints
    const requestHistory = mockIntegration.getRequestHistory()
    const slowRequests = requestHistory
      .filter(r => r.performance && r.performance.responseTime > 1000)
      .sort((a, b) => (b.performance?.responseTime || 0) - (a.performance?.responseTime || 0))

    console.log('Slow Requests (>1s):', slowRequests.slice(0, 5))

    await mockIntegration.cleanup()
  })
})

// Test helper functions
function logTestResults(testName: string, results: any) {
  console.log(`=== ${testName} Results ===`)
  console.log(JSON.stringify(results, null, 2))
  console.log(`=== End ${testName} ===`)
}