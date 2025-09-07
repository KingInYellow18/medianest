# MediaNest Testing Framework

**⚠️ Current Status: Development/Repair Phase - Test Failures Present**

The MediaNest Testing Framework provides comprehensive testing infrastructure including unit tests, integration tests, end-to-end tests, and performance testing. Currently experiencing significant test failures due to build issues.

## 🚨 Known Issues

- **Integration Tests**: 28/30 tests failing
- **Build Dependencies**: Cannot run tests due to TypeScript compilation errors
- **Test Data**: Database seeding and teardown issues
- **E2E Tests**: Playwright configuration problems
- **Coverage**: Limited test coverage due to build failures

## 📋 Purpose

The testing framework provides:

- **Unit Testing**: Component and service-level testing
- **Integration Testing**: API endpoint and database testing
- **End-to-End Testing**: Full user workflow testing
- **Performance Testing**: Load testing and benchmarking
- **Security Testing**: Vulnerability and penetration testing
- **Visual Testing**: UI regression and screenshot comparison

## 🏗️ Architecture

```
tests/
├── integration/         # Integration test suites
│   ├── auth/           # Authentication endpoint tests
│   ├── users/          # User management tests
│   ├── media/          # Media service tests
│   └── admin/          # Admin functionality tests
├── e2e/                # End-to-end test suites
│   ├── auth/           # Authentication flows
│   ├── dashboard/      # Dashboard interactions
│   ├── media/          # Media management workflows
│   └── admin/          # Administrative workflows
├── security/           # Security and penetration tests
│   ├── auth/           # Authentication security tests
│   ├── api/            # API security tests
│   └── injection/      # SQL/XSS injection tests
├── cypress/            # Cypress E2E tests
│   ├── fixtures/       # Test data
│   ├── integration/    # Test specifications
│   └── support/        # Helper functions
├── fixtures/           # Shared test data
├── setup.ts            # Test environment setup
└── setup-enhanced.ts   # Advanced test configuration
```

## 🧪 Testing Stack

### Unit & Integration Testing

- **Vitest**: Modern testing framework
- **Supertest**: HTTP endpoint testing
- **MSW**: API mocking
- **Testing Library**: Component testing
- **JSDOM**: DOM simulation

### End-to-End Testing

- **Playwright**: Cross-browser E2E testing
- **Cypress**: Interactive E2E testing
- **Visual Regression**: Screenshot comparison

### Performance Testing

- **Lighthouse**: Performance auditing
- **k6**: Load testing
- **Artillery**: API load testing

## 🚀 Getting Started

### Prerequisites

```bash
# Ensure backend and database are running
cd backend && npm run dev

# Database should be seeded with test data
npm run db:seed:test
```

### Running Tests (⚠️ Currently Failing)

```bash
# From project root
npm test                    # Run all tests (will fail)
npm run test:unit          # Unit tests only (limited)
npm run test:integration   # Integration tests (28/30 failing)
npm run test:e2e           # End-to-end tests (status unknown)

# Individual modules
cd backend && npm test     # Backend tests
cd frontend && npm test    # Frontend tests
cd shared && npm test      # Shared module tests
```

### Test Coverage

```bash
# Generate coverage report (limited due to build issues)
npm run test:coverage

# View coverage in browser
open coverage/index.html
```

## 🔧 Configuration

