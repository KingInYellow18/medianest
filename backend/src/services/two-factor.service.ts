// @ts-nocheck
import crypto from 'crypto';
import speakeasy from 'speakeasy';
import qrcode from 'qrcode';
import { UserRepository } from '../repositories/user.repository';
import { RedisService } from './redis.service';
import { AppError } from '@medianest/shared';
import { logger } from '../utils/logger';
import {
  generateSecureToken,
  generateOTP,
  generateBackupCodes,
  hashSensitiveData,
  verifySensitiveData,
  logSecurityEvent,
} from '../utils/security';
// Email service removed - email-based 2FA disabled

interface TwoFactorSetup {
  secret: string;
  qrCodeUrl: string;
  manualEntryKey: string;
  backupCodes: string[];
}

interface TwoFactorMethod {
  type: 'totp' | 'sms'; // 'email' removed - no longer supported
  enabled: boolean;
  verified: boolean;
  createdAt: Date;
  lastUsed?: Date;
}

interface TwoFactorChallenge {
  id: string;
  userId: string;
  method: 'totp' | 'sms'; // 'email' removed - no longer supported
  code: string;
  hashedCode: string;
  expiresAt: Date;
  verified: boolean;
  attempts: number;
  maxAttempts: number;
  createdAt: Date;
  ipAddress: string;
  userAgent: string;
}

interface TwoFactorVerification {
  success: boolean;
  remainingAttempts?: number;
  nextMethodAvailable?: boolean;
}

export class TwoFactorService {
  private userRepository: UserRepository;
  private redisService: RedisService;
  // private emailService: EmailService; // REMOVED - email 2FA disabled

  constructor(
    userRepository: UserRepository,
    redisService: RedisService /* emailService: EmailService - REMOVED */
  ) {
    this.userRepository = userRepository;
    this.redisService = redisService;
    // this.emailService = emailService; // REMOVED - email 2FA disabled

    // Redis handles TTL automatically, no need for manual cleanup
  }

  /**
   * Setup TOTP (Time-based One-Time Password) for user
   */
  async setupTOTP(userId: string): Promise<TwoFactorSetup> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    // Generate secret
    const secret = speakeasy.generateSecret({
      name: `MediaNest (${user.email})`,
      issuer: 'MediaNest',
      length: 32,
    });

    // Generate QR code
    const qrCodeUrl = await qrcode.toDataURL(secret.otpauth_url!);

    // Generate backup codes
    const backupCodes = generateBackupCodes(10);
    const hashedBackupCodes = await Promise.all(backupCodes.map((code) => hashSensitiveData(code)));

    // Store the secret and backup codes (temporarily until verified)
    await this.userRepository.update(userId, {
      twoFactorSecret: secret.base32,
      twoFactorBackupCodes: hashedBackupCodes,
      twoFactorEnabled: false, // Not enabled until verified
    });

    logSecurityEvent(
      '2FA_SETUP_INITIATED',
      {
        userId,
        method: 'totp',
      },
      'info'
    );

