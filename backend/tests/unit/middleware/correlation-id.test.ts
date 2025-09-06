import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { correlationIdMiddleware } from '@/middleware/correlation-id';
import { createChildLogger } from '@/utils/logger';

// Mock generateCorrelationId from shared package
vi.mock('@medianest/shared', () => ({
  generateCorrelationId: vi.fn(() => 'mock-uuid-123'),
}));

// Mock createChildLogger
vi.mock('@/utils/logger', () => ({
  createChildLogger: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
  })),
}));

describe('Correlation ID Middleware', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    req = {
      headers: {},
    };
    res = {
      setHeader: vi.fn(),
    };
    next = vi.fn();
  });

  it('should generate correlation ID if not provided', () => {
    correlationIdMiddleware(req as Request, res as Response, next);

    expect(req.correlationId).toBe('mock-uuid-123');
    expect(res.setHeader).toHaveBeenCalledWith('x-correlation-id', 'mock-uuid-123');
    expect(next).toHaveBeenCalled();
  });

  it('should use existing correlation ID from header', () => {
    req.headers = { 'x-correlation-id': 'existing-id-456' };

    correlationIdMiddleware(req as Request, res as Response, next);

    expect(req.correlationId).toBe('existing-id-456');
    expect(res.setHeader).toHaveBeenCalledWith('x-correlation-id', 'existing-id-456');
    expect(next).toHaveBeenCalled();
  });

  it('should create child logger with correlation ID', () => {
    correlationIdMiddleware(req as Request, res as Response, next);

    expect(createChildLogger).toHaveBeenCalledWith('mock-uuid-123');
    expect(req.logger).toBeDefined();
  });

  it('should handle case-insensitive header', () => {
    req.headers = { 'X-CORRELATION-ID': 'uppercase-id' };

    correlationIdMiddleware(req as Request, res as Response, next);

    expect(req.correlationId).toBe('uppercase-id');
  });
});
