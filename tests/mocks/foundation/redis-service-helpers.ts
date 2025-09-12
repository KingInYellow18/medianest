/**
 * REDIS SERVICE-SPECIFIC HELPERS
 *
 * High-level helpers that match the MediaNest RedisService interface patterns.
 * These provide realistic behavior simulation for:
 * - OAuth state management
 * - Two-factor authentication challenges
 * - Password reset tokens
 * - Session management
 * - Rate limiting
 * - Cache operations
 */

import { createRedisMock, TimeSimulator } from './redis-mock-foundation';
import { MockConfig } from './mock-registry';

// ===========================
// Redis Service Data Types
// ===========================

export interface OAuthStateData {
  userId?: string;
  provider: string;
  redirectUri: string;
  codeVerifier?: string;
  state: string;
  createdAt: Date;
}

export interface TwoFactorChallengeData {
  userId: string;
  method: 'email' | 'sms' | 'app';
  code: string;
  attempts: number;
  maxAttempts: number;
  expiresAt: Date;
  createdAt: Date;
}

export interface PasswordResetTokenData {
  userId: string;
  email: string;
  token: string;
  used: boolean;
  expiresAt: Date;
  createdAt: Date;
}

export interface SessionData {
  userId: string;
  deviceId?: string;
  ipAddress?: string;
  userAgent?: string;
  expiresAt: Date;
}

// ===========================
// Redis Service Helpers
// ===========================

export class RedisServiceHelpers {
  private redisMock: any;

  constructor(config?: MockConfig) {
    this.redisMock = createRedisMock(config);
  }

  /**
   * Get the underlying Redis mock
   */
  getRedis(): any {
    return this.redisMock;
  }

  // ===========================
  // OAuth State Helpers
  // ===========================

  /**
   * Mock OAuth state storage
   */
  async mockOAuthState(
    state: string,
    data: OAuthStateData,
    ttlSeconds: number = 600,
  ): Promise<void> {
    const key = `oauth:state:${state}`;
    const serializedData = JSON.stringify({
      ...data,
      createdAt: data.createdAt.toISOString(),
    });
    await this.redisMock.setex(key, ttlSeconds, serializedData);
  }

  /**
   * Mock OAuth state retrieval
   */
  async mockGetOAuthState(state: string): Promise<OAuthStateData | null> {
    const key = `oauth:state:${state}`;
    const data = await this.redisMock.get(key);

    if (!data) return null;

    const parsed = JSON.parse(data);
    return {
      ...parsed,
      createdAt: new Date(parsed.createdAt),
    };
  }

  /**
   * Mock OAuth state cleanup
   */
  async mockCleanupOAuthStates(): Promise<string[]> {
    const pattern = 'oauth:state:*';
    const keys = await this.redisMock.keys(pattern);
    if (keys.length > 0) {
      await this.redisMock.del(keys);
    }
    return keys;
  }

  // ===========================
  // Two-Factor Auth Helpers
  // ===========================

  /**
   * Mock 2FA challenge storage
   */
  async mock2FAChallenge(
    challengeId: string,
    data: TwoFactorChallengeData,
    ttlSeconds: number = 300,
  ): Promise<void> {
    const key = `2fa:challenge:${challengeId}`;
    const serializedData = JSON.stringify({
      ...data,
      expiresAt: data.expiresAt.toISOString(),
      createdAt: data.createdAt.toISOString(),
    });
    await this.redisMock.setex(key, ttlSeconds, serializedData);
  }

  /**
   * Mock 2FA challenge retrieval
   */
  async mockGet2FAChallenge(challengeId: string): Promise<TwoFactorChallengeData | null> {
    const key = `2fa:challenge:${challengeId}`;
    const data = await this.redisMock.get(key);

    if (!data) return null;

    const parsed = JSON.parse(data);
    return {
      ...parsed,
      expiresAt: new Date(parsed.expiresAt),
      createdAt: new Date(parsed.createdAt),
    };
  }

  /**
   * Mock 2FA challenge attempt increment
   */
  async mockIncrement2FAAttempts(challengeId: string): Promise<number> {
    const challenge = await this.mockGet2FAChallenge(challengeId);
    if (!challenge) return 0;

    challenge.attempts += 1;
    const ttl = await this.redisMock.ttl(`2fa:challenge:${challengeId}`);
    if (ttl > 0) {
      await this.mock2FAChallenge(challengeId, challenge, ttl);
    }
    return challenge.attempts;
  }

  // ===========================
  // Password Reset Helpers
  // ===========================

  /**
   * Mock password reset token storage
   */
  async mockPasswordResetToken(
    tokenId: string,
    data: PasswordResetTokenData,
    ttlSeconds: number = 900,
  ): Promise<void> {
    const key = `pwd:reset:${tokenId}`;
    const serializedData = JSON.stringify({
      ...data,
      expiresAt: data.expiresAt.toISOString(),
      createdAt: data.createdAt.toISOString(),
    });
    await this.redisMock.setex(key, ttlSeconds, serializedData);
  }

