import { describe, expect, it } from '@jest/globals';
import { inferRegionalAccessFromText } from '../../src/modules/auth/regional-access';

describe('regional access inference', () => {
  it.each([
    ['เจ้าหน้าที่ กวภ.', 'ภาคกลาง'],
    ['เจ้าหน้าที่ ศวภ.ต.', 'ภาคใต้'],
    ['เจ้าหน้าที่ ศวภ.ตอ.', 'ภาคตะวันออก'],
    ['เจ้าหน้าที่ ศวภ.ตต.', 'ภาคตะวันตก'],
    ['เจ้าหน้าที่ ศวภ.ตอน.', 'ภาคตะวันออกเฉียงเหนือ'],
    ['เจ้าหน้าที่ ศวภ.น.', 'ภาคเหนือ'],
  ])('maps %s to %s', (profileText, regionName) => {
    expect(inferRegionalAccessFromText(profileText)).toEqual({ regions: [regionName] });
  });

  it('does not add central access when a regional center appears with the parent division name', () => {
    expect(
      inferRegionalAccessFromText(
        'กองวิจัยและเตือนภัยมลพิษโรงงาน',
        'เจ้าหน้าที่ ศวภ.ต.',
      ),
    ).toEqual({ regions: ['ภาคใต้'] });
  });
});
