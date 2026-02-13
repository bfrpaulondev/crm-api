// =============================================================================
// Email Service - Integration with SendGrid/AWS SES/Resend
// =============================================================================

import { config } from '@/config/index.js';
import { logger } from '@/infrastructure/logging/index.js';

// Types for email
export interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string;
  attachments?: EmailAttachment[];
  headers?: Record<string, string>;
}

export interface EmailAttachment {
  filename: string;
  content: Buffer | string;
  contentType?: string;
}

export interface EmailTemplate {
  id: string;
  subject: string;
  html: string;
  text?: string;
}

// Email provider interface
interface EmailProvider {
  send(options: EmailOptions): Promise<{ success: boolean; messageId?: string; error?: string }>;
}

// =============================================================================
// SendGrid Provider
// =============================================================================

class SendGridProvider implements EmailProvider {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async send(options: EmailOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          personalizations: [
            {
              to: Array.isArray(options.to)
                ? options.to.map((email) => ({ email }))
                : [{ email: options.to }],
            },
          ],
          from: { email: options.from || 'noreply@yourdomain.com' },
          subject: options.subject,
          content: [
            { type: 'text/plain', value: options.text || '' },
            { type: 'text/html', value: options.html },
          ],
          attachments: options.attachments?.map((att) => ({
            filename: att.filename,
            content: typeof att.content === 'string' ? att.content : att.content.toString('base64'),
            type: att.contentType || 'application/octet-stream',
            disposition: 'attachment',
          })),
        }),
      });

      if (response.ok) {
        const messageId = response.headers.get('X-Message-Id') || undefined;
        return { success: true, messageId };
      }

      const error = await response.text();
      return { success: false, error };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }
}

// =============================================================================
// AWS SES Provider
// =============================================================================

class SESProvider implements EmailProvider {
  private region: string;
  private accessKeyId: string;
  private secretAccessKey: string;

  constructor(region: string, accessKeyId: string, secretAccessKey: string) {
    this.region = region;
    this.accessKeyId = accessKeyId;
    this.secretAccessKey = secretAccessKey;
  }

  async send(options: EmailOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
    // Em produção, usar AWS SDK
    // Por agora, log e simular sucesso
    logger.info('SES: Sending email', {
      to: options.to,
      subject: options.subject,
    });

    return { success: true, messageId: `ses-${Date.now()}` };
  }
}

// =============================================================================
// Resend Provider (Recomendado para startups)
// =============================================================================

class ResendProvider implements EmailProvider {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async send(options: EmailOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: options.from || 'noreply@yourdomain.com',
          to: Array.isArray(options.to) ? options.to : [options.to],
          subject: options.subject,
          html: options.html,
          text: options.text,
          attachments: options.attachments?.map((att) => ({
            filename: att.filename,
            content: typeof att.content === 'string' ? att.content : att.content.toString('base64'),
          })),
        }),
      });

      const data = await response.json();

      if (response.ok && data.id) {
        return { success: true, messageId: data.id };
      }

      return { success: false, error: JSON.stringify(data) };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }
}

// =============================================================================
// Console Provider (Development)
// =============================================================================

class ConsoleProvider implements EmailProvider {
  async send(options: EmailOptions): Promise<{ success: boolean; messageId?: string }> {
    logger.info('📧 Email (Console Provider)', {
      to: options.to,
      from: options.from,
      subject: options.subject,
      html: options.html.substring(0, 200) + '...',
    });

    return { success: true, messageId: `console-${Date.now()}` };
  }
}

// =============================================================================
// Email Service
// =============================================================================

export class EmailService {
  private provider: EmailProvider;
  private defaultFrom: string;

  constructor() {
    // Select provider based on configuration
    this.provider = this.createProvider();
    this.defaultFrom = process.env.EMAIL_FROM || 'noreply@yourdomain.com';
  }

  private createProvider(): EmailProvider {
    const provider = process.env.EMAIL_PROVIDER || 'console';

    switch (provider) {
      case 'sendgrid':
        return new SendGridProvider(process.env.SENDGRID_API_KEY || '');

      case 'ses':
        return new SESProvider(
          process.env.AWS_REGION || 'us-east-1',
          process.env.AWS_ACCESS_KEY_ID || '',
          process.env.AWS_SECRET_ACCESS_KEY || ''
        );

      case 'resend':
        return new ResendProvider(process.env.RESEND_API_KEY || '');

      case 'console':
      default:
        return new ConsoleProvider();
    }
  }

