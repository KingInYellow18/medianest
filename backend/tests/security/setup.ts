/**
 * Security Test Setup for Backend Tests
 * Ensures proper environment configuration for security testing
 */

import { beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';

// Configure test environment variables BEFORE any imports
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key-32-bytes-long-for-security-testing-validation';
process.env.JWT_ISSUER = 'medianest';
process.env.JWT_AUDIENCE = 'medianest-users';
process.env.JWT_EXPIRES_IN = '1h';
process.env.ENCRYPTION_KEY = 'test-encryption-key-32-bytes-long-for-testing';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5433/medianest_test';
process.env.REDIS_URL = 'redis://localhost:6380';
process.env.REDIS_HOST = 'localhost';
process.env.REDIS_PORT = '6380';
process.env.LOG_LEVEL = 'error';

// Set test-specific configuration
process.env.PLEX_CLIENT_ID = 'test-plex-client-id';
process.env.PLEX_CLIENT_SECRET = 'test-plex-client-secret';
process.env.FRONTEND_URL = 'http://localhost:3000';

console.log('🔒 Security test environment initialized');
console.log('   NODE_ENV:', process.env.NODE_ENV);
console.log('   JWT_SECRET length:', process.env.JWT_SECRET?.length);
console.log('   DATABASE_URL configured:', !!process.env.DATABASE_URL);

// Mock external dependencies that might interfere with security testing
vi.mock('../src/config/redis', () => ({
  default: {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    ping: vi.fn().mockResolvedValue('PONG'),
    connect: vi.fn(),
    disconnect: vi.fn(),
  },
  redisClient: {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    ping: vi.fn().mockResolvedValue('PONG'),
    connect: vi.fn(),
    disconnect: vi.fn(),
  },
  initializeRedis: vi.fn(),
  closeRedis: vi.fn(),
  checkRedisHealth: vi.fn().mockResolvedValue(true),
}));

vi.mock('../src/config/database', () => ({
  getDatabase: vi.fn(() => ({
    user: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    mediaRequest: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    sessionToken: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    $connect: vi.fn(),
    $disconnect: vi.fn(),
  })),
  initializeDatabase: vi.fn(),
  getRepositories: vi.fn(),
}));

vi.mock('../src/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    child: vi.fn().mockReturnThis(),
  },
}));

// Mock winston to prevent logging interference
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

beforeAll(async () => {
  console.log('🧪 Security test suite initializing...');
  
  // Validate critical environment variables are set
  const requiredVars = ['JWT_SECRET', 'DATABASE_URL', 'NODE_ENV'];
  for (const varName of requiredVars) {
    if (!process.env[varName]) {
      throw new Error(`Required environment variable ${varName} not set for security tests`);
    }
  }
  
  // Validate JWT_SECRET meets minimum requirements
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters for security tests');
  }
});

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.clearAllTimers();
});

afterAll(() => {
  vi.restoreAllMocks();
  console.log('✅ Security test suite completed');
});