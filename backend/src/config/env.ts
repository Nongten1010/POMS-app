import 'dotenv/config';
import { z } from 'zod';

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(3000),
    API_PREFIX: z.string().default('/api/v1'),

    DB_HOST: z.string().min(1),
    DB_PORT: z.coerce.number().int().positive().default(1433),
    DB_NAME: z.string().min(1),
    DB_USER: z.string().min(1),
    DB_PASSWORD: z.string(),
    DB_ENCRYPT: z
      .string()
      .default('false')
      .transform((v) => v === 'true'),
    DB_TRUST_SERVER_CERTIFICATE: z
      .string()
      .default('true')
      .transform((v) => v !== 'false'),
    DB_POOL_MIN: z.coerce.number().int().min(0).default(2),
    DB_POOL_MAX: z.coerce.number().int().min(1).default(10),

    JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
    JWT_EXPIRES_IN: z.string().default('15m'),
    JWT_REFRESH_SECRET: z.string().min(16),
    JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

    BCRYPT_SALT_ROUNDS: z.coerce.number().int().min(4).max(15).default(12),

    IDENTITY_PROVIDER: z.enum(['mock', 'external']).default('mock'),
    DIW_USER_LOGIN_ENABLED: z
      .string()
      .default('false')
      .transform((v) => v === 'true'),
    DIW_OFFICER_LOGIN_ENABLED: z
      .string()
      .default('false')
      .transform((v) => v === 'true'),
    DIW_USER_LOGIN_URL: z
      .string()
      .url()
      .default('https://diw-center.diw.go.th/uloginuat/v1/UserLogin'),
    DIW_OFFICER_LOGIN_URL: z
      .string()
      .url()
      .default('https://diw-center.diw.go.th/idiwdpisloginuat/v1/UserLogin'),
    DIW_USER_LOGIN_CLIENT_ID: z.string().min(1).optional(),
    DIW_USER_LOGIN_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),
    DIW_USER_LOGIN_DEFAULT_PROVINCE_ID: z.string().min(1).max(8).default('1000'),

    FACTORY_DB_HOST: z.string().min(1).optional(),
    FACTORY_DB_PORT: z.coerce.number().int().positive().optional(),
    FACTORY_DB_NAME: z.string().min(1).default('diw'),
    FACTORY_DB_USER: z.string().min(1).optional(),
    FACTORY_DB_PASSWORD: z.string().optional(),
    FACTORY_DB_ENCRYPT: z
      .string()
      .optional()
      .transform((v) => (v === undefined ? undefined : v === 'true')),
    FACTORY_DB_TRUST_SERVER_CERTIFICATE: z
      .string()
      .optional()
      .transform((v) => (v === undefined ? undefined : v !== 'false')),
    FACTORY_DB_SCHEMA: z
      .string()
      .regex(/^[A-Za-z_][A-Za-z0-9_]*$/)
      .default('dbo'),
    FACTORY_DB_TABLE: z
      .string()
      .regex(/^[A-Za-z_][A-Za-z0-9_]*$/)
      .default('fac_import'),

    BOILER_DB_HOST: z.string().min(1).default('sqldiw.diw.go.th'),
    BOILER_DB_PORT: z.coerce.number().int().positive().optional(),
    BOILER_DB_NAME: z.string().min(1).default('control'),
    BOILER_DB_USER: z.string().min(1).optional(),
    BOILER_DB_PASSWORD: z.string().optional(),
    BOILER_DB_ENCRYPT: z
      .string()
      .optional()
      .transform((v) => (v === undefined ? undefined : v === 'true')),
    BOILER_DB_TRUST_SERVER_CERTIFICATE: z
      .string()
      .optional()
      .transform((v) => (v === undefined ? undefined : v !== 'false')),
    BOILER_DB_SCHEMA: z
      .string()
      .regex(/^[A-Za-z_][A-Za-z0-9_]*$/)
      .default('dbo'),
    BOILER_DB_TABLE: z
      .string()
      .regex(/^[A-Za-z_][A-Za-z0-9_]*$/)
      .default('boiler_list'),

    PARAMETER_DB_HOST: z.string().min(1).optional(),
    PARAMETER_DB_PORT: z.coerce.number().int().positive().optional(),
    PARAMETER_DB_NAME: z.string().min(1).optional(),
    PARAMETER_DB_USER: z.string().min(1).optional(),
    PARAMETER_DB_PASSWORD: z.string().optional(),
    PARAMETER_DB_ENCRYPT: z
      .string()
      .optional()
      .transform((v) => (v === undefined ? undefined : v === 'true')),
    PARAMETER_DB_TRUST_SERVER_CERTIFICATE: z
      .string()
      .optional()
      .transform((v) => (v === undefined ? undefined : v !== 'false')),
    PARAMETER_DB_SCHEMA: z
      .string()
      .regex(/^[A-Za-z_][A-Za-z0-9_]*$/)
      .default('dbo'),
    PARAMETER_DB_TABLE: z
      .string()
      .regex(/^[A-Za-z_][A-Za-z0-9_]*$/)
      .default('parameter_values'),

    INTEGRATION_API_KEYS: z.string().optional(),
    DEVICE_CONFIG_API_KEYS: z.string().optional(),
    ALERT_EVENT_API_KEYS: z.string().optional(),

    SMTP_HOST: z.string().min(1).optional(),
    SMTP_PORT: z.coerce.number().int().positive().default(587),
    SMTP_SECURE: z
      .string()
      .default('false')
      .transform((v) => v === 'true'),
    SMTP_REQUIRE_TLS: z
      .string()
      .default('true')
      .transform((v) => v !== 'false'),
    SMTP_USERNAME: z.string().min(1).optional(),
    SMTP_PASSWORD: z.string().min(1).optional(),
    SMTP_FROM: z.string().min(1).optional(),

    CORS_ORIGIN: z.string().default('*'),
    PUBLIC_BASE_URL: z.string().url().optional(),
    UPLOAD_DIR: z.string().min(1).default('uploads'),
    UPLOAD_PUBLIC_PATH: z
      .string()
      .regex(/^\/[A-Za-z0-9/_-]*$/)
      .default('/uploads'),

    LOG_LEVEL: z.enum(['error', 'warn', 'info', 'http', 'debug']).default('info'),
  })
  .superRefine((value, ctx) => {
    const smtpFields = [
      value.SMTP_HOST,
      process.env.SMTP_PORT,
      process.env.SMTP_SECURE,
      process.env.SMTP_REQUIRE_TLS,
      value.SMTP_USERNAME,
      value.SMTP_PASSWORD,
      value.SMTP_FROM,
    ];
    const hasSmtpConfig = smtpFields.some((field) => field !== undefined && field !== '');

    if (hasSmtpConfig) {
      const requiredFields: Array<[string, string | undefined]> = [
        ['SMTP_HOST', value.SMTP_HOST],
        ['SMTP_USERNAME', value.SMTP_USERNAME],
        ['SMTP_PASSWORD', value.SMTP_PASSWORD],
        ['SMTP_FROM', value.SMTP_FROM],
      ];

      for (const [fieldName, fieldValue] of requiredFields) {
        if (!fieldValue) {
          ctx.addIssue({
            code: 'custom',
            path: [fieldName],
            message: `${fieldName} is required when SMTP is configured`,
          });
        }
      }
    }

    if (
      (value.DIW_USER_LOGIN_ENABLED || value.DIW_OFFICER_LOGIN_ENABLED) &&
      !value.DIW_USER_LOGIN_CLIENT_ID
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['DIW_USER_LOGIN_CLIENT_ID'],
        message:
          'DIW_USER_LOGIN_CLIENT_ID is required when DIW UserLogin integration is enabled',
      });
    }
  });

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;
