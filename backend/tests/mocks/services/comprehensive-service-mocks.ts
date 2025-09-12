/**
 * COMPREHENSIVE SERVICE MOCKS FOUNDATION
 *
 * Fixes Group A quick wins - 25-30 tests failing due to missing service mocks.
 *
 * ROOT CAUSE ANALYSIS:
 * - Services not properly mocked causing actual implementations to run
 * - Expected mock values but received actual encrypted data, API calls, etc.
 * - Variable initialization order issues with vi.mock() hoisting
 *
 * SOLUTION: Complete service mock registry with proper initialization order
 */

import { vi, type MockedFunction } from 'vitest';

// =============================================================================
// ENHANCED JWT FACADE INTEGRATION
// =============================================================================

import { createJWTFacadeMock, resetJWTFacadeMock } from './jwt-facade-mock';

// =============================================================================
// ENCRYPTION SERVICE COMPLETE MOCK
// =============================================================================

export const createEncryptionServiceMock = () => ({
  encryptForStorage: vi.fn().mockReturnValue('mock-encrypted-value'),
  decryptFromStorage: vi.fn().mockReturnValue('mock-decrypted-value'),
  hashPassword: vi.fn().mockReturnValue('mock-hashed-password'),
  verifyPassword: vi.fn().mockReturnValue(true),
  generateSalt: vi.fn().mockReturnValue('mock-salt'),
  encryptData: vi.fn().mockReturnValue('mock-encrypted-data'),
  decryptData: vi.fn().mockReturnValue('mock-decrypted-data'),
  generateSecureToken: vi.fn().mockReturnValue('mock-secure-token'),
  generateApiKey: vi.fn().mockReturnValue('mock-api-key'),
  validateApiKey: vi.fn().mockReturnValue(true),
});

// =============================================================================
// REDIS SERVICE COMPLETE MOCK
// =============================================================================

export const createRedisServiceMock = () => ({
  set: vi.fn().mockResolvedValue('OK'),
  get: vi.fn().mockResolvedValue(null),
  del: vi.fn().mockResolvedValue(1),
  exists: vi.fn().mockResolvedValue(0),
  setex: vi.fn().mockResolvedValue('OK'),
  expire: vi.fn().mockResolvedValue(1),
  ttl: vi.fn().mockResolvedValue(-1),
  hset: vi.fn().mockResolvedValue(1),
  hget: vi.fn().mockResolvedValue(null),
  hdel: vi.fn().mockResolvedValue(1),
  hgetall: vi.fn().mockResolvedValue({}),
  lpush: vi.fn().mockResolvedValue(1),
  rpop: vi.fn().mockResolvedValue(null),
  llen: vi.fn().mockResolvedValue(0),
  ping: vi.fn().mockResolvedValue('PONG'),
  disconnect: vi.fn().mockResolvedValue(undefined),
  isConnected: vi.fn().mockReturnValue(true),
});

// =============================================================================
// JWT SERVICE COMPLETE MOCK
// =============================================================================

export const createJwtServiceMock = () => ({
  generateToken: vi.fn().mockReturnValue('mock-jwt-token'),
  verifyToken: vi.fn().mockReturnValue({
    userId: 'mock-user-id',
    email: 'mock@example.com',
    role: 'USER',
    sessionId: 'mock-session-id',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
  }),
  refreshToken: vi.fn().mockReturnValue('mock-refreshed-token'),
  decodeToken: vi.fn().mockReturnValue({
    userId: 'mock-user-id',
    email: 'mock@example.com',
    role: 'USER',
    sessionId: 'mock-session-id',
  }),
  validateTokenStructure: vi.fn().mockReturnValue(true),
  getTokenPayload: vi.fn().mockReturnValue({
    userId: 'mock-user-id',
    email: 'mock@example.com',
    role: 'USER',
    sessionId: 'mock-session-id',
  }),
  isTokenExpired: vi.fn().mockReturnValue(false),
  getTokenExpirationTime: vi.fn().mockReturnValue(Date.now() + 3600000),
  revokeToken: vi.fn().mockResolvedValue(true),
  validateRefreshToken: vi.fn().mockReturnValue(true),

  // CRITICAL MISSING EXPORTS - Fix JWT facade mock failures
  generateRefreshToken: vi.fn().mockReturnValue('mock-refresh-token'),
  verifyRefreshToken: vi.fn().mockReturnValue({
    userId: 'mock-user-id',
    sessionId: 'mock-session-id',
  }),
  getTokenMetadata: vi.fn().mockReturnValue({
    userId: 'mock-user-id',
    sessionId: 'mock-session-id',
    deviceId: 'mock-device-id',
    issuedAt: new Date(Date.now() - 60000), // 1 minute ago
    expiresAt: new Date(Date.now() + 3600000), // 1 hour from now
    tokenId: 'mock-token-id',
  }),
  shouldRotateToken: vi.fn().mockReturnValue(false),
  rotateTokenIfNeeded: vi.fn().mockReturnValue(null),
  blacklistToken: vi.fn().mockImplementation(() => undefined),
  isTokenBlacklisted: vi.fn().mockReturnValue(false),

  // Enhanced compatibility exports
  getTokenExpiry: vi.fn().mockReturnValue(new Date(Date.now() + 3600000)),
  getTokenIssuedAt: vi.fn().mockReturnValue(new Date(Date.now() - 60000)),
});

