/**
 * COMPREHENSIVE SERVICE MOCK ALIGNMENT - Emergency Repository API Fix
 * 
 * Addresses the critical service mock misalignment causing repository test failures.
 * 
 * CRITICAL FIXES:
 * 1. EncryptionService mock alignment with actual implementation
 * 2. CacheService.getInfo() missing method implementation  
 * 3. Service layer mock interface compatibility
 * 4. Proper method signatures and return types
 */

import { vi } from 'vitest';

// =============================================================================
// ENCRYPTION SERVICE ALIGNED MOCK (Critical Fix)
// =============================================================================

export interface AlignedEncryptionServiceInterface {
  encrypt: (data: string) => string;
  decrypt: (encryptedData: string) => string;
  encryptForStorage: (data: string) => string;
  decryptFromStorage: (encryptedData: string) => string;
  isEncrypted: (data: string) => boolean;
}

export const createAlignedEncryptionServiceMock = (): AlignedEncryptionServiceInterface => ({
  encrypt: vi.fn().mockImplementation((data: string) => {
    // CRITICAL: Must return actual string, not undefined
    return `encrypted_${data}_${Date.now()}`;
  }),
  
  decrypt: vi.fn().mockImplementation((encryptedData: string) => {
    // Extract original data from encrypted format
    if (encryptedData.startsWith('encrypted_')) {
      return encryptedData.replace(/^encrypted_(.+)_\d+$/, '$1');
    }
    return encryptedData;
  }),
  
  encryptForStorage: vi.fn().mockImplementation((data: string) => {
    // CRITICAL: Repository expects string return, not undefined
    if (!data) return null;
    return `storage_encrypted_${data}_${Date.now()}`;
  }),
  
  decryptFromStorage: vi.fn().mockImplementation((encryptedData: string) => {
    // Handle null/undefined gracefully
    if (!encryptedData) return null;
    
    if (encryptedData.startsWith('storage_encrypted_')) {
      return encryptedData.replace(/^storage_encrypted_(.+)_\d+$/, '$1');
    }
    return encryptedData;
  }),
  
  isEncrypted: vi.fn().mockImplementation((data: string) => {
    return data && (data.startsWith('encrypted_') || data.startsWith('storage_encrypted_'));
  }),
});

// =============================================================================
// CACHE SERVICE ALIGNED MOCK (Critical Fix)
// =============================================================================

export interface AlignedCacheServiceInterface {
  get: (key: string) => Promise<any>;
  set: (key: string, value: any, ttl?: number) => Promise<void>;
  del: (key: string) => Promise<void>;
  exists: (key: string) => Promise<boolean>;
  clear: () => Promise<void>;
  keys: (pattern?: string) => Promise<string[]>;
  getInfo: () => Promise<{
    keys: number;
    memory: string;
    connected: boolean;
    uptime: number;
  }>; // CRITICAL: Missing method causing health controller failures
}

export const createAlignedCacheServiceMock = (): AlignedCacheServiceInterface => {
  const cache = new Map<string, { value: any; expires?: number }>();
  
  return {
    get: vi.fn().mockImplementation(async (key: string) => {
      const item = cache.get(key);
      if (!item) return null;
      
      if (item.expires && Date.now() > item.expires) {
        cache.delete(key);
        return null;
      }
      
      return item.value;
    }),
    
    set: vi.fn().mockImplementation(async (key: string, value: any, ttl?: number) => {
      const item: any = { value };
      if (ttl) {
        item.expires = Date.now() + (ttl * 1000);
      }
      cache.set(key, item);
    }),
    
    del: vi.fn().mockImplementation(async (key: string) => {
      cache.delete(key);
    }),
    
    exists: vi.fn().mockImplementation(async (key: string) => {
      const item = cache.get(key);
      if (!item) return false;
      
      if (item.expires && Date.now() > item.expires) {
        cache.delete(key);
        return false;
      }
      
      return true;
    }),
    
    clear: vi.fn().mockImplementation(async () => {
      cache.clear();
    }),
    
    keys: vi.fn().mockImplementation(async (pattern?: string) => {
      const allKeys = Array.from(cache.keys());
      if (!pattern) return allKeys;
      
      // Simple pattern matching (Redis-style)
      const regex = new RegExp(pattern.replace('*', '.*'));
      return allKeys.filter(key => regex.test(key));
    }),
    
    // CRITICAL: This method was completely missing, causing health controller failures
    getInfo: vi.fn().mockImplementation(async () => ({
      keys: cache.size,
      memory: `${cache.size * 1024}B`, // Simulate memory usage
      connected: true,
      uptime: Math.floor(Date.now() / 1000), // Uptime in seconds
    })),
  };
};

// =============================================================================
// JWT SERVICE ALIGNED MOCK
// =============================================================================

export interface AlignedJwtServiceInterface {
  sign: (payload: any, options?: any) => string;
  verify: (token: string) => any;
  decode: (token: string) => any;
  generateTokens: (payload: any) => { accessToken: string; refreshToken: string };
  verifyRefreshToken: (token: string) => any;
}

