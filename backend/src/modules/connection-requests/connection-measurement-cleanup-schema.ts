import type { Knex } from 'knex';

export const MEASUREMENT_CLEANUP_RECEIPTS_TABLE = 'connection_measurement_cleanup_receipts';

// Point codes can contain Unicode, dots and brackets. Quote the entire identifier
// instead of letting Knex interpret a dot inside a point code as a schema separator.
export function cleanupSqlIdentifier(value: string): string {
  if (!value || value.length > 128 || value.includes('\0')) {
    throw new Error('Invalid measurement cleanup SQL identifier');
  }
  return `[${value.replace(/]/g, ']]')}]`;
}

export async function createMeasurementCleanupReceipts(
  source: Knex,
  schema: string,
): Promise<void> {
  const table = `${cleanupSqlIdentifier(schema)}.${cleanupSqlIdentifier(MEASUREMENT_CLEANUP_RECEIPTS_TABLE)}`;
  await source.transaction(async (trx) => {
    await trx.raw(`
      DECLARE @result int;
      EXEC @result = sys.sp_getapplock
        @Resource = N'poms-measurement-cleanup-schema',
        @LockMode = 'Exclusive', @LockOwner = 'Transaction', @LockTimeout = 15000;
      IF @result < 0 THROW 51000, 'Measurement cleanup schema lock unavailable', 1;
    `);
    if (await trx.schema.withSchema(schema).hasTable(MEASUREMENT_CLEANUP_RECEIPTS_TABLE)) return;
    await trx.raw(`
      CREATE TABLE ${table} (
        source_key char(64) NOT NULL,
        station_id nvarchar(64) NOT NULL,
        request_id bigint NOT NULL,
        actor_user_id bigint NOT NULL,
        cleared_at datetime2 NOT NULL DEFAULT SYSUTCDATETIME(),
        table_results_json nvarchar(max) NOT NULL,
        PRIMARY KEY (source_key, station_id),
        CHECK (ISJSON(table_results_json) = 1)
      );
    `);
  });
}