### Vitest Configuration

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'dist/', 'coverage/', '**/*.d.ts'],
    },
  },
});
```

### Playwright Configuration

```typescript
// playwright.config.ts
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],
});
```

## 🔐 Integration Tests

### Authentication Tests (Currently Failing)

```typescript
// tests/integration/auth/login.test.ts
describe('Authentication API', () => {
  describe('POST /api/auth/login', () => {
    it('should login with valid credentials', async () => {
      const response = await request(app).post('/api/auth/login').send({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(response.status).toBe(200);
      expect(response.body.data.accessToken).toBeDefined();
      expect(response.body.data.user.email).toBe('test@example.com');
    });

    it('should reject invalid credentials', async () => {
      const response = await request(app).post('/api/auth/login').send({
        email: 'test@example.com',
        password: 'wrongpassword',
      });

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
    });
  });
});
```

### Database Tests

```typescript
// tests/integration/database/users.test.ts
describe('User Repository', () => {
  beforeEach(async () => {
    await seedTestDatabase();
  });

  afterEach(async () => {
    await cleanTestDatabase();
  });

  it('should create user successfully', async () => {
    const userData = {
      email: 'newuser@example.com',
      password: 'hashedpassword',
      username: 'newuser',
    };

    const user = await userRepository.create(userData);

    expect(user.id).toBeDefined();
    expect(user.email).toBe(userData.email);
    expect(user.password).not.toBe(userData.password); // Should be hashed
  });
});
```

## 🎭 End-to-End Tests

### Authentication Flow

```typescript
// tests/e2e/auth/login.spec.ts
import { test, expect } from '@playwright/test';

test.describe('User Authentication', () => {
  test('should login and logout successfully', async ({ page }) => {
    await page.goto('/auth/signin');

    // Fill login form
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'password123');
    await page.click('[data-testid="login-button"]');

    // Should redirect to dashboard
    await expect(page).toHaveURL('/dashboard');
    await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();

    // Logout
    await page.click('[data-testid="user-menu"]');
    await page.click('[data-testid="logout-button"]');

    // Should redirect to login
    await expect(page).toHaveURL('/auth/signin');
  });
});
```

### Media Management

```typescript
// tests/e2e/media/library.spec.ts
test.describe('Media Library', () => {
  test('should browse media library', async ({ page }) => {
    await loginAsUser(page, 'test@example.com', 'password123');

    await page.goto('/media/libraries');

    // Should display libraries
    await expect(page.locator('[data-testid="library-grid"]')).toBeVisible();

    // Click on first library
    await page.click('[data-testid="library-card"]:first-child');

    // Should show library contents
    await expect(page.locator('[data-testid="media-grid"]')).toBeVisible();
  });
});
```

## 🛡️ Security Tests

### Authentication Security

```typescript
// tests/security/auth/brute-force.test.ts
describe('Brute Force Protection', () => {
  it('should block after 5 failed attempts', async () => {
    const email = 'test@example.com';

    // Make 5 failed login attempts
    for (let i = 0; i < 5; i++) {
      await request(app).post('/api/auth/login').send({ email, password: 'wrongpassword' });
    }

    // 6th attempt should be blocked
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email, password: 'wrongpassword' });

    expect(response.status).toBe(429);
    expect(response.body.error.code).toBe('TOO_MANY_REQUESTS');
  });
});
```

### SQL Injection Tests

```typescript
// tests/security/injection/sql.test.ts
describe('SQL Injection Protection', () => {
  it('should prevent SQL injection in user search', async () => {
    const maliciousQuery = "'; DROP TABLE users; --";

    const response = await request(app)
      .get('/api/users/search')
      .query({ q: maliciousQuery })
      .set('Authorization', `Bearer ${validToken}`);

    expect(response.status).not.toBe(500);
    // Database should still exist
    const users = await userRepository.findMany();
    expect(users).toBeDefined();
  });
});
```

## 📊 Performance Tests

### API Performance

```typescript
// tests/performance/api/endpoints.test.ts
describe('API Performance', () => {
  it('should respond within acceptable time limits', async () => {
    const start = Date.now();

    const response = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${validToken}`);

    const duration = Date.now() - start;

    expect(response.status).toBe(200);
    expect(duration).toBeLessThan(500); // Should respond within 500ms
  });
});
```

### Load Testing with k6

```javascript
// tests/performance/load/api-load.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
  stages: [
    { duration: '2m', target: 100 }, // Ramp up to 100 users
    { duration: '5m', target: 100 }, // Stay at 100 users
    { duration: '2m', target: 200 }, // Ramp up to 200 users
    { duration: '5m', target: 200 }, // Stay at 200 users
    { duration: '2m', target: 0 }, // Ramp down to 0 users
  ],
};

export default function () {
  let response = http.get('http://localhost:3001/api/health');
  check(response, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });
  sleep(1);
}
```

## 📝 Test Data Management

### Fixtures

```typescript
// tests/fixtures/users.ts
export const testUsers = [
  {
    id: '1',
    email: 'admin@example.com',
    username: 'admin',
    role: 'ADMIN',
    password: 'hashedpassword123',
  },
  {
    id: '2',
    email: 'user@example.com',
    username: 'user',
    role: 'USER',
    password: 'hashedpassword456',
  },
];

export const createTestUser = (overrides = {}) => ({
  email: 'test@example.com',
  username: 'testuser',
  role: 'USER',
  password: 'password123',
  ...overrides,
});
```

### Database Seeding

```typescript
// tests/setup.ts
export const seedTestDatabase = async () => {
  await prisma.user.createMany({
    data: testUsers,
  });

  await prisma.mediaLibrary.createMany({
    data: testLibraries,
  });
};

export const cleanTestDatabase = async () => {
  await prisma.user.deleteMany();
  await prisma.mediaLibrary.deleteMany();
  await prisma.session.deleteMany();
};
```

## 🔍 Visual Testing

### Screenshot Comparison

```typescript
// tests/e2e/visual/dashboard.spec.ts
test.describe('Visual Regression', () => {
  test('dashboard should match baseline', async ({ page }) => {
    await loginAsUser(page);
    await page.goto('/dashboard');

    // Wait for content to load
    await page.waitForSelector('[data-testid="dashboard-content"]');

    // Take screenshot and compare
    await expect(page).toHaveScreenshot('dashboard.png');
  });
});
```

## 🚨 Error Handling Tests

### Error Boundary Testing

```typescript
// tests/integration/errors/boundaries.test.ts
describe('Error Handling', () => {
  it('should handle database connection errors', async () => {
    // Simulate database failure
    await prisma.$disconnect();

    const response = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${validToken}`);

    expect(response.status).toBe(503);
    expect(response.body.error.code).toBe('SERVICE_UNAVAILABLE');
  });
});
```

## 📋 Test Reporting

### Coverage Reports

```bash
# Generate coverage report
npm run test:coverage

