// @ts-nocheck
import bcrypt from 'bcrypt';
import { Router } from 'express';
import crypto from 'crypto';

import { authMiddleware } from '../middleware/auth';
import { validate, validateBody } from '../middleware/validation';
import { securityHeaders, sanitizeInput } from '../middleware/security';
import {
  createEnhancedRateLimit,
  // emailRateLimit, // REMOVED - no longer needed
  userRateLimit,
  createRateLimitReset,
} from '../middleware/enhanced-rate-limit';
import {
  securityAuditMiddleware,
  logAuthEvent,
  logCriticalSecurityEvent,
} from '../middleware/security-audit';
import { SessionTokenRepository } from '../repositories/session-token.repository';
import { UserRepository } from '../repositories/user.repository';
import {
  createPinSchema,
  checkPinSchema,
  completeOAuthSchema,
  adminBootstrapSchema,
  loginSchema,
  logoutSchema,
  changePasswordSchema,
} from '../schemas/auth.schemas';
import { PlexAuthService } from '../services/plex-auth.service';
import { PasswordResetService } from '../services/password-reset.service';
// import { EmailService } from '../services/email.service'; // REMOVED - email system disabled
import { OAuthProvidersService } from '../services/oauth-providers.service';
import { TwoFactorService } from '../services/two-factor.service';
import { DeviceSessionService } from '../services/device-session.service';
import { SessionAnalyticsService } from '../services/session-analytics.service';
import { asyncHandler } from '../utils/async-handler';
import { AppError, AuthenticationError } from '../utils/errors';
import { generateToken, verifyToken } from '../utils/jwt';
import { logger } from '../utils/logger';
import { validatePasswordStrength, generateDeviceFingerprint } from '../utils/security';

const router = Router();

// Apply security middleware
router.use(securityHeaders());
router.use(sanitizeInput());
router.use(securityAuditMiddleware());

// Repository instances - these should ideally be injected in production
const userRepository = new UserRepository();
const sessionTokenRepository = new SessionTokenRepository();
// const emailService = new EmailService(); // REMOVED - email system disabled
const plexAuthService = new PlexAuthService(userRepository, sessionTokenRepository);
const passwordResetService = new PasswordResetService(
  userRepository,
  sessionTokenRepository
  // emailService, // REMOVED - email system disabled
);
const oauthService = new OAuthProvidersService(userRepository, sessionTokenRepository);
const twoFactorService = new TwoFactorService(userRepository /* emailService - REMOVED */);
const deviceSessionService = new DeviceSessionService(userRepository, sessionTokenRepository);
const sessionAnalyticsService = new SessionAnalyticsService(
  userRepository,
  sessionTokenRepository,
  deviceSessionService
);

// POST /api/auth/plex/pin - Create Plex OAuth PIN
router.post(
  '/plex/pin',
  validate(createPinSchema),
  asyncHandler(async (req, res) => {
    const pin = await plexAuthService.createPin();

    res.json({
      success: true,
      data: {
        id: pin.id,
        code: pin.code,
        qrUrl: `https://plex.tv/link/#!/pin/${pin.id}`,
        expiresIn: pin.expiresIn,
        expiresAt: pin.expiresAt,
        pollInterval: 5000, // 5 seconds recommended polling interval
      },
    });
  })
);

// GET /api/auth/plex/pin/:id/status - Check PIN status
router.get(
  '/plex/pin/:id/status',
  validate(checkPinSchema),
  asyncHandler(async (req, res) => {
    const pinId = req.params.id as unknown as number;
    const pin = await plexAuthService.checkPin(pinId);

    res.json({
      success: true,
      data: {
        id: pin.id,
        authorized: !!pin.authToken,
        expiresAt: pin.expiresAt,
      },
    });
  })
);

// POST /api/auth/plex - Complete Plex OAuth flow
router.post(
  '/plex',
  validate(completeOAuthSchema),
  asyncHandler(async (req, res) => {
    const { pinId } = req.body;
    const result = await plexAuthService.completeOAuth(pinId);

    // Set HTTP-only cookie for security
    res.cookie('auth-token', result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    });

    logger.info('User authenticated successfully', {
      userId: result.user.id,
      isNewUser: result.isNewUser,
      method: 'plex',
      correlationId: req.correlationId,
    });

    res.json({
      success: true,
      data: {
        user: result.user,
        token: result.token,
        isNewUser: result.isNewUser,
      },
    });
  })
);

// POST /api/auth/admin - Admin bootstrap login
router.post(
  '/admin',
  validate(adminBootstrapSchema),
  asyncHandler(async (req, res) => {
    const { email, password, name } = req.body;

    // Check if this is the first user (admin bootstrap)
    const isFirstUser = await userRepository.isFirstUser();
    if (!isFirstUser) {
      throw new AppError('Admin user already exists. Use regular login.', 400, 'ADMIN_EXISTS');
    }

    // Create admin user
    const hashedPassword = await bcrypt.hash(password, 12);
    const user = await userRepository.create({
      email,
      name,
      password: hashedPassword,
      role: 'admin',
    });

    // Generate JWT
    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    // Create session token
    await sessionTokenRepository.create({
      userId: user.id,
      hashedToken: token,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    });

    // Set HTTP-only cookie
    res.cookie('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    });

    logger.info('Admin user created and authenticated', {
      userId: user.id,
      email: user.email,
      correlationId: req.correlationId,
    });

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
        token,
        message: 'Admin user created successfully',
      },
    });
  })
);

