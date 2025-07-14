// Shared constants for MediaNest

export const APP_NAME = 'MediaNest';
export const APP_VERSION = '1.0.0';

// Re-export constants from specific modules
export * from './events';
export * from './api';

// Rate limiting constants
export const RATE_LIMITS = {
  GENERAL_API: {
    windowMs: 60 * 1000, // 1 minute
    max: 100, // requests per window
    keyPrefix: 'rate:api:',
  },
  YOUTUBE_DOWNLOAD: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5, // downloads per window
    keyPrefix: 'rate:youtube:',
  },
  MEDIA_REQUEST: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 20, // requests per window
    keyPrefix: 'rate:media:',
  },
  AUTH: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // attempts per window
    keyPrefix: 'rate:auth:',
  },
} as const;

// Service names
export const SERVICES = {
  PLEX: 'Plex',
  OVERSEERR: 'Overseerr',
  UPTIME_KUMA: 'Uptime Kuma',
  YOUTUBE_DL: 'YouTube Downloader',
} as const;

// Error codes
export const ERROR_CODES = {
  AUTHENTICATION_FAILED: 'AUTH_001',
  UNAUTHORIZED: 'AUTH_002',
  RATE_LIMIT_EXCEEDED: 'RATE_001',
  SERVICE_UNAVAILABLE: 'SERVICE_001',
  VALIDATION_ERROR: 'VAL_001',
  INTERNAL_ERROR: 'INT_001',
} as const;
