// ResilienceConfig interface is defined inline below
import { CircuitBreakerOptions } from '../utils/circuit-breaker';

export interface ResilienceConfiguration {
  circuitBreakers: Record<string, CircuitBreakerOptions>;
  retry: {
    maxAttempts: number;
    initialDelay: number;
    maxDelay: number;
    factor: number;
  };
  healthChecks: {
    interval: number;
    timeout: number;
    enabled: boolean;
  };
  errorRecovery: {
    enabled: boolean;
    maxHistorySize: number;
    cascadeDetectionWindow: number;
  };
  gracefulDegradation: {
    enabled: boolean;
    fallbackCacheTimeout: number;
    queueRetryDelay: number;
  };
}

export const defaultResilienceConfig: ResilienceConfiguration = {
  circuitBreakers: {
    // Database circuit breakers
    'database-primary': {
      failureThreshold: 5,
      resetTimeout: 30000, // 30 seconds
      monitoringPeriod: 60000, // 1 minute
      halfOpenMaxCalls: 2,
      expectedErrors: ['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', 'P1001', 'P1002'],
      enableMetrics: true,
    },
    'database-read-replica': {
      failureThreshold: 3,
      resetTimeout: 20000, // 20 seconds
      monitoringPeriod: 60000,
      halfOpenMaxCalls: 3,
      expectedErrors: ['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', 'P1001', 'P1002'],
      enableMetrics: true,
    },

    // Cache circuit breakers
    'redis-cache': {
      failureThreshold: 10, // More tolerant for cache
      resetTimeout: 15000, // 15 seconds
      monitoringPeriod: 60000,
      halfOpenMaxCalls: 5,
      expectedErrors: ['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT'],
      enableMetrics: true,
    },

    // External API circuit breakers
    'plex-api': {
      failureThreshold: 5,
      resetTimeout: 45000, // 45 seconds
      monitoringPeriod: 60000,
      halfOpenMaxCalls: 3,
      expectedErrors: ['ENOTFOUND', 'ECONNREFUSED', 'timeout', '5xx', 'rate_limit'],
      enableMetrics: true,
    },
    'youtube-api': {
      failureThreshold: 8, // YouTube API can be flaky
      resetTimeout: 60000, // 1 minute
      monitoringPeriod: 120000, // 2 minutes
      halfOpenMaxCalls: 2,
      expectedErrors: [
        'ENOTFOUND',
        'ECONNREFUSED',
        'timeout',
        '5xx',
        'rate_limit',
        'quota_exceeded',
      ],
      enableMetrics: true,
    },
    'overseerr-api': {
      failureThreshold: 5,
      resetTimeout: 30000,
      monitoringPeriod: 60000,
      halfOpenMaxCalls: 3,
      expectedErrors: ['ENOTFOUND', 'ECONNREFUSED', 'timeout', '5xx'],
      enableMetrics: true,
    },
    'uptime-kuma-api': {
      failureThreshold: 3,
      resetTimeout: 30000,
      monitoringPeriod: 60000,
      halfOpenMaxCalls: 2,
      expectedErrors: ['ENOTFOUND', 'ECONNREFUSED', 'timeout', '5xx'],
      enableMetrics: true,
    },

    // Internal service circuit breakers
    'file-operations': {
      failureThreshold: 7,
      resetTimeout: 20000,
      monitoringPeriod: 60000,
      halfOpenMaxCalls: 3,
      expectedErrors: ['ENOENT', 'EACCES', 'EMFILE', 'ENFILE'],
      enableMetrics: true,
    },
    'email-service': {
      failureThreshold: 5,
      resetTimeout: 60000, // 1 minute
      monitoringPeriod: 120000,
      halfOpenMaxCalls: 2,
      expectedErrors: ['ENOTFOUND', 'ECONNREFUSED', 'timeout', '5xx'],
      enableMetrics: true,
    },
  },

  retry: {
    maxAttempts: 3,
    initialDelay: 1000, // 1 second
    maxDelay: 30000, // 30 seconds
    factor: 2, // Exponential backoff factor
  },

  healthChecks: {
    interval: 30000, // 30 seconds
    timeout: 5000, // 5 seconds
    enabled: true,
  },

  errorRecovery: {
    enabled: true,
    maxHistorySize: 100, // Keep last 100 errors per operation
    cascadeDetectionWindow: 300000, // 5 minutes
  },

  gracefulDegradation: {
    enabled: true,
    fallbackCacheTimeout: 3600000, // 1 hour
    queueRetryDelay: 30000, // 30 seconds
  },
};

