/**
 * Redis Test Helper
 * 
 * Provides utilities for Redis testing including:
 * - Session management testing
 * - Cache testing and validation
 * - Pub/Sub testing
 * - Rate limiting testing
 * - Connection error simulation
 */

import Redis from 'ioredis';

export interface SessionData {
  userId: string;
  role: string;
  loginTime: string;
  lastActivity: string;
  metadata?: Record<string, any>;
}

export interface CacheEntry {
  key: string;
  value: any;
  ttl?: number;
  metadata?: Record<string, any>;
}

export class RedisTestHelper {
  private redis: Redis;
  private isConnectionBroken = false;
  private subscribers: Map<string, Redis> = new Map();
  private messageHandlers: Map<string, Function[]> = new Map();

  constructor(redisClient: Redis) {
    this.redis = redisClient;
  }

  /**
   * Clear all test data from Redis
   */
  async clearTestData(): Promise<void> {
    if (this.isConnectionBroken) {
      return; // Can't clear if connection is broken
    }

    try {
      // Get all test-related keys
      const keys = await this.redis.keys('test:*');
      const sessionKeys = await this.redis.keys('session:*');
      const cacheKeys = await this.redis.keys('cache:*');
      const rateLimitKeys = await this.redis.keys('rate_limit:*');
      const notificationKeys = await this.redis.keys('notification:*');

      const allKeys = [...keys, ...sessionKeys, ...cacheKeys, ...rateLimitKeys, ...notificationKeys];

      if (allKeys.length > 0) {
        await this.redis.del(...allKeys);
        console.log(`🧹 Cleared ${allKeys.length} Redis test keys`);
      }
    } catch (error) {
      console.error('❌ Failed to clear Redis test data:', error);
      throw error;
    }
  }

  /**
   * Create a test session
   */
  async createTestSession(userId: string, sessionData: Partial<SessionData>): Promise<string> {
    if (this.isConnectionBroken) {
      throw new Error('Redis connection is broken');
    }

    const sessionKey = `session:${userId}`;
    const fullSessionData: SessionData = {
      userId,
      role: sessionData.role || 'user',
      loginTime: sessionData.loginTime || new Date().toISOString(),
      lastActivity: sessionData.lastActivity || new Date().toISOString(),
      metadata: sessionData.metadata || {}
    };

    const ttl = 3600; // 1 hour default
    await this.redis.setex(sessionKey, ttl, JSON.stringify(fullSessionData));

    return sessionKey;
  }

  /**
   * Get session data
   */
  async getSession(userId: string): Promise<SessionData | null> {
    if (this.isConnectionBroken) {
      throw new Error('Redis connection is broken');
    }

    const sessionKey = `session:${userId}`;
    const sessionData = await this.redis.get(sessionKey);
    
    if (!sessionData) {
      return null;
    }

    return JSON.parse(sessionData);
  }

  /**
   * Update session activity
   */
  async updateSessionActivity(userId: string): Promise<void> {
    if (this.isConnectionBroken) {
      throw new Error('Redis connection is broken');
    }

    const sessionData = await this.getSession(userId);
    if (!sessionData) {
      throw new Error('Session not found');
    }

    sessionData.lastActivity = new Date().toISOString();
    
    const sessionKey = `session:${userId}`;
    const ttl = await this.redis.ttl(sessionKey);
    
    await this.redis.setex(sessionKey, Math.max(ttl, 3600), JSON.stringify(sessionData));
  }

  /**
   * Destroy session
   */
  async destroySession(userId: string): Promise<boolean> {
    if (this.isConnectionBroken) {
      throw new Error('Redis connection is broken');
    }

    const sessionKey = `session:${userId}`;
    const result = await this.redis.del(sessionKey);
    return result > 0;
  }

  /**
   * Test cache operations
   */
  async testCacheOperations(entries: CacheEntry[]): Promise<{
    setResults: boolean[];
    getResults: (any | null)[];
    hitRate: number;
  }> {
    if (this.isConnectionBroken) {
      throw new Error('Redis connection is broken');
    }

    const setResults: boolean[] = [];
    const getResults: (any | null)[] = [];

    // Set cache entries
    for (const entry of entries) {
      try {
        if (entry.ttl) {
          await this.redis.setex(entry.key, entry.ttl, JSON.stringify(entry.value));
        } else {
          await this.redis.set(entry.key, JSON.stringify(entry.value));
        }
        setResults.push(true);
      } catch (error) {
        setResults.push(false);
      }
    }

    // Wait a bit to test TTL if applicable
    await new Promise(resolve => setTimeout(resolve, 100));

    // Get cache entries
    for (const entry of entries) {
      try {
        const cachedValue = await this.redis.get(entry.key);
        if (cachedValue) {
          getResults.push(JSON.parse(cachedValue));
        } else {
          getResults.push(null);
        }
      } catch (error) {
        getResults.push(null);
      }
    }

    // Calculate hit rate
    const hits = getResults.filter(result => result !== null).length;
    const hitRate = entries.length > 0 ? (hits / entries.length) * 100 : 0;

    return { setResults, getResults, hitRate };
  }

