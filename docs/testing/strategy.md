# Testing Strategy

MediaNest implements a comprehensive testing strategy with 80% coverage thresholds and automated quality gates as established by our validation framework.

!!! success "Testing Framework Status"
    Environment Health: 78% | Quality Gates: Established | Coverage Target: 80%

## 🎯 Testing Philosophy

### Test Pyramid Structure

```mermaid
graph TB
    subgraph "Testing Pyramid"
        A[E2E Tests<br/>5-10%<br/>High Value, Slow]
        B[Integration Tests<br/>20-30%<br/>Medium Value, Medium Speed]
        C[Unit Tests<br/>60-70%<br/>Fast, Comprehensive]
    end
    
    subgraph "Test Types"
        D[Component Tests]
        E[API Tests]
        F[Database Tests]
        G[Performance Tests]
        H[Security Tests]
        I[Accessibility Tests]
    end
    
    C --> D
    C --> E
    B --> F
    B --> G
    A --> H
    A --> I
```

### Quality Principles

1. **Fast Feedback Loop**: Unit tests run in < 30 seconds
2. **Reliable Tests**: Deterministic, no flaky tests
3. **Maintainable**: Clear test structure and naming
4. **Comprehensive Coverage**: 80% minimum across all workspaces
5. **Real-World Scenarios**: Tests reflect actual usage patterns

## 🧪 Testing Framework Stack

### Backend Testing (Vitest)

```typescript
// vitest.config.ts - Optimized configuration
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80
        }
      }
    }
  }
});
```

**Key Features:**
- **Vitest**: Fast, modern testing framework
- **80% Coverage Thresholds**: Enforced quality gates
- **Parallel Execution**: 4 threads maximum for performance
- **Mock Support**: vitest-mock-extended for complex mocking
- **Database Testing**: In-memory SQLite for fast tests

### Frontend Testing (Jest + React Testing Library)

```javascript
// jest.config.js - React-optimized setup
module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  }
};
```

**Key Features:**
- **Jest**: Industry-standard React testing
- **React Testing Library**: User-centric testing approach
- **jsdom**: DOM simulation for component testing
- **MSW**: Mock Service Worker for API mocking
- **a11y Testing**: Automated accessibility checks

### E2E Testing (Playwright)

```typescript
// playwright.config.ts - Full-stack testing
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  }
});
```

**Key Features:**
- **Cross-Browser Testing**: Chrome, Firefox, Safari
- **Visual Regression**: Screenshot comparisons
- **Mobile Testing**: Device simulation
- **Network Conditions**: Slow/fast network simulation
- **Authentication**: Persistent login state

## 📊 Test Organization

### Backend Test Structure

```
backend/tests/
├── unit/                    # Fast, isolated tests
│   ├── services/           # Business logic tests
│   ├── utils/              # Utility function tests
│   ├── middleware/         # Express middleware tests
│   └── models/             # Data model tests
├── integration/            # Database and API tests
│   ├── auth.test.ts        # Authentication flow
│   ├── media.test.ts       # Media management
│   ├── queue.test.ts       # Queue processing
│   └── health.test.ts      # Health endpoints
├── e2e/                    # End-to-end scenarios
│   ├── user-journey.test.ts # Complete user flows
│   ├── admin-workflow.test.ts # Admin functionality
│   └── api-integration.test.ts # Full API testing
├── fixtures/               # Test data
│   ├── users.ts           # Sample user data
│   ├── media.ts           # Sample media data
│   └── requests.ts        # Sample request data
├── helpers/               # Test utilities
│   ├── database.ts        # DB test helpers
│   ├── auth.ts            # Auth test helpers
│   └── api.ts             # API test helpers
└── setup.ts               # Global test setup
```

### Frontend Test Structure

