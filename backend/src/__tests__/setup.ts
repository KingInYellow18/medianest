import { vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { createHash } from 'crypto';
import { createMockPrismaClient, resetMockPrismaClient } from '../config/test-database';
import { createMockRedisClient, RedisTestUtils } from '../config/test-redis';

// Mock Prisma Client for unit tests
export const mockPrismaClient = createMockPrismaClient();

// Mock Redis Client
export const mockRedisClient = createMockRedisClient();

// Mock Logger - Create a factory to avoid circular dependencies
export const createMockLoggerInstance = () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
  child: vi.fn(() => createMockLoggerInstance()),
});

export const mockLogger = createMockLoggerInstance();

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
  interceptors: {
    request: {
      use: vi.fn(),
    },
    response: {
      use: vi.fn(),
    },
  },
};

// Test utilities
export const createTestUser = (overrides = {}) => ({
  id: 'test-user-id',
  plexId: 'test-plex-id',
  plexUsername: 'testuser',
  email: 'test@example.com',
  name: 'Test User',
  role: 'USER',
  createdAt: new Date('2024-01-01T00:00:00Z'),
  updatedAt: new Date('2024-01-01T00:00:00Z'),
  lastLoginAt: new Date('2024-01-01T00:00:00Z'),
  status: 'active',
  plexToken: null,
  image: null,
  requiresPasswordChange: false,
  ...overrides,
});

export const createTestMediaRequest = (overrides = {}) => ({
  id: 'test-request-id',
  userId: 'test-user-id',
  mediaType: 'movie',
  tmdbId: '12345',
  title: 'Test Movie',
  status: 'pending',
  overseerrId: null,
  createdAt: new Date('2024-01-01T00:00:00Z'),
  completedAt: null,
  ...overrides,
});

