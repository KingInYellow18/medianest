/**
 * Configuration Service Mock Implementation - Phase 2 Mock Fixes
 * Fixes issues with configService mocking across authentication modules
 */

import { vi } from 'vitest';

// Mock configuration values for different environments
export const createMockConfigs = () => ({
  auth: {
    JWT_SECRET: 'test-jwt-secret-32-characters-long!!',
    JWT_SECRET_ROTATION: 'test-rotation-secret-32-chars-long!',
    JWT_ISSUER: 'medianest-test',
    JWT_AUDIENCE: 'medianest-app-test',
    JWT_EXPIRES_IN: '15m',
    JWT_REFRESH_EXPIRES_IN: '7d',
    BCRYPT_ROUNDS: 10,
    SESSION_SECRET: 'test-session-secret-32-chars-long!',
    COOKIE_MAX_AGE: 24 * 60 * 60 * 1000, // 24 hours
    REMEMBER_ME_EXPIRES: 30 * 24 * 60 * 60 * 1000, // 30 days
    TOKEN_ROTATION_THRESHOLD: 5 * 60 * 1000, // 5 minutes
    MAX_LOGIN_ATTEMPTS: 5,
    LOCKOUT_TIME: 15 * 60 * 1000, // 15 minutes
    PASSWORD_MIN_LENGTH: 8,
    PASSWORD_REQUIRE_UPPERCASE: true,
    PASSWORD_REQUIRE_LOWERCASE: true,
    PASSWORD_REQUIRE_NUMBERS: true,
    PASSWORD_REQUIRE_SYMBOLS: true,
  },
  database: {
    DATABASE_URL: 'postgresql://test:test@localhost:5432/medianest_test',
    DATABASE_POOL_MIN: 2,
    DATABASE_POOL_MAX: 10,
    DATABASE_CONNECTION_TIMEOUT: 30000,
    DATABASE_IDLE_TIMEOUT: 10000,
    DATABASE_LOGGING: false,
    DATABASE_SSL: false,
  },
  redis: {
    REDIS_URL: 'redis://localhost:6379/0',
    REDIS_PASSWORD: '',
    REDIS_DB: 0,
    REDIS_PREFIX: 'medianest:test:',
    REDIS_TTL: 3600,
    REDIS_CONNECT_TIMEOUT: 10000,
    REDIS_LAZYCONNECT: true,
    REDIS_RETRIES: 3,
    REDIS_RETRY_DELAY: 1000,
  },
  server: {
    NODE_ENV: 'test',
    PORT: 3001,
    HOST: 'localhost',
    API_BASE_URL: 'http://localhost:3001/api/v1',
    WEB_BASE_URL: 'http://localhost:3000',
    CORS_ORIGINS: ['http://localhost:3000', 'http://localhost:3001'],
    TRUST_PROXY: false,
    BODY_LIMIT: '10mb',
    RATE_LIMIT_WINDOW: 15 * 60 * 1000, // 15 minutes
    RATE_LIMIT_MAX: 100,
    HELMET_ENABLED: true,
    COMPRESSION_ENABLED: true,
  },
  plex: {
    PLEX_CLIENT_ID: 'medianest-test-client',
    PLEX_CLIENT_NAME: 'MediaNest Test',
    PLEX_CLIENT_VERSION: '1.0.0-test',
    PLEX_PLATFORM: 'Web',
    PLEX_DEVICE: 'Test Device',
    PLEX_PRODUCT: 'MediaNest Test Suite',
    PLEX_API_TIMEOUT: 10000,
    PLEX_PIN_TIMEOUT: 300000, // 5 minutes
    PLEX_AUTH_TIMEOUT: 60000, // 1 minute
    PLEX_RETRY_ATTEMPTS: 3,
    PLEX_RETRY_DELAY: 2000,
  },
  youtube: {
    YOUTUBE_API_KEY: 'test-youtube-api-key',
    YOUTUBE_CLIENT_ID: 'test-youtube-client-id',
    YOUTUBE_CLIENT_SECRET: 'test-youtube-client-secret',
    YOUTUBE_REDIRECT_URI: 'http://localhost:3001/api/v1/youtube/callback',
    YOUTUBE_DOWNLOAD_PATH: '/tmp/test-downloads',
    YOUTUBE_MAX_CONCURRENT: 3,
    YOUTUBE_RETRY_ATTEMPTS: 3,
    YOUTUBE_TIMEOUT: 300000, // 5 minutes
    YOUTUBE_QUALITY: 'best',
    YOUTUBE_FORMAT: 'mp4',
  },
  overseerr: {
    OVERSEERR_URL: 'http://localhost:5055',
    OVERSEERR_API_KEY: 'test-overseerr-api-key',
    OVERSEERR_TIMEOUT: 30000,
    OVERSEERR_RETRY_ATTEMPTS: 3,
    OVERSEERR_RETRY_DELAY: 2000,
    OVERSEERR_SYNC_INTERVAL: 300000, // 5 minutes
    OVERSEERR_ENABLED: true,
  },
  webhook: {
    WEBHOOK_SECRET: 'test-webhook-secret-32-chars-long!',
    WEBHOOK_TIMEOUT: 30000,
    WEBHOOK_RETRY_ATTEMPTS: 3,
    WEBHOOK_RETRY_DELAY: 2000,
    WEBHOOK_MAX_PAYLOAD: 1024 * 1024, // 1MB
    WEBHOOK_SIGNATURE_HEADER: 'X-Hub-Signature-256',
  },
  logging: {
    LOG_LEVEL: 'info',
    LOG_FORMAT: 'json',
    LOG_FILE: '/tmp/test-medianest.log',
    LOG_MAX_SIZE: '10m',
    LOG_MAX_FILES: 5,
    LOG_COMPRESS: true,
    LOG_DATE_PATTERN: 'YYYY-MM-DD',
  },
  security: {
    ENCRYPTION_KEY: 'test-encryption-key-32-characters!',
    ENCRYPTION_ALGORITHM: 'aes-256-gcm',
    HASH_ALGORITHM: 'sha256',
    SECURE_HEADERS: true,
    CONTENT_SECURITY_POLICY: true,
    XSS_PROTECTION: true,
    FRAME_OPTIONS: 'DENY',
    HSTS_MAX_AGE: 31536000, // 1 year
    REFERRER_POLICY: 'strict-origin-when-cross-origin',
  },
});

