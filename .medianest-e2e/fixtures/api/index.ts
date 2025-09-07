/**
 * MediaNest API Mocking Framework - Main Export File
 * Comprehensive API testing toolkit with HIVE-MIND coordination
 */

// Core components
export { default as MediaNestMockServer } from './mock-server'
export type { MockServerConfig, MockResponse } from './mock-server'

export { default as MockScenarioManager } from './scenario-manager'
export type { MockScenario } from './scenario-manager'

export { default as ApiEndpointRegistry } from './endpoint-registry'
export type { EndpointDefinition } from './endpoint-registry'

export { default as ResponseGenerator } from './response-generator'
export type { ResponseGenerationContext } from './response-generator'

export { default as EdgeCaseSimulator } from './edge-case-simulator'
export type { EdgeCaseConfig, LoadTestConfig, ChaosTestConfig } from './edge-case-simulator'

export { default as PerformanceTester } from './performance-tester'
export type { PerformanceMetrics, LoadTestScenario, StressTestConfig } from './performance-tester'

export { default as TestDataGenerator } from './test-data-generator'
export type { 
  MediaItem, 
  Season, 
  Episode, 
  User, 
  UserPreferences, 
  MediaRequest, 
  ServiceStatus 
} from './test-data-generator'

export { default as HiveMindCoordinator } from './hive-mind-coordinator'
export type { 
  HiveMindConfig, 
  StateEntry, 
  CoordinationEvent, 
  NodeInfo 
} from './hive-mind-coordinator'

export { default as MockIntegration } from './mock-integration'
export type { MockIntegrationConfig, MockRequestContext } from './mock-integration'

export { default as EnhancedPageBase } from './enhanced-page-base'
export type { ApiTestOptions, ApiAssertionOptions } from './enhanced-page-base'

// Utility functions and constants
export const DEFAULT_SCENARIOS = {
  // Network scenarios
  NETWORK_TIMEOUT: 'network.timeout',
  NETWORK_CONNECTION_DROP: 'network.connection-drop',
  NETWORK_SLOW: 'network.slow-connection',
  NETWORK_INTERMITTENT: 'network.intermittent.failure',

  // Server error scenarios
  SERVER_INTERNAL_ERROR: 'server.internal-error',
  SERVER_SERVICE_UNAVAILABLE: 'server.service-unavailable',
  SERVER_BAD_GATEWAY: 'server.bad-gateway',

  // Rate limiting scenarios
  RATE_LIMIT_EXCEEDED: 'rate-limit.too-many-requests',

  // Authentication scenarios
  AUTH_TOKEN_EXPIRED: 'auth.token-expired',
  AUTH_INVALID_CREDENTIALS: 'auth.invalid-credentials',

  // Data scenarios
  DATA_CORRUPTION: 'data.corruption',
  DATA_EMPTY_RESPONSE: 'data.empty-response',

  // Service-specific scenarios
  PLEX_SERVER_OFFLINE: 'plex.server-offline',
  PLEX_LIBRARY_SCANNING: 'plex.library-scan-in-progress',
  PLEX_AUTH_FAILURE: 'plex.authentication-failure',
  
  OVERSEERR_QUOTA_EXCEEDED: 'overseerr.quota-exceeded',
  OVERSEERR_MAINTENANCE: 'overseerr.service-maintenance',

  // Media scenarios
  MEDIA_SEARCH_TIMEOUT: 'media.search-timeout',
  MEDIA_METADATA_UNAVAILABLE: 'media.metadata-unavailable'
} as const

