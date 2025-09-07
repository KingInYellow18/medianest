/**
 * Mock Integration Layer for MediaNest Playwright Tests
 * Seamlessly integrates API mocking with existing Page Object Models
 */

import { Page, Request, Response } from '@playwright/test'
import MediaNestMockServer, { MockServerConfig } from './mock-server'
import { MockScenarioManager } from './scenario-manager'
import { EdgeCaseSimulator } from './edge-case-simulator'
import PerformanceTester from './performance-tester'
import TestDataGenerator from './test-data-generator'
import HiveMindCoordinator from './hive-mind-coordinator'

export interface MockIntegrationConfig {
  enableMocking: boolean
  mockServerConfig: MockServerConfig
  interceptRealRequests: boolean
  recordMode: 'off' | 'record' | 'replay'
  scenarios: string[]
  performanceTesting: boolean
  dataGeneration: boolean
}

export interface MockRequestContext {
  request: Request
  response?: Response
  page: Page
  timestamp: number
  scenario?: string
  performance?: {
    responseTime: number
    size: number
  }
}

export class MockIntegration {
  private mockServer: MediaNestMockServer | null = null
  private hiveMind: HiveMindCoordinator
  private scenarioManager: MockScenarioManager
  private edgeCaseSimulator: EdgeCaseSimulator
  private performanceTester: PerformanceTester
  private dataGenerator: TestDataGenerator
  private config: MockIntegrationConfig
  private interceptedRequests: MockRequestContext[] = []
  private isInitialized = false

  constructor(config: MockIntegrationConfig) {
    this.config = config
    
    // Initialize HIVE-MIND coordinator
    this.hiveMind = new HiveMindCoordinator({
      nodeId: `mock-integration-${Date.now()}`,
      enablePersistence: true,
      coordinationType: 'distributed'
    })

    this.scenarioManager = new MockScenarioManager(this.hiveMind)
    this.edgeCaseSimulator = new EdgeCaseSimulator(this.scenarioManager)
    this.performanceTester = new PerformanceTester(this.hiveMind, this.edgeCaseSimulator)
    this.dataGenerator = new TestDataGenerator()
  }

  /**
   * Initialize mock integration for a Playwright page
   */
  async initializeForPage(page: Page): Promise<void> {
    if (this.isInitialized && this.mockServer) {
      console.log('🔄 Mock integration already initialized, applying to new page')
      await this.attachToPage(page)
      return
    }

    console.log('🚀 Initializing MediaNest Mock Integration...')

    // Initialize HIVE-MIND
    await this.hiveMind.initialize()

    // Start mock server if mocking is enabled
    if (this.config.enableMocking) {
      this.mockServer = new MediaNestMockServer(this.config.mockServerConfig)
      await this.mockServer.start()
      
      // Apply initial scenarios
      if (this.config.scenarios.length > 0) {
        await this.mockServer.applyScenarios(this.config.scenarios)
      }
    }

    // Attach to the page
    await this.attachToPage(page)

    // Initialize performance testing if enabled
    if (this.config.performanceTesting) {
      await this.initializePerformanceTesting()
    }

    // Store initial state in HIVE-MIND
    await this.hiveMind.storeState('mock.integration.initialized', {
      timestamp: Date.now(),
      config: this.config,
      pageUrl: page.url()
    })

    this.isInitialized = true
    console.log('✅ Mock integration initialized successfully')
  }

  /**
   * Attach mock integration to a Playwright page
   */
  private async attachToPage(page: Page): Promise<void> {
    // Set up request/response interception
    await page.route('**/api/**', async (route, request) => {
      await this.handleApiRequest(route, request, page)
    })

    // Set up external service interception (Plex, Overseerr, etc.)
    await page.route('**/plex/**', async (route, request) => {
      await this.handleExternalServiceRequest(route, request, 'plex', page)
    })

    await page.route('**/overseerr/**', async (route, request) => {
      await this.handleExternalServiceRequest(route, request, 'overseerr', page)
    })

    // Set up response monitoring
    page.on('response', async (response) => {
      await this.handleResponse(response, page)
    })

    // Set up request monitoring
    page.on('request', async (request) => {
      await this.handleRequest(request, page)
    })

    console.log(`🔗 Mock integration attached to page: ${page.url()}`)
  }

  /**
   * Handle API requests with mocking logic
   */
  private async handleApiRequest(route: any, request: Request, page: Page): Promise<void> {
    const url = request.url()
    const method = request.method()
    
    console.log(`🌐 Intercepted API request: ${method} ${url}`)

    // Store request context in HIVE-MIND
    const requestContext: MockRequestContext = {
      request,
      page,
      timestamp: Date.now()
    }

    // Check if we should mock this request
    if (this.config.enableMocking && this.mockServer) {
      // Let MSW handle the request
      await route.continue()
    } else if (this.config.interceptRealRequests) {
      // Record or replay based on configuration
      if (this.config.recordMode === 'record') {
        await this.recordRequest(route, request, page)
      } else if (this.config.recordMode === 'replay') {
        await this.replayRequest(route, request, page)
      } else {
        await route.continue()
      }
    } else {
      // Pass through to real API
      await route.continue()
    }

    this.interceptedRequests.push(requestContext)

    // Notify HIVE-MIND of request
    await this.hiveMind.storeState(`requests.${Date.now()}`, {
      url,
      method,
      timestamp: Date.now(),
      page: page.url()
    })
  }

