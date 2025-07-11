# MediaNest Test Suite Audit & Task List

**Generated:** January 2025  
**Purpose:** Comprehensive audit of test suite with actionable improvements  
**Scope:** Backend and Frontend test infrastructure  

## Executive Summary

The MediaNest test suite is well-architected with modern tooling (Vitest, MSW) but has several critical issues preventing tests from running successfully. The main problems are:

1. **Backend:** Plex OAuth tests timing out due to MSW configuration issues
2. **Frontend:** Environment variable and socket.io mock issues
3. **Both:** Missing test database setup and configuration

## Current State Analysis

### ✅ What's Working Well

1. **Modern Test Stack**
   - Vitest for fast, ESM-native testing
   - MSW for API mocking  
   - Good separation of unit/integration tests
   - Proper test helpers and fixtures

2. **Architecture Alignment**
   - Follows test_architecture.md guidelines
   - Pragmatic coverage goals (60-70%)
   - Focus on critical paths
   - Repository pattern testing structure

3. **Configuration**
   - Proper path aliases
   - Consistent test scripts
   - Coverage thresholds configured
   - Test timeouts appropriate for scale

### ❌ Critical Issues

1. **Backend Test Failures (15 failures)**
   - All Plex OAuth tests timing out after 30s
   - MSW intercepting local API calls instead of external only
   - Missing test database on port 5433

2. **Frontend Test Failures (3 failures)**
   - Missing `NEXT_PUBLIC_BACKEND_URL` environment variable
   - Socket.io mock implementation incomplete
   - Relative URLs in test environment

3. **Configuration Issues**
   - MSW handlers not properly scoped
   - Test environment variables not set
   - Database test containers not configured

## Task List

### Task 1: Fix Backend MSW Configuration
**Priority:** Critical  
**Impact:** Unblocks all Plex OAuth tests  
**Why:** MSW is intercepting local Express routes instead of only external API calls

**Changes Required:**
1. Update MSW handlers to only intercept external URLs (plex.tv, overseerr, uptime-kuma)
2. Remove mock auth router that conflicts with real Express routes
3. Configure MSW to bypass local API calls

**Implementation:**
```typescript
// backend/tests/mocks/handlers.ts
import { http, HttpResponse } from 'msw'

export const handlers = [
  // Only intercept EXTERNAL Plex API calls
  http.post('https://plex.tv/api/v2/pins', () => {
    return HttpResponse.json({
      id: 12345,
      code: 'TEST-CODE',
      authToken: null
    })
  }),
  
  http.get('https://plex.tv/api/v2/pins/:pinId', ({ params }) => {
    return HttpResponse.json({
      id: params.pinId,
      code: 'TEST-CODE',
      authToken: 'test-plex-token'
    })
  }),
  
  // Remove any handlers for local routes like /api/auth/*
  // Let Express handle these naturally
]

// backend/tests/setup.ts
import { server } from './mocks/server'

beforeAll(() => server.listen({ 
  onUnhandledRequest: 'bypass' // Let unhandled requests pass through
}))
```

### Task 2: Fix Frontend Environment & Socket Mocks
**Priority:** Critical  
**Impact:** Fixes all frontend test failures  
**Why:** Tests need proper environment setup and complete mocks

**Changes Required:**
1. Set `NEXT_PUBLIC_BACKEND_URL` in test setup
2. Fix socket.io mock implementation
3. Handle relative URLs in test environment

