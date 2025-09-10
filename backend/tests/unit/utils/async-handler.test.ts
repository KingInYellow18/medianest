import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { asyncHandler } from '@/utils/async-handler';

describe('AsyncHandler Utility', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockRequest = {
      params: {},
      query: {},
      body: {},
      user: { id: 'user-123' },
    };
    mockResponse = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    };
    mockNext = vi.fn();
    vi.clearAllMocks();
  });

  describe('successful async operations', () => {
    it('should handle successful async function', async () => {
      const asyncFunction = vi.fn().mockResolvedValue('success');
      const wrappedFunction = asyncHandler(asyncFunction);

      await wrappedFunction(mockRequest as Request, mockResponse as Response, mockNext);

      expect(asyncFunction).toHaveBeenCalledWith(mockRequest, mockResponse, mockNext);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should pass through return values', async () => {
      const returnValue = { data: 'test' };
      const asyncFunction = vi.fn().mockResolvedValue(returnValue);
      const wrappedFunction = asyncHandler(asyncFunction);

      const result = await wrappedFunction(mockRequest as Request, mockResponse as Response, mockNext);

      expect(result).toBe(returnValue);
    });

    it('should handle void async functions', async () => {
      const asyncFunction = vi.fn().mockImplementation(async (req, res) => {
        res.json({ success: true });
      });
      const wrappedFunction = asyncHandler(asyncFunction);

      await wrappedFunction(mockRequest as Request, mockResponse as Response, mockNext);

      expect(asyncFunction).toHaveBeenCalled();
      expect(mockResponse.json).toHaveBeenCalledWith({ success: true });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle functions that modify request/response', async () => {
      const asyncFunction = vi.fn().mockImplementation(async (req, res) => {
        req.customProperty = 'added';
        res.locals = { ...res.locals, customData: 'test' };
      });
      const wrappedFunction = asyncHandler(asyncFunction);

      await wrappedFunction(mockRequest as Request, mockResponse as Response, mockNext);

      expect((mockRequest as any).customProperty).toBe('added');
      expect(mockResponse.locals).toEqual({ customData: 'test' });
    });
  });

  describe('error handling', () => {
    it('should catch and pass errors to next middleware', async () => {
      const error = new Error('Test error');
      const asyncFunction = vi.fn().mockRejectedValue(error);
      const wrappedFunction = asyncHandler(asyncFunction);

      await wrappedFunction(mockRequest as Request, mockResponse as Response, mockNext);

      expect(asyncFunction).toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalledWith(error);
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
        const nextSpy = vi.fn();

        await wrappedFunction(mockRequest as Request, mockResponse as Response, nextSpy);

        expect(nextSpy).toHaveBeenCalledWith(error);
        vi.clearAllMocks();
      }
    });

    it('should handle synchronous errors thrown in async function', async () => {
      const error = new Error('Sync error in async function');
      const asyncFunction = vi.fn().mockImplementation(async () => {
        throw error;
      });
      const wrappedFunction = asyncHandler(asyncFunction);

      await wrappedFunction(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });

    it('should handle promise rejection', async () => {
      const error = new Error('Promise rejection');
      const asyncFunction = vi.fn().mockImplementation(() => Promise.reject(error));
      const wrappedFunction = asyncHandler(asyncFunction);

      await wrappedFunction(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });

    it('should not interfere with response when error occurs', async () => {
      const error = new Error('Test error');
      const asyncFunction = vi.fn().mockImplementation(async (req, res) => {
        res.status(200).json({ success: true });
        throw error;
      });
      const wrappedFunction = asyncHandler(asyncFunction);

      await wrappedFunction(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({ success: true });
      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('middleware chain behavior', () => {
    it('should work with controller methods', async () => {
      class TestController {
        async getUser(req: Request, res: Response) {
          const userId = req.params.id;
          res.json({ id: userId, name: 'Test User' });
        }
      }

      const controller = new TestController();
      const wrappedMethod = asyncHandler(controller.getUser.bind(controller));

      mockRequest.params = { id: '123' };

      await wrappedMethod(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.json).toHaveBeenCalledWith({ id: '123', name: 'Test User' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should work with middleware functions', async () => {
      const authMiddleware = vi.fn().mockImplementation(async (req, res, next) => {
        req.user = { id: 'authenticated-user' };
        next();
      });
      const wrappedMiddleware = asyncHandler(authMiddleware);

      await wrappedMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect((mockRequest as any).user).toEqual({ id: 'authenticated-user' });
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should handle middleware that calls next with error', async () => {
      const error = new Error('Middleware error');
      const errorMiddleware = vi.fn().mockImplementation(async (req, res, next) => {
        next(error);
      });
      const wrappedMiddleware = asyncHandler(errorMiddleware);

      await wrappedMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });

    it('should handle middleware that calls next multiple times', async () => {
      const multipleNextMiddleware = vi.fn().mockImplementation(async (req, res, next) => {
        next();
        next(); // This should not cause issues
      });
      const wrappedMiddleware = asyncHandler(multipleNextMiddleware);

      await wrappedMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(2);
    });
  });

  describe('performance and edge cases', () => {
    it('should handle functions that resolve immediately', async () => {
      const immediateFunction = vi.fn().mockImplementation(() => Promise.resolve('immediate'));
      const wrappedFunction = asyncHandler(immediateFunction);

      const startTime = Date.now();
      await wrappedFunction(mockRequest as Request, mockResponse as Response, mockNext);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(10); // Should be very fast
      expect(immediateFunction).toHaveBeenCalled();
    });

    it('should handle functions with delays', async () => {
      const delayedFunction = vi.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
        return 'delayed';
      });
      const wrappedFunction = asyncHandler(delayedFunction);

      const startTime = Date.now();
      await wrappedFunction(mockRequest as Request, mockResponse as Response, mockNext);
      const endTime = Date.now();

      expect(endTime - startTime).toBeGreaterThanOrEqual(45);
      expect(delayedFunction).toHaveBeenCalled();
    });

    it('should handle concurrent wrapped function calls', async () => {
      let callCount = 0;
      const concurrentFunction = vi.fn().mockImplementation(async () => {
        callCount++;
        await new Promise(resolve => setTimeout(resolve, 10));
        return `call-${callCount}`;
      });
      const wrappedFunction = asyncHandler(concurrentFunction);

      const promises = [
        wrappedFunction(mockRequest as Request, mockResponse as Response, mockNext),
        wrappedFunction(mockRequest as Request, mockResponse as Response, mockNext),
        wrappedFunction(mockRequest as Request, mockResponse as Response, mockNext),
      ];

      await Promise.all(promises);

      expect(concurrentFunction).toHaveBeenCalledTimes(3);
      expect(callCount).toBe(3);
    });

    it('should preserve function context', async () => {
      const context = { value: 'test-context' };
      const contextFunction = vi.fn().mockImplementation(async function(this: any) {
        return this.value;
      });
      const wrappedFunction = asyncHandler(contextFunction.bind(context));

      await wrappedFunction(mockRequest as Request, mockResponse as Response, mockNext);

      expect(contextFunction).toHaveBeenCalled();
    });

    it('should handle empty functions', async () => {
      const emptyFunction = vi.fn().mockImplementation(async () => {});
      const wrappedFunction = asyncHandler(emptyFunction);

      await wrappedFunction(mockRequest as Request, mockResponse as Response, mockNext);

      expect(emptyFunction).toHaveBeenCalled();
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('TypeScript compatibility', () => {
    it('should maintain type safety for request/response', async () => {
      interface CustomRequest extends Request {
        customProp: string;
      }

      const typedFunction = vi.fn().mockImplementation(async (req: CustomRequest, res: Response) => {
        res.json({ custom: req.customProp });
      });

      const wrappedFunction = asyncHandler(typedFunction);

      const customRequest = { ...mockRequest, customProp: 'test' } as CustomRequest;

      await wrappedFunction(customRequest, mockResponse as Response, mockNext);

      expect(typedFunction).toHaveBeenCalledWith(customRequest, mockResponse, mockNext);
      expect(mockResponse.json).toHaveBeenCalledWith({ custom: 'test' });
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

      await wrappedString(mockRequest as Request, mockResponse as Response, mockNext);
      await wrappedNumber(mockRequest as Request, mockResponse as Response, mockNext);
      await wrappedObject(mockRequest as Request, mockResponse as Response, mockNext);
      await wrappedVoid(mockRequest as Request, mockResponse as Response, mockNext);

      expect(stringFunction).toHaveBeenCalled();
      expect(numberFunction).toHaveBeenCalled();
      expect(objectFunction).toHaveBeenCalled();
      expect(voidFunction).toHaveBeenCalled();
    });
  });
});