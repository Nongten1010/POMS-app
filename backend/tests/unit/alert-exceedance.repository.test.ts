import { afterEach, describe, expect, it, jest } from '@jest/globals';
import knex, { type Knex } from 'knex';
import { createKnexSqliteFixture, type KnexSqliteFixture } from '../helpers/knex-sqlite-fixture';
import {
  buildExceedanceSnapshot,
  type ExceedancePointRow,
} from '../../src/modules/alert-exceedances/exceedance-metadata';
import {
  buildExceedanceSourceQuery,
  createExceedanceRepository,
} from '../../src/modules/alert-exceedances/exceedance-repository';
import { evaluateExceedanceHour } from '../../src/modules/alert-exceedances/exceedance-detector';
import { buildLegacyAlertEventIdempotencyKey } from '../../src/modules/alert-events/alert-event-identity';
import { toAlertEventInsertPayload } from '../../src/modules/alert-events/alert-event-persistence';
import type { ActiveExceedancePolicy } from '../../src/modules/alert-exceedances/exceedance-policy';

const hour = new Date('2026-11-03T10:00:00+07:00');
const now = new Date('2026-11-03T11:15:00+07:00');
const policy: ActiveExceedancePolicy = {
  mode: 'active',
  stations: ['S0001'],
  cutover: new Date('2026-11-01T00:00:00Z'),
  hourLabel: 'START',
  delayMinutes: 10,
  batchSize: 50,
  budgetMs: 300000,
  timeoutMs: 5000,
  lateHours: 24,
  recheckHours: 3,
};
const row: ExceedancePointRow = {
  id: 55,
  point_code: 'S0001',
  point_name: 'จุดทดสอบ',
  system_type: 'CEMS',
  point_type: 'STACK',
  connected_at: '2026-10-01T00:00:00.000Z',
  updated_at: '2026-11-01T00:00:00.000Z',
  instruments_json: JSON.stringify({
    parameters: [
      {
        parameter: 'CO (ppm)',
        standardCriteria: { standardValue: 120 },
        eiaCriteria: { standardValue: 200 },
      },
    ],
  }),
  factory_id: 'factory-test',
  factory_name: 'โรงงานทดสอบ',
  factory_registration_no: 'test-registration',
};
const channel = {
  station_id: 'S0001',
  data_type: 'CO (ppm)',
  config_updated_at: '2026-11-01T00:00:00.000Z',
};
const activation = {
  connected_point_id: 55,
  parameter_code: 'co',
  unit: 'ppm',
  activated_at: '2026-10-01T00:00:00.000Z',
};
const point = buildExceedanceSnapshot(row, [channel], [activation]);
const evaluation = evaluateExceedanceHour(point, hour, [
  { co_value: 125, co_status: 1, co_units: 'ppm' },
]);
const lease = { owner: 'test-owner', fence: 3, scanAfter: 0 };
let database: Knex;
let fixture: KnexSqliteFixture | undefined;
function executeFixture(sql: string, bindings: unknown[] = []): void {
  if (!fixture) throw new Error('SQL fixture not initialized');
  fixture.execute(sql, bindings);
}
async function setup(mode: 'shadow' | 'active' = 'active', events: Record<string, unknown>[] = []) {
  database = knex({ client: 'mssql' });
  fixture = await createKnexSqliteFixture(
    database,
    {
      cems_wpms_connected_measurement_points: [{ ...row, deleted_at: null, source_request_id: 1 }],
      cems_wpms_connection_requests: [{ id: 1, status: 'CONNECTED', deleted_at: null }],
      device_connection_configs: [
        {
          id: 7,
          station_id: 'S0001',
          request_id: null,
          deleted_at: null,
          updated_at: channel.config_updated_at,
        },
      ],
      device_measurement_channels: [
        { id: 8, config_id: 7, data_type: channel.data_type, deleted_at: null },
      ],
      alert_parameter_activations: [{ id: 9, ...activation, deactivated_at: null }],
      alert_exceedance_lease: [
        {
          lease_key: 'hourly-exceedance',
          owner: lease.owner,
          fence: lease.fence,
          expires_at: '2099-01-01T00:00:00.000Z',
          scan_after_id: 0,
        },
      ],
      alert_exceedance_points: [
        {
          mode,
          system_type: 'CEMS',
          station_id: 'S0001',
          fingerprint: point.fingerprint,
          valid_from: '2026-11-01T00:00:00.000Z',
          next_hour: hour.toISOString(),
        },
      ],
      alert_exceedance_hours: [],
      alert_events: events,
    },
    {
      alert_exceedance_hours: [
        'mode',
        'system_type',
        'station_id',
        'hour_at',
        'fingerprint',
        'status',
        'attempts',
        'next_retry_at',
        'checked_at',
        'summary_json',
      ],
      alert_events: [
        'id',
        ...Object.keys(toAlertEventInsertPayload(evaluation.events[0])),
        'source_table',
        'evidence_json',
        'detected_at',
        'deleted_at',
      ],
    },
  );
  fixture.execute('CREATE UNIQUE INDEX uq_test_event ON alert_events(idempotency_key)');
  return createExceedanceRepository(database, database, 'ingest', { ...policy, mode });
}
afterEach(async () => {
  fixture?.close();
  fixture = undefined;
  await database?.destroy();
  jest.restoreAllMocks();
});

