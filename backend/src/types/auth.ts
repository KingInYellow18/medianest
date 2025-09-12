import { Request } from 'express';

import type { User } from '@medianest/shared';

// Authenticated user type (extends User with required fields)
export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string | null; // Make sure this matches User.name type
  role: string;
  status: string;
  plexId?: string;
  plexUsername?: string | null;
  createdAt?: Date;
  lastLoginAt?: Date | null;
}

// Auth request interface
export interface AuthRequest extends Request {
  user?: AuthenticatedUser;
  correlationId: string;
  logger: any;
}

// Export compatibility alias
export type { AuthRequest as AuthenticatedRequest };
