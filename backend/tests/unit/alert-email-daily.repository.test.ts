import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  buildDailyAlertCandidates,
  type DailyAlertCandidate,
} from '../../src/modules/alert-emails/alert-email-daily-detector';
import type {
  AlertEventDTO,
  AlertEventRow,
} from '../../src/modules/alert-events/alert-events.types';

jest.mock('../../src/config/database', () => {
  const knex = jest.requireActual<typeof import('knex').default>('knex');
  const client = knex({ client: 'mssql' });
  const queries: { sql: string; bindings: readonly unknown[] }[] = [];
  const results: unknown[] = [];
  const failures: unknown[] = [];
  return {
    db: (table: string) => {
      const query = client(table);
      Object.defineProperty(query, 'then', {
        value: function (
          resolve: (value: unknown) => unknown,
          reject: (error: unknown) => unknown,
        ) {
          queries.push(query.toSQL());
          return failures.length
            ? Promise.reject(failures.shift()).then(resolve, reject)
            : Promise.resolve(results.shift() ?? []).then(resolve, reject);
        },
      });
      return query;
    },
    __queries: queries,
    __results: results,
    __failures: failures,
  };
});

jest.mock('../../src/modules/alert-events/alert-events.repository', () => {
  const actual = jest.requireActual<
    typeof import('../../src/modules/alert-events/alert-events.repository')
  >('../../src/modules/alert-events/alert-events.repository');
  return {
    ...actual,
    alertEventsRepository: { ...actual.alertEventsRepository, findByIdempotencyKey: jest.fn() },
  };
});

import {
  alertEventsRepository,
  toAlertEventDTO,
} from '../../src/modules/alert-events/alert-events.repository';

const lookup = jest.mocked(alertEventsRepository.findByIdempotencyKey);
const database = jest.requireMock('../../src/config/database') as {
  __queries: { sql: string; bindings: readonly unknown[] }[];
  __results: unknown[];
  __failures: unknown[];
};

function repository() {
  return jest.requireActual<{
    alertEmailDailyRepository: { create(candidate: DailyAlertCandidate): Promise<AlertEventDTO> };
  }>('../../src/modules/alert-emails/alert-email-daily.repository').alertEmailDailyRepository;
}

function candidate(overrides: Partial<DailyAlertCandidate> = {}): DailyAlertCandidate {
  const [daily] = buildDailyAlertCandidates({
    point: {
      id: 55,
      systemType: 'CEMS',
      stationId: 'S0001',
      pointCode: 'S0001',
      pointName: 'ปล่อง 1',
      pointType: 'STACK',
      factoryId: 'factory-001',
      factoryName: 'บริษัทตัวอย่าง จำกัด',
      factoryRegistrationNo: '3-001',
      connectedAt: '2026-10-01T00:00:00+07:00',
      officerEmails: [],
      factoryEmails: [],
    },
    parameters: [{ code: 'co', name: 'CO', unit: 'ppm', samples: [], dailySummaries: [] }],
    date: '2026-10-04',
    detectedAt: '2026-10-05T09:00:00+07:00',
    completenessPolicy: 'ON_TIME',
    exemptDayPolicy: 'RESET',
    abnormalReadings: 5,
  });
  return { ...daily, ...overrides };
}

function row(overrides: Partial<AlertEventRow> = {}): AlertEventRow {
  return {
    ...candidate(),
    id: 2001,
    created_at: '2026-10-05T02:00:00.000Z',
    updated_at: '2026-10-05T02:00:00.000Z',
    created_by: null,
    updated_by: null,
    deleted_at: null,
    ...overrides,
  };
}

