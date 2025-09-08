/**
 * Configuration type definitions for MediaNest Backend
 */

export interface ServerConfig {
  NODE_ENV: 'development' | 'test' | 'production';
  PORT: number;
  HOST: string;
  HOSTNAME?: string;
  FRONTEND_URL: string;
  BACKEND_URL?: string;
  APP_VERSION?: string;
  SERVICE_NAME?: string;
  SERVICE_VERSION?: string;
}

export interface DatabaseConfig {
  DATABASE_URL: string;
  DATABASE_POOL_SIZE: number;
  DATABASE_TIMEOUT: number;
  USE_REAL_DATABASE?: boolean;
}

export interface AuthConfig {
  JWT_SECRET: string;
  JWT_ISSUER: string;
  JWT_AUDIENCE: string;
  JWT_EXPIRES_IN: string;
  JWT_SECRET_ROTATION?: string;
  ENCRYPTION_KEY: string;

  // Session
  SESSION_COOKIE_MAX_AGE: number;
  SESSION_ROLLING: boolean;

  // Auth cookies
  AUTH_COOKIE_NAME: string;
  AUTH_COOKIE_DOMAIN?: string;

  // Security
  BCRYPT_ROUNDS: number;
  PASSWORD_MIN_LENGTH: number;
  MAX_LOGIN_ATTEMPTS: number;
  LOCKOUT_TIME: number;

  // Feature flags
  ENABLE_REGISTRATION: boolean;
  ENABLE_EMAIL_VERIFICATION: boolean;
  ENABLE_TWO_FACTOR_AUTH: boolean;
  ENABLE_PASSWORD_RESET: boolean;

  // API Key
  API_KEY_HASH?: string;
  METRICS_TOKEN?: string;
}

export interface RedisConfig {
  REDIS_URL?: string;
  REDIS_HOST: string;
  REDIS_PORT: number;
  REDIS_PASSWORD?: string;
  SKIP_REDIS?: boolean;
  DISABLE_REDIS?: boolean;
}

export interface PlexConfig {
  PLEX_URL?: string;
  PLEX_SERVER_URL?: string;
  PLEX_CLIENT_ID: string;
  PLEX_CLIENT_SECRET: string;
  PLEX_CLIENT_IDENTIFIER?: string;
  PLEX_DEFAULT_TOKEN?: string;
  PLEX_DEVICE_NAME?: string;
  PLEX_ENABLED?: boolean;
  PLEX_PLATFORM?: string;
  PLEX_PRODUCT?: string;
  PLEX_VERSION?: string;
}

export interface EmailConfig {
  SMTP_HOST?: string;
  SMTP_PORT: number;
  SMTP_SECURE: boolean;
  SMTP_USER?: string;
  EMAIL_FROM: string;
  EMAIL_FROM_NAME: string;
}

export interface OAuthConfig {
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  GITHUB_REDIRECT_URI?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GOOGLE_REDIRECT_URI?: string;
}

export interface IntegrationConfig {
  OVERSEERR_URL?: string;
  OVERSEERR_API_KEY?: string;
  OVERSEERR_ENABLED?: boolean;

  UPTIME_KUMA_URL?: string;
  UPTIME_KUMA_USERNAME?: string;
  UPTIME_KUMA_PASSWORD?: string;
  UPTIME_KUMA_ENABLED?: boolean;

  YT_DLP_PATH?: string;
  DOWNLOAD_PATH?: string;
}

export interface LoggingConfig {
  LOG_LEVEL: string;
  LOG_REQUESTS: boolean;
  LOG_ERRORS: boolean;
  LOG_REQUEST_BODY?: boolean;
  ENABLE_REQUEST_LOGGING: boolean;
}

export interface SecurityConfig {
  CORS_ORIGIN?: string;
  ALLOWED_ORIGINS?: string;

  RATE_LIMIT_API_REQUESTS: number;
  RATE_LIMIT_API_WINDOW: number;
  RATE_LIMIT_YOUTUBE_REQUESTS: number;
  RATE_LIMIT_YOUTUBE_WINDOW: number;
}

export interface MonitoringConfig {
  TRACING_ENABLED?: boolean;
  JAEGER_ENDPOINT?: string;
  OTLP_ENDPOINT?: string;
  SENTRY_DSN?: string;
  SENTRY_TRACES_SAMPLE_RATE?: string;
  SENTRY_PROFILES_SAMPLE_RATE?: string;

  ERROR_REPORTING_ENABLED: boolean;
  ERROR_REPORTING_ENDPOINT?: string;
}

export interface DockerConfig {
  USE_DOCKER_SECRETS: boolean;
  DOCKER_SECRETS_PATH: string;
}

/**
 * Complete application configuration
 */
export interface AppConfig {
  server: ServerConfig;
  database: DatabaseConfig;
  auth: AuthConfig;
  redis: RedisConfig;
  plex: PlexConfig;
  email: EmailConfig;
  oauth: OAuthConfig;
  integrations: IntegrationConfig;
  logging: LoggingConfig;
  security: SecurityConfig;
  monitoring: MonitoringConfig;
  docker: DockerConfig;
}

/**
 * Configuration validation result
 */
export interface ConfigValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Configuration source information
 */
export interface ConfigSource {
  key: string;
  value: unknown;
  source: 'env' | 'docker_secret' | 'default';
  isSecret: boolean;
}
