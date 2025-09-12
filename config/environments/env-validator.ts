import { z } from 'zod';

/**
 * Environment Variable Validation Schema
 * Validates and transforms environment variables with proper type checking
 */

// Base schema for all environments
const baseSchema = z.object({
  // Environment identification
  NODE_ENV: z.enum(['development', 'test', 'production']),
  APP_NAME: z.string().min(1, 'APP_NAME is required'),
  APP_VERSION: z.string().min(1, 'APP_VERSION is required'),

  // Server configuration
  MEDIANEST_BACKEND_PORT: z.coerce.number().min(1000).max(65535),
  MEDIANEST_BACKEND_HOST: z.string().min(1),
  BACKEND_API_PREFIX: z.string().startsWith('/'),
  MEDIANEST_FRONTEND_PORT: z.coerce.number().min(1000).max(65535),
  MEDIANEST_FRONTEND_HOST: z.string().min(1),
  CORS_ORIGIN: z.string().url().or(z.literal('*')),
  CORS_CREDENTIALS: z.coerce.boolean(),

  // Database configuration
  DATABASE_URL: z.string().url().startsWith('postgresql://'),
  DB_HOST: z.string().min(1).optional(),
  DB_PORT: z.coerce.number().min(1000).max(65535).optional(),
  DB_NAME: z.string().min(1).optional(),
  DB_USER: z.string().min(1).optional(),
  DB_PASSWORD: z.string().min(1).optional(),
  DB_SSL: z.coerce.boolean(),
  DB_POOL_MIN: z.coerce.number().min(1),
  DB_POOL_MAX: z.coerce.number().min(1),
  DB_CONNECTION_TIMEOUT: z.coerce.number().min(1000),
  DB_IDLE_TIMEOUT: z.coerce.number().min(1000),
  DB_MIGRATE_ON_START: z.coerce.boolean(),
  DB_SEED_ON_START: z.coerce.boolean(),

  // Redis configuration
  REDIS_URL: z.string().url().startsWith('redis://'),
  REDIS_HOST: z.string().min(1).optional(),
  REDIS_PORT: z.coerce.number().min(1000).max(65535).optional(),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_DB: z.coerce.number().min(0).max(15),
  REDIS_PREFIX: z.string().min(1),
  REDIS_TTL: z.coerce.number().min(60),
  REDIS_MAX_RETRIES: z.coerce.number().min(1),

  // Authentication & Security
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRE_IN: z.string().regex(/^\d+[smhd]$/, 'Invalid JWT expiration format'),
  JWT_REFRESH_EXPIRE_IN: z.string().regex(/^\d+[smhd]$/, 'Invalid JWT refresh expiration format'),
  JWT_ISSUER: z.string().min(1),
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters'),
  SESSION_MAX_AGE: z.coerce.number().min(60000),
  SESSION_SECURE: z.coerce.boolean(),
  SESSION_HTTP_ONLY: z.coerce.boolean(),
  SESSION_SAME_SITE: z.enum(['strict', 'lax', 'none']),
  SECURITY_HELMET_ENABLED: z.coerce.boolean(),
  SECURITY_RATE_LIMIT_ENABLED: z.coerce.boolean(),
  SECURITY_RATE_LIMIT_WINDOW: z.coerce.number().min(1),
  SECURITY_RATE_LIMIT_MAX_REQUESTS: z.coerce.number().min(1),
  BCRYPT_ROUNDS: z.coerce.number().min(4).max(15),

  // External services
  EMAIL_PROVIDER: z.enum(['sendgrid', 'ses', 'smtp', 'mock']),
  EMAIL_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().email(),
  EMAIL_FROM_NAME: z.string().min(1),
  STORAGE_PROVIDER: z.enum(['local', 's3', 'gcs', 'azure', 'memory']),
  STORAGE_LOCAL_PATH: z.string().optional(),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_REGION: z.string().optional(),
  AWS_S3_BUCKET: z.string().optional(),
  EXTERNAL_API_TIMEOUT: z.coerce.number().min(1000),
  EXTERNAL_API_RETRY_ATTEMPTS: z.coerce.number().min(1),

  // Logging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']),
  LOG_FORMAT: z.enum(['combined', 'common', 'dev', 'short', 'tiny', 'json', 'simple']),
  LOG_FILE_ENABLED: z.coerce.boolean(),
  LOG_FILE_PATH: z.string().optional(),
  LOG_FILE_MAX_SIZE: z.string().optional(),
  LOG_FILE_MAX_FILES: z.coerce.number().min(1).optional(),

  // Development tools
  DEBUG_ENABLED: z.coerce.boolean(),
  DEBUG_NAMESPACE: z.string().optional(),
  PROFILING_ENABLED: z.coerce.boolean(),
  WATCH_MODE: z.coerce.boolean(),
  AUTO_RESTART: z.coerce.boolean(),

  // Monitoring & Health
  HEALTH_CHECK_ENABLED: z.coerce.boolean(),
  HEALTH_CHECK_PATH: z.string().startsWith('/'),
  HEALTH_CHECK_TIMEOUT: z.coerce.number().min(1000),
  METRICS_ENABLED: z.coerce.boolean(),
  METRICS_PORT: z.coerce.number().min(1000).max(65535),
  METRICS_PATH: z.string().startsWith('/'),
  APM_ENABLED: z.coerce.boolean(),
  APM_SERVICE_NAME: z.string().min(1),
  APM_ENVIRONMENT: z.string().min(1),

  // Docker
  DOCKER_NETWORK: z.string().min(1),
  DOCKER_COMPOSE_PROJECT_NAME: z.string().min(1),
  CONTAINER_HEALTH_CHECK_INTERVAL: z.string().regex(/^\d+[sm]$/),
  CONTAINER_HEALTH_CHECK_TIMEOUT: z.string().regex(/^\d+[sm]$/),
  CONTAINER_HEALTH_CHECK_RETRIES: z.coerce.number().min(1),
});