export const DEFAULT_API_ENDPOINTS = {
  // Authentication
  AUTH_LOGIN: '/api/v1/auth/login',
  AUTH_LOGOUT: '/api/v1/auth/logout',
  AUTH_REFRESH: '/api/v1/auth/refresh',
  AUTH_VERIFY: '/api/v1/auth/verify',
  
  // Plex authentication
  AUTH_PLEX_PIN: '/api/v1/auth/plex/pin',
  AUTH_PLEX_CALLBACK: '/api/v1/auth/plex/callback',

  // Media
  MEDIA_SEARCH: '/api/v1/media/search',
  MEDIA_DETAILS: '/api/v1/media/:type/:id',
  MEDIA_REQUEST: '/api/v1/media/request',
  MEDIA_POPULAR: '/api/v1/media/popular',
  MEDIA_TRENDING: '/api/v1/media/trending',

  // Requests
  REQUESTS_LIST: '/api/v1/requests',
  REQUESTS_MY: '/api/v1/requests/me',
  REQUESTS_BY_ID: '/api/v1/requests/:id',
  REQUESTS_APPROVE: '/api/v1/requests/:id/approve',
  REQUESTS_DENY: '/api/v1/requests/:id/deny',
  REQUESTS_CANCEL: '/api/v1/requests/:id/cancel',

  // Services
  SERVICES_STATUS: '/api/v1/services/status',
  SERVICES_BY_NAME: '/api/v1/services/:name',
  SERVICES_CONFIGURE: '/api/v1/services/:name/configure',
  SERVICES_TEST: '/api/v1/services/:name/test',
  SERVICES_REFRESH: '/api/v1/services/:name/refresh',

  // Dashboard
  DASHBOARD_STATUS: '/api/v1/dashboard/status',
  DASHBOARD_STATS: '/api/v1/dashboard/stats',
  DASHBOARD_ACTIVITY: '/api/v1/dashboard/activity',

  // Downloads
  DOWNLOADS_YOUTUBE: '/api/v1/downloads/youtube',
  DOWNLOADS_STATUS: '/api/v1/downloads/:id',
  DOWNLOADS_CANCEL: '/api/v1/downloads/:id/cancel',
  DOWNLOADS_HISTORY: '/api/v1/downloads/history',

  // Admin
  ADMIN_SETTINGS: '/api/v1/admin/settings',
  ADMIN_LOGS: '/api/v1/admin/logs',
  ADMIN_METRICS: '/api/v1/admin/metrics',
  ADMIN_SYSTEM: '/api/v1/admin/system',
  ADMIN_MAINTENANCE: '/api/v1/admin/maintenance',

  // Health
  HEALTH_CHECK: '/api/v1/health',
  READY_CHECK: '/api/v1/ready'
} as const

// Factory functions for easy setup
export function createMockServer(config?: Partial<MockServerConfig>): MediaNestMockServer {
  const defaultConfig: MockServerConfig = {
    mode: 'testing',
    baseUrl: process.env.API_BASE_URL || 'http://localhost:3001',
    apiVersion: 'v1',
    enableHiveMind: true,
    scenarios: [],
    persistence: false
  }

  return new MediaNestMockServer({ ...defaultConfig, ...config })
}

export function createMockIntegration(config?: Partial<MockIntegrationConfig>): MockIntegration {
  return MockIntegration.create(config)
}

export async function setupApiTesting(
  page: any,
  options: {
    scenarios?: string[]
    performanceTesting?: boolean
    edgeCaseTesting?: boolean
    dataGeneration?: boolean
  } = {}
): Promise<MockIntegration> {
  const mockIntegration = createMockIntegration({
    enableMocking: true,
    scenarios: options.scenarios || [],
    performanceTesting: options.performanceTesting || false,
    dataGeneration: options.dataGeneration || true
  })

  await mockIntegration.initializeForPage(page)

  if (options.edgeCaseTesting) {
    await mockIntegration.startEdgeCaseSimulation()
  }

  return mockIntegration
}

// Performance testing presets
export const PERFORMANCE_TEST_PRESETS = {
  LIGHT_LOAD: {
    duration: 120000,
    maxUsers: 25,
    rampUpTime: 30000,
    requestsPerSecond: 10
  },
  MODERATE_LOAD: {
    duration: 180000,
    maxUsers: 75,
    rampUpTime: 45000,
    requestsPerSecond: 30
  },
  HEAVY_LOAD: {
    duration: 300000,
    maxUsers: 150,
    rampUpTime: 60000,
    requestsPerSecond: 60
  },
  STRESS_TEST: {
    duration: 180000,
    maxUsers: 500,
    rampUpTime: 30000,
    requestsPerSecond: 100
  }
} as const

// Edge case scenario groups
export const SCENARIO_GROUPS = {
  NETWORK_ISSUES: [
    DEFAULT_SCENARIOS.NETWORK_TIMEOUT,
    DEFAULT_SCENARIOS.NETWORK_CONNECTION_DROP,
    DEFAULT_SCENARIOS.NETWORK_SLOW,
    DEFAULT_SCENARIOS.NETWORK_INTERMITTENT
  ],
  SERVER_ERRORS: [
    DEFAULT_SCENARIOS.SERVER_INTERNAL_ERROR,
    DEFAULT_SCENARIOS.SERVER_SERVICE_UNAVAILABLE,
    DEFAULT_SCENARIOS.SERVER_BAD_GATEWAY
  ],
  AUTH_ISSUES: [
    DEFAULT_SCENARIOS.AUTH_TOKEN_EXPIRED,
    DEFAULT_SCENARIOS.AUTH_INVALID_CREDENTIALS,
    DEFAULT_SCENARIOS.RATE_LIMIT_EXCEEDED
  ],
  DATA_ISSUES: [
    DEFAULT_SCENARIOS.DATA_CORRUPTION,
    DEFAULT_SCENARIOS.DATA_EMPTY_RESPONSE
  ],
  PLEX_ISSUES: [
    DEFAULT_SCENARIOS.PLEX_SERVER_OFFLINE,
    DEFAULT_SCENARIOS.PLEX_LIBRARY_SCANNING,
    DEFAULT_SCENARIOS.PLEX_AUTH_FAILURE
  ],
  OVERSEERR_ISSUES: [
    DEFAULT_SCENARIOS.OVERSEERR_QUOTA_EXCEEDED,
    DEFAULT_SCENARIOS.OVERSEERR_MAINTENANCE
  ],
  MEDIA_ISSUES: [
    DEFAULT_SCENARIOS.MEDIA_SEARCH_TIMEOUT,
    DEFAULT_SCENARIOS.MEDIA_METADATA_UNAVAILABLE
  ],
  ALL_SCENARIOS: [
    ...Object.values(DEFAULT_SCENARIOS)
  ]
} as const

