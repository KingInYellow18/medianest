export declare function createMockFunction<T extends (...args: any[]) => any>(): T;
export declare function delay(ms: number): Promise<void>;
export declare function generateId(prefix?: string): string;
export declare function mockDate(date: string | Date): () => void;
export declare function mockConsole(): () => void;
export declare function createMockWebSocket(): {
    on: any;
    off: any;
    emit: any;
    disconnect: any;
    connect: any;
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
    get: any;
    set: any;
    del: any;
    exists: any;
    expire: any;
    ttl: any;
    incr: any;
    zadd: any;
    zrange: any;
    pipeline: any;
    quit: any;
    disconnect: any;
    _store: Map<string, string>;
};
export declare function createMockPrismaClient(): {
    user: {
        findUnique: any;
        findMany: any;
        create: any;
        update: any;
        delete: any;
        count: any;
    };
    mediaRequest: {
        findUnique: any;
        findMany: any;
        create: any;
        update: any;
        delete: any;
        count: any;
    };
    youtubeDownload: {
        findUnique: any;
        findMany: any;
        create: any;
        update: any;
        delete: any;
        count: any;
    };
    serviceStatus: {
        findUnique: any;
        findMany: any;
        create: any;
        update: any;
        upsert: any;
        delete: any;
    };
    $transaction: any;
    $disconnect: any;
    $connect: any;
};
//# sourceMappingURL=test-helpers.d.ts.map