/**
 * Enhanced Base Page with API Mocking Integration
 * Extends existing page objects with comprehensive API testing capabilities
 */

import { Page, Locator, expect } from '@playwright/test'
import MockIntegration, { MockIntegrationConfig } from './mock-integration'

export interface ApiTestOptions {
  enableMocking: boolean
  scenarios: string[]
  performanceMonitoring: boolean
  edgeCaseTesting: boolean
  timeout: number
}

export interface ApiAssertionOptions {
  expectedStatus: number
  maxResponseTime?: number
  minResponseTime?: number
  contentType?: string
  bodySchema?: any
  errorHandling?: boolean
}

export class EnhancedPageBase {
  protected page: Page
  protected mockIntegration: MockIntegration
  protected apiTestOptions: ApiTestOptions

  constructor(page: Page, options: Partial<ApiTestOptions> = {}) {
    this.page = page
    this.apiTestOptions = {
      enableMocking: true,
      scenarios: [],
      performanceMonitoring: false,
      edgeCaseTesting: false,
      timeout: 30000,
      ...options
    }

    // Initialize mock integration
    const mockConfig: MockIntegrationConfig = {
      enableMocking: this.apiTestOptions.enableMocking,
      mockServerConfig: {
        mode: 'testing',
        baseUrl: process.env.API_BASE_URL || 'http://localhost:3001',
        apiVersion: 'v1',
        enableHiveMind: true,
        scenarios: this.apiTestOptions.scenarios,
        persistence: true,
        coordinationId: `page-${Date.now()}`
      },
      interceptRealRequests: true,
      recordMode: 'off',
      scenarios: this.apiTestOptions.scenarios,
      performanceTesting: this.apiTestOptions.performanceMonitoring,
      dataGeneration: true
    }

    this.mockIntegration = MockIntegration.create(mockConfig)
  }

  /**
   * Initialize page with API mocking capabilities
   */
  async initializeApiTesting(): Promise<void> {
    await this.mockIntegration.initializeForPage(this.page)
    
    if (this.apiTestOptions.edgeCaseTesting) {
      await this.mockIntegration.startEdgeCaseSimulation()
    }
  }

  /**
   * Navigate with API readiness verification
   */
  async navigateWithApiCheck(url: string, options?: {
    waitForApi?: string[]
    expectedResponses?: Array<{ url: string; status: number }>
  }): Promise<void> {
    // Set up API response expectations before navigation
    const responsePromises: Promise<any>[] = []
    
    if (options?.waitForApi) {
      options.waitForApi.forEach(apiEndpoint => {
        responsePromises.push(
          this.waitForApiResponse(apiEndpoint, { expectedStatus: 200 })
        )
      })
    }

    // Navigate to URL
    await this.page.goto(url, { waitUntil: 'networkidle' })

    // Wait for expected API responses
    if (responsePromises.length > 0) {
      await Promise.all(responsePromises)
    }

    // Verify expected responses if specified
    if (options?.expectedResponses) {
      for (const expectedResponse of options.expectedResponses) {
        await this.assertApiResponse(expectedResponse.url, {
          expectedStatus: expectedResponse.status
        })
      }
    }
  }

  /**
   * Wait for specific API response with comprehensive validation
   */
  async waitForApiResponse(
    urlPattern: string | RegExp, 
    options: ApiAssertionOptions = { expectedStatus: 200 }
  ): Promise<any> {
    const startTime = Date.now()
    
    try {
      const response = await this.mockIntegration.waitForApiResponse(
        this.page, 
        urlPattern, 
        this.apiTestOptions.timeout
      )

      const responseTime = Date.now() - startTime

      // Validate response status
      expect(response.status()).toBe(options.expectedStatus)

      // Validate response time if specified
      if (options.maxResponseTime) {
        expect(responseTime).toBeLessThanOrEqual(options.maxResponseTime)
      }

      if (options.minResponseTime) {
        expect(responseTime).toBeGreaterThanOrEqual(options.minResponseTime)
      }

      // Validate content type if specified
      if (options.contentType) {
        const contentType = response.headers()['content-type'] || ''
        expect(contentType).toContain(options.contentType)
      }

      // Validate response body schema if specified
      if (options.bodySchema) {
        const responseBody = await response.json()
        await this.validateResponseSchema(responseBody, options.bodySchema)
      }

      return {
        response,
        responseTime,
        body: await response.json().catch(() => null),
        headers: response.headers()
      }

    } catch (error) {
      if (options.errorHandling) {
        console.warn(`API response error handled: ${error}`)
        return null
      }
      throw error
    }
  }