// Utility function to get random scenarios
export function getRandomScenarios(group: keyof typeof SCENARIO_GROUPS, count: number = 3): string[] {
  const scenarios = SCENARIO_GROUPS[group]
  const shuffled = [...scenarios].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, Math.min(count, scenarios.length))
}

// Test data generation helpers
export function generateTestUsers(count: number): User[] {
  const generator = new TestDataGenerator()
  return generator.generateUsers(count)
}

export function generateTestMovies(count: number): MediaItem[] {
  const generator = new TestDataGenerator()
  return generator.generateMovies(count)
}

export function generateTestTvShows(count: number): MediaItem[] {
  const generator = new TestDataGenerator()
  return generator.generateTvShows(count)
}

export function generateTestRequests(count: number): MediaRequest[] {
  const generator = new TestDataGenerator()
  return generator.generateMediaRequests(count)
}

export function generateTestServices(count: number): ServiceStatus[] {
  const generator = new TestDataGenerator()
  return generator.generateServiceStatuses(count)
}

// Configuration validation
export function validateMockServerConfig(config: MockServerConfig): boolean {
  if (!config.baseUrl || !config.apiVersion) {
    console.error('Mock server config missing required fields: baseUrl, apiVersion')
    return false
  }

  if (!['development', 'testing', 'production'].includes(config.mode)) {
    console.error('Mock server config has invalid mode. Must be: development, testing, or production')
    return false
  }

  return true
}

// Helper for creating test scenarios
export function createTestScenario(
  id: string,
  name: string,
  options: {
    probability?: number
    statusCode?: number
    delay?: number
    errorType?: 'network' | 'server' | 'client' | 'timeout' | 'rate-limit'
    category?: string
    severity?: 'low' | 'medium' | 'high' | 'critical'
    tags?: string[]
  }
): MockScenario {
  return {
    id,
    name,
    description: `Custom test scenario: ${name}`,
    probability: options.probability || 0.05,
    effects: {
      statusCode: options.statusCode,
      delay: options.delay,
      errorType: options.errorType
    },
    metadata: {
      category: options.category || 'custom',
      severity: options.severity || 'medium',
      tags: options.tags || ['custom']
    }
  }
}

// Version information
export const VERSION = '1.0.0'
export const BUILD_DATE = new Date().toISOString()

// Framework information
export const FRAMEWORK_INFO = {
  name: 'MediaNest API Mocking Framework',
  version: VERSION,
  buildDate: BUILD_DATE,
  description: 'Comprehensive API mocking and edge case testing framework with HIVE-MIND coordination',
  author: 'MediaNest Development Team',
  license: 'MIT',
  features: [
    'Comprehensive API endpoint mocking',
    'Edge case scenario simulation',
    'Performance testing under load',
    'HIVE-MIND distributed coordination',
    'Intelligent failure scenario selection',
    'Real-time test data generation',
    'Service integration mocking',
    'Network failure simulation',
    'Seamless Playwright integration'
  ]
} as const

console.log(`🚀 MediaNest API Mocking Framework v${VERSION} loaded`)
console.log(`🧠 HIVE-MIND coordination enabled`)
console.log(`🎭 ${Object.keys(DEFAULT_SCENARIOS).length} edge case scenarios available`)
console.log(`📡 ${Object.keys(DEFAULT_API_ENDPOINTS).length} API endpoints mapped`)

export default {
  MediaNestMockServer,
  MockIntegration,
  EnhancedPageBase,
  createMockServer,
  createMockIntegration,
  setupApiTesting,
  DEFAULT_SCENARIOS,
  DEFAULT_API_ENDPOINTS,
  SCENARIO_GROUPS,
  PERFORMANCE_TEST_PRESETS,
  FRAMEWORK_INFO
}