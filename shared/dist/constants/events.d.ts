export declare const SOCKET_EVENTS: {
    readonly CONNECTION: "connection";
    readonly DISCONNECT: "disconnect";
    readonly ERROR: "error";
    readonly SERVICE_STATUS: "service:status";
    readonly SERVICE_STATUS_ALL: "service:status:all";
    readonly SERVICE_ERROR: "service:error";
    readonly SERVICE_RECONNECTED: "service:reconnected";
    readonly REQUEST_UPDATE: "request:update";
    readonly REQUEST_CREATED: "request:created";
    readonly REQUEST_APPROVED: "request:approved";
    readonly REQUEST_DENIED: "request:denied";
    readonly REQUEST_AVAILABLE: "request:available";
    readonly REQUEST_FAILED: "request:failed";
    readonly DOWNLOAD_PROGRESS: "download:progress";
    readonly DOWNLOAD_STARTED: "download:started";
    readonly DOWNLOAD_COMPLETED: "download:completed";
    readonly DOWNLOAD_FAILED: "download:failed";
    readonly DOWNLOAD_CANCELLED: "download:cancelled";
    readonly USER_NOTIFICATION: "user:notification";
    readonly USER_SESSION_EXPIRED: "user:session:expired";
    readonly SYSTEM_MAINTENANCE: "system:maintenance";
    readonly SYSTEM_UPDATE: "system:update";
};
export type SocketEvent = (typeof SOCKET_EVENTS)[keyof typeof SOCKET_EVENTS];
//# sourceMappingURL=events.d.ts.map