import { describe, expect, it, jest, beforeEach } from '@jest/globals';

jest.mock('../../src/shared/services/factory-source-provinces', () => ({
  resolveFactorySourceProvinces: jest.fn(),
}));
jest.mock('../../src/config/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn() },
}));

import { DiwUserLoginIdentityProvider } from '../../src/modules/auth/identity-provider/diw-user-login.identity-provider';
import { resolveFactorySourceProvinces } from '../../src/shared/services/factory-source-provinces';

const resolveProvinces = jest.mocked(resolveFactorySourceProvinces);

describe('DIW operator province source regression', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each([undefined, '1000'])(
    'uses Fac60k instead of missing/wrong login province %s',
    async (loginProvince) => {
      resolveProvinces.mockResolvedValue(
        new Map([
          ['10740200225505', { provinceId: '1074', provinceName: 'สมุทรสาคร' }],
          ['91090000125402', { provinceId: '1021', provinceName: 'ระยอง' }],
        ]),
      );
      const provider = new DiwUserLoginIdentityProvider({
        operatorUrl: 'https://example.test/operator',
        officerUrl: 'https://example.test/officer',
        clientId: 'test-client',
        timeoutMs: 1000,
        fetchImpl: (async () =>
          new Response(
            JSON.stringify({
              status: true,
              citizen_id: '0000000000000',
              juristic: [
                {
                  JuristicID: 'TEST',
                  JuristicNameTh: 'ทดสอบ',
                  FactoryList: [
                    {
                      FID: '10740200225505',
                      CODE: 'TEST-1',
                      FNAME: 'ทดสอบ 1',
                      PROVINCE_ID: loginProvince,
                    },
                    {
                      FID: '91090000125402',
                      CODE: 'TEST-2',
                      FNAME: 'ทดสอบ 2',
                      PROVINCE_ID: loginProvince,
                    },
                  ],
                },
              ],
            }),
          )) as typeof fetch,
      });
      const result = await provider.authenticateOperator('0000000000000', 'test-password');
      expect(result?.juristics[0].factories.map((factory) => factory.province_id)).toEqual([
        '1074',
        '1021',
      ]);
      expect(resolveProvinces).toHaveBeenCalledWith(['10740200225505', '91090000125402']);
    },
  );
});
