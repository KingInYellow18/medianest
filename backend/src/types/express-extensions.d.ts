declare global {
  namespace Express {
    interface Request {
      user?: import('./auth').AuthenticatedUser;
      authStartTime?: number;
      correlationId?: string;
      logger?: any;
    }
  }
}

export {};