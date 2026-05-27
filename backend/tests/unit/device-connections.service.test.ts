import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../../src/modules/device-connections/device-connections.repository', () => ({
  deviceConnectionsRepository: {
    create: jest.fn(),
    findById: jest.fn(),
    list: jest.fn(),
  },
}));

import { deviceConnectionsRepository } from '../../src/modules/device-connections/device-connections.repository';
import { deviceConnectionsService } from '../../src/modules/device-connections/device-connections.service';
import {
  DEVICE_CONNECTION_PROTOCOL,
  type CreateDeviceConnectionConfigInput,
  type DeviceConnectionConfigDTO,
} from '../../src/modules/device-connections/device-connections.types';

const mockedRepository = jest.mocked(deviceConnectionsRepository);

describe('deviceConnectionsService', () => {
  const now = new Date('2026-05-27T10:00:00.000Z');
  const actorUserId = 42;
  const modbusTcpPayload: CreateDeviceConnectionConfigInput = {
    stationId: 'STATION_001',
    protocol: DEVICE_CONNECTION_PROTOCOL.MODBUS_TCP,
    settings: {
      hostIp: '192.168.1.10',
      slaveId: 1,
      port: 502,
    },
    channels: [
      {
        addressId: 40001,
        dataType: 'CO2',
        unit: 'ppm',
        valueRange: { min: 0, max: 200 },
        valueFormat: 'MEASUREMENT_VALUE',
        offset: 0,
        encoding: 'UNSIGNED16_BIG_ENDIAN',
      },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    deviceConnectionsService.setClockForTests(() => now);
  });

  it('returns a successful mock connection result', async () => {
    const result = await deviceConnectionsService.testConnection(modbusTcpPayload);

    expect(result).toMatchObject({
      success: true,
      mode: 'MOCK',
      protocol: DEVICE_CONNECTION_PROTOCOL.MODBUS_TCP,
      stationId: 'STATION_001',
      checkedAt: now.toISOString(),
      details: {
        endpoint: '192.168.1.10:502:slave-1',
        channelCount: 1,
      },
    });
  });

  it('supports one Modbus RTU connection point with multiple measurement devices in mock mode', async () => {
    const result = await deviceConnectionsService.testConnection({
      stationId: 'STATION_001',
      protocol: DEVICE_CONNECTION_PROTOCOL.MODBUS_RTU,
      settings: {
        comPort: 1,
        slaveId: 1,
        baudRate: 9600,
        parity: 'NONE',
        stopBits: 1,
        dataBits: 8,
        quantity: 2,
        valueRange: { min: 0, max: 200 },
      },
      channels: [
        {
          addressId: 40001,
          dataType: 'CO2',
          unit: 'ppm',
          valueRange: { min: 0, max: 200 },
          valueFormat: 'MEASUREMENT_VALUE',
          offset: 0,
          encoding: 'UNSIGNED',
        },
        {
          addressId: 40002,
          dataType: 'O2',
          unit: '%',
          valueRange: { min: 0, max: 25 },
          valueFormat: 'MEASUREMENT_VALUE',
          offset: -0.1,
          encoding: 'SIGNED',
        },
      ],
    });

    expect(result).toMatchObject({
      success: true,
      mode: 'MOCK',
      protocol: DEVICE_CONNECTION_PROTOCOL.MODBUS_RTU,
      details: {
        endpoint: 'COM1:slave-1',
        channelCount: 2,
      },
    });
  });

  const multiDeviceCases: Array<{
    payload: CreateDeviceConnectionConfigInput;
    endpoint: string;
  }> = [
    {
      payload: {
        ...modbusTcpPayload,
        channels: multiDeviceChannels('UNSIGNED16_BIG_ENDIAN', 'SIGNED16_BIG_ENDIAN'),
      },
      endpoint: '192.168.1.10:502:slave-1',
    },
    {
      payload: {
        stationId: 'STATION_001',
        protocol: DEVICE_CONNECTION_PROTOCOL.MSSQL,
        settings: {
          hostIp: '192.168.1.254',
          port: 1433,
          dbUser: 'sensor_user',
          dbPass: 'secret-pass',
          dbName: 'sensor_db',
        },
        channels: databaseMultiDeviceChannels(),
      },
      endpoint: '192.168.1.254:1433/sensor_db',
    },
    {
      payload: {
        stationId: 'STATION_001',
        protocol: DEVICE_CONNECTION_PROTOCOL.MYSQL,
        settings: {
          hostIp: '192.168.1.254',
          port: 3306,
          dbUser: 'sensor_user',
          dbPass: 'secret-pass',
          dbName: 'sensor_db',
        },
        channels: databaseMultiDeviceChannels(),
      },
      endpoint: '192.168.1.254:3306/sensor_db',
    },
  ];

  it.each(multiDeviceCases)(
    'supports one $payload.protocol connection point with multiple measurement devices in mock mode',
    async ({ payload, endpoint }) => {
      const result = await deviceConnectionsService.testConnection(payload);

      expect(result).toMatchObject({
        success: true,
        mode: 'MOCK',
        protocol: payload.protocol,
        details: {
          endpoint,
          channelCount: 2,
        },
      });
    },
  );

  it('returns one fallback mock config for STATION_001 when no DB config exists', async () => {
    mockedRepository.list.mockResolvedValue([]);

    const result = await deviceConnectionsService.list({ stationId: 'STATION_001' });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 900001,
      stationId: 'STATION_001',
      protocol: DEVICE_CONNECTION_PROTOCOL.MODBUS_RTU,
    });
  });

  it('does not return fallback mock config when protocol filter does not match station protocol', async () => {
    mockedRepository.list.mockResolvedValue([]);

    const result = await deviceConnectionsService.list({
      stationId: 'STATION_001',
      protocol: DEVICE_CONNECTION_PROTOCOL.MSSQL,
    });

    expect(result).toEqual([]);
  });

  it('does not return fallback mock configs for other station ids', async () => {
    mockedRepository.list.mockResolvedValue([]);

    const result = await deviceConnectionsService.list({ stationId: 'UNKNOWN_STATION' });

    expect(result).toEqual([]);
  });

  it('returns fallback mock config detail by mock id', async () => {
    mockedRepository.findById.mockResolvedValue(null);

    const result = await deviceConnectionsService.getById(900001);

    expect(result).toMatchObject({
      id: 900001,
      stationId: 'STATION_001',
      protocol: DEVICE_CONNECTION_PROTOCOL.MODBUS_RTU,
      settings: {
        comPort: 1,
        slaveId: 1,
      },
      channels: expect.arrayContaining([
        expect.objectContaining({
          addressId: 40001,
          dataType: 'CO2',
          unit: 'ppm',
          encoding: 'UNSIGNED',
        }),
      ]),
    });
  });

  it('rejects duplicate channel addresses', async () => {
    await expect(
      deviceConnectionsService.testConnection({
        ...modbusTcpPayload,
        channels: [
          ...modbusTcpPayload.channels,
          { ...modbusTcpPayload.channels[0], dataType: 'SO2' },
        ],
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('tests then stores a valid config', async () => {
    mockedRepository.create.mockResolvedValue(configDto());

    const result = await deviceConnectionsService.create(modbusTcpPayload, actorUserId);

    expect(mockedRepository.create).toHaveBeenCalledWith(modbusTcpPayload, actorUserId);
    expect(result.settings).toMatchObject({ hostIp: '192.168.1.10', port: 502 });
  });
});

function configDto(overrides: Partial<DeviceConnectionConfigDTO> = {}): DeviceConnectionConfigDTO {
  return {
    id: 1,
    stationId: 'STATION_001',
    protocol: DEVICE_CONNECTION_PROTOCOL.MODBUS_TCP,
    settings: { hostIp: '192.168.1.10', slaveId: 1, port: 502 },
    channels: [
      {
        addressId: 40001,
        dataType: 'CO2',
        unit: 'ppm',
        valueRange: { min: 0, max: 200 },
        valueFormat: 'MEASUREMENT_VALUE',
        offset: 0,
        encoding: 'UNSIGNED16_BIG_ENDIAN',
      },
    ],
    createdBy: 42,
    createdAt: '2026-05-27T10:00:00.000Z',
    updatedAt: '2026-05-27T10:00:00.000Z',
    ...overrides,
  };
}

function multiDeviceChannels(
  firstEncoding: CreateDeviceConnectionConfigInput['channels'][number]['encoding'],
  secondEncoding: CreateDeviceConnectionConfigInput['channels'][number]['encoding'],
): CreateDeviceConnectionConfigInput['channels'] {
  return [
    {
      addressId: 40001,
      dataType: 'CO2',
      unit: 'ppm',
      valueRange: { min: 0, max: 200 },
      valueFormat: 'MEASUREMENT_VALUE',
      offset: 0,
      encoding: firstEncoding,
    },
    {
      addressId: 40002,
      dataType: 'O2',
      unit: '%',
      valueRange: { min: 0, max: 25 },
      valueFormat: 'MEASUREMENT_VALUE',
      offset: -0.1,
      encoding: secondEncoding,
    },
  ];
}

function databaseMultiDeviceChannels(): CreateDeviceConnectionConfigInput['channels'] {
  return [
    {
      addressId: 40001,
      dataType: 'COD',
      unit: 'mg/L',
      offset: -0.5,
    },
    {
      addressId: 40002,
      dataType: 'BOD',
      unit: 'mg/L',
      offset: 0,
    },
  ];
}
