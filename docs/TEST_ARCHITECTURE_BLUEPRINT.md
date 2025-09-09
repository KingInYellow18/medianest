# MediaNest Test Architecture Blueprint
## Technical Implementation Guide
### Generated: September 9, 2025

---

## 🏗️ Architecture Overview

The MediaNest testing infrastructure implements a multi-layered, workspace-based architecture designed for scalability, maintainability, and developer productivity. This blueprint provides detailed technical specifications for understanding and extending the test infrastructure.

### System Architecture Diagram
```
┌─────────────────────────────────────────────────────────────────────┐
│                    MediaNest Test Infrastructure                     │
├─────────────────────────────────────────────────────────────────────┤
│  Vitest Workspace Orchestration Layer (v3.2.4)                    │
│  ├── Root Configuration & Global Setup                              │
│  ├── Cross-workspace Test Coordination                             │
│  └── Aggregated Coverage Reporting                                 │
├─────────────────────────────────────────────────────────────────────┤
│  Backend Testing Environment (Node.js)          │  Frontend Testing │
│  ├── Vitest v2.1.9 Configuration               │  Environment       │
│  ├── Fork Pool Isolation                       │  (jsdom)           │
│  ├── PostgreSQL Test DB (Port 5433)            │  ├── Vitest v3.2.4 │
│  ├── Redis Test Instance (Port 6380)           │  ├── React Testing │
│  ├── MSW API Mocking                          │  │   Library        │
│  ├── Playwright E2E Integration               │  ├── Component Unit │
│  └── Security & Performance Testing           │  │   Testing        │
│                                               │  └── Hook Testing   │
├─────────────────────────────────────────────────┤                 │
│  Shared Library Testing                        │                   │
│  ├── Utility Function Testing                 │                   │
│  ├── Common Type Validation                   │                   │
│  └── Cross-platform Compatibility            │                   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 🔧 Technical Configuration Details

### Root Workspace Configuration (`vitest.config.ts`)

```typescript
/// <reference types="vitest" />
import { defineConfig } from 'vite'

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./tests/setup-enhanced.ts'],
    globals: true,
    
    // **PERFORMANCE OPTIMIZED CONFIGURATION**
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
        minThreads: 2,
        maxThreads: Math.max(2, Math.min(8, require('os').cpus().length)),
        isolate: false, // Performance optimization
      }
    },
    
    // Optimized timeouts
    testTimeout: 10000,
    hookTimeout: 3000,
    teardownTimeout: 3000,
    
    // Parallel execution settings
    sequence: {
      shuffle: true,
      concurrent: true,
    },
    
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'json', 'html'],
      reportsDirectory: './coverage',
      
      // Performance optimizations
      clean: true,
      cleanOnRerun: false,
      skipFull: true,
      reportOnFailure: false,
      
      // Strategic include/exclude patterns
      exclude: [
        'node_modules/', 'tests/', 'src/__tests__/',
        '**/*.d.ts', '**/*.config.*', 'dist/', 'coverage/',
        'src/types/**', 'src/schemas/**', 'src/validations/**'
      ],
      
      include: [
        'src/controllers/**/*.ts',
        'src/services/**/*.ts', 
        'src/middleware/**/*.ts',
        'src/utils/**/*.ts',
        'backend/src/**/*.ts',
        'frontend/src/**/*.ts',
        'shared/src/**/*.ts'
      ]
    }
  }
})
```

### Backend Test Configuration (`backend/vitest.config.ts`)

```typescript
import { defineConfig } from 'vitest/config';