// POST /api/auth/login - Password-based login (for admin)
router.post(
  '/login',
  createEnhancedRateLimit('login'),
  validate(loginSchema),
  asyncHandler(async (req, res) => {
    const { email, password, rememberMe } = req.body;

    // Find user by email
    const user = await userRepository.findByEmail(email);
    if (!user) {
      logAuthEvent('LOGIN_FAILED', req, 'failure', {
        email,
        reason: 'user_not_found',
      });

      throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
    }

    // Check if user has a password (for admin bootstrap users)
    if (!user.passwordHash) {
      logAuthEvent('LOGIN_FAILED', req, 'failure', {
        email,
        reason: 'no_password_set',
      });

      throw new AppError(
        'This user cannot login with password. Please use Plex authentication.',
        400,
        'NO_PASSWORD_SET'
      );
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    if (!isValidPassword) {
      logAuthEvent('LOGIN_FAILED', req, 'failure', {
        email,
        reason: 'invalid_password',
      });

      throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
    }

    // Update last login
    await userRepository.updateLastLogin(user.id);

    // Generate JWT
    const token = generateToken(
      {
        userId: user.id,
        email: user.email,
        role: user.role,
        plexId: user.plexId || undefined,
      },
      rememberMe
    );

    // Create session token
    const expiresAt = rememberMe
      ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
      : new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await sessionTokenRepository.create({
      userId: user.id,
      hashedToken: token,
      expiresAt,
    });

    // Set HTTP-only cookie
    res.cookie('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: rememberMe ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000,
    });

    logger.info('User logged in successfully', {
      userId: user.id,
      email: user.email,
      rememberMe,
      correlationId: req.correlationId,
    });

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          plexUsername: user.plexUsername,
        },
        token,
      },
    });
  })
);

// POST /api/auth/logout - Logout
router.post(
  '/logout',
  authMiddleware(),
  validate(logoutSchema),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const { allSessions } = req.body || {};

    if (allSessions) {
      // Delete all sessions for the user
      await sessionTokenRepository.deleteByUserId(user.id);
      logger.info('All user sessions deleted', {
        userId: user.id,
        correlationId: req.correlationId,
      });
    } else {
      // Delete current session only
      const token = req.token;
      if (token) {
        await sessionTokenRepository.deleteByToken(token);
      }
      logger.info('User session deleted', {
        userId: user.id,
        correlationId: req.correlationId,
      });
    }

    // Clear cookie
    res.clearCookie('auth-token');

    res.json({
      success: true,
      data: {
        message: allSessions ? 'All sessions ended' : 'Logged out successfully',
      },
    });
  })
);

// GET /api/auth/session - Get current session info
router.get(
  '/session',
  authMiddleware(),
  asyncHandler(async (req, res) => {
    const user = req.user!;

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          plexUsername: user.plexUsername,
          lastLoginAt: user.lastLoginAt,
        },
        authenticated: true,
      },
    });
  })
);

// POST /api/auth/change-password - Change password
router.post(
  '/change-password',
  authMiddleware(),
  validate(changePasswordSchema),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const { currentPassword, newPassword } = req.body;

    // Get full user data to access passwordHash
    const fullUser = await userRepository.findById(user.id);
    if (!fullUser) {
      throw new AuthenticationError('User not found');
    }

    // Verify current password (only for users with passwords)
    if (fullUser.passwordHash) {
      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, fullUser.passwordHash);
      if (!isCurrentPasswordValid) {
        throw new AppError('Current password is incorrect', 400, 'INVALID_CURRENT_PASSWORD');
      }
    } else if (user.role === 'admin') {
      throw new AppError('Admin users must have a password', 400, 'PASSWORD_REQUIRED');
    }

    // Hash new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 12);

    // Update password
    await userRepository.updatePassword(user.id, hashedNewPassword);

    logger.info('User password changed', {
      userId: user.id,
      correlationId: req.correlationId,
    });

    res.json({
      success: true,
      data: {
        message: 'Password changed successfully',
      },
    });
  })
);

// POST /api/auth/password-reset/request - DISABLED (email system removed)
router.post(
  '/password-reset/request',
  createEnhancedRateLimit('passwordReset'), // Changed from emailRateLimit
  asyncHandler(async (req, res) => {
    // PASSWORD RESET DISABLED: Email system has been removed
    res.status(503).json({
      success: false,
      message: 'Password reset via email is currently disabled. Please contact an administrator.',
      error: 'EMAIL_SYSTEM_DISABLED',
    });
  })
);

// POST /api/auth/password-reset/verify - DISABLED (email system removed)
router.post(
  '/password-reset/verify',
  createEnhancedRateLimit('passwordReset'),
  asyncHandler(async (req, res) => {
    // PASSWORD RESET DISABLED: Email system has been removed
    res.status(503).json({
      success: false,
      message: 'Password reset via email is currently disabled. Please contact an administrator.',
      error: 'EMAIL_SYSTEM_DISABLED',
    });
  })
);

// POST /api/auth/password-reset/confirm - DISABLED (email system removed)
router.post(
  '/password-reset/confirm',
  createEnhancedRateLimit('passwordReset'),
  asyncHandler(async (req, res) => {
    // PASSWORD RESET DISABLED: Email system has been removed
    res.status(503).json({
      success: false,
      message: 'Password reset via email is currently disabled. Please contact an administrator.',
      error: 'EMAIL_SYSTEM_DISABLED',
    });
  })
);

export default router;
