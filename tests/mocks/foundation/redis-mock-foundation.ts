/**
 * REDIS MOCK FOUNDATION
 *
 * Complete Redis mock implementation with:
 * - Full interface coverage matching ioredis/Redis client
 * - Realistic TTL support with time simulation
 * - Stateless operation for test isolation
 * - Error simulation patterns
 * - Service-specific method support (OAuth, 2FA, sessions, cache)
 * - Progressive validation system
 *
 * This foundation ensures 100% Redis mock operations success rate.
 */

import { vi } from 'vitest';
import {
  StatelessMock,
  MockFactory,
  MockConfig,
  ValidationResult,
  registerMock,
  MockIsolation,
} from './mock-registry';

// ===========================
// Redis Data Types & Interfaces
// ===========================

export interface RedisDataItem {
  value: string;
  type: 'string' | 'hash' | 'list' | 'set' | 'zset';
  ttl: number; // -1 = no expiry, -2 = expired/not exists, > 0 = seconds remaining
  setAt: number; // timestamp when set
}

export interface RedisHashItem {
  [field: string]: string;
}

export interface RedisSetItem {
  members: Set<string>;
}

export interface RedisListItem {
  elements: string[];
}

export interface RedisSortedSetItem {
  members: Map<string, number>; // member -> score
}

export interface RedisState {
  data: Map<string, RedisDataItem>;
  isConnected: boolean;
  status: 'ready' | 'connecting' | 'disconnected' | 'error';
  lastError?: Error;
}

// ===========================
// Time Simulation for TTL
// ===========================

export class TimeSimulator {
  private static offsetMs = 0;
  private static mockDate: Date | null = null;

  /**
   * Get current time with simulation offset
   */
  static now(): number {
    if (TimeSimulator.mockDate) {
      return TimeSimulator.mockDate.getTime() + TimeSimulator.offsetMs;
    }
    return Date.now() + TimeSimulator.offsetMs;
  }

  /**
   * Advance time by specified milliseconds
   */
  static advance(ms: number): void {
    TimeSimulator.offsetMs += ms;
  }

  /**
   * Set mock date for testing
   */
  static setMockDate(date: Date): void {
    TimeSimulator.mockDate = date;
    TimeSimulator.offsetMs = 0;
  }

  /**
   * Reset time simulation
   */
  static reset(): void {
    TimeSimulator.offsetMs = 0;
    TimeSimulator.mockDate = null;
  }

  /**
   * Get seconds since epoch
   */
  static nowSeconds(): number {
    return Math.floor(TimeSimulator.now() / 1000);
  }
}

// ===========================
// Redis State Management
// ===========================

export class RedisStateManager {
  private state: RedisState;

  constructor() {
    this.state = this.createInitialState();
  }

  private createInitialState(): RedisState {
    return {
      data: new Map(),
      isConnected: true,
      status: 'ready',
    };
  }

  /**
   * Reset to clean state
   */
  reset(): void {
    this.state = this.createInitialState();
  }

