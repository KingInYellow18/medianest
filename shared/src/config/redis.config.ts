import Redis, { RedisOptions, Cluster } from 'ioredis';
import { z } from 'zod';

import type { RedisConfig } from './base.config';
import { createServiceLogger } from './logging.config';

/**
 * Redis Cluster Configuration Schema
 */
export const RedisClusterConfigSchema = z.object({
  enabled: z.coerce.boolean().default(false),
  nodes: z.array(z.object({
    host: z.string(),
    port: z.coerce.number(),
  })).default([]),
  options: z.object({
    enableOfflineQueue: z.coerce.boolean().default(false),
    redisOptions: z.object({
      password: z.string().optional(),
    }).optional(),
  }).optional(),
});

export type RedisClusterConfig = z.infer<typeof RedisClusterConfigSchema>;

/**
 * Redis Connection Pool Configuration
 */
export const RedisPoolConfigSchema = z.object({
  family: z.enum(['4', '6']).default('4'),
  keepAlive: z.coerce.boolean().default(true),
  connectTimeout: z.coerce.number().default(10000),
  commandTimeout: z.coerce.number().default(5000),
  lazyConnect: z.coerce.boolean().default(true),
  maxRetriesPerRequest: z.coerce.number().default(3),
  retryDelayOnFailover: z.coerce.number().default(100),
  enableAutoPipelining: z.coerce.boolean().default(true),
  maxRetriesPerRequest: z.coerce.number().default(3),
});

export type RedisPoolConfig = z.infer<typeof RedisPoolConfigSchema>;

/**
 * Redis Configuration Manager
 * Provides centralized Redis configuration and connection management
 */
export class RedisConfigManager {
  private static instance: RedisConfigManager | null = null;
  private redisClients: Map<string, Redis | Cluster> = new Map();
  private logger = createServiceLogger('redis-config');

  private constructor() {}

  /**
   * Singleton instance getter
   */
  public static getInstance(): RedisConfigManager {
    if (!RedisConfigManager.instance) {
      RedisConfigManager.instance = new RedisConfigManager();
    }
    return RedisConfigManager.instance;
  }

  /**
   * Create Redis client with centralized configuration
   */
  public createRedisClient(
    config: RedisConfig,
    options: {
      clientId?: string;
      cluster?: RedisClusterConfig;
      pool?: Partial<RedisPoolConfig>;
      keyPrefix?: string;
      enableReadyCheck?: boolean;
    } = {}
  ): Redis | Cluster {
    const {
      clientId = 'default',
      cluster,
      pool = {},
      keyPrefix,
      enableReadyCheck = true,
    } = options;

    // Return existing client if available
    if (this.redisClients.has(clientId)) {
      return this.redisClients.get(clientId)!;
    }

    let client: Redis | Cluster;

    // Create cluster client if cluster configuration is provided
    if (cluster?.enabled && cluster.nodes.length > 0) {
      client = this.createClusterClient(config, cluster, pool, keyPrefix);
    } else {
      client = this.createStandardClient(config, pool, keyPrefix, enableReadyCheck);
    }

    // Setup event listeners
    this.setupRedisEventListeners(client, clientId);

    // Cache client
    this.redisClients.set(clientId, client);

    this.logger.info('Redis client created', {
      clientId,
      type: cluster?.enabled ? 'cluster' : 'standard',
      host: config.REDIS_HOST,
      port: config.REDIS_PORT,
      keyPrefix: keyPrefix || config.REDIS_KEY_PREFIX,
    });

    return client;
  }

  /**
   * Get existing Redis client
   */
  public getRedisClient(clientId: string = 'default'): Redis | Cluster {
    const client = this.redisClients.get(clientId);
    if (!client) {
      throw new Error(`Redis client '${clientId}' not found. Create it first.`);
    }
    return client;
  }

  /**
   * Connect to Redis with health checks
   */
  public async connectRedis(
    clientId: string = 'default',
    options: {
      maxRetries?: number;
      retryDelay?: number;
      healthCheck?: boolean;
    } = {}
  ): Promise<void> {
    const {
      maxRetries = 3,
      retryDelay = 2000,
      healthCheck = true,
    } = options;

    const client = this.getRedisClient(clientId);
    let retries = 0;

    while (retries < maxRetries) {
      try {
        await client.connect();
        
        if (healthCheck) {
          // Perform basic health check
          await client.ping();
        }

        this.logger.info('Redis connected successfully', {
          clientId,
          retries,
          healthCheck,
        });
        return;
      } catch (error) {
        retries++;
        this.logger.warn('Redis connection attempt failed', {
          clientId,
          retries,
          maxRetries,
          error: error instanceof Error ? error.message : error,
        });

        if (retries >= maxRetries) {
          this.logger.error('Redis connection failed after max retries', {
            clientId,
            maxRetries,
            error: error instanceof Error ? error.message : error,
          });
          throw error;
        }

        // Wait before retrying
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
      }
    }
  }

  /**
   * Disconnect from Redis
   */
  public async disconnectRedis(clientId: string = 'default'): Promise<void> {
    const client = this.redisClients.get(clientId);
    if (client) {
      await client.disconnect();
      this.redisClients.delete(clientId);
      this.logger.info('Redis disconnected', { clientId });
    }
  }