```
frontend/tests/
├── components/             # Component unit tests
│   ├── ui/                # UI component tests
│   ├── youtube/           # YouTube feature tests
│   └── common/            # Shared component tests
├── hooks/                 # Custom hook tests
│   ├── useAuth.test.ts    # Authentication hook
│   ├── useQueue.test.ts   # Queue management hook
│   └── useMedia.test.ts   # Media handling hook
├── pages/                 # Page-level tests
│   ├── login.test.ts      # Login page
│   ├── dashboard.test.ts  # Dashboard page
│   └── queue.test.ts      # Queue page
├── utils/                 # Utility function tests
├── integration/           # Component integration
│   ├── auth-flow.test.ts  # Complete auth flow
│   └── media-request.test.ts # Media request flow
├── e2e/                   # Full application tests
│   ├── user-journey.test.ts # Complete user scenarios
│   └── admin-tasks.test.ts # Administrative tasks
├── fixtures/              # Test data and mocks
└── setup.ts               # Test environment setup
```

### Shared Package Tests

```
shared/tests/
├── types/                 # Type validation tests
├── schemas/               # Zod schema tests
├── utils/                 # Shared utility tests
└── integration/           # Cross-package tests
```

## 🔧 Testing Patterns and Best Practices

### Unit Testing Patterns

#### Service Layer Testing

```typescript
// Example: MediaService unit test
describe('MediaService', () => {
  let mediaService: MediaService;
  let mockMediaRepo: MockProxy<MediaRepository>;
  let mockOverseerrService: MockProxy<OverseerrService>;

  beforeEach(() => {
    mockMediaRepo = mock<MediaRepository>();
    mockOverseerrService = mock<OverseerrService>();
    mediaService = new MediaService(mockMediaRepo, mockOverseerrService);
  });

  describe('requestMedia', () => {
    it('should create media request successfully', async () => {
      // Arrange
      const userId = 'user-123';
      const mediaId = 'media-456';
      const expectedRequest = { id: 'req-789', userId, mediaId, status: 'pending' };

      mockOverseerrService.createRequest.mockResolvedValue({ id: 'overseerr-123' });
      mockMediaRepo.createRequest.mockResolvedValue(expectedRequest);

      // Act
      const result = await mediaService.requestMedia(userId, mediaId);

      // Assert
      expect(result).toEqual(expectedRequest);
      expect(mockOverseerrService.createRequest).toHaveBeenCalledWith(mediaId);
      expect(mockMediaRepo.createRequest).toHaveBeenCalledWith({ userId, mediaId });
    });

    it('should handle Overseerr API failure gracefully', async () => {
      // Arrange
      mockOverseerrService.createRequest.mockRejectedValue(new Error('API Error'));

      // Act & Assert
      await expect(mediaService.requestMedia('user-123', 'media-456'))
        .rejects.toThrow('Failed to create media request');
    });
  });
});
```

#### Component Testing

```typescript
// Example: React component test
describe('DownloadCard', () => {
  const mockDownload = {
    id: '1',
    title: 'Test Video',
    progress: 50,
    status: 'downloading' as const,
    estimatedTime: 300
  };

  it('should display download progress correctly', () => {
    render(<DownloadCard download={mockDownload} />);
    
    expect(screen.getByText('Test Video')).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '50');
  });

  it('should call onCancel when cancel button is clicked', async () => {
    const mockOnCancel = vi.fn();
    render(<DownloadCard download={mockDownload} onCancel={mockOnCancel} />);
    
    const cancelButton = screen.getByLabelText('Cancel download');
    await user.click(cancelButton);
    
    expect(mockOnCancel).toHaveBeenCalledWith('1');
  });

  it('should be accessible to screen readers', async () => {
    render(<DownloadCard download={mockDownload} />);
    
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
```

### Integration Testing Patterns

#### API Integration Tests

