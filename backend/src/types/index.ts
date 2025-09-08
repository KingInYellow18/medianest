// Backend-specific type declarations
// @ts-ignore
import { User } from '@medianest/shared';
import { Request } from 'express';

// Import AuthenticatedUser to maintain type consistency
import { AuthenticatedUser } from './auth';

// Extend Express Request with user
export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
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
