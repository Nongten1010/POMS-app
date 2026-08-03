import { describe, expect, it } from '@jest/globals';
import { resolveEligibleFactoryAddressForStorage } from '../../src/modules/eligible-factories/eligible-factory-source-hydration';

describe('eligible factory address storage', () => {
  it('keeps province separately usable while storing it in a readable address', async () => {
    await expect(
      resolveEligibleFactoryAddressForStorage({
        sourceFactoryId: '72120200125358',
        factoryRegistrationNoNew: '72120200125358',
        address: '89 หมู่ 1 ถนนสายเอเซีย ตำบลบ้านเลน อำเภอบางปะอิน 13160',
        provinceName: 'พระนครศรีอยุธยา',
      }),
    ).resolves.toBe(
      '89 หมู่ 1 ถนนสายเอเซีย ตำบลบ้านเลน อำเภอบางปะอิน จังหวัดพระนครศรีอยุธยา 13160',
    );
  });
});
