import { describe, expect, it } from '@jest/globals';
import {
  createDeviceConnectionConfigRequestSchema,
  createDeviceConnectionConfigSchema,
} from '../../src/modules/device-connections/device-connections.validator';

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
    if (result.success) {
      expect(result.data.channels[0]).toMatchObject({
        dataType: 'CO2 (ppm)',
      });
      expect(result.data.channels[0]).not.toHaveProperty('unit');
    }
  });

  it('preserves the full parameter name when the unit is already in dataType', () => {
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
        quantity: 1,
      },
      channels: [
        {
          addressId: 40001,
          dataType: 'CO2 (%)',
          valueRange: { min: 0, max: 200 },
          valueFormat: 'MEASUREMENT_VALUE',
          offset: 0,
          encoding: 'SIGNED16_BIG_ENDIAN',
          status: 'Start up',
        },
      ],
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.channels[0]).toMatchObject({
        dataType: 'CO2 (%)',
      });
      expect(result.data.channels[0]).not.toHaveProperty('unit');
    }
  });

  it('accepts structured config payload with shared station and flat channels', () => {
    const result = createDeviceConnectionConfigRequestSchema.safeParse({
      config: {
        stationId: 'S0001',
        device: [
          {
            deviceCode: 'S0001/01',
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
          },
          {
            deviceCode: 'S0001/02',
            protocol: 'MODBUS_RTU',
            settings: {
              comPort: 1,
              slaveId: 1,
              baudRate: 9600,
              parity: 'NONE',
              stopBits: 1,
              dataBits: 8,
              quantity: 1,
              valueRange: { min: 0, max: 180 },
            },
          },
        ],
        channels: [
          {
            deviceCode: 'S0001/01',
            addressId: 40001,
            dataType: 'CO2 (%)',
            valueRange: { min: 20, max: 200 },
            valueFormat: 'MEASUREMENT_VALUE',
            offset: 1,
            encoding: 'SIGNED16_BIG_ENDIAN',
            status: 'Start up',
          },
          {
            deviceCode: 'S0001/02',
            addressId: 40002,
            dataType: 'CO2 (ppm)',
            valueRange: { min: 0, max: 180 },
            valueFormat: 'MEASUREMENT_VALUE',
            offset: 1,
            encoding: 'SIGNED16_BIG_ENDIAN',
            status: 'Start up',
          },
        ],
        statusManagement: {
          selectedParameters: ['ทั้งหมด'],
          startAt: null,
          endAt: null,
          status: 'Normal',
          schedules: [],
        },
      },
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toMatchObject({
        configs: [
          {
            stationId: 'S0001',
            deviceCode: 'S0001/01',
            protocol: 'MODBUS_RTU',
            settings: { valueRange: { min: 20, max: 200 } },
            channels: [
              {
                addressId: 40001,
                dataType: 'CO2 (%)',
              },
            ],
            statusManagement: { status: 'Normal' },
          },
          {
            stationId: 'S0001',
            deviceCode: 'S0001/02',
            protocol: 'MODBUS_RTU',
            settings: { valueRange: { min: 0, max: 180 } },
            channels: [
              {
                addressId: 40002,
                dataType: 'CO2 (ppm)',
              },
            ],
            statusManagement: { status: 'Normal' },
          },
        ],
      });
    }
  });

  it('accepts the legacy Modbus RTU device setup form payload', () => {
    const result = createDeviceConnectionConfigSchema.safeParse({
      stationId: 'SO001',
      connection: 'Modbus RTU',
      deviceCode: 'SO001/01',
      COMPORT: '1',
      slaveID: '1',
      baudRate: '9600 (default)',
      parity: 'None (default)',
      stopBits: '1 (default)',
      dataBits: '8 (default)',
      measurementMin: '0',
      measurementMax: '200',
      quantity: '1',
      selectedParameters: 'ทั้งหมด',
      startAt: null,
      endAt: null,
      status: 'Normal',
      channels: [
        {
          addressID: '40001',
          parameter: 'NOx (ppm)',
          min: '0',
          max: '200',
          format: 'ค่าข้อมูลตรวจวัด',
          offset: '0',
          encodingData: 'Signed16 - Big Endian',
        },
      ],
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toMatchObject({
        stationId: 'SO001',
        deviceCode: 'SO001/01',
        protocol: 'MODBUS_RTU',
        settings: {
          comPort: 1,
          slaveId: 1,
          baudRate: 9600,
          parity: 'NONE',
          stopBits: 1,
          dataBits: 8,
          quantity: 1,
          valueRange: { min: 0, max: 200 },
        },
        channels: [
          {
            addressId: 40001,
            dataType: 'NOx (ppm)',
            valueRange: { min: 0, max: 200 },
            valueFormat: 'MEASUREMENT_VALUE',
            offset: 0,
            encoding: 'SIGNED16_BIG_ENDIAN',
          },
        ],
        statusManagement: {
          selectedParameters: ['ทั้งหมด'],
          startAt: null,
          endAt: null,
          status: 'Normal',
          schedules: [],
        },
      });
    }
  });

  it('accepts optional status management for config form prefill', () => {
    const result = createDeviceConnectionConfigSchema.safeParse({
      stationId: 'STATION_001',
      deviceCode: 'STATION_001/01',
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
          valueRange: { min: 0, max: 200 },
          valueFormat: 'MEASUREMENT_VALUE',
          offset: 0,
          encoding: 'UNSIGNED16_BIG_ENDIAN',
          status: 'Maintenance',
        },
      ],
      statusManagement: {
        selectedParameters: ['ทั้งหมด'],
        startAt: null,
        endAt: null,
        status: 'Normal',
        schedules: [],
      },
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.deviceCode).toBe('STATION_001/01');
      expect(result.data.channels[0].status).toBe('Maintenance');
      expect(result.data.statusManagement?.status).toBe('Normal');
    }
  });

  it('accepts optional alert thresholds on Modbus channels', () => {
    const result = createDeviceConnectionConfigSchema.safeParse({
      stationId: 'STATION_001',
      deviceCode: 'STATION_001/01',
      protocol: 'MODBUS_TCP',
      settings: {
        hostIp: '192.168.1.10',
        slaveId: 1,
        port: 502,
      },
      channels: [
        {
          addressId: 40001,
          dataType: 'CO',
          unit: 'ppm',
          valueRange: { min: 0, max: 500 },
          alertLow: 80,
          alertHigh: 400,
          valueFormat: 'MEASUREMENT_VALUE',
          offset: 0,
          encoding: 'UNSIGNED16_BIG_ENDIAN',
        },
      ],
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.channels[0]).toMatchObject({
        dataType: 'CO (ppm)',
        alertLow: 80,
        alertHigh: 400,
      });
    }
  });

  it('accepts Modbus TCP request config channels without optional value ranges', () => {
    const result = createDeviceConnectionConfigRequestSchema.safeParse({
      stationId: 'P0001',
      deviceCode: 'P0001/01',
      protocol: 'MODBUS_TCP',
      settings: {
        hostIp: '127.0.0.1',
        slaveId: 20,
        port: 443,
      },
      channels: [
        {
          addressId: 40001,
          dataType: 'COD (mg/l)',
          valueRange: { min: 0, max: 200 },
          alertLow: 0,
          alertHigh: 100,
          valueFormat: 'MEASUREMENT_VALUE',
          offset: 1,
          encoding: 'UNSIGNED16_BIG_ENDIAN',
          status: 'Normal',
        },
        {
          addressId: 40002,
          dataType: 'Flow rate (m3/hr)',
          valueFormat: 'MEASUREMENT_VALUE',
          offset: 1,
          encoding: 'UNSIGNED16_BIG_ENDIAN',
          status: 'Normal',
        },
        {
          addressId: 40003,
          dataType: 'Watt (kW/hr)',
          valueFormat: 'MEASUREMENT_VALUE',
          offset: 1,
          encoding: 'UNSIGNED16_BIG_ENDIAN',
          status: 'Normal',
        },
      ],
      statusManagement: {
        selectedParameters: ['ทั้งหมด'],
        startAt: null,
        endAt: null,
        status: 'Normal',
        schedules: [],
      },
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toMatchObject({
        stationId: 'P0001',
        deviceCode: 'P0001/01',
        protocol: 'MODBUS_TCP',
        channels: [
          { addressId: 40001, valueRange: { min: 0, max: 200 } },
          { addressId: 40002, valueRange: null },
          { addressId: 40003, valueRange: null },
        ],
      });
    }
  });

  it('normalizes legacy alert threshold fields from device setup forms', () => {
    const result = createDeviceConnectionConfigSchema.safeParse({
      stationId: 'SO001',
      connection: 'Modbus RTU',
      deviceCode: 'SO001/01',
      COMPORT: '1',
      slaveID: '1',
      baudRate: '9600 (default)',
      parity: 'None (default)',
      stopBits: '1 (default)',
      dataBits: '8 (default)',
      measurementMin: '0',
      measurementMax: '500',
      quantity: '1',
      channels: [
        {
          addressID: '40001',
          parameter: 'CO (ppm)',
          min: '0',
          max: '500',
          alertLow: '80',
          alertHigh: '400',
          format: 'ค่าข้อมูลตรวจวัด',
          offset: '0',
          encodingData: 'Signed16 - Big Endian',
        },
      ],
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.channels[0]).toMatchObject({
        alertLow: 80,
        alertHigh: 400,
      });
    }
  });

  it('rejects inverted alert thresholds', () => {
    const result = createDeviceConnectionConfigSchema.safeParse({
      stationId: 'STATION_001',
      deviceCode: 'STATION_001/01',
      protocol: 'MODBUS_TCP',
      settings: {
        hostIp: '192.168.1.10',
        slaveId: 1,
        port: 502,
      },
      channels: [
        {
          addressId: 40001,
          dataType: 'CO',
          unit: 'ppm',
          valueRange: { min: 0, max: 500 },
          alertLow: 400,
          alertHigh: 80,
          valueFormat: 'MEASUREMENT_VALUE',
          offset: 0,
          encoding: 'UNSIGNED16_BIG_ENDIAN',
        },
      ],
    });

    expect(result.success).toBe(false);
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