  /**
   * Test cache TTL behavior
   */
  async testCacheTTL(key: string, value: any, ttlSeconds: number): Promise<{
    initialSet: boolean;
    initialGet: any | null;
    afterExpiry: any | null;
    actualTTL: number;
  }> {
    if (this.isConnectionBroken) {
      throw new Error('Redis connection is broken');
    }

    // Set with TTL
    await this.redis.setex(key, ttlSeconds, JSON.stringify(value));
    const initialSet = true;

    // Get initial value
    const initialValue = await this.redis.get(key);
    const initialGet = initialValue ? JSON.parse(initialValue) : null;

    // Get actual TTL
    const actualTTL = await this.redis.ttl(key);

    // Wait for expiry (add small buffer for timing)
    await new Promise(resolve => setTimeout(resolve, (ttlSeconds * 1000) + 100));

    // Check if expired
    const expiredValue = await this.redis.get(key);
    const afterExpiry = expiredValue ? JSON.parse(expiredValue) : null;

    return {
      initialSet,
      initialGet,
      afterExpiry,
      actualTTL
    };
  }

  /**
   * Set up pub/sub subscriber
   */
  async setupSubscriber(channel: string, handler: (message: any) => void): Promise<string> {
    if (this.isConnectionBroken) {
      throw new Error('Redis connection is broken');
    }

    const subscriberKey = `subscriber-${channel}-${Date.now()}`;
    const subscriber = new Redis(this.redis.options);
    
    await subscriber.subscribe(channel);
    
    subscriber.on('message', (receivedChannel, message) => {
      if (receivedChannel === channel) {
        try {
          const parsedMessage = JSON.parse(message);
          handler(parsedMessage);
        } catch (error) {
          handler(message); // Handle non-JSON messages
        }
      }
    });

    this.subscribers.set(subscriberKey, subscriber);
    
    if (!this.messageHandlers.has(channel)) {
      this.messageHandlers.set(channel, []);
    }
    this.messageHandlers.get(channel)!.push(handler);

    return subscriberKey;
  }

  /**
   * Publish message to channel
   */
  async publishMessage(channel: string, message: any): Promise<number> {
    if (this.isConnectionBroken) {
      throw new Error('Redis connection is broken');
    }

    const messageString = typeof message === 'string' ? message : JSON.stringify(message);
    return await this.redis.publish(channel, messageString);
  }

  /**
   * Test pub/sub functionality
   */
  async testPubSub(channel: string, messages: any[]): Promise<{
    publishedCount: number;
    receivedMessages: any[];
    subsciberCount: number;
  }> {
    if (this.isConnectionBroken) {
      throw new Error('Redis connection is broken');
    }

    const receivedMessages: any[] = [];
    let publishedCount = 0;

    // Set up subscriber
    const subscriberKey = await this.setupSubscriber(channel, (message) => {
      receivedMessages.push(message);
    });

    // Wait for subscription to be ready
    await new Promise(resolve => setTimeout(resolve, 100));

    // Publish messages
    for (const message of messages) {
      const result = await this.publishMessage(channel, message);
      if (result > 0) publishedCount++;
    }

    // Wait for messages to be received
    await new Promise(resolve => setTimeout(resolve, 200));

    // Get subscriber count
    const subscriberCount = await this.redis.pubsub('numsub', channel);

    // Cleanup subscriber
    await this.cleanupSubscriber(subscriberKey);

    return {
      publishedCount,
      receivedMessages,
      subsciberCount: subscriberCount[1] as number
    };
  }

  /**
   * Test rate limiting functionality
   */
  async testRateLimit(key: string, limit: number, windowSeconds: number, attempts: number): Promise<{
    allowed: number;
    denied: number;
    finalCount: number;
    ttl: number;
  }> {
    if (this.isConnectionBroken) {
      throw new Error('Redis connection is broken');
    }

    let allowed = 0;
    let denied = 0;

    for (let i = 0; i < attempts; i++) {
      // Simulate rate limiting logic
      const current = await this.redis.incr(key);
      
      if (current === 1) {
        // First request, set expiry
        await this.redis.expire(key, windowSeconds);
      }

      if (current <= limit) {
        allowed++;
      } else {
        denied++;
      }
    }

    const finalCount = await this.redis.get(key);
    const ttl = await this.redis.ttl(key);

    return {
      allowed,
      denied,
      finalCount: parseInt(finalCount || '0'),
      ttl
    };
  }