const cpuCount = require('os').cpus().length;
const maxWorkers = Math.max(2, Math.min(6, cpuCount));

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    globals: true,
    
    // **OPTIMIZED PARALLEL EXECUTION**
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
        minThreads: 2,
        maxThreads: maxWorkers,
        isolate: false, // Better performance
        useAtomics: true,
      }
    },
    
    // **PERFORMANCE TIMEOUTS**
    testTimeout: 8000,    // Reduced from 30s
    hookTimeout: 2000,    // Reduced setup time
    teardownTimeout: 2000,
    
    // **MOCK OPTIMIZATIONS**
    mockReset: false,     // Reduce overhead
    clearMocks: false,
    restoreMocks: false,
    
    coverage: {
      provider: 'v8',
      thresholds: {
        branches: 70,
        functions: 70,
        lines: 70,
        statements: 70,
      }
    },
    
    // **TEST ENVIRONMENT VARIABLES**
    env: {
      NODE_ENV: 'test',
      JWT_SECRET: 'test-jwt-secret-key-32-bytes-long',
      DATABASE_URL: 'postgresql://test:test@localhost:5433/medianest_test',
      REDIS_URL: 'redis://localhost:6380/0',
      DATABASE_POOL_SIZE: '2',
      DATABASE_TIMEOUT: '3000',
      REDIS_TEST_DB: '15',
      VITEST_POOL_SIZE: maxWorkers.toString(),
      NODE_OPTIONS: '--max-old-space-size=4096'
    }
  }
});
```

### Frontend Test Configuration (`frontend/vitest.config.ts`)

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      thresholds: {
        branches: 60,
        functions: 60,
        lines: 60,
        statements: 60,
      },
      exclude: [
        'node_modules/',
        'tests/',
        '**/*.d.ts',
        'next.config.js',
        '.next/',
      ]
    }
  },
  
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@/components': path.resolve(__dirname, './src/components'),
      '@/lib': path.resolve(__dirname, './src/lib'),
      '@/utils': path.resolve(__dirname, './src/utils'),
    }
  }
});
```

---

## 🗄️ Database Test Infrastructure

### PostgreSQL Test Database Setup

```sql
-- Database: medianest_test
-- Port: 5433 (isolated from development)
-- User: test
-- Password: test

-- Test-specific optimizations
ALTER SYSTEM SET shared_preload_libraries = 'pg_stat_statements';
ALTER SYSTEM SET track_activity_query_size = 2048;
ALTER SYSTEM SET log_min_duration_statement = 1000;

-- Connection pooling for tests
ALTER SYSTEM SET max_connections = 20;
ALTER SYSTEM SET shared_buffers = '256MB';
ALTER SYSTEM SET effective_cache_size = '1GB';
```

#### Database Connection Management
```typescript
// backend/tests/helpers/database.ts
import { PrismaClient } from '@prisma/client';

class TestDatabaseManager {
  private static instance: TestDatabaseManager;
  private prisma: PrismaClient;
  private connectionPool: Map<string, PrismaClient> = new Map();

  private constructor() {
    this.prisma = new PrismaClient({
      datasources: {
        db: { url: process.env.DATABASE_TEST_URL }
      },
      log: process.env.LOG_LEVEL === 'debug' ? ['query', 'error'] : ['error']
    });
  }

  static getInstance(): TestDatabaseManager {
    if (!TestDatabaseManager.instance) {
      TestDatabaseManager.instance = new TestDatabaseManager();
    }
    return TestDatabaseManager.instance;
  }

  async getConnection(testSuite?: string): Promise<PrismaClient> {
    if (testSuite && this.connectionPool.has(testSuite)) {
      return this.connectionPool.get(testSuite)!;
    }

    await this.prisma.$connect();
    
    if (testSuite) {
      this.connectionPool.set(testSuite, this.prisma);
    }
    
    return this.prisma;
  }

  async cleanup(testSuite?: string): Promise<void> {
    const connection = testSuite 
      ? this.connectionPool.get(testSuite) 
      : this.prisma;
      
    if (connection) {
      // Clean test data
      await connection.mediaRequest.deleteMany();
      await connection.session.deleteMany();
      await connection.user.deleteMany();
      
      if (testSuite) {
        await connection.$disconnect();
        this.connectionPool.delete(testSuite);
      }
    }
  }
}
```

### Redis Test Infrastructure

```typescript
// backend/tests/helpers/redis.ts
import Redis from 'ioredis';
import IoRedis from 'ioredis-mock';

class TestRedisManager {
  private static instance: TestRedisManager;
  private redis: Redis;
  private mockRedis: IoRedis;

  private constructor() {
    // Real Redis for integration tests
    this.redis = new Redis({
      host: 'localhost',
      port: 6380,
      db: 15, // Test-specific database
      lazyConnect: true,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 1,
    });

    // Mock Redis for unit tests
    this.mockRedis = new IoRedis({
      data: {},
      lazyConnect: false
    });
  }

  getRedis(mock: boolean = false): Redis | IoRedis {
    return mock ? this.mockRedis : this.redis;
  }

  async cleanup(): Promise<void> {
    await this.redis.flushdb();
    this.mockRedis.flushall();
  }

  async disconnect(): Promise<void> {
    await this.redis.disconnect();
    this.mockRedis.disconnect();
  }
}
```

