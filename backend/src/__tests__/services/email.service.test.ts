import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EmailService } from '../../services/email.service';
import { mockAxios } from '../setup';

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

describe('EmailService', () => {
  let emailService: EmailService;

  beforeEach(() => {
    emailService = new EmailService();
  });

  describe('sendEmail', () => {
    it('should send email successfully with SMTP', async () => {
      const emailData = {
        to: 'test@example.com',
        subject: 'Test Email',
        html: '<h1>Test Content</h1>',
        text: 'Test Content',
      };

      mockTransporter.sendMail.mockResolvedValueOnce({
        messageId: 'test-message-id',
        accepted: ['test@example.com'],
        rejected: [],
      });

      const result = await emailService.sendEmail(emailData);

      expect(result).toEqual({
        success: true,
        messageId: 'test-message-id',
      });

      expect(mockTransporter.sendMail).toHaveBeenCalledWith({
        from: expect.any(String),
        to: emailData.to,
        subject: emailData.subject,
        html: emailData.html,
        text: emailData.text,
      });
    });

    it('should handle SMTP errors gracefully', async () => {
      const emailData = {
        to: 'invalid@example.com',
        subject: 'Test Email',
        html: '<h1>Test Content</h1>',
      };

      mockTransporter.sendMail.mockRejectedValueOnce(new Error('SMTP Error'));

      const result = await emailService.sendEmail(emailData);

      expect(result).toEqual({
        success: false,
        error: 'Failed to send email',
      });
    });

    it('should validate email data', async () => {
      const invalidEmailData = {
        to: '', // invalid email
        subject: 'Test Email',
        html: '<h1>Test Content</h1>',
      };

      const result = await emailService.sendEmail(invalidEmailData);

      expect(result).toEqual({
        success: false,
        error: 'Invalid email data',
      });
    });

    it('should handle rejected recipients', async () => {
      const emailData = {
        to: 'rejected@example.com',
        subject: 'Test Email',
        html: '<h1>Test Content</h1>',
      };

      mockTransporter.sendMail.mockResolvedValueOnce({
        messageId: 'test-message-id',
        accepted: [],
        rejected: ['rejected@example.com'],
      });

      const result = await emailService.sendEmail(emailData);

      expect(result).toEqual({
        success: false,
        error: 'Email was rejected by recipient server',
      });
    });
  });

  describe('sendWelcomeEmail', () => {
    it('should send welcome email with user data', async () => {
      const userData = {
        email: 'newuser@example.com',
        username: 'newuser',
        id: 'user-123',
      };

      mockTransporter.sendMail.mockResolvedValueOnce({
        messageId: 'welcome-message-id',
        accepted: [userData.email],
        rejected: [],
      });

      const result = await emailService.sendWelcomeEmail(userData);

      expect(result.success).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: userData.email,
          subject: expect.stringContaining('Welcome'),
          html: expect.stringContaining(userData.username),
        }),
      );
    });

    it('should include activation link if provided', async () => {
      const userData = {
        email: 'newuser@example.com',
        username: 'newuser',
        id: 'user-123',
        activationToken: 'activation-token-123',
      };

      mockTransporter.sendMail.mockResolvedValueOnce({
        messageId: 'welcome-message-id',
        accepted: [userData.email],
        rejected: [],
      });

      const result = await emailService.sendWelcomeEmail(userData);

      expect(result.success).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          html: expect.stringContaining(userData.activationToken),
        }),
      );
    });
  });

  describe('sendPasswordResetEmail', () => {
    it('should send password reset email with token', async () => {
      const resetData = {
        email: 'user@example.com',
        username: 'testuser',
        resetToken: 'reset-token-123',
      };

      mockTransporter.sendMail.mockResolvedValueOnce({
        messageId: 'reset-message-id',
        accepted: [resetData.email],
        rejected: [],
      });

      const result = await emailService.sendPasswordResetEmail(resetData);

      expect(result.success).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: resetData.email,
          subject: expect.stringContaining('Password Reset'),
          html: expect.stringContaining(resetData.resetToken),
        }),
      );
    });

    it('should include expiration information', async () => {
      const resetData = {
        email: 'user@example.com',
        username: 'testuser',
        resetToken: 'reset-token-123',
        expiresIn: '1 hour',
      };

      mockTransporter.sendMail.mockResolvedValueOnce({
        messageId: 'reset-message-id',
        accepted: [resetData.email],
        rejected: [],
      });

      const result = await emailService.sendPasswordResetEmail(resetData);

      expect(result.success).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          html: expect.stringContaining(resetData.expiresIn),
        }),
      );
    });
  });

  describe('sendMediaRequestNotification', () => {
    it('should send notification for new media request', async () => {
      const requestData = {
        userEmail: 'user@example.com',
        userName: 'testuser',
        mediaTitle: 'Test Movie',
        mediaType: 'movie',
        requestId: 'request-123',
      };

      const adminEmails = ['admin@example.com'];

      mockTransporter.sendMail.mockResolvedValueOnce({
        messageId: 'notification-message-id',
        accepted: adminEmails,
        rejected: [],
      });

      const result = await emailService.sendMediaRequestNotification(requestData, adminEmails);

      expect(result.success).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: adminEmails.join(', '),
          subject: expect.stringContaining('New Media Request'),
          html: expect.stringContaining(requestData.mediaTitle),
        }),
      );
    });

    it('should handle multiple admin recipients', async () => {
      const requestData = {
        userEmail: 'user@example.com',
        userName: 'testuser',
        mediaTitle: 'Test Movie',
        mediaType: 'movie',
        requestId: 'request-123',
      };

      const adminEmails = ['admin1@example.com', 'admin2@example.com'];

      mockTransporter.sendMail.mockResolvedValueOnce({
        messageId: 'notification-message-id',
        accepted: adminEmails,
        rejected: [],
      });

      const result = await emailService.sendMediaRequestNotification(requestData, adminEmails);

      expect(result.success).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: adminEmails.join(', '),
        }),
      );
    });
  });

  describe('sendRequestStatusUpdate', () => {
    it('should send approval notification', async () => {
      const updateData = {
        userEmail: 'user@example.com',
        userName: 'testuser',
        mediaTitle: 'Test Movie',
        status: 'approved',
        requestId: 'request-123',
      };

      mockTransporter.sendMail.mockResolvedValueOnce({
        messageId: 'status-message-id',
        accepted: [updateData.userEmail],
        rejected: [],
      });

      const result = await emailService.sendRequestStatusUpdate(updateData);

      expect(result.success).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: updateData.userEmail,
          subject: expect.stringContaining('approved'),
          html: expect.stringContaining(updateData.mediaTitle),
        }),
      );
    });

    it('should send rejection notification with reason', async () => {
      const updateData = {
        userEmail: 'user@example.com',
        userName: 'testuser',
        mediaTitle: 'Test Movie',
        status: 'rejected',
        requestId: 'request-123',
        reason: 'Content not available',
      };

      mockTransporter.sendMail.mockResolvedValueOnce({
        messageId: 'status-message-id',
        accepted: [updateData.userEmail],
        rejected: [],
      });

      const result = await emailService.sendRequestStatusUpdate(updateData);

      expect(result.success).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          html: expect.stringContaining(updateData.reason),
        }),
      );
    });
  });

  describe('verifyConnection', () => {
    it('should verify SMTP connection successfully', async () => {
      mockTransporter.verify.mockResolvedValueOnce(true);

      const result = await emailService.verifyConnection();

      expect(result).toEqual({
        success: true,
        message: 'SMTP connection verified',
      });
    });

    it('should handle connection verification failure', async () => {
      mockTransporter.verify.mockRejectedValueOnce(new Error('Connection failed'));

      const result = await emailService.verifyConnection();

      expect(result).toEqual({
        success: false,
        error: 'SMTP connection failed',
      });
    });
  });

  describe('generateEmailTemplate', () => {
    it('should generate HTML template with variables', () => {
      const template = 'Hello {{username}}, welcome to {{appName}}!';
      const variables = {
        username: 'testuser',
        appName: 'MediaNest',
      };

      const result = emailService.generateEmailTemplate(template, variables);

      expect(result).toBe('Hello testuser, welcome to MediaNest!');
    });

    it('should handle missing variables gracefully', () => {
      const template = 'Hello {{username}}, your {{unknownVar}} is ready!';
      const variables = {
        username: 'testuser',
      };

      const result = emailService.generateEmailTemplate(template, variables);

      expect(result).toBe('Hello testuser, your  is ready!');
    });

    it('should escape HTML in variables', () => {
      const template = 'Hello {{username}}!';
      const variables = {
        username: '<script>alert("xss")</script>testuser',
      };

      const result = emailService.generateEmailTemplate(template, variables);

      expect(result).not.toContain('<script>');
      expect(result).toContain('testuser');
    });
  });

  describe('email queue integration', () => {
    it('should queue email for background processing', async () => {
      const emailData = {
        to: 'queued@example.com',
        subject: 'Queued Email',
        html: '<h1>Queued Content</h1>',
        priority: 'low',
      };

      // Mock queue system
      const mockQueue = {
        add: vi.fn().mockResolvedValue({ id: 'job-123' }),
      };

      const result = await emailService.queueEmail(emailData, mockQueue);

      expect(result).toEqual({
        success: true,
        jobId: 'job-123',
      });

      expect(mockQueue.add).toHaveBeenCalledWith(
        'send-email',
        emailData,
        expect.objectContaining({
          priority: expect.any(Number),
          attempts: expect.any(Number),
        }),
      );
    });

    it('should handle queue failures', async () => {
      const emailData = {
        to: 'failed@example.com',
        subject: 'Failed Email',
        html: '<h1>Failed Content</h1>',
      };

      const mockQueue = {
        add: vi.fn().mockRejectedValue(new Error('Queue error')),
      };

      const result = await emailService.queueEmail(emailData, mockQueue);

      expect(result).toEqual({
        success: false,
        error: 'Failed to queue email',
      });
    });
  });

  describe('email tracking', () => {
    it('should track email open events', async () => {
      const trackingData = {
        messageId: 'message-123',
        recipientEmail: 'tracked@example.com',
        eventType: 'open',
        timestamp: new Date(),
      };

      const result = await emailService.trackEmailEvent(trackingData);

      expect(result).toEqual({
        success: true,
        tracked: true,
      });
    });

    it('should track email click events', async () => {
      const trackingData = {
        messageId: 'message-123',
        recipientEmail: 'clicked@example.com',
        eventType: 'click',
        linkUrl: 'https://example.com/verify',
        timestamp: new Date(),
      };

      const result = await emailService.trackEmailEvent(trackingData);

      expect(result).toEqual({
        success: true,
        tracked: true,
      });
    });

    it('should get email statistics', async () => {
      const messageId = 'message-123';

      const result = await emailService.getEmailStats(messageId);

      expect(result).toEqual({
        success: true,
        stats: expect.objectContaining({
          sent: expect.any(Boolean),
          delivered: expect.any(Boolean),
          opened: expect.any(Number),
          clicked: expect.any(Number),
        }),
      });
    });
  });
});