  /**
   * Disconnect all Redis connections
   */
  public async disconnectAll(): Promise<void> {
    const disconnectPromises = Array.from(this.redisClients.entries()).map(
      async ([clientId, client]) => {
        try {
          await client.disconnect();
          this.logger.info('Redis disconnected', { clientId });
        } catch (error) {
          this.logger.error('Error disconnecting Redis', {
            clientId,
            error: error instanceof Error ? error.message : error,
          });
        }
      }
    );

    await Promise.all(disconnectPromises);
    this.redisClients.clear();
    this.logger.info('All Redis connections disconnected');
  }

  /**
   * Check Redis health
   */
  public async checkHealth(clientId: string = 'default'): Promise<{
    healthy: boolean;
    latency?: number;
    memory?: { used: string; peak: string };
    error?: string;
  }> {
    try {
      const client = this.getRedisClient(clientId);
      const startTime = Date.now();
      
      await client.ping();
      
      const latency = Date.now() - startTime;
      
      // Get memory info
      const info = await client.info('memory');
      const memoryMatch = info.match(/used_memory_human:([^\r\n]+)/);
      const peakMatch = info.match(/used_memory_peak_human:([^\r\n]+)/);
      
      const memory = {
        used: memoryMatch?.[1] || 'unknown',
        peak: peakMatch?.[1] || 'unknown',
      };
      
      return { healthy: true, latency, memory };
    } catch (error) {
      return {
        healthy: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Create standard Redis client
   */
  private createStandardClient(
    config: RedisConfig,
    pool: Partial<RedisPoolConfig>,
    keyPrefix?: string,
    enableReadyCheck: boolean = true
  ): Redis {
    const redisOptions: RedisOptions = {
      host: config.REDIS_HOST,
      port: config.REDIS_PORT,
      password: config.REDIS_PASSWORD,
      db: config.REDIS_DB,
      keyPrefix: keyPrefix || config.REDIS_KEY_PREFIX,
      enableReadyCheck,
      maxRetriesPerRequest: config.REDIS_MAX_RETRIES,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, config.REDIS_RETRY_DELAY_MS);
        return delay;
      },
      // Pool configuration
      family: pool.family ? parseInt(pool.family) : 4,
      keepAlive: pool.keepAlive ?? true,
      connectTimeout: pool.connectTimeout ?? 10000,
      commandTimeout: pool.commandTimeout ?? 5000,
      lazyConnect: pool.lazyConnect ?? true,
      retryDelayOnFailover: pool.retryDelayOnFailover ?? 100,
      enableAutoPipelining: pool.enableAutoPipelining ?? true,
    };

    // Add Redis URL if provided
    if (config.REDIS_URL) {
      return new Redis(config.REDIS_URL, redisOptions);
    }

    return new Redis(redisOptions);
  }

  /**
   * Create Redis cluster client
   */
  private createClusterClient(
    config: RedisConfig,
    cluster: RedisClusterConfig,
    pool: Partial<RedisPoolConfig>,
    keyPrefix?: string
  ): Cluster {
    const clusterOptions = {
      enableOfflineQueue: cluster.options?.enableOfflineQueue ?? false,
      redisOptions: {
        password: config.REDIS_PASSWORD,
        keyPrefix: keyPrefix || config.REDIS_KEY_PREFIX,
        // Pool configuration
        family: pool.family ? parseInt(pool.family) : 4,
        keepAlive: pool.keepAlive ?? true,
        connectTimeout: pool.connectTimeout ?? 10000,
        commandTimeout: pool.commandTimeout ?? 5000,
        maxRetriesPerRequest: config.REDIS_MAX_RETRIES,
        retryDelayOnFailover: pool.retryDelayOnFailover ?? 100,
        ...cluster.options?.redisOptions,
      },
    };

    return new Cluster(cluster.nodes, clusterOptions);
  }

  /**
   * Setup Redis event listeners
   */
  private setupRedisEventListeners(
    client: Redis | Cluster,
    clientId: string
  ): void {
    client.on('connect', () => {
      this.logger.info('Redis client connected', { clientId });
    });

    client.on('ready', () => {
      this.logger.info('Redis client ready', { clientId });
    });

    client.on('error', (error) => {
      this.logger.error('Redis client error', {
        clientId,
        error: error.message,
        stack: error.stack,
      });
    });

    client.on('close', () => {
      this.logger.warn('Redis client connection closed', { clientId });
    });

    client.on('reconnecting', () => {
      this.logger.info('Redis client reconnecting', { clientId });
    });

    client.on('end', () => {
      this.logger.warn('Redis client connection ended', { clientId });
    });
  }
}

// Convenience functions
export const redisConfig = RedisConfigManager.getInstance();

/**
 * Create Redis client with default configuration
 */
export function createRedisClient(
  config: RedisConfig,
  options?: Parameters<typeof redisConfig.createRedisClient>[1]
): Redis | Cluster {
  return redisConfig.createRedisClient(config, options);
}

/**
 * Connect to Redis with retry logic
 */
export async function connectRedis(
  clientId?: string,
  options?: Parameters<typeof redisConfig.connectRedis>[1]
): Promise<void> {
  return redisConfig.connectRedis(clientId, options);
}

/**
 * Disconnect from Redis
 */
export async function disconnectRedis(clientId?: string): Promise<void> {
  return redisConfig.disconnectRedis(clientId);
}

/**
 * Check Redis health
 */
export async function checkRedisHealth(
  clientId?: string
): Promise<ReturnType<typeof redisConfig.checkHealth>> {
  return redisConfig.checkHealth(clientId);
}

// Export types
export type { RedisClusterConfig, RedisPoolConfig };