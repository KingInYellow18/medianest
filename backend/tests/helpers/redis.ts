import { Redis } from 'ioredis';

export class TestRedis {
  private static instance: TestRedis;
  private redis: Redis | null = null;

  private constructor() {}

  static getInstance(): TestRedis {
    if (!TestRedis.instance) {
      TestRedis.instance = new TestRedis();
    }
    return TestRedis.instance;
  }

  async connect(): Promise<Redis> {
    if (this.redis) {
      return this.redis;
    }

    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      db: parseInt(process.env.REDIS_DB || '1'), // Use separate DB for tests
      maxRetriesPerRequest: 3,
      retryDelayOnFailover: 100,
      lazyConnect: true
    });

    await this.redis.connect();
    
    // Test connection
    await this.redis.ping();
    
    return this.redis;
  }

  async disconnect(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
      this.redis = null;
    }
  }

  async clearDatabase(): Promise<void> {
    if (!this.redis) {
      throw new Error('Redis not connected');
    }

    await this.redis.flushdb();
  }

  async seedTestData(): Promise<void> {
    if (!this.redis) {
      throw new Error('Redis not connected');
    }

    // Seed some test cache data
    await this.redis.set('test:user:test-user-1:profile', JSON.stringify({
      id: 'test-user-1',
      email: 'test1@example.com',
      role: 'user'
    }), 'EX', 3600);

    await this.redis.set('test:health:last-check', Date.now().toString(), 'EX', 300);

    // Seed rate limit data
    await this.redis.set('rate_limit:auth:192.168.1.1', '5', 'EX', 3600);
    await this.redis.set('rate_limit:api:test-user-1', '10', 'EX', 3600);

    // Seed session data
    await this.redis.hset('session:test-session-1', {
      userId: 'test-user-1',
      createdAt: Date.now().toString(),
      lastAccess: Date.now().toString()
    });

    await this.redis.expire('session:test-session-1', 7 * 24 * 60 * 60);
  }

  getRedis(): Redis | null {
    return this.redis;
  }

  async waitForConnection(timeout: number = 5000): Promise<void> {
    if (!this.redis) {
      throw new Error('Redis not initialized');
    }

    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      try {
        await this.redis.ping();
        return;
      } catch (error) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    throw new Error(`Redis connection timeout after ${timeout}ms`);
  }

  async getTestKeys(): Promise<string[]> {
    if (!this.redis) {
      throw new Error('Redis not connected');
    }

    return this.redis.keys('test:*');
  }

  async clearTestKeys(): Promise<void> {
    if (!this.redis) {
      throw new Error('Redis not connected');
    }

    const testKeys = await this.getTestKeys();
    if (testKeys.length > 0) {
      await this.redis.del(...testKeys);
    }
  }
}

export const testRedis = TestRedis.getInstance();