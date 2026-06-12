export const EMAIL_TEST_RECIPIENT = 'yuth.s@ku.th';

export interface SendEmailTestInput {
  subject?: string;
  message?: string;
}

export interface EmailTestResultDTO {
  to: string;
  subject: string;
  sentAt: string;
}
