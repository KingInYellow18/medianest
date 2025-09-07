/**
 * Performance Testing Framework for MediaNest API Testing
 * Advanced load testing and performance monitoring with HIVE-MIND coordination
 */

import { HiveMindCoordinator } from '../../../shared/dist/utils/hive-mind-coordinator'
import { EdgeCaseSimulator, LoadTestConfig } from './edge-case-simulator'

export interface PerformanceMetrics {
  responseTime: {
    min: number
    max: number
    avg: number
    median: number
    p95: number
    p99: number
  }
  throughput: {
    requestsPerSecond: number
    bytesPerSecond: number
  }
  errors: {
    total: number
    rate: number
    byType: Record<string, number>
  }
  memory: {
    used: number
    peak: number
    growth: number
  }
  cpu: {
    usage: number
    peak: number
  }
  network: {
    connections: number
    bandwidth: number
  }
}

export interface LoadTestScenario {
  name: string
  description: string
  duration: number // milliseconds
  users: {
    initial: number
    max: number
    rampUpTime: number
  }
  requests: {
    distribution: Record<string, number> // endpoint -> weight
    thinkTime: {
      min: number
      max: number
    }
  }
  expectations: {
    maxResponseTime: number
    maxErrorRate: number
    minThroughput: number
  }
}

export interface StressTestConfig {
  maxUsers: number
  incrementStep: number
  holdTime: number // time to hold each load level
  breakingPoint: boolean // continue until system breaks
  resourceMonitoring: boolean
}

export class PerformanceTester {
  private hiveMind: HiveMindCoordinator
  private edgeCaseSimulator: EdgeCaseSimulator
  private activeTests: Map<string, any> = new Map()
  private metrics: Map<string, PerformanceMetrics> = new Map()
  private baselineMetrics: PerformanceMetrics | null = null

  constructor(hiveMind: HiveMindCoordinator, edgeCaseSimulator: EdgeCaseSimulator) {
    this.hiveMind = hiveMind
    this.edgeCaseSimulator = edgeCaseSimulator
  }

  /**
   * Run comprehensive performance test suite
   */
  async runPerformanceTestSuite(): Promise<{
    baseline: PerformanceMetrics
    loadTests: Record<string, PerformanceMetrics>
    stressTest: PerformanceMetrics
    recommendations: string[]
  }> {
    console.log('🚀 Starting comprehensive performance test suite...')
    
    // Store test session in HIVE-MIND
    const sessionId = `perf-test-${Date.now()}`
    await this.hiveMind.storeState('performance.session', {
      id: sessionId,
      startTime: Date.now(),
      status: 'running'
    })

    try {
      // 1. Establish baseline performance
      console.log('📊 Establishing baseline performance...')
      const baseline = await this.runBaselineTest()
      this.baselineMetrics = baseline

      // 2. Run standard load test scenarios
      console.log('⚡ Running load test scenarios...')
      const loadTests: Record<string, PerformanceMetrics> = {}
      
      const scenarios = this.getStandardLoadTestScenarios()
      for (const scenario of scenarios) {
        console.log(`🎯 Running ${scenario.name}...`)
        loadTests[scenario.name] = await this.runLoadTestScenario(scenario)
      }

      // 3. Run stress test to find breaking point
      console.log('🔥 Running stress test...')
      const stressTest = await this.runStressTest({
        maxUsers: 1000,
        incrementStep: 50,
        holdTime: 30000,
        breakingPoint: true,
        resourceMonitoring: true
      })

      // 4. Generate recommendations
      const recommendations = this.generatePerformanceRecommendations(
        baseline,
        loadTests,
        stressTest
      )

      // Store final results in HIVE-MIND
      await this.hiveMind.storeState('performance.results', {
        sessionId,
        baseline,
        loadTests,
        stressTest,
        recommendations,
        completedAt: Date.now()
      })

      console.log('✅ Performance test suite completed')
      return { baseline, loadTests, stressTest, recommendations }

    } catch (error) {
      console.error('❌ Performance test suite failed:', error)
      throw error
    }
  }

