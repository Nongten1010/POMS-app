import { db } from '../src/config/database';
import { ConflictError } from '../src/shared/errors/AppError';
import { reconcileApprovedStationParameters } from '../src/modules/device-connections/reconcile-approved-station-parameters';
import { planApprovedParameterRepair } from '../src/modules/poms-factories/poms-approved-parameter-repair';
import type { PomsMeasurementPointDTO } from '../src/modules/poms-factories/poms-factories.types';

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const value = (name: string) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
  const registration = value('--factory');
  const requestNo = value('--request-no');
  const apply = args.includes('--apply');
  const actorUserId = Number(value('--actor-id'));
  if (
    !registration ||
    !requestNo ||
    (apply && (!Number.isSafeInteger(actorUserId) || actorUserId < 1))
  ) {
    throw new Error(
      'Usage: tsx scripts/repair-approved-poms-parameters.ts --factory REGISTRATION --request-no REQUEST_NO [--apply --actor-id USER_ID]',
    );
  }
  const result = await db.transaction(async (trx) => {
    const eligibleIds = trx('eligible_factories')
      .whereNull('deleted_at')
      .where((query) =>
        query
          .where('factory_registration_no_new', registration)
          .orWhere('factory_registration_no_old', registration),
      )
      .select('id');
    const rows = await trx('poms_factory_edit_requests')
      .where('request_no', requestNo)
      .whereIn('eligible_factory_id', eligibleIds)
      .whereNull('deleted_at')
      .forUpdate()
      .select('*');
    if (
      rows.length !== 1 ||
      rows[0].status !== 'APPROVED' ||
      rows[0].form_type !== 'MEASUREMENT_POINTS'
    ) {
      throw new ConflictError('Expected one approved measurement-point request for this factory');
    }
    const request = rows[0];
    const later = await trx('poms_factory_edit_requests')
      .where('eligible_factory_id', request.eligible_factory_id)
      .where('form_type', 'MEASUREMENT_POINTS')
      .where('status', 'APPROVED')
      .where('approved_at', '>', request.approved_at)
      .whereNull('deleted_at')
      .first('id');
    if (later)
      throw new ConflictError('Repair refused: a newer approved measurement-point request exists');
    if (
      apply &&
      !(await trx('users').where('id', actorUserId).whereNull('deleted_at').first('id'))
    ) {
      throw new ConflictError('Repair actor does not exist');
    }
    const before = JSON.parse(request.current_measurement_points_json) as PomsMeasurementPointDTO[];
    const proposed = JSON.parse(
      request.proposed_measurement_points_json,
    ) as PomsMeasurementPointDTO[];
    const plans = [];
    for (const proposal of proposed) {
      const previous = before.find((point) => point.connectedPointId === proposal.connectedPointId);
      if (!previous)
        throw new ConflictError('Repair refused: approved snapshot changed point identities');
      const live = await trx('cems_wpms_connected_measurement_points')
        .where('id', proposal.connectedPointId)
        .where('eligible_factory_id', request.eligible_factory_id)
        .whereNull('deleted_at')
        .forUpdate()
        .first();
      if (!live) throw new ConflictError('Repair refused: approved point is no longer active');
      const plan = planApprovedParameterRepair(previous, proposal, live, request.approved_at);
      if (plan) plans.push({ connectedPointId: proposal.connectedPointId, ...plan });
    }
    if (apply) {
      for (const plan of plans) {
        await trx('cems_wpms_connected_measurement_points')
          .where('id', plan.connectedPointId)
          .where('eligible_factory_id', request.eligible_factory_id)
          .whereNull('deleted_at')
          .update({ ...plan.patch, updated_by: actorUserId, updated_at: trx.fn.now() });
        await reconcileApprovedStationParameters(trx, plan.stationId, plan.after, actorUserId);
      }
    }
    return {
      mode: apply ? 'applied' : 'dry-run',
      requestId: request.id,
      requestNo,
      registration,
      points: plans.map(({ patch: _patch, ...plan }) => plan),
      note: 'Removed channels are retired; new parameters require real device addresses. Request and device snapshots are preserved.',
    };
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

main()
  .catch((error: unknown) => {
    // Do not expose SQL, bindings, connection details or credentials on failures.
    process.stderr.write(
      `${error instanceof ConflictError ? error.message : 'Repair failed; inspect securely on the server'}\n`,
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.destroy();
  });
