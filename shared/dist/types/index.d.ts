export * from './service';
export * from './request';
export interface User {
    id: string;
    plexId?: string;
    plexUsername?: string;
    email: string;
    name?: string;
    role: string;
    status: string;
    createdAt: Date;
    lastLoginAt?: Date;
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