export const createTestJWT = (payload = {}) => {
  const basePayload = {
    userId: 'test-user-id',
    email: 'test@example.com',
    role: 'USER',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour
    sessionId: 'test-session-id',
    ...payload,
  };

  // Return a test token string or mock the actual JWT creation
  return `mock.jwt.${Buffer.from(JSON.stringify(basePayload)).toString('base64')}`;
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

  // Mock ioredis module completely
  vi.mock('ioredis', () => ({
    default: vi.fn().mockImplementation(() => mockRedisClient),
    Redis: vi.fn().mockImplementation(() => mockRedisClient),
  }));

  // Mock Logger with stable reference
  vi.mock('winston', () => {
    const mockLoggerFactory = () => ({
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
      child: vi.fn(() => mockLoggerFactory()),
    });

    return {
      default: {
        createLogger: vi.fn(() => mockLoggerFactory()),
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
    };
  });

  // Mock axios
  vi.mock('axios', () => ({
    default: {
      ...mockAxios,
      create: vi.fn(() => mockAxios),
    },
    create: vi.fn(() => mockAxios),
  }));

  // Mock bcrypt
  vi.mock('bcrypt', () => ({
    hash: vi.fn().mockResolvedValue('hashed-password'),
    compare: vi.fn().mockResolvedValue(true),
    genSalt: vi.fn().mockResolvedValue('salt'),
  }));

  // Mock bcryptjs (alternative bcrypt implementation)
  vi.mock('bcryptjs', () => ({
    hash: vi.fn().mockResolvedValue('hashed-password'),
    compare: vi.fn().mockResolvedValue(true),
    genSalt: vi.fn().mockResolvedValue('salt'),
  }));

  // Mock JWT
  vi.mock('jsonwebtoken', () => ({
    default: {
      sign: vi.fn().mockReturnValue('test-jwt-token'),
      verify: vi.fn().mockReturnValue({
        userId: 'test-user-id',
        email: 'test@example.com',
        role: 'USER',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
        sessionId: 'test-session-id',
      }),
      decode: vi.fn().mockReturnValue({
        userId: 'test-user-id',
        email: 'test@example.com',
        role: 'USER',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
        sessionId: 'test-session-id',
      }),
    },
    sign: vi.fn().mockReturnValue('test-jwt-token'),
    verify: vi.fn().mockReturnValue({
      userId: 'test-user-id',
      email: 'test@example.com',
      role: 'USER',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
      sessionId: 'test-session-id',
    }),
    decode: vi.fn().mockReturnValue({
      userId: 'test-user-id',
      email: 'test@example.com',
      role: 'USER',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
      sessionId: 'test-session-id',
    }),
  }));

  // Mock crypto for encryption
  vi.mock('crypto', async () => ({
    ...(await vi.importActual('crypto')),
    randomBytes: vi.fn().mockReturnValue(Buffer.from('test-random-bytes')),
  }));

  // Mock database config
  vi.mock('@/config/database', () => ({
    getDatabase: vi.fn(() => mockPrismaClient),
    initializeDatabase: vi.fn().mockResolvedValue(mockPrismaClient),
    getRepositories: vi.fn(() => ({
      user: mockPrismaClient.user,
      mediaRequest: mockPrismaClient.mediaRequest,
      sessionToken: mockPrismaClient.sessionToken,
      serviceStatus: mockPrismaClient.serviceStatus,
      serviceConfig: mockPrismaClient.serviceConfig,
    })),
  }));

  // Mock main config module
  vi.mock('@/config', () => ({
    config: {
      NODE_ENV: 'test',
      JWT_SECRET: 'test-jwt-secret-key-32-bytes-long',
      JWT_ISSUER: 'medianest-test',
      JWT_AUDIENCE: 'medianest-test-users',
      JWT_EXPIRES_IN: '1h',
      DATABASE_URL: 'postgresql://test:test@localhost:5433/medianest_test',
      REDIS_URL: 'redis://localhost:6380/0',
      jwt: {
        secret: 'test-jwt-secret-key-32-bytes-long',
        issuer: 'medianest-test',
        audience: 'medianest-test-users',
        expiresIn: '1h',
      },
    },
    getJWTConfig: () => ({
      secret: 'test-jwt-secret-key-32-bytes-long',
      issuer: 'medianest-test',
      audience: 'medianest-test-users',
      expiresIn: '1h',
    }),
  }));

  // Mock Prisma client directly
  vi.mock('@/db/prisma', () => ({
    default: mockPrismaClient,
    prisma: mockPrismaClient,
    getPrismaClient: vi.fn(() => mockPrismaClient),
    disconnectPrisma: vi.fn(),
  }));

  // Mock Redis client
  vi.mock('@/config/redis', () => ({
    default: mockRedisClient,
    redisClient: mockRedisClient,
    initializeRedis: vi.fn().mockResolvedValue(mockRedisClient),
    getRedis: vi.fn(() => mockRedisClient),
    getRedisClient: vi.fn(() => mockRedisClient),
    closeRedis: vi.fn().mockResolvedValue(undefined),
    checkRedisHealth: vi.fn().mockResolvedValue(true),
    checkRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
    disconnectRedis: vi.fn(),
  }));

  // Mock missing middleware modules
  vi.mock('@/middleware/rbac', () => ({
    authorize: vi.fn(() => (_req: any, _res: any, next: any) => next()),
    requireRole: vi.fn(() => (_req: any, _res: any, next: any) => next()),
  }));

  // Mock auth middleware modules
  vi.mock('@/middleware/auth.middleware', () => ({
    authMiddleware: vi.fn(() => (_req: any, _res: any, next: any) => next()),
  }));

  // Also mock relative paths for middleware
  vi.mock('../../middleware/auth.middleware', () => ({
    authMiddleware: vi.fn(() => (_req: any, _res: any, next: any) => next()),
  }));

  // Mock JWT utilities
  vi.mock('@/utils/jwt', () => ({
    generateToken: vi.fn().mockReturnValue('test-jwt-token'),
    verifyToken: vi.fn().mockReturnValue({
      userId: 'test-user-id',
      email: 'test@example.com',
      role: 'USER',
      sessionId: 'test-session-id',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    }),
    generateRefreshToken: vi.fn().mockReturnValue('test-refresh-token'),
    verifyRefreshToken: vi.fn().mockReturnValue({
      userId: 'test-user-id',
      sessionId: 'test-session-id',
    }),
    getTokenMetadata: vi.fn().mockReturnValue({
      userId: 'test-user-id',
      sessionId: 'test-session-id',
      tokenId: 'test-token-id',
    }),
    isTokenBlacklisted: vi.fn().mockReturnValue(false),
    blacklistToken: vi.fn(),
    shouldRotateToken: vi.fn().mockReturnValue(false),
    rotateTokenIfNeeded: vi.fn().mockReturnValue(null),
  }));

  vi.mock('../../middleware/validation.middleware', () => ({
    validateRequest: vi.fn(() => (_req: any, _res: any, next: any) => next()),
  }));

  vi.mock('../../lib/logger', () => ({
    logger: mockLogger,
  }));

  // Mock token validation utilities
  vi.mock('../../src/middleware/auth/token-validator', () => ({
    extractToken: vi.fn().mockReturnValue('test-jwt-token'),
    extractTokenOptional: vi.fn().mockReturnValue('test-jwt-token'),
    validateToken: vi.fn().mockReturnValue({
      token: 'test-jwt-token',
      payload: {
        userId: 'test-user-id',
        email: 'test@example.com',
        role: 'USER',
        sessionId: 'test-session-id',
      },
      metadata: {
        tokenId: 'test-token-id',
      },
    }),
  }));

  // Mock user validation utilities
  vi.mock('../../src/middleware/auth/user-validator', () => ({
    validateUser: vi.fn().mockResolvedValue({
      id: 'test-user-id',
      email: 'test@example.com',
      name: 'Test User',
      role: 'USER',
      plexId: 'test-plex-id',
      plexUsername: 'testuser',
    }),
    validateUserOptional: vi.fn().mockResolvedValue({
      id: 'test-user-id',
      email: 'test@example.com',
      name: 'Test User',
      role: 'USER',
      plexId: 'test-plex-id',
      plexUsername: 'testuser',
    }),
  }));

  // Mock device session utilities
  vi.mock('../../src/middleware/auth/device-session-manager', () => ({
    validateSessionToken: vi.fn().mockResolvedValue(undefined),
    registerAndAssessDevice: vi.fn().mockResolvedValue({
      deviceId: 'test-device-id',
      isNewDevice: false,
      riskScore: 0.1,
    }),
    updateSessionActivity: vi.fn().mockResolvedValue(undefined),
  }));
};

// Reset all mocks
export const resetAllMocks = () => {
  vi.clearAllMocks();

  // Reset Prisma mocks
  Object.values(mockPrismaClient).forEach((model: any) => {
    if (typeof model === 'object' && model !== null) {
      Object.values(model).forEach((fn: any) => {
        if (vi.isMockFunction(fn)) {
          fn.mockReset();
        }
      });
    } else if (vi.isMockFunction(model)) {
      model.mockReset();
    }
  });

  // Reset Redis mocks
  if (mockRedisClient && typeof mockRedisClient === 'object') {
    RedisTestUtils.resetMockClient();
  }

  // Reset logger mocks
  Object.values(mockLogger).forEach((fn: any) => {
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
  resetMockPrismaClient();
  RedisTestUtils.resetMockClient();
});

afterEach(() => {
  vi.clearAllTimers();
});

afterAll(async () => {
  await RedisTestUtils.cleanup();
  vi.restoreAllMocks();
});
