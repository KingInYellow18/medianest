/**
 * Mock Scenario Manager for MediaNest API Testing
 * Handles edge case simulation and failure scenarios
 */

import { HiveMindCoordinator } from '../../../shared/dist/utils/hive-mind-coordinator'

export interface MockScenario {
  id: string
  name: string
  description: string
  probability: number
  conditions?: {
    endpoint?: string
    method?: string
    userAgent?: string
    timeRange?: [number, number]
  }
  effects: {
    delay?: number
    statusCode?: number
    errorType?: 'network' | 'server' | 'client' | 'timeout' | 'rate-limit'
    responseModification?: any
    failureRate?: number
  }
  metadata: {
    category: string
    severity: 'low' | 'medium' | 'high' | 'critical'
    tags: string[]
  }
}

export class MockScenarioManager {
  private scenarios: Map<string, MockScenario> = new Map()
  private activeScenarios: Set<string> = new Set()
  private hiveMind: HiveMindCoordinator
  private scenarioHistory: Array<{
    scenario: string
    timestamp: number
    endpoint: string
    result: 'success' | 'failure'
  }> = []

  constructor(hiveMind: HiveMindCoordinator) {
    this.hiveMind = hiveMind
    this.initializeDefaultScenarios()
  }

  /**
   * Initialize comprehensive default scenarios
   */
  private initializeDefaultScenarios(): void {
    // Network failure scenarios
    this.registerScenario({
      id: 'network.timeout',
      name: 'Network Timeout',
      description: 'Simulate network timeout errors',
      probability: 0.05,
      effects: {
        delay: 30000,
        statusCode: 408,
        errorType: 'timeout'
      },
      metadata: {
        category: 'network',
        severity: 'medium',
        tags: ['timeout', 'network', 'reliability']
      }
    })

    this.registerScenario({
      id: 'network.connection-drop',
      name: 'Connection Drop',
      description: 'Simulate sudden connection drops',
      probability: 0.03,
      effects: {
        statusCode: 0,
        errorType: 'network'
      },
      metadata: {
        category: 'network',
        severity: 'high',
        tags: ['connection', 'network', 'instability']
      }
    })

    this.registerScenario({
      id: 'network.slow-connection',
      name: 'Slow Network',
      description: 'Simulate slow network conditions',
      probability: 0.1,
      effects: {
        delay: 5000
      },
      metadata: {
        category: 'network',
        severity: 'low',
        tags: ['performance', 'network', 'latency']
      }
    })

    // Server error scenarios
    this.registerScenario({
      id: 'server.internal-error',
      name: 'Internal Server Error',
      description: 'Simulate 500 internal server errors',
      probability: 0.02,
      effects: {
        statusCode: 500,
        errorType: 'server'
      },
      metadata: {
        category: 'server',
        severity: 'critical',
        tags: ['5xx', 'server', 'critical']
      }
    })

    this.registerScenario({
      id: 'server.service-unavailable',
      name: 'Service Unavailable',
      description: 'Simulate 503 service unavailable errors',
      probability: 0.015,
      effects: {
        statusCode: 503,
        errorType: 'server',
        delay: 1000
      },
      metadata: {
        category: 'server',
        severity: 'high',
        tags: ['5xx', 'service', 'unavailable']
      }
    })

    this.registerScenario({
      id: 'server.bad-gateway',
      name: 'Bad Gateway',
      description: 'Simulate 502 bad gateway errors',
      probability: 0.01,
      effects: {
        statusCode: 502,
        errorType: 'server'
      },
      metadata: {
        category: 'server',
        severity: 'high',
        tags: ['5xx', 'gateway', 'proxy']
      }
    })

    // Rate limiting scenarios
    this.registerScenario({
      id: 'rate-limit.too-many-requests',
      name: 'Rate Limited',
      description: 'Simulate rate limiting responses',
      probability: 0.05,
      conditions: {
        timeRange: [Date.now() - 60000, Date.now()]
      },
      effects: {
        statusCode: 429,
        errorType: 'rate-limit',
        delay: 2000
      },
      metadata: {
        category: 'rate-limit',
        severity: 'medium',
        tags: ['429', 'rate-limit', 'throttling']
      }
    })

    // Authentication scenarios
    this.registerScenario({
      id: 'auth.token-expired',
      name: 'Token Expired',
      description: 'Simulate expired authentication tokens',
      probability: 0.04,
      conditions: {
        endpoint: 'auth'
      },
      effects: {
        statusCode: 401,
        errorType: 'client'
      },
      metadata: {
        category: 'auth',
        severity: 'medium',
        tags: ['401', 'auth', 'token']
      }
    })

    this.registerScenario({
      id: 'auth.invalid-credentials',
      name: 'Invalid Credentials',
      description: 'Simulate invalid authentication credentials',
      probability: 0.02,
      conditions: {
        endpoint: 'auth.login'
      },
      effects: {
        statusCode: 401,
        errorType: 'client'
      },
      metadata: {
        category: 'auth',
        severity: 'medium',
        tags: ['401', 'auth', 'credentials']
      }
    })

    // Data scenarios
    this.registerScenario({
      id: 'data.corruption',
      name: 'Data Corruption',
      description: 'Simulate corrupted or malformed data responses',
      probability: 0.01,
      effects: {
        statusCode: 200,
        responseModification: 'corrupt'
      },
      metadata: {
        category: 'data',
        severity: 'high',
        tags: ['corruption', 'data', 'malformed']
      }
    })

    this.registerScenario({
      id: 'data.empty-response',
      name: 'Empty Response',
      description: 'Simulate empty or null responses',
      probability: 0.03,
      effects: {
        statusCode: 200,
        responseModification: 'empty'
      },
      metadata: {
        category: 'data',
        severity: 'medium',
        tags: ['empty', 'data', 'null']
      }
    })

    // Service-specific scenarios
    this.registerPlexScenarios()
    this.registerOverseerrScenarios()
    this.registerMediaScenarios()
  }

