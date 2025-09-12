import { config } from 'dotenv';
import { resolve, join } from 'path';
import { existsSync } from 'fs';
import { EnvironmentLoader, validateEnvironment, type EnvironmentConfig } from './env-validator';
import { initializeSecrets } from './secret-manager';

/**
 * Environment Configuration Loader
 * Handles loading environment files and initializing configuration
 */

export interface EnvLoadOptions {
  environment?: string;
  override?: boolean;
  debug?: boolean;
  secretsEnabled?: boolean;
  configPath?: string;
}

/**
 * Load environment configuration with proper precedence
 *
 * Loading order (higher priority first):
 * 1. Process environment variables
 * 2. .env.local (local overrides, never committed)
 * 3. .env.{environment} (environment-specific)
 * 4. .env (default fallback)
 */
export async function loadEnvironment(options: EnvLoadOptions = {}): Promise<EnvironmentConfig> {
  const {
    environment = process.env.NODE_ENV || 'development',
    override = true,
    debug = false,
    secretsEnabled = true,
    configPath = './config/environments',
  } = options;

  if (debug) {
    console.log(`⚙️ Loading environment configuration for: ${environment}`);
  }

  // Define environment file paths in loading order
  const envFiles = [
    join(configPath, '.env'), // Base configuration
    join(configPath, `.env.${environment}`), // Environment-specific
    join(configPath, '.env.local'), // Local overrides
  ];

  // Load environment files
  const loadedFiles: string[] = [];

  for (const envFile of envFiles) {
    if (existsSync(envFile)) {
      const result = config({
        path: resolve(envFile),
        override,
        debug,
      });

      if (result.error) {
        console.warn(`⚠️ Failed to load ${envFile}:`, result.error.message);
      } else {
        loadedFiles.push(envFile);
        if (debug) {
          console.log(`✅ Loaded: ${envFile}`);
        }
      }
    } else if (debug) {
      console.log(`ℹ️ Not found: ${envFile}`);
    }
  }

  if (loadedFiles.length === 0) {
    console.warn('⚠️ No environment files found, using process environment only');
  }

  // Initialize secrets if enabled
  if (secretsEnabled) {
    try {
      await initializeSecrets(environment);
    } catch (error) {
      if (environment === 'production') {
        throw new Error(`Failed to initialize secrets in production: ${error}`);
      }
      console.warn(`⚠️ Failed to initialize secrets (continuing): ${error}`);
    }
  }

  // Load and validate configuration
  const envLoader = EnvironmentLoader.getInstance();
  const config = envLoader.load(process.env);

  if (debug) {
    console.log(`✅ Environment configuration loaded successfully`);
    console.log(`   Environment: ${config.NODE_ENV}`);
    console.log(`   Backend Port: ${config.MEDIANEST_BACKEND_PORT}`);
    console.log(`   Frontend Port: ${config.MEDIANEST_FRONTEND_PORT}`);
    console.log(`   Database: ${config.DATABASE_URL ? 'Configured' : 'Not configured'}`);
    console.log(`   Redis: ${config.REDIS_URL ? 'Configured' : 'Not configured'}`);
    console.log(`   Files loaded: ${loadedFiles.length}`);
  }

  return config;
}

/**
 * Get environment file paths for a specific environment
 */
export function getEnvironmentFiles(
  environment: string,
  configPath: string = './config/environments',
): string[] {
  return [
    join(configPath, '.env'),
    join(configPath, `.env.${environment}`),
    join(configPath, '.env.local'),
  ];
}

/**
 * Check which environment files exist
 */
export function checkEnvironmentFiles(
  environment: string,
  configPath: string = './config/environments',
): {
  files: Array<{ path: string; exists: boolean; readable?: boolean }>;
  missing: string[];
  available: string[];
} {
  const files = getEnvironmentFiles(environment, configPath);
  const result = {
    files: [] as Array<{ path: string; exists: boolean; readable?: boolean }>,
    missing: [] as string[],
    available: [] as string[],
  };

  for (const file of files) {
    const exists = existsSync(file);
    let readable = false;

    if (exists) {
      try {
        // Try to read the file to check accessibility
        require('fs').accessSync(file, require('fs').constants.R_OK);
        readable = true;
      } catch {
        readable = false;
      }
    }

    result.files.push({ path: file, exists, readable });

    if (exists && readable) {
      result.available.push(file);
    } else {
      result.missing.push(file);
    }
  }

  return result;
}

/**
 * Create a sample .env.local file for development
 */
export function createSampleLocalEnv(
  environment: string = 'development',
  configPath: string = './config/environments',
): string {
  const sampleContent = `# Local Environment Overrides for ${environment}
# This file is for local development only and should never be committed
# Copy from .env.template and customize as needed

# Override any configuration from .env.${environment}
# Examples:

# Database override for local development
# DATABASE_URL=postgresql://your_user:your_password@localhost:5432/your_local_db

# Redis override for local development  
# REDIS_URL=redis://localhost:6379

# Custom ports
# MEDIANEST_BACKEND_PORT=4001
# MEDIANEST_FRONTEND_PORT=3001

# Local secrets (use secure values in production)
# JWT_SECRET=your-local-jwt-secret-for-development-only
# SESSION_SECRET=your-local-session-secret-for-development-only

# Development tools
# DEBUG_ENABLED=true
# LOG_LEVEL=debug

# Local storage path
# STORAGE_LOCAL_PATH=./local-uploads

# Email testing (use services like MailHog, Ethereal, etc.)
# EMAIL_PROVIDER=mock
# EMAIL_FROM=dev@localhost
`;

  return sampleContent;
}

