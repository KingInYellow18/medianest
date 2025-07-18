import { readFileSync, existsSync } from 'fs';
import path from 'path';

/**
 * Reads a secret from Docker secrets or falls back to environment variable
 * @param secretName - Name of the secret file
 * @param envVar - Environment variable name to fall back to
 * @param defaultValue - Default value if neither secret nor env var exists
 * @returns The secret value
 */
export function readSecret(
  secretName: string,
  envVar: string,
  defaultValue = ''
): string {
  // Check if we should use Docker secrets
  const useDockerSecrets = process.env.USE_DOCKER_SECRETS === 'true';
  const secretsPath = process.env.DOCKER_SECRETS_PATH || '/run/secrets';

  if (useDockerSecrets) {
    const secretPath = path.join(secretsPath, secretName);
    
    // Check if secret file exists
    if (existsSync(secretPath)) {
      try {
        const secret = readFileSync(secretPath, 'utf8').trim();
        if (secret) {
          return secret;
        }
      } catch (error) {
        console.warn(`Failed to read secret ${secretName}:`, error);
      }
    }
  }

  // Fall back to environment variable
  return process.env[envVar] || defaultValue;
}

/**
 * Reads a secret from a file path specified in an environment variable
 * @param envVar - Environment variable containing the file path
 * @param defaultValue - Default value if file doesn't exist
 * @returns The secret value
 */
export function readSecretFromFile(
  envVar: string,
  defaultValue = ''
): string {
  const filePath = process.env[envVar];
  
  if (!filePath) {
    // If no file path, check for direct env var without _FILE suffix
    const directEnvVar = envVar.replace(/_FILE$/, '');
    return process.env[directEnvVar] || defaultValue;
  }

  if (existsSync(filePath)) {
    try {
      return readFileSync(filePath, 'utf8').trim();
    } catch (error) {
      console.warn(`Failed to read secret from ${filePath}:`, error);
    }
  }

  return defaultValue;
}

/**
 * Validates that all required secrets are present
 * @param requiredSecrets - Array of required secret configurations
 * @throws Error if any required secrets are missing
 */
export function validateSecrets(
  requiredSecrets: Array<{
    name: string;
    value: string | undefined;
    description: string;
  }>
): void {
  const missingSecrets = requiredSecrets.filter(
    (secret) => !secret.value || secret.value === ''
  );

  if (missingSecrets.length > 0) {
    const errorMessage = [
      'Missing required secrets:',
      ...missingSecrets.map(
        (secret) => `  - ${secret.name}: ${secret.description}`
      ),
    ].join('\n');
    
    throw new Error(errorMessage);
  }
}

/**
 * Masks a secret value for logging (shows first and last 4 chars)
 * @param secret - Secret value to mask
 * @returns Masked secret
 */
export function maskSecret(secret: string): string {
  if (!secret || secret.length < 12) {
    return '***';
  }
  
  return `${secret.slice(0, 4)}...${secret.slice(-4)}`;
}

/**
 * Checks if running in production mode with Docker secrets
 * @returns True if using Docker secrets in production
 */
export function isUsingDockerSecrets(): boolean {
  return (
    process.env.NODE_ENV === 'production' &&
    process.env.USE_DOCKER_SECRETS === 'true'
  );
}