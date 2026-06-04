import type { Knex } from 'knex';

const OPERATOR_EXTERNAL_ID = '3191000135709';
const FACTORY_FID = '10190003325500';
const REQUEST_NO = 'CEMS-DEMO-S0001';
const STATION_ID = 'S0001';

export async function seed(knex: Knex): Promise<void> {
  const hasConnectionRequestTable = await knex.schema.hasTable('cems_wpms_connection_requests');
  const hasMeasurementPointTable = await knex.schema.hasTable('cems_wpms_measurement_points');
  if (!hasConnectionRequestTable || !hasMeasurementPointTable) return;

  const user = await knex('users')
    .where({ identity_provider: 'mock', external_id: OPERATOR_EXTERNAL_ID })
    .first('id', 'email', 'phone', 'first_name', 'last_name');
  if (!user) return;

  const factory = await knex('factories').where({ fid: FACTORY_FID }).first('fid', 'code', 'name');
  if (!factory) return;

  const requestId = await upsertConnectionRequest(knex, {
    userId: Number(user.id),
    factoryId: factory.fid,
    factoryName: factory.name,
    factoryRegistrationNo: factory.code,
    contactName: `${user.first_name} ${user.last_name}`.trim(),
    contactPhone: user.phone ?? '0999454594',
    contactEmail: user.email,
  });

  await upsertMeasurementPoint(knex, requestId, Number(user.id));
  await insertStatusHistory(knex, requestId, Number(user.id));
}

async function upsertConnectionRequest(
  knex: Knex,
  payload: {
    userId: number;
    factoryId: string;
    factoryName: string;
    factoryRegistrationNo: string;
    contactName: string;
    contactPhone: string;
    contactEmail: string | null;
  },
): Promise<number> {
  const existing = await knex('cems_wpms_connection_requests')
    .where({ request_no: REQUEST_NO })
    .first('id');

  const requestPayload = {
    request_type: 'NEW_CONNECTION',
    factory_id: payload.factoryId,
    factory_name: payload.factoryName,
    factory_registration_no: payload.factoryRegistrationNo,
    system_type: 'CEMS',
    status: 'CONNECTED',
    contact_name: payload.contactName || 'operator_demo',
    contact_phone: payload.contactPhone,
    contact_email: payload.contactEmail,
    remarks: 'Demo station access for parameter values API',
    confirmed_at: knex.raw('SYSDATETIME()'),
    verified_at: knex.raw('SYSDATETIME()'),
    updated_by: payload.userId,
    updated_at: knex.raw('SYSDATETIME()'),
  };

  if (existing) {
    await knex('cems_wpms_connection_requests').where({ id: existing.id }).update(requestPayload);
    return Number(existing.id);
  }

  const [inserted] = await knex('cems_wpms_connection_requests')
    .insert({
      request_no: REQUEST_NO,
      ...requestPayload,
      created_by: payload.userId,
    })
    .returning('id');

  return Number(inserted.id);
}

async function upsertMeasurementPoint(
  knex: Knex,
  requestId: number,
  userId: number,
): Promise<void> {
  const existing = await knex('cems_wpms_measurement_points')
    .where({ request_id: requestId, point_code: STATION_ID })
    .first('id');

  const pointPayload = {
    point_name: STATION_ID,
    point_type: 'STACK',
    parameters_json: JSON.stringify(['co2', 'co', 'nox', 'o2', 'so2', 'temp']),
    description: 'Demo stack station for parameter ingestion demo',
    updated_by: userId,
    updated_at: knex.raw('SYSDATETIME()'),
  };

  if (existing) {
    await knex('cems_wpms_measurement_points').where({ id: existing.id }).update(pointPayload);
    return;
  }

  await knex('cems_wpms_measurement_points').insert({
    request_id: requestId,
    point_code: STATION_ID,
    ...pointPayload,
    created_by: userId,
  });
}

async function insertStatusHistory(knex: Knex, requestId: number, userId: number): Promise<void> {
  const existing = await knex('cems_wpms_request_status_history')
    .where({ request_id: requestId, status: 'CONNECTED' })
    .first('id');
  if (existing) return;

  await knex('cems_wpms_request_status_history').insert({
    request_id: requestId,
    status: 'CONNECTED',
    note: 'Demo station access for parameter values API',
    changed_by: userId,
  });
}