  /**
   * Handle external service requests (Plex, Overseerr, etc.)
   */
  private async handleExternalServiceRequest(
    route: any, 
    request: Request, 
    service: string, 
    page: Page
  ): Promise<void> {
    console.log(`🔌 Intercepted ${service} request: ${request.url()}`)

    if (this.config.enableMocking) {
      // Use mock server's external service handlers
      await route.continue()
    } else {
      // Log external service calls for analysis
      await this.hiveMind.storeState(`external.${service}.${Date.now()}`, {
        url: request.url(),
        method: request.method(),
        timestamp: Date.now(),
        page: page.url()
      })
      
      await route.continue()
    }
  }

  /**
   * Handle response monitoring
   */
  private async handleResponse(response: Response, page: Page): Promise<void> {
    const url = response.url()
    const status = response.status()
    
    // Only track API responses
    if (url.includes('/api/') || url.includes('plex') || url.includes('overseerr')) {
      const responseTime = Date.now() - (response.request().timing()?.responseStart || Date.now())
      
      // Store response metrics
      await this.hiveMind.updateState('response.metrics', {
        [`${url}_${Date.now()}`]: {
          url,
          status,
          responseTime,
          size: await this.getResponseSize(response),
          timestamp: Date.now()
        }
      })

      // Update intercepted request with response data
      const matchingRequest = this.interceptedRequests.find(
        ctx => ctx.request.url() === url && !ctx.response
      )
      
      if (matchingRequest) {
        matchingRequest.response = response
        matchingRequest.performance = {
          responseTime,
          size: await this.getResponseSize(response)
        }
      }

      console.log(`📊 Response tracked: ${status} ${url} (${responseTime}ms)`)
    }
  }

  /**
   * Handle request monitoring
   */
  private async handleRequest(request: Request, page: Page): Promise<void> {
    // Track all requests for performance analysis
    if (this.config.performanceTesting) {
      await this.hiveMind.updateState('request.tracking', {
        [`${request.url()}_${Date.now()}`]: {
          url: request.url(),
          method: request.method(),
          timestamp: Date.now(),
          page: page.url()
        }
      })
    }
  }

  /**
   * Record request for later replay
   */
  private async recordRequest(route: any, request: Request, page: Page): Promise<void> {
    // Continue with real request to record response
    await route.continue()
    
    // The response will be captured in handleResponse
    console.log(`📹 Recording request: ${request.method()} ${request.url()}`)
  }

  /**
   * Replay previously recorded request
   */
  private async replayRequest(route: any, request: Request, page: Page): Promise<void> {
    const recordedResponse = await this.hiveMind.getState(`recorded.${request.url()}`)
    
    if (recordedResponse) {
      await route.fulfill({
        status: recordedResponse.status,
        contentType: recordedResponse.contentType,
        body: recordedResponse.body
      })
      console.log(`▶️ Replaying recorded response for: ${request.url()}`)
    } else {
      console.log(`⚠️ No recorded response found for: ${request.url()}, falling back to real request`)
      await route.continue()
    }
  }

  /**
   * Get response size
   */
  private async getResponseSize(response: Response): Promise<number> {
    try {
      const body = await response.body()
      return body.length
    } catch {
      return 0
    }
  }

  /**
   * Initialize performance testing
   */
  private async initializePerformanceTesting(): Promise<void> {
    console.log('⚡ Initializing performance testing capabilities...')
    
    // Set up baseline performance monitoring
    await this.hiveMind.storeState('performance.monitoring', {
      enabled: true,
      startTime: Date.now(),
      baseline: null
    })
  }

  /**
   * Apply mock scenarios during test execution
   */
  async applyScenarios(scenarios: string[]): Promise<void> {
    if (!this.mockServer) {
      console.warn('Mock server not initialized, cannot apply scenarios')
      return
    }

    await this.mockServer.applyScenarios(scenarios)
    await this.hiveMind.storeState('mock.scenarios.active', scenarios)
    
    console.log(`🎭 Applied mock scenarios: ${scenarios.join(', ')}`)
  }

  /**
   * Start edge case simulation
   */
  async startEdgeCaseSimulation(config?: any): Promise<void> {
    await this.edgeCaseSimulator.startSimulation(config)
    console.log('🎯 Edge case simulation started')
  }

