/**
 * Secret Management System for MediaNest
 * Handles secure loading and management of secrets across environments
 */

import { createHash } from 'crypto';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

// Types for secret management
export interface SecretConfig {
  provider: 'env' | 'file' | 'aws' | 'azure' | 'vault';
  options?: Record<string, any>;
}

export interface SecretMetadata {
  key: string;
  required: boolean;
  environment: string[];
  description?: string;
  validation?: RegExp | ((value: string) => boolean);
  transform?: (value: string) => any;
}

/**
 * Secret definitions with metadata
 */
export const SECRET_DEFINITIONS: Record<string, SecretMetadata> = {
  // Database secrets
  DATABASE_URL: {
    key: 'DATABASE_URL',
    required: true,
    environment: ['development', 'test', 'production'],
    description: 'PostgreSQL connection string',
    validation: /^postgresql:\/\/.+/,
  },
  DB_PASSWORD: {
    key: 'DB_PASSWORD',
    required: false,
    environment: ['production'],
    description: 'Database password (if using separate connection params)',
  },

  // Redis secrets
  REDIS_URL: {
    key: 'REDIS_URL',
    required: true,
    environment: ['development', 'test', 'production'],
    description: 'Redis connection string',
    validation: /^redis:\/\/.+/,
  },
  REDIS_PASSWORD: {
    key: 'REDIS_PASSWORD',
    required: false,
    environment: ['production'],
    description: 'Redis password (if required)',
  },

  // Authentication secrets
  JWT_SECRET: {
    key: 'JWT_SECRET',
    required: true,
    environment: ['development', 'test', 'production'],
    description: 'JWT signing secret',
    validation: (value: string) => value.length >= 32,
  },
  SESSION_SECRET: {
    key: 'SESSION_SECRET',
    required: true,
    environment: ['development', 'test', 'production'],
    description: 'Session signing secret',
    validation: (value: string) => value.length >= 32,
  },

  // External service API keys
  EMAIL_API_KEY: {
    key: 'EMAIL_API_KEY',
    required: false,
    environment: ['production'],
    description: 'Email service API key (SendGrid, SES, etc.)',
  },
  AWS_ACCESS_KEY_ID: {
    key: 'AWS_ACCESS_KEY_ID',
    required: false,
    environment: ['production'],
    description: 'AWS access key for S3 storage',
  },
  AWS_SECRET_ACCESS_KEY: {
    key: 'AWS_SECRET_ACCESS_KEY',
    required: false,
    environment: ['production'],
    description: 'AWS secret key for S3 storage',
  },

  // Monitoring and APM secrets
  APM_SERVER_URL: {
    key: 'APM_SERVER_URL',
    required: false,
    environment: ['production'],
    description: 'APM server URL (Elastic APM, New Relic, etc.)',
  },
  APM_SECRET_TOKEN: {
    key: 'APM_SECRET_TOKEN',
    required: false,
    environment: ['production'],
    description: 'APM authentication token',
  },

  // SSL certificates (for HTTPS)
  SSL_CERT_PATH: {
    key: 'SSL_CERT_PATH',
    required: false,
    environment: ['production'],
    description: 'Path to SSL certificate file',
  },
  SSL_KEY_PATH: {
    key: 'SSL_KEY_PATH',
    required: false,
    environment: ['production'],
    description: 'Path to SSL private key file',
  },

  // Third-party integrations
  STRIPE_SECRET_KEY: {
    key: 'STRIPE_SECRET_KEY',
    required: false,
    environment: ['production'],
    description: 'Stripe payment processing secret key',
  },
  GOOGLE_OAUTH_CLIENT_SECRET: {
    key: 'GOOGLE_OAUTH_CLIENT_SECRET',
    required: false,
    environment: ['development', 'production'],
    description: 'Google OAuth client secret',
  },
};

/**
 * Abstract base class for secret providers
 */
