// API endpoint constants

export const API_VERSION = 'v1';

export const API_ENDPOINTS = {
  // Authentication
  AUTH: {
    LOGIN: '/auth/login',
    LOGOUT: '/auth/logout',
    REFRESH: '/auth/refresh',
    VERIFY: '/auth/verify',
    PLEX_PIN: '/auth/plex/pin',
    PLEX_CALLBACK: '/auth/plex/callback',
  },

  // User management
  USERS: {
    BASE: '/users',
    ME: '/users/me',
    BY_ID: (id: string) => `/users/${id}`,
    UPDATE: (id: string) => `/users/${id}`,
    DELETE: (id: string) => `/users/${id}`,
    PREFERENCES: '/users/me/preferences',
  },

  // Media
  MEDIA: {
    SEARCH: '/media/search',
    DETAILS: (type: string, id: string) => `/media/${type}/${id}`,
    REQUEST: '/media/request',
    POPULAR: '/media/popular',
    TRENDING: '/media/trending',
  },

  // Requests
  REQUESTS: {
    BASE: '/requests',
    MY_REQUESTS: '/requests/me',
    BY_ID: (id: string) => `/requests/${id}`,
    APPROVE: (id: string) => `/requests/${id}/approve`,
    DENY: (id: string) => `/requests/${id}/deny`,
    CANCEL: (id: string) => `/requests/${id}/cancel`,
  },

  // Services
  SERVICES: {
    STATUS: '/services/status',
    BY_NAME: (name: string) => `/services/${name}`,
    CONFIGURE: (name: string) => `/services/${name}/configure`,
    TEST: (name: string) => `/services/${name}/test`,
    REFRESH: (name: string) => `/services/${name}/refresh`,
  },

  // Dashboard
  DASHBOARD: {
    STATUS: '/dashboard/status',
    STATS: '/dashboard/stats',
    RECENT_ACTIVITY: '/dashboard/activity',
  },

  // Downloads
  DOWNLOADS: {
    YOUTUBE: '/downloads/youtube',
    STATUS: (id: string) => `/downloads/${id}`,
    CANCEL: (id: string) => `/downloads/${id}/cancel`,
    HISTORY: '/downloads/history',
  },

  // Admin
  ADMIN: {
    SETTINGS: '/admin/settings',
    LOGS: '/admin/logs',
    METRICS: '/admin/metrics',
    SYSTEM: '/admin/system',
    MAINTENANCE: '/admin/maintenance',
  },

  // Health
  HEALTH: '/health',
  READY: '/ready',
} as const;

/**
 * Build full API URL
 */
export function buildApiUrl(endpoint: string, baseUrl?: string): string {
  const base = baseUrl || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
  return `${base}/api/${API_VERSION}${endpoint}`;
}