/**
 * Development helper to display current configuration
 */
export function displayEnvironmentInfo(config?: EnvironmentConfig): void {
  const env = config || EnvironmentLoader.getInstance().getConfig();

  console.log('\n📄 Environment Configuration');
  console.log('='.repeat(50));
  console.log(`Environment: ${env.NODE_ENV}`);
  console.log(`App: ${env.APP_NAME} v${env.APP_VERSION}`);
  console.log('');

  console.log('🔌 Server Configuration');
  console.log(`Backend: ${env.MEDIANEST_BACKEND_HOST}:${env.MEDIANEST_BACKEND_PORT}`);
  console.log(`Frontend: ${env.MEDIANEST_FRONTEND_HOST}:${env.MEDIANEST_FRONTEND_PORT}`);
  console.log(`API Prefix: ${env.BACKEND_API_PREFIX}`);
  console.log(`CORS Origin: ${env.CORS_ORIGIN}`);
  console.log('');

  console.log('📊 Database & Cache');
  console.log(`Database: ${env.DATABASE_URL ? '✅ Configured' : '❌ Not configured'}`);
  console.log(`Redis: ${env.REDIS_URL ? '✅ Configured' : '❌ Not configured'}`);
  console.log(`DB SSL: ${env.DB_SSL ? 'Enabled' : 'Disabled'}`);
  console.log(`DB Pool: ${env.DB_POOL_MIN}-${env.DB_POOL_MAX} connections`);
  console.log('');

  console.log('🔒 Security');
  console.log(`JWT Expiry: ${env.JWT_EXPIRE_IN}`);
  console.log(`Session Secure: ${env.SESSION_SECURE}`);
  console.log(`Helmet: ${env.SECURITY_HELMET_ENABLED ? 'Enabled' : 'Disabled'}`);
  console.log(`Rate Limiting: ${env.SECURITY_RATE_LIMIT_ENABLED ? 'Enabled' : 'Disabled'}`);
  console.log(`BCrypt Rounds: ${env.BCRYPT_ROUNDS}`);
  console.log('');

  console.log('📝 Logging & Monitoring');
  console.log(`Log Level: ${env.LOG_LEVEL}`);
  console.log(`Log Format: ${env.LOG_FORMAT}`);
  console.log(`Metrics: ${env.METRICS_ENABLED ? 'Enabled' : 'Disabled'}`);
  console.log(`APM: ${env.APM_ENABLED ? 'Enabled' : 'Disabled'}`);
  console.log('');

  console.log('📧 External Services');
  console.log(`Email Provider: ${env.EMAIL_PROVIDER}`);
  console.log(`Storage Provider: ${env.STORAGE_PROVIDER}`);
  console.log('');

  if (env.NODE_ENV === 'development') {
    console.log('🛠️ Development Tools');
    console.log(`Debug: ${env.DEBUG_ENABLED ? 'Enabled' : 'Disabled'}`);
    console.log(`Watch Mode: ${env.WATCH_MODE ? 'Enabled' : 'Disabled'}`);
    console.log(`Auto Restart: ${env.AUTO_RESTART ? 'Enabled' : 'Disabled'}`);
    console.log('');
  }

  console.log('='.repeat(50));
  console.log('');
}

/**
 * Validate environment setup and provide recommendations
 */
export async function validateEnvironmentSetup(environment: string): Promise<{
  valid: boolean;
  errors: string[];
  warnings: string[];
  recommendations: string[];
}> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const recommendations: string[] = [];

  // Check file availability
  const fileCheck = checkEnvironmentFiles(environment);

  if (fileCheck.available.length === 0) {
    errors.push('No readable environment files found');
    recommendations.push(`Create .env.${environment} file from .env.template`);
  }

  // Check for .env.local in non-production environments
  if (environment !== 'production') {
    const localEnvExists = fileCheck.files.find((f) => f.path.includes('.env.local'))?.exists;
    if (!localEnvExists) {
      recommendations.push('Consider creating .env.local for local overrides');
    }
  }

  // Environment-specific validations
  switch (environment) {
    case 'production':
      recommendations.push('Ensure secrets are provided via secure secret management');
      recommendations.push('Verify SSL/HTTPS configuration');
      recommendations.push('Enable monitoring and APM');
      break;

    case 'test':
      recommendations.push('Use separate test database and Redis instances');
      recommendations.push('Configure faster bcrypt rounds for testing');
      break;

    case 'development':
      recommendations.push('Enable development tools for better debugging');
      recommendations.push('Consider using local database and Redis');
      break;
  }

  // Try to load configuration to catch validation errors
  try {
    await loadEnvironment({ environment, debug: false });
  } catch (error) {
    errors.push(`Configuration validation failed: ${error}`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    recommendations,
  };
}

// Default export for the main loading function
export default loadEnvironment;
