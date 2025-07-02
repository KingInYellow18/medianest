# Task: Testing Framework Setup

**Task ID:** PHASE1-11  
**Priority:** Critical  
**Estimated Time:** 3 hours  
**Dependencies:** PHASE1-03 (Backend Init), PHASE1-04 (Frontend Init)

## Objective
Set up the testing framework for both frontend and backend following the test architecture strategy, enabling test-driven development from the start.

## Acceptance Criteria
- [ ] Vitest configured for both frontend and backend
- [ ] Test helpers and utilities created
- [ ] Database test containers working
- [ ] Mock service workers configured
- [ ] Coverage reporting enabled
- [ ] CI/CD pipeline includes tests

## Detailed Steps

### 1. Backend Testing Setup

#### Install Testing Dependencies
```bash
cd backend
npm install -D vitest @vitest/ui supertest @types/supertest
npm install -D @testcontainers/postgresql @testcontainers/redis
npm install -D nock @vitest/coverage-v8
npm install -D testcontainers
```

#### Create Vitest Configuration
Create `backend/vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: './tests/setup.ts',
    testTimeout: 30000,
    hookTimeout: 30000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      exclude: [
        'node_modules',
        'tests',
        'dist',
        '**/*.d.ts',
        '**/*.config.ts',
        '**/migrations/**'
      ],
      thresholds: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80
      }
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@config': path.resolve(__dirname, './src/config'),
      '@controllers': path.resolve(__dirname, './src/controllers'),
      '@services': path.resolve(__dirname, './src/services'),
      '@middleware': path.resolve(__dirname, './src/middleware'),
      '@utils': path.resolve(__dirname, './src/utils'),
      '@types': path.resolve(__dirname, './src/types')
    }
  }
})
```

#### Create Test Setup File
Create `backend/tests/setup.ts`:

```typescript
import { beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest'
import { config } from '@/config'

// Mock environment for tests
process.env.NODE_ENV = 'test'
process.env.LOG_LEVEL = 'error' // Reduce noise in tests

// Global test setup
beforeAll(async () => {
  // Setup that runs once before all tests
  console.log('🧪 Starting test suite...')
})

afterAll(async () => {
  // Cleanup after all tests
  console.log('✅ Test suite completed')
})

// Reset mocks between tests
beforeEach(() => {
  vi.clearAllMocks()
})

// Mock logger to reduce noise
vi.mock('@/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
  log: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    security: vi.fn(),
    performance: vi.fn(),
    request: vi.fn(),
    errorWithStack: vi.fn(),
  },
  PerformanceTimer: vi.fn(() => ({
    end: vi.fn()
  }))
}))
```

### 2. Frontend Testing Setup

#### Install Testing Dependencies
```bash
cd frontend
npm install -D vitest @vitejs/plugin-react @vitest/ui
npm install -D @testing-library/react @testing-library/user-event @testing-library/jest-dom
npm install -D jsdom msw@2 @vitest/coverage-v8
npm install -D @types/testing-library__jest-dom
```

#### Create Vitest Configuration
Create `frontend/vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './tests/setup.ts',
    css: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      exclude: [
        'node_modules',
        'tests',
        '.next',
        '**/*.d.ts',
        '**/*.config.ts',
        'src/app/layout.tsx',
        'src/app/page.tsx'
      ],
      thresholds: {
        branches: 70,
        functions: 70,
        lines: 70,
        statements: 70
      }
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@/components': path.resolve(__dirname, './src/components'),
      '@/lib': path.resolve(__dirname, './src/lib'),
      '@/hooks': path.resolve(__dirname, './src/hooks'),
      '@/services': path.resolve(__dirname, './src/services'),
      '@/types': path.resolve(__dirname, './src/types')
    }
  }
})
```

#### Create Frontend Test Setup
Create `frontend/tests/setup.ts`:

```typescript
import '@testing-library/jest-dom'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'
import { setupServer } from 'msw/node'
import { handlers } from './mocks/handlers'

// Setup MSW
export const server = setupServer(...handlers)

// Start server before all tests
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))

// Reset handlers after each test
afterEach(() => {
  server.resetHandlers()
  cleanup()
})

// Clean up after all tests
afterAll(() => server.close())

// Mock Next.js router
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}))
```

