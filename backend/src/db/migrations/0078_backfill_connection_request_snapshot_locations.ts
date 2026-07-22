import type { Knex } from 'knex';

export const config = { transaction: true };

export async function up(knex: Knex): Promise<void> {
  await knex.schema.raw(`
    UPDATE snapshot_row
    SET
      snapshot_row.region_code = COALESCE(snapshot_row.region_code, province_row.region),
      snapshot_row.region_name = COALESCE(snapshot_row.region_name, province_row.region),
      snapshot_row.province_code = COALESCE(snapshot_row.province_code, province_row.id),
      snapshot_row.province_name = COALESCE(snapshot_row.province_name, eligible_row.province_name),
      snapshot_row.updated_at = SYSUTCDATETIME()
    FROM cems_wpms_request_factory_snapshots AS snapshot_row
    INNER JOIN cems_wpms_connection_requests AS request_row
      ON request_row.id = snapshot_row.request_id
      AND request_row.deleted_at IS NULL
    INNER JOIN eligible_factories AS eligible_row
      ON eligible_row.id = request_row.eligible_factory_id
      AND eligible_row.deleted_at IS NULL
    LEFT JOIN provinces AS province_row
      ON province_row.name_th = eligible_row.province_name
    WHERE snapshot_row.deleted_at IS NULL
      AND (
        snapshot_row.region_code IS NULL
        OR snapshot_row.region_name IS NULL
        OR snapshot_row.province_code IS NULL
        OR snapshot_row.province_name IS NULL
      );
  `);
}

export async function down(knex: Knex): Promise<void> {
  void knex;
}
