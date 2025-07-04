// Backend-specific type declarations
import { User } from '@medianest/shared';
import { Request } from 'express';

// Extend Express Request with user
export interface AuthenticatedRequest extends Request {
  user?: User;
  correlationId?: string;
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