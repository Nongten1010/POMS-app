import { describe, expect, it } from '@jest/globals';
import { withProvinceInFactoryAddress } from '../../src/modules/eligible-factories/factory-address';

describe('factory address province formatting', () => {
  it('is idempotent when the address already contains the province', () => {
    const address = '89 อำเภอบางปะอิน จังหวัดพระนครศรีอยุธยา 13160';
    expect(withProvinceInFactoryAddress(address, 'พระนครศรีอยุธยา')).toBe(address);
  });

  it('uses กรุงเทพมหานคร without a จังหวัด prefix', () => {
    expect(
      withProvinceInFactoryAddress('99 แขวงลำปลาทิว เขตลาดกระบัง 10520', 'กรุงเทพมหานคร'),
    ).toBe('99 แขวงลำปลาทิว เขตลาดกระบัง กรุงเทพมหานคร 10520');
  });

  it('preserves an explicit conflicting province for manual review', () => {
    const address = '99 อำเภอเมือง จังหวัดชลบุรี 20000';
    expect(withProvinceInFactoryAddress(address, 'ระยอง')).toBe(address);
  });

  it('does not create a province-only address when the address is empty', () => {
    expect(withProvinceInFactoryAddress(null, 'ชัยนาท')).toBeNull();
  });
});
