import knex, { Knex } from 'knex';
import { env } from './env';
import { logger } from './logger';

const config: Knex.Config = {
  client: 'mssql',
  connection: {
    server: env.PARAMETER_DB_HOST ?? env.DB_HOST,
    port: env.PARAMETER_DB_PORT ?? env.DB_PORT,
    user: env.PARAMETER_DB_USER ?? env.DB_USER,
    password: env.PARAMETER_DB_PASSWORD ?? env.DB_PASSWORD,
    database: env.PARAMETER_DB_NAME ?? env.DB_NAME,
    options: {
      encrypt: env.PARAMETER_DB_ENCRYPT ?? env.DB_ENCRYPT,
      trustServerCertificate:
        env.PARAMETER_DB_TRUST_SERVER_CERTIFICATE ?? env.DB_TRUST_SERVER_CERTIFICATE,
    },
  },
  pool: {
    min: 0,
    max: env.DB_POOL_MAX,
  },
};

export const parameterSourceDb: Knex = knex(config);

export function parameterSourceTableName(): string {
  return `${env.PARAMETER_DB_SCHEMA}.${env.PARAMETER_DB_TABLE}`;
}

export async function closeParameterSourceDatabase(): Promise<void> {
  await parameterSourceDb.destroy();
  logger.info('[parameter-source-db] Connection pool closed');
}
