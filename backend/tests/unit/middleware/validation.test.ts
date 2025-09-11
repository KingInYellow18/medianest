import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { validate } from '@/middleware/validation';
import { z } from 'zod';

// ✅ ENVIRONMENT SETUP (before imports)
beforeAll(() => {
  process.env.JWT_SECRET = 'test-jwt-secret-key-32-bytes-long';
  process.env.ENCRYPTION_KEY = 'test-encryption-key-32-bytes-long';
  process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';
  process.env.REDIS_URL = 'redis://localhost:6379';
  process.env.NODE_ENV = 'test';
});

afterAll(() => {
  // Clean up test environment variables
  delete process.env.JWT_SECRET;
  delete process.env.ENCRYPTION_KEY;
  delete process.env.DATABASE_URL;
  delete process.env.REDIS_URL;
});

// Simplified Stateless Mock Pattern for Perfect Test Isolation
class IsolatedValidationMocks {
  public logger: any;

  constructor() {
    this.reset();
  }

  reset() {
    // Create completely fresh mocks with no shared state
    this.logger = {
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    };
  }

  // Comprehensive cleanup to prevent cross-test contamination
  cleanup() {
    // Reset all mock functions and their call history
    Object.values(this.logger).forEach((fn: any) => {
      if (typeof fn?.mockReset === 'function') fn.mockReset();
      if (typeof fn?.mockClear === 'function') fn.mockClear();
    });
  }
}

// Global mock instance with proper isolation
let isolatedMocks: IsolatedValidationMocks;

// Mock dependencies with proper isolation
vi.mock('@/utils/logger', () => ({
  logger: new Proxy({}, {
    get: (target, prop) => {
      return isolatedMocks?.logger?.[prop] || vi.fn();
    }
  }),
}));

