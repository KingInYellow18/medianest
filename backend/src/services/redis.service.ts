import Redis from 'ioredis';
import { logger } from '../utils/logger';
import { AppError } from '../utils/errors';

export interface RedisConfig {
  url?: string;
  host?: string;
  port?: number;
  password?: string;
  db?: number;
  maxRetriesPerRequest?: number;
  retryDelayOnFailover?: number;
  lazyConnect?: boolean;
}

export interface OAuthStateData {
  state: string;
  provider: 'github' | 'google';
  redirectUri: string;
  createdAt: Date;
  ipAddress: string;
  userAgent: string;
}

export interface TwoFactorChallengeData {
  id: string;
  userId: string;
  method: 'totp' | 'sms';
  code: string;
  hashedCode: string;
  expiresAt: Date;
  verified: boolean;
  attempts: number;
  maxAttempts: number;
  createdAt: Date;
  ipAddress: string;
  userAgent: string;
}

export interface PasswordResetTokenData {
  id: string;
  userId: string;
  token: string;
  hashedToken: string;
  expiresAt: Date;
  used: boolean;
  createdAt: Date;
  ipAddress: string;
  userAgent: string;
}

export interface SessionData {
  userId: string;
  hashedToken: string;
  expiresAt: Date;
  deviceId: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
}

/**
 * Redis service for managing OAuth states, 2FA challenges, password reset tokens, and sessions
 */
export class RedisService {
  private client: Redis;
  private isConnected: boolean = false;

  // Redis key prefixes for different data types
  private static readonly KEY_PREFIXES = {
    OAUTH_STATE: 'oauth:state:',
    TWOFACTOR_CHALLENGE: '2fa:challenge:',
    PASSWORD_RESET: 'pwd:reset:',
    SESSION: 'session:',
    USER_SESSIONS: 'user:sessions:',
    RATE_LIMIT: 'rate:limit:',
    CACHE: 'cache:',
  } as const;

  constructor(config?: RedisConfig) {
    const redisUrl = config?.url || process.env.REDIS_URL || 'redis://localhost:6379';

    try {
      this.client = new Redis(redisUrl, {
        maxRetriesPerRequest: config?.maxRetriesPerRequest || 3,
        retryDelayOnFailover: config?.retryDelayOnFailover || 100,
        lazyConnect: config?.lazyConnect || true,
        // Automatically reconnect
        reconnectOnError: (err) => {
          const targetError = 'READONLY';
          return err.message.includes(targetError);
        },
      });

      this.setupEventHandlers();
    } catch (error) {
      logger.error('Failed to create Redis client', { error, redisUrl });
      throw new AppError('Redis connection failed', 500, 'REDIS_CONNECTION_FAILED');
    }
  }

  /**
   * Setup Redis event handlers
   */
  private setupEventHandlers(): void {
    this.client.on('connect', () => {
      logger.info('Redis client connected');
      this.isConnected = true;
    });

    this.client.on('ready', () => {
      logger.info('Redis client ready');
    });

    this.client.on('error', (error) => {
      logger.error('Redis client error', { error });
      this.isConnected = false;
    });

    this.client.on('close', () => {
      logger.warn('Redis client connection closed');
      this.isConnected = false;
    });

    this.client.on('reconnecting', (delay) => {
      logger.info('Redis client reconnecting', { delay });
    });
  }

  /**
   * Connect to Redis
   */
  async connect(): Promise<void> {
    try {
      await this.client.connect();
      this.isConnected = true;
      logger.info('Redis service connected successfully');
    } catch (error) {
      logger.error('Failed to connect to Redis', { error });
      throw new AppError('Redis connection failed', 500, 'REDIS_CONNECTION_FAILED');
    }
  }

  /**
   * Disconnect from Redis
   */
  async disconnect(): Promise<void> {
    try {
      await this.client.quit();
      this.isConnected = false;
      logger.info('Redis service disconnected');
    } catch (error) {
      logger.error('Failed to disconnect from Redis', { error });
    }
  }

  /**
   * Check if Redis is connected
   */
  isHealthy(): boolean {
    return this.isConnected;
  }