**Implementation:**
```typescript
// frontend/tests/setup.ts
import { vi } from 'vitest'
import '@testing-library/jest-dom/vitest'

// Set required environment variables
process.env.NEXT_PUBLIC_BACKEND_URL = 'http://localhost:4000'

// Mock socket.io-client with proper implementation
vi.mock('socket.io-client', () => {
  const mockSocket = {
    on: vi.fn((event, callback) => {
      if (event === 'connect') {
        callback()
      }
      return mockSocket
    }),
    off: vi.fn(() => mockSocket),
    emit: vi.fn(() => mockSocket),
    close: vi.fn(),
    connected: true,
    disconnect: vi.fn(),
    connect: vi.fn(),
    io: {
      on: vi.fn(),
      opts: {}
    }
  }
  
  return {
    io: vi.fn(() => mockSocket),
    default: vi.fn(() => mockSocket)
  }
})

// Mock fetch for relative URLs
global.fetch = vi.fn((url, options) => {
  const fullUrl = url.startsWith('http') 
    ? url 
    : `${process.env.NEXT_PUBLIC_BACKEND_URL}${url}`
    
  // Return mock response based on URL
  if (fullUrl.includes('/api/services/status')) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve([
        { name: 'Plex', status: 'operational', uptime: 99.9 }
      ])
    })
  }
  
  return Promise.reject(new Error('Not mocked'))
})
```

### Task 3: Setup Test Database Configuration
**Priority:** High  
**Impact:** Enables integration tests to run  
**Why:** Tests expect PostgreSQL on port 5433 but it's not configured

**Changes Required:**
1. Add test database setup script
2. Update test configuration to use test database
3. Add database cleanup utilities

**Implementation:**
```bash
#!/bin/bash
# backend/scripts/setup-test-db.sh

# Check if PostgreSQL is running on port 5433
if ! nc -z localhost 5433; then
  echo "Starting test PostgreSQL..."
  docker run -d \
    --name medianest-test-db \
    -e POSTGRES_USER=test \
    -e POSTGRES_PASSWORD=test \
    -e POSTGRES_DB=medianest_test \
    -p 5433:5432 \
    postgres:15-alpine
    
  # Wait for database to be ready
  echo "Waiting for database..."
  sleep 5
fi

# Run migrations on test database
DATABASE_URL="postgresql://test:test@localhost:5433/medianest_test" \
  npx prisma migrate deploy
```

```typescript
// backend/tests/helpers/database.ts
import { PrismaClient } from '@prisma/client'

export const getTestDatabase = () => {
  return new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL || 'postgresql://test:test@localhost:5433/medianest_test'
      }
    }
  })
}

export const cleanupDatabase = async (prisma: PrismaClient) => {
  // Clean in correct order to respect foreign keys
  await prisma.youtubeDownload.deleteMany()
  await prisma.mediaRequest.deleteMany()
  await prisma.userSession.deleteMany()
  await prisma.user.deleteMany()
}
```

### Task 4: Implement Missing Critical Path Tests
**Priority:** High  
**Impact:** Ensures core functionality is tested  
**Why:** Some critical paths lack test coverage per architecture requirements

**Missing Tests to Add:**
1. Media request submission flow
2. Service status monitoring with fallbacks
3. YouTube download functionality
4. WebSocket real-time updates
5. User data isolation

**Implementation Examples:**

