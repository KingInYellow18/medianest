/**
 * MediaNest Environment Configuration Module
 * Centralized environment management system
 */

// Export all environment configuration utilities
export { default as loadEnvironment } from './env-loader';
export type { EnvLoadOptions } from './env-loader';
export {
  getEnvironmentFiles,
  checkEnvironmentFiles,
  createSampleLocalEnv,
  displayEnvironmentInfo,
  validateEnvironmentSetup,
} from './env-loader';

export {
  validateEnvironment,
  validateProductionSecrets,
  getEnvironmentFilePath,
  EnvironmentLoader,
} from './env-validator';
export type {
  BaseConfig,
  DevelopmentConfig,
  TestConfig,
  ProductionConfig,
  EnvironmentConfig,
} from './env-validator';

export {
  SecretManager,
  getSecretManager,
  initializeSecrets,
  SECRET_DEFINITIONS,
} from './secret-manager';
export type { SecretConfig, SecretMetadata, SecretProvider } from './secret-manager';

/**
 * Quick setup function for applications
 */
export async function setupEnvironment(options?: {
  environment?: string;
  debug?: boolean;
  displayInfo?: boolean;
}) {
  const {
    environment = process.env.NODE_ENV || 'development',
    debug = false,
    displayInfo = false,
  } = options || {};

  try {
    // Load environment configuration
    const config = await loadEnvironment({
      environment,
      debug,
      secretsEnabled: true,
    });

    // Display configuration info if requested
    if (displayInfo) {
      const { displayEnvironmentInfo } = await import('./env-loader');
      displayEnvironmentInfo(config);
    }

    return config;
  } catch (error) {
    console.error('❌ Failed to setup environment:', error);
    throw error;
  }
}

/**
 * Environment configuration constants
 */
export const ENV_CONSTANTS = {
  ENVIRONMENTS: ['development', 'test', 'production'] as const,
  DEFAULT_PORTS: {
    BACKEND: {
      development: 4000,
      test: 4001,
      production: 4000,
    },
    FRONTEND: {
      development: 3000,
      test: 3001,
      production: 3000,
    },
    METRICS: {
      development: 9090,
      test: 9091,
      production: 9090,
    },
  },
  DATABASE_NAMES: {
    development: 'medianest_dev',
    test: 'medianest_test',
    production: 'medianest_prod',
  },
  REDIS_DBS: {
    development: 0,
    test: 1,
    production: 0,
  },
} as const;

/**
 * Helper to check if we're in a specific environment
 */
export const isEnvironment = {
  development: () => process.env.NODE_ENV === 'development',
  test: () => process.env.NODE_ENV === 'test',
  production: () => process.env.NODE_ENV === 'production',
  local: () => process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test',
};

/**
 * Helper to get environment-specific values
 */
export function getEnvValue<T>(
  values: Record<string, T>,
  environment: string = process.env.NODE_ENV || 'development',
): T {
  return values[environment] || values['development'];
}

/**
 * Development helper to create environment files
 */
export async function createEnvironmentFiles(targetEnvironment?: string): Promise<void> {
  const { writeFileSync, existsSync } = await import('fs');
  const { join } = await import('path');
  const { createSampleLocalEnv } = await import('./env-loader');

  const environment = targetEnvironment || process.env.NODE_ENV || 'development';
  const configPath = './config/environments';

  // Create .env.local if it doesn't exist
  const localEnvPath = join(configPath, '.env.local');
  if (!existsSync(localEnvPath)) {
    const sampleContent = createSampleLocalEnv(environment, configPath);
    writeFileSync(localEnvPath, sampleContent);
    console.log(`✅ Created ${localEnvPath}`);
  } else {
    console.log(`ℹ️ ${localEnvPath} already exists`);
  }

  // Add .env.local to .gitignore if not present
  const gitignorePath = './.gitignore';
  if (existsSync(gitignorePath)) {
    const { readFileSync } = await import('fs');
    const gitignoreContent = readFileSync(gitignorePath, 'utf8');

    if (!gitignoreContent.includes('.env.local')) {
      const updatedContent = gitignoreContent + '\n# Local environment overrides\n.env.local\n';
      writeFileSync(gitignorePath, updatedContent);
      console.log('✅ Added .env.local to .gitignore');
    }
  }
}

// Re-export main types for convenience
export type Environment = (typeof ENV_CONSTANTS.ENVIRONMENTS)[number];
