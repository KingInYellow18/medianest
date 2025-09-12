/**
 * ZERO TRUST AUTHENTICATION VALIDATOR
 *
 * Comprehensive validation layer for authentication security
 * Prevents bypass attempts and validates all authentication components
 */

import { AuthenticatedUser } from '../auth';
import { authSecurityService } from './auth-security-fixes';
import { logger } from '../utils/logger';


export interface AuthValidationContext {
  ipAddress: string;
  userAgent?: string;
  sessionId?: string;
  tokenId?: string;
}

export interface AuthValidationResult {
  isValid: boolean;
  user?: AuthenticatedUser;
  reason?: string;
  riskScore: number;
  requiresAdditionalAuth?: boolean;
}

export class AuthValidator {
  /**
   * ZERO TRUST: Comprehensive authentication validation
   */
  async validateAuthentication(
    user: AuthenticatedUser,
    token: string,
    context: AuthValidationContext,
  ): Promise<AuthValidationResult> {
    const validationResults: Array<{ isValid: boolean; reason?: string; riskScore: number }> = [];

    // 1. User Status Validation
    const userValidation = await this.validateUserStatus(user);
    validationResults.push(userValidation);

    // 2. Token Security Validation
    const tokenValidation = await this.validateTokenSecurity(token, user.id, context);
    validationResults.push(tokenValidation);

    // 3. IP Address Validation
    const ipValidation = this.validateIPAddress(context);
    validationResults.push(ipValidation);

    // 4. Session Validation
    const sessionValidation = await this.validateSession(user.id, context);
    validationResults.push(sessionValidation);

    // 5. Suspicious Activity Detection
    const activityValidation = await this.validateUserActivity(user.id, context);
    validationResults.push(activityValidation);

    // Calculate overall validation result
    const isValid = validationResults.every((result) => result.isValid);
    const totalRiskScore = validationResults.reduce((sum, result) => sum + result.riskScore, 0);
    const failedReasons = validationResults
      .filter((result) => !result.isValid)
      .map((result) => result.reason)
      .join(', ');

    // Log validation result for audit
    logger.info('Authentication validation completed', {
      userId: user.id,
      isValid,
      riskScore: totalRiskScore,
      ipAddress: context.ipAddress,
      sessionId: context.sessionId,
    });

    if (!isValid) {
      await authSecurityService.logSecurityEvent({
        userId: user.id,
        action: 'security_violation',
        reason: `Authentication validation failed: ${failedReasons}`,
        ipAddress: context.ipAddress,
        sessionId: context.sessionId,
        timestamp: new Date(),
        metadata: { riskScore: totalRiskScore },
      });
    }

    return {
      isValid,
      user: isValid ? user : undefined,
      reason: failedReasons || undefined,
      riskScore: totalRiskScore,
      requiresAdditionalAuth: totalRiskScore > 60,
    };
  }

  /**
   * Validate user account status and permissions
   */
  private async validateUserStatus(
    user: AuthenticatedUser,
  ): Promise<{ isValid: boolean; reason?: string; riskScore: number }> {
    // Check user status
    if (!user.status || user.status !== 'active') {
      return {
        isValid: false,
        reason: 'User account is not active',
        riskScore: 100,
      };
    }

    // Check required fields
    if (!user.id || !user.email || !user.role) {
      return {
        isValid: false,
        reason: 'User data is incomplete',
        riskScore: 80,
      };
    }

    // Validate role
    const validRoles = ['admin', 'user', 'guest'];
    if (!validRoles.includes(user.role.toLowerCase())) {
      return {
        isValid: false,
        reason: 'Invalid user role',
        riskScore: 70,
      };
    }

    return { isValid: true, riskScore: 0 };
  }

