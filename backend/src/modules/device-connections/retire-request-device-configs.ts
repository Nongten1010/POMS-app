import type { Knex } from 'knex';

/** The caller holds the source request lock until cancellation commits. */
export async function retireRequestDeviceConfigs(
  trx: Knex.Transaction,
  requestId: number,
  actorUserId: number,
): Promise<void> {
  const snapshots = await trx('device_connection_configs')
    .where('request_id', requestId)
    .whereNull('deleted_at')
    .forUpdate()
    .select('id');
  // Provenance, rather than station_id, protects settings from another request
  // or independently maintained settings for an already connected station.
  const current = await trx('device_connection_configs')
    .whereNull('request_id')
    .where('source_request_id', requestId)
    .whereNull('deleted_at')
    .forUpdate()
    .select('id');
  const configIds = [...snapshots, ...current].map((row) => Number(row.id));
  if (configIds.length === 0) return;

  const audit = {
    deleted_at: trx.fn.now(),
    updated_at: trx.fn.now(),
    updated_by: actorUserId,
  };
  await trx('device_measurement_channels')
    .whereIn('config_id', configIds)
    .whereNull('deleted_at')
    .update(audit);
  await trx('device_connection_configs')
    .whereIn('id', configIds)
    .whereNull('deleted_at')
    .update(audit);
}
