# MediaNest Test Architecture (Simplified)

**Version:** 2.0  
**Date:** January 2025  
**Status:** Final  
**Scope:** Small-scale application (10-20 users)

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Pragmatic Testing Approach](#2-pragmatic-testing-approach)
3. [Test Implementation](#3-test-implementation)
4. [Critical Path Testing](#4-critical-path-testing)
5. [External Service Testing](#5-external-service-testing)
6. [Simple CI/CD Integration](#6-simple-cicd-integration)
7. [Practical Guidelines](#7-practical-guidelines)

## 1. Executive Summary

MediaNest's test strategy is designed for a small-scale monolithic application serving 10-20 concurrent users. We focus on practical, maintainable testing that ensures quality without over-engineering.

### Key Principles
- **Test what matters**: Focus on critical user paths and integrations
- **Keep it simple**: Use built-in tools and avoid complex frameworks
- **Fast feedback**: Total test suite runs in under 5 minutes
- **Practical coverage**: Target 60-70% overall, 80% for critical paths

## 2. Pragmatic Testing Approach

### 2.1 Testing Focus Areas

Instead of rigid percentages, we test based on risk and value:

1. **Critical Paths (High Priority)**
   - Plex OAuth authentication flow
   - Media request submission
   - Service status monitoring
   - Rate limiting enforcement

2. **Core Features (Medium Priority)**
   - YouTube download functionality
   - User data isolation
   - Error handling and fallbacks
   - WebSocket connections

3. **Nice-to-Have (Low Priority)**
   - UI component variations
   - Edge case scenarios
   - Performance optimizations

### 2.2 Simplified Standards
- **Coverage Goals**: 60-70% overall (not a hard requirement)
- **Test Execution**: Under 5 minutes for full suite
- **Flaky Tests**: Fix immediately or remove

## 3. Test Implementation

### 3.1 Test Types (What We Actually Need)

| Test Type | Purpose | Tools | When to Use |
|-----------|---------|-------|-------------|
| Unit Tests | Business logic, utilities | Jest | Complex logic, calculations |
| API Tests | Endpoint validation | Supertest | All API routes |
| Integration Tests | External services | Nock/MSW | Service integrations |
| E2E Tests | Critical user flows | Playwright | 2-3 key workflows only |

### 3.2 What We're NOT Doing
- Contract testing (Pact) - overkill for our scale
- Load testing tools (k6, Artillery) - simple integration tests suffice
- Security scanning tools (OWASP ZAP) - manual security review is enough
- Complex mocking frameworks - use simple stubs

### 3.3 Simple Test Environment

```yaml
# docker-compose.test.yml - One simple test environment
version: '3.8'
services:
  postgres-test:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: medianest_test
      POSTGRES_USER: test
      POSTGRES_PASSWORD: test
  
  redis-test:
    image: redis:7-alpine
```

## 4. Technology Stack Testing

### 4.1 Frontend Testing (Next.js 14)

#### Component Testing
```typescript
// components/__tests__/Dashboard.test.tsx
import { render, screen } from '@testing-library/react';
import { Dashboard } from '../Dashboard';

describe('Dashboard Component', () => {
  it('displays service status indicators', () => {
    const mockServices = [
      { name: 'Plex', status: 'up', uptime: 99.9 },
      { name: 'Overseerr', status: 'down', uptime: 85.2 }
    ];
    
    render(<Dashboard services={mockServices} />);
    
    expect(screen.getByText('Plex')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveClass('status-up');
  });
});
```

#### Server-Side Rendering Testing
```typescript
// pages/__tests__/dashboard.test.ts
import { getServerSideProps } from '../dashboard';

describe('Dashboard SSR', () => {
  it('fetches service status data', async () => {
    const context = { req: {}, res: {}, query: {} };
    const result = await getServerSideProps(context);
    
    expect(result.props.services).toBeDefined();
    expect(result.props.services.length).toBeGreaterThan(0);
  });
});
```

#### API Route Testing
```typescript
// pages/api/__tests__/auth.test.ts
import request from 'supertest';
import { createMocks } from 'node-mocks-http';
import handler from '../auth/session';

describe('/api/auth/session', () => {
  it('returns user session data', async () => {
    const { req, res } = createMocks({
      method: 'GET',
      headers: { authorization: 'Bearer valid-token' }
    });
    
    await handler(req, res);
    
    expect(res._getStatusCode()).toBe(200);
    expect(JSON.parse(res._getData())).toMatchObject({
      user: { id: expect.any(String) }
    });
  });
});
```

### 4.2 Backend Testing (Express)

#### API Endpoint Testing
```typescript
// backend/tests/integration/api/media.test.ts
import request from 'supertest';
import { app } from '../../src/app';
import { setupTestDB, cleanupTestDB } from '../helpers/database';

describe('Media API', () => {
  beforeAll(async () => {
    await setupTestDB();
  });
  
  afterAll(async () => {
    await cleanupTestDB();
  });
  
  describe('POST /api/media/request', () => {
    it('creates media request with authentication', async () => {
      const response = await request(app)
        .post('/api/media/request')
        .set('Authorization', 'Bearer valid-jwt')
        .send({
          title: 'The Matrix',
          mediaType: 'movie',
          tmdbId: '603'
        });
      
      expect(response.status).toBe(201);
      expect(response.body.data.title).toBe('The Matrix');
    });
    
    it('rejects unauthenticated requests', async () => {
      const response = await request(app)
        .post('/api/media/request')
        .send({ title: 'Test Movie' });
      
      expect(response.status).toBe(401);
    });
  });
});
```

#### Service Layer Testing
```typescript
// backend/tests/unit/services/authService.test.ts
import { AuthService } from '../../src/services/authService';
import { PlexClient } from '../../src/integrations/plex';

jest.mock('../../src/integrations/plex');

describe('AuthService', () => {
  let authService: AuthService;
  let mockPlexClient: jest.Mocked<PlexClient>;
  
  beforeEach(() => {
    mockPlexClient = new PlexClient() as jest.Mocked<PlexClient>;
    authService = new AuthService(mockPlexClient);
  });
  
  it('validates Plex token correctly', async () => {
    mockPlexClient.validateToken.mockResolvedValue({
      valid: true,
      user: { id: '123', username: 'testuser' }
    });
    
    const result = await authService.validatePlexToken('test-token');
    
    expect(result.valid).toBe(true);
    expect(result.user.username).toBe('testuser');
  });
});
```

### 4.3 Database Testing (PostgreSQL)

#### Repository Testing with Testcontainers
```typescript
// backend/tests/integration/repositories/userRepository.test.ts
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { UserRepository } from '../../src/repositories/userRepository';
import { PrismaClient } from '@prisma/client';

describe('UserRepository', () => {
  let container: PostgreSqlContainer;
  let prisma: PrismaClient;
  let userRepository: UserRepository;
  
  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:15-alpine')
      .withDatabase('medianest_test')
      .withUsername('test')
      .withPassword('test')
      .start();
    
    const connectionString = container.getConnectionUri();
    prisma = new PrismaClient({
      datasources: { db: { url: connectionString } }
    });
    
    await prisma.$executeRawUnsafe('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    await prisma.$executeRaw`
      CREATE TABLE users (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        plex_id VARCHAR(255) UNIQUE NOT NULL,
        username VARCHAR(255) NOT NULL,
        email VARCHAR(255),
        role VARCHAR(50) DEFAULT 'user',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    userRepository = new UserRepository(prisma);
  });
  
  afterAll(async () => {
    await prisma.$disconnect();
    await container.stop();
  });
  
  it('creates user with Plex OAuth data', async () => {
    const userData = {
      plexId: '12345',
      username: 'testuser',
      email: 'test@example.com'
    };
    
    const user = await userRepository.create(userData);
    
    expect(user.plexId).toBe('12345');
    expect(user.username).toBe('testuser');
  });
});
```

### 4.4 Redis Testing

#### Cache Testing
```typescript
// backend/tests/integration/cache/redisCache.test.ts
import { RedisContainer } from '@testcontainers/redis';
import { RedisCache } from '../../src/cache/redisCache';
import Redis from 'ioredis';

describe('RedisCache', () => {
  let container: RedisContainer;
  let redis: Redis;
  let cache: RedisCache;
  
  beforeAll(async () => {
    container = await new RedisContainer('redis:7-alpine').start();
    
    redis = new Redis({
      host: container.getHost(),
      port: container.getMappedPort(6379)
    });
    
    cache = new RedisCache(redis);
  });
  
  afterAll(async () => {
    await redis.quit();
    await container.stop();
  });
  
  beforeEach(async () => {
    await redis.flushall();
  });
  
  it('stores and retrieves service status', async () => {
    const status = { service: 'plex', status: 'up', lastCheck: Date.now() };
    
    await cache.setServiceStatus('plex', status);
    const retrieved = await cache.getServiceStatus('plex');
    
    expect(retrieved).toEqual(status);
  });
  
  it('expires keys correctly', async () => {
    await cache.setServiceStatus('plex', { status: 'up' }, 1); // 1 second TTL
    
    await new Promise(resolve => setTimeout(resolve, 1100));
    
    const retrieved = await cache.getServiceStatus('plex');
    expect(retrieved).toBeNull();
  });
});
```

#### Rate Limiting Testing
```typescript
// backend/tests/unit/middleware/rateLimiter.test.ts
import { rateLimitMiddleware } from '../../src/middleware/rateLimiter';
import Redis from 'ioredis-mock';

describe('Rate Limiter', () => {
  let redis: Redis;
  
  beforeEach(() => {
    redis = new Redis();
  });
  
  it('allows requests within limit', async () => {
    const middleware = rateLimitMiddleware(redis, { limit: 5, window: 60 });
    const req = { user: { id: 'user123' }, path: '/api/test' };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();
    
    await middleware(req, res, next);
    
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });
  
  it('blocks requests exceeding limit', async () => {
    const middleware = rateLimitMiddleware(redis, { limit: 1, window: 60 });
    const req = { user: { id: 'user123' }, path: '/api/test' };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();
    
    // First request should pass
    await middleware(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    
    // Second request should be blocked
    await middleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(429);
  });
});
```

## 4. Critical Path Testing

### 4.1 What to Test First

1. **Authentication Flow** (Most Critical)
   ```typescript
   // Simple test for Plex OAuth
   describe('Plex Authentication', () => {
     it('should handle PIN generation', async () => {
       const pin = await authService.generatePlexPin();
       expect(pin).toHaveProperty('code');
       expect(pin.code).toHaveLength(4);
     });
     
     it('should create user from Plex data', async () => {
       const plexUser = { id: '123', username: 'test', email: 'test@example.com' };
       const user = await userService.createFromPlex(plexUser);
       expect(user.plexId).toBe('123');
     });
   });
   ```

2. **Media Request Flow**
   ```typescript
   // Test the happy path only
   it('should submit media request', async () => {
     const response = await request(app)
       .post('/api/media/request')
       .set('Authorization', 'Bearer valid-token')
       .send({ title: 'The Matrix', type: 'movie' });
     
     expect(response.status).toBe(201);
   });
   ```

3. **Service Status Check**
   ```typescript
   // Simple mock for Uptime Kuma
   it('should return service status', async () => {
     mockUptimeKuma.getStatus.mockResolvedValue([
       { name: 'Plex', status: 'up' },
       { name: 'Overseerr', status: 'down' }
     ]);
     
     const response = await request(app).get('/api/dashboard/status');
     expect(response.body.services).toHaveLength(2);
   });
   ```
```

#### Overseerr API Testing
```typescript
// backend/tests/integration/overseerr/overseerrService.test.ts
import nock from 'nock';
import { OverseerrService } from '../../src/services/overseerrService';

describe('Overseerr Service Integration', () => {
  it('submits media request successfully', async () => {
    nock('http://localhost:5055')
      .post('/api/v1/request')
      .reply(201, {
        id: 123,
        type: 'movie',
        status: 'pending',
        media: { tmdbId: 603, title: 'The Matrix' }
      });
    
    const service = new OverseerrService('http://localhost:5055', 'api-key');
    const request = await service.submitRequest({
      mediaType: 'movie',
      tmdbId: 603
    });
    
    expect(request.id).toBe(123);
    expect(request.status).toBe('pending');
  });
});
```

### 5.2 WebSocket Testing (Socket.io)

```typescript
// frontend/tests/integration/websocket.test.ts
import { io, Socket } from 'socket.io-client';
import { createServer } from 'http';
import { Server } from 'socket.io';

describe('WebSocket Integration', () => {
  let httpServer: any;
  let ioServer: Server;
  let clientSocket: Socket;
  
  beforeAll((done) => {
    httpServer = createServer();
    ioServer = new Server(httpServer);
    
    httpServer.listen(() => {
      const port = httpServer.address().port;
      clientSocket = io(`http://localhost:${port}`, {
        auth: { token: 'valid-jwt' }
      });
      
      ioServer.on('connection', (socket) => {
        socket.on('subscribe:status', () => {
          socket.join('status-updates');
        });
      });
      
      clientSocket.on('connect', done);
    });
  });
  
  afterAll(() => {
    ioServer.close();
    clientSocket.close();
    httpServer.close();
  });
  
  it('receives service status updates', (done) => {
    clientSocket.emit('subscribe:status');
    
    clientSocket.on('service:status', (data) => {
      expect(data.service).toBe('plex');
      expect(data.status).toBe('up');
      done();
    });
    
    // Simulate status update
    ioServer.to('status-updates').emit('service:status', {
      service: 'plex',
      status: 'up',
      timestamp: Date.now()
    });
  });
  
  it('handles authentication failure', (done) => {
    const unauthorizedClient = io(`http://localhost:${httpServer.address().port}`, {
      auth: { token: 'invalid-token' }
    });
    
    unauthorizedClient.on('connect_error', (error) => {
      expect(error.message).toMatch(/authentication/i);
      done();
    });
  });
});
```

### 5.3 Background Job Testing (Bull/Redis)

```typescript
// backend/tests/integration/jobs/youtubeDownload.test.ts
import Queue from 'bull';
import { RedisContainer } from '@testcontainers/redis';
import { processYouTubeDownload } from '../../src/jobs/youtubeProcessor';

