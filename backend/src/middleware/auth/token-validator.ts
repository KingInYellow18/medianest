import { Request } from 'express';
import { AuthenticationError } from '../../utils/errors';
import { verifyToken, isTokenBlacklisted, getTokenMetadata } from '../../utils/jwt';
import { logSecurityEvent } from '../../utils/security';

export interface TokenValidationContext {
  ipAddress?: string;
  userAgent?: string;
}

export interface TokenValidationResult {
  token: string;
  payload: any;
  metadata: unknown;
}

/**
 * Extract authentication token from request headers or cookies
 */
export function extractToken(req: Request): string {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  if (req.cookies['auth-token']) {
    return req.cookies['auth-token'];
  }

  throw new AuthenticationError('Authentication required');
}

/**
 * Validate token blacklist status and log security events
 */
export function validateTokenBlacklist(
  token: string,
  tokenMetadata: unknown,
  context: TokenValidationContext
): void {
  if (tokenMetadata.tokenId && isTokenBlacklisted(tokenMetadata.tokenId)) {
    logSecurityEvent(
      'BLACKLISTED_TOKEN_USED',
      {
        tokenId: tokenMetadata.tokenId,
        userId: tokenMetadata.userId,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      },
      'error'
    );

    throw new AuthenticationError('Token has been revoked');
  }
}

/**
 * Comprehensive token validation including JWT verification and blacklist check
 */
export function validateToken(
  req: Request,
  context: TokenValidationContext
): TokenValidationResult {
  const token = extractToken(req);
  const tokenMetadata = getTokenMetadata(token);

  // Check blacklist
  validateTokenBlacklist(token, tokenMetadata, context);

  // Verify JWT with security context
  const payload = verifyToken(token, context);

  return {
    token,
    payload,
    metadata: tokenMetadata,
  };
}

/**
 * Extract token with optional fallback (for optional auth middleware)
 */
export function extractTokenOptional(req: Request): string | null {
  try {
    return extractToken(req);
  } catch {
    return null;
  }
}