// Development environment schema
const developmentSchema = baseSchema.extend({
  NODE_ENV: z.literal('development'),
  // More relaxed validation for development
  JWT_SECRET: z.string().min(10), // Shorter secrets OK in dev
  SESSION_SECRET: z.string().min(10),
  SESSION_SECURE: z.literal(false), // HTTP OK in dev
  SECURITY_HELMET_ENABLED: z.coerce.boolean(), // Optional in dev
  SECURITY_RATE_LIMIT_ENABLED: z.coerce.boolean(), // Optional in dev
});

// Test environment schema
const testSchema = baseSchema.extend({
  NODE_ENV: z.literal('test'),
  // Test-specific validation
  TEST_DATABASE_URL: z.string().url().startsWith('postgresql://').optional(),
  TEST_REDIS_URL: z.string().url().startsWith('redis://').optional(),
  TEST_TIMEOUT: z.coerce.number().min(1000),
  TEST_SETUP_TIMEOUT: z.coerce.number().min(1000),
  TEST_TEARDOWN_TIMEOUT: z.coerce.number().min(1000),
  TEST_RUNNER: z.enum(['jest', 'vitest', 'mocha']).optional(),
  TEST_COVERAGE_THRESHOLD: z.coerce.number().min(0).max(100).optional(),
  TEST_PARALLEL: z.coerce.boolean().optional(),
  TEST_MAX_WORKERS: z.coerce.number().min(1).optional(),
  TEST_DB_CLEANUP_STRATEGY: z.enum(['truncate', 'drop', 'migrate']).optional(),
  TEST_DB_ISOLATION: z.coerce.boolean().optional(),
  TEST_MOCK_EXTERNAL_APIS: z.coerce.boolean().optional(),
  TEST_MOCK_FILE_SYSTEM: z.coerce.boolean().optional(),
  TEST_MOCK_TIME: z.coerce.boolean().optional(),
});

// Production environment schema
const productionSchema = baseSchema.extend({
  NODE_ENV: z.literal('production'),
  // Strict validation for production
  JWT_SECRET: z.string().min(64, 'Production JWT_SECRET must be at least 64 characters'),
  SESSION_SECRET: z.string().min(64, 'Production SESSION_SECRET must be at least 64 characters'),
  SESSION_SECURE: z.literal(true), // HTTPS required in production
  SESSION_SAME_SITE: z.literal('strict'), // Strict same-site policy
  SECURITY_HELMET_ENABLED: z.literal(true), // Security headers required
  SECURITY_RATE_LIMIT_ENABLED: z.literal(true), // Rate limiting required
  DB_SSL: z.literal(true), // SSL required for production DB
  LOG_LEVEL: z.enum(['error', 'warn', 'info']), // No debug logs in production
  DEBUG_ENABLED: z.literal(false), // No debugging in production
  PROFILING_ENABLED: z.literal(false), // No profiling in production
  // Production-specific fields
  PM2_ENABLED: z.coerce.boolean().optional(),
  PM2_INSTANCES: z.string().optional(),
  PM2_MAX_MEMORY_RESTART: z.string().optional(),
  SSL_ENABLED: z.coerce.boolean().optional(),
  SSL_REDIRECT: z.coerce.boolean().optional(),
  CACHE_ENABLED: z.coerce.boolean().optional(),
  CACHE_TTL: z.coerce.number().min(60).optional(),
  COMPRESSION_ENABLED: z.coerce.boolean().optional(),
  COMPRESSION_LEVEL: z.coerce.number().min(1).max(9).optional(),
  STATIC_CACHE_MAX_AGE: z.coerce.number().min(0).optional(),
  STATIC_ETAG_ENABLED: z.coerce.boolean().optional(),
  REQUEST_SIZE_LIMIT: z.string().optional(),
  REQUEST_PARAMETER_LIMIT: z.coerce.number().min(100).optional(),
  GRACEFUL_SHUTDOWN_TIMEOUT: z.coerce.number().min(5000).optional(),
});

