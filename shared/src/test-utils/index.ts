/**
 * Shared Test Utilities
 * Cross-package testing utilities for MediaNest
 * Test Data Organizer Agent - MediaNest Hive Mind
 */

import { vi } from 'vitest';

// Common test data generators
export const generators = {
  // Generate random string
  randomString: (length = 10, charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789') => {
    return Array.from({ length }, () => charset.charAt(Math.floor(Math.random() * charset.length))).join('');
  },

  // Generate random email
  randomEmail: (domain = 'test.com') => {
    return `${generators.randomString(8)}@${domain}`;
  },

  // Generate random UUID-like string
  randomId: () => {
    return `${generators.randomString(8)}-${generators.randomString(4)}-${generators.randomString(4)}-${generators.randomString(12)}`;
  },

  // Generate random date within range
  randomDate: (start = new Date(2020, 0, 1), end = new Date()) => {
    return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
  },

  // Generate random number within range
  randomNumber: (min = 0, max = 100) => {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  },

  // Generate random boolean
  randomBoolean: () => Math.random() < 0.5,

  // Generate random array of items
  randomArray: <T>(generator: () => T, length = 5) => {
    return Array.from({ length }, generator);
  }
};

// Validation utilities
export const validators = {
  // Validate email format
  isValidEmail: (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  },

  // Validate URL format
  isValidUrl: (url: string) => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  },

  // Validate UUID format
  isValidUuid: (uuid: string) => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  },

  // Validate object has required properties
  hasRequiredProperties: (obj: any, requiredProps: string[]) => {
    return requiredProps.every(prop => obj.hasOwnProperty(prop) && obj[prop] !== undefined);
  },

  // Validate array contains specific items
  arrayContains: <T>(array: T[], items: T[]) => {
    return items.every(item => array.includes(item));
  },

  // Validate object structure matches schema
  matchesSchema: (obj: any, schema: Record<string, string>) => {
    return Object.entries(schema).every(([key, type]) => {
      return obj.hasOwnProperty(key) && typeof obj[key] === type;
    });
  }
};

// Time and date utilities
export const timeUtils = {
  // Add time to date
  addTime: (date: Date, amount: number, unit: 'seconds' | 'minutes' | 'hours' | 'days' = 'days') => {
    const newDate = new Date(date);
    const multipliers = {
      seconds: 1000,
      minutes: 60 * 1000,
      hours: 60 * 60 * 1000,
      days: 24 * 60 * 60 * 1000
    };
    
    newDate.setTime(newDate.getTime() + (amount * multipliers[unit]));
    return newDate;
  },

  // Subtract time from date
  subtractTime: (date: Date, amount: number, unit: 'seconds' | 'minutes' | 'hours' | 'days' = 'days') => {
    return timeUtils.addTime(date, -amount, unit);
  },

  // Check if date is within range
  isWithinRange: (date: Date, start: Date, end: Date) => {
    return date >= start && date <= end;
  },

  // Format date for testing
  formatForTesting: (date: Date) => {
    return date.toISOString();
  },

  // Create fixed date for consistent testing
  createFixedDate: (year = 2024, month = 0, day = 1, hour = 0, minute = 0, second = 0) => {
    return new Date(year, month, day, hour, minute, second);
  }
};

// Async testing utilities
export const asyncUtils = {
  // Wait for a specific amount of time
  wait: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),

  // Wait for condition to be true
  waitFor: async (condition: () => boolean, timeout = 5000, interval = 100) => {
    const start = Date.now();
    
    while (Date.now() - start < timeout) {
      if (condition()) {
        return true;
      }
      await asyncUtils.wait(interval);
    }
    
    throw new Error(`Condition not met within ${timeout}ms`);
  },

  // Retry operation until it succeeds
  retry: async <T>(operation: () => Promise<T>, maxAttempts = 3, delay = 1000): Promise<T> => {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        if (attempt === maxAttempts) {
          throw error;
        }
        await asyncUtils.wait(delay);
      }
    }
    throw new Error('Retry failed');
  },

  // Create a promise that resolves after delay
  delayed: <T>(value: T, delay = 1000) => {
    return new Promise<T>(resolve => setTimeout(() => resolve(value), delay));
  },

  // Create a promise that rejects after delay
  delayedReject: (error: Error, delay = 1000) => {
    return new Promise((_, reject) => setTimeout(() => reject(error), delay));
  }
};

