declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        name?: string;
        role: string;
        plexId?: string;
        plexUsername?: string;
        [key: string]: any;
      };
      correlationId: string;
      plex?: any;
    }
  }
}

export {};
