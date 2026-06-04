import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
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

  CORS_ORIGIN: z.string().default('*'),

  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'http', 'debug']).default('info'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;