  /**
   * Register Plex-specific scenarios
   */
  private registerPlexScenarios(): void {
    this.registerScenario({
      id: 'plex.server-offline',
      name: 'Plex Server Offline',
      description: 'Simulate Plex server being offline',
      probability: 0.02,
      conditions: {
        endpoint: 'plex'
      },
      effects: {
        statusCode: 503,
        errorType: 'server',
        delay: 5000
      },
      metadata: {
        category: 'plex',
        severity: 'high',
        tags: ['plex', 'offline', 'service']
      }
    })

    this.registerScenario({
      id: 'plex.library-scan-in-progress',
      name: 'Plex Library Scanning',
      description: 'Simulate Plex library scan affecting performance',
      probability: 0.05,
      conditions: {
        endpoint: 'plex.libraries'
      },
      effects: {
        delay: 3000,
        statusCode: 200
      },
      metadata: {
        category: 'plex',
        severity: 'low',
        tags: ['plex', 'scanning', 'performance']
      }
    })

    this.registerScenario({
      id: 'plex.authentication-failure',
      name: 'Plex Auth Failure',
      description: 'Simulate Plex authentication failures',
      probability: 0.03,
      conditions: {
        endpoint: 'auth.plex'
      },
      effects: {
        statusCode: 401,
        errorType: 'client'
      },
      metadata: {
        category: 'plex',
        severity: 'high',
        tags: ['plex', 'auth', 'failure']
      }
    })
  }

  /**
   * Register Overseerr-specific scenarios
   */
  private registerOverseerrScenarios(): void {
    this.registerScenario({
      id: 'overseerr.quota-exceeded',
      name: 'Overseerr Quota Exceeded',
      description: 'Simulate request quota being exceeded',
      probability: 0.02,
      conditions: {
        endpoint: 'media.request'
      },
      effects: {
        statusCode: 429,
        errorType: 'rate-limit'
      },
      metadata: {
        category: 'overseerr',
        severity: 'medium',
        tags: ['overseerr', 'quota', 'limit']
      }
    })

    this.registerScenario({
      id: 'overseerr.service-maintenance',
      name: 'Overseerr Maintenance',
      description: 'Simulate Overseerr being in maintenance mode',
      probability: 0.01,
      conditions: {
        endpoint: 'overseerr'
      },
      effects: {
        statusCode: 503,
        errorType: 'server',
        delay: 2000
      },
      metadata: {
        category: 'overseerr',
        severity: 'medium',
        tags: ['overseerr', 'maintenance', 'service']
      }
    })
  }

  /**
   * Register media-specific scenarios
   */
  private registerMediaScenarios(): void {
    this.registerScenario({
      id: 'media.search-timeout',
      name: 'Media Search Timeout',
      description: 'Simulate media search timeouts',
      probability: 0.03,
      conditions: {
        endpoint: 'media.search'
      },
      effects: {
        statusCode: 408,
        errorType: 'timeout',
        delay: 15000
      },
      metadata: {
        category: 'media',
        severity: 'medium',
        tags: ['media', 'search', 'timeout']
      }
    })

    this.registerScenario({
      id: 'media.metadata-unavailable',
      name: 'Metadata Unavailable',
      description: 'Simulate missing media metadata',
      probability: 0.05,
      conditions: {
        endpoint: 'media.details'
      },
      effects: {
        statusCode: 404,
        errorType: 'client'
      },
      metadata: {
        category: 'media',
        severity: 'low',
        tags: ['media', 'metadata', '404']
      }
    })
  }

  /**
   * Register a new scenario
   */
  registerScenario(scenario: MockScenario): void {
    this.scenarios.set(scenario.id, scenario)
  }

