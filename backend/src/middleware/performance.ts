// Context7 Express.js Performance Middleware
// Implements official Express.js performance optimization patterns

import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

// Context7 Pattern: Request timing middleware for performance monitoring
export function requestTiming() {
  return (req: Request, res: Response, next: NextFunction) => {
    const startTime = process.hrtime.bigint();

    // Context7 Pattern: Use res.on('finish') for accurate timing
    res.on('finish', () => {
      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1e6; // Convert to milliseconds

      // Context7 Pattern: Add performance headers for monitoring
      res.setHeader('X-Response-Time', `${duration.toFixed(2)}ms`);

      // Context7 Pattern: Log slow requests asynchronously
      if (duration > 1000) {
        // Log requests slower than 1s
        setImmediate(() => {
          logger.warn('Slow request detected', {
            method: req.method,
            path: req.path,
            duration: `${duration.toFixed(2)}ms`,
            userId: req.user?.id,
          });
        });
      }
    });

    next();
  };
}

// Context7 Pattern: Memory usage monitoring middleware
export function memoryMonitor() {
  let lastCheck = Date.now();
  const CHECK_INTERVAL = 30000; // 30 seconds

  return (_req: Request, _res: Response, next: NextFunction) => {
    const now = Date.now();

    // Context7 Pattern: Throttled memory monitoring to reduce overhead
    if (now - lastCheck > CHECK_INTERVAL) {
      lastCheck = now;

      // Context7 Pattern: Async memory monitoring
      setImmediate(() => {
        const usage = process.memoryUsage();
        const heapUsedMB = Math.round(usage.heapUsed / 1024 / 1024);
        const heapTotalMB = Math.round(usage.heapTotal / 1024 / 1024);

        // Context7 Pattern: Warning for high memory usage
        if (heapUsedMB > 512) {
          // Warn if using more than 512MB
          logger.warn('High memory usage detected', {
            heapUsed: `${heapUsedMB}MB`,
            heapTotal: `${heapTotalMB}MB`,
            usage: `${Math.round((heapUsedMB / heapTotalMB) * 100)}%`,
          });
        }
      });
    }

    next();
  };
}

// Context7 Pattern: Response optimization middleware
export function responseOptimization() {
  return (_req: Request, res: Response, next: NextFunction) => {
    // Context7 Pattern: Set efficient JSON replacer for production
    if (process.env.NODE_ENV === 'production') {
      const originalJson = res.json;
      res.json = function (obj: any) {
        // Context7 Pattern: Remove null/undefined values in production
        return originalJson.call(
          this,
          JSON.parse(
            JSON.stringify(obj, (_key, value) => {
              return value === null || value === undefined ? undefined : value;
            })
          )
        );
      };
    }

    // Context7 Pattern: Set performance-oriented headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');

    // Context7 Pattern: Enable keep-alive for better connection reuse
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Keep-Alive', 'timeout=5, max=1000');

    next();
  };
}

// Context7 Pattern: Request size limiter for early rejection
export function requestSizeLimiter(maxSize: number = 1024 * 1024) {
  // 1MB default
  return (req: Request, res: Response, next: NextFunction): void => {
    const contentLength = parseInt(req.headers['content-length'] || '0', 10);

    // Context7 Pattern: Early rejection for oversized requests
    if (contentLength > maxSize) {
      res.status(413).json({
        success: false,
        error: {
          code: 'PAYLOAD_TOO_LARGE',
          message: `Request payload too large. Maximum size is ${Math.round(maxSize / 1024)}KB`,
          maxSize: `${Math.round(maxSize / 1024)}KB`,
          receivedSize: `${Math.round(contentLength / 1024)}KB`,
        },
      });
      return;
    }

    next();
  };
}

// Context7 Pattern: Route-specific cache headers
export function cacheHeaders(
  options: {
    maxAge?: number;
    public?: boolean;
    immutable?: boolean;
    etag?: boolean;
  } = {}
) {
  const { maxAge = 0, public: isPublic = false, immutable = false, etag = false } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    // Context7 Pattern: Skip caching for non-GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Context7 Pattern: Build cache control header efficiently
    const cacheDirectives = [];

    if (maxAge > 0) {
      cacheDirectives.push(isPublic ? 'public' : 'private');
      cacheDirectives.push(`max-age=${maxAge}`);

      if (immutable) {
        cacheDirectives.push('immutable');
      }
    } else {
      cacheDirectives.push('no-cache', 'no-store', 'must-revalidate');
    }

    res.setHeader('Cache-Control', cacheDirectives.join(', '));

    // Context7 Pattern: Conditional ETag generation
    if (etag && maxAge > 0) {
      const originalSend = res.send;
      res.send = function (body: any) {
        if (typeof body === 'string' || Buffer.isBuffer(body)) {
          const hash = require('crypto').createHash('md5').update(body).digest('hex');
          res.setHeader('ETag', `"${hash}"`);
        }
        return originalSend.call(this, body);
      };
    }

    next();
  };
}

// Context7 Pattern: Health check optimization middleware
export function healthCheckOptimization() {
  const healthPaths = new Set(['/health', '/ping', '/status', '/api/health', '/api/v1/health']);

  return (req: Request, res: Response, next: NextFunction): void => {
    // Context7 Pattern: Fast-path for health checks
    if (healthPaths.has(req.path)) {
      // Skip unnecessary middleware for health checks
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Content-Type', 'application/json');

      // Context7 Pattern: Minimal health check response
      if (req.path === '/ping') {
        res.status(200).send('pong');
        return;
      }
    }

    next();
  };
}

// Context7 Pattern: Combine all performance middleware
export function applyPerformanceMiddleware() {
  return [
    healthCheckOptimization(),
    requestTiming(),
    responseOptimization(),
    memoryMonitor(),
    requestSizeLimiter(),
  ];
}