### 3. Create Test Helpers

#### Database Test Helpers
Create `backend/tests/helpers/database.ts`:

```typescript
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import { RedisContainer, StartedRedisContainer } from '@testcontainers/redis'
import { PrismaClient } from '@prisma/client'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

let postgresContainer: StartedPostgreSqlContainer
let redisContainer: StartedRedisContainer
let prisma: PrismaClient

export async function setupTestDatabase() {
  // Start PostgreSQL container
  postgresContainer = await new PostgreSqlContainer('postgres:15-alpine')
    .withDatabase('medianest_test')
    .withUsername('test_user')
    .withPassword('test_password')
    .start()

  // Start Redis container
  redisContainer = await new RedisContainer('redis:7-alpine')
    .start()

  // Set environment variables
  process.env.DATABASE_URL = postgresContainer.getConnectionUri()
  process.env.REDIS_URL = redisContainer.getConnectionUrl()

  // Initialize Prisma client
  prisma = new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL
      }
    }
  })

  // Run migrations
  await execAsync('npx prisma migrate deploy')

  return { prisma, postgresContainer, redisContainer }
}

export async function cleanupTestDatabase() {
  await prisma?.$disconnect()
  await postgresContainer?.stop()
  await redisContainer?.stop()
}

export async function resetTestDatabase() {
  // Clear all tables
  const tableNames = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  `

  for (const { tablename } of tableNames) {
    if (tablename !== '_prisma_migrations') {
      await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${tablename}" CASCADE`)
    }
  }
}

export { prisma }
```

#### API Test Helpers
Create `backend/tests/helpers/api.ts`:

```typescript
import request from 'supertest'
import { app } from '@/index'
import jwt from 'jsonwebtoken'
import { config } from '@/config'

export function createAuthToken(userId: string, role: 'user' | 'admin' = 'user') {
  return jwt.sign(
    { userId, role },
    config.jwt.secret,
    { expiresIn: '1h' }
  )
}

export function authenticatedRequest(token?: string) {
  const req = request(app)
  if (token) {
    req.set('Authorization', `Bearer ${token}`)
  }
  return req
}

export async function createTestUser(data = {}) {
  const user = await prisma.user.create({
    data: {
      plexId: 'test-plex-id',
      plexUsername: 'testuser',
      email: 'test@example.com',
      role: 'user',
      ...data
    }
  })
  
  const token = createAuthToken(user.id, user.role)
  return { user, token }
}
```

### 4. Create Mock Services

#### MSW Handlers for Frontend
Create `frontend/tests/mocks/handlers.ts`:

```typescript
import { http, HttpResponse } from 'msw'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

export const handlers = [
  // Auth endpoints
  http.post(`${API_URL}/api/auth/plex/pin`, () => {
    return HttpResponse.json({
      success: true,
      data: {
        id: 12345,
        code: 'TEST',
        expiresAt: new Date(Date.now() + 300000).toISOString()
      }
    })
  }),

  http.post(`${API_URL}/api/auth/plex/check`, () => {
    return HttpResponse.json({
      success: true,
      data: {
        authorized: true,
        user: {
          id: 'test-user-id',
          username: 'testuser',
          email: 'test@example.com',
          role: 'user'
        },
        accessToken: 'test-access-token',
        refreshToken: 'test-refresh-token',
        expiresIn: 86400
      }
    })
  }),

  // Health check
  http.get(`${API_URL}/api/health`, () => {
    return HttpResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString()
    })
  })
]
```

#### External Service Mocks
Create `backend/tests/mocks/external-services.ts`:

```typescript
import nock from 'nock'

