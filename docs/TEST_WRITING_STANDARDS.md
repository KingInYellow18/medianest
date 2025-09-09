# Test Writing Standards and Patterns

## Overview
This document establishes standards, patterns, and best practices for writing tests in the MediaNest project. Following these guidelines ensures consistency, maintainability, and reliability across the test suite.

## General Testing Principles

### 1. Test Structure (AAA Pattern)
All tests should follow the Arrange-Act-Assert pattern:

```typescript
describe('UserService', () => {
  it('should create a new user with valid data', async () => {
    // Arrange - Setup test data and dependencies
    const userData = { email: 'test@example.com', name: 'Test User' };
    const mockRepository = vi.mocked(userRepository);
    mockRepository.create.mockResolvedValue({ id: 1, ...userData });
    
    // Act - Execute the functionality being tested
    const result = await userService.createUser(userData);
    
    // Assert - Verify the expected outcome
    expect(result).toEqual({ id: 1, ...userData });
    expect(mockRepository.create).toHaveBeenCalledWith(userData);
  });
});
```

### 2. Test Naming Conventions
- **Describe blocks**: Use the class/function/component name being tested
- **Test cases**: Use "should [expected behavior] when [condition]"
- **Variables**: Use descriptive names that indicate their purpose in the test

```typescript
describe('AuthenticationController', () => {
  describe('login', () => {
    it('should return JWT token when credentials are valid', () => {});
    it('should throw UnauthorizedError when credentials are invalid', () => {});
    it('should lock account when too many failed attempts', () => {});
  });
});
```

### 3. Test Independence
- Each test should be completely independent
- Tests should not depend on the execution order
- Use proper setup and teardown for each test

```typescript
beforeEach(() => {
  vi.clearAllMocks();
  // Reset any global state
});

afterEach(() => {
  vi.clearAllTimers();
  // Clean up any test artifacts
});
```

## Backend Testing Patterns

### 1. Unit Tests for Services

```typescript
// backend/tests/unit/services/user.service.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UserService } from '@/services/user.service';
import { UserRepository } from '@/repositories/user.repository';

vi.mock('@/repositories/user.repository');

describe('UserService', () => {
  let userService: UserService;
  let mockUserRepository: ReturnType<typeof vi.mocked<UserRepository>>;

  beforeEach(() => {
    mockUserRepository = vi.mocked(UserRepository);
    userService = new UserService(mockUserRepository);
  });

  describe('findByEmail', () => {
    it('should return user when email exists', async () => {
      // Arrange
      const email = 'test@example.com';
      const expectedUser = { id: 1, email, name: 'Test User' };
      mockUserRepository.findByEmail.mockResolvedValue(expectedUser);

      // Act
      const result = await userService.findByEmail(email);

      // Assert
      expect(result).toEqual(expectedUser);
      expect(mockUserRepository.findByEmail).toHaveBeenCalledWith(email);
    });

    it('should throw NotFoundError when email does not exist', async () => {
      // Arrange
      const email = 'nonexistent@example.com';
      mockUserRepository.findByEmail.mockResolvedValue(null);

      // Act & Assert
      await expect(userService.findByEmail(email)).rejects.toThrow(NotFoundError);
    });
  });
});
```

### 2. Integration Tests for Controllers

```typescript
// backend/tests/integration/controllers/user.controller.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '@/app';
import { setupTestDatabase, cleanupTestDatabase } from '@/tests/helpers/database';

describe('UserController Integration', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await cleanupTestDatabase();
  });

  describe('GET /api/users', () => {
    it('should return paginated users list', async () => {
      // Arrange
      const authToken = await getAuthToken(); // Test helper
      
      // Act
      const response = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ page: 1, limit: 10 });

      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        data: expect.any(Array),
        pagination: {
          page: 1,
          limit: 10,
          total: expect.any(Number)
        }
      });
    });

    it('should require authentication', async () => {
      // Act
      const response = await request(app).get('/api/users');

      // Assert
      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Unauthorized');
    });
  });
});
```

### 3. Database Testing Patterns

```typescript
// backend/tests/integration/repositories/user.repository.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { UserRepository } from '@/repositories/user.repository';
import { getTestDatabase } from '@/tests/helpers/database';

describe('UserRepository', () => {
  let userRepository: UserRepository;
  let testDb: any;

  beforeEach(async () => {
    testDb = await getTestDatabase();
    userRepository = new UserRepository(testDb);
    
    // Clear test data
    await testDb.user.deleteMany();
  });

  afterEach(async () => {
    await testDb.user.deleteMany();
  });

  describe('create', () => {
    it('should create user with hashed password', async () => {
      // Arrange
      const userData = {
        email: 'test@example.com',
        name: 'Test User',
        password: 'plaintext-password'
      };

      // Act
      const createdUser = await userRepository.create(userData);

      // Assert
      expect(createdUser.id).toBeDefined();
      expect(createdUser.email).toBe(userData.email);
      expect(createdUser.password).not.toBe(userData.password); // Should be hashed
      expect(createdUser.createdAt).toBeInstanceOf(Date);
    });
  });
});
```

