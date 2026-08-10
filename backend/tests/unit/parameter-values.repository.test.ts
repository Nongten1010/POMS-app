import { beforeEach, describe, expect, it, jest } from '@jest/globals';

type TimestampQueryMock = {
  from: (...args: unknown[]) => TimestampQueryMock;
  first: () => Promise<unknown>;
  orderBy: (...args: unknown[]) => TimestampQueryMock;
  select: (...args: unknown[]) => TimestampQueryMock;
  where: (...args: unknown[]) => TimestampQueryMock;
};

type RowsQueryMock = {
  from: (...args: unknown[]) => RowsQueryMock;
  orderBy: (...args: unknown[]) => Promise<Record<string, unknown>[]>;
  select: (...args: unknown[]) => RowsQueryMock;
  where: (...args: unknown[]) => RowsQueryMock;
};

type CutoffPredicateQueryMock = {
  andWhere: (...args: unknown[]) => CutoffPredicateQueryMock;
  orWhere: (callback: (builder: CutoffPredicateQueryMock) => void) => CutoffPredicateQueryMock;
  where: (...args: unknown[]) => CutoffPredicateQueryMock;
};

let mockSameDatePredicateQuery: CutoffPredicateQueryMock;
const mockSameDateWhere = jest.fn<(...args: unknown[]) => CutoffPredicateQueryMock>(
  () => mockSameDatePredicateQuery,
);
const mockSameDateAndWhere = jest.fn<(...args: unknown[]) => CutoffPredicateQueryMock>(
  () => mockSameDatePredicateQuery,
);
mockSameDatePredicateQuery = {
  andWhere: mockSameDateAndWhere,
  orWhere: jest.fn(() => mockSameDatePredicateQuery),
  where: mockSameDateWhere,
};

let mockCutoffPredicateQuery: CutoffPredicateQueryMock;
const mockCutoffDateWhere = jest.fn<(...args: unknown[]) => CutoffPredicateQueryMock>(
  () => mockCutoffPredicateQuery,
);
const mockCutoffDateOrWhere = jest.fn<
  (callback: (builder: CutoffPredicateQueryMock) => void) => CutoffPredicateQueryMock
>((callback) => {
  callback(mockSameDatePredicateQuery);
  return mockCutoffPredicateQuery;
});
mockCutoffPredicateQuery = {
  andWhere: jest.fn(() => mockCutoffPredicateQuery),
  orWhere: mockCutoffDateOrWhere,
  where: mockCutoffDateWhere,
};

const mockTimestampFirst = jest.fn<() => Promise<unknown>>();
const mockTimestampWhere = jest.fn<(...args: unknown[]) => TimestampQueryMock>(
  (...args) => {
    const predicate = args[0];
    if (typeof predicate === 'function') {
      (predicate as (builder: CutoffPredicateQueryMock) => void)(mockCutoffPredicateQuery);
    }
    return mockTimestampQuery;
  },
);
const mockTimestampQuery: TimestampQueryMock = {
  from: jest.fn(() => mockTimestampQuery),
  first: mockTimestampFirst,
  orderBy: jest.fn(() => mockTimestampQuery),
  select: jest.fn(() => mockTimestampQuery),
  where: mockTimestampWhere,
};

let mockRowsQuery: RowsQueryMock;
const mockRowsWhere = jest.fn<(...args: unknown[]) => RowsQueryMock>(() => mockRowsQuery);
const mockRowsOrderBy = jest.fn<() => Promise<Record<string, unknown>[]>>();
mockRowsQuery = {
  from: jest.fn(() => mockRowsQuery),
  orderBy: mockRowsOrderBy,
  select: jest.fn(() => mockRowsQuery),
  where: mockRowsWhere,
};

const mockParameterSourceDb = {
  withSchema: jest.fn(),
};

jest.mock('../../src/config/parameter-source-database', () => ({
  parameterSourceDb: mockParameterSourceDb,
}));

import {
  buildStationAccessQueryForTests,
  buildWaitingConnectionStationAccessQueryForTests,
  parseRegisteredParametersFromRowForTests,
  parameterValuesRepository,
} from '../../src/modules/parameter-values/parameter-values.repository';