describe('exceedance persistence using production queries on a SQL fixture', () => {
  it('commits with SQL Server table hints before JOIN predicates, preserving event and progress', async () => {
    const repository = await setup();
    const fixtureRunner = jest.mocked(database.client.runner).getMockImplementation();
    if (!fixtureRunner) throw new Error('SQL fixture runner missing');
    const lockedQueries: string[] = [];
    jest.mocked(database.client.runner).mockImplementation((builder: unknown) => {
      const runner = fixtureRunner.call(database.client, builder) as { run(): Promise<unknown> };
      return {
        ...runner,
        run: async () => {
          const sql = (builder as Knex.QueryBuilder).toSQL().sql;
          if (/\bjoin\b/i.test(sql) && /\bwith\s*\(UPDLOCK\)/i.test(sql)) {
            lockedQueries.push(sql);
            // SQL Server rejects a table hint appended after the JOIN's ON predicate.
            if (/\bon\b[^]*\bwith\s*\(UPDLOCK\)/i.test(sql)) {
              throw Object.assign(new Error('SQL Server 319: misplaced table hint'), {
                number: 319,
              });
            }
          }
          return runner.run();
        },
      } as never;
    });
    await expect(repository.commit(lease, point, hour, evaluation, now)).resolves.toMatchObject({
      created: 1,
      issues: [],
    });
    expect(lockedQueries).toHaveLength(1);
    expect(lockedQueries[0]).toMatch(/\[dc\]\s+with\s*\(UPDLOCK\)\s+inner join/i);
    expect(lockedQueries[0]).toMatch(/\[ch\]\s+with\s*\(UPDLOCK\)\s+on/i);
    expect(await database('alert_events').select('id')).toHaveLength(1);
    expect((await database('alert_exceedance_hours').first('status')).status).toBe('COMPLETE');
  });

  it('propagates a driver error that references itself without overflowing or retrying', async () => {
    const repository = await setup();
    const error = Object.assign(new Error('SQL Server syntax error'), { number: 319 });
    Object.assign(error, { originalError: error });
    const transaction = jest.mocked(
      (database as Knex & { context: { transaction: typeof database.transaction } }).context
        .transaction,
    );
    transaction.mockRejectedValue(error);
    await expect(repository.commit(lease, point, hour, evaluation, now)).rejects.toBe(error);
    expect(transaction).toHaveBeenCalledTimes(1);
  });

  it('retries one deadlock when wrapped beside a circular driver error', async () => {
    const repository = await setup();
    const transaction = jest.mocked(
      (database as Knex & { context: { transaction: typeof database.transaction } }).context
        .transaction,
    );
    const error = new Error('wrapped deadlock');
    Object.assign(error, { originalError: error, info: { number: 1205 } });
    transaction.mockRejectedValueOnce(error);
    await expect(repository.commit(lease, point, hour, evaluation, now)).resolves.toMatchObject({
      created: 1,
    });
    expect(transaction).toHaveBeenCalledTimes(2);
  });

  it('projects only enabled parameter columns from the source table', async () => {
    database = knex({ client: 'mssql' });
    const statements: string[] = [];
    const responses = [
      [
        ...[
          'cdate',
          'ctime',
          'co_value',
          'co_units',
          'co_status',
          'temp_value',
          'temp_units',
          'temp_status',
        ].map((name) => ({ name })),
      ],
      [{ cdate: '2026-11-03', ctime: '10:00', co_value: '125', co_units: 'ppm', co_status: '1' }],
    ];
    jest.spyOn(database.client, 'runner').mockImplementation(
      (builder: unknown) =>
        ({
          run: async () => {
            statements.push((builder as Knex.QueryBuilder).toSQL().sql);
            return responses.shift();
          },
        }) as never,
    );
    const repository = createExceedanceRepository(database, database, 'ingest', policy);
    const target = {
      ...point,
      parameters: [
        ...point.parameters,
        {
          label: 'Temp (C)',
          activatedAt: activation.activated_at,
          standard: null,
          eia: null,
          standardEnabled: false,
          eiaEnabled: false,
        },
      ],
    };
    expect(await repository.readRows(target, hour)).toHaveLength(1);
    expect(statements[1]).toContain('[co_value]');
    expect(statements[1]).not.toContain('temp_');
  });
  it('loads only connected, non-canceled point metadata and excludes device credentials', async () => {
    const repository = await setup();
    expect((await repository.listPoints(0)).points[0]).toEqual(point);
    executeFixture("UPDATE cems_wpms_connection_requests SET status='CANCELED'");
    expect((await repository.listPoints(0)).points).toEqual([]);
  });
  it('writes a detector event and durable progress together; replay returns the same event', async () => {
    const repository = await setup();
    expect(await repository.commit(lease, point, hour, evaluation, now)).toMatchObject({
      created: 1,
      duplicate: 0,
      issues: [],
    });
    expect(await repository.commit(lease, point, hour, evaluation, now)).toMatchObject({
      created: 0,
      duplicate: 1,
      issues: [],
    });
    const events = await database('alert_events').select('*');
    expect(events).toHaveLength(1);
    expect(JSON.parse(events[0].source_payload_json)).toMatchObject({
      time: '10:00',
      eventDate: '2026-11-03',
    });
    expect(events[0].started_at).toBe(hour.toISOString());
    expect(events[0].detected_at).toBe(now.toISOString());
    expect(JSON.parse(events[0].evidence_json)).toMatchObject({ producer: 'POMS_HOURLY_DETECTOR' });
    expect(await database('alert_exceedance_points').first('next_hour')).toEqual({
      next_hour: new Date(hour.getTime() + 3600000).toISOString(),
    });
  });
  it('recognizes an event previously created by the external API, including legacy keys', async () => {
    const event = evaluation.events[0];
    const repository = await setup('active', [
      {
        id: 21,
        ...toAlertEventInsertPayload(event),
        idempotency_key: buildLegacyAlertEventIdempotencyKey(event),
        deleted_at: null,
      },
    ]);
    expect(await repository.commit(lease, point, hour, evaluation, now)).toMatchObject({
      created: 0,
      duplicate: 1,
      issues: [],
    });
    expect(await database('alert_events').select('id')).toEqual([{ id: 21 }]);
  });
  it('persists both criteria for 100 real registered parameters without losing events or progress', async () => {
    const repository = await setup();
    const instruments = Array.from({ length: 100 }, (_, index) => ({
      parameter: `P${index} (ppm)`,
      standardCriteria: { standardValue: 120 },
      eiaCriteria: { standardValue: 100 },
    }));
    executeFixture('UPDATE cems_wpms_connected_measurement_points SET instruments_json=?', [
      JSON.stringify({ parameters: instruments }),
    ]);
    executeFixture('DELETE FROM device_measurement_channels');
    executeFixture('DELETE FROM alert_parameter_activations');
    for (let index = 0; index < instruments.length; index += 1) {
      await database('device_measurement_channels').insert({
        id: index + 1,
        config_id: 7,
        data_type: instruments[index].parameter,
        deleted_at: null,
      });
      await database('alert_parameter_activations').insert({
        id: index + 1,
        connected_point_id: 55,
        parameter_code: `p${index}`,
        unit: 'ppm',
        activated_at: activation.activated_at,
        deactivated_at: null,
      });
    }
    const registered = (await repository.listPoints(0)).points[0];
    await repository.state(lease, registered, new Date('2026-11-03T09:00:00+07:00'));
    const reading = Object.fromEntries(
      instruments.flatMap((_, index) => [
        [`p${index}_value`, 125],
        [`p${index}_units`, 'ppm'],
        [`p${index}_status`, 1],
      ]),
    );
    const result = await repository.commit(
      lease,
      registered,
      hour,
      evaluateExceedanceHour(registered, hour, [reading]),
      now,
    );
    expect(result.created).toBe(200);
    expect(await database('alert_events').select('id')).toHaveLength(200);
  });
  it('records producer discrepancies without overwriting or recreating the existing event', async () => {
    const repository = await setup('active', [
      {
        id: 21,
        ...toAlertEventInsertPayload(evaluation.events[0]),
        measured_value: 130,
        deleted_at: null,
      },
    ]);
    expect((await repository.commit(lease, point, hour, evaluation, now)).issues).toContain(
      'PRODUCER_DISCREPANCY',
    );
    expect((await database('alert_events').first('measured_value')).measured_value).toBe(130);
  });
  it('persists bounded shadow samples without creating events or advancing active state', async () => {
    const repository = await setup('shadow');
    expect(await repository.commit(lease, point, hour, evaluation, now)).toMatchObject({
      created: 0,
      duplicate: 0,
    });
    expect(await database('alert_events').select('*')).toHaveLength(0);
    const job = await database('alert_exceedance_hours').first('*');
    expect(JSON.parse(job.summary_json)).toMatchObject({
      candidates: 1,
      samples: [{ parameter: 'CO (ppm)' }],
    });
    expect(job.mode).toBe('shadow');
    expect(
      await database('alert_exceedance_points').where('mode', 'active').first(),
    ).toBeUndefined();
  });
  it('rolls back event and hourly receipt when checkpoint persistence fails', async () => {
    const repository = await setup();
    executeFixture(
      "CREATE TRIGGER reject_checkpoint BEFORE UPDATE ON alert_exceedance_points BEGIN SELECT RAISE(ABORT, 'checkpoint refused'); END",
    );
    await expect(repository.commit(lease, point, hour, evaluation, now)).rejects.toThrow(
      'checkpoint refused',
    );
    expect(await database('alert_events').select('*')).toHaveLength(0);
    expect(await database('alert_exceedance_hours').select('*')).toHaveLength(0);
  });
  it('refuses a stale owner before touching event persistence', async () => {
    const repository = await setup();
    executeFixture("UPDATE alert_exceedance_lease SET fence=4, owner='new-owner'");
    await expect(repository.commit(lease, point, hour, evaluation, now)).rejects.toThrow(
      'LEASE_LOST',
    );
    expect(await database('alert_events').select('*')).toHaveLength(0);
  });
  it('detects configuration changes between source read and commit', async () => {
    const repository = await setup();
    executeFixture("UPDATE device_connection_configs SET updated_at='2026-11-03T03:10:00.000Z'");
    await expect(repository.commit(lease, point, hour, evaluation, now)).rejects.toThrow(
      'CONFIG_CHANGED',
    );
    expect(await database('alert_events').select('*')).toHaveLength(0);
  });
  it('keeps missing source hours durable and retryable rather than treating them as no exceedance', async () => {
    const repository = await setup();
    await repository.commit(lease, point, hour, { events: [], issues: ['WAITING_DATA'] }, now);
    const job = await database('alert_exceedance_hours').first('*');
    expect(job.status).toBe('PENDING');
    expect(job.next_retry_at).not.toBeNull();
    expect(await repository.retryHour(point, new Date(now.getTime() + 600000))).toEqual(hour);
  });
  it('detects corrected source data without overwriting or sending a replacement event', async () => {
    const repository = await setup();
    await repository.commit(lease, point, hour, evaluation, now);
    const corrected = evaluateExceedanceHour(point, hour, [
      { co_value: 250, co_status: 1, co_units: 'ppm' },
    ]);
    const result = await repository.commit(lease, point, hour, corrected, now);
    expect(result).toMatchObject({ created: 0, issues: ['SOURCE_REVISED'] });
    const events = await database('alert_events').select('measured_value');
    expect(events.map((event) => Number(event.measured_value))).toEqual([125]);
    const job = await database('alert_exceedance_hours').first('*');
    expect(job.status).toBe('REVIEW_REQUIRED');
    expect(job.next_retry_at).toBeNull();
    expect(JSON.parse(job.summary_json).eventIds).toHaveLength(1);
  });
  it('limits unresolved history per point while preserving jobs for manual reconciliation', async () => {
    const repository = await setup();
    for (let index = 0; index < 48; index += 1) {
      await database('alert_exceedance_hours').insert({
        mode: 'active',
        system_type: 'CEMS',
        station_id: 'S0001',
        hour_at: new Date(hour.getTime() - index * 3600000),
        status: 'REVIEW_REQUIRED',
      });
    }
    expect(await repository.state(lease, point, now)).toMatchObject({ backlogFull: true });
    expect(await database('alert_exceedance_hours').select('hour_at')).toHaveLength(48);
  });
  it('starts a new fingerprint at observation time, not at an unproven historical cutover', async () => {
    const repository = await setup();
    executeFixture("UPDATE alert_exceedance_points SET fingerprint='old'");
    const state = await repository.state(lease, point, now);
    expect(state.validFrom).toEqual(new Date('2026-11-03T12:00:00+07:00'));
    expect(state.nextHour).toEqual(state.validFrom);
  });
  it('compiles a bounded hour query with bound dates and quoted source identifiers', async () => {
    database = knex({ client: 'mssql' });
    const query = buildExceedanceSourceQuery(database, 'ingest', 'WEMS-0003/2571', hour, 'START', [
      'cdate',
      'ctime',
      'cod_value',
      'cod_units',
      'cod_status',
    ]).toSQL();
    expect(query.sql).toContain('[ingest].[WEMS-0003/2571_data_60m]');
    expect(query.sql).not.toContain('*');
    expect(query.sql).not.toMatch(/CAST|FORMAT|NOLOCK/i);
    expect(query.bindings).toEqual([101, '2026-11-03', '10:00', '10:01']);
  });
});
