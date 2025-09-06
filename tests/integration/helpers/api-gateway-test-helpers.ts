import { Request, Response, NextFunction } from 'express'
import { EventEmitter } from 'events'
import { WebSocket } from 'ws'
import { redis } from '@/config/redis'

/**
 * API Gateway Integration Test Helpers
 * Utilities for testing complex service coordination scenarios
 */

export class ServiceMockManager {
  private mocks: Map<string, any> = new Map()
  private originalServices: Map<string, any> = new Map()

  constructor() {}

  mockService(serviceName: string, mockImplementation: any) {
    // Store original for restoration
    if (!this.originalServices.has(serviceName)) {
      // This would store original service implementation
      this.originalServices.set(serviceName, null)
    }
    
    this.mocks.set(serviceName, mockImplementation)
  }

  simulateServiceFailure(serviceName: string, errorType: 'timeout' | 'unavailable' | 'error' = 'unavailable') {
    const failureMock = {
      healthCheck: () => {
        switch (errorType) {
          case 'timeout':
            return new Promise(resolve => setTimeout(() => resolve({ healthy: false, error: 'Timeout' }), 10000))
          case 'unavailable':
            throw new Error('Service unavailable')
          case 'error':
            throw new Error('Internal service error')
        }
      },
      async connect() { throw new Error('Connection failed') },
      isHealthy: () => false,
      getCircuitBreakerStats: () => ({ state: 'OPEN', failures: 5 }),
    }

    this.mockService(serviceName, failureMock)
  }

  simulateCircuitBreakerOpen(serviceName: string) {
    const circuitBreakerMock = {
      healthCheck: () => ({ healthy: false, error: 'Circuit breaker open' }),
      getCircuitBreakerStats: () => ({ 
        state: 'OPEN', 
        failures: 10, 
        lastFailureTime: Date.now(),
        nextAttempt: Date.now() + 30000 
      }),
      resetCircuitBreaker: () => ({ state: 'CLOSED', failures: 0 }),
    }

    this.mockService(serviceName, circuitBreakerMock)
  }

  restoreServices() {
    this.mocks.clear()
    // In real implementation, would restore original services
  }

  getMock(serviceName: string) {
    return this.mocks.get(serviceName)
  }
}

export class RealTimeTestManager extends EventEmitter {
  private wsConnections: Set<WebSocket> = new Set()
  private sseConnections: Set<Response> = new Set()

  constructor() {
    super()
  }

  createWebSocketConnection(url: string, token: string): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(url, {
        headers: { Authorization: `Bearer ${token}` }
      })

      ws.on('open', () => {
        this.wsConnections.add(ws)
        resolve(ws)
      })

      ws.on('error', reject)
      ws.on('close', () => {
        this.wsConnections.delete(ws)
      })
    })
  }

  simulateBroadcast(eventType: string, data: any) {
    this.wsConnections.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: eventType, data }))
      }
    })
  }

  setupSSEConnection(res: Response, channel: string) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    })

    this.sseConnections.add(res)

    res.on('close', () => {
      this.sseConnections.delete(res)
    })

    // Send initial connection message
    res.write(`data: ${JSON.stringify({ type: 'connected', channel })}\n\n`)
  }

  simulateSSEEvent(eventType: string, data: any) {
    this.sseConnections.forEach(res => {
      try {
        res.write(`event: ${eventType}\n`)
        res.write(`data: ${JSON.stringify(data)}\n\n`)
      } catch (error) {
        this.sseConnections.delete(res)
      }
    })
  }

  cleanup() {
    this.wsConnections.forEach(ws => ws.close())
    this.sseConnections.forEach(res => {
      try {
        res.end()
      } catch {} // Ignore errors on cleanup
    })
    this.wsConnections.clear()
    this.sseConnections.clear()
  }
}

export class LoadTestManager {
  private activeRequests: Set<Promise<any>> = new Set()

  async simulateLoad(
    requestFactory: () => Promise<any>, 
    options: {
      concurrency: number
      duration: number
      rampUpTime?: number
    }
  ): Promise<LoadTestResult> {
    const results: LoadTestResult = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      minResponseTime: Infinity,
      maxResponseTime: 0,
      responseTimes: [],
      errorsByType: new Map(),
      throughput: 0
    }

    const startTime = Date.now()
    const endTime = startTime + options.duration
    const rampUpTime = options.rampUpTime || 0
    
    let activeWorkers = 0
    const maxWorkers = options.concurrency

    const startWorker = async () => {
      while (Date.now() < endTime) {
        const requestStart = Date.now()
        
        try {
          const request = requestFactory()
          this.activeRequests.add(request)
          
          await request
          
          const responseTime = Date.now() - requestStart
          results.totalRequests++
          results.successfulRequests++
          results.responseTimes.push(responseTime)
          results.minResponseTime = Math.min(results.minResponseTime, responseTime)
          results.maxResponseTime = Math.max(results.maxResponseTime, responseTime)
          
        } catch (error: any) {
          results.totalRequests++
          results.failedRequests++
          
          const errorType = error.code || error.message || 'unknown'
          const currentCount = results.errorsByType.get(errorType) || 0
          results.errorsByType.set(errorType, currentCount + 1)
          
        } finally {
          this.activeRequests.delete(requestFactory)
        }

        // Small delay to prevent overwhelming
        await new Promise(resolve => setTimeout(resolve, 10))
      }
    }

    // Ramp up workers
    const workers: Promise<void>[] = []
    
    for (let i = 0; i < maxWorkers; i++) {
      if (rampUpTime > 0) {
        await new Promise(resolve => setTimeout(resolve, rampUpTime / maxWorkers))
      }
      workers.push(startWorker())
    }

