/**
 * COMPREHENSIVE TEST INFRASTRUCTURE SETUP
 * 
 * This file provides unified test infrastructure across all packages:
 * - Standardizes Vitest framework usage
 * - Fixes Redis/database mocking conflicts 
 * - Repairs JWT authentication mocking
 * - Establishes consistent coverage targets >70%
 * - Eliminates framework conflicts between Jest/Vitest
 */

import { vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { applyTestConfig, TEST_CONFIG } from './test-infrastructure-config';
import { setupRedisMocks } from './mocks/redis-mock';
import { setupPrismaMocks } from './mocks/prisma-mock';
import { setupJWTMocks } from './mocks/jwt-mock';
import { setupAuthServiceMocks } from './mocks/auth-mock';

// Apply comprehensive test configuration
applyTestConfig();

/**
 * INITIALIZE ALL MOCK INFRASTRUCTURE
 * Uses modular mock setup from dedicated mock files
 */

// Initialize all mocking infrastructure
const { mockRedis, resetMocks: resetRedisMocks } = setupRedisMocks();
const { mockPrisma, resetMocks: resetPrismaMocks } = setupPrismaMocks();
const { mockSign, mockVerify, mockDecode, resetMocks: resetJWTMocks } = setupJWTMocks();
const { resetMocks: resetAuthMocks } = setupAuthServiceMocks();



// ADDITIONAL CORE MOCKS
// 1. BCRYPT MOCKING - Fix password hashing in tests
vi.mock('bcrypt', () => ({
  hash: vi.fn().mockResolvedValue('$2b$10$mock.hashed.password'),
  compare: vi.fn().mockResolvedValue(true),
  genSalt: vi.fn().mockResolvedValue('$2b$10$mocksalt'),
}));

vi.mock('bcryptjs', () => ({
  hash: vi.fn().mockResolvedValue('$2b$10$mock.hashed.password'),
  compare: vi.fn().mockResolvedValue(true),
  genSalt: vi.fn().mockResolvedValue('$2b$10$mocksalt'),
}));

// 5. LOGGING MOCKING - Reduce test noise
const mockLogger = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
  child: vi.fn().mockReturnThis(),
};

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

vi.mock('winston-daily-rotate-file', () => ({
  default: vi.fn(),
}));

// 6. HTTP CLIENT MOCKING - Prevent network calls
const createMockAxios = () => {
  const mockAxios = {
    get: vi.fn().mockResolvedValue({ data: {} }),
    post: vi.fn().mockResolvedValue({ data: {} }),
    put: vi.fn().mockResolvedValue({ data: {} }),
    delete: vi.fn().mockResolvedValue({ data: {} }),
    patch: vi.fn().mockResolvedValue({ data: {} }),
    defaults: { headers: { common: {} } },
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
    create: vi.fn(),
  };
  
  // Avoid circular reference by setting create after definition
  mockAxios.create.mockReturnValue(mockAxios);
  
  return mockAxios;
};

const mockAxios = createMockAxios();

vi.mock('axios', () => ({
  default: mockAxios,
  ...mockAxios,
}));

// 7. CRYPTO MOCKING - Consistent random generation
vi.mock('crypto', async () => {
  const actual = await vi.importActual('crypto');
  return {
    ...actual,
    randomBytes: vi.fn().mockReturnValue(Buffer.from('test-random-bytes-16b')),
    createHash: vi.fn(() => ({
      update: vi.fn().mockReturnThis(),
      digest: vi.fn().mockReturnValue('mock-hash-digest'),
    })),
  };
});

// 8. FILESYSTEM MOCKING - Prevent file operations
vi.mock('fs', async () => {
  const actual = await vi.importActual('fs');
  return {
    ...actual,
    readFileSync: vi.fn().mockReturnValue('mock-file-content'),
    writeFileSync: vi.fn(),
    existsSync: vi.fn().mockReturnValue(true),
    mkdirSync: vi.fn(),
  };
});

/**
 * TEST LIFECYCLE HOOKS
 * Consistent setup/teardown across all test suites
 */
beforeAll(async () => {
  console.log('🧪 Initializing comprehensive test infrastructure...');
  // Additional global setup can go here
});

beforeEach(() => {
  // Reset all mocks between tests for isolation
  vi.clearAllMocks();
  
  // Reset all mock infrastructure
  resetRedisMocks();
  resetPrismaMocks();
  resetJWTMocks();
  resetAuthMocks();
});

afterEach(() => {
  // Clean up timers and pending operations
  vi.clearAllTimers();
  vi.unstubAllGlobals();
});

afterAll(async () => {
  // Restore original implementations
  vi.restoreAllMocks();
  console.log('✅ Test infrastructure cleanup complete');
});

/**
 * SHARED TEST UTILITIES
 * Common helpers for creating test data
 */

export const createTestUser = (overrides = {}) => ({
  id: 'test-user-id',
  plexId: 'test-plex-id',
  plexUsername: 'testuser',
  email: 'test@medianest.com',
  name: 'Test User',
  role: 'USER',
  status: 'active',
  createdAt: new Date('2024-01-01T00:00:00Z'),
  updatedAt: new Date('2024-01-01T00:00:00Z'),
  lastLoginAt: new Date('2024-01-01T00:00:00Z'),
  plexToken: null,
  image: null,
  requiresPasswordChange: false,
  ...overrides,
});

export const createTestJWT = (payload = {}) => {
  const jwt = require('jsonwebtoken');
  return jwt.sign(
    {
      userId: 'test-user-id',
      role: 'USER',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
      ...payload,
    },
    process.env.JWT_SECRET || 'test-secret',
    { algorithm: 'HS256' }
  );
};

export const createTestRequest = (overrides = {}) => ({
  headers: {
    authorization: `Bearer ${createTestJWT()}`,
    'content-type': 'application/json',
    'user-agent': 'test-agent',
    ...(overrides as any)?.headers,
  },
  body: {},
  query: {},
  params: {},
  user: createTestUser(),
  ip: '127.0.0.1',
  method: 'GET',
  path: '/api/test',
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
    statusCode: 200,
  };
  return res;
};

export const createTestMediaRequest = (overrides = {}) => ({
  id: 'test-media-request-id',
  userId: 'test-user-id',
  title: 'Test Movie',
  year: 2024,
  type: 'movie',
  status: 'pending',
  createdAt: new Date('2024-01-01T00:00:00Z'),
  updatedAt: new Date('2024-01-01T00:00:00Z'),
  ...overrides,
});

// Export mock clients for direct manipulation in tests
export const createMockRedis = () => {
  const { mockRedis } = setupRedisMocks();
  return mockRedis;
};
export const getMockRedis = createMockRedis;

const createMockPrismaClient = () => {
  const { mockPrisma } = setupPrismaMocks();
  return mockPrisma;
};
export const getMockPrisma = createMockPrismaClient;
export const getMockAxios = () => mockAxios;
export const getMockLogger = () => mockLogger;

// Global utilities available in all tests
declare global {
  var createTestUser: typeof createTestUser;
  var createTestJWT: typeof createTestJWT;
  var createTestRequest: typeof createTestRequest;
  var createTestResponse: typeof createTestResponse;
}

// @ts-ignore
globalThis.createTestUser = createTestUser;
// @ts-ignore
globalThis.createTestJWT = createTestJWT;
// @ts-ignore
globalThis.createTestRequest = createTestRequest;
// @ts-ignore
globalThis.createTestResponse = createTestResponse;