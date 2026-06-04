import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../../src/modules/parameter-values/parameter-values.repository', () => ({
  parameterValuesRepository: {
    latestRow: jest.fn(),
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
    });

    const result = await parameterValuesService.list({
      stationId: 'S0001',
      interval: 'real',
      startDate: '2026-06-04',
      endDate: '2026-06-04',
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
        startDate: '2026-06-04',
        endDate: '2026-06-04',
        count: 1,
      },
    });
  });

  it('throws not found when the station interval table does not exist', async () => {
    mockedRepository.tableExists.mockResolvedValue(false);

    await expect(
      parameterValuesService.list({
        stationId: 'S9999',
        interval: 'real',
        startDate: '2026-06-04',
        endDate: '2026-06-04',
      }),
    ).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });

    expect(mockedRepository.listRows).not.toHaveBeenCalled();
  });

  it('returns the latest row with source metadata', async () => {
    mockedRepository.tableExists.mockResolvedValue(true);
    mockedRepository.latestRow.mockResolvedValue({
      tableName: 'S0001_data_real',
      row: {
        station_id: 'S0001',
        co2_value: '435',
        cdate: '2026-06-04',
        ctime: '09:04:00',
      },
    });

    const result = await parameterValuesService.latest({
      stationId: 'S0001',
      interval: 'real',
    });

    expect(result).toMatchObject({
      data: {
        station_id: 'S0001',
        co2_value: '435',
      },
      meta: {
        stationId: 'S0001',
        interval: 'real',
        schemaName: 'ingest',
        tableName: 'S0001_data_real',
        count: 1,
      },
    });
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
