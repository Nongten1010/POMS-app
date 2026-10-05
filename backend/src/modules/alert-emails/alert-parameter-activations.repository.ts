import type { Knex } from 'knex';
import { db } from '../../config/database';
import {
  parseRegisteredAlertParameter,
  planAlertParameterActivations,
  normalizeAlertActivationStationIdentity,
  type StoredAlertParameterActivation,
} from './alert-parameter-activations';

interface ActivationRow {
  id: number | string;
  connected_point_id: number | string;
  parameter_code: string;
  unit: string;
  activated_at: Date | string;
}

interface ActivationPoint {
  id: number | string;
  point_code: string | null;
  point_name: string;
  connected_at: Date | string | null;
}

export async function listActiveAlertParameterActivations(
  pointId: number,
): Promise<Array<{ parameterCode: string; unit: string; activatedAt: string }>> {
  if (!Number.isSafeInteger(pointId) || pointId < 1) throw new Error('Invalid activation point');
  const rows = await db<ActivationRow>('alert_parameter_activations')
    .where('connected_point_id', pointId)
    .whereNull('deactivated_at')
    .orderBy('id', 'asc')
    .select('id', 'parameter_code', 'unit', 'activated_at');
  return rows.map((row) => ({
    parameterCode: row.parameter_code,
    unit: row.unit,
    activatedAt: activationIso(row.activated_at),
  }));
}

/** All config writers acquire this lock before changing configs, including batch saves. */
export async function lockAlertActivationPoints(
  trx: Knex.Transaction,
  stationIds: string[],
): Promise<ActivationPoint[]> {
  const stations = [...new Set(stationIds.map((station) => station.trim()).filter(Boolean))].sort();
  if (stations.length === 0) return [];
  const candidates = await trx<ActivationPoint>('cems_wpms_connected_measurement_points')
    .whereNull('deleted_at')
    .where((builder) => builder.whereIn('point_code', stations).orWhereIn('point_name', stations))
    .orderBy('id', 'asc')
    .forUpdate()
    .select('id', 'point_code', 'point_name', 'connected_at');
  const points = new Map<number, ActivationPoint>();
  for (const station of stations) {
    const normalized = normalizeAlertActivationStationIdentity(station);
    const byCode = candidates.filter(
      (point) => normalizeAlertActivationStationIdentity(point.point_code ?? '') === normalized,
    );
    const matches =
      byCode.length > 0
        ? byCode
        : candidates.filter(
            (point) =>
              !point.point_code?.trim() &&
              normalizeAlertActivationStationIdentity(point.point_name) === normalized,
          );
    if (matches.length > 1) throw new Error('Ambiguous activation station');
    for (const point of matches) points.set(Number(point.id), point);
  }
  return [...points.values()].sort((a, b) => Number(a.id) - Number(b.id));
}