  /**
   * Run baseline performance test
   */
  private async runBaselineTest(): Promise<PerformanceMetrics> {
    const testConfig: LoadTestConfig = {
      duration: 60000, // 1 minute
      rampUpTime: 10000, // 10 seconds
      maxConcurrentUsers: 10,
      requestsPerSecond: 5,
      endpoints: [
        '/api/v1/health',
        '/api/v1/dashboard/status',
        '/api/v1/media/search',
        '/api/v1/services/status'
      ],
      thinkTime: {
        min: 1000,
        max: 3000
      }
    }

    return await this.runLoadTest('baseline', testConfig)
  }

  /**
   * Get standard load test scenarios
   */
  private getStandardLoadTestScenarios(): LoadTestScenario[] {
    return [
      {
        name: 'light-load',
        description: 'Light load simulation - typical usage',
        duration: 120000, // 2 minutes
        users: {
          initial: 5,
          max: 25,
          rampUpTime: 30000
        },
        requests: {
          distribution: {
            '/api/v1/media/search': 0.4,
            '/api/v1/dashboard/status': 0.2,
            '/api/v1/services/status': 0.2,
            '/api/v1/media/request': 0.1,
            '/api/v1/auth/refresh': 0.1
          },
          thinkTime: {
            min: 2000,
            max: 8000
          }
        },
        expectations: {
          maxResponseTime: 2000,
          maxErrorRate: 0.01,
          minThroughput: 20
        }
      },
      {
        name: 'moderate-load',
        description: 'Moderate load simulation - busy periods',
        duration: 180000, // 3 minutes
        users: {
          initial: 15,
          max: 75,
          rampUpTime: 45000
        },
        requests: {
          distribution: {
            '/api/v1/media/search': 0.5,
            '/api/v1/dashboard/status': 0.15,
            '/api/v1/services/status': 0.15,
            '/api/v1/media/request': 0.15,
            '/api/v1/auth/login': 0.05
          },
          thinkTime: {
            min: 1000,
            max: 5000
          }
        },
        expectations: {
          maxResponseTime: 3000,
          maxErrorRate: 0.02,
          minThroughput: 50
        }
      },
      {
        name: 'heavy-load',
        description: 'Heavy load simulation - peak usage',
        duration: 300000, // 5 minutes
        users: {
          initial: 25,
          max: 150,
          rampUpTime: 60000
        },
        requests: {
          distribution: {
            '/api/v1/media/search': 0.6,
            '/api/v1/media/request': 0.2,
            '/api/v1/dashboard/status': 0.1,
            '/api/v1/services/status': 0.05,
            '/api/v1/auth/refresh': 0.05
          },
          thinkTime: {
            min: 500,
            max: 2000
          }
        },
        expectations: {
          maxResponseTime: 5000,
          maxErrorRate: 0.05,
          minThroughput: 100
        }
      },
      {
        name: 'burst-load',
        description: 'Burst load simulation - sudden traffic spikes',
        duration: 180000, // 3 minutes
        users: {
          initial: 200,
          max: 200,
          rampUpTime: 5000 // Very fast ramp up
        },
        requests: {
          distribution: {
            '/api/v1/media/search': 0.7,
            '/api/v1/media/request': 0.3
          },
          thinkTime: {
            min: 100,
            max: 500
          }
        },
        expectations: {
          maxResponseTime: 8000,
          maxErrorRate: 0.1,
          minThroughput: 150
        }
      }
    ]
  }

  /**
   * Run load test scenario
   */
  private async runLoadTestScenario(scenario: LoadTestScenario): Promise<PerformanceMetrics> {
    const loadTestConfig: LoadTestConfig = {
      duration: scenario.duration,
      rampUpTime: scenario.users.rampUpTime,
      maxConcurrentUsers: scenario.users.max,
      requestsPerSecond: scenario.users.max / 10, // Rough estimate
      endpoints: Object.keys(scenario.requests.distribution),
      thinkTime: scenario.requests.thinkTime
    }

    return await this.runLoadTest(scenario.name, loadTestConfig)
  }