abstract class SecretProvider {
  abstract getSecret(key: string): Promise<string | undefined>;
  abstract setSecret(key: string, value: string): Promise<void>;
  abstract deleteSecret(key: string): Promise<void>;
  abstract listSecrets(): Promise<string[]>;
}

/**
 * Environment variable secret provider
 */
class EnvironmentSecretProvider extends SecretProvider {
  async getSecret(key: string): Promise<string | undefined> {
    return process.env[key];
  }

  async setSecret(key: string, value: string): Promise<void> {
    process.env[key] = value;
  }

  async deleteSecret(key: string): Promise<void> {
    delete process.env[key];
  }

  async listSecrets(): Promise<string[]> {
    return Object.keys(process.env);
  }
}

/**
 * File-based secret provider (for Docker secrets, etc.)
 */
class FileSecretProvider extends SecretProvider {
  private secretsPath: string;

  constructor(secretsPath: string = '/run/secrets') {
    super();
    this.secretsPath = secretsPath;
  }

  async getSecret(key: string): Promise<string | undefined> {
    const filePath = join(this.secretsPath, key);
    if (!existsSync(filePath)) {
      return undefined;
    }

    try {
      return readFileSync(filePath, 'utf8').trim();
    } catch (error) {
      console.warn(`Failed to read secret file ${filePath}:`, error);
      return undefined;
    }
  }

  async setSecret(key: string, value: string): Promise<void> {
    throw new Error('FileSecretProvider does not support setting secrets');
  }

  async deleteSecret(key: string): Promise<void> {
    throw new Error('FileSecretProvider does not support deleting secrets');
  }

  async listSecrets(): Promise<string[]> {
    // Implementation would depend on file system access
    throw new Error('FileSecretProvider does not support listing secrets');
  }
}

/**
 * AWS Secrets Manager provider (placeholder)
 */
class AWSSecretsProvider extends SecretProvider {
  private region: string;
  private secretName: string;

  constructor(region: string = 'us-east-1', secretName: string = 'medianest-secrets') {
    super();
    this.region = region;
    this.secretName = secretName;
  }

  async getSecret(key: string): Promise<string | undefined> {
    // This would integrate with AWS SDK
    // For now, return undefined to indicate not implemented
    console.warn('AWS Secrets Manager integration not implemented');
    return undefined;
  }

  async setSecret(key: string, value: string): Promise<void> {
    throw new Error('AWS Secrets Manager integration not implemented');
  }

  async deleteSecret(key: string): Promise<void> {
    throw new Error('AWS Secrets Manager integration not implemented');
  }

  async listSecrets(): Promise<string[]> {
    throw new Error('AWS Secrets Manager integration not implemented');
  }
}

/**
 * Kubernetes secrets provider (placeholder)
 */
class KubernetesSecretsProvider extends SecretProvider {
  private namespace: string;

  constructor(namespace: string = 'default') {
    super();
    this.namespace = namespace;
  }

  async getSecret(key: string): Promise<string | undefined> {
    // This would integrate with Kubernetes API
    console.warn('Kubernetes secrets integration not implemented');
    return undefined;
  }

  async setSecret(key: string, value: string): Promise<void> {
    throw new Error('Kubernetes secrets integration not implemented');
  }

  async deleteSecret(key: string): Promise<void> {
    throw new Error('Kubernetes secrets integration not implemented');
  }

  async listSecrets(): Promise<string[]> {
    throw new Error('Kubernetes secrets integration not implemented');
  }
}

/**
 * Main secret manager class
 */
export class SecretManager {
  private providers: SecretProvider[] = [];
  private cache: Map<string, { value: string; timestamp: number }> = new Map();
  private cacheTimeout: number = 300000; // 5 minutes

  constructor() {
    this.initializeProviders();
  }

  private initializeProviders(): void {
    // Always include environment variable provider
    this.providers.push(new EnvironmentSecretProvider());

    // Add file provider if running in Docker/K8s
    if (existsSync('/run/secrets')) {
      this.providers.push(new FileSecretProvider());
    }

    // Add cloud providers based on environment
    const secretProvider = process.env.SECRET_PROVIDER;
    switch (secretProvider) {
      case 'aws':
        this.providers.push(new AWSSecretsProvider());
        break;
      // k8s provider removed - use environment variables or vault instead
      // Add more providers as needed
    }
  }

