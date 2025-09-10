import { vi } from 'vitest';

/**
 * Create a mock function with TypeScript support
 */
export function createMockFunction<T extends (...args: any[]) => any>(): T {
  return vi.fn() as T;
}

/**
 * Wait for a specific amount of time
 */
export async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Generate a random ID
 */
export function generateId(prefix = 'test'): string {
  return `${prefix}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Create a mock date that can be controlled in tests
 */
export function mockDate(date: string | Date): () => void {
  const mockDate = new Date(date);
  vi.useFakeTimers();
  vi.setSystemTime(mockDate);

  return () => {
    vi.useRealTimers();
  };
}

/**
 * Mock console methods to prevent noise in tests
 */
export function mockConsole(): () => void {
  const originalConsole = { ...console };

  console.log = vi.fn();
  console.error = vi.fn();
  console.warn = vi.fn();
  console.info = vi.fn();
  console.debug = vi.fn();

  return () => {
    Object.assign(console, originalConsole);
  };
}

/**
 * Create a mock WebSocket instance
 */
export function createMockWebSocket() {
  return {
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
    disconnect: vi.fn(),
    connect: vi.fn(),
    connected: false,
    id: generateId('socket'),
  };
}

/**
 * Create a mock fetch response
 */
export function createMockFetchResponse(data: any, options: ResponseInit = {}): Response {
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

/**
 * Mock environment variables
 */
export function mockEnv(vars: Record<string, string>): () => void {
  const originalEnv = { ...process.env };

  Object.assign(process.env, vars);

  return () => {
    process.env = originalEnv;
  };
}

/**
 * Create a test context with common utilities
 */
export interface TestContext {
  cleanup: (() => void)[];
}

export function createTestContext(): TestContext & {
  addCleanup: (fn: () => void) => void;
  cleanup: () => void;
} {
  const cleanupFns: (() => void)[] = [];

  return {
    cleanupFns: cleanupFns,
    addCleanup: (fn: () => void) => {
      cleanupFns.push(fn);
    },
    cleanup: () => {
      cleanupFns.forEach((fn) => fn());
      cleanupFns.length = 0;
    },
  };
}

/**
 * Assert that a promise rejects with a specific error
 */
export async function expectToReject(
  promise: Promise<any>,
  expectedError?: string | RegExp | Error,
): Promise<void> {
  try {
    await promise;
    throw new Error('Expected promise to reject');
  } catch (error) {
    if (expectedError) {
      if (typeof expectedError === 'string') {
        expect(error).toEqual(new Error(expectedError));
      } else if (expectedError instanceof RegExp) {
        expect(error.message).toMatch(expectedError);
      } else {
        expect(error).toEqual(expectedError);
      }
    }
  }
}

/**
 * Create a mock Redis client
 */
export function createMockRedisClient() {
  const store = new Map<string, string>();

  return {
    get: vi.fn(async (key: string) => store.get(key) || null),
    set: vi.fn(async (key: string, value: string) => {
      store.set(key, value);
      return 'OK';
    }),
    del: vi.fn(async (key: string) => {
      const existed = store.has(key);
      store.delete(key);
      return existed ? 1 : 0;
    }),
    exists: vi.fn(async (key: string) => (store.has(key) ? 1 : 0)),
    expire: vi.fn(async () => 1),
    ttl: vi.fn(async () => -1),
    incr: vi.fn(async (key: string) => {
      const current = parseInt(store.get(key) || '0');
      const next = current + 1;
      store.set(key, next.toString());
      return next;
    }),
    zadd: vi.fn(),
    zrange: vi.fn(async () => []),
    pipeline: vi.fn(() => ({
      exec: vi.fn(async () => []),
    })),
    quit: vi.fn(),
    disconnect: vi.fn(),
    _store: store, // Expose for testing
  };
}

/**
 * Create a mock Prisma client
 */
export function createMockPrismaClient() {
  return {
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    mediaRequest: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    youtubeDownload: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    serviceStatus: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
    },
    $transaction: vi.fn(),
    $disconnect: vi.fn(),
    $connect: vi.fn(),
  };
}
