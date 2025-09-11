import crypto from 'crypto';

import bcrypt from 'bcrypt';
import { Router } from 'express';

import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middleware/auth';
import {
  createEnhancedRateLimit,
  // emailRateLimit, // REMOVED - no longer needed
  userRateLimit,
  createRateLimitReset,
} from '../middleware/enhanced-rate-limit';
import { securityHeaders, sanitizeInput } from '../middleware/security';
import {
  securityAuditMiddleware,
  logAuthEvent,
  logCriticalSecurityEvent,
} from '../middleware/security-audit';
import { validate, validateBody } from '../middleware/validation';
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
// import { EmailService } from '../services/email.service'; // REMOVED - email system disabled
import { DeviceSessionService } from '../services/device-session.service';
import { OAuthProvidersService } from '../services/oauth-providers.service';
import { PasswordResetService } from '../services/password-reset.service';
import { PlexAuthService } from '../services/plex-auth.service';
import { SessionAnalyticsService } from '../services/session-analytics.service';
import { TwoFactorService } from '../services/two-factor.service';
import { asyncHandler } from '../utils/async-handler';
import { AppError } from '../utils/errors';
import { generateToken, verifyToken } from '../utils/jwt';
import { logger } from '../utils/logger';
import { validatePasswordStrength, generateDeviceFingerprint } from '../utils/security';

const router = Router();

// Apply security middleware
router.use(securityHeaders());
router.use(sanitizeInput());
router.use(securityAuditMiddleware());

// Repository instances with proper Prisma client injection
const userRepository = new UserRepository(prisma);
const sessionTokenRepository = new SessionTokenRepository(prisma);
// const emailService = new EmailService(); // REMOVED - email system disabled
const plexAuthService = new PlexAuthService(userRepository, sessionTokenRepository);
const redisService = new (require('../services/redis.service').RedisService)();
const passwordResetService = new PasswordResetService(
  userRepository,
  sessionTokenRepository,
  redisService,
);
const oauthService = new OAuthProvidersService(
  userRepository,
  sessionTokenRepository,
  redisService,
);
const twoFactorService = new TwoFactorService(userRepository, redisService);
const deviceSessionService = new DeviceSessionService(userRepository, sessionTokenRepository);
const sessionAnalyticsService = new SessionAnalyticsService();

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
  }),
);

// GET /api/auth/plex/pin/:id/status - Check PIN status
router.get(
  '/plex/pin/:id/status',
  validate(checkPinSchema),
  asyncHandler(async (req, res) => {
    const pinId = parseInt(req.params.id ?? '0', 10);
    const pin = await plexAuthService.checkPin(pinId);

    res.json({
      success: true,
      data: {
        id: pin.id,
        authorized: !!pin.authToken,
        expiresAt: pin.expiresAt,
      },
    });
  }),
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
      correlationId: String(req.correlationId || 'unknown'),
    });

    res.json({
      success: true,
      data: {
        user: result.user,
        token: result.token,
        isNewUser: result.isNewUser,
      },
    });
  }),
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
      throw new AppError('ADMIN_EXISTS', 'Admin user already exists. Use regular login.', 400);
    }

    // Create admin user
    const hashedPassword = await bcrypt.hash(password, 12);
    const user = await userRepository.create({
      email,
      name,
      password: hashedPassword,
      role: 'admin',
    });

    // Generate JWT with complete payload
    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      plexId: user.plexId || undefined,
    });

    // Create session token
    await sessionTokenRepository.create({
      userId: user.id,
      token: token,
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
      correlationId: String(req.correlationId || 'unknown'),
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
  }),
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

      throw new AppError('INVALID_CREDENTIALS', 'Invalid email or password', 401);
    }

    // Check if user has a password (for admin bootstrap users)
    if (!(user as any).passwordHash) {
      logAuthEvent('LOGIN_FAILED', req, 'failure', {
        email,
        reason: 'no_password_set',
      });

      throw new AppError(
        'NO_PASSWORD_SET',
        'This user cannot login with password. Please use Plex authentication.',
        400,
      );
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, (user as any).passwordHash);
    if (!isValidPassword) {
      logAuthEvent('LOGIN_FAILED', req, 'failure', {
        email,
        reason: 'invalid_password',
      });

      throw new AppError('INVALID_CREDENTIALS', 'Invalid email or password', 401);
    }

    // Update last login
    await userRepository.updateLastLogin(user.id);

    // Generate JWT with complete payload
    const token = generateToken(
      {
        userId: user.id,
        email: user.email,
        role: user.role,
        plexId: user.plexId || undefined,
      },
      rememberMe,
    );

    // Create session token
    const expiresAt = rememberMe
      ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
      : new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await sessionTokenRepository.create({
      userId: user.id,
      token: token,
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
      correlationId: String(req.correlationId || 'unknown'),
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
  }),
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
        correlationId: String(req.correlationId || 'unknown'),
      });
    } else {
      // Delete current session only
      const token = req.token;
      if (token) {
        await sessionTokenRepository.deleteByToken(token);
      }
      logger.info('User session deleted', {
        userId: user.id,
        correlationId: String(req.correlationId || 'unknown'),
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
  }),
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
  }),
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
      throw new AppError('USER_NOT_FOUND', 'User not found', 404);
    }

    // Verify current password (only for users with passwords)
    if ((fullUser as any).passwordHash) {
      const isCurrentPasswordValid = await bcrypt.compare(
        currentPassword,
        (fullUser as any).passwordHash,
      );
      if (!isCurrentPasswordValid) {
        throw new AppError('INVALID_CURRENT_PASSWORD', 'Current password is incorrect', 400);
      }
    } else if (user.role === 'admin') {
      throw new AppError('PASSWORD_REQUIRED', 'Admin users must have a password', 400);
    }

    // Hash new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 12);

    // Update password
    await userRepository.updatePassword(user.id, hashedNewPassword);

    logger.info('User password changed', {
      userId: user.id,
      correlationId: String(req.correlationId || 'unknown'),
    });

    res.json({
      success: true,
      data: {
        message: 'Password changed successfully',
      },
    });
  }),
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
  }),
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
  }),
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
  }),
);

export default router;
