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
    });

    return {
      to: EMAIL_TEST_RECIPIENT,
      subject,
      sentAt,
    };
  },
};
