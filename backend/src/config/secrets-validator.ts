/**
 * Secrets Validator
 *
 * Validates all required secrets at application startup.
 * Fails fast with clear error messages if any secrets are missing.
 *
 * Security Requirements:
 * - No hardcoded fallback secrets
 * - Clear error messages for developers
 * - Environment-specific validation
 * - Helpful generation instructions
 */

import { logger } from '../utils/logger';

export interface SecretValidationConfig {
  name: string;
  envVar: string;
  required: boolean;
  description: string;
  generateCommand?: string;
  minLength?: number;
  production?: boolean; // Only required in production
}

export const REQUIRED_SECRETS: SecretValidationConfig[] = [
  {
    name: 'JWT Secret',
    envVar: 'JWT_SECRET',
    required: true,
    description: 'Secret key for signing JWT tokens',
    generateCommand: 'openssl rand -base64 32',
    minLength: 32,
  },
  {
    name: 'Encryption Key',
    envVar: 'ENCRYPTION_KEY',
    required: true,
    description: 'Key for encrypting sensitive data',
    generateCommand: 'openssl rand -base64 32',
    minLength: 32,
  },
  {
    name: 'JWT Rotation Secret',
    envVar: 'JWT_SECRET_ROTATION',
    required: false,
    description: 'Optional secret for JWT key rotation',
    generateCommand: 'openssl rand -base64 32',
    minLength: 32,
  },
  {
    name: 'Database URL',
    envVar: 'DATABASE_URL',
    required: true,
    description: 'PostgreSQL database connection string',
    minLength: 10,
  },
  {
    name: 'Plex Token',
    envVar: 'PLEX_TOKEN',
    required: false,
    description: 'Plex Media Server authentication token',
    minLength: 20,
  },
  {
    name: 'Metrics Token',
    envVar: 'METRICS_TOKEN',
    required: false,
    production: true,
    description: 'Token for protecting metrics endpoint in production',
    generateCommand: 'openssl rand -base64 24',
    minLength: 20,
  },
];

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  missing: string[];
}

/**
 * Validates all required secrets are present and meet minimum requirements
 */
export function validateSecrets(): ValidationResult {
  const result: ValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
    missing: [],
  };

  const isProduction = process.env.NODE_ENV === 'production';

  for (const secret of REQUIRED_SECRETS) {
    const value = process.env[secret.envVar];

    // Check if secret is required
    const isRequired = secret.required || (secret.production && isProduction);

    if (!value) {
      if (isRequired) {
        result.valid = false;
        result.missing.push(secret.envVar);
        result.errors.push(
          `Missing required secret: ${secret.name} (${secret.envVar})\n` +
            `  Description: ${secret.description}\n` +
            (secret.generateCommand ? `  Generate with: ${secret.generateCommand}\n` : '') +
            `  Add to .env: ${secret.envVar}=<your-${secret.envVar.toLowerCase()}>`
        );
      } else {
        result.warnings.push(`Optional secret not set: ${secret.name} (${secret.envVar})`);
      }
      continue;
    }

    // Check minimum length requirements
    if (secret.minLength && value.length < secret.minLength) {
      result.valid = false;
      result.errors.push(
        `Secret too short: ${secret.name} (${secret.envVar})\n` +
          `  Current length: ${value.length} characters\n` +
          `  Required minimum: ${secret.minLength} characters\n` +
          (secret.generateCommand ? `  Generate secure value: ${secret.generateCommand}` : '')
      );
    }

    // Check for obvious test/default values
    if (isProduction && isObviousTestValue(value)) {
      result.valid = false;
      result.errors.push(
        `Production secret appears to be a test value: ${secret.name} (${secret.envVar})\n` +
          `  Please generate a secure production secret\n` +
          (secret.generateCommand ? `  Generate with: ${secret.generateCommand}` : '')
      );
    }
  }

  return result;
}

/**
 * Validates secrets and throws error if validation fails
 * Should be called at application startup
 */
export function validateSecretsOrThrow(): void {
  const result = validateSecrets();

  if (result.warnings.length > 0) {
    for (const warning of result.warnings) {
      logger.warn('Secret validation warning:', warning);
    }
  }

  if (!result.valid) {
    const errorMessage = [
      '❌ SECRET VALIDATION FAILED',
      '',
      'Required secrets are missing or invalid:',
      '',
      ...result.errors.map((error) => `  ${error}`),
      '',
      '📋 Quick Setup:',
      '1. Copy .env.example to .env',
      '2. Generate secrets using the commands above',
      '3. Update your .env file with the generated values',
      '4. Restart the application',
      '',
      '🔒 Security Note:',
      '- Never commit secrets to version control',
      '- Use different secrets for each environment',
      '- Rotate secrets regularly in production',
      '',
    ].join('\n');

    logger.error(errorMessage);
    throw new Error('Secret validation failed - check logs for details');
  }

  logger.info('✅ All required secrets validated successfully', {
    validatedSecrets: REQUIRED_SECRETS.filter(
      (s) => s.required || (s.production && process.env.NODE_ENV === 'production')
    ).map((s) => s.envVar),
    optionalSecrets: REQUIRED_SECRETS.filter(
      (s) => !s.required && !(s.production && process.env.NODE_ENV === 'production')
    )
      .map((s) => s.envVar)
      .filter((envVar) => process.env[envVar]),
  });
}

/**
 * Checks if a value appears to be a test/default value
 */
function isObviousTestValue(value: string): boolean {
  const testPatterns = [
    'test',
    'demo',
    'example',
    'default',
    'changeme',
    'password',
    '123456',
    'secret',
    'development',
    'dev',
  ];

  const lowerValue = value.toLowerCase();
  return testPatterns.some((pattern) => lowerValue.includes(pattern));
}

/**
 * Gets help text for setting up secrets
 */
export function getSecretsSetupHelp(): string {
  return [
    '🔧 MediaNest Secrets Setup Guide',
    '',
    '1. Copy the example environment file:',
    '   cp .env.example .env',
    '',
    '2. Generate required secrets:',
    ...REQUIRED_SECRETS.filter((s) => s.generateCommand).map(
      (s) => `   ${s.envVar}=$(${s.generateCommand})`
    ),
    '',
    '3. Update .env with your values:',
    ...REQUIRED_SECRETS.filter((s) => s.required).map(
      (s) => `   ${s.envVar}=<paste-generated-value>`
    ),
    '',
    '4. Optional configuration:',
    ...REQUIRED_SECRETS.filter((s) => !s.required).map(
      (s) => `   ${s.envVar}=<your-value>  # ${s.description}`
    ),
    '',
    '5. Restart the application',
    '',
    '🔒 Security Reminders:',
    '- Keep .env files out of version control',
    '- Use different secrets for each environment',
    '- Store production secrets securely',
    '- Rotate secrets regularly',
  ].join('\n');
}