---

## 🧪 Mock Infrastructure Architecture

### MSW (Mock Service Worker) Configuration

```typescript
// backend/tests/mocks/handlers.ts
import { http, HttpResponse } from 'msw';

// Plex API Mocks
export const plexHandlers = [
  http.get('https://plex.tv/api/v2/user', ({ request }) => {
    const authHeader = request.headers.get('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new HttpResponse(null, { status: 401 });
    }

    return HttpResponse.json({
      id: 12345,
      username: 'testuser',
      email: 'test@plex.tv',
      subscription: { active: true, plan: 'premium' }
    });
  }),

  http.post('https://plex.tv/api/v2/pins', () => {
    return HttpResponse.json({
      id: 67890,
      code: 'ABCD1234',
      expires_at: new Date(Date.now() + 600000).toISOString(),
      auth_token: null
    });
  }),

  http.get('https://plex.tv/api/v2/pins/:id', ({ params }) => {
    return HttpResponse.json({
      id: params.id,
      code: 'ABCD1234',
      expires_at: new Date(Date.now() + 600000).toISOString(),
      auth_token: 'test-plex-auth-token'
    });
  })
];

// TMDB API Mocks
export const tmdbHandlers = [
  http.get('https://api.themoviedb.org/3/search/movie', ({ request }) => {
    const url = new URL(request.url);
    const query = url.searchParams.get('query');
    
    return HttpResponse.json({
      results: [
        {
          id: 12345,
          title: query,
          overview: `Test movie for ${query}`,
          release_date: '2024-01-01',
          poster_path: '/test-poster.jpg',
          backdrop_path: '/test-backdrop.jpg',
          vote_average: 8.5,
          vote_count: 1000
        }
      ],
      total_results: 1,
      total_pages: 1
    });
  })
];

export const handlers = [...plexHandlers, ...tmdbHandlers];
```

### Service Mock Factory Pattern

```typescript
// tests/mocks/service-factory.ts
import { vi } from 'vitest';

export const createMockUserService = () => ({
  findById: vi.fn(),
  findByEmail: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  authenticate: vi.fn(),
  hashPassword: vi.fn(),
  validatePassword: vi.fn(),
}) satisfies Partial<UserService>;

export const createMockMediaService = () => ({
  search: vi.fn(),
  request: vi.fn(),
  approve: vi.fn(),
  deny: vi.fn(),
  getStatus: vi.fn(),
  getHistory: vi.fn(),
}) satisfies Partial<MediaService>;

// Mock factory with realistic data
export const createMockData = {
  user: (overrides = {}) => ({
    id: 'user-123',
    email: 'test@example.com',
    plexId: 'plex-456',
    plexUsername: 'testuser',
    role: 'user' as const,
    status: 'active' as const,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides
  }),
  
  mediaRequest: (overrides = {}) => ({
    id: 'req-123',
    userId: 'user-123',
    mediaId: 'media-456',
    status: 'pending' as const,
    quality: 'HD' as const,
    requestType: 'movie' as const,
    title: 'Test Movie',
    year: 2024,
    notes: 'User requested movie',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides
  })
};
```

---

## 🔍 Test Execution Strategies

### Parallel Execution Optimization

