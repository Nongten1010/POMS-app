import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../../src/config/database', () => ({
  db: Object.assign(jest.fn(), { transaction: jest.fn() }),
}));

import { db } from '../../src/config/database';
import { eligibleFactoriesRepository } from '../../src/modules/eligible-factories/eligible-factories.repository';

const mockedDb = db as unknown as {
  transaction: jest.Mock<(...args: unknown[]) => Promise<unknown>>;
};

describe('eligibleFactoriesRepository.softDelete', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 409 and keeps eligibility active while the factory has active POMS rows', async () => {
    const eligibleLookup = makeChain(async () => ({ id: 17 }));
    const connectedLookup = makeChain(async () => ({ id: 55 }));
    const queues = new Map<string, unknown[]>([
      ['eligible_factories', [eligibleLookup]],
      ['cems_wpms_connected_measurement_points', [connectedLookup]],
    ]);
    const trx = Object.assign(
      jest.fn((tableName: string) => {
        const builder = queues.get(tableName)?.shift();
        if (!builder) throw new Error(`Unexpected mutation or query for ${tableName}`);
        return builder;
      }),
      { fn: { now: jest.fn(() => 'db-now') } },
    );
    mockedDb.transaction.mockImplementationOnce(async (...args: unknown[]) => {
      const callback = args[0] as (transaction: typeof trx) => Promise<unknown>;
      return callback(trx);
    });

    await expect(eligibleFactoriesRepository.softDelete(17, 42)).rejects.toMatchObject({
      statusCode: 409,
      details: { eligibleFactoryId: 17 },
    });
    expect(trx).toHaveBeenCalledTimes(2);
  });
});

function makeChain(first: () => Promise<unknown>) {
  const chain: Record<string, unknown> = {};
  const returnChain = jest.fn(() => chain);
  Object.assign(chain, {
    where: returnChain,
    whereNull: returnChain,
    forUpdate: returnChain,
    first: jest.fn(first),
  });
  return chain;
}
