/**
 * COMPREHENSIVE TEST INFRASTRUCTURE SETUP
 * 
 * This file provides unified test infrastructure across all packages:
 * - Standardizes Vitest framework usage
 * - Fixes Redis/database mocking conflicts 
 * - Repairs JWT authentication mocking
 * - Establishes consistent coverage targets >70%
 * - Eliminates framework conflicts between Jest/Vitest
 * - Implements comprehensive mock registry system
 */

import { vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { applyTestConfig, TEST_CONFIG } from './test-infrastructure-config';
import { initializeComprehensiveMocks, mockRegistry } from './mocks/comprehensive-mock-registry';
import { setupAllExternalServiceMocks } from './mocks/external-service-mocks';
import { resetRedisMocks } from './mocks/redis-mock';
import { resetPrismaMocks } from './mocks/prisma-mock-reset';
import { resetJWTMocks } from './mocks/jwt-mock-reset';
import { resetAuthMocks } from './mocks/auth-mock-reset';
import { resetCacheServiceMocks } from './mocks/cache-service-mock';

// Apply comprehensive test configuration
applyTestConfig();

/**
 * INITIALIZE ALL MOCK INFRASTRUCTURE
 * Uses the comprehensive mock registry system
 */

// Initialize comprehensive mock registry (handles all core mocks)
initializeComprehensiveMocks();

// Initialize external service mocks
const externalMocks = setupAllExternalServiceMocks();

console.log('🎭 All mock systems initialized successfully');

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
  resetCacheServiceMocks();
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