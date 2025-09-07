// @ts-nocheck
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { UserRepository } from '../repositories/user.repository';
import { SessionTokenRepository } from '../repositories/session-token.repository';
import { AppError } from '../utils/errors';
import { logger } from '../utils/logger';
import {
  generateSecureToken,
  validatePasswordStrength,
  checkPasswordReuse,
  logSecurityEvent,
} from '../utils/security';
// Email service removed - password reset via email disabled

interface PasswordResetToken {
  id: string;
  userId: string;
  token: string;
  hashedToken: string;
  expiresAt: Date;
  used: boolean;
  createdAt: Date;
  ipAddress: string;
  userAgent: string;
}

interface PasswordResetRequest {
  email: string;
  ipAddress: string;
  userAgent: string;
}

interface PasswordResetConfirm {
  token: string;
  newPassword: string;
  ipAddress: string;
  userAgent: string;
}

interface PasswordResetResult {
  success: boolean;
  message: string;
  resetId?: string;
}

export class PasswordResetService {
  private userRepository: UserRepository;
  private sessionTokenRepository: SessionTokenRepository;
  // private emailService: EmailService; // REMOVED - email functionality disabled

  // In-memory storage for demo - use Redis or database in production
  private resetTokens: Map<string, PasswordResetToken> = new Map();

  constructor(
    userRepository: UserRepository,
    sessionTokenRepository: SessionTokenRepository
    // emailService: EmailService, // REMOVED - email functionality disabled
  ) {
    this.userRepository = userRepository;
    this.sessionTokenRepository = sessionTokenRepository;
    // this.emailService = emailService; // REMOVED - email functionality disabled

    // Cleanup expired tokens every hour
    setInterval(() => this.cleanupExpiredTokens(), 60 * 60 * 1000);
  }

  /**
   * Initiate password reset process
   */
  async initiatePasswordReset(request: PasswordResetRequest): Promise<PasswordResetResult> {
    const { email, ipAddress, userAgent } = request;

    try {
      // Find user by email
      const user = await this.userRepository.findByEmail(email);

      // Always return success to prevent email enumeration
      if (!user) {
        logSecurityEvent(
          'PASSWORD_RESET_UNKNOWN_EMAIL',
          {
            email,
            ipAddress,
            userAgent,
          },
          'warn'
        );

        // Still return success to prevent email enumeration
        return {
          success: true,
          message:
            'Password reset via email is currently disabled. Please contact an administrator.',
        };
      }

      // Check if user account is active
      if (user.status !== 'active') {
        logSecurityEvent(
          'PASSWORD_RESET_INACTIVE_ACCOUNT',
          {
            userId: user.id,
            email,
            status: user.status,
            ipAddress,
            userAgent,
          },
          'warn'
        );

        return {
          success: true,
          message:
            'Password reset via email is currently disabled. Please contact an administrator.',
        };
      }

      // Check for existing active reset tokens
      const existingToken = this.findActiveResetToken(user.id);
      if (existingToken) {
        const timeRemaining = existingToken.expiresAt.getTime() - Date.now();
        if (timeRemaining > 10 * 60 * 1000) {
          // More than 10 minutes remaining
          logSecurityEvent(
            'PASSWORD_RESET_TOKEN_ALREADY_EXISTS',
            {
              userId: user.id,
              email,
              ipAddress,
              userAgent,
              existingTokenId: existingToken.id,
            },
            'info'
          );

          return {
            success: true,
            message:
              'If an account with this email exists, you will receive a password reset link.',
          };
        } else {
          // Invalidate existing token if less than 10 minutes remaining
          this.resetTokens.delete(existingToken.id);
        }
      }

      // Generate secure reset token
      const resetToken = generateSecureToken(32);
      const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

      const resetId = generateSecureToken(16);
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

      const tokenRecord: PasswordResetToken = {
        id: resetId,
        userId: user.id,
        token: resetToken,
        hashedToken,
        expiresAt,
        used: false,
        createdAt: new Date(),
        ipAddress,
        userAgent,
      };

      this.resetTokens.set(resetId, tokenRecord);

      // Generate reset link
      const resetUrl = `${process.env.FRONTEND_URL}/auth/reset-password?token=${resetToken}&id=${resetId}`;

      // EMAIL REMOVED: Password reset emails are no longer sent
      // This functionality has been disabled as part of email system removal
      logger.warn('Password reset email not sent - email system removed', {
        userId: user.id,
        email: user.email,
        resetId,
      });

      logSecurityEvent(
        'PASSWORD_RESET_INITIATED',
        {
          userId: user.id,
          email,
          resetId,
          ipAddress,
          userAgent,
          expiresAt,
        },
        'info'
      );

      return {
        success: true,
        message: 'Password reset via email is currently disabled. Please contact an administrator.',
        resetId,
      };
    } catch (error: any) {
      logger.error('Password reset initiation failed', {
        error,
        email,
        ipAddress,
        userAgent,
      });

      throw new AppError('Failed to process password reset request', 500, 'PASSWORD_RESET_FAILED');
    }
  }

