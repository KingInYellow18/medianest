import { z } from 'zod';

/**
 * Environment types supported by the application
 */
export const EnvironmentSchema = z.enum(['development', 'test', 'production']);
export type Environment = z.infer<typeof EnvironmentSchema>;

/**
 * Log level schema
 */
export const LogLevelSchema = z.enum(['error', 'warn', 'info', 'debug']);
export type LogLevel = z.infer<typeof LogLevelSchema>;

/**
 * Base configuration schema shared across all packages
 */
export const BaseConfigSchema = z.object({
  NODE_ENV: EnvironmentSchema.default('development'),
  LOG_LEVEL: LogLevelSchema.default('info'),
});

/**
 * Database configuration schema
 */
export const DatabaseConfigSchema = z.object({
  DATABASE_URL: z.string().url('Invalid database URL').min(1, 'Database URL is required'),
  DATABASE_POOL_SIZE: z.coerce.number().int().min(1).max(100).default(20),
  DATABASE_TIMEOUT: z.coerce.number().int().min(1000).default(30000), // 30 seconds
});

/**
 * Redis configuration schema
 */
export const RedisConfigSchema = z.object({
  REDIS_URL: z.string().url('Invalid Redis URL').optional(),
  REDIS_HOST: z.string().min(1).default('localhost'),
  REDIS_PORT: z.coerce.number().int().min(1).max(65535).default(6379),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_USERNAME: z.string().optional(),
  REDIS_DATABASE: z.coerce.number().int().min(0).max(15).default(0),
  REDIS_TLS: z.coerce.boolean().default(false),
});

/**
 * JWT configuration schema
 */
export const JWTConfigSchema = z.object({
  JWT_SECRET: z.string().min(32, 'JWT secret must be at least 32 characters'),
  JWT_ISSUER: z.string().min(1).default('medianest'),
  JWT_AUDIENCE: z.string().min(1).default('medianest-api'),
  JWT_EXPIRES_IN: z
    .string()
    .regex(/^\d+[smhd]$/, 'Invalid JWT expiration format')
    .default('7d'),
});

/**
 * NextAuth.js configuration schema
 */
export const NextAuthConfigSchema = z.object({
  NEXTAUTH_URL: z.string().url('Invalid NextAuth URL'),
  NEXTAUTH_SECRET: z.string().min(32, 'NextAuth secret must be at least 32 characters'),
});

/**
 * Plex OAuth configuration schema
 */
export const PlexConfigSchema = z.object({
  PLEX_CLIENT_ID: z.string().min(1, 'Plex client ID is required'),
  PLEX_CLIENT_SECRET: z.string().min(1, 'Plex client secret is required'),
  PLEX_CLIENT_IDENTIFIER: z.string().optional(),
  PLEX_SERVER_URL: z.string().url('Invalid Plex server URL').optional(),
  PLEX_TOKEN: z.string().optional(),
  PLEX_REDIRECT_URI: z.string().optional(),
  PLEX_YOUTUBE_LIBRARY_PATH: z.string().min(1).default('/data/youtube'),
});

/**
 * Encryption configuration schema
 */
export const EncryptionConfigSchema = z.object({
  ENCRYPTION_KEY: z.string().min(32, 'Encryption key must be at least 32 characters'),
});

/**
 * Rate limiting configuration schema
 */
export const RateLimitConfigSchema = z.object({
  RATE_LIMIT_API_REQUESTS: z.coerce.number().int().min(1).default(100),
  RATE_LIMIT_API_WINDOW: z.coerce.number().int().min(1).default(60), // seconds
  RATE_LIMIT_YOUTUBE_REQUESTS: z.coerce.number().int().min(1).default(5),
  RATE_LIMIT_YOUTUBE_WINDOW: z.coerce.number().int().min(1).default(3600), // 1 hour
  RATE_LIMIT_MEDIA_REQUESTS: z.coerce.number().int().min(1).default(20),
  RATE_LIMIT_MEDIA_WINDOW: z.coerce.number().int().min(1).default(3600), // 1 hour
});

/**
 * YouTube downloader configuration schema
 */
export const YouTubeConfigSchema = z.object({
  YOUTUBE_DOWNLOAD_PATH: z.string().min(1).default('/app/youtube'),
  YOUTUBE_MAX_CONCURRENT_DOWNLOADS: z.coerce.number().int().min(1).max(10).default(3),
  YOUTUBE_RATE_LIMIT: z.coerce.number().int().min(1).default(5),
});

