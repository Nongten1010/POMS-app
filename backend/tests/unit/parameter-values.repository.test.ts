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

import { parameterValuesRepository } from '../../src/modules/parameter-values/parameter-values.repository';

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
});