describe('YouTube Download Jobs', () => {
  let container: RedisContainer;
  let queue: Queue.Queue;
  
  beforeAll(async () => {
    container = await new RedisContainer('redis:7-alpine').start();
    
    queue = new Queue('youtube-test', {
      redis: {
        host: container.getHost(),
        port: container.getMappedPort(6379)
      }
    });
    
    queue.process(processYouTubeDownload);
  });
  
  afterAll(async () => {
    await queue.close();
    await container.stop();
  });
  
  it('processes download job successfully', async () => {
    const jobData = {
      userId: 'user123',
      playlistUrl: 'https://www.youtube.com/playlist?list=TEST',
      outputPath: '/tmp/test-downloads'
    };
    
    const job = await queue.add(jobData);
    await job.finished();
    
    expect(job.finishedOn).toBeDefined();
    expect(job.returnvalue.success).toBe(true);
  });
  
  it('handles invalid YouTube URL', async () => {
    const jobData = {
      userId: 'user123',
      playlistUrl: 'invalid-url',
      outputPath: '/tmp/test-downloads'
    };
    
    const job = await queue.add(jobData);
    
    await expect(job.finished()).rejects.toThrow('Invalid YouTube URL');
  });
  
  it('retries failed downloads', async () => {
    const jobData = {
      userId: 'user123',
      playlistUrl: 'https://www.youtube.com/playlist?list=NONEXISTENT',
      outputPath: '/tmp/test-downloads'
    };
    
    const job = await queue.add(jobData, { attempts: 3 });
    
    await expect(job.finished()).rejects.toThrow();
    expect(job.attemptsMade).toBe(3);
  });
});
```

### 5.4 Authentication Testing

#### Plex OAuth Testing
```typescript
// backend/tests/integration/auth/plexOAuth.test.ts
import request from 'supertest';
import nock from 'nock';
import { app } from '../../src/app';

