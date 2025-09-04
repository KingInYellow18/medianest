export declare const APP_NAME = "MediaNest";
export declare const APP_VERSION = "1.0.0";
export * from './events';
export * from './api';
export declare const RATE_LIMITS: {
    readonly GENERAL_API: {
        readonly windowMs: number;
        readonly max: 100;
        readonly keyPrefix: "rate:api:";
    };
    readonly YOUTUBE_DOWNLOAD: {
        readonly windowMs: number;
        readonly max: 5;
        readonly keyPrefix: "rate:youtube:";
    };
    readonly MEDIA_REQUEST: {
        readonly windowMs: number;
        readonly max: 20;
        readonly keyPrefix: "rate:media:";
    };
    readonly AUTH: {
        readonly windowMs: number;
        readonly max: 5;
        readonly keyPrefix: "rate:auth:";
    };
};
export declare const SERVICES: {
    readonly PLEX: "Plex";
    readonly OVERSEERR: "Overseerr";
    readonly UPTIME_KUMA: "Uptime Kuma";
    readonly YOUTUBE_DL: "YouTube Downloader";
};
export declare const ERROR_CODES: {
    readonly AUTHENTICATION_FAILED: "AUTH_001";
    readonly UNAUTHORIZED: "AUTH_002";
    readonly RATE_LIMIT_EXCEEDED: "RATE_001";
    readonly SERVICE_UNAVAILABLE: "SERVICE_001";
    readonly VALIDATION_ERROR: "VAL_001";
    readonly INTERNAL_ERROR: "INT_001";
};
//# sourceMappingURL=index.d.ts.map