  /**
   * Validate token security and integrity
   */
  private async validateTokenSecurity(
    token: string,
    _userId: string,
    context: AuthValidationContext,
  ): Promise<{ isValid: boolean; reason?: string; riskScore: number }> {
    // Check token blacklist
    const isBlacklisted = await authSecurityService.isTokenBlacklisted(token);
    if (isBlacklisted) {
      return {
        isValid: false,
        reason: 'Token is blacklisted',
        riskScore: 100,
      };
    }

    // Validate token format
    const tokenParts = token.split('.');
    if (tokenParts.length !== 3) {
      return {
        isValid: false,
        reason: 'Invalid token format',
        riskScore: 90,
      };
    }

    // Check token age (if available in context)
    if (context.tokenId) {
      // Additional token-specific validations could go here
    }

    return { isValid: true, riskScore: 0 };
  }

  /**
   * Validate IP address consistency and security
   */
  private validateIPAddress(context: AuthValidationContext): {
    isValid: boolean;
    reason?: string;
    riskScore: number;
  } {
    const ipAddress = context.ipAddress;

    // Basic IP format validation
    if (!ipAddress || ipAddress === 'unknown') {
      return {
        isValid: false,
        reason: 'Missing or invalid IP address',
        riskScore: 40,
      };
    }

    // Check for internal/private IP addresses in production
    if (process.env.NODE_ENV === 'production' && this.isPrivateIP(ipAddress)) {
      return {
        isValid: false,
        reason: 'Private IP address not allowed in production',
        riskScore: 60,
      };
    }

    return { isValid: true, riskScore: 0 };
  }

  /**
   * Validate user session consistency
   */
  private async validateSession(
    _userId: string,
    context: AuthValidationContext,
  ): Promise<{ isValid: boolean; reason?: string; riskScore: number }> {
    if (!context.sessionId) {
      return {
        isValid: false,
        reason: 'Missing session ID',
        riskScore: 50,
      };
    }

    // Additional session validations could be implemented here
    // For example, checking session expiry, concurrent session limits, etc.

    return { isValid: true, riskScore: 0 };
  }

  /**
   * Validate user activity patterns for suspicious behavior
   */
  private async validateUserActivity(
    userId: string,
    context: AuthValidationContext,
  ): Promise<{ isValid: boolean; reason?: string; riskScore: number }> {
    const activityResult = await authSecurityService.detectSuspiciousActivity(
      userId,
      context.ipAddress,
      context.userAgent,
    );

    if (activityResult.isSuspicious) {
      return {
        isValid: false,
        reason: `Suspicious activity detected: ${activityResult.reasons.join(', ')}`,
        riskScore: activityResult.riskScore,
      };
    }

    return { isValid: true, riskScore: activityResult.riskScore };
  }

  /**
   * Check if IP address is private/internal
   */
  private isPrivateIP(ip: string): boolean {
    const privateRanges = [
      /^10\./,
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
      /^192\.168\./,
      /^127\./,
      /^169\.254\./,
      /^::1$/,
      /^fc00::/,
      /^fe80::/,
    ];

    return privateRanges.some((range) => range.test(ip));
  }

  /**
   * Additional validation for admin operations
   */
  async validateAdminAccess(
    user: AuthenticatedUser,
    context: AuthValidationContext,
  ): Promise<AuthValidationResult> {
    const baseValidation = await this.validateAuthentication(user, '', context);

    if (!baseValidation.isValid) {
      return baseValidation;
    }

    // Additional admin-specific validations
    if (!user.role || !['admin', 'super_admin'].includes(user.role.toLowerCase())) {
      return {
        isValid: false,
        reason: 'Insufficient privileges for admin access',
        riskScore: 100,
      };
    }

    // Admin operations require additional logging
    await authSecurityService.logSecurityEvent({
      userId: user.id,
      action: 'login',
      reason: 'Admin access granted',
      ipAddress: context.ipAddress,
      sessionId: context.sessionId,
      timestamp: new Date(),
      metadata: { adminAccess: true },
    });

    return {
      ...baseValidation,
      requiresAdditionalAuth: baseValidation.riskScore > 30, // Lower threshold for admin
    };
  }
}

export const authValidator = new AuthValidator();
