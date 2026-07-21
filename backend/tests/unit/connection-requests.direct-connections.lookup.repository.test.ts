import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../../src/config/database', () => ({
  db: jest.fn(),
}));

import { db } from '../../src/config/database';
import { connectionRequestsRepository } from '../../src/modules/connection-requests/connection-requests.repository';

const mockedDb = db as unknown as jest.Mock<(...args: unknown[]) => unknown>;

describe('connectionRequestsRepository.findDirectConnectionFactory', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('maps the active eligible row to canonical direct-connection identity', async () => {
    mockedDb.mockReturnValue(
      queryChain({
        eligible_factory_id: '17',
        factory_registration_no_new: '10120000325542',
        factory_name: 'บริษัท โรงงานตัวอย่าง จำกัด',
      }),
    );

    const result = await connectionRequestsRepository.findDirectConnectionFactory(
      { factoryId: '10120000325542', factoryRegistrationNo: '3-34(3)-3/54นบ' },
      { actorUserId: 42, scope: 'ALL' },
    );

    expect(result).toEqual({
      eligibleFactoryId: 17,
      factoryId: '10120000325542',
      factoryName: 'บริษัท โรงงานตัวอย่าง จำกัด',
      newRegistrationNo: '10120000325542',
    });
  });

  it('returns null when no eligible row matches the officer access filter', async () => {
    mockedDb.mockReturnValue(queryChain(undefined));

    await expect(
      connectionRequestsRepository.findDirectConnectionFactory(
        { factoryId: '10120000325542', factoryRegistrationNo: '3-34(3)-3/54นบ' },
        { actorUserId: 42, scope: 'ALL' },
      ),
    ).resolves.toBeNull();
  });
});

function queryChain(row: unknown) {
  const chain: Record<string, unknown> = {};
  const returnChain = jest.fn(() => chain);
  Object.assign(chain, {
    leftJoin: returnChain,
    whereNull: returnChain,
    where: returnChain,
    select: returnChain,
    first: jest.fn(async () => row),
  });
  return chain;
}
