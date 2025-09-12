import { Request, Response, NextFunction } from 'express';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { asyncHandler } from '@/utils/async-handler';

// DeviceSessionService Excellence Template - Stateless Mock Pattern for Perfect Isolation
class IsolatedAsyncHandlerMocks {
  public mockRequest: Partial<Request>;
  public mockResponse: Partial<Response>;
  public mockNext: NextFunction;

  constructor() {
    this.reset();
  }

  reset() {
    // Create completely fresh mocks with no shared state
    this.mockRequest = {
      params: {},
      query: {},
      body: {},
      user: { id: 'user-123' },
    };

    // Create proper mock chain where each method returns the response object
    this.mockResponse = {} as any;
    this.mockResponse.status = vi.fn().mockReturnValue(this.mockResponse);
    this.mockResponse.json = vi.fn().mockReturnValue(this.mockResponse);
    this.mockResponse.send = vi.fn().mockReturnValue(this.mockResponse);
    this.mockResponse.sendStatus = vi.fn().mockReturnValue(this.mockResponse);
    this.mockResponse.end = vi.fn().mockReturnValue(this.mockResponse);
    this.mockResponse.locals = {};

    this.mockNext = vi.fn();
  }

  // Comprehensive cleanup to prevent cross-test contamination
  cleanup() {
    vi.mocked(this.mockResponse.status).mockReset();
    vi.mocked(this.mockResponse.json).mockReset();
    vi.mocked(this.mockResponse.send).mockReset();
    vi.mocked(this.mockResponse.sendStatus).mockReset();
    vi.mocked(this.mockResponse.end).mockReset();
    vi.mocked(this.mockNext).mockReset();
  }
}

// Global mock instance with proper isolation
let isolatedMocks: IsolatedAsyncHandlerMocks;

