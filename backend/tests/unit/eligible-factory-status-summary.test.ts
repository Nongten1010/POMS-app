import { describe, expect, it } from '@jest/globals';
import { deriveConnectionStatusSummary } from '../../src/modules/eligible-factories/eligible-factory-status-summary';

describe('deriveConnectionStatusSummary', () => {
  it('returns เชื่อมต่อครบถ้วน when every point in the requested system is connected', () => {
    expect(
      deriveConnectionStatusSummary(
        [
          { systemType: 'CEMS', monitoringPointStatus: 'เชื่อมต่อครบแล้ว' },
          { systemType: 'WPMS', monitoringPointStatus: 'อยู่ระหว่างเชื่อมต่อ' },
          { systemType: 'CEMS', monitoringPointStatus: 'เชื่อมต่อครบแล้ว' },
        ],
        'CEMS',
      ),
    ).toBe('เชื่อมต่อครบถ้วน');
  });

  it('returns ได้รับยกเว้นทั้งหมด when every point in the requested system is exempted', () => {
    expect(
      deriveConnectionStatusSummary(
        [
          { systemType: 'WPMS', monitoringPointStatus: 'ได้รับการยกเว้นทั้งหมด' },
          { systemType: 'WPMS', monitoringPointStatus: 'ได้รับการยกเว้นทั้งหมด' },
        ],
        'WPMS',
      ),
    ).toBe('ได้รับยกเว้นทั้งหมด');
  });

  it('returns ยังไม่แล้วเสร็จ for mixed, missing, or empty system statuses', () => {
    const cases = [
      [
        { systemType: 'CEMS' as const, monitoringPointStatus: 'เชื่อมต่อครบแล้ว' },
        { systemType: 'CEMS' as const, monitoringPointStatus: 'อยู่ระหว่างเชื่อมต่อ' },
      ],
      [{ systemType: 'CEMS' as const, monitoringPointStatus: null }],
      [{ systemType: 'WPMS' as const, monitoringPointStatus: 'เชื่อมต่อครบแล้ว' }],
      [],
    ];

    cases.forEach((points) => {
      expect(deriveConnectionStatusSummary(points, 'CEMS')).toBe('ยังไม่แล้วเสร็จ');
    });
  });
});
