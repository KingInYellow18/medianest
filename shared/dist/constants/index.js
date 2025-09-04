"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ERROR_CODES = exports.SERVICES = exports.RATE_LIMITS = exports.APP_VERSION = exports.APP_NAME = void 0;
exports.APP_NAME = 'MediaNest';
exports.APP_VERSION = '1.0.0';
__exportStar(require("./events"), exports);
__exportStar(require("./api"), exports);
exports.RATE_LIMITS = {
    GENERAL_API: {
        windowMs: 60 * 1000,
        max: 100,
        keyPrefix: 'rate:api:',
    },
    YOUTUBE_DOWNLOAD: {
        windowMs: 60 * 60 * 1000,
        max: 5,
        keyPrefix: 'rate:youtube:',
    },
    MEDIA_REQUEST: {
        windowMs: 60 * 60 * 1000,
        max: 20,
        keyPrefix: 'rate:media:',
    },
    AUTH: {
        windowMs: 15 * 60 * 1000,
        max: 5,
        keyPrefix: 'rate:auth:',
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