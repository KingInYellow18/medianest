import { UserRepository } from '../../repositories/user.repository';
import { AuthenticationError } from '../../utils/errors';
import { logSecurityEvent } from '../../utils/security';

export interface UserValidationContext {
  ipAddress?: string;
  userAgent?: string;
}

// User interface matching the database schema
interface User {
  id: string;
  email: string;
  name: string | null;
  role: string;
  status: string;
  plexId?: string;
  plexUsername?: string | null;
}

export interface AuthenticatedUser extends User {
  id: string;
  email: string;
  name: string | null;
  role: string;
  status: string;
  plexId?: string;
  plexUsername?: string | null;
  createdAt?: Date;
  lastLoginAt?: Date | null;
}

/**
 * Validate user exists, is active, and convert to authenticated user format
 */
export async function validateUser(
  userId: string,
  userRepository: UserRepository,
  context: UserValidationContext,
): Promise<AuthenticatedUser> {
  const user = await userRepository.findById(userId);

  if (!user || user.status !== 'active') {
    logSecurityEvent(
      'INACTIVE_USER_TOKEN_USED',
      {
        userId,
        userStatus: user?.status || 'not_found',
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      },
      'warn',
    );

    throw new AuthenticationError('User not found or inactive');
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    status: user.status,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
    plexId: user.plexId || undefined,
    plexUsername: user.plexUsername,
  } as AuthenticatedUser;
}

/**
 * Validate user for optional authentication (no error thrown)
 */
export async function validateUserOptional(
  userId: string,
  userRepository: UserRepository,
): Promise<AuthenticatedUser | null> {
  try {
    const user = await userRepository.findById(userId);

    if (user && user.status === 'active') {
      return {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        status: user.status,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt,
        plexId: user.plexId || undefined,
        plexUsername: user.plexUsername,
      } as AuthenticatedUser;
    }

    return null;
  } catch {
    return null;
  }
}