describe('Validation Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(async () => {
    // CRITICAL: Complete test isolation for each test
    
    // 1. Create completely fresh isolated mocks - no shared state
    isolatedMocks = new IsolatedValidationMocks();
    
    // 2. AGGRESSIVE mock clearing to prevent cross-test contamination
    vi.clearAllMocks();
    vi.resetAllMocks();
    vi.restoreAllMocks();
    
    // 3. Set up fresh request/response mocks
    mockRequest = {
      body: {},
      query: {},
      params: {},
    };
    mockResponse = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    mockNext = vi.fn();
    
    // 4. Allow a small delay for mock setup to complete
    await new Promise(resolve => setTimeout(resolve, 1));
  });

  afterEach(() => {
    // Comprehensive cleanup to prevent cross-test contamination
    isolatedMocks?.cleanup();
    vi.restoreAllMocks();
  });

  describe('body validation', () => {
    it('should pass validation with valid body data', async () => {
      const schema = z.object({
        name: z.string(),
        email: z.string().email(),
        age: z.number().min(0),
      });

      mockRequest.body = {
        name: 'John Doe',
        email: 'john@example.com',
        age: 30,
      };

      const middleware = validate({ body: schema });
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should fail validation with invalid body data', async () => {
      const schema = z.object({
        name: z.string(),
        email: z.string().email(),
        age: z.number().min(0),
      });

      mockRequest.body = {
        name: '',
        email: 'invalid-email',
        age: -5,
      };

      const middleware = validate({ body: schema });
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: expect.any(Array),
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle missing required fields', async () => {
      const schema = z.object({
        name: z.string(),
        email: z.string().email(),
      });

      mockRequest.body = {
        name: 'John',
        // email is missing
      };

      const middleware = validate({ body: schema });
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'VALIDATION_ERROR',
          details: expect.arrayContaining([
            expect.objectContaining({
              field: 'email',
              message: 'Required',
            }),
          ]),
        })
      );
    });

    it('should handle nested object validation', async () => {
      const schema = z.object({
        user: z.object({
          name: z.string(),
          profile: z.object({
            age: z.number(),
            bio: z.string().optional(),
          }),
        }),
      });

      mockRequest.body = {
        user: {
          name: 'John',
          profile: {
            age: 30,
            bio: 'Developer',
          },
        },
      };

      const middleware = validate({ body: schema });
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should handle array validation', async () => {
      const schema = z.object({
        items: z.array(z.object({
          id: z.string(),
          quantity: z.number().min(1),
        })),
      });

      mockRequest.body = {
        items: [
          { id: 'item-1', quantity: 5 },
          { id: 'item-2', quantity: 3 },
        ],
      };

      const middleware = validate({ body: schema });
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });
  });

  describe('query validation', () => {
    it('should pass validation with valid query parameters', async () => {
      const schema = z.object({
        page: z.string().transform(Number).pipe(z.number().min(1)),
        limit: z.string().transform(Number).pipe(z.number().min(1).max(100)),
        search: z.string().optional(),
      });

      mockRequest.query = {
        page: '1',
        limit: '10',
        search: 'test',
      };

      const middleware = validate({ query: schema });
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should fail validation with invalid query parameters', async () => {
      const schema = z.object({
        page: z.string().transform(Number).pipe(z.number().min(1)),
        limit: z.string().transform(Number).pipe(z.number().min(1).max(100)),
      });

      mockRequest.query = {
        page: 'invalid',
        limit: '200',
      };

      const middleware = validate({ query: schema });
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle boolean query parameters', async () => {
      const schema = z.object({
        active: z.string().transform(val => val === 'true').pipe(z.boolean()),
        includeDeleted: z.string().transform(val => val === 'true').pipe(z.boolean()).optional(),
      });

      mockRequest.query = {
        active: 'true',
        includeDeleted: 'false',
      };

      const middleware = validate({ query: schema });
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });
  });

  describe('params validation', () => {
    it('should pass validation with valid route parameters', async () => {
      const schema = z.object({
        id: z.string().uuid(),
        type: z.enum(['user', 'admin', 'guest']),
      });

      mockRequest.params = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        type: 'user',
      };

      const middleware = validate({ params: schema });
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should fail validation with invalid route parameters', async () => {
      const schema = z.object({
        id: z.string().uuid(),
        type: z.enum(['user', 'admin', 'guest']),
      });

      mockRequest.params = {
        id: 'invalid-uuid',
        type: 'invalid-type',
      };

      const middleware = validate({ params: schema });
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle numeric route parameters', async () => {
      const schema = z.object({
        page: z.string().transform(Number).pipe(z.number().min(1)),
        userId: z.string().transform(Number).pipe(z.number()),
      });

      mockRequest.params = {
        page: '5',
        userId: '123',
      };

      const middleware = validate({ params: schema });
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });
  });

  describe('combined validation', () => {
    it('should validate all parts when multiple schemas provided', async () => {
      const bodySchema = z.object({
        name: z.string(),
      });

      const querySchema = z.object({
        filter: z.string().optional(),
      });

      const paramsSchema = z.object({
        id: z.string().uuid(),
      });

      mockRequest.body = { name: 'Test' };
      mockRequest.query = { filter: 'active' };
      mockRequest.params = { id: '550e8400-e29b-41d4-a716-446655440000' };

      const middleware = validate({
        body: bodySchema,
        query: querySchema,
        params: paramsSchema,
      });

      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should fail if any part fails validation', async () => {
      const bodySchema = z.object({
        name: z.string(),
      });

      const paramsSchema = z.object({
        id: z.string().uuid(),
      });

      mockRequest.body = { name: 'Test' };
      mockRequest.params = { id: 'invalid-uuid' };

      const middleware = validate({
        body: bodySchema,
        params: paramsSchema,
      });

      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should handle unexpected validation errors', async () => {
      const schema = z.object({
        name: z.string(),
      });

      // Mock a schema that throws an unexpected error
      const mockSchema = {
        safeParse: vi.fn().mockImplementation(() => {
          throw new Error('Unexpected error');
        }),
      };

      mockRequest.body = { name: 'Test' };

      const middleware = validate({ body: mockSchema as any });
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'INTERNAL_ERROR',
        message: 'Validation processing failed',
      });
    });

    it('should format validation errors correctly', async () => {
      const schema = z.object({
        email: z.string().email(),
        age: z.number().min(0).max(120),
        preferences: z.object({
          notifications: z.boolean(),
        }),
      });

      mockRequest.body = {
        email: 'invalid-email',
        age: -5,
        preferences: {
          notifications: 'not-boolean',
        },
      };

      const middleware = validate({ body: schema });
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      const responseCall = mockResponse.json as any;
      expect(responseCall).toBeDefined();
      expect(responseCall.mock).toBeDefined();
      expect(responseCall.mock.calls).toBeDefined();
      expect(responseCall.mock.calls[0]).toBeDefined();
      const response = responseCall.mock.calls[0][0];

      expect(response.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'email',
            message: expect.stringContaining('email'),
          }),
          expect.objectContaining({
            field: 'age',
            message: expect.stringContaining('greater than or equal to 0'),
          }),
        ])
      );
    });

    it('should handle empty request objects', async () => {
      const schema = z.object({
        name: z.string(),
      });

      mockRequest.body = undefined;

      const middleware = validate({ body: schema });
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      // Verify the response status was called
      expect(mockResponse.status).toHaveBeenCalled();
      if (mockResponse.status) {
        const statusCall = (mockResponse.status as any).mock.calls[0];
        expect(statusCall).toBeDefined();
        expect(statusCall[0]).toBe(400);
      }
    });

    it('should handle null request objects', async () => {
      const schema = z.object({
        name: z.string(),
      });

      mockRequest.body = null;

      const middleware = validate({ body: schema });
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
    });
  });

  describe('transformation', () => {
    it('should transform and coerce data types', async () => {
      const schema = z.object({
        age: z.string().transform(Number).pipe(z.number()),
        active: z.string().transform(val => val === 'true').pipe(z.boolean()),
        tags: z.string().transform(val => val.split(',')),
      });

      mockRequest.query = {
        age: '25',
        active: 'true',
        tags: 'tag1,tag2,tag3',
      };

      const middleware = validate({ query: schema });
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect(mockRequest.query).toEqual({
        age: 25,
        active: true,
        tags: ['tag1', 'tag2', 'tag3'],
      });
    });

    it('should handle transformation errors', async () => {
      const schema = z.object({
        date: z.string().transform(val => {
          const date = new Date(val);
          if (isNaN(date.getTime())) {
            throw new Error('Invalid date');
          }
          return date;
        }),
      });

      mockRequest.body = {
        date: 'invalid-date',
      };

      const middleware = validate({ body: schema });
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
    });
  });

  describe('optional validation', () => {
    it('should handle optional fields correctly', async () => {
      const schema = z.object({
        name: z.string(),
        email: z.string().email().optional(),
        age: z.number().optional(),
      });

      mockRequest.body = {
        name: 'John',
        // email and age are optional and missing
      };

      const middleware = validate({ body: schema });
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should validate optional fields when provided', async () => {
      const schema = z.object({
        name: z.string(),
        email: z.string().email().optional(),
      });

      mockRequest.body = {
        name: 'John',
        email: 'invalid-email',
      };

      const middleware = validate({ body: schema });
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
    });
  });
});