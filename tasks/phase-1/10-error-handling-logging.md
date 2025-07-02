# Task: Error Handling and Logging Setup

**Task ID:** PHASE1-10  
**Priority:** High  
**Estimated Time:** 3 hours  
**Dependencies:** PHASE1-03 (Backend Initialization)

## Objective
Implement comprehensive error handling and structured logging throughout the MediaNest application, following the established error handling and logging strategy.

## Acceptance Criteria
- [ ] Structured logging with correlation IDs
- [ ] Centralized error handling
- [ ] User-friendly error messages
- [ ] Detailed internal error logging
- [ ] Log rotation and retention
- [ ] Performance logging

## Detailed Steps

### 1. Enhanced Logger Configuration
Update `backend/src/utils/logger.ts`:

```typescript
import winston from 'winston'
import DailyRotateFile from 'winston-daily-rotate-file'
import { config } from '@/config'
import { Request } from 'express'

// Custom log levels
const customLevels = {
  levels: {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    debug: 4,
  },
  colors: {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    http: 'magenta',
    debug: 'blue',
  },
}

// Create format for console output
const consoleFormat = winston.format.combine(
  winston.format.colorize({ all: true }),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let log = `${timestamp} [${level}]: ${message}`
    if (Object.keys(meta).length > 0) {
      log += ` ${JSON.stringify(meta, null, 2)}`
    }
    return log
  })
)

// Create format for file output
const fileFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
)

// Configure transports
const transports: winston.transport[] = []

// Console transport
if (config.env !== 'test') {
  transports.push(
    new winston.transports.Console({
      format: consoleFormat,
      level: config.env === 'production' ? 'info' : 'debug',
    })
  )
}

// File transports for production
if (config.env === 'production') {
  // All logs
  transports.push(
    new DailyRotateFile({
      filename: 'logs/application-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '30d',
      format: fileFormat,
      level: 'info',
    })
  )

  // Error logs
  transports.push(
    new DailyRotateFile({
      filename: 'logs/error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '30d',
      format: fileFormat,
      level: 'error',
    })
  )

  // Security logs
  transports.push(
    new DailyRotateFile({
      filename: 'logs/security-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '90d',
      format: fileFormat,
      level: 'warn',
      filter: (info) => info.security === true,
    })
  )
}

// Create logger instance
export const logger = winston.createLogger({
  levels: customLevels.levels,
  level: config.logging.level,
  format: fileFormat,
  transports,
  exitOnError: false,
})

// Add colors to console output
winston.addColors(customLevels.colors)

// Logger methods with metadata
export const log = {
  error: (message: string, meta?: any) => logger.error(message, meta),
  warn: (message: string, meta?: any) => logger.warn(message, meta),
  info: (message: string, meta?: any) => logger.info(message, meta),
  http: (message: string, meta?: any) => logger.http(message, meta),
  debug: (message: string, meta?: any) => logger.debug(message, meta),
  
  // Security-specific logging
  security: (message: string, meta?: any) => {
    logger.warn(message, { ...meta, security: true })
  },
  
  // Performance logging
  performance: (message: string, duration: number, meta?: any) => {
    logger.info(message, { ...meta, duration, performance: true })
  },
  
  // Request logging
  request: (req: Request, meta?: any) => {
    logger.http('HTTP Request', {
      correlationId: req.correlationId,
      method: req.method,
      url: req.url,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      userId: req.user?.id,
      ...meta,
    })
  },
  
  // Error logging with stack trace
  errorWithStack: (error: Error, meta?: any) => {
    logger.error(error.message, {
      ...meta,
      stack: error.stack,
      name: error.name,
    })
  },
}

// Performance timer utility
export class PerformanceTimer {
  private startTime: number
  private name: string

  constructor(name: string) {
    this.name = name
    this.startTime = Date.now()
  }

  end(meta?: any) {
    const duration = Date.now() - this.startTime
    log.performance(`${this.name} completed`, duration, meta)
    return duration
  }
}
```

### 2. Create Custom Error Classes
Create `backend/src/utils/errors.ts`:

