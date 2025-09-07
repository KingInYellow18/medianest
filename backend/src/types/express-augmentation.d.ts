import { Request } from 'express';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        plexId?: string;
        plexUsername: string;
        email: string;
        name: string;
        role: string;
        status: string;
        createdAt: Date;
        updatedAt: Date;
        lastLoginAt?: Date;
        plexToken?: string;
        image?: string;
        requiresPasswordChange?: boolean;
      };
      correlationId?: string;
      logger?: any;
    }
  }
}

export {};