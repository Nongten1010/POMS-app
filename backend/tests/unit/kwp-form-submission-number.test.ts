import { describe, expect, it } from '@jest/globals';
import {
  buddhistYearInBangkok,
  formatKwpFormSubmissionNo,
  kwpFormPrefix,
  kwpRegionCode,
} from '../../src/modules/kwp-form-submissions/kwp-form-submission-number';

describe('KWP form submission numbers', () => {
  it.each([
    ['KWP01', 'F01'],
    ['KWP02', 'F02'],
    ['KWP03', 'F03'],
    ['KWP04', 'F04'],
    ['KWP05', 'F05'],
  ] as const)('maps %s to %s', (formType, expected) => {
    expect(kwpFormPrefix(formType)).toBe(expected);
  });

  it.each([
    ['ภาคตะวันตก', '02'],
    ['ภาคตะวันออก', '03'],
    ['ภาคเหนือ', '04'],
    ['ภาคใต้', '05'],
    ['ภาคตะวันออกเฉียงเหนือ', '06'],
    ['ภาคกลาง', '07'],
  ] as const)('maps %s to region code %s', (regionName, expected) => {
    expect(kwpRegionCode(regionName)).toBe(expected);
  });

  it('returns null for an unmapped region', () => {
    expect(kwpRegionCode('ไม่ทราบภาค')).toBeNull();
    expect(kwpRegionCode(null)).toBeNull();
  });

  it.each([
    ['KWP01', '04', 45, '2569', 'F01-04-0045/2569'],
    ['KWP02', '05', 5, '2570', 'F02-05-0005/2570'],
    ['KWP03', '06', 6, '2569', 'F03-06-0006/2569'],
    ['KWP04', '05', 47, '2569', 'F04-05-0047/2569'],
    ['KWP05', '03', 1, '2569', 'F05-03-0001/2569'],
  ] as const)(
    'formats %s region %s sequence %s year %s',
    (formType, regionCode, sequence, buddhistYear, expected) => {
      expect(formatKwpFormSubmissionNo(formType, regionCode, sequence, buddhistYear)).toBe(
        expected,
      );
    },
  );

  it('uses the Buddhist year at the Asia/Bangkok new-year boundary', () => {
    expect(buddhistYearInBangkok(new Date('2026-12-31T16:59:59.000Z'))).toBe('2569');
    expect(buddhistYearInBangkok(new Date('2026-12-31T17:00:00.000Z'))).toBe('2570');
  });

  it.each([0, -1, 1.5, 10_000])('rejects out-of-range sequence %s', (sequence) => {
    expect(() => formatKwpFormSubmissionNo('KWP01', '04', sequence, '2569')).toThrow(RangeError);
  });

  it('rejects malformed Buddhist years', () => {
    expect(() => formatKwpFormSubmissionNo('KWP01', '04', 1, '69')).toThrow(RangeError);
  });
});