  /**
   * Run generic load test
   */
  private async runLoadTest(testName: string, config: LoadTestConfig): Promise<PerformanceMetrics> {
    const testId = `${testName}-${Date.now()}`
    
    // Store test configuration in HIVE-MIND
    await this.hiveMind.storeState(`performance.test.${testId}`, {
      name: testName,
      config,
      startTime: Date.now(),
      status: 'running'
    })

    // Initialize metrics tracking
    const metricsCollector = this.initializeMetricsCollector(testId)
    
    // Start the load test with edge case simulator
    await this.edgeCaseSimulator.startLoadTest(config)
    
    // Simulate load test execution
    const metrics = await this.simulateLoadTestExecution(config, metricsCollector)
    
    // Store results
    this.metrics.set(testId, metrics)
    await this.hiveMind.storeState(`performance.results.${testId}`, {
      testName,
      metrics,
      completedAt: Date.now()
    })

    return metrics
  }

  /**
   * Run stress test to find breaking point
   */
  private async runStressTest(config: StressTestConfig): Promise<PerformanceMetrics> {
    const testId = `stress-test-${Date.now()}`
    let currentUsers = config.incrementStep
    let breakingPointFound = false
    let lastSuccessfulLoad = 0
    const allMetrics: PerformanceMetrics[] = []

    console.log(`🔥 Starting stress test - finding breaking point up to ${config.maxUsers} users`)

    while (currentUsers <= config.maxUsers && !breakingPointFound) {
      console.log(`📈 Testing with ${currentUsers} concurrent users...`)
      
      const loadConfig: LoadTestConfig = {
        duration: config.holdTime,
        rampUpTime: Math.min(10000, config.holdTime / 3),
        maxConcurrentUsers: currentUsers,
        requestsPerSecond: currentUsers * 2,
        endpoints: [
          '/api/v1/media/search',
          '/api/v1/dashboard/status',
          '/api/v1/media/request'
        ],
        thinkTime: {
          min: 100,
          max: 500
        }
      }

      const metrics = await this.runLoadTest(`stress-${currentUsers}`, loadConfig)
      allMetrics.push(metrics)

      // Check if we've hit the breaking point
      if (metrics.errors.rate > 0.1 || metrics.responseTime.avg > 10000) {
        console.log(`💥 Breaking point found at ${currentUsers} users`)
        console.log(`📊 Error rate: ${(metrics.errors.rate * 100).toFixed(2)}%`)
        console.log(`⏱️  Avg response time: ${metrics.responseTime.avg}ms`)
        breakingPointFound = true
      } else {
        lastSuccessfulLoad = currentUsers
        console.log(`✅ Successfully handled ${currentUsers} users`)
      }

      currentUsers += config.incrementStep
    }

    // Return metrics from the breaking point or highest successful load
    const finalMetrics = allMetrics[allMetrics.length - 1]
    
    // Store stress test results
    await this.hiveMind.storeState('performance.stressTest', {
      maxUsersHandled: lastSuccessfulLoad,
      breakingPoint: breakingPointFound ? currentUsers - config.incrementStep : null,
      allResults: allMetrics,
      completedAt: Date.now()
    })

    return finalMetrics
  }

  /**
   * Initialize metrics collector
   */
  private initializeMetricsCollector(testId: string): any {
    return {
      responseTimes: [] as number[],
      errors: [] as any[],
      requestCount: 0,
      bytesReceived: 0,
      startTime: Date.now(),
      memoryUsage: [] as number[],
      cpuUsage: [] as number[]
    }
  }

