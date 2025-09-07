"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RATE_LIMITS = exports.ERROR_CODES = exports.SOCKET_EVENTS = exports.SERVICES = exports.API_ENDPOINTS = exports.APP_VERSION = exports.APP_NAME = void 0;
exports.APP_NAME = 'MediaNest';
exports.APP_VERSION = '1.0.0';
exports.API_ENDPOINTS = {
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
exports.SERVICES = {
    PLEX: 'plex',
    OVERSEERR: 'overseerr',
    UPTIME_KUMA: 'uptime-kuma',
    YOUTUBE_DL: 'youtube-dl',
};
exports.SOCKET_EVENTS = {
    CONNECTION: 'connection',
    CONNECT: 'connect',
    DISCONNECT: 'disconnect',
    SERVICE_STATUS: 'service:status',
    SERVICE_STATUS_ALL: 'service:status:all',
    REQUEST_UPDATE: 'request:update',
    REQUEST_CREATED: 'request:created',
    DOWNLOAD_PROGRESS: 'download:progress',
    DOWNLOAD_COMPLETE: 'download:complete',
    DOWNLOAD_ERROR: 'download:error',
    USER_NOTIFICATION: 'user:notification',
    NOTIFICATION: 'notification',
};
exports.ERROR_CODES = {
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    INVALID_INPUT: 'INVALID_INPUT',
    MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
    AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
    UNAUTHORIZED: 'UNAUTHORIZED',
    TOKEN_EXPIRED: 'TOKEN_EXPIRED',
    INVALID_TOKEN: 'INVALID_TOKEN',
    AUTHORIZATION_ERROR: 'AUTHORIZATION_ERROR',
    FORBIDDEN: 'FORBIDDEN',
    INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
    NOT_FOUND: 'NOT_FOUND',
    CONFLICT: 'CONFLICT',
    RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
    INTERNAL_ERROR: 'INTERNAL_ERROR',
    SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
    BAD_REQUEST: 'BAD_REQUEST',
};
exports.RATE_LIMITS = {
    API: {
        windowMs: 60000,
        max: 100,
        keyPrefix: 'rate:api:',
    },
    AUTH: {
        windowMs: 900000,
        max: 5,
        keyPrefix: 'rate:auth:',
    },
    YOUTUBE: {
        windowMs: 3600000,
        max: 5,
        keyPrefix: 'rate:youtube:',
    },
    MEDIA_REQUEST: {
        windowMs: 3600000,
        max: 20,
        keyPrefix: 'rate:request:',
    },
};
//# sourceMappingURL=index.js.map