// Type exports
export type BaseConfig = z.infer<typeof baseSchema>;
export type DevelopmentConfig = z.infer<typeof developmentSchema>;
export type TestConfig = z.infer<typeof testSchema>;
export type ProductionConfig = z.infer<typeof productionSchema>;
export type EnvironmentConfig = DevelopmentConfig | TestConfig | ProductionConfig;

/**
 * Validates environment variables based on the current NODE_ENV
 */
export function validateEnvironment(env: Record<string, string | undefined>): EnvironmentConfig {
  const nodeEnv = env.NODE_ENV;

  let schema: z.ZodSchema;
  switch (nodeEnv) {
    case 'development':
      schema = developmentSchema;
      break;
    case 'test':
      schema = testSchema;
      break;
    case 'production':
      schema = productionSchema;
      break;
    default:
      throw new Error(
        `Invalid NODE_ENV: ${nodeEnv}. Must be one of: development, test, production`,
      );
  }

  try {
    return schema.parse(env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const formattedErrors = error.errors
        .map((err) => {
          const path = err.path.join('.');
          return `${path}: ${err.message}`;
        })
        .join('\n');

      throw new Error(`Environment validation failed:\n${formattedErrors}`);
    }
    throw error;
  }
}

/**
 * Validates required production secrets
 */
export function validateProductionSecrets(env: Record<string, string | undefined>): void {
  if (env.NODE_ENV !== 'production') {
    return; // Only validate in production
  }

  const requiredSecrets = ['DATABASE_URL', 'REDIS_URL', 'JWT_SECRET', 'SESSION_SECRET'];

  // Check for email API key if not using mock provider
  if (env.EMAIL_PROVIDER && env.EMAIL_PROVIDER !== 'mock') {
    requiredSecrets.push('EMAIL_API_KEY');
  }

  // Check for AWS credentials if using S3 storage
  if (env.STORAGE_PROVIDER === 's3') {
    requiredSecrets.push('AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_S3_BUCKET');
  }

  const missingSecrets = requiredSecrets.filter((secret) => !env[secret]);

  if (missingSecrets.length > 0) {
    throw new Error(
      `Missing required production secrets: ${missingSecrets.join(', ')}\n` +
        'These must be provided via environment variables or secure secret management system.',
    );
  }
}

/**
 * Gets the appropriate environment file path based on NODE_ENV
 */
export function getEnvironmentFilePath(nodeEnv?: string): string {
  const env = nodeEnv || process.env.NODE_ENV || 'development';
  return `./config/environments/.env.${env}`;
}

/**
 * Environment configuration loader with validation
 */
export class EnvironmentLoader {
  private static instance: EnvironmentLoader;
  private config: EnvironmentConfig | null = null;

  private constructor() {}

  static getInstance(): EnvironmentLoader {
    if (!EnvironmentLoader.instance) {
      EnvironmentLoader.instance = new EnvironmentLoader();
    }
    return EnvironmentLoader.instance;
  }

  /**
   * Load and validate environment configuration
   */
  load(env: Record<string, string | undefined> = process.env): EnvironmentConfig {
    if (this.config) {
      return this.config;
    }

    try {
      // Validate basic environment structure
      this.config = validateEnvironment(env);

      // Additional production secret validation
      validateProductionSecrets(env);

      console.log(`✅ Environment validated successfully (${this.config.NODE_ENV})`);
      return this.config;
    } catch (error) {
      console.error('❌ Environment validation failed:', error);
      throw error;
    }
  }

  /**
   * Get current configuration (throws if not loaded)
   */
  getConfig(): EnvironmentConfig {
    if (!this.config) {
      throw new Error('Environment not loaded. Call load() first.');
    }
    return this.config;
  }

  /**
   * Check if environment is development
   */
  isDevelopment(): boolean {
    return this.getConfig().NODE_ENV === 'development';
  }

  /**
   * Check if environment is test
   */
  isTest(): boolean {
    return this.getConfig().NODE_ENV === 'test';
  }

  /**
   * Check if environment is production
   */
  isProduction(): boolean {
    return this.getConfig().NODE_ENV === 'production';
  }

  /**
   * Reset configuration (useful for testing)
   */
  reset(): void {
    this.config = null;
  }
}

// Default export for easy importing
export default EnvironmentLoader;
