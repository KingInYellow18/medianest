import { Response } from 'express';
import { SessionTokenRepository } from '../../repositories/session-token.repository';
import { rotateTokenIfNeeded } from '../../utils/jwt';

export interface TokenRotationContext {
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  deviceId: string;
}

export interface TokenRotationResult {
  newToken: string;
  expiresAt: Date;
  wasRotated: boolean;
}

/**
 * Handle token rotation if needed and update database/cookies
 */
export async function handleTokenRotation(
  token: string,
  payload: any,
  userId: string,
  context: TokenRotationContext,
  sessionTokenRepository: SessionTokenRepository,
  res: Response,
): Promise<TokenRotationResult | null> {
  const rotationResult = rotateTokenIfNeeded(token, payload, context);

  if (!rotationResult) {
    return null;
  }

  // Update session token in database
  await sessionTokenRepository.create({
    userId,
    hashedToken: rotationResult.newToken,
    expiresAt: rotationResult.expiresAt,
    deviceId: context.deviceId,
  });

  // Set new token in cookie
  res.cookie('auth-token', rotationResult.newToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 15 * 60 * 1000, // 15 minutes
  });

  // Add rotation headers
  res.setHeader('X-Token-Rotated', 'true');
  res.setHeader('X-New-Token', rotationResult.newToken);

  return {
    newToken: rotationResult.newToken,
    expiresAt: rotationResult.expiresAt,
    wasRotated: true,
  };
}
