// Backend-specific type declarations
// import { User as PrismaUser } from '@prisma/client'; // Currently unused
import { Request } from 'express';

// Backend-specific User type with required email
export interface BackendUser {
  id: string;
  email: string;
  role: string;
  plexId?: string | undefined;
  plexUsername?: string;
}

// Extend Express Request with user
export interface AuthenticatedRequest extends Request {
  user?: BackendUser;
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