## Frontend Testing Patterns

### 1. Component Unit Tests

```typescript
// frontend/tests/components/UserProfile.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { UserProfile } from '@/components/UserProfile';
import { useUser } from '@/hooks/useUser';

vi.mock('@/hooks/useUser');

describe('UserProfile', () => {
  const mockUseUser = vi.mocked(useUser);

  beforeEach(() => {
    mockUseUser.mockReturnValue({
      user: { id: 1, name: 'Test User', email: 'test@example.com' },
      loading: false,
      error: null,
      updateUser: vi.fn(),
    });
  });

  it('should display user information', () => {
    // Arrange & Act
    render(<UserProfile />);

    // Assert
    expect(screen.getByText('Test User')).toBeInTheDocument();
    expect(screen.getByText('test@example.com')).toBeInTheDocument();
  });

  it('should show loading state while fetching user', () => {
    // Arrange
    mockUseUser.mockReturnValue({
      user: null,
      loading: true,
      error: null,
      updateUser: vi.fn(),
    });

    // Act
    render(<UserProfile />);

    // Assert
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('should handle user update', async () => {
    // Arrange
    const mockUpdateUser = vi.fn();
    mockUseUser.mockReturnValue({
      user: { id: 1, name: 'Test User', email: 'test@example.com' },
      loading: false,
      error: null,
      updateUser: mockUpdateUser,
    });

    render(<UserProfile />);

    // Act
    const nameInput = screen.getByLabelText('Name');
    fireEvent.change(nameInput, { target: { value: 'Updated Name' } });
    fireEvent.click(screen.getByText('Save'));

    // Assert
    await waitFor(() => {
      expect(mockUpdateUser).toHaveBeenCalledWith({
        id: 1,
        name: 'Updated Name',
        email: 'test@example.com'
      });
    });
  });
});
```

### 2. Hook Testing

```typescript
// frontend/tests/hooks/useUser.test.ts
import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useUser } from '@/hooks/useUser';
import { userService } from '@/services/userService';

vi.mock('@/services/userService');

describe('useUser', () => {
  const mockUserService = vi.mocked(userService);

  it('should fetch user data on mount', async () => {
    // Arrange
    const mockUser = { id: 1, name: 'Test User', email: 'test@example.com' };
    mockUserService.getCurrentUser.mockResolvedValue(mockUser);

    // Act
    const { result } = renderHook(() => useUser());

    // Assert
    expect(result.current.loading).toBe(true);
    
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.user).toEqual(mockUser);
    });
  });
});
```

## E2E Testing Patterns

### 1. Playwright E2E Tests

```typescript
// backend/tests/e2e/user-workflow.spec.ts
import { test, expect } from '@playwright/test';

test.describe('User Management Workflow', () => {
  test.beforeEach(async ({ page }) => {
    // Setup: Login as admin
    await page.goto('/login');
    await page.fill('[data-testid="email"]', 'admin@example.com');
    await page.fill('[data-testid="password"]', 'admin-password');
    await page.click('[data-testid="submit"]');
    await expect(page).toHaveURL('/dashboard');
  });

  test('should create and manage user account', async ({ page }) => {
    // Navigate to user management
    await page.click('[data-testid="users-menu"]');
    await expect(page).toHaveURL('/users');

    // Create new user
    await page.click('[data-testid="create-user"]');
    await page.fill('[data-testid="user-name"]', 'New User');
    await page.fill('[data-testid="user-email"]', 'newuser@example.com');
    await page.click('[data-testid="save-user"]');

    // Verify user creation
    await expect(page.locator('[data-testid="user-list"]')).toContainText('New User');
    await expect(page.locator('[data-testid="success-message"]')).toContainText('User created successfully');

    // Edit user
    await page.click('[data-testid="edit-user-newuser@example.com"]');
    await page.fill('[data-testid="user-name"]', 'Updated User Name');
    await page.click('[data-testid="save-user"]');

    // Verify user update
    await expect(page.locator('[data-testid="user-list"]')).toContainText('Updated User Name');
  });
});
```

## Testing Utilities and Helpers

### 1. Database Test Helpers

```typescript
// backend/tests/helpers/database.ts
import { PrismaClient } from '@prisma/client';

let testDb: PrismaClient;

export async function setupTestDatabase(): Promise<PrismaClient> {
  testDb = new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_TEST_URL
      }
    }
  });

  await testDb.$connect();
  return testDb;
}

export async function cleanupTestDatabase(): Promise<void> {
  if (testDb) {
    await testDb.$disconnect();
  }
}

export function getTestDatabase(): PrismaClient {
  return testDb;
}
```

