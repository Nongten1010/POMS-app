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

  it('places the province immediately after the district instead of before land-title numbers', () => {
    const address =
      'โฉนดที่ดินเลขที่ 45907 45906 46388 หมู่ 1 ตำบลหนองกินเพล อำเภอวารินชำราบ 34190';

    expect(withProvinceInFactoryAddress(address, 'อุบลราชธานี')).toBe(
      'โฉนดที่ดินเลขที่ 45907 45906 46388 หมู่ 1 ตำบลหนองกินเพล อำเภอวารินชำราบ จังหวัดอุบลราชธานี 34190',
    );
  });

  it('moves an existing misplaced province to immediately after the district', () => {
    const address = 'โฉนดที่ดินเลขที่ จังหวัดร้อยเอ็ด 39274 หมู่ 9 ตำบลสระคู อำเภอสุวรรณภูมิ 45130';

    expect(withProvinceInFactoryAddress(address, 'ร้อยเอ็ด')).toBe(
      'โฉนดที่ดินเลขที่ 39274 หมู่ 9 ตำบลสระคู อำเภอสุวรรณภูมิ จังหวัดร้อยเอ็ด 45130',
    );
  });

  it('preserves unrelated source spacing while moving the province', () => {
    const address = 'โฉนดที่ดินเลขที่ จังหวัดลำปาง 17945  17946 และ 64720 หมู่ 6 อำเภอแม่ทะ 52150';

    expect(withProvinceInFactoryAddress(address, 'ลำปาง')).toBe(
      'โฉนดที่ดินเลขที่ 17945  17946 และ 64720 หมู่ 6 อำเภอแม่ทะ จังหวัดลำปาง 52150',
    );
  });

  it('does not mistake a province-like road name for the province address component', () => {
    const address =
      '61 หมู่ 8 ถนนทางหลวงจังหวัดปราจีนบุรี-บ้านสร้าง 3071 ตำบลวัดโบสถ์ อำเภอเมืองปราจีนบุรี 25000';

    expect(withProvinceInFactoryAddress(address, 'ปราจีนบุรี')).toBe(
      '61 หมู่ 8 ถนนทางหลวงจังหวัดปราจีนบุรี-บ้านสร้าง 3071 ตำบลวัดโบสถ์ อำเภอเมืองปราจีนบุรี จังหวัดปราจีนบุรี 25000',
    );
  });

  it('keeps land-title numbers in place when the source has no postal code', () => {
    const address = 'โฉนดที่ดิน22270 8881 หมู่ 11 ตำบลกลางเวียง อำเภอเวียงสา';

    expect(withProvinceInFactoryAddress(address, 'น่าน', { postalCode: null })).toBe(
      'โฉนดที่ดิน22270 8881 หมู่ 11 ตำบลกลางเวียง อำเภอเวียงสา จังหวัดน่าน',
    );
  });

  it('does not create a province-only address when the address is empty', () => {
    expect(withProvinceInFactoryAddress(null, 'ชัยนาท')).toBeNull();
  });
});