  /**
   * Ping Redis to check connectivity
   */
  async ping(): Promise<boolean> {
    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch (error) {
      logger.error('Redis ping failed', { error });
      return false;
    }
  }

  /**
   * Get Redis info
   */
  async getInfo(): Promise<string> {
    try {
      return await this.client.info();
    } catch (error) {
      logger.error('Failed to get Redis info', { error });
      throw new AppError('Redis info failed', 500, 'REDIS_INFO_FAILED');
    }
  }

  // ===================
  // OAuth State Methods
  // ===================

  /**
   * Store OAuth state with TTL (10 minutes default)
   */
  async setOAuthState(
    state: string,
    data: OAuthStateData,
    ttlSeconds: number = 600
  ): Promise<void> {
    try {
      const key = `${RedisService.KEY_PREFIXES.OAUTH_STATE}${state}`;
      const serializedData = JSON.stringify({
        ...data,
        createdAt: data.createdAt.toISOString(),
      });

      await this.client.setex(key, ttlSeconds, serializedData);
      logger.debug('OAuth state stored in Redis', { state, ttlSeconds });
    } catch (error) {
      logger.error('Failed to store OAuth state', { error, state });
      throw new AppError('Failed to store OAuth state', 500, 'REDIS_OAUTH_STORE_FAILED');
    }
  }

  /**
   * Get OAuth state
   */
  async getOAuthState(state: string): Promise<OAuthStateData | null> {
    try {
      const key = `${RedisService.KEY_PREFIXES.OAUTH_STATE}${state}`;
      const data = await this.client.get(key);

      if (!data) {
        return null;
      }

      const parsed = JSON.parse(data);
      return {
        ...parsed,
        createdAt: new Date(parsed.createdAt),
      };
    } catch (error) {
      logger.error('Failed to get OAuth state', { error, state });
      return null;
    }
  }

  /**
   * Delete OAuth state
   */
  async deleteOAuthState(state: string): Promise<boolean> {
    try {
      const key = `${RedisService.KEY_PREFIXES.OAUTH_STATE}${state}`;
      const result = await this.client.del(key);
      return result === 1;
    } catch (error) {
      logger.error('Failed to delete OAuth state', { error, state });
      return false;
    }
  }

  /**
   * Get all OAuth states (for cleanup/monitoring)
   */
  async getAllOAuthStates(): Promise<Array<{ state: string; data: OAuthStateData }>> {
    try {
      const pattern = `${RedisService.KEY_PREFIXES.OAUTH_STATE}*`;
      const keys = await this.client.keys(pattern);

      const states: Array<{ state: string; data: OAuthStateData }> = [];

      for (const key of keys) {
        const data = await this.client.get(key);
        if (data) {
          const parsed = JSON.parse(data);
          states.push({
            state: key.replace(RedisService.KEY_PREFIXES.OAUTH_STATE, ''),
            data: {
              ...parsed,
              createdAt: new Date(parsed.createdAt),
            },
          });
        }
      }

      return states;
    } catch (error) {
      logger.error('Failed to get all OAuth states', { error });
      return [];
    }
  }

  // ========================
  // Two-Factor Auth Methods
  // ========================

  /**
   * Store 2FA challenge with TTL (5 minutes default)
   */
  async set2FAChallenge(
    challengeId: string,
    data: TwoFactorChallengeData,
    ttlSeconds: number = 300
  ): Promise<void> {
    try {
      const key = `${RedisService.KEY_PREFIXES.TWOFACTOR_CHALLENGE}${challengeId}`;
      const serializedData = JSON.stringify({
        ...data,
        expiresAt: data.expiresAt.toISOString(),
        createdAt: data.createdAt.toISOString(),
      });

      await this.client.setex(key, ttlSeconds, serializedData);
      logger.debug('2FA challenge stored in Redis', { challengeId, ttlSeconds });
    } catch (error) {
      logger.error('Failed to store 2FA challenge', { error, challengeId });
      throw new AppError('Failed to store 2FA challenge', 500, 'REDIS_2FA_STORE_FAILED');
    }
  }

