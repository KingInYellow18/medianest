import { Request, Response, NextFunction } from 'express';
import fs from 'fs/promises';
import path from 'path';
import { logger } from '../utils/logger';

interface SecurityEvent {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'critical';
  category: 'authentication' | 'authorization' | 'data_access' | 'system' | 'user_action';
  event: string;
  userId?: string;
  sessionId?: string;
  ipAddress: string;
  userAgent: string;
  resource?: string;
  action?: string;
  outcome: 'success' | 'failure' | 'blocked';
  riskScore?: number;
  details: Record<string, any>;
  correlationId?: string;
}

interface AuditConfig {
  logFile?: string;
  maxFileSize?: number;
  maxFiles?: number;
  logToConsole?: boolean;
  logToFile?: boolean;
  logToDatabase?: boolean;
  sensitiveFields?: string[];
}

declare global {
  namespace Express {
    interface Request {
      user?: { id: string };
      correlationId?: string;
    }
  }
}

class SecurityAuditLogger {
  private config: AuditConfig;
  private logBuffer: SecurityEvent[] = [];
  private bufferSize = 100;
  private flushInterval = 30000;

  constructor(config: AuditConfig = {}) {
    this.config = {
      logFile: path.join(process.cwd(), 'logs', 'security-audit.log'),
      maxFileSize: 10 * 1024 * 1024,
      maxFiles: 10,
      logToConsole: process.env.NODE_ENV !== 'production',
      logToFile: true,
      logToDatabase: false,
      sensitiveFields: ['password', 'token', 'secret', 'key', 'hash'],
      ...config,
    };

    setInterval(() => this.flushBuffer(), this.flushInterval);
    this.ensureLogDirectory();
  }

  async logEvent(event: Partial<SecurityEvent>): Promise<void> {
    const fullEvent: SecurityEvent = {
      id: this.generateEventId(),
      timestamp: new Date().toISOString(),
      level: event.level || 'info',
      category: event.category || 'system',
      event: event.event || 'unknown',
      userId: event.userId,
      sessionId: event.sessionId,
      ipAddress: event.ipAddress || '',
      userAgent: event.userAgent || '',
      resource: event.resource,
      action: event.action,
      outcome: event.outcome || 'success',
      riskScore: event.riskScore,
      details: this.sanitizeDetails(event.details || {}),
      correlationId: event.correlationId,
    };

    this.logBuffer.push(fullEvent);

    if (this.config.logToConsole) {
      this.logToConsole(fullEvent);
    }

    if (fullEvent.level === 'critical' || this.logBuffer.length >= this.bufferSize) {
      await this.flushBuffer();
    }
  }

  private async flushBuffer(): Promise<void> {
    if (this.logBuffer.length === 0) return;

    const events = [...this.logBuffer];
    this.logBuffer = [];

    try {
      if (this.config.logToFile) {
        await this.logToFile(events);
      }

      if (this.config.logToDatabase) {
        await this.logToDatabase(events);
      }
    } catch (error: any) {
      logger.error('Failed to flush security audit buffer', { error, eventsCount: events.length });
      this.logBuffer.unshift(...events);
    }
  }

  private logToConsole(event: SecurityEvent): void {
    const logMessage = `[SECURITY AUDIT] ${event.level.toUpperCase()} - ${event.category}:${event.event}`;
    const logData = {
      id: event.id,
      timestamp: event.timestamp,
      userId: event.userId,
      ipAddress: event.ipAddress,
      outcome: event.outcome,
      details: event.details,
    };

    switch (event.level) {
      case 'critical':
      case 'error':
        console.error(logMessage, logData);
        break;
      case 'warn':
        console.warn(logMessage, logData);
        break;
      default:
        console.log(logMessage, logData);
    }
  }

  private async logToFile(events: SecurityEvent[]): Promise<void> {
    if (!this.config.logFile) return;

    const logEntries = events.map((event) => JSON.stringify(event)).join('\n') + '\n';

    try {
      await this.rotateLogFileIfNeeded();
      await fs.appendFile(this.config.logFile, logEntries, 'utf8');
    } catch (error: any) {
      logger.error('Failed to write security audit log to file', {
        error,
        logFile: this.config.logFile,
        eventsCount: events.length,
      });
      throw error;
    }
  }

  private async logToDatabase(_events: SecurityEvent[]): Promise<void> {
    // TODO: Implement database logging
  }

  private async rotateLogFileIfNeeded(): Promise<void> {
    if (!this.config.logFile || !this.config.maxFileSize) return;

    try {
      const stats = await fs.stat(this.config.logFile);
      if (stats.size >= this.config.maxFileSize) {
        await this.rotateLogFile();
      }
    } catch (error: any) {
      if (((error as any).code as any) !== 'ENOENT') {
        logger.warn('Error checking log file size', { error, logFile: this.config.logFile });
      }
    }
  }

