import Redis from 'ioredis';

// Redis connection singleton
let redisClient: Redis | null = null;
let redisSubscriber: Redis | null = null;

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
  maxRetriesPerRequest?: number | null;
  enableReadyCheck?: boolean;
  enableOfflineQueue?: boolean;
  retryStrategy?: (times: number) => number | void;
}

// Default configuration
const defaultConfig: RedisConfig = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB || '0'),
  maxRetriesPerRequest: 20, // For API operations
  enableReadyCheck: true,
  enableOfflineQueue: false, // Fail fast for API operations
  retryStrategy: (times: number) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
};

/**
 * Get or create Redis client instance
 */
export function getRedisClient(config?: Partial<RedisConfig>): Redis {
  if (!redisClient) {
    const finalConfig = { ...defaultConfig, ...config };
    redisClient = new Redis(finalConfig);

    redisClient.on('connect', () => {
      console.log('✅ Redis client connected');
    });

    redisClient.on('error', (err) => {
      console.error('❌ Redis client error:', err);
    });

    redisClient.on('ready', () => {
      console.log('✅ Redis client ready');
    });
  }

  return redisClient;
}

/**
 * Get or create Redis subscriber instance (for pub/sub)
 */
export function getRedisSubscriber(config?: Partial<RedisConfig>): Redis {
  if (!redisSubscriber) {
    const finalConfig = {
      ...defaultConfig,
      ...config,
      maxRetriesPerRequest: null, // Keep trying for subscribers
    };
    redisSubscriber = new Redis(finalConfig);

    redisSubscriber.on('connect', () => {
      console.log('✅ Redis subscriber connected');
    });

    redisSubscriber.on('error', (err) => {
      console.error('❌ Redis subscriber error:', err);
    });
  }

  return redisSubscriber;
}

/**
 * Create a new Redis connection (for workers, separate connections)
 */
export function createRedisConnection(config?: Partial<RedisConfig>): Redis {
  const finalConfig = { ...defaultConfig, ...config };
  const connection = new Redis(finalConfig);

  connection.on('error', (err) => {
    console.error('❌ Redis connection error:', err);
  });

  return connection;
}

/**
 * Close all Redis connections
 */
export async function closeRedisConnections(): Promise<void> {
  const promises: Promise<'OK'>[] = [];

  if (redisClient) {
    promises.push(redisClient.quit());
    redisClient = null;
  }

  if (redisSubscriber) {
    promises.push(redisSubscriber.quit());
    redisSubscriber = null;
  }

  await Promise.all(promises);
  console.log('✅ All Redis connections closed');
}

// Connection health check
export async function checkRedisHealth(): Promise<boolean> {
  try {
    const client = getRedisClient();
    const result = await client.ping();
    return result === 'PONG';
  } catch (error) {
    console.error('Redis health check failed:', error);
    return false;
  }
}
