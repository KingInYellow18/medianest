import {
  BackendConfigSchema,
  environmentLoader,
  configUtils,
  type BackendConfig,
} from '@medianest/shared/config';

import { createConfiguration } from '@medianest/shared/config/utils';

/**
 * Load and validate backend configuration
 */
const loadBackendConfig = (): BackendConfig => {
  const environment = environmentLoader.getEnvironment();

  return createConfiguration((env) => BackendConfigSchema.parse(env), {
    useDockerSecrets: environment === 'production',
    envFilePath: environment === 'test' ? '.env.test' : undefined,
  });
};

/**
 * Validated backend configuration instance
 */
export const config = loadBackendConfig();

/**
 * Configuration logging utility
 */
export const logConfiguration = () => {
  // Import logger dynamically to avoid circular dependency
  const { logger } = require('../utils/logger');

  logger.info('Backend configuration loaded', {
    environment: config.NODE_ENV,
    port: config.PORT,
    databaseUrl: configUtils.maskSensitiveValue('DATABASE_URL', config.DATABASE_URL),
    redisHost: config.REDIS_HOST,
    redisPort: config.REDIS_PORT,
    jwtIssuer: config.JWT_ISSUER,
    plexClientId: config.PLEX_CLIENT_ID,
    youtubeDownloadPath: config.YOUTUBE_DOWNLOAD_PATH,
    logLevel: config.LOG_LEVEL,
    useDockerSecrets: config.USE_DOCKER_SECRETS,
  });
};

/**
 * Validate required configuration at startup
 */
export const validateRequiredConfig = () => {
  const required = [
    'DATABASE_URL',
    'JWT_SECRET',
    'NEXTAUTH_SECRET',
    'ENCRYPTION_KEY',
    'PLEX_CLIENT_ID',
    'PLEX_CLIENT_SECRET',
  ];

  const missing = required.filter((key) => !config[key as keyof BackendConfig]);

  if (missing.length > 0) {
    throw new Error(`Missing required configuration: ${missing.join(', ')}`);
  }
};

/**
 * Get database configuration for Prisma
 */
export const getDatabaseConfig = () => ({
  url: config.DATABASE_URL,
  pool: {
    size: config.DATABASE_POOL_SIZE,
    timeout: config.DATABASE_TIMEOUT,
  },
});

/**
 * Get Redis configuration
 */
export const getRedisConfig = () => {
  if (config.REDIS_URL) {
    return { url: config.REDIS_URL };
  }

  return {
    host: config.REDIS_HOST,
    port: config.REDIS_PORT,
    password: config.REDIS_PASSWORD,
    username: config.REDIS_USERNAME,
    db: config.REDIS_DATABASE,
    tls: config.REDIS_TLS ? {} : undefined,
  };
};

/**
 * Get JWT configuration
 */
export const getJWTConfig = () => ({
  secret: config.JWT_SECRET,
  issuer: config.JWT_ISSUER,
  audience: config.JWT_AUDIENCE,
  expiresIn: config.JWT_EXPIRES_IN,
});

/**
 * Get Plex OAuth configuration
 */
export const getPlexConfig = () => ({
  clientId: config.PLEX_CLIENT_ID,
  clientSecret: config.PLEX_CLIENT_SECRET,
  clientIdentifier: config.PLEX_CLIENT_IDENTIFIER || config.PLEX_CLIENT_ID,
  serverUrl: config.PLEX_SERVER_URL,
});

/**
 * Get rate limiting configuration
 */
export const getRateLimitConfig = () => ({
  api: {
    requests: config.RATE_LIMIT_API_REQUESTS,
    window: config.RATE_LIMIT_API_WINDOW,
  },
  youtube: {
    requests: config.RATE_LIMIT_YOUTUBE_REQUESTS,
    window: config.RATE_LIMIT_YOUTUBE_WINDOW,
  },
  media: {
    requests: config.RATE_LIMIT_MEDIA_REQUESTS,
    window: config.RATE_LIMIT_MEDIA_WINDOW,
  },
});

/**
 * Get YouTube configuration
 */
export const getYouTubeConfig = () => ({
  downloadPath: config.YOUTUBE_DOWNLOAD_PATH,
  maxConcurrentDownloads: config.YOUTUBE_MAX_CONCURRENT_DOWNLOADS,
  rateLimit: config.YOUTUBE_RATE_LIMIT,
});

/**
 * Get admin bootstrap configuration
 */
export const getAdminConfig = () => ({
  username: config.ADMIN_USERNAME,
  password: config.ADMIN_PASSWORD,
});

/**
 * Get service endpoints configuration
 */
export const getServiceEndpointsConfig = () => ({
  overseerr: {
    url: config.OVERSEERR_URL,
    apiKey: config.OVERSEERR_API_KEY,
  },
  uptimeKuma: {
    url: config.UPTIME_KUMA_URL,
    token: config.UPTIME_KUMA_TOKEN,
  },
  plex: {
    url: config.PLEX_URL,
  },
});

/**
 * Get monitoring configuration
 */
export const getMonitoringConfig = () => ({
  metricsToken: config.METRICS_TOKEN,
  metricsEndpoint: config.METRICS_ENDPOINT,
  errorReportingEndpoint: config.ERROR_REPORTING_ENDPOINT,
  healthCheckInterval: config.HEALTH_CHECK_INTERVAL,
});

/**
 * Check if we're in development environment
 */
export const isDevelopment = () => config.NODE_ENV === 'development';

/**
 * Check if we're in test environment
 */
export const isTest = () => config.NODE_ENV === 'test';

/**
 * Check if we're in production environment
 */
export const isProduction = () => config.NODE_ENV === 'production';

// Export the configuration type for other modules
export type { BackendConfig };