describe('Plex OAuth Authentication', () => {
  it('completes OAuth flow successfully', async () => {
    // Mock Plex PIN generation
    nock('https://plex.tv')
      .post('/pins.xml')
      .reply(200, `
        <pin>
          <id>12345</id>
          <code>ABCD</code>
        </pin>
      `);
    
    // Request PIN
    const pinResponse = await request(app)
      .post('/api/auth/plex/pin')
      .expect(200);
    
    expect(pinResponse.body.pin).toBe('ABCD');
    
    // Mock PIN verification with auth token
    nock('https://plex.tv')
      .get('/pins/12345.xml')
      .reply(200, `
        <pin>
          <id>12345</id>
          <authToken>plex-auth-token</authToken>
        </pin>
      `);
    
    // Mock user info fetch
    nock('https://plex.tv')
      .get('/users/account.xml')
      .query({ 'X-Plex-Token': 'plex-auth-token' })
      .reply(200, `
        <user>
          <id>456</id>
          <username>testuser</username>
          <email>test@example.com</email>
        </user>
      `);
    
    // Verify PIN and complete OAuth
    const authResponse = await request(app)
      .post('/api/auth/plex/verify')
      .send({ pinId: '12345' })
      .expect(200);
    
    expect(authResponse.body.user.username).toBe('testuser');
    expect(authResponse.body.token).toBeDefined();
  });
  
  it('handles expired PIN gracefully', async () => {
    nock('https://plex.tv')
      .get('/pins/expired-pin.xml')
      .reply(404);
    
    await request(app)
      .post('/api/auth/plex/verify')
      .send({ pinId: 'expired-pin' })
      .expect(400);
  });
});
```

#### JWT Token Testing
```typescript
// backend/tests/unit/auth/jwtService.test.ts
import { JWTService } from '../../src/services/jwtService';

