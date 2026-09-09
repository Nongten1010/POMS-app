import { isDeepStrictEqual } from 'node:util';
import { ConflictError } from '../../shared/errors/AppError';
import type { PomsMeasurementPointDTO } from './poms-factories.types';
import {
  buildApprovedMeasurementPointWritePatch,
  buildApprovedPomsMeasurementPointUpdates,
} from './poms-factories.repository';

// A repair may only complete the parameter write omitted by the old approval
// path. Never replay unrelated fields or overwrite a later live-point change.
export function planApprovedParameterRepair(
  before: PomsMeasurementPointDTO,
  proposed: PomsMeasurementPointDTO,
  live: Record<string, unknown>,
  approvedAt: Date | string,
): { stationId: string; before: string[]; after: string[]; patch: Record<string, unknown> } | null {
  if (
    Number(live.id) !== before.connectedPointId ||
    Number(live.eligible_factory_id) !== before.eligibleFactoryId
  ) {
    throw new ConflictError('Repair target does not match the approved point identity');
  }
  const change = buildApprovedPomsMeasurementPointUpdates([before], [proposed])[0];
  if (!change?.parameterChange) return null;
  const liveParameters = JSON.parse(String(live.parameters_json));
  if (isDeepStrictEqual(liveParameters, change.parameterChange.parameters)) return null;
  const liveTime =
    live.updated_at instanceof Date
      ? live.updated_at.getTime()
      : new Date(String(live.updated_at)).getTime();
  const approvalTime = new Date(approvedAt).getTime();
  if (!Number.isFinite(liveTime) || !Number.isFinite(approvalTime) || liveTime > approvalTime) {
    throw new ConflictError('Repair refused: the live point changed after approval');
  }
  if (!isDeepStrictEqual(liveParameters, before.parameters)) {
    throw new ConflictError('Repair refused: live parameters do not match the before snapshot');
  }
  const expected = buildApprovedMeasurementPointWritePatch(proposed);
  for (const [column, value] of Object.entries(expected)) {
    const parse = (item: unknown) =>
      column.endsWith('_json') && typeof item === 'string' ? JSON.parse(item) : item;
    if (!isDeepStrictEqual(parse(live[column] ?? null), parse(value))) {
      throw new ConflictError('Repair refused: live data does not match the approved proposal', {
        column,
      });
    }
  }
  return {
    stationId: change.parameterChange.stationId,
    before: before.parameters,
    after: change.parameterChange.parameters,
    patch: {
      parameters_json: change.patch.parameters_json,
      instruments_json: change.patch.instruments_json,
    },
  };
}