  /**
   * Test Redis performance
   */
  async testPerformance(operationCount: number = 1000): Promise<{
    setTime: number;
    getTime: number;
    deleteTime: number;
    avgSetTime: number;
    avgGetTime: number;
    avgDeleteTime: number;
  }> {
    if (this.isConnectionBroken) {
      throw new Error('Redis connection is broken');
    }

    const testData = Array.from({ length: operationCount }, (_, i) => ({
      key: `perf-test-${i}`,
      value: { id: i, data: `test-data-${i}`, timestamp: Date.now() }
    }));

    // Test SET operations
    const setStart = Date.now();
    await Promise.all(
      testData.map(item => this.redis.set(item.key, JSON.stringify(item.value)))
    );
    const setTime = Date.now() - setStart;

    // Test GET operations
    const getStart = Date.now();
    await Promise.all(
      testData.map(item => this.redis.get(item.key))
    );
    const getTime = Date.now() - getStart;

    // Test DELETE operations
    const deleteStart = Date.now();
    await Promise.all(
      testData.map(item => this.redis.del(item.key))
    );
    const deleteTime = Date.now() - deleteStart;

    return {
      setTime,
      getTime,
      deleteTime,
      avgSetTime: setTime / operationCount,
      avgGetTime: getTime / operationCount,
      avgDeleteTime: deleteTime / operationCount
    };
  }

  /**
   * Simulate Redis connection error
   */
  async simulateConnectionError(): Promise<void> {
    console.log('💥 Simulating Redis connection error...');
    this.isConnectionBroken = true;
    
    // Disconnect Redis client
    this.redis.disconnect();
  }

  /**
   * Restore Redis connection
   */
  async restoreConnection(): Promise<void> {
    console.log('🔄 Restoring Redis connection...');
    this.isConnectionBroken = false;
    
    // Reconnect Redis client
    await this.redis.connect();
    console.log('✅ Redis connection restored');
  }

  /**
   * Get Redis connection status
   */
  async getConnectionStatus(): Promise<{
    connected: boolean;
    responseTime: number;
  }> {
    if (this.isConnectionBroken) {
      return { connected: false, responseTime: -1 };
    }

    try {
      const start = Date.now();
      await this.redis.ping();
      const responseTime = Date.now() - start;
      
      return { connected: true, responseTime };
    } catch (error) {
      return { connected: false, responseTime: -1 };
    }
  }

  /**
   * Get Redis memory usage information
   */
  async getMemoryInfo(): Promise<{
    usedMemory: number;
    usedMemoryPeak: number;
    totalKeys: number;
    keyspaceHits: number;
    keyspaceMisses: number;
    hitRate: number;
  }> {
    if (this.isConnectionBroken) {
      throw new Error('Redis connection is broken');
    }

    const info = await this.redis.info('memory');
    const stats = await this.redis.info('stats');
    const keyspace = await this.redis.info('keyspace');

    // Parse memory info
    const usedMemory = parseInt(info.match(/used_memory:(\d+)/)?.[1] || '0');
    const usedMemoryPeak = parseInt(info.match(/used_memory_peak:(\d+)/)?.[1] || '0');

    // Parse stats
    const keyspaceHits = parseInt(stats.match(/keyspace_hits:(\d+)/)?.[1] || '0');
    const keyspaceMisses = parseInt(stats.match(/keyspace_misses:(\d+)/)?.[1] || '0');
    const totalRequests = keyspaceHits + keyspaceMisses;
    const hitRate = totalRequests > 0 ? (keyspaceHits / totalRequests) * 100 : 0;

    // Count total keys
    const dbInfo = await this.redis.info('keyspace');
    const totalKeys = dbInfo.split('\n').reduce((total, line) => {
      const match = line.match(/db\d+:keys=(\d+)/);
      return total + (match ? parseInt(match[1]) : 0);
    }, 0);

    return {
      usedMemory,
      usedMemoryPeak,
      totalKeys,
      keyspaceHits,
      keyspaceMisses,
      hitRate
    };
  }

  /**
   * Cleanup subscriber
   */
  async cleanupSubscriber(subscriberKey: string): Promise<void> {
    const subscriber = this.subscribers.get(subscriberKey);
    if (subscriber) {
      await subscriber.disconnect();
      this.subscribers.delete(subscriberKey);
    }
  }

  /**
   * Cleanup and disconnect
   */
  async cleanup(): Promise<void> {
    console.log('🧹 Cleaning up Redis test helper...');
    
    try {
      // Cleanup all subscribers
      for (const [key, subscriber] of this.subscribers.entries()) {
        await subscriber.disconnect();
      }
      this.subscribers.clear();
      this.messageHandlers.clear();

      if (!this.isConnectionBroken) {
        await this.clearTestData();
      }
      
      // Don't disconnect the main Redis client as it might be shared
    } catch (error) {
      console.error('❌ Error during Redis cleanup:', error);
    }
    
    console.log('✅ Redis test helper cleanup complete');
  }
}