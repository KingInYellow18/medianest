export declare const APP_NAME = "MediaNest";
export declare const APP_VERSION = "1.0.0";
export declare const API_ENDPOINTS: {
    AUTH: {
        LOGIN: string;
        LOGOUT: string;
        SESSION: string;
        PLEX: {
            PIN: string;
            VERIFY: string;
        };
    };
    MEDIA: {
        SEARCH: string;
        REQUEST: string;
        REQUESTS: string;
    };
    SERVICES: {
        BASE: string;
        STATUS: string;
        CONFIG: string;
    };
    YOUTUBE: {
        VALIDATE: string;
        DOWNLOAD: string;
        QUEUE: string;
    };
    USERS: {
        PROFILE: string;
        PREFERENCES: string;
        QUOTA: string;
    };
};
export declare const SERVICES: {
    readonly PLEX: "plex";
    readonly OVERSEERR: "overseerr";
    readonly UPTIME_KUMA: "uptime-kuma";
    readonly YOUTUBE_DL: "youtube-dl";
};
export declare const SOCKET_EVENTS: {
    CONNECTION: string;
    CONNECT: string;
    DISCONNECT: string;
    SERVICE_STATUS: string;
    SERVICE_STATUS_ALL: string;
    REQUEST_UPDATE: string;
    REQUEST_CREATED: string;
    DOWNLOAD_PROGRESS: string;
    DOWNLOAD_COMPLETE: string;
    DOWNLOAD_ERROR: string;
    USER_NOTIFICATION: string;
    NOTIFICATION: string;
};
export declare const ERROR_CODES: {
    readonly VALIDATION_ERROR: "VALIDATION_ERROR";
    readonly INVALID_INPUT: "INVALID_INPUT";
    readonly MISSING_REQUIRED_FIELD: "MISSING_REQUIRED_FIELD";
    readonly AUTHENTICATION_ERROR: "AUTHENTICATION_ERROR";
    readonly UNAUTHORIZED: "UNAUTHORIZED";
    readonly TOKEN_EXPIRED: "TOKEN_EXPIRED";
    readonly INVALID_TOKEN: "INVALID_TOKEN";
    readonly AUTHORIZATION_ERROR: "AUTHORIZATION_ERROR";
    readonly FORBIDDEN: "FORBIDDEN";
    readonly INSUFFICIENT_PERMISSIONS: "INSUFFICIENT_PERMISSIONS";
    readonly NOT_FOUND: "NOT_FOUND";
    readonly CONFLICT: "CONFLICT";
    readonly RATE_LIMIT_EXCEEDED: "RATE_LIMIT_EXCEEDED";
    readonly INTERNAL_ERROR: "INTERNAL_ERROR";
    readonly SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE";
    readonly BAD_REQUEST: "BAD_REQUEST";
};
export declare const RATE_LIMITS: {
    readonly API: {
        readonly windowMs: 60000;
        readonly max: 100;
        readonly keyPrefix: "rate:api:";
    };
    readonly AUTH: {
        readonly windowMs: 900000;
        readonly max: 5;
        readonly keyPrefix: "rate:auth:";
    };
    readonly YOUTUBE: {
        readonly windowMs: 3600000;
        readonly max: 5;
        readonly keyPrefix: "rate:youtube:";
    };
    readonly MEDIA_REQUEST: {
        readonly windowMs: 3600000;
        readonly max: 20;
        readonly keyPrefix: "rate:request:";
    };
};
//# sourceMappingURL=index.d.ts.map