```typescript
// Workspace-level parallel execution strategy
const executionStrategy = {
  // CPU-based thread allocation
  calculateOptimalThreads: () => {
    const cpuCount = require('os').cpus().length;
    const memoryGB = require('os').totalmem() / (1024 * 1024 * 1024);
    
    // Conservative thread allocation based on resources
    if (memoryGB < 8) return Math.max(2, Math.min(4, cpuCount));
    if (memoryGB < 16) return Math.max(2, Math.min(6, cpuCount)); 
    return Math.max(2, Math.min(8, cpuCount));
  },
  
  // Test isolation strategies
  isolationLevel: {
    unit: 'none',        // Fast, shared context
    integration: 'fork', // Isolated processes
    e2e: 'serial',       // Sequential for stability
    security: 'fork',    // Isolated for security testing
  },
  
  // Timeout strategies by test type
  timeouts: {
    unit: 5000,          // 5 seconds
    integration: 30000,  // 30 seconds
    e2e: 120000,         // 2 minutes
    security: 60000,     // 1 minute
  }
};
```

### Test Categorization & Execution

```typescript
// Test execution patterns by category
export const testCategories = {
  unit: {
    pattern: '**/*.test.ts',
    exclude: ['**/integration/**', '**/e2e/**'],
    poolOptions: { isolate: false },
    parallel: true
  },
  
  integration: {
    pattern: '**/integration/**/*.test.ts',
    poolOptions: { isolate: true },
    parallel: true,
    setupFiles: ['./tests/integration-setup.ts']
  },
  
  e2e: {
    pattern: '**/e2e/**/*.spec.ts',
    parallel: false, // Sequential for stability
    setupFiles: ['./tests/e2e-setup.ts'],
    timeout: 120000
  },
  
  security: {
    pattern: '**/security/**/*.test.ts',
    poolOptions: { isolate: true },
    parallel: true,
    setupFiles: ['./tests/security-setup.ts']
  }
};
```

---

## 🛠️ Test Utilities Architecture

### Helper Function Organization

```typescript
// tests/helpers/index.ts - Centralized helper exports
export { TestDatabaseManager } from './database';
export { TestRedisManager } from './redis';
export { APITestClient } from './api-client';
export { AuthTestHelper } from './auth';
export { MockDataFactory } from './mock-data';
export { TestEnvironmentManager } from './environment';

// Helper function architecture
interface TestHelper {
  setup(): Promise<void>;
  teardown(): Promise<void>;
  reset(): Promise<void>;
}

class TestEnvironmentManager implements TestHelper {
  private database: TestDatabaseManager;
  private redis: TestRedisManager;
  private mockServer: MockServer;

  constructor() {
    this.database = TestDatabaseManager.getInstance();
    this.redis = TestRedisManager.getInstance();
    this.mockServer = new MockServer();
  }

  async setup(): Promise<void> {
    await Promise.all([
      this.database.setup(),
      this.redis.setup(),
      this.mockServer.listen()
    ]);
  }

  async teardown(): Promise<void> {
    await Promise.all([
      this.database.cleanup(),
      this.redis.cleanup(), 
      this.mockServer.close()
    ]);
  }

  async reset(): Promise<void> {
    await this.teardown();
    await this.setup();
  }
}
```

### Custom Test Matchers

```typescript
// tests/matchers/custom-matchers.ts
import { expect } from 'vitest';

interface CustomMatchers<R = unknown> {
  toBeValidEmail(): R;
  toBeValidJWT(): R;
  toHavePermission(permission: string): R;
  toBeWithinTimeRange(minutes: number): R;
}

declare module 'vitest' {
  interface Assertion<T = any> extends CustomMatchers<T> {}
  interface AsymmetricMatchersContaining extends CustomMatchers {}
}

expect.extend({
  toBeValidEmail(received: string) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const pass = emailRegex.test(received) && received.length <= 254;
    
    return {
      pass,
      message: () => `expected ${received} to be a valid email address`
    };
  },

  toBeValidJWT(received: string) {
    const jwtRegex = /^[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+$/;
    const pass = jwtRegex.test(received);
    
    return {
      pass,
      message: () => `expected ${received} to be a valid JWT token`
    };
  },

  toHavePermission(received: object, permission: string) {
    const hasPermission = received.permissions?.includes(permission) || 
                         received.permissions?.includes('*');
    
    return {
      pass: hasPermission,
      message: () => `expected user to have permission: ${permission}`
    };
  },

  toBeWithinTimeRange(received: Date, minutes: number) {
    const now = new Date();
    const diffMinutes = Math.abs(now.getTime() - received.getTime()) / (1000 * 60);
    const pass = diffMinutes <= minutes;
    
    return {
      pass,
      message: () => `expected ${received} to be within ${minutes} minutes of now`
    };
  }
});
```

