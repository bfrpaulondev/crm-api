// =============================================================================
// Email Service
// =============================================================================

import { logger } from '@/infrastructure/logging/index.js';
import { traceServiceOperation } from '@/infrastructure/otel/tracing.js';

interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
}

interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export class EmailService {
  private readonly defaultFrom: string;

  constructor() {
    this.defaultFrom = process.env.EMAIL_FROM || 'noreply@crm-api.com';
  }

  async send(options: SendEmailOptions): Promise<EmailResult> {
    return traceServiceOperation('EmailService', 'send', async () => {
      const provider = process.env.EMAIL_PROVIDER || 'console';

      switch (provider) {
        case 'console':
          return this.sendConsole(options);
        case 'ses':
          return this.sendSES(options);
        default:
          return this.sendConsole(options);
      }
    });
  }

  private async sendConsole(options: SendEmailOptions): Promise<EmailResult> {
    const to = Array.isArray(options.to) ? options.to.join(', ') : options.to;

    logger.info('Email sent (console)', {
      from: options.from || this.defaultFrom,
      to,
      subject: options.subject,
    });

    console.log('='.repeat(60));
    console.log(`From: ${options.from || this.defaultFrom}`);
    console.log(`To: ${to}`);
    console.log(`Subject: ${options.subject}`);
    console.log('-'.repeat(60));
    console.log(options.text || options.html);
    console.log('='.repeat(60));

    return {
      success: true,
      messageId: `console-${Date.now()}`,
    };
  }

  private async sendSES(_options: SendEmailOptions): Promise<EmailResult> {
    // AWS SES implementation would go here
    logger.warn('AWS SES not configured, falling back to console');

    return {
      success: false,
      error: 'AWS SES not configured',
    };
  }

  async sendWelcomeEmail(email: string, name: string): Promise<EmailResult> {
    return this.send({
      to: email,
      subject: 'Welcome to CRM!',
      html: `
        <h1>Welcome ${name}!</h1>
        <p>Thank you for joining our CRM platform.</p>
        <p>You can now start managing your leads and opportunities.</p>
      `,
      text: `Welcome ${name}! Thank you for joining our CRM platform.`,
    });
  }

  async sendPasswordResetEmail(email: string, resetToken: string): Promise<EmailResult> {
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;

    return this.send({
      to: email,
      subject: 'Reset Your Password',
      html: `
        <h1>Password Reset</h1>
        <p>Click the link below to reset your password:</p>
        <a href="${resetUrl}">${resetUrl}</a>
        <p>This link will expire in 1 hour.</p>
      `,
      text: `Password Reset\n\nClick the link below to reset your password:\n${resetUrl}\n\nThis link will expire in 1 hour.`,
    });
  }

  async sendNotificationEmail(
    email: string,
    subject: string,
    message: string
  ): Promise<EmailResult> {
    return this.send({
      to: email,
      subject,
      html: `<p>${message}</p>`,
      text: message,
    });
  }
}

export const emailService = new EmailService();