/**
 * Admin bootstrap configuration schema
 */
export const AdminConfigSchema = z.object({
  ADMIN_USERNAME: z.string().min(1).default('admin'),
  ADMIN_PASSWORD: z.string().min(1).default('admin'),
});

/**
 * Server configuration schema
 */
export const ServerConfigSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  HOST: z.string().default('0.0.0.0'),
  FRONTEND_URL: z.string().url('Invalid frontend URL').default('http://localhost:3000'),
  BACKEND_URL: z.string().url('Invalid backend URL').default('http://localhost:4000'),
  API_PREFIX: z.string().default('/api'),
  API_VERSION: z.string().default('v1'),
});

/**
 * Service endpoints configuration schema
 */
export const ServiceEndpointsSchema = z.object({
  OVERSEERR_URL: z.string().url('Invalid Overseerr URL').optional(),
  OVERSEERR_API_KEY: z.string().optional(),
  UPTIME_KUMA_URL: z.string().url('Invalid Uptime Kuma URL').optional(),
  UPTIME_KUMA_TOKEN: z.string().optional(),
  PLEX_URL: z.string().url('Invalid Plex URL').optional(),
});

/**
 * Metrics and monitoring configuration schema
 */
export const MonitoringConfigSchema = z.object({
  METRICS_TOKEN: z.string().optional(),
  METRICS_ENDPOINT: z.string().url('Invalid metrics endpoint').optional(),
  ERROR_REPORTING_ENDPOINT: z.string().url('Invalid error reporting endpoint').optional(),
  HEALTH_CHECK_INTERVAL: z.coerce.number().int().min(1000).default(30000), // 30 seconds
});

/**
 * Docker secrets configuration schema (for production)
 */
export const DockerSecretsSchema = z.object({
  DOCKER_SECRETS_PATH: z.string().default('/run/secrets'),
  USE_DOCKER_SECRETS: z.coerce.boolean().default(false),
});

/**
 * Structured Plex service configuration schema
 */
export const PlexServiceConfigSchema = z.object({
  enabled: z.boolean().default(true),
  clientId: z.string(),
  clientSecret: z.string(),
  clientIdentifier: z.string().optional(),
  serverUrl: z.string().optional(),
  defaultToken: z.string().optional(),
  product: z.string().default('MediaNest'),
  version: z.string().default('1.0.0'),
  platform: z.string().default('Web'),
  device: z.string().default('MediaNest Server'),
  redirectUri: z.string().optional(),
  baseUrl: z.string().default('https://plex.tv'),
});

/**
 * Structured Overseerr service configuration schema
 */
export const OverseerrServiceConfigSchema = z.object({
  enabled: z.boolean().default(false),
  url: z.string().optional(),
  apiKey: z.string().optional(),
  timeout: z.number().default(5000),
  retries: z.number().default(3),
});

/**
 * Structured service configuration schema
 */
export const ServiceConfigsSchema = z.object({
  plex: PlexServiceConfigSchema.optional(),
  overseerr: OverseerrServiceConfigSchema.optional(),
});

/**
 * Raw backend configuration schema (environment variables only)
 */
export const RawBackendConfigSchema = BaseConfigSchema.merge(DatabaseConfigSchema)
  .merge(RedisConfigSchema)
  .merge(JWTConfigSchema)
  .merge(PlexConfigSchema)
  .merge(EncryptionConfigSchema)
  .merge(RateLimitConfigSchema)
  .merge(YouTubeConfigSchema)
  .merge(AdminConfigSchema)
  .merge(ServerConfigSchema)
  .merge(ServiceEndpointsSchema)
  .merge(MonitoringConfigSchema)
  .merge(DockerSecretsSchema);

/**
 * Complete backend configuration schema with structured services
 */
export const BackendConfigSchema = RawBackendConfigSchema.transform((data) => {
  // Transform flat environment variables into structured service configs
  const transformed = {
    ...data,
    plex: {
      enabled: Boolean(data.PLEX_CLIENT_ID && data.PLEX_CLIENT_SECRET),
      clientId: data.PLEX_CLIENT_ID,
      clientSecret: data.PLEX_CLIENT_SECRET,
      clientIdentifier: data.PLEX_CLIENT_IDENTIFIER || data.PLEX_CLIENT_ID,
      serverUrl: data.PLEX_SERVER_URL,
      defaultToken: data.PLEX_TOKEN,
      product: 'MediaNest',
      version: '1.0.0',
      platform: 'Web',
      device: 'MediaNest Server',
      baseUrl: 'https://plex.tv',
      redirectUri: data.PLEX_REDIRECT_URI,
    },
    overseerr: {
      enabled: Boolean(data.OVERSEERR_URL && data.OVERSEERR_API_KEY),
      url: data.OVERSEERR_URL,
      apiKey: data.OVERSEERR_API_KEY,
      timeout: 5000,
      retries: 3,
    },
  };
  return transformed;
});

