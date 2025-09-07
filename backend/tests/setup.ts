import { afterAll, afterEach, beforeAll, vi } from 'vitest';
import { server } from './msw/setup';
import { createMockPrismaClient, resetMockPrismaClient } from '../src/config/test-database';
import { createMockRedisClient, RedisTestUtils } from '../src/config/test-redis';

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

vi.mock('winston-daily-rotate-file', () => ({
  default: vi.fn(),
}));

// Mock Redis and ioredis with enhanced test isolation
vi.mock('ioredis', () => {
  const { createMockRedisForTests } = require('../src/config/test-redis-connection');
  const mockRedisClient = createMockRedisForTests();

  return {
    __esModule: true,
    default: vi.fn(() => mockRedisClient),
    Redis: vi.fn(() => mockRedisClient),
  };
});

vi.mock('redis', () => ({
  createClient: vi.fn(() => ({
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
    exists: vi.fn().mockResolvedValue(0),
    ping: vi.fn().mockResolvedValue('PONG'),
  })),
}));

// Setup MSW server
beforeAll(() => {
  server.listen({
    onUnhandledRequest: 'bypass', // Let unhandled requests (local Express routes) pass through
  });
});

afterEach(() => {
  server.resetHandlers();
  vi.clearAllMocks();
});

afterAll(() => {
  server.close();
});

// Mock environment variables BEFORE any imports
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key-32-bytes-long';
process.env.JWT_ISSUER = 'medianest';
process.env.JWT_AUDIENCE = 'medianest-users';
process.env.NEXTAUTH_SECRET = 'test-nextauth-secret-key-32-bytes-long';
process.env.ENCRYPTION_KEY = 'test-encryption-key-32-bytes-long';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5433/medianest_test';
process.env.REDIS_URL = 'redis://localhost:6380';
process.env.PLEX_CLIENT_ID = 'test-plex-client-id';
process.env.PLEX_CLIENT_SECRET = 'test-plex-client-secret';
process.env.FRONTEND_URL = 'http://localhost:3000';
process.env.LOG_LEVEL = 'error'; // Reduce noise during tests

// Mock jsonwebtoken to fix auth test failures
vi.mock('jsonwebtoken', async () => {
  const actual = await vi.importActual('jsonwebtoken');

  class TokenExpiredError extends Error {
    name = 'TokenExpiredError';
    expiredAt: Date;
    constructor(message: string, expiredAt: Date) {
      super(message);
      this.expiredAt = expiredAt;
    }
  }

  class JsonWebTokenError extends Error {
    name = 'JsonWebTokenError';
    constructor(message: string) {
      super(message);
    }
  }

  return {
    ...actual,
    default: {
      sign: vi.fn().mockReturnValue('test-jwt-token'),
      verify: vi.fn().mockReturnValue({ userId: 'test-user-id', role: 'USER' }),
      decode: vi.fn().mockReturnValue({ userId: 'test-user-id', role: 'USER' }),
      TokenExpiredError,
      JsonWebTokenError,
    },
    sign: vi.fn().mockReturnValue('test-jwt-token'),
    verify: vi.fn().mockReturnValue({ userId: 'test-user-id', role: 'USER' }),
    decode: vi.fn().mockReturnValue({ userId: 'test-user-id', role: 'USER' }),
    TokenExpiredError,
    JsonWebTokenError,
  };
});

// Mock bcrypt to prevent actual hashing in tests
vi.mock('bcrypt', () => ({
  hash: vi.fn().mockResolvedValue('hashed-password'),
  compare: vi.fn().mockResolvedValue(true),
  genSalt: vi.fn().mockResolvedValue('salt'),
}));

vi.mock('bcryptjs', () => ({
  hash: vi.fn().mockResolvedValue('hashed-password'),
  compare: vi.fn().mockResolvedValue(true),
  genSalt: vi.fn().mockResolvedValue('salt'),
}));

// Mock config service to provide test configuration
vi.mock('../src/config/config.service', () => ({
  configService: {
    getAuthConfig: () => ({
      JWT_SECRET: 'test-secret-key-for-testing-only-do-not-use-in-production',
      JWT_ISSUER: 'medianest-test',
      JWT_AUDIENCE: 'medianest-test-users',
      JWT_EXPIRES_IN: '1h',
    }),
    getDatabaseConfig: () => ({
      DATABASE_URL: 'postgresql://test:test@localhost:5433/medianest_test',
    }),
    getRedisConfig: () => ({
      REDIS_URL: 'redis://localhost:6380/0',
    }),
  },
}));

// Mock the config module to return test configuration
vi.mock('@/config', () => ({
  config: {
    NODE_ENV: 'test',
    PORT: 3001,
    DATABASE_URL: 'postgresql://test:test@localhost:5433/medianest_test',
    REDIS_URL: 'redis://localhost:6380',
    jwt: {
      secret: 'test-jwt-secret-key-32-bytes-long',
      issuer: 'medianest-test',
      audience: 'medianest-test-users',
      expiresIn: '1h',
    },
    encryption: {
      key: 'test-encryption-key-32-bytes-long',
    },
    plex: {
      clientId: 'test-plex-client-id',
      clientSecret: 'test-plex-client-secret',
    },
    FRONTEND_URL: 'http://localhost:3000',
    LOG_LEVEL: 'silent',
  },
  logConfiguration: vi.fn(),
  validateRequiredConfig: vi.fn(),
  isDevelopment: vi.fn(() => false),
  isTest: vi.fn(() => true),
  isProduction: vi.fn(() => false),
}));

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
    { expiresIn: '1h' }
  );
};
