import { readSecret, readSecretFromFile, validateSecrets } from './secrets';

// Read configuration from Docker secrets or environment variables
export const env = {
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

  // NextAuth
  NEXTAUTH_SECRET: readSecret('nextauth_secret', 'NEXTAUTH_SECRET', ''),

  // Webhook secrets
  OVERSEERR_WEBHOOK_SECRET: readSecret('overseerr_webhook_secret', 'OVERSEERR_WEBHOOK_SECRET', ''),

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