```typescript
export class AppError extends Error {
  public readonly statusCode: number
  public readonly code: string
  public readonly isOperational: boolean
  public readonly details?: any

  constructor(
    message: string,
    statusCode: number,
    code: string,
    isOperational = true,
    details?: any
  ) {
    super(message)
    this.statusCode = statusCode
    this.code = code
    this.isOperational = isOperational
    this.details = details

    Error.captureStackTrace(this, this.constructor)
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 400, 'VALIDATION_ERROR', true, details)
  }
}

export class AuthenticationError extends AppError {
  constructor(message = 'Authentication failed', code = 'AUTH_FAILED') {
    super(message, 401, code, true)
  }
}

export class AuthorizationError extends AppError {
  constructor(message = 'Access denied', code = 'ACCESS_DENIED') {
    super(message, 403, code, true)
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    const message = id ? `${resource} with id ${id} not found` : `${resource} not found`
    super(message, 404, 'NOT_FOUND', true, { resource, id })
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 409, 'CONFLICT', true, details)
  }
}

export class RateLimitError extends AppError {
  constructor(retryAfter?: number) {
    super('Too many requests', 429, 'RATE_LIMIT_EXCEEDED', true, { retryAfter })
  }
}

export class ExternalServiceError extends AppError {
  constructor(service: string, originalError?: any) {
    super(
      `External service error: ${service}`,
      503,
      'EXTERNAL_SERVICE_ERROR',
      true,
      { service, originalError: originalError?.message }
    )
  }
}

export class DatabaseError extends AppError {
  constructor(operation: string, originalError?: any) {
    super(
      'Database operation failed',
      500,
      'DATABASE_ERROR',
      false,
      { operation, originalError: originalError?.message }
    )
  }
}

// Error factory for common scenarios
export const Errors = {
  validation: (message: string, details?: any) => new ValidationError(message, details),
  unauthorized: (message?: string) => new AuthenticationError(message),
  forbidden: (message?: string) => new AuthorizationError(message),
  notFound: (resource: string, id?: string) => new NotFoundError(resource, id),
  conflict: (message: string, details?: any) => new ConflictError(message, details),
  rateLimit: (retryAfter?: number) => new RateLimitError(retryAfter),
  externalService: (service: string, error?: any) => new ExternalServiceError(service, error),
  database: (operation: string, error?: any) => new DatabaseError(operation, error),
}
```

### 3. Update Error Handler Middleware
Update `backend/src/middleware/errorHandler.ts`:

```typescript
import { Request, Response, NextFunction } from 'express'
import { AppError } from '@/utils/errors'
import { log } from '@/utils/logger'
import { config } from '@/config'

// User-friendly error messages
const userFriendlyMessages: Record<string, string> = {
  VALIDATION_ERROR: 'Please check your input and try again.',
  AUTH_FAILED: 'Authentication failed. Please log in again.',
  ACCESS_DENIED: 'You do not have permission to perform this action.',
  NOT_FOUND: 'The requested resource was not found.',
  RATE_LIMIT_EXCEEDED: 'Too many requests. Please try again later.',
  EXTERNAL_SERVICE_ERROR: 'External service is temporarily unavailable.',
  DATABASE_ERROR: 'An error occurred while processing your request.',
  INTERNAL_ERROR: 'An unexpected error occurred. Please try again later.',
}

export function errorHandler(
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Log the error
  const errorMeta = {
    correlationId: req.correlationId,
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    userId: req.user?.id,
    body: config.env === 'development' ? req.body : undefined,
  }

  if (err instanceof AppError) {
    if (err.isOperational) {
      log.warn(`Operational error: ${err.message}`, {
        ...errorMeta,
        code: err.code,
        statusCode: err.statusCode,
        details: err.details,
      })
    } else {
      log.errorWithStack(err, {
        ...errorMeta,
        code: err.code,
        statusCode: err.statusCode,
        details: err.details,
      })
    }
  } else {
    // Unknown errors
    log.errorWithStack(err, errorMeta)
  }

  // Prepare response
  let statusCode = 500
  let code = 'INTERNAL_ERROR'
  let message = userFriendlyMessages.INTERNAL_ERROR
  let details: any

  if (err instanceof AppError) {
    statusCode = err.statusCode
    code = err.code
    message = userFriendlyMessages[code] || err.message
    
    if (config.env === 'development' || err.isOperational) {
      details = err.details
    }
  }

  // Handle Prisma errors
  if (err.name === 'PrismaClientKnownRequestError') {
    const prismaError = err as any
    switch (prismaError.code) {
      case 'P2002':
        statusCode = 409
        code = 'DUPLICATE_ENTRY'
        message = 'This record already exists.'
        break
      case 'P2025':
        statusCode = 404
        code = 'NOT_FOUND'
        message = 'Record not found.'
        break
      default:
        statusCode = 400
        code = 'DATABASE_ERROR'
        message = 'Database operation failed.'
    }
  }

  // Send response
  res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
      correlationId: req.correlationId,
      ...(details && { details }),
      ...(config.env === 'development' && {
        stack: err.stack,
        originalError: err.message,
      }),
    },
  })
}

// Async error wrapper
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next)
  }
}

// Not found handler
export function notFoundHandler(req: Request, res: Response) {
  const error = new AppError(
    `Cannot ${req.method} ${req.url}`,
    404,
    'ROUTE_NOT_FOUND',
    true
  )
  
  log.warn('Route not found', {
    correlationId: req.correlationId,
    method: req.method,
    url: req.url,
    ip: req.ip,
  })

  res.status(404).json({
    success: false,
    error: {
      code: error.code,
      message: 'The requested endpoint does not exist.',
      correlationId: req.correlationId,
    },
  })
}
```