    // Wait for all workers to complete
    await Promise.all(workers)

    // Calculate final metrics
    const totalTime = Date.now() - startTime
    results.averageResponseTime = results.responseTimes.length > 0 
      ? results.responseTimes.reduce((sum, time) => sum + time, 0) / results.responseTimes.length 
      : 0
    results.throughput = results.totalRequests / (totalTime / 1000) // requests per second

    return results
  }

  async waitForCompletion(): Promise<void> {
    await Promise.all(this.activeRequests)
  }
}

export interface LoadTestResult {
  totalRequests: number
  successfulRequests: number
  failedRequests: number
  averageResponseTime: number
  minResponseTime: number
  maxResponseTime: number
  responseTimes: number[]
  errorsByType: Map<string, number>
  throughput: number
}

export class CacheTestManager {
  constructor(private redis: any) {}

  async setupCacheScenario(scenario: 'cold' | 'warm' | 'hot' | 'invalid') {
    const cacheKeys = [
      'service:health:*',
      'user:session:*', 
      'media:search:*',
      'api:rate-limit:*'
    ]

    switch (scenario) {
      case 'cold':
        // Clear all cache
        for (const pattern of cacheKeys) {
          const keys = await this.redis.keys(pattern)
          if (keys.length > 0) {
            await this.redis.del(...keys)
          }
        }
        break

      case 'warm':
        // Populate some cache entries
        await this.redis.setex('service:health:plex', 300, JSON.stringify({ healthy: true, lastChecked: Date.now() }))
        await this.redis.setex('service:health:overseerr', 300, JSON.stringify({ healthy: true, lastChecked: Date.now() }))
        break

      case 'hot':
        // Populate all relevant cache entries
        const services = ['plex', 'overseerr', 'uptimeKuma']
        for (const service of services) {
          await this.redis.setex(`service:health:${service}`, 300, 
            JSON.stringify({ healthy: true, lastChecked: Date.now(), responseTime: 100 }))
        }
        
        // Cache some search results
        await this.redis.setex('media:search:test', 600, 
          JSON.stringify({ results: [{ id: 1, title: 'Cached Result' }] }))
        break

      case 'invalid':
        // Set up stale cache entries
        await this.redis.setex('service:health:plex', 1, JSON.stringify({ healthy: true, lastChecked: Date.now() - 10000 }))
        await new Promise(resolve => setTimeout(resolve, 1500)) // Wait for expiry
        break
    }
  }

  async validateCacheInvalidation(operation: () => Promise<any>, expectedInvalidatedKeys: string[]) {
    // Store initial cache state
    const initialState = new Map()
    for (const key of expectedInvalidatedKeys) {
      const value = await this.redis.get(key)
      initialState.set(key, value)
    }

    // Perform operation that should invalidate cache
    await operation()

    // Check cache invalidation
    const results = {
      invalidated: [] as string[],
      stillCached: [] as string[]
    }

    for (const key of expectedInvalidatedKeys) {
      const currentValue = await this.redis.get(key)
      const initialValue = initialState.get(key)
      
      if (initialValue !== null && currentValue === null) {
        results.invalidated.push(key)
      } else if (currentValue !== null) {
        results.stillCached.push(key)
      }
    }

    return results
  }
}

export class ErrorScenarioManager {
  private scenarios: Map<string, () => void> = new Map()

  registerScenario(name: string, scenario: () => void) {
    this.scenarios.set(name, scenario)
  }

  executeScenario(name: string) {
    const scenario = this.scenarios.get(name)
    if (!scenario) {
      throw new Error(`Scenario '${name}' not found`)
    }
    scenario()
  }

  createNetworkPartitionScenario(services: string[], partitionType: 'complete' | 'intermittent') {
    return () => {
      services.forEach(service => {
        if (partitionType === 'complete') {
          this.simulateCompleteNetworkFailure(service)
        } else {
          this.simulateIntermittentNetworkFailure(service)
        }
      })
    }
  }

  private simulateCompleteNetworkFailure(service: string) {
    // Mock complete network failure
    // In real implementation, would intercept network calls
  }

  private simulateIntermittentNetworkFailure(service: string) {
    // Mock intermittent failures (e.g., 30% failure rate)
    // In real implementation, would randomly fail network calls
  }

  createCascadingFailureScenario(services: string[]) {
    return async () => {
      // Simulate cascading failures with delays
      for (let i = 0; i < services.length; i++) {
        const service = services[i]
        setTimeout(() => {
          this.simulateCompleteNetworkFailure(service)
        }, i * 1000) // Stagger failures by 1 second
      }
    }
  }

  cleanup() {
    this.scenarios.clear()
  }
}

export class IntegrationTestOrchestrator {
  private serviceMockManager = new ServiceMockManager()
  private realTimeManager = new RealTimeTestManager()
  private loadTestManager = new LoadTestManager()
  private cacheManager: CacheTestManager
  private errorScenarioManager = new ErrorScenarioManager()

  constructor(redis: any) {
    this.cacheManager = new CacheTestManager(redis)
  }

  getServiceMockManager() { return this.serviceMockManager }
  getRealTimeManager() { return this.realTimeManager }
  getLoadTestManager() { return this.loadTestManager }
  getCacheManager() { return this.cacheManager }
  getErrorScenarioManager() { return this.errorScenarioManager }

  async cleanup() {
    this.serviceMockManager.restoreServices()
    this.realTimeManager.cleanup()
    await this.loadTestManager.waitForCompletion()
    this.errorScenarioManager.cleanup()
  }
}