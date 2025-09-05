import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest'
import { IntegrationService, ServiceHealthStatus, ServiceIntegrationConfig } from '@/services/integration.service'
import { initializeRedis, getRedis } from '@/config/redis'
import { PlexApiClient } from '@/integrations/plex/plex-api.client'
import { OverseerrApiClient } from '@/integrations/overseerr/overseerr-api.client'
import { UptimeKumaClient } from '@/integrations/uptime-kuma/uptime-kuma-client'
import { server } from '@/tests/mocks/server'
import { mockState } from '@/tests/mocks/handlers'
import { CircuitState } from '@/utils/circuit-breaker'

// Mock external clients
vi.mock('@/integrations/plex/plex-api.client')
vi.mock('@/integrations/overseerr/overseerr-api.client')
vi.mock('@/integrations/uptime-kuma/uptime-kuma-client')

describe('Service Degradation and Fallback Integration Tests', () => {
  let integrationService: IntegrationService
  let redis: ReturnType<typeof getRedis>
  let mockPlexClient: any
  let mockOverseerrClient: any
  let mockUptimeKumaClient: any

  beforeAll(() => {
    server.listen({ onUnhandledRequest: 'error' })
  })

  afterAll(() => {
    server.close()
  })

  beforeEach(async () => {
    // Initialize Redis
    await initializeRedis()
    redis = getRedis()
    await redis.flushdb()

    // Reset mock state
    server.resetHandlers()
    mockState.plexDown = false
    mockState.plexSlowResponse = false
    mockState.overseerrDown = false
    mockState.overseerrSlowResponse = false
    mockState.resetFailures()

    // Setup mock clients with full functionality
    mockPlexClient = {
      healthCheck: vi.fn(),
      getCircuitBreakerStats: vi.fn(() => ({ state: CircuitState.CLOSED, failures: 0, successes: 0, requests: 0 })),
      resetCircuitBreaker: vi.fn(),
      getUser: vi.fn().mockResolvedValue({ username: 'testuser', id: 'user123' }),
      getServers: vi.fn().mockResolvedValue([{ name: 'Test Server', host: '192.168.1.100' }]),
      getLibraries: vi.fn().mockResolvedValue([{ key: '1', title: 'Movies', type: 'movie' }]),
      validateToken: vi.fn().mockResolvedValue(true)
    }

    mockOverseerrClient = {
      healthCheck: vi.fn(),
      getCircuitBreakerStats: vi.fn(() => ({ state: CircuitState.CLOSED, failures: 0, successes: 0, requests: 0 })),
      resetCircuitBreaker: vi.fn(),
      getStatus: vi.fn().mockResolvedValue({ version: '1.32.0' }),
      getSettings: vi.fn().mockResolvedValue({ hostname: 'overseerr.local' }),
      getRequests: vi.fn().mockResolvedValue({ results: [], pageInfo: { total: 0 } }),
      validateConfiguration: vi.fn().mockResolvedValue(true)
    }

    mockUptimeKumaClient = {
      isHealthy: vi.fn(() => true),
      getCircuitBreakerStats: vi.fn(() => ({ state: CircuitState.CLOSED, failures: 0, successes: 0, requests: 0 })),
      resetCircuitBreaker: vi.fn(),
      connect: vi.fn().mockResolvedValue(true),
      disconnect: vi.fn().mockResolvedValue(true),
      on: vi.fn(),
      getMonitors: vi.fn(() => new Map()),
      getStats: vi.fn(() => ({ up: 0, down: 0, unknown: 0, pause: 0 }))
    }

    // Mock client constructors
    vi.mocked(PlexApiClient.createFromUserToken).mockResolvedValue(mockPlexClient)
    vi.mocked(OverseerrApiClient.createFromConfig).mockResolvedValue(mockOverseerrClient)
    vi.mocked(UptimeKumaClient.createClient).mockReturnValue(mockUptimeKumaClient)
  })

  afterEach(async () => {
    if (integrationService) {
      await integrationService.shutdown()
    }
    await redis.flushdb()
    vi.clearAllMocks()
  })

  describe('Graceful Service Degradation', () => {
    beforeEach(async () => {
      const config: ServiceIntegrationConfig = {
        plex: {
          enabled: true,
          defaultToken: 'plex-token',
          serverUrl: 'http://plex.local:32400'
        },
        overseerr: {
          enabled: true,
          url: 'http://overseerr.local:5055',
          apiKey: 'overseerr-key'
        },
        uptimeKuma: {
          enabled: true,
          url: 'ws://uptime.local:3001'
        }
      }

      integrationService = new IntegrationService(config)
      await integrationService.initialize()
      
      // Initialize healthy state
      mockPlexClient.healthCheck.mockResolvedValue({
        healthy: true,
        lastChecked: new Date(),
        responseTime: 100
      })
      mockOverseerrClient.healthCheck.mockResolvedValue({
        healthy: true,
        lastChecked: new Date(),
        responseTime: 150
      })
      
      // Allow initial health check to complete
      await new Promise(resolve => setTimeout(resolve, 100))
    })

    it('should maintain system functionality when one service fails', async () => {
      // Simulate Plex going down
      mockPlexClient.healthCheck.mockResolvedValue({
        healthy: false,
        lastChecked: new Date(),
        error: 'Service unavailable',
        circuitBreakerState: CircuitState.OPEN
      })
      mockPlexClient.getCircuitBreakerStats.mockReturnValue({
        state: CircuitState.OPEN,
        failures: 5,
        successes: 0,
        requests: 5
      })

      // Force health check update
      await (integrationService as any).performHealthChecks()

      const systemHealth = integrationService.getOverallSystemHealth()
      
      // System should be marked as unhealthy but other services should remain functional
      expect(systemHealth.healthy).toBe(false)
      expect(systemHealth.totalServices).toBe(3)
      expect(systemHealth.healthyServices).toBe(2) // Only Overseerr and UptimeKuma healthy

      // Verify individual service states
      const plexHealth = integrationService.getServiceHealth('plex')
      const overseerrHealth = integrationService.getServiceHealth('overseerr')
      const uptimeKumaHealth = integrationService.getServiceHealth('uptimeKuma')

      expect(plexHealth?.healthy).toBe(false)
      expect(plexHealth?.circuitBreakerState).toBe(CircuitState.OPEN)
      expect(overseerrHealth?.healthy).toBe(true)
      expect(uptimeKumaHealth?.healthy).toBe(true)
    })

    it('should provide fallback responses when primary service is down', async () => {
      // Simulate Plex service failure
      mockPlexClient.getUser.mockRejectedValue(new Error('Service unavailable'))
      mockPlexClient.getServers.mockRejectedValue(new Error('Service unavailable'))
      mockPlexClient.healthCheck.mockResolvedValue({
        healthy: false,
        error: 'Service unavailable',
        lastChecked: new Date()
      })

      // The service should still provide cached data or graceful error responses
      const plexClient = await integrationService.getPlexClient()
      expect(plexClient).not.toBeNull()

      // Even if Plex is down, the client should exist and handle errors gracefully
      await expect(plexClient!.getUser()).rejects.toThrow('Service unavailable')

      // Verify health status reflects the failure
      await (integrationService as any).performHealthChecks()
      const plexHealth = integrationService.getServiceHealth('plex')
      expect(plexHealth?.healthy).toBe(false)
    })

    it('should maintain cached service data during outages', async () => {
      // First, ensure we have cached healthy status
      await (integrationService as any).performHealthChecks()
      await new Promise(resolve => setTimeout(resolve, 100))

      // Verify data is cached
      let cachedPlexStatus = await integrationService.getCachedServiceStatus('plex')
      expect(cachedPlexStatus?.healthy).toBe(true)

      // Now simulate service going down
      mockPlexClient.healthCheck.mockResolvedValue({
        healthy: false,
        error: 'Service temporarily unavailable',
        lastChecked: new Date()
      })

      // Perform health check to update status
      await (integrationService as any).performHealthChecks()
      await new Promise(resolve => setTimeout(resolve, 100))

      // Cached status should now reflect the failure
      cachedPlexStatus = await integrationService.getCachedServiceStatus('plex')
      expect(cachedPlexStatus?.healthy).toBe(false)
      expect(cachedPlexStatus?.error).toBe('Service temporarily unavailable')
    })

    it('should handle partial service recovery', async () => {
      // Start with all services failing
      mockPlexClient.healthCheck.mockResolvedValue({
        healthy: false,
        error: 'Service down',
        lastChecked: new Date()
      })
      mockOverseerrClient.healthCheck.mockResolvedValue({
        healthy: false,
        error: 'Service down',
        lastChecked: new Date()
      })

      await (integrationService as any).performHealthChecks()
      
      let systemHealth = integrationService.getOverallSystemHealth()
      expect(systemHealth.healthyServices).toBe(1) // Only UptimeKuma

      // Plex recovers
      mockPlexClient.healthCheck.mockResolvedValue({
        healthy: true,
        responseTime: 200,
        lastChecked: new Date()
      })

      await (integrationService as any).performHealthChecks()
      
      systemHealth = integrationService.getOverallSystemHealth()
      expect(systemHealth.healthyServices).toBe(2) // Plex and UptimeKuma

      // Overseerr also recovers
      mockOverseerrClient.healthCheck.mockResolvedValue({
        healthy: true,
        responseTime: 250,
        lastChecked: new Date()
      })

      await (integrationService as any).performHealthChecks()
      
      systemHealth = integrationService.getOverallSystemHealth()
      expect(systemHealth.healthy).toBe(true)
      expect(systemHealth.healthyServices).toBe(3) // All services healthy
    })
  })

  describe('Circuit Breaker Integration', () => {
    beforeEach(async () => {
      const config: ServiceIntegrationConfig = {
        plex: { enabled: true, defaultToken: 'plex-token' },
        overseerr: { enabled: true, url: 'http://overseerr.local:5055', apiKey: 'overseerr-key' }
      }

      integrationService = new IntegrationService(config)
      await integrationService.initialize()
    })

    it('should reflect circuit breaker states in health status', async () => {
      // Simulate circuit breaker opening
      mockPlexClient.getCircuitBreakerStats.mockReturnValue({
        state: CircuitState.OPEN,
        failures: 5,
        successes: 10,
        requests: 15,
        nextAttempt: new Date(Date.now() + 30000)
      })

      mockPlexClient.healthCheck.mockResolvedValue({
        healthy: false,
        error: 'Circuit breaker is open',
        lastChecked: new Date(),
        circuitBreakerState: CircuitState.OPEN
      })

      await (integrationService as any).performHealthChecks()

      const plexHealth = integrationService.getServiceHealth('plex')
      expect(plexHealth?.healthy).toBe(false)
      expect(plexHealth?.circuitBreakerState).toBe(CircuitState.OPEN)
      expect(plexHealth?.error).toContain('Circuit breaker is open')
    })

    it('should handle circuit breaker state transitions', async () => {
      // Start with open circuit
      mockPlexClient.getCircuitBreakerStats.mockReturnValue({
        state: CircuitState.OPEN,
        failures: 5,
        successes: 0,
        requests: 5
      })

      mockPlexClient.healthCheck.mockResolvedValue({
        healthy: false,
        error: 'Circuit breaker open',
        lastChecked: new Date(),
        circuitBreakerState: CircuitState.OPEN
      })

      await (integrationService as any).performHealthChecks()
      
      let plexHealth = integrationService.getServiceHealth('plex')
      expect(plexHealth?.circuitBreakerState).toBe(CircuitState.OPEN)

      // Transition to half-open
      mockPlexClient.getCircuitBreakerStats.mockReturnValue({
        state: CircuitState.HALF_OPEN,
        failures: 5,
        successes: 0,
        requests: 6
      })

      mockPlexClient.healthCheck.mockResolvedValue({
        healthy: true,
        responseTime: 100,
        lastChecked: new Date(),
        circuitBreakerState: CircuitState.HALF_OPEN
      })

      await (integrationService as any).performHealthChecks()
      
      plexHealth = integrationService.getServiceHealth('plex')
      expect(plexHealth?.circuitBreakerState).toBe(CircuitState.HALF_OPEN)

      // Transition to closed (recovered)
      mockPlexClient.getCircuitBreakerStats.mockReturnValue({
        state: CircuitState.CLOSED,
        failures: 0,
        successes: 1,
        requests: 7
      })

      mockPlexClient.healthCheck.mockResolvedValue({
        healthy: true,
        responseTime: 80,
        lastChecked: new Date(),
        circuitBreakerState: CircuitState.CLOSED
      })

      await (integrationService as any).performHealthChecks()
      
      plexHealth = integrationService.getServiceHealth('plex')
      expect(plexHealth?.healthy).toBe(true)
      expect(plexHealth?.circuitBreakerState).toBe(CircuitState.CLOSED)
    })

    it('should reset circuit breakers when requested', async () => {
      // Setup open circuits
      mockPlexClient.getCircuitBreakerStats.mockReturnValue({
        state: CircuitState.OPEN,
        failures: 5,
        successes: 0,
        requests: 5
      })

      mockOverseerrClient.getCircuitBreakerStats.mockReturnValue({
        state: CircuitState.OPEN,
        failures: 3,
        successes: 0,
        requests: 3
      })

      // Reset all circuit breakers
      await integrationService.resetCircuitBreakers()

      expect(mockPlexClient.resetCircuitBreaker).toHaveBeenCalled()
      expect(mockOverseerrClient.resetCircuitBreaker).toHaveBeenCalled()
    })

    it('should reset individual service circuit breakers', async () => {
      mockPlexClient.getCircuitBreakerStats.mockReturnValue({
        state: CircuitState.OPEN,
        failures: 5,
        successes: 0,
        requests: 5
      })

      const result = await integrationService.resetServiceCircuitBreaker('plex')
      
      expect(result).toBe(true)
      expect(mockPlexClient.resetCircuitBreaker).toHaveBeenCalled()
      expect(mockOverseerrClient.resetCircuitBreaker).not.toHaveBeenCalled()
    })
  })

  describe('Error Recovery Scenarios', () => {
    beforeEach(async () => {
      const config: ServiceIntegrationConfig = {
        plex: { enabled: true, defaultToken: 'plex-token' },
        overseerr: { enabled: true, url: 'http://overseerr.local:5055', apiKey: 'overseerr-key' }
      }

      integrationService = new IntegrationService(config)
      await integrationService.initialize()
    })

    it('should handle intermittent network failures', async () => {
      let callCount = 0
      
      // Alternate between success and failure
      mockPlexClient.healthCheck.mockImplementation(async () => {
        callCount++
        if (callCount % 2 === 0) {
          throw new Error('Network timeout')
        }
        return {
          healthy: true,
          responseTime: 100,
          lastChecked: new Date()
        }
      })

      // Perform multiple health checks
      for (let i = 0; i < 6; i++) {
        await (integrationService as any).performHealthChecks()
        await new Promise(resolve => setTimeout(resolve, 50))
      }

      // Service should show some instability but not be completely down
      const plexHealth = integrationService.getServiceHealth('plex')
      expect(plexHealth).toBeDefined()
      
      // The last health check result should be recorded
      expect(plexHealth?.lastChecked).toBeInstanceOf(Date)
    })

    it('should recover from service authentication failures', async () => {
      // Start with auth failure
      mockPlexClient.healthCheck.mockResolvedValue({
        healthy: false,
        error: 'Authentication failed',
        lastChecked: new Date()
      })

      mockPlexClient.validateToken.mockResolvedValue(false)

      await (integrationService as any).performHealthChecks()
      
      let plexHealth = integrationService.getServiceHealth('plex')
      expect(plexHealth?.healthy).toBe(false)
      expect(plexHealth?.error).toBe('Authentication failed')

      // Auth issue resolved
      mockPlexClient.healthCheck.mockResolvedValue({
        healthy: true,
        responseTime: 120,
        lastChecked: new Date()
      })

      mockPlexClient.validateToken.mockResolvedValue(true)

      await (integrationService as any).performHealthChecks()
      
      plexHealth = integrationService.getServiceHealth('plex')
      expect(plexHealth?.healthy).toBe(true)
    })

    it('should handle service configuration changes', async () => {
      // Service initially working
      mockOverseerrClient.healthCheck.mockResolvedValue({
        healthy: true,
        responseTime: 100,
        lastChecked: new Date()
      })

      await (integrationService as any).performHealthChecks()
      
      let overseerrHealth = integrationService.getServiceHealth('overseerr')
      expect(overseerrHealth?.healthy).toBe(true)

      // Configuration becomes invalid
      mockOverseerrClient.healthCheck.mockResolvedValue({
        healthy: false,
        error: 'Configuration error - invalid API key',
        lastChecked: new Date()
      })

      mockOverseerrClient.validateConfiguration.mockResolvedValue(false)

      await (integrationService as any).performHealthChecks()
      
      overseerrHealth = integrationService.getServiceHealth('overseerr')
      expect(overseerrHealth?.healthy).toBe(false)
      expect(overseerrHealth?.error).toContain('Configuration error')

      // Configuration fixed
      mockOverseerrClient.healthCheck.mockResolvedValue({
        healthy: true,
        responseTime: 150,
        lastChecked: new Date()
      })

      mockOverseerrClient.validateConfiguration.mockResolvedValue(true)

      await (integrationService as any).performHealthChecks()
      
      overseerrHealth = integrationService.getServiceHealth('overseerr')
      expect(overseerrHealth?.healthy).toBe(true)
    })
  })

  describe('Resource Management During Degradation', () => {
    beforeEach(async () => {
      const config: ServiceIntegrationConfig = {
        plex: { enabled: true, defaultToken: 'plex-token' },
        overseerr: { enabled: true, url: 'http://overseerr.local:5055', apiKey: 'overseerr-key' },
        uptimeKuma: { enabled: true, url: 'ws://uptime.local:3001' }
      }

      integrationService = new IntegrationService(config)
      await integrationService.initialize()
    })

    it('should handle Redis failures gracefully', async () => {
      // Simulate Redis connection failure
      const originalSetex = redis.setex
      const originalGet = redis.get
      
      redis.setex = vi.fn().mockRejectedValue(new Error('Redis connection lost'))
      redis.get = vi.fn().mockRejectedValue(new Error('Redis connection lost'))

      mockPlexClient.healthCheck.mockResolvedValue({
        healthy: true,
        responseTime: 100,
        lastChecked: new Date()
      })

      // Health check should still work despite Redis failure
      await (integrationService as any).performHealthChecks()

      const plexHealth = integrationService.getServiceHealth('plex')
      expect(plexHealth?.healthy).toBe(true)

      // Cached status should return null due to Redis failure
      const cachedStatus = await integrationService.getCachedServiceStatus('plex')
      expect(cachedStatus).toBeNull()

      // Restore Redis
      redis.setex = originalSetex
      redis.get = originalGet
    })

    it('should handle WebSocket connection failures', async () => {
      // Simulate UptimeKuma WebSocket failure
      mockUptimeKumaClient.connect.mockRejectedValue(new Error('WebSocket connection failed'))
      mockUptimeKumaClient.isHealthy.mockReturnValue(false)

      // Service should handle WebSocket failure gracefully
      const uptimeKumaClient = integrationService.getUptimeKumaClient()
      expect(uptimeKumaClient).not.toBeNull()

      // Health status should reflect WebSocket failure
      await (integrationService as any).performHealthChecks()
      
      const uptimeHealth = integrationService.getServiceHealth('uptimeKuma')
      expect(uptimeHealth?.healthy).toBe(false)
    })

    it('should handle memory pressure during service failures', async () => {
      // Simulate multiple service failures creating memory pressure
      const heavyErrorData = 'x'.repeat(10000) // Large error message

      mockPlexClient.healthCheck.mockResolvedValue({
        healthy: false,
        error: `Heavy error data: ${heavyErrorData}`,
        lastChecked: new Date()
      })

      mockOverseerrClient.healthCheck.mockResolvedValue({
        healthy: false,
        error: `Another heavy error: ${heavyErrorData}`,
        lastChecked: new Date()
      })

      // System should handle large error messages without issues
      await (integrationService as any).performHealthChecks()

      const systemHealth = integrationService.getOverallSystemHealth()
      expect(systemHealth).toBeDefined()
      expect(systemHealth.healthy).toBe(false)
      
      // Errors should be present but system should remain stable
      const plexHealth = integrationService.getServiceHealth('plex')
      const overseerrHealth = integrationService.getServiceHealth('overseerr')
      
      expect(plexHealth?.error).toContain('Heavy error data')
      expect(overseerrHealth?.error).toContain('Another heavy error')
    })

    it('should handle concurrent health check failures', async () => {
      // Simulate all services taking a long time and failing
      mockPlexClient.healthCheck.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 100))
        throw new Error('Plex timeout')
      })

      mockOverseerrClient.healthCheck.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 150))
        throw new Error('Overseerr timeout')
      })

      const startTime = Date.now()
      await (integrationService as any).performHealthChecks()
      const duration = Date.now() - startTime

      // Health checks should run concurrently, not sequentially
      expect(duration).toBeLessThan(300) // Less than sum of individual timeouts

      const systemHealth = integrationService.getOverallSystemHealth()
      expect(systemHealth.healthy).toBe(false)
      expect(systemHealth.healthyServices).toBe(1) // Only UptimeKuma should be healthy

      const plexHealth = integrationService.getServiceHealth('plex')
      const overseerrHealth = integrationService.getServiceHealth('overseerr')
      
      expect(plexHealth?.healthy).toBe(false)
      expect(plexHealth?.error).toBe('Plex timeout')
      expect(overseerrHealth?.healthy).toBe(false)
      expect(overseerrHealth?.error).toBe('Overseerr timeout')
    })
  })

  describe('Event Handling During Degradation', () => {
    beforeEach(async () => {
      const config: ServiceIntegrationConfig = {
        plex: { enabled: true, defaultToken: 'plex-token' },
        overseerr: { enabled: true, url: 'http://overseerr.local:5055', apiKey: 'overseerr-key' }
      }

      integrationService = new IntegrationService(config)
      await integrationService.initialize()
    })

    it('should emit health change events during degradation', async () => {
      const healthChangeEvents: any[] = []
      integrationService.on('serviceHealthChanged', (event) => {
        healthChangeEvents.push(event)
      })

      // Start healthy
      mockPlexClient.healthCheck.mockResolvedValue({
        healthy: true,
        responseTime: 100,
        lastChecked: new Date()
      })

      await (integrationService as any).performHealthChecks()
      
      // Now go unhealthy
      mockPlexClient.healthCheck.mockResolvedValue({
        healthy: false,
        error: 'Service degraded',
        lastChecked: new Date()
      })

      await (integrationService as any).performHealthChecks()

      // Should have received health change event
      expect(healthChangeEvents.length).toBeGreaterThan(0)
      
      const degradationEvent = healthChangeEvents.find(event => 
        event.service === 'plex' && event.healthy === false
      )
      
      expect(degradationEvent).toBeDefined()
      expect(degradationEvent.error).toBe('Service degraded')
    })

    it('should emit recovery events', async () => {
      const healthChangeEvents: any[] = []
      integrationService.on('serviceHealthChanged', (event) => {
        healthChangeEvents.push(event)
      })

      // Start unhealthy
      mockPlexClient.healthCheck.mockResolvedValue({
        healthy: false,
        error: 'Service down',
        lastChecked: new Date()
      })

      await (integrationService as any).performHealthChecks()

      // Recover
      mockPlexClient.healthCheck.mockResolvedValue({
        healthy: true,
        responseTime: 120,
        lastChecked: new Date()
      })

      await (integrationService as any).performHealthChecks()

      // Should have received recovery event
      const recoveryEvent = healthChangeEvents.find(event => 
        event.service === 'plex' && event.healthy === true
      )
      
      expect(recoveryEvent).toBeDefined()
      expect(recoveryEvent.responseTime).toBe(120)
    })
  })
})