// Mock utilities
export const mockUtils = {
  // Create mock function with predefined behavior
  createMockFn: <T extends (...args: any[]) => any>(implementation?: T) => {
    return vi.fn(implementation);
  },

  // Create mock object with methods
  createMockObject: <T extends Record<string, any>>(methods: Partial<T>): T => {
    const mock = {} as T;
    
    Object.keys(methods).forEach(key => {
      mock[key] = vi.fn(methods[key]);
    });
    
    return mock;
  },

  // Create mock API response
  createMockResponse: <T>(data: T, status = 200, delay = 0) => {
    const response = {
      ok: status >= 200 && status < 300,
      status,
      statusText: status === 200 ? 'OK' : 'Error',
      json: vi.fn().mockResolvedValue(data),
      text: vi.fn().mockResolvedValue(JSON.stringify(data)),
      blob: vi.fn().mockResolvedValue(new Blob([JSON.stringify(data)])),
      clone: vi.fn().mockReturnValue(response)
    };

    if (delay > 0) {
      return asyncUtils.delayed(response, delay);
    }

    return Promise.resolve(response);
  },

  // Mock console methods
  mockConsole: () => {
    const originalConsole = global.console;
    const mockConsole = {
      log: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
      debug: vi.fn()
    };

    global.console = { ...originalConsole, ...mockConsole };

    return {
      restore: () => {
        global.console = originalConsole;
      },
      mocks: mockConsole
    };
  },

  // Mock environment variables
  mockEnv: (envVars: Record<string, string>) => {
    const originalEnv = process.env;
    process.env = { ...originalEnv, ...envVars };

    return {
      restore: () => {
        process.env = originalEnv;
      }
    };
  }
};

// Test data builders
export const builders = {
  // Build user test data
  buildUser: (overrides: any = {}) => ({
    id: generators.randomId(),
    email: generators.randomEmail(),
    username: generators.randomString(10),
    displayName: generators.randomString(15),
    role: 'user' as const,
    isVerified: generators.randomBoolean(),
    createdAt: timeUtils.formatForTesting(generators.randomDate()),
    updatedAt: timeUtils.formatForTesting(new Date()),
    ...overrides
  }),

  // Build media test data
  buildMedia: (overrides: any = {}) => ({
    id: generators.randomId(),
    title: generators.randomString(20),
    type: 'movie' as const,
    url: `https://example.com/${generators.randomString(10)}`,
    status: 'completed' as const,
    progress: 100,
    size: generators.randomNumber(1000000, 1000000000),
    createdAt: timeUtils.formatForTesting(generators.randomDate()),
    updatedAt: timeUtils.formatForTesting(new Date()),
    ...overrides
  }),

  // Build playlist test data
  buildPlaylist: (overrides: any = {}) => ({
    id: generators.randomId(),
    name: generators.randomString(15),
    description: generators.randomString(50),
    type: 'playlist' as const,
    visibility: 'public' as const,
    itemCount: generators.randomNumber(1, 50),
    createdAt: timeUtils.formatForTesting(generators.randomDate()),
    updatedAt: timeUtils.formatForTesting(new Date()),
    ...overrides
  }),

  // Build API response test data
  buildApiResponse: <T>(data: T, overrides: any = {}) => ({
    success: true,
    data,
    timestamp: timeUtils.formatForTesting(new Date()),
    ...overrides
  }),

  // Build error response test data
  buildErrorResponse: (message = 'Test error', code = 'TEST_ERROR', status = 500) => ({
    success: false,
    error: {
      code,
      message,
      status,
      timestamp: timeUtils.formatForTesting(new Date())
    }
  })
};

