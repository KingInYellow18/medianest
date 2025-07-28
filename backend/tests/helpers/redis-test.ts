import Redis from 'ioredis';

let testRedis: Redis | null = null;

export async function setupTestRedis(): Promise<void> {
  if (!testRedis) {
    testRedis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      db: parseInt(process.env.REDIS_TEST_DB || '15'), // Use separate DB for tests
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      retryDelayOnFailover: 100,
    });

    try {
      await testRedis.connect();
    } catch (error) {
      // If Redis is not available, create a mock implementation
      testRedis = createMockRedis();
    }
  }
}

export async function closeTestRedis(): Promise<void> {
  if (testRedis && typeof testRedis.disconnect === 'function') {
    await testRedis.disconnect();
    testRedis = null;
  }
}

export async function clearTestRedis(): Promise<void> {
  if (testRedis) {
    try {
      await testRedis.flushdb();
    } catch (error) {
      // Mock Redis doesn't need to flush
    }
  }
}

// Mock Redis implementation for testing when Redis is not available
function createMockRedis(): any {
  const store = new Map<string, { value: string; ttl?: number; expiry?: number }>();

  return {
    get: async (key: string) => {
      const item = store.get(key);
      if (!item) return null;

      if (item.expiry && Date.now() > item.expiry) {
        store.delete(key);
        return null;
      }

      return item.value;
    },

    set: async (key: string, value: string, mode?: string, duration?: number) => {
      let expiry: number | undefined;

      if (mode === 'EX' && duration) {
        expiry = Date.now() + duration * 1000;
      }

      store.set(key, { value, expiry });
      return 'OK';
    },

    incr: async (key: string) => {
      const item = store.get(key);
      const currentValue = item ? parseInt(item.value) : 0;
      const newValue = currentValue + 1;

      store.set(key, {
        value: newValue.toString(),
        expiry: item?.expiry,
      });

      return newValue;
    },

    decr: async (key: string) => {
      const item = store.get(key);
      const currentValue = item ? parseInt(item.value) : 0;
      const newValue = Math.max(0, currentValue - 1);

      store.set(key, {
        value: newValue.toString(),
        expiry: item?.expiry,
      });

      return newValue;
    },

    expire: async (key: string, seconds: number) => {
      const item = store.get(key);
      if (item) {
        item.expiry = Date.now() + seconds * 1000;
        store.set(key, item);
        return 1;
      }
      return 0;
    },

    ttl: async (key: string) => {
      const item = store.get(key);
      if (!item || !item.expiry) return -1;

      const remaining = Math.ceil((item.expiry - Date.now()) / 1000);
      return remaining > 0 ? remaining : -2;
    },

    eval: async (script: string, numKeys: number, ...args: any[]) => {
      // Simplified Lua script evaluation for rate limiting
      const key = args[0];
      const limit = parseInt(args[1]);
      const window = parseInt(args[2]);

      const item = store.get(key);
      const current = item ? parseInt(item.value) : 0;

      if (current >= limit) {
        const ttl = item?.expiry ? Math.ceil((item.expiry - Date.now()) / 1000) : window;
        return [1, ttl];
      } else {
        const newValue = current + 1;
        const expiry = Date.now() + window * 1000;
        store.set(key, { value: newValue.toString(), expiry });
        return [0, window];
      }
    },

    flushdb: async () => {
      store.clear();
      return 'OK';
    },

    disconnect: async () => {
      store.clear();
    },

    connect: async () => {
      // Mock connect
    },
  };
}

// Override the getRedis function for tests
export function getTestRedis(): Redis {
  if (!testRedis) {
    throw new Error('Test Redis not initialized. Call setupTestRedis() first.');
  }
  return testRedis;
}
