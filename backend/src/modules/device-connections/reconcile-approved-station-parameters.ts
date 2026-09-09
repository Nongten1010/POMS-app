import type { Knex } from 'knex';
import {
  parameterKey,
  approvedParameterLabel,
} from '../poms-factories/poms-measurement-point-parameters';

// Only retire removed channels. A newly approved parameter has no known hardware
// address, range or encoding until the operator saves its device configuration.
export async function reconcileApprovedStationParameters(
  trx: Knex.Transaction,
  stationId: string,
  parameters: string[],
  actorUserId: number,
): Promise<void> {
  const allowed = new Set(parameters.map(parameterKey));
  const configs = await trx('device_connection_configs')
    .where('station_id', stationId)
    .whereNull('request_id')
    .whereNull('deleted_at')
    .forUpdate()
    .select('id', 'status_management_json');
  for (const config of configs) {
    const channels = await trx('device_measurement_channels')
      .where('config_id', config.id)
      .whereNull('deleted_at')
      .forUpdate()
      .select('id', 'data_type');
    const removedIds = channels
      .filter((channel) => approvedParameterLabel(channel.data_type, parameters) === undefined)
      .map((channel) => channel.id);
    const statusManagement = filterSchedules(config.status_management_json, allowed);
    if (removedIds.length === 0 && statusManagement === config.status_management_json) continue;
    const now = trx.fn.now();
    if (removedIds.length > 0) {
      await trx('device_measurement_channels')
        .where('config_id', config.id)
        .whereIn('id', removedIds)
        .whereNull('deleted_at')
        .update({ deleted_at: now, updated_at: now, updated_by: actorUserId });
    }
    await trx('device_connection_configs')
      .where('id', config.id)
      .whereNull('request_id')
      .whereNull('deleted_at')
      .update({
        status_management_json: statusManagement,
        updated_at: now,
        updated_by: actorUserId,
      });
  }
}

function filterSchedules(value: string | null, allowed: Set<string>): string | null {
  if (!value) return value;
  const parsed = JSON.parse(value) as Record<string, unknown>;
  const filter = (values: unknown): unknown =>
    Array.isArray(values)
      ? values.filter(
          (item) =>
            typeof item === 'string' &&
            (item === 'ทั้งหมด' || approvedParameterLabel(item, [...allowed]) !== undefined),
        )
      : values;
  const next = { ...parsed };
  if (Array.isArray(next.selectedParameters))
    next.selectedParameters = filter(next.selectedParameters);
  if (Array.isArray(next.schedules)) {
    next.schedules = next.schedules
      .map((schedule) => ({ ...schedule, selectedParameters: filter(schedule.selectedParameters) }))
      .filter(
        (schedule) =>
          !Array.isArray(schedule.selectedParameters) || schedule.selectedParameters.length > 0,
      );
  }
  return JSON.stringify(next) === JSON.stringify(parsed) ? value : JSON.stringify(next);
}
