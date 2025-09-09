# MediaNest Test Templates & Development Standards

## Test Template Library

### Controller Test Template

```typescript
/**
 * Template: Controller Test Suite
 * Usage: Copy and customize for each controller
 * Coverage Target: 80%+ per controller
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import { app } from '@/app';
import { testDb } from '@/test-utils/test-database';

describe('[ControllerName] Controller', () => {
  beforeEach(async () => {
    await testDb.clean();
    await testDb.seed();
  });

  afterEach(async () => {
    vi.clearAllMocks();
  });

  describe('Happy Path Tests', () => {
    test('should handle valid request successfully', async () => {
      const response = await request(app)
        .post('/api/v1/endpoint')
        .send({ validData: 'test' })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: expect.any(Object)
      });
    });

    test('should return correct response format', async () => {
      const response = await request(app)
        .get('/api/v1/endpoint')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid input gracefully', async () => {
      const response = await request(app)
        .post('/api/v1/endpoint')
        .send({ invalidData: null })
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.any(String),
        code: expect.any(String)
      });
    });

    test('should handle server errors', async () => {
      // Mock service to throw error
      vi.spyOn(mockService, 'method').mockRejectedValue(new Error('Server error'));

      const response = await request(app)
        .post('/api/v1/endpoint')
        .send({ data: 'test' })
        .expect(500);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Security Tests', () => {
    test('should require authentication', async () => {
      const response = await request(app)
        .post('/api/v1/protected-endpoint')
        .send({ data: 'test' })
        .expect(401);

      expect(response.body.error).toContain('authentication');
    });

    test('should validate authorization', async () => {
      const token = generateTestToken({ role: 'user' });
      
      const response = await request(app)
        .post('/api/v1/admin-endpoint')
        .set('Authorization', `Bearer ${token}`)
        .send({ data: 'test' })
        .expect(403);

      expect(response.body.error).toContain('authorization');
    });

    test('should sanitize input data', async () => {
      const maliciousInput = { data: '<script>alert("xss")</script>' };
      
      const response = await request(app)
        .post('/api/v1/endpoint')
        .send(maliciousInput)
        .expect(400);

      expect(response.body.error).toContain('validation');
    });
  });

  describe('Edge Cases', () => {
    test('should handle boundary values', async () => {
      const edgeCases = [
        { value: '' },
        { value: 'a'.repeat(10000) },
        { value: null },
        { value: undefined }
      ];

      for (const testCase of edgeCases) {
        const response = await request(app)
          .post('/api/v1/endpoint')
          .send(testCase);

        expect([200, 400]).toContain(response.status);
      }
    });

    test('should handle concurrent requests', async () => {
      const requests = Array(10).fill(null).map(() =>
        request(app)
          .post('/api/v1/endpoint')
          .send({ data: 'concurrent test' })
      );

      const responses = await Promise.all(requests);
      
      responses.forEach(response => {
        expect([200, 201]).toContain(response.status);
      });
    });
  });

  describe('Performance Tests', () => {
    test('should respond within acceptable time', async () => {
      const start = Date.now();
      
      await request(app)
        .get('/api/v1/endpoint')
        .expect(200);

      const responseTime = Date.now() - start;
      expect(responseTime).toBeLessThan(1000); // 1 second max
    });
  });
});
```

### Service Test Template

