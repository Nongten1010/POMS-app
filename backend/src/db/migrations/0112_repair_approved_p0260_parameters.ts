import type { Knex } from 'knex';
import { planApprovedParameterRepair } from '../../modules/poms-factories/poms-approved-parameter-repair';
import { buildApprovedPomsMeasurementPointUpdates } from '../../modules/poms-factories/poms-factories.repository';
import { reconcileApprovedStationParameters } from '../../modules/device-connections/reconcile-approved-station-parameters';
import type { PomsMeasurementPointDTO } from '../../modules/poms-factories/poms-factories.types';

const FACTORY = '10100000125241';
const REQUEST = 'point-00001/2569';
const STATION = 'P0260';
const BACKUP = 'poms_p0260_parameter_repair_backup_20260909';
const EXPECTED = ['BOD (mg/l)', 'Watt (kW/hr)', 'Flow rate (m3/hr)'];
export const config = { transaction: true };

export async function up(knex: Knex): Promise<void> {
  if (process.env.NODE_ENV !== 'production') return;
  const requests = await knex('poms_factory_edit_requests')
    .where('factory_id', FACTORY)
    .where('request_no', REQUEST)
    .whereNull('deleted_at')
    .forUpdate()
    .select('*');
  const request = requests[0];
  if (
    requests.length !== 1 ||
    request.status !== 'APPROVED' ||
    request.form_type !== 'MEASUREMENT_POINTS'
  ) {
    throw new Error('P0260 repair requires exactly one approved target request');
  }
  const later = await knex('poms_factory_edit_requests')
    .where('eligible_factory_id', request.eligible_factory_id)
    .where('form_type', 'MEASUREMENT_POINTS')
    .where('status', 'APPROVED')
    .whereNot('id', request.id)
    // Compare SQL timestamps directly; JS Date drops SQL Server precision.
    .where(
      'approved_at',
      '>',
      knex('poms_factory_edit_requests').select('approved_at').where('id', request.id),
    )
    .whereNull('deleted_at')
    .forUpdate()
    .first('id');
  if (later)
    throw new Error(
      `P0260 repair refused: newer approved request ${later.id} exists after target ${request.id}`,
    );
  const reviewerId = Number(request.reviewed_by);
  if (
    !Number.isSafeInteger(reviewerId) ||
    reviewerId < 1 ||
    !(await knex('users').where('id', reviewerId).whereNull('deleted_at').first('id'))
  ) {
    throw new Error('P0260 repair requires the recorded approval reviewer');
  }
  const before = JSON.parse(request.current_measurement_points_json) as PomsMeasurementPointDTO[];
  const proposed = JSON.parse(
    request.proposed_measurement_points_json,
  ) as PomsMeasurementPointDTO[];
  if (
    before.length !== 1 ||
    proposed.length !== 1 ||
    before[0].pointCode !== STATION ||
    proposed[0].pointCode !== STATION ||
    before[0].factoryId !== FACTORY ||
    proposed[0].factoryId !== FACTORY ||
    before[0].eligibleFactoryId !== Number(request.eligible_factory_id)
  ) {
    throw new Error('P0260 repair snapshot identity does not match the target');
  }
  const change = buildApprovedPomsMeasurementPointUpdates(before, proposed)[0];
  if (JSON.stringify(change?.parameterChange?.parameters) !== JSON.stringify(EXPECTED)) {
    throw new Error('P0260 repair approved parameters do not match the expected change');
  }
  const live = await knex('cems_wpms_connected_measurement_points')
    .where('id', before[0].connectedPointId)
    .where('eligible_factory_id', request.eligible_factory_id)
    .where('point_code', STATION)
    .whereNull('deleted_at')
    .forUpdate()
    .first('*');
  if (!live) throw new Error('P0260 repair active point was not found');
  const plan = planApprovedParameterRepair(before[0], proposed[0], live, request.approved_at);
  if (!plan) {
    console.log('[migration 0112] P0260 approved parameters are already present; no writes');
    return;
  }
  const configs = await knex('device_connection_configs')
    .where('station_id', STATION)
    .whereNull('request_id')
    .whereNull('deleted_at')
    .forUpdate()
    .select('*');
  const channels = configs.length
    ? await knex('device_measurement_channels')
        .whereIn(
          'config_id',
          configs.map((c) => c.id),
        )
        .whereNull('deleted_at')
        .forUpdate()
        .select('*')
    : [];
  console.log(
    `[migration 0112] validated ${REQUEST}: ${JSON.stringify(plan.before)} -> ${JSON.stringify(plan.after)}`,
  );
  if (await knex.schema.hasTable(BACKUP))
    throw new Error('P0260 repair backup already exists; inspect before retry');
  await knex.schema.createTable(BACKUP, (table) => {
    table.increments('id').primary();
    table.string('execution', 128).notNullable();
    table.integer('request_id').notNullable();
    table.integer('approval_reviewer_id').notNullable();
    table.text('snapshot_json').notNullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
  });
  await knex(BACKUP).insert({
    execution: 'migration:0112_repair_approved_p0260_parameters',
    request_id: request.id,
    approval_reviewer_id: reviewerId,
    snapshot_json: JSON.stringify({
      request,
      live,
      configs,
      channels,
      approvedParameters: plan.after,
    }),
  });
  // Complete the recorded approval. The backup identifies this as an automated
  // migration, while updated_by retains the original approval's reviewer.
  const affected = await knex('cems_wpms_connected_measurement_points')
    .where('id', before[0].connectedPointId)
    .where('eligible_factory_id', request.eligible_factory_id)
    .where('point_code', STATION)
    .whereNull('deleted_at')
    .update({ ...plan.patch, updated_by: reviewerId, updated_at: knex.fn.now() });
  if (affected !== 1) throw new Error('P0260 repair did not update exactly one point');
  await reconcileApprovedStationParameters(
    knex as Knex.Transaction,
    STATION,
    plan.after,
    reviewerId,
  );
  const verified = await knex('cems_wpms_connected_measurement_points')
    .where('id', before[0].connectedPointId)
    .whereNull('deleted_at')
    .first('parameters_json');
  if (
    JSON.stringify(JSON.parse(verified?.parameters_json ?? 'null')) !== JSON.stringify(EXPECTED)
  ) {
    throw new Error('P0260 repair verification failed');
  }
  console.log(
    '[migration 0112] repaired P0260 live parameters; preserved retained addresses; Flow awaits device mapping',
  );
}

export async function down(): Promise<void> {
  throw new Error(
    'P0260 approval repair is forward-only; use the backup for a separately reviewed recovery',
  );
}