export type BackendConfig = z.infer<typeof BackendConfigSchema>;
export type PlexServiceConfig = z.infer<typeof PlexServiceConfigSchema>;
export type OverseerrServiceConfig = z.infer<typeof OverseerrServiceConfigSchema>;
export type ServiceConfigs = z.infer<typeof ServiceConfigsSchema>;

/**
 * Frontend-specific configuration schema
 */
export const FrontendConfigSchema = BaseConfigSchema.merge(NextAuthConfigSchema)
  .merge(
    z.object({
      NEXT_PUBLIC_API_URL: z.string().url('Invalid API URL').default('http://localhost:4000/api'),
      NEXT_PUBLIC_BACKEND_URL: z
        .string()
        .url('Invalid backend URL')
        .default('http://localhost:4000'),
      NEXT_PUBLIC_WS_URL: z.string().url('Invalid WebSocket URL').default('ws://localhost:4000'),
      NEXT_PUBLIC_PLEX_URL: z.string().url('Invalid Plex URL').optional(),
      NEXT_PUBLIC_OVERSEERR_URL: z.string().url('Invalid Overseerr URL').optional(),
      NEXT_PUBLIC_ERROR_REPORTING_ENDPOINT: z
        .string()
        .url('Invalid error reporting endpoint')
        .optional(),
      NEXT_PUBLIC_APP_NAME: z.string().default('MediaNest'),
      NEXT_PUBLIC_APP_VERSION: z.string().default('1.0.0'),
    }),
  )
  .merge(PlexConfigSchema.pick({ PLEX_CLIENT_ID: true, PLEX_CLIENT_SECRET: true }));

export type FrontendConfig = z.infer<typeof FrontendConfigSchema>;

/**
 * Test environment configuration schema
 */
export const TestConfigSchema = RawBackendConfigSchema.merge(
  z.object({
    TEST_DATABASE_URL: z.string().url('Invalid test database URL').optional(),
    TEST_REDIS_URL: z.string().url('Invalid test Redis URL').optional(),
    TEST_PORT: z.coerce.number().int().min(1).max(65535).default(4001),
    TEST_TIMEOUT: z.coerce.number().int().min(1000).default(30000),
  }),
).transform((data) => {
  // Apply the same transformations as BackendConfigSchema for testing
  const transformed = {
    ...data,
    plex: {
      enabled: Boolean(data.PLEX_CLIENT_ID && data.PLEX_CLIENT_SECRET),
      clientId: data.PLEX_CLIENT_ID,
      clientSecret: data.PLEX_CLIENT_SECRET,
      clientIdentifier: data.PLEX_CLIENT_IDENTIFIER || data.PLEX_CLIENT_ID,
      serverUrl: data.PLEX_SERVER_URL,
      defaultToken: data.PLEX_TOKEN,
      product: 'MediaNest',
      version: '1.0.0',
      platform: 'Web',
      device: 'MediaNest Server',
      baseUrl: 'https://plex.tv',
      redirectUri: data.PLEX_REDIRECT_URI,
    },
    overseerr: {
      enabled: Boolean(data.OVERSEERR_URL && data.OVERSEERR_API_KEY),
      url: data.OVERSEERR_URL,
      apiKey: data.OVERSEERR_API_KEY,
      timeout: 5000,
      retries: 3,
    },
  };
  return transformed;
});

export type TestConfig = z.infer<typeof TestConfigSchema>;

/**
 * Validation error formatter
 */
export const formatValidationError = (error: z.ZodError): string => {
  const issues = error.issues.map((issue) => {
    const path = issue.path.join('.');
    return `${path}: ${issue.message}`;
  });

  return `Configuration validation failed:\n${issues.join('\n')}`;
};

/**
 * Utility to merge environment overrides with defaults
 */
export const createConfigValidator = <T extends z.ZodSchema>(schema: T) => {
  return (env: Record<string, unknown>): z.infer<T> => {
    try {
      return schema.parse(env);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(formatValidationError(error));
      }
      throw error;
    }
  };
};
