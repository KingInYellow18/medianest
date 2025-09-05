import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { IntegrationService, ServiceHealthStatus, ServiceIntegrationConfig } from '@/services/integration.service'
import { initializeRedis, getRedis } from '@/config/redis'
import { PlexApiClient } from '@/integrations/plex/plex-api.client'
import { OverseerrApiClient } from '@/integrations/overseerr/overseerr-api.client'
import { UptimeKumaClient } from '@/integrations/uptime-kuma/uptime-kuma-client'

// Mock external clients
vi.mock('@/integrations/plex/plex-api.client')
vi.mock('@/integrations/overseerr/overseerr-api.client')
vi.mock('@/integrations/uptime-kuma/uptime-kuma-client')

describe('IntegrationService Comprehensive Tests', () => {
  let integrationService: IntegrationService
  let redis: ReturnType<typeof getRedis>
  let mockPlexClient: any
  let mockOverseerrClient: any
  let mockUptimeKumaClient: any

  beforeEach(async () => {
    // Initialize Redis
    await initializeRedis()
    redis = getRedis()
    await redis.flushdb()

    // Setup mock clients
    mockPlexClient = {
      healthCheck: vi.fn(),
      getCircuitBreakerStats: vi.fn(() => ({ state: 'CLOSED' })),
      resetCircuitBreaker: vi.fn(),
    }

    mockOverseerrClient = {
      healthCheck: vi.fn(),
      getCircuitBreakerStats: vi.fn(() => ({ state: 'CLOSED' })),
      resetCircuitBreaker: vi.fn(),
    }

    mockUptimeKumaClient = {
      isHealthy: vi.fn(() => true),
      getCircuitBreakerStats: vi.fn(() => ({ state: 'CLOSED' })),
      resetCircuitBreaker: vi.fn(),
      connect: vi.fn().mockResolvedValue(true),
      disconnect: vi.fn().mockResolvedValue(true),
      on: vi.fn(),
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

  describe('Initialization', () => {
    it('should initialize with empty config', async () => {
      integrationService = new IntegrationService({})
      await integrationService.initialize()

      expect(integrationService).toBeDefined()
      expect(integrationService.getAllServiceHealth()).toEqual([])
    })

    it('should initialize Plex integration when enabled', async () => {
      const config: ServiceIntegrationConfig = {
        plex: {
          enabled: true,
          defaultToken: 'test-plex-token',
          serverUrl: 'http://plex.local:32400'
        }
      }

      integrationService = new IntegrationService(config)
      await integrationService.initialize()

      expect(PlexApiClient.createFromUserToken).toHaveBeenCalledWith(
        'test-plex-token',
        'http://plex.local:32400'
      )

      const plexClient = await integrationService.getPlexClient()
      expect(plexClient).toBe(mockPlexClient)
    })

    it('should initialize Overseerr integration when properly configured', async () => {
      const config: ServiceIntegrationConfig = {
        overseerr: {
          enabled: true,
          url: 'http://overseerr.local:5055',
          apiKey: 'test-overseerr-key'
        }
      }

      integrationService = new IntegrationService(config)
      await integrationService.initialize()

      expect(OverseerrApiClient.createFromConfig).toHaveBeenCalledWith(
        'http://overseerr.local:5055',
        'test-overseerr-key'
      )

      const overseerrClient = integrationService.getOverseerrClient()
      expect(overseerrClient).toBe(mockOverseerrClient)
    })

    it('should initialize Uptime Kuma integration when configured', async () => {
      const config: ServiceIntegrationConfig = {
        uptimeKuma: {
          enabled: true,
          url: 'ws://uptime.local:3001',
          username: 'admin',
          password: 'secret'
        }
      }

      integrationService = new IntegrationService(config)
      await integrationService.initialize()

      expect(UptimeKumaClient.createClient).toHaveBeenCalledWith({
        url: 'ws://uptime.local:3001',
        username: 'admin',
        password: 'secret',
        reconnectInterval: 5000,
        heartbeatInterval: 30000,
        timeout: 10000,
      })

      expect(mockUptimeKumaClient.connect).toHaveBeenCalled()

      const uptimeKumaClient = integrationService.getUptimeKumaClient()
      expect(uptimeKumaClient).toBe(mockUptimeKumaClient)
    })

    it('should skip disabled services', async () => {
      const config: ServiceIntegrationConfig = {
        plex: { enabled: false },
        overseerr: { enabled: false },
        uptimeKuma: { enabled: false }
      }

      integrationService = new IntegrationService(config)
      await integrationService.initialize()

      expect(PlexApiClient.createFromUserToken).not.toHaveBeenCalled()
      expect(OverseerrApiClient.createFromConfig).not.toHaveBeenCalled()
      expect(UptimeKumaClient.createClient).not.toHaveBeenCalled()
    })

    it('should handle initialization errors gracefully', async () => {
      vi.mocked(PlexApiClient.createFromUserToken).mockRejectedValue(
        new Error('Plex server not found')
      )

      const config: ServiceIntegrationConfig = {
        plex: {
          enabled: true,
          defaultToken: 'invalid-token'
        }
      }

      integrationService = new IntegrationService(config)

      // Should not throw despite Plex initialization failure
      await expect(integrationService.initialize()).resolves.toBeUndefined()

      const plexClient = await integrationService.getPlexClient()
      expect(plexClient).toBeNull()
    })

    it('should initialize all services when fully configured', async () => {
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
          url: 'ws://uptime.local:3001',
          username: 'admin',
          password: 'secret'
        }
      }

      integrationService = new IntegrationService(config)
      await integrationService.initialize()

      expect(await integrationService.getPlexClient()).toBe(mockPlexClient)
      expect(integrationService.getOverseerrClient()).toBe(mockOverseerrClient)
      expect(integrationService.getUptimeKumaClient()).toBe(mockUptimeKumaClient)
    })
  })

  describe('Health Checks', () => {
    beforeEach(async () => {
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

      const config: ServiceIntegrationConfig = {
        plex: {
          enabled: true,
          defaultToken: 'plex-token'
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
    })

    it('should perform health checks on all services', async () => {
      // Wait for initial health check to complete
      await new Promise(resolve => setTimeout(resolve, 100))

      const healthStatuses = integrationService.getAllServiceHealth()
      expect(healthStatuses).toHaveLength(3)

      const plexHealth = integrationService.getServiceHealth('plex')
      expect(plexHealth).toMatchObject({
        service: 'plex',
        healthy: true,
        circuitBreakerState: 'CLOSED'
      })

      const overseerrHealth = integrationService.getServiceHealth('overseerr')
      expect(overseerrHealth).toMatchObject({
        service: 'overseerr',
        healthy: true,
        circuitBreakerState: 'CLOSED'
      })

      const uptimeKumaHealth = integrationService.getServiceHealth('uptimeKuma')
      expect(uptimeKumaHealth).toMatchObject({
        service: 'uptimeKuma',
        healthy: true,
        circuitBreakerState: 'CLOSED'
      })
    })

    it('should cache health status in Redis', async () => {
      // Wait for health check and caching
      await new Promise(resolve => setTimeout(resolve, 200))

      const cachedPlexStatus = await integrationService.getCachedServiceStatus('plex')
      expect(cachedPlexStatus).toMatchObject({
        service: 'plex',
        healthy: true
      })

      // Verify it's actually in Redis
      const redisKey = 'service:health:plex'
      const redisValue = await redis.get(redisKey)
      expect(redisValue).toBeTruthy()

      const parsedValue = JSON.parse(redisValue!)
      expect(parsedValue.service).toBe('plex')
      expect(parsedValue.healthy).toBe(true)
    })

    it('should emit events when service health changes', async () => {
      const healthChangeHandler = vi.fn()
      integrationService.on('serviceHealthChanged', healthChangeHandler)

      // Simulate Plex becoming unhealthy
      mockPlexClient.healthCheck.mockResolvedValue({
        healthy: false,
        lastChecked: new Date(),
        error: 'Connection timeout',
        responseTime: 5000
      })

      // Trigger health check manually
      await (integrationService as any).performHealthChecks()

      expect(healthChangeHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          service: 'plex',
          healthy: false,
          error: 'Connection timeout'
        })
      )
    })

    it('should handle health check failures gracefully', async () => {
      mockPlexClient.healthCheck.mockRejectedValue(new Error('Network error'))

      await (integrationService as any).performHealthChecks()

      const plexHealth = integrationService.getServiceHealth('plex')
      expect(plexHealth).toMatchObject({
        service: 'plex',
        healthy: false,
        error: 'Network error',
        circuitBreakerState: 'OPEN'
      })
    })

    it('should handle services without health check methods', async () => {
      // Create service without healthCheck method
      delete mockPlexClient.healthCheck

      await (integrationService as any).performHealthChecks()

      const plexHealth = integrationService.getServiceHealth('plex')
      expect(plexHealth).toMatchObject({
        service: 'plex',
        healthy: false,
        error: 'Health check method not available'
      })
    })

    it('should calculate overall system health correctly', async () => {
      await new Promise(resolve => setTimeout(resolve, 100))

      const systemHealth = integrationService.getOverallSystemHealth()
      expect(systemHealth).toMatchObject({
        healthy: true,
        totalServices: 3,
        healthyServices: 3
      })
      expect(systemHealth.services).toHaveLength(3)
    })

    it('should show system as unhealthy when any service is down', async () => {
      mockPlexClient.healthCheck.mockResolvedValue({
        healthy: false,
        lastChecked: new Date(),
        error: 'Service unavailable'
      })

      await (integrationService as any).performHealthChecks()

      const systemHealth = integrationService.getOverallSystemHealth()
      expect(systemHealth.healthy).toBe(false)
      expect(systemHealth.healthyServices).toBe(2) // Only Overseerr and UptimeKuma healthy
      expect(systemHealth.totalServices).toBe(3)
    })

    it('should handle Redis caching errors gracefully', async () => {
      // Mock Redis error
      const originalSetex = redis.setex
      redis.setex = vi.fn().mockRejectedValue(new Error('Redis connection lost'))

      // Health check should still work despite caching failure
      await (integrationService as any).performHealthChecks()

      const plexHealth = integrationService.getServiceHealth('plex')
      expect(plexHealth?.healthy).toBe(true)

      // Restore Redis
      redis.setex = originalSetex
    })
  })

  describe('Client Management', () => {
    beforeEach(async () => {
      const config: ServiceIntegrationConfig = {
        plex: {
          enabled: true,
          defaultToken: 'default-token'
        }
      }

      integrationService = new IntegrationService(config)
      await integrationService.initialize()
    })

    it('should create user-specific Plex clients', async () => {
      const userMockClient = { 
        healthCheck: vi.fn(),
        getCircuitBreakerStats: vi.fn(() => ({ state: 'CLOSED' }))
      }
      
      vi.mocked(PlexApiClient.createFromUserToken).mockResolvedValue(userMockClient)

      const userClient = await integrationService.getPlexClient('user-specific-token')
      
      expect(PlexApiClient.createFromUserToken).toHaveBeenCalledWith('user-specific-token')
      expect(userClient).toBe(userMockClient)
    })

    it('should handle user client creation failures', async () => {
      vi.mocked(PlexApiClient.createFromUserToken).mockRejectedValue(
        new Error('Invalid token')
      )

      const userClient = await integrationService.getPlexClient('invalid-token')
      expect(userClient).toBeNull()
    })

    it('should return null for non-configured clients', async () => {
      // Service without Overseerr configuration
      const overseerrClient = integrationService.getOverseerrClient()
      expect(overseerrClient).toBeNull()
    })
  })

  describe('Circuit Breaker Management', () => {
    beforeEach(async () => {
      const config: ServiceIntegrationConfig = {
        plex: { enabled: true, defaultToken: 'token' },
        overseerr: { enabled: true, url: 'http://test', apiKey: 'key' }
      }

      integrationService = new IntegrationService(config)
      await integrationService.initialize()
    })

    it('should reset all circuit breakers', async () => {
      await integrationService.resetCircuitBreakers()

      expect(mockPlexClient.resetCircuitBreaker).toHaveBeenCalled()
      expect(mockOverseerrClient.resetCircuitBreaker).toHaveBeenCalled()
    })

    it('should reset specific service circuit breaker', async () => {
      const result = await integrationService.resetServiceCircuitBreaker('plex')
      
      expect(result).toBe(true)
      expect(mockPlexClient.resetCircuitBreaker).toHaveBeenCalled()
      expect(mockOverseerrClient.resetCircuitBreaker).not.toHaveBeenCalled()
    })

    it('should return false for non-existent service', async () => {
      const result = await integrationService.resetServiceCircuitBreaker('nonexistent')
      expect(result).toBe(false)
    })

    it('should handle services without circuit breaker support', async () => {
      delete mockPlexClient.resetCircuitBreaker
      
      const result = await integrationService.resetServiceCircuitBreaker('plex')
      expect(result).toBe(false)
    })
  })

  describe('Event Handling', () => {
    beforeEach(async () => {
      const config: ServiceIntegrationConfig = {
        uptimeKuma: {
          enabled: true,
          url: 'ws://uptime.local:3001'
        }
      }

      integrationService = new IntegrationService(config)
      await integrationService.initialize()
    })

    it('should setup Uptime Kuma event handlers', () => {
      expect(mockUptimeKumaClient.on).toHaveBeenCalledWith(
        'monitorsUpdated',
        expect.any(Function)
      )
      expect(mockUptimeKumaClient.on).toHaveBeenCalledWith(
        'heartbeat',
        expect.any(Function)
      )
      expect(mockUptimeKumaClient.on).toHaveBeenCalledWith(
        'statsUpdated',
        expect.any(Function)
      )
    })

    it('should emit Uptime Kuma events', async () => {
      const monitorsHandler = vi.fn()
      const heartbeatHandler = vi.fn()
      const statsHandler = vi.fn()

      integrationService.on('uptimeKumaMonitorsUpdated', monitorsHandler)
      integrationService.on('uptimeKumaHeartbeat', heartbeatHandler)
      integrationService.on('uptimeKumaStatsUpdated', statsHandler)

      // Simulate Uptime Kuma events
      const monitorsCallback = mockUptimeKumaClient.on.mock.calls
        .find(call => call[0] === 'monitorsUpdated')[1]
      const heartbeatCallback = mockUptimeKumaClient.on.mock.calls
        .find(call => call[0] === 'heartbeat')[1]
      const statsCallback = mockUptimeKumaClient.on.mock.calls
        .find(call => call[0] === 'statsUpdated')[1]

      const mockMonitors = [{ id: 1, name: 'Test Monitor', status: 'up' }]
      const mockHeartbeat = { monitorId: 1, timestamp: Date.now(), status: 'up' }
      const mockStats = { uptime: 99.9, totalRequests: 1000 }

      monitorsCallback(mockMonitors)
      heartbeatCallback(mockHeartbeat)
      statsCallback(mockStats)

      expect(monitorsHandler).toHaveBeenCalledWith(mockMonitors)
      expect(heartbeatHandler).toHaveBeenCalledWith(mockHeartbeat)
      expect(statsHandler).toHaveBeenCalledWith(mockStats)
    })
  })

  describe('Service Management', () => {
    beforeEach(async () => {
      const config: ServiceIntegrationConfig = {
        plex: { enabled: true, defaultToken: 'token' }
      }

      integrationService = new IntegrationService(config)
      await integrationService.initialize()
    })

    it('should refresh service configuration', async () => {
      const performHealthChecksSpy = vi.spyOn(integrationService as any, 'performHealthChecks')
      
      await integrationService.refreshServiceConfiguration()
      
      expect(performHealthChecksSpy).toHaveBeenCalled()
    })

    it('should shutdown gracefully', async () => {
      // Add Uptime Kuma to test WebSocket disconnect
      const config: ServiceIntegrationConfig = {
        plex: { enabled: true, defaultToken: 'token' },
        uptimeKuma: { enabled: true, url: 'ws://test' }
      }

      const serviceWithUptime = new IntegrationService(config)
      await serviceWithUptime.initialize()

      await serviceWithUptime.shutdown()

      expect(mockUptimeKumaClient.disconnect).toHaveBeenCalled()
      
      // Verify clients are cleared
      expect(serviceWithUptime.getAllServiceHealth()).toEqual([])
    })
  })

  describe('Redis Integration', () => {
    beforeEach(async () => {
      const config: ServiceIntegrationConfig = {
        plex: { enabled: true, defaultToken: 'token' }
      }

      integrationService = new IntegrationService(config)
      await integrationService.initialize()
    })

    it('should cache service status with proper TTL', async () => {
      await new Promise(resolve => setTimeout(resolve, 200))

      // Check Redis TTL
      const redisKey = 'service:health:plex'
      const ttl = await redis.ttl(redisKey)
      
      expect(ttl).toBeGreaterThan(0)
      expect(ttl).toBeLessThanOrEqual(300) // 5 minutes max
    })

    it('should return null for non-cached service status', async () => {
      const cachedStatus = await integrationService.getCachedServiceStatus('nonexistent')
      expect(cachedStatus).toBeNull()
    })

    it('should handle Redis retrieval errors gracefully', async () => {
      const originalGet = redis.get
      redis.get = vi.fn().mockRejectedValue(new Error('Redis error'))

      const cachedStatus = await integrationService.getCachedServiceStatus('plex')
      expect(cachedStatus).toBeNull()

      redis.get = originalGet
    })
  })

  describe('Performance and Reliability', () => {
    it('should handle concurrent health checks', async () => {
      const config: ServiceIntegrationConfig = {
        plex: { enabled: true, defaultToken: 'token' },
        overseerr: { enabled: true, url: 'http://test', apiKey: 'key' }
      }

      // Add delays to simulate slow responses
      mockPlexClient.healthCheck.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 100))
        return { healthy: true, lastChecked: new Date(), responseTime: 100 }
      })

      mockOverseerrClient.healthCheck.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 150))
        return { healthy: true, lastChecked: new Date(), responseTime: 150 }
      })

      integrationService = new IntegrationService(config)
      await integrationService.initialize()

      const startTime = Date.now()
      await (integrationService as any).performHealthChecks()
      const duration = Date.now() - startTime

      // Should run concurrently, not sequentially
      expect(duration).toBeLessThan(200) // Less than sum of individual delays
      
      const healthStatuses = integrationService.getAllServiceHealth()
      expect(healthStatuses).toHaveLength(2)
      expect(healthStatuses.every(s => s.healthy)).toBe(true)
    })

    it('should handle partial failures in health checks', async () => {
      const config: ServiceIntegrationConfig = {
        plex: { enabled: true, defaultToken: 'token' },
        overseerr: { enabled: true, url: 'http://test', apiKey: 'key' }
      }

      mockPlexClient.healthCheck.mockRejectedValue(new Error('Plex failed'))
      mockOverseerrClient.healthCheck.mockResolvedValue({
        healthy: true,
        lastChecked: new Date(),
        responseTime: 50
      })

      integrationService = new IntegrationService(config)
      await integrationService.initialize()

      await (integrationService as any).performHealthChecks()

      const plexHealth = integrationService.getServiceHealth('plex')
      const overseerrHealth = integrationService.getServiceHealth('overseerr')

      expect(plexHealth?.healthy).toBe(false)
      expect(overseerrHealth?.healthy).toBe(true)
    })

    it('should handle health check timeouts', async () => {
      const config: ServiceIntegrationConfig = {
        plex: { enabled: true, defaultToken: 'token' }
      }

      // Mock a very slow health check
      mockPlexClient.healthCheck.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({
          healthy: true,
          lastChecked: new Date(),
          responseTime: 30000
        }), 30000))
      )

      integrationService = new IntegrationService(config)
      await integrationService.initialize()

      // Health check should complete quickly even with slow service
      const startTime = Date.now()
      await (integrationService as any).performHealthChecks()
      const duration = Date.now() - startTime

      // Should not wait for the full 30 seconds
      expect(duration).toBeLessThan(5000)
    }, 10000)
  })
})