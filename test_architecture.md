# MediaNest Test Architecture

**Version:** 1.0  
**Date:** January 2025  
**Status:** Draft

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Testing Philosophy & Principles](#2-testing-philosophy--principles)
3. [Test Strategy Overview](#3-test-strategy-overview)
4. [Technology Stack Testing](#4-technology-stack-testing)
5. [Test Types & Layers](#5-test-types--layers)
6. [Environment Configuration](#6-environment-configuration)
7. [Test Implementation Guidelines](#7-test-implementation-guidelines)
8. [CI/CD Integration](#8-cicd-integration)
9. [Performance & Load Testing](#9-performance--load-testing)
10. [Security Testing](#10-security-testing)
11. [Test Automation Framework](#11-test-automation-framework)
12. [Coverage Requirements](#12-coverage-requirements)
13. [Monitoring & Reporting](#13-monitoring--reporting)
14. [Maintenance & Best Practices](#14-maintenance--best-practices)

## 1. Executive Summary

MediaNest's test architecture ensures reliable, secure, and performant operation of a unified media management portal serving 10-20 concurrent users. The strategy encompasses unit, integration, end-to-end, and specialized testing for external service integrations (Plex, Overseerr, Uptime Kuma), real-time features (Socket.io), background processing (Bull/Redis), and security mechanisms (Plex OAuth, JWT).

### Key Testing Objectives
- **Reliability**: 99.9% uptime with graceful degradation when external services fail
- **Security**: Comprehensive authentication and authorization testing
- **Performance**: Sub-2s page loads and <1s API response times
- **Integration**: Robust external service mocking and fallback testing
- **User Experience**: End-to-end workflow validation

## 2. Testing Philosophy & Principles

### 2.1 Testing Pyramid Strategy
```
              E2E Tests (5%)
          Integration Tests (25%)
        Unit Tests (70%)
```

### 2.2 Core Principles
1. **Test-Driven Development**: Write tests before implementation
2. **Fast Feedback**: Unit tests run in <30 seconds
3. **Reliable Isolation**: Each test runs independently
4. **Real-World Simulation**: Integration tests mirror production scenarios
5. **Security-First**: All authentication flows thoroughly tested
6. **Graceful Degradation**: Test service failures and fallbacks

### 2.3 Testing Standards
- **Code Coverage**: Minimum 80% for critical paths, 70% overall
- **Test Execution Time**: Full suite completes in <10 minutes
- **Flaky Test Tolerance**: <2% failure rate in CI/CD

## 3. Test Strategy Overview

### 3.1 Testing Layers

| Test Layer | Purpose | Tools | Coverage |
|------------|---------|-------|----------|
| Unit | Individual components, functions | Jest, React Testing Library | 70% |
| Integration | API endpoints, database interactions | Supertest, Testcontainers | 25% |
| E2E | User workflows, cross-system | Playwright, Cypress | 5% |
| Contract | External API interactions | Pact, WireMock | - |
| Performance | Load, stress, scalability | k6, Artillery | - |
| Security | Authentication, authorization | Custom scripts, OWASP ZAP | - |

### 3.2 Test Environment Matrix

| Environment | Purpose | Services | Data |
|-------------|---------|----------|------|
| Local | Development testing | Docker Compose | Fixtures |
| CI/CD | Automated testing | GitHub Actions + Docker | Synthetic |
| Staging | Integration testing | Full stack | Production-like |

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

## 5. Test Types & Layers

### 5.1 External Service Integration Testing

#### Plex API Testing
```typescript
// backend/tests/integration/plex/plexService.test.ts
import nock from 'nock';
import { PlexService } from '../../src/services/plexService';

describe('Plex Service Integration', () => {
  let plexService: PlexService;
  
  beforeEach(() => {
    plexService = new PlexService('http://localhost:32400');
  });
  
  afterEach(() => {
    nock.cleanAll();
  });
  
  it('fetches library sections successfully', async () => {
    nock('http://localhost:32400')
      .get('/library/sections')
      .query({ 'X-Plex-Token': 'test-token' })
      .reply(200, {
        MediaContainer: {
          Directory: [
            { key: '1', title: 'Movies', type: 'movie' },
            { key: '2', title: 'TV Shows', type: 'show' }
          ]
        }
      });
    
    const libraries = await plexService.getLibraries('test-token');
    
    expect(libraries).toHaveLength(2);
    expect(libraries[0].title).toBe('Movies');
  });
  
  it('handles Plex server unavailable gracefully', async () => {
    nock('http://localhost:32400')
      .get('/library/sections')
      .replyWithError('ECONNREFUSED');
    
    await expect(plexService.getLibraries('test-token'))
      .rejects
      .toThrow('Plex server unavailable');
  });
});
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

## 8. CI/CD Integration

### 8.1 GitHub Actions Workflow

```yaml
# .github/workflows/test.yml
name: Test Suite

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: test
          POSTGRES_USER: test
          POSTGRES_DB: medianest_test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      
      redis:
        image: redis:7-alpine
        ports:
          - 6379:6379
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: 20
          cache: 'npm'
      
      - name: Install dependencies
        run: |
          npm ci
          cd frontend && npm ci
          cd ../backend && npm ci
      
      - name: Run backend unit tests
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/medianest_test
          REDIS_URL: redis://localhost:6379
          NODE_ENV: test
        run: |
          cd backend
          npm run test:unit
      
      - name: Run frontend unit tests
        run: |
          cd frontend
          npm run test:unit
      
      - name: Upload coverage reports
        uses: codecov/codecov-action@v3
        with:
          directory: ./coverage
          flags: unittests

  integration-tests:
    runs-on: ubuntu-latest
    needs: unit-tests
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: 20
          cache: 'npm'
      
      - name: Install dependencies
        run: |
          npm ci
          cd frontend && npm ci
          cd ../backend && npm ci
      
      - name: Start test environment
        run: |
          docker-compose -f docker-compose.test.yml up -d
          sleep 30 # Wait for services to be ready
      
      - name: Run integration tests
        env:
          NODE_ENV: test
        run: |
          cd backend
          npm run test:integration
      
      - name: Stop test environment
        run: docker-compose -f docker-compose.test.yml down

  e2e-tests:
    runs-on: ubuntu-latest
    needs: [unit-tests, integration-tests]
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: 20
          cache: 'npm'
      
      - name: Install dependencies
        run: |
          npm ci
          cd frontend && npm ci
          cd ../backend && npm ci
      
      - name: Install Playwright browsers
        run: npx playwright install --with-deps
      
      - name: Start application
        run: |
          docker-compose -f docker-compose.test.yml up -d
          npm run dev &
          sleep 60 # Wait for app to be ready
      
      - name: Run E2E tests
        run: npx playwright test
      
      - name: Upload Playwright report
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 30

  security-tests:
    runs-on: ubuntu-latest
    needs: unit-tests
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      
      - name: Run Snyk security scan
        uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
        with:
          args: --severity-threshold=high
      
      - name: Run npm audit
        run: |
          cd frontend && npm audit --audit-level high
          cd ../backend && npm audit --audit-level high
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

## 9. Performance & Load Testing

### 9.1 API Load Testing with k6

```javascript
// tests/performance/api-load.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
  stages: [
    { duration: '2m', target: 10 }, // Ramp up
    { duration: '5m', target: 20 }, // Stay at 20 users
    { duration: '2m', target: 0 },  // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests under 500ms
    http_req_failed: ['rate<0.1'],   // Error rate under 10%
  },
};

export default function() {
  // Test authentication
  let authResponse = http.post('http://localhost:4000/api/auth/login', {
    username: 'testuser',
    password: 'testpass'
  });
  
  check(authResponse, {
    'auth status is 200': (r) => r.status === 200,
    'auth response time < 200ms': (r) => r.timings.duration < 200,
  });
  
  let token = authResponse.json('token');
  let headers = { Authorization: `Bearer ${token}` };
  
  // Test dashboard endpoint
  let dashboardResponse = http.get('http://localhost:4000/api/dashboard/status', {
    headers: headers
  });
  
  check(dashboardResponse, {
    'dashboard status is 200': (r) => r.status === 200,
    'dashboard response time < 500ms': (r) => r.timings.duration < 500,
  });
  
  // Test media search
  let searchResponse = http.get(
    'http://localhost:4000/api/media/search?q=matrix',
    { headers: headers }
  );
  
  check(searchResponse, {
    'search status is 200': (r) => r.status === 200,
    'search response time < 1000ms': (r) => r.timings.duration < 1000,
  });
  
  sleep(1);
}
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

## 10. Security Testing

### 10.1 Authentication & Authorization Testing

```typescript
// tests/security/auth.test.ts
import request from 'supertest';
import { app } from '../src/app';
import jwt from 'jsonwebtoken';

describe('Security: Authentication & Authorization', () => {
  describe('JWT Token Security', () => {
    it('rejects requests with no token', async () => {
      await request(app)
        .get('/api/admin/users')
        .expect(401)
        .expect(res => {
          expect(res.body.error.code).toBe('AUTH_REQUIRED');
        });
    });
    
    it('rejects requests with invalid token', async () => {
      await request(app)
        .get('/api/admin/users')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401)
        .expect(res => {
          expect(res.body.error.code).toBe('INVALID_TOKEN');
        });
    });
    
    it('rejects requests with expired token', async () => {
      const expiredToken = jwt.sign(
        { userId: 'test', role: 'admin' },
        process.env.JWT_SECRET!,
        { expiresIn: '1ms' }
      );
      
      // Wait for token to expire
      await new Promise(resolve => setTimeout(resolve, 10));
      
      await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401)
        .expect(res => {
          expect(res.body.error.code).toBe('TOKEN_EXPIRED');
        });
    });
    
    it('rejects users accessing admin endpoints', async () => {
      const userToken = jwt.sign(
        { userId: 'test', role: 'user' },
        process.env.JWT_SECRET!
      );
      
      await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403)
        .expect(res => {
          expect(res.body.error.code).toBe('PERMISSION_DENIED');
        });
    });
  });
  
  describe('Rate Limiting', () => {
    it('enforces API rate limits', async () => {
      const token = jwt.sign(
        { userId: 'test', role: 'user' },
        process.env.JWT_SECRET!
      );
      
      const requests = Array.from({ length: 101 }, () =>
        request(app)
          .get('/api/dashboard/status')
          .set('Authorization', `Bearer ${token}`)
      );
      
      const responses = await Promise.all(requests);
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
    
    it('includes retry-after header in rate limit responses', async () => {
      const token = jwt.sign(
        { userId: 'test', role: 'user' },
        process.env.JWT_SECRET!
      );
      
      // Exceed rate limit
      for (let i = 0; i < 101; i++) {
        await request(app)
          .get('/api/dashboard/status')
          .set('Authorization', `Bearer ${token}`);
      }
      
      const response = await request(app)
        .get('/api/dashboard/status')
        .set('Authorization', `Bearer ${token}`)
        .expect(429);
      
      expect(response.headers['retry-after']).toBeDefined();
      expect(parseInt(response.headers['retry-after'])).toBeGreaterThan(0);
    });
  });
  
  describe('Input Validation', () => {
    it('sanitizes user input to prevent XSS', async () => {
      const token = jwt.sign(
        { userId: 'test', role: 'user' },
        process.env.JWT_SECRET!
      );
      
      const maliciousInput = '<script>alert("xss")</script>';
      
      await request(app)
        .post('/api/media/request')
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: maliciousInput,
          mediaType: 'movie',
          tmdbId: '123'
        })
        .expect(400)
        .expect(res => {
          expect(res.body.error.code).toBe('VALIDATION_ERROR');
        });
    });
    
    it('validates YouTube URLs to prevent code injection', async () => {
      const token = jwt.sign(
        { userId: 'test', role: 'user' },
        process.env.JWT_SECRET!
      );
      
      const maliciousUrl = 'javascript:alert("xss")';
      
      await request(app)
        .post('/api/youtube/download')
        .set('Authorization', `Bearer ${token}`)
        .send({
          playlistUrl: maliciousUrl
        })
        .expect(400)
        .expect(res => {
          expect(res.body.error.code).toBe('INVALID_YOUTUBE_URL');
        });
    });
  });
});
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

## 11. Test Automation Framework

### 11.1 Test Utilities

```typescript
// tests/utils/testHelpers.ts
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { Redis } from 'ioredis';

export class TestHelpers {
  static generateAuthToken(payload: any): string {
    return jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn: '1h' });
  }
  
  static async waitForCondition(
    condition: () => Promise<boolean>,
    timeout = 5000,
    interval = 100
  ): Promise<void> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      if (await condition()) {
        return;
      }
      await new Promise(resolve => setTimeout(resolve, interval));
    }
    
    throw new Error(`Condition not met within ${timeout}ms`);
  }
  
  static createMockRequest(overrides = {}) {
    return {
      method: 'GET',
      url: '/',
      headers: {},
      body: {},
      query: {},
      params: {},
      user: null,
      ...overrides
    };
  }
  
  static createMockResponse() {
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
      setHeader: jest.fn().mockReturnThis(),
      cookie: jest.fn().mockReturnThis()
    };
    return res;
  }
}

export class DatabaseTestHelper {
  constructor(private prisma: PrismaClient) {}
  
  async seedTestData() {
    await this.prisma.user.createMany({
      data: [
        {
          plexId: 'test-user-1',
          username: 'testuser1',
          email: 'test1@example.com',
          role: 'user'
        },
        {
          plexId: 'test-admin-1',
          username: 'admin',
          email: 'admin@example.com',
          role: 'admin'
        }
      ]
    });
  }
  
  async cleanTestData() {
    await this.prisma.mediaRequest.deleteMany();
    await this.prisma.youtubeDownload.deleteMany();
    await this.prisma.user.deleteMany();
  }
}

export class RedisTestHelper {
  constructor(private redis: Redis) {}
  
  async flushTestData() {
    await this.redis.flushall();
  }
  
  async setTestRateLimit(userId: string, endpoint: string, count: number) {
    const key = `rate:${endpoint}:${userId}`;
    await this.redis.set(key, count, 'EX', 60);
  }
}
```

### 11.2 Custom Matchers

```typescript
// tests/utils/customMatchers.ts
import { expect } from '@jest/globals';

declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidJWT(): R;
      toHaveValidApiResponse(): R;
      toBeWithinTimeRange(expected: number, tolerance: number): R;
    }
  }
}

expect.extend({
  toBeValidJWT(received: string) {
    try {
      const decoded = jwt.decode(received);
      if (!decoded || typeof decoded !== 'object') {
        return {
          message: () => 'Expected a valid JWT token',
          pass: false
        };
      }
      
      return {
        message: () => 'Expected not to be a valid JWT token',
        pass: true
      };
    } catch (error) {
      return {
        message: () => `Expected a valid JWT token, but got error: ${error.message}`,
        pass: false
      };
    }
  },
  
  toHaveValidApiResponse(received: any) {
    const hasSuccess = typeof received.success === 'boolean';
    const hasData = received.success ? received.data !== undefined : received.error !== undefined;
    
    return {
      message: () => hasSuccess && hasData 
        ? 'Expected invalid API response format'
        : 'Expected valid API response format with success boolean and data/error',
      pass: hasSuccess && hasData
    };
  },
  
  toBeWithinTimeRange(received: number, expected: number, tolerance: number) {
    const diff = Math.abs(received - expected);
    const withinRange = diff <= tolerance;
    
    return {
      message: () => withinRange
        ? `Expected ${received} not to be within ${tolerance}ms of ${expected}`
        : `Expected ${received} to be within ${tolerance}ms of ${expected}, but diff was ${diff}ms`,
      pass: withinRange
    };
  }
});
```

### 11.3 Test Data Factories

```typescript
// tests/factories/userFactory.ts
import { User } from '@prisma/client';

export class UserFactory {
  static create(overrides: Partial<User> = {}): Omit<User, 'id' | 'createdAt' | 'updatedAt'> {
    return {
      plexId: `plex-${Math.random().toString(36).substr(2, 9)}`,
      username: `user${Math.random().toString(36).substr(2, 5)}`,
      email: `test${Math.random().toString(36).substr(2, 5)}@example.com`,
      role: 'user',
      plexToken: null,
      lastLoginAt: null,
      status: 'active',
      ...overrides
    };
  }
  
  static createAdmin(overrides: Partial<User> = {}) {
    return this.create({
      role: 'admin',
      username: 'admin',
      ...overrides
    });
  }
  
  static createMany(count: number, overrides: Partial<User> = {}) {
    return Array.from({ length: count }, () => this.create(overrides));
  }
}

export class MediaRequestFactory {
  static create(userId: string, overrides = {}) {
    return {
      userId,
      title: `Test Movie ${Math.random().toString(36).substr(2, 5)}`,
      mediaType: 'movie',
      tmdbId: Math.floor(Math.random() * 10000).toString(),
      status: 'pending',
      overseerrId: null,
      completedAt: null,
      ...overrides
    };
  }
}
```

## 12. Coverage Requirements

### 12.1 Coverage Metrics

| Component | Line Coverage | Branch Coverage | Function Coverage |
|-----------|---------------|-----------------|-------------------|
| Authentication | 95% | 90% | 100% |
| API Controllers | 85% | 80% | 95% |
| Service Layer | 90% | 85% | 95% |
| Database Layer | 80% | 75% | 90% |
| Frontend Components | 85% | 80% | 90% |
| External Integrations | 75% | 70% | 85% |

### 12.2 Critical Path Coverage

```typescript
// Critical paths requiring 100% coverage
const CRITICAL_PATHS = [
  'src/services/authService.ts',
  'src/middleware/authentication.ts',
  'src/middleware/rateLimiter.ts',
  'src/controllers/authController.ts',
  'src/integrations/plex/auth.ts'
];
```

### 12.3 Coverage Reporting

```bash
# Generate coverage reports
npm run test:coverage

# Coverage by directory
npm run test:coverage -- --coverage-directory-threshold=80

# Enforce coverage thresholds
npm run test:coverage -- --coverage-threshold-global=80
```

## 13. Monitoring & Reporting

### 13.1 Test Result Dashboard

```typescript
// scripts/generateTestReport.ts
import fs from 'fs';
import path from 'path';

interface TestMetrics {
  timestamp: string;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  skippedTests: number;
  coverage: {
    lines: number;
    branches: number;
    functions: number;
    statements: number;
  };
  performance: {
    averageTestTime: number;
    slowestTests: Array<{
      name: string;
      duration: number;
    }>;
  };
}

export function generateTestReport(): TestMetrics {
  // Read Jest results
  const jestResults = JSON.parse(
    fs.readFileSync('test-results/jest-results.json', 'utf8')
  );
  
  // Read coverage data
  const coverageData = JSON.parse(
    fs.readFileSync('coverage/coverage-summary.json', 'utf8')
  );
  
  const report: TestMetrics = {
    timestamp: new Date().toISOString(),
    totalTests: jestResults.numTotalTests,
    passedTests: jestResults.numPassedTests,
    failedTests: jestResults.numFailedTests,
    skippedTests: jestResults.numPendingTests,
    coverage: {
      lines: coverageData.total.lines.pct,
      branches: coverageData.total.branches.pct,
      functions: coverageData.total.functions.pct,
      statements: coverageData.total.statements.pct
    },
    performance: {
      averageTestTime: jestResults.testResults.reduce((sum, result) => 
        sum + result.perfStats.runtime, 0) / jestResults.testResults.length,
      slowestTests: jestResults.testResults
        .map(result => ({
          name: result.name,
          duration: result.perfStats.runtime
        }))
        .sort((a, b) => b.duration - a.duration)
        .slice(0, 10)
    }
  };
  
  // Write report
  fs.writeFileSync(
    'test-results/test-metrics.json',
    JSON.stringify(report, null, 2)
  );
  
  return report;
}
```

### 13.2 Continuous Monitoring

```typescript
// tests/monitoring/testMonitor.ts
export class TestMonitor {
  private static instance: TestMonitor;
  private metrics: Map<string, number[]> = new Map();
  
  static getInstance(): TestMonitor {
    if (!TestMonitor.instance) {
      TestMonitor.instance = new TestMonitor();
    }
    return TestMonitor.instance;
  }
  
  recordTestDuration(testName: string, duration: number) {
    if (!this.metrics.has(testName)) {
      this.metrics.set(testName, []);
    }
    this.metrics.get(testName)!.push(duration);
  }
  
  detectRegressions(): Array<{ testName: string; regression: number }> {
    const regressions = [];
    
    for (const [testName, durations] of this.metrics) {
      if (durations.length < 5) continue; // Need history
      
      const recent = durations.slice(-3).reduce((a, b) => a + b, 0) / 3;
      const baseline = durations.slice(0, -3).reduce((a, b) => a + b, 0) / (durations.length - 3);
      
      if (recent > baseline * 1.5) { // 50% slower
        regressions.push({
          testName,
          regression: (recent - baseline) / baseline
        });
      }
    }
    
    return regressions;
  }
}
```

## 14. Maintenance & Best Practices

### 14.1 Test Maintenance Guidelines

#### Regular Review Cycles
- **Weekly**: Review failing tests and flaky test reports
- **Monthly**: Update test data and mock responses
- **Quarterly**: Review test architecture and coverage goals

#### Test Debt Management
```typescript
// Mark tests that need attention
describe.skip('Legacy API Tests', () => {
  // TODO: Update after API refactor
  // DEBT: These tests use deprecated mock library
  // OWNER: @backend-team
});
```

#### Dependency Updates
```bash
# Update testing dependencies quarterly
npm update jest @testing-library/react @testing-library/jest-dom
npm update playwright cypress supertest

# Check for security vulnerabilities
npm audit
```

### 14.2 Common Anti-Patterns to Avoid

#### ❌ Don't Test Implementation Details
```typescript
// Bad: Testing internal state
expect(component.state.isLoading).toBe(true);

// Good: Testing behavior
expect(screen.getByText('Loading...')).toBeInTheDocument();
```

#### ❌ Don't Use Production Dependencies in Tests
```typescript
// Bad: Using real external services
const plexClient = new PlexClient('https://my-plex-server.com');

// Good: Using mocks
const mockPlexClient = createMockPlexClient();
```

#### ❌ Don't Write Overly Complex Tests
```typescript
// Bad: Testing multiple concerns
it('should handle complex user workflow', async () => {
  // 100 lines of test code testing everything
});

// Good: Focused, single-concern tests
it('should create user account', async () => { /* ... */ });
it('should send welcome email', async () => { /* ... */ });
it('should redirect to dashboard', async () => { /* ... */ });
```

### 14.3 Performance Optimization

#### Test Execution Optimization
```typescript
// jest.config.js
module.exports = {
  // Run tests in parallel
  maxWorkers: '50%',
  
  // Cache test results
  cache: true,
  cacheDirectory: './node_modules/.cache/jest',
  
  // Only test changed files in watch mode
  watchman: true,
  
  // Optimize test discovery
  testPathIgnorePatterns: ['/node_modules/', '/build/']
};
```

#### Mock Optimization
```typescript
// Reuse expensive mocks
const mockPlexClient = jest.fn();
beforeAll(() => {
  mockPlexClient.mockImplementation(() => ({
    getLibraries: jest.fn().mockResolvedValue(mockLibraries),
    searchMedia: jest.fn().mockResolvedValue(mockSearchResults)
  }));
});
```

### 14.4 Documentation Standards

#### Test Documentation Template
```typescript
/**
 * @fileoverview Tests for MediaService
 * @description Validates media request functionality including:
 * - Plex integration for existing content checks
 * - Overseerr integration for new requests
 * - Rate limiting enforcement
 * - Error handling and fallbacks
 * 
 * @requires Plex server mock
 * @requires Overseerr API mock
 * @requires Redis for rate limiting
 * 
 * @author Backend Team
 * @since 1.0.0
 */
```

#### Test Case Documentation
```typescript
describe('MediaService', () => {
  /**
   * Tests the primary use case where a user requests media
   * that doesn't exist in their Plex library.
   * 
   * Preconditions:
   * - User is authenticated
   * - Media is not in Plex library
   * - Overseerr is available
   * - User hasn't exceeded rate limits
   * 
   * Expected outcomes:
   * - Request submitted to Overseerr
   * - Database record created
   * - User receives confirmation
   */
  it('submits request for unavailable media', async () => {
    // Test implementation
  });
});
```

---

## Conclusion

This test architecture provides comprehensive coverage for MediaNest's complex technology stack, ensuring reliability, security, and performance at scale. The multi-layered approach combines unit testing for fast feedback, integration testing for service interactions, and end-to-end testing for user workflows.

Key success factors:
- **Fast feedback loops** with sub-30-second unit test execution
- **Reliable external service mocking** preventing flaky tests
- **Comprehensive security testing** for authentication and authorization
- **Performance monitoring** to catch regressions early
- **Automated CI/CD integration** for continuous quality assurance

This architecture supports MediaNest's goal of providing a reliable, secure media management platform while maintaining developer productivity and code quality standards.

**Document Version**: 1.0  
**Next Review**: February 2025  
**Maintainers**: Development Team