  /**
   * Verify password reset token
   */
  async verifyResetToken(
    tokenId: string,
    token: string
  ): Promise<{ valid: boolean; userId?: string; expiresAt?: Date }> {
    try {
      const tokenRecord = this.resetTokens.get(tokenId);

      if (!tokenRecord) {
        return { valid: false };
      }

      // Check if token is expired
      if (new Date() > tokenRecord.expiresAt) {
        this.resetTokens.delete(tokenId);
        return { valid: false };
      }

      // Check if token is already used
      if (tokenRecord.used) {
        return { valid: false };
      }

      // Verify token hash
      const providedHash = crypto.createHash('sha256').update(token).digest('hex');
      const isValid = crypto.timingSafeEqual(
        Buffer.from(tokenRecord.hashedToken, 'hex'),
        Buffer.from(providedHash, 'hex')
      );

      if (!isValid) {
        logSecurityEvent(
          'PASSWORD_RESET_INVALID_TOKEN',
          {
            tokenId,
            userId: tokenRecord.userId,
            ipAddress: tokenRecord.ipAddress,
          },
          'warn'
        );

        return { valid: false };
      }

      return {
        valid: true,
        userId: tokenRecord.userId,
        expiresAt: tokenRecord.expiresAt,
      };
    } catch (error: any) {
      logger.error('Token verification failed', { error, tokenId });
      return { valid: false };
    }
  }

