import type { Knex } from 'knex';
import { cleanupSqlIdentifier } from './connection-measurement-cleanup-schema';

export const PARAMETER_CLEANUP_RECEIPTS_TABLE = 'parameter_measurement_cleanup_receipts';

export async function createParameterMeasurementCleanupReceipts(
  source: Knex,
  schema: string,
): Promise<void> {
  await source.transaction(async (trx) => {
    await trx.raw(`DECLARE @result int;
      EXEC @result = sys.sp_getapplock @Resource = N'poms-parameter-cleanup-schema',
        @LockMode = 'Exclusive', @LockOwner = 'Transaction', @LockTimeout = 15000;
      IF @result < 0 THROW 51000, 'Parameter cleanup schema lock unavailable', 1;`);
    if (await trx.schema.withSchema(schema).hasTable(PARAMETER_CLEANUP_RECEIPTS_TABLE)) return;
    await trx.raw(`CREATE TABLE ${cleanupSqlIdentifier(schema)}.${cleanupSqlIdentifier(PARAMETER_CLEANUP_RECEIPTS_TABLE)} (
      source_key char(64) NOT NULL,
      request_id bigint NOT NULL,
      station_id nvarchar(64) NOT NULL,
      parameter_key char(64) NOT NULL,
      parameter_label nvarchar(255) NOT NULL,
      actor_user_id bigint NOT NULL,
      cleared_at datetime2 NOT NULL DEFAULT SYSUTCDATETIME(),
      table_results_json nvarchar(max) NOT NULL,
      PRIMARY KEY (source_key, request_id, station_id, parameter_key),
      CHECK (ISJSON(table_results_json) = 1)
    )`);
  });
}
