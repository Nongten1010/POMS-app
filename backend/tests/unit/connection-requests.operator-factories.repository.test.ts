import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../../src/config/database', () => ({
  db: jest.fn(),
}));

import { db } from '../../src/config/database';
import { connectionRequestsRepository } from '../../src/modules/connection-requests/connection-requests.repository';

const mockedDb = db as unknown as jest.Mock<(...args: unknown[]) => unknown>;

describe('connectionRequestsRepository operator factory eligibility requests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('loads all open pending requests for the visible factory masters in one query', async () => {
    const query = queryHarness([
      {
        id: 42,
        factory_master_id: 2,
        submitted_at: new Date('2026-08-31T04:00:00.000Z'),
      },
      {
        id: 41,
        factory_master_id: 2,
        submitted_at: new Date('2026-08-31T03:00:00.000Z'),
      },
      {
        id: '55',
        factory_master_id: '3',
        submitted_at: '2026-08-31T02:00:00.000Z',
      },
    ]);
    mockedDb.mockReturnValue(query.builder);

    const result =
      await connectionRequestsRepository.listOpenEligibleFactoryAddRequestsForFactoryMasterIds([
        2, 2, 3, 0, -1,
      ]);

    expect(mockedDb).toHaveBeenCalledTimes(1);
    expect(mockedDb).toHaveBeenCalledWith('eligible_factory_add_requests');
    expect(query.whereIn).toHaveBeenCalledWith('factory_master_id', [2, 3]);
    expect(query.where).toHaveBeenCalledWith('status', 'PENDING_REVIEW');
    expect(query.where).toHaveBeenCalledWith('is_open', true);
    expect(query.whereNull).toHaveBeenCalledWith('deleted_at');
    expect(query.orderBy).toHaveBeenNthCalledWith(1, 'submitted_at', 'desc');
    expect(query.orderBy).toHaveBeenNthCalledWith(2, 'id', 'desc');
    expect(result).toEqual(
      new Map([
        [
          2,
          {
            id: 42,
            status: 'PENDING_REVIEW',
            statusLabel: 'รอพิจารณา',
            submittedAt: '2026-08-31T04:00:00.000Z',
          },
        ],
        [
          3,
          {
            id: 55,
            status: 'PENDING_REVIEW',
            statusLabel: 'รอพิจารณา',
            submittedAt: '2026-08-31T02:00:00.000Z',
          },
        ],
      ]),
    );
  });

  it('skips the database when there are no valid factory master ids', async () => {
    await expect(
      connectionRequestsRepository.listOpenEligibleFactoryAddRequestsForFactoryMasterIds([
        0,
        -1,
        Number.NaN,
      ]),
    ).resolves.toEqual(new Map());

    expect(mockedDb).not.toHaveBeenCalled();
  });
});

function queryHarness(rows: unknown[]) {
  const builder: Record<string, unknown> = {};
  const whereIn = jest.fn((..._args: unknown[]) => builder);
  const where = jest.fn((..._args: unknown[]) => builder);
  const whereNull = jest.fn((..._args: unknown[]) => builder);
  const orderBy = jest.fn((..._args: unknown[]) => builder);
  const select = jest.fn(async (..._args: unknown[]) => rows);
  Object.assign(builder, { whereIn, where, whereNull, orderBy, select });
  return { builder, whereIn, where, whereNull, orderBy };
}
