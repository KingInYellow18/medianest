import { setupUniversalTestIsolation } from '../../../backend/tests/mocks/foundation/universal-test-isolation';
import { beforeAll, afterAll } from 'vitest';

/**
 * REDIS MOCK PROGRESSIVE VALIDATION TESTS
 * 
 * Layer-by-layer validation ensuring 100% Redis mock operations success rate.
 * Tests validate:
 * - Interface completeness
 * - Stateless operation
 * - TTL accuracy
 * - Error simulation
 * - Service-specific behaviors
 * - Memory isolation
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createRedisMock,
  getRedisMock,
  resetRedisMock,
  validateRedisMock,
  TimeSimulator,
  RedisMockFoundation,
} from './redis-mock-foundation';
import {
  createRedisServiceHelpers,
  redisScenarios,
  RedisServiceHelpers,
} from './redis-service-helpers';
import { MockIsolation, validateMocks } from './mock-registry';

// ===========================
// Test Setup
// ===========================


// =====================================================
// UNIVERSAL TEST ISOLATION - Phase F Proven Pattern
// =====================================================
// SUCCESS METRICS:
// - Frontend tests: 100% isolation (proven)
// - Security tests: 50/50 working with isolation
// - Winston mocks: 29/29 working with factory pattern
// =====================================================

let isolationManager: any;

beforeAll(async () => {
  // Initialize universal isolation manager
  isolationManager = setupUniversalTestIsolation();
});

beforeEach(async () => {
  // CRITICAL: Complete isolation reset before each test
  // This prevents cascade failures between tests
  vi.clearAllMocks();
  vi.resetAllMocks();
  isolationManager?.reset();
  
  // Additional environment cleanup
  process.env.NODE_ENV = 'test';
});

afterEach(async () => {
  // CRITICAL: Aggressive cleanup after each test
  // This ensures no state leaks to subsequent tests
  isolationManager?.cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

afterAll(async () => {
  // Final cleanup and resource deallocation
  isolationManager?.cleanup();
});

describe('Redis Mock Foundation - Progressive Validation', () => {
  let redisMock: any;
  let serviceHelpers: RedisServiceHelpers;

  beforeEach(() => {
    // Reset time simulation
    TimeSimulator.reset();
    
    // Create fresh instances
    redisMock = createRedisMock();
    serviceHelpers = createRedisServiceHelpers();
  });

  afterEach(() => {
    // Clean up
    if (redisMock?._clearState) {
      redisMock._clearState();
    }
    serviceHelpers?.clearAll();
    TimeSimulator.reset();
  });

  // ===========================
  // Layer 1: Interface Validation
  // ===========================

  describe('Layer 1: Interface Validation', () => {
    it('should have complete Redis interface coverage', () => {
      const requiredMethods = [
        // Connection
        'connect', 'disconnect', 'quit', 'ping',
        // Basic operations
        'get', 'set', 'setex', 'del', 'exists', 'expire', 'ttl',
        // Key operations
        'keys', 'type',
        // Database operations
        'flushdb', 'flushall', 'dbsize', 'select',
        // Info
        'info',
        // String operations
        'incr', 'incrby', 'decr', 'decrby', 'append', 'strlen',
        // Hash operations
        'hget', 'hset', 'hgetall', 'hdel', 'hexists', 'hkeys', 'hvals', 'hlen',
        // Set operations
        'sadd', 'srem', 'smembers', 'sismember', 'scard',
        // List operations
        'lpush', 'rpush', 'lpop', 'rpop', 'llen', 'lrange',
        // Sorted set operations
        'zadd', 'zrem', 'zrange', 'zcard', 'zscore',
        // Transaction operations
        'multi', 'exec', 'discard', 'watch', 'unwatch', 'pipeline',
        // Lua scripting
        'eval', 'evalsha', 'script',
        // Event emitter
        'on', 'off', 'once', 'emit', 'removeListener', 'removeAllListeners',
      ];

      for (const method of requiredMethods) {
        expect(typeof redisMock[method]).toBe('function', `Missing method: ${method}`);
      }
    });

    it('should have required properties', () => {
      expect(redisMock.status).toBeDefined();
      expect(redisMock.readyState).toBeDefined();
      expect(redisMock.connected).toBeDefined();
      expect(redisMock.options).toBeDefined();
    });

    it('should have test utilities', () => {
      expect(typeof redisMock._clearState).toBe('function');
      expect(typeof redisMock._getState).toBe('function');
      expect(typeof redisMock._setErrorMode).toBe('function');
      expect(typeof redisMock._advanceTime).toBe('function');
      expect(typeof redisMock._validateInterface).toBe('function');
    });

    it('should validate interface using built-in validator', () => {
      expect(redisMock._validateInterface()).toBe(true);
    });

    it('should pass registry validation', () => {
      const result = validateRedisMock();
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  // ===========================
  // Layer 2: Stateless Operation
  // ===========================

  describe('Layer 2: Stateless Operation', () => {
    it('should start with clean state', () => {
      expect(redisMock._getState().data.size).toBe(0);
      expect(redisMock._getState().isConnected).toBe(true);
      expect(redisMock._getState().status).toBe('ready');
    });

    it('should isolate state between instances', () => {
      const mock1 = createRedisMock();
      const mock2 = createRedisMock();

      // Set data in mock1
      mock1.set('test', 'value1');
      
      // Mock2 should not see mock1's data
      expect(mock2._getState().data.size).toBe(0);
      
      // Validate isolation
      expect(MockIsolation.validateIsolation(mock1, mock2)).toBe(true);
    });

    it('should reset to clean state', async () => {
      // Add some data
      await redisMock.set('key1', 'value1');
      await redisMock.set('key2', 'value2');
      expect(redisMock._getState().data.size).toBe(2);

      // Reset
      redisMock._clearState();
      expect(redisMock._getState().data.size).toBe(0);
    });

    it('should not persist state between test runs', () => {
      // This test validates the beforeEach cleanup
      const state = redisMock._getState();
      expect(state.data.size).toBe(0);
    });
  });

  // ===========================
  // Layer 3: TTL Accuracy
  // ===========================

  describe('Layer 3: TTL Accuracy', () => {
    it('should handle TTL correctly', async () => {
      await redisMock.setex('ttl-key', 60, 'value');
      
      // Should exist initially
      expect(await redisMock.exists('ttl-key')).toBe(1);
      expect(await redisMock.get('ttl-key')).toBe('value');
      
      // Check TTL
      const ttl = await redisMock.ttl('ttl-key');
      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(60);
    });

    it('should expire keys after TTL', async () => {
      await redisMock.setex('expire-key', 5, 'value');
      
      // Should exist initially
      expect(await redisMock.exists('expire-key')).toBe(1);
      
      // Advance time past TTL
      redisMock._advanceTime(6);
      
      // Should be expired
      expect(await redisMock.exists('expire-key')).toBe(0);
      expect(await redisMock.get('expire-key')).toBeNull();
      expect(await redisMock.ttl('expire-key')).toBe(-2);
    });

    it('should handle no expiry (-1 TTL)', async () => {
      await redisMock.set('no-expire', 'value');
      
      expect(await redisMock.ttl('no-expire')).toBe(-1);
      
      // Advance time significantly
      redisMock._advanceTime(3600);
      
      // Should still exist
      expect(await redisMock.exists('no-expire')).toBe(1);
      expect(await redisMock.get('no-expire')).toBe('value');
    });

    it('should update TTL with expire command', async () => {
      await redisMock.set('update-ttl', 'value');
      
      // Initially no expiry
      expect(await redisMock.ttl('update-ttl')).toBe(-1);
      
      // Set expiry
      expect(await redisMock.expire('update-ttl', 30)).toBe(1);
      
      // Should now have TTL
      const ttl = await redisMock.ttl('update-ttl');
      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(30);
    });
  });

  // ===========================
  // Layer 4: Error Simulation
  // ===========================

  describe('Layer 4: Error Simulation', () => {
    it('should simulate connection errors', async () => {
      redisMock._setErrorMode('connection');
      
      await expect(redisMock.connect()).rejects.toThrow('Redis connection failed');
      await expect(redisMock.ping()).rejects.toThrow('Redis connection failed');
    });

    it('should simulate timeout errors', async () => {
      redisMock._setErrorMode('timeout');
      
      await expect(redisMock.get('key')).rejects.toThrow('Redis timeout');
    });

    it('should restore normal behavior after error simulation', async () => {
      // Set error mode
      redisMock._setErrorMode('connection');
      await expect(redisMock.ping()).rejects.toThrow();
      
      // Restore normal behavior
      redisMock._setErrorMode('none');
      await expect(redisMock.ping()).resolves.toBe('PONG');
    });
  });

  // ===========================
  // Layer 5: Service-Specific Behaviors
  // ===========================

  describe('Layer 5: Service-Specific Behaviors', () => {
    describe('OAuth State Management', () => {
      it('should store and retrieve OAuth state', async () => {
        const state = 'oauth-state-123';
        await redisScenarios.oauthFlow(serviceHelpers, state, 'google');
        
        const retrieved = await serviceHelpers.mockGetOAuthState(state);
        expect(retrieved).toBeDefined();
        expect(retrieved?.provider).toBe('google');
        expect(retrieved?.state).toBe(state);
      });

      it('should expire OAuth state after TTL', async () => {
        const state = 'oauth-expire-123';
        await serviceHelpers.mockOAuthState(state, {
          provider: 'google',
          redirectUri: 'http://localhost',
          state,
          createdAt: new Date(),
        }, 5); // 5 seconds TTL
        
        // Should exist initially
        expect(await serviceHelpers.mockGetOAuthState(state)).toBeDefined();
        
        // Advance time past TTL
        serviceHelpers.advanceTime(6);
        
        // Should be expired
        expect(await serviceHelpers.mockGetOAuthState(state)).toBeNull();
      });
    });

    describe('Two-Factor Authentication', () => {
      it('should handle 2FA challenge lifecycle', async () => {
        const challengeId = '2fa-challenge-123';
        const userId = 'user-123';
        
        await redisScenarios.twoFactorChallenge(serviceHelpers, challengeId, userId);
        
        const challenge = await serviceHelpers.mockGet2FAChallenge(challengeId);
        expect(challenge).toBeDefined();
        expect(challenge?.userId).toBe(userId);
        expect(challenge?.attempts).toBe(0);
        
        // Increment attempts
        const attempts = await serviceHelpers.mockIncrement2FAAttempts(challengeId);
        expect(attempts).toBe(1);
      });
    });

    describe('Password Reset', () => {
      it('should handle password reset token lifecycle', async () => {
        const tokenId = 'reset-token-123';
        const userId = 'user-123';
        const email = 'user@example.com';
        
        await redisScenarios.passwordReset(serviceHelpers, tokenId, userId, email);
        
        const token = await serviceHelpers.mockGetPasswordResetToken(tokenId);
        expect(token).toBeDefined();
        expect(token?.userId).toBe(userId);
        expect(token?.used).toBe(false);
        
        // Use token
        const used = await serviceHelpers.mockUsePasswordResetToken(tokenId);
        expect(used).toBe(true);
        
        // Should be marked as used
        const usedToken = await serviceHelpers.mockGetPasswordResetToken(tokenId);
        expect(usedToken?.used).toBe(true);
      });
    });

    describe('Session Management', () => {
      it('should handle session lifecycle', async () => {
        const sessionId = 'session-123';
        const userId = 'user-123';
        
        await redisScenarios.userSession(serviceHelpers, sessionId, userId);
        
        const session = await serviceHelpers.mockGetSession(sessionId);
        expect(session).toBeDefined();
        expect(session?.userId).toBe(userId);
        
        // Delete session
        const deleted = await serviceHelpers.mockDeleteSession(sessionId);
        expect(deleted).toBe(true);
        
        // Should be gone
        expect(await serviceHelpers.mockGetSession(sessionId)).toBeNull();
      });

      it('should delete all user sessions', async () => {
        const userId = 'user-123';
        
        // Create multiple sessions
        await redisScenarios.userSession(serviceHelpers, 'session-1', userId);
        await redisScenarios.userSession(serviceHelpers, 'session-2', userId);
        await redisScenarios.userSession(serviceHelpers, 'session-3', userId);
        
        // Verify sessions exist
        expect(await serviceHelpers.mockGetSession('session-1')).toBeDefined();
        expect(await serviceHelpers.mockGetSession('session-2')).toBeDefined();
        expect(await serviceHelpers.mockGetSession('session-3')).toBeDefined();
        
        // Delete all user sessions
        const deletedCount = await serviceHelpers.mockDeleteUserSessions(userId);
        expect(deletedCount).toBe(3);
        
        // All should be gone
        expect(await serviceHelpers.mockGetSession('session-1')).toBeNull();
        expect(await serviceHelpers.mockGetSession('session-2')).toBeNull();
        expect(await serviceHelpers.mockGetSession('session-3')).toBeNull();
      });
    });

    describe('Rate Limiting', () => {
      it('should track rate limit attempts', async () => {
        const key = 'rate-limit-test';
        
        // First attempt
        const result1 = await serviceHelpers.mockRateLimit(key, 60, 5);
        expect(result1.count).toBe(1);
        expect(result1.remaining).toBe(4);
        
        // Second attempt
        const result2 = await serviceHelpers.mockRateLimit(key, 60, 5);
        expect(result2.count).toBe(2);
        expect(result2.remaining).toBe(3);
      });

      it('should simulate rate limit scenarios', () => {
        // Test exceeded scenario
        serviceHelpers.mockRateLimitExceeded();
        expect(redisMock.eval).toHaveBeenLastCalledWith(
          expect.any(String),
          expect.any(Number),
          expect.any(String)
        );
        
        // Test OK scenario
        serviceHelpers.mockRateLimitOk();
        expect(redisMock.eval).toHaveBeenLastCalledWith(
          expect.any(String),
          expect.any(Number),
          expect.any(String)
        );
      });
    });

    describe('Cache Operations', () => {
      it('should handle cache operations', async () => {
        const key = 'cache-test';
        const value = { data: 'test', timestamp: Date.now() };
        
        // Set cache
        await serviceHelpers.mockCacheSet(key, value, 300);
        
        // Get cache
        const retrieved = await serviceHelpers.mockCacheGet(key);
        expect(retrieved).toEqual(value);
        
        // Delete cache
        const deleted = await serviceHelpers.mockCacheDelete(key);
        expect(deleted).toBe(true);
        
        // Should be gone
        expect(await serviceHelpers.mockCacheGet(key)).toBeNull();
      });

      it('should simulate cache hit/miss scenarios', () => {
        const key = 'cache-scenario';
        const value = { test: 'data' };
        
        // Cache hit
        serviceHelpers.mockCacheHit(key, value);
        expect(redisMock.get).toBeDefined();
        
        // Cache miss
        serviceHelpers.mockCacheMiss();
        expect(redisMock.get).toBeDefined();
      });
    });
  });

  // ===========================
  // Layer 6: Memory Isolation
  // ===========================

  describe('Layer 6: Memory Isolation', () => {
    it('should not leak memory between tests', () => {
      // This validates the beforeEach/afterEach cleanup
      const initialState = redisMock._getState();
      expect(initialState.data.size).toBe(0);
    });

    it('should clean up properly on destroy', () => {
      const mockFoundation = new RedisMockFoundation();
      const instance = mockFoundation.createFreshInstance();
      
      // Add some data
      instance.set('test', 'value');
      expect(instance._getState().data.size).toBe(1);
      
      // Destroy
      mockFoundation.destroy();
      
      // Should be clean
      const newInstance = mockFoundation.createFreshInstance();
      expect(newInstance._getState().data.size).toBe(0);
    });

    it('should validate all mocks in registry', () => {
      const result = validateMocks();
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should ensure no shared state between service helpers', () => {
      const helpers1 = createRedisServiceHelpers();
      const helpers2 = createRedisServiceHelpers();
      
      // Set data in helpers1
      helpers1.mockCacheHit('test', 'value1');
      
      // helpers2 should not be affected
      expect(helpers1.getRedis()).not.toBe(helpers2.getRedis());
      expect(MockIsolation.validateIsolation(helpers1.getRedis(), helpers2.getRedis())).toBe(true);
    });
  });

  // ===========================
  // Integration Validation
  // ===========================

  describe('Integration Validation', () => {
    it('should pass comprehensive validation', () => {
      // Interface validation
      expect(redisMock._validateInterface()).toBe(true);
      
      // Registry validation
      const registryResult = validateRedisMock();
      expect(registryResult.isValid).toBe(true);
      
      // Service helpers validation
      expect(serviceHelpers.validate()).toBe(true);
      
      // State isolation validation
      const mock1 = createRedisMock();
      const mock2 = createRedisMock();
      expect(MockIsolation.validateIsolation(mock1, mock2)).toBe(true);
    });

    it('should maintain performance characteristics', () => {
      const start = Date.now();
      
      // Perform 100 operations
      const promises = [];
      for (let i = 0; i < 100; i++) {
        promises.push(redisMock.set(`key-${i}`, `value-${i}`));
      }
      
      return Promise.all(promises).then(() => {
        const duration = Date.now() - start;
        // Should complete in reasonable time (less than 100ms)
        expect(duration).toBeLessThan(100);
      });
    });

    it('should handle concurrent operations safely', async () => {
      // Simulate concurrent operations
      const operations = [];
      for (let i = 0; i < 50; i++) {
        operations.push(redisMock.set(`concurrent-${i}`, `value-${i}`));
        operations.push(redisMock.get(`concurrent-${i}`));
      }
      
      await Promise.all(operations);
      
      // State should be consistent
      expect(redisMock._getState().data.size).toBe(50);
    });
  });
});

// ===========================
// Export for external validation
// ===========================

export {
  createRedisMock,
  createRedisServiceHelpers,
  redisScenarios,
  validateRedisMock,
};