import { afterAll, afterEach, beforeAll, beforeEach, vi } from 'vitest';
// Removed import from deleted redis-mock-setup file

// Global mock Redis implementation
const mockRedis = {
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
  exists: vi.fn(),
  expire: vi.fn(),
  flushall: vi.fn(),
  disconnect: vi.fn(),
  eval: vi.fn(),
  status: 'ready'
};

// **CRITICAL REDIS MOCKING STRATEGY - PREVENT ALL REAL CONNECTIONS**
// Mock ioredis completely to prevent any real Redis connections
vi.mock('ioredis', () => {
  return {
    default: vi.fn(() => mockRedis),
    Redis: vi.fn(() => mockRedis)
  };
});

// Mock all Redis configuration modules
vi.mock('@/config/redis', () => {
  return {
    redis: mockRedis,
    redisClient: mockRedis,
    getRedis: vi.fn(() => mockRedis),
    initializeRedis: vi.fn().mockResolvedValue(mockRedis)
  };
});

// Mock winston and logger completely for tests
vi.mock('winston', () => ({
  default: {
    createLogger: vi.fn(() => ({
      info: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn(),
      child: vi.fn(() => ({
        info: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
      })),
    })),
    format: {
      combine: vi.fn(),
      timestamp: vi.fn(),
      errors: vi.fn(),
      splat: vi.fn(),
      json: vi.fn(),
      printf: vi.fn(),
      colorize: vi.fn(),
    },
    transports: {
      Console: vi.fn(),
      File: vi.fn(),
    },
  },
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    child: vi.fn(() => ({
      info: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn(),
    })),
  })),
  format: {
    combine: vi.fn(),
    timestamp: vi.fn(),
    errors: vi.fn(),
    splat: vi.fn(),
    json: vi.fn(),
    printf: vi.fn(),
    colorize: vi.fn(),
  },
  transports: {
    Console: vi.fn(),
    File: vi.fn(),
  },
}));

// Mock fetch for tests
global.fetch = vi.fn();

// Mock next-auth for tests
vi.mock('next-auth/react', () => ({
  signIn: vi.fn(() => Promise.resolve({ error: null })),
  signOut: vi.fn(() => Promise.resolve()),
  useSession: vi.fn(() => ({ data: null, status: 'unauthenticated' })),
}));

vi.mock('winston-daily-rotate-file', () => ({
  default: vi.fn(),
}));

// **TIMEOUT PREVENTION STRATEGY**
// Override setTimeout to prevent hanging tests
const originalSetTimeout = global.setTimeout;
global.setTimeout = (fn: Function, ms: number) => {
  // Clamp timeout values to prevent hanging tests
  if (ms > 10000) {
    console.warn(`Test timeout reduced from ${ms}ms to 100ms to prevent hanging`);
    ms = 100;
  }
  return originalSetTimeout(fn, ms);
};

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-that-is-at-least-32-characters-long-for-validation';
process.env.JWT_ISSUER = 'medianest';
process.env.JWT_AUDIENCE = 'medianest-users';
process.env.ENCRYPTION_KEY = 'test-encryption-key-32-bytes-long';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5433/medianest_test';
process.env.REDIS_URL = 'redis://localhost:6380';
process.env.PLEX_CLIENT_ID = 'test-plex-client-id';
process.env.PLEX_CLIENT_SECRET = 'test-plex-client-secret';
process.env.FRONTEND_URL = 'http://localhost:3000';
process.env.LOG_LEVEL = 'error'; // Reduce noise during tests

// Global test utilities
global.createTestUser = (overrides = {}) => ({
  id: 'test-user-id',
  plexId: 'test-plex-id',
  username: 'testuser',
  email: 'test@example.com',
  role: 'user',
  createdAt: new Date(),
  lastLoginAt: new Date(),
  status: 'active',
  plexToken: null,
  ...overrides,
});

global.createTestJWT = (payload = {}) => {
  const jwt = require('jsonwebtoken');
  return jwt.sign(
    {
      userId: 'test-user-id',
      role: 'user',
      ...payload,
    },
    process.env.JWT_SECRET,
    { expiresIn: '1h' },
  );
};

// **REDIS MOCK UTILITIES FOR TESTS**
global.createMockRedis = () => mockRedis;

global.mockRateLimitAllowed = (key: string, limit = 100, remaining = 99) => {
  const resetTime = Math.floor(Date.now() / 1000) + 60;
  mockRedis.eval.mockResolvedValueOnce([1, limit, remaining, resetTime]);
};

global.mockRateLimitExceeded = (key: string, limit = 100) => {
  const resetTime = Math.floor(Date.now() / 1000) + 60;
  mockRedis.eval.mockResolvedValueOnce([0, limit, 0, resetTime]);
};

// Reset all mocks before each test to ensure clean state
beforeEach(() => {
  // Reset mock Redis for clean test state
  Object.values(mockRedis).forEach(fn => {
    if (typeof fn?.mockReset === 'function') fn.mockReset();
  });
  vi.clearAllTimers();
  
  // Clear fetch mock
  if (global.fetch && typeof global.fetch === 'function' && 'mockClear' in global.fetch) {
    (global.fetch as any).mockClear();
  }
});

// Cleanup after tests
afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllTimers();
});

// Global cleanup
afterAll(() => {
  // Reset mock Redis for clean test state
  Object.values(mockRedis).forEach(fn => {
    if (typeof fn?.mockReset === 'function') fn.mockReset();
  });
  vi.restoreAllMocks();
  vi.clearAllTimers();
});