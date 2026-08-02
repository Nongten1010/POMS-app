import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../../src/modules/integrations/integration-device-configs.repository', () => ({
  integrationDeviceConfigsRepository: {
    findConnectedPointByStationId: jest.fn(),
  },
}));

jest.mock('../../src/modules/device-connections/device-connections.service', () => ({
  deviceConnectionsService: {
    listActiveSettingsForIntegration: jest.fn(),
  },
}));

import { deviceConnectionsService } from '../../src/modules/device-connections/device-connections.service';
import { integrationDeviceConfigsRepository } from '../../src/modules/integrations/integration-device-configs.repository';
import { integrationDeviceConfigsService } from '../../src/modules/integrations/integration-device-configs.service';

const mockedRepository = jest.mocked(integrationDeviceConfigsRepository);
const mockedDeviceConnectionsService = jest.mocked(deviceConnectionsService);

describe('integrationDeviceConfigsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedRepository.findConnectedPointByStationId.mockResolvedValue({
      stationId: 'S0002',
      systemType: 'CEMS',
      pointType: 'STACK',
      monitoringPointKind: 'CEMS',
      measurementInstruments: {
        parameters: [
          {
            parameter: 'NOx (ppm)',
            standardCondition: true,
            dryBasis: true,
            oxygenOrExcessAir: false,
            standardCriteria: { enabled: true, standardValue: '120' },
            eiaCriteria: { enabled: true, standardValue: '100' },
          },
          {
            parameter: 'SO2 (ppm)',
            standardCondition: false,
            dryBasis: null,
            oxygenOrExcessAir: true,
            standardCriteria: { enabled: true, standardValue: '300' },
            eiaCriteria: null,
          },
        ],
      },
    });
  });

  it('returns separated device, parameter, and schedule config for a station', async () => {
    mockedDeviceConnectionsService.listActiveSettingsForIntegration.mockResolvedValue([
      {
        id: 1,
        requestId: null,
        stationId: 'S0002',
        deviceCode: 'S0002/01',
        protocol: 'MODBUS_TCP',
        settings: { hostIp: '127.0.0.1', port: 1, slaveId: 1 },
        channels: [
          {
            addressId: 40001,
            dataType: 'NOx (ppm)',
            valueRange: { min: 0, max: 200 },
            alertLow: 50,
            alertHigh: 180,
            valueFormat: 'MEASUREMENT_VALUE',
            offset: 0,
            encoding: 'UNSIGNED16_BIG_ENDIAN',
            status: 'Normal',
          },
          {
            addressId: 40002,
            dataType: 'SO2 (ppm)',
            valueRange: { min: 0, max: 500 },
            valueFormat: 'MEASUREMENT_VALUE',
            offset: 0,
            encoding: 'UNSIGNED16_BIG_ENDIAN',
            status: 'Normal',
          },
        ],
        statusManagement: {
          selectedParameters: ['NOx (ppm)', 'SO2 (ppm)'],
          startAt: '2026-06-13T00:00:00+07:00',
          endAt: '2026-06-13T06:00:00+07:00',
          status: 'Calibration',
          schedules: [],
        },
        createdBy: 42,
        createdAt: '2026-06-12T00:00:00.000Z',
        updatedAt: '2026-06-12T00:00:00.000Z',
      },
      {
        id: 2,
        requestId: null,
        stationId: 'S0002',
        deviceCode: 'S0002/02',
        protocol: 'MODBUS_RTU',
        settings: {
          comPort: 1,
          slaveId: 1,
          baudRate: 9600,
          parity: 'NONE',
          stopBits: 1,
          dataBits: 8,
          quantity: 1,
          valueRange: { min: 20, max: 200 },
        },
        channels: [],
        statusManagement: {
          selectedParameters: ['NOx (ppm)', 'SO2 (ppm)'],
          startAt: '2026-06-13T00:00:00+07:00',
          endAt: '2026-06-13T06:00:00+07:00',
          status: 'Calibration',
          schedules: [],
        },
        createdBy: 42,
        createdAt: '2026-06-12T00:00:00.000Z',
        updatedAt: '2026-06-12T00:00:00.000Z',
      },
    ]);

    const result = await integrationDeviceConfigsService.getByStationId('S0002');

    expect(result).toEqual({
      stationId: 'S0002',
      measurementPointType: 'CEMS',
      systemType: 'CEMS',
      pointType: 'STACK',
      monitoringPointKind: 'CEMS',
      deviceConfigs: [
        {
          deviceCode: 'S0002/01',
          protocol: 'MODBUS_TCP',
          hostIp: '127.0.0.1',
          port: 1,
          slaveId: 1,
          comPort: null,
          baudRate: null,
          parity: null,
          stopBits: null,
          dataBits: null,
          quantity: null,
          dbUser: null,
          dbPass: null,
          dbName: null,
          minuteTableName: null,
          fiveMinuteTableName: null,
          hourlyTableName: null,
          deviceValueRangeMin: null,
          deviceValueRangeMax: null,
        },
        {
          deviceCode: 'S0002/02',
          protocol: 'MODBUS_RTU',
          hostIp: null,
          port: null,
          slaveId: 1,
          comPort: 1,
          baudRate: 9600,
          parity: 'NONE',
          stopBits: 1,
          dataBits: 8,
          quantity: 1,
          dbUser: null,
          dbPass: null,
          dbName: null,
          minuteTableName: null,
          fiveMinuteTableName: null,
          hourlyTableName: null,
          deviceValueRangeMin: 20,
          deviceValueRangeMax: 200,
        },
      ],
      parameterConfigs: [
        {
          deviceCode: 'S0002/01',
          addressId: 40001,
          parameter: 'NOx (ppm)',
          parameterName: 'NOx',
          parameterUnit: 'ppm',
          valueRange: { min: 0, max: 200 },
          alertLow: 50,
          alertHigh: 180,
          valueFormat: 'MEASUREMENT_VALUE',
          offset: 0,
          encoding: 'UNSIGNED16_BIG_ENDIAN',
          standardCriteria: 120,
          eiaCriteria: 100,
          standardCondition: true,
          dryBasis: true,
          oxygenOrExcessAir: false,
          status: 'Normal',
        },
        {
          deviceCode: 'S0002/01',
          addressId: 40002,
          parameter: 'SO2 (ppm)',
          parameterName: 'SO2',
          parameterUnit: 'ppm',
          valueRange: { min: 0, max: 500 },
          alertLow: null,
          alertHigh: null,
          valueFormat: 'MEASUREMENT_VALUE',
          offset: 0,
          encoding: 'UNSIGNED16_BIG_ENDIAN',
          standardCriteria: 300,
          eiaCriteria: null,
          standardCondition: false,
          dryBasis: null,
          oxygenOrExcessAir: true,
          status: 'Normal',
        },
      ],
      statusSchedules: [
        {
          parameter: 'NOx (ppm)',
          startAt: '2026-06-13T00:00:00+07:00',
          endAt: '2026-06-13T06:00:00+07:00',
          status: 'Calibration',
        },
        {
          parameter: 'SO2 (ppm)',
          startAt: '2026-06-13T00:00:00+07:00',
          endAt: '2026-06-13T06:00:00+07:00',
          status: 'Calibration',
        },
      ],
    });
  });

  it('returns database table names and preserves nullable channel config values', async () => {
    mockedRepository.findConnectedPointByStationId.mockResolvedValue({
      stationId: 'S0002',
      systemType: 'CEMS',
      pointType: 'STACK',
      monitoringPointKind: 'CEMS',
      measurementInstruments: {
        parameters: [
          {
            parameter: 'NOx (ppm)',
          },
        ],
      },
    });
    mockedDeviceConnectionsService.listActiveSettingsForIntegration.mockResolvedValue([
      {
        id: 3,
        requestId: null,
        stationId: 'S0002',
        deviceCode: 'S0002/DB-01',
        protocol: 'MSSQL',
        settings: {
          hostIp: null,
          port: null,
          dbUser: null,
          dbPass: 'secret-pass',
          dbName: null,
          minuteTableName: 'measurements_1m',
          fiveMinuteTableName: 'measurements_5m',
          hourlyTableName: 'measurements_1h',
          valueRange: { min: null, max: 500 },
        },
        channels: [
          {
            addressId: null,
            dataType: 'NOx (ppm)',
            valueRange: { min: null, max: 500 },
            alertLow: null,
            alertHigh: null,
            valueFormat: null,
            offset: null,
            encoding: null,
            status: null,
          },
        ],
        statusManagement: null,
        createdBy: 42,
        createdAt: '2026-06-12T00:00:00.000Z',
        updatedAt: '2026-06-12T00:00:00.000Z',
      },
    ]);

    const result = await integrationDeviceConfigsService.getByStationId('S0002');

    expect(result.deviceConfigs[0]).toMatchObject({
      dbPass: 'secret-pass',
      minuteTableName: 'measurements_1m',
      fiveMinuteTableName: 'measurements_5m',
      hourlyTableName: 'measurements_1h',
      deviceValueRangeMin: null,
      deviceValueRangeMax: 500,
    });
    expect(result.parameterConfigs[0]).toMatchObject({
      addressId: null,
      valueRange: { min: null, max: 500 },
      valueFormat: null,
      offset: null,
      encoding: null,
      standardCondition: null,
      dryBasis: null,
      oxygenOrExcessAir: null,
      status: 'Normal',
    });
  });

  it('uses reporting settings from a unique unitless match and avoids ambiguous matches', async () => {
    mockedRepository.findConnectedPointByStationId.mockResolvedValue({
      stationId: 'S0002',
      systemType: 'CEMS',
      pointType: 'STACK',
      monitoringPointKind: 'CEMS',
      measurementInstruments: {
        parameters: [
          {
            parameter: 'NOx (ppm)',
            standardCondition: true,
            dryBasis: false,
            oxygenOrExcessAir: true,
          },
          {
            parameter: 'SO2 (ppm)',
            standardCondition: true,
            dryBasis: true,
            oxygenOrExcessAir: false,
          },
          {
            parameter: 'SO2 (mg/m3)',
            standardCondition: false,
            dryBasis: false,
            oxygenOrExcessAir: true,
          },
        ],
      },
    });
    mockedDeviceConnectionsService.listActiveSettingsForIntegration.mockResolvedValue([
      {
        id: 4,
        requestId: null,
        stationId: 'S0002',
        deviceCode: 'S0002/03',
        protocol: 'MODBUS_TCP',
        settings: {},
        channels: [
          {
            addressId: null,
            dataType: 'NOx',
            offset: null,
          },
          {
            addressId: null,
            dataType: 'SO2',
            offset: null,
          },
        ],
        statusManagement: null,
        createdBy: 42,
        createdAt: '2026-06-12T00:00:00.000Z',
        updatedAt: '2026-06-12T00:00:00.000Z',
      },
    ]);

    const result = await integrationDeviceConfigsService.getByStationId('S0002');

    expect(result.parameterConfigs[0]).toMatchObject({
      parameter: 'NOx',
      standardCondition: true,
      dryBasis: false,
      oxygenOrExcessAir: true,
    });
    expect(result.parameterConfigs[1]).toMatchObject({
      parameter: 'SO2',
      standardCondition: null,
      dryBasis: null,
      oxygenOrExcessAir: null,
    });
  });

  it.each([
    {
      label: 'CEMS point',
      source: { systemType: 'CEMS', pointType: 'STACK', monitoringPointKind: 'CEMS' },
      expected: {
        measurementPointType: 'CEMS',
        systemType: 'CEMS',
        pointType: 'STACK',
        monitoringPointKind: 'CEMS',
      },
    },
    {
      label: 'WPMS point',
      source: { systemType: 'WPMS', pointType: 'WASTEWATER', monitoringPointKind: 'WPMS' },
      expected: {
        measurementPointType: 'WPMS',
        systemType: 'WPMS',
        pointType: 'WASTEWATER',
        monitoringPointKind: 'WPMS',
      },
    },
    {
      label: 'mobile point',
      source: { systemType: 'CEMS', pointType: 'OTHER', monitoringPointKind: ' Mobile ' },
      expected: {
        measurementPointType: 'MOBILE',
        systemType: 'CEMS',
        pointType: 'OTHER',
        monitoringPointKind: 'MOBILE',
      },
    },
    {
      label: 'station point',
      source: { systemType: 'WPMS', pointType: 'OTHER', monitoringPointKind: 'station' },
      expected: {
        measurementPointType: 'STATION',
        systemType: 'WPMS',
        pointType: 'OTHER',
        monitoringPointKind: 'STATION',
      },
    },
  ] as const)('returns normalized measurement-point metadata for a $label', async ({ source, expected }) => {
    const connectedPoint = {
      stationId: 'S0002',
      ...source,
      measurementInstruments: null,
    };
    mockedRepository.findConnectedPointByStationId.mockResolvedValue(connectedPoint);
    mockedDeviceConnectionsService.listActiveSettingsForIntegration.mockResolvedValue([]);

    const result = await integrationDeviceConfigsService.getByStationId('S0002');

    expect(result).toMatchObject(expected);
  });

  it.each([
    ['CEMS', 'STACK', 'CEMS'],
    ['WPMS', 'WASTEWATER', 'WPMS'],
  ] as const)(
    'falls back to %s for a legacy point without monitoringPointKind',
    async (systemType, pointType, expectedType) => {
      const connectedPoint = {
        stationId: 'S0002',
        systemType,
        pointType,
        monitoringPointKind: null,
        measurementInstruments: null,
      };
      mockedRepository.findConnectedPointByStationId.mockResolvedValue(connectedPoint);
      mockedDeviceConnectionsService.listActiveSettingsForIntegration.mockResolvedValue([]);

      const result = await integrationDeviceConfigsService.getByStationId('S0002');

      expect(result).toMatchObject({
        measurementPointType: expectedType,
        systemType,
        pointType,
        monitoringPointKind: null,
      });
    },
  );

  it.each([
    ['CEMS', 'OTHER', null],
    ['CEMS', 'STACK', 'STATION'],
    ['WPMS', 'OTHER', 'unexpected-kind'],
  ] as const)(
    'returns UNKNOWN instead of guessing for ambiguous metadata %s/%s/%s',
    async (systemType, pointType, monitoringPointKind) => {
      const connectedPoint = {
        stationId: 'S0002',
        systemType,
        pointType,
        monitoringPointKind,
        measurementInstruments: null,
      };
      mockedRepository.findConnectedPointByStationId.mockResolvedValue(connectedPoint);
      mockedDeviceConnectionsService.listActiveSettingsForIntegration.mockResolvedValue([]);

      const result = await integrationDeviceConfigsService.getByStationId('S0002');

      expect(result).toMatchObject({
        measurementPointType: 'UNKNOWN',
        systemType,
        pointType,
        monitoringPointKind:
          monitoringPointKind === 'STATION' ? 'STATION' : null,
      });
    },
  );

  it('throws not found when the station is not connected', async () => {
    mockedRepository.findConnectedPointByStationId.mockResolvedValue(null);
    mockedDeviceConnectionsService.listActiveSettingsForIntegration.mockResolvedValue([]);

    await expect(integrationDeviceConfigsService.getByStationId('S9999')).rejects.toThrow(
      'Connected measurement point not found',
    );
    expect(mockedDeviceConnectionsService.listActiveSettingsForIntegration).not.toHaveBeenCalled();
  });
});
