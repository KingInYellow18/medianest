import { Request } from 'express';
// @ts-ignore
import { User } from '@medianest/shared';

// Auth request interface
export interface AuthRequest extends Request {
  user?: User;
  correlationId: string;
  logger: any;
}

// Authenticated user type
export interface AuthenticatedUser extends User {
  id: string;
  email: string;
}

// Export compatibility alias
export { AuthRequest as AuthenticatedRequest };
