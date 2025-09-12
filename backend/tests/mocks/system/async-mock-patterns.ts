/**
 * ASYNC MOCK PATTERNS - PROMISE-BASED SERVICE MOCKING
 *
 * This system provides comprehensive async mock patterns for Promise-based services,
 * ensuring proper async/await behavior and eliminating timing-related test failures.
 *
 * FEATURES:
 * - Promise-based mock implementations with proper async patterns
 * - Timing control for async operations
 * - Error simulation for async failure scenarios
 * - Concurrent async operation handling
 * - Memory-efficient async mock management
 */

import { vi } from 'vitest';

import { logger } from '../../../src/utils/logger';

export interface AsyncMockConfig {
  defaultDelay?: number;
  errorRate?: number;
  timeoutMs?: number;
  enableConcurrency?: boolean;
  enableRetries?: boolean;
  maxRetries?: number;
}

export interface AsyncOperationResult<T> {
  success: boolean;
  data?: T;
  error?: Error;
  duration: number;
  retryCount: number;
  operationId: string;
}

export interface AsyncMockMetrics {
  totalOperations: number;
  successfulOperations: number;
  failedOperations: number;
  averageResponseTime: number;
  concurrentOperations: number;
  retryAttempts: number;
}

/**
 * Async Mock Pattern Factory - Creates Promise-based mocks
 */
export class AsyncMockPatterns {
  private static instance: AsyncMockPatterns;
  private operationMetrics = new Map<string, AsyncMockMetrics>();
  private activeOperations = new Map<string, Promise<any>>();
  private defaultConfig: AsyncMockConfig = {
    defaultDelay: 10,
    errorRate: 0,
    timeoutMs: 5000,
    enableConcurrency: true,
    enableRetries: false,
    maxRetries: 3,
  };

  static getInstance(): AsyncMockPatterns {
    if (!this.instance) {
      this.instance = new AsyncMockPatterns();
    }
    return this.instance;
  }

  /**
   * Create async mock for cache service
   */
  createCacheServiceMock(config: AsyncMockConfig = {}): any {
    const finalConfig = { ...this.defaultConfig, ...config };
    const mockName = 'CacheService';

    this.initializeMetrics(mockName);

    return {
      // Core cache operations
      get: this.createAsyncMethod<any>(
        mockName,
        'get',
        async (key: string) => {
          // Simulate cache miss 30% of the time
          return Math.random() > 0.3
            ? { key, value: `cached-${key}`, timestamp: Date.now() }
            : null;
        },
        finalConfig,
      ),

      set: this.createAsyncMethod<void>(
        mockName,
        'set',
        async (key: string, value: any, ttl?: number) => {
          // Simulate successful set operation
          logger.debug(`Cache set: ${key}`, { ttl });
        },
        finalConfig,
      ),

      del: this.createAsyncMethod<void>(
        mockName,
        'del',
        async (keys: string | string[]) => {
          // Simulate successful delete operation
          const keyCount = Array.isArray(keys) ? keys.length : 1;
          logger.debug(`Cache delete: ${keyCount} keys`);
        },
        finalConfig,
      ),

      // Advanced operations
      getOrSet: this.createAsyncMethod<any>(
        mockName,
        'getOrSet',
        async (key: string, callback: () => Promise<any>, ttl?: number) => {
          // Simulate cache miss, call callback
          const result = await callback();
          logger.debug(`Cache getOrSet: ${key}`, { result, ttl });
          return result;
        },
        finalConfig,
      ),

      invalidatePattern: this.createAsyncMethod<void>(
        mockName,
        'invalidatePattern',
        async (pattern: string) => {
          // Simulate pattern invalidation
          const affectedKeys = Math.floor(Math.random() * 10);
          logger.debug(`Cache invalidatePattern: ${pattern}`, { affectedKeys });
        },
        finalConfig,
      ),

      // Utility operations
      exists: this.createAsyncMethod<boolean>(
        mockName,
        'exists',
        async (key: string) => Math.random() > 0.5,
        finalConfig,
      ),

      ttl: this.createAsyncMethod<number>(
        mockName,
        'ttl',
        async (key: string) => Math.floor(Math.random() * 3600), // Random TTL up to 1 hour
        finalConfig,
      ),

      // Info method with complete interface matching
      getInfo: this.createAsyncMethod<{
        keys: number;
        memory: string;
        connected: boolean;
        uptime: number;
        keyCount: number;
        memoryUsage: string;
      }>(
        mockName,
        'getInfo',
        async () => ({
          keys: Math.floor(Math.random() * 1000),
          memory: `${Math.floor(Math.random() * 100)}MB`,
          connected: true,
          uptime: Math.floor(Math.random() * 86400),
          keyCount: Math.floor(Math.random() * 1000),
          memoryUsage: `${Math.floor(Math.random() * 100)}MB`,
        }),
        finalConfig,
      ),

      clear: this.createAsyncMethod<void>(
        mockName,
        'clear',
        async () => {
          logger.debug('Cache cleared');
        },
        finalConfig,
      ),

      // Test helper methods
      reset: () => this.resetMockMetrics(mockName),
      getMetrics: () => this.getMetrics(mockName),
    };
  }

