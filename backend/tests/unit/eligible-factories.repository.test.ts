import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockDb = jest.fn();
const mockFactorySourceDb = jest.fn();

jest.mock('../../src/config/database', () => ({
  db: mockDb,
}));

jest.mock('../../src/config/env', () => ({
  env: {
    FACTORY_DB_SCHEMA: 'dbo',
    API_PREFIX: '/api/v1',
    JWT_SECRET: 'eligible-factory-repository-test-secret',
  },
}));

jest.mock('../../src/config/factory-source-database', () => ({
  factorySourceDb: mockFactorySourceDb,
  factorySourceTableName: jest.fn(() => 'dbo.fac_import'),
}));

import { eligibleFactoriesRepository } from '../../src/modules/eligible-factories/eligible-factories.repository';
import {
  resolveEligibleFactoryAddressForStorage,
  resolveEligibleFactoryIndustrialEstateForStorage,
} from '../../src/modules/eligible-factories/eligible-factory-source-hydration';

describe('eligibleFactoriesRepository.list', () => {
  const selectedFactoryRow = {
    id: 795,
    source_system: 'monitoring_point_forms',
    source_factory_id: '10180000125417',
    monitoring_point_form_id: null as number | string | null,
    factory_registration_no_new: '10180000125417',
    factory_registration_no_old: null,
    factory_name: 'โรงงานทดสอบ',
    factory_type_sequence: '02203',
    address: '197 หมู่ 5 ตำบล7 อำเภอ4 17150',
    province_name: 'ชัยนาท',
    industrial_estate_name: null,
    latitude: null,
    longitude: null,
    business_activity: null,
    operation_status: 'แจ้งประกอบแล้ว',
    capital_amount: null,
    machinery_horsepower: 10,
    production_capacity: null,
    wastewater_discharge_info: null,
    boiler_count: null,
    boiler_size_each: null,
    fuel_used: null,
    eia_assessment: null as string | null,
    eia_other: null as string | null,
    project_name: null as string | null,
    has_eia: null as boolean | null,
    selected_reason: null,
    selected_by: 1,
    selected_at: '2026-07-13T00:00:00.000Z',
    created_at: '2026-07-13T00:00:00.000Z',
    updated_at: '2026-07-13T00:00:00.000Z',
  };
  let selectedRowForTest = { ...selectedFactoryRow };
  let monitoringPointRowsForTest: Array<Record<string, unknown>> = [];
  let monitoringPointAttachmentRowsForTest: Array<Record<string, unknown>> = [];

  beforeEach(() => {
    jest.clearAllMocks();
    selectedRowForTest = { ...selectedFactoryRow };
    monitoringPointRowsForTest = [];
    monitoringPointAttachmentRowsForTest = [];

    const countQuery = {
      clearSelect: jest.fn().mockReturnThis(),
      clearOrder: jest.fn().mockReturnThis(),
      count: jest.fn().mockReturnThis(),
      first: jest.fn<() => Promise<{ total: number }>>().mockResolvedValue({ total: 1 }),
    };
    const rowsQuery = {
      orderBy: jest.fn().mockReturnThis(),
      then: jest.fn((resolve: (rows: (typeof selectedFactoryRow)[]) => unknown) =>
        Promise.resolve(resolve([selectedRowForTest])),
      ),
    };
    const baseQuery = {
      whereNull: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      clone: jest.fn().mockReturnValueOnce(countQuery).mockReturnValueOnce(rowsQuery),
    };

    mockDb.mockImplementation((tableName: unknown) => {
      if (tableName === 'eligible_factories' || tableName === 'eligible_factories as ef') {
        return baseQuery;
      }
      if (tableName === 'factory_monitoring_points') {
        return {
          whereIn: jest.fn().mockReturnThis(),
          whereNull: jest.fn().mockReturnThis(),
          orderBy: jest.fn().mockReturnThis(),
          then: jest.fn((resolve: (rows: Array<Record<string, unknown>>) => unknown) =>
            Promise.resolve(resolve(monitoringPointRowsForTest)),
          ),
        };
      }
      if (tableName === 'factory_monitoring_point_attachments') {
        return {
          whereIn: jest.fn().mockReturnThis(),
          whereNotNull: jest.fn().mockReturnThis(),
          whereNull: jest.fn().mockReturnThis(),
          then: jest.fn((resolve: (rows: Array<Record<string, unknown>>) => unknown) =>
            Promise.resolve(resolve(monitoringPointAttachmentRowsForTest)),
          ),
        };
      }
      throw new Error(`Unexpected local table: ${String(tableName)}`);
    });

    const sourceWhereBuilder = {
      whereIn: jest.fn().mockReturnThis(),
      orWhereIn: jest.fn().mockReturnThis(),
    };
    const facImportQuery = {
      where: jest.fn((callback: (builder: typeof sourceWhereBuilder) => void) => {
        callback(sourceWhereBuilder);
        return facImportQuery;
      }),
      timeout: jest.fn().mockReturnThis(),
      select: jest
        .fn<(...columns: string[]) => Promise<Array<Record<string, unknown>>>>()
        .mockResolvedValue([
          {
            FID: '10180000125417',
            FACREG: '10180000125417',
            DISPFACREG: '3-22(3)-1/41ชน',
            FADDR: '197',
            FMOO: '5',
            SOI: null,
            ROAD: null,
            PROV: 18,
            AMP: 4,
            TUMBOL: 7,
            ZIPCODE: '17150',
            COLONY_INDUST_CODE: 'IE-01',
          },
        ]),
    };
    const administrativeAreaQuery = {
      whereIn: jest.fn().mockReturnThis(),
      timeout: jest.fn().mockReturnThis(),
      select: jest
        .fn<(...columns: string[]) => Promise<Array<Record<string, unknown>>>>()
        .mockResolvedValue([
          {
            PROV: 18,
            AMP: 4,
            TUMBOL: 7,
            TUMNAME: 'หาดอาษา',
            AMPNAME: 'สรรพยา',
          },
        ]),
    };
    const industrialEstateQuery = {
      where: jest.fn().mockReturnThis(),
      timeout: jest.fn().mockReturnThis(),
      select: jest
        .fn<(...columns: string[]) => Promise<Array<Record<string, unknown>>>>()
        .mockResolvedValue([
          {
            COLONY_INDUST_CODE: 'IE-01',
            COLONY_INDUST_DESC: 'นิคมอุตสาหกรรมมาบตาพุด',
          },
        ]),
    };

    mockFactorySourceDb.mockImplementation((tableName: unknown) => {
      if (tableName === 'dbo.fac_import') return facImportQuery;
      if (tableName === 'dbo.TUMBOL') return administrativeAreaQuery;
      if (tableName === 'dbo.FAC_COLONY_INDUST') return industrialEstateQuery;
      throw new Error(`Unexpected factory-source table: ${String(tableName)}`);
    });
  });

  it('resolves selected-factory address names from FAC_IMPORT and TUMBOL', async () => {
    const result = await eligibleFactoriesRepository.list({});

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.address).toBe('197 หมู่ 5 ตำบลหาดอาษา อำเภอสรรพยา จังหวัดชัยนาท 17150');
  });

  it('returns the synchronized EIA assessment and project name from eligible factory data', async () => {
    selectedRowForTest = {
      ...selectedFactoryRow,
      eia_assessment: 'มี EHIA',
      eia_other: null,
      project_name: 'โครงการขยายกำลังผลิต',
      has_eia: true,
    };

    const result = await eligibleFactoriesRepository.list({});

    expect(result.rows[0]).toMatchObject({
      eia: 'มี EHIA',
      eiaOther: null,
      hasEia: true,
      projectName: 'โครงการขยายกำลังผลิต',
    });
  });

  it('hydrates the frontend monitoring-point fields from details JSON', async () => {
    selectedRowForTest = {
      ...selectedFactoryRow,
      monitoring_point_form_id: 12,
    };
    monitoringPointRowsForTest = [
      {
        id: 91,
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
          { label: 'invalid', url: 'ftp://example.com/reference' },
        ]),
        details_json: JSON.stringify({
          timeSharingParameters: ['NOx (ppm)'],
          sharedStackCode: 'S0002',
          monitoringPointStatus: 'เชื่อมต่อครบแล้ว',
          attachmentLinks: 'legacy duplicate must be stripped',
          attachments: { legacy: true },
        }),
      },
      {
        id: 92,
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
      },
    ];
    monitoringPointAttachmentRowsForTest = [
      {
        id: 501,
        public_id: 'f338ba40-a4ea-4cb8-87e4-fbe225394cb3',
        claim_token_hash: Buffer.alloc(32, 1),
        monitoring_point_id: 91,
        original_file_name: 'document.png',
        mime_type: 'image/png',
        file_size: 1024,
        storage_path: '.private/monitoring-point-forms/attachments/2026/08/document.png',
        sort_order: 1,
        expires_at: '2026-08-12T00:00:00.000Z',
        claimed_at: '2026-08-11T00:00:00.000Z',
        created_at: '2026-08-11T00:00:00.000Z',
        updated_at: '2026-08-11T00:00:00.000Z',
        created_by: 1,
        updated_by: 1,
        deleted_at: null,
      },
    ];

    const result = await eligibleFactoriesRepository.list({});

    expect(result.rows[0]?.measurementPoints?.[0]).toMatchObject({
      id: 91,
      timeSharingParameters: ['NOx (ppm)'],
      sharedStackCode: 'S0002',
      monitoringPointStatus: 'เชื่อมต่อครบแล้ว',
      attachmentLinks: [{ label: 'เอกสารอ้างอิง', url: 'https://example.com/reference' }],
      attachments: [
        {
          id: 501,
          fileName: 'document.png',
          fileType: 'image/png',
          fileSize: 1024,
          fileUrlExpiresAt: expect.any(String),
        },
      ],
    });
    expect(result.rows[0]?.measurementPoints?.[0]?.attachments[0]?.fileUrl).toMatch(
      /^\/api\/v1\/monitoring-point-forms\/attachments\/f338ba40-a4ea-4cb8-87e4-fbe225394cb3\/content\?expires=\d+&signature=/,
    );
    expect(result.rows[0]?.measurementPoints?.[0]?.details).not.toHaveProperty('attachmentLinks');
    expect(result.rows[0]?.measurementPoints?.[0]?.details).not.toHaveProperty('attachments');
    expect(result.rows[0]?.measurementPoints?.[1]).toMatchObject({
      id: 92,
      timeSharingParameters: ['SO2 (ppm)', 'ไม่มี'],
      sharedStackCode: null,
      monitoringPointStatus: null,
      attachmentLinks: [],
      attachments: [],
    });
    expect(result.rows[0]?.measurementPoints?.[1]?.details).not.toHaveProperty('attachmentLinks');
    expect(result.rows[0]?.measurementPoints?.[1]?.details).not.toHaveProperty('attachments');
  });

  it('preserves a readable address entered in the monitoring-point form', async () => {
    selectedRowForTest = {
      ...selectedFactoryRow,
      address: '197 หมู่ 5 ตำบลหาดอาษา อำเภอสรรพยา 17150 (ประตู 2)',
    };

    const result = await eligibleFactoriesRepository.list({});

    expect(result.rows[0]?.address).toBe(
      '197 หมู่ 5 ตำบลหาดอาษา อำเภอสรรพยา จังหวัดชัยนาท 17150 (ประตู 2)',
    );
  });

  it('omits numeric area codes when the TUMBOL master lookup is unavailable', async () => {
    mockFactorySourceDb.mockImplementation((tableName: unknown) => {
      if (tableName === 'dbo.fac_import') {
        const sourceWhereBuilder = {
          whereIn: jest.fn().mockReturnThis(),
          orWhereIn: jest.fn().mockReturnThis(),
        };
        const facImportQuery = {
          where: jest.fn((callback: (builder: typeof sourceWhereBuilder) => void) => {
            callback(sourceWhereBuilder);
            return facImportQuery;
          }),
          timeout: jest.fn().mockReturnThis(),
          select: jest
            .fn<(...columns: string[]) => Promise<Array<Record<string, unknown>>>>()
            .mockResolvedValue([
              {
                FID: '10180000125417',
                FACREG: '10180000125417',
                DISPFACREG: '3-22(3)-1/41ชน',
                FADDR: '197',
                FMOO: '5',
                SOI: null,
                ROAD: null,
                PROV: 18,
                AMP: 4,
                TUMBOL: 7,
                ZIPCODE: '17150',
              },
            ]),
        };
        return facImportQuery;
      }
      throw new Error('TUMBOL is unavailable');
    });

    const result = await eligibleFactoriesRepository.list({});

    expect(result.rows[0]?.address).toBe('197 หมู่ 5 จังหวัดชัยนาท 17150');
    expect(result.rows[0]?.address).not.toContain('ตำบล7');
    expect(result.rows[0]?.address).not.toContain('อำเภอ4');
  });

  it('falls back to the stored row when FAC_IMPORT cannot be queried', async () => {
    mockFactorySourceDb.mockImplementation(() => {
      throw new Error('FAC_IMPORT is unavailable');
    });

    const result = await eligibleFactoriesRepository.list({});

    expect(result.rows[0]?.address).toBe('197 หมู่ 5 ตำบล7 อำเภอ4 จังหวัดชัยนาท 17150');
  });

  it('resolves legacy numeric labels before persisting a form address', async () => {
    await expect(
      resolveEligibleFactoryAddressForStorage({
        sourceFactoryId: '10180000125417',
        factoryRegistrationNoNew: '10180000125417',
        address: '197 หมู่ 5 ตำบล7 อำเภอ4 17150 (ประตู 2)',
      }),
    ).resolves.toBe('197 หมู่ 5 ตำบลหาดอาษา อำเภอสรรพยา 17150 (ประตู 2)');
  });

  it('resolves the industrial estate description before persisting a selected factory', async () => {
    await expect(
      resolveEligibleFactoryIndustrialEstateForStorage({
        sourceFactoryId: '10180000125417',
        factoryRegistrationNoNew: '10180000125417',
      }),
    ).resolves.toBe('นิคมอุตสาหกรรมมาบตาพุด');
  });

  it('returns undefined instead of persisting numeric labels when names cannot be resolved', async () => {
    mockFactorySourceDb.mockImplementation((tableName: unknown) => {
      if (tableName === 'dbo.fac_import') {
        const sourceWhereBuilder = {
          whereIn: jest.fn().mockReturnThis(),
          orWhereIn: jest.fn().mockReturnThis(),
        };
        const query = {
          where: jest.fn((callback: (builder: typeof sourceWhereBuilder) => void) => {
            callback(sourceWhereBuilder);
            return query;
          }),
          timeout: jest.fn().mockReturnThis(),
          select: jest.fn().mockResolvedValue([
            {
              FID: '10180000125417',
              FACREG: '10180000125417',
              DISPFACREG: null,
              FADDR: '197',
              FMOO: '5',
              SOI: null,
              ROAD: null,
              PROV: 18,
              AMP: 4,
              TUMBOL: 7,
              ZIPCODE: '17150',
            },
          ] as never),
        };
        return query;
      }
      throw new Error('TUMBOL is unavailable');
    });

    await expect(
      resolveEligibleFactoryAddressForStorage({
        sourceFactoryId: '10180000125417',
        factoryRegistrationNoNew: '10180000125417',
        address: '197 หมู่ 5 ตำบล7 อำเภอ4 17150',
      }),
    ).resolves.toBeUndefined();
  });
});
