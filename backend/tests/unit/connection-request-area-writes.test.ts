import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockEnv = { FACTORY_DB_SCHEMA: 'dbo', FACTORY_PROFILE_MODE: 'legacy' };
const mockTransaction = jest.fn<() => Promise<never>>();
const mockSource = jest.fn();
jest.mock('../../src/config/env', () => ({ env: mockEnv }));
jest.mock('../../src/config/database', () => ({ db: { transaction: mockTransaction } }));
jest.mock('../../src/config/logger', () => ({ logger: { warn: jest.fn(), error: jest.fn() } }));
jest.mock('../../src/config/factory-source-database', () => ({
  factorySourceDb: mockSource,
  factorySourceTableName: () => 'dbo.Fac60k',
}));
jest.mock('../../src/config/parameter-source-database', () => ({ parameterSourceDb: jest.fn() }));

import { connectionRequestsRepository } from '../../src/modules/connection-requests/connection-requests.repository';
import {
  CONNECTION_REQUEST_STATUS,
  type CreateConnectionRequestInput,
} from '../../src/modules/connection-requests/connection-requests.types';

const input: CreateConnectionRequestInput = {
  factoryId: '82250600225587',
  factoryName: 'โรงงานทดสอบ',
  factoryRegistrationNo: '82250600225587',
  eligibleFactoryId: 430,
  provinceCode: '21',
  provinceName: 'ระยอง',
  districtCode: '6',
  subdistrictCode: '5',
  address: '7/507 หมู่ 6 ตำบล5 อำเภอ6 21140',
  systemType: 'CEMS',
  contactName: 'ผู้ทดสอบ',
  contactPhone: '020000000',
  measurementPoints: [],
};

const writers = [
  {
    name: 'create',
    run: (payload: CreateConnectionRequestInput) =>
      connectionRequestsRepository.create(
        payload,
        42,
        CONNECTION_REQUEST_STATUS.PENDING_DESIGN_REVIEW,
      ),
  },
  {
    name: 'direct connection',
    run: (payload: CreateConnectionRequestInput) =>
      connectionRequestsRepository.createDirectConnection(
        {
          ...payload,
          requestType: 'ADD_MEASUREMENT_POINT',
          measurementPoints: [
            { pointName: 'จุดทดสอบ', pointType: 'STACK', pointCode: 'TEST-AREA' },
          ],
        },
        42,
      ),
  },
  {
    name: 'resubmit/replace form',
    run: (payload: CreateConnectionRequestInput) =>
      connectionRequestsRepository.replaceForm(
        17,
        payload,
        42,
        CONNECTION_REQUEST_STATUS.REVISED_PENDING_DESIGN_REVIEW,
        { actorUserId: 42, scope: 'ALL', expectedUpdatedAt: '2026-10-30T00:00:00Z' },
      ),
  },
];

describe.each(['legacy', 'canonical'])('request area write boundary in %s mode', (mode) => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockEnv.FACTORY_PROFILE_MODE = mode;
    mockTransaction.mockRejectedValue(new Error('TRANSACTION_REACHED'));
    mockSource.mockImplementation(() => ({
      where: jest.fn().mockReturnThis(),
      whereIn: jest.fn().mockReturnThis(),
      timeout: jest.fn().mockReturnThis(),
      select: jest.fn(async () => []),
    }));
  });

  it.each(writers)(
    '$name rejects unverified numeric areas before any transaction or snapshot write',
    async ({ run }) => {
      await expect(run({ ...input })).rejects.toMatchObject({
        statusCode: 400,
        code: 'BAD_REQUEST',
        details: { path: 'address', reason: 'UNRESOLVED_ADMINISTRATIVE_AREA' },
      });
      expect(mockTransaction).not.toHaveBeenCalled();
    },
  );

  it.each(writers)(
    '$name refuses a lookup outage before any transaction or snapshot write',
    async ({ run }) => {
      mockSource.mockImplementation(() => {
        throw new Error('synthetic outage');
      });
      await expect(run({ ...input })).rejects.toMatchObject({
        statusCode: 503,
        code: 'FACTORY_AREA_LOOKUP_UNAVAILABLE',
      });
      expect(mockTransaction).not.toHaveBeenCalled();
    },
  );

  it.each(writers)(
    '$name allows readable addresses through without an external name lookup',
    async ({ run }) => {
      await expect(
        run({ ...input, address: '7/507 หมู่ 6 ตำบลมาบยางพร อำเภอปลวกแดง 21140' }),
      ).rejects.toThrow('TRANSACTION_REACHED');
      expect(mockTransaction).toHaveBeenCalledTimes(1);
      expect(mockSource).not.toHaveBeenCalled();
    },
  );
});
