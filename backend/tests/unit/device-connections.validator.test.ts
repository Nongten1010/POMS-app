import { describe, expect, it } from '@jest/globals';
import { createDeviceConnectionConfigSchema } from '../../src/modules/device-connections/device-connections.validator';

describe('device connection validators', () => {
  it('accepts a valid Modbus RTU mock config', () => {
    const result = createDeviceConnectionConfigSchema.safeParse({
      stationId: 'STATION_001',
      protocol: 'MODBUS_RTU',
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
          encoding: 'UNSIGNED16_BIG_ENDIAN',
        },
      ],
    });

    expect(result.success).toBe(true);
  });

  it('rejects Modbus channels without address ranges and encoding', () => {
    const result = createDeviceConnectionConfigSchema.safeParse({
      stationId: 'STATION_001',
      protocol: 'MODBUS_TCP',
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
          offset: 0,
        },
      ],
    });

    expect(result.success).toBe(false);
  });

  it('accepts database config and keeps dbPass required on input', () => {
    const result = createDeviceConnectionConfigSchema.safeParse({
      stationId: 'STATION_001',
      protocol: 'MSSQL',
      settings: {
        hostIp: '192.168.1.254',
        port: 1433,
        dbUser: 'sensor_user',
        dbPass: 'secret-pass',
        dbName: 'sensor_db',
      },
      channels: [
        {
          addressId: 40001,
          dataType: 'COD',
          unit: 'mg/L',
          offset: -0.5,
        },
      ],
    });

    expect(result.success).toBe(true);
  });

  it('rejects database-only channels that include Modbus fields', () => {
    const result = createDeviceConnectionConfigSchema.safeParse({
      stationId: 'STATION_001',
      protocol: 'MYSQL',
      settings: {
        hostIp: '192.168.1.254',
        port: 3306,
        dbUser: 'sensor_user',
        dbPass: 'secret-pass',
        dbName: 'sensor_db',
      },
      channels: [
        {
          addressId: 40001,
          dataType: 'COD',
          unit: 'mg/L',
          valueRange: { min: 0, max: 200 },
          valueFormat: 'MEASUREMENT_VALUE',
          offset: 0,
          encoding: 'UNSIGNED',
        },
      ],
    });

    expect(result.success).toBe(false);
  });

  it('rejects unknown fields and invalid IPs', () => {
    const result = createDeviceConnectionConfigSchema.safeParse({
      stationId: 'STATION_001',
      protocol: 'MYSQL',
      settings: {
        hostIp: 'not-an-ip',
        port: 3306,
        dbUser: 'sensor_user',
        dbPass: 'secret-pass',
        dbName: 'sensor_db',
      },
      channels: [{ addressId: 40001, dataType: 'COD', unit: 'mg/L', offset: 0 }],
      rawSql: 'DROP TABLE device_connection_configs',
    });

    expect(result.success).toBe(false);
  });
});
