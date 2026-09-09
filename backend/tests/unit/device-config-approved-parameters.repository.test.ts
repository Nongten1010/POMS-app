import { describe, expect, it, jest } from '@jest/globals';
jest.mock('../../src/config/database', () => ({ db: { transaction: jest.fn() } }));
import { db } from '../../src/config/database';
import { deviceConnectionsRepository } from '../../src/modules/device-connections/device-connections.repository';

describe('current device configuration transaction guard', () => {
  it('rejects a stale COD channel after concurrent parameter approval before deleting configs', async () => {
    const queries: string[] = [];
    const forUpdate = jest.fn();
    const trx = (table: string) => {
      queries.push(table);
      const chain = {
        where: () => chain,
        whereNull: () => chain,
        forUpdate: () => {
          forUpdate();
          return chain;
        },
        select: async () => [
          { parameters_json: JSON.stringify(['BOD (mg/l)', 'Watt (kW/hr)', 'Flow rate (m3/hr)']) },
        ],
      };
      return chain;
    };
    (
      db.transaction as unknown as jest.Mock<
        (callback: (value: typeof trx) => Promise<unknown>) => Promise<unknown>
      >
    ).mockImplementation(async (callback) => callback(trx));
    await expect(
      deviceConnectionsRepository.replaceManyActiveForStation(
        'P0260',
        [
          {
            stationId: 'P0260',
            deviceCode: 'P0260/01',
            protocol: 'MODBUS_RTU',
            settings: {},
            channels: [{ dataType: 'COD (mg/l)', addressId: 2, offset: 0 }],
          },
        ],
        42,
      ),
    ).rejects.toMatchObject({ code: 'CONFLICT', details: { invalidParameters: ['COD (mg/l)'] } });
    expect(forUpdate).toHaveBeenCalledTimes(1);
    expect(queries).toEqual(['cems_wpms_connected_measurement_points']);
  });
});
