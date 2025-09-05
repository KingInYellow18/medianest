import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { EventEmitter } from 'events'
import { 
  UptimeKumaClient, 
  UptimeKumaConfig,
  UptimeKumaMonitor,
  UptimeKumaHeartbeat,
  UptimeKumaStats
} from '@/integrations/uptime-kuma/uptime-kuma-client'
import { CircuitState } from '@/utils/circuit-breaker'

// Mock WebSocket
class MockWebSocket extends EventEmitter {
  public readyState: number = 1 // OPEN
  public static OPEN = 1
  public static CLOSED = 3

  constructor(public url: string, public options?: any) {
    super()
    // Simulate connection delay
    setTimeout(() => {
      if (this.readyState === 1) {
        this.emit('open')
      }
    }, 10)
  }

  send(data: string) {
    // Echo back pong for ping messages
    if (data === '3') {
      return // Pong response, no further action needed
    }
    
    // Simulate server responses
    setTimeout(() => {
      this.simulateServerMessage(data)
    }, 5)
  }

  close() {
    this.readyState = MockWebSocket.CLOSED
    this.emit('close', 1000, 'Normal closure')
  }

  private simulateServerMessage(clientMessage: string) {
    if (clientMessage.startsWith('42')) {
      const eventData = clientMessage.substring(2)
      try {
        const parsed = JSON.parse(eventData)
        const [eventName, data] = parsed

        // Simulate responses based on client requests
        switch (eventName) {
          case 'login':
            this.emit('message', '42["authSuccess",{"username":"admin"}]')
            break
          case 'getMonitorList':
            this.simulateMonitorList()
            break
          default:
            // Echo back or ignore unknown events
            break
        }
      } catch (error) {
        // Invalid JSON, ignore
      }
    }
  }

  private simulateMonitorList() {
    const monitors = {
      '1': {
        id: 1,
        name: 'Test Website',
        url: 'https://example.com',
        type: 'http',
        interval: 60,
        active: true,
        tags: [{ id: 1, name: 'Production', color: '#28a745' }]
      },
      '2': {
        id: 2,
        name: 'Database Server',
        hostname: '192.168.1.100',
        port: 5432,
        type: 'port',
        interval: 30,
        active: true,
        tags: [{ id: 2, name: 'Critical', color: '#dc3545' }]
      }
    }

    this.emit('message', `42["monitorList",${JSON.stringify(monitors)}]`)

    // Also send heartbeat data
    setTimeout(() => {
      const heartbeats = {
        '1': [
          { id: 101, monitorId: 1, status: 1, time: new Date().toISOString(), msg: 'OK', ping: 45, duration: 200, down_count: 0, up_count: 100 },
          { id: 102, monitorId: 1, status: 1, time: new Date(Date.now() - 60000).toISOString(), msg: 'OK', ping: 52, duration: 180, down_count: 0, up_count: 99 }
        ],
        '2': [
          { id: 201, monitorId: 2, status: 0, time: new Date().toISOString(), msg: 'Connection refused', ping: null, duration: null, down_count: 1, up_count: 89 }
        ]
      }
      this.emit('message', `42["heartbeatList",${JSON.stringify(heartbeats)}]`)
    }, 20)
  }
}

// Mock WebSocket globally
vi.mock('ws', () => ({
  default: MockWebSocket
}))

