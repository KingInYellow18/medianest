declare global {
  namespace Express {
    interface Request {
      user?: import('./auth').AuthenticatedUser;
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
