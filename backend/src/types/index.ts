// Backend-specific type declarations
// @ts-ignore
import { User } from '@medianest/shared';
import { Request } from 'express';

// Import and re-export AuthenticatedUser to maintain type consistency
export type { AuthenticatedUser } from './auth';

// Import consolidated type definitions
export * from './logging';
export * from './metrics';

// Import Express consolidated global types
import './express-consolidated';

// Import winston type extensions (maintain existing import)
import './winston';

// Express consolidated types are globally declared
// Re-export specific interfaces for backwards compatibility
export interface AuthenticatedRequest extends Request {
  user?: import('./auth').AuthenticatedUser;
  correlationId: string;
}

// Service configuration types
export interface ServiceConfig {
  plex: {
    url: string;
    token?: string;
  };
  overseerr: {
    url: string;
    apiKey: string;
  };
  uptimeKuma: {
    url: string;
    token?: string;
  };
}

// Queue job types
export interface YouTubeDownloadJob {
  userId: string;
  playlistUrl: string;
  outputPath: string;
}
