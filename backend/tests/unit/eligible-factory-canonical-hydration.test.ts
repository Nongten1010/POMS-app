import { describe, expect, it, jest } from '@jest/globals';

jest.mock('../../src/config/env', () => ({
  env: { FACTORY_DB_SCHEMA: 'dbo', FACTORY_PROFILE_MODE: 'canonical' },
}));
jest.mock('../../src/config/factory-source-database', () => ({
  factorySourceTableName: () => 'dbo.FAC_IMPORT',
  factorySourceDb: (table: string) => ({
    where: jest.fn().mockReturnThis(),
    whereIn: jest.fn().mockReturnThis(),
    timeout: jest.fn().mockReturnThis(),
    select: jest.fn(async () =>
      table === 'dbo.FAC_IMPORT'
        ? [
            {
              FID: 'REG-TEST',
              FACREG: 'REG-TEST',
              FADDR: 'External address',
              PROV: '21',
              AMP: '1',
              TUMBOL: '1',
              HP: 50,
            },
          ]
        : [{ PROV: '21', AMP: '1', TUMBOL: '1', TUMNAME: 'ทดสอบ', AMPNAME: 'ทดสอบ' }],
    ),
  }),
}));

import { hydrateEligibleFactoriesFromSource } from '../../src/modules/eligible-factories/eligible-factory-source-hydration';

describe('canonical profile address is authoritative during selected factory hydration', () => {
  it.each([
    [null, null],
    ['Office address', 'Office address'],
    ['ตำบล1 อำเภอ1', 'ตำบลทดสอบ อำเภอทดสอบ'],
  ])(
    'preserves readable or cleared address %s and repairs numeric labels with horsepower fallback',
    async (address, expectedAddress) => {
      const [row] = await hydrateEligibleFactoriesFromSource([
        {
          sourceFactoryId: 'REG-TEST',
          factoryRegistrationNoNew: 'REG-TEST',
          address,
          provinceName: 'ระยอง',
          machineryHorsepower: null,
        } as never,
      ]);
      expect(row?.address).toBe(expectedAddress);
      expect(row?.machineryHorsepower).toBe(50);
    },
  );
});
