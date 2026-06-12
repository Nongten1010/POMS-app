import { describe, expect, it } from '@jest/globals';
import {
  buildSmtpTransportOptions,
  getDefaultMailFrom,
  isSmtpConfigured,
  type SmtpRuntimeConfig,
} from '../../src/config/smtp';

const baseConfig: SmtpRuntimeConfig = {
  SMTP_HOST: 'mailrelay.uc-workd.com',
  SMTP_PORT: 587,
  SMTP_SECURE: false,
  SMTP_REQUIRE_TLS: true,
  SMTP_USERNAME: 'diwmailreply2@diw.mail.go.th',
  SMTP_PASSWORD: 'secret',
  SMTP_FROM: 'POMS Notification <diwmailreply2@diw.mail.go.th>',
};

describe('smtp config', () => {
  it('returns null transport options when SMTP is not configured', () => {
    expect(isSmtpConfigured({ ...baseConfig, SMTP_HOST: undefined })).toBe(false);
    expect(buildSmtpTransportOptions({ ...baseConfig, SMTP_HOST: undefined })).toBeNull();
  });

  it('builds STARTTLS transport options for port 587', () => {
    expect(buildSmtpTransportOptions(baseConfig)).toEqual({
      host: 'mailrelay.uc-workd.com',
      port: 587,
      secure: false,
      requireTLS: true,
      auth: {
        user: 'diwmailreply2@diw.mail.go.th',
        pass: 'secret',
      },
    });
  });

  it('builds SSL transport options without STARTTLS requirement', () => {
    expect(
      buildSmtpTransportOptions({
        ...baseConfig,
        SMTP_PORT: 467,
        SMTP_SECURE: true,
      }),
    ).toEqual({
      host: 'mailrelay.uc-workd.com',
      port: 467,
      secure: true,
      auth: {
        user: 'diwmailreply2@diw.mail.go.th',
        pass: 'secret',
      },
    });
  });

  it('throws a redacted error when credentials are incomplete', () => {
    expect(() => buildSmtpTransportOptions({ ...baseConfig, SMTP_PASSWORD: undefined })).toThrow(
      'SMTP configuration missing: SMTP_PASSWORD',
    );
  });

  it('returns the default sender from config', () => {
    expect(getDefaultMailFrom(baseConfig)).toBe('POMS Notification <diwmailreply2@diw.mail.go.th>');
  });
});
