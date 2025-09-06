export interface User {
    id: string;
    plexId: string;
    plexUsername: string;
    email?: string;
    role: 'admin' | 'user';
    status: 'active' | 'inactive';
    createdAt: Date;
    lastLoginAt?: Date;
}
export interface MediaRequest {
    id: string;
    userId: string;
    title: string;
    mediaType: 'movie' | 'tv';
    tmdbId?: string;
    status: 'pending' | 'approved' | 'completed' | 'failed';
    overseerrId?: string;
    createdAt: Date;
    completedAt?: Date;
}
export interface ServiceStatus {
    name: string;
    status: 'up' | 'down' | 'degraded';
    responseTime?: number;
    lastCheck?: Date;
    uptime?: number;
}
export interface ApiResponse<T = any> {
    success: boolean;
    data?: T;
    error?: {
        code: string;
        message: string;
        details?: any;
    };
    meta?: {
        timestamp: string;
        version: string;
    };
}
//# sourceMappingURL=index.d.ts.map