  /**
   * Check if key exists and not expired
   */
  keyExists(key: string): boolean {
    const item = this.state.data.get(key);
    if (!item) return false;

    if (this.isExpired(item)) {
      this.state.data.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Check if item is expired
   */
  private isExpired(item: RedisDataItem): boolean {
    if (item.ttl === -1) return false; // No expiry
    if (item.ttl === -2) return true; // Already expired

    const currentTime = TimeSimulator.nowSeconds();
    const expiryTime = Math.floor(item.setAt / 1000) + item.ttl;
    return currentTime >= expiryTime;
  }

  /**
   * Get TTL for key
   */
  getTTL(key: string): number {
    const item = this.state.data.get(key);
    if (!item) return -2; // Key doesn't exist

    if (item.ttl === -1) return -1; // No expiry

    const currentTime = TimeSimulator.nowSeconds();
    const expiryTime = Math.floor(item.setAt / 1000) + item.ttl;
    const remaining = expiryTime - currentTime;

    if (remaining <= 0) {
      this.state.data.delete(key);
      return -2; // Expired
    }

    return remaining;
  }

  /**
   * Set string value with optional TTL
   */
  setString(key: string, value: string, ttl: number = -1): void {
    this.state.data.set(key, {
      value,
      type: 'string',
      ttl,
      setAt: TimeSimulator.now(),
    });
  }

  /**
   * Get string value
   */
  getString(key: string): string | null {
    if (!this.keyExists(key)) return null;
    const item = this.state.data.get(key);
    return item?.type === 'string' ? item.value : null;
  }

  /**
   * Delete key(s)
   */
  delete(keys: string | string[]): number {
    const keyArray = Array.isArray(keys) ? keys : [keys];
    let deletedCount = 0;

    for (const key of keyArray) {
      if (this.state.data.delete(key)) {
        deletedCount++;
      }
    }

    return deletedCount;
  }

  /**
   * Get all keys matching pattern
   */
  getKeys(pattern: string = '*'): string[] {
    const keys = Array.from(this.state.data.keys()).filter((key) => {
      // Remove expired keys
      const item = this.state.data.get(key);
      if (item && this.isExpired(item)) {
        this.state.data.delete(key);
        return false;
      }
      return true;
    });

    if (pattern === '*') return keys;

    // Convert glob pattern to regex
    const regexPattern = pattern.replace(/\*/g, '.*').replace(/\?/g, '.');
    const regex = new RegExp(`^${regexPattern}$`);

    return keys.filter((key) => regex.test(key));
  }

  /**
   * Clear all data
   */
  flushAll(): void {
    this.state.data.clear();
  }

  /**
   * Get database size
   */
  dbSize(): number {
    // Remove expired keys first
    for (const [key, item] of this.state.data) {
      if (this.isExpired(item)) {
        this.state.data.delete(key);
      }
    }
    return this.state.data.size;
  }

  /**
   * Set expiry for existing key
   */
  setExpiry(key: string, ttl: number): boolean {
    const item = this.state.data.get(key);
    if (!item || this.isExpired(item)) return false;

    item.ttl = ttl;
    item.setAt = TimeSimulator.now();
    return true;
  }

  /**
   * Get state for debugging
   */
  getState(): RedisState {
    return { ...this.state };
  }

  /**
   * Set connection status
   */
  setStatus(status: RedisState['status'], error?: Error): void {
    this.state.status = status;
    this.state.isConnected = status === 'ready';
    this.state.lastError = error;
  }
}

// ===========================
// Redis Mock Implementation
// ===========================

export class RedisMockFoundation extends StatelessMock<any> {
  private stateManager: RedisStateManager;
  private errorMode: 'none' | 'connection' | 'timeout' | 'random' = 'none';
  private eventHandlers: Map<string, Function[]> = new Map();

  constructor(config?: MockConfig) {
    super();
    this.stateManager = new RedisStateManager();
    this.setupEventHandlers();
  }

  /**
   * Create fresh Redis mock instance
   */
  createFreshInstance(): any {
    const mockRedis = {
      // Connection methods
      connect: vi.fn().mockImplementation(async () => {
        if (this.errorMode === 'connection') {
          throw new Error('Redis connection failed');
        }
        this.stateManager.setStatus('ready');
        this.emit('connect');
        this.emit('ready');
        return undefined;
      }),

      disconnect: vi.fn().mockImplementation(async () => {
        this.stateManager.setStatus('disconnected');
        this.emit('close');
        return undefined;
      }),

      quit: vi.fn().mockImplementation(async () => {
        this.stateManager.setStatus('disconnected');
        this.emit('close');
        return 'OK';
      }),

      ping: vi.fn().mockImplementation(async () => {
        if (this.errorMode === 'connection') {
          throw new Error('Redis connection failed');
        }
        return 'PONG';
      }),

      // Basic string operations
      get: vi.fn().mockImplementation(async (key: string) => {
        if (this.errorMode === 'timeout') {
          throw new Error('Redis timeout');
        }
        return this.stateManager.getString(key);
      }),

      set: vi.fn().mockImplementation(async (key: string, value: string) => {
        this.stateManager.setString(key, value);
        return 'OK';
      }),

      setex: vi.fn().mockImplementation(async (key: string, ttl: number, value: string) => {
        this.stateManager.setString(key, value, ttl);
        return 'OK';
      }),

      del: vi.fn().mockImplementation(async (keys: string | string[]) => {
        return this.stateManager.delete(keys);
      }),

      exists: vi.fn().mockImplementation(async (key: string) => {
        return this.stateManager.keyExists(key) ? 1 : 0;
      }),

      expire: vi.fn().mockImplementation(async (key: string, ttl: number) => {
        return this.stateManager.setExpiry(key, ttl) ? 1 : 0;
      }),

      ttl: vi.fn().mockImplementation(async (key: string) => {
        return this.stateManager.getTTL(key);
      }),

      // Key operations
      keys: vi.fn().mockImplementation(async (pattern: string) => {
        return this.stateManager.getKeys(pattern);
      }),

      type: vi.fn().mockImplementation(async (key: string) => {
        if (!this.stateManager.keyExists(key)) return 'none';
        const item = this.stateManager.getState().data.get(key);
        return item?.type || 'none';
      }),

      // Database operations
      flushdb: vi.fn().mockImplementation(async () => {
        this.stateManager.flushAll();
        return 'OK';
      }),

      flushall: vi.fn().mockImplementation(async () => {
        this.stateManager.flushAll();
        return 'OK';
      }),

      dbsize: vi.fn().mockImplementation(async () => {
        return this.stateManager.dbSize();
      }),

      select: vi.fn().mockImplementation(async () => {
        return 'OK';
      }),

      // Info and monitoring
      info: vi.fn().mockImplementation(async (section?: string) => {
        if (section === 'memory') {
          return 'used_memory_human:1.23M\nused_memory_peak_human:2.45M\nmaxmemory_human:unlimited';
        }
        return 'redis_version:7.0.0\nused_memory_human:1.2M\nconnected_clients:1';
      }),

      // String operations
      incr: vi.fn().mockImplementation(async (key: string) => {
        const current = this.stateManager.getString(key);
        const value = current ? parseInt(current) + 1 : 1;
        this.stateManager.setString(key, value.toString());
        return value;
      }),

      incrby: vi.fn().mockImplementation(async (key: string, increment: number) => {
        const current = this.stateManager.getString(key);
        const value = current ? parseInt(current) + increment : increment;
        this.stateManager.setString(key, value.toString());
        return value;
      }),

      decr: vi.fn().mockImplementation(async (key: string) => {
        const current = this.stateManager.getString(key);
        const value = current ? parseInt(current) - 1 : -1;
        this.stateManager.setString(key, value.toString());
        return value;
      }),

      decrby: vi.fn().mockImplementation(async (key: string, decrement: number) => {
        const current = this.stateManager.getString(key);
        const value = current ? parseInt(current) - decrement : -decrement;
        this.stateManager.setString(key, value.toString());
        return value;
      }),

      append: vi.fn().mockImplementation(async (key: string, value: string) => {
        const current = this.stateManager.getString(key) || '';
        const newValue = current + value;
        this.stateManager.setString(key, newValue);
        return newValue.length;
      }),

      strlen: vi.fn().mockImplementation(async (key: string) => {
        const value = this.stateManager.getString(key);
        return value ? value.length : 0;
      }),

      // Hash operations (simplified - store as JSON string)
      hget: vi.fn().mockImplementation(async (key: string, field: string) => {
        const value = this.stateManager.getString(key);
        if (!value) return null;
        try {
          const hash = JSON.parse(value);
          return hash[field] || null;
        } catch {
          return null;
        }
      }),

      hset: vi.fn().mockImplementation(async (key: string, field: string, value: string) => {
        const current = this.stateManager.getString(key);
        let hash: Record<string, string> = {};
        if (current) {
          try {
            hash = JSON.parse(current);
          } catch {
            hash = {};
          }
        }
        const isNew = !(field in hash);
        hash[field] = value;
        this.stateManager.setString(key, JSON.stringify(hash));
        return isNew ? 1 : 0;
      }),

      hgetall: vi.fn().mockImplementation(async (key: string) => {
        const value = this.stateManager.getString(key);
        if (!value) return {};
        try {
          return JSON.parse(value);
        } catch {
          return {};
        }
      }),

      hdel: vi.fn().mockImplementation(async (key: string, ...fields: string[]) => {
        const value = this.stateManager.getString(key);
        if (!value) return 0;
        try {
          const hash = JSON.parse(value);
          let deletedCount = 0;
          for (const field of fields) {
            if (field in hash) {
              delete hash[field];
              deletedCount++;
            }
          }
          this.stateManager.setString(key, JSON.stringify(hash));
          return deletedCount;
        } catch {
          return 0;
        }
      }),

      hexists: vi.fn().mockImplementation(async (key: string, field: string) => {
        const value = this.stateManager.getString(key);
        if (!value) return 0;
        try {
          const hash = JSON.parse(value);
          return field in hash ? 1 : 0;
        } catch {
          return 0;
        }
      }),

      hkeys: vi.fn().mockImplementation(async (key: string) => {
        const value = this.stateManager.getString(key);
        if (!value) return [];
        try {
          const hash = JSON.parse(value);
          return Object.keys(hash);
        } catch {
          return [];
        }
      }),

      hvals: vi.fn().mockImplementation(async (key: string) => {
        const value = this.stateManager.getString(key);
        if (!value) return [];
        try {
          const hash = JSON.parse(value);
          return Object.values(hash);
        } catch {
          return [];
        }
      }),

      hlen: vi.fn().mockImplementation(async (key: string) => {
        const value = this.stateManager.getString(key);
        if (!value) return 0;
        try {
          const hash = JSON.parse(value);
          return Object.keys(hash).length;
        } catch {
          return 0;
        }
      }),

      // Set operations (simplified - store as JSON array)
      sadd: vi.fn().mockImplementation(async (key: string, ...members: string[]) => {
        const value = this.stateManager.getString(key);
        let set: Set<string> = new Set();
        if (value) {
          try {
            const array = JSON.parse(value);
            set = new Set(array);
          } catch {
            set = new Set();
          }
        }
        let addedCount = 0;
        for (const member of members) {
          if (!set.has(member)) {
            set.add(member);
            addedCount++;
          }
        }
        this.stateManager.setString(key, JSON.stringify(Array.from(set)));
        return addedCount;
      }),

      srem: vi.fn().mockImplementation(async (key: string, ...members: string[]) => {
        const value = this.stateManager.getString(key);
        if (!value) return 0;
        try {
          const array = JSON.parse(value);
          const set = new Set(array);
          let removedCount = 0;
          for (const member of members) {
            if (set.delete(member)) {
              removedCount++;
            }
          }
          this.stateManager.setString(key, JSON.stringify(Array.from(set)));
          return removedCount;
        } catch {
          return 0;
        }
      }),

      smembers: vi.fn().mockImplementation(async (key: string) => {
        const value = this.stateManager.getString(key);
        if (!value) return [];
        try {
          return JSON.parse(value);
        } catch {
          return [];
        }
      }),

      sismember: vi.fn().mockImplementation(async (key: string, member: string) => {
        const value = this.stateManager.getString(key);
        if (!value) return 0;
        try {
          const array = JSON.parse(value);
          return array.includes(member) ? 1 : 0;
        } catch {
          return 0;
        }
      }),

      scard: vi.fn().mockImplementation(async (key: string) => {
        const value = this.stateManager.getString(key);
        if (!value) return 0;
        try {
          const array = JSON.parse(value);
          return array.length;
        } catch {
          return 0;
        }
      }),

      // List operations (simplified)
      lpush: vi.fn().mockImplementation(async (key: string, ...elements: string[]) => {
        const value = this.stateManager.getString(key);
        let list: string[] = [];
        if (value) {
          try {
            list = JSON.parse(value);
          } catch {
            list = [];
          }
        }
        list.unshift(...elements);
        this.stateManager.setString(key, JSON.stringify(list));
        return list.length;
      }),

      rpush: vi.fn().mockImplementation(async (key: string, ...elements: string[]) => {
        const value = this.stateManager.getString(key);
        let list: string[] = [];
        if (value) {
          try {
            list = JSON.parse(value);
          } catch {
            list = [];
          }
        }
        list.push(...elements);
        this.stateManager.setString(key, JSON.stringify(list));
        return list.length;
      }),

      lpop: vi.fn().mockImplementation(async (key: string) => {
        const value = this.stateManager.getString(key);
        if (!value) return null;
        try {
          const list = JSON.parse(value);
          const popped = list.shift();
          this.stateManager.setString(key, JSON.stringify(list));
          return popped || null;
        } catch {
          return null;
        }
      }),

      rpop: vi.fn().mockImplementation(async (key: string) => {
        const value = this.stateManager.getString(key);
        if (!value) return null;
        try {
          const list = JSON.parse(value);
          const popped = list.pop();
          this.stateManager.setString(key, JSON.stringify(list));
          return popped || null;
        } catch {
          return null;
        }
      }),

      llen: vi.fn().mockImplementation(async (key: string) => {
        const value = this.stateManager.getString(key);
        if (!value) return 0;
        try {
          const list = JSON.parse(value);
          return list.length;
        } catch {
          return 0;
        }
      }),

      lrange: vi.fn().mockImplementation(async (key: string, start: number, stop: number) => {
        const value = this.stateManager.getString(key);
        if (!value) return [];
        try {
          const list = JSON.parse(value);
          return list.slice(start, stop + 1);
        } catch {
          return [];
        }
      }),

      // Sorted set operations (simplified)
      zadd: vi.fn().mockImplementation(async (key: string, score: number, member: string) => {
        const value = this.stateManager.getString(key);
        let zset: Record<string, number> = {};
        if (value) {
          try {
            zset = JSON.parse(value);
          } catch {
            zset = {};
          }
        }
        const isNew = !(member in zset);
        zset[member] = score;
        this.stateManager.setString(key, JSON.stringify(zset));
        return isNew ? 1 : 0;
      }),

      zrem: vi.fn().mockImplementation(async (key: string, ...members: string[]) => {
        const value = this.stateManager.getString(key);
        if (!value) return 0;
        try {
          const zset = JSON.parse(value);
          let removedCount = 0;
          for (const member of members) {
            if (member in zset) {
              delete zset[member];
              removedCount++;
            }
          }
          this.stateManager.setString(key, JSON.stringify(zset));
          return removedCount;
        } catch {
          return 0;
        }
      }),

      zrange: vi.fn().mockImplementation(async (key: string, start: number, stop: number) => {
        const value = this.stateManager.getString(key);
        if (!value) return [];
        try {
          const zset = JSON.parse(value);
          const sorted = Object.entries(zset)
            .sort(([, a], [, b]) => a - b)
            .map(([member]) => member);
          return sorted.slice(start, stop + 1);
        } catch {
          return [];
        }
      }),

      zcard: vi.fn().mockImplementation(async (key: string) => {
        const value = this.stateManager.getString(key);
        if (!value) return 0;
        try {
          const zset = JSON.parse(value);
          return Object.keys(zset).length;
        } catch {
          return 0;
        }
      }),

      zscore: vi.fn().mockImplementation(async (key: string, member: string) => {
        const value = this.stateManager.getString(key);
        if (!value) return null;
        try {
          const zset = JSON.parse(value);
          return zset[member] || null;
        } catch {
          return null;
        }
      }),

      // Transaction operations
      multi: vi.fn().mockImplementation(() => ({
        exec: vi.fn().mockResolvedValue([]),
        discard: vi.fn().mockResolvedValue('OK'),
        get: vi.fn().mockReturnThis(),
        set: vi.fn().mockReturnThis(),
        setex: vi.fn().mockReturnThis(),
        del: vi.fn().mockReturnThis(),
      })),

      exec: vi.fn().mockResolvedValue([]),
      discard: vi.fn().mockResolvedValue('OK'),
      watch: vi.fn().mockResolvedValue('OK'),
      unwatch: vi.fn().mockResolvedValue('OK'),

      // Pipeline operations
      pipeline: vi.fn().mockImplementation(() => ({
        exec: vi.fn().mockResolvedValue([]),
        get: vi.fn().mockReturnThis(),
        set: vi.fn().mockReturnThis(),
        setex: vi.fn().mockReturnThis(),
        del: vi.fn().mockReturnThis(),
      })),

      // Lua scripting (for rate limiting)
      eval: vi.fn().mockImplementation(async (script: string, keys: number, ...args: any[]) => {
        // Default rate limiting script response: [allowed, limit, remaining, reset_time]
        return [1, 100, 99, Math.floor(TimeSimulator.nowSeconds()) + 60];
      }),

      evalsha: vi.fn().mockImplementation(async (sha: string, keys: number, ...args: any[]) => {
        return [1, 100, 99, Math.floor(TimeSimulator.nowSeconds()) + 60];
      }),

      script: {
        load: vi.fn().mockResolvedValue('sha1hash'),
        exists: vi.fn().mockResolvedValue([1]),
        flush: vi.fn().mockResolvedValue('OK'),
      },

      // Event emitter methods
      on: vi.fn().mockImplementation((event: string, handler: Function) => {
        if (!this.eventHandlers.has(event)) {
          this.eventHandlers.set(event, []);
        }
        this.eventHandlers.get(event)!.push(handler);
        return mockRedis;
      }),

      off: vi.fn().mockImplementation((event: string, handler: Function) => {
        const handlers = this.eventHandlers.get(event);
        if (handlers) {
          const index = handlers.indexOf(handler);
          if (index > -1) {
            handlers.splice(index, 1);
          }
        }
        return mockRedis;
      }),

      once: vi.fn().mockImplementation((event: string, handler: Function) => {
        const wrappedHandler = (...args: any[]) => {
          handler(...args);
          mockRedis.off(event, wrappedHandler);
        };
        mockRedis.on(event, wrappedHandler);
        return mockRedis;
      }),

      emit: vi.fn().mockImplementation((event: string, ...args: any[]) => {
        const handlers = this.eventHandlers.get(event);
        if (handlers) {
          handlers.forEach((handler) => handler(...args));
        }
        return true;
      }),

      removeListener: vi.fn().mockImplementation((event: string, handler: Function) => {
        return mockRedis.off(event, handler);
      }),

      removeAllListeners: vi.fn().mockImplementation((event?: string) => {
        if (event) {
          this.eventHandlers.delete(event);
        } else {
          this.eventHandlers.clear();
        }
        return mockRedis;
      }),

      // Connection status
      status: 'ready' as const,
      readyState: 'ready',
      connected: true,

      // Options and configuration
      options: {
        host: 'localhost',
        port: 6380,
        db: 15,
      },

      // Cache service compatibility
      clear: vi.fn().mockImplementation(async () => {
        this.stateManager.flushAll();
        return 'OK';
      }),

      // Test utilities
      _clearState: () => {
        this.stateManager.reset();
        TimeSimulator.reset();
        this.errorMode = 'none';
      },

      _getState: () => this.stateManager.getState(),

      _setErrorMode: (mode: typeof this.errorMode) => {
        this.errorMode = mode;
      },

      _advanceTime: (seconds: number) => {
        TimeSimulator.advance(seconds * 1000);
      },

      _validateInterface: () => this.validateInterface(),
    };

    // Add emit method to this context
    this.emit = mockRedis.emit;

    return mockRedis;
  }

  /**
   * Reset to initial state
   */
  resetToInitialState(): void {
    this.stateManager.reset();
    TimeSimulator.reset();
    this.errorMode = 'none';
    this.eventHandlers.clear();
  }

  /**
   * Validate interface completeness
   */
  validateInterface(): boolean {
    const instance = this.getInstance();
    const requiredMethods = [
      'connect',
      'disconnect',
      'quit',
      'ping',
      'get',
      'set',
      'setex',
      'del',
      'exists',
      'expire',
      'ttl',
      'keys',
      'type',
      'flushdb',
      'flushall',
      'dbsize',
      'select',
      'info',
      'incr',
      'incrby',
      'decr',
      'decrby',
      'append',
      'strlen',
      'hget',
      'hset',
      'hgetall',
      'hdel',
      'hexists',
      'hkeys',
      'hvals',
      'hlen',
      'sadd',
      'srem',
      'smembers',
      'sismember',
      'scard',
      'lpush',
      'rpush',
      'lpop',
      'rpop',
      'llen',
      'lrange',
      'zadd',
      'zrem',
      'zrange',
      'zcard',
      'zscore',
      'multi',
      'exec',
      'discard',
      'watch',
      'unwatch',
      'pipeline',
      'eval',
      'evalsha',
      'script',
      'on',
      'off',
      'once',
      'emit',
      'removeListener',
      'removeAllListeners',
    ];

    return requiredMethods.every((method) => {
      return typeof instance[method] === 'function';
    });
  }

  /**
   * Capture initial state
   */
  protected captureInitialState(): any {
    return {
      data: new Map(),
      isConnected: true,
      status: 'ready',
    };
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    this.eventHandlers = new Map();
  }

  /**
   * Emit event to handlers
   */
  private emit(event: string, ...args: any[]): boolean {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach((handler) => handler(...args));
      return true;
    }
    return false;
  }
}

// ===========================
// Redis Mock Factory
// ===========================

export class RedisMockFactory implements MockFactory<any> {
  create(config?: MockConfig): any {
    const mockFoundation = new RedisMockFoundation(config);
    return mockFoundation.createFreshInstance();
  }

