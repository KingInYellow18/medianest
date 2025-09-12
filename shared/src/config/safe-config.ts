/**
 * SAFE CONFIGURATION UTILITIES
 * Security-focused configuration parsing with comprehensive null safety
 */

import {
  safeParseInt,
  safeParsePort,
  safeParseBoolean,
  requireEnv,
  safeGetEnv,
} from '../utils/safe-parsing';
import { isString, safeJsonParse } from '../utils/type-guards';

/**
 * Safe environment configuration parser
 */
export class SafeEnvironmentConfig {
  /**
   * Parse database configuration with comprehensive validation
   */
  static getDatabaseConfig() {
    const databaseUrl = requireEnv('DATABASE_URL');

    // Validate URL format
    try {
      new URL(databaseUrl);
    } catch {
      throw new Error('DATABASE_URL must be a valid URL');
    }

    return {
      url: databaseUrl,
      poolSize: safeParseInt(process.env.DATABASE_POOL_SIZE, 10, {
        min: 1,
        max: 100,
        allowNegative: false,
      }),
      timeout: safeParseInt(process.env.DATABASE_TIMEOUT, 30000, {
        min: 1000,
        max: 300000,
        allowNegative: false,
      }),
      ssl: safeParseBoolean(process.env.DATABASE_SSL, false),
      logging: safeParseBoolean(process.env.DATABASE_LOGGING, false),
    };
  }

  /**
   * Parse Redis configuration with validation
   */
  static getRedisConfig() {
    const host = safeGetEnv('REDIS_HOST', 'localhost');
    const port = safeParsePort(process.env.REDIS_PORT, 6379);
    const password = safeGetEnv('REDIS_PASSWORD');

    return {
      host,
      port,
      password: password || undefined,
      db: safeParseInt(process.env.REDIS_DB, 0, {
        min: 0,
        max: 15,
        allowNegative: false,
      }),
      retryDelayOnFailover: safeParseInt(process.env.REDIS_RETRY_DELAY, 1000, {
        min: 100,
        max: 10000,
        allowNegative: false,
      }),
    };
  }

  /**
   * Parse server configuration
   */
  static getServerConfig() {
    return {
      port: safeParsePort(process.env.PORT, 3000),
      host: safeGetEnv('HOST', '0.0.0.0'),
      nodeEnv: (process.env.NODE_ENV as 'development' | 'production' | 'test') || 'development',
      cors: {
        origin: this.parseCorsOrigins(process.env.CORS_ORIGINS),
        credentials: safeParseBoolean(process.env.CORS_CREDENTIALS, true),
      },
      rateLimit: {
        windowMs: safeParseInt(process.env.RATE_LIMIT_WINDOW, 900000, {
          // 15 minutes
          min: 60000, // 1 minute minimum
          max: 3600000, // 1 hour maximum
          allowNegative: false,
        }),
        max: safeParseInt(process.env.RATE_LIMIT_MAX, 100, {
          min: 1,
          max: 10000,
          allowNegative: false,
        }),
      },
    };
  }

  /**
   * Parse authentication configuration
   */
  static getAuthConfig() {
    return {
      jwtSecret: requireEnv('JWT_SECRET'),
      jwtExpiry: safeGetEnv('JWT_EXPIRY', '7d'),
      bcryptRounds: safeParseInt(process.env.BCRYPT_ROUNDS, 12, {
        min: 8,
        max: 15,
        allowNegative: false,
      }),
      sessionSecret: requireEnv('SESSION_SECRET'),
      sessionMaxAge: safeParseInt(process.env.SESSION_MAX_AGE, 86400000, {
        // 24 hours
        min: 3600000, // 1 hour minimum
        max: 604800000, // 1 week maximum
        allowNegative: false,
      }),
      maxLoginAttempts: safeParseInt(process.env.MAX_LOGIN_ATTEMPTS, 5, {
        min: 1,
        max: 20,
        allowNegative: false,
      }),
      lockoutDuration: safeParseInt(process.env.LOCKOUT_DURATION, 1800000, {
        // 30 minutes
        min: 300000, // 5 minutes minimum
        max: 86400000, // 24 hours maximum
        allowNegative: false,
      }),
    };
  }

