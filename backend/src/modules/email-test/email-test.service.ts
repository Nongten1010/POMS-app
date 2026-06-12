import { StatusCodes } from 'http-status-codes';
import { AppError } from '../../shared/errors/AppError';
import { emailService } from '../../shared/services/email.service';
import {
  EMAIL_TEST_RECIPIENT,
  type EmailTestResultDTO,
  type SendEmailTestInput,
} from './email-test.types';

const defaultSubject = 'POMS SMTP Test';
const defaultMessage = 'This is a test email from the POMS backend SMTP configuration.';

export const emailTestService = {
  async send(input: SendEmailTestInput, actorUserId: number): Promise<EmailTestResultDTO> {
    if (!emailService.isConfigured()) {
      throw new AppError(
        'SMTP is not configured',
        StatusCodes.SERVICE_UNAVAILABLE,
        'SMTP_NOT_CONFIGURED',
      );
    }

    const subject = input.subject ?? defaultSubject;
    const message = input.message ?? defaultMessage;
    const sentAt = new Date().toISOString();

    await emailService.send({
      to: EMAIL_TEST_RECIPIENT,
      subject,
      text: [message, '', `Sent at: ${sentAt}`, `Triggered by user ID: ${actorUserId}`].join('\n'),
      html: renderEmailTestHtml(message, sentAt, actorUserId),
    });

    return {
      to: EMAIL_TEST_RECIPIENT,
      subject,
      sentAt,
    };
  },
};

export function renderEmailTestHtml(message: string, sentAt: string, actorUserId: number): string {
  return [
    '<!doctype html>',
    '<html lang="th">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<title>POMS SMTP Test</title>',
    '</head>',
    '<body>',
    `<p>${escapeHtml(message).replace(/\n/g, '<br>')}</p>`,
    `<p>Sent at: ${escapeHtml(sentAt)}<br>Triggered by user ID: ${actorUserId}</p>`,
    '</body>',
    '</html>',
  ].join('');
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
