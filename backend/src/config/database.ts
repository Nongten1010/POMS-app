import knex, { Knex } from 'knex';
import { env } from './env';
import { logger } from './logger';

const config: Knex.Config = {
  client: 'mssql',
  connection: {
    server: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    options: {
      encrypt: env.DB_ENCRYPT,
      trustServerCertificate: env.DB_TRUST_SERVER_CERTIFICATE,
    },
  },
  pool: {
    min: env.DB_POOL_MIN,
    max: env.DB_POOL_MAX,
  },
};

export const db: Knex = knex(config);

export async function pingDatabase(): Promise<void> {
  try {
    await db.raw('SELECT 1 AS ping');
    logger.info(`[db] Connected to MSSQL ${env.DB_HOST}:${env.DB_PORT}/${env.DB_NAME}`);
  } catch (err) {
    logger.error('[db] Failed to connect to MSSQL', err);
    throw err;
  }
}

export async function closeDatabase(): Promise<void> {
  await db.destroy();
  logger.info('[db] Connection pool closed');
}
