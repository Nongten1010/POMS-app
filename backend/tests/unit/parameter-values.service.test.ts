import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../../src/modules/parameter-values/parameter-values.repository', () => ({
  parameterValuesRepository: {
    canAccessStation: jest.fn(),
    latestRow: jest.fn(),
    listAccessibleStationIds: jest.fn(),
    listRegisteredParameters: jest.fn(),
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
  const operatorAccess = { actorUserId: 42, scope: 'OWN_FACTORY' };

  beforeEach(() => {
    jest.clearAllMocks();
    mockedRepository.canAccessStation.mockResolvedValue(true);
    mockedRepository.listAccessibleStationIds.mockResolvedValue(['S0001']);
    mockedRepository.listRegisteredParameters.mockResolvedValue(['CO2']);
  });

  it('lists only registered parameter columns from the interval table with source metadata', async () => {
    mockedRepository.listRegisteredParameters.mockResolvedValue(['NOx', 'O2']);
    mockedRepository.tableExists.mockResolvedValue(true);
    mockedRepository.listRows.mockResolvedValue({
      tableName: 'S0001_data_real',
      rows: [
        {
          station_id: 'S0001',
          nox_value: '12.3',
          nox_units: 'ppm',
          nox_status: 'Normal',
          o2_value: '7.1',
          o2_units: '%',
          co2_value: '400',
          cdate: '2026-06-04',
          ctime: '10:00:00',
        },
      ],
    });

    const result = await parameterValuesService.list(
      {
        stationId: 'S0001',
        interval: 'real',
        startDate: '2026-06-04',
        endDate: '2026-06-04',
      },
      operatorAccess,
    );

    expect(mockedRepository.tableExists).toHaveBeenCalledWith('S0001_data_real');
    expect(mockedRepository.canAccessStation).toHaveBeenCalledWith('S0001', operatorAccess);
    expect(result).toMatchObject({
      data: [
        {
          station_id: 'S0001',
          nox_value: '12.3',
          nox_units: 'ppm',
          nox_status: 'Normal',
          o2_value: '7.1',
          o2_units: '%',
          cdate: '2026-06-04',
          ctime: '10:00:00',
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
        registeredParameters: ['NOx', 'O2'],
        returnedColumns: [
          'station_id',
          'nox_value',
          'nox_units',
          'nox_status',
          'o2_value',
          'o2_units',
          'cdate',
          'ctime',
        ],
      },
    });
    expect(result.data[0]).not.toHaveProperty('co2_value');
  });

  it('throws not found when the station interval table does not exist', async () => {
    mockedRepository.tableExists.mockResolvedValue(false);

    await expect(
      parameterValuesService.list(
        {
          stationId: 'S9999',
          interval: 'real',
          startDate: '2026-06-04',
          endDate: '2026-06-04',
        },
        operatorAccess,
      ),
    ).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });

    expect(mockedRepository.listRows).not.toHaveBeenCalled();
  });

  it('throws forbidden when the station is not accessible to the operator', async () => {
    mockedRepository.tableExists.mockResolvedValue(true);
    mockedRepository.canAccessStation.mockResolvedValue(false);

    await expect(
      parameterValuesService.list(
        {
          stationId: 'S0002',
          interval: 'real',
          startDate: '2026-06-04',
          endDate: '2026-06-04',
        },
        operatorAccess,
      ),
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
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

    const result = await parameterValuesService.latest(
      {
        stationId: 'S0001',
        interval: 'real',
      },
      operatorAccess,
    );

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
        registeredParameters: ['CO2'],
        returnedColumns: ['station_id', 'co2_value', 'cdate', 'ctime'],
      },
    });
  });

  it('returns formatted connection test values from the station test table', async () => {
    mockedRepository.listRegisteredParameters.mockResolvedValue([
      'CO2 (%)',
      'CO2 (ppm)',
      'NOx (ppm)',
    ]);
    mockedRepository.tableExists.mockResolvedValue(true);
    mockedRepository.latestRow.mockResolvedValue({
      tableName: 'S0001_data_test',
      row: {
        station_id: 'S0001',
        co2_value: '123.4',
        co2_units: 'ppm',
        co2_status: 'Normal',
        nox_value: '8.5',
        nox_units: 'ppm',
        nox_status: 'Maintenance',
        flow_value: '777',
        cdate: '2026-06-07',
        ctime: '10:15:00',
      },
    });

    const result = await parameterValuesService.connectionTest(
      { stationId: 'S0001' },
      operatorAccess,
    );

    expect(mockedRepository.canAccessStation).toHaveBeenCalledWith('S0001', operatorAccess);
    expect(mockedRepository.tableExists).toHaveBeenCalledWith('S0001_data_test');
    expect(mockedRepository.latestRow).toHaveBeenCalledWith({
      stationId: 'S0001',
      interval: 'test',
    });
    expect(result).toMatchObject({
      data: {
        stationId: 'S0001',
        timestamp: '2026-06-07 10:15:00',
        values: {
          'CO2 (%)': '123.4',
          'CO2 (ppm)': '123.4',
          'NOx (ppm)': '8.5',
        },
        statuses: {
          'CO2 (%)': 'Normal',
          'CO2 (ppm)': 'Normal',
          'NOx (ppm)': 'Maintenance',
        },
        results: [
          {
            parameter: 'CO2 (%)',
            value: '123.4',
            status: 'Normal',
            unit: 'ppm',
            valueColumn: 'co2_value',
            statusColumn: 'co2_status',
            unitColumn: 'co2_units',
          },
          {
            parameter: 'CO2 (ppm)',
            value: '123.4',
            status: 'Normal',
            unit: 'ppm',
            valueColumn: 'co2_value',
            statusColumn: 'co2_status',
            unitColumn: 'co2_units',
          },
          {
            parameter: 'NOx (ppm)',
            value: '8.5',
            status: 'Maintenance',
            unit: 'ppm',
            valueColumn: 'nox_value',
            statusColumn: 'nox_status',
            unitColumn: 'nox_units',
          },
        ],
      },
      meta: {
        stationId: 'S0001',
        interval: 'test',
        schemaName: 'ingest',
        tableName: 'S0001_data_test',
        count: 1,
        registeredParameters: ['CO2 (%)', 'CO2 (ppm)', 'NOx (ppm)'],
        returnedColumns: [
          'station_id',
          'co2_value',
          'co2_units',
          'co2_status',
          'nox_value',
          'nox_units',
          'nox_status',
          'cdate',
          'ctime',
        ],
      },
    });
    expect(result.data?.values).not.toHaveProperty('Flow');
  });

  it('returns empty connection test data when no test row exists', async () => {
    mockedRepository.tableExists.mockResolvedValue(true);
    mockedRepository.latestRow.mockResolvedValue({
      tableName: 'S0001_data_test',
      row: null,
    });

    await expect(
      parameterValuesService.connectionTest({ stationId: 'S0001' }, operatorAccess),
    ).resolves.toMatchObject({
      data: null,
      meta: {
        stationId: 'S0001',
        interval: 'test',
        tableName: 'S0001_data_test',
        count: 0,
        registeredParameters: ['CO2'],
        returnedColumns: [],
      },
    });
  });

  it('returns only base columns when the station has no registered parameters', async () => {
    mockedRepository.listRegisteredParameters.mockResolvedValue([]);
    mockedRepository.tableExists.mockResolvedValue(true);
    mockedRepository.listRows.mockResolvedValue({
      tableName: 'S0001_data_real',
      rows: [
        {
          station_id: 'S0001',
          co2_value: '12.3',
          cdate: '2026-06-04',
          ctime: '10:00:00',
        },
      ],
    });

    const result = await parameterValuesService.list(
      {
        stationId: 'S0001',
        interval: 'real',
        startDate: '2026-06-04',
        endDate: '2026-06-04',
      },
      operatorAccess,
    );

    expect(result).toMatchObject({
      data: [
        {
          station_id: 'S0001',
          cdate: '2026-06-04',
          ctime: '10:00:00',
        },
      ],
      meta: {
        registeredParameters: [],
        returnedColumns: ['station_id', 'cdate', 'ctime'],
      },
    });
    expect(result.data[0]).not.toHaveProperty('co2_value');
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

    await expect(parameterValuesService.listTables(operatorAccess)).resolves.toEqual([
      {
        schemaName: 'ingest',
        tableName: 'S0001_data_real',
        columnCount: 392,
        rowCount: 1,
      },
    ]);
  });

  it('filters available parameter tables by accessible station ids', async () => {
    mockedRepository.listAccessibleStationIds.mockResolvedValue(['S0001']);
    mockedRepository.listTables.mockResolvedValue([
      {
        schemaName: 'ingest',
        tableName: 'S0001_data_real',
        columnCount: 392,
        rowCount: 1,
      },
      {
        schemaName: 'ingest',
        tableName: 'S0002_data_real',
        columnCount: 392,
        rowCount: 1,
      },
    ]);

    await expect(parameterValuesService.listTables(operatorAccess)).resolves.toEqual([
      {
        schemaName: 'ingest',
        tableName: 'S0001_data_real',
        columnCount: 392,
        rowCount: 1,
      },
    ]);
  });
});
