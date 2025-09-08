import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { AppError } from '@medianest/shared';
import { logger } from '../utils/logger';

// CSRF Protection Middleware
export function csrfProtection() {
  return (req: Request, res: Response, next: NextFunction) => {
    // Skip CSRF for GET requests and safe methods
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      return next();
    }

    // Skip CSRF for API endpoints using Bearer tokens
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      return next();
    }

    // Check for CSRF token in headers or body
    const csrfToken = (req.headers['x-csrf-token'] as string) || req.body._csrf;
    const sessionCsrfToken = (req as any).session?.csrfToken;

    if (!csrfToken || !sessionCsrfToken || csrfToken !== sessionCsrfToken) {
      logger.warn('CSRF token validation failed', {
        ip: req.ip,
        userAgent: req.get('user-agent'),
        path: req.path,
        method: req.method,
        correlationId: req.correlationId,
      });
      throw new AppError('CSRF_INVALID', 'Invalid CSRF token', 403);
    }

    next();
  };
}

// Generate CSRF token
export function generateCSRFToken(req: Request): string {
  const token = crypto.randomBytes(32).toString('hex');
  if ((req as any).session) {
    (req as any).session.csrfToken = token;
  }
  return token;
}

// Security Headers Middleware
export function securityHeaders() {
  return (req: Request, res: Response, next: NextFunction) => {
    // Content Security Policy
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' https:; connect-src 'self' https:; frame-ancestors 'none';"
    );

    // X-Frame-Options
    res.setHeader('X-Frame-Options', 'DENY');

    // X-Content-Type-Options
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // X-XSS-Protection
    res.setHeader('X-XSS-Protection', '1; mode=block');

    // Referrer Policy
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    // Permissions Policy
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');

    // Cross-Origin-Embedder-Policy
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');

    // Cross-Origin-Opener-Policy
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');

    // Cross-Origin-Resource-Policy
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');

    next();
  };
}

// Input Sanitization Middleware
export function sanitizeInput() {
  return (req: Request, res: Response, next: NextFunction) => {
    // Sanitize request body
    if (req.body && typeof req.body === 'object') {
      req.body = sanitizeObject(req.body);
    }

    // Sanitize query parameters
    if (req.query && typeof req.query === 'object') {
      req.query = sanitizeObject(req.query);
    }

    // Sanitize route parameters
    if (req.params && typeof req.params === 'object') {
      req.params = sanitizeObject(req.params);
    }

    next();
  };
}

// Sanitize object recursively
function sanitizeObject(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  }

  if (typeof obj === 'object') {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      const sanitizedKey = sanitizeString(key);
      sanitized[sanitizedKey] = sanitizeObject(value);
    }
    return sanitized;
  }

  if (typeof obj === 'string') {
    return sanitizeString(obj);
  }

  return obj;
}

// Sanitize string input
function sanitizeString(input: string): string {
  return input
    .replace(/<script[^>]*>.*?<\/script>/gi, '') // Remove script tags
    .replace(/<[^>]+>/g, '') // Remove HTML tags
    .replace(/javascript:/gi, '') // Remove javascript: protocols
    .replace(/on\w+=/gi, '') // Remove event handlers
    .trim();
}

// Request Size Limit Middleware
export function requestSizeLimit(maxSize: string = '10mb') {
  const maxSizeBytes = parseSize(maxSize);

  return (req: Request, res: Response, next: NextFunction) => {
    const contentLength = parseInt(req.get('content-length') || '0', 10);

    if (contentLength > maxSizeBytes) {
      logger.warn('Request size exceeded limit', {
        contentLength,
        maxSizeBytes,
        ip: req.ip,
        path: req.path,
        correlationId: req.correlationId,
      });
      throw new AppError('REQUEST_TOO_LARGE', 'Request entity too large', 413);
    }

    next();
  };
}

// Parse size string to bytes
function parseSize(size: string): number {
  const match = size.match(/^(\d+(?:\.\d+)?)\s*(\w+)?$/);
  if (!match) {
    throw new Error('Invalid size format');
  }

  const value = parseFloat(match[1]);
  const unit = (match[2] || 'b').toLowerCase();

  const units: Record<string, number> = {
    b: 1,
    kb: 1024,
    mb: 1024 * 1024,
    gb: 1024 * 1024 * 1024,
  };

  return value * (units[unit] || 1);
}

// IP Whitelist Middleware
export function ipWhitelist(allowedIPs: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const clientIP = req.ip || req.connection.remoteAddress;

    if (!clientIP || !allowedIPs.includes(clientIP)) {
      logger.warn('IP access denied', {
        clientIP,
        allowedIPs,
        path: req.path,
        correlationId: req.correlationId,
      });
      throw new AppError('IP_NOT_ALLOWED', 'Access denied', 403);
    }

    next();
  };
}

// Session Security Middleware
export function sessionSecurity() {
  return (req: Request, res: Response, next: NextFunction) => {
    // Regenerate session ID on authentication
    if (req.user && (req as any).session) {
      (req as any).session.regenerate((err: any) => {
        if (err) {
          logger.error('Session regeneration failed', {
            error: err,
            correlationId: req.correlationId,
          });
        }
        next();
      });
    } else {
      next();
    }
  };
}

// Request Validation Middleware
export function validateRequest() {
  return (req: Request, res: Response, next: NextFunction) => {
    // Check for suspicious patterns
    const suspiciousPatterns = [
      /\.\.\//g, // Directory traversal
      /\x00/g, // Null bytes
      /<script/gi, // Script injections
      /javascript:/gi, // JavaScript protocol
      /data:/gi, // Data protocol
    ];

    const requestString = JSON.stringify({
      body: req.body,
      query: req.query,
      params: req.params,
    });

    const isSuspicious = suspiciousPatterns.some((pattern) => pattern.test(requestString));

    if (isSuspicious) {
      logger.warn('Suspicious request detected', {
        ip: req.ip,
        userAgent: req.get('user-agent'),
        path: req.path,
        method: req.method,
        body: req.body,
        query: req.query,
        params: req.params,
        correlationId: req.correlationId,
      });
      throw new AppError('SUSPICIOUS_REQUEST', 'Invalid request', 400);
    }

    next();
  };
}
