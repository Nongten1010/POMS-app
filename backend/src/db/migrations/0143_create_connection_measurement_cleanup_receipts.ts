import knex, { type Knex } from 'knex';
import { createMeasurementCleanupReceipts } from '../../modules/connection-requests/connection-measurement-cleanup-schema';

// The parameter database can live on another server. This migration provisions
// only its durable receipts; it never deletes or backfills measurement rows.
export const config = { transaction: false };

export function cleanupSourceConfig(
  primary: Knex.MsSqlConnectionConfig,
  settings: NodeJS.ProcessEnv = process.env,
): Knex.Config {
  return {
    client: 'mssql',
    connection: {
      ...primary,
      server: settings.PARAMETER_DB_HOST ?? primary.server,
      port: settings.PARAMETER_DB_PORT ? Number(settings.PARAMETER_DB_PORT) : primary.port,
      database: settings.PARAMETER_DB_NAME ?? primary.database,
      user:
        settings.PARAMETER_DB_USER ??
        ('user' in primary && typeof primary.user === 'string' ? primary.user : undefined),
      password: settings.PARAMETER_DB_PASSWORD ?? primary.password,
      options: {
        ...primary.options,
        ...(settings.PARAMETER_DB_ENCRYPT !== undefined
          ? { encrypt: settings.PARAMETER_DB_ENCRYPT === 'true' }
          : {}),
        ...(settings.PARAMETER_DB_TRUST_SERVER_CERTIFICATE !== undefined
          ? { trustServerCertificate: settings.PARAMETER_DB_TRUST_SERVER_CERTIFICATE !== 'false' }
          : {}),
      },
    },
    pool: { min: 0, max: 1 },
  };
}

export async function up(primary: Knex): Promise<void> {
  const source = knex(cleanupSourceConfig(primary.client.config.connection));
  try {
    await createMeasurementCleanupReceipts(source, process.env.PARAMETER_DB_SCHEMA ?? 'dbo');
  } finally {
    await source.destroy();
  }
}

export async function down(): Promise<void> {
  // Retain receipts on rollback. Removing them could allow a retry to erase live
  // rows after an earlier cleanup committed but the primary transaction failed.
}
