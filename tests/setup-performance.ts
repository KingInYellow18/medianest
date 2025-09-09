import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest';

// Global test state management
let globalTestState = {
  dbPool: null,
  redisClient: null,
  testData: new Map()
};

// Optimized database connection pooling
beforeAll(async () => {
  // Initialize database pool with optimized settings
  globalTestState.dbPool = createOptimizedPool({
    max: 10,
    min: 2,
    acquireTimeoutMillis: 5000,
    createTimeoutMillis: 3000,
    destroyTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
    reapIntervalMillis: 1000,
    createRetryIntervalMillis: 100
  });

  // Initialize Redis with optimized settings
  globalTestState.redisClient = createOptimizedRedis({
    connectTimeout: 1000,
    commandTimeout: 1000,
    retryDelayOnFailover: 100,
    maxRetriesPerRequest: 1,
    lazyConnect: true,
    keyPrefix: 'test:'
  });
});

// Cleanup resources after all tests
afterAll(async () => {
  if (globalTestState.dbPool) {
    await globalTestState.dbPool.destroy();
  }
  
  if (globalTestState.redisClient) {
    await globalTestState.redisClient.disconnect();
  }
});

// Optimized per-test setup
beforeEach(async () => {
  // Fast Redis cleanup (selective strategy)
  if (globalTestState.redisClient) {
    const keys = await globalTestState.redisClient.keys('test:*');
    if (keys.length > 0) {
      await globalTestState.redisClient.del(...keys);
    }
  }
  
  // Reset test data cache
  globalTestState.testData.clear();
});

// Performance monitoring
afterEach(async () => {
  // Collect test performance metrics
  if (process.env.NODE_ENV === 'test') {
    const memUsage = process.memoryUsage();
    if (memUsage.heapUsed > 100 * 1024 * 1024) { // 100MB
      console.warn('⚠️ High memory usage detected:', Math.round(memUsage.heapUsed / 1024 / 1024) + 'MB');
    }
  }
});

// Export optimized utilities
export {
  globalTestState,
  createTestUser: createOptimizedTestUser,
  createTestData: createOptimizedTestData,
  cleanupTestData: parallelCleanup
};

// Optimized test user factory
async function createOptimizedTestUser(overrides = {}) {
  const cacheKey = JSON.stringify(overrides);
  
  if (globalTestState.testData.has(cacheKey)) {
    return globalTestState.testData.get(cacheKey);
  }
  
  const user = {
    id: Math.random().toString(36).substring(2),
    email: `test-${Date.now()}@example.com`,
    name: 'Test User',
    ...overrides
  };
  
  globalTestState.testData.set(cacheKey, user);
  return user;
}

// Batch test data creation
async function createOptimizedTestData(count, factory) {
  const batchSize = 50;
  const results = [];
  
  for (let i = 0; i < count; i += batchSize) {
    const batch = await Promise.all(
      Array.from({ length: Math.min(batchSize, count - i) }, (_, index) => 
        factory(i + index)
      )
    );
    results.push(...batch);
  }
  
  return results;
}

// Parallel cleanup for better performance
async function parallelCleanup(cleanupTasks) {
  await Promise.all(cleanupTasks.map(task => 
    Promise.resolve(task()).catch(err => 
      console.warn('Cleanup task failed:', err.message)
    )
  ));
}

function createOptimizedPool(config) {
  // Mock implementation - replace with actual database pool
  return {
    query: async (sql, params) => ({ rows: [] }),
    destroy: async () => {},
    totalCount: () => 0,
    idleCount: () => 0
  };
}

function createOptimizedRedis(config) {
  // Mock implementation - replace with actual Redis client
  return {
    keys: async (pattern) => [],
    del: async (...keys) => keys.length,
    disconnect: async () => {},
    get: async (key) => null,
    set: async (key, value) => 'OK'
  };
}