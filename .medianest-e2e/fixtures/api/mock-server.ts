/**
 * Comprehensive API Mocking Framework for MediaNest
 * HIVE-MIND Coordinated Mock Server Infrastructure
 */

import { setupServer } from 'msw/node'
import { setupWorker } from 'msw/browser'
import { rest, RestHandler } from 'msw'
import { HiveMindCoordinator } from '../../../shared/dist/utils/hive-mind-coordinator'
import { MockScenarioManager } from './scenario-manager'
import { ApiEndpointRegistry } from './endpoint-registry'
import { ResponseGenerator } from './response-generator'
import { EdgeCaseSimulator } from './edge-case-simulator'

export interface MockServerConfig {
  mode: 'development' | 'testing' | 'production'
  baseUrl: string
  apiVersion: string
  enableHiveMind: boolean
  scenarios: string[]
  persistence: boolean
  coordinationId?: string
}

export interface MockResponse {
  status: number
  data?: any
  headers?: Record<string, string>
  delay?: number
  error?: boolean
}

export class MediaNestMockServer {
  private server: any
  private worker: any
  private handlers: RestHandler[] = []
  private hiveMind: HiveMindCoordinator
  private scenarioManager: MockScenarioManager
  private endpointRegistry: ApiEndpointRegistry
  private responseGenerator: ResponseGenerator
  private edgeCaseSimulator: EdgeCaseSimulator
  private config: MockServerConfig
  private isRunning = false

  constructor(config: MockServerConfig) {
    this.config = config
    this.hiveMind = new HiveMindCoordinator({
      nodeId: config.coordinationId || 'mock-server',
      enablePersistence: config.persistence,
      coordinationType: 'distributed'
    })
    
    this.scenarioManager = new MockScenarioManager(this.hiveMind)
    this.endpointRegistry = new ApiEndpointRegistry()
    this.responseGenerator = new ResponseGenerator(this.hiveMind)
    this.edgeCaseSimulator = new EdgeCaseSimulator(this.scenarioManager)
    
    this.initializeHandlers()
  }

  /**
   * Initialize all API endpoint handlers
   */
  private initializeHandlers(): void {
    // Authentication endpoints
    this.registerAuthHandlers()
    
    // User management endpoints
    this.registerUserHandlers()
    
    // Media endpoints
    this.registerMediaHandlers()
    
    // Request management endpoints
    this.registerRequestHandlers()
    
    // Service status endpoints
    this.registerServiceHandlers()
    
    // Dashboard endpoints
    this.registerDashboardHandlers()
    
    // Download endpoints
    this.registerDownloadHandlers()
    
    // Admin endpoints
    this.registerAdminHandlers()
    
    // Health check endpoints
    this.registerHealthHandlers()
    
    // External service integration endpoints
    this.registerExternalServiceHandlers()
  }

