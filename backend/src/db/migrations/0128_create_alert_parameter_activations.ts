import type { Knex } from 'knex';
import { parseRegisteredAlertParameter } from '../../modules/alert-emails/alert-parameter-activations';

export const config = { transaction: true };

interface BackfillRow {
  connected_point_id: number | string;
  connected_at: Date | string;
  updated_at: Date | string;
  data_type: string;
}

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('alert_parameter_activations', (table) => {
    table.bigIncrements('id').primary();
    table.bigInteger('connected_point_id').notNullable();
    table.specificType('parameter_code', 'VARCHAR(128) NOT NULL');
    table.specificType('unit', 'NVARCHAR(128) NOT NULL');
    // UTC instants: application writes bind Date, not server-local audit defaults.
    table.specificType('activated_at', 'DATETIME2 NOT NULL');
    table.specificType('deactivated_at', 'DATETIME2 NULL');
    table.specificType('created_at', 'DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()');
    table
      .foreign('connected_point_id', 'fk_alert_parameter_activations_point')
      .references('id')
      .inTable('cems_wpms_connected_measurement_points');
    table.check(
      'deactivated_at IS NULL OR deactivated_at >= activated_at',
      [],
      'ck_alert_parameter_activations_period',
    );
  });
  await knex.schema.raw(`
    CREATE UNIQUE INDEX uq_alert_parameter_activations_active
    ON alert_parameter_activations(connected_point_id, parameter_code, unit)
    WHERE deactivated_at IS NULL;
  `);
  // Preserve the previous conservative lower bound once. Historical replace
  // audit timestamps cannot prove an uninterrupted parameter registration.
  const rows = await knex.raw<BackfillRow[]>(`
    SELECT cp.id AS connected_point_id, cp.connected_at, dc.updated_at, ch.data_type
    FROM cems_wpms_connected_measurement_points AS cp
    INNER JOIN device_connection_configs AS dc
      ON dc.station_id = COALESCE(NULLIF(LTRIM(RTRIM(cp.point_code)), ''), cp.point_name)
      AND dc.request_id IS NULL AND dc.deleted_at IS NULL
    INNER JOIN device_measurement_channels AS ch
      ON ch.config_id = dc.id AND ch.deleted_at IS NULL
      AND (ch.test_mode = 0 OR ch.test_mode IS NULL)
    WHERE cp.deleted_at IS NULL AND cp.connected_at IS NOT NULL;
  `);
  const activations = new Map<
    string,
    {
      connected_point_id: number;
      parameter_code: string;
      unit: string;
      activated_at: Date;
    }
  >();
  for (const row of rows) {
    const parameter = parseRegisteredAlertParameter(row.data_type);
    if (!parameter) continue;
    const pointId = Number(row.connected_point_id);
    const connected = new Date(row.connected_at).getTime();
    const revision = new Date(row.updated_at).getTime();
    if (
      !Number.isSafeInteger(pointId) ||
      pointId < 1 ||
      !Number.isFinite(connected) ||
      !Number.isFinite(revision)
    )
      throw new Error('Invalid active parameter activation backfill');
    const key = JSON.stringify([pointId, parameter.key]);
    const activated = Math.max(
      connected,
      revision,
      activations.get(key)?.activated_at.getTime() ?? -Infinity,
    );
    activations.set(key, {
      connected_point_id: pointId,
      parameter_code: parameter.parameterCode,
      unit: parameter.unit.normalize('NFKC').toLowerCase(),
      activated_at: new Date(activated),
    });
  }
  const values = [...activations.values()];
  // SQL Server has a 2,100-parameter limit; each row binds four values.
  for (let index = 0; index < values.length; index += 200) {
    await knex('alert_parameter_activations').insert(values.slice(index, index + 200));
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('alert_parameter_activations');
}
