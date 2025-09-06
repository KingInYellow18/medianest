export declare function createMockFunction<T extends (...args: any[]) => any>(): T;
export declare function delay(ms: number): Promise<void>;
export declare function generateId(prefix?: string): string;
export declare function mockDate(date: string | Date): () => void;
export declare function mockConsole(): () => void;
export declare function createMockWebSocket(): {
    on: import("vitest").Mock<any, any>;
    off: import("vitest").Mock<any, any>;
    emit: import("vitest").Mock<any, any>;
    disconnect: import("vitest").Mock<any, any>;
    connect: import("vitest").Mock<any, any>;
    connected: boolean;
    id: string;
};
export declare function createMockFetchResponse(data: any, options?: ResponseInit): Response;
export declare function mockEnv(vars: Record<string, string>): () => void;
export interface TestContext {
    cleanup: (() => void)[];
}
export declare function createTestContext(): TestContext & {
    addCleanup: (fn: () => void) => void;
    cleanup: () => void;
};
export declare function expectToReject(promise: Promise<any>, expectedError?: string | RegExp | Error): Promise<void>;
export declare function createMockRedisClient(): {
    get: import("vitest").Mock<[key: string], Promise<string | null>>;
    set: import("vitest").Mock<[key: string, value: string], Promise<string>>;
    del: import("vitest").Mock<[key: string], Promise<0 | 1>>;
    exists: import("vitest").Mock<[key: string], Promise<0 | 1>>;
    expire: import("vitest").Mock<[], Promise<number>>;
    ttl: import("vitest").Mock<[], Promise<number>>;
    incr: import("vitest").Mock<[key: string], Promise<number>>;
    zadd: import("vitest").Mock<any, any>;
    zrange: import("vitest").Mock<[], Promise<never[]>>;
    pipeline: import("vitest").Mock<[], {
        exec: import("vitest").Mock<[], Promise<never[]>>;
    }>;
    quit: import("vitest").Mock<any, any>;
    disconnect: import("vitest").Mock<any, any>;
    _store: Map<string, string>;
};
export declare function createMockPrismaClient(): {
    user: {
        findUnique: import("vitest").Mock<any, any>;
        findMany: import("vitest").Mock<any, any>;
        create: import("vitest").Mock<any, any>;
        update: import("vitest").Mock<any, any>;
        delete: import("vitest").Mock<any, any>;
        count: import("vitest").Mock<any, any>;
    };
    mediaRequest: {
        findUnique: import("vitest").Mock<any, any>;
        findMany: import("vitest").Mock<any, any>;
        create: import("vitest").Mock<any, any>;
        update: import("vitest").Mock<any, any>;
        delete: import("vitest").Mock<any, any>;
        count: import("vitest").Mock<any, any>;
    };
    youtubeDownload: {
        findUnique: import("vitest").Mock<any, any>;
        findMany: import("vitest").Mock<any, any>;
        create: import("vitest").Mock<any, any>;
        update: import("vitest").Mock<any, any>;
        delete: import("vitest").Mock<any, any>;
        count: import("vitest").Mock<any, any>;
    };
    serviceStatus: {
        findUnique: import("vitest").Mock<any, any>;
        findMany: import("vitest").Mock<any, any>;
        create: import("vitest").Mock<any, any>;
        update: import("vitest").Mock<any, any>;
        upsert: import("vitest").Mock<any, any>;
        delete: import("vitest").Mock<any, any>;
    };
    $transaction: import("vitest").Mock<any, any>;
    $disconnect: import("vitest").Mock<any, any>;
    $connect: import("vitest").Mock<any, any>;
};
//# sourceMappingURL=test-helpers.d.ts.map