```typescript
// backend/tests/integration/api/media-requests.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import { app } from '@/app'
import { getTestDatabase, cleanupDatabase } from '../../helpers/database'
import { createTestUser, createAuthToken } from '../../helpers/auth'

describe('Media Request API', () => {
  const prisma = getTestDatabase()
  let authToken: string
  let userId: string
  
  beforeEach(async () => {
    await cleanupDatabase(prisma)
    const user = await createTestUser(prisma)
    userId = user.id
    authToken = createAuthToken(user.id)
  })
  
  describe('POST /api/v1/media/request', () => {
    it('creates media request for authenticated user', async () => {
      const response = await request(app)
        .post('/api/v1/media/request')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'The Matrix',
          mediaType: 'movie',
          tmdbId: '603'
        })
        
      expect(response.status).toBe(201)
      expect(response.body.success).toBe(true)
      expect(response.body.data).toMatchObject({
        title: 'The Matrix',
        mediaType: 'movie',
        tmdbId: '603',
        userId,
        status: 'pending'
      })
      
      // Verify in database
      const dbRequest = await prisma.mediaRequest.findFirst({
        where: { userId, tmdbId: '603' }
      })
      expect(dbRequest).toBeTruthy()
    })
    
    it('prevents duplicate requests from same user', async () => {
      // Create first request
      await prisma.mediaRequest.create({
        data: {
          userId,
          title: 'The Matrix',
          mediaType: 'movie',
          tmdbId: '603',
          status: 'pending'
        }
      })
      
      // Try to create duplicate
      const response = await request(app)
        .post('/api/v1/media/request')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'The Matrix',
          mediaType: 'movie',
          tmdbId: '603'
        })
        
      expect(response.status).toBe(409)
      expect(response.body.error.code).toBe('DUPLICATE_REQUEST')
    })
  })
})

// backend/tests/integration/services/uptime-kuma.test.ts
describe('Service Monitoring with Fallbacks', () => {
  it('returns cached data when Uptime Kuma is down', async () => {
    // Mock Uptime Kuma being down
    server.use(
      http.get('http://localhost:3001/api/status-page/*', () => {
        return HttpResponse.error()
      })
    )
    
    // Seed cache with previous data
    await cache.setServiceStatus('all-services', [
      { name: 'Plex', status: 'up', lastCheck: Date.now() - 60000 }
    ])
    
    const response = await request(app)
      .get('/api/v1/dashboard/status')
      .set('Authorization', `Bearer ${authToken}`)
      
    expect(response.status).toBe(200)
    expect(response.body.data.fromCache).toBe(true)
    expect(response.body.data.services).toHaveLength(1)
  })
})
```

### Task 5: Optimize Test Performance
**Priority:** Medium  
**Impact:** Faster feedback loop  
**Why:** Some tests are slow or have unnecessary overhead

**Changes Required:**
1. Use test database transactions for isolation
2. Reduce test timeout where appropriate
3. Parallelize independent test suites
4. Mock heavy operations (YouTube metadata fetch)

**Implementation:**
```typescript
// backend/vitest.config.ts
export default defineConfig({
  test: {
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: false, // Allow parallel execution
        maxForks: 4
      }
    },
    testTimeout: 15000, // Reduce from 30s
    hookTimeout: 10000
  }
})

// Use transactions for test isolation
describe('User Repository', () => {
  it('creates user', async () => {
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { /* ... */ }
      })
      expect(user).toBeTruthy()
      throw new Error('Rollback') // Rollback transaction
    }).catch(() => {}) // Ignore rollback error
  })
})
```

### Task 6: Add E2E Tests for Critical Flows
**Priority:** Medium  
**Impact:** End-to-end confidence  
**Why:** Architecture specifies 2-3 key E2E tests

**Tests to Add:**
1. Complete Plex OAuth flow
2. Media request from search to submission
3. Real-time service status updates

**Implementation:**
```typescript
// e2e/auth.spec.ts
import { test, expect } from '@playwright/test'

test.describe('Plex Authentication Flow', () => {
  test('user can login with Plex', async ({ page }) => {
    await page.goto('/')
    await page.click('text=Login with Plex')
    
    // Mock Plex PIN generation
    await page.route('**/api/auth/plex/pin', route => {
      route.fulfill({
        status: 200,
        body: JSON.stringify({ 
          pin: 'ABCD',
          id: '12345',
          authUrl: 'https://app.plex.tv/auth#?code=ABCD'
        })
      })
    })
    
    // User sees PIN
    await expect(page.locator('text=ABCD')).toBeVisible()
    
    // Simulate PIN verification
    await page.route('**/api/auth/plex/verify', route => {
      route.fulfill({
        status: 200,
        body: JSON.stringify({
          success: true,
          user: { username: 'testuser' },
          token: 'jwt-token'
        })
      })
    })
    
    // Auto-redirect after auth
    await page.waitForURL('/dashboard')
    await expect(page.locator('text=Welcome, testuser')).toBeVisible()
  })
})
```

