/**
 * Centralized Configuration Service for MediaNest Backend
 * Replaces 92+ direct process.env accesses with type-safe configuration
 */


import {
  AppConfig,
  ServerConfig,
  DatabaseConfig,
  AuthConfig,
  RedisConfig,
  PlexConfig,
  EmailConfig,
  OAuthConfig,
  IntegrationConfig,
  LoggingConfig,
  SecurityConfig,
  MonitoringConfig,
  DockerConfig,
  ConfigValidationResult,
  ConfigSource,
} from './config.types';
import { readSecret, readSecretFromFile } from './secrets';
import { logger } from '../utils/logger';

export class ConfigService {
  private readonly config: AppConfig;
  private readonly configSources: ConfigSource[] = [];

  constructor() {
    this.config = this.loadAndValidateConfig();
    this.validateRequiredConfig();
  }

  /**
   * Get configuration value by category and key
   */
  get<T extends keyof AppConfig>(category: T): AppConfig[T];
  get<T extends keyof AppConfig, K extends keyof AppConfig[T]>(
    category: T,
    key: K,
  ): AppConfig[T][K];
  get<T extends keyof AppConfig, K extends keyof AppConfig[T]>(
    category: T,
    key?: K,
  ): AppConfig[T] | AppConfig[T][K] {
    if (key) {
      return this.config[category][key];
    }
    return this.config[category];
  }

  /**
   * Get server configuration
   */
  getServerConfig(): ServerConfig {
    return this.config.server;
  }

  /**
   * Get database configuration
   */
  getDatabaseConfig(): DatabaseConfig {
    return this.config.database;
  }

  /**
   * Get authentication configuration
   */
  getAuthConfig(): AuthConfig {
    return this.config.auth;
  }

  /**
   * Get Redis configuration
   */
  getRedisConfig(): RedisConfig {
    return this.config.redis;
  }

  /**
   * Get Plex configuration
   */
  getPlexConfig(): PlexConfig {
    return this.config.plex;
  }

  /**
   * Get email configuration
   */
  getEmailConfig(): EmailConfig {
    return this.config.email;
  }

  /**
   * Get OAuth configuration
   */
  getOAuthConfig(): OAuthConfig {
    return this.config.oauth;
  }

  /**
   * Get integrations configuration
   */
  getIntegrationsConfig(): IntegrationConfig {
    return this.config.integrations;
  }

  /**
   * Get logging configuration
   */
  getLoggingConfig(): LoggingConfig {
    return this.config.logging;
  }

  /**
   * Get security configuration
   */
  getSecurityConfig(): SecurityConfig {
    return this.config.security;
  }

  /**
   * Get monitoring configuration
   */
  getMonitoringConfig(): MonitoringConfig {
    return this.config.monitoring;
  }

  /**
   * Get Docker configuration
   */
  getDockerConfig(): DockerConfig {
    return this.config.docker;
  }

  /**
   * Check if running in development mode
   */
  isDevelopment(): boolean {
    return this.config.server.NODE_ENV === 'development';
  }

  /**
   * Check if running in test mode
   */
  isTest(): boolean {
    return this.config.server.NODE_ENV === 'test';
  }

  /**
   * Check if running in production mode
   */
  isProduction(): boolean {
    return this.config.server.NODE_ENV === 'production';
  }

  /**
   * Get configuration sources for debugging
   */
  getConfigSources(): ConfigSource[] {
    return this.configSources;
  }

