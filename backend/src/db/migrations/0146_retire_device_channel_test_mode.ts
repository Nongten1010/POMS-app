import type { Knex } from 'knex';

export const config = { transaction: false };

interface PointRow {
  id: number | string;
  point_code: string | null;
  point_name: string;
  parameters_json: string;
  connected_at: Date | string;
}

interface ParameterIdentity {
  code: string;
  unit: string;
  key: string;
}

// Frozen migration identity rules: never import changing application policy here.
function parameterIdentity(label: string): ParameterIdentity | null {
  const match = label.trim().match(/^(.*?)\s*\(([^()]*)\)\s*$/u);
  if (!match) return null;
  const code = match[1]
    .trim()
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^a-z0-9_-]/gu, '');
  const unit = match[2].trim().normalize('NFKC').toLowerCase();
  return code && unit ? { code, unit, key: JSON.stringify([code, unit]) } : null;
}

function approvedKeys(value: string): Set<string> {
  const labels: unknown = JSON.parse(value);
  if (!Array.isArray(labels) || labels.some((label) => typeof label !== 'string')) {
    throw new Error('Invalid approved parameters during Test mode retirement');
  }
  return new Set(
    labels.flatMap((label: string) => {
      const parameter = parameterIdentity(label);
      return parameter ? [parameter.key] : [];
    }),
  );
}

export async function up(knex: Knex): Promise<void> {
  const [clock] = await knex.raw('SELECT SYSUTCDATETIME() AS cutover_at');
  const cutover = new Date(clock.cutover_at);
  if (!Number.isFinite(cutover.getTime())) throw new Error('Invalid Test mode cutover time');

  const points = await knex('cems_wpms_connected_measurement_points')
    .whereNull('deleted_at')
    .whereNotNull('connected_at')
    .orderBy('id', 'asc')
    .select('id');
  for (const candidate of points) {
    // Match the live-point -> current-config lock order used by config writers.
    await knex.transaction(async (trx) => {
      const point = await trx<PointRow>('cems_wpms_connected_measurement_points')
        .where('id', candidate.id)
        .whereNull('deleted_at')
        .whereNotNull('connected_at')
        .forUpdate()
        .first('id', 'point_code', 'point_name', 'parameters_json', 'connected_at');
      if (!point) return;
      const connectedAt =
        point.connected_at instanceof Date
          ? point.connected_at.getTime()
          : Date.parse(point.connected_at);
      if (!Number.isFinite(connectedAt)) throw new Error('Invalid connected point timestamp');
      const activationAt = new Date(Math.max(cutover.getTime(), connectedAt));
      const stationId = point.point_code?.trim() || point.point_name.trim();
      const configs = await trx('device_connection_configs')
        .where('station_id', stationId)
        .whereNull('request_id')
        .whereNull('deleted_at')
        .orderBy('id', 'asc')
        .forUpdate()
        .select('id');
      if (configs.length === 0) return;
      const channels = await trx('device_measurement_channels')
        .whereIn(
          'config_id',
          configs.map((entry) => entry.id),
        )
        .where('test_mode', true)
        .whereNull('deleted_at')
        .orderBy('id', 'asc')
        .forUpdate()
        .select('data_type');
      if (channels.length === 0) return;
      const approved = approvedKeys(point.parameters_json);
      const existing = await trx('alert_parameter_activations')
        .where('connected_point_id', point.id)
        .whereNull('deactivated_at')
        .forUpdate()
        .select('parameter_code', 'unit');
      const activeKeys = new Set(
        existing.map((entry) =>
          JSON.stringify([
            String(entry.parameter_code).normalize('NFKC').trim().toLowerCase(),
            String(entry.unit).normalize('NFKC').trim().toLowerCase(),
          ]),
        ),
      );
      const missing = new Map<string, ParameterIdentity>();
      for (const channel of channels) {
        const parameter = parameterIdentity(channel.data_type);
        if (parameter && approved.has(parameter.key) && !activeKeys.has(parameter.key)) {
          missing.set(parameter.key, parameter);
        }
      }
      const values = [...missing.values()].map((parameter) => ({
        connected_point_id: Number(point.id),
        parameter_code: parameter.code,
        unit: parameter.unit,
        activated_at: activationAt,
      }));
      // Four bindings per row; stay below SQL Server's 2,100-parameter limit.
      for (let index = 0; index < values.length; index += 200) {
        await trx('alert_parameter_activations').insert(values.slice(index, index + 200));
      }
    });
  }

  // Include historical/snapshot flags, but retain their original audit fields.
  // Each batch commits separately so a large channel history does not take one
  // long-running table-wide update; rerunning the migration is safe.
  for (;;) {
    const channels = await knex('device_measurement_channels')
      .where('test_mode', true)
      .orderBy('id', 'asc')
      .limit(500)
      .select('id');
    if (channels.length === 0) break;
    await knex('device_measurement_channels')
      .whereIn(
        'id',
        channels.map((channel) => channel.id),
      )
      .where('test_mode', true)
      .update({ test_mode: false });
  }
}

export async function down(_knex: Knex): Promise<void> {
  // Forward-only: restoring flags would re-enable retired behavior and lose
  // the distinction between migration activations and later live registrations.
}