describe('parameterValuesRepository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockParameterSourceDb.withSchema
      .mockReturnValueOnce(mockTimestampQuery)
      .mockReturnValueOnce(mockRowsQuery);
  });

  it('serializes SQL Server date/time values before querying latest hourly timestamp rows', async () => {
    const cdate = new Date('2026-02-25T00:00:00.000Z');
    const ctime = new Date('1970-01-01T22:00:00.000Z');

    mockTimestampFirst.mockResolvedValue({ cdate, ctime });
    mockRowsOrderBy.mockResolvedValue([
      {
        station_id: 'NB-C21',
        co_value: 0.05,
        cdate,
        ctime,
      },
    ]);

    const result = await parameterValuesRepository.latestRowsAtLatestTimestamp({
      stationId: 'S0001',
      interval: '60m',
    });

    expect(mockRowsWhere).toHaveBeenNthCalledWith(1, 'cdate', '2026-02-25');
    expect(mockRowsWhere).toHaveBeenNthCalledWith(2, 'ctime', '22:00:00');
    expect(result).toEqual({
      tableName: 'S0001_data_60m',
      rows: [
        {
          station_id: 'NB-C21',
          co_value: 0.05,
          cdate: '2026-02-25',
          ctime: '22:00:00',
        },
      ],
    });
  });

  it('limits the latest hourly timestamp to the completed-hour cutoff', async () => {
    mockTimestampFirst.mockResolvedValue({ cdate: '2026-08-08', ctime: '20:00:00' });
    mockRowsOrderBy.mockResolvedValue([
      { station_id: 'S0001', cdate: '2026-08-08', ctime: '20:00:00' },
    ]);

    const result = await parameterValuesRepository.latestRowsAtOrBeforeHour(
      { stationId: 'S0001', interval: '60m' },
      { date: '2026-08-08', hour: 20 },
    );

    expect(mockTimestampWhere).toHaveBeenCalledWith(expect.any(Function));
    expect(mockCutoffDateWhere).toHaveBeenCalledWith('cdate', '<', '2026-08-08');
    expect(mockCutoffDateOrWhere).toHaveBeenCalledWith(expect.any(Function));
    expect(mockSameDateWhere).toHaveBeenCalledWith('cdate', '2026-08-08');
    expect(mockSameDateAndWhere).toHaveBeenCalledWith('ctime', '<=', '20:59:59.9999999');
    expect(result.rows[0]).toMatchObject({ cdate: '2026-08-08', ctime: '20:00:00' });
  });

  it('uses current connected measurement points for station access and registered parameters', () => {
    const sql = buildStationAccessQueryForTests({ actorUserId: 42, scope: 'OWN_FACTORY' })
      .toSQL()
      .sql.toLowerCase();

    expect(sql).toContain('cems_wpms_connected_measurement_points');
    expect(sql).not.toContain('cems_wpms_measurement_points');
    expect(sql).not.toContain('cems_wpms_connection_requests');
    expect(sql).toContain('[p].[factory_id]');
    expect(sql).toContain('[p].[created_by]');
  });

  it('allows connected station access by selected permission province', () => {
    const compiled = buildStationAccessQueryForTests({
      actorUserId: 42,
      scope: {
        scope: 'IN_PROVINCE',
        region: null,
        province: 'ฉะเชิงเทรา',
      },
    }).toSQL();
    const sql = compiled.sql.toLowerCase();

    expect(sql).toContain('left join [eligible_factories] as [ef]');
    expect(sql).toContain('[ef].[id] = [p].[eligible_factory_id]');
    expect(sql).toContain('[ef].[deleted_at] is null');
    expect(sql).toContain('left join [factories] as [f]');
    expect(sql).toContain('[f].[fid] = [ef].[factory_registration_no_new]');
    expect(sql).toContain('[f].[code] = [ef].[source_factory_id]');
    expect(sql).toContain('left join [provinces] as [pr]');
    expect(sql).toContain('[pr].[name_th] = [ef].[province_name]');
    expect(sql).toContain('[pr].[name_th]');
    expect(sql).not.toContain('user_juristics');
    expect(compiled.bindings).toContain('ฉะเชิงเทรา');
  });

  it('fails closed when province scope has no selected province', () => {
    const compiled = buildStationAccessQueryForTests({
      actorUserId: 42,
      scope: {
        scope: 'IN_PROVINCE',
        region: null,
        province: null,
      },
    }).toSQL();
    const sql = compiled.sql.toLowerCase();

    expect(sql).toContain('1 = 0');
    expect(sql).not.toContain('user_juristics');
  });

  it('uses regionalAccess as the fallback qualifier for IN_REGION', () => {
    const compiled = buildStationAccessQueryForTests({
      actorUserId: 42,
      scope: { scope: 'IN_REGION' },
      regionalAccess: { regions: ['ภาคเหนือ'] },
    }).toSQL();

    expect(compiled.sql.toLowerCase()).toContain('[pr].[region]');
    expect(compiled.bindings).toContain('ภาคเหนือ');
    expect(compiled.sql.toLowerCase()).not.toContain('user_juristics');
  });

  it('fails closed when explicit region conflicts with regionalAccess', () => {
    const compiled = buildStationAccessQueryForTests({
      actorUserId: 42,
      scope: { scope: 'IN_REGION', region: 'ภาคเหนือ' },
      regionalAccess: { regions: ['ภาคใต้'] },
    }).toSQL();

    expect(compiled.sql.toLowerCase()).toContain('1 = 0');
  });

  it('filters IN_ESTATE station access by canonical estateCode', () => {
    const compiled = buildStationAccessQueryForTests({
      actorUserId: 42,
      scope: { scope: 'IN_ESTATE', estateCode: 'MTP' },
    }).toSQL();
    const sql = compiled.sql.toLowerCase();

    expect(sql).toContain('left join [industrial_estates] as [ie]');
    expect(sql).toContain('[ie].[code]');
    expect(compiled.bindings).toContain('MTP');
  });

  it('uses waiting connection requests for connection-test station access', () => {
    const compiled = buildWaitingConnectionStationAccessQueryForTests({
      actorUserId: 42,
      scope: 'OWN_FACTORY',
    }).toSQL();
    const sql = compiled.sql.toLowerCase();

    expect(sql).toContain('cems_wpms_measurement_points');
    expect(sql).toContain('cems_wpms_connection_requests');
    expect(sql).toContain('[r].[status] = ?');
    expect(compiled.bindings).toContain('WAITING_CONNECTION');
    expect(sql).toContain('[r].[factory_id]');
    expect(sql).toContain('[r].[created_by]');
  });

  it('allows waiting connection-test station access by selected permission province', () => {
    const compiled = buildWaitingConnectionStationAccessQueryForTests({
      actorUserId: 42,
      scope: {
        scope: 'IN_PROVINCE',
        region: null,
        province: 'ฉะเชิงเทรา',
      },
    }).toSQL();
    const sql = compiled.sql.toLowerCase();

    expect(sql).toContain('left join [factories] as [f]');
    expect(sql).toContain('left join [provinces] as [pr]');
    expect(sql).toContain('[pr].[name_th]');
    expect(sql).not.toContain('user_juristics');
    expect(compiled.bindings).toContain('ฉะเชิงเทรา');
  });

  it('uses regionalAccess fallback for waiting connection-test station access', () => {
    const compiled = buildWaitingConnectionStationAccessQueryForTests({
      actorUserId: 42,
      scope: { scope: 'IN_REGION' },
      regionalAccess: { regions: ['ภาคกลาง'] },
    }).toSQL();

    expect(compiled.sql.toLowerCase()).toContain('[pr].[region]');
    expect(compiled.bindings).toContain('ภาคกลาง');
  });

  it('prefers instrument parameters over all eligible registered parameters', () => {
    const result = parseRegisteredParametersFromRowForTests({
      parameters_json: JSON.stringify([
        'CO (ppm)',
        'NOx (ppm)',
        'Temp. (°C)',
        'O2 (%)',
        'Flow (m³/hr)',
      ]),
      instruments_json: JSON.stringify({
        converterBrand: 'Converter Brand',
        converterModel: 'CV-100',
        parameters: [
          { parameter: 'CO (ppm)' },
          { parameter: 'NOx (ppm)' },
          { parameter: 'Temp. (°C)' },
        ],
      }),
    });

    expect(result).toEqual(['CO (ppm)', 'NOx (ppm)', 'Temp. (°C)']);
  });
});
