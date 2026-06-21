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
      PROV: 10,
      FFLAG: 1,
    },
    {
      FNAME: 'โรงงานจริง 2',
      FID: 'real-2',
      DISPFACREG: 'real-reg-2',
      PROV: 21,
      FFLAG: 3,
      COLONY_INDUST_CODE: '000022',
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
      whereIn: jest.fn().mockReturnThis(),
      whereNotIn: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      timeout: jest.fn().mockReturnThis(),
      offset: jest.fn().mockReturnThis(),
      limit: jest
        .fn<(...args: unknown[]) => Promise<typeof externalRows>>()
        .mockResolvedValue(externalRows),
      then: jest.fn((resolve: (rows: typeof externalRows) => unknown) =>
        Promise.resolve(resolve(externalRows)),
      ),
    };
    const countQuery = {
      whereIn: jest.fn().mockReturnThis(),
      whereNotIn: jest.fn().mockReturnThis(),
      timeout: jest.fn().mockReturnThis(),
      count: jest
        .fn<(...args: unknown[]) => Promise<Array<{ total: string | number | null }>>>()
        .mockResolvedValue([{ total: externalRows.length }]),
    };
    const baseQuery = {
      clone: jest.fn().mockReturnValueOnce(countQuery).mockReturnValueOnce(facImportQuery),
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
    const boilerListQuery = {
      whereIn: jest.fn().mockReturnThis(),
      timeout: jest.fn().mockReturnThis(),
      select: jest.fn<(...columns: string[]) => Promise<Array<Record<string, unknown>>>>().mockResolvedValue([
        {
          fac_id_reg: 'real-2',
          mac_max_stream_prod: '10 ตัน/ชั่วโมง',
          fuel_name: 'ก๊าซธรรมชาติ',
        },
        {
          fac_id_reg: 'real-2',
          mac_max_stream_prod: '12 ตัน/ชั่วโมง',
          fuel_name: 'น้ำมันเตา',
        },
      ]),
    };
    mockedBoilerSourceDb.mockReturnValue(boilerListQuery as never);
    mockedFactorySourceDb.mockImplementation(((tableName: unknown) => {
      if (tableName === 'INFORMATION_SCHEMA.COLUMNS') return informationSchemaQuery as never;
      if (tableName === 'dbo.check_eia') return checkEiaQuery as never;
      if (tableName === 'dbo.FAC_COLONY_INDUST') return industrialEstateQuery as never;
      if (tableName === 'dbo.FAC_PROD as fp') return facProdQuery as never;
      return baseQuery as never;
    }) as never);
    return {
      baseQuery,
      countQuery,
      facImportQuery,
      checkEiaQuery,
      facProdQuery,
      boilerListQuery,
      industrialEstateQuery,
    };
  }

  it('paginates candidates before loading related lookup data', async () => {
    const { countQuery, facImportQuery, facProdQuery, boilerListQuery, industrialEstateQuery } =
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
    expect(result.data[1]?.boilerSizeEach).toBe('10 ตัน/ชั่วโมง, 12 ตัน/ชั่วโมง');
    expect(result.data[1]?.fuelUsed).toBe('ก๊าซธรรมชาติ, น้ำมันเตา');
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
    expect(mockedBoilerSourceDb).toHaveBeenCalledWith('dbo.boiler_list');
    expect(boilerListQuery.whereIn).toHaveBeenCalledWith('fac_id_reg', ['real-1', 'real-2']);
    expect(boilerListQuery.select).toHaveBeenCalledWith(
      'fac_id_reg',
      'mac_max_stream_prod',
      'fuel_name',
    );
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