// Environment-specific configurations
export const getEnvironmentConfig = (): Partial<ResilienceConfiguration> => {
  const env = process.env.NODE_ENV || 'development';

  switch (env) {
    case 'development':
      return {
        circuitBreakers: {
          // More lenient thresholds for development
          ...Object.keys(defaultResilienceConfig.circuitBreakers).reduce(
            (acc, key) => {
              const defaultCB = defaultResilienceConfig.circuitBreakers[key];
              if (!defaultCB) return acc;
              acc[key] = {
                failureThreshold: defaultCB.failureThreshold + 2,
                resetTimeout: Math.min(defaultCB.resetTimeout, 15000),
                monitoringPeriod: defaultCB.monitoringPeriod,
                expectedErrors: defaultCB.expectedErrors,
                halfOpenMaxCalls: defaultCB.halfOpenMaxCalls,
                enableMetrics: defaultCB.enableMetrics,
              };
              return acc;
            },
            {} as Record<string, CircuitBreakerOptions>,
          ),
        },
        retry: {
          ...defaultResilienceConfig.retry,
          maxAttempts: 2, // Faster feedback in development
        },
      };

    case 'test':
      return {
        circuitBreakers: {
          // Very lenient for testing
          ...Object.keys(defaultResilienceConfig.circuitBreakers).reduce(
            (acc, key) => {
              acc[key] = {
                ...defaultResilienceConfig.circuitBreakers[key],
                failureThreshold: 100, // High threshold to avoid interference in tests
                resetTimeout: 1000, // Quick reset
                monitoringPeriod: 10000, // Short monitoring period
              };
              return acc;
            },
            {} as Record<string, CircuitBreakerOptions>,
          ),
        },
        retry: {
          ...defaultResilienceConfig.retry,
          maxAttempts: 1,
          initialDelay: 100,
          maxDelay: 1000,
        },
        healthChecks: {
          ...defaultResilienceConfig.healthChecks,
          enabled: false, // Disable in tests
        },
      };

    case 'staging':
      return {
        circuitBreakers: {
          // Slightly more aggressive than production for early detection
          ...Object.keys(defaultResilienceConfig.circuitBreakers).reduce(
            (acc, key) => {
              const defaultCB = defaultResilienceConfig.circuitBreakers[key];
              if (!defaultCB) return acc;
              acc[key] = {
                failureThreshold: Math.max(3, defaultCB.failureThreshold - 1),
                resetTimeout: defaultCB.resetTimeout,
                monitoringPeriod: defaultCB.monitoringPeriod,
                expectedErrors: defaultCB.expectedErrors,
                halfOpenMaxCalls: defaultCB.halfOpenMaxCalls,
                enableMetrics: defaultCB.enableMetrics,
              };
              return acc;
            },
            {} as Record<string, CircuitBreakerOptions>,
          ),
        },
      };

    case 'production':
    default:
      return defaultResilienceConfig;
  }
};

// Service-specific dependency configurations
export const serviceDependencies = [
  {
    name: 'database',
    type: 'database' as const,
    criticalityLevel: 'critical' as const,
    healthCheckFn: async () => {
      // This would be implemented to actually check database health
      return {
        service: 'database',
        healthy: true,
        responseTime: 50,
        timestamp: new Date(),
      };
    },
  },
  {
    name: 'redis-cache',
    type: 'cache' as const,
    criticalityLevel: 'important' as const,
    healthCheckFn: async () => {
      // This would be implemented to actually check Redis health
      return {
        service: 'redis-cache',
        healthy: true,
        responseTime: 20,
        timestamp: new Date(),
      };
    },
  },
  {
    name: 'plex-media-server',
    type: 'external-api' as const,
    criticalityLevel: 'important' as const,
    healthCheckUrl: process.env.PLEX_URL ? `${process.env.PLEX_URL}/identity` : undefined,
  },
  {
    name: 'overseerr-service',
    type: 'external-api' as const,
    criticalityLevel: 'optional' as const,
    healthCheckUrl: process.env.OVERSEERR_URL
      ? `${process.env.OVERSEERR_URL}/api/v1/status`
      : undefined,
  },
  {
    name: 'uptime-kuma',
    type: 'external-api' as const,
    criticalityLevel: 'optional' as const,
    healthCheckUrl: process.env.UPTIME_KUMA_URL
      ? `${process.env.UPTIME_KUMA_URL}/api/status-page/heartbeat`
      : undefined,
  },
];

// Bulkhead compartment configurations
export const bulkheadCompartments = {
  'user-operations': {
    maxConcurrent: 50,
    description: 'User authentication and profile operations',
  },
  'media-operations': {
    maxConcurrent: 30,
    description: 'Media browsing and streaming operations',
  },
  'admin-operations': {
    maxConcurrent: 10,
    description: 'Administrative operations',
  },
  'download-operations': {
    maxConcurrent: 5,
    description: 'File download and processing operations',
  },
  'api-integration': {
    maxConcurrent: 20,
    description: 'External API integration calls',
  },
  'background-jobs': {
    maxConcurrent: 15,
    description: 'Background processing tasks',
  },
};

// Alert thresholds
export const alertThresholds = {
  errorRate: {
    warning: 5, // 5%
    critical: 10, // 10%
  },
  responseTime: {
    warning: 2000, // 2 seconds
    critical: 5000, // 5 seconds
  },
  memoryUsage: {
    warning: 75, // 75%
    critical: 90, // 90%
  },
  circuitBreakerOpen: {
    warning: 1,
    critical: 3,
  },
  recentErrors: {
    warning: 10,
    critical: 20,
  },
};

export function getMergedConfig(): ResilienceConfiguration {
  const envConfig = getEnvironmentConfig();

  return {
    ...defaultResilienceConfig,
    ...envConfig,
    circuitBreakers: {
      ...defaultResilienceConfig.circuitBreakers,
      ...envConfig.circuitBreakers,
    },
    retry: {
      ...defaultResilienceConfig.retry,
      ...envConfig.retry,
    },
    healthChecks: {
      ...defaultResilienceConfig.healthChecks,
      ...envConfig.healthChecks,
    },
    errorRecovery: {
      ...defaultResilienceConfig.errorRecovery,
      ...envConfig.errorRecovery,
    },
    gracefulDegradation: {
      ...defaultResilienceConfig.gracefulDegradation,
      ...envConfig.gracefulDegradation,
    },
  };
}