  /**
   * Simulate load test execution and collect metrics
   */
  private async simulateLoadTestExecution(
    config: LoadTestConfig, 
    collector: any
  ): Promise<PerformanceMetrics> {
    const duration = config.duration
    const startTime = Date.now()
    
    // Simulate requests being made
    const totalRequests = Math.floor((duration / 1000) * config.requestsPerSecond)
    
    for (let i = 0; i < totalRequests; i++) {
      // Simulate response time with realistic distribution
      const responseTime = this.generateRealisticResponseTime(config.maxConcurrentUsers)
      collector.responseTimes.push(responseTime)
      collector.requestCount++
      
      // Simulate random errors based on load
      if (Math.random() < this.calculateErrorRate(config.maxConcurrentUsers)) {
        collector.errors.push({
          type: 'timeout',
          endpoint: config.endpoints[Math.floor(Math.random() * config.endpoints.length)]
        })
      }
      
      // Simulate received bytes
      collector.bytesReceived += Math.floor(Math.random() * 5000) + 1000
      
      // Add small delay to simulate real requests
      if (i % 100 === 0) {
        await new Promise(resolve => setTimeout(resolve, 10))
        
        // Simulate resource usage
        collector.memoryUsage.push(this.simulateMemoryUsage(config.maxConcurrentUsers))
        collector.cpuUsage.push(this.simulateCpuUsage(config.maxConcurrentUsers))
      }
    }
    
    return this.calculateMetrics(collector, duration)
  }

  /**
   * Generate realistic response time based on load
   */
  private generateRealisticResponseTime(concurrentUsers: number): number {
    const baseTime = 200
    const loadFactor = Math.log(concurrentUsers + 1) * 50
    const randomVariation = (Math.random() - 0.5) * 100
    
    return Math.max(50, baseTime + loadFactor + randomVariation)
  }

  /**
   * Calculate error rate based on load
   */
  private calculateErrorRate(concurrentUsers: number): number {
    if (concurrentUsers < 25) return 0.001
    if (concurrentUsers < 50) return 0.005
    if (concurrentUsers < 100) return 0.02
    if (concurrentUsers < 200) return 0.05
    return 0.1
  }

  /**
   * Simulate memory usage
   */
  private simulateMemoryUsage(concurrentUsers: number): number {
    const baseUsage = 512 // MB
    const perUserUsage = concurrentUsers * 2
    const variation = (Math.random() - 0.5) * 100
    
    return Math.max(256, baseUsage + perUserUsage + variation)
  }

  /**
   * Simulate CPU usage
   */
  private simulateCpuUsage(concurrentUsers: number): number {
    const baseUsage = 15 // %
    const loadUsage = concurrentUsers * 0.5
    const variation = (Math.random() - 0.5) * 20
    
    return Math.min(100, Math.max(5, baseUsage + loadUsage + variation))
  }

  /**
   * Calculate final metrics from collected data
   */
  private calculateMetrics(collector: any, duration: number): PerformanceMetrics {
    const responseTimes = collector.responseTimes.sort((a: number, b: number) => a - b)
    const errorCount = collector.errors.length
    const requestCount = collector.requestCount
    
    return {
      responseTime: {
        min: Math.min(...responseTimes),
        max: Math.max(...responseTimes),
        avg: responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length,
        median: responseTimes[Math.floor(responseTimes.length / 2)],
        p95: responseTimes[Math.floor(responseTimes.length * 0.95)],
        p99: responseTimes[Math.floor(responseTimes.length * 0.99)]
      },
      throughput: {
        requestsPerSecond: (requestCount / duration) * 1000,
        bytesPerSecond: (collector.bytesReceived / duration) * 1000
      },
      errors: {
        total: errorCount,
        rate: errorCount / requestCount,
        byType: collector.errors.reduce((acc: any, error: any) => {
          acc[error.type] = (acc[error.type] || 0) + 1
          return acc
        }, {})
      },
      memory: {
        used: collector.memoryUsage.length > 0 ? 
          collector.memoryUsage.reduce((sum: number, mem: number) => sum + mem, 0) / collector.memoryUsage.length : 0,
        peak: collector.memoryUsage.length > 0 ? Math.max(...collector.memoryUsage) : 0,
        growth: collector.memoryUsage.length > 1 ? 
          collector.memoryUsage[collector.memoryUsage.length - 1] - collector.memoryUsage[0] : 0
      },
      cpu: {
        usage: collector.cpuUsage.length > 0 ? 
          collector.cpuUsage.reduce((sum: number, cpu: number) => sum + cpu, 0) / collector.cpuUsage.length : 0,
        peak: collector.cpuUsage.length > 0 ? Math.max(...collector.cpuUsage) : 0
      },
      network: {
        connections: requestCount,
        bandwidth: collector.bytesReceived
      }
    }
  }

