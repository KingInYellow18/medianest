"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.API_ENDPOINTS = exports.API_VERSION = void 0;
exports.buildApiUrl = buildApiUrl;
exports.API_VERSION = 'v1';
exports.API_ENDPOINTS = {
    AUTH: {
        LOGIN: '/auth/login',
        LOGOUT: '/auth/logout',
        REFRESH: '/auth/refresh',
        VERIFY: '/auth/verify',
        PLEX_PIN: '/auth/plex/pin',
        PLEX_CALLBACK: '/auth/plex/callback',
    },
    USERS: {
        BASE: '/users',
        ME: '/users/me',
        BY_ID: (id) => `/users/${id}`,
        UPDATE: (id) => `/users/${id}`,
        DELETE: (id) => `/users/${id}`,
        PREFERENCES: '/users/me/preferences',
    },
    MEDIA: {
        SEARCH: '/media/search',
        DETAILS: (type, id) => `/media/${type}/${id}`,
        REQUEST: '/media/request',
        POPULAR: '/media/popular',
        TRENDING: '/media/trending',
    },
    REQUESTS: {
        BASE: '/requests',
        MY_REQUESTS: '/requests/me',
        BY_ID: (id) => `/requests/${id}`,
        APPROVE: (id) => `/requests/${id}/approve`,
        DENY: (id) => `/requests/${id}/deny`,
        CANCEL: (id) => `/requests/${id}/cancel`,
    },
    SERVICES: {
        STATUS: '/services/status',
        BY_NAME: (name) => `/services/${name}`,
        CONFIGURE: (name) => `/services/${name}/configure`,
        TEST: (name) => `/services/${name}/test`,
        REFRESH: (name) => `/services/${name}/refresh`,
    },
    DASHBOARD: {
        STATUS: '/dashboard/status',
        STATS: '/dashboard/stats',
        RECENT_ACTIVITY: '/dashboard/activity',
    },
    DOWNLOADS: {
        YOUTUBE: '/downloads/youtube',
        STATUS: (id) => `/downloads/${id}`,
        CANCEL: (id) => `/downloads/${id}/cancel`,
        HISTORY: '/downloads/history',
    },
    ADMIN: {
        SETTINGS: '/admin/settings',
        LOGS: '/admin/logs',
        METRICS: '/admin/metrics',
        SYSTEM: '/admin/system',
        MAINTENANCE: '/admin/maintenance',
    },
    HEALTH: '/health',
    READY: '/ready',
};
function buildApiUrl(endpoint, baseUrl) {
    const base = baseUrl || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
    return `${base}/api/${exports.API_VERSION}${endpoint}`;
}
//# sourceMappingURL=api.js.map