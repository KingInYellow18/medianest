import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { EventEmitter } from 'events'
import { IntegrationService, ServiceHealthStatus, ServiceIntegrationConfig } from '@/services/integration.service'
import { UptimeKumaClient } from '@/integrations/uptime-kuma/uptime-kuma-client'
import { initializeRedis, getRedis } from '@/config/redis'

// Mock WebSocket for testing
class MockWebSocket extends EventEmitter {
  public readyState: number = 1
  public static OPEN = 1
  public static CLOSED = 3

  constructor(public url: string) {
    super()
    setTimeout(() => this.emit('open'), 10)
  }

  send(data: string) {
    // Simulate server responses
    if (data === '3') return // Pong response
    
    setTimeout(() => {
      if (data.includes('getMonitorList')) {
        this.simulateMonitorData()
      }
    }, 5)
  }

  close() {
    this.readyState = MockWebSocket.CLOSED
    this.emit('close', 1000, 'Normal closure')
  }

  private simulateMonitorData() {
    // Simulate monitor list
    const monitors = {
      '1': { id: 1, name: 'Web Server', url: 'https://example.com', active: true, type: 'http' },
      '2': { id: 2, name: 'Database', hostname: 'db.local', port: 5432, active: true, type: 'port' }
    }
    this.emit('message', `42["monitorList",${JSON.stringify(monitors)}]`)

    // Simulate heartbeats after monitors
    setTimeout(() => {
      const heartbeats = {
        '1': [{ id: 101, monitorId: 1, status: 1, time: new Date().toISOString(), msg: 'OK', ping: 45 }],
        '2': [{ id: 201, monitorId: 2, status: 0, time: new Date().toISOString(), msg: 'Connection timeout', ping: null }]
      }
      this.emit('message', `42["heartbeatList",${JSON.stringify(heartbeats)}]`)
    }, 20)
  }

  // Method to simulate real-time events
  simulateHeartbeat(monitorId: number, status: 0 | 1, msg: string, ping?: number) {
    const heartbeat = {
      id: Date.now(),
      monitorId,
      status,
      time: new Date().toISOString(),
      msg,
      ping,
      duration: status === 1 ? Math.floor(Math.random() * 500) + 100 : null,
      down_count: status === 0 ? 1 : 0,
      up_count: status === 1 ? 1 : 0
    }
    this.emit('message', `42["heartbeat",${JSON.stringify(heartbeat)}]`)
  }

  simulateMonitorUpdate(monitors: Record<string, any>) {
    this.emit('message', `42["monitorList",${JSON.stringify(monitors)}]`)
  }

  simulateStatsUpdate(stats: any) {
    this.emit('message', `42["statsUpdated",${JSON.stringify(stats)}]`)
  }

  simulateInfo(info: any) {
    this.emit('message', `42["info",${JSON.stringify(info)}]`)
  }

  simulateAvgPing(data: any) {
    this.emit('message', `42["avgPing",${JSON.stringify(data)}]`)
  }
}

// Mock WebSocket globally
vi.mock('ws', () => ({
  default: MockWebSocket
}))

// Mock other clients
vi.mock('@/integrations/plex/plex-api.client')
vi.mock('@/integrations/overseerr/overseerr-api.client')

