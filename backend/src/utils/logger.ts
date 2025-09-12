import * as fs from 'fs';
import * as path from 'path';

import * as winston from 'winston';
const DailyRotateFile = require('winston-daily-rotate-file');

// Winston type extensions are automatically available from types/winston.d.ts

const generateCorrelationId = () => Math.random().toString(36).substr(2, 9);

// Ensure logs directory exists
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Define log format for development
const devFormat = winston.format.printf((info: any) => {
  const { level, message, timestamp, correlationId, ...meta } = info;
  const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
  return `${timestamp} [${correlationId || 'no-correlation-id'}] ${level}: ${message}${metaStr}`;
});

// Define log format for production (Loki-compatible structured JSON)
const prodFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json(),
  // Add Loki-compatible labels and structure
  winston.format.printf((info: any) => {
    const { timestamp, level, message, correlationId, service, ...meta } = info;
    const logEntry: any = {
      timestamp,
      level,
      message,
      service: service || 'medianest-backend',
      correlationId: correlationId || 'no-correlation-id',
      environment: process.env.NODE_ENV || 'development',
      ...meta,
    };

    // Add request context if available
    if (meta.req) {
      logEntry.requestId = meta.req.id;
      logEntry.method = meta.req.method;
      logEntry.url = meta.req.url;
      logEntry.ip = meta.req.ip;
      logEntry.userAgent = meta.req.get?.('User-Agent');
      logEntry.userId = meta.req.user?.id;
      delete logEntry.req; // Remove raw request object
    }

    // Add response context if available
    if (meta.res) {
      logEntry.statusCode = meta.res.statusCode;
      logEntry.responseTime = meta.responseTime;
      delete logEntry.res; // Remove raw response object
    }

    // Ensure stack traces are preserved for errors
    if (meta.stack) {
      logEntry.stack = meta.stack;
    }

    return JSON.stringify(logEntry);
  }),
);

// Create the logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.errors({ stack: true }),
    winston.format.timestamp(),
    process.env.NODE_ENV === 'development' ? devFormat : prodFormat,
  ),
  defaultMeta: { service: 'medianest-backend' },
  transports: [
    // Console transport (JSON for production, colored for development)
    new winston.transports.Console({
      level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
      format:
        process.env.NODE_ENV === 'development'
          ? winston.format.combine(winston.format.colorize(), devFormat)
          : prodFormat, // Use structured JSON format for production console logs
    }),

    // Error file transport
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: 10485760, // 10MB
      maxFiles: 5,
    }),

    // Combined file transport with daily rotation
    new DailyRotateFile({
      filename: path.join(logsDir, 'application-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d',
      level: 'info',
    }),
  ],
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, 'exceptions.log'),
      maxsize: 10485760,
      maxFiles: 5,
    }),
  ],
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, 'rejections.log'),
      maxsize: 10485760,
      maxFiles: 5,
    }),
  ],
});

// Create child logger with correlation ID
export function createChildLogger(correlationId?: string): winston.Logger {
  return logger.child({ correlationId: correlationId || generateCorrelationId() });
}

// Create structured logger for request/response logging
export function createRequestLogger(req: any, correlationId?: string): winston.Logger {
  const requestId = req.id || generateCorrelationId();
  return logger.child({
    correlationId: correlationId || generateCorrelationId(),
    requestId,
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get?.('User-Agent'),
    userId: req.user?.id,
  });
}

// Log performance metrics
export function logPerformance(
  operation: string,
  duration: number,
  metadata?: Record<string, any>,
  correlationId?: string,
): void {
  logger.info(`Performance: ${operation}`, {
    correlationId: correlationId || generateCorrelationId(),
    operation,
    duration,
    unit: 'ms',
    ...metadata,
  });
}

// Log security events
export function logSecurityEvent(
  event: string,
  severity: 'low' | 'medium' | 'high' | 'critical',
  details: Record<string, any>,
  correlationId?: string,
): void {
  logger.warn(`Security Event: ${event}`, {
    correlationId: correlationId || generateCorrelationId(),
    securityEvent: event,
    severity,
    ...details,
  });
}

// Log business metrics
export function logBusinessMetric(
  metric: string,
  value: number,
  unit: string,
  tags?: Record<string, any>,
  correlationId?: string,
): void {
  logger.info(`Business Metric: ${metric}`, {
    correlationId: correlationId || generateCorrelationId(),
    metric,
    value,
    unit,
    ...tags,
  });
}

// Create a stream object with a 'write' function for Morgan/Express logging
export const stream = {
  write: (message: string) => {
    // Parse Morgan log format to extract structured data
    const trimmed = message.trim();
    const match = trimmed.match(
      /^(\S+) (\S+) (\S+) \[([^\]]+)\] "(\S+) (\S+) (\S+)" (\d+) (\d+|-) "([^"]*)" "([^"]*)"/,
    );

    if (match) {
      const [
        ,
        remoteAddr,
        ,
        remoteUser,
        timestamp,
        method,
        url,
        version,
        status,
        size,
        referer,
        userAgent,
      ] = match;
      logger.info('HTTP Request', {
        ip: remoteAddr,
        method,
        url,
        version,
        statusCode: status ? parseInt(status, 10) : 0,
        responseSize: size === '-' ? 0 : size ? parseInt(size, 10) : 0,
        referer: referer === '-' ? undefined : referer,
        userAgent: userAgent === '-' ? undefined : userAgent,
      });
    } else {
      logger.info(trimmed);
    }
  },
};

// Export the main logger
export { logger };
// Test comment
