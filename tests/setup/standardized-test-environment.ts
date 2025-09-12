/**
 * STANDARDIZED TEST ENVIRONMENT SETUP
 * 
 * This is the single source of truth for test environment configuration
 * across all test files. Ensures consistent mock initialization, proper
 * test isolation, and standardized environment variable loading.
 * 
 * Phase 4A Environment Stability Requirements:
 * - Consistent mock initialization order
 * - Proper test isolation between suites
 * - Standardized environment variable setup
 * - Database connection mock consistency
 * - Redis client mock consistency
 */

import { vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';

// ================================================================
// CRITICAL: ENVIRONMENT VARIABLES SETUP FIRST
// ================================================================

export function setupTestEnvironment() {
  // Set NODE_ENV first - critical for proper mocking
  process.env.NODE_ENV = 'test';
  
  // JWT Configuration - consistent across all tests
  process.env.JWT_SECRET = 'test-jwt-secret-key-32-bytes-long';
  process.env.JWT_ISSUER = 'medianest-test';
  process.env.JWT_AUDIENCE = 'medianest-test-users';
  
  // Database Configuration - consistent test values
  process.env.DATABASE_URL = 'postgresql://test:test@localhost:5433/medianest_test';
  process.env.DATABASE_POOL_SIZE = '2';
  process.env.DATABASE_TIMEOUT = '3000';
  
  // Redis Configuration - consistent test values
  process.env.REDIS_URL = 'redis://localhost:6380/15';
  process.env.REDIS_TEST_DB = '15';
  
  // Plex Configuration - consistent test values
  process.env.PLEX_CLIENT_ID = 'test-plex-client-id';
  process.env.PLEX_CLIENT_SECRET = 'test-plex-client-secret';
  
  // Application Configuration
  process.env.FRONTEND_URL = 'http://localhost:3000';
  process.env.BACKEND_URL = 'http://localhost:4000';
  process.env.LOG_LEVEL = 'silent';
  
  // Encryption Configuration
  process.env.ENCRYPTION_KEY = 'test-encryption-key-32-bytes-long!!!';
  
  // Performance Configuration
  process.env.VITEST_POOL_SIZE = '4';
  process.env.NODE_OPTIONS = '--max-old-space-size=4096';
}

// ================================================================
// REDIS MOCK SETUP - CONSISTENT STATE MANAGEMENT
// ================================================================

interface RedisMockItem {
  value: string;
  ttl: number;
  setAt: number;
}

class StandardizedRedisMock {
  private cache = new Map<string, RedisMockItem>();
  
  get(key: string): string | null {
    const item = this.cache.get(key);
    if (!item) return null;
    
    // Check TTL expiration
    if (item.ttl > 0 && Date.now() - item.setAt > item.ttl * 1000) {
      this.cache.delete(key);
      return null;
    }
    
    return item.value;
  }
  
  setex(key: string, ttl: number, value: string): string {
    this.cache.set(key, {
      value,
      ttl,
      setAt: Date.now()
    });
    return 'OK';
  }
  
  del(keys: string | string[]): number {
    if (Array.isArray(keys)) {
      let deleted = 0;
      keys.forEach(key => {
        if (this.cache.delete(key)) deleted++;
      });
      return deleted;
    } else {
      return this.cache.delete(keys) ? 1 : 0;
    }
  }
  
  exists(key: string): number {
    return this.cache.has(key) ? 1 : 0;
  }
  
  ttl(key: string): number {
    const item = this.cache.get(key);
    if (!item) return -2; // Key doesn't exist
    if (item.ttl <= 0) return -1; // No expiration
    
    const remaining = Math.ceil(item.ttl - (Date.now() - item.setAt) / 1000);
    return remaining > 0 ? remaining : -2;
  }
  
  flushall(): string {
    this.cache.clear();
    return 'OK';
  }
  
  keys(pattern: string): string[] {
    const keys = Array.from(this.cache.keys());
    
    if (pattern === '*') {
      return keys;
    }
    
    // Simple pattern matching for test:*
    const regexPattern = pattern.replace(/\*/g, '.*');
    const regex = new RegExp(`^${regexPattern}$`);
    
    return keys.filter(key => regex.test(key));
  }
  
  info(section?: string): string {
    if (section === 'memory') {
      return 'used_memory_human:1.23M\nused_memory_peak_human:2.45M';
    }
    return 'used_memory_human:1.2M';
  }
  
  dbsize(): number {
    return this.cache.size;
  }
  
  ping(): string {
    return 'PONG';
  }
  
  connect(): Promise<void> {
    return Promise.resolve();
  }
  
  disconnect(): Promise<void> {
    return Promise.resolve();
  }
  
  // Test isolation helper
  clear(): void {
    this.cache.clear();
  }
}

// Global Redis mock instance for consistent state
const globalRedisMock = new StandardizedRedisMock();

export function createStandardRedisClient() {
  return {
    get: vi.fn().mockImplementation((key: string) => 
      Promise.resolve(globalRedisMock.get(key))
    ),
    setex: vi.fn().mockImplementation((key: string, ttl: number, value: string) => 
      Promise.resolve(globalRedisMock.setex(key, ttl, value))
    ),
    del: vi.fn().mockImplementation((keys: string | string[]) => 
      Promise.resolve(globalRedisMock.del(keys))
    ),
    exists: vi.fn().mockImplementation((key: string) => 
      Promise.resolve(globalRedisMock.exists(key))
    ),
    ttl: vi.fn().mockImplementation((key: string) => 
      Promise.resolve(globalRedisMock.ttl(key))
    ),
    flushall: vi.fn().mockImplementation(() => 
      Promise.resolve(globalRedisMock.flushall())
    ),
    keys: vi.fn().mockImplementation((pattern: string) => 
      Promise.resolve(globalRedisMock.keys(pattern))
    ),
    info: vi.fn().mockImplementation((section?: string) => 
      Promise.resolve(globalRedisMock.info(section))
    ),
    dbsize: vi.fn().mockImplementation(() => 
      Promise.resolve(globalRedisMock.dbsize())
    ),
    ping: vi.fn().mockImplementation(() => 
      Promise.resolve(globalRedisMock.ping())
    ),
    connect: vi.fn().mockImplementation(() => 
      Promise.resolve(globalRedisMock.connect())
    ),
    disconnect: vi.fn().mockImplementation(() => 
      Promise.resolve(globalRedisMock.disconnect())
    ),
    
    // Test helpers
    _clearState: () => globalRedisMock.clear(),
    _getInternalState: () => globalRedisMock,
  };
}

// ================================================================
// DATABASE MOCK SETUP - CONSISTENT PRISMA MOCKING
// ================================================================

export function createStandardDatabaseMocks() {
  return {
    user: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    mediaRequest: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    sessionToken: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    $connect: vi.fn().mockResolvedValue(undefined),
    $disconnect: vi.fn().mockResolvedValue(undefined),
    $transaction: vi.fn().mockImplementation((callback) => callback(this)),
  };
}

// ================================================================
// LOGGER MOCK SETUP - CONSISTENT LOGGING
// ================================================================

export function createStandardLoggerMock() {
  return {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    child: vi.fn().mockReturnThis(),
  };
}

// ================================================================
// JWT MOCK SETUP - CONSISTENT TOKEN HANDLING
// ================================================================

export function createStandardJWTMocks() {
  return {
    generateToken: vi.fn().mockReturnValue('test-jwt-token'),
    verifyToken: vi.fn().mockReturnValue({
      userId: 'user-123',
      email: 'test@example.com',
      role: 'user',
      sessionId: 'test-session-id',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    }),
    generateRefreshToken: vi.fn().mockReturnValue('test-refresh-token'),
    verifyRefreshToken: vi.fn().mockReturnValue({
      userId: 'user-123',
      sessionId: 'test-session-id',
    }),
    getTokenMetadata: vi.fn().mockReturnValue({
      userId: 'user-123',
      sessionId: 'test-session-id',
      tokenId: 'test-token-id',
    }),
    isTokenBlacklisted: vi.fn().mockReturnValue(false),
    blacklistToken: vi.fn(),
    shouldRotateToken: vi.fn().mockReturnValue(false),
    rotateTokenIfNeeded: vi.fn().mockReturnValue(null),
  };
}

// ================================================================
// STANDARDIZED TEST LIFECYCLE HOOKS
// ================================================================

export function setupTestLifecycleHooks() {
  let redisClient: ReturnType<typeof createStandardRedisClient>;
  let databaseMocks: ReturnType<typeof createStandardDatabaseMocks>;
  let loggerMock: ReturnType<typeof createStandardLoggerMock>;
  let jwtMocks: ReturnType<typeof createStandardJWTMocks>;

  beforeAll(async () => {
    console.log('🧪 Initializing standardized test environment...');
    
    // Setup environment first
    setupTestEnvironment();
    
    // Initialize all mocks
    redisClient = createStandardRedisClient();
    databaseMocks = createStandardDatabaseMocks();
    loggerMock = createStandardLoggerMock();
    jwtMocks = createStandardJWTMocks();
  });

  beforeEach(() => {
    // Clear all mocks for test isolation
    vi.clearAllMocks();
    
    // Reset Redis state
    if (redisClient) {
      redisClient._clearState();
    }
    
    // Reset database mock implementations
    if (databaseMocks) {
      Object.values(databaseMocks).forEach(mock => {
        if (typeof mock === 'object' && mock !== null) {
          Object.values(mock).forEach(method => {
            if (vi.isMockFunction(method)) {
              method.mockReset();
            }
          });
        } else if (vi.isMockFunction(mock)) {
          mock.mockReset();
        }
      });
    }
  });

  afterEach(() => {
    // Clear timers and globals
    vi.clearAllTimers();
    vi.unstubAllGlobals();
  });

  afterAll(async () => {
    // Restore all mocks
    vi.restoreAllMocks();
    console.log('✅ Standardized test environment cleanup complete');
  });

  return {
    redisClient,
    databaseMocks,
    loggerMock,
    jwtMocks,
  };
}

// ================================================================
// STANDARD MOCK DEFINITIONS - APPLIED GLOBALLY
// ================================================================

export function applyStandardMocks() {
  const mocks = setupTestLifecycleHooks();

  // Redis mocks
  vi.mock('@/config/redis', () => ({
    default: mocks.redisClient,
    redisClient: mocks.redisClient,
    initializeRedis: vi.fn(),
    closeRedis: vi.fn(),
    checkRedisHealth: vi.fn().mockResolvedValue(true),
  }));

  // Database mocks
  vi.mock('@/config/database', () => ({
    getDatabase: vi.fn(() => mocks.databaseMocks),
    initializeDatabase: vi.fn(),
    getRepositories: vi.fn(),
  }));

  // Logger mocks
  vi.mock('@/utils/logger', () => ({
    logger: mocks.loggerMock,
  }));

  // JWT mocks
  vi.mock('@/auth/jwt-facade', () => ({
    jwtFacade: mocks.jwtMocks,
    ...mocks.jwtMocks,
  }));

  return mocks;
}

// ================================================================
// TEST DATA FACTORIES - CONSISTENT TEST DATA
// ================================================================

export const testDataFactory = {
  createUser: (overrides = {}) => ({
    id: 'test-user-id',
    plexId: 'test-plex-id',
    plexUsername: 'testuser',
    email: 'test@example.com',
    name: 'Test User',
    role: 'user',
    status: 'active',
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
    lastLoginAt: new Date('2024-01-01T00:00:00Z'),
    plexToken: null,
    image: null,
    requiresPasswordChange: false,
    ...overrides,
  }),

  createRequest: (overrides = {}) => ({
    headers: {
      authorization: 'Bearer test-jwt-token',
      'content-type': 'application/json',
      'user-agent': 'test-agent',
    },
    body: {},
    query: {},
    params: {},
    user: testDataFactory.createUser(),
    ip: '127.0.0.1',
    method: 'GET',
    path: '/api/test',
    ...overrides,
  }),

  createResponse: () => ({
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
    cookie: vi.fn().mockReturnThis(),
    clearCookie: vi.fn().mockReturnThis(),
    redirect: vi.fn().mockReturnThis(),
    setHeader: vi.fn().mockReturnThis(),
    getHeader: vi.fn(),
    locals: {
      csrfToken: 'test-csrf-token',
    },
    statusCode: 200,
  }),
};

// ================================================================
// ENVIRONMENT VALIDATION
// ================================================================

export function validateTestEnvironment() {
  const required = [
    'NODE_ENV',
    'JWT_SECRET', 
    'DATABASE_URL',
    'REDIS_URL'
  ];

  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
  
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('NODE_ENV must be set to "test" for test environment');
  }
}