```typescript
// Example: Auth API integration test
describe('Authentication API', () => {
  let app: Express;
  let testDb: TestDatabase;

  beforeAll(async () => {
    testDb = await createTestDatabase();
    app = createApp({ database: testDb });
  });

  afterAll(async () => {
    await testDb.cleanup();
  });

  describe('POST /auth/login', () => {
    it('should authenticate user with valid Plex credentials', async () => {
      // Arrange
      const mockPlexUser = { id: '123', username: 'testuser' };
      mockPlexAuth.mockResolvedValue(mockPlexUser);

      // Act
      const response = await request(app)
        .post('/auth/login')
        .send({ plexToken: 'valid-token' })
        .expect(200);

      // Assert
      expect(response.body).toMatchObject({
        user: { id: expect.any(String), username: 'testuser' },
        token: expect.any(String)
      });
      
      // Verify JWT token
      const decoded = jwt.verify(response.body.token, process.env.JWT_SECRET!);
      expect(decoded).toMatchObject({ userId: expect.any(String) });
    });

    it('should reject invalid Plex credentials', async () => {
      // Arrange
      mockPlexAuth.mockRejectedValue(new Error('Invalid token'));

      // Act & Assert
      await request(app)
        .post('/auth/login')
        .send({ plexToken: 'invalid-token' })
        .expect(401)
        .expect((res) => {
          expect(res.body.error).toBe('Invalid Plex credentials');
        });
    });
  });
});
```

#### Database Integration Tests

```typescript
// Example: Database operation test
describe('UserRepository', () => {
  let userRepo: UserRepository;
  let testDb: TestDatabase;

  beforeEach(async () => {
    testDb = await createTestDatabase();
    userRepo = new UserRepository(testDb.client);
  });

  afterEach(async () => {
    await testDb.cleanup();
  });

  describe('createUser', () => {
    it('should create user with encrypted password', async () => {
      // Arrange
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'plaintext-password'
      };

      // Act
      const user = await userRepo.createUser(userData);

      // Assert
      expect(user).toMatchObject({
        id: expect.any(String),
        username: 'testuser',
        email: 'test@example.com'
      });
      expect(user.password).not.toBe('plaintext-password');
      
      // Verify password encryption
      const isValidPassword = await bcrypt.compare('plaintext-password', user.password);
      expect(isValidPassword).toBe(true);
    });
  });
});
```

### E2E Testing Patterns

#### User Journey Tests

```typescript
// Example: Complete user flow test
test.describe('Media Request Flow', () => {
  test('user can search and request media', async ({ page }) => {
    // Setup: Login as regular user
    await page.goto('/login');
    await page.fill('[data-testid=username]', 'testuser');
    await page.fill('[data-testid=password]', 'testpass');
    await page.click('[data-testid=login-button]');
    
    // Wait for dashboard
    await expect(page.locator('[data-testid=dashboard]')).toBeVisible();

    // Navigate to search
    await page.click('[data-testid=search-link]');
    await expect(page).toHaveURL('/search');

    // Search for media
    await page.fill('[data-testid=search-input]', 'Inception');
    await page.click('[data-testid=search-button]');
    
    // Wait for results
    await expect(page.locator('[data-testid=search-results]')).toBeVisible();
    
    // Request first result
    await page.click('[data-testid=request-button]:first-child');
    
    // Verify request modal
    await expect(page.locator('[data-testid=request-modal]')).toBeVisible();
    await page.fill('[data-testid=request-notes]', 'Please add this movie');
    await page.click('[data-testid=submit-request]');
    
    // Verify success
    await expect(page.locator('[data-testid=success-message]')).toBeVisible();
    await expect(page.locator('[data-testid=success-message]'))
      .toContainText('Request submitted successfully');
  });
});
```

## 📋 Test Data Management

### Fixtures and Factories

```typescript
// User factory for consistent test data
export const userFactory = {
  build: (overrides: Partial<User> = {}): User => ({
    id: faker.string.uuid(),
    username: faker.internet.userName(),
    email: faker.internet.email(),
    role: 'user',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  }),

  buildMany: (count: number, overrides: Partial<User> = {}): User[] =>
    Array.from({ length: count }, () => userFactory.build(overrides))
};

// Media request factory
export const mediaRequestFactory = {
  build: (overrides: Partial<MediaRequest> = {}): MediaRequest => ({
    id: faker.string.uuid(),
    userId: faker.string.uuid(),
    mediaId: faker.string.uuid(),
    title: faker.lorem.words(3),
    type: faker.helpers.arrayElement(['movie', 'tv']),
    status: 'pending',
    requestedAt: new Date(),
    ...overrides
  })
};
```

