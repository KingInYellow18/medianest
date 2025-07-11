import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '4000', 10),
  
  // Database
  database: {
    url: process.env.DATABASE_URL || 'postgresql://user:pass@localhost:5432/medianest'
  },

  // Redis
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379'
  },

  // Authentication
  auth: {
    nextAuthSecret: process.env.NEXTAUTH_SECRET || 'development-secret',
    encryptionKey: process.env.ENCRYPTION_KEY || 'development-encryption-key-32-chars!',
    adminUsername: process.env.ADMIN_USERNAME || 'admin',
    adminPassword: process.env.ADMIN_PASSWORD || 'admin'
  },
  
  // JWT
  jwt: {
    secret: process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET || 'development-secret',
    issuer: 'medianest',
    audience: 'medianest-users'
  },
  
  // Security
  security: {
    encryptionKey: process.env.ENCRYPTION_KEY || 'development-encryption-key-32-chars!'
  },

  // Plex
  plex: {
    clientId: process.env.PLEX_CLIENT_ID || 'medianest',
    clientSecret: process.env.PLEX_CLIENT_SECRET || ''
  },

  // YouTube
  youtube: {
    downloadPath: process.env.YOUTUBE_DOWNLOAD_PATH || '/app/youtube',
    rateLimit: parseInt(process.env.YOUTUBE_RATE_LIMIT || '5', 10)
  },

  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'info'
  }
};