import { vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
// import type { PrismaClient } from '@prisma/client';
import { createHash } from 'crypto';

// Mock Prisma Client for unit tests
export const mockPrismaClient = {
  user: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    upsert: vi.fn(),
    delete: vi.fn(),
  },
  mediaRequest: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  sessionToken: {
    create: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  $transaction: vi.fn(),
  $connect: vi.fn(),
  $disconnect: vi.fn(),
};

// Mock Redis Client
export const mockRedisClient = {
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
  setex: vi.fn(),
  exists: vi.fn(),
  expire: vi.fn(),
  flushall: vi.fn(),
  quit: vi.fn(),
};

// Mock Logger
export const mockLogger = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
  child: vi.fn(() => mockLogger),
};

// Mock external services
export const mockAxios = {
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
  defaults: {
    headers: {
      common: {},
    },
  },
};

// Test utilities
export const createTestUser = (overrides = {}) => ({
  id: 'test-user-id',
  plexId: 'test-plex-id',
  username: 'testuser',
  email: 'test@example.com',
  role: 'user',
  createdAt: new Date('2024-01-01T00:00:00Z'),
  updatedAt: new Date('2024-01-01T00:00:00Z'),
  lastLoginAt: new Date('2024-01-01T00:00:00Z'),
  status: 'active',
  plexToken: null,
  avatar: null,
  preferences: null,
  ...overrides,
});

export const createTestMediaRequest = (overrides = {}) => ({
  id: 'test-request-id',
  userId: 'test-user-id',
  mediaType: 'movie',
  tmdbId: '12345',
  title: 'Test Movie',
  status: 'pending',
  createdAt: new Date('2024-01-01T00:00:00Z'),
  updatedAt: new Date('2024-01-01T00:00:00Z'),
  ...overrides,
});

export const createTestJWT = (payload = {}) => {
  const jwt = require('jsonwebtoken');
  return jwt.sign(
    {
      userId: 'test-user-id',
      role: 'user',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour
      ...payload,
    },
    process.env.JWT_SECRET || 'test-secret',
    { algorithm: 'HS256' },
  );
};

export const createTestRequest = (overrides = {}) => ({
  headers: {
    authorization: `Bearer ${createTestJWT()}`,
    'content-type': 'application/json',
    'user-agent': 'test-agent',
    ...(overrides as any).headers,
  },
  body: {},
  query: {},
  params: {},
  user: createTestUser(),
  ...overrides,
});

export const createTestResponse = () => {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
    cookie: vi.fn().mockReturnThis(),
    clearCookie: vi.fn().mockReturnThis(),
    redirect: vi.fn().mockReturnThis(),
    setHeader: vi.fn().mockReturnThis(),
    getHeader: vi.fn(),
    locals: {},
  };
  return res;
};

// Mock environment setup
export const setupTestEnvironment = () => {
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-jwt-secret-key-32-bytes-long';
  process.env.JWT_ISSUER = 'medianest-test';
  process.env.JWT_AUDIENCE = 'medianest-test-users';
  process.env.ENCRYPTION_KEY = 'test-encryption-key-32-bytes-long';
  process.env.DATABASE_URL = 'postgresql://test:test@localhost:5433/medianest_test';
  process.env.REDIS_URL = 'redis://localhost:6380/0';
  process.env.PLEX_CLIENT_ID = 'test-plex-client-id';
  process.env.PLEX_CLIENT_SECRET = 'test-plex-client-secret';
  process.env.FRONTEND_URL = 'http://localhost:3000';
  process.env.LOG_LEVEL = 'silent';
  process.env.API_KEY_HASH = createHash('sha256').update('test-api-key').digest('hex');
};

// Global mocks setup
export const setupGlobalMocks = () => {
  // Mock Prisma
  vi.mock('@prisma/client', () => ({
    PrismaClient: vi.fn(() => mockPrismaClient),
  }));

  // Mock Redis
  vi.mock('ioredis', () => ({
    default: vi.fn(() => mockRedisClient),
  }));

  // Mock Logger
  vi.mock('winston', () => ({
    default: {
      createLogger: vi.fn(() => mockLogger),
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
  }));

  // Mock axios
  vi.mock('axios', () => ({
    default: mockAxios,
    create: vi.fn(() => mockAxios),
  }));

  // Mock bcrypt
  vi.mock('bcrypt', () => ({
    hash: vi.fn().mockResolvedValue('hashed-password'),
    compare: vi.fn().mockResolvedValue(true),
    genSalt: vi.fn().mockResolvedValue('salt'),
  }));

  // Mock JWT
  vi.mock('jsonwebtoken', () => ({
    sign: vi.fn().mockReturnValue('test-jwt-token'),
    verify: vi.fn().mockReturnValue({ userId: 'test-user-id', role: 'user' }),
    decode: vi.fn().mockReturnValue({ userId: 'test-user-id', role: 'user' }),
  }));

  // Mock crypto for encryption
  vi.mock('crypto', async () => ({
    ...(await vi.importActual('crypto')),
    randomBytes: vi.fn().mockReturnValue(Buffer.from('test-random-bytes')),
  }));
};

// Reset all mocks
export const resetAllMocks = () => {
  vi.clearAllMocks();
  Object.values(mockPrismaClient).forEach((mock) => {
    if (typeof mock === 'object' && mock !== null) {
      Object.values(mock).forEach((fn) => {
        if (vi.isMockFunction(fn)) {
          fn.mockReset();
        }
      });
    }
  });
  Object.values(mockRedisClient).forEach((fn) => {
    if (vi.isMockFunction(fn)) {
      fn.mockReset();
    }
  });
  Object.values(mockLogger).forEach((fn) => {
    if (vi.isMockFunction(fn)) {
      fn.mockReset();
    }
  });
};

// Setup hooks
beforeAll(() => {
  setupTestEnvironment();
  setupGlobalMocks();
});

beforeEach(() => {
  resetAllMocks();
});

afterEach(() => {
  vi.clearAllTimers();
});

afterAll(() => {
  vi.restoreAllMocks();
});
