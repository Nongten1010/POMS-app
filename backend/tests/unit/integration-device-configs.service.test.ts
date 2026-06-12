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
            standardCriteria: { enabled: true, standardValue: '120' },
            eiaCriteria: { enabled: true, standardValue: '100' },
          },
          {
            parameter: 'SO2 (ppm)',
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
          deviceValueRangeMin: 20,
          deviceValueRangeMax: 200,
        },
      ],
      parameterConfigs: [
        {
          deviceCode: 'S0002/01',
          addressId: 40001,
          parameter: 'NOx (ppm)',
          valueRange: { min: 0, max: 200 },
          valueFormat: 'MEASUREMENT_VALUE',
          offset: 0,
          encoding: 'UNSIGNED16_BIG_ENDIAN',
          standardCriteria: 120,
          eiaCriteria: 100,
          status: 'Normal',
        },
        {
          deviceCode: 'S0002/01',
          addressId: 40002,
          parameter: 'SO2 (ppm)',
          valueRange: { min: 0, max: 500 },
          valueFormat: 'MEASUREMENT_VALUE',
          offset: 0,
          encoding: 'UNSIGNED16_BIG_ENDIAN',
          standardCriteria: 300,
          eiaCriteria: null,
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

  it('throws not found when the station is not connected', async () => {
    mockedRepository.findConnectedPointByStationId.mockResolvedValue(null);
    mockedDeviceConnectionsService.listActiveSettings.mockResolvedValue([]);

    await expect(integrationDeviceConfigsService.getByStationId('S9999')).rejects.toThrow(
      'Connected measurement point not found',
    );
    expect(mockedDeviceConnectionsService.listActiveSettings).not.toHaveBeenCalled();
  });
});