```typescript
/**
 * Template: Service Test Suite
 * Usage: Copy and customize for each service
 * Coverage Target: 75%+ per service
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { [ServiceName]Service } from '@/services/[service-name].service';
import { mockRepository } from '@/test-utils/mocks';

describe('[ServiceName] Service', () => {
  let service: [ServiceName]Service;

  beforeEach(() => {
    service = new [ServiceName]Service();
    vi.clearAllMocks();
  });

  describe('Core Functionality', () => {
    test('should perform primary operation correctly', async () => {
      const input = { validInput: 'test' };
      const expectedOutput = { result: 'expected' };
      
      mockRepository.method.mockResolvedValue(expectedOutput);

      const result = await service.primaryMethod(input);

      expect(result).toEqual(expectedOutput);
      expect(mockRepository.method).toHaveBeenCalledWith(input);
    });

    test('should handle business logic validation', async () => {
      const input = { businessData: 'test' };
      
      const result = await service.businessMethod(input);

      expect(result).toBeDefined();
      expect(result).toHaveProperty('processed', true);
    });
  });

  describe('Error Handling', () => {
    test('should handle repository errors gracefully', async () => {
      mockRepository.method.mockRejectedValue(new Error('Database error'));

      await expect(service.primaryMethod({})).rejects.toThrow('Service error');
    });

    test('should validate input parameters', async () => {
      const invalidInputs = [null, undefined, {}, ''];

      for (const input of invalidInputs) {
        await expect(service.primaryMethod(input)).rejects.toThrow();
      }
    });
  });

  describe('Data Transformation', () => {
    test('should transform data correctly', () => {
      const rawData = { raw: 'input', extra: 'field' };
      const expectedTransformed = { processed: 'input' };

      const result = service.transformData(rawData);

      expect(result).toEqual(expectedTransformed);
    });

    test('should handle empty data', () => {
      const result = service.transformData({});
      
      expect(result).toBeDefined();
      expect(Object.keys(result)).toHaveLength(0);
    });
  });

  describe('Integration Points', () => {
    test('should integrate with external services', async () => {
      const mockExternalService = vi.fn().mockResolvedValue({ success: true });
      service.externalService = mockExternalService;

      await service.externalOperation();

      expect(mockExternalService).toHaveBeenCalled();
    });
  });

  describe('Performance & Optimization', () => {
    test('should cache results appropriately', async () => {
      const input = { cacheable: true };
      
      await service.cacheableMethod(input);
      await service.cacheableMethod(input); // Second call

      expect(mockRepository.method).toHaveBeenCalledTimes(1);
    });
  });
});
```

### Middleware Test Template

```typescript
/**
 * Template: Middleware Test Suite
 * Usage: Copy and customize for each middleware
 * Coverage Target: 70%+ per middleware
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { [MiddlewareName] } from '@/middleware/[middleware-name]';

describe('[MiddlewareName] Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = {
      headers: {},
      body: {},
      params: {},
      query: {}
    };
    
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      setHeader: vi.fn().mockReturnThis()
    };
    
    mockNext = vi.fn();
  });

  describe('Valid Requests', () => {
    test('should process valid request and call next', async () => {
      mockReq.headers = { authorization: 'Bearer valid-token' };

      await middlewareFunction(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    test('should add required data to request object', async () => {
      await middlewareFunction(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq).toHaveProperty('customProperty');
      expect(mockNext).toHaveBeenCalledWith();
    });
  });

  describe('Error Cases', () => {
    test('should handle missing required headers', async () => {
      await middlewareFunction(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockNext).not.toHaveBeenCalled();
    });

    test('should handle invalid data format', async () => {
      mockReq.body = { invalid: 'format' };

      await middlewareFunction(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('Security Validation', () => {
    test('should reject malicious inputs', async () => {
      mockReq.body = { script: '<script>alert("xss")</script>' };

      await middlewareFunction(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockNext).not.toHaveBeenCalled();
    });
  });
});
```

## Test Utilities & Helpers

### Database Test Utilities

```typescript
/**
 * Test Database Utilities
 * File: src/test-utils/test-database.ts
 */

import { PrismaClient } from '@prisma/client';

export class TestDatabase {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.TEST_DATABASE_URL
        }
      }
    });
  }

  async clean(): Promise<void> {
    const tablenames = await this.prisma.$queryRaw<Array<{ tablename: string }>>`
      SELECT tablename FROM pg_tables WHERE schemaname='public'
    `;

    for (const { tablename } of tablenames) {
      if (tablename !== '_prisma_migrations') {
        await this.prisma.$executeRawUnsafe(`TRUNCATE TABLE "public"."${tablename}" CASCADE;`);
      }
    }
  }

  async seed(): Promise<void> {
    // Add test data seeding logic
    await this.prisma.user.createMany({
      data: [
        { email: 'test@example.com', password: 'hashedPassword', role: 'USER' },
        { email: 'admin@example.com', password: 'hashedPassword', role: 'ADMIN' }
      ]
    });
  }

  async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
  }
}

export const testDb = new TestDatabase();
```