describe('daily alert event persistence', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    database.__queries.length = 0;
    database.__results.length = 0;
    database.__failures.length = 0;
    lookup.mockResolvedValue(null);
  });

  it('returns an existing daily event without inserting or changing its evidence', async () => {
    const existing = toAlertEventDTO(row());
    lookup.mockResolvedValue(existing);
    await expect(repository().create(candidate())).resolves.toEqual(existing);
    expect(database.__queries).toHaveLength(0);
  });

  it('persists candidate facts with explicit UTC Date bindings and no original recipient/source payload', async () => {
    database.__results.push([row()]);
    const input = candidate({ source_payload_json: '{"private":"must not be stored"}' });
    const result = await repository().create(input);

    expect(result).toMatchObject({
      id: 2001,
      parameterLabel: 'CO (ppm)',
      alertType: 'DAILY_COMPLETENESS_LOW',
    });
    const compiled = database.__queries[0];
    expect(compiled.sql).toContain('insert into [alert_events]');
    expect(compiled.sql).toContain('[detected_at]');
    expect(compiled.sql).toContain('[source_payload_json]');
    expect(compiled.bindings).toContain(input.idempotency_key);
    expect(compiled.bindings).toContain(input.evidence_json);
    expect(compiled.bindings).not.toContain(input.source_payload_json);
    const dates = compiled.bindings.filter((value): value is Date => value instanceof Date);
    expect(dates.map((value) => value.toISOString())).toEqual(
      expect.arrayContaining([
        '2026-10-03T17:00:00.000Z',
        '2026-10-04T17:00:00.000Z',
        '2026-10-05T02:00:00.000Z',
      ]),
    );
    expect(dates).toHaveLength(3);
  });

  it('converts the first and confirmed abnormal timestamps to UTC before SQL binding', async () => {
    database.__results.push([row()]);
    await repository().create(
      candidate({
        alert_type: 'ABNORMAL_VALUE',
        abnormal_type: 'ZERO',
        abnormal_streak_count: 5,
        started_at: '2026-10-04T04:00:00+07:00',
        ended_at: '2026-10-04T08:00:00+07:00',
        first_abnormal_at: '2026-10-04T04:00:00+07:00',
        confirmed_abnormal_at: '2026-10-04T08:00:00+07:00',
      }),
    );
    const dates = database.__queries[0].bindings.filter(
      (value): value is Date => value instanceof Date,
    );
    expect(
      dates
        .map((value) => value.toISOString())
        .filter((value) => value === '2026-10-03T21:00:00.000Z'),
    ).toHaveLength(2);
    expect(
      dates
        .map((value) => value.toISOString())
        .filter((value) => value === '2026-10-04T01:00:00.000Z'),
    ).toHaveLength(2);
  });

  it.each([2601, 2627])(
    'returns the concurrent winner for an exact-key SQL unique collision %s',
    async (number) => {
      const existing = toAlertEventDTO(row());
      lookup.mockResolvedValueOnce(null).mockResolvedValueOnce(existing);
      database.__failures.push(Object.assign(new Error('duplicate'), { number }));
      await expect(repository().create(candidate())).resolves.toEqual(existing);
      expect(lookup).toHaveBeenLastCalledWith(candidate().idempotency_key);
    },
  );

  it('supports the wrapped SQL Server unique-key error shape', async () => {
    const existing = toAlertEventDTO(row());
    lookup.mockResolvedValueOnce(null).mockResolvedValueOnce(existing);
    database.__failures.push({ originalError: { info: { number: 2627 } } });
    await expect(repository().create(candidate())).resolves.toEqual(existing);
  });

  it('propagates a unique violation if it does not resolve to the expected daily event', async () => {
    const error = Object.assign(new Error('another unique constraint'), { number: 2627 });
    database.__failures.push(error);
    await expect(repository().create(candidate())).rejects.toBe(error);
  });

  it('propagates ordinary database failures without masking them as duplicates', async () => {
    const error = Object.assign(new Error('connection failed'), { number: 4060 });
    database.__failures.push(error);
    await expect(repository().create(candidate())).rejects.toBe(error);
    expect(lookup).toHaveBeenCalledTimes(1);
  });

  it('looks up the inserted event when the SQL driver does not return a row', async () => {
    const existing = toAlertEventDTO(row());
    lookup.mockResolvedValueOnce(null).mockResolvedValueOnce(existing);
    database.__results.push([]);
    await expect(repository().create(candidate())).resolves.toEqual(existing);
  });

  it('reports an insert that neither returned nor persisted the expected event', async () => {
    database.__results.push([]);
    await expect(repository().create(candidate())).rejects.toThrow(
      'Failed to create daily alert event',
    );
  });

  it.each(['', 'x'.repeat(221)])(
    'rejects an invalid idempotency key before querying: %s',
    async (key) => {
      await expect(repository().create(candidate({ idempotency_key: key }))).rejects.toThrow(
        'Invalid daily alert idempotency key',
      );
      expect(lookup).not.toHaveBeenCalled();
      expect(database.__queries).toHaveLength(0);
    },
  );

  it.each(['2026-10-05T09:00:00', 'invalid'])(
    'rejects a detected time without a valid timezone: %s',
    async (detected_at) => {
      await expect(repository().create(candidate({ detected_at }))).rejects.toThrow(
        'Invalid daily alert detected_at',
      );
      expect(database.__queries).toHaveLength(0);
    },
  );
});
