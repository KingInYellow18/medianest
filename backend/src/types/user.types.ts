import { User as PrismaUser } from '@prisma/client';

/**
 * Extended User interface with additional authentication fields
 * This extends the generated Prisma User type with fields that may be added
 * in future migrations or are handled separately.
 */
export interface ExtendedUser extends PrismaUser {
  passwordHash?: string | null;
  githubId?: string | null;
  githubUsername?: string | null;
  googleId?: string | null;
  googleUsername?: string | null;
}

/**
 * Type guard to check if a user has a password hash
 */
export function hasPasswordHash(user: any): user is ExtendedUser & { passwordHash: string } {
  return user && typeof user.passwordHash === 'string';
}

/**
 * Type guard to check if a user has GitHub authentication
 */
export function hasGitHubAuth(user: any): user is ExtendedUser & { githubId: string } {
  return user && typeof user.githubId === 'string';
}

/**
 * Type guard to check if a user has Google authentication
 */
export function hasGoogleAuth(user: any): user is ExtendedUser & { googleId: string } {
  return user && typeof user.googleId === 'string';
}