  /**
   * Authentication endpoint handlers
   */
  private registerAuthHandlers(): void {
    // Login endpoint
    this.handlers.push(
      rest.post(`${this.config.baseUrl}/api/v1/auth/login`, async (req, res, ctx) => {
        const scenario = await this.scenarioManager.getActiveScenario('auth.login')
        const response = await this.responseGenerator.generateAuthResponse('login', scenario)
        
        if (response.error) {
          return res(
            ctx.status(response.status),
            ctx.delay(response.delay || 0),
            ctx.json(response.data)
          )
        }
        
        // Store session state in HIVE-MIND for cross-test persistence
        await this.hiveMind.storeState('auth.session', {
          token: response.data.token,
          user: response.data.user,
          expires: Date.now() + 3600000 // 1 hour
        })
        
        return res(
          ctx.status(200),
          ctx.delay(response.delay || 200),
          ctx.json(response.data),
          ctx.cookie('auth-token', response.data.token, {
            httpOnly: true,
            secure: true,
            maxAge: 3600
          })
        )
      })
    )

    // Logout endpoint
    this.handlers.push(
      rest.post(`${this.config.baseUrl}/api/v1/auth/logout`, async (req, res, ctx) => {
        const scenario = await this.scenarioManager.getActiveScenario('auth.logout')
        
        // Clear session from HIVE-MIND
        await this.hiveMind.clearState('auth.session')
        
        const response = await this.responseGenerator.generateAuthResponse('logout', scenario)
        
        return res(
          ctx.status(response.status),
          ctx.delay(response.delay || 100),
          ctx.json({ success: true }),
          ctx.cookie('auth-token', '', { maxAge: 0 })
        )
      })
    )

    // Token refresh endpoint
    this.handlers.push(
      rest.post(`${this.config.baseUrl}/api/v1/auth/refresh`, async (req, res, ctx) => {
        const scenario = await this.scenarioManager.getActiveScenario('auth.refresh')
        const response = await this.responseGenerator.generateAuthResponse('refresh', scenario)
        
        if (response.error) {
          return res(
            ctx.status(response.status),
            ctx.delay(response.delay || 0),
            ctx.json(response.data)
          )
        }
        
        // Update session in HIVE-MIND
        await this.hiveMind.updateState('auth.session', {
          token: response.data.token,
          refreshedAt: Date.now()
        })
        
        return res(
          ctx.status(200),
          ctx.delay(response.delay || 150),
          ctx.json(response.data)
        )
      })
    )

    // Plex authentication endpoints
    this.registerPlexAuthHandlers()
  }

  /**
   * Plex-specific authentication handlers
   */
  private registerPlexAuthHandlers(): void {
    // Plex PIN request
    this.handlers.push(
      rest.post(`${this.config.baseUrl}/api/v1/auth/plex/pin`, async (req, res, ctx) => {
        const scenario = await this.scenarioManager.getActiveScenario('auth.plex.pin')
        const response = await this.responseGenerator.generatePlexResponse('pin', scenario)
        
        return res(
          ctx.status(response.status),
          ctx.delay(response.delay || 300),
          ctx.json(response.data)
        )
      })
    )

    // Plex callback
    this.handlers.push(
      rest.get(`${this.config.baseUrl}/api/v1/auth/plex/callback`, async (req, res, ctx) => {
        const scenario = await this.scenarioManager.getActiveScenario('auth.plex.callback')
        const response = await this.responseGenerator.generatePlexResponse('callback', scenario)
        
        return res(
          ctx.status(response.status),
          ctx.delay(response.delay || 500),
          ctx.json(response.data)
        )
      })
    )
  }

  /**
   * Media endpoint handlers
   */
  private registerMediaHandlers(): void {
    // Media search
    this.handlers.push(
      rest.get(`${this.config.baseUrl}/api/v1/media/search`, async (req, res, ctx) => {
        const query = req.url.searchParams.get('query')
        const mediaType = req.url.searchParams.get('type')
        const page = parseInt(req.url.searchParams.get('page') || '1')
        
        const scenario = await this.scenarioManager.getActiveScenario('media.search')
        const response = await this.responseGenerator.generateMediaSearchResponse({
          query,
          mediaType,
          page,
          scenario
        })
        
        // Simulate search latency based on query complexity
        const searchDelay = this.calculateSearchDelay(query)
        
        return res(
          ctx.status(response.status),
          ctx.delay(searchDelay),
          ctx.json(response.data)
        )
      })
    )

    // Media details
    this.handlers.push(
      rest.get(`${this.config.baseUrl}/api/v1/media/:type/:id`, async (req, res, ctx) => {
        const { type, id } = req.params
        const scenario = await this.scenarioManager.getActiveScenario('media.details')
        const response = await this.responseGenerator.generateMediaDetailsResponse({
          type: type as string,
          id: id as string,
          scenario
        })
        
        return res(
          ctx.status(response.status),
          ctx.delay(response.delay || 400),
          ctx.json(response.data)
        )
      })
    )

    // Media request
    this.handlers.push(
      rest.post(`${this.config.baseUrl}/api/v1/media/request`, async (req, res, ctx) => {
        const requestData = await req.json()
        const scenario = await this.scenarioManager.getActiveScenario('media.request')
        const response = await this.responseGenerator.generateMediaRequestResponse({
          requestData,
          scenario
        })
        
        // Store request in HIVE-MIND for cross-test state
        if (!response.error) {
          await this.hiveMind.storeState(`media.requests.${response.data.id}`, {
            ...response.data,
            createdAt: Date.now()
          })
        }
        
        return res(
          ctx.status(response.status),
          ctx.delay(response.delay || 600),
          ctx.json(response.data)
        )
      })
    )
  }

