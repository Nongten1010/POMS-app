import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockDb = jest.fn();

jest.mock('../../src/config/database', () => ({
  db: mockDb,
}));

import { eligibleFactoriesRepository } from '../../src/modules/eligible-factories/eligible-factories.repository';

describe('eligibleFactoriesRepository monitoring-point-form synchronization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.assign(mockDb, { fn: { now: jest.fn(() => 'NOW') } });
  });

  it('preserves current project and EIA fields when the form omits them', async () => {
    const update = jest
      .fn<(payload: Record<string, unknown>) => Promise<number>>()
      .mockResolvedValue(1);
    const updateQuery = {
      where: jest.fn().mockReturnThis(),
      whereNull: jest.fn().mockReturnThis(),
      update,
    };
    const findQuery = {
      where: jest.fn().mockReturnThis(),
      whereNull: jest.fn().mockReturnThis(),
      first: jest.fn<() => Promise<null>>().mockResolvedValue(null),
    };
    mockDb.mockReturnValueOnce(updateQuery).mockReturnValueOnce(findQuery);

    await eligibleFactoriesRepository.updateFromMonitoringPointForm(
      88,
      {
        factoryName: 'โรงงานตัวอย่าง',
        factoryRegistrationNoNew: '10180000125417',
        provinceName: 'ชัยนาท',
        operationStatus: 'แจ้งประกอบแล้ว',
      },
      42,
    );

    const updatePayload = update.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(updatePayload).not.toHaveProperty('eia_assessment');
    expect(updatePayload).not.toHaveProperty('eia_other');
    expect(updatePayload).not.toHaveProperty('has_eia');
    expect(updatePayload).not.toHaveProperty('project_name');
  });

  it('updates explicit project and EIA fields as one consistent patch', async () => {
    const update = jest
      .fn<(payload: Record<string, unknown>) => Promise<number>>()
      .mockResolvedValue(1);
    const updateQuery = {
      where: jest.fn().mockReturnThis(),
      whereNull: jest.fn().mockReturnThis(),
      update,
    };
    const findQuery = {
      where: jest.fn().mockReturnThis(),
      whereNull: jest.fn().mockReturnThis(),
      first: jest.fn<() => Promise<null>>().mockResolvedValue(null),
    };
    mockDb.mockReturnValueOnce(updateQuery).mockReturnValueOnce(findQuery);

    await eligibleFactoriesRepository.updateFromMonitoringPointForm(
      88,
      {
        factoryName: 'โรงงานตัวอย่าง',
        factoryRegistrationNoNew: '10180000125417',
        provinceName: 'ชัยนาท',
        operationStatus: 'แจ้งประกอบแล้ว',
        eia: 'อื่นๆ',
        eiaOther: 'รายงานสิ่งแวดล้อมประเภทเฉพาะ',
        hasEia: false,
        projectName: 'โครงการขยายกำลังผลิต',
      },
      42,
    );

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        eia_assessment: 'อื่นๆ',
        eia_other: 'รายงานสิ่งแวดล้อมประเภทเฉพาะ',
        has_eia: false,
        project_name: 'โครงการขยายกำลังผลิต',
      }),
    );
  });
});
