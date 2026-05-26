import { describe, expect, it, jest } from '@jest/globals';

jest.mock('../../src/config/env', () => ({
  env: {
    FACTORY_SOURCE_MODE: 'external',
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
      FFLAG: 2,
    },
    {
      FNAME: 'โรงงานจริง 2',
      FID: 'real-2',
      DISPFACREG: 'real-reg-2',
      PROV: 21,
      FFLAG: 2,
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
      select: jest.fn().mockReturnThis(),
      orderBy: jest.fn<() => Promise<typeof externalRows>>().mockResolvedValue(externalRows),
    };
    mockedFactorySourceDb.mockImplementation(((tableName: unknown) => {
      if (tableName === 'INFORMATION_SCHEMA.COLUMNS') return informationSchemaQuery as never;
      return facImportQuery as never;
    }) as never);
  }

  it('excludes factories that are already selected as eligible', async () => {
    mockExternalCandidates();
    mockedEligibleFactoriesRepository.listActiveRegistrationNumbers.mockResolvedValue([
      'real-reg-1',
    ]);

    const result = await eligibleFactoryCandidatesRepository.list({});

    expect(result.meta).toEqual({ total: 1, source: 'external' });
    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.factoryRegistrationNo).toBe('real-reg-2');
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