  /**
   * Get 2FA challenge
   */
  async get2FAChallenge(challengeId: string): Promise<TwoFactorChallengeData | null> {
    try {
      const key = `${RedisService.KEY_PREFIXES.TWOFACTOR_CHALLENGE}${challengeId}`;
      const data = await this.client.get(key);

      if (!data) {
        return null;
      }

      const parsed = JSON.parse(data);
      return {
        ...parsed,
        expiresAt: new Date(parsed.expiresAt),
        createdAt: new Date(parsed.createdAt),
      };
    } catch (error) {
      logger.error('Failed to get 2FA challenge', { error, challengeId });
      return null;
    }
  }

  /**
   * Update 2FA challenge (for incrementing attempts)
   */
  async update2FAChallenge(challengeId: string, data: TwoFactorChallengeData): Promise<void> {
    try {
      const key = `${RedisService.KEY_PREFIXES.TWOFACTOR_CHALLENGE}${challengeId}`;

      // Get remaining TTL
      const ttl = await this.client.ttl(key);
      if (ttl <= 0) {
        throw new AppError('Challenge expired', 400, 'CHALLENGE_EXPIRED');
      }

      const serializedData = JSON.stringify({
        ...data,
        expiresAt: data.expiresAt.toISOString(),
        createdAt: data.createdAt.toISOString(),
      });

      await this.client.setex(key, ttl, serializedData);
      logger.debug('2FA challenge updated in Redis', { challengeId });
    } catch (error) {
      logger.error('Failed to update 2FA challenge', { error, challengeId });
      throw new AppError('Failed to update 2FA challenge', 500, 'REDIS_2FA_UPDATE_FAILED');
    }
  }

  /**
   * Delete 2FA challenge
   */
  async delete2FAChallenge(challengeId: string): Promise<boolean> {
    try {
      const key = `${RedisService.KEY_PREFIXES.TWOFACTOR_CHALLENGE}${challengeId}`;
      const result = await this.client.del(key);
      return result === 1;
    } catch (error) {
      logger.error('Failed to delete 2FA challenge', { error, challengeId });
      return false;
    }
  }

  /**
   * Find active 2FA challenge for user
   */
  async findActive2FAChallenge(
    userId: string
  ): Promise<{ challengeId: string; data: TwoFactorChallengeData } | null> {
    try {
      const pattern = `${RedisService.KEY_PREFIXES.TWOFACTOR_CHALLENGE}*`;
      const keys = await this.client.keys(pattern);

      for (const key of keys) {
        const data = await this.client.get(key);
        if (data) {
          const parsed = JSON.parse(data);
          if (parsed.userId === userId && new Date() < new Date(parsed.expiresAt)) {
            return {
              challengeId: key.replace(RedisService.KEY_PREFIXES.TWOFACTOR_CHALLENGE, ''),
              data: {
                ...parsed,
                expiresAt: new Date(parsed.expiresAt),
                createdAt: new Date(parsed.createdAt),
              },
            };
          }
        }
      }

      return null;
    } catch (error) {
      logger.error('Failed to find active 2FA challenge', { error, userId });
      return null;
    }
  }

  // =========================
  // Password Reset Methods
  // =========================

  /**
   * Store password reset token with TTL (15 minutes default)
   */
  async setPasswordResetToken(
    tokenId: string,
    data: PasswordResetTokenData,
    ttlSeconds: number = 900
  ): Promise<void> {
    try {
      const key = `${RedisService.KEY_PREFIXES.PASSWORD_RESET}${tokenId}`;
      const serializedData = JSON.stringify({
        ...data,
        expiresAt: data.expiresAt.toISOString(),
        createdAt: data.createdAt.toISOString(),
      });

      await this.client.setex(key, ttlSeconds, serializedData);
      logger.debug('Password reset token stored in Redis', { tokenId, ttlSeconds });
    } catch (error) {
      logger.error('Failed to store password reset token', { error, tokenId });
      throw new AppError(
        'Failed to store password reset token',
        500,
        'REDIS_PWD_RESET_STORE_FAILED'
      );
    }
  }

