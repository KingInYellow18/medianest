import { readSecret, readSecretFromFile, validateSecrets } from './secrets';

// Read configuration from Docker secrets or environment variables
export const env = {
  // Database additional settings
  DATABASE_POOL_SIZE: parseInt(process.env.DATABASE_POOL_SIZE || '10', 10),
  DATABASE_TIMEOUT: parseInt(process.env.DATABASE_TIMEOUT || '30000', 10),

  // Redis settings
  REDIS_HOST: process.env.REDIS_HOST || 'localhost',
  REDIS_PORT: parseInt(process.env.REDIS_PORT || '6379', 10),
  REDIS_PASSWORD: process.env.REDIS_PASSWORD,

  // Auth settings
  AUTH_COOKIE_NAME: process.env.AUTH_COOKIE_NAME || 'auth-token',
  AUTH_COOKIE_DOMAIN: process.env.AUTH_COOKIE_DOMAIN,
  AUTH_COOKIE_SECURE: process.env.NODE_ENV === 'production',
  AUTH_COOKIE_HTTP_ONLY: true,
  AUTH_COOKIE_SAME_SITE: 'strict' as const,

  // Session settings
  SESSION_SECRET: readSecret('session_secret', 'SESSION_SECRET', 'dev-session'),
  SESSION_COOKIE_MAX_AGE: parseInt(process.env.SESSION_COOKIE_MAX_AGE || '86400000', 10),
  SESSION_ROLLING: process.env.SESSION_ROLLING === 'true',
  SESSION_SAVE_UNINITIALIZED: false,
  SESSION_RESAVE: false,

  // Email settings
  SMTP_HOST: process.env.SMTP_HOST,
  SMTP_PORT: parseInt(process.env.SMTP_PORT || '587', 10),
  SMTP_SECURE: process.env.SMTP_SECURE === 'true',
  SMTP_USER: process.env.SMTP_USER,
  SMTP_PASS: readSecret('smtp_password', 'SMTP_PASS', ''),
  EMAIL_FROM: process.env.EMAIL_FROM || 'noreply@medianest.com',
  EMAIL_FROM_NAME: process.env.EMAIL_FROM_NAME || 'MediaNest',

  // Security settings
  BCRYPT_ROUNDS: parseInt(process.env.BCRYPT_ROUNDS || '12', 10),
  PASSWORD_MIN_LENGTH: parseInt(process.env.PASSWORD_MIN_LENGTH || '8', 10),
  MAX_LOGIN_ATTEMPTS: parseInt(process.env.MAX_LOGIN_ATTEMPTS || '5', 10),
  LOCKOUT_TIME: parseInt(process.env.LOCKOUT_TIME || '1800000', 10), // 30 minutes

  // Feature flags
  ENABLE_REGISTRATION: process.env.ENABLE_REGISTRATION !== 'false',
  ENABLE_EMAIL_VERIFICATION: process.env.ENABLE_EMAIL_VERIFICATION === 'true',
  ENABLE_TWO_FACTOR_AUTH: process.env.ENABLE_TWO_FACTOR_AUTH === 'true',
  ENABLE_PASSWORD_RESET: process.env.ENABLE_PASSWORD_RESET !== 'false',

  // Monitoring and logging
  ENABLE_REQUEST_LOGGING: process.env.ENABLE_REQUEST_LOGGING !== 'false',
  LOG_REQUESTS: process.env.LOG_REQUESTS === 'true',
  LOG_ERRORS: process.env.LOG_ERRORS !== 'false',

  // External services
  YOUTUBE_API_KEY: readSecret('youtube_api_key', 'YOUTUBE_API_KEY', ''),
  TMDB_API_KEY: readSecret('tmdb_api_key', 'TMDB_API_KEY', ''),

  // Error reporting
  ERROR_REPORTING_ENABLED: process.env.ERROR_REPORTING_ENABLED === 'true',
  ERROR_REPORTING_ENDPOINT: process.env.ERROR_REPORTING_ENDPOINT,
  // Application settings
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '4000', 10),
  HOST: process.env.HOST || 'localhost',
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:3000',

  // Database configuration
  DATABASE_URL: readSecretFromFile('DATABASE_URL_FILE', process.env.DATABASE_URL || ''),

  // Redis configuration
  REDIS_URL: readSecretFromFile(
    'REDIS_URL_FILE',
    process.env.REDIS_URL || 'redis://localhost:6379',
  ),

  // JWT configuration
  JWT_SECRET: readSecret('jwt_secret', 'JWT_SECRET', 'dev-secret'),
  JWT_ISSUER: process.env.JWT_ISSUER || 'medianest',
  JWT_AUDIENCE: process.env.JWT_AUDIENCE || 'medianest-users',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',

  // Encryption
  ENCRYPTION_KEY: readSecret('encryption_key', 'ENCRYPTION_KEY', ''),

  // Plex OAuth
  PLEX_CLIENT_ID: readSecret('plex_client_id', 'PLEX_CLIENT_ID', ''),
  PLEX_CLIENT_SECRET: readSecret('plex_client_secret', 'PLEX_CLIENT_SECRET', ''),

  // Plex configuration
  plex: {
    serverUrl: process.env.PLEX_SERVER_URL,
    clientId: readSecret('plex_client_id', 'PLEX_CLIENT_ID', ''),
    clientSecret: readSecret('plex_client_secret', 'PLEX_CLIENT_SECRET', ''),
  },

  // NextAuth
  NEXTAUTH_SECRET: readSecret('nextauth_secret', 'NEXTAUTH_SECRET', ''),

  // Logging
  LOG_LEVEL: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),

  // Rate limiting
  RATE_LIMIT_API_REQUESTS: parseInt(process.env.RATE_LIMIT_API_REQUESTS || '100', 10),
  RATE_LIMIT_API_WINDOW: parseInt(process.env.RATE_LIMIT_API_WINDOW || '60', 10),
  RATE_LIMIT_YOUTUBE_REQUESTS: parseInt(process.env.RATE_LIMIT_YOUTUBE_REQUESTS || '5', 10),
  RATE_LIMIT_YOUTUBE_WINDOW: parseInt(process.env.RATE_LIMIT_YOUTUBE_WINDOW || '3600', 10),

  // Docker secrets configuration
  USE_DOCKER_SECRETS: process.env.USE_DOCKER_SECRETS === 'true',
  DOCKER_SECRETS_PATH: process.env.DOCKER_SECRETS_PATH || '/run/secrets',
};

// Validate required secrets in production
if (env.NODE_ENV === 'production') {
  validateSecrets([
    {
      name: 'DATABASE_URL',
      value: env.DATABASE_URL,
      description: 'PostgreSQL connection string',
    },
    {
      name: 'JWT_SECRET',
      value: env.JWT_SECRET,
      description: 'JWT signing secret',
    },
    {
      name: 'ENCRYPTION_KEY',
      value: env.ENCRYPTION_KEY,
      description: 'AES-256-GCM encryption key',
    },
    {
      name: 'PLEX_CLIENT_ID',
      value: env.PLEX_CLIENT_ID,
      description: 'Plex OAuth client ID',
    },
    {
      name: 'PLEX_CLIENT_SECRET',
      value: env.PLEX_CLIENT_SECRET,
      description: 'Plex OAuth client secret',
    },
  ]);
}