  /**
   * Mock password reset token retrieval
   */
  async mockGetPasswordResetToken(tokenId: string): Promise<PasswordResetTokenData | null> {
    const key = `pwd:reset:${tokenId}`;
    const data = await this.redisMock.get(key);

    if (!data) return null;

    const parsed = JSON.parse(data);
    return {
      ...parsed,
      expiresAt: new Date(parsed.expiresAt),
      createdAt: new Date(parsed.createdAt),
    };
  }

  /**
   * Mock password reset token usage
   */
  async mockUsePasswordResetToken(tokenId: string): Promise<boolean> {
    const token = await this.mockGetPasswordResetToken(tokenId);
    if (!token || token.used) return false;

    token.used = true;
    const ttl = await this.redisMock.ttl(`pwd:reset:${tokenId}`);
    if (ttl > 0) {
      await this.mockPasswordResetToken(tokenId, token, ttl);
    }
    return true;
  }

  // ===========================
  // Session Helpers
  // ===========================

  /**
   * Mock session storage
   */
  async mockSession(
    sessionId: string,
    data: SessionData,
    ttlSeconds: number = 86400,
  ): Promise<void> {
    const sessionKey = `session:${sessionId}`;
    const userSessionsKey = `user:sessions:${data.userId}`;

    const serializedData = JSON.stringify({
      ...data,
      expiresAt: data.expiresAt.toISOString(),
    });

    // Store session data
    await this.redisMock.setex(sessionKey, ttlSeconds, serializedData);

    // Add to user sessions set
    await this.redisMock.sadd(userSessionsKey, sessionId);
    await this.redisMock.expire(userSessionsKey, ttlSeconds);
  }

  /**
   * Mock session retrieval
   */
  async mockGetSession(sessionId: string): Promise<SessionData | null> {
    const key = `session:${sessionId}`;
    const data = await this.redisMock.get(key);

    if (!data) return null;

    const parsed = JSON.parse(data);
    return {
      ...parsed,
      expiresAt: new Date(parsed.expiresAt),
    };
  }

  /**
   * Mock session deletion
   */
  async mockDeleteSession(sessionId: string): Promise<boolean> {
    const sessionData = await this.mockGetSession(sessionId);
    const sessionKey = `session:${sessionId}`;
    const result = await this.redisMock.del(sessionKey);

    // Remove from user sessions set
    if (sessionData) {
      const userSessionsKey = `user:sessions:${sessionData.userId}`;
      await this.redisMock.srem(userSessionsKey, sessionId);
    }

    return result === 1;
  }

  /**
   * Mock user sessions cleanup
   */
  async mockDeleteUserSessions(userId: string): Promise<number> {
    const userSessionsKey = `user:sessions:${userId}`;
    const sessionIds = await this.redisMock.smembers(userSessionsKey);

    let deletedCount = 0;
    for (const sessionId of sessionIds) {
      const sessionKey = `session:${sessionId}`;
      const result = await this.redisMock.del(sessionKey);
      if (result === 1) {
        deletedCount++;
      }
    }

    // Clear user sessions set
    await this.redisMock.del(userSessionsKey);
    return deletedCount;
  }

  // ===========================
  // Rate Limiting Helpers
  // ===========================

  /**
   * Mock rate limit check
   */
  async mockRateLimit(
    key: string,
    windowSeconds: number = 60,
    maxAttempts: number = 5,
  ): Promise<{ count: number; remaining: number; resetTime: Date }> {
    const rateLimitKey = `rate:limit:${key}`;

    // Get current count
    const current = await this.redisMock.get(rateLimitKey);
    let count = current ? parseInt(current) : 0;

    // Increment
    count += 1;
    await this.redisMock.setex(rateLimitKey, windowSeconds, count.toString());

    const remaining = Math.max(0, maxAttempts - count);
    const resetTime = new Date(TimeSimulator.now() + windowSeconds * 1000);

    return { count, remaining, resetTime };
  }

  /**
   * Mock rate limit status
   */
  async mockGetRateLimit(
    key: string,
    maxAttempts: number = 5,
  ): Promise<{ count: number; remaining: number; resetTime: Date | null }> {
    const rateLimitKey = `rate:limit:${key}`;

    const current = await this.redisMock.get(rateLimitKey);
    const count = current ? parseInt(current) : 0;
    const ttl = await this.redisMock.ttl(rateLimitKey);

    const remaining = Math.max(0, maxAttempts - count);
    const resetTime = ttl > 0 ? new Date(TimeSimulator.now() + ttl * 1000) : null;

    return { count, remaining, resetTime };
  }

  /**
   * Mock rate limit exceeded scenario
   */
  mockRateLimitExceeded(): void {
    this.redisMock.eval.mockResolvedValue([0, 100, 0, Math.floor(TimeSimulator.nowSeconds()) + 60]);
  }

  /**
   * Mock rate limit OK scenario
   */
  mockRateLimitOk(): void {
    this.redisMock.eval.mockResolvedValue([
      1,
      100,
      99,
      Math.floor(TimeSimulator.nowSeconds()) + 60,
    ]);
  }

