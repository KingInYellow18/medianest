import { NextFunction, Request, Response } from 'express';
import { z, ZodError } from 'zod';

import { ValidationError } from '../utils/errors';
import { logger } from '../utils/logger';

/**
 * Security middleware for input validation and sanitization
 */

// Common validation schemas
export const commonSchemas = {
  // ID validation - only allow alphanumeric IDs
  id: z.string().regex(/^[a-zA-Z0-9_-]+$/, 'Invalid ID format').min(1).max(50),
  
  // Email validation
  email: z.string().email('Invalid email format').max(254),
  
  // Password validation - strong password requirements
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password too long')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>])/, 
           'Password must contain at least one uppercase letter, lowercase letter, number, and special character'),
  
  // Username validation
  username: z.string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username too long')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, hyphens, and underscores'),
  
  // URL validation
  url: z.string().url('Invalid URL format').max(2048),
  
  // File path validation - prevent directory traversal
  filename: z.string()
    .regex(/^[a-zA-Z0-9._-]+$/, 'Invalid filename')
    .refine(name => !name.includes('..'), 'Directory traversal not allowed')
    .max(255),
  
  // Generic text with length limits
  shortText: z.string().max(255).trim(),
  mediumText: z.string().max(1000).trim(),
  longText: z.string().max(10000).trim(),
  
  // Numeric validations
  positiveInt: z.number().int().positive(),
  port: z.number().int().min(1).max(65535),
  
  // Date validations
  isoDate: z.string().datetime(),
  
  // Boolean validation
  boolean: z.boolean(),
  
  // Array validations
  stringArray: z.array(z.string().max(255)).max(100),
  
  // JWT token format
  jwtToken: z.string().regex(/^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/, 'Invalid JWT format'),
  
  // API key format
  apiKey: z.string().regex(/^[a-zA-Z0-9_-]+$/, 'Invalid API key format').min(16).max(128),
  
  // IP address validation
  ipAddress: z.string().ip(),
};

/**
 * Request validation middleware factory
 */
export function validateRequest(schema: {
  body?: z.ZodSchema;
  query?: z.ZodSchema;
  params?: z.ZodSchema;
  headers?: z.ZodSchema;
}) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      // Validate request body
      if (schema.body) {
        req.body = schema.body.parse(req.body);
      }

      // Validate query parameters
      if (schema.query) {
        req.query = schema.query.parse(req.query);
      }

      // Validate route parameters
      if (schema.params) {
        req.params = schema.params.parse(req.params);
      }

      // Validate headers
      if (schema.headers) {
        const headers = schema.headers.parse(req.headers);
        // Don't override req.headers, just validate
      }

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = new ValidationError(
          'Validation failed',
          error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
            value: err.input,
          }))
        );

        // Log validation errors for security monitoring
        logger.warn('Request validation failed', {
          path: req.path,
          method: req.method,
          errors: validationError.details,
          ip: req.ip,
          userAgent: req.get('user-agent'),
        });

        return next(validationError);
      }
      next(error);
    }
  };
}

/**
 * Sanitize HTML content to prevent XSS
 */
