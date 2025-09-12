/**
 * Consolidated Express Type Extensions for MEDIANEST
 * Unifies all Express Request/Response extensions in a single declaration
 * Resolves conflicts between multiple Express extension files
 */

import type { Logger } from 'winston';
import type { AuthenticatedUser } from './auth';

declare global {
  namespace Express {
    interface Request {
      // Authentication & User Context
      user?: AuthenticatedUser;
      token?: string;
      deviceId?: string;
      sessionId?: string;
      authStartTime?: number;

      // Request Tracking & Correlation
      correlationId: string;
      requestId?: string;
      traceId?: string;
      spanId?: string;
      startTime?: number;

      // Logging Integration
      logger?: Logger;

      // External Service Integration
      plex?: any;

      // Performance & Metrics
      metricsStartTime?: number;
      processingTime?: number;
    }

    interface Response {
      // Response Tracking
      correlationId?: string;
      requestId?: string;
      
      // Logging Context
      logContext?: Record<string, unknown>;
      
      // Performance Metrics
      processingTime?: number;
    }
  }
}

export {};