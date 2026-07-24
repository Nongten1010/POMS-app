export type MonitoringSystemType = 'CEMS' | 'WPMS';
export type AnnualPointCodePrefix = 'CEMS' | 'WEMS';

const ANNUAL_POINT_CODE_PATTERN = /^(?:CEMS|WEMS)-\d{4,}\/\d{4}$/;

export function annualPointCodePrefix(systemType: MonitoringSystemType): AnnualPointCodePrefix {
  return systemType === 'CEMS' ? 'CEMS' : 'WEMS';
}

export function buddhistCalendarYear(date = new Date()): string {
  const gregorianYear = Number(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Bangkok',
      year: 'numeric',
    }).format(date),
  );
  return String(gregorianYear + 543);
}

export function formatAnnualPointCode(
  systemType: MonitoringSystemType,
  sequence: number,
  buddhistYear: string,
): string {
  if (!Number.isInteger(sequence) || sequence < 1) {
    throw new RangeError('Monitoring point-code sequence must be a positive integer');
  }
  if (!/^\d{4}$/.test(buddhistYear)) {
    throw new RangeError('Monitoring point-code Buddhist year must contain four digits');
  }

  return `${annualPointCodePrefix(systemType)}-${String(sequence).padStart(4, '0')}/${buddhistYear}`;
}

export function parseAnnualPointCodeSequence(
  pointCode: string | null,
  systemType: MonitoringSystemType,
  buddhistYear: string,
): number | null {
  if (!/^\d{4}$/.test(buddhistYear)) return null;

  const prefix = annualPointCodePrefix(systemType);
  const match = pointCode?.match(new RegExp(`^${prefix}-(\\d{4,})/${buddhistYear}$`));
  if (!match) return null;

  const sequence = Number(match[1]);
  return Number.isSafeInteger(sequence) && sequence > 0 ? sequence : null;
}

export function isAnnualMonitoringPointCode(value: string): boolean {
  return ANNUAL_POINT_CODE_PATTERN.test(value);
}