describe('JWT Service', () => {
  let jwtService: JWTService;
  
  beforeEach(() => {
    jwtService = new JWTService('test-secret');
  });
  
  it('generates and validates tokens correctly', () => {
    const payload = { userId: '123', role: 'user' };
    const token = jwtService.sign(payload);
    
    expect(token).toBeDefined();
    
    const decoded = jwtService.verify(token);
    expect(decoded.userId).toBe('123');
    expect(decoded.role).toBe('user');
  });
  
  it('rejects expired tokens', () => {
    const payload = { userId: '123', role: 'user' };
    const token = jwtService.sign(payload, { expiresIn: '1ms' });
    
    // Wait for token to expire
    setTimeout(() => {
      expect(() => jwtService.verify(token)).toThrow('Token expired');
    }, 10);
  });
  
  it('rejects tampered tokens', () => {
    const payload = { userId: '123', role: 'user' };
    const token = jwtService.sign(payload);
    const tamperedToken = token.slice(0, -1) + 'x';
    
    expect(() => jwtService.verify(tamperedToken)).toThrow('Invalid signature');
  });
});
```

### 5.5 End-to-End Testing

```typescript
// e2e/tests/mediaRequest.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Media Request Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Login with test user
    await page.goto('/auth/login');
    await page.click('[data-testid="plex-login-button"]');
    
    // Mock Plex OAuth flow
    await page.route('https://plex.tv/pins.xml', route => {
      route.fulfill({
        status: 200,
        body: '<pin><id>test</id><code>1234</code></pin>'
      });
    });
    
    await page.fill('[data-testid="pin-input"]', '1234');
    await page.click('[data-testid="verify-pin"]');
    await page.waitForURL('/dashboard');
  });
  
  test('user can request new media', async ({ page }) => {
    // Navigate to media search
    await page.click('[data-testid="media-search-nav"]');
    
    // Search for movie
    await page.fill('[data-testid="search-input"]', 'The Matrix');
    await page.click('[data-testid="search-button"]');
    
    // Verify search results
    await expect(page.locator('[data-testid="search-results"]')).toBeVisible();
    
    // Request movie
    await page.click('[data-testid="request-button-603"]');
    
    // Confirm request
    await page.click('[data-testid="confirm-request"]');
    
    // Verify success message
    await expect(page.locator('[data-testid="success-message"]'))
      .toContainText('Request submitted successfully');
    
    // Check request appears in user's queue
    await page.click('[data-testid="my-requests-nav"]');
    await expect(page.locator('[data-testid="request-item"]'))
      .toContainText('The Matrix');
  });
  
  test('user sees service status updates in real-time', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Initial service status
    await expect(page.locator('[data-testid="plex-status"]'))
      .toHaveClass(/status-up/);
    
    // Simulate service going down via WebSocket
    await page.evaluate(() => {
      window.socket.emit('service:status', {
        service: 'plex',
        status: 'down',
        timestamp: Date.now()
      });
    });
    
    // Verify status update
    await expect(page.locator('[data-testid="plex-status"]'))
      .toHaveClass(/status-down/);
  });
});
```

## 6. Environment Configuration

### 6.1 Test Environment Setup

#### Docker Compose for Testing
```yaml
# docker-compose.test.yml
version: '3.8'

