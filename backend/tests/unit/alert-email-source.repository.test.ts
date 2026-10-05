import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type {
  AlertEventDTO,
  AlertEventRow,
} from '../../src/modules/alert-events/alert-events.types';

jest.mock('../../src/config/database', () => {
  const knex = jest.requireActual<typeof import('knex').default>('knex');
  const client = knex({ client: 'mssql' });
  const queries: { sql: string; bindings: readonly unknown[] }[] = [];
  const results: unknown[] = [];
  return {
    db: (table: string) => {
      const query = client(table);
      Object.defineProperty(query, 'then', {
        value: function (
          resolve: (value: unknown) => unknown,
          reject: (error: unknown) => unknown,
        ) {
          queries.push(query.toSQL());
          return Promise.resolve(results.shift() ?? []).then(resolve, reject);
        },
      });
      return query;
    },
    __queries: queries,
    __results: results,
  };
});

jest.mock('../../src/modules/factory-profiles/factory-profile-mode', () => ({
  factoryProfileReadTable: jest.fn((table: string, alias?: string) => {
    const source =
      table === 'cems_wpms_connected_measurement_points'
        ? 'current_connected_measurement_points'
        : table;
    return alias ? `${source} as ${alias}` : source;
  }),
  isCanonicalFactoryProfilesEnabled: () => true,
}));

const database = jest.requireMock('../../src/config/database') as {
  __queries: { sql: string; bindings: readonly unknown[] }[];
  __results: unknown[];
};

import { alertEmailSourceRepository } from '../../src/modules/alert-emails/alert-email-source.repository';

function repository() {
  return alertEmailSourceRepository;
}

function pointRow(overrides: Record<string, unknown> = {}) {
  return {
    id: '55',
    system_type: 'CEMS',
    point_code: 'S0001',
    point_name: 'ปล่อง 1',
    point_type: 'STACK',
    factory_id: 'factory-001',
    factory_name: 'บริษัทตัวอย่าง จำกัด',
    factory_registration_no: '3-001',
    connected_at: new Date('2026-10-01T00:00:00.000Z'),
    live_officer_emails_json: '[" Officer@example.test ","officer@example.test","invalid-email"]',
    live_factory_emails_json: '["factory@example.test"]',
    source_officer_emails_json: '["old-officer@example.test"]',
    source_factory_emails_json: '["old-factory@example.test"]',
    ...overrides,
  };
}

function eventRow(overrides: Partial<AlertEventRow> = {}): AlertEventRow {
  return {
    id: 1001,
    idempotency_key: 'v2:key',
    alert_type: 'STANDARD_EXCEEDED',
    system_type: 'CEMS',
    display_system_type: 'CEMS',
    factory_id: 'factory-001',
    factory_name: 'บริษัทตัวอย่าง จำกัด',
    factory_registration_no: '3-001',
    connected_measurement_point_id: 55,
    station_id: 'S0001',
    point_code: 'S0001',
    point_name: 'ปล่อง 1',
    point_type: 'STACK',
    parameter_code: 'co',
    parameter_name: 'CO',
    parameter_label: 'CO (ppm)',
    unit: 'ppm',
    event_date: '2026-10-04',
    started_at: '2026-10-04T11:00:00+07:00',
    ended_at: '2026-10-04T11:59:59+07:00',
    measured_value: 250,
    threshold_value: 200,
    threshold_type: 'STANDARD',
    completeness_percent: null,
    consecutive_days: null,
    abnormal_type: null,
    abnormal_streak_count: null,
    first_abnormal_at: null,
    confirmed_abnormal_at: null,
    source_table: null,
    source_interval: 'HOURLY',
    source_payload_json: JSON.stringify({
      systemType: 'CEMS',
      stationId: 'S0001',
      parameterCode: 'co',
      unit: 'ppm',
      eventDate: '2026-10-04',
      time: '11:00',
      measuredValue: 250,
      thresholdValue: 200,
      thresholdType: 'STANDARD',
    }),
    evidence_json: null,
    notification_status: 'AUTO',
    detected_at: '2026-10-04T05:01:00.000Z',
    created_at: '2026-10-04T05:01:00.000Z',
    updated_at: '2026-10-04T05:01:00.000Z',
    created_by: null,
    updated_by: null,
    deleted_at: null,
    ...overrides,
  };
}

