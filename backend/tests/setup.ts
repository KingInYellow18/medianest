/**
 * BACKEND TEST SETUP - WORKER THREAD STABILITY FOCUSED
 *
 * CRITICAL FIXES:
 * - Prevents worker thread termination errors
 * - Handles unhandled promise rejections
 * - Ensures proper resource cleanup
 * - Manages memory pressure
 */

import { afterAll, afterEach, beforeAll, beforeEach, vi } from 'vitest';
import '../../tests/setup-shared';
import { resourceManager, setupGlobalErrorHandlers } from '../../tests/utils/resource-cleanup';
import { setupForceExitHandler } from '../../tests/utils/force-exit';

// CRITICAL: Setup comprehensive error handling and resource tracking
setupGlobalErrorHandlers();

// CRITICAL: Setup force exit handler to prevent hanging processes
setupForceExitHandler();

// Track active resources to prevent leaks
const activeResources = new Set();
const cleanup = new Set();

function registerCleanup(cleanupFn: () => Promise<void> | void) {
  cleanup.add(cleanupFn);
  resourceManager.registerCleanup(cleanupFn);
}

// CRITICAL: Mock file system operations to track file handles
vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs');
  return {
    ...actual,
    createReadStream: vi.fn((path: string) => {
      const stream = actual.createReadStream(path);
      resourceManager.track(stream, 'streams');
      return stream;
    }),
    createWriteStream: vi.fn((path: string) => {
      const stream = actual.createWriteStream(path);
      resourceManager.track(stream, 'streams');
      return stream;
    }),
    open: vi.fn((...args: any[]) => {
      const result = actual.open.apply(null, args as any);
      if (result && typeof result === 'object' && 'close' in result) {
        resourceManager.track(result, 'fileHandles');
      }
      return result;
    }),
  };
});

vi.mock('fs/promises', async () => {
  const actual = await vi.importActual<typeof import('fs/promises')>('fs/promises');
  return {
    ...actual,
    open: vi.fn(async (...args: any[]) => {
      const result = await actual.open.apply(null, args as any);
      if (result && typeof result === 'object' && 'close' in result) {
        resourceManager.track(result, 'fileHandles');
      }
      return result;
    }),
  };
});

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

// Global test setup hooks - WORKER THREAD STABLE
beforeAll(async () => {
  console.log(
    '🧪 Backend test suite initializing - Worker Thread Safe with Resource Management...',
  );

  // Initialize resource tracking
  resourceManager.reset();
});

beforeEach(async () => {
  // Clear all mocks with error handling
  try {
    vi.clearAllMocks();
    vi.clearAllTimers();
  } catch (error) {
    console.warn('Mock clearing error (non-fatal):', error);
  }

  // Clear any pending promises
  await vi.waitFor(() => Promise.resolve(), { timeout: 100 }).catch(() => {});
});

afterEach(async () => {
  // CRITICAL: Comprehensive cleanup to prevent worker thread issues
  try {
    // Use resource manager for comprehensive cleanup
    await resourceManager.cleanup();

    // Clear active resources
    activeResources.clear();
  } catch (error) {
    console.warn('AfterEach cleanup error (non-fatal):', error);
  }
});

afterAll(async () => {
  console.log(
    '🧪 Backend test suite cleanup - Preventing Worker Thread Issues and Hanging Processes...',
  );

  try {
    // CRITICAL: Final comprehensive cleanup using resource manager
    await resourceManager.cleanup();

    // Clear cleanup registry
    cleanup.clear();
    activeResources.clear();

    console.log('✅ Backend test suite completed - Worker Threads Stable, No Hanging Processes');
  } catch (error) {
    console.warn('AfterAll cleanup error (non-fatal):', error);
  }
});

// Export cleanup utilities for tests to use
export { registerCleanup, activeResources };