  /**
   * Run performance test suite
   */
  async runPerformanceTests(): Promise<any> {
    if (!this.config.performanceTesting) {
      console.warn('Performance testing not enabled')
      return null
    }

    const results = await this.performanceTester.runPerformanceTestSuite()
    await this.hiveMind.storeState('performance.test.results', results)
    
    return results
  }

  /**
   * Generate test data for scenarios
   */
  generateTestData(): {
    movies: any[]
    tvShows: any[]
    users: any[]
    requests: any[]
    services: any[]
  } {
    if (!this.config.dataGeneration) {
      console.warn('Data generation not enabled')
      return {
        movies: [],
        tvShows: [],
        users: [],
        requests: [],
        services: []
      }
    }

    return this.dataGenerator.generateCompleteDataset()
  }

  /**
   * Get mock integration statistics
   */
  async getStatistics(): Promise<{
    requests: {
      total: number
      intercepted: number
      mocked: number
      recorded: number
    }
    performance: any
    scenarios: any
    hiveMind: any
  }> {
    const interceptedCount = this.interceptedRequests.length
    const mockedCount = this.interceptedRequests.filter(ctx => ctx.scenario).length
    
    return {
      requests: {
        total: interceptedCount,
        intercepted: interceptedCount,
        mocked: mockedCount,
        recorded: 0 // TODO: implement recording statistics
      },
      performance: await this.hiveMind.getState('performance.monitoring'),
      scenarios: this.scenarioManager.getScenarioStats(),
      hiveMind: this.hiveMind.getStatus()
    }
  }

  /**
   * Wait for specific API responses
   */
  async waitForApiResponse(page: Page, urlPattern: string | RegExp, timeout = 30000): Promise<Response> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Timeout waiting for API response matching: ${urlPattern}`))
      }, timeout)

      page.on('response', (response) => {
        const url = response.url()
        const matches = typeof urlPattern === 'string' 
          ? url.includes(urlPattern)
          : urlPattern.test(url)
          
        if (matches) {
          clearTimeout(timer)
          resolve(response)
        }
      })
    })
  }

  /**
   * Assert API response characteristics
   */
  async assertApiResponse(
    page: Page, 
    urlPattern: string | RegExp, 
    expectations: {
      status?: number
      maxResponseTime?: number
      contentType?: string
      bodyContains?: string
    }
  ): Promise<void> {
    const response = await this.waitForApiResponse(page, urlPattern)
    
    if (expectations.status && response.status() !== expectations.status) {
      throw new Error(`Expected status ${expectations.status}, got ${response.status()}`)
    }

    if (expectations.contentType) {
      const contentType = response.headers()['content-type']
      if (!contentType?.includes(expectations.contentType)) {
        throw new Error(`Expected content type ${expectations.contentType}, got ${contentType}`)
      }
    }

    if (expectations.bodyContains) {
      const body = await response.text()
      if (!body.includes(expectations.bodyContains)) {
        throw new Error(`Response body does not contain: ${expectations.bodyContains}`)
      }
    }

    console.log(`✅ API response assertion passed for: ${urlPattern}`)
  }

  /**
   * Get request history for analysis
   */
  getRequestHistory(): MockRequestContext[] {
    return [...this.interceptedRequests]
  }

  /**
   * Clear request history
   */
  clearRequestHistory(): void {
    this.interceptedRequests = []
  }

  /**
   * Export mock integration data
   */
  async exportData(): Promise<{
    requests: MockRequestContext[]
    hiveMindState: Record<string, any>
    statistics: any
  }> {
    return {
      requests: this.interceptedRequests,
      hiveMindState: this.hiveMind.exportState(),
      statistics: await this.getStatistics()
    }
  }

  /**
   * Cleanup and shutdown integration
   */
  async cleanup(): Promise<void> {
    console.log('🧹 Cleaning up mock integration...')

    // Stop mock server
    if (this.mockServer) {
      await this.mockServer.stop()
    }

    // Stop edge case simulation
    await this.edgeCaseSimulator.reset()

    // Cleanup performance tester
    await this.performanceTester.cleanup()

    // Cleanup HIVE-MIND
    await this.hiveMind.cleanup()

    // Clear local state
    this.interceptedRequests = []
    this.isInitialized = false

    console.log('✅ Mock integration cleanup completed')
  }

  /**
   * Create mock integration instance for tests
   */
  static create(config: Partial<MockIntegrationConfig> = {}): MockIntegration {
    const defaultConfig: MockIntegrationConfig = {
      enableMocking: true,
      mockServerConfig: {
        mode: 'testing',
        baseUrl: 'http://localhost:3001',
        apiVersion: 'v1',
        enableHiveMind: true,
        scenarios: [],
        persistence: false
      },
      interceptRealRequests: false,
      recordMode: 'off',
      scenarios: [],
      performanceTesting: false,
      dataGeneration: true
    }

    return new MockIntegration({ ...defaultConfig, ...config })
  }
}

export default MockIntegration