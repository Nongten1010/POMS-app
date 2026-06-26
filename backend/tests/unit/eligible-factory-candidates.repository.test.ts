import { describe, expect, it, jest } from '@jest/globals';

jest.mock('../../src/config/env', () => ({
  env: {
    FACTORY_DB_SCHEMA: 'dbo',
    FACTORY_DB_TABLE: 'fac_import',
    BOILER_DB_SCHEMA: 'dbo',
    BOILER_DB_TABLE: 'boiler_list',
  },
}));

jest.mock('../../src/config/factory-source-database', () => ({
  factorySourceDb: jest.fn(),
  factorySourceTableName: jest.fn(() => 'dbo.fac_import'),
}));

jest.mock('../../src/config/boiler-source-database', () => ({
  boilerSourceDb: jest.fn(),
  boilerSourceTableName: jest.fn(() => 'dbo.boiler_list'),
}));

jest.mock('../../src/modules/eligible-factories/eligible-factories.repository', () => ({
  eligibleFactoriesRepository: {
    listActiveRegistrationNumbers: jest.fn(),
  },
}));

import { eligibleFactoriesRepository } from '../../src/modules/eligible-factories/eligible-factories.repository';
import { factorySourceDb } from '../../src/config/factory-source-database';
import { boilerSourceDb } from '../../src/config/boiler-source-database';
import { eligibleFactoryCandidatesRepository } from '../../src/modules/eligible-factories/eligible-factory-candidates.repository';

const mockedEligibleFactoriesRepository = jest.mocked(eligibleFactoriesRepository);
const mockedFactorySourceDb = jest.mocked(factorySourceDb);
const mockedBoilerSourceDb = jest.mocked(boilerSourceDb);

