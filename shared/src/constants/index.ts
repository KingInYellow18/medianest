// Shared constants for MediaNest

export const APP_NAME = 'MediaNest';
export const APP_VERSION = '1.0.0';

// API Endpoints with nested structure
export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: '/api/v1/auth/login',
    LOGOUT: '/api/v1/auth/logout',
    SESSION: '/api/v1/auth/session',
    PLEX: {
      PIN: '/api/v1/auth/plex/pin',
      VERIFY: '/api/v1/auth/plex/verify',
    },
  },
  MEDIA: {
    SEARCH: '/api/v1/media/search',
    REQUEST: '/api/v1/media/request',
    REQUESTS: '/api/v1/media/requests',
  },
  SERVICES: {
    BASE: '/api/v1/services',
    STATUS: '/api/v1/services/status',
    CONFIG: '/api/v1/services/config',
  },
  YOUTUBE: {
    VALIDATE: '/api/v1/youtube/validate',
    DOWNLOAD: '/api/v1/youtube/download',
    QUEUE: '/api/v1/youtube/queue',
  },
  USERS: {
    PROFILE: '/api/v1/users/profile',
    PREFERENCES: '/api/v1/users/preferences',
    QUOTA: '/api/v1/users/quota',
  },
};

// Service names (lowercase)
export const SERVICES = {
  PLEX: 'plex',
  OVERSEERR: 'overseerr',
  UPTIME_KUMA: 'uptime-kuma',
  YOUTUBE_DL: 'youtube-dl',
} as const;

// Socket events
export const SOCKET_EVENTS = {
  // Connection events
  CONNECTION: 'connection',
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',

  // Service events
  SERVICE_STATUS: 'service:status',
  SERVICE_STATUS_ALL: 'service:status:all',

  // Request events
  REQUEST_UPDATE: 'request:update',
  REQUEST_CREATED: 'request:created',

  // Download events
  DOWNLOAD_PROGRESS: 'download:progress',
  DOWNLOAD_COMPLETE: 'download:complete',
  DOWNLOAD_ERROR: 'download:error',

  // User events
  USER_NOTIFICATION: 'user:notification',
  NOTIFICATION: 'notification',
};

// Error codes (descriptive format)
export const ERROR_CODES = {
  // Validation errors
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',

  // Authentication errors
  AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  INVALID_TOKEN: 'INVALID_TOKEN',

  // Authorization errors
  AUTHORIZATION_ERROR: 'AUTHORIZATION_ERROR',
  FORBIDDEN: 'FORBIDDEN',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',

  // Resource errors
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',

  // Rate limiting
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',

  // Server errors
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  BAD_REQUEST: 'BAD_REQUEST',
} as const;

// Rate limiting configuration
export const RATE_LIMITS = {
  API: {
    windowMs: 60000, // 1 minute
    max: 100, // 100 requests per minute
    keyPrefix: 'rate:api:',
  },
  AUTH: {
    windowMs: 900000, // 15 minutes
    max: 5, // 5 login attempts per 15 minutes
    keyPrefix: 'rate:auth:',
  },
  YOUTUBE: {
    windowMs: 3600000, // 1 hour
    max: 5, // 5 downloads per hour
    keyPrefix: 'rate:youtube:',
  },
  MEDIA_REQUEST: {
    windowMs: 3600000, // 1 hour
    max: 20, // 20 requests per hour
    keyPrefix: 'rate:request:',
  },
} as const;

// Note: We're not re-exporting from './events' and './api' to avoid conflicts
