import { logger } from '../utils/logger';
import { logSecurityEvent } from '../utils/security';

interface EmailConfig {
  from: string;
  replyTo?: string;
  provider: 'smtp' | 'sendgrid' | 'ses' | 'console'; // console for development
}

interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

interface PasswordResetEmailData {
  to: string;
  name: string;
  resetUrl: string;
  expiresIn: number; // minutes
  ipAddress: string;
  userAgent: string;
}

interface PasswordResetConfirmationData {
  to: string;
  name: string;
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
}

interface EmailVerificationData {
  to: string;
  name: string;
  verificationUrl: string;
  expiresIn: number; // minutes
}

interface TwoFactorEmailData {
  to: string;
  name: string;
  code: string;
  expiresIn: number; // minutes
  ipAddress: string;
  userAgent: string;
}

interface SecurityAlertData {
  to: string;
  name: string;
  alertType: string;
  description: string;
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
  actionRequired?: boolean;
}

export class EmailService {
  private config: EmailConfig;

  constructor() {
    this.config = {
      from: process.env.EMAIL_FROM || 'noreply@medianest.com',
      replyTo: process.env.EMAIL_REPLY_TO,
      provider: (process.env.EMAIL_PROVIDER as any) || 'console',
    };
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(data: PasswordResetEmailData): Promise<void> {
    const template = this.generatePasswordResetTemplate(data);

    await this.sendEmail({
      to: data.to,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });

    logSecurityEvent(
      'PASSWORD_RESET_EMAIL_SENT',
      {
        to: data.to,
        ipAddress: data.ipAddress,
        expiresIn: data.expiresIn,
      },
      'info',
    );
  }

  /**
   * Send password reset confirmation email
   */
  async sendPasswordResetConfirmationEmail(data: PasswordResetConfirmationData): Promise<void> {
    const template = this.generatePasswordResetConfirmationTemplate(data);

    await this.sendEmail({
      to: data.to,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });

    logSecurityEvent(
      'PASSWORD_RESET_CONFIRMATION_EMAIL_SENT',
      {
        to: data.to,
        ipAddress: data.ipAddress,
      },
      'info',
    );
  }

  /**
   * Send email verification email
   */
  async sendEmailVerificationEmail(data: EmailVerificationData): Promise<void> {
    const template = this.generateEmailVerificationTemplate(data);

    await this.sendEmail({
      to: data.to,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });

    logSecurityEvent(
      'EMAIL_VERIFICATION_SENT',
      {
        to: data.to,
        expiresIn: data.expiresIn,
      },
      'info',
    );
  }

  /**
   * Send two-factor authentication code email
   */
  async sendTwoFactorEmail(data: TwoFactorEmailData): Promise<void> {
    const template = this.generateTwoFactorTemplate(data);

    await this.sendEmail({
      to: data.to,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });

    logSecurityEvent(
      'TWO_FACTOR_EMAIL_SENT',
      {
        to: data.to,
        ipAddress: data.ipAddress,
        expiresIn: data.expiresIn,
      },
      'info',
    );
  }

  /**
   * Send security alert email
   */
  async sendSecurityAlertEmail(data: SecurityAlertData): Promise<void> {
    const template = this.generateSecurityAlertTemplate(data);

    await this.sendEmail({
      to: data.to,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });

    logSecurityEvent(
      'SECURITY_ALERT_EMAIL_SENT',
      {
        to: data.to,
        alertType: data.alertType,
        ipAddress: data.ipAddress,
      },
      'info',
    );
  }

  /**
   * Send welcome email
   */
  async sendWelcomeEmail(data: { to: string; name: string }): Promise<void> {
    const template = this.generateWelcomeTemplate(data);

    await this.sendEmail({
      to: data.to,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });
  }

  /**
   * Generic email sending method
   */
  private async sendEmail(email: {
    to: string;
    subject: string;
    html: string;
    text: string;
  }): Promise<void> {
    try {
      switch (this.config.provider) {
        case 'console':
          await this.sendViaConsole(email);
          break;
        case 'smtp':
          await this.sendViaSMTP(email);
          break;
        case 'sendgrid':
          await this.sendViaSendGrid(email);
          break;
        case 'ses':
          await this.sendViaSES(email);
          break;
        default:
          logger.warn('Unknown email provider, falling back to console', {
            provider: this.config.provider,
          });
          await this.sendViaConsole(email);
      }
    } catch (error: any) {
      logger.error('Failed to send email', {
        error,
        to: email.to,
        subject: email.subject,
        provider: this.config.provider,
      });
      throw error;
    }
  }

  /**
   * Console email provider (for development)
   */
  private async sendViaConsole(email: {
    to: string;
    subject: string;
    html: string;
    text: string;
  }): Promise<void> {
    console.log('\n=== EMAIL SENT ===');
    console.log(`To: ${email.to}`);
    console.log(`From: ${this.config.from}`);
    console.log(`Subject: ${email.subject}`);
    console.log('--- TEXT CONTENT ---');
    console.log(email.text);
    console.log('--- HTML CONTENT ---');
    console.log(email.html);
    console.log('===================\n');

    logger.info('Email sent via console', {
      to: email.to,
      subject: email.subject,
      provider: 'console',
    });
  }

  /**
   * SMTP email provider
   */
  private async sendViaSMTP(email: {
    to: string;
    subject: string;
    html: string;
    text: string;
  }): Promise<void> {
    // TODO: Implement SMTP sending using nodemailer
    logger.info('SMTP email sending not implemented yet', { to: email.to });
    throw new Error('SMTP email provider not implemented');
  }

  /**
   * SendGrid email provider
   */
  private async sendViaSendGrid(email: {
    to: string;
    subject: string;
    html: string;
    text: string;
  }): Promise<void> {
    // TODO: Implement SendGrid API
    logger.info('SendGrid email sending not implemented yet', { to: email.to });
    throw new Error('SendGrid email provider not implemented');
  }

  /**
   * AWS SES email provider
   */
  private async sendViaSES(email: {
    to: string;
    subject: string;
    html: string;
    text: string;
  }): Promise<void> {
    // TODO: Implement AWS SES
    logger.info('SES email sending not implemented yet', { to: email.to });
    throw new Error('SES email provider not implemented');
  }

  /**
   * Generate password reset email template
   */
  private generatePasswordResetTemplate(data: PasswordResetEmailData): EmailTemplate {
    const subject = 'Reset Your MediaNest Password';

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject}</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #f8f9fa; padding: 30px; border-radius: 10px;">
          <h1 style="color: #2c3e50; margin-bottom: 20px;">Reset Your Password</h1>
          
          <p>Hello ${data.name},</p>
          
          <p>We received a request to reset your MediaNest account password. If you made this request, click the button below to reset your password:</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${data.resetUrl}" style="background: #3498db; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">Reset Password</a>
          </div>
          
          <p>This link will expire in ${data.expiresIn} minutes for security reasons.</p>
          
          <p>If you didn't request a password reset, please ignore this email. Your password will remain unchanged.</p>
          
          <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666;">
            <p><strong>Security Information:</strong></p>
            <p>Request made from IP: ${data.ipAddress}</p>
            <p>Browser: ${data.userAgent.substring(0, 100)}...</p>
            <p>Time: ${new Date().toLocaleString()}</p>
          </div>
          
          <div style="margin-top: 20px; font-size: 12px; color: #666;">
            <p>If you're having trouble clicking the button, copy and paste this URL into your browser:</p>
            <p style="word-break: break-all;">${data.resetUrl}</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
Reset Your MediaNest Password

Hello ${data.name},

We received a request to reset your MediaNest account password. If you made this request, visit the following URL to reset your password:

${data.resetUrl}

This link will expire in ${data.expiresIn} minutes for security reasons.

If you didn't request a password reset, please ignore this email. Your password will remain unchanged.

Security Information:
- Request made from IP: ${data.ipAddress}
- Browser: ${data.userAgent}
- Time: ${new Date().toLocaleString()}

If you need help, please contact our support team.
    `;

    return { subject, html, text };
  }

  /**
   * Generate password reset confirmation template
   */
  private generatePasswordResetConfirmationTemplate(
    data: PasswordResetConfirmationData,
  ): EmailTemplate {
    const subject = 'Your MediaNest Password Has Been Changed';

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject}</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #f8f9fa; padding: 30px; border-radius: 10px;">
          <h1 style="color: #27ae60; margin-bottom: 20px;">Password Changed Successfully</h1>
          
          <p>Hello ${data.name},</p>
          
          <p>Your MediaNest account password has been successfully changed.</p>
          
          <div style="background: #e8f5e8; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p style="margin: 0; font-weight: bold; color: #27ae60;">✓ Your password has been updated</p>
          </div>
          
          <p>If you did not make this change, please contact our support team immediately.</p>
          
          <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666;">
            <p><strong>Security Information:</strong></p>
            <p>Change made from IP: ${data.ipAddress}</p>
            <p>Browser: ${data.userAgent.substring(0, 100)}...</p>
            <p>Time: ${data.timestamp.toLocaleString()}</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
Your MediaNest Password Has Been Changed

Hello ${data.name},

Your MediaNest account password has been successfully changed.

If you did not make this change, please contact our support team immediately.

Security Information:
- Change made from IP: ${data.ipAddress}
- Browser: ${data.userAgent}
- Time: ${data.timestamp.toLocaleString()}
    `;

    return { subject, html, text };
  }