/** Synchronize only the final active state, never request snapshots or intermediate replace steps. */
export async function syncAlertParameterActivations(
  trx: Knex.Transaction,
  stationIds: string[],
  options: { now?: Date; carryFromPointId?: number } = {},
): Promise<void> {
  const now = options.now ?? new Date();
  if (!Number.isFinite(now.getTime())) throw new Error('Invalid activation synchronization time');
  const points = await lockAlertActivationPoints(trx, stationIds);
  if (options.carryFromPointId !== undefined && points.length !== 1)
    throw new Error('Continuous activation replacement requires one live point');
  for (const point of points) {
    // An unverified legacy point has no proven reporting start. Do not invent one.
    if (point.connected_at === null) continue;
    const connectedAt =
      point.connected_at instanceof Date
        ? point.connected_at.getTime()
        : Date.parse(point.connected_at);
    if (!Number.isFinite(connectedAt)) throw new Error('Invalid connected point timestamp');
    const newActivationAt = new Date(Math.max(now.getTime(), connectedAt)).toISOString();
    const configs = await trx('device_connection_configs')
      .where('station_id', point.point_code?.trim() || point.point_name)
      .whereNull('request_id')
      .whereNull('deleted_at')
      .orderBy('id', 'asc')
      .forUpdate()
      .select('id');
    const channels =
      configs.length === 0
        ? []
        : await trx('device_measurement_channels')
            .whereIn(
              'config_id',
              configs.map((config) => config.id),
            )
            .whereNull('deleted_at')
            .select('data_type', 'test_mode');
    const registered = channels.flatMap((channel) => {
      // Legacy null test_mode means normal. Only explicit false/0/null is eligible.
      if (![false, 0, '0', null, undefined].includes(channel.test_mode)) return [];
      const parameter = parseRegisteredAlertParameter(channel.data_type);
      return parameter ? [parameter] : [];
    });
    const existing = await loadStored(trx, Number(point.id));
    const carry =
      options.carryFromPointId === undefined ? [] : await loadStored(trx, options.carryFromPointId);
    // Existing and explicitly carried keys keep their proven baseline; this
    // connection floor applies only to newly activated keys.
    const plan = planAlertParameterActivations(existing, registered, newActivationAt, carry);
    if (plan.deactivateIds.length > 0) {
      await deactivateStored(
        trx,
        existing.filter((activation) => plan.deactivateIds.includes(activation.id)),
        now,
      );
    }
    // Four bindings per activation; stay below SQL Server's 2,100-parameter limit.
    for (let index = 0; index < plan.activate.length; index += 200) {
      await trx('alert_parameter_activations').insert(
        plan.activate.slice(index, index + 200).map((activation) => ({
          connected_point_id: Number(point.id),
          parameter_code: activation.parameterCode,
          unit: activation.unit,
          activated_at: new Date(activation.activatedAt),
        })),
      );
    }
    if (options.carryFromPointId !== undefined && options.carryFromPointId !== Number(point.id)) {
      await retireAlertParameterActivations(trx, [options.carryFromPointId], now);
    }
  }
}

export async function retireAlertParameterActivations(
  trx: Knex.Transaction,
  pointIds: number[],
  now = new Date(),
): Promise<void> {
  if (pointIds.length === 0) return;
  const rows = await trx<ActivationRow>('alert_parameter_activations')
    .whereIn('connected_point_id', pointIds)
    .whereNull('deactivated_at')
    .orderBy('id', 'asc')
    .forUpdate()
    .select('id', 'parameter_code', 'unit', 'activated_at');
  await deactivateStored(trx, rows.map(toStored), now);
}

async function loadStored(
  trx: Knex.Transaction,
  pointId: number,
): Promise<StoredAlertParameterActivation[]> {
  const rows = await trx<ActivationRow>('alert_parameter_activations')
    .where('connected_point_id', pointId)
    .whereNull('deactivated_at')
    .orderBy('id', 'asc')
    .forUpdate()
    .select('id', 'parameter_code', 'unit', 'activated_at');
  return rows.map(toStored);
}

function toStored(
  row: Pick<ActivationRow, 'id' | 'parameter_code' | 'unit' | 'activated_at'>,
): StoredAlertParameterActivation {
  return {
    id: Number(row.id),
    parameterCode: row.parameter_code,
    unit: row.unit,
    activatedAt: activationIso(row.activated_at),
  };
}

async function deactivateStored(
  trx: Knex.Transaction,
  activations: StoredAlertParameterActivation[],
  now: Date,
): Promise<void> {
  if (!Number.isFinite(now.getTime())) throw new Error('Invalid activation retirement time');
  // Legacy audit backfill may conservatively lie in the future. Preserve that
  // bound without guessing its old timezone, and keep each episode nonnegative.
  const groups = new Map<number, number[]>();
  for (const activation of activations) {
    const time = Math.max(now.getTime(), Date.parse(activation.activatedAt));
    if (!Number.isFinite(time)) throw new Error('Invalid stored activation timestamp');
    groups.set(time, [...(groups.get(time) ?? []), activation.id]);
  }
  for (const [time, ids] of groups) {
    for (let index = 0; index < ids.length; index += 500) {
      await trx('alert_parameter_activations')
        .whereIn('id', ids.slice(index, index + 500))
        .whereNull('deactivated_at')
        .update({ deactivated_at: new Date(time) });
    }
  }
}

function activationIso(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error('Invalid stored activation timestamp');
  return date.toISOString();
}