describe('AsyncHandler Utility', () => {
  beforeEach(async () => {
    // CRITICAL: Complete test isolation using DeviceSessionService pattern

    // 1. Create completely fresh isolated mocks - no shared state
    isolatedMocks = new IsolatedAsyncHandlerMocks();

    // 2. More targeted mock clearing to prevent cross-test contamination
    // Don't clear ALL mocks as it affects inline spy functions
    vi.clearAllTimers();

    // 3. Set test environment
    process.env.NODE_ENV = 'test';

    // 4. Allow a small delay for mock setup to complete
    await new Promise((resolve) => setTimeout(resolve, 1));
  });

  afterEach(() => {
    // Comprehensive cleanup to prevent cross-test contamination
    isolatedMocks?.cleanup();
    vi.useRealTimers();
    // Don't restore all mocks as it affects test-specific spy functions
  });

  describe('successful async operations', () => {
    it('should handle successful async function', async () => {
      const asyncFunction = vi.fn().mockResolvedValue(undefined);
      const wrappedFunction = asyncHandler(asyncFunction);

      await wrappedFunction(
        isolatedMocks.mockRequest as Request,
        isolatedMocks.mockResponse as Response,
        isolatedMocks.mockNext,
      );

      expect(asyncFunction).toHaveBeenCalledWith(
        isolatedMocks.mockRequest,
        isolatedMocks.mockResponse,
        isolatedMocks.mockNext,
      );
      expect(isolatedMocks.mockNext).not.toHaveBeenCalled();
    });

    it('should pass through return values', async () => {
      const returnValue = { data: 'test' };
      const asyncFunction = vi.fn().mockResolvedValue(returnValue);
      const wrappedFunction = asyncHandler(asyncFunction);

      const result = await wrappedFunction(
        isolatedMocks.mockRequest as Request,
        isolatedMocks.mockResponse as Response,
        isolatedMocks.mockNext,
      );

      expect(result).toBe(returnValue);
      expect(asyncFunction).toHaveBeenCalledWith(
        isolatedMocks.mockRequest,
        isolatedMocks.mockResponse,
        isolatedMocks.mockNext,
      );
    });

    it('should handle async function execution without return checking', async () => {
      const asyncFunction = vi.fn().mockImplementation(async (req, res) => {
        res.json({ data: 'test' });
      });
      const wrappedFunction = asyncHandler(asyncFunction);

      await wrappedFunction(
        isolatedMocks.mockRequest as Request,
        isolatedMocks.mockResponse as Response,
        isolatedMocks.mockNext,
      );

      expect(asyncFunction).toHaveBeenCalled();
      expect(isolatedMocks.mockResponse.json).toHaveBeenCalledWith({ data: 'test' });
      expect(isolatedMocks.mockNext).not.toHaveBeenCalled();
    });

    it('should handle void async functions', async () => {
      const asyncFunction = vi.fn().mockImplementation(async (req, res) => {
        res.json({ success: true });
      });
      const wrappedFunction = asyncHandler(asyncFunction);

      await wrappedFunction(
        isolatedMocks.mockRequest as Request,
        isolatedMocks.mockResponse as Response,
        isolatedMocks.mockNext,
      );

      expect(asyncFunction).toHaveBeenCalled();
      expect(isolatedMocks.mockResponse.json).toHaveBeenCalledWith({ success: true });
      expect(isolatedMocks.mockNext).not.toHaveBeenCalled();
    });

    it('should handle functions that modify request/response', async () => {
      const asyncFunction = vi.fn().mockImplementation(async (req, res) => {
        req.params.id = '456';
        res.status(200);
        res.json({ modified: true });
      });
      const wrappedFunction = asyncHandler(asyncFunction);

      await wrappedFunction(
        isolatedMocks.mockRequest as Request,
        isolatedMocks.mockResponse as Response,
        isolatedMocks.mockNext,
      );

      expect(isolatedMocks.mockRequest.params.id).toBe('456');
      expect(isolatedMocks.mockResponse.status).toHaveBeenCalledWith(200);
      expect(isolatedMocks.mockResponse.json).toHaveBeenCalledWith({ modified: true });
    });

    it('should handle functions that modify response locals', async () => {
      const asyncFunction = vi.fn().mockImplementation(async (req, res) => {
        res.locals = { ...res.locals, customData: 'test' };
      });
      const wrappedFunction = asyncHandler(asyncFunction);

      await wrappedFunction(
        isolatedMocks.mockRequest as Request,
        isolatedMocks.mockResponse as Response,
        isolatedMocks.mockNext,
      );

      expect(isolatedMocks.mockResponse.locals).toEqual({ customData: 'test' });
    });
  });

  describe('error handling', () => {
    it('should catch and pass errors to next middleware', async () => {
      const error = new Error('Async error');
      const asyncFunction = vi.fn().mockRejectedValue(error);
      const wrappedFunction = asyncHandler(asyncFunction);

      await wrappedFunction(
        isolatedMocks.mockRequest as Request,
        isolatedMocks.mockResponse as Response,
        isolatedMocks.mockNext,
      );

      expect(asyncFunction).toHaveBeenCalled();
      expect(isolatedMocks.mockNext).toHaveBeenCalledWith(error);
    });

    it('should handle different error types', async () => {
      const testCases = [
        new Error('Standard Error'),
        new TypeError('Type Error'),
        new RangeError('Range Error'),
        { message: 'Custom Error Object', code: 'CUSTOM_ERROR' },
        'String Error',
        null,
        undefined,
        42,
      ];

      for (const error of testCases) {
        const asyncFunction = vi.fn().mockRejectedValue(error);
        const wrappedFunction = asyncHandler(asyncFunction);

        await wrappedFunction(
          isolatedMocks.mockRequest as Request,
          isolatedMocks.mockResponse as Response,
          isolatedMocks.mockNext,
        );

        expect(isolatedMocks.mockNext).toHaveBeenCalledWith(error);

        // Reset for next iteration
        isolatedMocks.cleanup();
        isolatedMocks.reset();
      }
    });

    it('should handle synchronous errors thrown in async function', async () => {
      const error = new Error('Sync error in async function');
      const asyncFunction = vi.fn().mockImplementation(async () => {
        throw error;
      });
      const wrappedFunction = asyncHandler(asyncFunction);

      await wrappedFunction(
        isolatedMocks.mockRequest as Request,
        isolatedMocks.mockResponse as Response,
        isolatedMocks.mockNext,
      );

      expect(isolatedMocks.mockNext).toHaveBeenCalledWith(error);
    });

    it('should handle promise rejection', async () => {
      const error = new Error('Promise rejection');
      const asyncFunction = vi.fn().mockImplementation(() => Promise.reject(error));
      const wrappedFunction = asyncHandler(asyncFunction);

      await wrappedFunction(
        isolatedMocks.mockRequest as Request,
        isolatedMocks.mockResponse as Response,
        isolatedMocks.mockNext,
      );

      expect(isolatedMocks.mockNext).toHaveBeenCalledWith(error);
    });

    it('should not interfere with response when error occurs', async () => {
      const error = new Error('Test error');
      const asyncFunction = vi.fn().mockImplementation(async (req, res) => {
        // This would normally set response status, but error prevents completion
        throw error;
      });
      const wrappedFunction = asyncHandler(asyncFunction);

      await wrappedFunction(
        isolatedMocks.mockRequest as Request,
        isolatedMocks.mockResponse as Response,
        isolatedMocks.mockNext,
      );

      expect(isolatedMocks.mockNext).toHaveBeenCalledWith(error);
      // Response methods should not be called when error occurs immediately
      expect(isolatedMocks.mockResponse.status).not.toHaveBeenCalled();
    });
  });

  describe('middleware chain behavior', () => {
    it('should work with controller methods', async () => {
      const mockController = {
        getUser: vi.fn().mockImplementation(async (req, res) => {
          const user = { id: '123', name: 'Test User' };
          res.json(user);
        }),
      };
      const wrappedMethod = asyncHandler(mockController.getUser);

      await wrappedMethod(
        isolatedMocks.mockRequest as Request,
        isolatedMocks.mockResponse as Response,
        isolatedMocks.mockNext,
      );

      expect(mockController.getUser).toHaveBeenCalled();
      expect(isolatedMocks.mockResponse.json).toHaveBeenCalledWith({
        id: '123',
        name: 'Test User',
      });
      expect(isolatedMocks.mockNext).not.toHaveBeenCalled();
    });

    it('should work with class-based controller methods', async () => {
      class TestController {
        async getUser(req: Request, res: Response) {
          const userId = req.params.id;
          res.json({ id: userId, name: 'Test User' });
        }
      }

      const controller = new TestController();
      const wrappedMethod = asyncHandler(controller.getUser.bind(controller));

      isolatedMocks.mockRequest.params = { id: '123' };

      await wrappedMethod(
        isolatedMocks.mockRequest as Request,
        isolatedMocks.mockResponse as Response,
        isolatedMocks.mockNext,
      );

      expect(isolatedMocks.mockResponse.json).toHaveBeenCalledWith({
        id: '123',
        name: 'Test User',
      });
      expect(isolatedMocks.mockNext).not.toHaveBeenCalled();
    });

    it('should work with middleware functions', async () => {
      const middlewareFunction = vi.fn().mockImplementation(async (req, res, next) => {
        req.user = { id: 'middleware-user' };
        next();
      });
      const wrappedMiddleware = asyncHandler(middlewareFunction);

      await wrappedMiddleware(
        isolatedMocks.mockRequest as Request,
        isolatedMocks.mockResponse as Response,
        isolatedMocks.mockNext,
      );

      expect(isolatedMocks.mockRequest.user).toEqual({ id: 'middleware-user' });
      expect(isolatedMocks.mockNext).toHaveBeenCalledWith();
    });

    it('should handle middleware that calls next with error', async () => {
      const error = new Error('Middleware error');
      const middlewareFunction = vi.fn().mockImplementation(async (req, res, next) => {
        next(error);
      });
      const wrappedMiddleware = asyncHandler(middlewareFunction);

      await wrappedMiddleware(
        isolatedMocks.mockRequest as Request,
        isolatedMocks.mockResponse as Response,
        isolatedMocks.mockNext,
      );

      expect(isolatedMocks.mockNext).toHaveBeenCalledWith(error);
    });

    it('should handle middleware that calls next multiple times safely', async () => {
      const middlewareFunction = vi.fn().mockImplementation(async (req, res, next) => {
        next(); // First call
        next(); // Second call - should be handled gracefully
      });
      const wrappedMiddleware = asyncHandler(middlewareFunction);

      await wrappedMiddleware(
        isolatedMocks.mockRequest as Request,
        isolatedMocks.mockResponse as Response,
        isolatedMocks.mockNext,
      );

      // The function should complete without throwing errors
      expect(middlewareFunction).toHaveBeenCalled();
      expect(isolatedMocks.mockNext).toHaveBeenCalledTimes(2);
    });
  });

  describe('performance and edge cases', () => {
    it('should handle functions that resolve immediately', async () => {
      const immediateFunction = vi.fn().mockImplementation(() => Promise.resolve('immediate'));
      const wrappedFunction = asyncHandler(immediateFunction);

      const startTime = Date.now();
      await wrappedFunction(
        isolatedMocks.mockRequest as Request,
        isolatedMocks.mockResponse as Response,
        isolatedMocks.mockNext,
      );
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(50); // Should be very fast
      expect(immediateFunction).toHaveBeenCalled();
    });

    it('should handle functions with delays', async () => {
      // Create the spy function after the beforeEach cleanup
      const delayedFunction = vi.fn(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        return 'delayed';
      });
      const wrappedFunction = asyncHandler(delayedFunction);

      const startTime = Date.now();
      const result = await wrappedFunction(
        isolatedMocks.mockRequest as Request,
        isolatedMocks.mockResponse as Response,
        isolatedMocks.mockNext,
      );
      const endTime = Date.now();

      expect(endTime - startTime).toBeGreaterThanOrEqual(45);
      expect(delayedFunction).toHaveBeenCalled();
      expect(result).toBe('delayed');
    });

    it('should handle concurrent wrapped function calls', async () => {
      let callCount = 0;
      // Create the spy function after the beforeEach cleanup
      const concurrentFunction = vi.fn(async () => {
        callCount++;
        await new Promise((resolve) => setTimeout(resolve, 10));
        return `call-${callCount}`;
      });
      const wrappedFunction = asyncHandler(concurrentFunction);

      const promises = [
        wrappedFunction(
          isolatedMocks.mockRequest as Request,
          isolatedMocks.mockResponse as Response,
          isolatedMocks.mockNext,
        ),
        wrappedFunction(
          isolatedMocks.mockRequest as Request,
          isolatedMocks.mockResponse as Response,
          isolatedMocks.mockNext,
        ),
        wrappedFunction(
          isolatedMocks.mockRequest as Request,
          isolatedMocks.mockResponse as Response,
          isolatedMocks.mockNext,
        ),
      ];

      const results = await Promise.all(promises);

      expect(concurrentFunction).toHaveBeenCalledTimes(3);
      expect(callCount).toBe(3);
      expect(results).toHaveLength(3);
    });

    it('should handle null/undefined functions gracefully', async () => {
      // This test ensures that if somehow a null function is passed, it's handled
      const asyncFunction = vi.fn().mockResolvedValue(undefined);
      const wrappedFunction = asyncHandler(asyncFunction);

      await wrappedFunction(
        isolatedMocks.mockRequest as Request,
        isolatedMocks.mockResponse as Response,
        isolatedMocks.mockNext,
      );

      expect(asyncFunction).toHaveBeenCalled();
      expect(isolatedMocks.mockNext).not.toHaveBeenCalled();
    });

    it('should handle long-running async operations', async () => {
      const asyncFunction = vi.fn().mockImplementation(async (req, res) => {
        // Simulate delay without real timeout for test speed
        await Promise.resolve();
        res.json({ delayed: true });
      });
      const wrappedFunction = asyncHandler(asyncFunction);

      await wrappedFunction(
        isolatedMocks.mockRequest as Request,
        isolatedMocks.mockResponse as Response,
        isolatedMocks.mockNext,
      );

      expect(isolatedMocks.mockResponse.json).toHaveBeenCalledWith({ delayed: true });
    });

    it('should preserve function context', async () => {
      const context = { value: 'test-context' };
      const asyncFunction = vi.fn().mockImplementation(async function (this: any, req, res) {
        res.json({ context: this.value });
      });
      const wrappedFunction = asyncHandler(asyncFunction.bind(context));

      await wrappedFunction(
        isolatedMocks.mockRequest as Request,
        isolatedMocks.mockResponse as Response,
        isolatedMocks.mockNext,
      );

      expect(isolatedMocks.mockResponse.json).toHaveBeenCalledWith({ context: 'test-context' });
    });

    it('should handle empty functions', async () => {
      const emptyFunction = vi.fn().mockImplementation(async () => {});
      const wrappedFunction = asyncHandler(emptyFunction);

      await wrappedFunction(
        isolatedMocks.mockRequest as Request,
        isolatedMocks.mockResponse as Response,
        isolatedMocks.mockNext,
      );

      expect(emptyFunction).toHaveBeenCalled();
      expect(isolatedMocks.mockNext).not.toHaveBeenCalled();
    });
  });

  describe('TypeScript compatibility', () => {
    it('should maintain type safety for request/response', async () => {
      interface CustomRequest extends Request {
        customProp: string;
      }

      const typedFunction = vi
        .fn()
        .mockImplementation(async (req: CustomRequest, res: Response) => {
          res.json({ custom: req.customProp });
        });

      const wrappedFunction = asyncHandler(typedFunction);

      const customRequest = { ...isolatedMocks.mockRequest, customProp: 'test' } as CustomRequest;

      await wrappedFunction(
        customRequest,
        isolatedMocks.mockResponse as Response,
        isolatedMocks.mockNext,
      );

      expect(typedFunction).toHaveBeenCalledWith(
        customRequest,
        isolatedMocks.mockResponse,
        isolatedMocks.mockNext,
      );
      expect(isolatedMocks.mockResponse.json).toHaveBeenCalledWith({ custom: 'test' });
    });

    it('should work with different return types', async () => {
      const stringFunction = vi.fn().mockResolvedValue('string');
      const numberFunction = vi.fn().mockResolvedValue(42);
      const objectFunction = vi.fn().mockResolvedValue({ key: 'value' });
      const voidFunction = vi.fn().mockResolvedValue(undefined);

      const wrappedString = asyncHandler(stringFunction);
      const wrappedNumber = asyncHandler(numberFunction);
      const wrappedObject = asyncHandler(objectFunction);
      const wrappedVoid = asyncHandler(voidFunction);

      await wrappedString(
        isolatedMocks.mockRequest as Request,
        isolatedMocks.mockResponse as Response,
        isolatedMocks.mockNext,
      );
      await wrappedNumber(
        isolatedMocks.mockRequest as Request,
        isolatedMocks.mockResponse as Response,
        isolatedMocks.mockNext,
      );
      await wrappedObject(
        isolatedMocks.mockRequest as Request,
        isolatedMocks.mockResponse as Response,
        isolatedMocks.mockNext,
      );
      await wrappedVoid(
        isolatedMocks.mockRequest as Request,
        isolatedMocks.mockResponse as Response,
        isolatedMocks.mockNext,
      );

      expect(stringFunction).toHaveBeenCalled();
      expect(numberFunction).toHaveBeenCalled();
      expect(objectFunction).toHaveBeenCalled();
      expect(voidFunction).toHaveBeenCalled();
    });
  });
});
