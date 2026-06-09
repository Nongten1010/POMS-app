import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../../src/modules/parameter-values/parameter-values.repository', () => ({
  parameterValuesRepository: {
    canAccessStation: jest.fn(),
    listRegisteredParameters: jest.fn(),
    listRows: jest.fn(),
    tableExists: jest.fn(),
    tableName: jest.fn((stationId: string, interval: string) => `${stationId}_data_${interval}`),
  },
}));

import { parameterValuesRepository } from '../../src/modules/parameter-values/parameter-values.repository';
import { parameterValuesService } from '../../src/modules/parameter-values/parameter-values.service';

const mockedRepository = jest.mocked(parameterValuesRepository);

describe('parameterValuesService CO2 unit-specific columns', () => {
  const operatorAccess = { actorUserId: 42, scope: 'OWN_FACTORY' };

  beforeEach(() => {
    jest.clearAllMocks();
    mockedRepository.canAccessStation.mockResolvedValue(true);
    mockedRepository.tableExists.mockResolvedValue(true);
  });

  it('returns CO2 percent and CO2 ppm mock columns as separate parameters', async () => {
    mockedRepository.listRegisteredParameters.mockResolvedValue(['CO2 (%)', 'CO2 (ppm)']);
    mockedRepository.listRows.mockResolvedValue({
      tableName: 'S0001_data_60m',
      rows: [
        {
          station_id: 'S0001',
          co2_percent_value: '10.4',
          co2_percent_units: '%',
          co2_percent_status: 'Normal',
          co2_ppm_value: '530',
          co2_ppm_units: 'ppm',
          co2_ppm_status: 'Maintenance',
          cdate: '2026-06-09',
          ctime: '10:00:00',
        },
      ],
    });

    const result = await parameterValuesService.list(
      {
        stationId: 'S0001',
        interval: '60m',
        startDate: '2026-06-09',
        endDate: '2026-06-09',
      },
      operatorAccess,
    );

    expect(result.data[0]).toMatchObject({
      co2_percent_value: '10.4',
      co2_percent_units: '%',
      co2_percent_status: 'Normal',
      co2_ppm_value: '530',
      co2_ppm_units: 'ppm',
      co2_ppm_status: 'Maintenance',
    });
    expect(result.meta.returnedColumns).toEqual(
      expect.arrayContaining([
        'co2_percent_value',
        'co2_percent_units',
        'co2_percent_status',
        'co2_ppm_value',
        'co2_ppm_units',
        'co2_ppm_status',
      ]),
    );
  });
});
