export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '4000', 10),
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:3000',
  DATABASE_URL: process.env.DATABASE_URL || '',
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
  JWT_SECRET: process.env.JWT_SECRET || 'dev-secret',
  JWT_ISSUER: process.env.JWT_ISSUER || 'medianest',
  JWT_AUDIENCE: process.env.JWT_AUDIENCE || 'medianest-users',
  ENCRYPTION_KEY: process.env.ENCRYPTION_KEY || '',
  PLEX_CLIENT_ID: process.env.PLEX_CLIENT_ID || '',
  PLEX_CLIENT_SECRET: process.env.PLEX_CLIENT_SECRET || '',
};