  /**
   * Get password reset token
   */
  async getPasswordResetToken(tokenId: string): Promise<PasswordResetTokenData | null> {
    try {
      const key = `${RedisService.KEY_PREFIXES.PASSWORD_RESET}${tokenId}`;
      const data = await this.client.get(key);

      if (!data) {
        return null;
      }

      const parsed = JSON.parse(data);
      return {
        ...parsed,
        expiresAt: new Date(parsed.expiresAt),
        createdAt: new Date(parsed.createdAt),
      };
    } catch (error) {
      logger.error('Failed to get password reset token', { error, tokenId });
      return null;
    }
  }

  /**
   * Update password reset token (for marking as used)
   */
  async updatePasswordResetToken(tokenId: string, data: PasswordResetTokenData): Promise<void> {
    try {
      const key = `${RedisService.KEY_PREFIXES.PASSWORD_RESET}${tokenId}`;

      // Get remaining TTL
      const ttl = await this.client.ttl(key);
      if (ttl <= 0) {
        throw new AppError('Reset token expired', 400, 'RESET_TOKEN_EXPIRED');
      }

      const serializedData = JSON.stringify({
        ...data,
        expiresAt: data.expiresAt.toISOString(),
        createdAt: data.createdAt.toISOString(),
      });

      await this.client.setex(key, ttl, serializedData);
      logger.debug('Password reset token updated in Redis', { tokenId });
    } catch (error) {
      logger.error('Failed to update password reset token', { error, tokenId });
      throw new AppError(
        'Failed to update password reset token',
        500,
        'REDIS_PWD_RESET_UPDATE_FAILED'
      );
    }
  }

  /**
   * Delete password reset token
   */
  async deletePasswordResetToken(tokenId: string): Promise<boolean> {
    try {
      const key = `${RedisService.KEY_PREFIXES.PASSWORD_RESET}${tokenId}`;
      const result = await this.client.del(key);
      return result === 1;
    } catch (error) {
      logger.error('Failed to delete password reset token', { error, tokenId });
      return false;
    }
  }

  /**
   * Find active password reset token for user
   */
  async findActivePasswordResetToken(
    userId: string
  ): Promise<{ tokenId: string; data: PasswordResetTokenData } | null> {
    try {
      const pattern = `${RedisService.KEY_PREFIXES.PASSWORD_RESET}*`;
      const keys = await this.client.keys(pattern);

      for (const key of keys) {
        const data = await this.client.get(key);
        if (data) {
          const parsed = JSON.parse(data);
          if (parsed.userId === userId && !parsed.used && new Date() < new Date(parsed.expiresAt)) {
            return {
              tokenId: key.replace(RedisService.KEY_PREFIXES.PASSWORD_RESET, ''),
              data: {
                ...parsed,
                expiresAt: new Date(parsed.expiresAt),
                createdAt: new Date(parsed.createdAt),
              },
            };
          }
        }
      }

      return null;
    } catch (error) {
      logger.error('Failed to find active password reset token', { error, userId });
      return null;
    }
  }

  // =================
  // Session Methods
  // =================

  /**
   * Store session data
   */
  async setSession(
    sessionId: string,
    data: SessionData,
    ttlSeconds: number = 86400
  ): Promise<void> {
    try {
      const sessionKey = `${RedisService.KEY_PREFIXES.SESSION}${sessionId}`;
      const userSessionsKey = `${RedisService.KEY_PREFIXES.USER_SESSIONS}${data.userId}`;

      const serializedData = JSON.stringify({
        ...data,
        expiresAt: data.expiresAt.toISOString(),
      });

      // Store session data
      await this.client.setex(sessionKey, ttlSeconds, serializedData);

      // Add to user sessions set
      await this.client.sadd(userSessionsKey, sessionId);
      await this.client.expire(userSessionsKey, ttlSeconds);

      logger.debug('Session stored in Redis', { sessionId, userId: data.userId, ttlSeconds });
    } catch (error) {
      logger.error('Failed to store session', { error, sessionId });
      throw new AppError('Failed to store session', 500, 'REDIS_SESSION_STORE_FAILED');
    }
  }

  /**
   * Get session data
   */
  async getSession(sessionId: string): Promise<SessionData | null> {
    try {
      const key = `${RedisService.KEY_PREFIXES.SESSION}${sessionId}`;
      const data = await this.client.get(key);

      if (!data) {
        return null;
      }

      const parsed = JSON.parse(data);
      return {
        ...parsed,
        expiresAt: new Date(parsed.expiresAt),
      };
    } catch (error) {
      logger.error('Failed to get session', { error, sessionId });
      return null;
    }
  }

