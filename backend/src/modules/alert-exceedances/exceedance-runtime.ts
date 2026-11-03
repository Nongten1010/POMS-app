import knex, { type Knex } from 'knex';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { guardMssqlPool } from '../../config/mssql-pool-guard';
import type { ActiveExceedancePolicy } from './exceedance-policy';
import { createExceedanceRepository } from './exceedance-repository';
import { createExceedanceWorker } from './exceedance-worker';

export function exceedanceDatabaseConfig(
  policy: ActiveExceedancePolicy,
  source: boolean,
): Knex.Config {
  const connection: Knex.MsSqlConnectionConfig = {
    server: source ? (env.PARAMETER_DB_HOST ?? env.DB_HOST) : env.DB_HOST,
    port: source ? (env.PARAMETER_DB_PORT ?? env.DB_PORT) : env.DB_PORT,
    userName: source ? (env.PARAMETER_DB_USER ?? env.DB_USER) : env.DB_USER,
    password: source ? (env.PARAMETER_DB_PASSWORD ?? env.DB_PASSWORD) : env.DB_PASSWORD,
    database: source ? (env.PARAMETER_DB_NAME ?? env.DB_NAME) : env.DB_NAME,
    requestTimeout: policy.timeoutMs,
    connectionTimeout: policy.timeoutMs,
    options: {
      encrypt: source ? (env.PARAMETER_DB_ENCRYPT ?? env.DB_ENCRYPT) : env.DB_ENCRYPT,
      trustServerCertificate: source
        ? (env.PARAMETER_DB_TRUST_SERVER_CERTIFICATE ?? env.DB_TRUST_SERVER_CERTIFICATE)
        : env.DB_TRUST_SERVER_CERTIFICATE,
      // Native Tedious requestTimeout cancels the request, unlike a Promise.race wrapper.
      useUTC: true,
      appName: 'POMS-hourly-exceedance',
    },
  };
  return {
    client: 'mssql',
    connection,
    pool: { min: 0, max: 1 },
    acquireConnectionTimeout: policy.timeoutMs,
  };
}

/** Dedicated process; no HTTP, SMTP or recipient lookup is started here. */
export function startExceedanceRuntime(policy: ActiveExceedancePolicy) {
  const db = knex(exceedanceDatabaseConfig(policy, false));
  const source = knex(exceedanceDatabaseConfig(policy, true));
  guardMssqlPool(db);
  guardMssqlPool(source);
  const repository = createExceedanceRepository(db, source, env.PARAMETER_DB_SCHEMA, policy);
  const worker = createExceedanceWorker(policy, {
    ...repository,
    report(summary) {
      logger.info('[alert-exceedance] RUN', summary);
    },
  });
  return {
    runOnce: worker.runOnce,
    async stop(): Promise<void> {
      await worker.stop();
      await Promise.all([db.destroy(), source.destroy()]);
    },
  };
}
