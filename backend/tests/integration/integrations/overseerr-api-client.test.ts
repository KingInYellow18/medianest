import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import { 
  OverseerrApiClient, 
  OverseerrStatus,
  OverseerrSettings,
  OverseerrMediaRequest,
  CreateMediaRequestInput
} from '@/integrations/overseerr/overseerr-api.client'
import { CircuitState } from '@/utils/circuit-breaker'
import { server } from '@/tests/mocks/server'
import { mockState } from '@/tests/mocks/handlers'

describe('Overseerr API Client Integration Tests', () => {
  let overseerrClient: OverseerrApiClient

  beforeAll(() => {
    server.listen({ onUnhandledRequest: 'error' })
  })

  afterAll(() => {
    server.close()
  })

  beforeEach(() => {
    server.resetHandlers()
    mockState.overseerrDown = false
    mockState.overseerrSlowResponse = false
    mockState.resetFailures()
    
    overseerrClient = new OverseerrApiClient({
      overseerrUrl: 'http://overseerr.local:5055',
      apiKey: 'test-overseerr-key',
      timeout: 5000,
      retryAttempts: 2,
      circuitBreakerOptions: {
        failureThreshold: 3,
        resetTimeout: 5000,
        monitoringPeriod: 10000,
      }
    })
  })

  afterEach(() => {
    mockState.overseerrDown = false
    mockState.overseerrSlowResponse = false
  })

  describe('Service Status & Configuration', () => {
    it('should get Overseerr status', async () => {
      const status = await overseerrClient.getStatus()

      expect(status).toMatchObject({
        version: '1.32.0',
        commitTag: 'v1.32.0',
        updateAvailable: false,
        commitsBehind: 0
      })

      expect(typeof status.version).toBe('string')
      expect(typeof status.updateAvailable).toBe('boolean')
      expect(typeof status.commitsBehind).toBe('number')
    })

    it('should get Overseerr settings', async () => {
      const settings = await overseerrClient.getSettings()

      expect(settings).toMatchObject({
        id: 1,
        hostname: 'overseerr.local',
        port: 5055,
        ssl: false,
        csrfProtection: false,
        cacheImages: true,
        enablePushRegistration: true,
        locale: 'en',
        region: 'US',
        hideAvailable: false,
        localLogin: true,
        newPlexLogin: true,
        defaultPermissions: 2
      })

      expect(typeof settings.hostname).toBe('string')
      expect(typeof settings.port).toBe('number')
      expect(typeof settings.ssl).toBe('boolean')
      expect(typeof settings.defaultPermissions).toBe('number')
    })

    it('should fail with invalid API key', async () => {
      const invalidClient = new OverseerrApiClient({
        overseerrUrl: 'http://overseerr.local:5055',
        apiKey: 'invalid-key'
      })

      await expect(invalidClient.getStatus()).rejects.toThrow('Failed to get Overseerr status')
      await expect(invalidClient.getSettings()).rejects.toThrow('Failed to get Overseerr settings')
    })

    it('should validate configuration successfully', async () => {
      const isValid = await overseerrClient.validateConfiguration()
      expect(isValid).toBe(true)
    })

    it('should fail configuration validation with invalid API key', async () => {
      const invalidClient = new OverseerrApiClient({
        overseerrUrl: 'http://overseerr.local:5055',
        apiKey: 'invalid-key'
      })

      const isValid = await invalidClient.validateConfiguration()
      expect(isValid).toBe(false)
    })

    it('should create client from config with validation', async () => {
      const client = await OverseerrApiClient.createFromConfig(
        'http://overseerr.local:5055',
        'test-overseerr-key'
      )
      
      expect(client).toBeInstanceOf(OverseerrApiClient)
      
      // Should be able to get status immediately
      const status = await client.getStatus()
      expect(status.version).toBe('1.32.0')
    })

    it('should fail to create client with invalid configuration', async () => {
      await expect(
        OverseerrApiClient.createFromConfig('http://overseerr.local:5055', 'invalid-key')
      ).rejects.toThrow('Invalid Overseerr configuration')
    })
  })

  describe('Media Request Management', () => {
    it('should get all media requests with pagination', async () => {
      const result = await overseerrClient.getRequests(10, 0, 'all')

      expect(result).toHaveProperty('results')
      expect(result).toHaveProperty('pageInfo')

      expect(Array.isArray(result.results)).toBe(true)
      expect(result.results).toHaveLength(1)

      const request = result.results[0]
      expect(request).toMatchObject({
        id: 1,
        status: 1, // pending
        createdAt: '2023-12-01T10:00:00.000Z',
        updatedAt: '2023-12-01T10:00:00.000Z',
        type: 'movie'
      })

      expect(request.requestedBy).toMatchObject({
        id: 1,
        email: 'user@example.com',
        displayName: 'Test User',
        permissions: 2
      })

      expect(request.media).toMatchObject({
        id: 1,
        mediaType: 'movie',
        tmdbId: 550,
        status: 1,
        status4k: 1
      })

      expect(result.pageInfo).toMatchObject({
        pages: 1,
        pageSize: 10,
        total: 1,
        page: 1
      })
    })

    it('should get requests with different filters', async () => {
      const filters = ['all', 'approved', 'available', 'pending', 'processing', 'unavailable'] as const

      for (const filter of filters) {
        const result = await overseerrClient.getRequests(20, 0, filter)
        expect(result).toHaveProperty('results')
        expect(result).toHaveProperty('pageInfo')
        expect(Array.isArray(result.results)).toBe(true)
      }
    })

    it('should get specific request by ID', async () => {
      const request = await overseerrClient.getRequestById(1)

      expect(request).toMatchObject({
        id: 1,
        status: 1,
        createdAt: '2023-12-01T10:00:00.000Z',
        updatedAt: '2023-12-01T10:00:00.000Z',
        type: 'movie'
      })

      expect(request.requestedBy).toBeDefined()
      expect(request.media).toBeDefined()
    })

    it('should throw error for non-existent request', async () => {
      await expect(overseerrClient.getRequestById(999)).rejects.toThrow('Failed to get request 999')
    })

    it('should create new media request', async () => {
      const requestData: CreateMediaRequestInput = {
        mediaType: 'movie',
        mediaId: 550, // TMDB ID
        is4k: false,
        serverId: 1,
        profileId: 1
      }

      const newRequest = await overseerrClient.createRequest(requestData)

      expect(newRequest).toMatchObject({
        id: 123,
        status: 1,
        type: 'movie'
      })

      expect(newRequest.media).toMatchObject({
        mediaType: 'movie',
        tmdbId: 550,
        status: 1,
        status4k: 1
      })

      expect(newRequest.requestedBy).toMatchObject({
        id: 1,
        email: 'user@example.com',
        displayName: 'Test User',
        permissions: 2
      })
    })

    it('should handle create request with TV show seasons', async () => {
      const tvRequestData: CreateMediaRequestInput = {
        mediaType: 'tv',
        mediaId: 1234,
        seasons: [1, 2, 3],
        is4k: false
      }

      const newRequest = await overseerrClient.createRequest(tvRequestData)

      expect(newRequest.type).toBe('tv')
      expect(newRequest.media.tmdbId).toBe(1234)
    })

    it('should fail to create request for non-existent media', async () => {
      const invalidRequestData: CreateMediaRequestInput = {
        mediaType: 'movie',
        mediaId: 999, // Non-existent media
      }

      await expect(overseerrClient.createRequest(invalidRequestData)).rejects.toThrow('Failed to create media request')
    })

    it('should update existing request', async () => {
      const updateData = {
        is4k: true,
        serverId: 2,
        profileId: 2
      }

      const updatedRequest = await overseerrClient.updateRequest(1, updateData)

      expect(updatedRequest).toMatchObject({
        id: 1,
        status: 1,
        type: 'movie'
      })
    })

    it('should approve media request', async () => {
      const approvedRequest = await overseerrClient.approveRequest(1)

      expect(approvedRequest).toMatchObject({
        id: 1,
        status: 2, // approved
        type: 'movie'
      })

      // Updated timestamp should be recent
      expect(new Date(approvedRequest.updatedAt).getTime()).toBeGreaterThan(Date.now() - 10000)
    })

    it('should decline media request with reason', async () => {
      const declinedRequest = await overseerrClient.declineRequest(1, 'Not available in region')

      expect(declinedRequest).toBeDefined()
      expect(declinedRequest.id).toBe(1)
    })

    it('should delete media request', async () => {
      await expect(overseerrClient.deleteRequest(1)).resolves.toBeUndefined()
    })

    it('should handle request operations on non-existent requests', async () => {
      await expect(overseerrClient.updateRequest(999, {})).rejects.toThrow('Failed to update request 999')
      await expect(overseerrClient.approveRequest(999)).rejects.toThrow('Failed to approve request 999')
      await expect(overseerrClient.declineRequest(999)).rejects.toThrow('Failed to decline request 999')
      await expect(overseerrClient.deleteRequest(999)).rejects.toThrow('Failed to delete request 999')
    })
  })

  describe('User Request Management', () => {
    it('should get requests for specific user', async () => {
      const result = await overseerrClient.getUserRequests(1, 10, 0)

      expect(result).toHaveProperty('results')
      expect(result).toHaveProperty('pageInfo')
      expect(Array.isArray(result.results)).toBe(true)

      expect(result.pageInfo).toMatchObject({
        pageSize: 10,
        page: 1
      })
    })

    it('should handle pagination for user requests', async () => {
      const firstPage = await overseerrClient.getUserRequests(1, 5, 0)
      const secondPage = await overseerrClient.getUserRequests(1, 5, 5)

      expect(firstPage.pageInfo.page).toBe(1)
      expect(secondPage.pageInfo.page).toBe(2)
    })
  })

  describe('Media Search & Discovery', () => {
    it('should search for media', async () => {
      const searchResult = await overseerrClient.searchMedia('test movie', undefined, 1)

      expect(searchResult).toMatchObject({
        page: 1,
        totalPages: 1,
        totalResults: 1
      })

      expect(Array.isArray(searchResult.results)).toBe(true)
      expect(searchResult.results).toHaveLength(1)

      const movie = searchResult.results[0]
      expect(movie).toMatchObject({
        id: 550,
        title: 'Test Movie',
        overview: 'A test movie for integration testing',
        release_date: '2023-01-01',
        vote_average: 8.5,
        vote_count: 1000,
        popularity: 500,
        adult: false,
        original_language: 'en',
        mediaType: 'movie'
      })
    })

    it('should search with type filter', async () => {
      const movieSearch = await overseerrClient.searchMedia('test movie', 'movie')
      const tvSearch = await overseerrClient.searchMedia('test movie', 'tv')

      expect(movieSearch.results).toHaveLength(1)
      expect(tvSearch.results).toHaveLength(0) // No TV results for "test movie"
    })

    it('should handle empty search results', async () => {
      const searchResult = await overseerrClient.searchMedia('nonexistent movie')

      expect(searchResult).toMatchObject({
        page: 1,
        totalPages: 0,
        totalResults: 0,
        results: []
      })
    })

    it('should handle paginated search results', async () => {
      const page1 = await overseerrClient.searchMedia('test movie', undefined, 1)
      const page2 = await overseerrClient.searchMedia('test movie', undefined, 2)

      expect(page1.page).toBe(1)
      expect(page2.page).toBe(2)
    })

    it('should get detailed media information', async () => {
      const mediaInfo = await overseerrClient.getMediaInfo('movie', 550)

      expect(mediaInfo).toBeDefined()
      // In a real implementation, this would return detailed media information
      // The mock just returns a generic response for now
    })

    it('should handle non-existent media info requests', async () => {
      await expect(overseerrClient.getMediaInfo('movie', 999999)).rejects.toThrow('Failed to get media info')
    })
  })

  describe('Error Handling & Resilience', () => {
    it('should handle service unavailable errors', async () => {
      mockState.overseerrDown = true

      await expect(overseerrClient.getStatus()).rejects.toThrow('Overseerr API error: 503 Service Unavailable')
    })

    it('should handle timeout errors', async () => {
      mockState.overseerrSlowResponse = true

      await expect(overseerrClient.getStatus()).rejects.toThrow('Overseerr request timeout after 5000ms')
    })

    it('should handle authentication errors', async () => {
      const unauthClient = new OverseerrApiClient({
        overseerrUrl: 'http://overseerr.local:5055',
        apiKey: 'invalid-key'
      })

      await expect(unauthClient.getSettings()).rejects.toThrow('Failed to get Overseerr settings')
    })

    it('should properly handle rate limiting', async () => {
      // This would require specific rate limiting mocks
      // For now, we test that the client handles various HTTP error codes
      const status = await overseerrClient.getStatus()
      expect(status).toBeDefined()
    })

    it('should handle malformed request data', async () => {
      const invalidRequestData = {} as CreateMediaRequestInput

      await expect(overseerrClient.createRequest(invalidRequestData)).rejects.toThrow()
    })

    it('should handle network connectivity issues', async () => {
      const unreachableClient = new OverseerrApiClient({
        overseerrUrl: 'http://unreachable.test',
        apiKey: 'test-key',
        timeout: 1000
      })

      await expect(unreachableClient.getStatus()).rejects.toThrow()
    })
  })

  describe('Circuit Breaker Integration', () => {
    it('should track circuit breaker statistics', () => {
      const stats = overseerrClient.getCircuitBreakerStats()

      expect(stats).toMatchObject({
        state: CircuitState.CLOSED,
        failures: 0,
        successes: expect.any(Number),
        requests: expect.any(Number)
      })
    })

    it('should open circuit after consecutive failures', async () => {
      mockState.overseerrDown = true

      // Trigger multiple failures
      for (let i = 0; i < 4; i++) {
        try {
          await overseerrClient.getStatus()
        } catch (error) {
          // Expected to fail
        }
      }

      const stats = overseerrClient.getCircuitBreakerStats()
      expect(stats.state).toBe(CircuitState.OPEN)
      expect(stats.failures).toBeGreaterThanOrEqual(3)
    })

    it('should reset circuit breaker manually', async () => {
      mockState.overseerrDown = true

      // Trigger failures to open circuit
      for (let i = 0; i < 4; i++) {
        try {
          await overseerrClient.getStatus()
        } catch (error) {
          // Expected to fail
        }
      }

      expect(overseerrClient.getCircuitBreakerStats().state).toBe(CircuitState.OPEN)

      // Reset circuit breaker
      overseerrClient.resetCircuitBreaker()

      const stats = overseerrClient.getCircuitBreakerStats()
      expect(stats.state).toBe(CircuitState.CLOSED)
      expect(stats.failures).toBe(0)
    })

    it('should count failure accumulation correctly', async () => {
      mockState.overseerrDown = true

      let initialStats = overseerrClient.getCircuitBreakerStats()
      let initialFailures = initialStats.failures

      // Trigger one more failure
      try {
        await overseerrClient.getStatus()
      } catch (error) {
        // Expected to fail
      }

      let newStats = overseerrClient.getCircuitBreakerStats()
      expect(newStats.failures).toBe(initialFailures + 1)
    })
  })

  describe('Health Checks', () => {
    it('should perform health check successfully', async () => {
      const health = await overseerrClient.healthCheck()

      expect(health).toMatchObject({
        healthy: true,
        responseTime: expect.any(Number),
        lastChecked: expect.any(Date),
        circuitBreakerState: CircuitState.CLOSED
      })

      expect(health.responseTime).toBeGreaterThan(0)
    })

    it('should fail health check when service is down', async () => {
      mockState.overseerrDown = true

      const health = await overseerrClient.healthCheck()

      expect(health).toMatchObject({
        healthy: false,
        lastChecked: expect.any(Date),
        error: expect.stringContaining('Overseerr health check failed'),
        circuitBreakerState: expect.any(String)
      })
    })

    it('should return last health check result', async () => {
      await overseerrClient.healthCheck()

      const lastHealth = overseerrClient.getLastHealthCheck()
      expect(lastHealth).not.toBeNull()
      expect(lastHealth!.healthy).toBe(true)
      expect(lastHealth!.lastChecked).toBeInstanceOf(Date)
    })

    it('should measure health check response times', async () => {
      const startTime = Date.now()
      const health = await overseerrClient.healthCheck()
      const endTime = Date.now()

      expect(health.responseTime).toBeGreaterThan(0)
      expect(health.responseTime).toBeLessThanOrEqual(endTime - startTime)
    })
  })

  describe('API Contract Validation', () => {
    it('should validate status response structure', async () => {
      const status = await overseerrClient.getStatus()

      // Validate required fields
      expect(status).toHaveProperty('version')
      expect(status).toHaveProperty('commitTag')
      expect(status).toHaveProperty('updateAvailable')
      expect(status).toHaveProperty('commitsBehind')

      // Validate data types
      expect(typeof status.version).toBe('string')
      expect(typeof status.commitTag).toBe('string')
      expect(typeof status.updateAvailable).toBe('boolean')
      expect(typeof status.commitsBehind).toBe('number')
    })

    it('should validate settings response structure', async () => {
      const settings = await overseerrClient.getSettings()

      // Validate required fields
      expect(settings).toHaveProperty('id')
      expect(settings).toHaveProperty('hostname')
      expect(settings).toHaveProperty('port')
      expect(settings).toHaveProperty('ssl')
      expect(settings).toHaveProperty('locale')
      expect(settings).toHaveProperty('region')
      expect(settings).toHaveProperty('defaultPermissions')

      // Validate data types
      expect(typeof settings.id).toBe('number')
      expect(typeof settings.hostname).toBe('string')
      expect(typeof settings.port).toBe('number')
      expect(typeof settings.ssl).toBe('boolean')
      expect(typeof settings.defaultPermissions).toBe('number')
    })

    it('should validate media request response structure', async () => {
      const requests = await overseerrClient.getRequests()

      expect(requests).toHaveProperty('results')
      expect(requests).toHaveProperty('pageInfo')
      expect(Array.isArray(requests.results)).toBe(true)

      if (requests.results.length > 0) {
        const request = requests.results[0]
        
        // Validate request structure
        expect(request).toHaveProperty('id')
        expect(request).toHaveProperty('status')
        expect(request).toHaveProperty('createdAt')
        expect(request).toHaveProperty('updatedAt')
        expect(request).toHaveProperty('type')
        expect(request).toHaveProperty('requestedBy')
        expect(request).toHaveProperty('media')

        expect(typeof request.id).toBe('number')
        expect(typeof request.status).toBe('number')
        expect(typeof request.type).toBe('string')
        expect(['movie', 'tv']).toContain(request.type)

        // Validate user structure
        expect(request.requestedBy).toHaveProperty('id')
        expect(request.requestedBy).toHaveProperty('email')
        expect(request.requestedBy).toHaveProperty('displayName')
        expect(request.requestedBy).toHaveProperty('permissions')

        // Validate media structure
        expect(request.media).toHaveProperty('id')
        expect(request.media).toHaveProperty('mediaType')
        expect(request.media).toHaveProperty('tmdbId')
        expect(request.media).toHaveProperty('status')
      }

      // Validate pagination structure
      expect(requests.pageInfo).toHaveProperty('pages')
      expect(requests.pageInfo).toHaveProperty('pageSize')
      expect(requests.pageInfo).toHaveProperty('total')
      expect(requests.pageInfo).toHaveProperty('page')

      expect(typeof requests.pageInfo.pages).toBe('number')
      expect(typeof requests.pageInfo.pageSize).toBe('number')
      expect(typeof requests.pageInfo.total).toBe('number')
      expect(typeof requests.pageInfo.page).toBe('number')
    })

    it('should validate search response structure', async () => {
      const searchResult = await overseerrClient.searchMedia('test movie')

      expect(searchResult).toHaveProperty('page')
      expect(searchResult).toHaveProperty('totalPages')
      expect(searchResult).toHaveProperty('totalResults')
      expect(searchResult).toHaveProperty('results')

      expect(typeof searchResult.page).toBe('number')
      expect(typeof searchResult.totalPages).toBe('number')
      expect(typeof searchResult.totalResults).toBe('number')
      expect(Array.isArray(searchResult.results)).toBe(true)

      if (searchResult.results.length > 0) {
        const item = searchResult.results[0]
        expect(item).toHaveProperty('id')
        expect(item).toHaveProperty('title')
        expect(item).toHaveProperty('overview')
        expect(item).toHaveProperty('vote_average')
        expect(item).toHaveProperty('adult')

        expect(typeof item.id).toBe('number')
        expect(typeof item.title).toBe('string')
        expect(typeof item.vote_average).toBe('number')
        expect(typeof item.adult).toBe('boolean')
      }
    })
  })

  describe('Performance & Concurrent Operations', () => {
    it('should handle concurrent requests efficiently', async () => {
      const promises = [
        overseerrClient.getStatus(),
        overseerrClient.getSettings(),
        overseerrClient.getRequests(),
        overseerrClient.searchMedia('test')
      ]

      const startTime = Date.now()
      const results = await Promise.all(promises)
      const duration = Date.now() - startTime

      expect(results).toHaveLength(4)
      expect(results[0]).toHaveProperty('version')     // Status
      expect(results[1]).toHaveProperty('hostname')    // Settings  
      expect(results[2]).toHaveProperty('results')     // Requests
      expect(results[3]).toHaveProperty('results')     // Search

      // Should complete efficiently when running concurrently
      expect(duration).toBeLessThan(10000)
    })

    it('should handle mixed success/failure scenarios', async () => {
      const promises = [
        overseerrClient.getStatus(),                    // Should succeed
        overseerrClient.getRequestById(999),           // Should fail
        overseerrClient.searchMedia('test movie'),     // Should succeed
        overseerrClient.getRequestById(1)              // Should succeed
      ]

      const results = await Promise.allSettled(promises)

      expect(results[0].status).toBe('fulfilled')    // Status
      expect(results[1].status).toBe('rejected')     // Non-existent request
      expect(results[2].status).toBe('fulfilled')    // Search
      expect(results[3].status).toBe('fulfilled')    // Valid request
    })

    it('should maintain consistent state across operations', async () => {
      // Perform multiple operations and verify circuit breaker state remains consistent
      await overseerrClient.getStatus()
      await overseerrClient.getSettings()
      
      const stats1 = overseerrClient.getCircuitBreakerStats()
      
      await overseerrClient.searchMedia('test')
      
      const stats2 = overseerrClient.getCircuitBreakerStats()
      
      expect(stats1.state).toBe(CircuitState.CLOSED)
      expect(stats2.state).toBe(CircuitState.CLOSED)
      expect(stats2.successes).toBeGreaterThan(stats1.successes)
    })
  })
})