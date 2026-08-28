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

  it('accepts only factory type 88 input for the ERC category scope', async () => {
    const access = { actorUserId: 88, scope: { scope: 'FACTORY_TYPE_88' } } as never;

    await expect(
      monitoringPointFormsRepository.canAccessFactory(
        { factoryTypeMain: '88', provinceName: 'ระยอง' } as never,
        access,
      ),
    ).resolves.toBe(true);
    await expect(
      monitoringPointFormsRepository.canAccessFactory(
        { factoryTypeMain: '89', provinceName: 'ระยอง' } as never,
        access,
      ),
    ).resolves.toBe(false);
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

  it('projects the frontend monitoring-point fields from details JSON when loading a form', async () => {
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
        operation_status: null,
        eia_info: null,
        eia_other: null,
        project_name: null,
        address: null,
        business_activity: null,
        machinery_horsepower: null,
        latitude: null,
        longitude: null,
        created_at: '2026-08-06T00:00:00.000Z',
        updated_at: '2026-08-06T00:00:00.000Z',
      }),
    };
    const pointsQuery = {
      where: jest.fn().mockReturnThis(),
      whereNull: jest.fn().mockReturnThis(),
      orderBy: jest.fn<() => Promise<Array<Record<string, unknown>>>>().mockResolvedValue([
        {
          id: 99,
          form_id: 12,
          system_type: 'CEMS',
          point_code: 'S0001',
          point_name: 'ปล่องหลัก',
          production_unit_type: null,
          production_capacity: null,
          cems_installation_required_by: null,
          cems_installation_required_other: null,
          legal_annex_no: null,
          accounting_connection_status: null,
          eligible_parameters_json: '[]',
          exempted_parameters_json: '[]',
          connected_parameters_json: '[]',
          pending_parameters_json: '[]',
          primary_fuel: null,
          primary_fuel_other: null,
          secondary_fuel: null,
          secondary_fuel_other: null,
          attachment_links_json: JSON.stringify([
            { label: 'เอกสารอ้างอิง', url: 'https://example.com/reference' },
            { label: 'ใช้ไม่ได้', url: 'ftp://example.com/reference' },
          ]),
          details_json: JSON.stringify({
            legacyField: 'kept',
            timeSharingParameters: ['NOx (ppm)'],
            sharedStackCode: 'S0002',
            monitoringPointStatus: 'อยู่ระหว่างเชื่อมต่อ',
            attachmentLinks: 'legacy duplicate must be stripped',
            attachments: { legacy: true },
          }),
          created_at: '2026-08-06T00:00:00.000Z',
          updated_at: '2026-08-06T00:00:00.000Z',
        },
        {
          id: 100,
          form_id: 12,
          system_type: 'CEMS',
          point_code: 'S0002',
          point_name: 'ปล่องร่วม',
          production_unit_type: null,
          production_capacity: null,
          cems_installation_required_by: null,
          cems_installation_required_other: null,
          legal_annex_no: null,
          accounting_connection_status: null,
          eligible_parameters_json: '[]',
          exempted_parameters_json: '[]',
          connected_parameters_json: '[]',
          pending_parameters_json: '[]',
          primary_fuel: null,
          primary_fuel_other: null,
          secondary_fuel: null,
          secondary_fuel_other: null,
          attachment_links_json: 'malformed legacy value',
          details_json: JSON.stringify({
            timeSharingParameters: ' SO2 (ppm), ไม่มี ',
            sharedStackCode: ' S0001 ',
            monitoringPointStatus: 'สถานะที่ไม่รองรับ',
            attachmentLinks: 'https://legacy.example.com/reference',
            attachments: { fileName: 'legacy.pdf' },
          }),
          created_at: '2026-08-06T00:00:00.000Z',
          updated_at: '2026-08-06T00:00:00.000Z',
        },
      ]),
    };

    mockDb.mockImplementation((tableName: unknown) => {
      if (tableName === 'factory_monitoring_point_forms') return formQuery;
      if (tableName === 'factory_monitoring_points') return pointsQuery;
      if (tableName === 'factory_monitoring_point_attachments') {
        return {
          whereIn: jest.fn().mockReturnThis(),
          whereNotNull: jest.fn().mockReturnThis(),
          whereNull: jest.fn().mockReturnThis(),
          then: jest.fn((resolve: (rows: Array<Record<string, unknown>>) => unknown) =>
            Promise.resolve(
              resolve([
                {
                  id: 501,
                  public_id: 'f338ba40-a4ea-4cb8-87e4-fbe225394cb3',
                  claim_token_hash: Buffer.alloc(32, 1),
                  monitoring_point_id: 99,
                  original_file_name: 'document.pdf',
                  mime_type: 'application/pdf',
                  file_size: 1024,
                  storage_path: '.private/monitoring-point-forms/attachments/2026/08/document.pdf',
                  sort_order: 1,
                  expires_at: '2026-08-12T00:00:00.000Z',
                  claimed_at: '2026-08-11T00:00:00.000Z',
                  created_at: '2026-08-11T00:00:00.000Z',
                  updated_at: '2026-08-11T00:00:00.000Z',
                  created_by: 1,
                  updated_by: 1,
                  deleted_at: null,
                },
              ]),
            ),
          ),
        };
      }
      throw new Error(`Unexpected table: ${String(tableName)}`);
    });

    const result = await monitoringPointFormsRepository.findById(12);

    expect(result?.points[0]).toMatchObject({
      timeSharingParameters: ['NOx (ppm)'],
      sharedStackCode: 'S0002',
      monitoringPointStatus: 'อยู่ระหว่างเชื่อมต่อ',
      attachmentLinks: [{ label: 'เอกสารอ้างอิง', url: 'https://example.com/reference' }],
      attachments: [
        {
          id: 501,
          fileName: 'document.pdf',
          fileType: 'application/pdf',
          fileSize: 1024,
          fileUrl: expect.any(String),
          fileUrlExpiresAt: expect.any(String),
        },
      ],
      details: expect.objectContaining({ legacyField: 'kept' }),
    });
    expect(result?.points[1]).toMatchObject({
      timeSharingParameters: ['SO2 (ppm)', 'ไม่มี'],
      sharedStackCode: null,
      monitoringPointStatus: null,
      attachmentLinks: [],
      attachments: [],
    });
    expect(result?.points[0]?.details).not.toHaveProperty('attachmentLinks');
    expect(result?.points[0]?.details).not.toHaveProperty('attachments');
    expect(result?.points[1]?.details).not.toHaveProperty('attachmentLinks');
    expect(result?.points[1]?.details).not.toHaveProperty('attachments');
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

  it('stores typed point fields and attachment links outside details JSON when creating a form', async () => {
    const pointInsert = jest.fn().mockReturnThis();
    const pointInsertQuery = {
      insert: pointInsert,
      returning: jest.fn<() => Promise<Array<{ id: number }>>>().mockResolvedValue([{ id: 99 }]),
    };
    const formInsertQuery = {
      insert: jest.fn().mockReturnThis(),
      returning: jest.fn<() => Promise<Array<{ id: number }>>>().mockResolvedValue([{ id: 12 }]),
    };
    const formReadQuery = {
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
        eia_info: null,
        eia_other: null,
        project_name: null,
        address: null,
        business_activity: null,
        machinery_horsepower: null,
        latitude: null,
        longitude: null,
        created_at: '2026-08-06T00:00:00.000Z',
        updated_at: '2026-08-06T00:00:00.000Z',
      }),
    };
    const pointReadQuery = {
      where: jest.fn().mockReturnThis(),
      whereNull: jest.fn().mockReturnThis(),
      orderBy: jest.fn<() => Promise<never[]>>().mockResolvedValue([]),
    };
    let formQueryCount = 0;
    let pointQueryCount = 0;
    const trx = jest.fn((tableName: string) => {
      if (tableName === 'factory_monitoring_point_forms') {
        formQueryCount += 1;
        return formQueryCount === 1 ? formInsertQuery : formReadQuery;
      }
      if (tableName === 'factory_monitoring_points') {
        pointQueryCount += 1;
        return pointQueryCount === 1 ? pointInsertQuery : pointReadQuery;
      }
      throw new Error(`Unexpected table: ${tableName}`);
    });
    Object.assign(mockDb, {
      transaction: jest.fn((callback: (transaction: typeof trx) => unknown) => callback(trx)),
    });

    await monitoringPointFormsRepository.create(
      {
        factory: {},
        points: [
          {
            systemType: 'CEMS',
            pointCode: 'S0001',
            timeSharingParameters: ['NOx (ppm)'],
            sharedStackCode: 'S0002',
            monitoringPointStatus: 'อยู่ระหว่างเชื่อมต่อ',
            attachmentLinks: [{ label: 'เอกสารอ้างอิง', url: 'https://example.com/reference' }],
            details: {
              legacyField: 'kept',
              attachmentLinks: 'must not persist here',
              attachments: { mustNotPersist: true },
            },
          },
        ],
      },
      7,
    );

    expect(pointInsert).toHaveBeenCalledTimes(1);
    const insertedRow = pointInsert.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(JSON.parse(String(insertedRow.details_json))).toEqual({
      legacyField: 'kept',
      timeSharingParameters: ['NOx (ppm)'],
      sharedStackCode: 'S0002',
      monitoringPointStatus: 'อยู่ระหว่างเชื่อมต่อ',
    });
    expect(JSON.parse(String(insertedRow.attachment_links_json))).toEqual([
      { label: 'เอกสารอ้างอิง', url: 'https://example.com/reference' },
    ]);
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
