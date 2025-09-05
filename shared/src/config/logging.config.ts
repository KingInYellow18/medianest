import { createLogger, format, transports, Logger } from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { v4 as uuidv4 } from 'uuid';

import type { CompleteConfig } from './base.config';

/**
 * Log Level Enumeration
 */
export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug',
  VERBOSE = 'verbose',
}

/**
 * Log Context Interface
 */
export interface LogContext {
  correlationId?: string;
  userId?: string;
  requestId?: string;
  service?: string;
  component?: string;
  method?: string;
  duration?: number;
  [key: string]: unknown;
}

/**
 * Structured Log Entry Interface
 */
export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
    cause?: unknown;
  };
  metadata?: Record<string, unknown>;
}

/**
 * Logger Configuration Options
 */
export interface LoggerConfigOptions {
  service: string;
  level?: LogLevel;
  format?: 'json' | 'simple';
  logsDir?: string;
  enableConsole?: boolean;
  enableFile?: boolean;
  enableRotation?: boolean;
  maxFiles?: number;
  maxSize?: string;
  correlationId?: string;
}

/**
 * Centralized Logging Configuration
 */
export class LoggingConfig {
  private static instance: LoggingConfig | null = null;
  private loggers: Map<string, Logger> = new Map();
  private globalContext: LogContext = {};

  private constructor() {}

  /**
   * Singleton instance getter
   */
  public static getInstance(): LoggingConfig {
    if (!LoggingConfig.instance) {
      LoggingConfig.instance = new LoggingConfig();
    }
    return LoggingConfig.instance;
  }

  /**
   * Create or get a logger for a specific service/component
   */
  public createLogger(options: LoggerConfigOptions): Logger {
    const {
      service,
      level = LogLevel.INFO,
      format: logFormat = 'json',
      logsDir = this.getDefaultLogsDir(),
      enableConsole = true,
      enableFile = true,
      enableRotation = true,
      maxFiles = 7,
      maxSize = '20m',
      correlationId,
    } = options;

    const loggerKey = `${service}-${level}-${logFormat}`;
    
    // Return existing logger if available
    if (this.loggers.has(loggerKey)) {
      return this.loggers.get(loggerKey)!;
    }

    // Ensure logs directory exists
    this.ensureLogsDirectory(logsDir);

    // Create logger instance
    const logger = createLogger({
      level,
      defaultMeta: { 
        service,
        ...this.globalContext,
        ...(correlationId && { correlationId }),
      },
      format: format.combine(
        format.errors({ stack: true }),
        format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
        format.splat(),
        this.createLogFormat(logFormat)
      ),
      transports: this.createTransports({
        service,
        level,
        logsDir,
        enableConsole,
        enableFile,
        enableRotation,
        maxFiles,
        maxSize,
        logFormat,
      }),
      exceptionHandlers: enableFile ? [
        new transports.File({
          filename: join(logsDir, `${service}-exceptions.log`),
          maxsize: 10485760, // 10MB
          maxFiles: 3,
        }),
      ] : [],
      rejectionHandlers: enableFile ? [
        new transports.File({
          filename: join(logsDir, `${service}-rejections.log`),
          maxsize: 10485760, // 10MB
          maxFiles: 3,
        }),
      ] : [],
    });

    // Cache logger
    this.loggers.set(loggerKey, logger);
    return logger;
  }

  /**
   * Create logger from environment configuration
   */
  public createLoggerFromConfig(
    config: CompleteConfig,
    service: string,
    additionalOptions: Partial<LoggerConfigOptions> = {}
  ): Logger {
    return this.createLogger({
      service,
      level: config.LOG_LEVEL as LogLevel,
      format: config.LOG_FORMAT as 'json' | 'simple',
      maxFiles: config.LOG_MAX_FILES,
      maxSize: config.LOG_MAX_SIZE,
      ...additionalOptions,
    });
  }

  /**
   * Create child logger with additional context
   */
  public createChildLogger(
    parentLogger: Logger,
    context: LogContext
  ): Logger {
    return parentLogger.child(context);
  }

  /**
   * Set global context for all loggers
   */
  public setGlobalContext(context: LogContext): void {
    this.globalContext = { ...this.globalContext, ...context };
    
    // Update existing loggers
    this.loggers.forEach((logger) => {
      logger.defaultMeta = { ...logger.defaultMeta, ...context };
    });
  }

