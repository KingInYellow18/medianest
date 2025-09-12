/**
 * COMPREHENSIVE MOCK REGISTRY
 *
 * Centralized mock management system for all external dependencies.
 * Provides isolation, reliability, and consistent mock behavior.
 */

import { vi, type MockedFunction } from 'vitest';
import { setupJWTMocks } from './jwt-mock';
import { setupRedisMocks } from './redis-mock';
import { setupPrismaMocks } from './prisma-mock';
import { setupAuthServiceMocks } from './auth-mock';
import { setupCacheServiceMocks } from './cache-service-mock';

/**
 * Mock Registry - Central hub for all mocks
 */
export class MockRegistry {
  private static instance: MockRegistry;
  private mocks: Map<string, any> = new Map();
  private isInitialized = false;

  static getInstance(): MockRegistry {
    if (!MockRegistry.instance) {
      MockRegistry.instance = new MockRegistry();
    }
    return MockRegistry.instance;
  }

  /**
   * Initialize all mock systems
   */
  initializeAll(): void {
    if (this.isInitialized) return;

    // Initialize core infrastructure mocks
    this.setupJWTMocks();
    this.setupDatabaseMocks();
    this.setupCacheMocks();
    this.setupCacheServiceMocks();
    this.setupHTTPClientMocks();
    this.setupFileSystemMocks();
    this.setupCryptographyMocks();
    this.setupLoggingMocks();
    this.setupEnvironmentMocks();
    this.setupExternalServiceMocks();
    this.setupWebSocketMocks();
    this.setupValidationMocks();

    this.isInitialized = true;
    console.log('🎭 Comprehensive mock registry initialized');
  }

  /**
   * Setup JWT and authentication mocks
   */
  private setupJWTMocks(): void {
    const jwtMocks = setupJWTMocks();
    const authMocks = setupAuthServiceMocks();

    this.mocks.set('jwt', jwtMocks);
    this.mocks.set('auth', authMocks);
  }

  /**
   * Setup database mocks (Prisma + Redis)
   */
  private setupDatabaseMocks(): void {
    const prismaMocks = setupPrismaMocks();
    const redisMocks = setupRedisMocks();

    this.mocks.set('prisma', prismaMocks);
    this.mocks.set('redis', redisMocks);

    // Database connection pool mocks
    vi.mock('pg', () => ({
      Pool: vi.fn(() => ({
        connect: vi.fn().mockResolvedValue({
          query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
          release: vi.fn(),
        }),
        end: vi.fn().mockResolvedValue(undefined),
        query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
      })),
      Client: vi.fn(() => ({
        connect: vi.fn().mockResolvedValue(undefined),
        end: vi.fn().mockResolvedValue(undefined),
        query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
      })),
    }));

    // Kysely query builder mock
    vi.mock('kysely', () => ({
      Kysely: vi.fn(() => ({
        selectFrom: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        insertInto: vi.fn().mockReturnThis(),
        values: vi.fn().mockReturnThis(),
        updateTable: vi.fn().mockReturnThis(),
        set: vi.fn().mockReturnThis(),
        deleteFrom: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue([]),
        executeTakeFirst: vi.fn().mockResolvedValue(null),
        executeTakeFirstOrThrow: vi.fn().mockResolvedValue({}),
      })),
      PostgresDialect: vi.fn(),
      FileMigrationProvider: vi.fn(),
      Migrator: vi.fn(() => ({
        migrateToLatest: vi.fn().mockResolvedValue({ error: undefined, results: [] }),
      })),
    }));
  }

  /**
   * Setup cache and storage mocks
   */
  private setupCacheMocks(): void {
    // Node-cache mock
    vi.mock('node-cache', () => ({
      default: vi.fn(() => ({
        get: vi.fn().mockReturnValue(undefined),
        set: vi.fn().mockReturnValue(true),
        del: vi.fn().mockReturnValue(1),
        flushAll: vi.fn(),
        keys: vi.fn().mockReturnValue([]),
        has: vi.fn().mockReturnValue(false),
        ttl: vi.fn().mockReturnValue(0),
        getTtl: vi.fn().mockReturnValue(0),
        mget: vi.fn().mockReturnValue({}),
        mset: vi.fn().mockReturnValue(true),
      })),
    }));

    // Memory store mock
    const mockMemoryStore = {
      data: new Map(),
      get: vi.fn().mockImplementation((key: string) => mockMemoryStore.data.get(key)),
      set: vi.fn().mockImplementation((key: string, value: any) => {
        mockMemoryStore.data.set(key, value);
        return true;
      }),
      del: vi.fn().mockImplementation((key: string) => mockMemoryStore.data.delete(key)),
      clear: vi.fn().mockImplementation(() => mockMemoryStore.data.clear()),
      keys: vi.fn().mockImplementation(() => Array.from(mockMemoryStore.data.keys())),
    };

    this.mocks.set('cache', mockMemoryStore);
  }