services:
  postgres-test:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: medianest_test
      POSTGRES_USER: test
      POSTGRES_PASSWORD: test
    ports:
      - "5433:5432"
    tmpfs:
      - /var/lib/postgresql/data

  redis-test:
    image: redis:7-alpine
    ports:
      - "6380:6379"
    command: redis-server --save ""

  app-test:
    build:
      context: .
      dockerfile: Dockerfile.test
    environment:
      NODE_ENV: test
      DATABASE_URL: postgresql://test:test@postgres-test:5432/medianest_test
      REDIS_URL: redis://redis-test:6379
    depends_on:
      - postgres-test
      - redis-test
    volumes:
      - ./test-results:/app/test-results
```

#### Test Configuration
```typescript
// jest.config.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  testMatch: [
    '<rootDir>/tests/**/*.test.ts',
    '<rootDir>/src/**/__tests__/**/*.test.ts'
  ],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/tests/**'
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    },
    './src/services/': {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  testTimeout: 30000,
  maxWorkers: '50%'
};
```

#### Playwright Configuration
```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e/tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html'],
    ['junit', { outputFile: 'test-results/results.xml' }]
  ],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure'
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] }
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] }
    }
  ],
  webServer: {
    command: 'npm run dev',
    port: 3000,
    reuseExistingServer: !process.env.CI
  }
});
```

### 6.2 Test Data Management

#### Database Fixtures
```typescript
// tests/fixtures/users.ts
export const testUsers = [
  {
    id: 'user-1',
    plexId: 'plex-123',
    username: 'testuser1',
    email: 'test1@example.com',
    role: 'user'
  },
  {
    id: 'admin-1',
    plexId: 'plex-456',
    username: 'admin',
    email: 'admin@example.com',
    role: 'admin'
  }
];

export const testMediaRequests = [
  {
    id: 'request-1',
    userId: 'user-1',
    title: 'The Matrix',
    mediaType: 'movie',
    tmdbId: '603',
    status: 'pending'
  }
];
```

#### Test Database Helpers
```typescript
// tests/helpers/database.ts
import { PrismaClient } from '@prisma/client';
import { testUsers, testMediaRequests } from '../fixtures';

export class TestDatabase {
  private prisma: PrismaClient;
  
  constructor(connectionString: string) {
    this.prisma = new PrismaClient({
      datasources: { db: { url: connectionString } }
    });
  }
  
  async seed() {
    // Clear existing data
    await this.prisma.mediaRequest.deleteMany();
    await this.prisma.user.deleteMany();
    
    // Insert test data
    await this.prisma.user.createMany({ data: testUsers });
    await this.prisma.mediaRequest.createMany({ data: testMediaRequests });
  }
  
  async cleanup() {
    await this.prisma.mediaRequest.deleteMany();
    await this.prisma.user.deleteMany();
  }
  
  async disconnect() {
    await this.prisma.$disconnect();
  }
}
```

## 7. Test Implementation Guidelines

### 7.1 Writing Effective Tests

#### Test Structure (AAA Pattern)
```typescript
describe('Service Under Test', () => {
  it('should behave correctly when condition is met', async () => {
    // Arrange
    const mockDependency = createMockDependency();
    const service = new ServiceUnderTest(mockDependency);
    const input = { /* test input */ };
    
    // Act
    const result = await service.methodUnderTest(input);
    
    // Assert
    expect(result).toEqual(expectedResult);
    expect(mockDependency.method).toHaveBeenCalledWith(expectedArgs);
  });
});
```

#### Test Naming Conventions
- **Unit tests**: `service.method.should.behavior.when.condition.test.ts`
- **Integration tests**: `feature.integration.test.ts`
- **E2E tests**: `userFlow.spec.ts`

#### Mock Strategy
```typescript
// Prefer dependency injection for easier mocking
export class MediaService {
  constructor(
    private plexClient: PlexClient,
    private overseerrClient: OverseerrClient,
    private database: Database
  ) {}
}

