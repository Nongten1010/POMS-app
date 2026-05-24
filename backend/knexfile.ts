import 'dotenv/config';
import type { Knex } from 'knex';

const baseConfig: Knex.Config = {
  client: 'mssql',
  connection: {
    server: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 1433,
    user: process.env.DB_USER || 'sa',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'POMS',
    options: {
      encrypt: process.env.DB_ENCRYPT === 'true',
      trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE !== 'false',
    },
  },
  pool: {
    min: Number(process.env.DB_POOL_MIN) || 2,
    max: Number(process.env.DB_POOL_MAX) || 10,
  },
  migrations: {
    directory: './src/db/migrations',
    extension: 'ts',
    tableName: 'knex_migrations',
  },
  seeds: {
    directory: './src/db/seeds',
    extension: 'ts',
  },
};

const config: { [key: string]: Knex.Config } = {
  development: baseConfig,
  test: {
    ...baseConfig,
    connection: {
      ...(baseConfig.connection as object),
      database: `${process.env.DB_NAME || 'POMS'}_test`,
    },
  },
  production: baseConfig,
};

export default config;
