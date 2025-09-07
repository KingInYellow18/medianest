import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { resilienceService } from '../services/resilience.service';
import { retryWithBackoff } from '../utils/retry';
import { CatchError } from '../types/common';

export interface ResilienceMiddlewareOptions {
  enableCircuitBreaker?: boolean;
  enableRetry?: boolean;
  enableBulkhead?: boolean;
  enableFallback?: boolean;
  serviceName?: string;
  compartmentName?: string;
  maxConcurrent?: number;
  fallbackResponse?: any;
}

// Circuit breaker middleware
export function circuitBreakerMiddleware(serviceName: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Store service name in request for downstream handlers
      (req as any).serviceName = serviceName;

      // Check if circuit breaker is open
      const dependency = resilienceService['dependencies'].get(serviceName);
      if (dependency?.circuitBreaker?.isOpen) {
        logger.warn(`Circuit breaker is open for service: ${serviceName}`);

        // Return cached response or fallback
        const fallbackResponse = await getFallbackResponse(serviceName, req);
        if (fallbackResponse) {
          return res.status(200).json({
            data: fallbackResponse,
            cached: true,
            message: 'Service temporarily unavailable, serving cached data',
          });
        }

        return res.status(503).json({
          error: 'Service temporarily unavailable',
          service: serviceName,
          // @ts-ignore
          retryAfter: dependency.circuitBreaker.getStats().nextRetryAt,
        });
      }

      next();
    } catch (error: CatchError) {
      next(error);
    }
  };
}

// Bulkhead middleware
export function bulkheadMiddleware(compartmentName: string, maxConcurrent = 10) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await resilienceService.executeWithBulkhead(
        compartmentName,
        async () => {
          // Store compartment info for monitoring
          (req as any).compartment = compartmentName;
          next();
        },
        maxConcurrent
      );
    } catch (error: CatchError) {
      if ((error as Error).name === 'BulkheadError') {
        logger.warn(`Bulkhead limit exceeded for compartment: ${compartmentName}`);
        return res.status(429).json({
          error: 'Too many concurrent requests',
          compartment: compartmentName,
          retryAfter: '5s',
        });
      }
      next(error);
    }
  };
}

// Retry middleware for failed operations
export function retryMiddleware(options: { maxAttempts?: number; initialDelay?: number } = {}) {
  return (req: Request, res: Response, next: NextFunction) => {
    const originalSend = res.send.bind(res);
    const originalJson = res.json.bind(res);

    // Override response methods to catch 5xx errors
    res.send = function (data: unknown) {
      if (res.statusCode >= 500 && res.statusCode < 600) {
        handleRetryableError(req, res, new Error(`HTTP ${res.statusCode}`), options);
        return res;
      }
      return originalSend(data);
    };

    res.json = function (data: unknown) {
      if (res.statusCode >= 500 && res.statusCode < 600) {
        handleRetryableError(req, res, new Error(`HTTP ${res.statusCode}`), options);
        return res;
      }
      return originalJson(data);
    };

    next();
  };
}

// Graceful degradation middleware
export function gracefulDegradationMiddleware(fallbackStrategies: {
  cache?: boolean;
  defaultResponse?: any;
  queueForLater?: boolean;
}) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const originalNextFunction = next;

    // Override next to intercept errors
    const enhancedNext = async (error?: any) => {
      if (!error) {
        return originalNextFunction();
      }

      // Try graceful degradation strategies
      try {
        if (fallbackStrategies.cache) {
          const cachedResponse = await getCachedResponseForRequest(req);
          if (cachedResponse) {
            logger.info('Serving cached response due to error', {
              path: req.path,
              error: error instanceof Error ? error.message : ('Unknown error' as any),
            });

            return res.status(200).json({
              data: cachedResponse,
              cached: true,
              message: 'Serving cached data due to service issue',
            });
          }
        }

        if (fallbackStrategies.defaultResponse) {
          logger.info('Serving default response due to error', {
            path: req.path,
            error: error instanceof Error ? error.message : ('Unknown error' as any),
          });

          return res.status(200).json({
            data: fallbackStrategies.defaultResponse,
            fallback: true,
            message: 'Serving default data due to service issue',
          });
        }

        if (fallbackStrategies.queueForLater) {
          await queueRequestForLater(req);

          return res.status(202).json({
            message: 'Request queued for processing when service is available',
            requestId: generateRequestId(),
          });
        }

        // No fallback available, proceed with error
        originalNextFunction(error);
      } catch (fallbackError) {
        logger.error('Fallback strategy failed', {
          originalError: error.message as any,
          fallbackError: (fallbackError as Error).message,
        });
        originalNextFunction(error);
      }
    };

    // Replace next function
    (req as any).next = enhancedNext;
    next();
  };
}