  /**
   * Get active scenario for an endpoint
   */
  async getActiveScenario(endpoint: string): Promise<MockScenario | null> {
    const applicableScenarios = Array.from(this.scenarios.values()).filter(scenario => {
      // Check if scenario is active
      if (!this.activeScenarios.has(scenario.id)) return false
      
      // Check endpoint conditions
      if (scenario.conditions?.endpoint && !endpoint.includes(scenario.conditions.endpoint)) {
        return false
      }
      
      // Check time conditions
      if (scenario.conditions?.timeRange) {
        const now = Date.now()
        const [start, end] = scenario.conditions.timeRange
        if (now < start || now > end) return false
      }
      
      return true
    })

    if (applicableScenarios.length === 0) return null

    // Select scenario based on probability and HIVE-MIND intelligence
    const selectedScenario = await this.selectIntelligentScenario(applicableScenarios, endpoint)
    
    // Record scenario usage
    this.recordScenarioUsage(selectedScenario, endpoint)
    
    return selectedScenario
  }

  /**
   * Intelligent scenario selection using HIVE-MIND
   */
  private async selectIntelligentScenario(
    scenarios: MockScenario[],
    endpoint: string
  ): Promise<MockScenario | null> {
    // Get historical data from HIVE-MIND
    const history = await this.hiveMind.getState('scenario.history') || []
    
    // Calculate adaptive probabilities based on recent failures
    const recentFailures = history.filter((h: any) => 
      h.timestamp > Date.now() - 300000 && // Last 5 minutes
      h.endpoint === endpoint &&
      h.result === 'failure'
    ).length

    // Adjust probabilities based on recent patterns
    const adjustedScenarios = scenarios.map(scenario => ({
      ...scenario,
      probability: this.adjustProbabilityForHistory(scenario, recentFailures)
    }))

    // Weighted random selection
    const totalWeight = adjustedScenarios.reduce((sum, s) => sum + s.probability, 0)
    const random = Math.random() * totalWeight
    
    let currentWeight = 0
    for (const scenario of adjustedScenarios) {
      currentWeight += scenario.probability
      if (random <= currentWeight) {
        return scenario
      }
    }

    return null
  }

  /**
   * Adjust probability based on historical patterns
   */
  private adjustProbabilityForHistory(scenario: MockScenario, recentFailures: number): number {
    let adjustedProbability = scenario.probability

    // Reduce probability if there have been many recent failures
    if (recentFailures > 3) {
      adjustedProbability *= 0.5
    } else if (recentFailures > 1) {
      adjustedProbability *= 0.75
    }

    // Increase probability for certain scenarios during specific conditions
    if (scenario.metadata.category === 'network' && Date.now() % 100 < 10) {
      adjustedProbability *= 2
    }

    return Math.min(adjustedProbability, 1.0)
  }

  /**
   * Record scenario usage for learning
   */
  private recordScenarioUsage(scenario: MockScenario | null, endpoint: string): void {
    if (!scenario) return

    const record = {
      scenario: scenario.id,
      timestamp: Date.now(),
      endpoint,
      result: 'success' // Will be updated based on actual result
    }

    this.scenarioHistory.push(record)
    
    // Keep only last 1000 records
    if (this.scenarioHistory.length > 1000) {
      this.scenarioHistory = this.scenarioHistory.slice(-1000)
    }

    // Store in HIVE-MIND for cross-test learning
    this.hiveMind.updateState('scenario.history', this.scenarioHistory)
  }

  /**
   * Apply scenarios by ID
   */
  async applyScenarios(scenarioIds: string[]): Promise<void> {
    this.activeScenarios.clear()
    scenarioIds.forEach(id => {
      if (this.scenarios.has(id)) {
        this.activeScenarios.add(id)
      }
    })

    // Notify HIVE-MIND of active scenarios
    await this.hiveMind.updateState('active.scenarios', Array.from(this.activeScenarios))
  }

  /**
   * Reset all scenarios
   */
  async resetScenarios(): Promise<void> {
    this.activeScenarios.clear()
    this.scenarioHistory = []
    await this.hiveMind.clearState('scenario.history')
    await this.hiveMind.clearState('active.scenarios')
  }

  /**
   * Get scenario statistics
   */
  getScenarioStats(): {
    total: number
    active: number
    categories: Record<string, number>
    recentUsage: Array<{scenario: string, count: number}>
  } {
    const categories = Array.from(this.scenarios.values()).reduce((acc, scenario) => {
      acc[scenario.metadata.category] = (acc[scenario.metadata.category] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const recentUsage = this.scenarioHistory
      .filter(h => h.timestamp > Date.now() - 3600000) // Last hour
      .reduce((acc, h) => {
        const existing = acc.find(item => item.scenario === h.scenario)
        if (existing) {
          existing.count++
        } else {
          acc.push({ scenario: h.scenario, count: 1 })
        }
        return acc
      }, [] as Array<{scenario: string, count: number}>)
      .sort((a, b) => b.count - a.count)

    return {
      total: this.scenarios.size,
      active: this.activeScenarios.size,
      categories,
      recentUsage
    }
  }

  /**
   * Get all available scenarios
   */
  getAllScenarios(): MockScenario[] {
    return Array.from(this.scenarios.values())
  }

  /**
   * Get active scenarios
   */
  getActiveScenarios(): MockScenario[] {
    return Array.from(this.activeScenarios)
      .map(id => this.scenarios.get(id))
      .filter(Boolean) as MockScenario[]
  }
}

export default MockScenarioManager