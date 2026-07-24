import { describe, expect, it } from '@jest/globals';
import {
  buddhistCalendarYear,
  formatAnnualPointCode,
  isAnnualMonitoringPointCode,
  parseAnnualPointCodeSequence,
} from '../../src/shared/utils/monitoring-point-code';

describe('annual monitoring point code', () => {
  it('formats the accepted CEMS and WPMS examples', () => {
    expect(formatAnnualPointCode('CEMS', 1, '2569')).toBe('CEMS-0001/2569');
    expect(formatAnnualPointCode('WPMS', 3, '2571')).toBe('WEMS-0003/2571');
  });

  it('uses the Buddhist calendar year in the Asia/Bangkok time zone', () => {
    expect(buddhistCalendarYear(new Date('2026-12-31T16:59:59.000Z'))).toBe('2569');
    expect(buddhistCalendarYear(new Date('2026-12-31T17:00:00.000Z'))).toBe('2570');
  });

  it('parses only the requested system and year', () => {
    expect(parseAnnualPointCodeSequence('WEMS-0021/2569', 'WPMS', '2569')).toBe(21);
    expect(parseAnnualPointCodeSequence('WEMS-0021/2570', 'WPMS', '2569')).toBeNull();
    expect(parseAnnualPointCodeSequence('W2001', 'WPMS', '2569')).toBeNull();
    expect(parseAnnualPointCodeSequence('WEMS-0021/2569', 'WPMS', '.*')).toBeNull();
  });

  it('recognizes only the strict annual point-code shape', () => {
    expect(isAnnualMonitoringPointCode('CEMS-0001/2569')).toBe(true);
    expect(isAnnualMonitoringPointCode('WEMS-0003/2571')).toBe(true);
    expect(isAnnualMonitoringPointCode('CEMS-1/2569')).toBe(false);
    expect(isAnnualMonitoringPointCode('WEMS-0003/71')).toBe(false);
  });

  it('rejects invalid sequence and year inputs before formatting', () => {
    expect(() => formatAnnualPointCode('CEMS', 0, '2569')).toThrow(
      'Monitoring point-code sequence must be a positive integer',
    );
    expect(() => formatAnnualPointCode('WPMS', 1, '69')).toThrow(
      'Monitoring point-code Buddhist year must contain four digits',
    );
  });
});
