import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockDb = jest.fn();

jest.mock('../../src/config/database', () => ({
  db: mockDb,
}));

import { monitoringPointFormsRepository } from '../../src/modules/monitoring-point-forms/monitoring-point-forms.repository';

describe('monitoringPointFormsRepository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns stored project fields when loading a monitoring point form', async () => {
    const formQuery = {
      where: jest.fn().mockReturnThis(),
      whereNull: jest.fn().mockReturnThis(),
      first: jest.fn<() => Promise<Record<string, unknown>>>().mockResolvedValue({
        id: 12,
        factory_name: 'โรงงานตัวอย่าง',
        factory_registration_no_new: '10180000125417',
        factory_registration_no_old: null,
        province_name: 'ชัยนาท',
        factory_type_main: null,
        factory_type_sub: null,
        operation_status: 'แจ้งประกอบแล้ว',
        eia_info: 'อื่นๆ',
        eia_other: 'รายงานสิ่งแวดล้อมประเภทเฉพาะ',
        project_name: 'โครงการขยายกำลังผลิต',
        address: null,
        business_activity: null,
        machinery_horsepower: null,
        latitude: null,
        longitude: null,
        created_at: '2026-07-22T00:00:00.000Z',
        updated_at: '2026-07-22T00:00:00.000Z',
      }),
    };
    const pointsQuery = {
      where: jest.fn().mockReturnThis(),
      whereNull: jest.fn().mockReturnThis(),
      orderBy: jest.fn<() => Promise<never[]>>().mockResolvedValue([]),
    };

    mockDb.mockImplementation((tableName: unknown) => {
      if (tableName === 'factory_monitoring_point_forms') return formQuery;
      if (tableName === 'factory_monitoring_points') return pointsQuery;
      throw new Error(`Unexpected table: ${String(tableName)}`);
    });

    const result = await monitoringPointFormsRepository.findById(12);

    expect(result?.factory).toMatchObject({
      eiaInfo: 'อื่นๆ',
      eiaOther: 'รายงานสิ่งแวดล้อมประเภทเฉพาะ',
      projectName: 'โครงการขยายกำลังผลิต',
    });
  });

  it('persists project fields when creating a monitoring point form', async () => {
    const insert = jest.fn().mockReturnThis();
    const insertQuery = {
      insert,
      returning: jest.fn<() => Promise<Array<{ id: number }>>>().mockResolvedValue([{ id: 12 }]),
    };
    const formQuery = {
      where: jest.fn().mockReturnThis(),
      whereNull: jest.fn().mockReturnThis(),
      first: jest.fn<() => Promise<Record<string, unknown>>>().mockResolvedValue({
        id: 12,
        factory_name: null,
        factory_registration_no_new: null,
        factory_registration_no_old: null,
        province_name: null,
        factory_type_main: null,
        factory_type_sub: null,
        operation_status: null,
        eia_info: 'อื่นๆ',
        eia_other: 'รายงานสิ่งแวดล้อมประเภทเฉพาะ',
        project_name: 'โครงการขยายกำลังผลิต',
        address: null,
        business_activity: null,
        machinery_horsepower: null,
        latitude: null,
        longitude: null,
        created_at: '2026-07-22T00:00:00.000Z',
        updated_at: '2026-07-22T00:00:00.000Z',
      }),
    };
    const pointsQuery = {
      where: jest.fn().mockReturnThis(),
      whereNull: jest.fn().mockReturnThis(),
      orderBy: jest.fn<() => Promise<never[]>>().mockResolvedValue([]),
    };
    let formQueryCount = 0;
    const trx = jest.fn((tableName: string) => {
      if (tableName === 'factory_monitoring_point_forms') {
        formQueryCount += 1;
        return formQueryCount === 1 ? insertQuery : formQuery;
      }
      if (tableName === 'factory_monitoring_points') return pointsQuery;
      throw new Error(`Unexpected table: ${tableName}`);
    });
    Object.assign(mockDb, {
      transaction: jest.fn((callback: (transaction: typeof trx) => unknown) => callback(trx)),
    });

    await monitoringPointFormsRepository.create(
      {
        factory: {
          eiaInfo: 'อื่นๆ',
          eiaOther: 'รายงานสิ่งแวดล้อมประเภทเฉพาะ',
          projectName: 'โครงการขยายกำลังผลิต',
        },
        points: [],
      },
      7,
    );

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        eia_info: 'อื่นๆ',
        eia_other: 'รายงานสิ่งแวดล้อมประเภทเฉพาะ',
        project_name: 'โครงการขยายกำลังผลิต',
      }),
    );
  });

  it('selects project fields for monitoring point form summaries', async () => {
    const groupBy = jest.fn().mockReturnThis();
    const select = jest.fn().mockReturnThis();
    const query = {
      whereNull: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      groupBy,
      select,
      orderBy: jest.fn().mockReturnThis(),
      then: jest.fn((resolve: (rows: never[]) => unknown) => Promise.resolve(resolve([]))),
    };
    mockDb.mockReturnValue(query);
    Object.assign(mockDb, { raw: jest.fn() });

    await monitoringPointFormsRepository.list({});

    expect(groupBy.mock.calls[0]).toEqual(
      expect.arrayContaining(['f.eia_other', 'f.project_name']),
    );
    expect(select.mock.calls[0]?.[0]).toEqual(
      expect.arrayContaining(['f.eia_other', 'f.project_name']),
    );
  });
});
