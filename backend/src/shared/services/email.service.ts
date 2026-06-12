import nodemailer, { type SentMessageInfo, type Transporter } from 'nodemailer';
import { buildSmtpTransportOptions, getDefaultMailFrom, isSmtpConfigured } from '@config/smtp';

export interface SendEmailInput {
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  subject: string;
  text?: string;
  html?: string;
}

class EmailService {
  private transporter: Transporter | null = null;

  isConfigured(): boolean {
    return isSmtpConfigured();
  }

  async verify(): Promise<boolean> {
    const transporter = this.getTransporter();
    if (!transporter) {
      return false;
    }

    return transporter.verify();
  }

  async send(input: SendEmailInput): Promise<SentMessageInfo> {
    const transporter = this.getTransporter();
    const from = getDefaultMailFrom();

    if (!transporter || !from) {
      throw new Error('SMTP is not configured');
    }

    return transporter.sendMail({
      from,
      to: input.to,
      cc: input.cc,
      bcc: input.bcc,
      subject: input.subject,
      text: input.text,
      html: input.html,
    });
  }

  private getTransporter(): Transporter | null {
    if (this.transporter) {
      return this.transporter;
    }

    const options = buildSmtpTransportOptions();
    if (!options) {
      return null;
    }

    this.transporter = nodemailer.createTransport(options);
    return this.transporter;
  }
}

export const emailService = new EmailService();