### Database Seeding

```typescript
// Test database seeder
export class TestDataSeeder {
  constructor(private db: PrismaClient) {}

  async seedBasicData(): Promise<TestData> {
    const admin = await this.db.user.create({
      data: userFactory.build({ role: 'admin' })
    });

    const users = await Promise.all(
      userFactory.buildMany(5).map(user => 
        this.db.user.create({ data: user })
      )
    );

    const requests = await Promise.all(
      mediaRequestFactory.buildMany(10, { userId: users[0].id }).map(request =>
        this.db.mediaRequest.create({ data: request })
      )
    );

    return { admin, users, requests };
  }

  async cleanup(): Promise<void> {
    await this.db.mediaRequest.deleteMany();
    await this.db.user.deleteMany();
  }
}
```

## 🎛️ Test Configuration

### Environment-Specific Configs

#### Development Testing

```bash
# .env.test
NODE_ENV=test
DATABASE_URL="postgresql://test:test@localhost:5432/medianest_test"
REDIS_URL="redis://localhost:6379/1"
JWT_SECRET="test-jwt-secret"
LOG_LEVEL="error"
```

#### CI/CD Testing

```yaml
# GitHub Actions test configuration
name: Test Suite
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      redis:
        image: redis:7
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - run: npm ci
      - run: npm run test:coverage
      - run: npm run test:e2e
      
      - name: Upload coverage reports
        uses: codecov/codecov-action@v3
```

## 📊 Coverage and Quality Gates

### Coverage Requirements

| Test Type | Coverage Target | Enforcement |
|-----------|----------------|-------------|
| **Unit Tests** | 85% | Strict |
| **Integration Tests** | 80% | Strict |
| **E2E Tests** | N/A (Behavior-based) | Quality-based |
| **Overall** | 80% | Build-blocking |

### Quality Metrics

```typescript
// Quality gates configuration
export const qualityGates = {
  coverage: {
    lines: 80,
    functions: 80,
    branches: 80,
    statements: 80
  },
  performance: {
    maxTestDuration: 30000, // 30 seconds
    maxSuiteParallelism: 4
  },
  reliability: {
    maxFlakeRate: 0.05, // 5% flake tolerance
    retryAttempts: 2
  }
};
```

### Continuous Monitoring

```bash
# Test performance monitoring
npm run test:perf          # Performance benchmarks
npm run test:memory        # Memory usage tracking
npm run test:flake-detect  # Flaky test detection
npm run test:coverage-trend # Coverage trend analysis
```

## 🚀 Running Tests

### Local Development

```bash
# Run all tests
npm test

# Run tests by workspace
npm run test:backend
npm run test:frontend
npm run test:shared

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch

# Run specific test files
npm test -- auth.test.ts
npm test -- --grep "MediaService"

# Run E2E tests
npm run test:e2e

# Run performance tests
npm run test:performance
```

### CI/CD Pipeline

```bash
# Full test suite for CI
npm run test:ci

# Parallel test execution
npm run test:parallel

# Test result reporting
npm run test:report

# Coverage reporting
npm run coverage:report
```

## 🔧 Debugging Tests

### Debug Configuration

```json
// .vscode/launch.json - Test debugging
{
  "name": "Debug Tests",
  "type": "node",
  "request": "launch",
  "program": "${workspaceFolder}/node_modules/.bin/vitest",
  "args": ["run", "--reporter=verbose"],
  "console": "integratedTerminal",
  "internalConsoleOptions": "neverOpen"
}
```

### Common Debugging Patterns

```typescript
// Debug test with detailed logging
test('debug example', async () => {
  console.log('Test start');
  
  const result = await someAsyncFunction();
  console.log('Result:', result);
  
  expect(result).toBeDefined();
  console.log('Test complete');
});

// Debug with test-specific timeouts
test('slow operation', async () => {
  // Increase timeout for debugging
  vi.setConfig({ testTimeout: 60000 });
  
  const result = await slowOperation();
  expect(result).toBeTruthy();
}, 60000);
```

---

**Next**: [Unit Testing Guide](unit-tests.md) →