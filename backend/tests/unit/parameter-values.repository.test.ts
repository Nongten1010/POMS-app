import { beforeEach, describe, expect, it, jest } from '@jest/globals';

type TimestampQueryMock = {
  from: (...args: unknown[]) => TimestampQueryMock;
  first: () => Promise<unknown>;
  orderBy: (...args: unknown[]) => TimestampQueryMock;
  select: (...args: unknown[]) => TimestampQueryMock;
};

type RowsQueryMock = {
  from: (...args: unknown[]) => RowsQueryMock;
  orderBy: (...args: unknown[]) => Promise<Record<string, unknown>[]>;
  select: (...args: unknown[]) => RowsQueryMock;
  where: (...args: unknown[]) => RowsQueryMock;
};

const mockTimestampFirst = jest.fn<() => Promise<unknown>>();
const mockTimestampQuery: TimestampQueryMock = {
  from: jest.fn(() => mockTimestampQuery),
  first: mockTimestampFirst,
  orderBy: jest.fn(() => mockTimestampQuery),
  select: jest.fn(() => mockTimestampQuery),
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

    expect(sql).toContain('left join [factories] as [f]');
    expect(sql).toContain('left join [provinces] as [pr]');
    expect(sql).toContain('[pr].[name_th]');
    expect(sql).not.toContain('user_juristics');
    expect(compiled.bindings).toContain('ฉะเชิงเทรา');
  });

  it('falls back to owner or juristic access when province scope has no selected province', () => {
    const compiled = buildStationAccessQueryForTests({
      actorUserId: 42,
      scope: {
        scope: 'IN_PROVINCE',
        region: null,
        province: null,
      },
    }).toSQL();
    const sql = compiled.sql.toLowerCase();

    expect(sql).toContain('user_juristics');
    expect(sql).toContain('[p].[created_by]');
    expect(compiled.bindings).toContain(42);
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

  it('prefers instrument parameters over all eligible registered parameters', () => {
    const result = parseRegisteredParametersFromRowForTests({
      parameters_json: JSON.stringify(['CO (ppm)', 'NOx (ppm)', 'Temp. (°C)', 'O2 (%)', 'Flow (m³/hr)']),
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