  /**
   * Delete session
   */
  async deleteSession(sessionId: string): Promise<boolean> {
    try {
      // Get session data first to remove from user sessions
      const sessionData = await this.getSession(sessionId);

      const sessionKey = `${RedisService.KEY_PREFIXES.SESSION}${sessionId}`;
      const result = await this.client.del(sessionKey);

      // Remove from user sessions set
      if (sessionData) {
        const userSessionsKey = `${RedisService.KEY_PREFIXES.USER_SESSIONS}${sessionData.userId}`;
        await this.client.srem(userSessionsKey, sessionId);
      }

      return result === 1;
    } catch (error) {
      logger.error('Failed to delete session', { error, sessionId });
      return false;
    }
  }

  /**
   * Delete all sessions for a user
   */
  async deleteUserSessions(userId: string): Promise<number> {
    try {
      const userSessionsKey = `${RedisService.KEY_PREFIXES.USER_SESSIONS}${userId}`;
      const sessionIds = await this.client.smembers(userSessionsKey);

      let deletedCount = 0;

      for (const sessionId of sessionIds) {
        const sessionKey = `${RedisService.KEY_PREFIXES.SESSION}${sessionId}`;
        const result = await this.client.del(sessionKey);
        if (result === 1) {
          deletedCount++;
        }
      }

      // Clear user sessions set
      await this.client.del(userSessionsKey);

      logger.debug('User sessions deleted from Redis', { userId, deletedCount });
      return deletedCount;
    } catch (error) {
      logger.error('Failed to delete user sessions', { error, userId });
      return 0;
    }
  }

  // ===================
  // Rate Limiting Methods
  // ===================

  /**
   * Increment rate limit counter
   */
  async incrementRateLimit(
    key: string,
    windowSeconds: number = 60,
    maxAttempts: number = 5
  ): Promise<{ count: number; remaining: number; resetTime: Date }> {
    try {
      const rateLimitKey = `${RedisService.KEY_PREFIXES.RATE_LIMIT}${key}`;

      // Use multi for atomic operations
      const multi = this.client.multi();
      multi.incr(rateLimitKey);
      multi.ttl(rateLimitKey);
      multi.expire(rateLimitKey, windowSeconds);

      const results = await multi.exec();

      if (!results || results.some(([err]) => err)) {
        throw new Error('Rate limit multi operation failed');
      }

      const count = results[0][1] as number;
      const ttl = results[1][1] as number;

      // If this is the first request, set the TTL
      if (count === 1 && ttl === -1) {
        await this.client.expire(rateLimitKey, windowSeconds);
      }

      const remaining = Math.max(0, maxAttempts - count);
      const resetTime = new Date(Date.now() + (ttl > 0 ? ttl * 1000 : windowSeconds * 1000));

      return { count, remaining, resetTime };
    } catch (error) {
      logger.error('Failed to increment rate limit', { error, key });
      throw new AppError('Rate limit operation failed', 500, 'REDIS_RATE_LIMIT_FAILED');
    }
  }

  /**
   * Get rate limit status
   */
  async getRateLimit(
    key: string,
    maxAttempts: number = 5
  ): Promise<{ count: number; remaining: number; resetTime: Date | null }> {
    try {
      const rateLimitKey = `${RedisService.KEY_PREFIXES.RATE_LIMIT}${key}`;

      const multi = this.client.multi();
      multi.get(rateLimitKey);
      multi.ttl(rateLimitKey);

      const results = await multi.exec();

      if (!results || results.some(([err]) => err)) {
        return { count: 0, remaining: maxAttempts, resetTime: null };
      }

      const count = parseInt(results[0][1] as string) || 0;
      const ttl = results[1][1] as number;

      const remaining = Math.max(0, maxAttempts - count);
      const resetTime = ttl > 0 ? new Date(Date.now() + ttl * 1000) : null;

      return { count, remaining, resetTime };
    } catch (error) {
      logger.error('Failed to get rate limit', { error, key });
      return { count: 0, remaining: maxAttempts, resetTime: null };
    }
  }

