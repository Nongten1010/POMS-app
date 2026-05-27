import {
  DEVICE_CONNECTION_PROTOCOL,
  type DeviceConnectionConfigDTO,
} from './device-connections.types';

const mockTimestamp = '2026-05-27T00:00:00.000Z';
const mockStationId = 'STATION_001';

const station001MockConfig: DeviceConnectionConfigDTO = {
  id: 900001,
  stationId: mockStationId,
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
};

export function getMockDeviceConnectionConfigs(stationId: string): DeviceConnectionConfigDTO[] {
  if (stationId !== mockStationId) return [];
  return [station001MockConfig];
}

export function findMockDeviceConnectionConfig(id: number): DeviceConnectionConfigDTO | null {
  return id === station001MockConfig.id ? station001MockConfig : null;
}
