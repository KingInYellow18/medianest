"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ERROR_CODES = exports.SERVICES = exports.RATE_LIMITS = exports.APP_VERSION = exports.APP_NAME = void 0;
exports.APP_NAME = 'MediaNest';
exports.APP_VERSION = '1.0.0';
exports.RATE_LIMITS = {
    GENERAL_API: {
        windowMs: 60 * 1000,
        max: 100,
    },
    YOUTUBE_DOWNLOAD: {
        windowMs: 60 * 60 * 1000,
        max: 5,
    },
    MEDIA_REQUEST: {
        windowMs: 60 * 60 * 1000,
        max: 20,
    },
};
exports.SERVICES = {
    PLEX: 'Plex',
    OVERSEERR: 'Overseerr',
    UPTIME_KUMA: 'Uptime Kuma',
    YOUTUBE_DL: 'YouTube Downloader',
};
exports.ERROR_CODES = {
    AUTHENTICATION_FAILED: 'AUTH_001',
    UNAUTHORIZED: 'AUTH_002',
    RATE_LIMIT_EXCEEDED: 'RATE_001',
    SERVICE_UNAVAILABLE: 'SERVICE_001',
    VALIDATION_ERROR: 'VAL_001',
    INTERNAL_ERROR: 'INT_001',
};
//# sourceMappingURL=index.js.map