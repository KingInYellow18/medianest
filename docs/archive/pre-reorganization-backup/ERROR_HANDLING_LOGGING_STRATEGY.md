# MediaNest Error Handling and Logging Strategy

**Version:** 1.0  
**Date:** January 2025  
**Status:** Draft

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Error Handling Architecture](#2-error-handling-architecture)
3. [Logging Strategy](#3-logging-strategy)
4. [Service Resilience Patterns](#4-service-resilience-patterns)
5. [Implementation Guidelines](#5-implementation-guidelines)
6. [Monitoring and Alerting](#6-monitoring-and-alerting)
7. [Best Practices](#7-best-practices)

## 1. Executive Summary

MediaNest's error handling and logging strategy ensures system reliability, debuggability, and user satisfaction through comprehensive error management, structured logging, and resilience patterns. This document outlines the implementation of these critical components for a 10-20 user media management platform.

### Key Principles

- **User-First Error Messages**: Clear, actionable feedback without technical jargon
- **Comprehensive Internal Logging**: Detailed traces for debugging while protecting user privacy
- **Graceful Degradation**: Maintain functionality when external services fail
- **Proactive Monitoring**: Detect issues before users report them

## 2. Error Handling Architecture

### 2.1 Centralized Error Middleware

#### Express Error Handler

```javascript
// middleware/errorHandler.js
import winston from 'winston';
import { USER_ERRORS } from '../constants/errors';

export const errorHandler = (err, req, res, next) => {
  // Generate correlation ID if not present
  const correlationId = req.correlationId || generateId();

  // Log detailed error internally
  req.logger.error({
    correlationId,
    error: {
      message: err.message,
      stack: err.stack,
      code: err.code,
      statusCode: err.statusCode || 500,
      details: err.details,
    },
    request: {
      method: req.method,
      path: req.path,
      query: req.query,
      userId: req.user?.id,
      ip: req.ip,
    },
  });

  // Determine user-facing response
  const statusCode = err.statusCode || 500;
  const userMessage = USER_ERRORS[err.code] || USER_ERRORS.INTERNAL_ERROR;

  res.status(statusCode).json({
    success: false,
    error: {
      message: userMessage,
      code: err.code || 'INTERNAL_ERROR',
      correlationId,
      ...(statusCode === 429 && { retryAfter: err.retryAfter }),
    },
  });
};
```

### 2.2 Error Categories and User Messages

```javascript
// constants/errors.js
export const USER_ERRORS = {
  // Authentication Errors
  AUTH_FAILED: 'Authentication failed. Please log in again.',
  PLEX_TOKEN_EXPIRED: 'Your Plex session has expired. Please reconnect.',
  PERMISSION_DENIED: "You don't have permission to perform this action.",

  // Rate Limiting
  RATE_LIMIT_EXCEEDED: 'Too many requests. Please try again later.',
  YOUTUBE_QUOTA_EXCEEDED: 'Download limit reached. Try again in an hour.',

  // Service Availability
  SERVICE_UNAVAILABLE: 'This service is temporarily unavailable.',
  PLEX_UNREACHABLE: 'Cannot connect to Plex server. Please try again.',
  OVERSEERR_DOWN: 'Media requests are temporarily unavailable.',

  // Validation Errors
  INVALID_REQUEST: 'Invalid request. Please check your input.',
  INVALID_YOUTUBE_URL: 'Please provide a valid YouTube playlist URL.',

  // Resource Errors
  NOT_FOUND: 'The requested resource was not found.',
  MEDIA_NOT_FOUND: 'Media not found in library.',

  // Generic Errors
  INTERNAL_ERROR: 'Something went wrong. Please try again.',
};
```

### 2.3 Custom Error Classes

```javascript
// errors/AppError.js
export class AppError extends Error {
  constructor(code, message, statusCode = 500, details = {}) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true;
  }
}

export class ValidationError extends AppError {
  constructor(message, details) {
    super('VALIDATION_ERROR', message, 400, details);
  }
}

export class AuthenticationError extends AppError {
  constructor(message = 'Authentication failed') {
    super('AUTH_FAILED', message, 401);
  }
}

export class RateLimitError extends AppError {
  constructor(retryAfter) {
    super('RATE_LIMIT_EXCEEDED', 'Too many requests', 429, { retryAfter });
    this.retryAfter = retryAfter;
  }
}
```

## 3. Logging Strategy

### 3.1 Winston Logger Configuration

```javascript
// lib/logger.js
import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

const { combine, timestamp, errors, json, printf } = winston.format;

// Custom format for development
const devFormat = printf(({ level, message, timestamp, correlationId, ...meta }) => {
  return `${timestamp} [${correlationId}] ${level}: ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`;
});

// Create logger instance
export const createLogger = () => {
  return winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: combine(
      errors({ stack: true }),
      timestamp(),
      process.env.NODE_ENV === 'development' ? devFormat : json(),
    ),
    defaultMeta: { service: 'medianest' },
    transports: [
      // Console transport
      new winston.transports.Console({
        level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
      }),

      // Error file transport
      new winston.transports.File({
        filename: 'logs/error.log',
        level: 'error',
        maxsize: 10485760, // 10MB
        maxFiles: 5,
      }),

      // Combined file transport with rotation
      new DailyRotateFile({
        filename: 'logs/application-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        maxSize: '20m',
        maxFiles: '14d',
        level: 'info',
      }),
    ],
    exceptionHandlers: [new winston.transports.File({ filename: 'logs/exceptions.log' })],
    rejectionHandlers: [new winston.transports.File({ filename: 'logs/rejections.log' })],
  });
};

export const logger = createLogger();
```

### 3.2 Correlation ID Implementation

```javascript
// middleware/correlationId.js
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../lib/logger';

export const correlationIdMiddleware = (req, res, next) => {
  // Extract or generate correlation ID
  const correlationId = req.headers['x-correlation-id'] || uuidv4();

  // Attach to request
  req.correlationId = correlationId;

  // Create child logger with correlation ID
  req.logger = logger.child({ correlationId });

  // Set response header
  res.setHeader('x-correlation-id', correlationId);

  next();
};
```

### 3.3 PostgreSQL Error Logging

```sql
-- Database error logging table
CREATE TABLE error_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  correlation_id VARCHAR(255),
  user_id UUID REFERENCES users(id),
  error_code VARCHAR(100),
  error_message TEXT,
  stack_trace TEXT,
  request_path VARCHAR(500),
  request_method VARCHAR(10),
  status_code INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for efficient querying
CREATE INDEX idx_error_logs_correlation ON error_logs(correlation_id);
CREATE INDEX idx_error_logs_created ON error_logs(created_at);
CREATE INDEX idx_error_logs_user ON error_logs(user_id);

-- Automated cleanup job
CREATE OR REPLACE FUNCTION cleanup_old_error_logs()
RETURNS void AS $$
BEGIN
  DELETE FROM error_logs
  WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;
```

## 4. Service Resilience Patterns

### 4.1 Circuit Breaker Implementation

```javascript
// lib/circuitBreaker.js
import CircuitBreaker from 'opossum';
import { logger } from './logger';

export const createCircuitBreaker = (name, asyncFunction, options = {}) => {
  const breaker = new CircuitBreaker(asyncFunction, {
    timeout: 5000,
    errorThresholdPercentage: 50,
    resetTimeout: 30000,
    rollingCountTimeout: 10000,
    rollingCountBuckets: 10,
    ...options,
  });

  // Event handlers
  breaker.on('open', () => {
    logger.warn(`Circuit breaker opened for ${name}`);
  });

  breaker.on('halfOpen', () => {
    logger.info(`Circuit breaker half-open for ${name}, testing...`);
  });

  breaker.on('close', () => {
    logger.info(`Circuit breaker closed for ${name}`);
  });

  breaker.on('failure', (error) => {
    logger.error(`Circuit breaker failure for ${name}`, { error: error.message });
  });

  return breaker;
};
```

### 4.2 Service Integration with Circuit Breaker

```javascript
// services/plexService.js
import axios from 'axios';
import { createCircuitBreaker } from '../lib/circuitBreaker';
import { AppError } from '../errors/AppError';

class PlexService {
  constructor() {
    this.client = axios.create({
      baseURL: process.env.PLEX_URL,
      timeout: 10000,
    });

    // Wrap API calls with circuit breaker
    this.getLibraries = createCircuitBreaker('plex-libraries', this._getLibraries.bind(this), {
      fallback: () => this._getLibrariesFallback(),
    });
  }

  async _getLibraries(plexToken) {
    try {
      const response = await this.client.get('/library/sections', {
        headers: { 'X-Plex-Token': plexToken },
      });

      // Cache successful response
      await this.cacheLibraries(response.data);

      return response.data;
    } catch (error) {
      throw new AppError('PLEX_UNREACHABLE', 'Cannot fetch Plex libraries', 503, {
        originalError: error.message,
      });
    }
  }

  async _getLibrariesFallback() {
    logger.warn('Using cached Plex libraries due to service unavailability');

    // Return cached data
    const cached = await this.getCachedLibraries();
    if (cached) {
      return {
        ...cached,
        _cached: true,
        _cachedAt: cached.updatedAt,
      };
    }

    throw new AppError('SERVICE_UNAVAILABLE', 'Plex service unavailable');
  }
}
```

### 4.3 Graceful Degradation Strategy

```javascript
// middleware/serviceStatus.js
export const serviceStatusMiddleware = (serviceName) => {
  return async (req, res, next) => {
    const status = await getServiceStatus(serviceName);

    if (status === 'down') {
      // Add degraded mode header
      res.setHeader('X-Service-Degraded', serviceName);

      // Attach degraded flag to request
      req.degradedServices = req.degradedServices || [];
      req.degradedServices.push(serviceName);

      // Log degraded request
      req.logger.warn(`Processing request in degraded mode`, {
        service: serviceName,
        path: req.path,
      });
    }

    next();
  };
};

// Usage in routes
router.get('/api/media/search', serviceStatusMiddleware('overseerr'), async (req, res, next) => {
  if (req.degradedServices?.includes('overseerr')) {
    // Return limited functionality
    return res.json({
      success: true,
      data: [],
      message: 'Search temporarily unavailable. Browse existing library instead.',
      degraded: true,
    });
  }

  // Normal flow
  // ...
});
```

## 5. Implementation Guidelines

### 5.1 Request Lifecycle Logging

```javascript
// middleware/requestLogger.js
export const requestLogger = (req, res, next) => {
  const start = Date.now();

  // Log request start
  req.logger.info('Request started', {
    method: req.method,
    path: req.path,
    query: req.query,
    userId: req.user?.id,
  });

  // Capture response
  const originalSend = res.send;
  res.send = function (data) {
    res.send = originalSend;

    const duration = Date.now() - start;

    req.logger.info('Request completed', {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration,
      ...(res.statusCode >= 400 && { response: data }),
    });

    return res.send(data);
  };

  next();
};
```

### 5.2 Async Error Handling

```javascript
// utils/asyncHandler.js
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Usage in routes
router.post(
  '/api/youtube/download',
  asyncHandler(async (req, res) => {
    const { playlistUrl } = req.body;

    // Validation
    if (!isValidYouTubeUrl(playlistUrl)) {
      throw new ValidationError('Invalid YouTube URL', { playlistUrl });
    }

    // Check rate limit
    const userDownloads = await getUserDownloadCount(req.user.id);
    if (userDownloads >= 5) {
      throw new RateLimitError(3600); // 1 hour
    }

    // Process download
    const result = await queueDownload(req.user.id, playlistUrl);

    res.json({ success: true, data: result });
  }),
);
```

### 5.3 Background Job Error Handling

```javascript
// jobs/youtubeProcessor.js
import { logger } from '../lib/logger';

export const processYouTubeDownload = async (job) => {
  const { userId, playlistUrl, correlationId } = job.data;
  const jobLogger = logger.child({ correlationId, jobId: job.id });

  try {
    jobLogger.info('Starting YouTube download', { userId, playlistUrl });

    // Download logic
    const result = await downloadPlaylist(playlistUrl, {
      onProgress: (progress) => {
        job.progress(progress);
        jobLogger.debug('Download progress', { progress });
      },
    });

    jobLogger.info('YouTube download completed', {
      userId,
      fileCount: result.files.length,
    });

    return result;
  } catch (error) {
    jobLogger.error('YouTube download failed', {
      error: error.message,
      stack: error.stack,
      userId,
      playlistUrl,
    });

    // Store error in database
    await logJobError({
      jobType: 'youtube_download',
      userId,
      error: error.message,
      correlationId,
    });

    throw error;
  }
};
```

## 6. Monitoring and Alerting

### 6.1 Error Metrics

```javascript
// monitoring/metrics.js
import { Counter, Histogram } from 'prom-client';

// Error counter by type
export const errorCounter = new Counter({
  name: 'medianest_errors_total',
  help: 'Total number of errors',
  labelNames: ['error_code', 'status_code', 'service'],
});

// Request duration histogram
export const requestDuration = new Histogram({
  name: 'medianest_request_duration_seconds',
  help: 'Request duration in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.5, 1, 2, 5],
});

// Circuit breaker state
export const circuitBreakerState = new Counter({
  name: 'medianest_circuit_breaker_state',
  help: 'Circuit breaker state changes',
  labelNames: ['service', 'state'],
});
```

### 6.2 Alert Rules

```yaml
# prometheus-alerts.yml
groups:
  - name: medianest_alerts
    rules:
      # High error rate
      - alert: HighErrorRate
        expr: rate(medianest_errors_total[5m]) > 0.05
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: 'High error rate detected'
          description: 'Error rate is {{ $value }} errors/sec'

      # Circuit breaker open
      - alert: CircuitBreakerOpen
        expr: increase(medianest_circuit_breaker_state{state="open"}[5m]) > 0
        labels:
          severity: critical
        annotations:
          summary: 'Circuit breaker opened for {{ $labels.service }}'

      # Slow requests
      - alert: SlowRequests
        expr: histogram_quantile(0.95, rate(medianest_request_duration_seconds_bucket[5m])) > 2
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: '95th percentile request duration > 2s'
```

### 6.3 Log Analysis Queries

```sql
-- Most common errors in last 24 hours
SELECT
  error_code,
  COUNT(*) as error_count,
  COUNT(DISTINCT user_id) as affected_users
FROM error_logs
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY error_code
ORDER BY error_count DESC
LIMIT 10;

-- Error correlation analysis
SELECT
  e1.error_code as primary_error,
  e2.error_code as secondary_error,
  COUNT(*) as correlation_count
FROM error_logs e1
JOIN error_logs e2 ON e1.correlation_id = e2.correlation_id
  AND e1.id != e2.id
  AND e2.created_at BETWEEN e1.created_at AND e1.created_at + INTERVAL '5 minutes'
WHERE e1.created_at > NOW() - INTERVAL '7 days'
GROUP BY e1.error_code, e2.error_code
HAVING COUNT(*) > 10
ORDER BY correlation_count DESC;
```

## 7. Best Practices

### 7.1 Error Handling Checklist

- [ ] All async routes wrapped with asyncHandler
- [ ] User-facing errors use predefined messages
- [ ] Sensitive data never logged or exposed
- [ ] Correlation IDs propagated across services
- [ ] Circuit breakers on all external API calls
- [ ] Graceful fallbacks for service failures
- [ ] Rate limiting with clear retry information
- [ ] Structured logging with appropriate levels
- [ ] Error metrics exported for monitoring
- [ ] Database errors logged for analysis

### 7.2 Logging Standards

```javascript
// DO: Structured, contextual logging
logger.info('Media request submitted', {
  userId: req.user.id,
  mediaType: 'movie',
  tmdbId: '12345',
  requestId: request.id,
});

// DON'T: Unstructured string concatenation
logger.info(`User ${userId} requested movie ${title}`);

// DO: Appropriate log levels
logger.debug('Cache hit for user preferences');
logger.info('New user registered');
logger.warn('Rate limit approaching for user');
logger.error('Failed to connect to Plex', { error });

// DON'T: Wrong levels
logger.error('User logged in'); // Should be info
logger.debug('Database connection failed'); // Should be error
```

### 7.3 Security Considerations

```javascript
// Sanitize sensitive data before logging
const sanitizeRequest = (req) => {
  const sanitized = { ...req };

  // Remove sensitive headers
  if (sanitized.headers) {
    delete sanitized.headers.authorization;
    delete sanitized.headers['x-plex-token'];
    delete sanitized.headers.cookie;
  }

  // Remove sensitive body fields
  if (sanitized.body?.password) {
    sanitized.body.password = '[REDACTED]';
  }

  return sanitized;
};

// Use in error logging
logger.error('Request failed', {
  request: sanitizeRequest({
    method: req.method,
    path: req.path,
    headers: req.headers,
    body: req.body,
  }),
});
```

### 7.4 Performance Considerations

```javascript
// Async logging for high-volume operations
import { Writable } from 'stream';
import { pipeline } from 'stream/promises';

class AsyncLogStream extends Writable {
  constructor(options) {
    super(options);
    this.buffer = [];
    this.flushInterval = setInterval(() => this.flush(), 1000);
  }

  _write(chunk, encoding, callback) {
    this.buffer.push(chunk);
    callback();
  }

  async flush() {
    if (this.buffer.length === 0) return;

    const logs = this.buffer.splice(0);
    try {
      await this.writeLogs(logs);
    } catch (error) {
      logger.error('Failed to flush logs', { error });
    }
  }

  async writeLogs(logs) {
    // Batch insert to database or external service
  }
}
```

## Summary

MediaNest's error handling and logging strategy provides:

1. **User Experience**: Clear, non-technical error messages with actionable guidance
2. **Debugging Power**: Comprehensive internal logging with correlation tracking
3. **System Resilience**: Circuit breakers and graceful degradation for external services
4. **Operational Excellence**: Proactive monitoring and automated alerting
5. **Performance**: Optimized logging with minimal runtime impact

This strategy ensures MediaNest remains reliable, debuggable, and user-friendly even when facing unexpected errors or service disruptions.
