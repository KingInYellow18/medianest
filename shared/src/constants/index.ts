/**
 * Shared constants for MediaNest
 */

// Re-export from specific modules
export * from './api';
export * from './events';

// Rate limiting constants
export const RATE_LIMITS = {
  DEFAULT: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
  },
  AUTH: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // limit each IP to 5 login attempts per windowMs
  },
  MEDIA: {
    windowMs: 60 * 1000, // 1 minute
    max: 30, // limit each IP to 30 media requests per minute
  },
} as const;

// Service constants
export const SERVICES = {
  SONARR: 'sonarr',
  RADARR: 'radarr',
  OVERSEERR: 'overseerr',
  PLEX: 'plex',
  TAUTULLI: 'tautulli',
} as const;

// Error codes
export const ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  BAD_REQUEST: 'BAD_REQUEST',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

// Legacy constants for backward compatibility
export const API_ENDPOINTS = {
  AUTH: '/api/auth',
  MEDIA: '/api/media',
  USERS: '/api/users',
  HEALTH: '/api/health',
};

export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  INTERNAL_SERVER_ERROR: 500,
};

export const USER_ROLES = {
  ADMIN: 'ADMIN' as const,
  USER: 'USER' as const,
};

export const MEDIA_TYPES = {
  MOVIE: 'movie' as const,
  TV: 'tv' as const,
  MUSIC: 'music' as const,
};
