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
import { MOCK_ELIGIBLE_FACTORY_CANDIDATES } from '../../src/modules/eligible-factories/eligible-factories.mock-source';
import { eligibleFactoryCandidatesRepository } from '../../src/modules/eligible-factories/eligible-factory-candidates.repository';

const mockedEligibleFactoriesRepository = jest.mocked(eligibleFactoriesRepository);
const mockedFactorySourceDb = jest.mocked(factorySourceDb);

describe('eligibleFactoryCandidatesRepository', () => {
  function mockExternalCandidateFailure() {
    const failingQuery = {
      clone: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      orderBy: jest
        .fn<() => Promise<never>>()
        .mockRejectedValue(new Error('invalid fac_import column')),
    };
    mockedFactorySourceDb.mockReturnValue(failingQuery as never);
  }

  it('excludes factories that are already selected as eligible', async () => {
    mockExternalCandidateFailure();
    mockedEligibleFactoriesRepository.listActiveRegistrationNumbers.mockResolvedValue([
      MOCK_ELIGIBLE_FACTORY_CANDIDATES[0]!.factoryRegistrationNo,
    ]);

    const result = await eligibleFactoryCandidatesRepository.list({});

    expect(result.meta.total).toBe(59999);
    expect(result.data).toHaveLength(59999);
    expect(result.data[0]?.factoryRegistrationNo).not.toBe(
      MOCK_ELIGIBLE_FACTORY_CANDIDATES[0]!.factoryRegistrationNo,
    );
  });

  it('returns candidates when selected factory exclusion cannot be loaded', async () => {
    mockExternalCandidateFailure();
    mockedEligibleFactoriesRepository.listActiveRegistrationNumbers.mockRejectedValue(
      new Error('selected table is unavailable'),
    );

    const result = await eligibleFactoryCandidatesRepository.list({});

    expect(result.meta.total).toBe(60000);
    expect(result.data).toHaveLength(60000);
  });

  it('falls back to mock candidates when the external Fac60k source fails', async () => {
    mockExternalCandidateFailure();
    mockedEligibleFactoriesRepository.listActiveRegistrationNumbers.mockResolvedValue([]);

    const result = await eligibleFactoryCandidatesRepository.list({});

    expect(result.meta).toEqual({
      total: 60000,
      source: 'mock',
    });
    expect(result.data).toHaveLength(60000);
  });
});
