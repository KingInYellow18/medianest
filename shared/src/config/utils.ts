import fs from 'fs';
import path from 'path';

import dotenv from 'dotenv';

import type { Environment } from './schemas';

/**
 * Interface for environment variable loaders
 */
export interface EnvLoader {
  load(): Record<string, string>;
}

/**
 * Standard environment variable loader using process.env
 */
export class ProcessEnvLoader implements EnvLoader {
  load(): Record<string, string> {
    const env: Record<string, string> = {};

    for (const [key, value] of Object.entries(process.env)) {
      if (value !== undefined) {
        env[key] = value;
      }
    }

    return env;
  }
}

/**
 * Docker secrets loader for production environments
 */
export class DockerSecretsLoader implements EnvLoader {
  constructor(private secretsPath: string = '/run/secrets') {}

  load(): Record<string, string> {
    const env: Record<string, string> = {};

    if (!fs.existsSync(this.secretsPath)) {
      return env;
    }

    try {
      const secretFiles = fs.readdirSync(this.secretsPath);

      for (const file of secretFiles) {
        const secretPath = path.join(this.secretsPath, file);

        if (fs.statSync(secretPath).isFile()) {
          try {
            const value = fs.readFileSync(secretPath, 'utf8').trim();
            // Convert filename to uppercase environment variable name
            const envKey = file.toUpperCase();
            env[envKey] = value;
          } catch (error) {
            console.warn(`Failed to read Docker secret ${file}:`, error);
          }
        }
      }
    } catch (error) {
      console.warn('Failed to read Docker secrets directory:', error);
    }

    return env;
  }
}

/**
 * Dotenv file loader
 */
export class DotenvLoader implements EnvLoader {
  constructor(private envPath?: string) {}

  load(): Record<string, string> {
    const env: Record<string, string> = {};

    try {
      const result = dotenv.config({ path: this.envPath });

      if (result.parsed) {
        Object.assign(env, result.parsed);
      }
    } catch (error) {
      console.warn('Failed to load .env file:', error);
    }

    return env;
  }
}

/**
 * Composite environment loader that combines multiple sources
 */
export class CompositeEnvLoader implements EnvLoader {
  constructor(private loaders: EnvLoader[]) {}

  load(): Record<string, string> {
    let env: Record<string, string> = {};

    // Load from all sources, with later sources taking precedence
    for (const loader of this.loaders) {
      const loaderEnv = loader.load();
      env = { ...env, ...loaderEnv };
    }

    return env;
  }
}

/**
 * Environment-specific configuration loader
 */
export class EnvironmentConfigLoader {
  private static instance: EnvironmentConfigLoader;
  private envCache: Record<string, string> | null = null;

  private constructor() {}

  static getInstance(): EnvironmentConfigLoader {
    if (!EnvironmentConfigLoader.instance) {
      EnvironmentConfigLoader.instance = new EnvironmentConfigLoader();
    }
    return EnvironmentConfigLoader.instance;
  }

  /**
   * Load environment variables with proper precedence
   * Precedence (highest to lowest):
   * 1. Process environment variables
   * 2. Docker secrets (production only)
   * 3. .env file
   */
  loadEnvironment(
    options: {
      useDockerSecrets?: boolean;
      envFilePath?: string;
      secretsPath?: string;
    } = {}
  ): Record<string, string> {
    if (this.envCache) {
      return this.envCache;
    }

    const loaders: EnvLoader[] = [];

    // 1. Load from .env file first (lowest precedence)
    if (options.envFilePath || this.shouldLoadDotenv()) {
      loaders.push(new DotenvLoader(options.envFilePath));
    }

    // 2. Load Docker secrets (production environments)
    if (options.useDockerSecrets || this.shouldUseDockerSecrets()) {
      loaders.push(new DockerSecretsLoader(options.secretsPath));
    }

    // 3. Load process environment variables (highest precedence)
    loaders.push(new ProcessEnvLoader());

    const compositeLoader = new CompositeEnvLoader(loaders);
    this.envCache = compositeLoader.load();

    return this.envCache;
  }