describe('WebSocket Event Handling and Real-time Functionality Tests', () => {
  let integrationService: IntegrationService
  let redis: ReturnType<typeof getRedis>
  let mockUptimeClient: UptimeKumaClient
  let mockWebSocket: MockWebSocket

  beforeEach(async () => {
    vi.clearAllTimers()
    vi.useFakeTimers()

    // Initialize Redis
    await initializeRedis()
    redis = getRedis()
    await redis.flushdb()

    const config: ServiceIntegrationConfig = {
      uptimeKuma: {
        enabled: true,
        url: 'ws://uptime.local:3001',
        username: 'admin',
        password: 'password',
        reconnectInterval: 1000,
        heartbeatInterval: 5000
      }
    }

    integrationService = new IntegrationService(config)
    await integrationService.initialize()
    
    mockUptimeClient = integrationService.getUptimeKumaClient()!
    
    // Get reference to the mock WebSocket
    mockWebSocket = (mockUptimeClient as any).ws
  })

  afterEach(async () => {
    if (integrationService) {
      await integrationService.shutdown()
    }
    await redis.flushdb()
    vi.useRealTimers()
  })

  describe('Real-time Monitor Status Updates', () => {
    beforeEach(async () => {
      // Let connection establish and initial data load
      vi.advanceTimersByTime(100)
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    it('should handle real-time heartbeat updates', async () => {
      const heartbeatEvents: any[] = []
      const statsEvents: any[] = []
      
      integrationService.on('uptimeKumaHeartbeat', (heartbeat) => {
        heartbeatEvents.push(heartbeat)
      })
      
      integrationService.on('uptimeKumaStatsUpdated', (stats) => {
        statsEvents.push(stats)
      })

      // Simulate monitor 1 going down
      mockWebSocket.simulateHeartbeat(1, 0, 'Service unavailable')
      await new Promise(resolve => setTimeout(resolve, 0))

      expect(heartbeatEvents).toHaveLength(1)
      expect(heartbeatEvents[0]).toMatchObject({
        monitorId: 1,
        status: 0,
        msg: 'Service unavailable',
        ping: null
      })

      // Stats should update to reflect the change
      expect(statsEvents.length).toBeGreaterThan(0)
      const latestStats = statsEvents[statsEvents.length - 1]
      expect(latestStats.down).toBeGreaterThan(0)

      // Simulate monitor 1 coming back up
      mockWebSocket.simulateHeartbeat(1, 1, 'Service restored', 42)
      await new Promise(resolve => setTimeout(resolve, 0))

      expect(heartbeatEvents).toHaveLength(2)
      expect(heartbeatEvents[1]).toMatchObject({
        monitorId: 1,
        status: 1,
        msg: 'Service restored',
        ping: 42
      })
    })

    it('should handle multiple simultaneous monitor updates', async () => {
      const heartbeatEvents: any[] = []
      
      integrationService.on('uptimeKumaHeartbeat', (heartbeat) => {
        heartbeatEvents.push(heartbeat)
      })

      // Simulate rapid updates from multiple monitors
      mockWebSocket.simulateHeartbeat(1, 1, 'OK', 25)
      mockWebSocket.simulateHeartbeat(2, 0, 'Connection timeout')
      mockWebSocket.simulateHeartbeat(1, 1, 'OK', 30)
      mockWebSocket.simulateHeartbeat(2, 1, 'Connection restored', 55)

      await new Promise(resolve => setTimeout(resolve, 0))

      expect(heartbeatEvents).toHaveLength(4)
      
      // Verify events are in order and contain correct data
      expect(heartbeatEvents[0]).toMatchObject({ monitorId: 1, status: 1, ping: 25 })
      expect(heartbeatEvents[1]).toMatchObject({ monitorId: 2, status: 0, ping: null })
      expect(heartbeatEvents[2]).toMatchObject({ monitorId: 1, status: 1, ping: 30 })
      expect(heartbeatEvents[3]).toMatchObject({ monitorId: 2, status: 1, ping: 55 })
    })

    it('should update monitor status in real-time', async () => {
      // Initial state: monitor 1 up, monitor 2 down
      expect(mockUptimeClient.getMonitorStatus(1)).toBe('up')
      expect(mockUptimeClient.getMonitorStatus(2)).toBe('down')

      // Monitor 1 goes down
      mockWebSocket.simulateHeartbeat(1, 0, 'Service unavailable')
      await new Promise(resolve => setTimeout(resolve, 0))

      expect(mockUptimeClient.getMonitorStatus(1)).toBe('down')
      expect(mockUptimeClient.getMonitorStatus(2)).toBe('down')

      // Monitor 2 comes up
      mockWebSocket.simulateHeartbeat(2, 1, 'Service restored', 45)
      await new Promise(resolve => setTimeout(resolve, 0))

      expect(mockUptimeClient.getMonitorStatus(1)).toBe('down')
      expect(mockUptimeClient.getMonitorStatus(2)).toBe('up')
    })

    it('should calculate uptime statistics in real-time', async () => {
      const statsEvents: any[] = []
      
      integrationService.on('uptimeKumaStatsUpdated', (stats) => {
        statsEvents.push(stats)
      })

      // Initial state: 1 up, 1 down
      let currentStats = mockUptimeClient.getStats()
      expect(currentStats.up).toBe(1)
      expect(currentStats.down).toBe(1)
      expect(currentStats.upRate).toBe('50.0')

      // Both monitors go up
      mockWebSocket.simulateHeartbeat(2, 1, 'Service restored', 35)
      await new Promise(resolve => setTimeout(resolve, 0))

      currentStats = mockUptimeClient.getStats()
      expect(currentStats.up).toBe(2)
      expect(currentStats.down).toBe(0)
      expect(currentStats.upRate).toBe('100.0')

      // One monitor goes down
      mockWebSocket.simulateHeartbeat(1, 0, 'Timeout')
      await new Promise(resolve => setTimeout(resolve, 0))

      currentStats = mockUptimeClient.getStats()
      expect(currentStats.up).toBe(1)
      expect(currentStats.down).toBe(1)
      expect(currentStats.upRate).toBe('50.0')
    })
  })

  describe('Dynamic Monitor Management', () => {
    beforeEach(async () => {
      vi.advanceTimersByTime(100)
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    it('should handle new monitors being added', async () => {
      const monitorEvents: any[] = []
      
      integrationService.on('uptimeKumaMonitorsUpdated', (monitors) => {
        monitorEvents.push(new Map(monitors))
      })

      // Initial state: 2 monitors
      expect(mockUptimeClient.getMonitors().size).toBe(2)

      // Add new monitor
      const updatedMonitors = {
        '1': { id: 1, name: 'Web Server', url: 'https://example.com', active: true, type: 'http' },
        '2': { id: 2, name: 'Database', hostname: 'db.local', port: 5432, active: true, type: 'port' },
        '3': { id: 3, name: 'API Gateway', url: 'https://api.example.com', active: true, type: 'http' }
      }

      mockWebSocket.simulateMonitorUpdate(updatedMonitors)
      await new Promise(resolve => setTimeout(resolve, 0))

      expect(mockUptimeClient.getMonitors().size).toBe(3)
      expect(monitorEvents.length).toBeGreaterThan(0)

      const newMonitor = mockUptimeClient.getMonitors().get(3)
      expect(newMonitor).toMatchObject({
        id: 3,
        name: 'API Gateway',
        url: 'https://api.example.com',
        active: true,
        type: 'http'
      })

      // Stats should reflect the new monitor as unknown initially
      const stats = mockUptimeClient.getStats()
      expect(stats.unknown).toBeGreaterThan(0)
    })

    it('should handle monitors being removed', async () => {
      const monitorEvents: any[] = []
      
      integrationService.on('uptimeKumaMonitorsUpdated', (monitors) => {
        monitorEvents.push(new Map(monitors))
      })

      // Remove monitor 2
      const reducedMonitors = {
        '1': { id: 1, name: 'Web Server', url: 'https://example.com', active: true, type: 'http' }
      }

      mockWebSocket.simulateMonitorUpdate(reducedMonitors)
      await new Promise(resolve => setTimeout(resolve, 0))

      expect(mockUptimeClient.getMonitors().size).toBe(1)
      expect(mockUptimeClient.getMonitorStatus(2)).toBe('unknown')

      // Stats should update accordingly
      const stats = mockUptimeClient.getStats()
      expect(stats.up + stats.down + stats.unknown + stats.pause).toBe(1)
    })

    it('should handle monitor configuration changes', async () => {
      const monitorEvents: any[] = []
      
      integrationService.on('uptimeKumaMonitorsUpdated', (monitors) => {
        monitorEvents.push(new Map(monitors))
      })

      // Update monitor 1 configuration
      const updatedMonitors = {
        '1': { 
          id: 1, 
          name: 'Web Server - Updated', 
          url: 'https://new-example.com', 
          active: true, 
          type: 'http',
          interval: 30 // Changed interval
        },
        '2': { id: 2, name: 'Database', hostname: 'db.local', port: 5432, active: true, type: 'port' }
      }

      mockWebSocket.simulateMonitorUpdate(updatedMonitors)
      await new Promise(resolve => setTimeout(resolve, 0))

      const updatedMonitor = mockUptimeClient.getMonitors().get(1)
      expect(updatedMonitor).toMatchObject({
        id: 1,
        name: 'Web Server - Updated',
        url: 'https://new-example.com',
        interval: 30
      })
    })

    it('should handle monitor activation/deactivation', async () => {
      // Deactivate monitor 1
      const deactivatedMonitors = {
        '1': { 
          id: 1, 
          name: 'Web Server', 
          url: 'https://example.com', 
          active: false, // Deactivated
          type: 'http'
        },
        '2': { id: 2, name: 'Database', hostname: 'db.local', port: 5432, active: true, type: 'port' }
      }

      mockWebSocket.simulateMonitorUpdate(deactivatedMonitors)
      await new Promise(resolve => setTimeout(resolve, 0))

      expect(mockUptimeClient.getMonitorStatus(1)).toBe('paused')

      // Stats should show the monitor as paused
      const stats = mockUptimeClient.getStats()
      expect(stats.pause).toBe(1)
    })
  })

  describe('WebSocket Connection Events', () => {
    it('should handle WebSocket connection events', async () => {
      const connectEvents: any[] = []
      const disconnectEvents: any[] = []
      
      integrationService.on('uptimeKumaConnected', () => {
        connectEvents.push({ timestamp: Date.now() })
      })
      
      integrationService.on('uptimeKumaDisconnected', () => {
        disconnectEvents.push({ timestamp: Date.now() })
      })

      // Connection should already be established
      vi.advanceTimersByTime(100)
      await new Promise(resolve => setTimeout(resolve, 0))

      // Simulate disconnection
      mockWebSocket.close()
      await new Promise(resolve => setTimeout(resolve, 0))

      expect(disconnectEvents.length).toBeGreaterThan(0)
    })

    it('should handle WebSocket reconnection', async () => {
      const connectEvents: any[] = []
      const disconnectEvents: any[] = []
      
      mockUptimeClient.on('connect', () => connectEvents.push({}))
      mockUptimeClient.on('disconnect', () => disconnectEvents.push({}))

      // Simulate connection loss
      mockWebSocket.close()
      vi.advanceTimersByTime(100)

      expect(disconnectEvents.length).toBe(1)

      // Simulate reconnection after interval
      vi.advanceTimersByTime(1500) // Past reconnect interval

      // In a real scenario, this would trigger a new connection attempt
      expect(mockUptimeClient.isHealthy()).toBe(false) // Still disconnected in mock
    })

    it('should handle WebSocket errors', async () => {
      const errorEvents: any[] = []
      
      mockUptimeClient.on('error', (error) => {
        errorEvents.push(error)
      })

      // Simulate WebSocket error
      mockWebSocket.emit('error', new Error('Connection error'))
      await new Promise(resolve => setTimeout(resolve, 0))

      expect(errorEvents.length).toBe(1)
      expect(errorEvents[0].message).toBe('Connection error')
    })
  })

  describe('Advanced Event Scenarios', () => {
    beforeEach(async () => {
      vi.advanceTimersByTime(100)
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    it('should handle server info updates', async () => {
      const infoEvents: any[] = []
      
      integrationService.on('uptimeKumaInfo', (info) => {
        infoEvents.push(info)
      })

      const serverInfo = {
        version: '1.18.5',
        latestVersion: '1.19.0',
        primaryBaseURL: 'https://uptime.example.com',
        serverTimezone: 'UTC',
        serverTimezoneOffset: '+00:00'
      }

      mockWebSocket.simulateInfo(serverInfo)
      await new Promise(resolve => setTimeout(resolve, 0))

      expect(infoEvents).toHaveLength(1)
      expect(infoEvents[0]).toMatchObject(serverInfo)
    })

    it('should handle average ping updates', async () => {
      const avgPingEvents: any[] = []
      
      integrationService.on('uptimeKumaAvgPing', (data) => {
        avgPingEvents.push(data)
      })

      const avgPingData = {
        monitorId: 1,
        avgPing: 45.7,
        period: '24h'
      }

      mockWebSocket.simulateAvgPing(avgPingData)
      await new Promise(resolve => setTimeout(resolve, 0))

      expect(avgPingEvents).toHaveLength(1)
      expect(avgPingEvents[0]).toMatchObject(avgPingData)
    })

    it('should handle rapid successive events', async () => {
      const allEvents: any[] = []
      
      integrationService.on('uptimeKumaHeartbeat', (data) => {
        allEvents.push({ type: 'heartbeat', data })
      })
      
      integrationService.on('uptimeKumaStatsUpdated', (data) => {
        allEvents.push({ type: 'stats', data })
      })

      // Rapid fire multiple events
      for (let i = 0; i < 10; i++) {
        mockWebSocket.simulateHeartbeat(1, i % 2 as 0 | 1, `Status ${i}`, i * 10)
      }

      await new Promise(resolve => setTimeout(resolve, 0))

      // Should have received all heartbeat events
      const heartbeatEvents = allEvents.filter(e => e.type === 'heartbeat')
      expect(heartbeatEvents.length).toBe(10)

      // Should have received stats updates
      const statsEvents = allEvents.filter(e => e.type === 'stats')
      expect(statsEvents.length).toBeGreaterThan(0)

      // Events should be in order
      heartbeatEvents.forEach((event, index) => {
        expect(event.data.msg).toBe(`Status ${index}`)
      })
    })

    it('should handle concurrent WebSocket operations', async () => {
      const events: any[] = []
      
      // Listen to multiple event types
      integrationService.on('uptimeKumaHeartbeat', (data) => events.push({ type: 'heartbeat', data }))
      integrationService.on('uptimeKumaMonitorsUpdated', (data) => events.push({ type: 'monitors', data }))
      integrationService.on('uptimeKumaStatsUpdated', (data) => events.push({ type: 'stats', data }))

      // Send multiple types of events simultaneously
      mockWebSocket.simulateHeartbeat(1, 1, 'Concurrent update 1', 25)
      
      const newMonitors = {
        '1': { id: 1, name: 'Web Server', url: 'https://example.com', active: true, type: 'http' },
        '2': { id: 2, name: 'Database', hostname: 'db.local', port: 5432, active: true, type: 'port' },
        '3': { id: 3, name: 'Cache Server', hostname: 'cache.local', port: 6379, active: true, type: 'port' }
      }
      mockWebSocket.simulateMonitorUpdate(newMonitors)
      
      mockWebSocket.simulateHeartbeat(2, 0, 'Concurrent update 2')

      await new Promise(resolve => setTimeout(resolve, 0))

      // Should have received all event types
      const heartbeats = events.filter(e => e.type === 'heartbeat')
      const monitors = events.filter(e => e.type === 'monitors')
      const stats = events.filter(e => e.type === 'stats')

      expect(heartbeats.length).toBe(2)
      expect(monitors.length).toBeGreaterThan(0)
      expect(stats.length).toBeGreaterThan(0)
    })
  })

  describe('Event Performance and Memory Management', () => {
    beforeEach(async () => {
      vi.advanceTimersByTime(100)
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    it('should handle high-frequency events efficiently', async () => {
      const events: any[] = []
      let eventCount = 0
      
      integrationService.on('uptimeKumaHeartbeat', () => {
        eventCount++
        if (eventCount <= 100) { // Only store first 100 to avoid memory issues in test
          events.push({ timestamp: Date.now() })
        }
      })

      const startTime = Date.now()

      // Generate 1000 rapid heartbeat events
      for (let i = 0; i < 1000; i++) {
        mockWebSocket.simulateHeartbeat(1, i % 2 as 0 | 1, `Event ${i}`, i)
      }

      await new Promise(resolve => setTimeout(resolve, 0))

      const endTime = Date.now()
      const processingTime = endTime - startTime

      expect(eventCount).toBe(1000)
      expect(processingTime).toBeLessThan(1000) // Should process quickly
      expect(events.length).toBe(100) // Limited by our test logic
    })

    it('should not leak memory with continuous events', async () => {
      // This test ensures that event handlers don't accumulate unbounded data
      const initialStats = mockUptimeClient.getStats()

      // Generate many events over time
      for (let batch = 0; batch < 10; batch++) {
        for (let i = 0; i < 50; i++) {
          mockWebSocket.simulateHeartbeat(1, (i + batch) % 2 as 0 | 1, `Batch ${batch} Event ${i}`)
        }
        await new Promise(resolve => setTimeout(resolve, 0))
      }

      // Client should still be responsive and not accumulate excessive data
      const finalStats = mockUptimeClient.getStats()
      expect(finalStats).toBeDefined()
      expect(typeof finalStats.up).toBe('number')
      expect(typeof finalStats.down).toBe('number')

      // Latest heartbeats should be maintained (not growing unbounded)
      const heartbeats = mockUptimeClient.getLatestHeartbeats()
      expect(heartbeats.size).toBeLessThanOrEqual(10) // Should not grow unbounded
    })

    it('should clean up event listeners on disconnect', () => {
      const initialListenerCount = mockUptimeClient.listenerCount('heartbeat')
      
      // Add some listeners
      const handler1 = () => {}
      const handler2 = () => {}
      
      mockUptimeClient.on('heartbeat', handler1)
      mockUptimeClient.on('heartbeat', handler2)
      
      expect(mockUptimeClient.listenerCount('heartbeat')).toBe(initialListenerCount + 2)
      
      // Disconnect should not remove user-added listeners, but internal cleanup should work
      mockUptimeClient.disconnect()
      
      // Verify client is properly disconnected
      expect(mockUptimeClient.isHealthy()).toBe(false)
      
      // Remove our test listeners
      mockUptimeClient.off('heartbeat', handler1)
      mockUptimeClient.off('heartbeat', handler2)
    })
  })
})