  /**
   * Service status endpoint handlers
   */
  private registerServiceHandlers(): void {
    // Service status overview
    this.handlers.push(
      rest.get(`${this.config.baseUrl}/api/v1/services/status`, async (req, res, ctx) => {
        const scenario = await this.scenarioManager.getActiveScenario('services.status')
        const response = await this.responseGenerator.generateServiceStatusResponse(scenario)
        
        return res(
          ctx.status(response.status),
          ctx.delay(response.delay || 800),
          ctx.json(response.data)
        )
      })
    )

    // Individual service status
    this.handlers.push(
      rest.get(`${this.config.baseUrl}/api/v1/services/:serviceName`, async (req, res, ctx) => {
        const { serviceName } = req.params
        const scenario = await this.scenarioManager.getActiveScenario(`services.${serviceName}`)
        const response = await this.responseGenerator.generateIndividualServiceResponse({
          serviceName: serviceName as string,
          scenario
        })
        
        return res(
          ctx.status(response.status),
          ctx.delay(response.delay || 300),
          ctx.json(response.data)
        )
      })
    )
  }

  /**
   * External service integration handlers (Plex, Overseerr, etc.)
   */
  private registerExternalServiceHandlers(): void {
    // Plex API endpoints
    this.registerPlexServiceHandlers()
    
    // Overseerr integration endpoints
    this.registerOverseerrServiceHandlers()
    
    // Uptime Kuma endpoints
    this.registerUptimeKumaHandlers()
  }

  /**
   * Plex service handlers
   */
  private registerPlexServiceHandlers(): void {
    // Plex library search
    this.handlers.push(
      rest.get('*/library/sections', async (req, res, ctx) => {
        const scenario = await this.scenarioManager.getActiveScenario('plex.libraries')
        const response = await this.responseGenerator.generatePlexLibrariesResponse(scenario)
        
        return res(
          ctx.status(response.status),
          ctx.delay(response.delay || 1000),
          ctx.json(response.data)
        )
      })
    )

    // Plex media search
    this.handlers.push(
      rest.get('*/search', async (req, res, ctx) => {
        const query = req.url.searchParams.get('query')
        const scenario = await this.scenarioManager.getActiveScenario('plex.search')
        const response = await this.responseGenerator.generatePlexSearchResponse({
          query,
          scenario
        })
        
        return res(
          ctx.status(response.status),
          ctx.delay(response.delay || 1500),
          ctx.json(response.data)
        )
      })
    )
  }

  /**
   * Overseerr service handlers
   */
  private registerOverseerrServiceHandlers(): void {
    // Overseerr request status
    this.handlers.push(
      rest.get('*/api/v1/request*', async (req, res, ctx) => {
        const scenario = await this.scenarioManager.getActiveScenario('overseerr.requests')
        const response = await this.responseGenerator.generateOverseerrResponse('requests', scenario)
        
        return res(
          ctx.status(response.status),
          ctx.delay(response.delay || 700),
          ctx.json(response.data)
        )
      })
    )
  }

  /**
   * Register all other handlers (User, Request, Dashboard, Download, Admin, Health)
   */
  private registerUserHandlers(): void {
    // Implementation for user management endpoints
  }