### 4. Create Request Logger Middleware
Create `backend/src/middleware/requestLogger.ts`:

```typescript
import { Request, Response, NextFunction } from 'express'
import { log, PerformanceTimer } from '@/utils/logger'

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const timer = new PerformanceTimer(`${req.method} ${req.path}`)
  
  // Log request
  log.request(req, {
    query: req.query,
    params: req.params,
  })

  // Capture response
  const originalSend = res.send
  res.send = function (data) {
    res.send = originalSend
    
    // Log response
    timer.end({
      correlationId: req.correlationId,
      statusCode: res.statusCode,
      userId: req.user?.id,
    })

    // Log errors
    if (res.statusCode >= 400) {
      log.warn(`HTTP Error Response`, {
        correlationId: req.correlationId,
        statusCode: res.statusCode,
        method: req.method,
        url: req.url,
        userId: req.user?.id,
      })
    }

    return res.send(data)
  }

  next()
}
```

### 5. Create Audit Logger
Create `backend/src/utils/audit-logger.ts`:

```typescript
import { prisma } from './database'
import { log } from './logger'

export interface AuditLogEntry {
  userId: string
  action: string
  entityType?: string
  entityId?: string
  oldValue?: any
  newValue?: any
  metadata?: any
  ipAddress?: string
  userAgent?: string
}

export class AuditLogger {
  static async log(entry: AuditLogEntry) {
    try {
      await prisma.activityLog.create({
        data: {
          userId: entry.userId,
          action: entry.action,
          entityType: entry.entityType,
          entityId: entry.entityId,
          metadata: {
            oldValue: entry.oldValue,
            newValue: entry.newValue,
            ...entry.metadata,
          },
          ipAddress: entry.ipAddress,
          userAgent: entry.userAgent,
        },
      })

      // Also log to file for important actions
      if (this.isImportantAction(entry.action)) {
        log.security(`Audit: ${entry.action}`, {
          userId: entry.userId,
          entityType: entry.entityType,
          entityId: entry.entityId,
          ipAddress: entry.ipAddress,
        })
      }
    } catch (error) {
      log.error('Failed to create audit log', { error, entry })
    }
  }

  static async logRequest(req: any, action: string, details?: any) {
    await this.log({
      userId: req.user?.id || 'anonymous',
      action,
      metadata: details,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    })
  }

  private static isImportantAction(action: string): boolean {
    const importantActions = [
      'user_delete',
      'admin_login',
      'permission_change',
      'config_update',
      'security_event',
    ]
    return importantActions.includes(action)
  }
}

// Audit decorator for methods
export function Audit(action: string) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value

    descriptor.value = async function (...args: any[]) {
      const req = args[0] // Assuming first argument is request
      const startTime = Date.now()

      try {
        const result = await originalMethod.apply(this, args)
        
        // Log successful action
        await AuditLogger.logRequest(req, action, {
          method: propertyKey,
          duration: Date.now() - startTime,
          success: true,
        })

        return result
      } catch (error) {
        // Log failed action
        await AuditLogger.logRequest(req, action, {
          method: propertyKey,
          duration: Date.now() - startTime,
          success: false,
          error: error.message,
        })

        throw error
      }
    }

    return descriptor
  }
}
```

