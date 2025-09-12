import { vi } from 'vitest';
import { StatelessMock, type MockConfig, type ValidationResult } from './unified-mock-registry';

// Controller-specific mock interfaces that align with actual service implementations
export interface ControllerServiceMocks {
  jwtService: {
    generateAccessToken: (payload: any) => string;
    generateRememberToken: (payload: any) => string;
    verifyToken: (token: string) => any;
    decodeToken: (token: string) => any | null;
    refreshToken: (oldToken: string) => string;
    isTokenExpired: (token: string) => boolean;
    getTokenExpirationTime: (token: string) => number | null;
    generateRefreshToken: (payload?: { userId: string; sessionId?: string }) => string;
    shouldRotateToken: (token: string) => boolean;
  };

  encryptionService: {
    encrypt: (text: string) => any;
    decrypt: (data: any) => string;
    encryptForStorage: (text: string) => string;
    decryptFromStorage: (storedData: string) => string;
    isEncrypted: (data: string) => boolean;
  };

  userRepository: {
    findByPlexId: (plexId: string) => Promise<any>;
    create: (userData: any) => Promise<any>;
    update: (id: string, data: any) => Promise<any>;
    findById: (id: string) => Promise<any>;
    findByEmail: (email: string) => Promise<any>;
    delete: (id: string) => Promise<void>;
    isFirstUser: () => Promise<boolean>;
    findAll: () => Promise<any[]>;
    findMany: (options: any) => Promise<any[]>;
    count: (options?: any) => Promise<number>;
  };

  // Service mocks for dashboard controller
  statusService: {
    getServiceStatus: (serviceName: string) => Promise<any>;
    getAllServiceStatuses: () => Promise<any>;
    getDashboardStats: () => Promise<any>;
    checkServiceHealth: (serviceName: string) => Promise<boolean>;
  };

  // Service mocks for media controller
  mediaService: {
    searchMedia: (query: string, options?: any) => Promise<any>;
    requestMedia: (mediaData: any) => Promise<any>;
    getUserRequests: (userId: string) => Promise<any[]>;
    getRequestDetails: (requestId: string) => Promise<any>;
    deleteRequest: (requestId: string) => Promise<void>;
    getAllRequests: () => Promise<any[]>;
    getMediaDetails: (mediaId: string) => Promise<any>;
  };

  // Service mocks for plex controller
  plexService: {
    getServerInfo: (token: string) => Promise<any>;
    getLibraries: (token: string) => Promise<any[]>;
    getLibraryItems: (token: string, libraryId: string) => Promise<any[]>;
    search: (token: string, query: string) => Promise<any[]>;
    getRecentlyAdded: (token: string) => Promise<any[]>;
    getCollections: (token: string) => Promise<any[]>;
    getCollectionDetails: (token: string, collectionId: string) => Promise<any>;
  };

  // Cache service for performance monitoring
  cacheService: {
    get: (key: string) => Promise<any>;
    set: (key: string, value: any, ttl?: number) => Promise<void>;
    del: (key: string) => Promise<void>;
    clear: () => Promise<void>;
    getInfo: () => Promise<any>;
  };

  // Notification service
  notificationService: {
    getUserNotifications: (userId: string) => Promise<any[]>;
    markAsRead: (notificationId: string) => Promise<void>;
    createNotification: (data: any) => Promise<any>;
    deleteNotification: (notificationId: string) => Promise<void>;
  };

  logger: {
    info: (...args: any[]) => void;
    warn: (...args: any[]) => void;
    error: (...args: any[]) => void;
    debug: (...args: any[]) => void;
    trace: (...args: any[]) => void;
    fatal: (...args: any[]) => void;
    child: (bindings: any) => any;
    level: string;
    silent: boolean;
  };

  axios: {
    get: (url: string, config?: any) => Promise<any>;
    post: (url: string, data?: any, config?: any) => Promise<any>;
    put: (url: string, data?: any, config?: any) => Promise<any>;
    delete: (url: string, config?: any) => Promise<any>;
    isAxiosError: (error: any) => boolean;
  };
}

export class ControllerMockRegistry extends StatelessMock<ControllerServiceMocks> {
  private mockInstances: Map<string, any> = new Map();