  /**
   * Create async mock for encryption service
   */
  createEncryptionServiceMock(config: AsyncMockConfig = {}): any {
    const finalConfig = { ...this.defaultConfig, ...config };
    const mockName = 'EncryptionService';

    this.initializeMetrics(mockName);

    return {
      encrypt: this.createAsyncMethod<{
        encrypted: string;
        iv: string;
        authTag: string;
        salt: string;
      }>(
        mockName,
        'encrypt',
        async (text: string) => ({
          encrypted: Buffer.from(text).toString('base64'),
          iv: 'mock-iv-' + Math.random().toString(36).substring(7),
          authTag: 'mock-authtag-' + Math.random().toString(36).substring(7),
          salt: 'mock-salt-' + Math.random().toString(36).substring(7),
        }),
        finalConfig,
      ),

      decrypt: this.createAsyncMethod<string>(
        mockName,
        'decrypt',
        async (data: { encrypted: string; iv: string; authTag: string; salt: string }) => {
          return Buffer.from(data.encrypted, 'base64').toString('utf8');
        },
        finalConfig,
      ),

      encryptForStorage: this.createAsyncMethod<string>(
        mockName,
        'encryptForStorage',
        async (text: string) => {
          return `encrypted:${Buffer.from(text).toString('base64')}:iv:authTag:salt`;
        },
        finalConfig,
      ),

      decryptFromStorage: this.createAsyncMethod<string>(
        mockName,
        'decryptFromStorage',
        async (storedData: string) => {
          const parts = storedData.split(':');
          return Buffer.from(parts[1] || '', 'base64').toString('utf8');
        },
        finalConfig,
      ),

      isEncrypted: vi.fn((data: string) => {
        return data.includes('encrypted:') && data.split(':').length === 5;
      }),

      // Test helpers
      reset: () => this.resetMockMetrics(mockName),
      getMetrics: () => this.getMetrics(mockName),
    };
  }

