/**
 * Edge Case Simulator for MediaNest API Testing
 * Advanced failure simulation and stress testing capabilities
 */

import { MockScenarioManager, MockScenario } from './scenario-manager'
import { HiveMindCoordinator } from '../../../shared/dist/utils/hive-mind-coordinator'

export interface EdgeCaseConfig {
  networkFailures: {
    enabled: boolean
    frequency: number // 0.0 to 1.0
    types: ('timeout' | 'connection-drop' | 'slow-network' | 'intermittent')[]
  }
  serverErrors: {
    enabled: boolean
    frequency: number
    types: (500 | 502 | 503 | 504)[]
  }
  rateLimiting: {
    enabled: boolean
    threshold: number
    windowMs: number
  }
  dataCorruption: {
    enabled: boolean
    frequency: number
    types: ('malformed-json' | 'missing-fields' | 'wrong-types' | 'empty-responses')[]
  }
  concurrency: {
    enabled: boolean
    maxConcurrentRequests: number
    requestBurstSize: number
  }
  memoryPressure: {
    enabled: boolean
    threshold: number // percentage
    degradationFactor: number
  }
}

export interface LoadTestConfig {
  duration: number // milliseconds
  rampUpTime: number // milliseconds
  maxConcurrentUsers: number
  requestsPerSecond: number
  endpoints: string[]
  thinkTime: {
    min: number
    max: number
  }
}

export interface ChaosTestConfig {
  enabled: boolean
  intensity: number // 0.0 to 1.0
  scenarios: string[]
  duration: number
  randomSeed?: number
}

export class EdgeCaseSimulator {
  private scenarioManager: MockScenarioManager
  private hiveMind: HiveMindCoordinator
  private activeConfig: EdgeCaseConfig
  private loadTestState: Map<string, any> = new Map()
  private chaosState: {
    active: boolean
    startTime: number
    scenarios: string[]
    intensity: number
  } | null = null

  constructor(scenarioManager: MockScenarioManager) {
    this.scenarioManager = scenarioManager
    this.hiveMind = scenarioManager['hiveMind'] // Access private property
    this.activeConfig = this.getDefaultConfig()
  }

  /**
   * Get default edge case configuration
   */
  private getDefaultConfig(): EdgeCaseConfig {
    return {
      networkFailures: {
        enabled: true,
        frequency: 0.05,
        types: ['timeout', 'connection-drop', 'slow-network']
      },
      serverErrors: {
        enabled: true,
        frequency: 0.02,
        types: [500, 502, 503]
      },
      rateLimiting: {
        enabled: true,
        threshold: 100,
        windowMs: 60000
      },
      dataCorruption: {
        enabled: true,
        frequency: 0.01,
        types: ['malformed-json', 'missing-fields']
      },
      concurrency: {
        enabled: true,
        maxConcurrentRequests: 50,
        requestBurstSize: 10
      },
      memoryPressure: {
        enabled: true,
        threshold: 80,
        degradationFactor: 0.5
      }
    }
  }

  /**
   * Start edge case simulation
   */
  async startSimulation(config?: Partial<EdgeCaseConfig>): Promise<void> {
    this.activeConfig = { ...this.activeConfig, ...config }
    
    // Register edge case scenarios
    await this.registerEdgeCaseScenarios()
    
    // Store simulation state in HIVE-MIND
    await this.hiveMind.storeState('edgeCase.simulation', {
      active: true,
      config: this.activeConfig,
      startTime: Date.now()
    })

    console.log('🎭 Edge case simulation started')
    console.log('📊 Configuration:', JSON.stringify(this.activeConfig, null, 2))
  }

  /**
   * Stop edge case simulation
   */
  async stopSimulation(): Promise<void> {
    await this.hiveMind.clearState('edgeCase.simulation')
    await this.hiveMind.clearState('edgeCase.stats')
    
    console.log('🛑 Edge case simulation stopped')
  }

  /**
   * Register comprehensive edge case scenarios
   */
  private async registerEdgeCaseScenarios(): Promise<void> {
    const scenarios: MockScenario[] = []

    // Network failure scenarios
    if (this.activeConfig.networkFailures.enabled) {
      scenarios.push(...this.createNetworkFailureScenarios())
    }

    // Server error scenarios
    if (this.activeConfig.serverErrors.enabled) {
      scenarios.push(...this.createServerErrorScenarios())
    }

    // Data corruption scenarios
    if (this.activeConfig.dataCorruption.enabled) {
      scenarios.push(...this.createDataCorruptionScenarios())
    }

    // Memory pressure scenarios
    if (this.activeConfig.memoryPressure.enabled) {
      scenarios.push(...this.createMemoryPressureScenarios())
    }

    // Register all scenarios
    scenarios.forEach(scenario => {
      this.scenarioManager.registerScenario(scenario)
    })

    // Activate scenarios based on configuration
    const scenarioIds = scenarios.map(s => s.id)
    await this.scenarioManager.applyScenarios(scenarioIds)
  }

