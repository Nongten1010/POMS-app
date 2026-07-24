import type { KwpFormSubmissionDetailType } from './kwp-form-submissions.types';
import {
  formatRegionalDocumentNumber,
  regionalDocumentRegionCode,
  type RegionalDocumentRegionCode,
} from '../../shared/utils/regional-document-number';

export type KwpSubmissionRegionCode = RegionalDocumentRegionCode;

const KWP_FORM_PREFIXES: Record<KwpFormSubmissionDetailType, string> = {
  KWP01: 'F01',
  KWP02: 'F02',
  KWP03: 'F03',
  KWP04: 'F04',
  KWP05: 'F05',
};

export function kwpFormPrefix(formType: KwpFormSubmissionDetailType): string {
  return KWP_FORM_PREFIXES[formType];
}

export function kwpRegionCode(
  regionName: string | null | undefined,
): KwpSubmissionRegionCode | null {
  return regionalDocumentRegionCode(regionName);
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
  return formatRegionalDocumentNumber(kwpFormPrefix(formType), regionCode, sequence, buddhistYear);
}