  /**
   * Get masked configuration for logging (hides sensitive values)
   */
  getMaskedConfig(): Partial<AppConfig> {
    return {
      server: this.config.server,
      database: {
        ...this.config.database,
        DATABASE_URL: this.maskSensitiveValue(this.config.database.DATABASE_URL),
      },
      auth: {
        ...this.config.auth,
        JWT_SECRET: this.maskSensitiveValue(this.config.auth.JWT_SECRET),
        ENCRYPTION_KEY: this.maskSensitiveValue(this.config.auth.ENCRYPTION_KEY),
      },
      redis: {
        ...this.config.redis,
        REDIS_URL: this.config.redis.REDIS_URL
          ? this.maskSensitiveValue(this.config.redis.REDIS_URL)
          : undefined,
        REDIS_PASSWORD: this.config.redis.REDIS_PASSWORD
          ? this.maskSensitiveValue(this.config.redis.REDIS_PASSWORD)
          : undefined,
      },
      plex: {
        ...this.config.plex,
        PLEX_CLIENT_SECRET: this.maskSensitiveValue(this.config.plex.PLEX_CLIENT_SECRET),
      },
      oauth: {
        ...this.config.oauth,
        GITHUB_CLIENT_SECRET: this.config.oauth.GITHUB_CLIENT_SECRET
          ? this.maskSensitiveValue(this.config.oauth.GITHUB_CLIENT_SECRET)
          : undefined,
        GOOGLE_CLIENT_SECRET: this.config.oauth.GOOGLE_CLIENT_SECRET
          ? this.maskSensitiveValue(this.config.oauth.GOOGLE_CLIENT_SECRET)
          : undefined,
      },
      logging: this.config.logging,
      security: this.config.security,
      monitoring: {
        ...this.config.monitoring,
        SENTRY_DSN: this.config.monitoring.SENTRY_DSN
          ? this.maskSensitiveValue(this.config.monitoring.SENTRY_DSN)
          : undefined,
      },
      docker: this.config.docker,
    };
  }

  /**
   * Load and validate configuration from environment variables
   */
  private loadAndValidateConfig(): AppConfig {
    return {
      server: this.loadServerConfig(),
      database: this.loadDatabaseConfig(),
      auth: this.loadAuthConfig(),
      redis: this.loadRedisConfig(),
      plex: this.loadPlexConfig(),
      email: this.loadEmailConfig(),
      oauth: this.loadOAuthConfig(),
      integrations: this.loadIntegrationsConfig(),
      logging: this.loadLoggingConfig(),
      security: this.loadSecurityConfig(),
      monitoring: this.loadMonitoringConfig(),
      docker: this.loadDockerConfig(),
    };
  }

  private loadServerConfig(): ServerConfig {
    return {
      NODE_ENV: (process.env.NODE_ENV as 'development' | 'test' | 'production') || 'development',
      PORT: this.getIntEnv('PORT', 4000),
      HOST: this.getStringEnv('HOST', 'localhost') || 'localhost',
      HOSTNAME: this.getStringEnv('HOSTNAME'),
      FRONTEND_URL:
        this.getStringEnv('FRONTEND_URL', 'http://localhost:3000') || 'http://localhost:3000',
      BACKEND_URL: this.getStringEnv('BACKEND_URL'),
      APP_VERSION: this.getStringEnv('APP_VERSION'),
      SERVICE_NAME: this.getStringEnv('SERVICE_NAME'),
      SERVICE_VERSION: this.getStringEnv('SERVICE_VERSION'),
    };
  }

  private loadDatabaseConfig(): DatabaseConfig {
    return {
      DATABASE_URL: readSecretFromFile('DATABASE_URL_FILE', process.env.DATABASE_URL || ''),
      DATABASE_POOL_SIZE: this.getIntEnv('DATABASE_POOL_SIZE', 10),
      DATABASE_TIMEOUT: this.getIntEnv('DATABASE_TIMEOUT', 30000),
      USE_REAL_DATABASE: this.getBooleanEnv('USE_REAL_DATABASE'),
    };
  }