  /**
   * Create async mock for JWT service
   */
  createJWTServiceMock(config: AsyncMockConfig = {}): any {
    const finalConfig = { ...this.defaultConfig, ...config };
    const mockName = 'JWTService';

    this.initializeMetrics(mockName);

    const mockTokens = new Map<string, any>();

    return {
      generateToken: this.createAsyncMethod<string>(
        mockName,
        'generateToken',
        async (payload: any, rememberMe?: boolean, options?: any) => {
          const token = `mock-jwt-${Date.now()}-${Math.random().toString(36).substring(7)}`;
          mockTokens.set(token, { payload, rememberMe, options, createdAt: Date.now() });
          return token;
        },
        finalConfig,
      ),

      verifyToken: this.createAsyncMethod<any>(
        mockName,
        'verifyToken',
        async (token: string, options?: any) => {
          const tokenData = mockTokens.get(token);
          if (!tokenData) {
            throw new Error('Invalid token');
          }
          return tokenData.payload;
        },
        finalConfig,
      ),

      generateRefreshToken: this.createAsyncMethod<string>(
        mockName,
        'generateRefreshToken',
        async (payload?: any) => {
          return `mock-refresh-${Date.now()}-${Math.random().toString(36).substring(7)}`;
        },
        finalConfig,
      ),

      verifyRefreshToken: this.createAsyncMethod<{ userId: string; sessionId: string }>(
        mockName,
        'verifyRefreshToken',
        async (refreshToken: string) => {
          return {
            userId: 'mock-user-id',
            sessionId: 'mock-session-id',
          };
        },
        finalConfig,
      ),

      getTokenMetadata: this.createAsyncMethod<any>(
        mockName,
        'getTokenMetadata',
        async (token: string) => {
          return {
            userId: 'mock-user-id',
            sessionId: 'mock-session-id',
            deviceId: 'mock-device-id',
            issuedAt: new Date(),
            expiresAt: new Date(Date.now() + 900000), // 15 minutes
            tokenId: 'mock-token-id',
          };
        },
        finalConfig,
      ),

      isTokenExpired: vi.fn((token: string) => false),
      shouldRotateToken: vi.fn((token: string) => false),
      blacklistToken: vi.fn((tokenId: string) => {}),
      isTokenBlacklisted: vi.fn((tokenId: string) => false),
      decodeToken: vi.fn((token: string) => mockTokens.get(token)?.payload || null),

      rotateTokenIfNeeded: this.createAsyncMethod<any>(
        mockName,
        'rotateTokenIfNeeded',
        async (token: string, payload: any, options?: any) => {
          return {
            newToken: `rotated-${Date.now()}`,
            refreshToken: `refresh-${Date.now()}`,
            expiresAt: new Date(Date.now() + 900000),
          };
        },
        finalConfig,
      ),

      // Test helpers
      reset: () => {
        mockTokens.clear();
        this.resetMockMetrics(mockName);
      },
      getMetrics: () => this.getMetrics(mockName),
    };
  }

  /**
   * Create async mock for Redis service
   */
  createRedisServiceMock(config: AsyncMockConfig = {}): any {
    const finalConfig = { ...this.defaultConfig, ...config };
    const mockName = 'RedisService';

    this.initializeMetrics(mockName);

    const mockStorage = new Map<string, any>();

    return {
      // Connection methods
      connect: this.createAsyncMethod<void>(
        mockName,
        'connect',
        async () => {
          logger.debug('Redis mock connected');
        },
        finalConfig,
      ),

      disconnect: this.createAsyncMethod<void>(
        mockName,
        'disconnect',
        async () => {
          logger.debug('Redis mock disconnected');
        },
        finalConfig,
      ),

      ping: this.createAsyncMethod<boolean>(mockName, 'ping', async () => true, finalConfig),

      isHealthy: vi.fn(() => true),

      getInfo: this.createAsyncMethod<string>(
        mockName,
        'getInfo',
        async () => 'redis_version:6.0.0\nused_memory_human:1.2MB',
        finalConfig,
      ),

      // OAuth state methods
      setOAuthState: this.createAsyncMethod<void>(
        mockName,
        'setOAuthState',
        async (state: string, data: any, ttl?: number) => {
          mockStorage.set(`oauth:${state}`, { data, ttl, createdAt: Date.now() });
        },
        finalConfig,
      ),

      getOAuthState: this.createAsyncMethod<any>(
        mockName,
        'getOAuthState',
        async (state: string) => {
          const stored = mockStorage.get(`oauth:${state}`);
          return stored?.data || null;
        },
        finalConfig,
      ),

      deleteOAuthState: this.createAsyncMethod<boolean>(
        mockName,
        'deleteOAuthState',
        async (state: string) => {
          return mockStorage.delete(`oauth:${state}`);
        },
        finalConfig,
      ),

      // Session methods
      setSession: this.createAsyncMethod<void>(
        mockName,
        'setSession',
        async (sessionId: string, data: any, ttl?: number) => {
          mockStorage.set(`session:${sessionId}`, { data, ttl, createdAt: Date.now() });
        },
        finalConfig,
      ),

      getSession: this.createAsyncMethod<any>(
        mockName,
        'getSession',
        async (sessionId: string) => {
          const stored = mockStorage.get(`session:${sessionId}`);
          return stored?.data || null;
        },
        finalConfig,
      ),

      deleteSession: this.createAsyncMethod<boolean>(
        mockName,
        'deleteSession',
        async (sessionId: string) => {
          return mockStorage.delete(`session:${sessionId}`);
        },
        finalConfig,
      ),

      // Cache methods
      setCache: this.createAsyncMethod<void>(
        mockName,
        'setCache',
        async (key: string, value: any, ttl?: number) => {
          mockStorage.set(`cache:${key}`, { value, ttl, createdAt: Date.now() });
        },
        finalConfig,
      ),

      getCache: this.createAsyncMethod<any>(
        mockName,
        'getCache',
        async (key: string) => {
          const stored = mockStorage.get(`cache:${key}`);
          return stored?.value || null;
        },
        finalConfig,
      ),

      deleteCache: this.createAsyncMethod<boolean>(
        mockName,
        'deleteCache',
        async (key: string) => {
          return mockStorage.delete(`cache:${key}`);
        },
        finalConfig,
      ),

      // Memory stats
      getMemoryStats: this.createAsyncMethod<any>(
        mockName,
        'getMemoryStats',
        async () => ({
          usedMemory: '1.2MB',
          maxMemory: 'unlimited',
          memoryUsagePercent: 5.2,
          keyCount: mockStorage.size,
        }),
        finalConfig,
      ),

      // Test helpers
      reset: () => {
        mockStorage.clear();
        this.resetMockMetrics(mockName);
      },
      getMetrics: () => this.getMetrics(mockName),
    };
  }

