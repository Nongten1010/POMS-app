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
