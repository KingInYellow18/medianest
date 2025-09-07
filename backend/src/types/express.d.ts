declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        name?: string | null;
        role: string;
        plexId?: string;
        plexUsername?: string | null;
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