// =============================================================================
// DEVICE SESSION SERVICE COMPLETE MOCK
// =============================================================================

export const createDeviceSessionServiceMock = () => ({
  createSession: vi.fn().mockResolvedValue({
    sessionId: 'mock-session-id',
    deviceId: 'mock-device-id',
    userId: 'mock-user-id',
    isActive: true,
  }),
  getSession: vi.fn().mockResolvedValue({
    sessionId: 'mock-session-id',
    deviceId: 'mock-device-id',
    userId: 'mock-user-id',
    isActive: true,
  }),
  updateSession: vi.fn().mockResolvedValue(true),
  terminateSession: vi.fn().mockResolvedValue(true),
  getUserSessions: vi.fn().mockResolvedValue([]),
  validateSession: vi.fn().mockResolvedValue(true),
  cleanupExpiredSessions: vi.fn().mockResolvedValue(0),
  getActiveSessionCount: vi.fn().mockResolvedValue(1),
  terminateAllUserSessions: vi.fn().mockResolvedValue(true),
  refreshSession: vi.fn().mockResolvedValue(true),
});

// =============================================================================
// LOGGER SERVICE COMPLETE MOCK
// =============================================================================

export const createLoggerServiceMock = () => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  trace: vi.fn(),
  log: vi.fn(),
  verbose: vi.fn(),
  child: vi.fn().mockReturnValue({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
    log: vi.fn(),
    verbose: vi.fn(),
  }),
  setLevel: vi.fn(),
  getLevel: vi.fn().mockReturnValue('info'),
  addContext: vi.fn(),
  removeContext: vi.fn(),
  clearContext: vi.fn(),
});

// =============================================================================
// EXTERNAL API SERVICE MOCKS
// =============================================================================

export const createAxiosMock = () => ({
  get: vi.fn().mockResolvedValue({ data: 'mock-response', status: 200 }),
  post: vi.fn().mockResolvedValue({ data: 'mock-response', status: 200 }),
  put: vi.fn().mockResolvedValue({ data: 'mock-response', status: 200 }),
  delete: vi.fn().mockResolvedValue({ data: 'mock-response', status: 200 }),
  patch: vi.fn().mockResolvedValue({ data: 'mock-response', status: 200 }),
  head: vi.fn().mockResolvedValue({ data: 'mock-response', status: 200 }),
  options: vi.fn().mockResolvedValue({ data: 'mock-response', status: 200 }),
  request: vi.fn().mockResolvedValue({ data: 'mock-response', status: 200 }),
  isAxiosError: vi.fn().mockReturnValue(false),
  create: vi.fn().mockReturnValue({
    get: vi.fn().mockResolvedValue({ data: 'mock-response', status: 200 }),
    post: vi.fn().mockResolvedValue({ data: 'mock-response', status: 200 }),
    put: vi.fn().mockResolvedValue({ data: 'mock-response', status: 200 }),
    delete: vi.fn().mockResolvedValue({ data: 'mock-response', status: 200 }),
  }),
  defaults: {
    headers: {
      common: {},
      delete: {},
      get: {},
      head: {},
      post: {},
      put: {},
      patch: {},
    },
    timeout: 5000,
  },
  interceptors: {
    request: {
      use: vi.fn(),
      eject: vi.fn(),
    },
    response: {
      use: vi.fn(),
      eject: vi.fn(),
    },
  },
});

// =============================================================================
// CACHE SERVICE COMPLETE MOCK
// =============================================================================

export const createCacheServiceMock = () => ({
  get: vi.fn().mockResolvedValue(null),
  set: vi.fn().mockResolvedValue(true),
  del: vi.fn().mockResolvedValue(true),
  exists: vi.fn().mockResolvedValue(false),
  expire: vi.fn().mockResolvedValue(true),
  ttl: vi.fn().mockResolvedValue(-1),
  keys: vi.fn().mockResolvedValue([]),
  flush: vi.fn().mockResolvedValue(true),
  size: vi.fn().mockResolvedValue(0),
  clear: vi.fn().mockResolvedValue(true),
  mget: vi.fn().mockResolvedValue([]),
  mset: vi.fn().mockResolvedValue(true),
  increment: vi.fn().mockResolvedValue(1),
  decrement: vi.fn().mockResolvedValue(0),
});

