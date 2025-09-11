/**
 * 🔐 SECURE SECRET MANAGEMENT
 *
 * Production-grade secret management with rotation support
 * and environment-aware configuration loading
 */

import { readFileSync } from 'fs';
import { join } from 'path';

interface SecretConfig {
  JWT_SECRET: string;
  NEXTAUTH_SECRET: string;
  ENCRYPTION_KEY: string;
  DATABASE_PASSWORD?: string;
  REDIS_PASSWORD?: string;
  PLEX_CLIENT_SECRET?: string;
}

class SecureSecretManager {
  private static instance: SecureSecretManager;
  private secrets: SecretConfig | null = null;
  private readonly useDockerSecrets: boolean;
  private readonly secretsPath: string;

  private constructor() {
    this.useDockerSecrets = process.env.USE_DOCKER_SECRETS === 'true';
    this.secretsPath = process.env.DOCKER_SECRETS_PATH || '/run/secrets';
  }

  static getInstance(): SecureSecretManager {
    if (!SecureSecretManager.instance) {
      SecureSecretManager.instance = new SecureSecretManager();
    }
    return SecureSecretManager.instance;
  }

  /**
   * Load secrets from Docker secrets or environment variables
   */
  loadSecrets(): SecretConfig {
    if (this.secrets) {
      return this.secrets;
    }

    const config: SecretConfig = {
      JWT_SECRET: this.getSecret('JWT_SECRET', 'jwt_secret'),
      NEXTAUTH_SECRET: this.getSecret('NEXTAUTH_SECRET', 'nextauth_secret'),
      ENCRYPTION_KEY: this.getSecret('ENCRYPTION_KEY', 'encryption_key'),
    };

    // Optional secrets
    config.DATABASE_PASSWORD = this.getSecret('POSTGRES_PASSWORD', 'postgres_password', false);
    config.REDIS_PASSWORD = this.getSecret('REDIS_PASSWORD', 'redis_password', false);
    config.PLEX_CLIENT_SECRET = this.getSecret('PLEX_CLIENT_SECRET', 'plex_client_secret', false);

    this.validateSecrets(config);
    this.secrets = config;

    return config;
  }

  /**
   * Get a secret from Docker secrets file or environment variable
   */
  private getSecret(envVar: string, secretFile: string, required = true): string {
    // Try Docker secrets first
    if (this.useDockerSecrets) {
      try {
        const secretPath = join(this.secretsPath, secretFile);
        const secret = readFileSync(secretPath, 'utf8').trim();
        if (secret) {
          return secret;
        }
      } catch (error) {
        if (required) {
          console.warn(`Failed to read Docker secret: ${secretFile}`);
        }
      }
    }

    // Fallback to environment variable
    const envValue = process.env[envVar];
    if (!envValue && required) {
      throw new Error(`Missing required secret: ${envVar}`);
    }

    return envValue || '';
  }

  /**
   * Validate that all required secrets meet security requirements
   */
  private validateSecrets(config: SecretConfig): void {
    const requiredSecrets = ['JWT_SECRET', 'NEXTAUTH_SECRET', 'ENCRYPTION_KEY'] as const;

    for (const key of requiredSecrets) {
      const secret = config[key];

      if (!secret) {
        throw new Error(`Missing required secret: ${key}`);
      }

      if (secret.length < 32) {
        throw new Error(`Secret ${key} must be at least 32 characters long`);
      }

      // Check for development/placeholder values
      const insecurePatterns = [
        'your-secret',
        'changeme',
        'development',
        'test-secret',
        'placeholder',
      ];

      if (insecurePatterns.some((pattern) => secret.toLowerCase().includes(pattern))) {
        throw new Error(`Insecure secret detected for ${key}. Please generate a proper secret.`);
      }
    }
  }

  /**
   * Get JWT secret with rotation support
   */
  getJWTSecret(): string {
    return this.loadSecrets().JWT_SECRET;
  }

  /**
   * Get NextAuth secret
   */
  getNextAuthSecret(): string {
    return this.loadSecrets().NEXTAUTH_SECRET;
  }

  /**
   * Get encryption key
   */
  getEncryptionKey(): string {
    return this.loadSecrets().ENCRYPTION_KEY;
  }

  /**
   * Force reload secrets (for rotation scenarios)
   */
  reloadSecrets(): void {
    this.secrets = null;
    this.loadSecrets();
  }

  /**
   * Check if running in production environment
   */
  isProduction(): boolean {
    return process.env.NODE_ENV === 'production';
  }

  /**
   * Validate environment security configuration
   */
  validateEnvironmentSecurity(): { valid: boolean; issues: string[] } {
    const issues: string[] = [];

    if (this.isProduction()) {
      if (!this.useDockerSecrets && !process.env.JWT_SECRET) {
        issues.push(
          'Production environment should use Docker secrets or secure environment variables',
        );
      }

      if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 64) {
        issues.push('Production JWT secret should be at least 64 characters');
      }

      // Check for development flags that shouldn't be in production
      const dangerousFlags = [
        'JWT_SKIP_VERIFICATION',
        'AUTH_BYPASS',
        'SKIP_AUTH_CHECK',
        'DISABLE_SECURITY',
      ];

      for (const flag of dangerousFlags) {
        if (process.env[flag] === 'true') {
          issues.push(`Dangerous flag ${flag} is enabled in production`);
        }
      }
    }

    return {
      valid: issues.length === 0,
      issues,
    };
  }
}

// Export singleton instance
export const secretManager = SecureSecretManager.getInstance();
export default secretManager;
