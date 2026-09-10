import type { Knex } from 'knex';
import { db } from '../../config/database';
import { ConflictError, NotFoundError } from '../../shared/errors/AppError';
import type { MeasurementInstrumentsInput } from '../connection-requests/connection-requests.types';
import { pomsFactoriesRepository, toPomsParameterDisplayNames } from './poms-factories.repository';
import { applyStatusManagementPatch } from './poms-status-management.state';
import {
  defaultFactoryStatus,
  type StatusActor,
  type StatusManagementInput,
  type StatusSnapshot,
  type StatusSource,
  type StoredFactoryStatus,
} from './poms-status-management.types';

export const STATUS_TABLE = 'poms_factory_status_management';
export const STATUS_EVENTS_TABLE = 'poms_factory_status_events';
interface StateRow {
  state_json: string;
  revision: number;
  updated_at: Date | string;
  updated_by: number;
}
interface PointRow {
  id: number | string;
  point_code: string | null;
  point_name: string;
  system_type: 'CEMS' | 'WPMS';
  parameters_json: string;
  instruments_json: string | null;
}

function snapshot(row?: StateRow): StatusSnapshot {
  return row
    ? {
        state: JSON.parse(row.state_json) as StoredFactoryStatus,
        revision: Number(row.revision),
        updatedAt: new Date(row.updated_at).toISOString(),
        updatedBy: Number(row.updated_by),
      }
    : { state: defaultFactoryStatus(), revision: 0, updatedAt: null, updatedBy: null };
}

// All saves for a factory acquire the same parent lock, including its first INSERT.
export function statusFactoryLock(executor: Knex, eligibleFactoryId: number) {
  return executor(executor.raw('?? WITH (UPDLOCK, HOLDLOCK)', ['eligible_factories']))
    .where('id', eligibleFactoryId)
    .whereNull('deleted_at')
    .select('id')
    .first();
}

async function loadSource(
  executor: Knex,
  factory: { eligibleFactoryId: number; factoryId: string; factoryName: string },
  lock: boolean,
): Promise<StatusSource> {
  const table = lock
    ? executor.raw('?? WITH (UPDLOCK, HOLDLOCK)', ['cems_wpms_connected_measurement_points'])
    : 'cems_wpms_connected_measurement_points';
  const points = await executor<PointRow>(table)
    .where('eligible_factory_id', factory.eligibleFactoryId)
    .whereNull('deleted_at')
    .select('id', 'point_code', 'point_name', 'system_type', 'parameters_json', 'instruments_json')
    .orderBy('id');
  if (!points.length)
    throw new NotFoundError('POMS factory has no current connected measurement points');
  return {
    ...factory,
    measurementPoints: points.map((point) => {
      const parameters: unknown = JSON.parse(point.parameters_json);
      if (!Array.isArray(parameters) || parameters.some((p) => typeof p !== 'string' || !p.trim()))
        throw new ConflictError('Current connected parameters are invalid');
      const instruments = point.instruments_json
        ? (JSON.parse(point.instruments_json) as MeasurementInstrumentsInput)
        : null;
      return {
        connectedPointId: Number(point.id),
        pointCode: point.point_code,
        pointName: point.point_name,
        systemType: point.system_type,
        parameters: [...new Set(parameters as string[])].map((parameter) => ({
          parameter,
          displayName: toPomsParameterDisplayNames([parameter], instruments)[0] ?? parameter,
        })),
      };
    }),
  };
}

export const pomsStatusManagementRepository = {
  async read(
    factoryId: string,
    actor: StatusActor,
  ): Promise<{ source: StatusSource; snapshot: StatusSnapshot }> {
    const factory = await pomsFactoriesRepository.findFactoryDetail(factoryId, actor);
    if (!factory) throw new NotFoundError('POMS factory not found');
    return db.transaction(async (trx) => {
      if (!(await statusFactoryLock(trx, factory.eligibleFactoryId)))
        throw new NotFoundError('POMS factory not found');
      const source = await loadSource(trx, factory, true);
      const row = await trx<StateRow>(STATUS_TABLE)
        .where('eligible_factory_id', factory.eligibleFactoryId)
        .first();
      return { source, snapshot: snapshot(row) };
    });
  },
  async update(
    factoryId: string,
    actor: StatusActor,
    input: StatusManagementInput,
  ): Promise<{ source: StatusSource; snapshot: StatusSnapshot }> {
    const factory = await pomsFactoriesRepository.findFactoryDetail(factoryId, actor);
    if (!factory) throw new NotFoundError('POMS factory not found');
    return db.transaction(async (trx) => {
      if (!(await statusFactoryLock(trx, factory.eligibleFactoryId)))
        throw new NotFoundError('POMS factory not found');
      const source = await loadSource(trx, factory, true);
      const row = await trx<StateRow>(STATUS_TABLE)
        .where('eligible_factory_id', factory.eligibleFactoryId)
        .first();
      const current = snapshot(row);
      const state = applyStatusManagementPatch(source, current, input);
      // Identical saves are idempotent and do not manufacture audit events.
      if (JSON.stringify(state) === JSON.stringify(current.state))
        return { source, snapshot: current };
      const updatedAt = new Date().toISOString();
      const revision = current.revision + 1;
      const record = {
        state_json: JSON.stringify(state),
        revision,
        updated_at: updatedAt,
        updated_by: actor.actorUserId,
      };
      if (row) {
        const count = await trx(STATUS_TABLE)
          .where({ eligible_factory_id: factory.eligibleFactoryId, revision: current.revision })
          .update(record);
        if (count !== 1) throw new ConflictError('Status has changed; reload before saving');
      } else {
        await trx(STATUS_TABLE).insert({
          eligible_factory_id: factory.eligibleFactoryId,
          ...record,
        });
      }
      await trx(STATUS_EVENTS_TABLE).insert({
        eligible_factory_id: factory.eligibleFactoryId,
        revision,
        actor_user_id: actor.actorUserId,
        // Keep the existing audit constraint without requiring client-supplied text.
        reason: 'อัปเดตสถานะผ่าน status-management',
        before_json: JSON.stringify(current.state),
        after_json: record.state_json,
        changes_json: JSON.stringify(input),
        created_at: updatedAt,
      });
      return { source, snapshot: { state, revision, updatedAt, updatedBy: actor.actorUserId } };
    });
  },
};