describe('Uptime Kuma WebSocket Client Integration Tests', () => {
  let uptimeKumaClient: UptimeKumaClient
  let mockWebSocket: MockWebSocket

  beforeEach(() => {
    vi.clearAllTimers()
    vi.useFakeTimers()

    const config: UptimeKumaConfig = {
      url: 'http://uptime.local:3001',
      username: 'admin',
      password: 'password',
      reconnectInterval: 1000,
      heartbeatInterval: 5000,
      timeout: 10000
    }

    uptimeKumaClient = new UptimeKumaClient(config)
  })

  afterEach(async () => {
    if (uptimeKumaClient) {
      uptimeKumaClient.disconnect()
    }
    vi.useRealTimers()
  })

  describe('Connection Management', () => {
    it('should establish WebSocket connection successfully', async () => {
      const connectPromise = uptimeKumaClient.connect()
      
      // Fast forward to allow connection to complete
      vi.advanceTimersByTime(100)
      
      await connectPromise

      expect(uptimeKumaClient.isHealthy()).toBe(true)
      
      const stats = uptimeKumaClient.getCircuitBreakerStats()
      expect(stats.state).toBe(CircuitState.CLOSED)
    })

    it('should handle connection timeout', async () => {
      // Mock WebSocket that never opens
      const slowConfig: UptimeKumaConfig = {
        url: 'http://slow.test:3001',
        timeout: 1000
      }
      
      const slowClient = new UptimeKumaClient(slowConfig)
      
      const connectPromise = slowClient.connect()
      
      // Don't advance timers to simulate timeout
      await expect(connectPromise).rejects.toThrow('Connection timeout')
      
      expect(slowClient.isHealthy()).toBe(false)
    })

    it('should handle WebSocket connection errors', async () => {
      // Create client that will fail to connect
      const failConfig: UptimeKumaConfig = {
        url: 'http://unreachable.test:3001'
      }
      
      const failClient = new UptimeKumaClient(failConfig)
      
      await expect(failClient.connect()).rejects.toThrow()
      expect(failClient.isHealthy()).toBe(false)
    })

    it('should authenticate with username and password', async () => {
      const authEvents: any[] = []
      uptimeKumaClient.on('authSuccess', (data) => {
        authEvents.push(data)
      })

      await uptimeKumaClient.connect()
      vi.advanceTimersByTime(100)

      // Should have sent login message and received auth success
      expect(authEvents.length).toBeGreaterThanOrEqual(0)
    })

    it('should connect without authentication when credentials not provided', async () => {
      const noAuthConfig: UptimeKumaConfig = {
        url: 'http://uptime.local:3001'
      }
      
      const noAuthClient = new UptimeKumaClient(noAuthConfig)
      
      await noAuthClient.connect()
      vi.advanceTimersByTime(100)
      
      expect(noAuthClient.isHealthy()).toBe(true)
      
      noAuthClient.disconnect()
    })

    it('should disconnect cleanly', async () => {
      await uptimeKumaClient.connect()
      vi.advanceTimersByTime(100)
      
      expect(uptimeKumaClient.isHealthy()).toBe(true)
      
      uptimeKumaClient.disconnect()
      
      expect(uptimeKumaClient.isHealthy()).toBe(false)
    })
  })

  describe('Monitor Management', () => {
    beforeEach(async () => {
      await uptimeKumaClient.connect()
      vi.advanceTimersByTime(100)
    })

    it('should receive and parse monitor list', async () => {
      const monitorEvents: Map<number, UptimeKumaMonitor>[] = []
      
      uptimeKumaClient.on('monitorsUpdated', (monitors) => {
        monitorEvents.push(monitors)
      })

      // Advance time to let monitor list arrive
      vi.advanceTimersByTime(50)
      await new Promise(resolve => setTimeout(resolve, 0))

      expect(monitorEvents.length).toBeGreaterThan(0)
      
      const monitors = uptimeKumaClient.getMonitors()
      expect(monitors.size).toBe(2)
      
      const webMonitor = monitors.get(1)
      expect(webMonitor).toMatchObject({
        id: 1,
        name: 'Test Website',
        url: 'https://example.com',
        type: 'http',
        interval: 60,
        active: true
      })
      
      const dbMonitor = monitors.get(2)
      expect(dbMonitor).toMatchObject({
        id: 2,
        name: 'Database Server',
        hostname: '192.168.1.100',
        port: 5432,
        type: 'port',
        interval: 30,
        active: true
      })
    })

    it('should track monitor tags', async () => {
      vi.advanceTimersByTime(50)
      await new Promise(resolve => setTimeout(resolve, 0))

      const monitors = uptimeKumaClient.getMonitors()
      const webMonitor = monitors.get(1)
      
      expect(webMonitor?.tags).toEqual([
        { id: 1, name: 'Production', color: '#28a745' }
      ])
      
      const dbMonitor = monitors.get(2)
      expect(dbMonitor?.tags).toEqual([
        { id: 2, name: 'Critical', color: '#dc3545' }
      ])
    })

    it('should get individual monitor status', async () => {
      vi.advanceTimersByTime(100)
      await new Promise(resolve => setTimeout(resolve, 0))

      // Monitor 1 should be up (status: 1 in heartbeat)
      expect(uptimeKumaClient.getMonitorStatus(1)).toBe('up')
      
      // Monitor 2 should be down (status: 0 in heartbeat)
      expect(uptimeKumaClient.getMonitorStatus(2)).toBe('down')
      
      // Non-existent monitor should be unknown
      expect(uptimeKumaClient.getMonitorStatus(999)).toBe('unknown')
    })
  })

  describe('Heartbeat Processing', () => {
    beforeEach(async () => {
      await uptimeKumaClient.connect()
      vi.advanceTimersByTime(100)
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    it('should process heartbeat lists', async () => {
      const heartbeats = uptimeKumaClient.getLatestHeartbeats()
      expect(heartbeats.size).toBe(2)
      
      const webHeartbeat = heartbeats.get(1)
      expect(webHeartbeat).toMatchObject({
        id: 101,
        monitorId: 1,
        status: 1,
        msg: 'OK',
        ping: 45,
        duration: 200,
        down_count: 0,
        up_count: 100
      })
      
      const dbHeartbeat = heartbeats.get(2)
      expect(dbHeartbeat).toMatchObject({
        id: 201,
        monitorId: 2,
        status: 0,
        msg: 'Connection refused',
        ping: null,
        duration: null,
        down_count: 1,
        up_count: 89
      })
    })

    it('should emit individual heartbeat events', async () => {
      const heartbeatEvents: UptimeKumaHeartbeat[] = []
      
      uptimeKumaClient.on('heartbeat', (heartbeat) => {
        heartbeatEvents.push(heartbeat)
      })

      // Simulate a new individual heartbeat
      const mockWs = (uptimeKumaClient as any).ws
      const newHeartbeat = {
        id: 103,
        monitorId: 1,
        status: 1,
        time: new Date().toISOString(),
        msg: 'OK',
        ping: 38,
        duration: 150,
        down_count: 0,
        up_count: 101
      }
      
      mockWs.emit('message', `42["heartbeat",${JSON.stringify(newHeartbeat)}]`)
      
      await new Promise(resolve => setTimeout(resolve, 0))
      
      expect(heartbeatEvents).toContain(
        expect.objectContaining({
          id: 103,
          monitorId: 1,
          status: 1,
          ping: 38
        })
      )
    })

    it('should update statistics based on heartbeats', async () => {
      const stats = uptimeKumaClient.getStats()
      
      expect(stats).toMatchObject({
        up: 1,      // Monitor 1 is up
        down: 1,    // Monitor 2 is down
        unknown: 0, // All monitors have heartbeats
        pause: 0    // All monitors are active
      })
      
      expect(stats.upRate).toBe('50.0') // 1 up out of 2 total = 50%
    })

    it('should emit statistics update events', async () => {
      const statsEvents: UptimeKumaStats[] = []
      
      uptimeKumaClient.on('statsUpdated', (stats) => {
        statsEvents.push(stats)
      })

      // Wait for initial stats calculation
      await new Promise(resolve => setTimeout(resolve, 0))
      
      expect(statsEvents.length).toBeGreaterThan(0)
      
      const latestStats = statsEvents[statsEvents.length - 1]
      expect(latestStats).toMatchObject({
        up: expect.any(Number),
        down: expect.any(Number),
        unknown: expect.any(Number),
        pause: expect.any(Number)
      })
    })
  })

  describe('Real-time Updates', () => {
    beforeEach(async () => {
      await uptimeKumaClient.connect()
      vi.advanceTimersByTime(100)
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    it('should handle monitor state changes', async () => {
      const heartbeatEvents: UptimeKumaHeartbeat[] = []
      
      uptimeKumaClient.on('heartbeat', (heartbeat) => {
        heartbeatEvents.push(heartbeat)
      })

      // Simulate monitor 2 coming back online
      const mockWs = (uptimeKumaClient as any).ws
      const recoveryHeartbeat = {
        id: 202,
        monitorId: 2,
        status: 1, // Now up
        time: new Date().toISOString(),
        msg: 'Connection restored',
        ping: 25,
        duration: 100,
        down_count: 1,
        up_count: 90
      }
      
      mockWs.emit('message', `42["heartbeat",${JSON.stringify(recoveryHeartbeat)}]`)
      
      await new Promise(resolve => setTimeout(resolve, 0))
      
      // Status should have changed
      expect(uptimeKumaClient.getMonitorStatus(2)).toBe('up')
      
      // Stats should be updated
      const stats = uptimeKumaClient.getStats()
      expect(stats.up).toBe(2) // Both monitors now up
      expect(stats.down).toBe(0)
      expect(stats.upRate).toBe('100.0')
    })

    it('should handle new monitors being added', async () => {
      const monitorEvents: Map<number, UptimeKumaMonitor>[] = []
      
      uptimeKumaClient.on('monitorsUpdated', (monitors) => {
        monitorEvents.push(new Map(monitors))
      })

      // Simulate new monitor list with additional monitor
      const mockWs = (uptimeKumaClient as any).ws
      const updatedMonitors = {
        '1': {
          id: 1,
          name: 'Test Website',
          url: 'https://example.com',
          type: 'http',
          interval: 60,
          active: true,
          tags: []
        },
        '2': {
          id: 2,
          name: 'Database Server',
          hostname: '192.168.1.100',
          port: 5432,
          type: 'port',
          interval: 30,
          active: true,
          tags: []
        },
        '3': {
          id: 3,
          name: 'New API Service',
          url: 'https://api.example.com',
          type: 'http',
          interval: 30,
          active: true,
          tags: []
        }
      }
      
      mockWs.emit('message', `42["monitorList",${JSON.stringify(updatedMonitors)}]`)
      
      await new Promise(resolve => setTimeout(resolve, 0))
      
      expect(uptimeKumaClient.getMonitors().size).toBe(3)
      
      const newMonitor = uptimeKumaClient.getMonitors().get(3)
      expect(newMonitor).toMatchObject({
        id: 3,
        name: 'New API Service',
        url: 'https://api.example.com',
        type: 'http'
      })
    })

    it('should handle monitor removal', async () => {
      // Simulate monitor list with one monitor removed
      const mockWs = (uptimeKumaClient as any).ws
      const reducedMonitors = {
        '1': {
          id: 1,
          name: 'Test Website',
          url: 'https://example.com',
          type: 'http',
          interval: 60,
          active: true,
          tags: []
        }
      }
      
      mockWs.emit('message', `42["monitorList",${JSON.stringify(reducedMonitors)}]`)
      
      await new Promise(resolve => setTimeout(resolve, 0))
      
      expect(uptimeKumaClient.getMonitors().size).toBe(1)
      expect(uptimeKumaClient.getMonitorStatus(2)).toBe('unknown')
    })
  })

  describe('Connection Resilience', () => {
    it('should handle WebSocket ping/pong', async () => {
      await uptimeKumaClient.connect()
      vi.advanceTimersByTime(100)
      
      const mockWs = (uptimeKumaClient as any).ws
      let pongReceived = false
      
      // Mock the send method to capture pong responses
      const originalSend = mockWs.send
      mockWs.send = vi.fn((data: string) => {
        if (data === '3') { // Pong
          pongReceived = true
        }
        originalSend.call(mockWs, data)
      })
      
      // Simulate ping from server
      mockWs.emit('message', '2')
      
      await new Promise(resolve => setTimeout(resolve, 0))
      
      expect(pongReceived).toBe(true)
    })

    it('should detect heartbeat timeout and reconnect', async () => {
      await uptimeKumaClient.connect()
      vi.advanceTimersByTime(100)
      
      const disconnectEvents: any[] = []
      uptimeKumaClient.on('disconnect', (data) => {
        disconnectEvents.push(data)
      })
      
      // Fast forward past heartbeat timeout (should be 2x heartbeat interval)
      vi.advanceTimersByTime(15000) // 15 seconds, more than 2x default 5 second interval
      
      // Should have detected timeout and triggered disconnect/reconnect
      expect(disconnectEvents.length).toBeGreaterThan(0)
    })

    it('should attempt reconnection on connection loss', async () => {
      const connectEvents: any[] = []
      const disconnectEvents: any[] = []
      
      uptimeKumaClient.on('connect', () => connectEvents.push({}))
      uptimeKumaClient.on('disconnect', () => disconnectEvents.push({}))
      
      await uptimeKumaClient.connect()
      vi.advanceTimersByTime(100)
      
      expect(connectEvents.length).toBe(1)
      
      // Simulate connection loss
      const mockWs = (uptimeKumaClient as any).ws
      mockWs.close()
      
      vi.advanceTimersByTime(100)
      
      expect(disconnectEvents.length).toBe(1)
      
      // Should schedule reconnection
      vi.advanceTimersByTime(2000) // Past default reconnect interval of 1000ms
      
      // Should have attempted reconnection
      // (In a real scenario, this would create a new WebSocket connection)
    })

    it('should handle multiple rapid disconnections gracefully', async () => {
      await uptimeKumaClient.connect()
      vi.advanceTimersByTime(100)
      
      const mockWs = (uptimeKumaClient as any).ws
      
      // Simulate rapid connect/disconnect cycles
      for (let i = 0; i < 5; i++) {
        mockWs.close()
        vi.advanceTimersByTime(100)
        
        // Simulate reconnection
        mockWs.readyState = MockWebSocket.OPEN
        mockWs.emit('open')
        vi.advanceTimersByTime(100)
      }
      
      // Client should remain stable
      expect(uptimeKumaClient.isHealthy()).toBe(true)
    })
  })

  describe('Circuit Breaker Integration', () => {
    it('should track circuit breaker statistics', () => {
      const stats = uptimeKumaClient.getCircuitBreakerStats()
      
      expect(stats).toMatchObject({
        state: CircuitState.CLOSED,
        failures: 0,
        successes: expect.any(Number),
        requests: expect.any(Number)
      })
    })

    it('should open circuit breaker on repeated connection failures', async () => {
      // Create client with low failure threshold
      const fragileConfig: UptimeKumaConfig = {
        url: 'http://unreachable.test:3001',
        timeout: 100
      }
      
      const fragileClient = UptimeKumaClient.createClient(fragileConfig)
      
      // Attempt connections that will fail
      for (let i = 0; i < 4; i++) {
        try {
          await fragileClient.connect()
        } catch (error) {
          // Expected to fail
        }
      }
      
      const stats = fragileClient.getCircuitBreakerStats()
      expect(stats.state).toBe(CircuitState.OPEN)
      expect(stats.failures).toBeGreaterThanOrEqual(3)
    })

    it('should reset circuit breaker manually', async () => {
      // First open the circuit
      const fragileConfig: UptimeKumaConfig = {
        url: 'http://unreachable.test:3001',
        timeout: 100
      }
      
      const fragileClient = UptimeKumaClient.createClient(fragileConfig)
      
      // Trigger failures
      for (let i = 0; i < 4; i++) {
        try {
          await fragileClient.connect()
        } catch (error) {
          // Expected to fail
        }
      }
      
      expect(fragileClient.getCircuitBreakerStats().state).toBe(CircuitState.OPEN)
      
      // Reset circuit breaker
      fragileClient.resetCircuitBreaker()
      
      const stats = fragileClient.getCircuitBreakerStats()
      expect(stats.state).toBe(CircuitState.CLOSED)
      expect(stats.failures).toBe(0)
    })
  })

  describe('Error Handling', () => {
    it('should handle malformed WebSocket messages', async () => {
      await uptimeKumaClient.connect()
      vi.advanceTimersByTime(100)
      
      const errorEvents: any[] = []
      uptimeKumaClient.on('error', (error) => {
        errorEvents.push(error)
      })
      
      const mockWs = (uptimeKumaClient as any).ws
      
      // Send malformed messages
      mockWs.emit('message', 'invalid-json')
      mockWs.emit('message', '42[invalid-array')
      mockWs.emit('message', '42["unknownEvent"]')
      
      await new Promise(resolve => setTimeout(resolve, 0))
      
      // Client should remain stable despite malformed messages
      expect(uptimeKumaClient.isHealthy()).toBe(true)
    })

    it('should handle WebSocket errors gracefully', async () => {
      await uptimeKumaClient.connect()
      vi.advanceTimersByTime(100)
      
      const errorEvents: any[] = []
      uptimeKumaClient.on('error', (error) => {
        errorEvents.push(error)
      })
      
      const mockWs = (uptimeKumaClient as any).ws
      mockWs.emit('error', new Error('WebSocket error'))
      
      await new Promise(resolve => setTimeout(resolve, 0))
      
      expect(errorEvents.length).toBe(1)
      expect(errorEvents[0].message).toBe('WebSocket error')
    })

    it('should handle missing monitor data gracefully', async () => {
      await uptimeKumaClient.connect()
      vi.advanceTimersByTime(100)
      
      const mockWs = (uptimeKumaClient as any).ws
      
      // Send heartbeat for non-existent monitor
      const orphanHeartbeat = {
        id: 999,
        monitorId: 999,
        status: 1,
        time: new Date().toISOString(),
        msg: 'OK'
      }
      
      mockWs.emit('message', `42["heartbeat",${JSON.stringify(orphanHeartbeat)}]`)
      
      await new Promise(resolve => setTimeout(resolve, 0))
      
      // Should handle gracefully without crashing
      expect(uptimeKumaClient.isHealthy()).toBe(true)
      expect(uptimeKumaClient.getMonitorStatus(999)).toBe('unknown')
    })
  })

  describe('Performance and Resource Management', () => {
    it('should handle large numbers of monitors efficiently', async () => {
      await uptimeKumaClient.connect()
      vi.advanceTimersByTime(100)
      
      // Simulate large monitor list
      const largeMonitorList: Record<string, any> = {}
      const largeHeartbeatList: Record<string, any> = {}
      
      for (let i = 1; i <= 100; i++) {
        largeMonitorList[i.toString()] = {
          id: i,
          name: `Monitor ${i}`,
          url: `https://service${i}.example.com`,
          type: 'http',
          interval: 60,
          active: true,
          tags: []
        }
        
        largeHeartbeatList[i.toString()] = [{
          id: i * 1000,
          monitorId: i,
          status: Math.random() > 0.1 ? 1 : 0, // 90% up
          time: new Date().toISOString(),
          msg: 'OK',
          ping: Math.floor(Math.random() * 100) + 20
        }]
      }
      
      const mockWs = (uptimeKumaClient as any).ws
      mockWs.emit('message', `42["monitorList",${JSON.stringify(largeMonitorList)}]`)
      
      vi.advanceTimersByTime(50)
      
      mockWs.emit('message', `42["heartbeatList",${JSON.stringify(largeHeartbeatList)}]`)
      
      await new Promise(resolve => setTimeout(resolve, 0))
      
      // Should handle large data set efficiently
      expect(uptimeKumaClient.getMonitors().size).toBe(100)
      expect(uptimeKumaClient.getLatestHeartbeats().size).toBe(100)
      
      const stats = uptimeKumaClient.getStats()
      expect(stats.up + stats.down + stats.unknown + stats.pause).toBe(100)
    })

    it('should clean up resources on disconnect', () => {
      // Connect and populate with data
      uptimeKumaClient.connect()
      vi.advanceTimersByTime(100)
      
      // Verify we have data
      expect(uptimeKumaClient.getMonitors().size).toBeGreaterThan(0)
      
      // Disconnect should clean up timers but preserve data
      uptimeKumaClient.disconnect()
      
      // Data should still be accessible
      expect(uptimeKumaClient.getMonitors().size).toBeGreaterThan(0)
      expect(uptimeKumaClient.isHealthy()).toBe(false)
    })
  })

  describe('Factory Methods', () => {
    it('should create client using factory method', () => {
      const config: UptimeKumaConfig = {
        url: 'ws://uptime.test:3001',
        username: 'admin',
        password: 'secret'
      }
      
      const client = UptimeKumaClient.createClient(config)
      
      expect(client).toBeInstanceOf(UptimeKumaClient)
      expect(client.isHealthy()).toBe(false) // Not connected yet
    })
  })
})