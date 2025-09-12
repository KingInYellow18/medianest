import { afterAll, afterEach, beforeAll, vi } from 'vitest';

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
