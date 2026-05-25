import knex, { Knex } from 'knex';
import { env } from './env';
import { logger } from './logger';

const config: Knex.Config = {
  client: 'mssql',
  connection: {
    server: env.FACTORY_DB_HOST ?? env.DB_HOST,
    port: env.FACTORY_DB_PORT ?? env.DB_PORT,
    user: env.FACTORY_DB_USER ?? env.DB_USER,
    password: env.FACTORY_DB_PASSWORD ?? env.DB_PASSWORD,
    database: env.FACTORY_DB_NAME,
    options: {
      encrypt: env.FACTORY_DB_ENCRYPT ?? env.DB_ENCRYPT,
      trustServerCertificate:
        env.FACTORY_DB_TRUST_SERVER_CERTIFICATE ?? env.DB_TRUST_SERVER_CERTIFICATE,
    },
  },
  pool: {
    min: 0,
    max: env.DB_POOL_MAX,
  },
};

export const factorySourceDb: Knex = knex(config);

export function factorySourceTableName(): string {
  return `${env.FACTORY_DB_SCHEMA}.${env.FACTORY_DB_TABLE}`;
}

export async function closeFactorySourceDatabase(): Promise<void> {
  await factorySourceDb.destroy();
  logger.info('[factory-source-db] Connection pool closed');
}
