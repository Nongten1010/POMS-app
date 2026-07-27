import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../../src/modules/integrations/integration-device-configs.repository', () => ({
  integrationDeviceConfigsRepository: {
    findConnectedPointByStationId: jest.fn(),
  },
}));

jest.mock('../../src/modules/device-connections/device-connections.service', () => ({
  deviceConnectionsService: {
    listActiveSettings: jest.fn(),
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
    mockedDeviceConnectionsService.listActiveSettings.mockResolvedValue([
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
      measurementInstruments: {
        parameters: [
          {
            parameter: 'NOx (ppm)',
          },
        ],
      },
    });
    mockedDeviceConnectionsService.listActiveSettings.mockResolvedValue([
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
          dbPass: null,
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

  it('throws not found when the station is not connected', async () => {
    mockedRepository.findConnectedPointByStationId.mockResolvedValue(null);
    mockedDeviceConnectionsService.listActiveSettings.mockResolvedValue([]);

    await expect(integrationDeviceConfigsService.getByStationId('S9999')).rejects.toThrow(
      'Connected measurement point not found',
    );
    expect(mockedDeviceConnectionsService.listActiveSettings).not.toHaveBeenCalled();
  });
});