  /**
   * Create async mock for Auth Security service
   */
  createAuthSecurityServiceMock(config: AsyncMockConfig = {}): any {
    const finalConfig = { ...this.defaultConfig, ...config };
    const mockName = 'AuthSecurityService';

    this.initializeMetrics(mockName);

    const mockBlacklist = new Set<string>();
    const mockSecurityLogs = new Map<string, any[]>();

    return {
      hashIP: vi.fn((ipAddress: string) => {
        return require('crypto')
          .createHash('sha256')
          .update(ipAddress)
          .digest('hex')
          .substring(0, 16);
      }),

      blacklistToken: this.createAsyncMethod<void>(
        mockName,
        'blacklistToken',
        async (token: string, userId: string, reason?: string) => {
          const tokenHash = require('crypto').createHash('sha256').update(token).digest('hex');
          mockBlacklist.add(tokenHash);
          logger.debug(`Token blacklisted: ${userId}`, { reason });
        },
        finalConfig,
      ),

      isTokenBlacklisted: this.createAsyncMethod<boolean>(
        mockName,
        'isTokenBlacklisted',
        async (token: string) => {
          const tokenHash = require('crypto').createHash('sha256').update(token).digest('hex');
          return mockBlacklist.has(tokenHash);
        },
        finalConfig,
      ),

      invalidateUserSessions: this.createAsyncMethod<void>(
        mockName,
        'invalidateUserSessions',
        async (userId: string, reason?: string) => {
          logger.debug(`User sessions invalidated: ${userId}`, { reason });
        },
        finalConfig,
      ),

      logSecurityEvent: this.createAsyncMethod<void>(
        mockName,
        'logSecurityEvent',
        async (event: any) => {
          const userLogs = mockSecurityLogs.get(event.userId) || [];
          userLogs.push({ ...event, timestamp: new Date() });
          mockSecurityLogs.set(event.userId, userLogs);
        },
        finalConfig,
      ),

      validateIPAddress: vi.fn((tokenIP?: string, requestIP?: string) => {
        return !tokenIP || tokenIP === requestIP;
      }),

      generateSecureCacheKey: vi.fn(
        (userId: string, sessionId: string, ipAddress: string, type: string) => {
          const ipHash = require('crypto')
            .createHash('sha256')
            .update(ipAddress)
            .digest('hex')
            .substring(0, 16);
          return `${type}:auth:v3:${userId}:${sessionId}:${ipHash}:${Date.now()}`;
        },
      ),

      detectSuspiciousActivity: this.createAsyncMethod<any>(
        mockName,
        'detectSuspiciousActivity',
        async (userId: string, ipAddress: string, userAgent?: string) => {
          return {
            isSuspicious: Math.random() > 0.9, // 10% chance of being suspicious
            riskScore: Math.floor(Math.random() * 100),
            reasons: [],
          };
        },
        finalConfig,
      ),

      secureLogout: this.createAsyncMethod<void>(
        mockName,
        'secureLogout',
        async (userId: string, sessionId: string, token: string, ipAddress: string) => {
          await this.createAuthSecurityServiceMock().blacklistToken(token, userId, 'user_logout');
          logger.debug(`Secure logout completed: ${userId}`);
        },
        finalConfig,
      ),

      securityWrapper: vi.fn((handler: Function) => {
        return async (req: any, res: any, next: Function) => {
          try {
            await handler(req, res, next);
          } catch (error) {
            logger.error('Security wrapper caught error', { error });
            next(error);
          }
        };
      }),

      // Test helpers
      reset: () => {
        mockBlacklist.clear();
        mockSecurityLogs.clear();
        this.resetMockMetrics(mockName);
      },
      getMetrics: () => this.getMetrics(mockName),
    };
  }