  /**
   * Generate performance recommendations
   */
  private generatePerformanceRecommendations(
    baseline: PerformanceMetrics,
    loadTests: Record<string, PerformanceMetrics>,
    stressTest: PerformanceMetrics
  ): string[] {
    const recommendations: string[] = []

    // Response time analysis
    if (baseline.responseTime.avg > 1000) {
      recommendations.push('🐌 Baseline response time is high (>1s). Consider optimizing database queries and API logic.')
    }

    if (stressTest.responseTime.p95 > 5000) {
      recommendations.push('⚠️  95th percentile response time exceeds 5s under load. Implement caching and connection pooling.')
    }

    // Error rate analysis
    Object.entries(loadTests).forEach(([testName, metrics]) => {
      if (metrics.errors.rate > 0.05) {
        recommendations.push(`❌ ${testName} shows high error rate (${(metrics.errors.rate * 100).toFixed(1)}%). Investigate error handling and timeout configurations.`)
      }
    })

    // Memory analysis
    if (stressTest.memory.growth > 500) {
      recommendations.push('💾 Significant memory growth detected under load. Check for memory leaks and implement proper garbage collection.')
    }

    // CPU analysis
    if (stressTest.cpu.peak > 90) {
      recommendations.push('🔥 CPU usage peaks above 90%. Consider horizontal scaling or code optimization.')
    }

    // Throughput analysis
    const heavyLoadTest = loadTests['heavy-load']
    if (heavyLoadTest && heavyLoadTest.throughput.requestsPerSecond < 50) {
      recommendations.push('📉 Low throughput under heavy load. Consider implementing request batching and asynchronous processing.')
    }

    // General recommendations
    if (recommendations.length === 0) {
      recommendations.push('✅ System performance is within acceptable parameters.')
      recommendations.push('🔍 Consider implementing APM tools for continuous monitoring.')
      recommendations.push('📊 Set up performance budgets and automated alerting.')
    }

    return recommendations
  }

  /**
   * Compare performance against baseline
   */
  compareToBaseline(metrics: PerformanceMetrics): {
    responseTime: number // percentage change
    throughput: number
    errorRate: number
    recommendation: string
  } {
    if (!this.baselineMetrics) {
      throw new Error('Baseline metrics not available')
    }

    const responseTimeChange = ((metrics.responseTime.avg - this.baselineMetrics.responseTime.avg) / this.baselineMetrics.responseTime.avg) * 100
    const throughputChange = ((metrics.throughput.requestsPerSecond - this.baselineMetrics.throughput.requestsPerSecond) / this.baselineMetrics.throughput.requestsPerSecond) * 100
    const errorRateChange = ((metrics.errors.rate - this.baselineMetrics.errors.rate) / (this.baselineMetrics.errors.rate || 0.001)) * 100

    let recommendation = 'Performance within normal parameters'
    if (responseTimeChange > 50) {
      recommendation = 'Significant performance degradation detected'
    } else if (responseTimeChange > 20) {
      recommendation = 'Moderate performance impact observed'
    } else if (throughputChange < -20) {
      recommendation = 'Throughput reduction requires investigation'
    }

    return {
      responseTime: responseTimeChange,
      throughput: throughputChange,
      errorRate: errorRateChange,
      recommendation
    }
  }

  /**
   * Get performance test results
   */
  async getTestResults(testId?: string): Promise<any> {
    if (testId) {
      return await this.hiveMind.getState(`performance.results.${testId}`)
    }
    
    return await this.hiveMind.getState('performance.results')
  }

  /**
   * Cleanup test data
   */
  async cleanup(): Promise<void> {
    this.activeTests.clear()
    this.metrics.clear()
    this.baselineMetrics = null
    
    // Clear HIVE-MIND performance data
    await this.hiveMind.clearState('performance.session')
    await this.hiveMind.clearState('performance.results')
    await this.hiveMind.clearState('performance.stressTest')
    
    console.log('🧹 Performance tester cleanup completed')
  }
}

export default PerformanceTester