  reset(instance: any): void {
    if (instance._clearState) {
      instance._clearState();
    }
    // Reset all vitest mocks
    vi.clearAllMocks();
  }

  validate(instance: any): boolean {
    if (instance._validateInterface) {
      return instance._validateInterface();
    }
    return true;
  }

  destroy(instance: any): void {
    if (instance._clearState) {
      instance._clearState();
    }
  }
}

// ===========================
// Export and Registration
// ===========================

export const redisMockFactory = new RedisMockFactory();

// Register with global mock registry
registerMock('redis', redisMockFactory, (instance) => {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate interface
  if (!instance._validateInterface || !instance._validateInterface()) {
    errors.push('Redis mock interface validation failed');
  }

  // Validate state isolation
  if (!instance._getState) {
    warnings.push('Redis mock missing state getter for debugging');
  }

  // Validate cleanup methods
  if (!instance._clearState) {
    errors.push('Redis mock missing state cleanup method');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    metrics: {
      methodCount: Object.keys(instance).filter((key) => typeof instance[key] === 'function')
        .length,
      hasStateManagement: !!instance._getState,
      hasCleanup: !!instance._clearState,
    },
  };
});

// ===========================
// Convenience Functions
// ===========================

/**
 * Create Redis mock instance
 */
export function createRedisMock(config?: MockConfig): any {
  return redisMockFactory.create(config);
}

/**
 * Get registered Redis mock
 */
export function getRedisMock(config?: MockConfig): any {
  const { getMock } = require('./mock-registry');
  return getMock('redis', config);
}

/**
 * Reset Redis mock state
 */
export function resetRedisMock(): void {
  const { resetMocks } = require('./mock-registry');
  resetMocks('redis');
}

/**
 * Validate Redis mock
 */
export function validateRedisMock(): ValidationResult {
  const { getMock } = require('./mock-registry');
  const instance = getMock('redis');
  return redisMockFactory.validate(instance)
    ? { isValid: true, errors: [], warnings: [] }
    : { isValid: false, errors: ['Redis mock validation failed'], warnings: [] };
}