  /**
   * Generate email verification template
   */
  private generateEmailVerificationTemplate(data: EmailVerificationData): EmailTemplate {
    const subject = 'Verify Your MediaNest Email Address';

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject}</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #f8f9fa; padding: 30px; border-radius: 10px;">
          <h1 style="color: #3498db; margin-bottom: 20px;">Verify Your Email</h1>
          
          <p>Hello ${data.name},</p>
          
          <p>Please verify your email address to complete your MediaNest account setup.</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${data.verificationUrl}" style="background: #3498db; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">Verify Email</a>
          </div>
          
          <p>This verification link will expire in ${data.expiresIn} minutes.</p>
          
          <div style="margin-top: 20px; font-size: 12px; color: #666;">
            <p>If you're having trouble clicking the button, copy and paste this URL into your browser:</p>
            <p style="word-break: break-all;">${data.verificationUrl}</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
Verify Your MediaNest Email Address

Hello ${data.name},

Please verify your email address to complete your MediaNest account setup.

Visit this URL: ${data.verificationUrl}

This verification link will expire in ${data.expiresIn} minutes.
    `;

    return { subject, html, text };
  }

  /**
   * Generate two-factor authentication template
   */
  private generateTwoFactorTemplate(data: TwoFactorEmailData): EmailTemplate {
    const subject = 'Your MediaNest Login Code';

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject}</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #f8f9fa; padding: 30px; border-radius: 10px;">
          <h1 style="color: #e74c3c; margin-bottom: 20px;">Your Login Code</h1>
          
          <p>Hello ${data.name},</p>
          
          <p>Use this code to complete your MediaNest login:</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <div style="background: #fff; border: 2px solid #e74c3c; color: #e74c3c; padding: 20px; border-radius: 5px; font-size: 32px; font-weight: bold; letter-spacing: 5px; display: inline-block;">${data.code}</div>
          </div>
          
          <p>This code will expire in ${data.expiresIn} minutes.</p>
          
          <p><strong>If you didn't try to log in, please secure your account immediately.</strong></p>
          
          <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666;">
            <p><strong>Login attempt from:</strong></p>
            <p>IP: ${data.ipAddress}</p>
            <p>Browser: ${data.userAgent.substring(0, 100)}...</p>
            <p>Time: ${new Date().toLocaleString()}</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
Your MediaNest Login Code

Hello ${data.name},

Use this code to complete your MediaNest login: ${data.code}

This code will expire in ${data.expiresIn} minutes.

If you didn't try to log in, please secure your account immediately.

Login attempt from:
- IP: ${data.ipAddress}
- Browser: ${data.userAgent}
- Time: ${new Date().toLocaleString()}
    `;

