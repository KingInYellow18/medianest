declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        name?: string | null;
        role: string;
        plexId?: string | null;
        plexUsername?: string | null;
        lastLoginAt?: Date | null;
        createdAt?: Date;
        updatedAt?: Date;
        [key: string]: any;
      };
      correlationId: string;
      token?: string;
      deviceId?: string;
      sessionId?: string;
      traceId?: string;
      spanId?: string;
      plex?: any;
      logger?: any;
    }
  }
}

export {};
