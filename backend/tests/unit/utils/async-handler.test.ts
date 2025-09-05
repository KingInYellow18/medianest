import { describe, it, expect, vi } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { asyncHandler } from '@/utils/async-handler';

describe('AsyncHandler', () => {
  const mockRequest = {} as Request;
  const mockResponse = {} as Response;
  const mockNext = vi.fn() as NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should handle successful async functions', async () => {
    const asyncFn = vi.fn().mockResolvedValue('success');
    const wrappedFn = asyncHandler(asyncFn);

    await wrappedFn(mockRequest, mockResponse, mockNext);

    expect(asyncFn).toHaveBeenCalledWith(mockRequest, mockResponse, mockNext);
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should catch and forward async errors', async () => {
    const error = new Error('Async error');
    const asyncFn = vi.fn().mockRejectedValue(error);
    const wrappedFn = asyncHandler(asyncFn);

    await wrappedFn(mockRequest, mockResponse, mockNext);

    expect(asyncFn).toHaveBeenCalledWith(mockRequest, mockResponse, mockNext);
    expect(mockNext).toHaveBeenCalledWith(error);
  });

  it('should handle synchronous functions that return promises', async () => {
    const syncFn = vi.fn().mockReturnValue(Promise.resolve('sync success'));
    const wrappedFn = asyncHandler(syncFn);

    await wrappedFn(mockRequest, mockResponse, mockNext);

    expect(syncFn).toHaveBeenCalledWith(mockRequest, mockResponse, mockNext);
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should handle synchronous functions that throw errors', async () => {
    const error = new Error('Sync error');
    const syncFn = vi.fn().mockImplementation(() => {
      throw error;
    });
    const wrappedFn = asyncHandler(syncFn);

    await wrappedFn(mockRequest, mockResponse, mockNext);

    expect(syncFn).toHaveBeenCalledWith(mockRequest, mockResponse, mockNext);
    expect(mockNext).toHaveBeenCalledWith(error);
  });

  it('should preserve function context', async () => {
    const contextObject = {
      value: 'test',
      method: vi.fn().mockResolvedValue('context preserved')
    };
    
    const wrappedFn = asyncHandler(contextObject.method.bind(contextObject));

    await wrappedFn(mockRequest, mockResponse, mockNext);

    expect(contextObject.method).toHaveBeenCalledWith(mockRequest, mockResponse, mockNext);
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should handle null/undefined return values', async () => {
    const asyncFn = vi.fn().mockResolvedValue(null);
    const wrappedFn = asyncHandler(asyncFn);

    await wrappedFn(mockRequest, mockResponse, mockNext);

    expect(asyncFn).toHaveBeenCalledWith(mockRequest, mockResponse, mockNext);
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should handle timeout scenarios', async () => {
    const timeout = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Timeout')), 100)
    );
    const asyncFn = vi.fn().mockReturnValue(timeout);
    const wrappedFn = asyncHandler(asyncFn);

    await wrappedFn(mockRequest, mockResponse, mockNext);

    expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({
      message: 'Timeout'
    }));
  });

  it('should handle functions with multiple arguments', async () => {
    const asyncFn = vi.fn().mockImplementation((req, res, next, extra) => {
      return Promise.resolve({ req, res, next, extra });
    });
    const wrappedFn = asyncHandler(asyncFn);

    // Call with extra argument (edge case)
    await wrappedFn(mockRequest, mockResponse, mockNext, 'extra');

    expect(asyncFn).toHaveBeenCalledWith(mockRequest, mockResponse, mockNext, 'extra');
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should handle errors with stack traces', async () => {
    const error = new Error('Stack trace error');
    error.stack = 'Error: Stack trace error\n    at test (test.js:1:1)';
    const asyncFn = vi.fn().mockRejectedValue(error);
    const wrappedFn = asyncHandler(asyncFn);

    await wrappedFn(mockRequest, mockResponse, mockNext);

    expect(mockNext).toHaveBeenCalledWith(error);
    expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({
      stack: expect.stringContaining('Stack trace error')
    }));
  });
});