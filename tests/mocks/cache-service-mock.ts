/**
 * COMPREHENSIVE CACHE SERVICE MOCK
 * 
 * Provides complete mocking for the CacheService class with all methods
 * including the missing 'clear' method that was causing test failures.
 */

import { vi } from 'vitest';

/**
 * Create a complete CacheService mock
 */
export const createCacheServiceMock = () => {
  const mockCacheService = {
    // Core operations
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
    del: vi.fn().mockResolvedValue(undefined),
    
    // Advanced operations
    getOrSet: vi.fn().mockImplementation(async (key: string, callback: () => Promise<any>, ttl?: number) => {
      // Simulate cache miss and call callback
      return await callback();
    }),
    
    // Pattern operations
    invalidatePattern: vi.fn().mockResolvedValue(undefined),
    
    // Utility operations
    exists: vi.fn().mockResolvedValue(false),
    ttl: vi.fn().mockResolvedValue(-1),
    
    // Information
    getInfo: vi.fn().mockResolvedValue({
      keyCount: 0,
      memoryUsage: '1.2MB'
    }),
    
    // Clear operation (this was missing and causing test failures)
    clear: vi.fn().mockResolvedValue(undefined),
    
    // Additional helper methods for testing
    flushAll: vi.fn().mockResolvedValue(undefined),
    reset: vi.fn().mockImplementation(() => {
      // Reset all mock implementations to defaults
      mockCacheService.get.mockResolvedValue(null);
      mockCacheService.set.mockResolvedValue(undefined);
      mockCacheService.del.mockResolvedValue(undefined);
      mockCacheService.exists.mockResolvedValue(false);
      mockCacheService.ttl.mockResolvedValue(-1);
      mockCacheService.clear.mockResolvedValue(undefined);
    }),
  };

  return mockCacheService;
};

/**
 * Global cache service mock instance
 */
export const mockCacheService = createCacheServiceMock();

/**
 * Setup cache service mocks
 */
export function setupCacheServiceMocks() {
  // Mock the cache service module
  vi.mock('@/services/cache.service', () => ({
    cacheService: mockCacheService,
    CacheService: vi.fn(() => mockCacheService),
  }));

  return {
    mockCacheService,
    resetMocks: () => {
      mockCacheService.reset();
      vi.clearAllMocks();
    },
  };
}

/**
 * Cache service test helpers
 */
export const cacheServiceHelpers = {
  // Mock cache hit
  mockCacheHit: (key: string, value: any) => {
    mockCacheService.get.mockImplementation((k: string) => 
      k === key ? Promise.resolve(value) : Promise.resolve(null)
    );
  },

  // Mock cache miss
  mockCacheMiss: () => {
    mockCacheService.get.mockResolvedValue(null);
  },

  // Mock cache error
  mockCacheError: (error: Error = new Error('Cache error')) => {
    mockCacheService.get.mockRejectedValue(error);
    mockCacheService.set.mockRejectedValue(error);
  },

  // Mock successful operations
  mockCacheSuccess: () => {
    mockCacheService.get.mockResolvedValue(null);
    mockCacheService.set.mockResolvedValue(undefined);
    mockCacheService.del.mockResolvedValue(undefined);
    mockCacheService.clear.mockResolvedValue(undefined);
    mockCacheService.exists.mockResolvedValue(false);
  },

  // Mock cache with data
  mockCacheWithData: (data: Record<string, any>) => {
    mockCacheService.get.mockImplementation((key: string) => {
      return Promise.resolve(data[key] || null);
    });
    
    mockCacheService.exists.mockImplementation((key: string) => {
      return Promise.resolve(key in data);
    });
  },
};

/**
 * Reset cache service mocks
 */
export function resetCacheServiceMocks() {
  mockCacheService.reset();
  vi.clearAllMocks();
}