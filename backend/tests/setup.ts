import { vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { mockDeep, mockReset, DeepMockProxy } from 'vitest-mock-extended';
import { PrismaClient } from '@prisma/client';

// Mock Prisma Client
export const mockPrisma = mockDeep<PrismaClient>();

// Mock Redis Client
export const mockRedis = {
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
  exists: vi.fn(),
  expire: vi.fn(),
  flushall: vi.fn(),
  quit: vi.fn(),
  ping: vi.fn()
};

// Mock Logger
export const mockLogger = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
  trace: vi.fn()
};

// Mock External Services
export const mockAxios = {
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
  patch: vi.fn(),
  request: vi.fn()
};

// Global test environment setup
beforeAll(async () => {
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_medianest';
  process.env.REDIS_URL = 'redis://localhost:6379/1';
  process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only';
  process.env.ENCRYPTION_KEY = 'test-encryption-key-32-chars-long!';
  process.env.PLEX_CLIENT_ID = 'test-plex-client-id';
  process.env.FRONTEND_URL = 'http://localhost:3000';
  process.env.BACKEND_URL = 'http://localhost:3001';
  
  // Mock external dependencies
  vi.mock('@/db/prisma', () => ({
    prisma: mockPrisma
  }));
  
  vi.mock('@/config/redis', () => ({
    redis: mockRedis
  }));
  
  vi.mock('@/utils/logger', () => ({
    logger: mockLogger
  }));
  
  vi.mock('axios', () => ({
    default: mockAxios,
    ...mockAxios
  }));
});

beforeEach(() => {
  // Reset all mocks before each test
  mockReset(mockPrisma);
  vi.clearAllMocks();
});

afterEach(() => {
  // Clean up after each test
  vi.restoreAllMocks();
});

afterAll(async () => {
  // Clean up global resources
  vi.clearAllTimers();
  vi.useRealTimers();
});

// Test utilities
export const createMockRequest = (overrides: any = {}) => ({
  body: {},
  params: {},
  query: {},
  headers: {},
  user: undefined,
  token: undefined,
  ...overrides
});

export const createMockResponse = () => {
  const res: any = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
    cookie: vi.fn().mockReturnThis(),
    clearCookie: vi.fn().mockReturnThis(),
    redirect: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    locals: {}
  };
  return res;
};

export const createMockNext = () => vi.fn();

// Test data factories
export const createTestUser = (overrides: any = {}) => ({
  id: 'test-user-id',
  email: 'test@example.com',
  role: 'user',
  status: 'active',
  plexId: 'test-plex-id',
  plexToken: 'encrypted-test-token',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides
});

export const createTestMediaRequest = (overrides: any = {}) => ({
  id: 'test-request-id',
  userId: 'test-user-id',
  type: 'movie',
  title: 'Test Movie',
  year: 2023,
  status: 'pending',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides
});

export const createTestYouTubeDownload = (overrides: any = {}) => ({
  id: 'test-download-id',
  userId: 'test-user-id',
  url: 'https://youtube.com/watch?v=test',
  title: 'Test Video',
  status: 'pending',
  format: 'mp4',
  quality: '720p',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides
});

// Health check test utilities
export const createHealthCheckMocks = () => ({
  database: vi.fn().mockResolvedValue({ status: 'healthy', responseTime: 10 }),
  redis: vi.fn().mockResolvedValue({ status: 'healthy', responseTime: 5 }),
  plex: vi.fn().mockResolvedValue({ status: 'healthy', responseTime: 50 }),
  youtube: vi.fn().mockResolvedValue({ status: 'healthy', responseTime: 100 })
});

// Socket.IO test utilities
export const createMockSocket = () => ({
  id: 'test-socket-id',
  emit: vi.fn(),
  on: vi.fn(),
  join: vi.fn(),
  leave: vi.fn(),
  disconnect: vi.fn(),
  handshake: {
    auth: {},
    query: {}
  },
  data: {}
});

export const createMockIO = () => ({
  emit: vi.fn(),
  to: vi.fn().mockReturnThis(),
  in: vi.fn().mockReturnThis(),
  sockets: {
    emit: vi.fn()
  }
});