---

## 📊 Coverage & Reporting Architecture

### Multi-Workspace Coverage Aggregation

```typescript
// coverage/aggregation.ts
import { readFileSync, writeFileSync } from 'fs';
import { glob } from 'glob';

interface CoverageData {
  statements: { total: number; covered: number; pct: number };
  branches: { total: number; covered: number; pct: number };
  functions: { total: number; covered: number; pct: number };
  lines: { total: number; covered: number; pct: number };
}

class CoverageAggregator {
  async aggregateWorkspaceCoverage(): Promise<CoverageData> {
    const coverageFiles = await glob('*/coverage/coverage-final.json');
    
    let totalStatements = { total: 0, covered: 0 };
    let totalBranches = { total: 0, covered: 0 };
    let totalFunctions = { total: 0, covered: 0 };
    let totalLines = { total: 0, covered: 0 };

    for (const file of coverageFiles) {
      const coverage = JSON.parse(readFileSync(file, 'utf8'));
      
      for (const [filePath, fileCoverage] of Object.entries(coverage)) {
        totalStatements.total += fileCoverage.s ? Object.keys(fileCoverage.s).length : 0;
        totalStatements.covered += fileCoverage.s ? Object.values(fileCoverage.s).filter(v => v > 0).length : 0;
        
        totalBranches.total += fileCoverage.b ? Object.keys(fileCoverage.b).length : 0;
        totalBranches.covered += fileCoverage.b ? Object.values(fileCoverage.b).flat().filter(v => v > 0).length : 0;
        
        totalFunctions.total += fileCoverage.f ? Object.keys(fileCoverage.f).length : 0;
        totalFunctions.covered += fileCoverage.f ? Object.values(fileCoverage.f).filter(v => v > 0).length : 0;
        
        totalLines.total += fileCoverage.l ? Object.keys(fileCoverage.l).length : 0;
        totalLines.covered += fileCoverage.l ? Object.values(fileCoverage.l).filter(v => v > 0).length : 0;
      }
    }

    return {
      statements: {
        ...totalStatements,
        pct: (totalStatements.covered / totalStatements.total) * 100
      },
      branches: {
        ...totalBranches,
        pct: (totalBranches.covered / totalBranches.total) * 100
      },
      functions: {
        ...totalFunctions,
        pct: (totalFunctions.covered / totalFunctions.total) * 100
      },
      lines: {
        ...totalLines,
        pct: (totalLines.covered / totalLines.total) * 100
      }
    };
  }
}
```

---

## 🚀 Performance Optimization Patterns

### Memory Management

```typescript
// Memory optimization strategies
const memoryOptimizations = {
  // Reduce memory usage during test runs
  nodeOptions: '--max-old-space-size=4096',
  
  // Garbage collection tuning
  gcOptions: '--gc-interval=100',
  
  // V8 optimizations for testing
  v8Options: [
    '--optimize-for-size',
    '--max_old_space_size=4096',
    '--initial_old_space_size=2048'
  ].join(' ')
};

// Test isolation memory management
class TestMemoryManager {
  private memoryUsage: Map<string, number> = new Map();
  
  recordMemoryUsage(testName: string): void {
    const usage = process.memoryUsage();
    this.memoryUsage.set(testName, usage.heapUsed);
  }
  
  checkMemoryLeak(testName: string, threshold: number = 50 * 1024 * 1024): boolean {
    const beforeUsage = this.memoryUsage.get(`${testName}_before`) || 0;
    const afterUsage = this.memoryUsage.get(`${testName}_after`) || 0;
    
    return (afterUsage - beforeUsage) > threshold;
  }
  
  forceGarbageCollection(): void {
    if (global.gc) {
      global.gc();
    }
  }
}
```

---

## 🔒 Security Test Architecture

### Comprehensive Security Testing Framework