  private loadAuthConfig(): AuthConfig {
    return {
      JWT_SECRET: readSecret('jwt_secret', 'JWT_SECRET', 'dev-secret'),
      JWT_ISSUER: this.getStringEnv('JWT_ISSUER', 'medianest') || 'medianest',
      JWT_AUDIENCE: this.getStringEnv('JWT_AUDIENCE', 'medianest-users') || 'medianest-users',
      JWT_EXPIRES_IN: this.getStringEnv('JWT_EXPIRES_IN', '7d') || '7d',
      JWT_SECRET_ROTATION: this.getStringEnv('JWT_SECRET_ROTATION'),
      ENCRYPTION_KEY: readSecret('encryption_key', 'ENCRYPTION_KEY', ''),

      SESSION_COOKIE_MAX_AGE: this.getIntEnv('SESSION_COOKIE_MAX_AGE', 86400000),
      SESSION_ROLLING: this.getBooleanEnv('SESSION_ROLLING', false),

      AUTH_COOKIE_NAME: this.getStringEnv('AUTH_COOKIE_NAME', 'auth-token') || 'auth-token',
      AUTH_COOKIE_DOMAIN: this.getStringEnv('AUTH_COOKIE_DOMAIN'),

      BCRYPT_ROUNDS: this.getIntEnv('BCRYPT_ROUNDS', 12),
      PASSWORD_MIN_LENGTH: this.getIntEnv('PASSWORD_MIN_LENGTH', 8),
      MAX_LOGIN_ATTEMPTS: this.getIntEnv('MAX_LOGIN_ATTEMPTS', 5),
      LOCKOUT_TIME: this.getIntEnv('LOCKOUT_TIME', 1800000), // 30 minutes

      ENABLE_REGISTRATION: this.getBooleanEnv('ENABLE_REGISTRATION', true),
      ENABLE_EMAIL_VERIFICATION: this.getBooleanEnv('ENABLE_EMAIL_VERIFICATION', false),
      ENABLE_TWO_FACTOR_AUTH: this.getBooleanEnv('ENABLE_TWO_FACTOR_AUTH', false),
      ENABLE_PASSWORD_RESET: this.getBooleanEnv('ENABLE_PASSWORD_RESET', true),

      API_KEY_HASH: this.getStringEnv('API_KEY_HASH'),
      METRICS_TOKEN: this.getStringEnv('METRICS_TOKEN'),
    };
  }

  private loadRedisConfig(): RedisConfig {
    return {
      REDIS_URL: readSecretFromFile(
        'REDIS_URL_FILE',
        process.env.REDIS_URL || 'redis://localhost:6379',
      ),
      REDIS_HOST: this.getStringEnv('REDIS_HOST', 'localhost') || 'localhost',
      REDIS_PORT: this.getIntEnv('REDIS_PORT', 6379),
      REDIS_PASSWORD: this.getStringEnv('REDIS_PASSWORD'),
      SKIP_REDIS: this.getBooleanEnv('SKIP_REDIS', false),
      DISABLE_REDIS: this.getBooleanEnv('DISABLE_REDIS', false),
    };
  }

  private loadPlexConfig(): PlexConfig {
    return {
      PLEX_URL: this.getStringEnv('PLEX_URL'),
      PLEX_SERVER_URL: this.getStringEnv('PLEX_SERVER_URL'),
      PLEX_CLIENT_ID: readSecret('plex_client_id', 'PLEX_CLIENT_ID', ''),
      PLEX_CLIENT_SECRET: readSecret('plex_client_secret', 'PLEX_CLIENT_SECRET', ''),
      PLEX_CLIENT_IDENTIFIER: this.getStringEnv('PLEX_CLIENT_IDENTIFIER'),
      PLEX_DEFAULT_TOKEN: this.getStringEnv('PLEX_DEFAULT_TOKEN'),
      PLEX_DEVICE_NAME: this.getStringEnv('PLEX_DEVICE_NAME'),
      PLEX_ENABLED: this.getBooleanEnv('PLEX_ENABLED'),
      PLEX_PLATFORM: this.getStringEnv('PLEX_PLATFORM'),
      PLEX_PRODUCT: this.getStringEnv('PLEX_PRODUCT'),
      PLEX_VERSION: this.getStringEnv('PLEX_VERSION'),
    };
  }

  private loadEmailConfig(): EmailConfig {
    return {
      SMTP_HOST: this.getStringEnv('SMTP_HOST'),
      SMTP_PORT: this.getIntEnv('SMTP_PORT', 587),
      SMTP_SECURE: this.getBooleanEnv('SMTP_SECURE', false),
      SMTP_USER: this.getStringEnv('SMTP_USER'),
      EMAIL_FROM:
        this.getStringEnv('EMAIL_FROM', 'noreply@medianest.com') || 'noreply@medianest.com',
      EMAIL_FROM_NAME: this.getStringEnv('EMAIL_FROM_NAME', 'MediaNest') || 'MediaNest',
    };
  }

