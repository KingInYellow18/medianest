export declare const API_VERSION = "v1";
export declare const API_ENDPOINTS: {
    readonly AUTH: {
        readonly LOGIN: "/auth/login";
        readonly LOGOUT: "/auth/logout";
        readonly REFRESH: "/auth/refresh";
        readonly VERIFY: "/auth/verify";
        readonly PLEX_PIN: "/auth/plex/pin";
        readonly PLEX_CALLBACK: "/auth/plex/callback";
    };
    readonly USERS: {
        readonly BASE: "/users";
        readonly ME: "/users/me";
        readonly BY_ID: (id: string) => string;
        readonly UPDATE: (id: string) => string;
        readonly DELETE: (id: string) => string;
        readonly PREFERENCES: "/users/me/preferences";
    };
    readonly MEDIA: {
        readonly SEARCH: "/media/search";
        readonly DETAILS: (type: string, id: string) => string;
        readonly REQUEST: "/media/request";
        readonly POPULAR: "/media/popular";
        readonly TRENDING: "/media/trending";
    };
    readonly REQUESTS: {
        readonly BASE: "/requests";
        readonly MY_REQUESTS: "/requests/me";
        readonly BY_ID: (id: string) => string;
        readonly APPROVE: (id: string) => string;
        readonly DENY: (id: string) => string;
        readonly CANCEL: (id: string) => string;
    };
    readonly SERVICES: {
        readonly STATUS: "/services/status";
        readonly BY_NAME: (name: string) => string;
        readonly CONFIGURE: (name: string) => string;
        readonly TEST: (name: string) => string;
        readonly REFRESH: (name: string) => string;
    };
    readonly DASHBOARD: {
        readonly STATUS: "/dashboard/status";
        readonly STATS: "/dashboard/stats";
        readonly RECENT_ACTIVITY: "/dashboard/activity";
    };
    readonly DOWNLOADS: {
        readonly YOUTUBE: "/downloads/youtube";
        readonly STATUS: (id: string) => string;
        readonly CANCEL: (id: string) => string;
        readonly HISTORY: "/downloads/history";
    };
    readonly ADMIN: {
        readonly SETTINGS: "/admin/settings";
        readonly LOGS: "/admin/logs";
        readonly METRICS: "/admin/metrics";
        readonly SYSTEM: "/admin/system";
        readonly MAINTENANCE: "/admin/maintenance";
    };
    readonly HEALTH: "/health";
    readonly READY: "/ready";
};
export declare function buildApiUrl(endpoint: string, baseUrl?: string): string;
//# sourceMappingURL=api.d.ts.map