export function mockPlexAPI() {
  return nock('https://plex.tv')
    .post('/api/v2/pins')
    .reply(200, {
      id: 12345,
      code: 'TEST',
      expiresAt: new Date(Date.now() + 300000).toISOString()
    })
    .get('/api/v2/pins/12345')
    .reply(200, {
      id: 12345,
      authToken: 'test-plex-token'
    })
    .get('/api/v2/user')
    .reply(200, {
      id: 123,
      uuid: 'test-plex-uuid',
      username: 'testuser',
      email: 'test@example.com'
    })
}

export function mockOverseerrAPI() {
  return nock('http://overseerr.local')
    .get('/api/v1/status')
    .reply(200, { version: '1.0.0', status: 'ok' })
}

export function mockUptimeKumaAPI() {
  return nock('http://uptime-kuma.local')
    .get('/api/status-page/heartbeat')
    .reply(200, { status: 'up' })
}
```

### 5. Create Test Fixtures
Create `backend/tests/fixtures/index.ts`:

```typescript
export const fixtures = {
  user: {
    admin: {
      id: 'admin-user-id',
      plexId: 'admin-plex-id',
      plexUsername: 'admin',
      email: 'admin@example.com',
      role: 'admin' as const
    },
    regular: {
      id: 'regular-user-id',
      plexId: 'regular-plex-id',
      plexUsername: 'regularuser',
      email: 'user@example.com',
      role: 'user' as const
    }
  },
  
  mediaRequest: {
    pending: {
      id: 'request-1',
      userId: 'regular-user-id',
      title: 'The Matrix',
      mediaType: 'movie',
      tmdbId: '603',
      status: 'pending' as const
    },
    approved: {
      id: 'request-2',
      userId: 'regular-user-id',
      title: 'Breaking Bad',
      mediaType: 'tv',
      tmdbId: '1396',
      status: 'approved' as const
    }
  },
  
  youtubeDownload: {
    queued: {
      id: 'download-1',
      userId: 'regular-user-id',
      playlistUrl: 'https://youtube.com/playlist?list=TEST',
      playlistTitle: 'Test Playlist',
      status: 'queued' as const
    }
  }
}
```

### 6. Update Package.json Scripts
Update both `backend/package.json` and `frontend/package.json`:

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest watch",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest run --coverage",
    "test:unit": "vitest run tests/unit",
    "test:integration": "vitest run tests/integration",
    "test:ci": "vitest run --reporter=junit --reporter=default"
  }
}
```

### 7. Create GitHub Actions Workflow
Update `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:15-alpine
        env:
          POSTGRES_USER: test_user
          POSTGRES_PASSWORD: test_password
          POSTGRES_DB: medianest_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432
          
      redis:
        image: redis:7-alpine
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 6379:6379

    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
      
      - name: Install backend dependencies
        working-directory: ./backend
        run: npm ci
      
      - name: Install frontend dependencies
        working-directory: ./frontend
        run: npm ci
      
      - name: Run backend tests
        working-directory: ./backend
        run: npm run test:coverage
        env:
          DATABASE_URL: postgresql://test_user:test_password@localhost:5432/medianest_test
          REDIS_URL: redis://localhost:6379
          JWT_SECRET: test-jwt-secret
          ENCRYPTION_KEY: test-encryption-key-32-bytes-long
      
      - name: Run frontend tests
        working-directory: ./frontend
        run: npm run test:coverage
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./backend/coverage/lcov.info,./frontend/coverage/lcov.info
```

## Verification Steps
1. Run `npm test` in both backend and frontend directories
2. Verify test output shows passing tests
3. Run `npm run test:coverage` to check coverage
4. Run `npm run test:ui` to see Vitest UI
5. Verify CI pipeline runs on push

## Common Issues & Solutions
- **Container startup timeout**: Increase timeout in test config
- **Port conflicts**: Use dynamic ports in containers
- **Module resolution**: Check path aliases match tsconfig
- **MSW not intercepting**: Verify handler URLs match exactly

## Notes
- Tests run in parallel by default for speed
- Database is isolated per test suite
- Coverage thresholds enforce quality standards
- Mock external services to avoid flaky tests

## Related Documentation
- [Test Architecture](/test_architecture.md)
- [Vitest Documentation](https://vitest.dev/)
- [Testing Library Documentation](https://testing-library.com/)