```typescript
// Security test categories and patterns
export const securityTestFramework = {
  authentication: {
    tests: [
      'jwt_token_validation',
      'session_management',
      'password_security',
      'multi_factor_auth',
      'token_expiration',
      'refresh_token_rotation'
    ],
    tools: ['supertest', 'jsonwebtoken', 'bcrypt'],
    coverage: 'critical_auth_flows'
  },
  
  authorization: {
    tests: [
      'rbac_enforcement',
      'resource_level_permissions', 
      'privilege_escalation_prevention',
      'api_endpoint_authorization',
      'data_access_controls'
    ],
    tools: ['custom_rbac_tester'],
    coverage: 'all_protected_resources'
  },
  
  input_validation: {
    tests: [
      'sql_injection_prevention',
      'xss_prevention',
      'csrf_protection',
      'file_upload_security',
      'input_sanitization'
    ],
    tools: ['msw', 'custom_payload_generators'],
    coverage: 'all_input_endpoints'
  },
  
  infrastructure: {
    tests: [
      'http_security_headers',
      'cors_configuration',
      'rate_limiting',
      'api_security',
      'encryption_validation'
    ],
    tools: ['supertest', 'custom_security_scanners'],
    coverage: 'security_middleware'
  }
};
```

---

## 🔄 CI/CD Integration Architecture

### Pipeline Test Integration

```yaml
# .github/workflows/test-architecture.yml
name: MediaNest Test Architecture
on: [push, pull_request]

jobs:
  test-matrix:
    strategy:
      matrix:
        workspace: [backend, frontend, shared]
        test-type: [unit, integration, e2e, security]
        node-version: [18, 20]
        exclude:
          - workspace: frontend
            test-type: e2e
          - workspace: shared  
            test-type: e2e
          - workspace: shared
            test-type: security

    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
        
      - name: Setup test infrastructure
        run: |
          docker compose -f docker-compose.test.yml up -d --wait
          npm run test:setup
          
      - name: Run tests
        run: |
          case "${{ matrix.test-type }}" in
            "unit")
              npm run test:${{ matrix.workspace }}:unit
              ;;
            "integration") 
              npm run test:${{ matrix.workspace }}:integration
              ;;
            "e2e")
              npm run test:${{ matrix.workspace }}:e2e
              ;;
            "security")
              npm run test:${{ matrix.workspace }}:security
              ;;
          esac
          
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          file: ./${{ matrix.workspace }}/coverage/coverage-final.json
          flags: ${{ matrix.workspace }}-${{ matrix.test-type }}
```

---

## 📈 Monitoring & Observability

### Test Execution Monitoring

```typescript
// Test execution monitoring and metrics
class TestExecutionMonitor {
  private metrics: Map<string, any> = new Map();
  private startTimes: Map<string, number> = new Map();
  
  startTest(testName: string): void {
    this.startTimes.set(testName, Date.now());
  }
  
  endTest(testName: string, result: 'pass' | 'fail' | 'skip'): void {
    const startTime = this.startTimes.get(testName);
    if (!startTime) return;
    
    const duration = Date.now() - startTime;
    const memoryUsage = process.memoryUsage();
    
    this.metrics.set(testName, {
      duration,
      result,
      memoryUsage: memoryUsage.heapUsed,
      timestamp: new Date().toISOString()
    });
  }
  
  generateReport(): TestExecutionReport {
    const tests = Array.from(this.metrics.entries());
    const totalDuration = tests.reduce((sum, [_, metrics]) => sum + metrics.duration, 0);
    const passRate = tests.filter(([_, metrics]) => metrics.result === 'pass').length / tests.length;
    
    return {
      totalTests: tests.length,
      totalDuration,
      averageDuration: totalDuration / tests.length,
      passRate,
      peakMemoryUsage: Math.max(...tests.map(([_, metrics]) => metrics.memoryUsage)),
      slowestTests: tests
        .sort(([_, a], [__, b]) => b.duration - a.duration)
        .slice(0, 10)
        .map(([name, metrics]) => ({ name, duration: metrics.duration }))
    };
  }
}
```

---

This comprehensive test architecture blueprint provides the technical foundation for understanding, maintaining, and extending the MediaNest testing infrastructure. The modular, performance-optimized design ensures scalability while maintaining developer productivity and code quality.

**Blueprint Version**: 1.0.0  
**Date**: September 9, 2025  
**Architect**: Documentation Specialist  
**Next Review**: December 9, 2025