  /**
   * Create network failure scenarios
   */
  private createNetworkFailureScenarios(): MockScenario[] {
    const scenarios: MockScenario[] = []
    const { frequency, types } = this.activeConfig.networkFailures

    if (types.includes('timeout')) {
      scenarios.push({
        id: 'network.timeout.aggressive',
        name: 'Aggressive Network Timeouts',
        description: 'Simulate frequent network timeouts',
        probability: frequency * 2,
        effects: {
          delay: 30000,
          statusCode: 408,
          errorType: 'timeout'
        },
        metadata: {
          category: 'network',
          severity: 'high',
          tags: ['timeout', 'network', 'edge-case']
        }
      })
    }

    if (types.includes('connection-drop')) {
      scenarios.push({
        id: 'network.connection-drop.random',
        name: 'Random Connection Drops',
        description: 'Simulate random connection drops mid-request',
        probability: frequency * 1.5,
        effects: {
          statusCode: 0,
          errorType: 'network'
        },
        metadata: {
          category: 'network',
          severity: 'critical',
          tags: ['connection', 'network', 'edge-case']
        }
      })
    }

    if (types.includes('slow-network')) {
      scenarios.push({
        id: 'network.slow-connection.extreme',
        name: 'Extremely Slow Network',
        description: 'Simulate extremely slow network conditions',
        probability: frequency * 3,
        effects: {
          delay: 10000
        },
        metadata: {
          category: 'network',
          severity: 'medium',
          tags: ['slow', 'network', 'edge-case']
        }
      })
    }

    if (types.includes('intermittent')) {
      scenarios.push({
        id: 'network.intermittent.failure',
        name: 'Intermittent Network Failures',
        description: 'Simulate intermittent network failures',
        probability: frequency * 2.5,
        effects: {
          statusCode: 0,
          failureRate: 0.3,
          errorType: 'network'
        },
        metadata: {
          category: 'network',
          severity: 'high',
          tags: ['intermittent', 'network', 'edge-case']
        }
      })
    }

    return scenarios
  }

  /**
   * Create server error scenarios
   */
  private createServerErrorScenarios(): MockScenario[] {
    const scenarios: MockScenario[] = []
    const { frequency, types } = this.activeConfig.serverErrors

    types.forEach(statusCode => {
      scenarios.push({
        id: `server.error.${statusCode}`,
        name: `Server Error ${statusCode}`,
        description: `Simulate ${statusCode} server errors`,
        probability: frequency,
        effects: {
          statusCode,
          errorType: 'server',
          delay: statusCode === 503 ? 2000 : 500
        },
        metadata: {
          category: 'server',
          severity: statusCode >= 500 ? 'critical' : 'high',
          tags: ['server-error', statusCode.toString(), 'edge-case']
        }
      })
    })

    return scenarios
  }

  /**
   * Create data corruption scenarios
   */
  private createDataCorruptionScenarios(): MockScenario[] {
    const scenarios: MockScenario[] = []
    const { frequency, types } = this.activeConfig.dataCorruption

    if (types.includes('malformed-json')) {
      scenarios.push({
        id: 'data.malformed-json',
        name: 'Malformed JSON Response',
        description: 'Return malformed JSON responses',
        probability: frequency,
        effects: {
          statusCode: 200,
          responseModification: 'malformed-json'
        },
        metadata: {
          category: 'data',
          severity: 'high',
          tags: ['json', 'corruption', 'edge-case']
        }
      })
    }

    if (types.includes('missing-fields')) {
      scenarios.push({
        id: 'data.missing-fields',
        name: 'Missing Required Fields',
        description: 'Return responses with missing required fields',
        probability: frequency * 2,
        effects: {
          statusCode: 200,
          responseModification: 'missing-fields'
        },
        metadata: {
          category: 'data',
          severity: 'medium',
          tags: ['fields', 'validation', 'edge-case']
        }
      })
    }

    if (types.includes('wrong-types')) {
      scenarios.push({
        id: 'data.wrong-types',
        name: 'Wrong Data Types',
        description: 'Return responses with incorrect data types',
        probability: frequency * 1.5,
        effects: {
          statusCode: 200,
          responseModification: 'wrong-types'
        },
        metadata: {
          category: 'data',
          severity: 'medium',
          tags: ['types', 'validation', 'edge-case']
        }
      })
    }

    if (types.includes('empty-responses')) {
      scenarios.push({
        id: 'data.empty-responses',
        name: 'Empty Responses',
        description: 'Return completely empty responses',
        probability: frequency * 0.5,
        effects: {
          statusCode: 200,
          responseModification: 'empty'
        },
        metadata: {
          category: 'data',
          severity: 'high',
          tags: ['empty', 'data', 'edge-case']
        }
      })
    }

    return scenarios
  }