// In tests
const mockPlexClient = {
  getLibraries: jest.fn(),
  searchMedia: jest.fn()
};

const mediaService = new MediaService(
  mockPlexClient,
  mockOverseerrClient,
  mockDatabase
);
```

### 7.2 Error Testing

```typescript
// Test error conditions explicitly
describe('Error Handling', () => {
  it('handles Plex server timeout gracefully', async () => {
    mockPlexClient.getLibraries.mockRejectedValue(
      new Error('ETIMEDOUT')
    );
    
    const result = await mediaService.getLibraries();
    
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/service unavailable/i);
    expect(result.cached).toBe(true); // Should return cached data
  });
  
  it('handles invalid JWT tokens', async () => {
    const invalidToken = 'invalid.jwt.token';
    
    const response = await request(app)
      .get('/api/protected')
      .set('Authorization', `Bearer ${invalidToken}`)
      .expect(401);
    
    expect(response.body.error.code).toBe('INVALID_TOKEN');
  });
});
```

### 7.3 Performance Testing in Unit Tests

```typescript
// Performance assertions in unit tests
describe('Performance Requirements', () => {
  it('processes YouTube download metadata under 5 seconds', async () => {
    const startTime = Date.now();
    
    const metadata = await youtubeService.extractMetadata(
      'https://youtube.com/playlist?list=TEST'
    );
    
    const duration = Date.now() - startTime;
    
    expect(duration).toBeLessThan(5000);
    expect(metadata.videos.length).toBeGreaterThan(0);
  });
});
```

## 6. Simple CI/CD Integration

### 6.1 One Simple GitHub Actions Workflow

```yaml
# .github/workflows/test.yml
name: Tests

on:
  push:
    branches: [main]
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:15-alpine
        env:
          POSTGRES_PASSWORD: test
          POSTGRES_USER: test
          POSTGRES_DB: medianest_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
      
      redis:
        image: redis:7-alpine
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: 20
          cache: 'npm'
      
      - name: Install and Test
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/medianest_test
          REDIS_URL: redis://localhost:6379
          NODE_ENV: test
        run: |
          npm ci
          npm test
          
      # Only run E2E on main branch to save time
      - name: E2E Tests
        if: github.ref == 'refs/heads/main'
        run: |
          npx playwright install chromium
          npm run test:e2e
```

### 6.2 Local Testing

```bash
# Simple test commands
npm test              # Run all tests
npm run test:watch    # Watch mode for development
npm run test:api      # Just API tests
npm run test:e2e      # Just E2E tests (rarely)
```

### 8.2 Test Reporting and Metrics

#### Coverage Reporting
```typescript
// tests/coverage.config.js
module.exports = {
  reporters: [
    'default',
    ['jest-junit', {
      outputDirectory: './test-results',
      outputName: 'junit.xml'
    }],
    ['jest-html-reporters', {
      publicPath: './test-results/html',
      filename: 'index.html'
    }]
  ],
  coverageReporters: [
    'text',
    'lcov',
    'html',
    'json-summary'
  ]
};
```

#### Performance Metrics Collection
```typescript
// tests/helpers/metrics.ts
export class TestMetrics {
  private metrics: Map<string, number[]> = new Map();
  
  recordExecutionTime(testName: string, duration: number) {
    if (!this.metrics.has(testName)) {
      this.metrics.set(testName, []);
    }
    this.metrics.get(testName)!.push(duration);
  }
  
  generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      metrics: {}
    };
    
    for (const [testName, durations] of this.metrics) {
      const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
      const max = Math.max(...durations);
      const min = Math.min(...durations);
      
      report.metrics[testName] = { avg, max, min, count: durations.length };
    }
    
    return report;
  }
}
```

## 5. External Service Testing

### 5.1 Simple Mocking Strategy

Use basic mocks instead of complex frameworks:

```typescript
// Simple mock for external services
export const mockPlexAPI = {
  getLibraries: jest.fn().mockResolvedValue([
    { id: '1', title: 'Movies' },
    { id: '2', title: 'TV Shows' }
  ]),
  searchMedia: jest.fn(),
  getUserInfo: jest.fn()
};

// In tests
import { mockPlexAPI } from '../mocks';

beforeEach(() => {
  jest.clearAllMocks();
});