  private loadOAuthConfig(): OAuthConfig {
    return {
      GITHUB_CLIENT_ID: this.getStringEnv('GITHUB_CLIENT_ID'),
      GITHUB_CLIENT_SECRET: this.getStringEnv('GITHUB_CLIENT_SECRET'),
      GITHUB_REDIRECT_URI: this.getStringEnv('GITHUB_REDIRECT_URI'),
      GOOGLE_CLIENT_ID: this.getStringEnv('GOOGLE_CLIENT_ID'),
      GOOGLE_CLIENT_SECRET: this.getStringEnv('GOOGLE_CLIENT_SECRET'),
      GOOGLE_REDIRECT_URI: this.getStringEnv('GOOGLE_REDIRECT_URI'),
    };
  }

  private loadIntegrationsConfig(): IntegrationConfig {
    return {
      OVERSEERR_URL: this.getStringEnv('OVERSEERR_URL'),
      OVERSEERR_API_KEY: this.getStringEnv('OVERSEERR_API_KEY'),
      OVERSEERR_ENABLED: this.getBooleanEnv('OVERSEERR_ENABLED'),

      UPTIME_KUMA_URL: this.getStringEnv('UPTIME_KUMA_URL'),
      UPTIME_KUMA_USERNAME: this.getStringEnv('UPTIME_KUMA_USERNAME'),
      UPTIME_KUMA_PASSWORD: this.getStringEnv('UPTIME_KUMA_PASSWORD'),
      UPTIME_KUMA_ENABLED: this.getBooleanEnv('UPTIME_KUMA_ENABLED'),

      YT_DLP_PATH: this.getStringEnv('YT_DLP_PATH'),
      DOWNLOAD_PATH: this.getStringEnv('DOWNLOAD_PATH'),
    };
  }

  private loadLoggingConfig(): LoggingConfig {
    const nodeEnv = process.env.NODE_ENV || 'development';
    return {
      LOG_LEVEL:
        this.getStringEnv('LOG_LEVEL', nodeEnv === 'production' ? 'info' : 'debug') ||
        (nodeEnv === 'production' ? 'info' : 'debug'),
      LOG_REQUESTS: this.getBooleanEnv('LOG_REQUESTS', false),
      LOG_ERRORS: this.getBooleanEnv('LOG_ERRORS', true),
      LOG_REQUEST_BODY: this.getBooleanEnv('LOG_REQUEST_BODY'),
      ENABLE_REQUEST_LOGGING: this.getBooleanEnv('ENABLE_REQUEST_LOGGING', true),
    };
  }

  private loadSecurityConfig(): SecurityConfig {
    return {
      CORS_ORIGIN: this.getStringEnv('CORS_ORIGIN'),
      ALLOWED_ORIGINS: this.getStringEnv('ALLOWED_ORIGINS'),

      RATE_LIMIT_API_REQUESTS: this.getIntEnv('RATE_LIMIT_API_REQUESTS', 100),
      RATE_LIMIT_API_WINDOW: this.getIntEnv('RATE_LIMIT_API_WINDOW', 60),
      RATE_LIMIT_YOUTUBE_REQUESTS: this.getIntEnv('RATE_LIMIT_YOUTUBE_REQUESTS', 5),
      RATE_LIMIT_YOUTUBE_WINDOW: this.getIntEnv('RATE_LIMIT_YOUTUBE_WINDOW', 3600),
    };
  }