// Create mock configuration service
export const createMockConfigService = () => {
  const configs = createMockConfigs();

  const configService = {
    // Configuration getters
    getAuthConfig: vi.fn().mockReturnValue(configs.auth),
    getDatabaseConfig: vi.fn().mockReturnValue(configs.database),
    getRedisConfig: vi.fn().mockReturnValue(configs.redis),
    getServerConfig: vi.fn().mockReturnValue(configs.server),
    getPlexConfig: vi.fn().mockReturnValue(configs.plex),
    getYouTubeConfig: vi.fn().mockReturnValue(configs.youtube),
    getOverseerrConfig: vi.fn().mockReturnValue(configs.overseerr),
    getWebhookConfig: vi.fn().mockReturnValue(configs.webhook),
    getLoggingConfig: vi.fn().mockReturnValue(configs.logging),
    getSecurityConfig: vi.fn().mockReturnValue(configs.security),

    // Generic configuration methods
    get: vi.fn().mockImplementation((key: string, defaultValue?: any) => {
      const keys = key.split('.');
      let value: any = configs;

      for (const k of keys) {
        if (value && typeof value === 'object' && k in value) {
          value = value[k];
        } else {
          return defaultValue;
        }
      }

      return value;
    }),

    has: vi.fn().mockImplementation((key: string) => {
      try {
        const value = configService.get(key);
        return value !== undefined;
      } catch {
        return false;
      }
    }),

    set: vi.fn().mockImplementation((key: string, value: any) => {
      const keys = key.split('.');
      let current: any = configs;

      for (let i = 0; i < keys.length - 1; i++) {
        const k = keys[i];
        if (!current[k] || typeof current[k] !== 'object') {
          current[k] = {};
        }
        current = current[k];
      }

      current[keys[keys.length - 1]] = value;
    }),

    // Environment checks
    isProduction: vi.fn().mockReturnValue(false),
    isDevelopment: vi.fn().mockReturnValue(false),
    isTest: vi.fn().mockReturnValue(true),

    // Validation methods
    validate: vi.fn().mockReturnValue({ valid: true, errors: [] }),
    validateAuth: vi.fn().mockReturnValue({ valid: true, errors: [] }),
    validateDatabase: vi.fn().mockReturnValue({ valid: true, errors: [] }),
    validateRedis: vi.fn().mockReturnValue({ valid: true, errors: [] }),

    // Runtime configuration updates
    reload: vi.fn().mockResolvedValue(true),
    watch: vi.fn().mockImplementation((callback: Function) => {
      // Mock file watcher
      return () => {}; // Return unwatch function
    }),

    // Security helpers
    getJWTSecret: vi.fn().mockReturnValue(configs.auth.JWT_SECRET),
    getEncryptionKey: vi.fn().mockReturnValue(configs.security.ENCRYPTION_KEY),
    getWebhookSecret: vi.fn().mockReturnValue(configs.webhook.WEBHOOK_SECRET),

    // Connection string builders
    getDatabaseUrl: vi.fn().mockReturnValue(configs.database.DATABASE_URL),
    getRedisUrl: vi.fn().mockReturnValue(configs.redis.REDIS_URL),

    // Feature flags
    isFeatureEnabled: vi.fn().mockImplementation((feature: string) => {
      const featureFlags = {
        'auth.token_rotation': true,
        'auth.remember_me': true,
        'security.rate_limiting': true,
        'security.csrf_protection': true,
        'plex.auto_sync': true,
        'youtube.downloads': true,
        'overseerr.integration': true,
        'webhooks.enabled': true,
        'logging.audit': true,
      };

      return featureFlags[feature] ?? false;
    }),

    // Performance settings
    getPerformanceConfig: vi.fn().mockReturnValue({
      maxConcurrentRequests: 100,
      requestTimeout: 30000,
      keepAliveTimeout: 5000,
      maxMemoryUsage: '512MB',
      gcThreshold: 0.8,
    }),

    // Monitoring configuration
    getMonitoringConfig: vi.fn().mockReturnValue({
      enabled: true,
      metricsInterval: 30000,
      healthCheckInterval: 10000,
      alertThresholds: {
        cpu: 80,
        memory: 85,
        disk: 90,
        responseTime: 2000,
      },
    }),
  };

  return configService;
};