# View detailed coverage
open coverage/index.html
```

### CI/CD Integration

```yaml
# .github/workflows/test.yml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - run: npm run test:ci
      - uses: codecov/codecov-action@v3
```

## 🔗 Related Modules

- **[Backend](../backend/README.md)** - Express.js API server (testing target)
- **[Frontend](../frontend/README.md)** - Next.js React application (testing target)
- **[Shared](../shared/README.md)** - Common utilities (testing utilities)
- **[Infrastructure](../infrastructure/README.md)** - Test environment setup

## 📚 Testing Best Practices

### Test Organization

- **Arrange-Act-Assert**: Structure test cases clearly
- **Test Isolation**: Each test should be independent
- **Descriptive Names**: Test names should describe behavior
- **Single Responsibility**: One assertion per test when possible

### Mock Management

```typescript
// Mock external services
vi.mock('../services/plexService', () => ({
  getLibraries: vi.fn().mockResolvedValue(mockLibraries),
  getMediaItem: vi.fn().mockResolvedValue(mockMediaItem),
}));

// Reset mocks between tests
beforeEach(() => {
  vi.clearAllMocks();
});
```

## 🐛 Troubleshooting

### Common Test Issues

1. **Database Connection Errors**

   ```bash
   # Check test database
   npm run db:test:reset

   # Verify test database URL
   echo $DATABASE_TEST_URL
   ```

2. **Timeout Issues**

   ```typescript
   // Increase test timeout
   test(
     'slow operation',
     async () => {
       // Test implementation
     },
     { timeout: 10000 }
   );
   ```

3. **Async Test Problems**

   ```typescript
   // Proper async/await usage
   test('async operation', async () => {
     await expect(asyncOperation()).resolves.toBe(expectedValue);
   });
   ```

4. **Mock Issues**
   ```typescript
   // Ensure mocks are properly reset
   afterEach(() => {
     vi.restoreAllMocks();
   });
   ```

### Performance Issues

- Run tests in parallel: `--run --reporter=verbose`
- Use test database for better isolation
- Mock external services to reduce network calls
- Profile slow tests with `--reporter=verbose`

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/test-improvement`
3. Write tests for new features
4. Ensure all tests pass (once build issues are fixed)
5. Add test documentation
6. Follow testing best practices
7. Submit pull request with test results

### Testing Standards

- **Coverage**: Aim for >80% code coverage
- **Test Types**: Include unit, integration, and E2E tests
- **Performance**: Tests should run efficiently
- **Reliability**: Tests should be deterministic
- **Documentation**: Comment complex test scenarios

## 📄 License

MIT License - see [LICENSE](../LICENSE) file for details.
