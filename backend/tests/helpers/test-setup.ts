import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { execSync } from 'child_process';
import { DatabaseStateFactory } from '../factories/test-data.factory';

// Global test configuration
export const TEST_CONFIG = {
  database: {
    url: process.env.DATABASE_TEST_URL || 'postgresql://test:test@localhost:5432/medianest_test',
    schema: 'public',
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    db: parseInt(process.env.REDIS_TEST_DB || '15'),
  },
  server: {
    port: parseInt(process.env.TEST_PORT || '3001'),
    host: 'localhost',
  },
  timeouts: {
    default: 10000,
    long: 30000,
    short: 5000,
  },
};

// Test Database Setup
export class TestDatabaseSetup {
  private static prisma: PrismaClient;
  private static redis: Redis;

  static async initialize() {
    // Initialize Prisma with test database
    this.prisma = new PrismaClient({
      datasources: {
        db: {
          url: TEST_CONFIG.database.url,
        },
      },
    });

    // Initialize Redis with test database
    this.redis = new Redis({
      host: TEST_CONFIG.redis.host,
      port: TEST_CONFIG.redis.port,
      db: TEST_CONFIG.redis.db,
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      retryDelayOnFailover: 100,
    });

    try {
      await this.redis.connect();
    } catch (error) {
      console.warn('Redis not available for tests, using mock implementation');
      // Create mock Redis if real Redis is not available
      this.redis = this.createMockRedis() as any;
    }

    return { prisma: this.prisma, redis: this.redis };
  }

  static async resetDatabase() {
    if (this.prisma) {
      await DatabaseStateFactory.cleanupTestData(this.prisma);
    }
  }

  static async resetRedis() {
    if (this.redis && typeof this.redis.flushdb === 'function') {
      try {
        await this.redis.flushdb();
      } catch (error) {
        // Mock Redis doesn't need to flush
      }
    }
  }

  static async cleanup() {
    if (this.prisma) {
      await this.prisma.$disconnect();
    }
    if (this.redis && typeof this.redis.disconnect === 'function') {
      await this.redis.disconnect();
    }
  }

  static getPrisma() {
    return this.prisma;
  }

  static getRedis() {
    return this.redis;
  }

  private static createMockRedis() {
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

      del: async (key: string) => {
        return store.delete(key) ? 1 : 0;
      },

      exists: async (key: string) => {
        return store.has(key) ? 1 : 0;
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

      ping: async () => 'PONG',
    };
  }
}

// Test Server Setup
export class TestServerSetup {
  private static server: any;
  private static app: any;

  static async startTestServer(app?: any) {
    if (app) {
      this.app = app;
      return new Promise((resolve, reject) => {
        this.server = app.listen(TEST_CONFIG.server.port, TEST_CONFIG.server.host, (err: any) => {
          if (err) {
            reject(err);
          } else {
            resolve(`http://${TEST_CONFIG.server.host}:${TEST_CONFIG.server.port}`);
          }
        });
      });
    }
    return null;
  }

  static async stopTestServer() {
    if (this.server) {
      return new Promise<void>((resolve) => {
        this.server.close(() => {
          resolve();
        });
      });
    }
  }

  static getBaseUrl() {
    return `http://${TEST_CONFIG.server.host}:${TEST_CONFIG.server.port}`;
  }
}

// Environment Setup
export class TestEnvironmentSetup {
  static setupEnvironment() {
    // Set test environment variables
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL = TEST_CONFIG.database.url;
    process.env.REDIS_HOST = TEST_CONFIG.redis.host;
    process.env.REDIS_PORT = TEST_CONFIG.redis.port.toString();
    process.env.REDIS_DB = TEST_CONFIG.redis.db.toString();
    process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only';
    process.env.ENCRYPTION_KEY = 'test-encryption-key-32-chars-long';
    process.env.LOG_LEVEL = 'error'; // Reduce log noise in tests
  }

  static async runMigrations() {
    try {
      // Run database migrations for test database
      execSync('npx prisma migrate deploy', {
        env: { ...process.env, DATABASE_URL: TEST_CONFIG.database.url },
        stdio: 'pipe',
      });
    } catch (error) {
      console.warn('Migration failed, running in mock mode without database');
      // Don't throw error - tests can run with mocks
    }
  }

  static cleanupEnvironment() {
    // Clean up any environment changes
    delete process.env.DATABASE_URL;
    delete process.env.REDIS_HOST;
    delete process.env.REDIS_PORT;
    delete process.env.REDIS_DB;
  }
}

// Test Utilities
export class TestUtils {
  static async waitFor(
    condition: () => boolean | Promise<boolean>,
    timeout = 5000,
    interval = 100,
  ) {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      if (await condition()) {
        return true;
      }
      await new Promise((resolve) => setTimeout(resolve, interval));
    }

    throw new Error(`Condition not met within ${timeout}ms`);
  }

  static async retryOperation<T>(
    operation: () => Promise<T>,
    maxRetries = 3,
    delay = 1000,
  ): Promise<T> {
    let lastError: Error;

    for (let i = 0; i < maxRetries; i++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        if (i < maxRetries - 1) {
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError!;
  }

  static createMockRequest(overrides: any = {}) {
    return {
      params: {},
      query: {},
      body: {},
      headers: {},
      user: null,
      ip: '127.0.0.1',
      method: 'GET',
      url: '/',
      ...overrides,
    };
  }

  static createMockResponse() {
    const response = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
      header: vi.fn().mockReturnThis(),
      cookie: vi.fn().mockReturnThis(),
      clearCookie: vi.fn().mockReturnThis(),
      redirect: vi.fn().mockReturnThis(),
      locals: {},
    };

    return response;
  }

  static generateCorrelationId() {
    return `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  static async measurePerformance<T>(
    operation: () => Promise<T>,
  ): Promise<{ result: T; duration: number }> {
    const startTime = process.hrtime.bigint();
    const result = await operation();
    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds

    return { result, duration };
  }
}

// Global test hooks
export function setupGlobalTestHooks() {
  beforeAll(async () => {
    TestEnvironmentSetup.setupEnvironment();
    await TestEnvironmentSetup.runMigrations();
    await TestDatabaseSetup.initialize();
  });

  afterAll(async () => {
    await TestDatabaseSetup.cleanup();
    await TestServerSetup.stopTestServer();
    TestEnvironmentSetup.cleanupEnvironment();
  });

  beforeEach(async () => {
    await TestDatabaseSetup.resetDatabase();
    await TestDatabaseSetup.resetRedis();
  });

  afterEach(async () => {
    // Additional cleanup if needed
  });
}

// Auto-setup global hooks
setupGlobalTestHooks();