// Setup configuration service mocks
export const setupConfigServiceMocks = () => {
  const mockConfigService = createMockConfigService();

  vi.mock('../../../src/config/config.service', () => ({
    configService: mockConfigService,
    ConfigService: vi.fn().mockImplementation(() => mockConfigService),
  }));

  return mockConfigService;
};

// Environment-specific configuration overrides
export const createTestEnvironmentConfig = (overrides?: any) => {
  const baseConfigs = createMockConfigs();

  const testOverrides = {
    auth: {
      ...baseConfigs.auth,
      JWT_SECRET: 'test-jwt-secret-override-32-chars!',
      JWT_EXPIRES_IN: '1h', // Longer for testing
    },
    database: {
      ...baseConfigs.database,
      DATABASE_URL: 'postgresql://test:test@localhost:5432/medianest_test_' + Date.now(),
      DATABASE_LOGGING: true, // Enable for test debugging
    },
    redis: {
      ...baseConfigs.redis,
      REDIS_DB: 1, // Use different DB for tests
      REDIS_PREFIX: 'test:' + Date.now() + ':',
    },
    server: {
      ...baseConfigs.server,
      PORT: 0, // Use random port
    },
    ...overrides,
  };

  return testOverrides;
};

// Mock for different configuration scenarios
export const createConfigTestScenarios = () => ({
  validConfig: {
    configService: createMockConfigService(),
    description: 'Valid configuration with all required values',
  },

  missingJWTSecret: {
    configService: (() => {
      const service = createMockConfigService();
      service.getAuthConfig.mockReturnValue({
        ...createMockConfigs().auth,
        JWT_SECRET: '',
      });
      return service;
    })(),
    description: 'Configuration missing JWT secret',
    expectedError: 'JWT_SECRET is required',
  },

  invalidDatabaseUrl: {
    configService: (() => {
      const service = createMockConfigService();
      service.getDatabaseConfig.mockReturnValue({
        ...createMockConfigs().database,
        DATABASE_URL: 'invalid-url',
      });
      return service;
    })(),
    description: 'Configuration with invalid database URL',
    expectedError: 'Invalid database URL',
  },

  productionMode: {
    configService: (() => {
      const service = createMockConfigService();
      service.isProduction.mockReturnValue(true);
      service.isTest.mockReturnValue(false);
      service.getServerConfig.mockReturnValue({
        ...createMockConfigs().server,
        NODE_ENV: 'production',
      });
      return service;
    })(),
    description: 'Production environment configuration',
  },

  developmentMode: {
    configService: (() => {
      const service = createMockConfigService();
      service.isDevelopment.mockReturnValue(true);
      service.isTest.mockReturnValue(false);
      service.getServerConfig.mockReturnValue({
        ...createMockConfigs().server,
        NODE_ENV: 'development',
      });
      return service;
    })(),
    description: 'Development environment configuration',
  },
});

