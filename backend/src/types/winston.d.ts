import { Request, Response } from 'express';
import { AuthenticatedUser } from './auth';

declare module 'winston' {
  // Extend winston's format function parameters  
  namespace format {
    interface TransformableInfo {
      // Base winston properties
      level: string;
      message: string;
      timestamp?: unknown;
      
      // Extended properties for our logging needs  
      service?: string | Record<string, any>;
      correlationId?: string | Record<string, any>;
      environment?: string;
      
      // Request context properties
      requestId?: string;
      method?: string;
      url?: string;
      ip?: string;
      userAgent?: string;
      userId?: string;
      req?: {
        id?: string;
        method?: string;
        url?: string;
        ip?: string;
        get?: (header: string) => string | undefined;
        user?: AuthenticatedUser;
      };
      
      // Response context properties
      statusCode?: number;
      responseTime?: number;
      res?: {
        statusCode?: number;
      };
      
      // Error properties
      stack?: string;
      
      // Additional metadata
      [key: string]: any;
    }
  }
}

// Re-export for convenience
export {};