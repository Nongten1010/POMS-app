import { describe, expect, it } from '@jest/globals';
import {
  formatRegionalDocumentNumber,
  regionalDocumentRegionCode,
} from '../../src/shared/utils/regional-document-number';

describe('regional document numbers', () => {
  it.each([
    ['ภาคตะวันตก', '02'],
    ['ภาคตะวันออก', '03'],
    ['ภาคเหนือ', '04'],
    ['ภาคใต้', '05'],
    ['ภาคตะวันออกเฉียงเหนือ', '06'],
    ['ภาคกลาง', '07'],
  ] as const)('maps %s to region code %s', (regionName, expected) => {
    expect(regionalDocumentRegionCode(regionName)).toBe(expected);
  });

  it('normalizes whitespace and rejects unsupported regions', () => {
    expect(regionalDocumentRegionCode(' ภาคตะวันตก ')).toBe('02');
    expect(regionalDocumentRegionCode('ไม่ทราบภาค')).toBeNull();
    expect(regionalDocumentRegionCode(null)).toBeNull();
  });

  it('formats a prefix, region, sequence, and Buddhist year', () => {
    expect(formatRegionalDocumentNumber('Error', '02', 1, '2569')).toBe('Error-02-0001/2569');
  });

  it.each([0, -1, 1.5, 10_000])('rejects out-of-range sequence %s', (sequence) => {
    expect(() => formatRegionalDocumentNumber('Error', '02', sequence, '2569')).toThrow(RangeError);
  });

  it('rejects malformed prefixes and Buddhist years', () => {
    expect(() => formatRegionalDocumentNumber('Bad-Prefix', '02', 1, '2569')).toThrow(RangeError);
    expect(() => formatRegionalDocumentNumber('Error', '02', 1, '69')).toThrow(RangeError);
  });
});