// Reset configuration service mocks
export const resetConfigServiceMocks = (
  mockConfigService: ReturnType<typeof createMockConfigService>
) => {
  Object.values(mockConfigService).forEach((method) => {
    if (method && typeof method.mockReset === 'function') {
      method.mockReset();
    }
  });

  // Restore default mock implementations
  const freshConfigs = createMockConfigs();
  mockConfigService.getAuthConfig.mockReturnValue(freshConfigs.auth);
  mockConfigService.getDatabaseConfig.mockReturnValue(freshConfigs.database);
  mockConfigService.getRedisConfig.mockReturnValue(freshConfigs.redis);
  mockConfigService.getServerConfig.mockReturnValue(freshConfigs.server);
  mockConfigService.getPlexConfig.mockReturnValue(freshConfigs.plex);
  mockConfigService.getYouTubeConfig.mockReturnValue(freshConfigs.youtube);
  mockConfigService.getOverseerrConfig.mockReturnValue(freshConfigs.overseerr);
  mockConfigService.getWebhookConfig.mockReturnValue(freshConfigs.webhook);
  mockConfigService.isTest.mockReturnValue(true);
  mockConfigService.isProduction.mockReturnValue(false);
  mockConfigService.isDevelopment.mockReturnValue(false);
};

// Helper for testing configuration validation
export const createConfigValidationMocks = () => ({
  validAuthConfig: vi.fn().mockReturnValue({ valid: true, errors: [] }),
  invalidAuthConfig: vi.fn().mockReturnValue({
    valid: false,
    errors: ['JWT_SECRET is required', 'JWT_SECRET must be at least 32 characters long'],
  }),
  validDatabaseConfig: vi.fn().mockReturnValue({ valid: true, errors: [] }),
  invalidDatabaseConfig: vi.fn().mockReturnValue({
    valid: false,
    errors: ['DATABASE_URL is required', 'DATABASE_URL format is invalid'],
  }),
});
