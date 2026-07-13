import { describe, expect, it } from '@jest/globals';
import {
  deriveHasEiaFromAssessment,
  resolveStoredConnectionRequestEia,
} from '../../src/modules/connection-requests/connection-request-eia';
import { toRequestRowForTests } from '../../src/modules/connection-requests/connection-requests.repository';

describe('connection request environmental assessment snapshot', () => {
  it.each([
    ['ไม่มี', false],
    ['มี', true],
    ['มี IEE', true],
    ['มี EIA', true],
    ['มี EHIA', true],
    ['อื่นๆ', false],
  ] as const)('derives hasEia from %s', (assessment, expected) => {
    expect(deriveHasEiaFromAssessment(assessment)).toBe(expected);
  });

  it('returns the exact stored assessment and Other detail for edit responses', () => {
    expect(
      resolveStoredConnectionRequestEia({
        eiaAssessment: 'อื่นๆ',
        eiaOther: 'รายงานสิ่งแวดล้อมประเภทเฉพาะ',
        hasEia: 0,
      }),
    ).toEqual({
      eia: 'อื่นๆ',
      eiaOther: 'รายงานสิ่งแวดล้อมประเภทเฉพาะ',
      hasEia: false,
    });
  });

  it('uses a valid categorical assessment as the source of truth for hasEia', () => {
    expect(
      resolveStoredConnectionRequestEia({
        eiaAssessment: 'มี EIA',
        eiaOther: null,
        hasEia: false,
      }),
    ).toEqual({
      eia: 'มี EIA',
      eiaOther: null,
      hasEia: true,
    });
  });

  it.each([
    [true, 'มี'],
    [false, 'ไม่มี'],
    [null, null],
  ] as const)('falls back for a legacy row whose hasEia is %s', (hasEia, expectedEia) => {
    expect(
      resolveStoredConnectionRequestEia({
        eiaAssessment: null,
        eiaOther: null,
        hasEia,
      }),
    ).toEqual({
      eia: expectedEia,
      eiaOther: null,
      hasEia,
    });
  });

  it('writes the exact assessment and Other detail to the request snapshot row', () => {
    const row = toRequestRowForTests({
      factoryId: 'FAC-001',
      factoryName: 'โรงงานทดสอบ',
      factoryRegistrationNo: 'REG-001',
      eia: 'อื่นๆ',
      eiaOther: 'รายงานสิ่งแวดล้อมประเภทเฉพาะ',
      hasEia: false,
      systemType: 'CEMS',
      contactName: 'ผู้ประสานงาน',
      contactPhone: '0812345678',
      measurementPoints: [],
    });

    expect(row).toEqual(
      expect.objectContaining({
        eia_assessment: 'อื่นๆ',
        eia_other: 'รายงานสิ่งแวดล้อมประเภทเฉพาะ',
        has_eia: false,
      }),
    );
  });

  it('clears Other detail when the assessment is not Other', () => {
    const row = toRequestRowForTests({
      factoryId: 'FAC-001',
      factoryName: 'โรงงานทดสอบ',
      factoryRegistrationNo: 'REG-001',
      eia: 'มี EIA',
      eiaOther: 'ข้อความที่ไม่ควรถูกบันทึก',
      hasEia: true,
      systemType: 'CEMS',
      contactName: 'ผู้ประสานงาน',
      contactPhone: '0812345678',
      measurementPoints: [],
    });

    expect(row).toEqual(
      expect.objectContaining({
        eia_assessment: 'มี EIA',
        eia_other: null,
        has_eia: true,
      }),
    );
  });
});