  /**
   * Setup cache service mocks (for application cache service)
   */
  private setupCacheServiceMocks(): void {
    const cacheServiceMocks = setupCacheServiceMocks();
    this.mocks.set('cacheService', cacheServiceMocks);
  }

  /**
   * Setup HTTP client mocks (axios, fetch, etc.)
   */
  private setupHTTPClientMocks(): void {
    // Axios mock
    const mockAxiosInstance = {
      get: vi.fn().mockResolvedValue({ data: {}, status: 200, statusText: 'OK' }),
      post: vi.fn().mockResolvedValue({ data: {}, status: 201, statusText: 'Created' }),
      put: vi.fn().mockResolvedValue({ data: {}, status: 200, statusText: 'OK' }),
      patch: vi.fn().mockResolvedValue({ data: {}, status: 200, statusText: 'OK' }),
      delete: vi.fn().mockResolvedValue({ data: {}, status: 204, statusText: 'No Content' }),
      head: vi.fn().mockResolvedValue({ headers: {}, status: 200, statusText: 'OK' }),
      options: vi.fn().mockResolvedValue({ headers: {}, status: 200, statusText: 'OK' }),
      request: vi.fn().mockResolvedValue({ data: {}, status: 200, statusText: 'OK' }),
      defaults: {
        headers: { common: {} },
        timeout: 5000,
        baseURL: '',
      },
      interceptors: {
        request: {
          use: vi.fn().mockReturnValue(0),
          eject: vi.fn(),
          clear: vi.fn(),
        },
        response: {
          use: vi.fn().mockReturnValue(0),
          eject: vi.fn(),
          clear: vi.fn(),
        },
      },
      create: vi.fn().mockReturnThis(),
    };

    vi.mock('axios', () => ({
      default: mockAxiosInstance,
      ...mockAxiosInstance,
      create: vi.fn(() => ({ ...mockAxiosInstance })),
      isAxiosError: vi.fn().mockReturnValue(false),
      Cancel: vi.fn(),
      CancelToken: {
        source: vi.fn(() => ({
          token: {},
          cancel: vi.fn(),
        })),
      },
    }));

    // Fetch mock
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: new Headers(),
      json: vi.fn().mockResolvedValue({}),
      text: vi.fn().mockResolvedValue(''),
      blob: vi.fn().mockResolvedValue(new Blob()),
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(0)),
      clone: vi.fn().mockReturnThis(),
    });

    // XMLHttpRequest mock
    global.XMLHttpRequest = vi.fn(() => ({
      open: vi.fn(),
      send: vi.fn(),
      setRequestHeader: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      abort: vi.fn(),
      readyState: 4,
      status: 200,
      statusText: 'OK',
      responseText: '{}',
      response: {},
    })) as any;

    this.mocks.set('http', { axios: mockAxiosInstance, fetch: global.fetch });
  }

  /**
   * Setup filesystem mocks
   */
  private setupFileSystemMocks(): void {
    vi.mock('fs', async () => {
      const actual = await vi.importActual('fs');
      return {
        ...actual,
        readFileSync: vi.fn().mockReturnValue('mock-file-content'),
        writeFileSync: vi.fn(),
        readFile: vi.fn().mockImplementation((path, callback) => {
          if (typeof callback === 'function') {
            callback(null, 'mock-file-content');
          }
        }),
        writeFile: vi.fn().mockImplementation((path, data, callback) => {
          if (typeof callback === 'function') {
            callback(null);
          }
        }),
        existsSync: vi.fn().mockReturnValue(true),
        mkdirSync: vi.fn(),
        mkdir: vi.fn().mockImplementation((path, callback) => {
          if (typeof callback === 'function') {
            callback(null);
          }
        }),
        rmSync: vi.fn(),
        unlinkSync: vi.fn(),
        statSync: vi.fn().mockReturnValue({
          isFile: () => true,
          isDirectory: () => false,
          size: 1024,
          mtime: new Date(),
        }),
        createReadStream: vi.fn().mockReturnValue({
          pipe: vi.fn().mockReturnThis(),
          on: vi.fn().mockReturnThis(),
          read: vi.fn(),
        }),
        createWriteStream: vi.fn().mockReturnValue({
          write: vi.fn(),
          end: vi.fn(),
          on: vi.fn().mockReturnThis(),
        }),
      };
    });

    vi.mock('fs/promises', () => ({
      readFile: vi.fn().mockResolvedValue('mock-file-content'),
      writeFile: vi.fn().mockResolvedValue(undefined),
      mkdir: vi.fn().mockResolvedValue(undefined),
      readdir: vi.fn().mockResolvedValue([]),
      stat: vi.fn().mockResolvedValue({
        isFile: () => true,
        isDirectory: () => false,
        size: 1024,
        mtime: new Date(),
      }),
      unlink: vi.fn().mockResolvedValue(undefined),
      rmdir: vi.fn().mockResolvedValue(undefined),
    }));

    vi.mock('path', async () => {
      const actual = await vi.importActual('path');
      return {
        ...actual,
        join: vi.fn().mockImplementation((...args) => args.join('/')),
        resolve: vi.fn().mockImplementation((...args) => '/' + args.join('/')),
        basename: vi.fn().mockImplementation((path) => path.split('/').pop()),
        dirname: vi.fn().mockImplementation((path) => path.split('/').slice(0, -1).join('/')),
        extname: vi.fn().mockImplementation((path) => {
          const parts = path.split('.');
          return parts.length > 1 ? '.' + parts[parts.length - 1] : '';
        }),
      };
    });
  }

  /**
   * Setup cryptography mocks
   */
  private setupCryptographyMocks(): void {
    vi.mock('crypto', async () => {
      const actual = await vi.importActual('crypto');
      return {
        ...actual,
        randomBytes: vi.fn().mockImplementation((size: number) => {
          return Buffer.alloc(size, 'a'); // Fill with 'a' for deterministic tests
        }),
        randomUUID: vi.fn().mockReturnValue('00000000-0000-4000-8000-000000000000'),
        createHash: vi.fn(() => ({
          update: vi.fn().mockReturnThis(),
          digest: vi.fn().mockReturnValue('mock-hash-digest'),
        })),
        createHmac: vi.fn(() => ({
          update: vi.fn().mockReturnThis(),
          digest: vi.fn().mockReturnValue('mock-hmac-digest'),
        })),
        createCipher: vi.fn(() => ({
          update: vi.fn().mockReturnValue('encrypted'),
          final: vi.fn().mockReturnValue(''),
        })),
        createDecipher: vi.fn(() => ({
          update: vi.fn().mockReturnValue('decrypted'),
          final: vi.fn().mockReturnValue(''),
        })),
        scrypt: vi.fn().mockImplementation((password, salt, keylen, callback) => {
          callback(null, Buffer.alloc(keylen, 'k'));
        }),
        pbkdf2: vi
          .fn()
          .mockImplementation((password, salt, iterations, keylen, digest, callback) => {
            callback(null, Buffer.alloc(keylen, 'p'));
          }),
      };
    });

    // bcrypt/bcryptjs mock
    const bcryptMock = {
      hash: vi.fn().mockResolvedValue('$2b$10$mock.hashed.password'),
      compare: vi.fn().mockResolvedValue(true),
      genSalt: vi.fn().mockResolvedValue('$2b$10$mocksalt'),
      hashSync: vi.fn().mockReturnValue('$2b$10$mock.hashed.password'),
      compareSync: vi.fn().mockReturnValue(true),
      genSaltSync: vi.fn().mockReturnValue('$2b$10$mocksalt'),
    };

    vi.mock('bcrypt', () => bcryptMock);
    // Standardized on bcrypt only, removed bcryptjs to prevent conflicts

    // Argon2 mock
    vi.mock('argon2', () => ({
      hash: vi.fn().mockResolvedValue('$argon2id$v=19$m=4096,t=3,p=1$mock-salt$mock-hash'),
      verify: vi.fn().mockResolvedValue(true),
      needsRehash: vi.fn().mockReturnValue(false),
    }));

    this.mocks.set('crypto', { bcrypt: bcryptMock });
  }

  /**
   * Setup logging mocks
   */
  private setupLoggingMocks(): void {
    const mockLogger = {
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
      debug: vi.fn(),
      trace: vi.fn(),
      log: vi.fn(),
      child: vi.fn().mockReturnThis(),
    };

    // Winston mock
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
          simple: vi.fn(),
        },
        transports: {
          Console: vi.fn(),
          File: vi.fn(),
          Http: vi.fn(),
        },
      },
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
    }));

    // Pino mock
    vi.mock('pino', () => ({
      default: vi.fn(() => mockLogger),
      pino: vi.fn(() => mockLogger),
    }));

    // Console override for tests
    const originalConsole = { ...console };
    Object.assign(console, {
      log: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
      debug: vi.fn(),
      trace: vi.fn(),
    });

    this.mocks.set('logger', { winston: mockLogger, console: originalConsole });
  }

  /**
   * Setup environment and configuration mocks
   */
  private setupEnvironmentMocks(): void {
    // dotenv mock
    vi.mock('dotenv', () => ({
      config: vi.fn().mockReturnValue({ parsed: {} }),
    }));

    // process.env setup
    const originalEnv = process.env;
    process.env = {
      ...originalEnv,
      NODE_ENV: 'test',
      JWT_SECRET: 'test-jwt-secret-key-32-bytes-long',
      JWT_ISSUER: 'medianest-test',
      JWT_AUDIENCE: 'medianest-test-users',
      ENCRYPTION_KEY: 'test-encryption-key-32-bytes-long',
      DATABASE_URL: 'postgresql://test:test@localhost:5433/medianest_test',
      REDIS_URL: 'redis://localhost:6380/15',
      PLEX_CLIENT_ID: 'test-plex-client-id',
      PLEX_CLIENT_SECRET: 'test-plex-client-secret',
      FRONTEND_URL: 'http://localhost:3000',
      LOG_LEVEL: 'silent',
    };

    this.mocks.set('env', { original: originalEnv });
  }

  /**
   * Setup external service mocks (Plex, TMDB, etc.)
   */
  private setupExternalServiceMocks(): void {
    // Plex API mock
    const mockPlexClient = {
      getServerInfo: vi.fn().mockResolvedValue({
        machineIdentifier: 'test-plex-server',
        version: '1.0.0',
        friendlyName: 'Test Plex Server',
      }),
      getLibraries: vi.fn().mockResolvedValue([]),
      getLibraryItems: vi.fn().mockResolvedValue([]),
      search: vi.fn().mockResolvedValue([]),
      getRecentlyAdded: vi.fn().mockResolvedValue([]),
      getCollections: vi.fn().mockResolvedValue([]),
      getCollectionDetails: vi.fn().mockResolvedValue({}),
      generatePin: vi.fn().mockResolvedValue({
        id: 'test-pin-id',
        code: '1234',
        expiresAt: new Date(Date.now() + 900000),
      }),
      checkPinStatus: vi.fn().mockResolvedValue({
        authorized: true,
        authToken: 'test-auth-token',
      }),
    };

    // TMDB API mock
    const mockTMDBClient = {
      searchMovie: vi.fn().mockResolvedValue({ results: [] }),
      searchTv: vi.fn().mockResolvedValue({ results: [] }),
      getMovieDetails: vi.fn().mockResolvedValue({}),
      getTvDetails: vi.fn().mockResolvedValue({}),
      getPersonDetails: vi.fn().mockResolvedValue({}),
    };

    // Email service mock
    const mockEmailService = {
      send: vi.fn().mockResolvedValue({ messageId: 'test-message-id' }),
      sendWelcome: vi.fn().mockResolvedValue(undefined),
      sendPasswordReset: vi.fn().mockResolvedValue(undefined),
      sendOrderConfirmation: vi.fn().mockResolvedValue(undefined),
    };

    this.mocks.set('external', {
      plex: mockPlexClient,
      tmdb: mockTMDBClient,
      email: mockEmailService,
    });
  }

  /**
   * Setup WebSocket mocks
   */
  private setupWebSocketMocks(): void {
    // Socket.io mock
    const mockSocketServer = {
      on: vi.fn(),
      off: vi.fn(),
      emit: vi.fn(),
      to: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      close: vi.fn(),
      sockets: {
        emit: vi.fn(),
        in: vi.fn().mockReturnThis(),
        to: vi.fn().mockReturnThis(),
      },
    };

    const mockSocket = {
      id: 'test-socket-id',
      on: vi.fn(),
      off: vi.fn(),
      emit: vi.fn(),
      join: vi.fn(),
      leave: vi.fn(),
      disconnect: vi.fn(),
      rooms: new Set(['test-room']),
      data: {},
    };

    vi.mock('socket.io', () => ({
      Server: vi.fn(() => mockSocketServer),
    }));

    // ws mock
    const mockWebSocket = {
      send: vi.fn(),
      close: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
      readyState: 1, // OPEN
      CONNECTING: 0,
      OPEN: 1,
      CLOSING: 2,
      CLOSED: 3,
    };

    vi.mock('ws', () => ({
      WebSocketServer: vi.fn(() => ({
        on: vi.fn(),
        close: vi.fn(),
        clients: new Set(),
      })),
      WebSocket: vi.fn(() => mockWebSocket),
    }));

    this.mocks.set('websocket', {
      socketio: mockSocketServer,
      ws: mockWebSocket,
      socket: mockSocket,
    });
  }

  /**
   * Setup validation and schema mocks
   */
  private setupValidationMocks(): void {
    // Joi mock
    const mockJoiSchema = {
      validate: vi.fn().mockReturnValue({ error: null, value: {} }),
      validateAsync: vi.fn().mockResolvedValue({}),
    };

    vi.mock('joi', () => ({
      object: vi.fn().mockReturnValue(mockJoiSchema),
      string: vi.fn().mockReturnThis(),
      number: vi.fn().mockReturnThis(),
      boolean: vi.fn().mockReturnThis(),
      array: vi.fn().mockReturnThis(),
      date: vi.fn().mockReturnThis(),
      any: vi.fn().mockReturnThis(),
      required: vi.fn().mockReturnThis(),
      optional: vi.fn().mockReturnThis(),
      min: vi.fn().mockReturnThis(),
      max: vi.fn().mockReturnThis(),
      email: vi.fn().mockReturnThis(),
      uuid: vi.fn().mockReturnThis(),
    }));

    // Zod mock
    const mockZodSchema = {
      parse: vi.fn().mockReturnValue({}),
      parseAsync: vi.fn().mockResolvedValue({}),
      safeParse: vi.fn().mockReturnValue({ success: true, data: {} }),
      safeParseAsync: vi.fn().mockResolvedValue({ success: true, data: {} }),
    };

    vi.mock('zod', () => ({
      z: {
        object: vi.fn().mockReturnValue(mockZodSchema),
        string: vi.fn().mockReturnValue(mockZodSchema),
        number: vi.fn().mockReturnValue(mockZodSchema),
        boolean: vi.fn().mockReturnValue(mockZodSchema),
        array: vi.fn().mockReturnValue(mockZodSchema),
        date: vi.fn().mockReturnValue(mockZodSchema),
        any: vi.fn().mockReturnValue(mockZodSchema),
        union: vi.fn().mockReturnValue(mockZodSchema),
        literal: vi.fn().mockReturnValue(mockZodSchema),
        enum: vi.fn().mockReturnValue(mockZodSchema),
        optional: vi.fn().mockReturnValue(mockZodSchema),
        nullable: vi.fn().mockReturnValue(mockZodSchema),
      },
    }));

    this.mocks.set('validation', { joi: mockJoiSchema, zod: mockZodSchema });
  }

  /**
   * Get specific mock by name
   */
  getMock(name: string): any {
    return this.mocks.get(name);
  }

  /**
   * Reset all mocks
   */
  resetAll(): void {
    vi.clearAllMocks();

    // Reset each mock system
    for (const [name, mock] of this.mocks) {
      if (mock && typeof mock.resetMocks === 'function') {
        mock.resetMocks();
      }
    }
  }

  /**
   * Reset specific mock
   */
  resetMock(name: string): void {
    const mock = this.mocks.get(name);
    if (mock && typeof mock.resetMocks === 'function') {
      mock.resetMocks();
    }
  }

  /**
   * Cleanup all mocks (for test teardown)
   */
  cleanup(): void {
    vi.restoreAllMocks();

    // Restore original environment
    const originalEnv = this.mocks.get('env')?.original;
    if (originalEnv) {
      process.env = originalEnv;
    }

    this.mocks.clear();
    this.isInitialized = false;
  }
}

