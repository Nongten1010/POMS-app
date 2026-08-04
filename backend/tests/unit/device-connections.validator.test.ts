import { describe, expect, it } from '@jest/globals';
import {
  createDeviceConnectionConfigRequestSchema,
  createDeviceConnectionConfigSchema,
} from '../../src/modules/device-connections/device-connections.validator';

describe('device connection validators', () => {
  it('accepts a POMS Box config with nullable settings and No Discharge status', () => {
    const result = createDeviceConnectionConfigSchema.safeParse({
      stationId: 'S1128',
      deviceCode: 'S1128/01',
      protocol: 'POMS_BOX',
      settings: null,
      channels: [
        {
          addressId: null,
          dataType: 'Flow rate (m3/hr)',
          offset: null,
          status: 'No Discharge',
        },
      ],
      statusManagement: {
        selectedParameters: ['Flow rate (m3/hr)'],
        startAt: null,
        endAt: null,
        status: null,
        schedules: [
          {
            selectedParameters: ['Flow rate (m3/hr)'],
            startAt: '2026-08-05T08:00:00+07:00',
            endAt: '2026-08-05T10:00:00+07:00',
            status: 'No Discharge',
          },
        ],
      },
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toMatchObject({
        stationId: 'S1128',
        deviceCode: 'S1128/01',
        protocol: 'POMS_BOX',
        settings: {},
        channels: [{ status: 'No Discharge' }],
        statusManagement: {
          schedules: [
            {
              startAt: '2026-08-05 08:00:00',
              endAt: '2026-08-05 10:00:00',
              status: 'No Discharge',
            },
          ],
        },
      });
    }
  });

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

  it('normalizes legacy UTC schedule timestamps to Bangkok local datetime strings', () => {
    const result = createDeviceConnectionConfigSchema.safeParse({
      stationId: 'STATION_UTC',
      protocol: 'MODBUS_TCP',
      settings: {},
      channels: [],
      statusManagement: {
        schedules: [
          {
            selectedParameters: ['CO (ppm)'],
            startAt: '2026-08-05T01:00:00Z',
            endAt: '2026-08-05T03:00:00Z',
            status: 'Maintenance',
          },
        ],
      },
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.statusManagement?.schedules[0]).toMatchObject({
        startAt: '2026-08-05 08:00:00',
        endAt: '2026-08-05 10:00:00',
      });
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

    if (!result.success) {
      throw new Error(JSON.stringify(result.error.issues));
    }
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.channels[0]).toMatchObject({
        alertLow: 80,
        alertHigh: 400,
      });
    }
  });

  it('does not validate alert threshold order in device config payloads', () => {
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

    expect(result.success).toBe(true);
  });

  it('accepts nullable Modbus channel values without config-form validation', () => {
    const result = createDeviceConnectionConfigSchema.safeParse({
      stationId: 'STATION_001',
      protocol: 'MODBUS_TCP',
      settings: {
        hostIp: null,
        slaveId: null,
        port: null,
        valueRange: {
          min: null,
          max: null,
        },
      },
      channels: [
        {
          addressId: null,
          dataType: 'CO2',
          unit: 'ppm',
          valueRange: null,
          alertLow: null,
          alertHigh: null,
          valueFormat: null,
          offset: null,
          encoding: null,
          status: null,
        },
      ],
    });

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({
      settings: {
        hostIp: null,
        slaveId: null,
        port: null,
        valueRange: {
          min: null,
          max: null,
        },
      },
      channels: [
        {
          addressId: null,
          dataType: 'CO2 (ppm)',
          valueRange: null,
          alertLow: null,
          alertHigh: null,
          valueFormat: null,
          offset: null,
          encoding: null,
          status: null,
        },
      ],
    });
  });

  it.each(['POMS_BOX', 'MODBUS_RTU', 'MODBUS_TCP', 'MSSQL', 'MYSQL'] as const)(
    'accepts empty settings and channels for %s',
    (protocol) => {
      const result = createDeviceConnectionConfigSchema.safeParse({
        stationId: 'STATION_001',
        protocol,
        settings: {},
        channels: [],
      });

      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        stationId: 'STATION_001',
        protocol,
        settings: {},
        channels: [],
      });
    },
  );

  it('defaults omitted or null settings and channels without config-form validation', () => {
    const omitted = createDeviceConnectionConfigSchema.safeParse({
      stationId: 'STATION_001',
      protocol: 'MYSQL',
    });
    const nullable = createDeviceConnectionConfigSchema.safeParse({
      stationId: 'STATION_001',
      protocol: 'MSSQL',
      settings: null,
      channels: null,
    });

    expect(omitted.success).toBe(true);
    expect(nullable.success).toBe(true);
    if (omitted.success) {
      expect(omitted.data).toMatchObject({ settings: {}, channels: [] });
    }
    if (nullable.success) {
      expect(nullable.data).toMatchObject({ settings: {}, channels: [] });
    }
  });

  it('rejects malformed container types while allowing nullable form values', () => {
    const invalidSettings = createDeviceConnectionConfigSchema.safeParse({
      stationId: 'STATION_001',
      protocol: 'MYSQL',
      settings: 'not-an-object',
      channels: [],
    });
    const invalidChannels = createDeviceConnectionConfigSchema.safeParse({
      stationId: 'STATION_001',
      protocol: 'MYSQL',
      settings: {},
      channels: {},
    });
    const invalidStatusManagement = createDeviceConnectionConfigSchema.safeParse({
      stationId: 'STATION_001',
      protocol: 'MYSQL',
      settings: {},
      channels: [],
      statusManagement: 'not-an-object',
    });
    const invalidStatusScheduleContainer = createDeviceConnectionConfigSchema.safeParse({
      stationId: 'STATION_001',
      protocol: 'MYSQL',
      settings: {},
      channels: [],
      statusManagement: {
        selectedParameters: [],
        status: 'Normal',
        schedules: {},
      },
    });

    expect(invalidSettings.success).toBe(false);
    expect(invalidChannels.success).toBe(false);
    expect(invalidStatusManagement.success).toBe(false);
    expect(invalidStatusScheduleContainer.success).toBe(false);
  });

  it('accepts nullable status-management fields from the config form', () => {
    const result = createDeviceConnectionConfigSchema.safeParse({
      stationId: 'STATION_001',
      protocol: 'MYSQL',
      settings: {},
      channels: [],
      statusManagement: {
        selectedParameters: null,
        startAt: null,
        endAt: null,
        status: null,
        schedules: [],
      },
    });

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({
      statusManagement: null,
    });
  });

  it('accepts database config without requiring connection values', () => {
    const result = createDeviceConnectionConfigSchema.safeParse({
      stationId: 'STATION_001',
      protocol: 'MSSQL',
      settings: {
        hostIp: null,
        port: null,
        dbUser: null,
        dbPass: null,
        dbName: null,
        minuteTableName: null,
        fiveMinuteTableName: null,
        hourlyTableName: null,
        valueRange: null,
      },
      channels: [],
    });

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({
      settings: {
        hostIp: null,
        port: null,
        dbUser: null,
        dbPass: null,
        dbName: null,
        minuteTableName: null,
        fiveMinuteTableName: null,
        hourlyTableName: null,
        valueRange: null,
      },
      channels: [],
    });
  });

  it('accepts database channels with optional measurement metadata', () => {
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

    expect(result.success).toBe(true);
    expect(result.data?.channels[0]).toMatchObject({
      dataType: 'COD (mg/L)',
      valueRange: { min: 0, max: 200 },
      valueFormat: 'MEASUREMENT_VALUE',
      encoding: 'UNSIGNED',
    });
  });

  it('does not validate config-specific formats or reject extra config fields', () => {
    const result = createDeviceConnectionConfigSchema.safeParse({
      stationId: 'STATION_001',
      protocol: 'MYSQL',
      settings: {
        hostIp: 'not-an-ip',
        port: -1,
        dbUser: 'sensor_user',
        dbPass: 'secret-pass',
        dbName: 'sensor_db',
        futureConfigField: 'accepted',
      },
      channels: [
        {
          addressId: -99,
          dataType: 'COD',
          unit: 'mg/L',
          offset: 0,
          futureChannelField: 'accepted',
        },
      ],
    });

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({
      settings: {
        hostIp: 'not-an-ip',
        port: -1,
        futureConfigField: 'accepted',
      },
      channels: [
        {
          addressId: -99,
          dataType: 'COD (mg/L)',
          futureChannelField: 'accepted',
        },
      ],
    });
  });
});