  /**
   * Complete password reset
   */
  async confirmPasswordReset(request: PasswordResetConfirm): Promise<PasswordResetResult> {
    const { token, newPassword, ipAddress, userAgent } = request;

    try {
      // Extract token ID from token (assuming format: tokenId.actualToken)
      const [tokenId, actualToken] = token.includes('.') ? token.split('.', 2) : [token, token];

      // Verify the reset token
      const tokenVerification = await this.verifyResetToken(tokenId, actualToken);
      if (!tokenVerification.valid || !tokenVerification.userId) {
        throw new AppError('Invalid or expired reset token', 400, 'INVALID_RESET_TOKEN');
      }

      const userId = tokenVerification.userId;

      // Get user details
      const user = await this.userRepository.findById(userId);
      if (!user || user.status !== 'active') {
        throw new AppError('User account not found or inactive', 400, 'USER_NOT_FOUND');
      }

      // Validate new password strength
      const passwordValidation = validatePasswordStrength(newPassword);
      if (!passwordValidation.isValid) {
        throw new AppError(
          `Password does not meet requirements: ${passwordValidation.errors.join(', ')}`,
          400,
          'WEAK_PASSWORD'
        );
      }

      // Check password reuse (get previous passwords from user)
      if (user.passwordHistory) {
        const isReused = await checkPasswordReuse(newPassword, user.passwordHistory);
        if (isReused) {
          throw new AppError(
            'Please choose a password you have not used recently',
            400,
            'PASSWORD_REUSED'
          );
        }
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, 12);

      // Update user password
      await this.userRepository.updatePassword(userId, hashedPassword);

      // Add to password history
      if (user.passwordHistory) {
        const updatedHistory = [hashedPassword, ...user.passwordHistory.slice(0, 4)]; // Keep last 5
        await this.userRepository.updatePasswordHistory(userId, updatedHistory);
      } else {
        await this.userRepository.updatePasswordHistory(userId, [hashedPassword]);
      }

      // Mark token as used
      const tokenRecord = this.resetTokens.get(tokenId);
      if (tokenRecord) {
        tokenRecord.used = true;
        this.resetTokens.set(tokenId, tokenRecord);
      }

      // Invalidate all existing sessions for security
      await this.sessionTokenRepository.deleteByUserId(userId);

      // EMAIL REMOVED: Password reset confirmation emails are no longer sent
      // This functionality has been disabled as part of email system removal
      logger.info('Password reset confirmation email not sent - email system removed', {
        userId,
        email: user.email,
      });

      logSecurityEvent(
        'PASSWORD_RESET_COMPLETED',
        {
          userId,
          email: user.email,
          tokenId,
          ipAddress,
          userAgent,
          passwordScore: passwordValidation.score,
        },
        'info'
      );

      return {
        success: true,
        message: 'Password has been reset successfully. Please log in with your new password.',
      };
    } catch (error: any) {
      if (error instanceof AppError) {
        throw error;
      }

      logger.error('Password reset confirmation failed', {
        error,
        ipAddress,
        userAgent,
      });

      throw new AppError('Failed to reset password', 500, 'PASSWORD_RESET_FAILED');
    }
  }

  /**
   * Cancel password reset token
   */
  async cancelPasswordReset(tokenId: string): Promise<void> {
    const tokenRecord = this.resetTokens.get(tokenId);
    if (tokenRecord) {
      this.resetTokens.delete(tokenId);

      logSecurityEvent(
        'PASSWORD_RESET_CANCELLED',
        {
          tokenId,
          userId: tokenRecord.userId,
        },
        'info'
      );
    }
  }

  /**
   * Get reset attempt history for user
   */
  async getResetHistory(userId: string): Promise<
    Array<{
      id: string;
      createdAt: Date;
      expiresAt: Date;
      used: boolean;
      ipAddress: string;
    }>
  > {
    const history = Array.from(this.resetTokens.values())
      .filter((token) => token.userId === userId)
      .map((token) => ({
        id: token.id,
        createdAt: token.createdAt,
        expiresAt: token.expiresAt,
        used: token.used,
        ipAddress: token.ipAddress,
      }))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 10); // Last 10 attempts

    return history;
  }

  /**
   * Find active reset token for user
   */
  private findActiveResetToken(userId: string): PasswordResetToken | undefined {
    return Array.from(this.resetTokens.values()).find(
      (token) => token.userId === userId && !token.used && new Date() < token.expiresAt
    );
  }

  /**
   * Clean up expired tokens
   */
  private cleanupExpiredTokens(): void {
    const now = new Date();
    let cleaned = 0;

    for (const [id, token] of this.resetTokens.entries()) {
      if (now > token.expiresAt || token.used) {
        this.resetTokens.delete(id);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.info('Cleaned up expired password reset tokens', { count: cleaned });
    }
  }

  /**
   * Get statistics
   */
  async getStatistics(): Promise<{
    totalActive: number;
    totalUsed: number;
    totalExpired: number;
  }> {
    const now = new Date();
    let active = 0;
    let used = 0;
    let expired = 0;

    for (const token of this.resetTokens.values()) {
      if (token.used) {
        used++;
      } else if (now > token.expiresAt) {
        expired++;
      } else {
        active++;
      }
    }

    return { totalActive: active, totalUsed: used, totalExpired: expired };
  }
}