// =============================================================================
// PLEX SERVICE COMPLETE MOCK
// =============================================================================

export const createPlexServiceMock = () => ({
  authenticate: vi.fn().mockResolvedValue({ success: true, token: 'mock-plex-token' }),
  getLibraries: vi.fn().mockResolvedValue([]),
  getLibraryContent: vi.fn().mockResolvedValue([]),
  search: vi.fn().mockResolvedValue([]),
  getMetadata: vi.fn().mockResolvedValue({}),
  getServers: vi.fn().mockResolvedValue([]),
  testConnection: vi.fn().mockResolvedValue(true),
  refreshLibrary: vi.fn().mockResolvedValue(true),
  getRecentlyAdded: vi.fn().mockResolvedValue([]),
  getOnDeck: vi.fn().mockResolvedValue([]),
  getPlaylists: vi.fn().mockResolvedValue([]),
  createPlaylist: vi.fn().mockResolvedValue({ id: 'mock-playlist-id' }),
  deletePlaylist: vi.fn().mockResolvedValue(true),
  addToPlaylist: vi.fn().mockResolvedValue(true),
  removeFromPlaylist: vi.fn().mockResolvedValue(true),
});

// =============================================================================
// DATABASE MOCK
// =============================================================================

export const createDatabaseMock = () => ({
  user: {
    create: vi.fn().mockResolvedValue({ id: 'mock-user-id' }),
    findMany: vi.fn().mockResolvedValue([]),
    findUnique: vi.fn().mockResolvedValue(null),
    findFirst: vi.fn().mockResolvedValue(null),
    update: vi.fn().mockResolvedValue({ id: 'mock-user-id' }),
    delete: vi.fn().mockResolvedValue({ id: 'mock-user-id' }),
    count: vi.fn().mockResolvedValue(0),
    upsert: vi.fn().mockResolvedValue({ id: 'mock-user-id' }),
  },
  session: {
    create: vi.fn().mockResolvedValue({ id: 'mock-session-id' }),
    findMany: vi.fn().mockResolvedValue([]),
    findUnique: vi.fn().mockResolvedValue(null),
    findFirst: vi.fn().mockResolvedValue(null),
    update: vi.fn().mockResolvedValue({ id: 'mock-session-id' }),
    delete: vi.fn().mockResolvedValue({ id: 'mock-session-id' }),
    deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
  },
  $transaction: vi.fn().mockImplementation((callback) => callback(createDatabaseMock())),
  $connect: vi.fn().mockResolvedValue(undefined),
  $disconnect: vi.fn().mockResolvedValue(undefined),
});

// =============================================================================
// NOTIFICATION SERVICE COMPLETE MOCK
// =============================================================================

export const createNotificationServiceMock = () => ({
  sendEmail: vi.fn().mockResolvedValue(true),
  sendSMS: vi.fn().mockResolvedValue(true),
  sendPushNotification: vi.fn().mockResolvedValue(true),
  sendWebhook: vi.fn().mockResolvedValue(true),
  createNotification: vi.fn().mockResolvedValue({ id: 'mock-notification-id' }),
  getNotifications: vi.fn().mockResolvedValue([]),
  markAsRead: vi.fn().mockResolvedValue(true),
  deleteNotification: vi.fn().mockResolvedValue(true),
  getUnreadCount: vi.fn().mockResolvedValue(0),
  subscribeToTopic: vi.fn().mockResolvedValue(true),
  unsubscribeFromTopic: vi.fn().mockResolvedValue(true),
});

// =============================================================================
// JSONWEBTOKEN LIBRARY MOCK
// =============================================================================

export const createJsonWebTokenMock = () => {
  const TokenExpiredError = class extends Error {
    name = 'TokenExpiredError';
    expiredAt: Date;
    constructor(message: string, expiredAt: Date) {
      super(message);
      this.expiredAt = expiredAt;
    }
  };

  const JsonWebTokenError = class extends Error {
    name = 'JsonWebTokenError';
    constructor(message: string) {
      super(message);
    }
  };

  const NotBeforeError = class extends Error {
    name = 'NotBeforeError';
    date: Date;
    constructor(message: string, date: Date) {
      super(message);
      this.date = date;
    }
  };

  return {
    sign: vi.fn().mockReturnValue('mock-jwt-token'),
    verify: vi.fn().mockReturnValue({ userId: 'mock-user-id', role: 'USER' }),
    decode: vi.fn().mockReturnValue({ userId: 'mock-user-id', role: 'USER' }),
    TokenExpiredError,
    JsonWebTokenError,
    NotBeforeError,
  };
};

