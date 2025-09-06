import { Request } from 'express';
import { DeviceSessionService } from '../../services/device-session.service';
import { SessionTokenRepository } from '../../repositories/session-token.repository';
import { AuthenticationError } from '../../utils/errors';
import { logSecurityEvent } from '../../utils/security';

export interface DeviceRegistrationResult {
  deviceId: string;
  shouldBlock: boolean;
  riskScore?: number;
  riskFactors?: string[];
}

export interface SessionUpdateContext {
  method: string;
  path: string;
  query: any;
  params: any;
  ipAddress: string;
  userAgent: string;
}

/**
 * Validate session token exists and is valid
 */
export async function validateSessionToken(
  token: string,
  tokenMetadata: any,
  sessionTokenRepository: SessionTokenRepository,
  context: { userId: string; ipAddress?: string; userAgent?: string },
): Promise<void> {
  const sessionToken = await sessionTokenRepository.validate(token);

  if (!sessionToken) {
    logSecurityEvent(
      'INVALID_SESSION_TOKEN_USED',
      {
        userId: context.userId,
        tokenId: tokenMetadata.tokenId,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      },
      'warn',
    );

    throw new AuthenticationError('Invalid session');
  }
}

/**
 * Register device and perform risk assessment
 */
export async function registerAndAssessDevice(
  userId: string,
  req: Request,
  deviceSessionService: DeviceSessionService,
): Promise<DeviceRegistrationResult> {
  const deviceRegistration = await deviceSessionService.registerDevice(userId, {
    userAgent: req.get('user-agent') || '',
    ipAddress: req.ip || '',
    acceptLanguage: req.get('accept-language'),
  });

  // Check device risk assessment
  if (deviceRegistration.riskAssessment.shouldBlock) {
    logSecurityEvent(
      'HIGH_RISK_DEVICE_BLOCKED',
      {
        userId,
        deviceId: deviceRegistration.deviceId,
        riskScore: deviceRegistration.riskAssessment.riskScore,
        riskFactors: deviceRegistration.riskAssessment.factors,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      },
      'error',
    );

    throw new AuthenticationError('Device blocked due to high risk score');
  }

  return {
    deviceId: deviceRegistration.deviceId,
    shouldBlock: false,
    riskScore: deviceRegistration.riskAssessment.riskScore,
    riskFactors: deviceRegistration.riskAssessment.factors,
  };
}

/**
 * Update session activity with request details
 */
export async function updateSessionActivity(
  sessionId: string | undefined,
  context: SessionUpdateContext,
  deviceSessionService: DeviceSessionService,
): Promise<void> {
  if (!sessionId) return;

  await deviceSessionService.updateSessionActivity(sessionId, {
    action: `${context.method} ${context.path}`,
    resource: context.path,
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
    metadata: {
      query: context.query,
      params: context.params,
    },
  });
}
