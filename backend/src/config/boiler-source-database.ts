import knex, { Knex } from 'knex';
import { env } from './env';
import { logger } from './logger';

const config: Knex.Config = {
  client: 'mssql',
  connection: {
    server: env.BOILER_DB_HOST ?? env.FACTORY_DB_HOST ?? env.DB_HOST,
    port: env.BOILER_DB_PORT ?? env.FACTORY_DB_PORT ?? env.DB_PORT,
    user: env.BOILER_DB_USER ?? env.FACTORY_DB_USER ?? env.DB_USER,
    password: env.BOILER_DB_PASSWORD ?? env.FACTORY_DB_PASSWORD ?? env.DB_PASSWORD,
    database: env.BOILER_DB_NAME,
    options: {
      encrypt: env.BOILER_DB_ENCRYPT ?? env.FACTORY_DB_ENCRYPT ?? env.DB_ENCRYPT,
      trustServerCertificate:
        env.BOILER_DB_TRUST_SERVER_CERTIFICATE ??
        env.FACTORY_DB_TRUST_SERVER_CERTIFICATE ??
        env.DB_TRUST_SERVER_CERTIFICATE,
    },
  },
  pool: {
    min: 0,
    max: env.DB_POOL_MAX,
  },
};

export const boilerSourceDb: Knex = knex(config);

export function boilerSourceTableName(): string {
  return `${env.BOILER_DB_SCHEMA}.${env.BOILER_DB_TABLE}`;
}

export async function closeBoilerSourceDatabase(): Promise<void> {
  await boilerSourceDb.destroy();
  logger.info('[boiler-source-db] Connection pool closed');
}