describe('eligibleFactoryCandidatesRepository', () => {
  const externalRows = [
    {
      FNAME: 'โรงงานจริง 1',
      FID: 'real-1',
      DISPFACREG: 'real-reg-1',
      CLASS: '00100',
      PROV: 10,
      FFLAG: 1,
    },
    {
      FNAME: 'โรงงานจริง 2',
      FID: 'real-2',
      DISPFACREG: 'real-reg-2',
      CLASS: '00100',
      PROV: 21,
      FFLAG: 3,
      COLONY_INDUST_CODE: '000022',
    },
  ];

  function mockExternalCandidates(candidateRows = externalRows) {
    const informationSchemaQuery = {
      where: jest.fn().mockReturnThis(),
      whereIn: jest.fn().mockReturnThis(),
      select: jest
        .fn<() => Promise<Array<{ COLUMN_NAME: string }>>>()
        .mockResolvedValue([
          { COLUMN_NAME: 'FNAME' },
          { COLUMN_NAME: 'FID' },
          { COLUMN_NAME: 'DISPFACREG' },
          { COLUMN_NAME: 'CLASS' },
          { COLUMN_NAME: 'PROV' },
          { COLUMN_NAME: 'FFLAG' },
        ]),
    };
    const facImportQuery = {
      whereIn: jest.fn().mockReturnThis(),
      whereNotIn: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      timeout: jest.fn().mockReturnThis(),
      offset: jest.fn().mockReturnThis(),
      limit: jest
        .fn<(...args: unknown[]) => Promise<typeof externalRows>>()
        .mockResolvedValue(candidateRows),
      then: jest.fn((resolve: (rows: typeof externalRows) => unknown) =>
        Promise.resolve(resolve(candidateRows)),
      ),
    };
    const countQuery = {
      whereIn: jest.fn().mockReturnThis(),
      whereNotIn: jest.fn().mockReturnThis(),
      timeout: jest.fn().mockReturnThis(),
      count: jest
        .fn<(...args: unknown[]) => Promise<Array<{ total: string | number | null }>>>()
        .mockResolvedValue([{ total: candidateRows.length }]),
    };
    const baseQuery = {
      clone: jest.fn().mockReturnValueOnce(countQuery).mockReturnValueOnce(facImportQuery),
      whereIn: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
    };
    const checkEiaQuery = {
      whereIn: jest.fn().mockReturnThis(),
      timeout: jest.fn().mockReturnThis(),
      select: jest
        .fn<
          (...columns: string[]) => Promise<Array<{ FACREG: string | null; FID: string | null }>>
        >()
        .mockResolvedValue([{ FACREG: 'real-reg-2', FID: null }]),
    };
    const industrialEstateQuery = {
      whereIn: jest.fn().mockReturnThis(),
      timeout: jest.fn().mockReturnThis(),
      select: jest
        .fn<
          (
            ...columns: string[]
          ) => Promise<
            Array<{ COLONY_INDUST_CODE: string | null; COLONY_INDUST_DESC: string | null }>
          >
        >()
        .mockResolvedValue([{ COLONY_INDUST_CODE: '000022', COLONY_INDUST_DESC: 'แหลมฉบัง' }]),
    };
    const facProdQuery = {
      join: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      whereIn: jest.fn().mockReturnThis(),
      timeout: jest.fn().mockReturnThis(),
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
    const facClassQuery = {
      whereIn: jest.fn().mockReturnThis(),
      timeout: jest.fn().mockReturnThis(),
      select: jest
        .fn<
          (...columns: string[]) => Promise<Array<{ FID: string | null; CLASS: string | null }>>
        >()
        .mockResolvedValue([
          { FID: 'real-1', CLASS: '00100' },
          { FID: 'real-1', CLASS: '00201' },
          { FID: 'real-2', CLASS: '00100' },
        ]),
    };
    const activeFacClassQuery = {
      join: jest.fn().mockReturnThis(),
      whereIn: jest.fn().mockReturnThis(),
      timeout: jest.fn().mockReturnThis(),
      select: jest
        .fn<
          (...columns: string[]) => Promise<Array<{ FID: string | null; CLASS: string | null }>>
        >()
        .mockResolvedValue([
          { FID: 'real-1', CLASS: '00100' },
          { FID: 'real-1', CLASS: '00201' },
          { FID: 'real-2', CLASS: '00100' },
        ]),
    };
    mockedFactorySourceDb.mockImplementation(((tableName: unknown) => {
      if (tableName === 'INFORMATION_SCHEMA.COLUMNS') return informationSchemaQuery as never;
      if (tableName === 'dbo.check_eia') return checkEiaQuery as never;
      if (tableName === 'dbo.FAC_COLONY_INDUST') return industrialEstateQuery as never;
      if (tableName === 'dbo.FAC_PROD as fp') return facProdQuery as never;
      if (tableName === 'dbo.FACCLASS') return facClassQuery as never;
      if (tableName === 'dbo.FACCLASS as fc') return activeFacClassQuery as never;
      return baseQuery as never;
    }) as never);
    return {
      baseQuery,
      countQuery,
      facImportQuery,
      checkEiaQuery,
      facProdQuery,
      facClassQuery,
      activeFacClassQuery,
      industrialEstateQuery,
    };
  }

  it('paginates candidates before loading related lookup data', async () => {
    const { countQuery, facImportQuery, facProdQuery, facClassQuery, industrialEstateQuery } =
      mockExternalCandidates();
    mockedEligibleFactoriesRepository.listActiveRegistrationNumbers.mockResolvedValue([]);

    const result = await eligibleFactoryCandidatesRepository.list({ page: 2, perPage: 50 });

    expect(result.meta).toEqual({
      total: 2,
      page: 2,
      perPage: 50,
      totalPages: 1,
      source: 'external',
    });
    expect(result.data).toHaveLength(2);
    expect(result.data[1]?.factoryRegistrationNo).toBe('real-reg-2');
    expect(result.data[1]?.industrialEstateName).toBe('แหลมฉบัง');
    expect(result.data[1]?.eia).toBeNull();
    expect(result.data[1]?.hasEia).toBeNull();
    expect(result.data[1]?.productionCapacity).toBe('น้ำตาลทราย 1200 ตัน/ปี, กากน้ำตาล 300 ตัน/ปี');
    expect(result.data[0]?.factorySubclass).toBe('0201');
    expect(result.data[1]?.boilerSizeEach).toBeNull();
    expect(result.data[1]?.fuelUsed).toBeNull();
    expect(countQuery.count).toHaveBeenCalledWith({ total: '*' });
    expect(facImportQuery.offset).toHaveBeenCalledWith(50);
    expect(facImportQuery.limit).toHaveBeenCalledWith(50);
    expect(facImportQuery.whereIn).toHaveBeenCalledWith('FFLAG', ['1', '3']);
    expect(industrialEstateQuery.select).toHaveBeenCalledWith(
      'COLONY_INDUST_CODE',
      'COLONY_INDUST_DESC',
    );
    expect(mockedFactorySourceDb).not.toHaveBeenCalledWith('dbo.check_eia');
    expect(facProdQuery.leftJoin).toHaveBeenCalledWith('dbo.UNIT as u', 'fp.UNIT', 'u.UNIT');
    expect(facProdQuery.whereIn).toHaveBeenCalledWith('fp.FID', ['real-1', 'real-2']);
    expect(facClassQuery.whereIn).toHaveBeenCalledWith('FID', ['real-1', 'real-2']);
    expect(mockedBoilerSourceDb).not.toHaveBeenCalled();
  });

  it('loads FACCLASS without joining fac_import when exporting all candidates', async () => {
    const manyRows = Array.from({ length: 5001 }, (_, index) => ({
      FNAME: `โรงงานจริง ${index + 1}`,
      FID: `real-${index + 1}`,
      DISPFACREG: `real-reg-${index + 1}`,
      CLASS: '00100',
      PROV: 10,
      FFLAG: 1,
    }));
    const { facClassQuery, activeFacClassQuery } = mockExternalCandidates(manyRows);
    mockedEligibleFactoriesRepository.listActiveRegistrationNumbers.mockResolvedValue([]);

    const result = await eligibleFactoryCandidatesRepository.list({});

    expect(result.meta).toEqual({
      total: 5001,
      source: 'external',
    });
    expect(result.data).toHaveLength(5001);
    expect(result.data[0]?.factorySubclass).toBe('0201');
    expect(activeFacClassQuery.join).not.toHaveBeenCalled();
    expect(facClassQuery.whereIn).not.toHaveBeenCalled();
    expect(activeFacClassQuery.whereIn).toHaveBeenCalled();
    expect(activeFacClassQuery.select).toHaveBeenCalledWith('fc.FID', 'fc.CLASS');
  });

  it('returns all candidates when pagination is not requested', async () => {
    const { facImportQuery } = mockExternalCandidates();
    mockedEligibleFactoriesRepository.listActiveRegistrationNumbers.mockResolvedValue([]);

    const result = await eligibleFactoryCandidatesRepository.list({});

    expect(result.meta).toEqual({
      total: 2,
      source: 'external',
    });
    expect(result.data).toHaveLength(2);
    expect(facImportQuery.offset).not.toHaveBeenCalled();
    expect(facImportQuery.limit).not.toHaveBeenCalled();
  });

  it('returns candidates when selected factory exclusion cannot be loaded', async () => {
    mockExternalCandidates();
    mockedEligibleFactoriesRepository.listActiveRegistrationNumbers.mockRejectedValue(
      new Error('selected table is unavailable'),
    );

    const result = await eligibleFactoryCandidatesRepository.list({});

    expect(result.meta).toEqual({
      total: 2,
      source: 'external',
    });
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
