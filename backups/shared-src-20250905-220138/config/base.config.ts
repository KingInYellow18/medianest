import { z } from 'zod';

/**
 * Base Configuration Schema
 * Defines common configuration structure used across all workspaces
 */
export const BaseConfigSchema = z.object({
  // Application Environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  APP_NAME: z.string().default('MediaNest'),
  APP_VERSION: z.string().default('1.0.0'),
  
  // Logging Configuration
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug', 'verbose']).default('info'),
  LOG_FORMAT: z.enum(['json', 'simple']).default('json'),
  LOG_MAX_FILES: z.coerce.number().default(7),
  LOG_MAX_SIZE: z.string().default('20m'),
  
  // Security
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('24h'),
  BCRYPT_ROUNDS: z.coerce.number().default(12),
  
  // CORS Configuration
  CORS_ORIGIN: z.union([z.string(), z.array(z.string())]).default('http://localhost:3000'),
  CORS_CREDENTIALS: z.coerce.boolean().default(true),
  
  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(15 * 60 * 1000), // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(100),
  RATE_LIMIT_SKIP_SUCCESSFUL: z.coerce.boolean().default(true),
});

/**
 * Database Configuration Schema
 */
export const DatabaseConfigSchema = z.object({
  DATABASE_URL: z.string().url(),
  DB_HOST: z.string().optional(),
  DB_PORT: z.coerce.number().optional(),
  DB_NAME: z.string().optional(),
  DB_USER: z.string().optional(),
  DB_PASSWORD: z.string().optional(),
  DB_SSL: z.coerce.boolean().default(false),
  DB_POOL_MIN: z.coerce.number().default(2),
  DB_POOL_MAX: z.coerce.number().default(10),
  DB_TIMEOUT: z.coerce.number().default(30000),
});

/**
 * Redis Configuration Schema
 */
export const RedisConfigSchema = z.object({
  REDIS_URL: z.string().optional(),
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_DB: z.coerce.number().default(0),
  REDIS_MAX_RETRIES: z.coerce.number().default(3),
  REDIS_RETRY_DELAY_MS: z.coerce.number().default(2000),
  REDIS_KEY_PREFIX: z.string().default('medianest:'),
  
  // Session Configuration
  SESSION_SECRET: z.string().min(32),
  SESSION_MAX_AGE: z.coerce.number().default(24 * 60 * 60 * 1000), // 24 hours
  SESSION_SECURE: z.coerce.boolean().default(false),
  SESSION_SAME_SITE: z.enum(['strict', 'lax', 'none']).default('lax'),
});

/**
 * Server Configuration Schema
 */
export const ServerConfigSchema = z.object({
  PORT: z.coerce.number().default(3001),
  HOST: z.string().default('0.0.0.0'),
  TRUST_PROXY: z.coerce.boolean().default(true),
  
  // Health Check Configuration
  HEALTH_CHECK_TIMEOUT: z.coerce.number().default(10000),
  HEALTH_CHECK_INTERVAL: z.coerce.number().default(30000),
  
  // Request Configuration
  REQUEST_TIMEOUT: z.coerce.number().default(30000),
  BODY_LIMIT: z.string().default('10mb'),
  JSON_LIMIT: z.string().default('1mb'),
  
  // WebSocket Configuration
  WS_PORT: z.coerce.number().optional(),
  WS_CORS_ORIGIN: z.union([z.string(), z.array(z.string())]).optional(),
  WS_HEARTBEAT_INTERVAL: z.coerce.number().default(30000),
});

/**
 * External Service Configuration Schema
 */
export const ExternalServicesConfigSchema = z.object({
  // Plex Configuration
  PLEX_SERVER_URL: z.string().url().optional(),
  PLEX_TOKEN: z.string().optional(),
  PLEX_CLIENT_ID: z.string().optional(),
  PLEX_PRODUCT: z.string().default('MediaNest'),
  PLEX_VERSION: z.string().default('1.0.0'),
  PLEX_PLATFORM: z.string().default('Web'),
  PLEX_DEVICE: z.string().default('MediaNest Server'),
  
  // Overseerr Configuration
  OVERSEERR_URL: z.string().url().optional(),
  OVERSEERR_API_KEY: z.string().optional(),
  
  // Uptime Kuma Configuration
  UPTIME_KUMA_URL: z.string().url().optional(),
  UPTIME_KUMA_TOKEN: z.string().optional(),
  
  // Notification Configuration
  WEBHOOK_URL: z.string().url().optional(),
  EMAIL_SMTP_HOST: z.string().optional(),
  EMAIL_SMTP_PORT: z.coerce.number().optional(),
  EMAIL_USERNAME: z.string().optional(),
  EMAIL_PASSWORD: z.string().optional(),
});

/**
 * Complete Configuration Schema
 * Combines all configuration schemas
 */
export const CompleteConfigSchema = BaseConfigSchema
  .merge(DatabaseConfigSchema)
  .merge(RedisConfigSchema)
  .merge(ServerConfigSchema)
  .merge(ExternalServicesConfigSchema);

// Type inference from schema
export type BaseConfig = z.infer<typeof BaseConfigSchema>;
export type DatabaseConfig = z.infer<typeof DatabaseConfigSchema>;
export type RedisConfig = z.infer<typeof RedisConfigSchema>;
export type ServerConfig = z.infer<typeof ServerConfigSchema>;
export type ExternalServicesConfig = z.infer<typeof ExternalServicesConfigSchema>;
export type CompleteConfig = z.infer<typeof CompleteConfigSchema>;

/**
 * Configuration validation utility
 */
export class ConfigValidationError extends Error {
  constructor(public errors: z.ZodError) {
    super(`Configuration validation failed: ${errors.message}`);
    this.name = 'ConfigValidationError';
  }
}

/**
 * Validates configuration against schema
 */
export function validateConfig<T>(
  schema: z.ZodSchema<T>,
  config: unknown,
  context: string = 'configuration'
): T {
  try {
    return schema.parse(config);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ConfigValidationError(error);
    }
    throw new Error(`Failed to validate ${context}: ${error}`);
  }
}

/**
 * Creates a configuration loader function
 */
export function createConfigLoader<T>(
  schema: z.ZodSchema<T>,
  context: string = 'configuration'
) {
  return (config: unknown): T => validateConfig(schema, config, context);
}