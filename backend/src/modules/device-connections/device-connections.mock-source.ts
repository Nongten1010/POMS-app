import {
  DEVICE_CONNECTION_PROTOCOL,
  type DeviceConnectionConfigDTO,
} from './device-connections.types';

const mockTimestamp = '2026-05-27T00:00:00.000Z';

export function getMockDeviceConnectionConfigs(stationId: string): DeviceConnectionConfigDTO[] {
  if (stationId !== 'STATION_001') return [];

  return [
    {
      id: 900001,
      stationId,
      protocol: DEVICE_CONNECTION_PROTOCOL.MODBUS_RTU,
      settings: {
        comPort: 1,
        slaveId: 1,
        baudRate: 9600,
        parity: 'NONE',
        stopBits: 1,
        dataBits: 8,
        valueRange: { min: 0, max: 200 },
        quantity: 2,
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
      createdBy: 0,
      createdAt: mockTimestamp,
      updatedAt: mockTimestamp,
    },
    {
      id: 900002,
      stationId,
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
        {
          addressId: 40002,
          dataType: 'O2',
          unit: '%',
          valueRange: { min: 0, max: 25 },
          valueFormat: 'MEASUREMENT_VALUE',
          offset: -0.1,
          encoding: 'SIGNED16_BIG_ENDIAN',
        },
      ],
      createdBy: 0,
      createdAt: mockTimestamp,
      updatedAt: mockTimestamp,
    },
    {
      id: 900003,
      stationId,
      protocol: DEVICE_CONNECTION_PROTOCOL.MSSQL,
      settings: {
        hostIp: '192.168.1.254',
        port: 1433,
        dbUser: 'sensor_user',
        dbPass: '********',
        dbName: 'sensor_db',
      },
      channels: [
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
      ],
      createdBy: 0,
      createdAt: mockTimestamp,
      updatedAt: mockTimestamp,
    },
    {
      id: 900004,
      stationId,
      protocol: DEVICE_CONNECTION_PROTOCOL.MYSQL,
      settings: {
        hostIp: '192.168.1.254',
        port: 3306,
        dbUser: 'sensor_user',
        dbPass: '********',
        dbName: 'sensor_db',
      },
      channels: [
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
      ],
      createdBy: 0,
      createdAt: mockTimestamp,
      updatedAt: mockTimestamp,
    },
  ];
}

export function findMockDeviceConnectionConfig(id: number): DeviceConnectionConfigDTO | null {
  return getMockDeviceConnectionConfigs('STATION_001').find((config) => config.id === id) ?? null;
}