// Test environment utilities
export const envUtils = {
  // Check if running in test environment
  isTestEnv: () => process.env.NODE_ENV === 'test' || process.env.VITEST === 'true',

  // Get test configuration
  getTestConfig: () => ({
    timeout: parseInt(process.env.TEST_TIMEOUT || '5000'),
    retries: parseInt(process.env.TEST_RETRIES || '0'),
    parallel: process.env.TEST_PARALLEL === 'true',
    coverage: process.env.TEST_COVERAGE === 'true'
  }),

  // Setup test globals
  setupTestGlobals: () => {
    // Mock common browser APIs
    if (typeof window === 'undefined') {
      global.window = {} as any;
    }
    
    if (typeof document === 'undefined') {
      global.document = {} as any;
    }

    // Mock performance API
    if (typeof performance === 'undefined') {
      global.performance = {
        now: vi.fn(() => Date.now()),
        mark: vi.fn(),
        measure: vi.fn(),
        getEntriesByName: vi.fn(() => []),
        getEntriesByType: vi.fn(() => [])
      } as any;
    }
  }
};

// Performance testing utilities
export const performanceUtils = {
  // Measure execution time
  measureTime: async <T>(operation: () => Promise<T> | T): Promise<{ result: T; duration: number }> => {
    const start = performance.now();
    const result = await operation();
    const end = performance.now();
    
    return {
      result,
      duration: end - start
    };
  },

  // Benchmark function execution
  benchmark: async <T>(
    operation: () => Promise<T> | T,
    iterations = 100
  ): Promise<{ average: number; min: number; max: number; results: T[] }> => {
    const times: number[] = [];
    const results: T[] = [];

    for (let i = 0; i < iterations; i++) {
      const { result, duration } = await performanceUtils.measureTime(operation);
      times.push(duration);
      results.push(result);
    }

    return {
      average: times.reduce((sum, time) => sum + time, 0) / times.length,
      min: Math.min(...times),
      max: Math.max(...times),
      results
    };
  },

  // Check memory usage
  getMemoryUsage: () => {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      return process.memoryUsage();
    }
    
    if (typeof performance !== 'undefined' && (performance as any).memory) {
      return (performance as any).memory;
    }
    
    return null;
  }
};

// Error testing utilities
export const errorUtils = {
  // Create standard error
  createError: (message: string, code?: string) => {
    const error = new Error(message);
    if (code) {
      (error as any).code = code;
    }
    return error;
  },

  // Create validation error
  createValidationError: (field: string, message: string) => {
    const error = new Error(`Validation failed for ${field}: ${message}`);
    (error as any).code = 'VALIDATION_ERROR';
    (error as any).field = field;
    return error;
  },

  // Create network error
  createNetworkError: (message = 'Network request failed') => {
    const error = new Error(message);
    (error as any).code = 'NETWORK_ERROR';
    return error;
  },

  // Test error handling
  testErrorHandling: async (operation: () => Promise<any>, expectedError?: string | RegExp) => {
    try {
      await operation();
      throw new Error('Expected operation to throw an error');
    } catch (error) {
      if (expectedError) {
        if (typeof expectedError === 'string') {
          expect((error as Error).message).toBe(expectedError);
        } else {
          expect((error as Error).message).toMatch(expectedError);
        }
      }
      return error;
    }
  }
};

// Export everything
export {
  generators,
  validators,
  timeUtils,
  asyncUtils,
  mockUtils,
  builders,
  envUtils,
  performanceUtils,
  errorUtils
};

// Default export for convenience
export default {
  generators,
  validators,
  timeUtils,
  asyncUtils,
  mockUtils,
  builders,
  envUtils,
  performanceUtils,
  errorUtils
};