// Comprehensive resilience middleware that combines multiple patterns
export function comprehensiveResilienceMiddleware(options: ResilienceMiddlewareOptions = {}) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const {
      enableCircuitBreaker = true,
      enableBulkhead = true,
      enableFallback = true,
      serviceName = 'default',
      compartmentName = req.path,
      maxConcurrent = 10,
      fallbackResponse,
    } = options;

    try {
      // Apply bulkhead pattern
      if (enableBulkhead) {
        await resilienceService.executeWithBulkhead(
          compartmentName,
          async () => {
            // Continue with request processing
          },
          maxConcurrent
        );
      }

      // Check circuit breaker
      if (enableCircuitBreaker) {
        const dependency = resilienceService['dependencies'].get(serviceName);
        if (dependency?.circuitBreaker?.isOpen) {
          if (enableFallback) {
            const fallback = fallbackResponse || (await getFallbackResponse(serviceName, req));
            if (fallback) {
              return res.status(200).json({
                data: fallback,
                fallback: true,
                message: 'Service temporarily unavailable, serving fallback data',
              });
            }
          }

          return res.status(503).json({
            error: 'Service temporarily unavailable',
            service: serviceName,
            // @ts-ignore
            retryAfter: dependency.circuitBreaker.getStats().nextRetryAt,
          });
        }
      }

      // Add error tracking to response
      const startTime = Date.now();
      res.on('finish', () => {
        const duration = Date.now() - startTime;
        const statusCode = res.statusCode;

        // Track metrics
        if (statusCode >= 500) {
          logger.error('Request resulted in server error', {
            path: req.path,
            method: req.method,
            statusCode,
            duration,
            service: serviceName,
          });
        }

        // Emit metrics for monitoring
        resilienceService.emit('requestCompleted', {
          path: req.path,
          method: req.method,
          statusCode,
          duration,
          service: serviceName,
        });
      });

      next();
    } catch (error: CatchError) {
      logger.error('Resilience middleware error', {
        error: (error as Error).message,
        path: req.path,
        service: serviceName,
      });
      next(error);
    }
  };
}

// Error recovery middleware
export function errorRecoveryMiddleware() {
  return async (error: Error, req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) {
      return next(error);
    }

    try {
      // Attempt recovery strategies
      const context = {
        path: req.path,
        method: req.method,
        body: req.body,
        query: req.query,
        fallbackToCache: true,
        cacheKey: `response:${req.method}:${req.path}`,
      };

      const recoveryResult = await resilienceService.executeRecoveryStrategies(error, context);

      if (recoveryResult) {
        logger.info('Error recovery successful', {
          path: req.path,
          originalError: error.message as any,
        });

        return res.status(200).json({
          data: recoveryResult,
          recovered: true,
          message: 'Request recovered through fallback strategy',
        });
      }
    } catch (recoveryError) {
      logger.error('Error recovery failed', {
        originalError: error.message as any,
        recoveryError: (recoveryError as Error).message,
      });
    }

    // No recovery possible, proceed with error handling
    next(error);
  };
}

// Helper functions
async function getFallbackResponse(serviceName: string, req: Request): Promise<any> {
  try {
    // Try to get cached response
    const cacheKey = `fallback:${serviceName}:${req.method}:${req.path}`;
    const cached = await getCachedData(cacheKey);

    if (cached) {
      return cached;
    }

    // Return default response based on service
    return getDefaultResponse(serviceName, req.path);
  } catch (error: CatchError) {
    logger.error('Failed to get fallback response', { error, serviceName });
    return null;
  }
}

async function getCachedResponseForRequest(req: Request): Promise<any> {
  try {
    const cacheKey = `response:${req.method}:${req.path}`;
    return await getCachedData(cacheKey);
  } catch (error: CatchError) {
    logger.error('Failed to get cached response', { error, path: req.path });
    return null;
  }
}

async function getCachedData(key: string): Promise<any> {
  // Implementation would use Redis or another cache
  // This is a placeholder
  return null;
}

function getDefaultResponse(serviceName: string, path: string): any {
  // Return service-specific default responses
  const defaults: Record<string, any> = {
    'youtube-service': { videos: [], message: 'Service temporarily unavailable' },
    'plex-service': { movies: [], shows: [], message: 'Media server unavailable' },
    'dashboard-service': { metrics: {}, message: 'Dashboard data unavailable' },
  };

  return defaults[serviceName] || { message: 'Service temporarily unavailable' };
}

async function queueRequestForLater(req: Request): Promise<void> {
  // Queue the request for processing when service is available
  // Implementation would use a queue system like Bull
  logger.info('Queueing request for later processing', {
    path: req.path,
    method: req.method,
  });
}

function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

async function handleRetryableError(
  req: Request,
  res: Response,
  error: Error,
  options: { maxAttempts?: number; initialDelay?: number }
): Promise<void> {
  const { maxAttempts = 3, initialDelay = 1000 } = options;

  try {
    await retryWithBackoff(
      async () => {
        // Re-execute the request handler
        throw new Error('Retry implementation needed');
      },
      {
        maxAttempts,
        initialDelay,
        maxDelay: 10000,
        factor: 2,
      }
    );
  } catch (retryError) {
    logger.error('Request retry failed', {
      path: req.path,
      error: error instanceof Error ? error.message : ('Unknown error' as any),
      retryError: (retryError as Error).message,
    });
  }
}
