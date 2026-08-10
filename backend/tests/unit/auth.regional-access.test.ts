import { describe, expect, it } from '@jest/globals';
import {
  inferRegionalAccessFromText,
  resolveAssignedRegions,
} from '../../src/modules/auth/regional-access';

describe('regional access inference', () => {
  it.each([
    ['เจ้าหน้าที่ กวภ.', 'ภาคกลาง'],
    ['เจ้าหน้าที่ กฝม.', 'ภาคกลาง'],
    ['ผอ.กฝม.', 'ภาคกลาง'],
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

  it('handles duplicate-column array values from MSSQL without throwing', () => {
    expect(inferRegionalAccessFromText(['กองวิจัยและเตือนภัยมลพิษโรงงาน'], null)).toEqual({
      regions: ['ภาคกลาง'],
    });
  });
});

describe('regional access intersection', () => {
  it('returns only an explicit region that is part of the profile assignment', () => {
    expect(resolveAssignedRegions('ภาคเหนือ', { regions: ['ภาคเหนือ', 'ภาคกลาง'] })).toEqual([
      'ภาคเหนือ',
    ]);
  });

  it('fails closed for conflicting or missing profile assignments', () => {
    expect(resolveAssignedRegions('ภาคเหนือ', { regions: ['ภาคใต้'] })).toEqual([]);
    expect(resolveAssignedRegions('ภาคเหนือ', null)).toEqual([]);
    expect(resolveAssignedRegions(null, null)).toEqual([]);
  });

  it('uses all assigned profile regions when the permission has no explicit qualifier', () => {
    expect(resolveAssignedRegions(null, { regions: [' ภาคใต้ ', 'ภาคใต้', 'ภาคเหนือ'] })).toEqual([
      'ภาคใต้',
      'ภาคเหนือ',
    ]);
  });
});