  private registerRequestHandlers(): void {
    // Implementation for request management endpoints
  }

  private registerDashboardHandlers(): void {
    // Implementation for dashboard endpoints
  }

  private registerDownloadHandlers(): void {
    // Implementation for download endpoints
  }

  private registerAdminHandlers(): void {
    // Implementation for admin endpoints
  }

  private registerHealthHandlers(): void {
    // Health check endpoint
    this.handlers.push(
      rest.get(`${this.config.baseUrl}/api/v1/health`, async (req, res, ctx) => {
        const scenario = await this.scenarioManager.getActiveScenario('health.check')
        const response = await this.responseGenerator.generateHealthResponse(scenario)
        
        return res(
          ctx.status(response.status),
          ctx.delay(response.delay || 50),
          ctx.json(response.data)
        )
      })
    )
  }

  private registerUptimeKumaHandlers(): void {
    // Implementation for Uptime Kuma endpoints
  }

  /**
   * Calculate search delay based on query complexity
   */
  private calculateSearchDelay(query: string | null): number {
    if (!query) return 200
    
    const baseDelay = 200
    const complexityFactor = query.length * 10
    const randomVariation = Math.random() * 300
    
    return Math.min(baseDelay + complexityFactor + randomVariation, 2000)
  }

  /**
   * Start the mock server
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.warn('Mock server is already running')
      return
    }

    // Initialize HIVE-MIND coordination
    await this.hiveMind.initialize()
    
    // Apply active scenarios
    await this.scenarioManager.applyScenarios(this.config.scenarios)
    
    if (typeof window !== 'undefined') {
      // Browser environment
      this.worker = setupWorker(...this.handlers)
      await this.worker.start({
        onUnhandledRequest: 'bypass',
        serviceWorker: {
          url: '/mockServiceWorker.js'
        }
      })
    } else {
      // Node.js environment
      this.server = setupServer(...this.handlers)
      this.server.listen({
        onUnhandledRequest: 'bypass'
      })
    }

    this.isRunning = true
    
    // Register with HIVE-MIND coordination
    await this.hiveMind.registerNode({
      type: 'mock-server',
      capabilities: ['api-mocking', 'edge-case-simulation', 'service-integration'],
      status: 'active'
    })

    console.log(`🚀 MediaNest Mock Server started in ${this.config.mode} mode`)
    console.log(`🧠 HIVE-MIND coordination: ${this.config.enableHiveMind ? 'enabled' : 'disabled'}`)
    console.log(`📡 Active scenarios: ${this.config.scenarios.join(', ')}`)
  }

  /**
   * Stop the mock server
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      console.warn('Mock server is not running')
      return
    }

    if (this.worker) {
      this.worker.stop()
    }
    
    if (this.server) {
      this.server.close()
    }

    // Cleanup HIVE-MIND coordination
    await this.hiveMind.cleanup()
    
    this.isRunning = false
    console.log('🛑 MediaNest Mock Server stopped')
  }

  /**
   * Reset mock server state
   */
  async reset(): Promise<void> {
    await this.hiveMind.clearAllState()
    await this.scenarioManager.resetScenarios()
    console.log('🔄 Mock server state reset')
  }

  /**
   * Apply new scenarios dynamically
   */
  async applyScenarios(scenarios: string[]): Promise<void> {
    this.config.scenarios = scenarios
    await this.scenarioManager.applyScenarios(scenarios)
    console.log(`🎭 Applied scenarios: ${scenarios.join(', ')}`)
  }

  /**
   * Get current server status
   */
  getStatus(): {
    isRunning: boolean
    config: MockServerConfig
    activeScenarios: string[]
    hiveMindStatus: any
  } {
    return {
      isRunning: this.isRunning,
      config: this.config,
      activeScenarios: this.config.scenarios,
      hiveMindStatus: this.hiveMind.getStatus()
    }
  }
}

export default MediaNestMockServer