/**
 * Global mock registry instance
 */
export const mockRegistry = MockRegistry.getInstance();

/**
 * Initialize all mocks (call this in setup files)
 */
export function initializeComprehensiveMocks(): void {
  mockRegistry.initializeAll();
}

/**
 * Helper functions for common mock operations
 */
export const mockHelpers = {
  // HTTP mocks
  mockSuccessfulAPIResponse: (data: any = {}) => {
    const httpMocks = mockRegistry.getMock('http');
    httpMocks?.axios.get.mockResolvedValueOnce({ data, status: 200 });
    httpMocks?.axios.post.mockResolvedValueOnce({ data, status: 201 });
    return data;
  },

  mockFailedAPIResponse: (error: any = new Error('API Error')) => {
    const httpMocks = mockRegistry.getMock('http');
    httpMocks?.axios.get.mockRejectedValueOnce(error);
    httpMocks?.axios.post.mockRejectedValueOnce(error);
    return error;
  },

  // Database mocks
  mockDatabaseSuccess: (result: any = {}) => {
    const prismaMocks = mockRegistry.getMock('prisma');
    if (prismaMocks?.mockPrisma) {
      // Configure all CRUD operations to succeed
      Object.values(prismaMocks.mockPrisma).forEach((model: any) => {
        if (model && typeof model === 'object' && 'findFirst' in model) {
          model.findFirst.mockResolvedValue(result);
          model.findUnique.mockResolvedValue(result);
          model.create.mockResolvedValue(result);
          model.update.mockResolvedValue(result);
        }
      });
    }
    return result;
  },

  mockDatabaseFailure: (error: any = new Error('Database Error')) => {
    const prismaMocks = mockRegistry.getMock('prisma');
    if (prismaMocks?.mockPrisma) {
      // Configure all operations to fail
      Object.values(prismaMocks.mockPrisma).forEach((model: any) => {
        if (model && typeof model === 'object' && 'findFirst' in model) {
          Object.values(model).forEach((method: any) => {
            if (typeof method?.mockRejectedValue === 'function') {
              method.mockRejectedValue(error);
            }
          });
        }
      });
    }
    return error;
  },

  // Cache mocks
  mockCacheHit: (key: string, value: any) => {
    const cacheMocks = mockRegistry.getMock('cache');
    cacheMocks?.get.mockImplementation((k: string) => (k === key ? value : undefined));
    return value;
  },

  mockCacheMiss: () => {
    const cacheMocks = mockRegistry.getMock('cache');
    cacheMocks?.get.mockReturnValue(undefined);
  },

  // External service mocks
  mockPlexSuccess: (data: any = {}) => {
    const externalMocks = mockRegistry.getMock('external');
    if (externalMocks?.plex) {
      Object.values(externalMocks.plex).forEach((method: any) => {
        if (typeof method?.mockResolvedValue === 'function') {
          method.mockResolvedValue(data);
        }
      });
    }
    return data;
  },

  mockPlexFailure: (error: any = new Error('Plex Service Unavailable')) => {
    const externalMocks = mockRegistry.getMock('external');
    if (externalMocks?.plex) {
      Object.values(externalMocks.plex).forEach((method: any) => {
        if (typeof method?.mockRejectedValue === 'function') {
          method.mockRejectedValue(error);
        }
      });
    }
    return error;
  },
};

/**
 * Test isolation helpers
 */
export const isolationHelpers = {
  // Isolate test by resetting all mocks
  isolateTest: () => {
    mockRegistry.resetAll();
  },

  // Create isolated environment for a test
  createIsolatedEnvironment: (config: Record<string, any> = {}) => {
    mockRegistry.resetAll();

    // Apply custom configuration
    Object.entries(config).forEach(([key, value]) => {
      const mock = mockRegistry.getMock(key);
      if (mock && typeof mock.configure === 'function') {
        mock.configure(value);
      }
    });

    return {
      cleanup: () => mockRegistry.resetAll(),
    };
  },
};

/**
 * Export for global access in tests
 */
declare global {
  var mockRegistry: MockRegistry;
  var mockHelpers: typeof mockHelpers;
  var isolationHelpers: typeof isolationHelpers;
}

// @ts-ignore
globalThis.mockRegistry = mockRegistry;
// @ts-ignore
globalThis.mockHelpers = mockHelpers;
// @ts-ignore
globalThis.isolationHelpers = isolationHelpers;