  /**
   * Create memory pressure scenarios
   */
  private createMemoryPressureScenarios(): MockScenario[] {
    const scenarios: MockScenario[] = []
    const { threshold, degradationFactor } = this.activeConfig.memoryPressure

    scenarios.push({
      id: 'system.memory-pressure',
      name: 'Memory Pressure Response Degradation',
      description: 'Simulate response degradation under memory pressure',
      probability: 0.1,
      effects: {
        delay: 2000 * degradationFactor,
        statusCode: 200
      },
      metadata: {
        category: 'system',
        severity: 'medium',
        tags: ['memory', 'performance', 'edge-case']
      }
    })

    scenarios.push({
      id: 'system.out-of-memory',
      name: 'Out of Memory Errors',
      description: 'Simulate out of memory conditions',
      probability: 0.01,
      effects: {
        statusCode: 507,
        errorType: 'server'
      },
      metadata: {
        category: 'system',
        severity: 'critical',
        tags: ['memory', 'system', 'edge-case']
      }
    })

    return scenarios
  }

  /**
   * Start load testing simulation
   */
  async startLoadTest(config: LoadTestConfig): Promise<void> {
    const testId = `load-test-${Date.now()}`
    
    this.loadTestState.set(testId, {
      config,
      startTime: Date.now(),
      requestCount: 0,
      errorCount: 0,
      responseTimeStats: {
        min: Infinity,
        max: 0,
        avg: 0,
        p95: 0,
        p99: 0
      }
    })

    // Store in HIVE-MIND for monitoring
    await this.hiveMind.storeState('loadTest.active', {
      testId,
      config,
      startTime: Date.now()
    })

    console.log(`🚀 Load test started: ${testId}`)
    console.log('⚡ Configuration:', JSON.stringify(config, null, 2))

    // Simulate load test scenarios
    await this.simulateLoadTestScenarios(config)
  }

  /**
   * Simulate load test scenarios
   */
  private async simulateLoadTestScenarios(config: LoadTestConfig): Promise<void> {
    const loadScenarios: MockScenario[] = [
      {
        id: 'load.high-concurrent-requests',
        name: 'High Concurrent Requests',
        description: 'Simulate high concurrent request load',
        probability: 0.8,
        effects: {
          delay: Math.max(100, 1000 / config.requestsPerSecond)
        },
        metadata: {
          category: 'load',
          severity: 'high',
          tags: ['concurrency', 'load', 'performance']
        }
      },
      {
        id: 'load.resource-exhaustion',
        name: 'Resource Exhaustion',
        description: 'Simulate resource exhaustion under load',
        probability: 0.1,
        effects: {
          statusCode: 503,
          errorType: 'server',
          delay: 5000
        },
        metadata: {
          category: 'load',
          severity: 'critical',
          tags: ['resources', 'load', 'exhaustion']
        }
      },
      {
        id: 'load.degraded-performance',
        name: 'Degraded Performance Under Load',
        description: 'Simulate performance degradation under high load',
        probability: 0.3,
        effects: {
          delay: 2000 + (config.maxConcurrentUsers * 10)
        },
        metadata: {
          category: 'load',
          severity: 'medium',
          tags: ['performance', 'load', 'degradation']
        }
      }
    ]

    // Register and activate load test scenarios
    loadScenarios.forEach(scenario => {
      this.scenarioManager.registerScenario(scenario)
    })

    await this.scenarioManager.applyScenarios(loadScenarios.map(s => s.id))
  }

  /**
   * Start chaos testing
   */
  async startChaosTest(config: ChaosTestConfig): Promise<void> {
    if (config.randomSeed) {
      // Set random seed for reproducible chaos
      Math.random = this.seededRandom(config.randomSeed)
    }

    this.chaosState = {
      active: true,
      startTime: Date.now(),
      scenarios: config.scenarios,
      intensity: config.intensity
    }

    // Store chaos state in HIVE-MIND
    await this.hiveMind.storeState('chaosTest.active', this.chaosState)

    console.log('💥 Chaos testing started')
    console.log('🎲 Intensity:', config.intensity)
    console.log('⏱️  Duration:', config.duration / 1000, 'seconds')

    // Create chaos scenarios
    await this.createChaosScenarios(config)

    // Schedule chaos test end
    setTimeout(async () => {
      await this.stopChaosTest()
    }, config.duration)
  }