  /**
   * Create async method with proper Promise patterns
   */
  private createAsyncMethod<T>(
    serviceName: string,
    methodName: string,
    implementation: (...args: any[]) => Promise<T>,
    config: AsyncMockConfig,
  ): any {
    const mockFn = vi.fn().mockImplementation(async (...args: any[]) => {
      const operationId = `${serviceName}.${methodName}-${Date.now()}-${Math.random()}`;
      const startTime = performance.now();

      try {
        // Simulate network delay
        if (config.defaultDelay && config.defaultDelay > 0) {
          await this.delay(config.defaultDelay);
        }

        // Simulate error rate
        if (config.errorRate && Math.random() < config.errorRate) {
          throw new Error(`Mock error in ${serviceName}.${methodName}`);
        }

        // Execute implementation
        const result = await implementation(...args);

        // Track metrics
        this.trackOperation(serviceName, methodName, true, performance.now() - startTime);

        return result;
      } catch (error) {
        // Track failed operation
        this.trackOperation(serviceName, methodName, false, performance.now() - startTime);
        throw error;
      }
    });

    return mockFn;
  }

  /**
   * Simple delay utility for simulating async operations
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Track operation metrics
   */
  private trackOperation(
    serviceName: string,
    methodName: string,
    success: boolean,
    duration: number,
  ): void {
    const metrics = this.operationMetrics.get(serviceName) || this.createDefaultMetrics();

    metrics.totalOperations++;
    if (success) {
      metrics.successfulOperations++;
    } else {
      metrics.failedOperations++;
    }

    // Update average response time
    metrics.averageResponseTime = (metrics.averageResponseTime + duration) / 2;

    this.operationMetrics.set(serviceName, metrics);
  }

  /**
   * Initialize metrics for a service
   */
  private initializeMetrics(serviceName: string): void {
    if (!this.operationMetrics.has(serviceName)) {
      this.operationMetrics.set(serviceName, this.createDefaultMetrics());
    }
  }

  /**
   * Create default metrics object
   */
  private createDefaultMetrics(): AsyncMockMetrics {
    return {
      totalOperations: 0,
      successfulOperations: 0,
      failedOperations: 0,
      averageResponseTime: 0,
      concurrentOperations: 0,
      retryAttempts: 0,
    };
  }

  /**
   * Get metrics for a service
   */
  private getMetrics(serviceName: string): AsyncMockMetrics {
    return this.operationMetrics.get(serviceName) || this.createDefaultMetrics();
  }

  /**
   * Reset metrics for a service
   */
  private resetMockMetrics(serviceName: string): void {
    this.operationMetrics.set(serviceName, this.createDefaultMetrics());
  }
}

export const asyncMockPatterns = AsyncMockPatterns.getInstance();
