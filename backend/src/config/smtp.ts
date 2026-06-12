import type SMTPTransport from 'nodemailer/lib/smtp-transport';
import { env, type Env } from './env';

export type SmtpRuntimeConfig = Pick<
  Env,
  | 'SMTP_HOST'
  | 'SMTP_PORT'
  | 'SMTP_SECURE'
  | 'SMTP_REQUIRE_TLS'
  | 'SMTP_USERNAME'
  | 'SMTP_PASSWORD'
  | 'SMTP_FROM'
>;

export function isSmtpConfigured(config: SmtpRuntimeConfig = env): boolean {
  return Boolean(config.SMTP_HOST);
}

export function buildSmtpTransportOptions(
  config: SmtpRuntimeConfig = env,
): SMTPTransport.Options | null {
  if (!isSmtpConfigured(config)) {
    return null;
  }

  assertCompleteSmtpConfig(config);

  const options: SMTPTransport.Options = {
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    secure: config.SMTP_SECURE,
    auth: {
      user: config.SMTP_USERNAME,
      pass: config.SMTP_PASSWORD,
    },
  };

  if (!config.SMTP_SECURE && config.SMTP_REQUIRE_TLS) {
    options.requireTLS = true;
  }

  return options;
}

export function getDefaultMailFrom(config: SmtpRuntimeConfig = env): string | undefined {
  return config.SMTP_FROM;
}

function assertCompleteSmtpConfig(
  config: SmtpRuntimeConfig,
): asserts config is SmtpRuntimeConfig & {
  SMTP_HOST: string;
  SMTP_USERNAME: string;
  SMTP_PASSWORD: string;
  SMTP_FROM: string;
} {
  const missing = [
    ['SMTP_HOST', config.SMTP_HOST],
    ['SMTP_USERNAME', config.SMTP_USERNAME],
    ['SMTP_PASSWORD', config.SMTP_PASSWORD],
    ['SMTP_FROM', config.SMTP_FROM],
  ]
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    throw new Error(`SMTP configuration missing: ${missing.join(', ')}`);
  }
}