    return { subject, html, text };
  }

  /**
   * Generate security alert template
   */
  private generateSecurityAlertTemplate(data: SecurityAlertData): EmailTemplate {
    const subject = `Security Alert: ${data.alertType}`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject}</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 30px; border-radius: 10px;">
          <h1 style="color: #d63031; margin-bottom: 20px;">🔐 Security Alert</h1>
          
          <p>Hello ${data.name},</p>
          
          <div style="background: #d63031; color: white; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p style="margin: 0; font-weight: bold;">${data.alertType}</p>
          </div>
          
          <p>${data.description}</p>
          
          ${
            data.actionRequired
              ? `
          <div style="background: #fdcb6e; color: #2d3436; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p style="margin: 0; font-weight: bold;">⚠️ Action Required: Please review your account security settings immediately.</p>
          </div>
          `
              : ''
          }
          
          <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666;">
            <p><strong>Event Details:</strong></p>
            <p>IP Address: ${data.ipAddress}</p>
            <p>Browser: ${data.userAgent.substring(0, 100)}...</p>
            <p>Time: ${data.timestamp.toLocaleString()}</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
Security Alert: ${data.alertType}

Hello ${data.name},

${data.description}

${data.actionRequired ? 'ACTION REQUIRED: Please review your account security settings immediately.' : ''}

Event Details:
- IP Address: ${data.ipAddress}
- Browser: ${data.userAgent}
- Time: ${data.timestamp.toLocaleString()}

If you have any concerns, please contact our support team.
    `;

    return { subject, html, text };
  }

  /**
   * Generate welcome email template
   */
  private generateWelcomeTemplate(data: { to: string; name: string }): EmailTemplate {
    const subject = 'Welcome to MediaNest!';

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject}</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #f8f9fa; padding: 30px; border-radius: 10px;">
          <h1 style="color: #3498db; margin-bottom: 20px;">Welcome to MediaNest! 🎉</h1>
          
          <p>Hello ${data.name},</p>
          
          <p>Welcome to MediaNest! We're excited to have you on board.</p>
          
          <p>Your account has been successfully created and you can now enjoy all the features MediaNest has to offer.</p>
          
          <div style="margin: 30px 0;">
            <h3 style="color: #2c3e50;">What's next?</h3>
            <ul style="padding-left: 20px;">
              <li>Complete your profile setup</li>
              <li>Connect your media services</li>
              <li>Start organizing your media</li>
            </ul>
          </div>
          
          <p>If you have any questions or need assistance, don't hesitate to reach out to our support team.</p>
          
          <p>Happy streaming!</p>
          <p>The MediaNest Team</p>
        </div>
      </body>
      </html>
    `;

    const text = `
Welcome to MediaNest!

Hello ${data.name},

Welcome to MediaNest! We're excited to have you on board.

Your account has been successfully created and you can now enjoy all the features MediaNest has to offer.

What's next?
- Complete your profile setup
- Connect your media services
- Start organizing your media

If you have any questions or need assistance, don't hesitate to reach out to our support team.

Happy streaming!
The MediaNest Team
    `;

    return { subject, html, text };
  }
}