  /**
   * Clear the environment cache (useful for testing)
   */
  clearCache(): void {
    this.envCache = null;
  }

  /**
   * Get current environment
   */
  getEnvironment(): Environment {
    const env = this.loadEnvironment();
    const nodeEnv = env.NODE_ENV?.toLowerCase();

    if (nodeEnv === 'production') return 'production';
    if (nodeEnv === 'test') return 'test';
    return 'development';
  }

  /**
   * Determine if we should load .env file
   */
  private shouldLoadDotenv(): boolean {
    // Check NODE_ENV directly from process.env to avoid circular dependency
    const nodeEnv = process.env.NODE_ENV?.toLowerCase();
    const env =
      nodeEnv === 'production' ? 'production' : nodeEnv === 'test' ? 'test' : 'development';
    return env === 'development' || env === 'test';
  }

  /**
   * Determine if we should use Docker secrets
   */
  private shouldUseDockerSecrets(): boolean {
    const useDockerSecrets = process.env.USE_DOCKER_SECRETS?.toLowerCase();
    // Check NODE_ENV directly from process.env to avoid circular dependency
    const nodeEnv = process.env.NODE_ENV?.toLowerCase();
    const env =
      nodeEnv === 'production' ? 'production' : nodeEnv === 'test' ? 'test' : 'development';
    return useDockerSecrets === 'true' || env === 'production';
  }
}

/**
 * Utility functions for configuration validation
 */
export const configUtils = {
  /**
   * Check if a value is a valid URL
   */
  isValidUrl: (value: string): boolean => {
    try {
      new URL(value);
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Parse a comma-separated string into an array
   */
  parseArray: (value: string | undefined, defaultValue: string[] = []): string[] => {
    if (!value) return defaultValue;
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  },

  /**
   * Parse a boolean value from string
   */
  parseBoolean: (value: string | undefined, defaultValue = false): boolean => {
    if (!value) return defaultValue;
    const lowercased = value.toLowerCase();
    return lowercased === 'true' || lowercased === '1' || lowercased === 'yes';
  },

  /**
   * Parse an integer with validation
   */
  parseInt: (
    value: string | undefined,
    defaultValue: number,
    min?: number,
    max?: number
  ): number => {
    if (!value) return defaultValue;

    const parsed = Number.parseInt(value, 10);
    if (Number.isNaN(parsed)) return defaultValue;

    if (min !== undefined && parsed < min) return defaultValue;
    if (max !== undefined && parsed > max) return defaultValue;

    return parsed;
  },

  /**
   * Mask sensitive values for logging
   */
  maskSensitiveValue: (key: string, value: string): string => {
    const sensitiveKeys = [
      'password',
      'secret',
      'key',
      'token',
      'api_key',
      'private',
      'jwt_secret',
      'nextauth_secret',
      'encryption_key',
      'plex_client_secret',
    ];

    const isSensitive = sensitiveKeys.some((sensitive) => key.toLowerCase().includes(sensitive));

    if (isSensitive && value.length > 0) {
      return `${value.substring(0, 4)}${'*'.repeat(value.length - 4)}`;
    }

    return value;
  },

  /**
   * Create a sanitized configuration object for logging
   */
  sanitizeConfigForLogging: (config: Record<string, unknown>): Record<string, unknown> => {
    const sanitized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(config)) {
      if (typeof value === 'string') {
        sanitized[key] = configUtils.maskSensitiveValue(key, value);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  },
};

/**
 * Create a validated configuration object
 */
export function createConfiguration<T>(
  validator: (env: Record<string, unknown>) => T,
  options: {
    useDockerSecrets?: boolean;
    envFilePath?: string;
    secretsPath?: string;
  } = {}
): T {
  const loader = EnvironmentConfigLoader.getInstance();
  const env = loader.loadEnvironment(options);

  try {
    return validator(env);
  } catch (error) {
    console.error('Configuration validation failed:', error);
    throw error;
  }
}

/**
 * Export the singleton instance
 */
export const environmentLoader = EnvironmentConfigLoader.getInstance();
