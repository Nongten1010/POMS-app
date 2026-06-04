import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../../src/modules/parameter-values/parameter-values.repository', () => ({
  parameterValuesRepository: {
    listRows: jest.fn(),
    listTables: jest.fn(),
    tableExists: jest.fn(),
    tableName: jest.fn((stationId: string, interval: string) => `${stationId}_data_${interval}`),
  },
}));

import { parameterValuesRepository } from '../../src/modules/parameter-values/parameter-values.repository';
import { parameterValuesService } from '../../src/modules/parameter-values/parameter-values.service';

const mockedRepository = jest.mocked(parameterValuesRepository);

describe('parameterValuesService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('lists values from the interval table with source metadata', async () => {
    mockedRepository.tableExists.mockResolvedValue(true);
    mockedRepository.listRows.mockResolvedValue({
      tableName: 'S0001_data_real',
      rows: [
        {
          station_id: 'S0001',
          co2_value: '12.3',
          co2_units: 'ppm',
          co2_status: 'Normal',
          cdate: '2026-06-04',
          ctime: '10:00:00',
        },
      ],
      hasMore: false,
    });

    const result = await parameterValuesService.list({
      stationId: 'S0001',
      interval: 'real',
      limit: 100,
      offset: 0,
    });

    expect(mockedRepository.tableExists).toHaveBeenCalledWith('S0001_data_real');
    expect(result).toMatchObject({
      data: [
        {
          station_id: 'S0001',
          co2_value: '12.3',
        },
      ],
      meta: {
        stationId: 'S0001',
        interval: 'real',
        schemaName: 'ingest',
        tableName: 'S0001_data_real',
        limit: 100,
        offset: 0,
        count: 1,
        hasMore: false,
      },
    });
  });

  it('throws not found when the station interval table does not exist', async () => {
    mockedRepository.tableExists.mockResolvedValue(false);

    await expect(
      parameterValuesService.list({
        stationId: 'S9999',
        interval: 'real',
        limit: 100,
        offset: 0,
      }),
    ).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });

    expect(mockedRepository.listRows).not.toHaveBeenCalled();
  });

  it('lists available parameter tables', async () => {
    mockedRepository.listTables.mockResolvedValue([
      {
        schemaName: 'ingest',
        tableName: 'S0001_data_real',
        columnCount: 392,
        rowCount: 1,
      },
    ]);

    await expect(parameterValuesService.listTables()).resolves.toEqual([
      {
        schemaName: 'ingest',
        tableName: 'S0001_data_real',
        columnCount: 392,
        rowCount: 1,
      },
    ]);
  });
});