  createFreshInstance(): ControllerServiceMocks {
    return {
      jwtService: {
        generateAccessToken: vi.fn().mockReturnValue('mock-access-token'),
        generateRememberToken: vi.fn().mockReturnValue('mock-remember-token'),
        verifyToken: vi
          .fn()
          .mockReturnValue({ userId: 'test-user', email: 'test@example.com', role: 'user' }),
        decodeToken: vi
          .fn()
          .mockReturnValue({ userId: 'test-user', email: 'test@example.com', role: 'user' }),
        refreshToken: vi.fn().mockReturnValue('mock-refreshed-token'),
        isTokenExpired: vi.fn().mockReturnValue(false),
        getTokenExpirationTime: vi.fn().mockReturnValue(Date.now() + 86400000), // 24 hours
        generateRefreshToken: vi.fn().mockReturnValue('mock-refresh-token'),
        shouldRotateToken: vi.fn().mockReturnValue(false),
      },

      encryptionService: {
        encrypt: vi.fn().mockReturnValue({
          encrypted: 'mock-encrypted',
          iv: 'mock-iv',
          authTag: 'mock-tag',
          salt: 'mock-salt',
        }),
        decrypt: vi.fn().mockReturnValue('decrypted-text'),
        encryptForStorage: vi.fn().mockReturnValue('mock-encrypted-storage-string'),
        decryptFromStorage: vi.fn().mockReturnValue('decrypted-storage-text'),
        isEncrypted: vi.fn().mockReturnValue(true),
      },

      userRepository: {
        findByPlexId: vi.fn().mockResolvedValue(null), // Default: user not found
        create: vi.fn().mockResolvedValue({ id: 'new-user-id', email: 'test@example.com' }),
        update: vi.fn().mockResolvedValue({ id: 'updated-user-id' }),
        findById: vi.fn().mockResolvedValue({ id: 'test-user', email: 'test@example.com' }),
        findByEmail: vi.fn().mockResolvedValue({ id: 'test-user', email: 'test@example.com' }),
        delete: vi.fn().mockResolvedValue(undefined),
        isFirstUser: vi.fn().mockResolvedValue(false),
        findAll: vi.fn().mockResolvedValue([]),
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(0),
      },

      statusService: {
        getServiceStatus: vi.fn().mockResolvedValue({ status: 'healthy', uptime: 12345 }),
        getAllServiceStatuses: vi.fn().mockResolvedValue({
          plex: { status: 'healthy', uptime: 12345 },
          database: { status: 'healthy', uptime: 12345 },
          redis: { status: 'healthy', uptime: 12345 },
        }),
        getDashboardStats: vi.fn().mockResolvedValue({
          totalUsers: 10,
          totalRequests: 50,
          pendingRequests: 5,
          uptime: 12345,
        }),
        checkServiceHealth: vi.fn().mockResolvedValue(true),
      },

      mediaService: {
        searchMedia: vi.fn().mockResolvedValue([{ id: '1', title: 'Test Movie' }]),
        requestMedia: vi.fn().mockResolvedValue({ id: 'request-1', status: 'pending' }),
        getUserRequests: vi.fn().mockResolvedValue([]),
        getRequestDetails: vi.fn().mockResolvedValue({ id: 'request-1', status: 'pending' }),
        deleteRequest: vi.fn().mockResolvedValue(undefined),
        getAllRequests: vi.fn().mockResolvedValue([]),
        getMediaDetails: vi.fn().mockResolvedValue({ id: 'media-1', title: 'Test Movie' }),
      },

      plexService: {
        getServerInfo: vi.fn().mockResolvedValue({ name: 'Test Server', version: '1.0.0' }),
        getLibraries: vi.fn().mockResolvedValue([{ id: '1', title: 'Movies' }]),
        getLibraryItems: vi.fn().mockResolvedValue([{ id: '1', title: 'Test Movie' }]),
        search: vi.fn().mockResolvedValue([{ id: '1', title: 'Test Movie' }]),
        getRecentlyAdded: vi.fn().mockResolvedValue([{ id: '1', title: 'New Movie' }]),
        getCollections: vi.fn().mockResolvedValue([{ id: '1', title: 'Action Movies' }]),
        getCollectionDetails: vi
          .fn()
          .mockResolvedValue({ id: '1', title: 'Action Movies', items: [] }),
      },

      cacheService: {
        get: vi.fn().mockResolvedValue(null),
        set: vi.fn().mockResolvedValue(undefined),
        del: vi.fn().mockResolvedValue(undefined),
        clear: vi.fn().mockResolvedValue(undefined),
        getInfo: vi.fn().mockResolvedValue({ hitRate: 0.85, keyCount: 100 }),
      },

      notificationService: {
        getUserNotifications: vi.fn().mockResolvedValue([]),
        markAsRead: vi.fn().mockResolvedValue(undefined),
        createNotification: vi.fn().mockResolvedValue({ id: 'notification-1' }),
        deleteNotification: vi.fn().mockResolvedValue(undefined),
      },

      logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
        trace: vi.fn(),
        fatal: vi.fn(),
        child: vi.fn().mockReturnThis(),
        level: 'info',
        silent: false,
      },

      axios: {
        get: vi.fn().mockResolvedValue({ data: {} }),
        post: vi.fn().mockResolvedValue({ data: {} }),
        put: vi.fn().mockResolvedValue({ data: {} }),
        delete: vi.fn().mockResolvedValue({ data: {} }),
        isAxiosError: vi.fn().mockReturnValue(false),
      },
    };
  }

  resetToInitialState(): void {
    // Clear all mock instances and their call history
    this.mockInstances.clear();
  }

  validateInterface(): boolean {
    const instance = this.createFreshInstance();

    // Validate JWT service interface
    const jwtMethods = [
      'generateAccessToken',
      'generateRememberToken',
      'verifyToken',
      'decodeToken',
      'refreshToken',
      'isTokenExpired',
      'getTokenExpirationTime',
      'generateRefreshToken',
      'shouldRotateToken',
    ];
    for (const method of jwtMethods) {
      if (typeof instance.jwtService[method as keyof typeof instance.jwtService] !== 'function') {
        return false;
      }
    }

    // Validate encryption service interface
    const encryptionMethods = [
      'encrypt',
      'decrypt',
      'encryptForStorage',
      'decryptFromStorage',
      'isEncrypted',
    ];
    for (const method of encryptionMethods) {
      if (
        typeof instance.encryptionService[method as keyof typeof instance.encryptionService] !==
        'function'
      ) {
        return false;
      }
    }

    // Validate service interfaces for all controllers
    const serviceInterfaces = {
      statusService: [
        'getServiceStatus',
        'getAllServiceStatuses',
        'getDashboardStats',
        'checkServiceHealth',
      ],
      mediaService: [
        'searchMedia',
        'requestMedia',
        'getUserRequests',
        'getRequestDetails',
        'deleteRequest',
        'getAllRequests',
        'getMediaDetails',
      ],
      plexService: [
        'getServerInfo',
        'getLibraries',
        'getLibraryItems',
        'search',
        'getRecentlyAdded',
        'getCollections',
        'getCollectionDetails',
      ],
      cacheService: ['get', 'set', 'del', 'clear', 'getInfo'],
      notificationService: [
        'getUserNotifications',
        'markAsRead',
        'createNotification',
        'deleteNotification',
      ],
    };

    for (const [serviceName, methods] of Object.entries(serviceInterfaces)) {
      const service = instance[serviceName as keyof typeof instance] as any;
      for (const method of methods) {
        if (typeof service[method] !== 'function') {
          return false;
        }
      }
    }

    return true;
  }

  // Setup method for controller tests
  setupForController(controllerName: string): ControllerServiceMocks {
    const mockInstance = this.createFreshInstance();
    this.mockInstances.set(controllerName, mockInstance);
    return mockInstance;
  }

  // Get configured mocks for a controller
  getMocksForController(controllerName: string): ControllerServiceMocks | null {
    return this.mockInstances.get(controllerName) || null;
  }

  // Clear mocks for a specific controller
  clearControllerMocks(controllerName: string): void {
    const mocks = this.mockInstances.get(controllerName);
    if (mocks) {
      // Reset all mock functions
      Object.values(mocks).forEach((service: any) => {
        Object.values(service).forEach((fn: any) => {
          if (typeof fn?.mockReset === 'function') {
            fn.mockReset();
          }
          if (typeof fn?.mockClear === 'function') {
            fn.mockClear();
          }
        });
      });
      // Remove the instance from the map
      this.mockInstances.delete(controllerName);
    }
  }
}

// Export singleton instance for global use
export const controllerMockRegistry = new ControllerMockRegistry();

// Helper function for setting up controller mocks
export function setupControllerMocks(controllerName: string): ControllerServiceMocks {
  return controllerMockRegistry.setupForController(controllerName);
}

// Helper function for cleaning up controller mocks
export function cleanupControllerMocks(controllerName: string): void {
  controllerMockRegistry.clearControllerMocks(controllerName);
}
