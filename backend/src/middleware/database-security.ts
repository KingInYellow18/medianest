/**
 * Database Security Middleware
 * Implements comprehensive database security validation and monitoring
 * 
 * @author MediaNest Security Team  
 * @version 1.0.0
 * @since 2025-09-11
 */

import { Request, Response, NextFunction } from 'express';
import { configService } from '../config/config.service';
import { logger } from '../utils/logger';
import { AppError } from '../utils/errors';

// Import database security manager
const { DatabaseSecurityManager } = require('../../../config/security/database-security');

/**
 * Database Security Validation Middleware
 */
export const validateDatabaseSecurity = () => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const securityManager = new DatabaseSecurityManager();
      
      // Get database configuration
      const dbConfig = {
        DATABASE_URL: configService.get('database', 'DATABASE_URL'),
        DB_HOST: process.env.DB_HOST,
        DB_USER: process.env.DB_USER, 
        DB_PASSWORD: process.env.DB_PASSWORD,
        DB_PORT: process.env.DB_PORT,
        DB_NAME: process.env.DB_NAME,
        REDIS_URL: configService.get('redis', 'REDIS_URL'),
        REDIS_HOST: configService.get('redis', 'REDIS_HOST'),
        REDIS_PORT: configService.get('redis', 'REDIS_PORT'),
        REDIS_PASSWORD: configService.get('redis', 'REDIS_PASSWORD'),
        REDIS_DB: process.env.REDIS_DB,
        REDIS_MAX_RETRIES: process.env.REDIS_MAX_RETRIES
      };
      
      // Validate security configuration
      const validationResults = securityManager.validateDatabaseSecurity(dbConfig);
      
      // Log validation results
      if (!validationResults.overall.secure) {
        logger.error('Database security validation failed', {
          criticalIssues: validationResults.overall.criticalIssues,
          warnings: validationResults.overall.warnings,
          postgresql: validationResults.postgresql.issues,
          redis: validationResults.redis.issues
        });
        
        // In production, fail fast on critical security issues
        if (configService.isProduction() && validationResults.overall.criticalIssues > 0) {
          throw new AppError(
            'DATABASE_SECURITY_FAILURE',
            'Critical database security issues detected',
            500
          );
        }
      }
      
      // Add security info to request context
      req.databaseSecurity = {
        validated: true,
        secure: validationResults.overall.secure,
        issues: validationResults.overall.criticalIssues,
        warnings: validationResults.overall.warnings
      };
      
      next();
    } catch (error) {
      logger.error('Database security validation error', {
        error: error instanceof Error ? error.message : error,
        path: req.path,
        method: req.method
      });
      
      next(error);
    }
  };
};

/**
 * Database Connection Security Health Check Middleware  
 */
export const checkDatabaseConnectionSecurity = () => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Only run detailed checks on health endpoints
      if (!req.path.includes('/health') && !req.path.includes('/security')) {
        return next();
      }
      
      const securityManager = new DatabaseSecurityManager();
      const dbConfig = {
        DATABASE_URL: configService.get('database', 'DATABASE_URL'),
        REDIS_URL: configService.get('redis', 'REDIS_URL'),
        REDIS_HOST: configService.get('redis', 'REDIS_HOST'),
        REDIS_PORT: configService.get('redis', 'REDIS_PORT'),
        REDIS_PASSWORD: configService.get('redis', 'REDIS_PASSWORD')
      };
      
      // Generate security report
      const validationResults = securityManager.validateDatabaseSecurity(dbConfig);
      const securityReport = securityManager.generateSecurityReport(validationResults);
      
      // Add security report to response locals for health endpoints
      res.locals.databaseSecurityReport = {
        timestamp: new Date().toISOString(),
        overall: validationResults.overall,
        postgresql: {
          secure: validationResults.postgresql.secure,
          issueCount: validationResults.postgresql.issues.length
        },
        redis: {
          secure: validationResults.redis.secure,
          issueCount: validationResults.redis.issues.length
        },
        detailedReport: configService.isDevelopment() ? securityReport : '[Hidden in production]'
      };
      
      next();
    } catch (error) {
      logger.error('Database connection security check error', {
        error: error instanceof Error ? error.message : error,
        path: req.path
      });
      
      // Don't fail health checks on security check errors
      res.locals.databaseSecurityReport = {
        timestamp: new Date().toISOString(),
        error: 'Security validation failed',
        secure: false
      };
      
      next();
    }
  };
};

/**
 * Enhanced Database Security Headers Middleware
 */
export const setDatabaseSecurityHeaders = () => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Add database security headers
    res.setHeader('X-Database-Security-Validated', 'true');
    
    if (req.databaseSecurity?.validated) {
      res.setHeader('X-Database-Security-Status', req.databaseSecurity.secure ? 'secure' : 'issues');
      
      if (req.databaseSecurity.issues > 0) {
        res.setHeader('X-Database-Security-Issues', req.databaseSecurity.issues.toString());
      }
    }
    
    // Security headers for database API endpoints
    if (req.path.includes('/api/database') || req.path.includes('/api/health')) {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    }
    
    next();
  };
};

/**
 * Database Query Security Monitoring
 */
export const monitorDatabaseQueries = () => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Monitor for potentially dangerous query patterns in request bodies
    if (req.method === 'POST' || req.method === 'PUT') {
      const body = req.body;
      
      if (body && typeof body === 'object') {
        const bodyString = JSON.stringify(body).toLowerCase();
        
        // Check for SQL injection patterns
        const dangerousPatterns = [
          /union\s+select/i,
          /drop\s+table/i,
          /delete\s+from/i,
          /update\s+.+set/i,
          /'.*or.*'.*=/i,
          /--/,
          /\/\*.*\*\//
        ];
        
        const foundPattern = dangerousPatterns.find(pattern => pattern.test(bodyString));
        
        if (foundPattern) {
          logger.warn('Potentially dangerous database query pattern detected', {
            pattern: foundPattern.toString(),
            path: req.path,
            method: req.method,
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            body: configService.isDevelopment() ? body : '[Hidden]'
          });
          
          // Add security flag to request
          req.databaseSecurity = {
            validated: req.databaseSecurity?.validated || false,
            secure: req.databaseSecurity?.secure || false,
            issues: req.databaseSecurity?.issues || 1,
            warnings: req.databaseSecurity?.warnings || 0,
            suspiciousQuery: true,
            detectedPattern: foundPattern.toString()
          };
        }
      }
    }
    
    next();
  };
};

/**
 * Production Database Security Enforcement
 */
export const enforceProductionDatabaseSecurity = () => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Only enforce in production
    if (!configService.isProduction()) {
      return next();
    }
    
    // Block requests with suspicious database query patterns
    if (req.databaseSecurity?.suspiciousQuery) {
      logger.error('Blocked suspicious database query in production', {
        pattern: req.databaseSecurity.detectedPattern,
        path: req.path,
        method: req.method,
        ip: req.ip
      });
      
      throw new AppError(
        'SUSPICIOUS_QUERY_BLOCKED',
        'Request blocked for security reasons',
        400
      );
    }
    
    next();
  };
};

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      databaseSecurity?: {
        validated: boolean;
        secure: boolean;
        issues: number;
        warnings: number;
        suspiciousQuery?: boolean;
        detectedPattern?: string;
      };
    }
  }
}

export default {
  validateDatabaseSecurity,
  checkDatabaseConnectionSecurity, 
  setDatabaseSecurityHeaders,
  monitorDatabaseQueries,
  enforceProductionDatabaseSecurity
};