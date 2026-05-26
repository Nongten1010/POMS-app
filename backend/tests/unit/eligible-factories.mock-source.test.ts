import { describe, expect, it } from '@jest/globals';
import {
  MOCK_ELIGIBLE_FACTORY_CANDIDATE_COUNT,
  MOCK_ELIGIBLE_FACTORY_CANDIDATES,
} from '../../src/modules/eligible-factories/eligible-factories.mock-source';

const FAC60K_CANDIDATE_FIELDS = [
  'factoryName',
  'factoryId',
  'factoryRegistrationNo',
  'factoryClass',
  'factorySubclass',
  'address',
  'provinceName',
  'industrialEstateName',
  'longitude',
  'latitude',
  'businessActivity',
  'operationStatus',
  'capitalAmount',
  'machineryHorsepower',
  'productionCapacity',
  'wastewaterDischargeInfo',
  'boilerCount',
  'boilerSizeEach',
  'fuelUsed',
  'hasEia',
].sort();

describe('eligible factory mock source', () => {
  it('provides the full 60,000 Fac60k candidate records', () => {
    expect(MOCK_ELIGIBLE_FACTORY_CANDIDATE_COUNT).toBe(60000);
    expect(MOCK_ELIGIBLE_FACTORY_CANDIDATES).toHaveLength(60000);
  });

  it('uses exactly the 20 DataDict_Fac60k candidate fields', () => {
    expect(Object.keys(MOCK_ELIGIBLE_FACTORY_CANDIDATES[0] ?? {}).sort()).toEqual(
      FAC60K_CANDIDATE_FIELDS,
    );
  });
});
