/**
 * SHARED TEST SETUP - CORE UTILITIES
 *
 * Shared testing utilities and mocks used across all test packages.
 * This file provides the foundation for consistent test infrastructure.
 */

import { vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';

/**
 * CORE MOCK CONFIGURATIONS
 * Mocks for universal dependencies used across all packages
 */

// Winston logger mock (universal)
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
}));

// Environment variables mock
vi.mock('process', () => ({
  env: {
    NODE_ENV: 'test',
    JWT_SECRET: 'test-secret-key-for-testing',
    JWT_ISSUER: 'medianest-test',
    JWT_AUDIENCE: 'medianest-app-test',
    REDIS_URL: 'redis://localhost:6379',
    DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
  },
}));

/**
 * UNIVERSAL TEST UTILITIES
 * Helper functions used across all test suites
 */

export const createTestRequest = (overrides = {}) => ({
  headers: {},
  cookies: {},
  ip: '127.0.0.1',
  method: 'GET',
  path: '/test',
  query: {},
  params: {},
  body: {},
  get: vi.fn().mockReturnValue('test-user-agent'),
  ...overrides,
});

export const createTestResponse = (overrides = {}) => ({
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
  send: vi.fn().mockReturnThis(),
  cookie: vi.fn().mockReturnThis(),
  clearCookie: vi.fn().mockReturnThis(),
  locals: {},
  ...overrides,
});

export const createTestUser = (overrides = {}) => ({
  id: 'test-user-123',
  email: 'test@example.com',
  name: 'Test User',
  role: 'user',
  status: 'active',
  plexId: 'plex-123',
  plexUsername: 'testuser',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

export const createTestJWT = (payload = {}) => {
  return 'test-jwt-token-' + Date.now();
};

/**
 * TEST LIFECYCLE HOOKS
 * Consistent setup/teardown for all test suites
 */

beforeAll(async () => {
  console.log('🧪 Initializing shared test infrastructure...');
});

beforeEach(() => {
  // Clear all mocks between tests for isolation
  vi.clearAllMocks();

  // Reset environment
  process.env.NODE_ENV = 'test';
});

afterEach(() => {
  // Additional cleanup if needed
});

afterAll(async () => {
  console.log('🧪 Cleaning up shared test infrastructure...');
});
