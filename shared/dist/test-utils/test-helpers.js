"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMockFunction = createMockFunction;
exports.delay = delay;
exports.generateId = generateId;
exports.mockDate = mockDate;
exports.mockConsole = mockConsole;
exports.createMockWebSocket = createMockWebSocket;
exports.createMockFetchResponse = createMockFetchResponse;
exports.mockEnv = mockEnv;
exports.createTestContext = createTestContext;
exports.expectToReject = expectToReject;
exports.createMockRedisClient = createMockRedisClient;
exports.createMockPrismaClient = createMockPrismaClient;
const vitest_1 = require("vitest");
function createMockFunction() {
    return vitest_1.vi.fn();
}
async function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
function generateId(prefix = 'test') {
    return `${prefix}-${Math.random().toString(36).substring(2, 9)}`;
}
function mockDate(date) {
    const mockDate = new Date(date);
    vitest_1.vi.useFakeTimers();
    vitest_1.vi.setSystemTime(mockDate);
    return () => {
        vitest_1.vi.useRealTimers();
    };
}
function mockConsole() {
    const originalConsole = { ...console };
    console.log = vitest_1.vi.fn();
    console.error = vitest_1.vi.fn();
    console.warn = vitest_1.vi.fn();
    console.info = vitest_1.vi.fn();
    console.debug = vitest_1.vi.fn();
    return () => {
        Object.assign(console, originalConsole);
    };
}
function createMockWebSocket() {
    return {
        on: vitest_1.vi.fn(),
        off: vitest_1.vi.fn(),
        emit: vitest_1.vi.fn(),
        disconnect: vitest_1.vi.fn(),
        connect: vitest_1.vi.fn(),
        connected: false,
        id: generateId('socket'),
    };
}
function createMockFetchResponse(data, options = {}) {
    const body = JSON.stringify(data);
    const init = {
        status: 200,
        statusText: 'OK',
        headers: {
            'Content-Type': 'application/json',
            ...options.headers,
        },
        ...options,
    };
    return new Response(body, init);
}
function mockEnv(vars) {
    const originalEnv = { ...process.env };
    Object.assign(process.env, vars);
    return () => {
        process.env = originalEnv;
    };
}
function createTestContext() {
    const cleanupFns = [];
    return {
        cleanup: cleanupFns,
        addCleanup: (fn) => {
            cleanupFns.push(fn);
        },
        cleanup: () => {
            cleanupFns.forEach((fn) => fn());
            cleanupFns.length = 0;
        },
    };
}
async function expectToReject(promise, expectedError) {
    try {
        await promise;
        throw new Error('Expected promise to reject');
    }
    catch (error) {
        if (expectedError) {
            if (typeof expectedError === 'string') {
                expect(error).toEqual(new Error(expectedError));
            }
            else if (expectedError instanceof RegExp) {
                expect(error.message).toMatch(expectedError);
            }
            else {
                expect(error).toEqual(expectedError);
            }
        }
    }
}
function createMockRedisClient() {
    const store = new Map();
    return {
        get: vitest_1.vi.fn(async (key) => store.get(key) || null),
        set: vitest_1.vi.fn(async (key, value) => {
            store.set(key, value);
            return 'OK';
        }),
        del: vitest_1.vi.fn(async (key) => {
            const existed = store.has(key);
            store.delete(key);
            return existed ? 1 : 0;
        }),
        exists: vitest_1.vi.fn(async (key) => (store.has(key) ? 1 : 0)),
        expire: vitest_1.vi.fn(async () => 1),
        ttl: vitest_1.vi.fn(async () => -1),
        incr: vitest_1.vi.fn(async (key) => {
            const current = parseInt(store.get(key) || '0');
            const next = current + 1;
            store.set(key, next.toString());
            return next;
        }),
        zadd: vitest_1.vi.fn(),
        zrange: vitest_1.vi.fn(async () => []),
        pipeline: vitest_1.vi.fn(() => ({
            exec: vitest_1.vi.fn(async () => []),
        })),
        quit: vitest_1.vi.fn(),
        disconnect: vitest_1.vi.fn(),
        _store: store,
    };
}
function createMockPrismaClient() {
    return {
        user: {
            findUnique: vitest_1.vi.fn(),
            findMany: vitest_1.vi.fn(),
            create: vitest_1.vi.fn(),
            update: vitest_1.vi.fn(),
            delete: vitest_1.vi.fn(),
            count: vitest_1.vi.fn(),
        },
        mediaRequest: {
            findUnique: vitest_1.vi.fn(),
            findMany: vitest_1.vi.fn(),
            create: vitest_1.vi.fn(),
            update: vitest_1.vi.fn(),
            delete: vitest_1.vi.fn(),
            count: vitest_1.vi.fn(),
        },
        youtubeDownload: {
            findUnique: vitest_1.vi.fn(),
            findMany: vitest_1.vi.fn(),
            create: vitest_1.vi.fn(),
            update: vitest_1.vi.fn(),
            delete: vitest_1.vi.fn(),
            count: vitest_1.vi.fn(),
        },
        serviceStatus: {
            findUnique: vitest_1.vi.fn(),
            findMany: vitest_1.vi.fn(),
            create: vitest_1.vi.fn(),
            update: vitest_1.vi.fn(),
            upsert: vitest_1.vi.fn(),
            delete: vitest_1.vi.fn(),
        },
        $transaction: vitest_1.vi.fn(),
        $disconnect: vitest_1.vi.fn(),
        $connect: vitest_1.vi.fn(),
    };
}
//# sourceMappingURL=test-helpers.js.map