  /**
   * Assert API response with detailed validation
   */
  async assertApiResponse(
    urlPattern: string | RegExp, 
    options: ApiAssertionOptions
  ): Promise<void> {
    await this.mockIntegration.assertApiResponse(this.page, urlPattern, {
      status: options.expectedStatus,
      maxResponseTime: options.maxResponseTime,
      contentType: options.contentType
    })
  }

  /**
   * Perform action with API monitoring
   */
  async performActionWithApiMonitoring<T>(
    action: () => Promise<T>,
    expectedApiCalls: Array<{
      url: string | RegExp
      method?: string
      status?: number
    }> = []
  ): Promise<{
    result: T
    apiCalls: any[]
    performance: {
      totalTime: number
      apiResponseTimes: number[]
    }
  }> {
    const startTime = Date.now()
    const initialRequestCount = this.mockIntegration.getRequestHistory().length

    // Clear previous request history
    this.mockIntegration.clearRequestHistory()

    // Set up API response monitoring
    const apiResponsePromises = expectedApiCalls.map(expectedCall => 
      this.waitForApiResponse(expectedCall.url, {
        expectedStatus: expectedCall.status || 200
      }).catch(error => ({ error, expectedCall }))
    )

    // Perform the action
    const result = await action()

    // Wait for all expected API responses
    const apiResponses = await Promise.all(apiResponsePromises)
    const totalTime = Date.now() - startTime

    // Get request history
    const apiCalls = this.mockIntegration.getRequestHistory()

    // Calculate performance metrics
    const apiResponseTimes = apiResponses
      .filter(response => response && !response.error)
      .map(response => response.responseTime)

    return {
      result,
      apiCalls,
      performance: {
        totalTime,
        apiResponseTimes
      }
    }
  }

  /**
   * Test API endpoint directly
   */
  async testApiEndpoint(
    endpoint: string,
    options: {
      method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
      body?: any
      headers?: Record<string, string>
      expectedStatus?: number
      expectedSchema?: any
    } = {}
  ): Promise<any> {
    const {
      method = 'GET',
      body,
      headers = {},
      expectedStatus = 200,
      expectedSchema
    } = options

    const response = await this.page.request.fetch(endpoint, {
      method,
      data: body,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    })

    expect(response.status()).toBe(expectedStatus)

    let responseBody = null
    try {
      responseBody = await response.json()
    } catch (error) {
      if (expectedStatus === 200) {
        throw new Error(`Failed to parse JSON response: ${error}`)
      }
    }

    if (expectedSchema && responseBody) {
      await this.validateResponseSchema(responseBody, expectedSchema)
    }

    return {
      status: response.status(),
      body: responseBody,
      headers: response.headers()
    }
  }

  /**
   * Simulate API failures for error handling tests
   */
  async simulateApiFailures(scenarios: string[]): Promise<void> {
    await this.mockIntegration.applyScenarios(scenarios)
  }

  /**
   * Test API performance under load
   */
  async testApiPerformance(
    action: () => Promise<void>,
    options: {
      iterations: number
      concurrency: number
      maxResponseTime: number
    }
  ): Promise<{
    totalTime: number
    averageResponseTime: number
    maxResponseTime: number
    minResponseTime: number
    errorCount: number
  }> {
    const results: number[] = []
    let errorCount = 0

    const startTime = Date.now()

    // Run iterations with specified concurrency
    const batches = Math.ceil(options.iterations / options.concurrency)
    
    for (let batch = 0; batch < batches; batch++) {
      const batchPromises: Promise<void>[] = []
      const currentBatchSize = Math.min(
        options.concurrency, 
        options.iterations - batch * options.concurrency
      )

      for (let i = 0; i < currentBatchSize; i++) {
        batchPromises.push(
          action().then(() => {
            results.push(Date.now())
          }).catch(() => {
            errorCount++
          })
        )
      }

      await Promise.all(batchPromises)
    }

    const totalTime = Date.now() - startTime
    const responseTimes = results.map((endTime, index) => 
      endTime - (startTime + index * (totalTime / results.length))
    )

    return {
      totalTime,
      averageResponseTime: responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length,
      maxResponseTime: Math.max(...responseTimes),
      minResponseTime: Math.min(...responseTimes),
      errorCount
    }
  }

