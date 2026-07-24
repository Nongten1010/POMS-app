export const REGIONAL_DOCUMENT_REGION_CODES = ['02', '03', '04', '05', '06', '07'] as const;

export type RegionalDocumentRegionCode = (typeof REGIONAL_DOCUMENT_REGION_CODES)[number];

const REGION_CODE_BY_NAME: Readonly<Record<string, RegionalDocumentRegionCode>> = Object.freeze({
  ภาคตะวันตก: '02',
  ภาคตะวันออก: '03',
  ภาคเหนือ: '04',
  ภาคใต้: '05',
  ภาคตะวันออกเฉียงเหนือ: '06',
  ภาคกลาง: '07',
});

const VALID_REGION_CODES = new Set<string>(REGIONAL_DOCUMENT_REGION_CODES);
const VALID_PREFIX_PATTERN = /^[A-Za-z][A-Za-z0-9]*$/;

export function regionalDocumentRegionCode(
  regionName: string | null | undefined,
): RegionalDocumentRegionCode | null {
  if (!regionName) return null;
  return REGION_CODE_BY_NAME[regionName.trim()] ?? null;
}

export function formatRegionalDocumentNumber(
  prefix: string,
  regionCode: RegionalDocumentRegionCode,
  sequence: number,
  buddhistYear: string,
): string {
  if (!VALID_PREFIX_PATTERN.test(prefix)) {
    throw new RangeError('Regional document prefix must be alphanumeric');
  }
  if (!VALID_REGION_CODES.has(regionCode)) {
    throw new RangeError('Regional document region code is invalid');
  }
  if (!Number.isInteger(sequence) || sequence < 1 || sequence > 9_999) {
    throw new RangeError('Regional document sequence must be between 1 and 9999');
  }
  if (!/^\d{4}$/.test(buddhistYear)) {
    throw new RangeError('Regional document Buddhist year must contain four digits');
  }

  return `${prefix}-${regionCode}-${String(sequence).padStart(4, '0')}/${buddhistYear}`;
}