function event(): AlertEventDTO {
  return {
    id: 1001,
    systemType: 'CEMS',
    stationId: 'S0001',
    factoryId: 'factory-001',
  } as AlertEventDTO;
}

describe('alert email source repository', () => {
  beforeEach(() => {
    database.__queries.length = 0;
    database.__results.length = 0;
  });

  it('reads only active connected points with canonical profiles and live email metadata', async () => {
    database.__results.push([pointRow()]);

    const points = await repository().listPoints();

    expect(points).toEqual([
      {
        id: 55,
        systemType: 'CEMS',
        stationId: 'S0001',
        pointCode: 'S0001',
        pointName: 'ปล่อง 1',
        pointType: 'STACK',
        factoryId: 'factory-001',
        factoryName: 'บริษัทตัวอย่าง จำกัด',
        factoryRegistrationNo: '3-001',
        connectedAt: '2026-10-01T00:00:00.000Z',
        officerEmails: ['officer@example.test'],
        factoryEmails: ['factory@example.test'],
      },
    ]);
    const compiled = database.__queries[0];
    expect(compiled.sql).toContain('[current_connected_measurement_points] as [cp]');
    expect(compiled.sql).toContain(
      'inner join [cems_wpms_connected_measurement_points] as [cp_live]',
    );
    expect(compiled.sql).toContain('[cp].[deleted_at] is null');
    expect(compiled.sql).toContain('[cp_live].[deleted_at] is null');
    expect(compiled.sql).toContain('[source_request].[deleted_at] is null');
    expect(compiled.sql).toContain('[cp].[point_code] is not null');
    expect(compiled.sql).not.toContain('[factories]');
  });

  it('inherits source request emails only when the live value is NULL', async () => {
    database.__results.push([
      pointRow({ live_officer_emails_json: null, live_factory_emails_json: null }),
    ]);
    const [point] = await repository().listPoints();
    expect(point.officerEmails).toEqual(['old-officer@example.test']);
    expect(point.factoryEmails).toEqual(['old-factory@example.test']);
  });

  it.each(['[]', '{"email":"unexpected@example.test"}', 'broken-json', '[1,true,null]'])(
    'does not resurrect old recipients from an explicitly cleared or malformed live list: %s',
    async (value) => {
      database.__results.push([
        pointRow({ live_officer_emails_json: value, live_factory_emails_json: value }),
      ]);
      const [point] = await repository().listPoints();
      expect(point.officerEmails).toEqual([]);
      expect(point.factoryEmails).toEqual([]);
    },
  );

  it('keeps recipients empty when the source request is unavailable', async () => {
    database.__results.push([
      pointRow({
        live_officer_emails_json: null,
        live_factory_emails_json: null,
        source_officer_emails_json: null,
        source_factory_emails_json: null,
        connected_at: null,
        point_type: 'UNKNOWN',
      }),
    ]);
    const [point] = await repository().listPoints();
    expect(point.officerEmails).toEqual([]);
    expect(point.factoryEmails).toEqual([]);
    expect(point.connectedAt).toBeNull();
    expect(point.pointType).toBe('OTHER');
  });

  it('maps live wastewater points without replacing their current profile or connection date', async () => {
    database.__results.push([
      pointRow({
        system_type: 'WPMS',
        point_type: 'WASTEWATER',
        point_code: 'WEMS-0001/2569',
        connected_at: '2026-10-01T00:00:00+07:00',
      }),
    ]);
    const [point] = await repository().listPoints();
    expect(point).toMatchObject({
      systemType: 'WPMS',
      pointType: 'WASTEWATER',
      stationId: 'WEMS-0001/2569',
      connectedAt: '2026-10-01T00:00:00+07:00',
    });
  });

  it('selects completed hourly events from the original Bangkok payload without guessing legacy DATETIME2 offsets', async () => {
    database.__results.push([eventRow()]);
    const startAt = '2026-10-04T04:00:00.000Z';
    const endAt = '2026-10-04T05:00:00.000Z';

    const events = await repository().listEvents({ cadence: 'HOURLY', startAt, endAt });

    expect(events[0]).toMatchObject({ id: 1001, parameterLabel: 'CO (ppm)', measuredValue: 250 });
    expect(events[0].startedAt).toBe('2026-10-04T04:00:00.000Z');
    expect(events[0].endedAt).toBe('2026-10-04T04:59:59.000Z');
    const compiled = database.__queries[0];
    expect(compiled.sql).toContain('[event_date] >= ?');
    expect(compiled.sql).toContain('[event_date] <= ?');
    expect(compiled.sql).toContain('[deleted_at] is null');
    expect(compiled.bindings).toEqual(
      expect.arrayContaining(['STANDARD_EXCEEDED', 'EIA_EXCEEDED', '2026-10-04']),
    );
    expect(compiled.sql).not.toContain(startAt);
    expect(compiled.sql).not.toContain(endAt);
  });

  it('keeps only completed events in the requested hourly window when the broad date query returns other hours', async () => {
    const nextHour = eventRow({
      id: 1002,
      source_payload_json: JSON.stringify({
        systemType: 'CEMS',
        stationId: 'S0001',
        parameterCode: 'co',
        unit: 'ppm',
        eventDate: '2026-10-04',
        time: '12:00',
        measuredValue: 250,
        thresholdValue: 200,
        thresholdType: 'STANDARD',
      }),
    });
    database.__results.push([eventRow(), nextHour]);
    const events = await repository().listEvents({
      cadence: 'HOURLY',
      startAt: '2026-10-04T04:00:00.000Z',
      endAt: '2026-10-04T05:00:00.000Z',
    });
    expect(events.map((item) => item.id)).toEqual([1001]);
  });

  it.each([null, 'malformed-json', '{}', '{"eventDate":"2026-02-30","time":"11:00"}'])(
    'skips hourly events when the original validated source payload is unavailable: %s',
    async (value) => {
      database.__results.push([eventRow({ source_payload_json: value })]);
      await expect(
        repository().listEvents({
          cadence: 'HOURLY',
          startAt: '2026-10-04T04:00:00.000Z',
          endAt: '2026-10-04T05:00:00.000Z',
        }),
      ).resolves.toEqual([]);
    },
  );

  it('does not send an unfinished hourly event even when its start is inside the requested period', async () => {
    database.__results.push([eventRow()]);
    await expect(
      repository().listEvents({
        cadence: 'HOURLY',
        startAt: '2026-10-04T04:00:00.000Z',
        endAt: '2026-10-04T04:30:00.000Z',
      }),
    ).resolves.toEqual([]);
  });

  it.each([
    { systemType: 'WPMS' },
    { stationId: 'S0002' },
    { parameterCode: 'cod' },
    { unit: '%' },
    { thresholdType: 'EIA' },
  ])(
    'skips an hourly source payload that no longer matches the event identity: %j',
    async (changed) => {
      const row = eventRow();
      row.source_payload_json = JSON.stringify({
        ...JSON.parse(row.source_payload_json as string),
        ...changed,
      });
      database.__results.push([row]);
      await expect(
        repository().listEvents({
          cadence: 'HOURLY',
          startAt: '2026-10-04T04:00:00.000Z',
          endAt: '2026-10-04T05:00:00.000Z',
        }),
      ).resolves.toEqual([]);
    },
  );

  it('does not send an event that precedes the requested hourly window', async () => {
    database.__results.push([eventRow()]);
    await expect(
      repository().listEvents({
        cadence: 'HOURLY',
        startAt: '2026-10-04T05:00:00.000Z',
        endAt: '2026-10-04T06:00:00.000Z',
      }),
    ).resolves.toEqual([]);
  });

  it('binds both covered Bangkok dates for a window crossing local midnight', async () => {
    database.__results.push([]);
    await repository().listEvents({
      cadence: 'HOURLY',
      startAt: '2026-10-04T16:00:00.000Z',
      endAt: '2026-10-04T18:00:00.000Z',
    });
    expect(database.__queries[0].bindings).toEqual(
      expect.arrayContaining(['2026-10-04', '2026-10-05']),
    );
  });

  it.each([
    { startAt: 'invalid', endAt: '2026-10-04T05:00:00.000Z' },
    { startAt: '2026-10-04T05:00:00.000Z', endAt: '2026-10-04T04:00:00.000Z' },
  ])('rejects invalid source windows before querying the database: %j', async (period) => {
    await expect(repository().listEvents({ cadence: 'HOURLY', ...period })).rejects.toThrow(
      'Invalid alert email source period',
    );
    expect(database.__queries).toHaveLength(0);
  });

  it('selects daily event date in Bangkok rather than using the UTC date of the window', async () => {
    database.__results.push([eventRow({ alert_type: 'DAILY_COMPLETENESS_LOW' })]);

    await repository().listEvents({
      cadence: 'DAILY',
      startAt: '2026-10-03T17:00:00.000Z',
      endAt: '2026-10-04T17:00:00.000Z',
    });

    const compiled = database.__queries[0];
    expect(compiled.sql).toContain('[event_date] = ?');
    expect(compiled.bindings).toEqual(
      expect.arrayContaining([
        'DAILY_COMPLETENESS_LOW',
        'CONSECUTIVE_NO_REPORT',
        'ABNORMAL_VALUE',
        '2026-10-04',
      ]),
    );
    expect(compiled.bindings).not.toContain('STANDARD_EXCEEDED');
    expect(compiled.sql).not.toContain('[started_at] >= ?');
  });

  it('binds an event to its current station, system and factory without accepting arbitrary recipients', async () => {
    database.__results.push(pointRow());
    const point = await repository().findPointForEvent(event());
    expect(point?.factoryId).toBe('factory-001');
    const compiled = database.__queries[0];
    expect(compiled.sql).toContain('[cp].[point_code] = ?');
    expect(compiled.sql).toContain('[cp].[system_type] = ?');
    expect(compiled.sql).toContain('[cp].[factory_id] = ?');
    expect(compiled.bindings).toEqual(expect.arrayContaining(['S0001', 'CEMS', 'factory-001']));
    expect(compiled.sql).not.toContain('factory-001');
  });

  it('fails closed for a factory mismatch even if the data source returns the wrong point', async () => {
    database.__results.push(pointRow({ factory_id: 'another-factory' }));
    await expect(repository().findPointForEvent(event())).resolves.toBeNull();
  });

  it.each([{ point_code: 'S0002' }, { system_type: 'WPMS' }])(
    'fails closed for a current point with another station or system: %j',
    async (changed) => {
      database.__results.push(pointRow(changed));
      await expect(repository().findPointForEvent(event())).resolves.toBeNull();
    },
  );

  it('fails closed when an event has no trusted factory snapshot', async () => {
    await expect(
      repository().findPointForEvent({ ...event(), factoryId: null }),
    ).resolves.toBeNull();
    expect(database.__queries).toHaveLength(0);
  });

  it('fails closed when the event has no station snapshot', async () => {
    await expect(repository().findPointForEvent({ ...event(), stationId: '' })).resolves.toBeNull();
    expect(database.__queries).toHaveLength(0);
  });

  it('returns no recipients for a point no longer connected', async () => {
    database.__results.push(null);
    await expect(repository().findPointForEvent(event())).resolves.toBeNull();
  });
});