  /**
   * Parse logging configuration
   */
  static getLoggingConfig() {
    const logLevel = safeGetEnv('LOG_LEVEL', 'info');
    const validLogLevels = ['error', 'warn', 'info', 'debug', 'verbose'];

    return {
      level: validLogLevels.includes(logLevel) ? logLevel : 'info',
      format: safeGetEnv('LOG_FORMAT', 'json'),
      file: {
        enabled: safeParseBoolean(process.env.LOG_FILE_ENABLED, false),
        path: safeGetEnv('LOG_FILE_PATH', './logs/app.log'),
        maxSize: safeParseInt(process.env.LOG_FILE_MAX_SIZE, 10485760, {
          // 10MB
          min: 1048576, // 1MB minimum
          max: 104857600, // 100MB maximum
          allowNegative: false,
        }),
      },
    };
  }

  /**
   * Parse email configuration
   */
  static getEmailConfig() {
    return {
      smtp: {
        host: safeGetEnv('SMTP_HOST'),
        port: safeParseInt(process.env.SMTP_PORT, 587, {
          min: 1,
          max: 65535,
          allowNegative: false,
        }),
        secure: safeParseBoolean(process.env.SMTP_SECURE, false),
        auth: {
          user: safeGetEnv('SMTP_USER'),
          pass: safeGetEnv('SMTP_PASS'),
        },
      },
      from: safeGetEnv('EMAIL_FROM', 'noreply@medianest.com'),
      templates: {
        path: safeGetEnv('EMAIL_TEMPLATES_PATH', './templates'),
      },
    };
  }

  /**
   * Parse security configuration
   */
  static getSecurityConfig() {
    return {
      helmet: {
        enabled: safeParseBoolean(process.env.HELMET_ENABLED, true),
        contentSecurityPolicy: {
          enabled: safeParseBoolean(process.env.CSP_ENABLED, true),
          directives: this.parseCSPDirectives(process.env.CSP_DIRECTIVES),
        },
      },
      https: {
        enabled: safeParseBoolean(process.env.HTTPS_ENABLED, false),
        forceRedirect: safeParseBoolean(process.env.HTTPS_FORCE_REDIRECT, false),
      },
      encryption: {
        algorithm: safeGetEnv('ENCRYPTION_ALGORITHM', 'aes-256-gcm'),
        keyLength: safeParseInt(process.env.ENCRYPTION_KEY_LENGTH, 32, {
          min: 16,
          max: 64,
          allowNegative: false,
        }),
      },
    };
  }

  /**
   * Parse CORS origins safely
   */
  private static parseCorsOrigins(origins: string | undefined): string[] | boolean {
    if (!isString(origins)) {
      return process.env.NODE_ENV === 'development' ? true : [];
    }

    if (origins.trim() === '*') {
      return true;
    }

    try {
      const parsed = safeJsonParse<string[]>(origins, []);
      return Array.isArray(parsed) ? parsed : [origins];
    } catch {
      return origins
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean);
    }
  }

  /**
   * Parse Content Security Policy directives
   */
  private static parseCSPDirectives(directives: string | undefined): Record<string, string[]> {
    if (!isString(directives)) {
      return {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      };
    }

    return safeJsonParse(directives, {});
  }

  /**
   * Validate all configurations
   */
  static validateAll(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    try {
      this.getDatabaseConfig();
    } catch (error) {
      errors.push(`Database config: ${error instanceof Error ? error.message : String(error)}`);
    }

    try {
      this.getAuthConfig();
    } catch (error) {
      errors.push(`Auth config: ${error instanceof Error ? error.message : String(error)}`);
    }

    try {
      this.getRedisConfig();
    } catch (error) {
      errors.push(`Redis config: ${error instanceof Error ? error.message : String(error)}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get complete application configuration
   */
  static getCompleteConfig() {
    return {
      database: this.getDatabaseConfig(),
      redis: this.getRedisConfig(),
      server: this.getServerConfig(),
      auth: this.getAuthConfig(),
      logging: this.getLoggingConfig(),
      email: this.getEmailConfig(),
      security: this.getSecurityConfig(),
    };
  }
}

/**
 * Configuration validation middleware
 */
export function validateConfigMiddleware() {
  return (_req: any, res: any, next: any) => {
    const validation = SafeEnvironmentConfig.validateAll();

    if (!validation.isValid) {
      console.error('Configuration validation failed:', validation.errors);
      return res.status(500).json({
        error: 'Server configuration is invalid',
        code: 'INVALID_CONFIGURATION',
      });
    }

    next();
  };
}