it('should handle Plex being down', async () => {
  mockPlexAPI.getLibraries.mockRejectedValue(new Error('Connection refused'));
  
  const response = await request(app).get('/api/plex/libraries');
  expect(response.status).toBe(503);
  expect(response.body.error).toContain('temporarily unavailable');
});
```

### 5.2 Testing Service Failures

Focus on graceful degradation:

```typescript
// Test what happens when services fail
describe('Service Resilience', () => {
  it('should show degraded status when Overseerr is down', async () => {
    mockOverseerr.isAvailable.mockResolvedValue(false);
    
    const response = await request(app).get('/api/dashboard/status');
    const overseerr = response.body.services.find(s => s.name === 'Overseerr');
    
    expect(overseerr.status).toBe('down');
    expect(overseerr.features).toContain('disabled');
  });
});
```

### 9.2 WebSocket Load Testing

```javascript
// tests/performance/websocket-load.js
import ws from 'k6/ws';
import { check } from 'k6';

export let options = {
  vus: 50, // 50 virtual users
  duration: '5m',
};

export default function() {
  let url = 'ws://localhost:4000';
  let params = { tags: { my_tag: 'websocket' } };
  
  let response = ws.connect(url, params, function(socket) {
    socket.on('open', function() {
      console.log('WebSocket connection established');
      
      // Subscribe to status updates
      socket.send(JSON.stringify({
        event: 'subscribe:status'
      }));
    });
    
    socket.on('message', function(message) {
      let data = JSON.parse(message);
      
      check(data, {
        'status message received': (d) => d.event === 'service:status',
        'status has valid format': (d) => d.service && d.status,
      });
    });
    
    socket.on('close', function() {
      console.log('WebSocket connection closed');
    });
    
    socket.setTimeout(function() {
      console.log('WebSocket connection timeout');
      socket.close();
    }, 10000);
  });
  
  check(response, {
    'WebSocket connection successful': (r) => r && r.status === 101,
  });
}
```

### 9.3 Database Performance Testing

```typescript
// tests/performance/database.test.ts
import { PrismaClient } from '@prisma/client';
import { performance } from 'perf_hooks';

describe('Database Performance', () => {
  let prisma: PrismaClient;
  
  beforeAll(async () => {
    prisma = new PrismaClient();
  });
  
  afterAll(async () => {
    await prisma.$disconnect();
  });
  
  it('handles concurrent user creation', async () => {
    const startTime = performance.now();
    
    const promises = Array.from({ length: 100 }, (_, i) =>
      prisma.user.create({
        data: {
          plexId: `test-${i}`,
          username: `user${i}`,
          email: `user${i}@test.com`
        }
      })
    );
    
    await Promise.all(promises);
    
    const duration = performance.now() - startTime;
    
    expect(duration).toBeLessThan(5000); // Under 5 seconds for 100 users
    
    // Cleanup
    await prisma.user.deleteMany({
      where: { username: { startsWith: 'user' } }
    });
  });
  
  it('efficiently queries media requests with pagination', async () => {
    // Seed test data
    const users = await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        prisma.user.create({
          data: {
            plexId: `perf-test-${i}`,
            username: `perfuser${i}`,
            email: `perfuser${i}@test.com`
          }
        })
      )
    );
    
    await Promise.all(
      users.flatMap(user =>
        Array.from({ length: 100 }, (_, i) =>
          prisma.mediaRequest.create({
            data: {
              userId: user.id,
              title: `Movie ${i}`,
              mediaType: 'movie',
              tmdbId: `${i}`,
              status: 'pending'
            }
          })
        )
      )
    );
    
    const startTime = performance.now();
    
    // Query with pagination
    const requests = await prisma.mediaRequest.findMany({
      take: 20,
      skip: 0,
      orderBy: { createdAt: 'desc' },
      include: { user: true }
    });
    
    const duration = performance.now() - startTime;
    
    expect(duration).toBeLessThan(100); // Under 100ms
    expect(requests).toHaveLength(20);
    
    // Cleanup
    await prisma.mediaRequest.deleteMany({
      where: { title: { startsWith: 'Movie' } }
    });
    await prisma.user.deleteMany({
      where: { username: { startsWith: 'perfuser' } }
    });
  });
});
```

### 5.3 Simple Performance Checks

No need for k6 or Artillery - just add assertions to existing tests:

```typescript
// Add performance checks to integration tests
it('should respond quickly to API requests', async () => {
  const start = Date.now();
  
  const response = await request(app)
    .get('/api/dashboard/status')
    .set('Authorization', 'Bearer valid-token');
  
  const duration = Date.now() - start;
  
  expect(response.status).toBe(200);
  expect(duration).toBeLessThan(1000); // Under 1 second
});

// Simple concurrent user test
it('should handle 20 concurrent requests', async () => {
  const requests = Array(20).fill(null).map(() => 
    request(app).get('/api/health')
  );
  
  const responses = await Promise.all(requests);
  const successful = responses.filter(r => r.status === 200);
  
  expect(successful.length).toBe(20);
});
```
```

### 10.2 SQL Injection Prevention Testing

