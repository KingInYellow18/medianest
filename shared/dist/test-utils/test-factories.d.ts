import { User, MediaRequest, YoutubeDownload, ServiceStatus } from '../types';
export declare function createTestUser(overrides?: Partial<User>): User;
export declare function createTestMediaRequest(overrides?: Partial<MediaRequest>): MediaRequest;
export declare function createTestYoutubeDownload(overrides?: Partial<YoutubeDownload>): YoutubeDownload;
export declare function createTestServiceStatus(overrides?: Partial<ServiceStatus>): ServiceStatus;
export declare class TestDataFactory {
    static createUsers(count: number, overrides?: Partial<User>): User[];
    static createMediaRequests(count: number, userId: string, overrides?: Partial<MediaRequest>): MediaRequest[];
    static createFullDataset(): {
        users: User[];
        mediaRequests: MediaRequest[];
        youtubeDownloads: any[];
        serviceStatuses: ServiceStatus[];
    };
}
export declare function createTestJwtPayload(userId: string, role?: 'user' | 'admin'): {
    userId: string;
    role: "admin" | "user";
    iat: number;
    exp: number;
};
export declare function createTestErrorResponse(code: string, message: string, details?: any): {
    success: boolean;
    error: {
        code: string;
        message: string;
        details: any;
    };
};
export declare function createTestSuccessResponse<T>(data: T): {
    success: boolean;
    data: T;
    meta: {
        timestamp: string;
        version: string;
    };
};
//# sourceMappingURL=test-factories.d.ts.map