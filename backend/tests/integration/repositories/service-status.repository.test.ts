import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { ServiceStatusRepository, ServiceStatusUpdate } from '@/repositories/service-status.repository'
import { getTestPrismaClient, cleanDatabase, disconnectDatabase } from '../../helpers/database'
import { Decimal } from '@prisma/client'

describe('ServiceStatusRepository Integration Tests', () => {
  let repository: ServiceStatusRepository
  
  beforeEach(async () => {
    const prisma = getTestPrismaClient()
    repository = new ServiceStatusRepository(prisma)
    await cleanDatabase()
  })
  
  afterEach(async () => {
    await cleanDatabase()
  })

  describe('upsert', () => {
    it('should create new service status when it does not exist', async () => {
      const data: ServiceStatusUpdate = {
        status: 'healthy',
        responseTimeMs: 150,
        uptimePercentage: 99.5
      }

      const result = await repository.upsert('plex', data)

      expect(result).toMatchObject({
        id: expect.any(Number),
        serviceName: 'plex',
        status: 'healthy',
        responseTimeMs: 150,
        uptimePercentage: expect.any(Object),
        lastCheckAt: expect.any(Date)
      })

      // Check decimal precision
      expect(result.uptimePercentage?.toNumber()).toBe(99.5)
    })

    it('should update existing service status', async () => {
      // Create initial status
      await repository.upsert('plex', {
        status: 'healthy',
        responseTimeMs: 150
      })

      // Update it
      const updatedData: ServiceStatusUpdate = {
        status: 'unhealthy',
        responseTimeMs: 2000,
        uptimePercentage: 95.0
      }

      const result = await repository.upsert('plex', updatedData)

      expect(result.status).toBe('unhealthy')
      expect(result.responseTimeMs).toBe(2000)
      expect(result.uptimePercentage?.toNumber()).toBe(95.0)
    })

    it('should set lastCheckAt to current time when not provided', async () => {
      const beforeCreate = new Date()
      
      const result = await repository.upsert('plex', {
        status: 'healthy',
        responseTimeMs: 150
      })

      expect(result.lastCheckAt).toBeInstanceOf(Date)
      expect(result.lastCheckAt!.getTime()).toBeGreaterThanOrEqual(beforeCreate.getTime())
    })

    it('should use provided lastCheckAt when specified', async () => {
      const customTime = new Date('2023-01-01T12:00:00Z')
      
      const result = await repository.upsert('plex', {
        status: 'healthy',
        lastCheckAt: customTime
      })

      expect(result.lastCheckAt!.getTime()).toBe(customTime.getTime())
    })
  })

  describe('findByName', () => {
    beforeEach(async () => {
      await repository.upsert('plex', {
        status: 'healthy',
        responseTimeMs: 120
      })
    })

    it('should find service status by name', async () => {
      const result = await repository.findByName('plex')

      expect(result).toMatchObject({
        serviceName: 'plex',
        status: 'healthy',
        responseTimeMs: 120
      })
    })

    it('should return null for non-existent service', async () => {
      const result = await repository.findByName('non-existent')
      expect(result).toBeNull()
    })
  })

  describe('findAll', () => {
    beforeEach(async () => {
      await repository.upsert('plex', { status: 'healthy' })
      await repository.upsert('overseerr', { status: 'unhealthy' })
      await repository.upsert('uptime-kuma', { status: 'healthy' })
    })

    it('should return all service statuses ordered by name', async () => {
      const result = await repository.findAll()

      expect(result).toHaveLength(3)
      expect(result[0].serviceName).toBe('overseerr')
      expect(result[1].serviceName).toBe('plex')
      expect(result[2].serviceName).toBe('uptime-kuma')
    })

    it('should return empty array when no services exist', async () => {
      await cleanDatabase()
      const result = await repository.findAll()
      expect(result).toHaveLength(0)
    })
  })

  describe('updateStatus', () => {
    it('should update status and response time', async () => {
      const result = await repository.updateStatus('plex', 'healthy', 150)

      expect(result.status).toBe('healthy')
      expect(result.responseTimeMs).toBe(150)
      expect(result.lastCheckAt).toBeInstanceOf(Date)
    })

    it('should work without response time', async () => {
      const result = await repository.updateStatus('plex', 'unhealthy')

      expect(result.status).toBe('unhealthy')
      expect(result.responseTimeMs).toBeNull()
    })

    it('should update existing service', async () => {
      // Create initial status
      await repository.updateStatus('plex', 'healthy', 100)
      
      // Update it
      const result = await repository.updateStatus('plex', 'degraded', 500)

      expect(result.status).toBe('degraded')
      expect(result.responseTimeMs).toBe(500)
    })
  })

  describe('updateUptimePercentage', () => {
    it('should update uptime percentage', async () => {
      const result = await repository.updateUptimePercentage('plex', 98.75)

      expect(result.uptimePercentage?.toNumber()).toBe(98.75)
    })

    it('should handle high precision decimals', async () => {
      const result = await repository.updateUptimePercentage('plex', 99.99)

      expect(result.uptimePercentage?.toNumber()).toBe(99.99)
    })

    it('should handle edge cases', async () => {
      const result1 = await repository.updateUptimePercentage('plex', 0)
      expect(result1.uptimePercentage?.toNumber()).toBe(0)

      const result2 = await repository.updateUptimePercentage('overseerr', 100)
      expect(result2.uptimePercentage?.toNumber()).toBe(100)
    })
  })

  describe('getHealthyServices', () => {
    beforeEach(async () => {
      await repository.updateStatus('plex', 'healthy')
      await repository.updateStatus('overseerr', 'unhealthy')
      await repository.updateStatus('uptime-kuma', 'healthy')
      await repository.updateStatus('sonarr', 'degraded')
    })

    it('should return only healthy services', async () => {
      const result = await repository.getHealthyServices()

      expect(result).toHaveLength(2)
      expect(result[0].serviceName).toBe('plex')
      expect(result[0].status).toBe('healthy')
      expect(result[1].serviceName).toBe('uptime-kuma')
      expect(result[1].status).toBe('healthy')
    })

    it('should return empty array when no healthy services', async () => {
      await cleanDatabase()
      await repository.updateStatus('plex', 'unhealthy')
      
      const result = await repository.getHealthyServices()
      expect(result).toHaveLength(0)
    })
  })

  describe('getUnhealthyServices', () => {
    beforeEach(async () => {
      await repository.updateStatus('plex', 'healthy')
      await repository.updateStatus('overseerr', 'unhealthy')
      await repository.updateStatus('uptime-kuma', 'degraded')
      await repository.upsert('sonarr', {}) // No status set (null)
    })

    it('should return unhealthy and null status services', async () => {
      const result = await repository.getUnhealthyServices()

      expect(result).toHaveLength(3)
      const serviceNames = result.map(s => s.serviceName).sort()
      expect(serviceNames).toEqual(['overseerr', 'sonarr', 'uptime-kuma'])
    })

    it('should exclude healthy services', async () => {
      const result = await repository.getUnhealthyServices()
      
      const healthyService = result.find(s => s.serviceName === 'plex')
      expect(healthyService).toBeUndefined()
    })
  })

  describe('getServicesStalerThan', () => {
    beforeEach(async () => {
      const now = new Date()
      const oneHourAgo = new Date(now.getTime() - (60 * 60 * 1000))
      const twoHoursAgo = new Date(now.getTime() - (2 * 60 * 60 * 1000))
      
      // Recent service
      await repository.upsert('plex', {
        status: 'healthy',
        lastCheckAt: now
      })
      
      // Stale service (1 hour ago)
      await repository.upsert('overseerr', {
        status: 'healthy',
        lastCheckAt: oneHourAgo
      })
      
      // Very stale service (2 hours ago)
      await repository.upsert('uptime-kuma', {
        status: 'healthy',
        lastCheckAt: twoHoursAgo
      })
      
      // Service with no lastCheckAt
      await repository.upsert('sonarr', {
        status: 'healthy'
      })
    })

    it('should return services older than threshold', async () => {
      const result = await repository.getServicesStalerThan(30) // 30 minutes
      
      const serviceNames = result.map(s => s.serviceName).sort()
      expect(serviceNames).toEqual(['overseerr', 'sonarr', 'uptime-kuma'])
    })

    it('should include services with null lastCheckAt', async () => {
      const result = await repository.getServicesStalerThan(30)
      
      const nullCheckService = result.find(s => s.serviceName === 'sonarr')
      expect(nullCheckService).toBeDefined()
      expect(nullCheckService?.lastCheckAt).toBeNull()
    })

    it('should return empty array when all services are fresh', async () => {
      const result = await repository.getServicesStalerThan(180) // 3 hours
      expect(result).toHaveLength(0)
    })
  })

  describe('clearStatus', () => {
    beforeEach(async () => {
      await repository.updateStatus('plex', 'healthy', 150)
    })

    it('should clear status and response time but update lastCheckAt', async () => {
      const result = await repository.clearStatus('plex')

      expect(result.status).toBeNull()
      expect(result.responseTimeMs).toBeNull()
      expect(result.lastCheckAt).toBeInstanceOf(Date)
    })

    it('should work for non-existent service', async () => {
      const result = await repository.clearStatus('new-service')

      expect(result.serviceName).toBe('new-service')
      expect(result.status).toBeNull()
    })
  })

  describe('getAverageResponseTime', () => {
    beforeEach(async () => {
      // Multiple updates with different response times
      await repository.updateStatus('plex', 'healthy', 100)
      await repository.upsert('plex', { responseTimeMs: 150 })
      await repository.upsert('plex', { responseTimeMs: 200 })
    })

    it('should calculate average response time', async () => {
      // Note: This test might not work as expected because upsert
      // overwrites the previous value. For true averaging, we'd need
      // historical data or multiple records per service.
      const result = await repository.getAverageResponseTime('plex')
      
      // Since we're using upsert, only the last value (200) will be present
      expect(result).toBe(200)
    })

    it('should return null for non-existent service', async () => {
      const result = await repository.getAverageResponseTime('non-existent')
      expect(result).toBeNull()
    })

    it('should handle service with null response times', async () => {
      await repository.upsert('test-service', { status: 'healthy' })
      
      const result = await repository.getAverageResponseTime('test-service')
      expect(result).toBeNull()
    })
  })

  describe('real-world scenarios', () => {
    it('should handle service monitoring workflow', async () => {
      const serviceName = 'plex'
      
      // 1. Initial health check - service is down
      await repository.updateStatus(serviceName, 'unhealthy', 5000)
      let status = await repository.findByName(serviceName)
      expect(status?.status).toBe('unhealthy')
      
      // 2. Service recovers
      await repository.updateStatus(serviceName, 'healthy', 150)
      status = await repository.findByName(serviceName)
      expect(status?.status).toBe('healthy')
      expect(status?.responseTimeMs).toBe(150)
      
      // 3. Update uptime percentage
      await repository.updateUptimePercentage(serviceName, 98.5)
      status = await repository.findByName(serviceName)
      expect(status?.uptimePercentage?.toNumber()).toBe(98.5)
      
      // 4. Service becomes degraded
      await repository.updateStatus(serviceName, 'degraded', 800)
      status = await repository.findByName(serviceName)
      expect(status?.status).toBe('degraded')
      expect(status?.responseTimeMs).toBe(800)
    })

    it('should handle dashboard overview queries', async () => {
      // Setup various service states
      await repository.updateStatus('plex', 'healthy', 120)
      await repository.updateStatus('overseerr', 'healthy', 200)
      await repository.updateStatus('sonarr', 'degraded', 1500)
      await repository.updateStatus('radarr', 'unhealthy', 5000)
      
      // Old check for uptime-kuma
      const oldTime = new Date(Date.now() - (2 * 60 * 60 * 1000)) // 2 hours ago
      await repository.upsert('uptime-kuma', {
        status: 'healthy',
        lastCheckAt: oldTime
      })

      // Dashboard queries
      const allServices = await repository.findAll()
      expect(allServices).toHaveLength(5)

      const healthyServices = await repository.getHealthyServices()
      expect(healthyServices).toHaveLength(2) // plex, overseerr

      const unhealthyServices = await repository.getUnhealthyServices()
      expect(unhealthyServices).toHaveLength(2) // sonarr (degraded), radarr (unhealthy)

      const staleServices = await repository.getServicesStalerThan(60) // 1 hour
      expect(staleServices).toHaveLength(1) // uptime-kuma
      expect(staleServices[0].serviceName).toBe('uptime-kuma')
    })
  })
})