  /**
   * Send an email
   */
  async send(options: EmailOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const emailOptions: EmailOptions = {
      ...options,
      from: options.from || this.defaultFrom,
    };

    try {
      const result = await this.provider.send(emailOptions);

      if (result.success) {
        logger.info('Email sent successfully', {
          to: options.to,
          subject: options.subject,
          messageId: result.messageId,
        });
      } else {
        logger.error('Failed to send email', {
          to: options.to,
          subject: options.subject,
          error: result.error,
        });
      }

      return result;
    } catch (error) {
      logger.error('Email service error', { error: String(error) });
      return { success: false, error: String(error) };
    }
  }

  /**
   * Send welcome email to new user
   */
  async sendWelcomeEmail(email: string, name: string, tenantName: string): Promise<void> {
    await this.send({
      to: email,
      subject: `Welcome to ${tenantName}!`,
      html: `
        <h1>Welcome to ${tenantName}!</h1>
        <p>Hi ${name},</p>
        <p>Your account has been created successfully.</p>
        <p>You can now access your CRM dashboard.</p>
      `,
      text: `Welcome to ${tenantName}!\n\nHi ${name},\n\nYour account has been created successfully.`,
    });
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(email: string, name: string, resetToken: string, resetUrl: string): Promise<void> {
    const fullUrl = `${resetUrl}?token=${resetToken}`;

    await this.send({
      to: email,
      subject: 'Reset Your Password',
      html: `
        <h1>Reset Your Password</h1>
        <p>Hi ${name},</p>
        <p>We received a request to reset your password.</p>
        <p><a href="${fullUrl}">Click here to reset your password</a></p>
        <p>This link will expire in 1 hour.</p>
        <p>If you didn't request this, you can ignore this email.</p>
      `,
      text: `Reset Your Password\n\nHi ${name},\n\nClick this link to reset your password: ${fullUrl}\n\nThis link will expire in 1 hour.`,
    });
  }

  /**
   * Send opportunity status notification
   */
  async sendOpportunityStatusEmail(
    email: string,
    name: string,
    opportunityName: string,
    status: string,
    amount: number
  ): Promise<void> {
    await this.send({
      to: email,
      subject: `Opportunity ${status}: ${opportunityName}`,
      html: `
        <h1>Opportunity Update</h1>
        <p>Hi ${name},</p>
        <p>The opportunity <strong>${opportunityName}</strong> has been marked as <strong>${status}</strong>.</p>
        <p>Amount: $${amount.toLocaleString()}</p>
      `,
      text: `Opportunity Update\n\nHi ${name},\n\nThe opportunity "${opportunityName}" has been marked as ${status}.\n\nAmount: $${amount.toLocaleString()}`,
    });
  }

  /**
   * Send lead assignment notification
   */
  async sendLeadAssignmentEmail(
    email: string,
    ownerName: string,
    leadName: string,
    leadEmail: string,
    companyName?: string
  ): Promise<void> {
    await this.send({
      to: email,
      subject: `New Lead Assigned: ${leadName}`,
      html: `
        <h1>New Lead Assigned</h1>
        <p>Hi ${ownerName},</p>
        <p>A new lead has been assigned to you:</p>
        <ul>
          <li><strong>Name:</strong> ${leadName}</li>
          <li><strong>Email:</strong> ${leadEmail}</li>
          ${companyName ? `<li><strong>Company:</strong> ${companyName}</li>` : ''}
        </ul>
        <p>Please follow up as soon as possible.</p>
      `,
      text: `New Lead Assigned\n\nHi ${ownerName},\n\nA new lead has been assigned to you:\n- Name: ${leadName}\n- Email: ${leadEmail}\n${companyName ? `- Company: ${companyName}\n` : ''}\nPlease follow up as soon as possible.`,
    });
  }

  /**
   * Send daily digest
   */
  async sendDailyDigest(
    email: string,
    name: string,
    data: {
      newLeads: number;
      opportunitiesToFollowUp: number;
      tasksDue: number;
    }
  ): Promise<void> {
    await this.send({
      to: email,
      subject: 'Your Daily CRM Digest',
      html: `
        <h1>Daily Digest</h1>
        <p>Hi ${name},</p>
        <p>Here's your daily summary:</p>
        <ul>
          <li><strong>${data.newLeads}</strong> new leads</li>
          <li><strong>${data.opportunitiesToFollowUp}</strong> opportunities need follow-up</li>
          <li><strong>${data.tasksDue}</strong> tasks due today</li>
        </ul>
      `,
      text: `Daily Digest\n\nHi ${name},\n\nHere's your daily summary:\n- ${data.newLeads} new leads\n- ${data.opportunitiesToFollowUp} opportunities need follow-up\n- ${data.tasksDue} tasks due today`,
    });
  }
}

// Singleton export
export const emailService = new EmailService();
