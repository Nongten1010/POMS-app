import type { KwpFormSubmissionDetailType } from './kwp-form-submissions.types';

export type KwpSubmissionRegionCode = '02' | '03' | '04' | '05' | '06' | '07';

const KWP_FORM_PREFIXES: Record<KwpFormSubmissionDetailType, string> = {
  KWP01: 'F01',
  KWP02: 'F02',
  KWP03: 'F03',
  KWP04: 'F04',
  KWP05: 'F05',
};

const KWP_REGION_CODES: Record<string, KwpSubmissionRegionCode> = {
  ภาคตะวันตก: '02',
  ภาคตะวันออก: '03',
  ภาคเหนือ: '04',
  ภาคใต้: '05',
  ภาคตะวันออกเฉียงเหนือ: '06',
  ภาคกลาง: '07',
};

const VALID_REGION_CODES = new Set<KwpSubmissionRegionCode>(Object.values(KWP_REGION_CODES));

export function kwpFormPrefix(formType: KwpFormSubmissionDetailType): string {
  return KWP_FORM_PREFIXES[formType];
}

export function kwpRegionCode(
  regionName: string | null | undefined,
): KwpSubmissionRegionCode | null {
  if (!regionName) return null;
  return KWP_REGION_CODES[regionName.trim()] ?? null;
}

export function buddhistYearInBangkok(date = new Date()): string {
  const gregorianYear = Number(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Bangkok',
      year: 'numeric',
    }).format(date),
  );
  return String(gregorianYear + 543);
}

export function formatKwpFormSubmissionNo(
  formType: KwpFormSubmissionDetailType,
  regionCode: KwpSubmissionRegionCode,
  sequence: number,
  buddhistYear: string,
): string {
  if (!VALID_REGION_CODES.has(regionCode)) {
    throw new RangeError('KWP submission region code is invalid');
  }
  if (!Number.isInteger(sequence) || sequence < 1 || sequence > 9_999) {
    throw new RangeError('KWP submission sequence must be between 1 and 9999');
  }
  if (!/^\d{4}$/.test(buddhistYear)) {
    throw new RangeError('KWP submission Buddhist year must contain four digits');
  }

  return `${kwpFormPrefix(formType)}-${regionCode}-${String(sequence).padStart(4, '0')}/${buddhistYear}`;
}