export function sanitizeHtml(input: string): string {
  if (typeof input !== 'string') return '';
  
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
    .replace(/`/g, '&#96;');
}

/**
 * Sanitize user input by removing/escaping dangerous characters
 */
export function sanitizeInput(input: unknown): unknown {
  if (typeof input === 'string') {
    return sanitizeHtml(input.trim());
  }
  
  if (Array.isArray(input)) {
    return input.map(sanitizeInput);
  }
  
  if (input && typeof input === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input)) {
      // Sanitize object keys too
      const cleanKey = sanitizeHtml(key);
      sanitized[cleanKey] = sanitizeInput(value);
    }
    return sanitized;
  }
  
  return input;
}

/**
 * Middleware to sanitize request data
 */
export function sanitizeMiddleware() {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      // Sanitize body
      if (req.body && typeof req.body === 'object') {
        req.body = sanitizeInput(req.body);
      }

      // Sanitize query parameters
      if (req.query && typeof req.query === 'object') {
        req.query = sanitizeInput(req.query) as Record<string, any>;
      }

      // Don't sanitize params as they're usually IDs/routes
      // Don't sanitize headers as they may break auth tokens

      next();
    } catch (error) {
      logger.error('Error in sanitization middleware', { error });
      next(error);
    }
  };
}

/**
 * Security headers middleware (additional to helmet)
 */
export function securityHeadersMiddleware() {
  return (_req: Request, res: Response, next: NextFunction) => {
    // Additional security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    
    // Cache control for sensitive endpoints
    if (_req.path.startsWith('/api/auth') || _req.path.startsWith('/api/admin')) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
    
    next();
  };
}

/**
 * Prevent NoSQL injection by sanitizing MongoDB queries
 */
export function sanitizeMongoQuery(query: any): any {
  if (query && typeof query === 'object') {
    const sanitized: any = {};
    
    for (const [key, value] of Object.entries(query)) {
      // Remove $ prefixed keys that could be injection attempts
      if (key.startsWith('$')) {
        logger.warn('Potential NoSQL injection attempt detected', { key, value });
        continue;
      }
      
      // Recursively sanitize nested objects
      if (value && typeof value === 'object') {
        sanitized[key] = sanitizeMongoQuery(value);
      } else {
        sanitized[key] = value;
      }
    }
    
    return sanitized;
  }
  
  return query;
}

/**
 * File upload security validation
 */
export function validateFileUpload(allowedTypes: string[], maxSize: number = 10 * 1024 * 1024) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.file && !req.files) {
      return next();
    }

    const files = req.files ? (Array.isArray(req.files) ? req.files : Object.values(req.files).flat()) : [req.file];

    for (const file of files) {
      if (!file) continue;

      // Check file size
      if (file.size > maxSize) {
        return next(new ValidationError(`File size too large. Maximum allowed: ${maxSize} bytes`));
      }

      // Check MIME type
      if (!allowedTypes.includes(file.mimetype)) {
        return next(new ValidationError(`File type not allowed. Allowed types: ${allowedTypes.join(', ')}`));
      }

      // Check file extension
      const ext = file.originalname.toLowerCase().split('.').pop();
      const allowedExtensions = allowedTypes.map(type => type.split('/')[1]);
      if (ext && !allowedExtensions.includes(ext) && !allowedExtensions.includes('*')) {
        return next(new ValidationError(`File extension not allowed: .${ext}`));
      }

      // Additional security checks
      if (file.originalname.includes('..') || file.originalname.includes('/') || file.originalname.includes('\\')) {
        return next(new ValidationError('Invalid filename'));
      }
    }

    next();
  };
}

/**
 * SQL injection prevention for raw queries (if used)
 */
export function escapeSqlString(input: string): string {
  if (typeof input !== 'string') return '';
  
  return input.replace(/'/g, "''").replace(/;/g, '');
}

/**
 * Prevent LDAP injection
 */
export function escapeLdapString(input: string): string {
  if (typeof input !== 'string') return '';
  
  return input
    .replace(/\\/g, '\\5c')
    .replace(/\*/g, '\\2a')
    .replace(/\(/g, '\\28')
    .replace(/\)/g, '\\29')
    .replace(/\u0000/g, '\\00');
}

/**
 * Rate limiting by user ID (in addition to IP-based limiting)
 */
export function userRateLimit(maxRequests: number = 1000, windowMs: number = 15 * 60 * 1000) {
  const userRequests = new Map<string, { count: number; resetTime: number }>();

  return (req: Request, _res: Response, next: NextFunction) => {
    const userId = req.user?.id;
    if (!userId) {
      return next(); // Let IP-based rate limiting handle unauthenticated requests
    }

    const now = Date.now();
    const userLimit = userRequests.get(userId);

    if (!userLimit || now > userLimit.resetTime) {
      userRequests.set(userId, { count: 1, resetTime: now + windowMs });
      return next();
    }

    if (userLimit.count >= maxRequests) {
      logger.warn('User rate limit exceeded', {
        userId,
        count: userLimit.count,
        maxRequests,
        path: req.path,
      });
      
      return next(new ValidationError('Rate limit exceeded for user'));
    }

    userLimit.count++;
    next();
  };
}

/**
 * Content Security Policy nonce generator
 */
export function generateNonce(): string {
  return require('crypto').randomBytes(16).toString('base64');
}

/**
 * Middleware to add CSP nonce to response locals
 */
export function cspNonceMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    const nonce = generateNonce();
    res.locals.nonce = nonce;
    res.setHeader('Content-Security-Policy', 
      `script-src 'self' 'nonce-${nonce}'; object-src 'none';`);
    next();
  };
}