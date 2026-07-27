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
