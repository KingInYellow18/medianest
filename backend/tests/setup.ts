/**
 * BACKEND TEST SETUP
 * Imports comprehensive test infrastructure and adds backend-specific setup
 */

import { afterAll, afterEach, beforeAll, beforeEach, vi } from 'vitest';
import '../../tests/setup-comprehensive';

// Backend-specific mocks
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

vi.mock('../src/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    child: vi.fn().mockReturnThis(),
  },
}));

// Global test setup hooks
beforeAll(async () => {
  console.log('🧪 Backend test suite initializing...');
});

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.clearAllTimers();
});

afterAll(() => {
  vi.restoreAllMocks();
  console.log('✅ Backend test suite completed');
});
