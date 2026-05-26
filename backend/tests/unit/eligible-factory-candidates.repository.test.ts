import { describe, expect, it, jest } from '@jest/globals';

jest.mock('../../src/modules/eligible-factories/eligible-factories.repository', () => ({
  eligibleFactoriesRepository: {
    listActiveRegistrationNumbers: jest.fn(),
  },
}));

import { eligibleFactoriesRepository } from '../../src/modules/eligible-factories/eligible-factories.repository';
import { MOCK_ELIGIBLE_FACTORY_CANDIDATES } from '../../src/modules/eligible-factories/eligible-factories.mock-source';
import { eligibleFactoryCandidatesRepository } from '../../src/modules/eligible-factories/eligible-factory-candidates.repository';

const mockedEligibleFactoriesRepository = jest.mocked(eligibleFactoriesRepository);

describe('eligibleFactoryCandidatesRepository', () => {
  it('excludes factories that are already selected as eligible', async () => {
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
});
