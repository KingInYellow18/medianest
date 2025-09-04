import { User, MediaRequest, ServiceStatus } from '../types';
export declare const mockUsers: Partial<User>[];
export declare const mockMediaRequests: Partial<MediaRequest>[];
export declare const mockServiceStatus: ServiceStatus[];
export declare const mockPlexOAuth: {
    pin: {
        id: string;
        code: string;
    };
    authToken: string;
    userInfo: {
        id: string;
        username: string;
        email: string;
        thumb: string;
    };
};
export declare const mockTokens: {
    validUser: string;
    validAdmin: string;
    expired: string;
    invalid: string;
};
export declare const mockApiResponses: {
    success: {
        success: boolean;
        data: {};
        meta: {
            timestamp: string;
            version: string;
        };
    };
    error: {
        success: boolean;
        error: {
            code: string;
            message: string;
            details: {};
        };
    };
    unauthorized: {
        success: boolean;
        error: {
            code: string;
            message: string;
            details: {};
        };
    };
    rateLimited: {
        success: boolean;
        error: {
            code: string;
            message: string;
            details: {
                limit: number;
                window: string;
                retryAfter: number;
            };
        };
    };
};
//# sourceMappingURL=mock-data.d.ts.map