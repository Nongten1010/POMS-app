import { describe, expect, it, jest } from '@jest/globals';

jest.mock('../../src/config/env', () => ({
  env: {
    FACTORY_DB_SCHEMA: 'dbo',
    FACTORY_DB_TABLE: 'fac_import',
  },
}));

jest.mock('../../src/config/factory-source-database', () => ({
  factorySourceDb: jest.fn(),
  factorySourceTableName: jest.fn(() => 'dbo.fac_import'),
}));

jest.mock('../../src/modules/eligible-factories/eligible-factories.repository', () => ({
  eligibleFactoriesRepository: {
    listActiveRegistrationNumbers: jest.fn(),
  },
}));

import { eligibleFactoriesRepository } from '../../src/modules/eligible-factories/eligible-factories.repository';
import { factorySourceDb } from '../../src/config/factory-source-database';
import { eligibleFactoryCandidatesRepository } from '../../src/modules/eligible-factories/eligible-factory-candidates.repository';

const mockedEligibleFactoriesRepository = jest.mocked(eligibleFactoriesRepository);
const mockedFactorySourceDb = jest.mocked(factorySourceDb);

describe('eligibleFactoryCandidatesRepository', () => {
  const externalRows = [
    {
      FNAME: 'โรงงานจริง 1',
      FID: 'real-1',
      DISPFACREG: 'real-reg-1',
      PROV: 10,
      FFLAG: 1,
    },
    {
      FNAME: 'โรงงานจริง 2',
      FID: 'real-2',
      DISPFACREG: 'real-reg-2',
      PROV: 21,
      FFLAG: 3,
    },
  ];

  function mockExternalCandidates() {
    const informationSchemaQuery = {
      where: jest.fn().mockReturnThis(),
      whereIn: jest.fn().mockReturnThis(),
      select: jest
        .fn<() => Promise<Array<{ COLUMN_NAME: string }>>>()
        .mockResolvedValue([
          { COLUMN_NAME: 'FNAME' },
          { COLUMN_NAME: 'FID' },
          { COLUMN_NAME: 'DISPFACREG' },
          { COLUMN_NAME: 'PROV' },
          { COLUMN_NAME: 'FFLAG' },
        ]),
    };
    const facImportQuery = {
      clone: jest.fn().mockReturnThis(),
      whereIn: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      orderBy: jest.fn<() => Promise<typeof externalRows>>().mockResolvedValue(externalRows),
    };
    const checkEiaQuery = {
      select: jest
        .fn<
          (...columns: string[]) => Promise<Array<{ FACREG: string | null; FID: string | null }>>
        >()
        .mockResolvedValue([{ FACREG: 'real-reg-2', FID: null }]),
    };
    const facProdQuery = {
      leftJoin: jest.fn().mockReturnThis(),
      whereIn: jest.fn().mockReturnThis(),
      select: jest
        .fn<
          () => Promise<
            Array<{
              FID: string | null;
              PRODNAME: string | null;
              PRODQUAN: string | number | null;
              UNT_ENAME: string | null;
            }>
          >
        >()
        .mockResolvedValue([
          {
            FID: 'real-2',
            PRODNAME: 'น้ำตาลทราย',
            PRODQUAN: 1200,
            UNT_ENAME: 'ตัน/ปี',
          },
          {
            FID: 'real-2',
            PRODNAME: 'กากน้ำตาล',
            PRODQUAN: 300,
            UNT_ENAME: 'ตัน/ปี',
          },
        ]),
    };
    mockedFactorySourceDb.mockImplementation(((tableName: unknown) => {
      if (tableName === 'INFORMATION_SCHEMA.COLUMNS') return informationSchemaQuery as never;
      if (tableName === 'dbo.check_eia') return checkEiaQuery as never;
      if (tableName === 'dbo.FAC_PROD as fp') return facProdQuery as never;
      return facImportQuery as never;
    }) as never);
    return { facImportQuery, checkEiaQuery, facProdQuery };
  }

  it('excludes factories that are already selected as eligible', async () => {
    const { facImportQuery, checkEiaQuery, facProdQuery } = mockExternalCandidates();
    mockedEligibleFactoriesRepository.listActiveRegistrationNumbers.mockResolvedValue([
      'real-reg-1',
    ]);

    const result = await eligibleFactoryCandidatesRepository.list({});

    expect(result.meta).toEqual({ total: 1, source: 'external' });
    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.factoryRegistrationNo).toBe('real-reg-2');
    expect(result.data[0]?.eia).toBe('มี');
    expect(result.data[0]?.hasEia).toBe(true);
    expect(result.data[0]?.productionCapacity).toBe('น้ำตาลทราย 1200 ตัน/ปี, กากน้ำตาล 300 ตัน/ปี');
    expect(facImportQuery.whereIn).toHaveBeenCalledWith('FFLAG', ['1', '3']);
    expect(checkEiaQuery.select).toHaveBeenCalledWith('FACREG', 'FID');
    expect(facProdQuery.leftJoin).toHaveBeenCalledWith('dbo.UNIT as u', 'fp.UNIT', 'u.UNIT');
    expect(facProdQuery.whereIn).toHaveBeenCalledWith('fp.FID', ['real-1', 'real-2']);
  });

  it('returns candidates when selected factory exclusion cannot be loaded', async () => {
    mockExternalCandidates();
    mockedEligibleFactoriesRepository.listActiveRegistrationNumbers.mockRejectedValue(
      new Error('selected table is unavailable'),
    );

    const result = await eligibleFactoryCandidatesRepository.list({});

    expect(result.meta).toEqual({ total: 2, source: 'external' });
    expect(result.data).toHaveLength(2);
  });

  it('surfaces external Fac60k source failures instead of returning mock data', async () => {
    const failingInformationSchemaQuery = {
      where: jest.fn().mockReturnThis(),
      whereIn: jest.fn().mockReturnThis(),
      select: jest
        .fn<() => Promise<never>>()
        .mockRejectedValue(new Error('fac_import unavailable')),
    };
    mockedFactorySourceDb.mockReturnValue(failingInformationSchemaQuery as never);
    mockedEligibleFactoriesRepository.listActiveRegistrationNumbers.mockResolvedValue([]);

    await expect(eligibleFactoryCandidatesRepository.list({})).rejects.toThrow(
      'fac_import unavailable',
    );
  });
});
