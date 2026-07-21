import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../../src/config/database', () => ({
  db: Object.assign(jest.fn(), {
    transaction: jest.fn(),
  }),
}));

import { db } from '../../src/config/database';
import { connectionRequestsRepository } from '../../src/modules/connection-requests/connection-requests.repository';

const mockedDb = db as unknown as {
  transaction: jest.Mock<(...args: unknown[]) => Promise<unknown>>;
};

describe('connectionRequestsRepository.connect', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 409 and performs no mutation when eligibility was removed before connection', async () => {
    const requestLookup = makeChain({
      first: async () => ({
        id: 91,
        status: 'CONNECTION_CONFIRMED',
        eligible_factory_id: 17,
      }),
    });
    const eligibleLookup = makeChain({ first: async () => undefined });
    const queues = new Map<string, unknown[]>([
      ['cems_wpms_connection_requests', [requestLookup]],
      ['eligible_factories', [eligibleLookup]],
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

    await expect(
      connectionRequestsRepository.connect(91, 7, {
        verifiedAt: '2026-07-21T05:00:00.000Z',
        officerNote: null,
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
      details: { eligibleFactoryId: 17 },
    });

    expect(trx).toHaveBeenCalledTimes(2);
    expect([...queues.values()].every((queue) => queue.length === 0)).toBe(true);
  });
});

function makeChain(options: { first: () => Promise<unknown> }) {
  const chain: Record<string, unknown> = {};
  const returnChain = jest.fn(() => chain);
  Object.assign(chain, {
    where: returnChain,
    whereNull: returnChain,
    forUpdate: returnChain,
    first: jest.fn(options.first),
  });
  return chain;
}
