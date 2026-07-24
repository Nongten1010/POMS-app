import { describe, expect, it } from '@jest/globals';
import { formatBodCodDeviationReportNo } from '../../src/modules/bod-cod-deviations/bod-cod-deviation-report-number';

describe('BOD/COD deviation report numbers', () => {
  it.each([
    ['02', 1, 2569, 'Error-02-0001/2569'],
    ['03', 8, 2569, 'Error-03-0008/2569'],
    ['07', 9999, 2570, 'Error-07-9999/2570'],
  ] as const)('formats region %s sequence %s year %s', (regionCode, sequence, year, expected) => {
    expect(formatBodCodDeviationReportNo(regionCode, sequence, year)).toBe(expected);
  });
});