### Task 7: Improve Test Documentation
**Priority:** Low  
**Impact:** Better maintainability  
**Why:** Complex tests need explanations

**Changes Required:**
1. Add test scenario descriptions
2. Document mock behavior
3. Explain test data relationships

**Implementation:**
```typescript
describe('Rate Limiting', () => {
  /**
   * Rate limiting uses Redis Lua scripts for atomic operations.
   * The sliding window algorithm tracks requests per user per endpoint.
   * 
   * Test scenarios:
   * 1. Allow requests within limit
   * 2. Block when limit exceeded
   * 3. Reset after window expires
   * 4. Different limits for different endpoints
   */
  
  it('enforces 100 req/min for API endpoints', async () => {
    // Test implementation...
  })
  
  it('enforces 5 req/hr for YouTube downloads', async () => {
    // Uses separate rate limit key: youtube:user123
    // Test implementation...
  })
})
```

### Task 8: Setup CI Test Pipeline
**Priority:** Medium  
**Impact:** Automated quality assurance  
**Why:** Catch issues before merge

**Implementation:**
```yaml
# .github/workflows/test.yml
name: Test Suite

on:
  pull_request:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:15-alpine
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: medianest_test
        ports:
          - 5433:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          
      redis:
        image: redis:7-alpine
        ports:
          - 6380:6379
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Generate Prisma client
        run: npm run db:generate
        
      - name: Run database migrations
        env:
          DATABASE_URL: postgresql://test:test@localhost:5433/medianest_test
        run: npm run db:migrate
        
      - name: Run tests
        env:
          NODE_ENV: test
          DATABASE_URL: postgresql://test:test@localhost:5433/medianest_test
          REDIS_URL: redis://localhost:6380
          JWT_SECRET: test-secret
          ENCRYPTION_KEY: test-encryption-key-32-chars-long
        run: npm test
        
      - name: Upload coverage
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: coverage-report
          path: |
            backend/coverage/
            frontend/coverage/
```

## Implementation Priority

1. **Week 1: Critical Fixes (Tasks 1-3)**
   - Fix MSW configuration
   - Fix frontend mocks
   - Setup test database
   - Goal: All existing tests passing

2. **Week 2: Coverage (Task 4)**
   - Add missing critical path tests
   - Focus on Plex auth, media requests, service monitoring
   - Goal: 70%+ coverage on critical paths

3. **Week 3: Quality (Tasks 5-8)**
   - Performance optimizations
   - E2E tests
   - Documentation
   - CI pipeline
   - Goal: Fast, reliable test suite

## Success Metrics

- ✅ All tests passing (0 failures)
- ✅ Test execution under 5 minutes
- ✅ 60-70% overall coverage
- ✅ 80% coverage on critical paths
- ✅ No flaky tests
- ✅ CI pipeline running on all PRs

## Code Style Guidelines for Tests

1. **Use descriptive test names**
   ```typescript
   // ❌ Bad
   it('works', () => {})
   
   // ✅ Good
   it('returns 404 when media request not found', () => {})
   ```

2. **Follow AAA pattern**
   ```typescript
   it('test scenario', () => {
     // Arrange
     const testData = createTestData()
     
     // Act
     const result = performAction(testData)
     
     // Assert
     expect(result).toMatchExpectation()
   })
   ```

3. **Use test builders for complex data**
   ```typescript
   const user = buildUser({ role: 'admin' })
   const request = buildMediaRequest({ userId: user.id })
   ```

4. **Mock at the right level**
   - Unit tests: Mock direct dependencies
   - Integration tests: Mock external services only
   - E2E tests: Mock as little as possible

## Notes

- All tasks align with test_architecture.md guidelines
- Focus remains on pragmatic testing for 10-20 users
- Avoid over-engineering - keep it simple
- Fix or delete flaky tests immediately
- Prioritize developer experience and fast feedback