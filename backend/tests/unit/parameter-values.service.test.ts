import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../../src/modules/parameter-values/parameter-values.repository', () => ({
  parameterValuesRepository: {
    canAccessStation: jest.fn(),
    canAccessStationForConnectionTest: jest.fn(),
    latestRow: jest.fn(),
    latestRowsAtLatestTimestamp: jest.fn(),
    latestRows: jest.fn(),
    listAccessibleStationIds: jest.fn(),
    listRegisteredParameters: jest.fn(),
    listRegisteredParametersForConnectionTest: jest.fn(),
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
    mockedRepository.canAccessStationForConnectionTest.mockResolvedValue(true);
    mockedRepository.listAccessibleStationIds.mockResolvedValue(['S0001']);
    mockedRepository.listRegisteredParameters.mockResolvedValue(['CO2']);
    mockedRepository.listRegisteredParametersForConnectionTest.mockResolvedValue(['CO2']);
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

  it('returns the latest hourly rows from the 60m table timestamp group', async () => {
    mockedRepository.listRegisteredParameters.mockResolvedValue([
      'CO',
      'NOx',
      'Temp',
      'O2',
      'Flow',
    ]);
    mockedRepository.tableExists.mockResolvedValue(true);
    mockedRepository.latestRowsAtLatestTimestamp.mockResolvedValue({
      tableName: 'S0001_data_60m',
      rows: [
        {
          station_id: 'NB-C21',
          co_value: 0.05,
          nox_value: 10.54,
          temp_value: 93.35,
          o2_value: 12.58,
          flow_value: 1981710,
          bod_value: 5,
          cdate: '2026-02-25',
          ctime: '22.00-22.59 น.',
        },
        {
          station_id: 'NB-C22',
          co_value: 0,
          nox_value: 12.37,
          temp_value: 93.11,
          o2_value: 12.52,
          flow_value: 1906655.5,
          cdate: '2026-02-25',
          ctime: '22.00-22.59 น.',
        },
      ],
    });

    const result = await parameterValuesService.latestHourly('S0001', operatorAccess);

    expect(mockedRepository.tableExists).toHaveBeenCalledWith('S0001_data_60m');
    expect(mockedRepository.latestRowsAtLatestTimestamp).toHaveBeenCalledWith({
      stationId: 'S0001',
      interval: '60m',
    });
    expect(result).toMatchObject({
      data: [
        {
          station_id: 'NB-C21',
          co_value: 0.05,
          nox_value: 10.54,
          temp_value: 93.35,
          o2_value: 12.58,
          flow_value: 1981710,
          cdate: '2026-02-25',
          ctime: '22.00-22.59 น.',
        },
        {
          station_id: 'NB-C22',
          co_value: 0,
          nox_value: 12.37,
          temp_value: 93.11,
          o2_value: 12.52,
          flow_value: 1906655.5,
          cdate: '2026-02-25',
          ctime: '22.00-22.59 น.',
        },
      ],
      meta: {
        stationId: 'S0001',
        interval: '60m',
        schemaName: 'ingest',
        tableName: 'S0001_data_60m',
        count: 2,
        registeredParameters: ['CO', 'NOx', 'Temp', 'O2', 'Flow'],
      },
    });
    expect(result.meta.returnedColumns).toEqual([
      'station_id',
      'co_value',
      'nox_value',
      'temp_value',
      'o2_value',
      'flow_value',
      'cdate',
      'ctime',
    ]);
    expect(result.data[0]).not.toHaveProperty('bod_value');
  });

  it('returns formatted connection test values from the latest five station test rows', async () => {
    mockedRepository.listRegisteredParametersForConnectionTest.mockResolvedValue([
      'CO2 (%)',
      'CO2 (ppm)',
      'NOx (ppm)',
    ]);
    mockedRepository.tableExists.mockResolvedValue(true);
    mockedRepository.latestRows.mockResolvedValue({
      tableName: 'S0001_data_test',
      rows: [
        {
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
        {
          station_id: 'S0001',
          co2_value: '122.4',
          co2_units: 'ppm',
          co2_status: 'Normal',
          nox_value: '8.1',
          nox_units: 'ppm',
          nox_status: 'Normal',
          cdate: '2026-06-07',
          ctime: '10:14:00',
        },
      ],
    });

    const result = await parameterValuesService.connectionTest(
      { stationId: 'S0001' },
      operatorAccess,
    );

    expect(mockedRepository.canAccessStationForConnectionTest).toHaveBeenCalledWith(
      'S0001',
      operatorAccess,
    );
    expect(mockedRepository.tableExists).toHaveBeenCalledWith('S0001_data_test');
    expect(mockedRepository.latestRows).toHaveBeenCalledWith(
      {
        stationId: 'S0001',
        interval: 'test',
      },
      5,
    );
    expect(result).toMatchObject({
      data: [
        {
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
        },
        {
          timestamp: '2026-06-07 10:14:00',
          values: {
            'CO2 (%)': '122.4',
            'CO2 (ppm)': '122.4',
            'NOx (ppm)': '8.1',
          },
          statuses: {
            'CO2 (%)': 'Normal',
            'CO2 (ppm)': 'Normal',
            'NOx (ppm)': 'Normal',
          },
        },
      ],
      meta: {
        stationId: 'S0001',
        interval: 'test',
        schemaName: 'ingest',
        tableName: 'S0001_data_test',
        count: 2,
        registeredParameters: ['CO2 (%)', 'CO2 (ppm)', 'NOx (ppm)'],
      },
    });
    expect(result.data[0]?.values).not.toHaveProperty('Flow');
    expect(result.data[0]).not.toHaveProperty('results');
    expect(result.data[0]).not.toHaveProperty('stationId');
    expect(result.meta).not.toHaveProperty('returnedColumns');
  });

  it('allows connection test when the station is accessible through a waiting connection request', async () => {
    mockedRepository.canAccessStationForConnectionTest.mockResolvedValue(true);
    mockedRepository.listRegisteredParametersForConnectionTest.mockResolvedValue(['NOx (ppm)']);
    mockedRepository.tableExists.mockResolvedValue(true);
    mockedRepository.latestRows.mockResolvedValue({
      tableName: 'S0001_data_test',
      rows: [
        {
          station_id: 'S0001',
          nox_value: '8.5',
          nox_units: 'ppm',
          nox_status: 'Normal',
          cdate: '2026-06-07',
          ctime: '10:15:00',
        },
      ],
    });

    const result = await parameterValuesService.connectionTest(
      { stationId: 'S0001' },
      operatorAccess,
    );

    expect(mockedRepository.canAccessStation).not.toHaveBeenCalled();
    expect(mockedRepository.canAccessStationForConnectionTest).toHaveBeenCalledWith(
      'S0001',
      operatorAccess,
    );
    expect(mockedRepository.listRegisteredParametersForConnectionTest).toHaveBeenCalledWith(
      'S0001',
      operatorAccess,
    );
    expect(result.data[0]?.values).toEqual({ 'NOx (ppm)': '8.5' });
  });

  it('returns empty connection test data when no test row exists', async () => {
    mockedRepository.tableExists.mockResolvedValue(true);
    mockedRepository.latestRows.mockResolvedValue({
      tableName: 'S0001_data_test',
      rows: [],
    });

    await expect(
      parameterValuesService.connectionTest({ stationId: 'S0001' }, operatorAccess),
    ).resolves.toMatchObject({
      data: [],
      meta: {
        stationId: 'S0001',
        interval: 'test',
        tableName: 'S0001_data_test',
        count: 0,
        registeredParameters: ['CO2'],
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

  it('builds daily measurement statistics for chart and table display', async () => {
    mockedRepository.listRegisteredParameters.mockResolvedValue(['CO (ppm)', 'NOx (ppm)']);
    mockedRepository.tableExists.mockResolvedValue(true);
    mockedRepository.listRows.mockResolvedValue({
      tableName: 'S0001_data_60m',
      rows: [
        {
          station_id: 'S0001',
          co_value: 0.08,
          co_units: 'ppm',
          co_status: 'Normal',
          nox_value: 192,
          nox_units: 'ppm',
          cdate: '2026-06-09',
          ctime: '01:00:00',
        },
        {
          station_id: 'S0001',
          co_value: null,
          nox_value: null,
          cdate: '2026-06-09',
          ctime: '02:00:00',
        },
        {
          station_id: 'S0001',
          co_value: 191,
          co_units: 'ppm',
          nox_value: 150,
          nox_units: 'ppm',
          cdate: '2026-06-09',
          ctime: '00:00:00',
        },
      ],
    });

    const result = await parameterValuesService.measurementStatistics(
      { stationId: 'S0001', date: '2026-06-09' },
      operatorAccess,
    );

    expect(mockedRepository.tableExists).toHaveBeenCalledWith('S0001_data_60m');
    expect(mockedRepository.listRows).toHaveBeenCalledWith({
      stationId: 'S0001',
      interval: '60m',
      startDate: '2026-06-09',
      endDate: '2026-06-09',
    });
    expect(result.data).toMatchObject({
      metadata: {
        date: '2026-06-09',
      },
      thresholds: [
        {
          parameterCode: 'CO',
          parameterLabel: 'CO (ppm)',
          unit: 'ppm',
          normalMax: 180,
          warningMax: 190,
        },
        {
          parameterCode: 'NOX',
          parameterLabel: 'NOx (ppm)',
          unit: 'ppm',
          normalMax: 180,
          warningMax: 190,
        },
      ],
      measurementPoints: [
        {
          pointCode: 'S0001',
          stationId: 'S0001',
          date: '2026-06-09',
          rows: expect.arrayContaining([
            expect.objectContaining({
              time: '00.00-00.59 น.',
              chartTime: '00:00',
              values: {
                'CO (ppm)': { value: 191, displayValue: '191.00', status: 'exceeded' },
                'NOx (ppm)': { value: 150, displayValue: '150.00', status: 'normal' },
              },
            }),
            expect.objectContaining({
              time: '02.00-02.59 น.',
              chartTime: '02:00',
              dataCompletenessPercent: 0,
              values: {
                'CO (ppm)': { value: null, displayValue: '-', status: 'insufficient' },
                'NOx (ppm)': { value: null, displayValue: '-', status: 'insufficient' },
              },
            }),
          ]),
        },
      ],
    });
    expect(result.data.measurementPoints[0]?.rows).toHaveLength(24);
    expect(result.meta).toMatchObject({
      stationId: 'S0001',
      interval: '60m',
      tableName: 'S0001_data_60m',
      count: 3,
      registeredParameters: ['CO (ppm)', 'NOx (ppm)'],
    });
  });

  it('uses form criteria for measurement thresholds without copying them across units', async () => {
    mockedRepository.listRegisteredParameters.mockResolvedValue(['CO2 (%)', 'CO2 (ppm)', 'SO2 (ppm)']);
    mockedRepository.tableExists.mockResolvedValue(true);
    mockedRepository.listRows.mockResolvedValue({
      tableName: 'S0001_data_60m',
      rows: [
        {
          station_id: 'S0001',
          co2_value: 185,
          co2_units: 'ppm',
          so2_value: 55,
          so2_units: 'ppm',
          cdate: '2026-06-09',
          ctime: '00:00:00',
        },
      ],
    });

    const result = await parameterValuesService.measurementStatistics(
      { stationId: 'S0001', date: '2026-06-09' },
      operatorAccess,
      {
        parameterEvaluations: [
          {
            parameter: 'CO2 (%)',
            channelStatus: 'Normal',
            standardCriteria: {
              enabled: false,
              standardValue: '120',
              rows: [
                { level: 'normal', min: 0, max: 180 },
                { level: 'warning', min: 181, max: 190 },
                { level: 'critical', min: 191, max: null },
              ],
            },
          },
          {
            parameter: 'CO2 (ppm)',
            channelStatus: 'Normal',
            standardCriteria: {
              enabled: true,
              standardValue: null,
              rows: [],
            },
            eiaCriteria: {
              enabled: true,
              standardValue: null,
              rows: [],
            },
          },
          {
            parameter: 'SO2 (ppm)',
            channelStatus: 'Normal',
            standardCriteria: {
              enabled: true,
              standardValue: null,
              rows: [],
            },
            eiaCriteria: {
              enabled: false,
              standardValue: '50',
              rows: [
                { level: 'normal', min: 0, max: 50 },
                { level: 'warning', min: 51, max: 60 },
                { level: 'critical', min: 61, max: null },
              ],
            },
          },
        ],
      },
    );

    expect(result.data.thresholds).toEqual([
      {
        parameterCode: 'CO2',
        parameterLabel: 'CO2 (%)',
        unit: '%',
        normalMax: 180,
        warningMax: 190,
      },
      {
        parameterCode: 'SO2',
        parameterLabel: 'SO2 (ppm)',
        unit: 'ppm',
        normalMax: 50,
        warningMax: 60,
      },
    ]);
  });

  it('keys measurement statistic values by parameter label with units', async () => {
    mockedRepository.listRegisteredParameters.mockResolvedValue(['CO2 (%)', 'CO2 (ppm)']);
    mockedRepository.tableExists.mockResolvedValue(true);
    mockedRepository.listRows.mockResolvedValue({
      tableName: 'S0001_data_60m',
      rows: [
        {
          station_id: 'S0001',
          co2_value: 12.5,
          co2_units: '%',
          cdate: '2026-06-09',
          ctime: '00:00:00',
        },
      ],
    });

    const result = await parameterValuesService.measurementStatistics(
      { stationId: 'S0001', date: '2026-06-09' },
      operatorAccess,
      {
        parameterEvaluations: [
          { parameter: 'CO2 (%)', channelStatus: 'ปกติ', standardCriteria: null },
          { parameter: 'CO2 (ppm)', channelStatus: 'ปกติ', standardCriteria: null },
        ],
      },
    );

    const values = result.data.measurementPoints[0]?.rows[0]?.values;
    expect(values).toEqual({
      'CO2 (%)': { value: 12.5, displayValue: '12.50', status: 'normal' },
      'CO2 (ppm)': { value: null, displayValue: '-', status: 'insufficient' },
    });
    expect(values).not.toHaveProperty('CO2');
  });

  it('builds monthly calendar status from hourly rows', async () => {
    mockedRepository.listRegisteredParameters.mockResolvedValue(['CO (ppm)', 'NOx (ppm)']);
    mockedRepository.tableExists.mockResolvedValue(true);
    mockedRepository.listRows.mockResolvedValue({
      tableName: 'S0001_data_60m',
      rows: [
        ...Array.from({ length: 20 }, (_, hour) => ({
          station_id: 'S0001',
          co_value: hour === 0 ? 191 : 100,
          nox_value: 100,
          cdate: '2026-06-09',
          ctime: `${String(hour).padStart(2, '0')}:00:00`,
        })),
        ...Array.from({ length: 10 }, (_, hour) => ({
          station_id: 'S0001',
          co_value: 100,
          nox_value: 100,
          cdate: '2026-06-10',
          ctime: `${String(hour).padStart(2, '0')}:00:00`,
        })),
      ],
    });

    const result = await parameterValuesService.calendarStatus(
      { stationId: 'S0001', month: '2026-06' },
      operatorAccess,
    );

    expect(mockedRepository.listRows).toHaveBeenCalledWith({
      stationId: 'S0001',
      interval: '60m',
      startDate: '2026-06-01',
      endDate: '2026-06-30',
    });
    expect(result.data.calendar).toMatchObject({
      year: 2026,
      month: 6,
      days: [
        {
          date: '2026-06-09',
          dataCompletenessPercent: 83,
          dataCompletenessStatus: 'highData',
          pollutionStatus: 'exceeded',
          display: {
            backgroundStatus: 'highData',
            borderStatus: 'exceeded',
          },
        },
        {
          date: '2026-06-10',
          dataCompletenessPercent: 42,
          dataCompletenessStatus: 'lowData',
          pollutionStatus: 'insufficient',
          display: {
            backgroundStatus: 'lowData',
            borderStatus: 'insufficient',
          },
        },
      ],
    });
    expect(result.data.monthlySummary).toEqual([
      {
        parameterCode: 'CO',
        parameterName: 'CO',
        unit: 'ppm',
        exceededDays: 1,
        lowDataDays: 1,
        todayDataCompletenessPercent: 42,
      },
      {
        parameterCode: 'NOX',
        parameterName: 'NOx',
        unit: 'ppm',
        exceededDays: 0,
        lowDataDays: 1,
        todayDataCompletenessPercent: 42,
      },
    ]);
  });

  it('can evaluate connected-point calendar status from per-parameter completeness, criteria, and channel health', async () => {
    mockedRepository.listRegisteredParameters.mockResolvedValue(['CO (ppm)', 'NOx (ppm)']);
    mockedRepository.tableExists.mockResolvedValue(true);
    mockedRepository.listRows.mockResolvedValue({
      tableName: 'S0001_data_60m',
      rows: [
        ...Array.from({ length: 24 }, (_, hour) => ({
          station_id: 'S0001',
          co_value: hour === 0 ? 110 : 60,
          nox_value: 40,
          cdate: '2026-06-09',
          ctime: `${String(hour).padStart(2, '0')}:00:00`,
        })),
        ...Array.from({ length: 24 }, (_, hour) => ({
          station_id: 'S0001',
          co_value: 60,
          nox_value: hour < 18 ? 40 : null,
          cdate: '2026-06-10',
          ctime: `${String(hour).padStart(2, '0')}:00:00`,
        })),
      ],
    });

    const result = await parameterValuesService.calendarStatus(
      { stationId: 'S0001', month: '2026-06' },
      operatorAccess,
      {
        parameterEvaluations: [
          {
            parameter: 'CO (ppm)',
            channelStatus: 'Normal',
            standardCriteria: {
              enabled: false,
              standardValue: null,
              rows: [
                { level: 'normal', min: 0, max: null },
                { level: 'warning', min: 80, max: null },
                { level: 'critical', min: 100, max: null },
              ],
            },
          },
          {
            parameter: 'NOx (ppm)',
            channelStatus: 'Normal',
            standardCriteria: {
              enabled: false,
              standardValue: null,
              rows: [
                { level: 'normal', min: 0, max: null },
                { level: 'warning', min: 100, max: null },
                { level: 'critical', min: 200, max: null },
              ],
            },
          },
        ],
      },
    );

    expect(result.data.calendar.days).toMatchObject([
      {
        date: '2026-06-09',
        dataCompletenessPercent: 100,
        dataCompletenessStatus: 'highData',
        pollutionStatus: 'exceeded',
        display: {
          backgroundStatus: 'highData',
          borderStatus: 'exceeded',
        },
      },
      {
        date: '2026-06-10',
        dataCompletenessPercent: 75,
        dataCompletenessStatus: 'lowData',
        pollutionStatus: 'insufficient',
        display: {
          backgroundStatus: 'lowData',
          borderStatus: 'insufficient',
        },
      },
    ]);
  });

  it('does not mark calendar pollution status insufficient for localized normal channel statuses', async () => {
    mockedRepository.listRegisteredParameters.mockResolvedValue(['CO (ppm)']);
    mockedRepository.tableExists.mockResolvedValue(true);
    mockedRepository.listRows.mockResolvedValue({
      tableName: 'S0001_data_60m',
      rows: Array.from({ length: 24 }, (_, hour) => ({
        station_id: 'S0001',
        co_value: hour === 0 ? 110 : 60,
        co_units: 'ppm',
        cdate: '2026-06-09',
        ctime: `${String(hour).padStart(2, '0')}:00:00`,
      })),
    });

    const result = await parameterValuesService.calendarStatus(
      { stationId: 'S0001', month: '2026-06' },
      operatorAccess,
      {
        parameterEvaluations: [
          {
            parameter: 'CO (ppm)',
            channelStatus: 'ปกติ',
            standardCriteria: {
              enabled: false,
              standardValue: null,
              rows: [
                { level: 'normal', min: 0, max: null },
                { level: 'warning', min: 80, max: null },
                { level: 'critical', min: 100, max: null },
              ],
            },
          },
        ],
      },
    );

    expect(result.data.calendar.days[0]).toMatchObject({
      dataCompletenessPercent: 100,
      dataCompletenessStatus: 'highData',
      pollutionStatus: 'exceeded',
      display: {
        backgroundStatus: 'highData',
        borderStatus: 'exceeded',
      },
    });
  });

  it('treats a non-normal device channel as insufficient even when values are otherwise normal', async () => {
    mockedRepository.listRegisteredParameters.mockResolvedValue(['CO (ppm)', 'NOx (ppm)']);
    mockedRepository.tableExists.mockResolvedValue(true);
    mockedRepository.listRows.mockResolvedValue({
      tableName: 'S0001_data_60m',
      rows: Array.from({ length: 24 }, (_, hour) => ({
        station_id: 'S0001',
        co_value: 50,
        nox_value: 40,
        cdate: '2026-06-09',
        ctime: `${String(hour).padStart(2, '0')}:00:00`,
      })),
    });

    const result = await parameterValuesService.calendarStatus(
      { stationId: 'S0001', month: '2026-06' },
      operatorAccess,
      {
        parameterEvaluations: [
          {
            parameter: 'CO (ppm)',
            channelStatus: 'Maintenance',
            standardCriteria: {
              enabled: false,
              standardValue: null,
              rows: [
                { level: 'normal', min: 0, max: null },
                { level: 'warning', min: 80, max: null },
                { level: 'critical', min: 100, max: null },
              ],
            },
          },
          {
            parameter: 'NOx (ppm)',
            channelStatus: 'Normal',
            standardCriteria: null,
          },
        ],
      },
    );

    expect(result.data.calendar.days[0]).toMatchObject({
      dataCompletenessStatus: 'highData',
      pollutionStatus: 'insufficient',
    });
  });
});