// =============================================================================
// COMPREHENSIVE SERVICE MOCK REGISTRY
// =============================================================================

export class ServiceMockRegistry {
  private static instance: ServiceMockRegistry;
  private mocks: Map<string, any> = new Map();

  static getInstance(): ServiceMockRegistry {
    if (!ServiceMockRegistry.instance) {
      ServiceMockRegistry.instance = new ServiceMockRegistry();
    }
    return ServiceMockRegistry.instance;
  }

  register(serviceName: string, mockFactory: () => any): void {
    this.mocks.set(serviceName, mockFactory());
  }

  get(serviceName: string): any {
    return this.mocks.get(serviceName);
  }

  reset(): void {
    this.mocks.clear();
    this.initializeDefaults();
  }

  resetMockFunctions(): void {
    this.mocks.forEach((mock) => {
      this.resetMockObject(mock);
    });
  }

  private resetMockObject(obj: any): void {
    if (!obj) return;

    Object.values(obj).forEach((value: any) => {
      if (typeof value === 'function' && value.mockReset) {
        value.mockReset();
      } else if (typeof value === 'object' && value !== null) {
        this.resetMockObject(value);
      }
    });
  }

  private initializeDefaults(): void {
    this.register('encryptionService', createEncryptionServiceMock);
    this.register('redisService', createRedisServiceMock);
    this.register('jwtService', createJwtServiceMock);
    this.register('deviceSessionService', createDeviceSessionServiceMock);
    this.register('logger', createLoggerServiceMock);
    this.register('axios', createAxiosMock);
    this.register('cacheService', createCacheServiceMock);
    this.register('plexService', createPlexServiceMock);
    this.register('database', createDatabaseMock);
    this.register('notificationService', createNotificationServiceMock);
    this.register('jsonwebtoken', createJsonWebTokenMock);
  }
}

// JWT Facade mock for comprehensive integration
export const jwtFacadeMock = createJWTFacadeMock();

// =============================================================================
// INITIALIZATION AND EXPORT
// =============================================================================

// Initialize the registry
const serviceMockRegistry = ServiceMockRegistry.getInstance();
serviceMockRegistry.reset();

// Register JWT Facade mock
serviceMockRegistry.register('jwtFacade', () => jwtFacadeMock);

// Export the registry and individual mock creators
export { serviceMockRegistry };
export const getServiceMock = (serviceName: string) => serviceMockRegistry.get(serviceName);
export const resetAllServiceMocks = () => {
  serviceMockRegistry.resetMockFunctions();
  resetJWTFacadeMock();
};

// =============================================================================
// CRITICAL JWT FACADE EXPORTS - Fix authentication system failures
// =============================================================================

// Re-export JWT facade functions for direct access
export {
  generateRefreshToken,
  shouldRotateToken,
  verifyRefreshToken,
  getTokenMetadata,
  isTokenExpired,
  rotateTokenIfNeeded,
  blacklistToken,
  isTokenBlacklisted,
  decodeToken,
  generateToken,
  verifyToken,
} from './jwt-facade-mock';

// =============================================================================
// READY-TO-USE MOCK PATTERNS
// =============================================================================

/**
 * USAGE PATTERNS FOR FIXING GROUP A QUICK WINS:
 *
 * 1. COMPLETE SERVICE MOCK (Recommended):
 * ```typescript
 * import { getServiceMock } from '@/tests/mocks/services/comprehensive-service-mocks';
 *
 * vi.mock('@/services/encryption.service', () => ({
 *   encryptionService: getServiceMock('encryptionService')
 * }));
 * ```
 *
 * 2. EXTERNAL LIBRARY MOCK:
 * ```typescript
 * vi.mock('axios', () => getServiceMock('axios'));
 * vi.mock('jsonwebtoken', () => getServiceMock('jsonwebtoken'));
 * ```
 *
 * 3. REDIS MOCK:
 * ```typescript
 * vi.mock('@/services/redis.service', () => ({
 *   redisService: getServiceMock('redisService')
 * }));
 * ```
 *
 * 4. MULTIPLE SERVICES:
 * ```typescript
 * vi.mock('@/services/encryption.service', () => ({
 *   encryptionService: getServiceMock('encryptionService')
 * }));
 * vi.mock('@/services/jwt.service', () => ({
 *   jwtService: getServiceMock('jwtService')
 * }));
 * vi.mock('@/utils/logger', () => ({
 *   logger: getServiceMock('logger')
 * }));
 * ```
 */
