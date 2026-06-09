import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../../src/modules/device-connections/device-connections.repository', () => ({
  deviceConnectionsRepository: {
    create: jest.fn(),
    createMany: jest.fn(),
    existsByStationIdProtocolAndDeviceCode: jest.fn(),
    findActiveByStationIdProtocolAndDeviceCode: jest.fn(),
    findById: jest.fn(),
    list: jest.fn(),
    listByRequestId: jest.fn(),
    replaceActive: jest.fn(),
    replaceManyActive: jest.fn(),
    replaceManyActiveForStation: jest.fn(),
    replaceManyForRequest: jest.fn(),
    replaceManyForRequestAndActiveSettings: jest.fn(),
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
    mockedRepository.existsByStationIdProtocolAndDeviceCode.mockResolvedValue(false);
    mockedRepository.findActiveByStationIdProtocolAndDeviceCode.mockResolvedValue(null);
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

  it('tests then stores a valid active setting', async () => {
    mockedRepository.replaceActive.mockResolvedValue(configDto({ requestId: null }));

    const result = await deviceConnectionsService.create(modbusTcpPayload, actorUserId);

    expect(mockedRepository.replaceActive).toHaveBeenCalledWith(modbusTcpPayload, actorUserId);
    expect(result.settings).toMatchObject({ hostIp: '192.168.1.10', port: 502 });
  });

  it('replaces an existing active setting without touching request snapshots', async () => {
    const input: CreateDeviceConnectionConfigInput = {
      ...modbusTcpPayload,
      deviceCode: 'STATION_001/01',
    };
    mockedRepository.replaceActive.mockResolvedValue(
      configDto({ id: 20, requestId: null, deviceCode: input.deviceCode }),
    );

    const result = await deviceConnectionsService.create(input, actorUserId);

    expect(mockedRepository.replaceActive).toHaveBeenCalledWith(input, actorUserId);
    expect(result).toMatchObject({ id: 20, requestId: null, deviceCode: 'STATION_001/01' });
    expect(mockedRepository.replaceManyForRequest).not.toHaveBeenCalled();
  });

  it('stores multiple active settings in one repository call', async () => {
    const inputs: CreateDeviceConnectionConfigInput[] = [
      { ...modbusTcpPayload, deviceCode: 'STATION_001/01' },
      { ...modbusTcpPayload, deviceCode: 'STATION_001/02' },
    ];
    mockedRepository.replaceManyActive.mockResolvedValue([
      configDto({ requestId: null, deviceCode: 'STATION_001/01' }),
      configDto({ requestId: null, id: 2, deviceCode: 'STATION_001/02' }),
    ]);

    const result = await deviceConnectionsService.createMany(inputs, actorUserId);

    expect(mockedRepository.replaceManyActive).toHaveBeenCalledWith(inputs, actorUserId);
    expect(result).toHaveLength(2);
    expect(mockedRepository.replaceManyForRequestAndActiveSettings).not.toHaveBeenCalled();
  });

  it('replaces all current active settings for a station in one repository call', async () => {
    const inputs: CreateDeviceConnectionConfigInput[] = [
      { ...modbusTcpPayload, deviceCode: 'STATION_001/02' },
    ];
    mockedRepository.replaceManyActiveForStation.mockResolvedValue([
      configDto({ requestId: null, deviceCode: 'STATION_001/02' }),
    ]);

    const result = await deviceConnectionsService.replaceCurrentStation(
      'STATION_001',
      inputs,
      actorUserId,
    );

    expect(mockedRepository.replaceManyActiveForStation).toHaveBeenCalledWith(
      'STATION_001',
      inputs,
      actorUserId,
    );
    expect(result).toHaveLength(1);
    expect(mockedRepository.replaceManyActive).not.toHaveBeenCalled();
  });

  it('allows the same station and protocol to store a different deviceCode', async () => {
    const input: CreateDeviceConnectionConfigInput = {
      ...modbusTcpPayload,
      deviceCode: 'STATION_001/02',
    };
    mockedRepository.replaceActive.mockResolvedValue(
      configDto({ requestId: null, deviceCode: input.deviceCode }),
    );

    await deviceConnectionsService.create(input, actorUserId);

    expect(mockedRepository.replaceActive).toHaveBeenCalledWith(input, actorUserId);
  });

  it('allows the same station to store different protocols', async () => {
    mockedRepository.replaceActive.mockResolvedValue(
      configDto({ requestId: null, protocol: DEVICE_CONNECTION_PROTOCOL.MODBUS_RTU }),
    );

    const input: CreateDeviceConnectionConfigInput = {
      stationId: 'STATION_001',
      protocol: DEVICE_CONNECTION_PROTOCOL.MODBUS_RTU,
      settings: {
        comPort: 1,
        slaveId: 1,
        baudRate: 9600,
        parity: 'NONE',
        stopBits: 1,
        dataBits: 8,
        quantity: 1,
        valueRange: null,
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

    await deviceConnectionsService.create(input, actorUserId);

    expect(mockedRepository.replaceActive).toHaveBeenCalledWith(input, actorUserId);
  });

  it('stores a request snapshot and a separate active setting for connection requests', async () => {
    mockedRepository.replaceManyForRequestAndActiveSettings.mockResolvedValue([
      configDto({ requestId: 99 }),
    ]);

    const result = await deviceConnectionsService.createForRequest(
      modbusTcpPayload,
      actorUserId,
      99,
    );

    expect(mockedRepository.replaceManyForRequestAndActiveSettings).toHaveBeenCalledWith(
      [modbusTcpPayload],
      actorUserId,
      99,
    );
    expect(result.requestId).toBe(99);
  });

  it('replaces only the same request snapshot when saving the same device key again', async () => {
    const input: CreateDeviceConnectionConfigInput = {
      ...modbusTcpPayload,
      deviceCode: 'STATION_001/01',
    };
    mockedRepository.replaceManyForRequestAndActiveSettings.mockResolvedValue([
      configDto({ requestId: 99, id: 11, deviceCode: 'STATION_001/01' }),
    ]);

    const result = await deviceConnectionsService.createForRequest(input, actorUserId, 99);

    expect(mockedRepository.replaceManyForRequestAndActiveSettings).toHaveBeenCalledWith(
      [input],
      actorUserId,
      99,
    );
    expect(result.id).toBe(11);
  });

  it('allows a later request to create its own snapshot without overwriting earlier request snapshots', async () => {
    const input: CreateDeviceConnectionConfigInput = {
      ...modbusTcpPayload,
      deviceCode: 'STATION_001/01',
    };
    mockedRepository.replaceManyForRequestAndActiveSettings.mockResolvedValue([
      configDto({ requestId: 99, id: 12, deviceCode: 'STATION_001/01' }),
    ]);

    await deviceConnectionsService.createForRequest(input, actorUserId, 99);

    expect(mockedRepository.replaceManyForRequestAndActiveSettings).toHaveBeenCalledWith(
      [input],
      actorUserId,
      99,
    );
  });

  it('stores multiple configs linked to a connection request in one repository call', async () => {
    const inputs: CreateDeviceConnectionConfigInput[] = [
      { ...modbusTcpPayload, deviceCode: 'STATION_001/01' },
      { ...modbusTcpPayload, deviceCode: 'STATION_001/02' },
    ];
    mockedRepository.replaceManyForRequestAndActiveSettings.mockResolvedValue([
      configDto({ requestId: 99, deviceCode: 'STATION_001/01' }),
      configDto({ requestId: 99, id: 2, deviceCode: 'STATION_001/02' }),
    ]);

    const result = await deviceConnectionsService.createManyForRequest(inputs, actorUserId, 99);

    expect(mockedRepository.replaceManyForRequestAndActiveSettings).toHaveBeenCalledWith(
      inputs,
      actorUserId,
      99,
    );
    expect(result).toHaveLength(2);
  });

  it('rejects duplicate station, protocol, and deviceCode within a batch payload', async () => {
    const inputs: CreateDeviceConnectionConfigInput[] = [
      { ...modbusTcpPayload, deviceCode: 'STATION_001/01' },
      { ...modbusTcpPayload, deviceCode: 'STATION_001/01' },
    ];

    await expect(
      deviceConnectionsService.createManyForRequest(inputs, actorUserId, 99),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(mockedRepository.replaceManyForRequest).not.toHaveBeenCalled();
  });

  it('lists configs linked to a connection request', async () => {
    mockedRepository.listByRequestId.mockResolvedValue([configDto({ requestId: 99 })]);

    const result = await deviceConnectionsService.listByRequestId(99);

    expect(mockedRepository.listByRequestId).toHaveBeenCalledWith(99);
    expect(result[0].requestId).toBe(99);
  });
});

function configDto(overrides: Partial<DeviceConnectionConfigDTO> = {}): DeviceConnectionConfigDTO {
  return {
    id: 1,
    requestId: null,
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
    statusManagement: null,
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