  private async rotateLogFile(): Promise<void> {
    if (!this.config.logFile || !this.config.maxFiles) return;

    const logDir = path.dirname(this.config.logFile);
    const logName = path.basename(this.config.logFile, '.log');

    try {
      for (let i = this.config.maxFiles - 1; i > 0; i--) {
        const currentFile = path.join(logDir, `${logName}.${i}.log`);
        const nextFile = path.join(logDir, `${logName}.${i + 1}.log`);

        try {
          await fs.access(currentFile);
          if (i === this.config.maxFiles - 1) {
            await fs.unlink(currentFile);
          } else {
            await fs.rename(currentFile, nextFile);
          }
        } catch {
          // File doesn't exist, skip
        }
      }

      const rotatedFile = path.join(logDir, `${logName}.1.log`);
      await fs.rename(this.config.logFile, rotatedFile);

      logger.info('Security audit log file rotated', {
        originalFile: this.config.logFile,
        rotatedFile,
      });
    } catch (error: any) {
      logger.error('Failed to rotate security audit log file', {
        error,
        logFile: this.config.logFile,
      });
      throw error;
    }
  }

  private async ensureLogDirectory(): Promise<void> {
    if (!this.config.logFile) return;

    const logDir = path.dirname(this.config.logFile);

    try {
      await fs.access(logDir);
    } catch {
      try {
        await fs.mkdir(logDir, { recursive: true });
        logger.info('Created security audit log directory', { logDir });
      } catch (error: any) {
        logger.error('Failed to create log directory', { error, logDir });
      }
    }
  }

  private generateEventId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private sanitizeDetails(details: Record<string, any>): Record<string, any> {
    const sensitiveFields = this.config.sensitiveFields || [];

    const sanitizeValue = (obj: any, key: string): any => {
      if (sensitiveFields.some((field) => key.toLowerCase().includes(field.toLowerCase()))) {
        return '[REDACTED]';
      }
      return obj;
    };

    const sanitizeObject = (obj: any): any => {
      if (obj === null || obj === undefined) return obj;

      if (Array.isArray(obj)) {
        return obj.map(sanitizeObject);
      }

      if (typeof obj === 'object') {
        const result: any = {};
        for (const [key, value] of Object.entries(obj)) {
          result[key] = sanitizeValue(sanitizeObject(value), key);
        }
        return result;
      }

      return obj;
    };

    return sanitizeObject(details);
  }
}

const auditLogger = new SecurityAuditLogger();

export function securityAuditMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();

    const originalJson = res.json.bind(res);
    const originalStatus = res.status.bind(res);

    let statusCode = 200;
    let responseBody: any;

    res.status = function (code: number) {
      statusCode = code;
      return originalStatus(code);
    };

    res.json = function (body: any) {
      responseBody = body;
      return originalJson(body);
    };

    res.on('finish', async () => {
      const duration = Date.now() - startTime;
      const outcome = statusCode < 400 ? 'success' : statusCode < 500 ? 'failure' : 'blocked';

      let category: SecurityEvent['category'] = 'system';
      if (req.path.includes('/auth/')) {
        category = statusCode === 401 || statusCode === 403 ? 'authorization' : 'authentication';
      } else if (req.method !== 'GET') {
        category = 'data_access';
      } else {
        category = 'user_action';
      }

      let riskScore = 0;
      if (statusCode === 401) riskScore += 20;
      if (statusCode === 403) riskScore += 30;
      if (statusCode >= 500) riskScore += 10;
      if (req.method === 'DELETE') riskScore += 15;
      if (req.path.includes('/admin/')) riskScore += 25;

      const event: Partial<SecurityEvent> = {
        level: statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info',
        category,
        event: `${req.method} ${req.path}`,
        userId: req.user?.id,
        sessionId: (req as any).sessionID,
        ipAddress: req.ip || req.socket.remoteAddress || '',
        userAgent: req.get('user-agent') || '',
        resource: req.path,
        action: req.method,
        outcome,
        riskScore,
        details: {
          statusCode,
          duration,
          contentLength: res.get('content-length'),
          query: req.query,
          params: req.params,
          referer: req.get('referer'),
          origin: req.get('origin'),
          ...(statusCode >= 400 && responseBody ? { error: responseBody } : {}),
        },
        correlationId: req.correlationId,
      };

      try {
        await auditLogger.logEvent(event);
      } catch (error: any) {
        logger.error('Failed to log security audit event', { error, event });
      }
    });

    next();
  };
}

export function logAuthEvent(
  event: string,
  req: Request,
  outcome: 'success' | 'failure' | 'blocked',
  details: Record<string, any> = {},
): void {
  auditLogger.logEvent({
    level: outcome === 'success' ? 'info' : 'warn',
    category: 'authentication',
    event,
    userId: req.user?.id,
    sessionId: (req as any).sessionID,
    ipAddress: req.ip || req.socket.remoteAddress || '',
    userAgent: req.get('user-agent') || '',
    outcome,
    details: {
      path: req.path,
      method: req.method,
      ...details,
    },
    correlationId: req.correlationId,
  });
}

export { auditLogger as SecurityAuditLogger };
