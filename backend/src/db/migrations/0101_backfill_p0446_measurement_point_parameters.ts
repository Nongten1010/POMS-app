import type { Knex } from 'knex';

const PARAMETERS_JSON = '["BOD (mg/l)","Flow rate (m3/hr)","Watt (kW/hr)"]';

export const config = { transaction: true };

export async function up(knex: Knex): Promise<void> {
  await knex.schema.raw(`
    UPDATE request_point
    SET
      request_point.parameters_json = N'${PARAMETERS_JSON}',
      request_point.updated_at = SYSUTCDATETIME()
    FROM cems_wpms_measurement_points AS request_point
    INNER JOIN cems_wpms_connection_requests AS request_row
      ON request_row.id = request_point.request_id
    WHERE request_row.deleted_at IS NULL
      AND request_point.deleted_at IS NULL
      AND request_row.request_no = 'WPMS-0011/2569'
      AND request_row.system_type = 'WPMS'
      AND request_row.status = 'CONNECTED'
      AND UPPER(LTRIM(RTRIM(request_point.point_code))) = 'P0446'
      AND LTRIM(RTRIM(request_point.parameters_json)) = N'[]';

    UPDATE connected_point
    SET
      connected_point.parameters_json = N'${PARAMETERS_JSON}',
      connected_point.updated_at = SYSUTCDATETIME()
    FROM cems_wpms_connected_measurement_points AS connected_point
    INNER JOIN cems_wpms_connection_requests AS request_row
      ON request_row.id = connected_point.source_request_id
    WHERE request_row.deleted_at IS NULL
      AND connected_point.deleted_at IS NULL
      AND request_row.request_no = 'WPMS-0011/2569'
      AND request_row.system_type = 'WPMS'
      AND request_row.status = 'CONNECTED'
      AND UPPER(LTRIM(RTRIM(connected_point.point_code))) = 'P0446'
      AND LTRIM(RTRIM(connected_point.parameters_json)) = N'[]';
  `);
}

export async function down(knex: Knex): Promise<void> {
  // Forward-only data repair: clearing these values could remove later operator configuration.
  void knex;
}
