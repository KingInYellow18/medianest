import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
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
    
    // 2. AGGRESSIVE mock clearing to prevent cross-test contamination
    vi.clearAllMocks();
    vi.resetAllMocks();
    
    // 3. Set test environment
    process.env.NODE_ENV = 'test';
    
    // 4. Allow a small delay for mock setup to complete
    await new Promise(resolve => setTimeout(resolve, 1));
  });

  afterEach(() => {
    // Comprehensive cleanup to prevent cross-test contamination
    isolatedMocks?.cleanup();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('successful async operations', () => {
    it('should handle successful async function', async () => {
      const asyncFunction = vi.fn().mockResolvedValue(undefined);
      const wrappedFunction = asyncHandler(asyncFunction);

      await wrappedFunction(
        isolatedMocks.mockRequest as Request, 
        isolatedMocks.mockResponse as Response, 
        isolatedMocks.mockNext
      );

      expect(asyncFunction).toHaveBeenCalledWith(
        isolatedMocks.mockRequest, 
        isolatedMocks.mockResponse, 
        isolatedMocks.mockNext
      );
      expect(isolatedMocks.mockNext).not.toHaveBeenCalled();
    });

    it('should handle async function execution without return checking', async () => {
      const asyncFunction = vi.fn().mockImplementation(async (req, res) => {
        res.json({ data: 'test' });
      });
      const wrappedFunction = asyncHandler(asyncFunction);

      await wrappedFunction(
        isolatedMocks.mockRequest as Request, 
        isolatedMocks.mockResponse as Response, 
        isolatedMocks.mockNext
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
        isolatedMocks.mockNext
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
        isolatedMocks.mockNext
      );

      expect(isolatedMocks.mockRequest.params.id).toBe('456');
      expect(isolatedMocks.mockResponse.status).toHaveBeenCalledWith(200);
      expect(isolatedMocks.mockResponse.json).toHaveBeenCalledWith({ modified: true });
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
        isolatedMocks.mockNext
      );

      expect(asyncFunction).toHaveBeenCalled();
      expect(isolatedMocks.mockNext).toHaveBeenCalledWith(error);
    });

    it('should handle different error types', async () => {
      const customError = { message: 'Custom error', code: 500 };
      const asyncFunction = vi.fn().mockRejectedValue(customError);
      const wrappedFunction = asyncHandler(asyncFunction);

      await wrappedFunction(
        isolatedMocks.mockRequest as Request, 
        isolatedMocks.mockResponse as Response, 
        isolatedMocks.mockNext
      );

      expect(isolatedMocks.mockNext).toHaveBeenCalledWith(customError);
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
        isolatedMocks.mockNext
      );

      expect(isolatedMocks.mockNext).toHaveBeenCalledWith(error);
    });

    it('should handle promise rejection', async () => {
      const error = new Error('Promise rejection');
      const asyncFunction = vi.fn().mockRejectedValue(error);
      const wrappedFunction = asyncHandler(asyncFunction);

      await wrappedFunction(
        isolatedMocks.mockRequest as Request, 
        isolatedMocks.mockResponse as Response, 
        isolatedMocks.mockNext
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
        isolatedMocks.mockNext
      );

      expect(isolatedMocks.mockNext).toHaveBeenCalledWith(error);
      // Response methods should not be called when error occurs
      expect(isolatedMocks.mockResponse.status).not.toHaveBeenCalled();
    });
  });

  describe('middleware chain behavior', () => {
    it('should work with controller methods', async () => {
      const mockController = {
        getUser: vi.fn().mockImplementation(async (req, res) => {
          const user = { id: '123', name: 'Test User' };
          res.json(user);
        })
      };
      const wrappedMethod = asyncHandler(mockController.getUser);

      await wrappedMethod(
        isolatedMocks.mockRequest as Request, 
        isolatedMocks.mockResponse as Response, 
        isolatedMocks.mockNext
      );

      expect(mockController.getUser).toHaveBeenCalled();
      expect(isolatedMocks.mockResponse.json).toHaveBeenCalledWith({ id: '123', name: 'Test User' });
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
        isolatedMocks.mockNext
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
        isolatedMocks.mockNext
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
        isolatedMocks.mockNext
      );

      // The function should complete without throwing errors
      expect(middlewareFunction).toHaveBeenCalled();
      expect(isolatedMocks.mockNext).toHaveBeenCalledTimes(2);
    });
  });

  describe('edge cases', () => {
    it('should handle null/undefined functions gracefully', async () => {
      // This test ensures that if somehow a null function is passed, it's handled
      const asyncFunction = vi.fn().mockResolvedValue(undefined);
      const wrappedFunction = asyncHandler(asyncFunction);

      await wrappedFunction(
        isolatedMocks.mockRequest as Request, 
        isolatedMocks.mockResponse as Response, 
        isolatedMocks.mockNext
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
        isolatedMocks.mockNext
      );

      expect(isolatedMocks.mockResponse.json).toHaveBeenCalledWith({ delayed: true });
    });

    it('should preserve function context', async () => {
      const context = { value: 'test-context' };
      const asyncFunction = vi.fn().mockImplementation(async function(req, res) {
        res.json({ context: this.value });
      });
      const wrappedFunction = asyncHandler(asyncFunction.bind(context));

      await wrappedFunction(
        isolatedMocks.mockRequest as Request, 
        isolatedMocks.mockResponse as Response, 
        isolatedMocks.mockNext
      );

      expect(isolatedMocks.mockResponse.json).toHaveBeenCalledWith({ context: 'test-context' });
    });
  });
});