  // ===============
  // Cache Methods
  // ===============

  /**
   * Set cache value with TTL
   */
  async setCache(key: string, value: any, ttlSeconds: number = 3600): Promise<void> {
    try {
      const cacheKey = `${RedisService.KEY_PREFIXES.CACHE}${key}`;
      const serializedValue = JSON.stringify(value);

      await this.client.setex(cacheKey, ttlSeconds, serializedValue);
      logger.debug('Cache value stored in Redis', { key, ttlSeconds });
    } catch (error) {
      logger.error('Failed to store cache value', { error, key });
      throw new AppError('Failed to store cache value', 500, 'REDIS_CACHE_STORE_FAILED');
    }
  }

  /**
   * Get cache value
   */
  async getCache<T = any>(key: string): Promise<T | null> {
    try {
      const cacheKey = `${RedisService.KEY_PREFIXES.CACHE}${key}`;
      const data = await this.client.get(cacheKey);

      if (!data) {
        return null;
      }

      return JSON.parse(data) as T;
    } catch (error) {
      logger.error('Failed to get cache value', { error, key });
      return null;
    }
  }

  /**
   * Delete cache value
   */
  async deleteCache(key: string): Promise<boolean> {
    try {
      const cacheKey = `${RedisService.KEY_PREFIXES.CACHE}${key}`;
      const result = await this.client.del(cacheKey);
      return result === 1;
    } catch (error) {
      logger.error('Failed to delete cache value', { error, key });
      return false;
    }
  }

  // ===================
  // Utility Methods
  // ===================

  /**
   * Get Redis memory usage statistics
   */
  async getMemoryStats(): Promise<{
    usedMemory: string;
    maxMemory: string;
    memoryUsagePercent: number;
    keyCount: number;
  }> {
    try {
      const info = await this.client.info('memory');
      const keyCount = await this.client.dbsize();

      const usedMemoryMatch = info.match(/used_memory_human:(.+)/);
      const maxMemoryMatch = info.match(/maxmemory_human:(.+)/);
      const usedMemoryBytesMatch = info.match(/used_memory:(\d+)/);
      const maxMemoryBytesMatch = info.match(/maxmemory:(\d+)/);

      const usedMemory = usedMemoryMatch ? usedMemoryMatch[1].trim() : 'unknown';
      const maxMemory = maxMemoryMatch ? maxMemoryMatch[1].trim() : 'unlimited';

      let memoryUsagePercent = 0;
      if (usedMemoryBytesMatch && maxMemoryBytesMatch) {
        const used = parseInt(usedMemoryBytesMatch[1]);
        const max = parseInt(maxMemoryBytesMatch[1]);
        memoryUsagePercent = max > 0 ? (used / max) * 100 : 0;
      }

      return {
        usedMemory,
        maxMemory,
        memoryUsagePercent,
        keyCount,
      };
    } catch (error) {
      logger.error('Failed to get Redis memory stats', { error });
      throw new AppError('Failed to get Redis memory stats', 500, 'REDIS_MEMORY_STATS_FAILED');
    }
  }

  /**
   * Clean up expired keys manually (Redis handles this automatically)
   */
  async cleanup(): Promise<{ deletedKeys: number }> {
    try {
      // Get all keys with our prefixes
      const patterns = Object.values(RedisService.KEY_PREFIXES);
      let totalDeleted = 0;

      for (const prefix of patterns) {
        const keys = await this.client.keys(`${prefix}*`);

        for (const key of keys) {
          const ttl = await this.client.ttl(key);
          // If TTL is -2, key doesn't exist; if -1, key has no expiry
          if (ttl === -2) {
            const result = await this.client.del(key);
            totalDeleted += result;
          }
        }
      }

      logger.info('Redis cleanup completed', { deletedKeys: totalDeleted });
      return { deletedKeys: totalDeleted };
    } catch (error) {
      logger.error('Redis cleanup failed', { error });
      throw new AppError('Redis cleanup failed', 500, 'REDIS_CLEANUP_FAILED');
    }
  }
}