  private loadMonitoringConfig(): MonitoringConfig {
    return {
      TRACING_ENABLED: this.getBooleanEnv('TRACING_ENABLED'),
      JAEGER_ENDPOINT: this.getStringEnv('JAEGER_ENDPOINT'),
      OTLP_ENDPOINT: this.getStringEnv('OTLP_ENDPOINT'),
      SENTRY_DSN: this.getStringEnv('SENTRY_DSN'),
      SENTRY_TRACES_SAMPLE_RATE: this.getStringEnv('SENTRY_TRACES_SAMPLE_RATE'),
      SENTRY_PROFILES_SAMPLE_RATE: this.getStringEnv('SENTRY_PROFILES_SAMPLE_RATE'),

      ERROR_REPORTING_ENABLED: this.getBooleanEnv('ERROR_REPORTING_ENABLED', false),
      ERROR_REPORTING_ENDPOINT: this.getStringEnv('ERROR_REPORTING_ENDPOINT'),
    };
  }

  private loadDockerConfig(): DockerConfig {
    return {
      USE_DOCKER_SECRETS: this.getBooleanEnv('USE_DOCKER_SECRETS', false),
      DOCKER_SECRETS_PATH:
        this.getStringEnv('DOCKER_SECRETS_PATH', '/run/secrets') || '/run/secrets',
    };
  }

  /**
   * Helper methods for environment variable parsing
   */
  private getStringEnv(key: string, defaultValue?: string): string | undefined {
    const value = process.env[key] || defaultValue;
    this.recordConfigSource(key, value, 'env', false);
    return value;
  }

  private getIntEnv(key: string, defaultValue?: number): number {
    const value = process.env[key];
    const parsed = value ? parseInt(value, 10) : defaultValue;
    this.recordConfigSource(key, parsed, 'env', false);
    return parsed || 0;
  }

  private getBooleanEnv(key: string, defaultValue?: boolean): boolean {
    const value = process.env[key];
    let parsed: boolean;

    if (value === undefined) {
      parsed = defaultValue || false;
    } else {
      parsed = value === 'true';
    }

    this.recordConfigSource(key, parsed, 'env', false);
    return parsed;
  }

  private recordConfigSource(
    key: string,
    value: unknown,
    source: 'env' | 'docker_secret' | 'default',
    isSecret: boolean,
  ): void {
    this.configSources.push({
      key,
      value: isSecret ? this.maskSensitiveValue(String(value)) : value,
      source,
      isSecret,
    });
  }

  private maskSensitiveValue(value: string | undefined): string {
    if (!value || value.length < 8) return '[hidden]';
    return value.substring(0, 4) + '***' + value.substring(value.length - 4);
  }

  /**
   * Validate required configuration in production
   */
  private validateRequiredConfig(): ConfigValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (this.isProduction()) {
      const required = [
        {
          key: 'DATABASE_URL',
          value: this.config.database.DATABASE_URL,
          description: 'PostgreSQL connection string',
        },
        {
          key: 'JWT_SECRET',
          value: this.config.auth.JWT_SECRET,
          description: 'JWT signing secret',
        },
        {
          key: 'ENCRYPTION_KEY',
          value: this.config.auth.ENCRYPTION_KEY,
          description: 'AES-256-GCM encryption key',
        },
        {
          key: 'PLEX_CLIENT_ID',
          value: this.config.plex.PLEX_CLIENT_ID,
          description: 'Plex OAuth client ID',
        },
        {
          key: 'PLEX_CLIENT_SECRET',
          value: this.config.plex.PLEX_CLIENT_SECRET,
          description: 'Plex OAuth client secret',
        },
      ];

      for (const config of required) {
        if (!config.value || config.value === '' || config.value === 'dev-secret') {
          errors.push(
            `Missing or invalid required configuration: ${config.key} - ${config.description}`,
          );
        }
      }
    }

    // Warnings for missing non-critical config
    if (!this.config.redis.REDIS_URL && !this.config.redis.REDIS_HOST) {
      warnings.push('Redis configuration is incomplete, some features may not work');
    }

    if (errors.length > 0) {
      throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
    }

    if (warnings.length > 0) {
      logger.warn('Configuration validation warnings', {
        warnings: warnings,
        warningCount: warnings.length,
        timestamp: new Date().toISOString(),
      });
    }

    return { isValid: true, errors, warnings };
  }
}

// Export singleton instance
export const configService = new ConfigService();

// Type export removed to prevent redeclaration