  /**
   * Clear global context
   */
  public clearGlobalContext(): void {
    this.globalContext = {};
  }

  /**
   * Get stream for HTTP request logging (Express/Morgan)
   */
  public getHttpStream(logger: Logger) {
    return {
      write: (message: string) => {
        logger.info(message.trim());
      },
    };
  }

  /**
   * Create log format based on environment
   */
  private createLogFormat(logFormat: 'json' | 'simple') {
    if (logFormat === 'simple') {
      return format.printf(({ level, message, timestamp, correlationId, service, ...meta }) => {
        const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
        const corrId = correlationId ? `[${correlationId}]` : '[no-correlation-id]';
        const svc = service ? `[${service}]` : '';
        return `${timestamp} ${corrId}${svc} ${level}: ${message}${metaStr}`;
      });
    }

    return format.combine(
      format.json(),
      format.prettyPrint({ depth: 3 })
    );
  }

  /**
   * Create transport configurations
   */
  private createTransports({
    service,
    level,
    logsDir,
    enableConsole,
    enableFile,
    enableRotation,
    maxFiles,
    maxSize,
    logFormat,
  }: {
    service: string;
    level: LogLevel;
    logsDir: string;
    enableConsole: boolean;
    enableFile: boolean;
    enableRotation: boolean;
    maxFiles: number;
    maxSize: string;
    logFormat: 'json' | 'simple';
  }) {
    const transportList: any[] = [];

    // Console transport
    if (enableConsole) {
      transportList.push(
        new transports.Console({
          level: process.env.NODE_ENV === 'production' ? LogLevel.INFO : LogLevel.DEBUG,
          format: process.env.NODE_ENV === 'development' && logFormat === 'simple'
            ? format.combine(
                format.colorize(),
                this.createLogFormat('simple')
              )
            : undefined,
        })
      );
    }

    // File transports
    if (enableFile) {
      // Error log file
      transportList.push(
        new transports.File({
          filename: join(logsDir, `${service}-error.log`),
          level: LogLevel.ERROR,
          maxsize: 10485760, // 10MB
          maxFiles: 5,
        })
      );

      // Combined log file
      if (enableRotation) {
        transportList.push(
          new DailyRotateFile({
            filename: join(logsDir, `${service}-%DATE%.log`),
            datePattern: 'YYYY-MM-DD',
            maxSize,
            maxFiles: `${maxFiles}d`,
            level,
            auditFile: join(logsDir, `${service}-audit.json`),
          })
        );
      } else {
        transportList.push(
          new transports.File({
            filename: join(logsDir, `${service}-combined.log`),
            level,
            maxsize: 20971520, // 20MB
            maxFiles: maxFiles,
          })
        );
      }
    }

    return transportList;
  }

  /**
   * Get default logs directory
   */
  private getDefaultLogsDir(): string {
    return join(process.cwd(), 'logs');
  }

  /**
   * Ensure logs directory exists
   */
  private ensureLogsDirectory(logsDir: string): void {
    if (!existsSync(logsDir)) {
      mkdirSync(logsDir, { recursive: true });
    }
  }
}

// Convenience functions
export const logging = LoggingConfig.getInstance();

/**
 * Create service logger with correlation ID support
 */
export function createServiceLogger(
  service: string,
  options?: Partial<LoggerConfigOptions>
): Logger {
  return logging.createLogger({
    service,
    correlationId: uuidv4(),
    ...options,
  });
}

/**
 * Create child logger with correlation ID
 */
export function createCorrelatedLogger(
  parentLogger: Logger,
  correlationId?: string
): Logger {
  return logging.createChildLogger(parentLogger, {
    correlationId: correlationId || uuidv4(),
  });
}

/**
 * Create performance logger with timing utilities
 */
export function createPerformanceLogger(logger: Logger) {
  return {
    ...logger,
    time: (label: string, context?: LogContext) => {
      const startTime = Date.now();
      return {
        end: (additionalContext?: LogContext) => {
          const duration = Date.now() - startTime;
          logger.info(`Performance: ${label}`, {
            duration,
            label,
            ...context,
            ...additionalContext,
          });
        },
      };
    },
  };
}

// Export types and utilities
export { LogLevel, type LogContext, type LogEntry, type LoggerConfigOptions };