```typescript
// tests/security/sqlInjection.test.ts
import { PrismaClient } from '@prisma/client';

describe('Security: SQL Injection Prevention', () => {
  let prisma: PrismaClient;
  
  beforeAll(async () => {
    prisma = new PrismaClient();
  });
  
  afterAll(async () => {
    await prisma.$disconnect();
  });
  
  it('prevents SQL injection in user search', async () => {
    const maliciousInput = "'; DROP TABLE users; --";
    
    // This should not throw an error or affect the database
    const result = await prisma.user.findMany({
      where: {
        username: {
          contains: maliciousInput
        }
      }
    });
    
    expect(result).toEqual([]);
    
    // Verify users table still exists
    const userCount = await prisma.user.count();
    expect(userCount).toBeGreaterThanOrEqual(0);
  });
  
  it('prevents SQL injection in media search', async () => {
    const maliciousInput = "' UNION SELECT * FROM users --";
    
    const result = await prisma.mediaRequest.findMany({
      where: {
        title: {
          contains: maliciousInput
        }
      }
    });
    
    expect(result).toEqual([]);
  });
});
```

### 10.3 Security Headers Testing

```typescript
// tests/security/headers.test.ts
import request from 'supertest';
import { app } from '../src/app';

describe('Security: HTTP Headers', () => {
  it('sets security headers correctly', async () => {
    const response = await request(app)
      .get('/api/health')
      .expect(200);
    
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-frame-options']).toBe('DENY');
    expect(response.headers['x-xss-protection']).toBe('1; mode=block');
    expect(response.headers['strict-transport-security']).toMatch(/max-age=\d+/);
    expect(response.headers['content-security-policy']).toBeDefined();
  });
  
  it('does not expose sensitive information', async () => {
    const response = await request(app)
      .get('/api/health')
      .expect(200);
    
    expect(response.headers['x-powered-by']).toBeUndefined();
    expect(response.headers['server']).toBeUndefined();
  });
});
```

## 7. Practical Guidelines

### 7.1 Test Helpers (Keep It Simple)

```typescript
// Simple test utilities
export const testUtils = {
  // Generate test JWT
  createAuthToken: (userId: string, role = 'user') => {
    return jwt.sign({ userId, role }, process.env.JWT_SECRET, { expiresIn: '1h' });
  },
  
  // Create test user
  createTestUser: async (overrides = {}) => {
    return await prisma.user.create({
      data: {
        plexId: 'test-' + Date.now(),
        username: 'testuser',
        email: 'test@example.com',
        role: 'user',
        ...overrides
      }
    });
  },
  
  // Clean database after tests
  cleanDatabase: async () => {
    await prisma.mediaRequest.deleteMany();
    await prisma.user.deleteMany();
  }
};
```

### 7.2 What to Test Checklist

✅ **Must Test:**
- Plex OAuth flow (critical path)
- User data isolation (security)
- Rate limiting (prevent abuse)
- Service unavailability handling
- Basic API authentication

❌ **Skip Testing:**
- UI component props/state
- Simple CRUD operations
- Third-party library internals
- CSS/styling
- Performance under extreme load

### 7.3 Test Maintenance

1. **Fix or Delete**: Flaky tests get one chance to be fixed, then deleted
2. **Review Quarterly**: Remove obsolete tests
3. **Document Weird Tests**: If a test is non-obvious, add a comment explaining why
4. **Keep It Fast**: If total suite > 5 minutes, remove low-value tests

### 7.4 Coverage Guidelines (Realistic Goals)

**Target Coverage: 60-70% overall**

Prioritize coverage where it matters:
- Authentication/Security: 80%
- Business Logic: 70%
- API Routes: 60%
- UI Components: 40-50%

```javascript
// jest.config.js - Simple configuration
module.exports = {
  testEnvironment: 'node',
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.{js,ts}',
    '!src/**/*.test.{js,ts}',
    '!src/types/**'
  ],
  // No hard thresholds - use as guidance only
  coverageReporters: ['text', 'html']
};
```

## Example Test Structure

```
tests/
├── unit/
│   ├── services/          # Business logic tests
│   └── utils/             # Utility function tests
├── integration/
│   ├── api/               # API endpoint tests
│   └── external/          # External service mocks
├── e2e/
│   ├── auth.spec.ts       # Auth flow
│   └── media-request.spec.ts  # Request flow
└── helpers/
    ├── setup.ts           # Test setup
    └── mocks.ts           # Shared mocks
```

## Summary

This simplified test architecture is designed specifically for MediaNest's scale (10-20 users). It prioritizes:

1. **Practical Testing**: Focus on what can break, not arbitrary coverage
2. **Simple Tools**: Jest, Supertest, and basic mocks - no complex frameworks
3. **Fast Execution**: Under 5 minutes for everything
4. **Easy Maintenance**: If a test is hard to maintain, delete it

Remember: For a small application, a few well-written tests covering critical paths are worth more than thousands of tests covering every edge case.

**Key Takeaway**: Test the Plex OAuth flow thoroughly, ensure services fail gracefully, verify rate limiting works, and call it done. Everything else is optional.

---

**Document Version**: 2.0 (Simplified)  
**Review Schedule**: When something breaks  
**Maintenance**: Keep it simple