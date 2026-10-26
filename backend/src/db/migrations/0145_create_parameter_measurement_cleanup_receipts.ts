import knex, { type Knex } from 'knex';
import { cleanupSourceConfig } from './0143_create_connection_measurement_cleanup_receipts';
import { createParameterMeasurementCleanupReceipts } from '../../modules/connection-requests/parameter-measurement-cleanup-schema';

// Schema-only migration in the measurement DB. It never clears measurements.
export const config = { transaction: false };

export async function up(primary: Knex): Promise<void> {
  const source = knex(cleanupSourceConfig(primary.client.config.connection));
  try {
    await createParameterMeasurementCleanupReceipts(
      source,
      process.env.PARAMETER_DB_SCHEMA ?? 'dbo',
    );
  } finally {
    await source.destroy();
  }
}

export async function down(): Promise<void> {
  // Deliberately retain durable receipts. Removing them would allow retries to
  // clear live values received after a previous measurement transaction committed.
}