  /**
   * Mock rate limit near limit scenario
   */
  mockRateLimitNearLimit(): void {
    this.redisMock.eval.mockResolvedValue([1, 100, 5, Math.floor(TimeSimulator.nowSeconds()) + 60]);
  }

  // ===========================
  // Cache Helpers
  // ===========================

  /**
   * Mock cache hit
   */
  mockCacheHit(key: string, value: any): void {
    const cacheKey = `cache:${key}`;
    this.redisMock.get.mockImplementation((k: string) =>
      k === cacheKey ? Promise.resolve(JSON.stringify(value)) : Promise.resolve(null),
    );
  }

  /**
   * Mock cache miss
   */
  mockCacheMiss(): void {
    this.redisMock.get.mockResolvedValue(null);
  }

  /**
   * Mock cache set operation
   */
  async mockCacheSet(key: string, value: any, ttlSeconds: number = 3600): Promise<void> {
    const cacheKey = `cache:${key}`;
    await this.redisMock.setex(cacheKey, ttlSeconds, JSON.stringify(value));
  }

  /**
   * Mock cache get operation
   */
  async mockCacheGet<T = any>(key: string): Promise<T | null> {
    const cacheKey = `cache:${key}`;
    const data = await this.redisMock.get(cacheKey);
    return data ? JSON.parse(data) : null;
  }

  /**
   * Mock cache delete operation
   */
  async mockCacheDelete(key: string): Promise<boolean> {
    const cacheKey = `cache:${key}`;
    const result = await this.redisMock.del(cacheKey);
    return result === 1;
  }

  // ===========================
  // Error Simulation
  // ===========================

  /**
   * Simulate connection error
   */
  simulateConnectionError(): void {
    this.redisMock._setErrorMode('connection');
  }

  /**
   * Simulate timeout error
   */
  simulateTimeoutError(): void {
    this.redisMock._setErrorMode('timeout');
  }

  /**
   * Restore normal behavior
   */
  restoreNormalBehavior(): void {
    this.redisMock._setErrorMode('none');
  }

  // ===========================
  // Time Control
  // ===========================

  /**
   * Advance time for TTL testing
   */
  advanceTime(seconds: number): void {
    this.redisMock._advanceTime(seconds);
  }

  /**
   * Reset time simulation
   */
  resetTime(): void {
    TimeSimulator.reset();
  }

  // ===========================
  // State Management
  // ===========================

  /**
   * Clear all Redis data
   */
  clearAll(): void {
    this.redisMock._clearState();
  }

  /**
   * Get current state for debugging
   */
  getState(): any {
    return this.redisMock._getState();
  }

  /**
   * Validate mock integrity
   */
  validate(): boolean {
    return this.redisMock._validateInterface();
  }
}

// ===========================
// Convenience Functions
// ===========================

/**
 * Create Redis service helpers instance
 */
export function createRedisServiceHelpers(config?: MockConfig): RedisServiceHelpers {
  return new RedisServiceHelpers(config);
}

/**
 * Quick setup for common scenarios
 */
export const redisScenarios = {
  /**
   * OAuth flow setup
   */
  oauthFlow: (helpers: RedisServiceHelpers, state: string, provider: string = 'google') => {
    const data: OAuthStateData = {
      provider,
      redirectUri: 'http://localhost:3000/auth/callback',
      state,
      createdAt: new Date(),
    };
    return helpers.mockOAuthState(state, data);
  },

  /**
   * 2FA challenge setup
   */
  twoFactorChallenge: (helpers: RedisServiceHelpers, challengeId: string, userId: string) => {
    const data: TwoFactorChallengeData = {
      userId,
      method: 'email',
      code: '123456',
      attempts: 0,
      maxAttempts: 3,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
      createdAt: new Date(),
    };
    return helpers.mock2FAChallenge(challengeId, data);
  },

  /**
   * Password reset setup
   */
  passwordReset: (helpers: RedisServiceHelpers, tokenId: string, userId: string, email: string) => {
    const data: PasswordResetTokenData = {
      userId,
      email,
      token: tokenId,
      used: false,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
      createdAt: new Date(),
    };
    return helpers.mockPasswordResetToken(tokenId, data);
  },

  /**
   * User session setup
   */
  userSession: (helpers: RedisServiceHelpers, sessionId: string, userId: string) => {
    const data: SessionData = {
      userId,
      deviceId: 'device-123',
      ipAddress: '127.0.0.1',
      userAgent: 'test-agent',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    };
    return helpers.mockSession(sessionId, data);
  },

  /**
   * Rate limit exceeded setup
   */
  rateLimitExceeded: (helpers: RedisServiceHelpers) => {
    helpers.mockRateLimitExceeded();
  },

  /**
   * Cache hit setup
   */
  cacheHit: (helpers: RedisServiceHelpers, key: string, value: any) => {
    helpers.mockCacheHit(key, value);
  },

  /**
   * Connection error setup
   */
  connectionError: (helpers: RedisServiceHelpers) => {
    helpers.simulateConnectionError();
  },
};

// Export default instance for convenience
export const redisServiceHelpers = createRedisServiceHelpers();