### Mock Factories

```typescript
/**
 * Mock Data Factories
 * File: src/test-utils/mock-factories.ts
 */

export const createMockUser = (overrides = {}) => ({
  id: 'test-user-id',
  email: 'test@example.com',
  role: 'USER',
  plexId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides
});

export const createMockMediaRequest = (overrides = {}) => ({
  id: 'test-request-id',
  title: 'Test Movie',
  type: 'MOVIE',
  status: 'PENDING',
  userId: 'test-user-id',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides
});

export const createMockJwtPayload = (overrides = {}) => ({
  userId: 'test-user-id',
  email: 'test@example.com',
  role: 'USER',
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 3600,
  ...overrides
});
```

### Test Configuration

```typescript
/**
 * Test Setup Configuration
 * File: tests/setup-enhanced.ts
 */

import { beforeAll, afterAll, beforeEach } from 'vitest';
import { testDb } from '@/test-utils/test-database';

beforeAll(async () => {
  // Global test setup
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-jwt-secret';
  process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/medianest_test';
});

afterAll(async () => {
  // Global test cleanup
  await testDb.disconnect();
});

beforeEach(async () => {
  // Reset state before each test
  await testDb.clean();
});
```

## Test Standards & Best Practices

### Naming Conventions

```typescript
// ✅ GOOD: Descriptive test names
test('should create media request with valid user authentication', async () => {});
test('should reject invalid JWT token with 401 error', async () => {});
test('should handle database connection failure gracefully', async () => {});

// ❌ BAD: Vague test names  
test('should work', async () => {});
test('test media', async () => {});
test('error case', async () => {});
```

### Assertion Patterns

```typescript
// ✅ GOOD: Specific assertions
expect(response.body).toMatchObject({
  success: true,
  data: expect.objectContaining({
    id: expect.any(String),
    createdAt: expect.any(String)
  })
});

// ✅ GOOD: Error validation
expect(() => service.validateInput(null)).toThrow('Input is required');
expect(error).toBeInstanceOf(ValidationError);
expect(error.message).toContain('validation failed');

// ❌ BAD: Vague assertions
expect(result).toBeTruthy();
expect(error).toBeDefined();
```

### Mock Management

```typescript
// ✅ GOOD: Controlled mocking
const mockService = {
  findById: vi.fn(),
  create: vi.fn(),
  update: vi.fn()
};

beforeEach(() => {
  vi.clearAllMocks();
  mockService.findById.mockResolvedValue(createMockUser());
});

// ✅ GOOD: Verify mock calls
expect(mockService.findById).toHaveBeenCalledWith('user-id');
expect(mockService.findById).toHaveBeenCalledTimes(1);
```

## Coverage Thresholds

### Per-Component Targets

```json
{
  "coverageThreshold": {
    "global": {
      "branches": 65,
      "functions": 70,
      "lines": 65,
      "statements": 65
    },
    "src/controllers/": {
      "branches": 80,
      "functions": 85,
      "lines": 80,
      "statements": 80
    },
    "src/services/": {
      "branches": 75,
      "functions": 80,
      "lines": 75,
      "statements": 75
    },
    "src/middleware/": {
      "branches": 70,
      "functions": 75,
      "lines": 70,
      "statements": 70
    }
  }
}
```

## Test Execution Strategy

### Parallel Execution

```bash
# Run tests in parallel for maximum efficiency
npm run test:unit -- --reporter=verbose --pool=threads
npm run test:integration -- --reporter=json --pool=forks
npm run test:e2e -- --reporter=html
```

### CI/CD Integration

```yaml
# .github/workflows/test-coverage.yml
test-coverage:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v3
    - name: Run comprehensive tests
      run: |
        npm run test:coverage
        npm run test:integration
        npm run test:security
    - name: Upload coverage reports
      uses: codecov/codecov-action@v3
      with:
        files: ./coverage/coverage-final.json
```

This comprehensive template library provides the foundation for rapid test development while maintaining high quality standards.