### 6. Create Service Error Wrapper
Create `backend/src/utils/service-wrapper.ts`:

```typescript
import { log, PerformanceTimer } from './logger'
import { Errors } from './errors'

export interface ServiceOptions {
  name: string
  timeout?: number
  retries?: number
  fallback?: () => any
}

export function serviceMethod(options: ServiceOptions) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value

    descriptor.value = async function (...args: any[]) {
      const timer = new PerformanceTimer(`${options.name}.${propertyKey}`)
      let lastError: any

      for (let attempt = 1; attempt <= (options.retries || 1); attempt++) {
        try {
          const result = await Promise.race([
            originalMethod.apply(this, args),
            ...(options.timeout ? [
              new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Timeout')), options.timeout)
              )
            ] : [])
          ])

          timer.end({ success: true, attempt })
          return result
        } catch (error) {
          lastError = error
          
          log.warn(`Service method failed`, {
            service: options.name,
            method: propertyKey,
            attempt,
            error: error.message,
          })

          if (attempt < (options.retries || 1)) {
            // Exponential backoff
            const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000)
            await new Promise(resolve => setTimeout(resolve, delay))
          }
        }
      }

      timer.end({ success: false, error: lastError.message })

      // Use fallback if available
      if (options.fallback) {
        log.info(`Using fallback for ${options.name}.${propertyKey}`)
        return options.fallback()
      }

      // Throw appropriate error
      throw Errors.externalService(options.name, lastError)
    }

    return descriptor
  }
}
```

### 7. Create Monitoring Service
Create `backend/src/services/monitoring.service.ts`:

```typescript
import { log } from '@/utils/logger'
import { redis } from '@/lib/redis/client'
import os from 'os'

export interface SystemMetrics {
  cpu: {
    usage: number
    loadAverage: number[]
  }
  memory: {
    total: number
    used: number
    free: number
    percentage: number
  }
  uptime: number
  timestamp: Date
}

export class MonitoringService {
  private static readonly METRICS_KEY = 'system:metrics'
  private static readonly METRICS_TTL = 300 // 5 minutes

  static async collectMetrics(): Promise<SystemMetrics> {
    const cpus = os.cpus()
    const totalMemory = os.totalmem()
    const freeMemory = os.freemem()
    const usedMemory = totalMemory - freeMemory

    const metrics: SystemMetrics = {
      cpu: {
        usage: this.calculateCPUUsage(cpus),
        loadAverage: os.loadavg(),
      },
      memory: {
        total: totalMemory,
        used: usedMemory,
        free: freeMemory,
        percentage: (usedMemory / totalMemory) * 100,
      },
      uptime: process.uptime(),
      timestamp: new Date(),
    }

    // Store in Redis
    await redis.setex(
      this.METRICS_KEY,
      this.METRICS_TTL,
      JSON.stringify(metrics)
    )

    // Log if thresholds exceeded
    if (metrics.memory.percentage > 90) {
      log.warn('High memory usage detected', metrics.memory)
    }

    if (metrics.cpu.loadAverage[0] > cpus.length * 0.8) {
      log.warn('High CPU load detected', metrics.cpu)
    }

    return metrics
  }

  private static calculateCPUUsage(cpus: os.CpuInfo[]): number {
    let totalIdle = 0
    let totalTick = 0

    cpus.forEach(cpu => {
      for (const type in cpu.times) {
        totalTick += cpu.times[type as keyof os.CpuTimes]
      }
      totalIdle += cpu.times.idle
    })

    return 100 - ~~(100 * totalIdle / totalTick)
  }

  static async getMetrics(): Promise<SystemMetrics | null> {
    try {
      const cached = await redis.get(this.METRICS_KEY)
      return cached ? JSON.parse(cached) : null
    } catch (error) {
      log.error('Failed to get metrics', error)
      return null
    }
  }

  static startMetricsCollection(intervalMs = 60000) {
    setInterval(async () => {
      try {
        await this.collectMetrics()
      } catch (error) {
        log.error('Metrics collection failed', error)
      }
    }, intervalMs)

    log.info('Metrics collection started', { interval: intervalMs })
  }
}
```

