// Backend-specific type declarations
import { User } from '@medianest/shared';

// Re-export all typed modules
export * from './api/common.types';
export * from './database/prisma.types';
export * from './middleware/express.types';
export * from './integration/external-apis.types';
export * from './services/config.types';
export * from './environment.types';

// Legacy exports for backward compatibility
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
