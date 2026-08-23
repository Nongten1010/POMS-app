import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../../src/config/database', () => ({
  db: jest.fn(),
}));

import { db } from '../../src/config/database';
import { deviceConnectionsRepository } from '../../src/modules/device-connections/device-connections.repository';

const mockedDb = db as unknown as jest.Mock<(...args: unknown[]) => unknown>;

describe('deviceConnectionsRepository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('hydrates nullable config values without coercing them to zero or defaults', async () => {
    mockedDb.mockImplementation((tableName: unknown) => {
      if (tableName === 'device_connection_configs') {
        return rowsQuery([
          {
            id: '10',
            request_id: null,
            station_id: 'S0001',
            device_code: 'S0001/DB-01',
            protocol: 'MSSQL',
            settings_json: JSON.stringify({
              hostIp: null,
              dbPass: { nested: 'must-not-leak' },
              minuteTableName: 'measurements_1m',
              fiveMinuteTableName: 'measurements_5m',
              hourlyTableName: 'measurements_1h',
            }),
            status_management_json: null,
            created_by: '42',
            created_at: '2026-07-27T00:00:00.000Z',
            updated_at: '2026-07-27T00:00:00.000Z',
          },
        ]);
      }

      if (tableName === 'device_measurement_channels') {
        return rowsQuery([
          {
            address_id: null,
            data_type: 'NOx (ppm)',
            value_range_json: JSON.stringify({ min: null, max: 500 }),
            test_mode: true,
            alert_low: null,
            alert_high: null,
            value_format: null,
            offset_value: null,
            encoding: null,
            parameter_status: null,
          },
        ]);
      }

      throw new Error(`Unexpected table: ${String(tableName)}`);
    });

    const result = await deviceConnectionsRepository.list({
      stationId: 'S0001',
      protocol: 'MSSQL',
    });

    expect(result).toEqual([
      expect.objectContaining({
        settings: expect.objectContaining({
          hostIp: null,
          dbPass: '********',
          minuteTableName: 'measurements_1m',
          fiveMinuteTableName: 'measurements_5m',
          hourlyTableName: 'measurements_1h',
        }),
        channels: [
          {
            addressId: null,
            dataType: 'NOx (ppm)',
            valueRange: { min: null, max: 500 },
            testMode: true,
            alertLow: null,
            alertHigh: null,
            valueFormat: null,
            offset: null,
            encoding: null,
            status: null,
          },
        ],
      }),
    ]);
  });

  it('normalizes stored status schedule timestamps to local datetime strings', async () => {
    mockedDb.mockImplementation((tableName: unknown) => {
      if (tableName === 'device_connection_configs') {
        return rowsQuery([
          {
            id: '12',
            request_id: null,
            station_id: 'S0003',
            device_code: 'S0003/01',
            protocol: 'MODBUS_TCP',
            settings_json: JSON.stringify({}),
            status_management_json: JSON.stringify({
              selectedParameters: ['NOx (ppm)'],
              startAt: '2026-08-05T08:00:00+07:00',
              endAt: '2026-08-05T10:00:00+07:00',
              status: 'Maintenance',
              schedules: [
                {
                  selectedParameters: ['NOx (ppm)'],
                  startAt: '2026-08-05T08:00:00+07:00',
                  endAt: '2026-08-05T10:00:00+07:00',
                  status: 'Maintenance',
                },
              ],
            }),
            created_by: '42',
            created_at: '2026-07-31T00:00:00.000Z',
            updated_at: '2026-07-31T00:00:00.000Z',
          },
        ]);
      }

      if (tableName === 'device_measurement_channels') {
        return rowsQuery([]);
      }

      throw new Error(`Unexpected table: ${String(tableName)}`);
    });

    const [result] = await deviceConnectionsRepository.list({
      stationId: 'S0003',
      protocol: 'MODBUS_TCP',
    });

    expect(result.statusManagement).toEqual({
      selectedParameters: ['NOx (ppm)'],
      startAt: '2026-08-05 08:00:00',
      endAt: '2026-08-05 10:00:00',
      status: 'Maintenance',
      schedules: [
        {
          selectedParameters: ['NOx (ppm)'],
          startAt: '2026-08-05 08:00:00',
          endAt: '2026-08-05 10:00:00',
          status: 'Maintenance',
        },
      ],
    });
  });

  it('returns the stored database password only for the integration-specific reader', async () => {
    mockedDb.mockImplementation((tableName: unknown) => {
      if (tableName === 'device_connection_configs') {
        return rowsQuery([
          {
            id: '11',
            request_id: null,
            station_id: 'S0002',
            device_code: 'S0002/DB-01',
            protocol: 'MSSQL',
            settings_json: JSON.stringify({
              dbUser: 'integration_reader',
              dbPass: 'secret-pass',
              dbName: 'measurements',
            }),
            status_management_json: null,
            created_by: '42',
            created_at: '2026-07-31T00:00:00.000Z',
            updated_at: '2026-07-31T00:00:00.000Z',
          },
        ]);
      }

      if (tableName === 'device_measurement_channels') {
        return rowsQuery([]);
      }

      throw new Error(`Unexpected table: ${String(tableName)}`);
    });

    const [result] = await deviceConnectionsRepository.listActiveForIntegration({
      stationId: 'S0002',
      protocol: 'MSSQL',
    });

    expect(result.settings).toMatchObject({
      dbUser: 'integration_reader',
      dbPass: 'secret-pass',
      dbName: 'measurements',
    });
  });

  it('hydrates missing or false test mode values as false', async () => {
    mockedDb.mockImplementation((tableName: unknown) => {
      if (tableName === 'device_connection_configs') {
        return rowsQuery([
          {
            id: '13',
            request_id: null,
            station_id: 'S0004',
            device_code: 'S0004/01',
            protocol: 'MODBUS_TCP',
            settings_json: JSON.stringify({}),
            status_management_json: null,
            created_by: '42',
            created_at: '2026-08-01T00:00:00.000Z',
            updated_at: '2026-08-01T00:00:00.000Z',
          },
        ]);
      }

      if (tableName === 'device_measurement_channels') {
        return rowsQuery([
          {
            address_id: '40001',
            data_type: 'CO (ppm)',
            test_mode: 0,
            value_range_json: null,
            alert_low: null,
            alert_high: null,
            value_format: null,
            offset_value: '0',
            encoding: null,
            parameter_status: null,
          },
        ]);
      }

      throw new Error(`Unexpected table: ${String(tableName)}`);
    });

    const [result] = await deviceConnectionsRepository.list({
      stationId: 'S0004',
      protocol: 'MODBUS_TCP',
    });

    expect(result.channels[0]).toMatchObject({
      dataType: 'CO (ppm)',
      testMode: false,
    });
  });

  it('persists explicit and omitted testMode values for channel rows', async () => {
    const insertedChannels: Array<Record<string, unknown>> = [];
    let channelTableCall = 0;
    const configRow = {
      id: '99',
      request_id: null,
      station_id: 'S0099',
      device_code: 'S0099/01',
      protocol: 'MODBUS_TCP',
      settings_json: JSON.stringify({}),
      status_management_json: null,
      created_by: '42',
      created_at: '2026-08-23T00:00:00.000Z',
      updated_at: '2026-08-23T00:00:00.000Z',
    };
    const trx = jest.fn((tableName: unknown) => {
      if (tableName === 'device_connection_configs') {
        return {
          insert: jest.fn(() => ({
            returning: jest.fn().mockResolvedValue([{ id: '99' }] as never),
          })),
          where: jest.fn().mockReturnThis(),
          whereNull: jest.fn().mockReturnThis(),
          first: jest.fn().mockResolvedValue(configRow as never),
        };
      }

      if (tableName === 'device_measurement_channels') {
        channelTableCall += 1;
        if (channelTableCall === 1) {
          return {
            insert: jest.fn((rows: Array<Record<string, unknown>>) => {
              insertedChannels.push(...rows);
              return Promise.resolve();
            }),
          };
        }

        return rowsQuery(
          insertedChannels.map((row) => ({
            address_id: row.address_id,
            data_type: row.data_type,
            test_mode: row.test_mode,
            value_range_json: row.value_range_json,
            alert_low: row.alert_low,
            alert_high: row.alert_high,
            value_format: row.value_format,
            offset_value: row.offset_value,
            encoding: row.encoding,
            parameter_status: row.parameter_status,
          })),
        );
      }

      throw new Error(`Unexpected table: ${String(tableName)}`);
    });
    const transaction = jest.fn(async (callback: (executor: typeof trx) => Promise<unknown>) =>
      callback(trx),
    );
    Object.assign(mockedDb, { transaction });

    const result = await deviceConnectionsRepository.create(
      {
        stationId: 'S0099',
        deviceCode: 'S0099/01',
        protocol: 'MODBUS_TCP',
        settings: {},
        channels: [
          { addressId: 40001, dataType: 'CO (ppm)', testMode: true, offset: 0 },
          { addressId: 40002, dataType: 'NOx (ppm)', offset: 0 },
        ],
        statusManagement: null,
      },
      42,
    );

    expect(insertedChannels).toEqual([
      expect.objectContaining({ data_type: 'CO (ppm)', test_mode: true }),
      expect.objectContaining({ data_type: 'NOx (ppm)', test_mode: false }),
    ]);
    expect(result.channels.map((channel) => channel.testMode)).toEqual([true, false]);
  });
});

function rowsQuery(rows: unknown[]) {
  const chain: Record<string, unknown> = {};
  const returnChain = jest.fn(() => chain);
  Object.assign(chain, {
    where: returnChain,
    whereNull: returnChain,
    orderBy: returnChain,
    modify: jest.fn((callback: (builder: typeof chain) => void) => {
      callback(chain);
      return chain;
    }),
    then: (
      resolve: (value: unknown[]) => unknown,
      reject: (reason: unknown) => unknown,
    ): Promise<unknown> => Promise.resolve(rows).then(resolve, reject),
  });
  return chain;
}