  /**
   * Get a secret value, trying all providers in order
   */
  async getSecret(key: string, useCache: boolean = true): Promise<string | undefined> {
    // Check cache first
    if (useCache) {
      const cached = this.cache.get(key);
      if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.value;
      }
    }

    // Try each provider
    for (const provider of this.providers) {
      try {
        const value = await provider.getSecret(key);
        if (value !== undefined && value !== '') {
          // Cache the result
          if (useCache) {
            this.cache.set(key, { value, timestamp: Date.now() });
          }
          return value;
        }
      } catch (error) {
        console.warn(`Provider ${provider.constructor.name} failed to get secret ${key}:`, error);
      }
    }

    return undefined;
  }

  /**
   * Validate that all required secrets are available
   */
  async validateSecrets(environment: string): Promise<{ valid: boolean; missing: string[] }> {
    const missing: string[] = [];

    for (const [key, metadata] of Object.entries(SECRET_DEFINITIONS)) {
      // Check if secret is required for this environment
      if (metadata.required && metadata.environment.includes(environment)) {
        const value = await this.getSecret(key);

        if (!value) {
          missing.push(key);
          continue;
        }

        // Validate the secret value
        if (metadata.validation) {
          let isValid: boolean;

          if (metadata.validation instanceof RegExp) {
            isValid = metadata.validation.test(value);
          } else if (typeof metadata.validation === 'function') {
            isValid = metadata.validation(value);
          } else {
            isValid = true;
          }

          if (!isValid) {
            console.error(`Secret ${key} failed validation`);
            missing.push(key);
          }
        }
      }
    }

    return {
      valid: missing.length === 0,
      missing,
    };
  }

  /**
   * Load all secrets into environment variables
   */
  async loadSecrets(environment: string): Promise<void> {
    console.log(`Loading secrets for environment: ${environment}`);

    const validation = await this.validateSecrets(environment);

    if (!validation.valid) {
      throw new Error(
        `Missing required secrets for ${environment} environment: ${validation.missing.join(', ')}`,
      );
    }

    // Load all defined secrets
    for (const [key, metadata] of Object.entries(SECRET_DEFINITIONS)) {
      if (metadata.environment.includes(environment)) {
        const value = await this.getSecret(key);
        if (value) {
          // Transform value if needed
          const transformedValue = metadata.transform ? metadata.transform(value) : value;
          process.env[key] = transformedValue;
        }
      }
    }

    console.log('✅ Secrets loaded successfully');
  }

  /**
   * Generate a secure secret (useful for development)
   */
  static generateSecret(length: number = 64): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let result = '';

    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    return result;
  }

  /**
   * Hash a secret for logging/comparison (never log actual secrets)
   */
  static hashSecret(secret: string): string {
    return createHash('sha256').update(secret).digest('hex').substring(0, 8);
  }

  /**
   * Clear the cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
}

// Singleton instance
let secretManagerInstance: SecretManager | null = null;

/**
 * Get the global secret manager instance
 */
export function getSecretManager(): SecretManager {
  if (!secretManagerInstance) {
    secretManagerInstance = new SecretManager();
  }
  return secretManagerInstance;
}

/**
 * Initialize secrets for the application
 */
export async function initializeSecrets(environment?: string): Promise<void> {
  const env = environment || process.env.NODE_ENV || 'development';
  const secretManager = getSecretManager();

  try {
    await secretManager.loadSecrets(env);
  } catch (error) {
    console.error('Failed to initialize secrets:', error);
    if (env === 'production') {
      // Fail hard in production
      process.exit(1);
    }
    // In development/test, continue with warnings
    console.warn('Continuing without all secrets loaded (non-production environment)');
  }
}

// Export for convenience
export { SecretProvider };
export default SecretManager;
