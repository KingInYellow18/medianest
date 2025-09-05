// Environment variable types for type-safe process.env access

export interface DatabaseEnvironment {
  DATABASE_URL: string;
  DATABASE_POOL_SIZE?: string;
  DATABASE_TIMEOUT?: string;
}

export interface AuthEnvironment {
  JWT_SECRET: string;
  JWT_EXPIRES_IN?: string;
  SESSION_SECRET?: string;
  COOKIE_DOMAIN?: string;
  COOKIE_SECURE?: string;
}

export interface RedisEnvironment {
  REDIS_URL?: string;
  REDIS_HOST?: string;
  REDIS_PORT?: string;
  REDIS_PASSWORD?: string;
  REDIS_DB?: string;
}

export interface ServerEnvironment {
  PORT?: string;
  HOST?: string;
  NODE_ENV: 'development' | 'production' | 'test';
  API_PREFIX?: string;
  CORS_ORIGIN?: string;
}

export interface LoggingEnvironment {
  LOG_LEVEL?: 'error' | 'warn' | 'info' | 'debug' | 'silly';
  LOG_FORMAT?: 'json' | 'simple' | 'combined';
  LOG_FILE?: string;
  LOG_MAX_SIZE?: string;
  LOG_MAX_FILES?: string;
}

export interface IntegrationEnvironment {
  PLEX_CLIENT_ID?: string;
  PLEX_CLIENT_SECRET?: string;
  OVERSEERR_API_KEY?: string;
  UPTIME_KUMA_TOKEN?: string;
}

export interface RateLimitEnvironment {
  RATE_LIMIT_WINDOW_MS?: string;
  RATE_LIMIT_MAX_REQUESTS?: string;
  RATE_LIMIT_SKIP_SUCCESSFUL?: string;
}

// Complete environment interface
export interface Environment 
  extends DatabaseEnvironment,
          AuthEnvironment,
          RedisEnvironment,
          ServerEnvironment,
          LoggingEnvironment,
          IntegrationEnvironment,
          RateLimitEnvironment {}

// Type-safe environment accessor
export interface TypedProcessEnv extends NodeJS.ProcessEnv {
  NODE_ENV: 'development' | 'production' | 'test';
  DATABASE_URL: string;
  JWT_SECRET: string;
  PORT?: string;
  HOST?: string;
  REDIS_URL?: string;
  LOG_LEVEL?: 'error' | 'warn' | 'info' | 'debug' | 'silly';
}

// Environment validation result
export interface EnvironmentValidationResult {
  isValid: boolean;
  missing: string[];
  invalid: Array<{
    key: string;
    value: string;
    expected: string;
  }>;
}

// Default environment values
export const DEFAULT_ENVIRONMENT: Partial<Environment> = {
  PORT: '5000',
  HOST: '0.0.0.0',
  NODE_ENV: 'development',
  LOG_LEVEL: 'info',
  LOG_FORMAT: 'json',
  API_PREFIX: '/api',
  CORS_ORIGIN: '*',
  RATE_LIMIT_WINDOW_MS: '900000', // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: '100',
  DATABASE_TIMEOUT: '10000',
  JWT_EXPIRES_IN: '7d',
};