    return {
      secret: secret.base32!,
      qrCodeUrl,
      manualEntryKey: secret.base32!,
      backupCodes,
    };
  }

  /**
   * Verify and enable TOTP
   */
  async verifyAndEnableTOTP(
    userId: string,
    token: string,
    options: {
      ipAddress: string;
      userAgent: string;
    }
  ): Promise<{ success: boolean; backupCodes?: string[] }> {
    const user = await this.userRepository.findById(userId);
    if (!user || !user.twoFactorSecret) {
      throw new AppError('TOTP setup not found', 400, 'TOTP_NOT_SETUP');
    }

    // Verify token
    const verified = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token,
      window: 2, // Allow some time drift
    });

    if (!verified) {
      logSecurityEvent(
        '2FA_VERIFICATION_FAILED',
        {
          userId,
          method: 'totp',
          ipAddress: options.ipAddress,
          reason: 'invalid_token',
        },
        'warn'
      );

      throw new AppError('Invalid authentication code', 400, 'INVALID_2FA_TOKEN');
    }

    // Enable 2FA
    await this.userRepository.update(userId, {
      twoFactorEnabled: true,
      twoFactorVerified: true,
      twoFactorMethod: 'totp',
    });

    // Get backup codes
    const backupCodes = await this.getBackupCodes(userId);

    logSecurityEvent(
      '2FA_ENABLED',
      {
        userId,
        method: 'totp',
        ipAddress: options.ipAddress,
        userAgent: options.userAgent,
      },
      'info'
    );

    return {
      success: true,
      backupCodes,
    };
  }

  /**
   * Setup email-based 2FA - DISABLED
   */
  async setupEmailTwoFactor(userId: string): Promise<{ success: boolean }> {
    // EMAIL 2FA DISABLED: This functionality has been removed
    throw new AppError('Email-based 2FA is no longer supported', 400, 'EMAIL_2FA_DISABLED');
  }

  /**
   * Create 2FA challenge
   */
  async createChallenge(
    userId: string,
    method: 'totp' | 'sms', // 'email' removed - no longer supported
    options: {
      ipAddress: string;
      userAgent: string;
    }
  ): Promise<{ challengeId: string; method: string; expiresIn: number }> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    if (!user.twoFactorEnabled) {
      throw new AppError('Two-factor authentication is not enabled', 400, '2FA_NOT_ENABLED');
    }

    // Check for existing active challenge
    const existingChallenge = await this.redisService.findActive2FAChallenge(userId);
    if (existingChallenge) {
      return {
        challengeId: existingChallenge.challengeId,
        method: existingChallenge.data.method,
        expiresIn: Math.floor((existingChallenge.data.expiresAt.getTime() - Date.now()) / 1000),
      };
    }

    const challengeId = generateSecureToken(16);
    let code = '';
    let hashedCode = '';
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    if (method === 'email') {
      // EMAIL 2FA DISABLED: This functionality has been removed
      throw new AppError('Email-based 2FA is no longer supported', 400, 'EMAIL_2FA_DISABLED');
    } else if (method === 'sms') {
      // SMS not implemented yet
      throw new AppError('SMS 2FA not implemented', 400, 'SMS_2FA_NOT_IMPLEMENTED');
    } else if (method === 'totp') {
      // TOTP doesn't need a challenge, but we create one for consistency
      code = 'totp';
      hashedCode = 'totp';
    }

    const challenge: TwoFactorChallenge = {
      id: challengeId,
      userId,
      method,
      code,
      hashedCode,
      expiresAt,
      verified: false,
      attempts: 0,
      maxAttempts: method === 'totp' ? 3 : 5,
      createdAt: new Date(),
      ipAddress: options.ipAddress,
      userAgent: options.userAgent,
    };

    await this.redisService.set2FAChallenge(challengeId, challenge, 300); // 5 minutes TTL

    logSecurityEvent(
      '2FA_CHALLENGE_CREATED',
      {
        challengeId,
        userId,
        method,
        ipAddress: options.ipAddress,
      },
      'info'
    );

    return {
      challengeId,
      method,
      expiresIn: 300, // 5 minutes in seconds
    };
  }

  /**
   * Verify 2FA challenge
   */
  async verifyChallenge(
    challengeId: string,
    code: string,
    options?: {
      ipAddress?: string;
      userAgent?: string;
    }
  ): Promise<TwoFactorVerification> {
    const challenge = await this.redisService.get2FAChallenge(challengeId);
    if (!challenge) {
      throw new AppError('Challenge not found', 404, 'CHALLENGE_NOT_FOUND');
    }

    // Check if challenge is expired (Redis TTL should handle this)
    if (new Date() > challenge.expiresAt) {
      await this.redisService.delete2FAChallenge(challengeId);
      throw new AppError('Challenge expired', 400, 'CHALLENGE_EXPIRED');
    }

    // Check max attempts
    if (challenge.attempts >= challenge.maxAttempts) {
      await this.redisService.delete2FAChallenge(challengeId);
      logSecurityEvent(
        '2FA_MAX_ATTEMPTS_EXCEEDED',
        {
          challengeId,
          userId: challenge.userId,
          method: challenge.method,
          attempts: challenge.attempts,
        },
        'error'
      );
      throw new AppError('Maximum attempts exceeded', 400, 'MAX_ATTEMPTS_EXCEEDED');
    }

    // Increment attempts
    challenge.attempts++;

    let verified = false;

    if (challenge.method === 'totp') {
      verified = await this.verifyTOTP(challenge.userId, code);
    } else if (challenge.method === 'email') {
      // EMAIL 2FA DISABLED: This functionality has been removed
      throw new AppError('Email-based 2FA is no longer supported', 400, 'EMAIL_2FA_DISABLED');
    } else if (challenge.method === 'sms') {
      // SMS verification not implemented
      throw new AppError('SMS verification not implemented', 400, 'SMS_NOT_IMPLEMENTED');
    }

    if (verified) {
      challenge.verified = true;
      await this.redisService.delete2FAChallenge(challengeId);

      logSecurityEvent(
        '2FA_VERIFICATION_SUCCESS',
        {
          challengeId,
          userId: challenge.userId,
          method: challenge.method,
          attempts: challenge.attempts,
          ipAddress: options?.ipAddress,
        },
        'info'
      );

      return { success: true };
    } else {
      await this.redisService.update2FAChallenge(challengeId, challenge);

      logSecurityEvent(
        '2FA_VERIFICATION_FAILED',
        {
          challengeId,
          userId: challenge.userId,
          method: challenge.method,
          attempts: challenge.attempts,
          remainingAttempts: challenge.maxAttempts - challenge.attempts,
          ipAddress: options?.ipAddress,
        },
        'warn'
      );

      return {
        success: false,
        remainingAttempts: challenge.maxAttempts - challenge.attempts,
      };
    }
  }

  /**
   * Verify TOTP token
   */
  private async verifyTOTP(userId: string, token: string): Promise<boolean> {
    const user = await this.userRepository.findById(userId);
    if (!user || !user.twoFactorSecret) {
      return false;
    }

    return speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token,
      window: 2, // Allow some time drift
    });
  }

  /**
   * Verify backup code
   */
  async verifyBackupCode(
    userId: string,
    code: string,
    options: {
      ipAddress: string;
      userAgent: string;
    }
  ): Promise<{ success: boolean; remainingCodes: number }> {
    const user = await this.userRepository.findById(userId);
    if (!user || !user.twoFactorBackupCodes) {
      throw new AppError('Backup codes not found', 404, 'BACKUP_CODES_NOT_FOUND');
    }

    // Check each backup code
    let codeIndex = -1;
    for (let i = 0; i < user.twoFactorBackupCodes.length; i++) {
      const isValid = await verifySensitiveData(code, user.twoFactorBackupCodes[i]);
      if (isValid) {
        codeIndex = i;
        break;
      }
    }

    if (codeIndex === -1) {
      logSecurityEvent(
        '2FA_BACKUP_CODE_INVALID',
        {
          userId,
          ipAddress: options.ipAddress,
        },
        'warn'
      );

      return { success: false, remainingCodes: user.twoFactorBackupCodes.length };
    }

    // Remove the used backup code
    const updatedBackupCodes = user.twoFactorBackupCodes.filter((_, index) => index !== codeIndex);
    await this.userRepository.update(userId, {
      twoFactorBackupCodes: updatedBackupCodes,
    });

    logSecurityEvent(
      '2FA_BACKUP_CODE_USED',
      {
        userId,
        remainingCodes: updatedBackupCodes.length,
        ipAddress: options.ipAddress,
        userAgent: options.userAgent,
      },
      'info'
    );

    return {
      success: true,
      remainingCodes: updatedBackupCodes.length,
    };
  }

  /**
   * Disable 2FA for user
   */
  async disableTwoFactor(
    userId: string,
    options: {
      ipAddress: string;
      userAgent: string;
    }
  ): Promise<{ success: boolean }> {
    await this.userRepository.update(userId, {
      twoFactorEnabled: false,
      twoFactorSecret: null,
      twoFactorBackupCodes: null,
      twoFactorMethod: null,
    });

    logSecurityEvent(
      '2FA_DISABLED',
      {
        userId,
        ipAddress: options.ipAddress,
        userAgent: options.userAgent,
      },
      'info'
    );

    return { success: true };
  }

  /**
   * Get backup codes for user
   */
  private async getBackupCodes(userId: string): Promise<string[]> {
    const user = await this.userRepository.findById(userId);
    if (!user || !user.twoFactorBackupCodes) {
      return [];
    }

    // Return placeholder codes (actual codes shouldn't be retrievable)
    return user.twoFactorBackupCodes.map((_, index) => `backup-code-${index + 1}`);
  }

  /**
   * Find active challenge for user (handled by Redis service)
   */
  private async findActiveChallenge(userId: string): Promise<TwoFactorChallenge | undefined> {
    const result = await this.redisService.findActive2FAChallenge(userId);
    return result?.data;
  }

  /**
   * Cleanup expired challenges (handled by Redis TTL)
   */
  private cleanupExpiredChallenges(): void {
    // Redis handles TTL automatically, method kept for compatibility
    logger.debug('2FA challenge cleanup handled by Redis TTL');
  }
}