  /**
   * Stop chaos testing
   */
  async stopChaosTest(): Promise<void> {
    this.chaosState = null
    await this.hiveMind.clearState('chaosTest.active')
    
    console.log('🛑 Chaos testing stopped')
  }

  /**
   * Create chaos testing scenarios
   */
  private async createChaosScenarios(config: ChaosTestConfig): Promise<void> {
    const chaosScenarios: MockScenario[] = [
      {
        id: 'chaos.random-failures',
        name: 'Random Service Failures',
        description: 'Randomly fail services during chaos test',
        probability: config.intensity * 0.5,
        effects: {
          statusCode: 503,
          errorType: 'server'
        },
        metadata: {
          category: 'chaos',
          severity: 'critical',
          tags: ['chaos', 'random', 'failure']
        }
      },
      {
        id: 'chaos.cascading-failures',
        name: 'Cascading Failures',
        description: 'Simulate cascading service failures',
        probability: config.intensity * 0.2,
        effects: {
          statusCode: 502,
          errorType: 'server',
          delay: 10000
        },
        metadata: {
          category: 'chaos',
          severity: 'critical',
          tags: ['chaos', 'cascading', 'failure']
        }
      },
      {
        id: 'chaos.network-partitions',
        name: 'Network Partitions',
        description: 'Simulate network partition scenarios',
        probability: config.intensity * 0.1,
        effects: {
          statusCode: 0,
          errorType: 'network'
        },
        metadata: {
          category: 'chaos',
          severity: 'critical',
          tags: ['chaos', 'network', 'partition']
        }
      },
      {
        id: 'chaos.data-inconsistency',
        name: 'Data Inconsistency',
        description: 'Introduce data inconsistencies',
        probability: config.intensity * 0.3,
        effects: {
          statusCode: 200,
          responseModification: 'inconsistent-data'
        },
        metadata: {
          category: 'chaos',
          severity: 'high',
          tags: ['chaos', 'data', 'inconsistency']
        }
      }
    ]

    // Register chaos scenarios
    chaosScenarios.forEach(scenario => {
      this.scenarioManager.registerScenario(scenario)
    })

    // Apply selected scenarios
    const selectedScenarios = config.scenarios.length > 0 
      ? config.scenarios 
      : chaosScenarios.map(s => s.id)

    await this.scenarioManager.applyScenarios(selectedScenarios)
  }

  /**
   * Get simulation statistics
   */
  async getSimulationStats(): Promise<{
    edgeCase: any
    loadTest: any
    chaosTest: any
    scenarios: any
  }> {
    const edgeCaseState = await this.hiveMind.getState('edgeCase.simulation')
    const loadTestState = await this.hiveMind.getState('loadTest.active')
    const chaosTestState = await this.hiveMind.getState('chaosTest.active')
    const scenarioStats = this.scenarioManager.getScenarioStats()

    return {
      edgeCase: {
        active: !!edgeCaseState,
        config: this.activeConfig,
        duration: edgeCaseState ? Date.now() - edgeCaseState.startTime : 0
      },
      loadTest: {
        active: !!loadTestState,
        stats: this.getLoadTestStats()
      },
      chaosTest: {
        active: !!this.chaosState,
        intensity: this.chaosState?.intensity || 0,
        duration: this.chaosState ? Date.now() - this.chaosState.startTime : 0
      },
      scenarios: scenarioStats
    }
  }

  /**
   * Get load test statistics
   */
  private getLoadTestStats(): any {
    const stats = Array.from(this.loadTestState.values())
    return {
      totalTests: stats.length,
      totalRequests: stats.reduce((sum, test) => sum + test.requestCount, 0),
      totalErrors: stats.reduce((sum, test) => sum + test.errorCount, 0),
      avgResponseTime: stats.length > 0 ? 
        stats.reduce((sum, test) => sum + test.responseTimeStats.avg, 0) / stats.length : 0
    }
  }

  /**
   * Create seeded random function for reproducible chaos
   */
  private seededRandom(seed: number): () => number {
    let x = seed
    return () => {
      x = Math.sin(x) * 10000
      return x - Math.floor(x)
    }
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<EdgeCaseConfig>): void {
    this.activeConfig = { ...this.activeConfig, ...config }
  }

  /**
   * Get current configuration
   */
  getConfig(): EdgeCaseConfig {
    return { ...this.activeConfig }
  }

  /**
   * Reset simulation state
   */
  async reset(): Promise<void> {
    await this.stopSimulation()
    await this.stopChaosTest()
    this.loadTestState.clear()
    this.activeConfig = this.getDefaultConfig()
    
    console.log('🔄 Edge case simulator reset')
  }
}

export default EdgeCaseSimulator