### 8. Update Main Application
Update `backend/src/index.ts`:

```typescript
import { errorHandler, notFoundHandler } from './middleware/errorHandler'
import { requestLogger } from './middleware/requestLogger'
import { MonitoringService } from './services/monitoring.service'

// Add request logger after correlation ID
app.use(correlationId)
app.use(requestLogger)

// ... other middleware and routes ...

// Error handlers (must be last)
app.use(notFoundHandler)
app.use(errorHandler)

// Start monitoring
if (config.env === 'production') {
  MonitoringService.startMetricsCollection()
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  log.errorWithStack(error, { type: 'uncaughtException' })
  process.exit(1)
})

process.on('unhandledRejection', (reason, promise) => {
  log.error('Unhandled Promise Rejection', {
    reason,
    promise,
    type: 'unhandledRejection',
  })
})
```

### 9. Create Log Viewer Endpoint (Admin Only)
Create `backend/src/controllers/logs.controller.ts`:

```typescript
import { Request, Response } from 'express'
import { asyncHandler } from '@/middleware/errorHandler'
import fs from 'fs/promises'
import path from 'path'

export class LogsController {
  getLogs = asyncHandler(async (req: Request, res: Response) => {
    const { type = 'application', date = new Date().toISOString().split('T')[0] } = req.query

    const logFile = path.join(process.cwd(), 'logs', `${type}-${date}.log`)

    try {
      const content = await fs.readFile(logFile, 'utf-8')
      const logs = content
        .split('\n')
        .filter(line => line)
        .map(line => {
          try {
            return JSON.parse(line)
          } catch {
            return { message: line }
          }
        })
        .slice(-1000) // Last 1000 entries

      res.json({
        success: true,
        data: {
          file: `${type}-${date}.log`,
          entries: logs,
        },
      })
    } catch (error) {
      res.status(404).json({
        success: false,
        error: {
          code: 'LOG_FILE_NOT_FOUND',
          message: 'Log file not found',
        },
      })
    }
  })
}

export const logsController = new LogsController()
```

## Verification Steps
1. Test structured logging output
2. Verify correlation IDs in logs
3. Test error handling with various error types
4. Check log rotation after size limit
5. Verify audit logs for important actions
6. Test performance logging
7. Monitor system metrics collection

## Testing Requirements
- [ ] Unit tests for custom error classes
- [ ] Unit tests for error handler middleware
- [ ] Unit tests for logging utilities
- [ ] Unit tests for audit logger
- [ ] Integration tests for error propagation
- [ ] Test correlation ID generation and tracking
- [ ] Test log rotation functionality
- [ ] Test different log levels and filtering
- [ ] Test error serialization and sanitization
- [ ] Test performance logging accuracy
- [ ] Test system metrics collection
- [ ] Verify sensitive data is not logged
- [ ] Test coverage should exceed 80% for error handling and logging
- [ ] All tests must pass before marking task complete

## Common Issues & Solutions
- **Log files not created**: Check write permissions
- **Performance impact**: Adjust log levels
- **Large log files**: Configure rotation properly
- **Missing correlation IDs**: Check middleware order

## Notes
- Logs are structured as JSON for easy parsing
- Security events logged separately for compliance
- Performance metrics help identify bottlenecks
- Audit logs required for admin actions

## Related Documentation
- [Winston Documentation](https://github.com/winstonjs/winston)
- [Error Handling Strategy](/docs/ERROR_HANDLING_LOGGING_STRATEGY.md)
- [Monitoring Guide](/docs/MONITORING.md)