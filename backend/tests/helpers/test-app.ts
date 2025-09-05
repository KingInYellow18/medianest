import express from 'express';
import { errorHandler } from '@/middleware/error';
import { correlationMiddleware } from '@/middleware/correlation-id';

/**
 * Creates a test Express application with common middleware
 */
export function setupTestApp(): express.Application {
  const app = express();

  // Basic middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  
  // Test middleware
  app.use(correlationMiddleware);

  // Error handling (should be last)
  app.use(errorHandler);

  return app;
}

/**
 * Creates a minimal test Express application without middleware
 */
export function setupMinimalTestApp(): express.Application {
  return express();
}

/**
 * Helper for creating test request context
 */
export function createTestRequestContext(overrides = {}) {
  return {
    user: null,
    correlationId: 'test-correlation-id',
    startTime: Date.now(),
    ...overrides
  };
}