  /**
   * Validate response against JSON schema
   */
  private async validateResponseSchema(response: any, schema: any): Promise<void> {
    // Simple schema validation - in production, use a proper JSON schema validator
    for (const [key, expectedType] of Object.entries(schema)) {
      if (response[key] === undefined || response[key] === null) {
        throw new Error(`Missing required field: ${key}`)
      }

      const actualType = typeof response[key]
      if (actualType !== expectedType) {
        throw new Error(`Field ${key} has type ${actualType}, expected ${expectedType}`)
      }
    }
  }

  /**
   * Wait for element with API loading state
   */
  async waitForElementWithApiLoading(
    locator: Locator,
    options: {
      loadingSelector?: string
      apiEndpoint?: string
      timeout?: number
    } = {}
  ): Promise<void> {
    const timeout = options.timeout || this.apiTestOptions.timeout

    // Wait for loading state to disappear if specified
    if (options.loadingSelector) {
      const loadingElement = this.page.locator(options.loadingSelector)
      await loadingElement.waitFor({ state: 'detached', timeout: timeout / 2 })
    }

    // Wait for API call to complete if specified
    if (options.apiEndpoint) {
      await this.waitForApiResponse(options.apiEndpoint, { expectedStatus: 200 })
    }

    // Wait for the actual element to be visible
    await locator.waitFor({ state: 'visible', timeout })
  }

  /**
   * Click with API response verification
   */
  async clickWithApiVerification(
    locator: Locator,
    expectedApiCall: {
      url: string | RegExp
      status?: number
      method?: string
    }
  ): Promise<void> {
    // Set up API response expectation
    const apiResponsePromise = this.waitForApiResponse(expectedApiCall.url, {
      expectedStatus: expectedApiCall.status || 200
    })

    // Perform the click
    await locator.click()

    // Wait for expected API response
    await apiResponsePromise
  }

  /**
   * Fill form with API validation
   */
  async fillFormWithApiValidation(
    formData: Record<string, string>,
    options: {
      submitButton?: Locator
      validationEndpoint?: string
      expectedValidationStatus?: number
    } = {}
  ): Promise<void> {
    // Fill form fields
    for (const [field, value] of Object.entries(formData)) {
      const fieldLocator = this.page.locator(`[name="${field}"], [id="${field}"]`)
      await fieldLocator.fill(value)

      // Trigger validation if endpoint specified
      if (options.validationEndpoint) {
        await fieldLocator.blur()
        await this.waitForApiResponse(options.validationEndpoint, {
          expectedStatus: options.expectedValidationStatus || 200
        })
      }
    }

    // Submit form if button specified
    if (options.submitButton) {
      await options.submitButton.click()
    }
  }

  /**
   * Get API testing statistics
   */
  async getApiTestingStatistics(): Promise<any> {
    return await this.mockIntegration.getStatistics()
  }

  /**
   * Export test data for analysis
   */
  async exportTestData(): Promise<any> {
    return await this.mockIntegration.exportData()
  }

  /**
   * Clean up API testing resources
   */
  async cleanupApiTesting(): Promise<void> {
    await this.mockIntegration.cleanup()
  }

  /**
   * Take screenshot with API context
   */
  async takeScreenshotWithApiContext(name: string): Promise<void> {
    const statistics = await this.getApiTestingStatistics()
    
    await this.page.screenshot({
      path: `screenshots/${name}-api-context.png`,
      fullPage: true
    })

    // Save API context as JSON
    const fs = require('fs')
    fs.writeFileSync(
      `screenshots/${name}-api-context.json`,
      JSON.stringify(statistics, null, 2)
    )
  }

  /**
   * Assert page state with API data validation
   */
  async assertPageStateWithApiData(
    assertions: Array<{
      locator: Locator
      expectedText?: string
      expectedAttribute?: { name: string; value: string }
      apiDataSource?: string
    }>
  ): Promise<void> {
    for (const assertion of assertions) {
      // Wait for element to be visible
      await assertion.locator.waitFor({ state: 'visible' })

      // Validate expected text
      if (assertion.expectedText) {
        await expect(assertion.locator).toContainText(assertion.expectedText)
      }

      // Validate expected attribute
      if (assertion.expectedAttribute) {
        await expect(assertion.locator).toHaveAttribute(
          assertion.expectedAttribute.name, 
          assertion.expectedAttribute.value
        )
      }

      // Validate against API data if specified
      if (assertion.apiDataSource) {
        const apiData = await this.mockIntegration['hiveMind'].getState(assertion.apiDataSource)
        if (apiData && assertion.expectedText) {
          expect(apiData).toContain(assertion.expectedText)
        }
      }
    }
  }
}

export default EnhancedPageBase