export const createAlignedJwtServiceMock = (): AlignedJwtServiceInterface => ({
  sign: vi.fn().mockImplementation((payload: any, options?: any) => {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64');
    const payloadStr = Buffer.from(JSON.stringify({
      ...payload,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (options?.expiresIn || 3600),
    })).toString('base64');
    const signature = 'mock-signature';
    
    return `${header}.${payloadStr}.${signature}`;
  }),
  
  verify: vi.fn().mockImplementation((token: string) => {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) throw new Error('Invalid token format');
      
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
      
      // Check expiration
      if (payload.exp && Date.now() / 1000 > payload.exp) {
        throw new Error('Token expired');
      }
      
      return payload;
    } catch (error) {
      throw new Error('Invalid token');
    }
  }),
  
  decode: vi.fn().mockImplementation((token: string) => {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      
      return JSON.parse(Buffer.from(parts[1], 'base64').toString());
    } catch {
      return null;
    }
  }),
  
  generateTokens: vi.fn().mockImplementation((payload: any) => {
    const accessToken = `access_${Buffer.from(JSON.stringify(payload)).toString('base64')}_${Date.now()}`;
    const refreshToken = `refresh_${Buffer.from(JSON.stringify(payload)).toString('base64')}_${Date.now()}`;
    
    return { accessToken, refreshToken };
  }),
  
  verifyRefreshToken: vi.fn().mockImplementation((token: string) => {
    if (!token.startsWith('refresh_')) {
      throw new Error('Invalid refresh token');
    }
    
    try {
      const encoded = token.replace(/^refresh_(.+)_\d+$/, '$1');
      return JSON.parse(Buffer.from(encoded, 'base64').toString());
    } catch {
      throw new Error('Invalid refresh token');
    }
  }),
});

// =============================================================================
// REDIS SERVICE ALIGNED MOCK
// =============================================================================

export interface AlignedRedisServiceInterface {
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string, options?: { EX?: number }) => Promise<void>;
  del: (key: string) => Promise<void>;
  exists: (key: string) => Promise<boolean>;
  flushall: () => Promise<void>;
  ping: () => Promise<string>;
}

export const createAlignedRedisServiceMock = (): AlignedRedisServiceInterface => {
  const store = new Map<string, { value: string; expires?: number }>();
  
  return {
    get: vi.fn().mockImplementation(async (key: string) => {
      const item = store.get(key);
      if (!item) return null;
      
      if (item.expires && Date.now() > item.expires) {
        store.delete(key);
        return null;
      }
      
      return item.value;
    }),
    
    set: vi.fn().mockImplementation(async (key: string, value: string, options?: { EX?: number }) => {
      const item: any = { value };
      if (options?.EX) {
        item.expires = Date.now() + (options.EX * 1000);
      }
      store.set(key, item);
    }),
    
    del: vi.fn().mockImplementation(async (key: string) => {
      store.delete(key);
    }),
    
    exists: vi.fn().mockImplementation(async (key: string) => {
      const item = store.get(key);
      if (!item) return false;
      
      if (item.expires && Date.now() > item.expires) {
        store.delete(key);
        return false;
      }
      
      return true;
    }),
    
    flushall: vi.fn().mockImplementation(async () => {
      store.clear();
    }),
    
    ping: vi.fn().mockImplementation(async () => 'PONG'),
  };
};

// =============================================================================
// LOGGER SERVICE ALIGNED MOCK
// =============================================================================

export interface AlignedLoggerInterface {
  info: (message: string, meta?: any) => void;
  error: (message: string, meta?: any) => void;
  warn: (message: string, meta?: any) => void;
  debug: (message: string, meta?: any) => void;
  verbose: (message: string, meta?: any) => void;
}

export const createAlignedLoggerMock = (): AlignedLoggerInterface => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
  verbose: vi.fn(),
});

// =============================================================================
// COMPREHENSIVE SERVICE MOCK REGISTRY
// =============================================================================

export class ComprehensiveServiceMockRegistry {
  private static instance: ComprehensiveServiceMockRegistry;
  private mocks: Map<string, any> = new Map();

  static getInstance(): ComprehensiveServiceMockRegistry {
    if (!ComprehensiveServiceMockRegistry.instance) {
      ComprehensiveServiceMockRegistry.instance = new ComprehensiveServiceMockRegistry();
    }
    return ComprehensiveServiceMockRegistry.instance;
  }

  getAlignedServiceMocks() {
    if (!this.mocks.has('services')) {
      this.mocks.set('services', {
        encryptionService: {
          instance: createAlignedEncryptionServiceMock(),
          ...createAlignedEncryptionServiceMock(),
        },
        cacheService: createAlignedCacheServiceMock(),
        jwtService: createAlignedJwtServiceMock(),
        redisService: createAlignedRedisServiceMock(),
        logger: createAlignedLoggerMock(),
      });
    }
    return this.mocks.get('services');
  }

  reset(): void {
    this.mocks.clear();
  }
}

// =============================================================================
// EXPORT FACTORY FUNCTIONS
// =============================================================================

export const serviceRegistry = ComprehensiveServiceMockRegistry.getInstance();

/**
 * Get all aligned service mocks
 */
export function getAlignedServiceMocks() {
  return serviceRegistry.getAlignedServiceMocks();
}

/**
 * Reset all service mocks
 */
export function resetServiceMocks() {
  serviceRegistry.reset();
}

/**
 * Create aligned encryption service mock (most critical fix)
 */
export function createAlignedEncryptionMock() {
  const mock = createAlignedEncryptionServiceMock();
  
  return {
    EncryptionService: vi.fn().mockImplementation(() => mock),
    encryptionService: {
      instance: mock,
      ...mock,
    },
  };
}