### 2. Authentication Test Helpers

```typescript
// backend/tests/helpers/auth.ts
import jwt from 'jsonwebtoken';
import { UserRole } from '@/types/user';

export function createTestJWT(userId: number, role: UserRole = 'user'): string {
  return jwt.sign(
    { userId, role },
    process.env.JWT_SECRET || 'test-secret',
    { expiresIn: '1h' }
  );
}

export async function getAuthToken(role: UserRole = 'user'): Promise<string> {
  const testUser = await createTestUser({ role });
  return createTestJWT(testUser.id, role);
}
```

### 3. API Test Helpers

```typescript
// backend/tests/helpers/api.ts
import request from 'supertest';
import { app } from '@/app';

export class APITestClient {
  private authToken?: string;

  setAuth(token: string) {
    this.authToken = token;
    return this;
  }

  get(path: string) {
    const req = request(app).get(path);
    if (this.authToken) {
      req.set('Authorization', `Bearer ${this.authToken}`);
    }
    return req;
  }

  post(path: string, data?: any) {
    const req = request(app).post(path);
    if (this.authToken) {
      req.set('Authorization', `Bearer ${this.authToken}`);
    }
    if (data) {
      req.send(data);
    }
    return req;
  }
}
```

## Mock Patterns and Standards

### 1. Service Mocking

```typescript
// Comprehensive service mock
const mockUserService = {
  findById: vi.fn(),
  findByEmail: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  authenticate: vi.fn(),
} satisfies Partial<UserService>;
```

### 2. External API Mocking (MSW)

```typescript
// backend/tests/mocks/plex-api.ts
import { http, HttpResponse } from 'msw';

export const plexHandlers = [
  http.get('https://plex.tv/api/v2/user', () => {
    return HttpResponse.json({
      id: 12345,
      username: 'testuser',
      email: 'test@plex.tv'
    });
  }),

  http.post('https://plex.tv/api/v2/pins', () => {
    return HttpResponse.json({
      id: 67890,
      code: 'TEST123',
      expires_at: new Date(Date.now() + 600000).toISOString()
    });
  })
];
```

## Error Testing Patterns

### 1. Exception Testing

```typescript
describe('Error Handling', () => {
  it('should throw ValidationError for invalid input', async () => {
    // Arrange
    const invalidData = { email: 'invalid-email' };

    // Act & Assert
    await expect(userService.create(invalidData))
      .rejects.toThrow(ValidationError);
  });

  it('should handle database connection errors gracefully', async () => {
    // Arrange
    mockDatabase.user.create.mockRejectedValue(new Error('Connection failed'));

    // Act & Assert
    await expect(userService.create(validUserData))
      .rejects.toThrow('Database operation failed');
  });
});
```

### 2. Async Error Testing

```typescript
describe('Async Operations', () => {
  it('should timeout after specified duration', async () => {
    // Arrange
    const slowOperation = vi.fn().mockImplementation(() => 
      new Promise(resolve => setTimeout(resolve, 2000))
    );

    // Act & Assert
    await expect(Promise.race([
      slowOperation(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), 1000)
      )
    ])).rejects.toThrow('Timeout');
  });
});
```

## Performance Testing Guidelines

### 1. Load Testing Patterns

```typescript
// backend/tests/performance/api-load.test.ts
import { describe, it, expect } from 'vitest';

describe('API Performance', () => {
  it('should handle 100 concurrent requests', async () => {
    const requests = Array.from({ length: 100 }, () => 
      request(app).get('/api/health')
    );

    const startTime = Date.now();
    const responses = await Promise.all(requests);
    const duration = Date.now() - startTime;

    // Assert all requests succeeded
    responses.forEach(response => {
      expect(response.status).toBe(200);
    });

    // Assert performance criteria
    expect(duration).toBeLessThan(5000); // 5 seconds
  });
});
```

## Best Practices Summary

### DO:
- Use descriptive test names
- Follow the AAA pattern
- Mock external dependencies
- Test error conditions
- Use test helpers and utilities
- Maintain test independence
- Clean up after tests

### DON'T:
- Test implementation details
- Create interdependent tests
- Use real databases in unit tests
- Hardcode test data unnecessarily
- Skip error testing
- Leave tests disabled long-term
- Ignore test performance

### Code Quality Standards:
- **Test Coverage**: Maintain minimum thresholds (70% backend, 60% frontend)
- **Performance**: Tests should complete within reasonable time limits
- **Maintainability**: Tests should be easy to understand and modify
- **Reliability**: Tests should be stable and not flaky
- **Documentation**: Complex test logic should be commented

This document serves as the authoritative guide for test writing in the MediaNest project. For specific framework documentation, refer to the official Vitest, Playwright, and React Testing Library documentation.