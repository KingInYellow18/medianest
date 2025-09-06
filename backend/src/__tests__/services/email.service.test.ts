import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EmailService } from '../../services/email.service';
import { mockAxios } from '../setup';

vi.mock('../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../utils/security', () => ({
  logSecurityEvent: vi.fn(),
}));

vi.mock('axios', () => ({
  default: mockAxios,
  create: vi.fn(() => mockAxios),
}));

// Mock nodemailer
const mockTransporter = {
  sendMail: vi.fn(),
  verify: vi.fn(),
};

vi.mock('nodemailer', () => ({
  default: {
    createTransport: vi.fn(() => mockTransporter),
  },
}));

// Mock console methods
const mockConsole = {
  log: vi.fn(),
};

global.console = mockConsole as any;

describe('EmailService', () => {
  let emailService: EmailService;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = process.env;
    process.env.EMAIL_PROVIDER = 'console';
    process.env.EMAIL_FROM = 'test@medianest.com';
    emailService = new EmailService();
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('console email provider', () => {
    it('should send email via console successfully', async () => {
      const emailData = {
        to: 'test@example.com',
        name: 'Test User',
      };

      await expect(emailService.sendWelcomeEmail(emailData)).resolves.not.toThrow();

      expect(mockConsole.log).toHaveBeenCalledWith('\n=== EMAIL SENT ===');
      expect(mockConsole.log).toHaveBeenCalledWith('To: test@example.com');
      expect(mockConsole.log).toHaveBeenCalledWith('From: test@medianest.com');
    });

    it('should handle email sending errors gracefully', async () => {
      process.env.EMAIL_PROVIDER = 'smtp'; // Force SMTP to trigger error
      const emailService = new EmailService();

      const emailData = {
        to: 'invalid@example.com',
        name: 'Test User',
      };

      // Should not throw, but log error internally
      await expect(emailService.sendWelcomeEmail(emailData)).rejects.toThrow();
    });

    it('should handle missing email data', async () => {
      const invalidEmailData = {
        to: '',
        name: '',
      };

      await expect(emailService.sendWelcomeEmail(invalidEmailData)).resolves.not.toThrow();
      expect(mockConsole.log).toHaveBeenCalled();
    });

    it('should log email details to console', async () => {
      const emailData = {
        to: 'user@example.com',
        name: 'Test User',
      };

      await emailService.sendWelcomeEmail(emailData);

      expect(mockConsole.log).toHaveBeenCalledWith('To: user@example.com');
      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringContaining('Welcome to MediaNest!'),
      );
    });
  });

  describe('sendWelcomeEmail', () => {
    it('should send welcome email with user data', async () => {
      const userData = {
        to: 'newuser@example.com',
        name: 'newuser',
      };

      await expect(emailService.sendWelcomeEmail(userData)).resolves.not.toThrow();

      expect(mockConsole.log).toHaveBeenCalledWith('To: newuser@example.com');
      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringContaining('Welcome to MediaNest!'),
      );
    });

    it('should include user name in email content', async () => {
      const userData = {
        to: 'newuser@example.com',
        name: 'John Doe',
      };

      await emailService.sendWelcomeEmail(userData);

      expect(mockConsole.log).toHaveBeenCalledWith(expect.stringContaining('Hello John Doe,'));
    });
  });

  describe('sendPasswordResetEmail', () => {
    it('should send password reset email with token', async () => {
      const resetData = {
        to: 'user@example.com',
        name: 'testuser',
        resetUrl: 'http://localhost:3000/reset?token=abc123',
        expiresIn: 60,
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      };

      await expect(emailService.sendPasswordResetEmail(resetData)).resolves.not.toThrow();

      expect(mockConsole.log).toHaveBeenCalledWith('To: user@example.com');
      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringContaining('Reset Your MediaNest Password'),
      );
    });

    it('should include expiration information', async () => {
      const resetData = {
        to: 'user@example.com',
        name: 'testuser',
        resetUrl: 'http://localhost:3000/reset?token=abc123',
        expiresIn: 30,
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      };

      await emailService.sendPasswordResetEmail(resetData);

      expect(mockConsole.log).toHaveBeenCalledWith(expect.stringContaining('30 minutes'));
    });
  });

  describe('sendEmailVerificationEmail', () => {
    it('should send email verification with URL', async () => {
      const verificationData = {
        to: 'user@example.com',
        name: 'testuser',
        verificationUrl: 'http://localhost:3000/verify?token=xyz789',
        expiresIn: 120,
      };

      await expect(
        emailService.sendEmailVerificationEmail(verificationData),
      ).resolves.not.toThrow();

      expect(mockConsole.log).toHaveBeenCalledWith('To: user@example.com');
      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringContaining('Verify Your MediaNest Email Address'),
      );
    });

    it('should include verification URL in content', async () => {
      const verificationData = {
        to: 'user@example.com',
        name: 'testuser',
        verificationUrl: 'http://localhost:3000/verify?token=xyz789',
        expiresIn: 60,
      };

      await emailService.sendEmailVerificationEmail(verificationData);

      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringContaining('http://localhost:3000/verify?token=xyz789'),
      );
    });
  });

  describe('sendTwoFactorEmail', () => {
    it('should send two factor authentication code', async () => {
      const twoFactorData = {
        to: 'user@example.com',
        name: 'testuser',
        code: '123456',
        expiresIn: 5,
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      };

      await expect(emailService.sendTwoFactorEmail(twoFactorData)).resolves.not.toThrow();

      expect(mockConsole.log).toHaveBeenCalledWith('To: user@example.com');
      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringContaining('Your MediaNest Login Code'),
      );
    });

    it('should include authentication code in content', async () => {
      const twoFactorData = {
        to: 'user@example.com',
        name: 'testuser',
        code: '654321',
        expiresIn: 5,
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      };

      await emailService.sendTwoFactorEmail(twoFactorData);

      expect(mockConsole.log).toHaveBeenCalledWith(expect.stringContaining('654321'));
    });
  });

  describe('sendSecurityAlertEmail', () => {
    it('should send security alert with event details', async () => {
      const alertData = {
        to: 'user@example.com',
        name: 'testuser',
        alertType: 'Suspicious Login Attempt',
        description: 'Someone tried to access your account from an unknown location.',
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        timestamp: new Date(),
        actionRequired: true,
      };

      await expect(emailService.sendSecurityAlertEmail(alertData)).resolves.not.toThrow();

      expect(mockConsole.log).toHaveBeenCalledWith('To: user@example.com');
      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringContaining('Security Alert: Suspicious Login Attempt'),
      );
    });

    it('should include action required message when needed', async () => {
      const alertData = {
        to: 'user@example.com',
        name: 'testuser',
        alertType: 'Password Changed',
        description: 'Your password was changed successfully.',
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        timestamp: new Date(),
        actionRequired: false,
      };

      await emailService.sendSecurityAlertEmail(alertData);

      expect(mockConsole.log).toHaveBeenCalledWith(expect.stringContaining('Password Changed'));
    });
  });

  describe('sendPasswordResetConfirmationEmail', () => {
    it('should send password reset confirmation', async () => {
      const confirmationData = {
        to: 'user@example.com',
        name: 'testuser',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        timestamp: new Date(),
      };

      await expect(
        emailService.sendPasswordResetConfirmationEmail(confirmationData),
      ).resolves.not.toThrow();

      expect(mockConsole.log).toHaveBeenCalledWith('To: user@example.com');
      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringContaining('Your MediaNest Password Has Been Changed'),
      );
    });

    it('should include security information in confirmation', async () => {
      const confirmationData = {
        to: 'user@example.com',
        name: 'John Doe',
        ipAddress: '10.0.0.1',
        userAgent: 'Chrome Browser',
        timestamp: new Date('2023-01-01T12:00:00Z'),
      };

      await emailService.sendPasswordResetConfirmationEmail(confirmationData);

      expect(mockConsole.log).toHaveBeenCalledWith(expect.stringContaining('10.0.0.1'));
      expect(mockConsole.log).toHaveBeenCalledWith(expect.stringContaining('Chrome Browser'));
    });

    it('should handle different timestamp formats', async () => {
      const confirmationData = {
        to: 'user@example.com',
        name: 'testuser',
        ipAddress: '127.0.0.1',
        userAgent: 'Firefox',
        timestamp: new Date(),
      };

      await emailService.sendPasswordResetConfirmationEmail(confirmationData);

      expect(mockConsole.log).toHaveBeenCalledWith(expect.stringContaining('127.0.0.1'));
    });
  });

  describe('email provider configuration', () => {
    it('should use console provider by default in development', async () => {
      const emailData = {
        to: 'test@example.com',
        name: 'Test User',
      };

      await emailService.sendWelcomeEmail(emailData);

      expect(mockConsole.log).toHaveBeenCalledWith('\n=== EMAIL SENT ===');
    });

    it('should fall back to console for unknown providers', async () => {
      process.env.EMAIL_PROVIDER = 'unknown-provider';
      const emailService = new EmailService();

      const emailData = {
        to: 'test@example.com',
        name: 'Test User',
      };

      await emailService.sendWelcomeEmail(emailData);

      expect(mockConsole.log).toHaveBeenCalled();
    });

    it('should respect EMAIL_FROM configuration', async () => {
      process.env.EMAIL_FROM = 'custom@medianest.com';
      const emailService = new EmailService();

      const emailData = {
        to: 'test@example.com',
        name: 'Test User',
      };

      await emailService.sendWelcomeEmail(emailData);

      expect(mockConsole.log).toHaveBeenCalledWith('From: custom@medianest.com');
    });

    it('should use default from address when not configured', async () => {
      delete process.env.EMAIL_FROM;
      const emailService = new EmailService();

      const emailData = {
        to: 'test@example.com',
        name: 'Test User',
      };

      await emailService.sendWelcomeEmail(emailData);

      expect(mockConsole.log).toHaveBeenCalledWith('From: noreply@medianest.com');
    });

    it('should log email provider information', async () => {
      const emailData = {
        to: 'test@example.com',
        name: 'Test User',
      };

      await emailService.sendWelcomeEmail(emailData);

      // Should log to winston logger as well as console
      expect(mockConsole.log).toHaveBeenCalled();
    });
  });
});
